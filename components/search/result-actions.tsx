"use client"

import {
  mdiContentCopy,
  mdiOpenInNew,
  mdiPencilOutline,
} from "@mdi/js"
import { toast } from "sonner"

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
  type DeepLinkContext,
} from "@/lib/sitecore/deeplinks"
import { Icon } from "@/lib/icon"
import type { SearchResultItem } from "@/lib/sitecore/types"

export function ResultActions({ item }: { item: SearchResultItem }) {
  const { client, appContext, tenants, activeTenantIndex } = useMarketplace()

  const linkContext: DeepLinkContext = {
    organizationId: appContext?.organizationId,
    tenantName: tenants[activeTenantIndex]?.tenantName,
  }

  const target = { itemId: item.id, language: item.language }
  const pagesUrl = item.hasLayout ? buildPagesEditUrl(target, linkContext) : null
  const explorerUrl = buildExplorerUrl(target, linkContext)

  async function open(url: string | null, label: string) {
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
      {pagesUrl ? (
        <Button
          size="sm"
          variant="outline"
          onClick={() => open(pagesUrl, "Pages")}
        >
          <Icon path={mdiPencilOutline} size={0.7} />
          Open in Pages
        </Button>
      ) : null}

      <Button
        size="sm"
        variant="outline"
        onClick={() => open(explorerUrl, "Explorer")}
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
