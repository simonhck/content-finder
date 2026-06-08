"use client"

import { ResultCard } from "@/components/search/result-card"
import { Button } from "@/components/ui/button"
import { EmptyStates } from "@/components/ui/empty-states"
import { ErrorStates } from "@/components/ui/error-states"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import type { SearchResultItem } from "@/lib/sitecore/types"

export function ResultsList({
  results,
  query,
  searchedFields,
  isLoading,
  isLoadingMore,
  error,
  hasMore,
  hasQuery,
  onLoadMore,
  onRetry,
}: {
  results: SearchResultItem[]
  query: string
  searchedFields: string[]
  isLoading: boolean
  isLoadingMore: boolean
  error: string | null
  hasMore: boolean
  hasQuery: boolean
  onLoadMore: () => void
  onRetry: () => void
}) {
  if (error) {
    return (
      <ErrorStates
        variant="generic"
        title="Search failed"
        description={error}
        actions={
          <Button variant="outline" onClick={onRetry}>
            Try again
          </Button>
        }
      />
    )
  }

  if (!hasQuery) {
    return (
      <EmptyStates
        variant="nothing-created"
        title="Start searching"
        description="Enter a query above, or narrow results with content type and tag filters."
        actions={null}
      />
    )
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-28 w-full rounded-md" />
        ))}
      </div>
    )
  }

  if (results.length === 0) {
    return (
      <EmptyStates
        variant="no-search-results"
        title="No results"
        description="Try a different query, fields, or filters."
        actions={null}
      />
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-subtle-text text-sm">
        {results.length} result{results.length === 1 ? "" : "s"}
        {hasMore ? "+" : ""}
      </p>

      {results.map((item) => (
        <ResultCard
          key={`${item.id}:${item.language}`}
          item={item}
          query={query}
          searchedFields={searchedFields}
        />
      ))}

      {hasMore ? (
        <div className="flex justify-center pt-2">
          <Button
            variant="outline"
            onClick={onLoadMore}
            disabled={isLoadingMore}
          >
            {isLoadingMore ? <Spinner className="size-4" /> : null}
            Load more
          </Button>
        </div>
      ) : null}
    </div>
  )
}
