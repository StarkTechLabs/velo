import { X } from "lucide-react"
import { ReactNode } from "react"

import { Button } from "@/components/ui/button"

export interface BaseFilterProps {
  value?: string
  onChange?: (value: string) => void
  onClear?: () => void
  className?: string
  children: ReactNode
  showClear?: boolean
}

export const BaseFilter = ({
  value,
  onChange,
  onClear,
  className,
  children,
  showClear = true,
}: BaseFilterProps) => {
  const handleClear = () => {
    onChange?.("")
    onClear?.()
  }

  return (
    <div className={`flex items-center gap-0.5 ${className}`}>
      {children}
      {showClear && value && (
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-8 w-8 text-gray-400 hover:text-gray-200 hover:bg-gray-700"
          onClick={handleClear}
          aria-label="Clear filter"
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  )
}
