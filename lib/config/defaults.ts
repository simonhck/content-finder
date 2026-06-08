import type { ContentFinderConfig } from "@/lib/sitecore/types"

/**
 * Sensible fallbacks used when the Sitecore config item is missing or a
 * particular setting is empty. Phase 2 documents the config template the user
 * builds in Sitecore; until then (and for any unset field) these apply.
 */
export const DEFAULT_CONFIG: ContentFinderConfig = {
  // `/sitecore/content` — the standard content root. Normalized, lowercase.
  searchRoots: ["0de95ae441ab4d019eb067441b7c2450"],
  // Common text-bearing fields most content items expose. The config item's
  // SearchableFields overrides this when present.
  searchableFields: ["Title", "Text", "Content", "Description", "Summary"],
  // No template restriction by default; the filter is populated from config.
  allowedTemplates: [],
  tagField: "Tags",
  tagsRoot: null,
  index: "sitecore_master_index",
}

/** Sort options offered in the UI. `field` values are index field names. */
export const SORT_OPTIONS = [
  { label: "Relevance", field: "_score", direction: "DESCENDING" as const },
  { label: "Name (A–Z)", field: "_name", direction: "ASCENDING" as const },
  { label: "Name (Z–A)", field: "_name", direction: "DESCENDING" as const },
  {
    label: "Recently updated",
    field: "__smallupdateddate",
    direction: "DESCENDING" as const,
  },
]

export const DEFAULT_PAGE_SIZE = 20
