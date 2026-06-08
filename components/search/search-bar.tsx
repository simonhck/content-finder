"use client"

import { mdiMagnify } from "@mdi/js"

import {
  SearchInput,
  SearchInputClearButton,
  SearchInputField,
  SearchInputLeftElement,
  SearchInputRightElement,
} from "@/components/ui/search-input"
import { Icon } from "@/lib/icon"

export function SearchBar({
  value,
  onChange,
  disabled,
}: {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}) {
  return (
    <SearchInput className="h-11">
      <SearchInputLeftElement>
        <Icon path={mdiMagnify} size={0.9} />
      </SearchInputLeftElement>
      <SearchInputField
        value={value}
        disabled={disabled}
        placeholder="Search content items…"
        onChange={(event) => onChange(event.target.value)}
        autoFocus
      />
      {value ? (
        <SearchInputRightElement>
          <SearchInputClearButton onClear={() => onChange("")} />
        </SearchInputRightElement>
      ) : null}
    </SearchInput>
  )
}
