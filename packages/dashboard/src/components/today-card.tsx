import { ChevronDown, ChevronUp, Clock, FileText, Pencil } from "lucide-react"
import { useMemo, useState } from "react"

import { getDateRangeFromValue } from "@/lib/date-ranges"
import { EditResourceSheet } from "@/components/edit-resource-sheet"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { formatDateTime } from "@starktech/core/browser"
import { cn } from "@/lib/utils"
import { WorkEvent } from "@/types"

function isToday(ts: string | null): boolean {
  if (!ts) return false
  const d = new Date(ts)
  const today = new Date()
  return (
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate()
  )
}

export function dateRangeIncludesToday(selectedDateRange: string): boolean {
  if (!selectedDateRange) return true // "All time" includes today
  const range = getDateRangeFromValue(selectedDateRange)
  if (!range) return false
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const endOfToday = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000 - 1)
  return range.maxDate >= startOfToday && range.minDate <= endOfToday
}

export interface TodayCardProps {
  data: WorkEvent[]
  selectedDateRange: string
  selectedProjects: string[]
  onDataChange: () => void
  className?: string
}

function formatDuration(minutes: number) {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

export function TodayCard({ data, selectedDateRange, onDataChange, className }: TodayCardProps) {
  const [isOpen, setIsOpen] = useState(true)
  const [isEditSheetOpen, setIsEditSheetOpen] = useState(false)
  const [eventToEdit, setEventToEdit] = useState<WorkEvent | null>(null)

  const includesToday = dateRangeIncludesToday(selectedDateRange)

  const { totalMinutesToday, byProject, lastEvent } = useMemo(() => {
    const todayEvents = data.filter((e) => isToday(e.timestamp))
    const total = todayEvents.reduce((sum, e) => sum + (e.minutes ?? 0), 0)
    const byProject: Record<string, number> = {}
    todayEvents.forEach((e) => {
      byProject[e.project] = (byProject[e.project] || 0) + (e.minutes ?? 0)
    })
    const last =
      todayEvents.length > 0
        ? todayEvents.sort(
            (a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime(),
          )[0]
        : null
    return { totalMinutesToday: total, byProject, lastEvent: last }
  }, [data])

  const totalHoursToday = (totalMinutesToday / 60).toFixed(2)
  const projectEntries = Object.entries(byProject).sort((a, b) => b[1] - a[1])

  return (
    <>
      <Card
        className={cn(
          "bg-gray-900/50 rounded-2xl border border-gray-700 shadow-2xl backdrop-blur-sm overflow-hidden",
          className,
        )}
      >
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <CollapsibleTrigger className="w-full px-6 py-0 flex items-center gap-2 transition-colors text-left cursor-pointer">
            <span className="text-lg font-medium text-gray-200 cursor-pointer">Today</span>
            {isOpen ? (
              <ChevronUp className="h-4 w-4 text-gray-200 hover:text-gray-700" />
            ) : (
              <ChevronDown className="h-4 w-4 text-gray-200 hover:text-gray-700" />
            )}
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="px-6 pb-0 pt-2">
              {!includesToday ? (
                <p className="text-gray-500 text-sm">
                  Select a date range that includes today to see today&apos;s summary.
                </p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-[1fr_1px_1fr] md:gap-0">
                  <div className="space-y-4 md:pr-6">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Clock className="h-5 w-5 text-gray-400" />
                        <span className="text-gray-300 font-medium">Total hours logged today</span>
                      </div>
                      <span className="text-2xl font-bold text-primary">{totalHoursToday}h</span>
                    </div>

                    {projectEntries.length > 0 && (
                      <div>
                        <div className="text-sm font-medium text-gray-400 mb-2">By project</div>
                        <ul className="space-y-1.5">
                          {projectEntries.map(([project, minutes]) => (
                            <li
                              key={project}
                              className="flex justify-between text-sm text-gray-300"
                            >
                              <span>{project}</span>
                              <span>{formatDuration(minutes)}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  <div
                    className="hidden md:block w-px bg-gray-700 min-h-[1px] self-stretch"
                    aria-hidden
                  />

                  <div className="md:pl-6 pt-4 md:pt-0">
                    {lastEvent ? (
                      <>
                        <div className="text-sm font-medium text-gray-400 mb-2">
                          Last logged event
                        </div>
                        <div className="flex items-center justify-between gap-4 p-3 rounded-lg bg-gray-800/50 border border-gray-700">
                          <div className="min-w-0 flex-1 flex items-center gap-2">
                            <FileText className="h-4 w-4 text-gray-400 flex-shrink-0" />
                            <div className="min-w-0">
                              <div className="text-gray-200 truncate">
                                {lastEvent.description || "—"}
                              </div>
                              <div className="text-xs text-gray-500">
                                {lastEvent.project} · {formatDateTime(lastEvent.timestamp)} ·{" "}
                                {formatDuration(lastEvent.minutes ?? 0)}
                              </div>
                            </div>
                          </div>
                          <Button
                            variant="icon"
                            size="icon"
                            className="flex-shrink-0 bg-gray-700 hover:bg-gray-600 text-gray-200"
                            onClick={(e) => {
                              e.preventDefault()
                              setEventToEdit(lastEvent)
                              setIsEditSheetOpen(true)
                            }}
                            title="Edit event"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </div>
                      </>
                    ) : (
                      <p className="text-gray-500 text-sm">
                        No events logged today for the current filters.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      <EditResourceSheet
        isOpen={isEditSheetOpen}
        onClose={() => {
          setIsEditSheetOpen(false)
          setEventToEdit(null)
        }}
        onDataChange={onDataChange}
        event={eventToEdit}
        sheetTitle="Edit Event"
      />
    </>
  )
}
