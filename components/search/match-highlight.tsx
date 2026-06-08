import type { FieldMatch } from "@/lib/sitecore/highlight"

/**
 * Renders the "why this matched" explanation: for each field that matched, the
 * field label plus a snippet with the matching terms emphasized.
 */
export function MatchHighlight({ matches }: { matches: FieldMatch[] }) {
  if (matches.length === 0) {
    return null
  }

  return (
    <ul className="flex flex-col gap-1.5">
      {matches.map((match) => (
        <li key={match.field} className="text-sm leading-snug">
          <span className="text-subtle-text mr-1.5">
            Matched in <span className="font-medium">{match.field}</span>:
          </span>
          <span className="text-body-text">
            {match.segments.map((segment, index) =>
              segment.highlighted ? (
                <mark
                  key={index}
                  className="bg-primary-bg text-primary-fg rounded-sm px-0.5"
                >
                  {segment.text}
                </mark>
              ) : (
                <span key={index}>{segment.text}</span>
              ),
            )}
          </span>
        </li>
      ))}
    </ul>
  )
}
