import type { ContentFinderConfig, TemplateOption } from "@/lib/sitecore/types"

/**
 * Cross-session cache of the *derived* search scope (templates + searchable
 * fields) so the cold-load tree walk in {@link deriveSearchScope} is paid at
 * most once per TTL rather than on every app open.
 *
 * Only the derived scope is cached the authoritative settings (search roots,
 * tag field, tenant name) always come fresh from the Sitecore config item, so a
 * stale cache can never widen the search scope or leak out-of-scope results. The
 * key is scoped to the Context ID + roots, so changing either invalidates it.
 */

export interface DerivedScopeData {
  templates: TemplateOption[]
  searchableFields: string[]
}

interface PersistedScope extends DerivedScopeData {
  /** Epoch ms when this entry was written (for TTL checks). */
  ts: number
}

const KEY_PREFIX = "cf:scope:"
const TTL_MS = 60 * 60 * 1000 // 1 hour

export function scopeCacheKey(contextId: string, roots: string[]): string {
  // Sort so root order doesn't produce a different key for the same scope.
  return `${KEY_PREFIX}${contextId}|${[...roots].sort().join(",")}`
}

/** Reads a non-expired derived scope from localStorage, or null. */
export function readPersistedScope(key: string): DerivedScopeData | null {
  if (typeof window === "undefined") {
    return null
  }
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) {
      return null
    }
    const parsed = JSON.parse(raw) as PersistedScope | null
    if (
      !parsed ||
      typeof parsed.ts !== "number" ||
      !Array.isArray(parsed.templates) ||
      !Array.isArray(parsed.searchableFields)
    ) {
      return null
    }
    if (Date.now() - parsed.ts > TTL_MS) {
      return null
    }
    return {
      templates: parsed.templates,
      searchableFields: parsed.searchableFields,
    }
  } catch {
    return null
  }
}

/** Writes the derived scope to localStorage; failures are swallowed. */
export function writePersistedScope(key: string, data: DerivedScopeData): void {
  if (typeof window === "undefined") {
    return
  }
  try {
    const payload: PersistedScope = { ...data, ts: Date.now() }
    window.localStorage.setItem(key, JSON.stringify(payload))
  } catch {
    // Quota or serialization error the cache is an optimisation, so ignore.
  }
}

/**
 * Merges a derived scope over a base config. Derived values only override when
 * non-empty, so a cold/empty derivation still leaves the base config usable.
 */
export function applyScope(
  base: ContentFinderConfig,
  scope: DerivedScopeData,
): ContentFinderConfig {
  return {
    ...base,
    allowedTemplates:
      scope.templates.length > 0 ? scope.templates : base.allowedTemplates,
    searchableFields:
      scope.searchableFields.length > 0
        ? scope.searchableFields
        : base.searchableFields,
  }
}
