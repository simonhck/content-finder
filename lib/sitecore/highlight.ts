import type { SearchResultItem } from "@/lib/sitecore/types"

export interface HighlightSegment {
  text: string
  highlighted: boolean
}

export interface FieldMatch {
  /** Field name that matched (e.g. "Title"). */
  field: string
  /** Snippet around the first match, split into highlighted/plain segments. */
  segments: HighlightSegment[]
}

const MAX_SNIPPET_LENGTH = 160
const CONTEXT_BEFORE = 40

/**
 * Splits the user's query into individual search terms. Terms shorter than two
 * characters are dropped (they create noisy, near-universal highlights).
 */
export function splitTerms(text: string): string[] {
  return Array.from(
    new Set(
      text
        .toLowerCase()
        .split(/\s+/)
        .map((t) => t.trim())
        .filter((t) => t.length >= 2),
    ),
  )
}

/**
 * Computes, for a result, the set of fields whose value contains any search
 * term — with a highlighted snippet for each. This is what powers the
 * "Matched in <Field>" explanation in the UI.
 */
export function computeMatches(
  item: SearchResultItem,
  text: string,
  searchedFields: string[],
): FieldMatch[] {
  const terms = splitTerms(text)
  if (terms.length === 0) {
    return []
  }

  // Only consider the fields the user actually searched (fallback: all returned).
  const fields =
    searchedFields.length > 0 ? searchedFields : Object.keys(item.fields)

  const matches: FieldMatch[] = []
  for (const field of fields) {
    const value = item.fields[field]
    if (!value) {
      continue
    }
    const segments = highlightSnippet(stripHtml(value), terms)
    if (segments?.some((s) => s.highlighted)) {
      matches.push({ field, segments })
    }
  }
  return matches
}

/** Finds the first matching term and returns a highlighted snippet around it. */
export function highlightSnippet(
  value: string,
  terms: string[],
): HighlightSegment[] | null {
  const lower = value.toLowerCase()

  let firstIndex = -1
  for (const term of terms) {
    const idx = lower.indexOf(term)
    if (idx !== -1 && (firstIndex === -1 || idx < firstIndex)) {
      firstIndex = idx
    }
  }

  if (firstIndex === -1) {
    return null
  }

  const start = Math.max(0, firstIndex - CONTEXT_BEFORE)
  const end = Math.min(value.length, start + MAX_SNIPPET_LENGTH)
  let snippet = value.slice(start, end)
  const prefix = start > 0 ? "…" : ""
  const suffix = end < value.length ? "…" : ""

  const segments = tokenizeHighlights(snippet, terms)
  if (prefix) {
    segments.unshift({ text: prefix, highlighted: false })
  }
  if (suffix) {
    segments.push({ text: suffix, highlighted: false })
  }
  return segments
}

/** Splits a string into highlighted/plain segments for all term occurrences. */
function tokenizeHighlights(
  text: string,
  terms: string[],
): HighlightSegment[] {
  const pattern = new RegExp(
    `(${terms.map(escapeRegExp).sort((a, b) => b.length - a.length).join("|")})`,
    "gi",
  )

  const segments: HighlightSegment[] = []
  let lastIndex = 0
  for (const match of text.matchAll(pattern)) {
    const index = match.index ?? 0
    if (index > lastIndex) {
      segments.push({ text: text.slice(lastIndex, index), highlighted: false })
    }
    segments.push({ text: match[0], highlighted: true })
    lastIndex = index + match[0].length
  }
  if (lastIndex < text.length) {
    segments.push({ text: text.slice(lastIndex), highlighted: false })
  }
  return segments
}

/** Strips HTML tags so rich-text field values produce clean snippets. */
export function stripHtml(value: string): string {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}
