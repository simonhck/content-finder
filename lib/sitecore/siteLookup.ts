import type { ClientSDK } from "@sitecore-marketplace-sdk/client"

import { formatGuidBraced, normalizeGuid } from "@/lib/sitecore/guid"
import { runAuthoringGraphQL } from "@/lib/sitecore/searchClient"

/** Sitecore `Headless Site` template — the site root item uses this template. */
const HEADLESS_SITE_TEMPLATE_ID = "49f355b0a0954988bd1f2e2114cd2780"

interface AncestorNode {
  name?: string | null
  template?: { templateId?: string | null } | null
}

/**
 * Resolves the site name for an item by walking its ancestors and returning the
 * name of the first one built on the `Headless Site` template — i.e. the site
 * root the item belongs to. Returns null when no such ancestor exists (item
 * lives outside a site) or the lookup fails.
 */
export async function resolveSiteName(
  client: ClientSDK,
  sitecoreContextId: string,
  itemId: string,
  language?: string | null,
): Promise<string | null> {
  const id = formatGuidBraced(itemId)
  if (!id) {
    return null
  }

  const lang = (language || "en").toLowerCase()
  const query = `query ResolveSite {
  item(where: { itemId: ${JSON.stringify(id)}, language: ${JSON.stringify(lang)} }) {
    ancestors {
      name
      template { templateId }
    }
  }
}`

  const data = (await runAuthoringGraphQL(client, sitecoreContextId, query)) as {
    item?: { ancestors?: AncestorNode[] | null } | null
  }

  const ancestors = data?.item?.ancestors ?? []
  const site = ancestors.find(
    (a) => normalizeGuid(a?.template?.templateId) === HEADLESS_SITE_TEMPLATE_ID,
  )

  return site?.name ?? null
}
