import { Calendar } from "lucide-react"
import { useEffect, useState } from "react"

import { BaseFilter } from "@/components/filter/base-filter"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { DATE_OPTIONS } from "@/lib/date-ranges"
import { DATE_FILTER_KEY } from "@/lib/filter-storage"

export interface DateFilterProps {
  value?: string
  onChange?: (value: string) => void
  className?: string
}

export const DateFilter = ({ value, onChange, className }: DateFilterProps) => {
  const [selectedDateRange, setSelectedDateRange] = useState(value ?? "")

  // Sync with external value (e.g. initial state from page hydration)
  useEffect(() => {
    if (value !== undefined) {
      setSelectedDateRange(value)
    }
  }, [value])

  const handleDateRangeChange = (newValue: string) => {
    setSelectedDateRange(newValue)
    onChange?.(newValue)

    // Save to localStorage
    if (newValue) {
      localStorage.setItem(DATE_FILTER_KEY, newValue)
    } else {
      localStorage.removeItem(DATE_FILTER_KEY)
    }
  }

  const handleClear = () => {
    localStorage.removeItem(DATE_FILTER_KEY)
  }

  return (
    <BaseFilter
      value={selectedDateRange}
      onChange={handleDateRangeChange}
      onClear={handleClear}
      className={className}
    >
      <Select value={selectedDateRange} onValueChange={handleDateRangeChange}>
        <SelectTrigger className="w-48 bg-gray-800 border-gray-700 text-gray-200">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-gray-400" />
            {selectedDateRange ? (
              <span className="truncate">
                {DATE_OPTIONS.find((option) => option.value === selectedDateRange)?.label}
              </span>
            ) : (
              <SelectValue placeholder="All time" />
            )}
          </div>
        </SelectTrigger>
        <SelectContent className="bg-gray-800 border-gray-700">
          {DATE_OPTIONS.map((option) => (
            <SelectItem
              key={option.value}
              value={option.value}
              className="text-gray-200 hover:bg-gray-700"
            >
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </BaseFilter>
  )
}
