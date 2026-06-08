"use client"

import * as React from "react"

import { DEFAULT_CONFIG } from "@/lib/config/defaults"
import type {
  ContentFinderConfig,
  TagOption,
} from "@/lib/sitecore/types"

interface ConfigContextValue {
  config: ContentFinderConfig
  /** Tag options for the tag filter (from the configured TagsRoot). */
  tags: TagOption[]
  isLoading: boolean
}

const ConfigContext = React.createContext<ConfigContextValue | null>(null)

/**
 * Supplies the admin-maintained Content Finder configuration.
 *
 * For now this serves {@link DEFAULT_CONFIG}. Once the Sitecore config item
 * (Phase 2) exists, this provider will read it by its known path/ID and merge
 * non-empty settings over the defaults, plus load the tag taxonomy from
 * `tagsRoot`. The rest of the app already consumes this context, so wiring the
 * real read in here requires no UI changes.
 */
export function ConfigProvider({ children }: { children: React.ReactNode }) {
  const value = React.useMemo<ConfigContextValue>(
    () => ({
      config: DEFAULT_CONFIG,
      tags: [],
      isLoading: false,
    }),
    [],
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
