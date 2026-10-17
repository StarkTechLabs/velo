import { Download, Filter, Group, List, Plus, RefreshCcw, Search } from "lucide-react"
import { useEffect, useState } from "react"

import { HoursByProjectChart } from "@/components/charts/hours-by-project-chart"
import { HoursPerDayChart } from "@/components/charts/hours-per-day-chart"
import { DateFilter } from "@/components/date-filter"
import { getDateRangeFromValue } from "@/lib/date-ranges"
import { EditResourceSheet } from "@/components/edit-resource-sheet"
import { EventsTable } from "@/components/events-table"
import { FilterContainer } from "@/components/filter/filter-container"
import { ProjectFilter } from "@/components/project-filter"
import { TodayCard } from "@/components/today-card"
import { Button } from "@/components/ui/button"

import SearchBar from "@/components/search/bar"
import { useDebounce } from "@/hooks/use-debounce"
import { toast } from "sonner"
import { getInitialDateFilter, getInitialProjectFilter } from "@/lib/filter-storage"
import { cn } from "@/lib/utils"
import { ApiError, errorText, fetchCsv, fetchEvents, fetchHealth } from "@/lib/api"
import { downloadCSV } from "@/lib/download"
import { versionsCompatible } from "@starktech/core/browser"

import { WorkEvent } from "@/types"

