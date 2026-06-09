import type { RunGraphQL } from "@/lib/config/derive"
import { formatGuidBraced, normalizeGuid } from "@/lib/sitecore/guid"
import type { ContentFinderConfig } from "@/lib/sitecore/types"

/**
 * Reads the admin-maintained "Content Finder Config" item from Sitecore by its
 * GUID and maps its fields onto a partial {@link ContentFinderConfig}.
 *
 * The item is located by GUID (supplied via the `NEXT_PUBLIC_CONTENT_FINDER_CONFIG_ID`
 * env var) rather than by path, so renaming/moving the item doesn't break the
 * app. Only fields that are present and non-empty are returned the caller
 * merges them over {@link DEFAULT_CONFIG}, so every setting degrades gracefully.
 *
 * Expected fields on the config item (see the Content Finder Config template):
 *  - "Search Roots" Treelist; pipe-separated root GUIDs (the search scope).
 *  - "Tag Field"    Single-Line Text; name of the multilist tag field.
 *  - "Tags Root"    Droptree; root GUID of the tag taxonomy.
 *  - "Tenant Name"  Single-Line Text; XM Cloud tenant-name slug for deep links.
 */
export async function fetchConfigItem(
  run: RunGraphQL,
  configItemId: string,
): Promise<Partial<ContentFinderConfig>> {
  const data = (await run(buildConfigItemQuery(configItemId))) as
    | ConfigItemResponse
    | null
    | undefined
  return parseConfigItem(data)
}

function buildConfigItemQuery(configItemId: string): string {
  // Sitecore accepts the braced/dashed GUID form for `item(where:{itemId})`.
  const id = formatGuidBraced(configItemId) ?? configItemId
  return `query ContentFinderConfig {
  item(where: { database: "master", itemId: ${JSON.stringify(id)} }) {
    fields(ownFields: true, excludeStandardFields: true) {
      nodes {
        name
        value
      }
    }
  }
}`
}

function parseConfigItem(
  data: ConfigItemResponse | null | undefined,
): Partial<ContentFinderConfig> {
  const nodes = data?.item?.fields?.nodes ?? []
  const get = (fieldName: string): string | null => {
    const match = nodes.find(
      (n) => n?.name?.trim().toLowerCase() === fieldName.toLowerCase(),
    )
    const value = match?.value
    return typeof value === "string" && value.trim().length > 0
      ? value.trim()
      : null
  }

  const result: Partial<ContentFinderConfig> = {}

  const searchRootsRaw = get("Search Roots")
  if (searchRootsRaw) {
    const roots = searchRootsRaw
      .split("|")
      .map((r) => normalizeGuid(r))
      .filter((r): r is string => r !== null)
    if (roots.length > 0) {
      result.searchRoots = roots
    }
  }

  const tagField = get("Tag Field")
  if (tagField) {
    result.tagField = tagField
  }

  const tagsRoot = normalizeGuid(get("Tags Root"))
  if (tagsRoot) {
    result.tagsRoot = tagsRoot
  }

  const tenantName = get("Tenant Name")
  if (tenantName) {
    result.tenantName = tenantName
  }

  return result
}

interface ConfigItemResponse {
  item?: {
    fields?: {
      nodes?: Array<{ name?: string | null; value?: string | null } | null> | null
    } | null
  } | null
}
