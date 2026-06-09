import { formatGuidBraced, formatGuidDashed } from "@/lib/sitecore/guid"

/**
 * Builders for "open this item" deep links.
 *
 * Because Content Finder is a **Full Screen** app (not a Page-builder
 * extension), the `pages.context` SDK navigation is unavailable — we open
 * editor URLs in a new tab instead (requires the pop-up permission).
 *
 * ⚠️ The exact query-param contracts for Pages / Explorer are not formally
 * documented and can change. They are isolated here behind a small abstraction
 * so they're trivial to adjust: copy a real URL from the address bar while
 * editing an item in each tool and reconcile the params below. Each builder
 * returns `null` when it can't produce a link, so callers can fall back to
 * "Copy ID / path".
 */

const PAGES_BASE = "https://pages.sitecorecloud.io"
// Content mode ("Explorer") is served from the Pages host under /content, not
// from explorer.sitecorecloud.io (that origin 401s for these item deep links).
const CONTENT_BASE = "https://pages.sitecorecloud.io/content"

export interface DeepLinkContext {
  organizationId?: string | null
  tenantName?: string | null
  /** Site name, when known (Pages is site-scoped). */
  siteName?: string | null
}

export interface ItemLinkTarget {
  itemId: string
  /** Language, e.g. "en". Defaults to "en" when absent. */
  language?: string | null
}

// A SitecoreAI site's direct children are standard folders. The site item is
// whichever segment is the parent of the first of these we encounter in a path.
const SITE_CHILD_FOLDERS = new Set([
  "home",
  "data",
  "media",
  "dictionary",
  "presentation",
  "settings",
])

/**
 * Derives the site name from a content item path. SitecoreAI sites live under
 * `/sitecore/content/<group?>/<site>/<Home|Data|Media|...>/...`, so the site is
 * the segment immediately preceding the first standard site-child folder, e.g.
 *   /sitecore/content/Playgrounds/simons-sai-playground/Home/...        → simons-sai-playground
 *   /sitecore/content/Playgrounds/simons-sai-playground/Data/Banners/x  → simons-sai-playground
 * Returns null when the path doesn't follow that shape, in which case Content
 * mode falls back to resolving by id.
 */
export function siteNameFromPath(
  path: string | null | undefined,
): string | null {
  if (!path) {
    return null
  }
  const segments = path.split("/").filter(Boolean)
  const folderIndex = segments.findIndex((segment) =>
    SITE_CHILD_FOLDERS.has(segment.toLowerCase()),
  )
  if (folderIndex <= 0) {
    return null
  }
  return segments[folderIndex - 1]
}

/**
 * Pages editor (Edit mode) deep link — only meaningful for items that have
 * presentation/layout. Returns null for non-page items or bad input.
 */
export function buildPagesEditUrl(
  target: ItemLinkTarget,
  context: DeepLinkContext,
): string | null {
  const itemId = formatGuidBraced(target.itemId)
  if (!itemId || !context.organizationId) {
    return null
  }

  const params = new URLSearchParams()
  params.set("sc_itemid", itemId)
  params.set("sc_lang", (target.language || "en").toLowerCase())
  params.set("sc_version", "1")
  params.set("organization", context.organizationId)
  if (context.tenantName) {
    params.set("tenantName", context.tenantName)
  }
  if (context.siteName) {
    params.set("sc_site", context.siteName)
  }

  return `${PAGES_BASE}/?${params.toString()}`
}

/**
 * Content mode ("Explorer") deep link — works for any content item, for editing
 * fields directly. Returns null for bad input.
 *
 * Reconciled against a real Content-mode URL, e.g.:
 *   https://pages.sitecorecloud.io/content?tenantName=...&organization=org_xxx
 *     &sc_itemid=9854d5ed-0a9f-4e3b-b739-570fc55c2c67&sc_lang=en
 *     &sc_site=simons-sai-playground&sc_version=1
 */
export function buildExplorerUrl(
  target: ItemLinkTarget,
  context: DeepLinkContext,
): string | null {
  // Content mode expects a dashed, lower-case, brace-less id.
  const itemId = formatGuidDashed(target.itemId)
  if (!itemId || !context.organizationId) {
    return null
  }

  const params = new URLSearchParams()
  params.set("sc_itemid", itemId)
  params.set("sc_lang", (target.language || "en").toLowerCase())
  params.set("sc_version", "1")
  params.set("organization", context.organizationId)
  if (context.tenantName) {
    params.set("tenantName", context.tenantName)
  }
  if (context.siteName) {
    params.set("sc_site", context.siteName)
  }

  return `${CONTENT_BASE}?${params.toString()}`
}
