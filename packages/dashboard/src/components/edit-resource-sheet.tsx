import { zodResolver } from "@hookform/resolvers/zod"
import { format } from "date-fns"
import { CalendarIcon, Loader2, Plus } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"

import { TimePickerInput } from "@/components/time-picker-input"
import { TimePeriodSelect } from "@/components/time-picker-input/period-select"
import { Period } from "@/components/time-picker-input/utils"
import { TimeframeQuickAdd } from "@/components/timeframe-quick-add"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import { errorText, fetchProjects, saveEvent } from "@/lib/api"
import { cn } from "@/lib/utils"
import { formatMinutesToTimeframeString, parseTimeframe } from "@starktech/core/browser"

import { WorkEvent } from "@/types"

const formSchema = z.object({
  timestamp: z.date(),
  project: z.string().min(1, "Project is required"),
  description: z.string(),
  timeframe: z.string().nonempty("Timeframe is required"),
})

interface EditResourceSheetProps {
  isOpen: boolean
  onClose: () => void
  onDataChange: () => void
  event: WorkEvent | null
  sheetTitle?: string
}

export function EditResourceSheet({
  isOpen,
  onClose,
  onDataChange,
  event,
  sheetTitle = "Edit Event",
}: EditResourceSheetProps) {
  const [projects, setProjects] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [period, setPeriod] = useState<Period>("PM")
  const [isAddingNewProject, setIsAddingNewProject] = useState(false)
  const [newProjectName, setNewProjectName] = useState("")

  // Helper function to determine period from date
  const getPeriodFromDate = (date: Date): Period => {
    return date.getHours() >= 12 ? "PM" : "AM"
  }
  const minuteRef = useRef<HTMLInputElement>(null)
  const hourRef = useRef<HTMLInputElement>(null)
  const secondRef = useRef<HTMLInputElement>(null)
  const periodRef = useRef<HTMLButtonElement>(null)

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      timestamp: new Date(),
      project: "",
      description: "",
      timeframe: "",
    },
  })

  const resetForm = useCallback(() => {
    form.reset({
      timestamp: new Date(),
      project: "",
      description: "",
      timeframe: "",
    })
    setPeriod(getPeriodFromDate(new Date()))
    setIsAddingNewProject(false)
    setNewProjectName("")
  }, [form])

  // Watch for timestamp changes and update period accordingly
  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      if (name === "timestamp" && value.timestamp) {
        setPeriod(getPeriodFromDate(value.timestamp))
      }
    })
    return () => subscription.unsubscribe()
  }, [form])

  useEffect(() => {
    async function loadProjects() {
      try {
        setProjects(await fetchProjects())
      } catch (error) {
        console.error("Error fetching projects:", error)
      }
    }
    loadProjects()
  }, [])

  useEffect(() => {
    if (event) {
      const timeframeValue = event.timeframe || ""
      const eventDate = new Date(event.timestamp || "")
      form.reset({
        timestamp: eventDate,
        project: event.project,
        description: event.description || "",
        timeframe: timeframeValue,
      })
      // Set the period based on the event's timestamp
      setPeriod(getPeriodFromDate(eventDate))
    } else {
      // Reset the form to default values when there is no event
      resetForm()
    }
  }, [event, form, resetForm, isOpen])

  const handleAddTime = (minutes: number) => {
    try {
      const currentVal = form.getValues("timeframe")
      const currentMinutes = currentVal ? parseTimeframe(currentVal).durationInMinutes : 0
      const newMinutes = currentMinutes + minutes
      form.setValue("timeframe", formatMinutesToTimeframeString(newMinutes))
    } catch {
      // If the current value is invalid, just set the new value
      form.setValue("timeframe", formatMinutesToTimeframeString(minutes))
    }
  }

  const handleAddNewProject = () => {
    if (newProjectName.trim()) {
      const trimmedName = newProjectName.trim()
      // Add the new project to the list if it doesn't already exist
      setProjects((prev) => {
        if (!prev.includes(trimmedName)) {
          return [...prev, trimmedName].sort()
        }
        return prev
      })
      // Set the form value to the new project
      form.setValue("project", trimmedName)
      // Reset the new project state
      setNewProjectName("")
      setIsAddingNewProject(false)
    }
  }

  const handleCancelNewProject = () => {
    setNewProjectName("")
    setIsAddingNewProject(false)
  }

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true)

    let error: unknown
    try {
      await saveEvent(event?.id, values)
    } catch (e) {
      error = e
    }

    if (!error) {
      toast.success(event ? "Event updated" : "Event created", {
        description: `The event has been ${event ? "updated" : "created"} successfully.`,
      })
      onDataChange?.()
      resetForm()
      onClose()
    } else {
      toast.error(`Error ${event ? "updating" : "creating"} event`, {
        description: errorText(error),
      })
    }
    setIsLoading(false)
  }

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="w-full max-w-lg p-6 bg-gray-900 text-white border-l border-gray-700 overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{sheetTitle}</SheetTitle>
          <SheetDescription className="sr-only">
            {event ? "Update the details of the event." : "Add a new event."}
          </SheetDescription>
        </SheetHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8 mt-8">
            <FormField
              control={form.control}
              name="timestamp"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Timestamp</FormLabel>
                  <div className="flex flex-col gap-2">
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant={"outline"}
                            className={cn(
                              "flex-1 justify-start text-left font-normal",
                              !field.value && "text-muted-foreground",
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 bg-gray-900" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={(date) => {
                            if (!date) return
                            const newDate = new Date(date || "")
                            newDate.setHours(field.value.getHours())
                            newDate.setMinutes(field.value.getMinutes())
                            newDate.setSeconds(field.value.getSeconds())
                            field.onChange(newDate)
                            if (date) {
                              setPeriod(getPeriodFromDate(newDate))
                            }
                          }}
                          captionLayout="dropdown"
                        />
                      </PopoverContent>
                    </Popover>
                    <FormControl>
                      <div className="flex items-end gap-2">
                        <div className="grid gap-1 text-center">
                          <Label htmlFor="hours" className="text-xs">
                            Hours
                          </Label>
                          <TimePickerInput
                            picker="12hours"
                            date={field.value}
                            setDate={field.onChange}
                            ref={hourRef}
                            period={period}
                            onRightFocus={() => minuteRef.current?.focus()}
                          />
                        </div>
                        <div className="grid gap-1 text-center">
                          <Label htmlFor="minutes" className="text-xs">
                            Minutes
                          </Label>
                          <TimePickerInput
                            picker="minutes"
                            date={field.value}
                            setDate={field.onChange}
                            ref={minuteRef}
                            onLeftFocus={() => hourRef.current?.focus()}
                            onRightFocus={() => secondRef.current?.focus()}
                          />
                        </div>
                        <div className="grid gap-1 text-center">
                          <Label htmlFor="seconds" className="text-xs">
                            Seconds
                          </Label>
                          <TimePickerInput
                            picker="seconds"
                            date={field.value}
                            setDate={field.onChange}
                            ref={secondRef}
                            onLeftFocus={() => minuteRef.current?.focus()}
                            onRightFocus={() => periodRef.current?.focus()}
                          />
                        </div>
                        <div className="grid gap-1 text-center">
                          <Label htmlFor="period" className="text-xs">
                            Period
                          </Label>
                          <TimePeriodSelect
                            period={period}
                            setPeriod={setPeriod}
                            date={field.value}
                            setDate={field.onChange}
                            ref={periodRef}
                            onLeftFocus={() => secondRef.current?.focus()}
                          />
                        </div>
                      </div>
                    </FormControl>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="project"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Project</FormLabel>
                  <FormControl>
                    <div className="flex gap-2">
                      {isAddingNewProject ? (
                        <div className="flex gap-2 flex-1">
                          <Input
                            placeholder="Enter project name"
                            value={newProjectName}
                            onChange={(e) => setNewProjectName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault()
                                handleAddNewProject()
                              } else if (e.key === "Escape") {
                                handleCancelNewProject()
                              }
                            }}
                            autoFocus
                            className="flex-1"
                          />
                          <Button
                            type="button"
                            size="sm"
                            onClick={handleAddNewProject}
                            disabled={!newProjectName.trim()}
                          >
                            Add
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={handleCancelNewProject}
                          >
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <>
                          <Select
                            {...field}
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                          >
                            <SelectTrigger className="flex-1">
                              <SelectValue placeholder="Select a project" />
                            </SelectTrigger>
                            <SelectContent className="bg-gray-900">
                              {projects.map((project) => (
                                <SelectItem
                                  key={project}
                                  value={project}
                                  className="text-foreground"
                                >
                                  {project}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button
                            type="button"
                            size="sm"
                            variant="default"
                            onClick={() => setIsAddingNewProject(true)}
                            className="px-3"
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Enter a description" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="timeframe"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Timeframe</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., 1h or 30m" {...field} />
                  </FormControl>
                  <TimeframeQuickAdd onAddTime={handleAddTime} />
                  <FormDescription>Enter a timeframe (e.g., 1h or 30m)</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" disabled={isLoading} className="w-full">
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Submit
            </Button>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  )
}
