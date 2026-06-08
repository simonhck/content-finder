/**
 * Domain types for the Content Finder search layer.
 *
 * These describe the inputs/outputs of the query builder and result normalizer
 * and are independent of whether the GraphQL call runs client-side (iframe SDK)
 * or server-side (experimental XMC client).
 */

/** Authoring search index criteria types (Solr/Lucene-backed). */
export type CriteriaType =
  | "SEARCH"
  | "EXACT"
  | "CONTAINS"
  | "STARTSWITH"
  | "ENDSWITH"
  | "WILDCARD"
  | "FUZZY"

/** Boolean operator joining a criterion to its statement. */
export type SearchOperator = "MUST" | "MUST_NOT" | "SHOULD"

export type SortDirection = "ASCENDING" | "DESCENDING"

/**
 * Admin-maintained configuration the app reads from a Sitecore config item.
 * Every field is optional; the app falls back to {@link DEFAULT_CONFIG} when a
 * setting is empty.
 */
export interface ContentFinderConfig {
  /** Root item GUID(s) to scope search to (descendants of these via `_path`). */
  searchRoots: string[]
  /** Default field names the user can search within / select. */
  searchableFields: string[]
  /** Template GUIDs offered in the content-type filter. */
  allowedTemplates: TemplateOption[]
  /** Name of the multilist tag field on content items (default `Tags`). */
  tagField: string
  /** Root item GUID of the tag taxonomy (to populate the tag filter). */
  tagsRoot: string | null
  /** Search index name. */
  index: string
}

export interface TemplateOption {
  /** Template GUID (normalized, lowercase no-dashes). */
  id: string
  /** Display name. */
  name: string
}

export interface TagOption {
  /** Tag item GUID (normalized, lowercase no-dashes). */
  id: string
  name: string
}

/** A user-initiated search request, before it is shaped into GraphQL. */
export interface SearchParams {
  /** Free-text query (full-text across selected fields). */
  text: string
  /**
   * Field names to scope the full-text search to. When empty, the config's
   * `searchableFields` are used.
   */
  fields: string[]
  /** Selected template GUIDs (content-type filter); OR-combined. */
  templateIds: string[]
  /** Selected tag GUIDs; the item must contain them in the tag field. */
  tagIds: string[]
  /** Tag combine mode: ALL (AND) or ANY (OR). */
  tagMatch: "ALL" | "ANY"
  paging: PagingParams
  sort: SortParams
}

export interface PagingParams {
  pageSize: number
  pageIndex: number
}

export interface SortParams {
  /** Index field to sort by, e.g. `_name`, `__smallupdateddate`. */
  field: string
  direction: SortDirection
}

/** A single search result, normalized from the raw GraphQL response. */
export interface SearchResultItem {
  id: string
  name: string
  path: string
  templateName: string | null
  language: string | null
  /** Whether the item has presentation/layout (derived from `__Renderings`). */
  hasLayout: boolean
  /** Field name → raw value, for every field we requested back. */
  fields: Record<string, string>
}
