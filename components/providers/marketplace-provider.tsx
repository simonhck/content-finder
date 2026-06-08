"use client"

import * as React from "react"

import type { ClientSDK } from "@sitecore-marketplace-sdk/client"
import type { ApplicationContext } from "@sitecore-marketplace-sdk/client"

import { useMarketplaceClient } from "@/lib/marketplace/useMarketplaceClient"

/**
 * The slice of Marketplace state the app needs:
 *  - the initialized `client` (for client-side SDK calls),
 *  - the raw `appContext` from `application.context`,
 *  - the resolved `sitecoreContextId` (Context ID) for the active tenant.
 *
 * A Full Screen app can be installed against multiple tenants; each tenant has
 * its own live/preview Context IDs. We default to the first tenant and expose a
 * setter so the UI can offer a tenant switcher when there is more than one.
 */
export interface MarketplaceContextValue {
  client: ClientSDK | null
  appContext: ApplicationContext | null
  /** The resolved Context ID passed to XMC GraphQL calls. */
  sitecoreContextId: string | null
  /** All tenants this app can access (from `resourceAccess`). */
  tenants: TenantSummary[]
  /** Index of the active tenant in `tenants`. */
  activeTenantIndex: number
  setActiveTenantIndex: (index: number) => void
  isInitialized: boolean
  isLoading: boolean
  error: Error | null
}

export interface TenantSummary {
  tenantId: string
  tenantName: string
  displayName: string
  liveContextId: string
  previewContextId: string
}

const MarketplaceContext = React.createContext<MarketplaceContextValue | null>(
  null,
)

export function MarketplaceProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const { client, error, isLoading, isInitialized } = useMarketplaceClient()

  const [appContext, setAppContext] =
    React.useState<ApplicationContext | null>(null)
  const [contextError, setContextError] = React.useState<Error | null>(null)
  const [activeTenantIndex, setActiveTenantIndex] = React.useState(0)

  React.useEffect(() => {
    if (!client) {
      return
    }

    let cancelled = false

    client
      .query("application.context")
      .then((res) => {
        if (!cancelled) {
          setAppContext((res.data as ApplicationContext) ?? null)
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setContextError(
            err instanceof Error ? err : new Error(String(err)),
          )
        }
      })

    return () => {
      cancelled = true
    }
  }, [client])

  const tenants = React.useMemo<TenantSummary[]>(() => {
    const access = appContext?.resourceAccess ?? []
    return access.map((entry) => ({
      tenantId: entry.tenantId,
      tenantName: entry.tenantName ?? entry.tenantId,
      displayName:
        entry.tenantDisplayName ?? entry.tenantName ?? entry.tenantId,
      liveContextId: entry.context?.live ?? "",
      previewContextId: entry.context?.preview ?? "",
    }))
  }, [appContext])

  // Keep the selected tenant index valid if the tenant list changes.
  React.useEffect(() => {
    if (tenants.length > 0 && activeTenantIndex >= tenants.length) {
      setActiveTenantIndex(0)
    }
  }, [tenants, activeTenantIndex])

  const sitecoreContextId =
    tenants[activeTenantIndex]?.previewContextId || null

  const value = React.useMemo<MarketplaceContextValue>(
    () => ({
      client,
      appContext,
      sitecoreContextId,
      tenants,
      activeTenantIndex,
      setActiveTenantIndex,
      isInitialized,
      isLoading,
      error: error ?? contextError,
    }),
    [
      client,
      appContext,
      sitecoreContextId,
      tenants,
      activeTenantIndex,
      isInitialized,
      isLoading,
      error,
      contextError,
    ],
  )

  return (
    <MarketplaceContext.Provider value={value}>
      {children}
    </MarketplaceContext.Provider>
  )
}

export function useMarketplace(): MarketplaceContextValue {
  const ctx = React.useContext(MarketplaceContext)
  if (!ctx) {
    throw new Error("useMarketplace must be used within a MarketplaceProvider")
  }
  return ctx
}
