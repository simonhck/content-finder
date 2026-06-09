"use client"

import * as React from "react"

import { useMarketplace } from "@/components/providers/marketplace-provider"
import { fetchConfigItem } from "@/lib/config/configItem"
import { DEFAULT_CONFIG } from "@/lib/config/defaults"
import { deriveSearchScope } from "@/lib/config/derive"
import type { RunGraphQL } from "@/lib/config/derive"
import {
  applyScope,
  readPersistedScope,
  scopeCacheKey,
  writePersistedScope,
} from "@/lib/config/scopeCache"
import { fetchTagOptions } from "@/lib/config/tagTaxonomy"
import { runAuthoringGraphQL } from "@/lib/sitecore/searchClient"
import type { ContentFinderConfig, TagOption } from "@/lib/sitecore/types"

/**
 * GUID of the Sitecore "Content Finder Config" item, supplied at build time.
 * When unset, the app skips the config-item read and runs on
 * {@link DEFAULT_CONFIG} (scope = `/sitecore/content`).
 */
const CONFIG_ITEM_ID =
  process.env.NEXT_PUBLIC_CONTENT_FINDER_CONFIG_ID?.trim() || null

interface ConfigContextValue {
  config: ContentFinderConfig
  /** Tag options for the tag filter (from the configured TagsRoot). */
  tags: TagOption[]
  /**
   * True while the base config (search roots + index + tag field) is still
   * loading. The search UI gates on this: once false, the authoritative search
   * roots are in effect, so search never runs against the default whole-tree
   * scope.
   */
  isLoading: boolean
  /**
   * True while the template/searchable-field derivation runs in the background.
   * Search is already usable; this only drives a loading state on the derived
   * (content-type) filter.
   */
  isDerivingScope: boolean
}

const ConfigContext = React.createContext<ConfigContextValue | null>(null)

/**
 * Supplies the admin-maintained Content Finder configuration.
 *
 * Load order:
 *  1. Read the Sitecore "Content Finder Config" item by GUID (when configured)
 *     and merge its non-empty settings over {@link DEFAULT_CONFIG}.
 *  2. Derive the content-type templates and searchable fields from that config's
 *     search scope (see {@link deriveSearchScope}).
 * Every step degrades gracefully to the defaults so the app stays usable even
 * with no config item or a partially-filled one.
 */
export function ConfigProvider({ children }: { children: React.ReactNode }) {
  const { client, sitecoreContextId } = useMarketplace()

  const [config, setConfig] =
    React.useState<ContentFinderConfig>(DEFAULT_CONFIG)
  const [tags, setTags] = React.useState<TagOption[]>([])
  // Start true so the search UI shows a loading state from the very first
  // render (before the load effect runs), rather than briefly exposing the
  // default whole-tree scope. The Marketplace handshake guard covers the case
  // where no client/Context ID ever arrives.
  const [isLoading, setIsLoading] = React.useState(true)
  const [isDerivingScope, setIsDerivingScope] = React.useState(false)

  React.useEffect(() => {
    if (!client || !sitecoreContextId) {
      return
    }
    // Capture the narrowed (non-null) values for use inside nested closures.
    const contextId = sitecoreContextId

    let cancelled = false
    const run: RunGraphQL = (query) =>
      runAuthoringGraphQL(client, contextId, query)

    // --- Phase B (background): walk the scope to derive the content-type and
    // searchable-field filters. This is the slow part on real content, so it
    // runs *after* search is already usable and never blocks the UI. ---
    async function deriveInBackground(
      base: ContentFinderConfig,
      cacheKey: string,
    ) {
      if (base.searchRoots.length === 0) {
        return
      }
      if (!cancelled) setIsDerivingScope(true)
      try {
        const scope = await deriveSearchScope(
          run,
          base.searchRoots,
          base.index,
        )
        const data = {
          templates: scope.templates,
          searchableFields: scope.searchableFields,
        }
        writePersistedScope(cacheKey, data)
        if (!cancelled) setConfig((prev) => applyScope(prev, data))
      } catch (err) {
        // Derivation is an optimisation over the base config; on failure the
        // filters simply stay on the base defaults.
        console.error("[ContentFinder] scope derivation failed:", err)
      } finally {
        if (!cancelled) setIsDerivingScope(false)
      }
    }

    // --- Phase A (blocking): read the config item so the authoritative search
    // roots are in effect before search can run, then release the UI. ---
    async function loadBase() {
      setIsLoading(true)
      let base: ContentFinderConfig = DEFAULT_CONFIG
      try {
        if (CONFIG_ITEM_ID) {
          const overrides = await fetchConfigItem(run, CONFIG_ITEM_ID)
          base = { ...DEFAULT_CONFIG, ...overrides }
        }
      } catch (err) {
        // Config item unreadable fall back to the safe defaults.
        console.error("[ContentFinder] config item read failed:", err)
        base = DEFAULT_CONFIG
      }

      // Apply a persisted derived scope (if fresh) so the filters are populated
      // on first paint and we can skip the expensive re-derivation entirely.
      const cacheKey = scopeCacheKey(contextId, base.searchRoots)
      const persisted = readPersistedScope(cacheKey)
      if (!cancelled) {
        setConfig(persisted ? applyScope(base, persisted) : base)
        // The real search roots are now in effect; search is safe to run.
        setIsLoading(false)
      }

      // Tags load independently (cheap, not needed for scope correctness).
      void fetchTagOptions(run, base.tagsRoot).then((tagOptions) => {
        if (!cancelled) setTags(tagOptions)
      })

      // Only walk the tree when we don't already have a fresh cached scope.
      if (!persisted) {
        void deriveInBackground(base, cacheKey)
      }
    }

    void loadBase()

    return () => {
      cancelled = true
    }
  }, [client, sitecoreContextId])

  const value = React.useMemo<ConfigContextValue>(
    () => ({ config, tags, isLoading, isDerivingScope }),
    [config, tags, isLoading, isDerivingScope],
  )

  return (
    <ConfigContext.Provider value={value}>{children}</ConfigContext.Provider>
  )
}

export function useConfig(): ConfigContextValue {
  const ctx = React.useContext(ConfigContext)
  if (!ctx) {
    throw new Error("useConfig must be used within a ConfigProvider")
  }
  return ctx
}
