"use client"

import { MultiSelect } from "@/components/search/multi-select"
import { useConfig } from "@/components/providers/config-provider"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { SORT_OPTIONS } from "@/lib/config/defaults"
import type { SearchFilters } from "@/hooks/useSearch"
import type { SortParams } from "@/lib/sitecore/types"

export function FiltersToolbar({
  filters,
  setFields,
  setTemplateIds,
  setTagIds,
  setTagMatch,
  setSort,
}: {
  filters: SearchFilters
  setFields: (fields: string[]) => void
  setTemplateIds: (ids: string[]) => void
  setTagIds: (ids: string[]) => void
  setTagMatch: (mode: "ALL" | "ANY") => void
  setSort: (sort: SortParams) => void
}) {
  const { config, tags } = useConfig()

  const fieldOptions = config.searchableFields.map((f) => ({
    value: f,
    label: f,
  }))
  const templateOptions = config.allowedTemplates.map((t) => ({
    value: t.id,
    label: t.name,
  }))
  const tagOptions = tags.map((t) => ({ value: t.id, label: t.name }))

  const sortValue = `${filters.sort.field}:${filters.sort.direction}`

  return (
    <div className="flex flex-wrap items-center gap-2">
      <MultiSelect
        label="Fields"
        options={fieldOptions}
        selected={filters.fields}
        onChange={setFields}
        emptyHint="No searchable fields configured"
      />

      <MultiSelect
        label="Content type"
        options={templateOptions}
        selected={filters.templateIds}
        onChange={setTemplateIds}
        emptyHint="No templates configured"
      />

      <MultiSelect
        label="Tags"
        options={tagOptions}
        selected={filters.tagIds}
        onChange={setTagIds}
        emptyHint="No tags configured"
      />

      {filters.tagIds.length > 1 ? (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setTagMatch(filters.tagMatch === "ALL" ? "ANY" : "ALL")}
        >
          Tags: {filters.tagMatch === "ALL" ? "match all" : "match any"}
        </Button>
      ) : null}

      <div className="ml-auto">
        <Select
          value={sortValue}
          onValueChange={(value) => {
            const [field, direction] = value.split(":")
            setSort({ field, direction: direction as SortParams["direction"] })
          }}
        >
          <SelectTrigger size="sm" className="w-44">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((option) => (
              <SelectItem
                key={`${option.field}:${option.direction}`}
                value={`${option.field}:${option.direction}`}
              >
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
