import { Calendar, Clock, FileText } from "lucide-react"
import { useMemo } from "react"

import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { groupEvents } from "@starktech/core/browser"

import { WorkEvent } from "@/types"

export interface GroupedEventsTableProps {
  data: WorkEvent[]
  className?: string
}

export const GroupedEventsTable = ({ data, className }: GroupedEventsTableProps) => {
  const groupedData = useMemo(() => groupEvents(data), [data])

  // group.date is a local YYYY-MM-DD; build the Date from parts so it isn't read as UTC
  const formatDate = (dateKey: string) => {
    const [year, month, day] = dateKey.split("-").map(Number)
    return new Date(year, month - 1, day).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    })
  }

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60)
    const remainingMinutes = minutes % 60
    if (hours > 0) {
      return `${hours}h ${remainingMinutes}m`
    }
    return `${remainingMinutes}m`
  }

  const formatHours = (minutes: number) => {
    return (minutes / 60).toFixed(2)
  }

  return (
    <div className={cn("space-y-3", className)}>
      {/* Grouped Events List */}
      <div className="space-y-2">
        {groupedData.map((group, index) => (
          <Card key={index} className="bg-gray-900/50 border-gray-700 p-3">
            <div className="flex items-center justify-between gap-4">
              {/* Date */}
              <div className="flex items-center gap-2 text-sm text-gray-400 min-w-[80px]">
                <Calendar className="h-4 w-4" />
                <span>{formatDate(group.date)}</span>
              </div>

              {/* Project */}
              <div className="text-sm font-medium text-gray-300 min-w-[120px] truncate">
                {group.project}
              </div>

              {/* Description */}
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <FileText className="h-4 w-4 text-gray-400 flex-shrink-0" />
                <span className="text-sm text-gray-200 truncate">{group.description}</span>
              </div>

              {/* Duration and Count */}
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1 text-gray-300">
                  <Clock className="h-4 w-4" />
                  <span>{formatDuration(group.totalMinutes)}</span>
                </div>
                <div className="text-primary font-medium min-w-[50px] text-right">
                  {formatHours(group.totalMinutes)}h
                </div>
                <div className="text-xs text-gray-500 min-w-[70px] text-right">
                  {group.eventCount} entries
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {groupedData.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          No events found for the selected filters.
        </div>
      )}
    </div>
  )
}