export default function App() {
  const [data, setData] = useState<WorkEvent[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedProjects, setSelectedProjects] = useState<string[]>([])
  const [selectedDateRange, setSelectedDateRange] = useState("")
  const [filtersHydrated, setFiltersHydrated] = useState(false)
  const [isGrouped, setIsGrouped] = useState(true)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(500)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const [apiVersion, setApiVersion] = useState<string | null>(null)
  const [showFilters, setShowFilters] = useState(true)
  const [showSearch, setShowSearch] = useState(false)
  const [isAddEventSheetOpen, setIsAddEventSheetOpen] = useState(false)

  const debouncedTerm = useDebounce(searchTerm, 300)

  // The dashboard and API are separate installs; tell the user if they have drifted apart.
  useEffect(() => {
    fetchHealth()
      .then((health) => setApiVersion(health.version))
      .catch(() => {}) // an unreachable API is reported by the data fetch below
  }, [])

  // Hydrate filter state from localStorage before first fetch (avoids flash of unfiltered data)
  useEffect(() => {
    setSelectedProjects(getInitialProjectFilter())
    setSelectedDateRange(getInitialDateFilter())
    setFiltersHydrated(true)
  }, [])

  const handleToggleFilters = () => {
    setShowFilters((prev) => !prev)
  }

  const handleToggleSearch = () => {
    setShowSearch((prev) => !prev)
  }

  const handleToggleAddEventSheet = () => {
    setIsAddEventSheetOpen((prev) => !prev)
  }

  const handleProjectChange = (projects: string[]) => {
    setSelectedProjects(projects)
    setPage(1) // Reset to first page when filter changes
  }

  const handleDateRangeChange = (dateRange: string) => {
    setSelectedDateRange(dateRange)
    setPage(1) // Reset to first page when filter changes
  }

  const currentQuery = () => {
    const range = selectedDateRange ? getDateRangeFromValue(selectedDateRange) : null
    return {
      term: debouncedTerm,
      projects: selectedProjects,
      minDate: range?.minDate,
      maxDate: range?.maxDate,
      page,
      pageSize,
    }
  }

  const handleDataFetch = async () => {
    setLoading(true)
    try {
      const result = await fetchEvents(currentQuery())
      setConnectionError(null)
      setTotal(result.total)
      setData(result.data)
    } catch (error) {
      if (error instanceof ApiError && error.status === 0) {
        setConnectionError(error.message)
      } else {
        toast.error("Failed to query data", { description: errorText(error) })
      }
    } finally {
      setLoading(false)
    }
  }

  const handleToggleGrouping = () => {
    setIsGrouped((prev) => !prev)
  }

  const handleExportCSV = async () => {
    if (data.length === 0) {
      toast.error("No data to export", {
        description: "Please apply filters to get data before exporting.",
      })
      return
    }

    try {
      const csvContent = await fetchCsv(currentQuery())
      const timestamp = new Date().toISOString().split("T")[0]
      const filename = `velo-export-${timestamp}.csv`
      downloadCSV(csvContent, filename)

      toast.success("Export successful", { description: `Exported events to ${filename}` })
    } catch (error) {
      console.error("Export failed:", error)
      toast.error("Export failed", { description: errorText(error) })
    }
  }

  useEffect(() => {
    if (!filtersHydrated) return
    handleDataFetch()
  }, [filtersHydrated, debouncedTerm, selectedProjects, selectedDateRange, page])

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="bg-gray-900/50 shadow-2xl border-b-1 border-gray-700 w-full">
        <div className="py-4 px-8 md:px-14 max-w-7xl mx-auto">
          <div className="flex flex-row items-center justify-between gap-4">
            <h1 className="text-xl font-bold text-white">velo</h1>
            <div className="flex items-center gap-2">
              <Button
                variant="icon"
                onClick={handleToggleSearch}
                className={cn(
                  "rounded-lg shadow-md transition-all duration-200 hover:shadow-lg",
                  showSearch
                    ? "bg-primary hover:bg-primary/80 text-white"
                    : "bg-gray-800 hover:bg-gray-700 text-gray-200",
                )}
                title="Search"
              >
                <Search className={showSearch ? "text-white" : "text-primary"} />
              </Button>
              <Button
                variant="icon"
                onClick={handleToggleAddEventSheet}
                className="bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-lg shadow-md transition-all duration-200 hover:shadow-lg"
                title="Add new event"
              >
                <Plus className="text-primary" />
              </Button>
              <Button
                variant="icon"
                onClick={handleToggleFilters}
                className={cn(
                  "rounded-lg shadow-md transition-all duration-200 hover:shadow-lg",
                  showFilters
                    ? "bg-primary hover:bg-primary/80 text-white"
                    : "bg-gray-800 hover:bg-gray-700 text-gray-200",
                )}
                title="Toggle filters"
              >
                <Filter className={showFilters ? "text-white" : "text-primary"} />
              </Button>
              <Button
                variant="icon"
                onClick={handleToggleGrouping}
                className={cn(
                  "rounded-lg shadow-md transition-all duration-200 hover:shadow-lg",
                  isGrouped
                    ? "bg-primary hover:bg-primary/80 text-white"
                    : "bg-gray-800 hover:bg-gray-700 text-gray-200",
                )}
                title={isGrouped ? "Switch to list view" : "Switch to grouped view"}
              >
                {isGrouped ? <List className="text-white" /> : <Group className="text-primary" />}
              </Button>
              <Button
                variant="icon"
                onClick={handleDataFetch}
                className="bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-lg shadow-md transition-all duration-200 hover:shadow-lg"
                title="Refresh"
              >
                <RefreshCcw className="text-primary" />
              </Button>
              <Button
                variant="icon"
                onClick={handleExportCSV}
                className="bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-lg shadow-md transition-all duration-200 hover:shadow-lg"
                title="Export to CSV"
              >
                <Download className="text-primary" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/** Content */}
      <div className="max-w-7xl mx-auto space-y-6 py-6 px-6 md:px-12">
        {showSearch && (
          <div className="bg-gray-900/50 rounded-2xl shadow-2xl border border-gray-700 p-6 backdrop-blur-sm">
            <SearchBar
              value={searchTerm}
              onChange={(val) => {
                setSearchTerm(val)
                setPage(1)
              }}
            />
          </div>
        )}

        {showFilters && (
          <div className="bg-gray-900/50 rounded-2xl shadow-2xl border border-gray-700 p-6 backdrop-blur-sm">
            <FilterContainer className="mb-0">
              <ProjectFilter value={selectedProjects} onChange={handleProjectChange} />
              <DateFilter value={selectedDateRange} onChange={handleDateRangeChange} />
            </FilterContainer>
          </div>
        )}

        {apiVersion && !versionsCompatible(__APP_VERSION__, apiVersion) && (
          <div
            role="status"
            className="bg-gray-900/50 rounded-2xl shadow-2xl border border-gray-700 p-6 backdrop-blur-sm text-gray-300 text-sm"
          >
            The dashboard (v{__APP_VERSION__}) and the API (v{apiVersion}) are different versions
            and may not work together. Update both: npm install -g @starktech/velo-api@latest
            @starktech/velo-dashboard@latest, then velo stop && velo start.
          </div>
        )}

        {connectionError && (
          <div
            role="alert"
            className="bg-gray-900/50 rounded-2xl shadow-2xl border border-gray-700 p-6 backdrop-blur-sm flex items-center justify-between gap-4"
          >
            <p className="text-gray-300 text-sm">{connectionError}</p>
            <Button variant="outline" onClick={handleDataFetch}>
              Retry
            </Button>
          </div>
        )}

        {data && total > data.length && (
          <div className="text-center text-gray-500 text-sm">
            Max rows reached. Use filters to narrow down results.
          </div>
        )}

        <TodayCard
          data={data}
          selectedDateRange={selectedDateRange}
          selectedProjects={selectedProjects}
          onDataChange={handleDataFetch}
        />

        {/* Charts */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <HoursByProjectChart data={data} />
          <HoursPerDayChart data={data} />
        </div>

        {/* Events Table */}
        <EventsTable
          data={data.map((event) => ({ ...event, id: event.id || Math.random().toString() }))}
          isGrouped={isGrouped}
          loading={loading}
          onDataChange={handleDataFetch}
        />

        <div className="text-center">
          <p className="text-gray-500 text-sm">v{__APP_VERSION__}</p>
        </div>
      </div>
      <EditResourceSheet
        isOpen={isAddEventSheetOpen}
        onClose={handleToggleAddEventSheet}
        onDataChange={handleDataFetch}
        event={null}
        sheetTitle="Add New Event"
      />
    </div>
  )
}
