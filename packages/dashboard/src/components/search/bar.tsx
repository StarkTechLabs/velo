import { Search } from "lucide-react"
import { ChangeEvent, useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export interface SearchBarProps {
  value: string
  onChange?: (val: string) => void
  placeholder?: string
}

const SearchBar = ({ value = "", onChange, placeholder = "Search..." }: SearchBarProps) => {
  const [search, setSearch] = useState(value)

  const handleInput = (e: ChangeEvent<HTMLInputElement>) => {
    setSearch(e?.target?.value || "")
    if (onChange) onChange(e?.target?.value || "")
  }

  const handleClear = () => {
    setSearch("")
    if (onChange) onChange("")
  }

  return (
    <div className="flex items-center gap-2 w-full">
      <div className="relative flex-1">
        <Input
          type="text"
          value={search}
          onChange={handleInput}
          placeholder={placeholder}
          className="pl-10 pr-8 text-foreground"
        />
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-foreground w-5 h-5" />
        {search && (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="absolute right-1 top-1/2 -translate-y-1/2"
            onClick={handleClear}
            aria-label="Clear search"
          >
            ×
          </Button>
        )}
      </div>
    </div>
  )
}

export default SearchBar
