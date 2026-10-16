import { FolderKanban, X } from "lucide-react"
import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { fetchProjects } from "@/lib/api"
import { PROJECT_FILTER_KEY } from "@/lib/filter-storage"

export interface ProjectFilterProps {
  value?: string[]
  onChange?: (value: string[]) => void
  className?: string
}

export const ProjectFilter = ({ value, onChange, className }: ProjectFilterProps) => {
  const [projects, setProjects] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedProjects, setSelectedProjects] = useState<string[]>(value ?? [])
  const [isOpen, setIsOpen] = useState(false)

  // Sync with external value (e.g. initial state from page hydration)
  useEffect(() => {
    if (value !== undefined) {
      setSelectedProjects(value)
    }
  }, [value])

  const loadProjects = async () => {
    setLoading(true)
    try {
      setProjects(await fetchProjects())
    } catch (error) {
      console.error("Error fetching projects:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadProjects()
  }, [])

  const handleProjectToggle = (project: string) => {
    const newSelected = selectedProjects.includes(project)
      ? selectedProjects.filter((p) => p !== project)
      : [...selectedProjects, project]

    setSelectedProjects(newSelected)
    onChange?.(newSelected)

    // Save to localStorage
    if (newSelected.length > 0) {
      localStorage.setItem(PROJECT_FILTER_KEY, JSON.stringify(newSelected))
    } else {
      localStorage.removeItem(PROJECT_FILTER_KEY)
    }
  }

  const handleClear = () => {
    setSelectedProjects([])
    onChange?.([])
    localStorage.removeItem(PROJECT_FILTER_KEY)
  }

  const displayText =
    selectedProjects.length === 0
      ? "All projects"
      : selectedProjects.length === 1
        ? selectedProjects[0]
        : `${selectedProjects.length} projects`

  return (
    <div className={`flex items-center gap-0.5 ${className}`}>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className="w-48 bg-gray-800 border-gray-700 text-gray-200 hover:bg-gray-700 justify-start"
          >
            <div className="flex items-center gap-2">
              <FolderKanban className="h-4 w-4 text-gray-400" />
              <span className="truncate">{loading ? "Loading..." : displayText}</span>
            </div>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 bg-gray-800 border-gray-700 p-2" align="start">
          <div className="max-h-64 overflow-y-auto space-y-2">
            {projects.map((project) => {
              const isSelected = selectedProjects.includes(project)
              return (
                <label
                  key={project}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-sm hover:bg-gray-700 cursor-pointer text-gray-200"
                >
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => handleProjectToggle(project)}
                  />
                  <span className="text-sm">{project}</span>
                </label>
              )
            })}
          </div>
        </PopoverContent>
      </Popover>
      {selectedProjects.length > 0 && (
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
