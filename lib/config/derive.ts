import { formatGuidBraced, normalizeGuid } from "@/lib/sitecore/guid"
import type { TemplateOption } from "@/lib/sitecore/types"

/**
 * Scope-driven configuration derivation.
 *
 * The admin only configures the *search scope* (one or more root item GUIDs).
 * Everything else the content-type filter and the searchable-field list is
 * derived from what actually exists in that scope, then cached:
 *
 *   roots ──(search, distinct `_template`)──▶ templates in scope
 *   templates ──(template field defs, type-filtered)──▶ searchable fields
 *
 * Two design notes:
 *  - Template enumeration uses ONLY the verified `search` query mechanism
 *    (criteria on `_path` + reading the `_template` system field), so it relies
 *    on nothing beyond what the live endpoint already proved it supports.
 *  - Field-type introspection (reading a template definition's field types) is
 *    isolated in {@link fetchTemplateFields}. The Authoring read-schema for
 *    template definitions is not documented, so that one call is best-effort:
 *    if it errors, derivation degrades to "no derived fields" for that template
 *    rather than failing the whole load. See the comment on that function.
 */

export interface DerivedScope {
  /** Distinct templates used by items under the scope. */
  templates: TemplateOption[]
  /** De-duplicated field names whose type is reliably in the search index. */
  searchableFields: string[]
}

/** Runs an Authoring GraphQL query string and returns `response.data.data`. */
export type RunGraphQL = (query: string) => Promise<unknown>

/**
 * Field types we are confident the `sitecore_master_index` stores as queryable
 * text. Compared case-insensitively and trimmed (Sitecore sometimes reports a
 * type with surrounding whitespace, e.g. `" Single-Line Text "`).
 *
 * "Name Value List" is intentionally included even though it stores a
 * URL-encoded blob (`k1=v1&k2=v2`) it backs redirect maintenance in this
 * project and authors search it often. "General Link" is intentionally
 * excluded (stored as XML markup, so matches are unintuitive).
 */
const INDEXED_FIELD_TYPES: ReadonlySet<string> = new Set([
  "single-line text",
  "multi-line text",
  "rich text",
  "name value list",
])

/** Hard cap on item pages scanned per root when enumerating templates. */
const MAX_TEMPLATE_SCAN_PAGES = 50
const TEMPLATE_SCAN_PAGE_SIZE = 100

/**
 * Derives the full searchable scope (templates + fields) for the given roots.
 * Throws only on a hard failure of the (verified) template enumeration; field
 * derivation failures are swallowed per-template and simply yield fewer fields.
 */
export async function deriveSearchScope(
  run: RunGraphQL,
  searchRoots: string[],
  index: string,
): Promise<DerivedScope> {
  const roots = searchRoots
    .map((r) => normalizeGuid(r))
    .filter((r): r is string => r !== null)

  if (roots.length === 0) {
    return { templates: [], searchableFields: [] }
  }

  const templateMap = new Map<string, string>() // id -> name
  for (const root of roots) {
    await collectTemplatesUnderRoot(run, index, root, templateMap)
  }

  const templates: TemplateOption[] = Array.from(templateMap.entries())
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name))

  // Field-type reads are independent per template, so fan them out in parallel
  // rather than awaiting each in turn this is the difference between N
  // sequential round-trips and one.
  const fieldNames = new Set<string>()
  const templateFields = await Promise.all(
    templates.map((template) => fetchTemplateFields(run, template.id)),
  )
  for (const fields of templateFields) {
    for (const field of fields) {
      if (isIndexedFieldType(field.type) && field.name.trim().length > 0) {
        fieldNames.add(field.name.trim())
      }
    }
  }

  return {
    templates,
    searchableFields: Array.from(fieldNames).sort((a, b) =>
      a.localeCompare(b),
    ),
  }
}

function isIndexedFieldType(type: string): boolean {
  return INDEXED_FIELD_TYPES.has(type.trim().toLowerCase())
}

