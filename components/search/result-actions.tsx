"use client"

import {
  mdiContentCopy,
  mdiOpenInNew,
  mdiPencilOutline,
} from "@mdi/js"
import * as React from "react"
import { toast } from "sonner"

import { useConfig } from "@/components/providers/config-provider"
import { useMarketplace } from "@/components/providers/marketplace-provider"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  buildExplorerUrl,
  buildPagesEditUrl,
  siteNameFromPath,
  type DeepLinkContext,
} from "@/lib/sitecore/deeplinks"
import { resolveSiteName } from "@/lib/sitecore/siteLookup"
import { Icon } from "@/lib/icon"
import type { SearchResultItem } from "@/lib/sitecore/types"

export function ResultActions({ item }: { item: SearchResultItem }) {
  const { client, appContext, sitecoreContextId } = useMarketplace()
  const { config } = useConfig()

  // Resolve the site once per item, then reuse it for any subsequent clicks.
  const siteNameRef = React.useRef<string | null | undefined>(undefined)

  async function getSiteName(): Promise<string | null> {
    if (siteNameRef.current !== undefined) {
      return siteNameRef.current
    }
    let name: string | null = null
    if (client && sitecoreContextId) {
      try {
        name = await resolveSiteName(
          client,
          sitecoreContextId,
          item.id,
          item.language,
        )
      } catch {
        name = null
      }
    }
    // Fall back to deriving the site from the path if the lookup came up empty.
    if (!name) {
      name = siteNameFromPath(item.path)
    }
    siteNameRef.current = name
    return name
  }

  async function open(mode: "pages" | "explorer") {
    const siteName = await getSiteName()
    const context: DeepLinkContext = {
      organizationId: appContext?.organizationId,
      // The technical tenant-name slug isn't available in a Full Screen app's
      // application.context (tenantName is null there), so it's supplied by the
      // admin on the Content Finder config item. Without it Pages shows a tenant
      // picker and can't resolve the item.
      tenantName: config.tenantName,
      siteName,
    }
    const target = { itemId: item.id, language: item.language }
    const url =
      mode === "pages"
        ? buildPagesEditUrl(target, context)
        : buildExplorerUrl(target, context)
    const label = mode === "pages" ? "Pages" : "Explorer"

    if (!url) {
      toast.error(`Couldn't build the ${label} link for this item.`)
      return
    }
    try {
      // Routes through the host so the iframe pop-up permission is honored.
      await client?.navigateToExternalUrl(url, true)
    } catch {
      window.open(url, "_blank", "noopener,noreferrer")
    }
  }

  async function copy(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value)
      toast.success(`${label} copied to clipboard.`)
    } catch {
      toast.error(`Couldn't copy the ${label.toLowerCase()}.`)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {item.hasLayout ? (
        <Button
          size="sm"
          variant="outline"
          onClick={() => open("pages")}
        >
          <Icon path={mdiPencilOutline} size={0.7} />
          Open in Pages
        </Button>
      ) : null}

      <Button
        size="sm"
        variant="outline"
        onClick={() => open("explorer")}
      >
        <Icon path={mdiOpenInNew} size={0.7} />
        Open in Explorer
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="ghost">
            <Icon path={mdiContentCopy} size={0.7} />
            Copy
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => copy(item.id, "Item ID")}>
            Copy item ID
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => copy(item.path, "Path")}>
            Copy path
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
