"use client"

import { MultiSelect } from "@/components/search/multi-select"
import { useConfig } from "@/components/providers/config-provider"
import { Button } from "@/components/ui/button"
import type { SearchFilters } from "@/hooks/useSearch"

export function FiltersToolbar({
  filters,
  setFields,
  setTemplateIds,
  setTagIds,
  setTagMatch,
}: {
  filters: SearchFilters
  setFields: (fields: string[]) => void
  setTemplateIds: (ids: string[]) => void
  setTagIds: (ids: string[]) => void
  setTagMatch: (mode: "ALL" | "ANY") => void
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

  return (
    <div className="flex flex-wrap items-center gap-2">
      <MultiSelect
        label="Search in Fields"
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
    </div>
  )
}
