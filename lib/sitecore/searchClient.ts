import type { ClientSDK } from "@sitecore-marketplace-sdk/client"

import { buildSearchQuery } from "@/lib/sitecore/searchQuery"
import { normalizeSearchResponse } from "@/lib/sitecore/normalize"
import type {
  ContentFinderConfig,
  SearchParams,
  SearchResultItem,
} from "@/lib/sitecore/types"

export interface SearchOutcome {
  items: SearchResultItem[]
  /** Whether another page is likely available (a full page was returned). */
  hasMore: boolean
}

export class SitecoreGraphQLError extends Error {
  constructor(
    message: string,
    readonly errors?: unknown,
  ) {
    super(message)
    this.name = "SitecoreGraphQLError"
  }
}

/**
 * Runs an arbitrary Authoring GraphQL query through the iframe Client SDK.
 *
 * The SDK wraps the HTTP response: the GraphQL payload lands at
 * `result.data.data` and GraphQL errors at `result.data.errors`.
 */
export async function runAuthoringGraphQL(
  client: ClientSDK,
  sitecoreContextId: string,
  query: string,
  variables?: Record<string, unknown>,
): Promise<unknown> {
  const result = (await client.mutate("xmc.authoring.graphql", {
    params: {
      query: { sitecoreContextId },
      body: { query, ...(variables ? { variables } : {}) },
    },
  })) as { data?: { data?: unknown; errors?: unknown } }

  const errors = result?.data?.errors
  if (Array.isArray(errors) && errors.length > 0) {
    const message =
      (errors[0] as { message?: string })?.message ?? "GraphQL request failed"
    throw new SitecoreGraphQLError(message, errors)
  }

  return result?.data?.data
}

/**
 * Builds, executes, and normalizes a content search in one call (client-side).
 * The same `buildSearchQuery`/`normalizeSearchResponse` pair is reused by the
 * server-side path, so search shaping stays consistent across both.
 */
export async function executeSearch(
  client: ClientSDK,
  sitecoreContextId: string,
  params: SearchParams,
  config: ContentFinderConfig,
): Promise<SearchOutcome> {
  const { query, fieldAliases } = buildSearchQuery(params, config)
  const data = await runAuthoringGraphQL(client, sitecoreContextId, query)
  const items = normalizeSearchResponse(
    data as Parameters<typeof normalizeSearchResponse>[0],
    fieldAliases,
  )

  return {
    items,
    hasMore: items.length >= params.paging.pageSize,
  }
}
