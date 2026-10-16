/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { getProjectColors } from "@/lib/utils/chart-colors"
import { WorkEvent } from "@/types"
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

export interface HoursPerDayChartProps {
  data: WorkEvent[]
  className?: string
}

export const HoursPerDayChart = ({ data, className }: HoursPerDayChartProps) => {
  // Calculate hours per day per project
  const dailyHours = data.reduce(
    (acc, event) => {
      const date = new Date(event.timestamp || "").toDateString()
      const project = event.project
      const hours = (event.minutes || 0) / 60

      if (!acc[date]) {
        acc[date] = {}
      }
      if (!acc[date][project]) {
        acc[date][project] = 0
      }
      acc[date][project] += hours
      return acc
    },
    {} as Record<string, Record<string, number>>,
  )

  // Get all unique projects and dates
  const projects = new Set<string>()
  const dates = Object.keys(dailyHours).sort((a, b) => {
    return new Date(a).getTime() - new Date(b).getTime()
  })

  dates.forEach((date) => {
    Object.keys(dailyHours[date]).forEach((project) => {
      projects.add(project)
    })
  })

  const projectList = Array.from(projects)

  // Get consistent colors for all projects
  const projectColors = getProjectColors(projectList)

  if (dates.length === 0) {
    return (
      <Card className={cn("bg-gray-900/50 border-gray-700 p-6", className)}>
        <div className="text-center text-gray-500">
          <div className="text-lg font-medium mb-2">Hours per Day</div>
          <div className="text-sm">No data available</div>
        </div>
      </Card>
    )
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    })
  }

  // Transform data for Recharts - dates are already sorted oldest to newest
  const chartData = dates.map((date) => {
    const dataPoint: any = {
      date: formatDate(date),
      fullDate: date,
    }

    projectList.forEach((project) => {
      dataPoint[project] = dailyHours[date][project] || 0
    })

    return dataPoint
  })

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-gray-800 border border-gray-700 p-3 rounded-lg shadow-lg">
          <p className="text-gray-200 font-medium mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {entry.value.toFixed(2)}h
            </p>
          ))}
        </div>
      )
    }
    return null
  }

  const CustomLegend = ({ payload }: any) => (
    <div className="flex flex-wrap gap-4 mt-4">
      {payload?.map((entry: any) => (
        <div key={entry.value} className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-sm text-gray-300">{entry.value}</span>
        </div>
      ))}
    </div>
  )

  return (
    <Card className={cn("bg-gray-900/50 border-gray-700 p-6", className)}>
      <div className="text-lg font-medium text-gray-200 mb-4">Hours per Day</div>

      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="date" stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
          <YAxis
            stroke="#9ca3af"
            fontSize={12}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => `${value.toFixed(1)}h`}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend content={<CustomLegend />} />
          {projectList.map((project) => (
            <Line
              key={project}
              type="monotone"
              dataKey={project}
              stroke={projectColors[project]}
              strokeWidth={2}
              dot={{ fill: projectColors[project], strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6, stroke: projectColors[project], strokeWidth: 2 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </Card>
  )
}
