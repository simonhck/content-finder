"use client"

import { mdiFileDocumentOutline, mdiWeb } from "@mdi/js"

import { MatchHighlight } from "@/components/search/match-highlight"
import { ResultActions } from "@/components/search/result-actions"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { computeMatches } from "@/lib/sitecore/highlight"
import { Icon } from "@/lib/icon"
import type { SearchResultItem } from "@/lib/sitecore/types"

export function ResultCard({
  item,
  query,
  searchedFields,
}: {
  item: SearchResultItem
  query: string
  searchedFields: string[]
}) {
  const matches = computeMatches(item, query, searchedFields)

  return (
    <Card
      padding="md"
      className="border-border-color gap-3 hover:shadow-sm"
    >
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-base font-semibold">{item.name}</h3>
          {item.templateName ? (
            <Badge colorScheme="primary">
              <Icon path={mdiFileDocumentOutline} size={0.55} />
              {item.templateName}
            </Badge>
          ) : null}
          {item.hasLayout ? (
            <Badge colorScheme="teal">
              <Icon path={mdiWeb} size={0.55} />
              Page
            </Badge>
          ) : null}
          {item.language ? (
            <Badge colorScheme="neutral">{item.language}</Badge>
          ) : null}
        </div>
        <p className="text-subtle-text font-mono text-xs break-all">
          {item.path}
        </p>
      </div>

      {matches.length > 0 ? <MatchHighlight matches={matches} /> : null}

      <ResultActions item={item} />
    </Card>
  )
}
