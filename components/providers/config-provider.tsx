"use client"

import * as React from "react"

import { useMarketplace } from "@/components/providers/marketplace-provider"
import { fetchConfigItem } from "@/lib/config/configItem"
import { DEFAULT_CONFIG } from "@/lib/config/defaults"
import { deriveSearchScope } from "@/lib/config/derive"
import type { RunGraphQL } from "@/lib/config/derive"
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
  isLoading: boolean
}

const ConfigContext = React.createContext<ConfigContextValue | null>(null)

/**
 * Process-lifetime cache of derived scope, keyed by context + roots. Scope
 * derivation walks the content tree, so we only want to pay for it once per
 * tenant/root combination. Phase 6 will move this behind Netlify Blobs with a
 * TTL; until then an in-memory map is enough to avoid re-deriving on every
 * mount/tenant-switch within a session.
 */
const scopeCache = new Map<string, ContentFinderConfig>()

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

  React.useEffect(() => {
    if (!client || !sitecoreContextId) {
      return
    }

    let cancelled = false
    const run: RunGraphQL = (query) =>
      runAuthoringGraphQL(client, sitecoreContextId, query)

    async function load() {
      setIsLoading(true)
      try {
        // 1. Base config from the Sitecore config item, falling back to defaults.
        let base: ContentFinderConfig = DEFAULT_CONFIG
        if (CONFIG_ITEM_ID) {
          const overrides = await fetchConfigItem(run, CONFIG_ITEM_ID)
          base = { ...DEFAULT_CONFIG, ...overrides }
        }

        // Tag options come straight from the children of the configured Tags
        // Root, independent of the (cached) scope derivation below, so they load
        // even on a scope-cache hit.
        const tagOptions = await fetchTagOptions(run, base.tagsRoot)
        if (!cancelled) setTags(tagOptions)

        const cacheKey = `${sitecoreContextId}|${base.searchRoots.join(",")}`
        const cached = scopeCache.get(cacheKey)
        if (cached) {
          if (!cancelled) setConfig(cached)
          return
        }

        // 2. Derive templates + fields from the resolved scope.
        const scope = await deriveSearchScope(run, base.searchRoots, base.index)
        const merged: ContentFinderConfig = {
          ...base,
          // Only override when derivation found something, so a cold/empty scope
          // still leaves the app usable on the base config.
          allowedTemplates:
            scope.templates.length > 0
              ? scope.templates
              : base.allowedTemplates,
          searchableFields:
            scope.searchableFields.length > 0
              ? scope.searchableFields
              : base.searchableFields,
        }
        scopeCache.set(cacheKey, merged)
        if (!cancelled) setConfig(merged)
      } catch (err) {
        // Config read or derivation failed entirely keep the safe defaults.
        console.error("[ContentFinder] config load failed:", err)
        if (!cancelled) setConfig(DEFAULT_CONFIG)
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [client, sitecoreContextId])

  const value = React.useMemo<ConfigContextValue>(
    () => ({ config, tags, isLoading }),
    [config, tags, isLoading],
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
