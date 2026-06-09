import { normalizeGuid } from "@/lib/sitecore/guid"
import type { SearchResultItem } from "@/lib/sitecore/types"

interface RawFieldValue {
  value?: string | null
}

interface RawInnerItem {
  itemId?: string | null
  id?: string | null
  name?: string | null
  path?: string | null
  template?: { name?: string | null } | null
  language?: { name?: string | null } | null
  __layout?: RawFieldValue | null
  __finalLayout?: RawFieldValue | null
  [alias: string]: unknown
}

interface RawSearchResponse {
  search?: {
    results?: Array<{ innerItem?: RawInnerItem | null } | null> | null
  } | null
}

/**
 * Normalizes the raw `response.data.data` payload from the authoring `search`
 * query into typed {@link SearchResultItem}s, resolving the dynamic field
 * aliases (f0, f1, …) back to their real field names.
 */
export function normalizeSearchResponse(
  raw: RawSearchResponse | null | undefined,
  fieldAliases: Record<string, string>,
): SearchResultItem[] {
  const results = raw?.search?.results ?? []

  const items = results
    .map((entry) => entry?.innerItem)
    .filter((item): item is RawInnerItem => Boolean(item))
    .map((item) => normalizeItem(item, fieldAliases))

  // The index can return the same item+language more than once (e.g. when an
  // item matches via several criteria), which would otherwise produce duplicate
  // React keys and an inflated result count. Keep the first occurrence of each.
  const seen = new Set<string>()
  return items.filter((item) => {
    const key = `${item.id}:${item.language}`
    if (seen.has(key)) {
      return false
    }
    seen.add(key)
    return true
  })
}

function normalizeItem(
  item: RawInnerItem,
  fieldAliases: Record<string, string>,
): SearchResultItem {
  const fields: Record<string, string> = {}
  for (const [alias, fieldName] of Object.entries(fieldAliases)) {
    const raw = item[alias] as RawFieldValue | undefined
    const value = raw?.value
    if (typeof value === "string" && value.length > 0) {
      fields[fieldName] = value
    }
  }

  const id = normalizeGuid(item.itemId ?? item.id ?? "") ?? (item.itemId ?? "")

  return {
    id,
    name: item.name ?? "",
    path: item.path ?? "",
    templateName: item.template?.name ?? null,
    language: item.language?.name ?? null,
    hasLayout:
      hasRenderings(item.__layout?.value) ||
      hasRenderings(item.__finalLayout?.value),
    fields,
  }
}

/**
 * A presentation/layout field counts as "has layout" when it holds real
 * rendering markup. Empty strings and the empty `<r/>` placeholder don't count.
 */
function hasRenderings(value: string | null | undefined): boolean {
  if (!value) {
    return false
  }
  const trimmed = value.trim()
  if (trimmed.length === 0) {
    return false
  }
  // Empty layout deltas serialize as an `<r />`/`<d />` shell with no devices.
  return /<r[ >]/i.test(trimmed) && /<d[ >]/i.test(trimmed)
}
