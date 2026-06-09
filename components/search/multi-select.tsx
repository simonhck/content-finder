"use client"

import * as React from "react"

import { mdiChevronDown } from "@mdi/js"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Icon } from "@/lib/icon"

export interface MultiSelectOption {
  value: string
  label: string
}

/** Above this many options, show a search box to filter the list. */
const SEARCH_THRESHOLD = 8

/**
 * A compact popover multi-select with checkboxes. Used for the field, template,
 * and tag filters. Renders nothing useful (a disabled trigger) when there are
 * no options, so the toolbar stays clean before the config item is set up.
 *
 * Long lists (templates, fields) get a sticky search box and a scrollable body.
 */
export function MultiSelect({
  label,
  options,
  selected,
  onChange,
  emptyHint = "No options configured",
}: {
  label: string
  options: MultiSelectOption[]
  selected: string[]
  onChange: (values: string[]) => void
  emptyHint?: string
}) {
  const hasOptions = options.length > 0
  const showSearch = options.length > SEARCH_THRESHOLD

  const [query, setQuery] = React.useState("")

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter((o) => o.label.toLowerCase().includes(q))
  }, [options, query])

  function toggle(value: string, checked: boolean) {
    onChange(
      checked ? [...selected, value] : selected.filter((v) => v !== value),
    )
  }

  // Clear the filter whenever the popover closes so it reopens fresh.
  function handleOpenChange(open: boolean) {
    if (!open) setQuery("")
  }

  return (
    <Popover onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="justify-between gap-2">
          {label}
          {selected.length > 0 ? (
            <Badge colorScheme="primary" size="sm">
              {selected.length}
            </Badge>
          ) : null}
          <Icon path={mdiChevronDown} size={0.6} />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-0">
        {hasOptions ? (
          <>
            {showSearch ? (
              <div className="border-border-color border-b p-2">
                <Input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={`Filter ${label.toLowerCase()}…`}
                  className="h-8"
                />
              </div>
            ) : null}
            <div className="max-h-72 overflow-y-auto">
              <div className="flex flex-col gap-1 p-2">
                {filtered.length > 0 ? (
                  filtered.map((option) => {
                    const checked = selected.includes(option.value)
                    return (
                      <Label
                        key={option.value}
                        className="hover:bg-neutral-bg flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm font-normal"
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(state) =>
                            toggle(option.value, state === true)
                          }
                        />
                        <span className="truncate">{option.label}</span>
                      </Label>
                    )
                  })
                ) : (
                  <p className="text-subtle-text px-2 py-1.5 text-sm">
                    No matches
                  </p>
                )}
              </div>
            </div>
          </>
        ) : (
          <p className="text-subtle-text p-4 text-sm">{emptyHint}</p>
        )}
        {selected.length > 0 ? (
          <div className="border-border-color border-t p-2">
            <Button
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={() => onChange([])}
            >
              Clear selection
            </Button>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  )
}
