import { Clock } from "lucide-react"
import { useMemo, useState } from "react"

import { GroupedEventsTable } from "@/components/grouped-events-table"
import { DataRow, ResourceTable } from "@/components/resource-table"
import { ColDef } from "@/components/resource-table/types"
import { Card } from "@/components/ui/card"
import { toast } from "@/hooks/use-toast"
import { deleteEvent, errorText } from "@/lib/api"
import { cn } from "@/lib/utils"
import { EditResourceSheet } from "./edit-resource-sheet"

import { formatDateTime } from "@starktech/core/browser"
import { WorkEvent } from "@/types"

type WorkEventDataRow = WorkEvent & DataRow

export interface EventsTableProps {
  data: WorkEventDataRow[] | WorkEvent[]
  loading?: boolean
  isGrouped: boolean
  className?: string
  onDataChange?: () => void
}

export const EventsTable = ({
  data,
  isGrouped = true,
  loading = false,
  className,
  onDataChange,
}: EventsTableProps) => {
  const [isEditSheetOpen, setIsEditSheetOpen] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<WorkEventDataRow | null>(null)

  const totalHours = useMemo(() => {
    const totalMinutes = (data as WorkEvent[]).reduce((sum, event) => sum + (event.minutes || 0), 0)
    return (totalMinutes / 60).toFixed(2)
  }, [data])

  const handleEditItem = (row: WorkEventDataRow) => {
    setSelectedEvent(row)
    setIsEditSheetOpen(true)
  }

  const handleDeleteItem = async (row: WorkEventDataRow) => {
    try {
      await deleteEvent(row.id)
      onDataChange?.()
    } catch (error) {
      toast({
        title: "Failed to delete event",
        description: errorText(error),
        variant: "destructive",
      })
    }
  }

  return (
    <div className={cn("space-y-6", className)}>
      {/* Summary Card */}
      <Card className="bg-gray-900/50 border-gray-700 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-gray-400" />
            <span className="text-gray-300 font-medium">Total Hours</span>
          </div>
          <div className="text-2xl font-bold text-primary">{totalHours}h</div>
        </div>
      </Card>

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : (
        <>
          {isGrouped ? (
            <GroupedEventsTable
              data={data}
              className="overflow-hidden rounded-xl bg-gray-900/50 border border-gray-700 shadow-inner p-4"
            />
          ) : (
            <ResourceTable
              initialData={[]}
              data={data as WorkEventDataRow[]}
              columnsDef={columnsDef}
              className="overflow-hidden rounded-xl bg-gray-900/50 border border-gray-700 shadow-inner"
              onDeleteItem={handleDeleteItem}
              onEditItem={handleEditItem}
              withCard={false}
            />
          )}
        </>
      )}
      <EditResourceSheet
        isOpen={isEditSheetOpen}
        onClose={() => setIsEditSheetOpen(false)}
        event={selectedEvent}
        onDataChange={() => {
          onDataChange?.()
        }}
      />
    </div>
  )
}

const columnsDef: Array<ColDef<WorkEventDataRow, string>> = [
  { field: "project", headerName: "Project" },
  {
    field: "minutes",
    headerName: "Duration (Minutes)",
    valueFormatter: ({ value }: { value: WorkEventDataRow }) => value.minutes?.toString() || "0",
  },
  { field: "description", headerName: "Description" },
  {
    field: "timestamp",
    headerName: "Timestamp",
    valueFormatter: ({ value }: { value: WorkEventDataRow }) => formatDateTime(value.timestamp),
  },
]
