import type { RunGraphQL } from "@/lib/config/derive"
import { formatGuidBraced, normalizeGuid } from "@/lib/sitecore/guid"
import type { TagOption } from "@/lib/sitecore/types"

/**
 * Loads the tag filter options from the configured Tags Root.
 *
 * Tags are plain Sitecore items: each direct child of the Tags Root becomes a
 * tag option, using the item's name as the label and its GUID as the value. No
 * special fields are required on a tag item.
 *
 * Query shape mirrors the other Authoring reads in this project
 * (`item(where:{itemId}) { children { ... } }`). On any failure we return `[]`
 * so the rest of the config load stays usable the tag filter simply shows
 * "No tags configured".
 */
export async function fetchTagOptions(
  run: RunGraphQL,
  tagsRoot: string | null,
): Promise<TagOption[]> {
  const id = formatGuidBraced(tagsRoot)
  if (!id) {
    return []
  }
  try {
    const data = (await run(buildTagsQuery(id))) as
      | TagsResponse
      | null
      | undefined
    return parseTagOptions(data)
  } catch (err) {
    console.warn("[ContentFinder] tag taxonomy read failed:", err)
    return []
  }
}

function buildTagsQuery(bracedId: string): string {
  return `query ContentFinderTags {
  item(where: { database: "master", itemId: ${JSON.stringify(bracedId)} }) {
    children {
      nodes {
        itemId
        name
      }
    }
  }
}`
}

function parseTagOptions(
  data: TagsResponse | null | undefined,
): TagOption[] {
  const nodes = data?.item?.children?.nodes ?? []
  const tags: TagOption[] = []
  for (const node of nodes) {
    const id = normalizeGuid(node?.itemId)
    const name = node?.name?.trim()
    if (id && name) {
      tags.push({ id, name })
    }
  }
  return tags.sort((a, b) => a.name.localeCompare(b.name))
}

interface TagsResponse {
  item?: {
    children?: {
      nodes?: Array<{ itemId?: string | null; name?: string | null } | null> | null
    } | null
  } | null
}
