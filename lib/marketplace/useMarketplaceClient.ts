"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import { ClientSDK } from "@sitecore-marketplace-sdk/client"
import { XMC } from "@sitecore-marketplace-sdk/xmc"

/**
 * Single shared ClientSDK instance for the whole app.
 *
 * The Marketplace SDK performs a postMessage handshake with the host
 * (SitecoreAI) the first time it initializes. We keep one instance (and one
 * in-flight init promise) at module scope so React Strict Mode double-invokes
 * and multiple consumers don't trigger competing handshakes.
 */
let clientInstance: ClientSDK | null = null
let initPromise: Promise<ClientSDK> | null = null

function createClient(): Promise<ClientSDK> {
  if (clientInstance) {
    return Promise.resolve(clientInstance)
  }

  if (!initPromise) {
    initPromise = ClientSDK.init({
      // The host (SitecoreAI) renders this app inside an iframe, so the
      // postMessage target is the parent window.
      target: window.parent,
      // Register the XMC module so `xmc.*` query/mutation keys are available.
      modules: [XMC],
    })
      .then((client) => {
        clientInstance = client
        return client
      })
      .catch((error) => {
        // Allow a later retry if the handshake failed.
        initPromise = null
        throw error
      })
  }

  return initPromise
}

export interface UseMarketplaceClientOptions {
  /** Number of init attempts before giving up. */
  retryAttempts?: number
  /** Delay between attempts, in milliseconds. */
  retryDelay?: number
  /** Initialize automatically on mount. Defaults to true. */
  autoInit?: boolean
}

export interface UseMarketplaceClientResult {
  client: ClientSDK | null
  error: Error | null
  isLoading: boolean
  isInitialized: boolean
  /** Manually (re)trigger initialization. */
  initialize: () => Promise<void>
}

const DEFAULTS = {
  retryAttempts: 3,
  retryDelay: 1000,
  autoInit: true,
} satisfies Required<UseMarketplaceClientOptions>

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Initializes (once) and exposes the Marketplace ClientSDK.
 *
 * Returns the shared client plus loading/error state. The client is only
 * available in the browser (the SDK needs `window.parent`), so this hook is a
 * no-op during SSR.
 */
export function useMarketplaceClient(
  options: UseMarketplaceClientOptions = {},
): UseMarketplaceClientResult {
  const { retryAttempts, retryDelay, autoInit } = { ...DEFAULTS, ...options }

  const [client, setClient] = useState<ClientSDK | null>(clientInstance)
  const [error, setError] = useState<Error | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const isMounted = useRef(true)

  const initialize = useCallback(async () => {
    if (typeof window === "undefined") {
      return
    }

    setIsLoading(true)
    setError(null)

    let lastError: Error | null = null

    for (let attempt = 1; attempt <= retryAttempts; attempt++) {
      try {
        const ready = await createClient()
        if (isMounted.current) {
          setClient(ready)
          setIsLoading(false)
        }
        return
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err))
        if (attempt < retryAttempts) {
          await delay(retryDelay)
        }
      }
    }

    if (isMounted.current) {
      setError(lastError)
      setIsLoading(false)
    }
  }, [retryAttempts, retryDelay])

  useEffect(() => {
    isMounted.current = true

    if (autoInit && !clientInstance) {
      void initialize()
    } else if (clientInstance) {
      setClient(clientInstance)
    }

    return () => {
      isMounted.current = false
    }
  }, [autoInit, initialize])

  return {
    client,
    error,
    isLoading,
    isInitialized: client !== null,
    initialize,
  }
}
