"use client"

import { FiltersToolbar } from "@/components/search/filters-toolbar"
import { ResultsList } from "@/components/search/results-list"
import { SearchBar } from "@/components/search/search-bar"
import { useConfig } from "@/components/providers/config-provider"
import { useMarketplace } from "@/components/providers/marketplace-provider"
import { ErrorStates } from "@/components/ui/error-states"
import { Spinner } from "@/components/ui/spinner"
import { useSearch } from "@/hooks/useSearch"

/**
 * Top-level Content Finder experience: search bar + filters + results, all
 * driven by the `useSearch` hook. Guards on the Marketplace handshake so the UI
 * only renders once the SDK is connected and a Context ID is available.
 */
export function ContentFinder() {
  const { isInitialized, isLoading, error, sitecoreContextId } =
    useMarketplace()
  // Gate the UI on the *base* config read only (the authoritative search roots).
  // Until that settles, search would run against the default whole-tree scope
  // and return confusing out-of-scope results. The slower template/field
  // derivation runs in the background and only refines the filters, so it does
  // not block search.
  const { isLoading: isConfigLoading } = useConfig()

  const search = useSearch()

  if (error) {
    return (
      <Centered>
        <ErrorStates
          variant="generic"
          title="Couldn't connect to SitecoreAI"
          description={error.message}
          actions={null}
        />
      </Centered>
    )
  }

  if (!isInitialized || isLoading || !sitecoreContextId || isConfigLoading) {
    return (
      <Centered>
        <p className="text-subtle-text flex items-center gap-2 text-sm">
          <Spinner className="size-4" />{" "}
          {isConfigLoading && isInitialized && sitecoreContextId
            ? "Loading search configuration…"
            : "Connecting to SitecoreAI…"}
        </p>
      </Centered>
    )
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-5 p-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Content Finder</h1>
        <p className="text-subtle-text text-sm">
          Search content items across your SitecoreAI environment.
        </p>
      </header>

      <div className="flex flex-col gap-3">
        <SearchBar value={search.filters.text} onChange={search.setText} />
        <FiltersToolbar
          filters={search.filters}
          setFields={search.setFields}
          setTemplateIds={search.setTemplateIds}
          setTagIds={search.setTagIds}
          setTagMatch={search.setTagMatch}
        />
      </div>

      <ResultsList
        results={search.results}
        query={search.filters.text}
        searchedFields={search.searchedFields}
        isLoading={search.isLoading}
        isLoadingMore={search.isLoadingMore}
        error={search.error}
        hasMore={search.hasMore}
        hasQuery={search.hasQuery}
        onLoadMore={search.loadMore}
        onRetry={() => search.setText(search.filters.text)}
      />
    </main>
  )
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl items-center justify-center p-6">
      {children}
    </main>
  )
}
