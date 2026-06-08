/**
 * Normalizes a Sitecore item/template GUID to the form the Authoring search
 * index expects: lowercase, no dashes, no braces.
 *
 * Accepts any of: `{110D559F-DEA5-42EA-9C1C-8A5DF7E70EF9}`,
 * `110d559f-dea5-42ea-9c1c-8a5df7e70ef9`, or an already-normalized value.
 * Returns the cleaned value, or null when the input isn't a GUID.
 */
export function normalizeGuid(value: string | null | undefined): string | null {
  if (!value) {
    return null
  }

  const cleaned = value.replace(/[{}\-\s]/g, "").toLowerCase()

  if (!/^[0-9a-f]{32}$/.test(cleaned)) {
    return null
  }

  return cleaned
}

/** True when the value looks like a Sitecore GUID (in any common format). */
export function isGuid(value: string | null | undefined): boolean {
  return normalizeGuid(value) !== null
}

/**
 * Formats a GUID into the braced, dashed, upper-case form Sitecore editor
 * deep links expect: `{XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX}`.
 * Returns null when the input isn't a GUID.
 */
export function formatGuidBraced(
  value: string | null | undefined,
): string | null {
  const normalized = normalizeGuid(value)
  if (!normalized) {
    return null
  }
  const g = normalized.toUpperCase()
  return `{${g.slice(0, 8)}-${g.slice(8, 12)}-${g.slice(12, 16)}-${g.slice(16, 20)}-${g.slice(20)}}`
}
