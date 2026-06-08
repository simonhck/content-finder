import { formatGuidBraced, normalizeGuid } from "@/lib/sitecore/guid"

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
const EXPLORER_BASE = "https://explorer.sitecorecloud.io"

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
 * Explorer (Content mode) deep link — works for any content item, for editing
 * fields directly. Returns null for bad input.
 */
export function buildExplorerUrl(
  target: ItemLinkTarget,
  context: DeepLinkContext,
): string | null {
  // Explorer tends to accept the normalized (dashless) id; fall back gracefully.
  const itemId = normalizeGuid(target.itemId)
  if (!itemId || !context.organizationId) {
    return null
  }

  const params = new URLSearchParams()
  params.set("sc_itemid", itemId)
  params.set("sc_lang", (target.language || "en").toLowerCase())
  params.set("organization", context.organizationId)
  if (context.tenantName) {
    params.set("tenantName", context.tenantName)
  }

  return `${EXPLORER_BASE}/?${params.toString()}`
}
