"use client"

import * as React from "react"

import { useMarketplace } from "@/components/providers/marketplace-provider"
import { useConfig } from "@/components/providers/config-provider"
import { DEFAULT_PAGE_SIZE, SORT_OPTIONS } from "@/lib/config/defaults"
import { executeSearch } from "@/lib/sitecore/searchClient"
import type {
  SearchParams,
  SearchResultItem,
  SortParams,
} from "@/lib/sitecore/types"

const DEBOUNCE_MS = 350

export interface SearchFilters {
  text: string
  fields: string[]
  templateIds: string[]
  tagIds: string[]
  tagMatch: "ALL" | "ANY"
  sort: SortParams
}

const INITIAL_FILTERS: SearchFilters = {
  text: "",
  fields: [],
  templateIds: [],
  tagIds: [],
  tagMatch: "ANY",
  sort: { field: SORT_OPTIONS[0].field, direction: SORT_OPTIONS[0].direction },
}

export interface UseSearchResult {
  filters: SearchFilters
  setText: (text: string) => void
  setFields: (fields: string[]) => void
  setTemplateIds: (ids: string[]) => void
  setTagIds: (ids: string[]) => void
  setTagMatch: (mode: "ALL" | "ANY") => void
  setSort: (sort: SortParams) => void
  reset: () => void
  loadMore: () => void
  results: SearchResultItem[]
  isLoading: boolean
  isLoadingMore: boolean
  error: string | null
  hasMore: boolean
  /** The searched fields used for the last query (drives highlighting). */
  searchedFields: string[]
  /** True once the user has entered a query or filter. */
  hasQuery: boolean
}

export function useSearch(): UseSearchResult {
  const { client, sitecoreContextId } = useMarketplace()
  const { config } = useConfig()

  const [filters, setFilters] = React.useState<SearchFilters>(INITIAL_FILTERS)
  const [debouncedText, setDebouncedText] = React.useState("")
  const [results, setResults] = React.useState<SearchResultItem[]>([])
  const [pageIndex, setPageIndex] = React.useState(0)
  const [isLoading, setIsLoading] = React.useState(false)
  const [isLoadingMore, setIsLoadingMore] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [hasMore, setHasMore] = React.useState(false)

  // Tracks the latest request so out-of-order responses are ignored.
  const requestId = React.useRef(0)

  // Debounce the free-text input.
  React.useEffect(() => {
    const handle = setTimeout(() => setDebouncedText(filters.text), DEBOUNCE_MS)
    return () => clearTimeout(handle)
  }, [filters.text])

  const searchedFields =
    filters.fields.length > 0 ? filters.fields : config.searchableFields

  const hasQuery =
    debouncedText.trim().length > 0 ||
    filters.templateIds.length > 0 ||
    filters.tagIds.length > 0

  const runSearch = React.useCallback(
    async (nextPageIndex: number, append: boolean) => {
      if (!client || !sitecoreContextId) {
        return
      }

      const id = ++requestId.current
      if (append) {
        setIsLoadingMore(true)
      } else {
        setIsLoading(true)
      }
      setError(null)

      const params: SearchParams = {
        text: debouncedText,
        fields: filters.fields,
        templateIds: filters.templateIds,
        tagIds: filters.tagIds,
        tagMatch: filters.tagMatch,
        sort: filters.sort,
        paging: { pageSize: DEFAULT_PAGE_SIZE, pageIndex: nextPageIndex },
      }

      try {
        const outcome = await executeSearch(
          client,
          sitecoreContextId,
          params,
          config,
        )
        if (id !== requestId.current) {
          return
        }
        setResults((prev) =>
          append ? [...prev, ...outcome.items] : outcome.items,
        )
        setHasMore(outcome.hasMore)
        setPageIndex(nextPageIndex)
      } catch (err) {
        if (id !== requestId.current) {
          return
        }
        setError(err instanceof Error ? err.message : "Search failed")
        if (!append) {
          setResults([])
          setHasMore(false)
        }
      } finally {
        if (id === requestId.current) {
          setIsLoading(false)
          setIsLoadingMore(false)
        }
      }
    },
    [
      client,
      sitecoreContextId,
      config,
      debouncedText,
      filters.fields,
      filters.templateIds,
      filters.tagIds,
      filters.tagMatch,
      filters.sort,
    ],
  )

  // Re-run (from page 0) whenever the debounced query or any filter changes.
  React.useEffect(() => {
    if (!client || !sitecoreContextId) {
      return
    }
    if (!hasQuery) {
      setResults([])
      setHasMore(false)
      setError(null)
      return
    }
    void runSearch(0, false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    client,
    sitecoreContextId,
    hasQuery,
    debouncedText,
    filters.fields,
    filters.templateIds,
    filters.tagIds,
    filters.tagMatch,
    filters.sort,
  ])

  const loadMore = React.useCallback(() => {
    if (!isLoading && !isLoadingMore && hasMore) {
      void runSearch(pageIndex + 1, true)
    }
  }, [isLoading, isLoadingMore, hasMore, pageIndex, runSearch])

  return {
    filters,
    setText: (text) => setFilters((f) => ({ ...f, text })),
    setFields: (fields) => setFilters((f) => ({ ...f, fields })),
    setTemplateIds: (templateIds) =>
      setFilters((f) => ({ ...f, templateIds })),
    setTagIds: (tagIds) => setFilters((f) => ({ ...f, tagIds })),
    setTagMatch: (tagMatch) => setFilters((f) => ({ ...f, tagMatch })),
    setSort: (sort) => setFilters((f) => ({ ...f, sort })),
    reset: () => setFilters(INITIAL_FILTERS),
    loadMore,
    results,
    isLoading,
    isLoadingMore,
    error,
    hasMore,
    searchedFields,
    hasQuery,
  }
}
