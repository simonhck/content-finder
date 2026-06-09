import type {
  ContentFinderConfig,
  CriteriaType,
  SearchOperator,
  SearchParams,
  SortDirection,
} from "@/lib/sitecore/types"
import { normalizeGuid } from "@/lib/sitecore/guid"

/**
 * Builds the Authoring & Management GraphQL `search` query for a request.
 *
 * Design notes / safety:
 *  - All string literals are emitted via {@link gqlString} (JSON.stringify),
 *    which produces a valid, injection-safe GraphQL string literal.
 *  - Enum tokens (criteriaType, operator, direction) are emitted unquoted and
 *    only ever come from fixed allowlists, never from free user text.
 *  - Boolean grouping: a required OR-group (e.g. "match text in ANY field") is
 *    modelled as a `subStatements` entry whose `operator` is MUST and whose
 *    inner `criteria` use SHOULD. `subStatements` is emitted as a LIST — the
 *    most common shape for this schema. If the live endpoint types it as a
 *    single object, switch {@link renderSubStatements} to nest instead.
 *
 * Returns the query text plus the alias→fieldName map needed to read field
 * values back out of the response (see normalize.ts).
 */
export function buildSearchQuery(
  params: SearchParams,
  config: ContentFinderConfig,
): { query: string; fieldAliases: Record<string, string> } {
  const fieldsToSearch =
    params.fields.length > 0 ? params.fields : config.searchableFields

  // Fields whose values we want returned (for highlighting "why it matched").
  const returnFields = unique([...fieldsToSearch, ...config.searchableFields])
  const fieldAliases = buildFieldAliases(returnFields)

  const topCriteria: string[] = []
  const subStatements: string[] = []

  // --- Full-text. ---
  // We use CONTAINS (substring match) rather than SEARCH (whole-token match)
  // everywhere: SEARCH tokenizes ("simons-sai-playground" → simons/sai/playground),
  // so "simon" wouldn't match, whereas CONTAINS matches any substring, which is
  // what authors expect ("simon" finds "simons-…").
  //
  // When the user picks specific fields, match each of them (OR-group). When no
  // field is picked, search the index-wide aggregate `_content` field rather than
  // guessing template-specific field names: the index rejects the whole query if
  // a criterion references a field it doesn't know, and `_content` (a standard
  // computed field that concatenates all text fields) always exists.
  const text = params.text.trim()
  if (text) {
    if (params.fields.length > 0) {
      const orFields = params.fields.map((field) =>
        renderCriterion("CONTAINS", field, text, "SHOULD"),
      )
      subStatements.push(renderStatement("MUST", orFields))
    } else {
      topCriteria.push(renderCriterion("CONTAINS", "_content", text, "MUST"))
    }
  }

  // --- Scope: descendants of one or more search roots (`_path`). ---
  const roots = config.searchRoots
    .map((r) => normalizeGuid(r))
    .filter((r): r is string => r !== null)
  if (roots.length === 1) {
    topCriteria.push(renderCriterion("EXACT", "_path", roots[0], "MUST"))
  } else if (roots.length > 1) {
    const orRoots = roots.map((r) =>
      renderCriterion("EXACT", "_path", r, "SHOULD"),
    )
    subStatements.push(renderStatement("MUST", orRoots))
  }

  // --- Content-type filter: any of the selected templates (`_template`). ---
  const templates = params.templateIds
    .map((t) => normalizeGuid(t))
    .filter((t): t is string => t !== null)
  if (templates.length === 1) {
    topCriteria.push(
      renderCriterion("EXACT", "_template", templates[0], "MUST"),
    )
  } else if (templates.length > 1) {
    const orTemplates = templates.map((t) =>
      renderCriterion("EXACT", "_template", t, "SHOULD"),
    )
    subStatements.push(renderStatement("MUST", orTemplates))
  }

  // --- Tag filter: item must contain the selected tag GUID(s). ---
  const tags = params.tagIds
    .map((t) => normalizeGuid(t))
    .filter((t): t is string => t !== null)
  if (tags.length > 0) {
    if (params.tagMatch === "ALL") {
      for (const tag of tags) {
        topCriteria.push(
          renderCriterion("CONTAINS", config.tagField, tag, "MUST"),
        )
      }
    } else {
      const orTags = tags.map((tag) =>
        renderCriterion("CONTAINS", config.tagField, tag, "SHOULD"),
      )
      subStatements.push(renderStatement("MUST", orTags))
    }
  }

  const pageSize = clampInt(params.paging.pageSize, 1, 100, 20)
  const pageIndex = clampInt(params.paging.pageIndex, 0, 100000, 0)
  const skip = pageIndex * pageSize

  // `_score` is Solr's natural relevance order — emitting it as an explicit
  // sort field is unnecessary and not always accepted, so omit the sort clause
  // for the default relevance sort and only sort when a real field is chosen.
  const sortClause =
    params.sort.field && params.sort.field !== "_score"
      ? `\n      sort: { field: ${gqlString(params.sort.field)}, direction: ${sanitizeDirection(params.sort.direction)} }`
      : ""

  // Only include `subStatements` when there is at least one — an empty
  // `subStatements: []` makes the search resolver fail ("search service is not
  // available"), and none of Sitecore's documented examples emit it.
  const subStatementsClause =
    subStatements.length > 0
      ? `\n        subStatements: ${renderSubStatements(subStatements)}`
      : ""

  const fieldSelections = Object.entries(fieldAliases)
    .map(([alias, name]) => `${alias}: field(name: ${gqlString(name)}) { value }`)
    .join("\n          ")

  const query = `query ContentFinderSearch {
  search(
    query: {
      index: ${gqlString(config.index)}
      paging: { pageSize: ${pageSize}, skip: ${skip}, pageIndex: ${pageIndex} }${sortClause}
      searchStatement: {
        criteria: [
          ${topCriteria.join("\n          ")}
        ]${subStatementsClause}
      }
    }
  ) {
    results {
      innerItem {
        itemId
        name
        path
        template { name }
        language { name }
        __layout: field(name: "__Renderings") { value }
        __finalLayout: field(name: "__Final Renderings") { value }
        ${fieldSelections}
      }
    }
  }
}`

  return { query, fieldAliases }
}