/**
 * Pages through every item under `root` (descendants via `_path`) and records
 * each distinct template GUID + name from `innerItem.template { templateId name }`.
 * (The `_template` system field is not exposed via `field(name:)` on a result,
 * so the GUID is read from the typed `template` object instead.)
 */
async function collectTemplatesUnderRoot(
  run: RunGraphQL,
  index: string,
  root: string,
  out: Map<string, string>,
): Promise<void> {
  for (let pageIndex = 0; pageIndex < MAX_TEMPLATE_SCAN_PAGES; pageIndex++) {
    const query = buildScopeScanQuery(index, root, pageIndex)
    const data = (await run(query)) as ScopeScanResponse | null | undefined
    const results = data?.search?.results ?? []

    for (const entry of results) {
      const item = entry?.innerItem
      if (!item) continue
      const id = normalizeGuid(item.template?.templateId ?? null)
      if (!id) continue
      if (!out.has(id)) {
        out.set(id, item.template?.name ?? id)
      }
    }

    if (results.length < TEMPLATE_SCAN_PAGE_SIZE) {
      return // last page reached
    }
  }
}

function buildScopeScanQuery(
  index: string,
  root: string,
  pageIndex: number,
): string {
  const skip = pageIndex * TEMPLATE_SCAN_PAGE_SIZE
  return `query ScopeTemplateScan {
  search(
    query: {
      index: ${JSON.stringify(index)}
      paging: { pageSize: ${TEMPLATE_SCAN_PAGE_SIZE}, skip: ${skip}, pageIndex: ${pageIndex} }
      searchStatement: {
        criteria: [
          { criteriaType: EXACT, field: "_path", value: ${JSON.stringify(root)}, operator: MUST }
        ]
      }
    }
  ) {
    results {
      innerItem {
        template { templateId name }
      }
    }
  }
}`
}

/**
 * Reads a template definition's fields (name + type), including inherited
 * fields from base templates. Query shape verified against the live Authoring
 * GraphQL endpoint: `itemTemplate(where:{templateId}) { fields { nodes { name type } } }`,
 * where `fields` already includes inherited base-template fields.
 *
 * On any error we return `[]` so a single bad template never breaks the whole
 * config load the field list is an optimisation over the static defaults, not
 * a hard requirement.
 */
async function fetchTemplateFields(
  run: RunGraphQL,
  templateId: string,
): Promise<TemplateFieldDef[]> {
  try {
    const data = (await run(buildTemplateFieldsQuery(templateId))) as
      | TemplateFieldsResponse
      | null
      | undefined
    return parseTemplateFields(data)
  } catch (err) {
    console.warn(
      `[ContentFinder] template field read failed for ${templateId}:`,
      err,
    )
    return []
  }
}

function buildTemplateFieldsQuery(templateId: string): string {
  // `fields` (as opposed to `ownFields`) includes inherited base-template
  // fields, so no manual base-template recursion is needed here.
  const id = formatGuidBraced(templateId) ?? templateId
  return `query TemplateFields {
  itemTemplate(where: { templateId: ${JSON.stringify(id)} }) {
    fields {
      nodes {
        name
        type
      }
    }
  }
}`
}

function parseTemplateFields(
  data: TemplateFieldsResponse | null | undefined,
): TemplateFieldDef[] {
  const nodes = data?.itemTemplate?.fields?.nodes ?? []
  return nodes
    .filter((n): n is TemplateFieldDef => Boolean(n?.name) && Boolean(n?.type))
    .map((n) => ({ name: n.name, type: n.type }))
}

interface TemplateFieldDef {
  name: string
  type: string
}

interface TemplateFieldsResponse {
  itemTemplate?: {
    fields?: { nodes?: Array<{ name: string; type: string } | null> | null } | null
  } | null
}

interface ScopeScanResponse {
  search?: {
    results?: Array<{
      innerItem?: {
        template?: { templateId?: string | null; name?: string | null } | null
      } | null
    } | null> | null
  } | null
}