const CRITERIA_TYPES: ReadonlySet<CriteriaType> = new Set([
  "SEARCH",
  "EXACT",
  "CONTAINS",
  "STARTSWITH",
  "ENDSWITH",
  "WILDCARD",
  "FUZZY",
])

const OPERATORS: ReadonlySet<SearchOperator> = new Set([
  "MUST",
  "MUST_NOT",
  "SHOULD",
])

function renderCriterion(
  criteriaType: CriteriaType,
  field: string,
  value: string,
  operator: SearchOperator,
): string {
  // Enum allowlist guard — defends against any accidental injection via enums.
  const type = CRITERIA_TYPES.has(criteriaType) ? criteriaType : "SEARCH"
  const op = OPERATORS.has(operator) ? operator : "MUST"
  return `{ criteriaType: ${type}, field: ${gqlString(field)}, value: ${gqlString(value)}, operator: ${op} }`
}

function renderStatement(operator: SearchOperator, criteria: string[]): string {
  const op = OPERATORS.has(operator) ? operator : "MUST"
  return `{ operator: ${op}, criteria: [ ${criteria.join(", ")} ] }`
}

function renderSubStatements(statements: string[]): string {
  if (statements.length === 0) {
    return "[]"
  }
  return `[ ${statements.join(", ")} ]`
}

/** Produces a valid, injection-safe GraphQL string literal. */
function gqlString(value: string): string {
  return JSON.stringify(value)
}

function sanitizeDirection(direction: SortDirection): SortDirection {
  return direction === "ASCENDING" ? "ASCENDING" : "DESCENDING"
}

/** Stable, collision-free aliases for the dynamic `field(name:)` selections. */
function buildFieldAliases(fields: string[]): Record<string, string> {
  const aliases: Record<string, string> = {}
  fields.forEach((name, index) => {
    aliases[`f${index}`] = name
  })
  return aliases
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter((v) => v && v.trim().length > 0)))
}

function clampInt(
  value: number,
  min: number,
  max: number,
  fallback: number,
): number {
  if (!Number.isFinite(value)) {
    return fallback
  }
  return Math.min(max, Math.max(min, Math.trunc(value)))
}
