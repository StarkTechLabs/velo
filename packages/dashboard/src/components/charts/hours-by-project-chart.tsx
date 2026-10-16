/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { getProjectColors } from "@/lib/utils/chart-colors"
import { WorkEvent } from "@/types"
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts"

export interface HoursByProjectChartProps {
  data: WorkEvent[]
  className?: string
}

export const HoursByProjectChart = ({ data, className }: HoursByProjectChartProps) => {
  // Calculate hours by project
  const projectHours = data.reduce(
    (acc, event) => {
      const project = event.project
      const hours = (event.minutes || 0) / 60
      acc[project] = (acc[project] || 0) + hours
      return acc
    },
    {} as Record<string, number>,
  )

  const totalHours = Object.values(projectHours).reduce((sum, hours) => sum + hours, 0)

  // Get consistent colors for all projects
  const projectNames = Object.keys(projectHours)
  const projectColors = getProjectColors(projectNames)

  const chartData = Object.entries(projectHours)
    .map(([project, hours]) => ({
      name: project,
      value: hours,
      percentage: totalHours > 0 ? (hours / totalHours) * 100 : 0,
      color: projectColors[project],
    }))
    .sort((a, b) => b.value - a.value)

  if (chartData.length === 0) {
    return (
      <Card className={cn("bg-gray-900/50 border-gray-700 p-6", className)}>
        <div className="text-center text-gray-500">
          <div className="text-lg font-medium mb-2">Hours by Project</div>
          <div className="text-sm">No data available</div>
        </div>
      </Card>
    )
  }

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      return (
        <div className="bg-gray-800 border border-gray-700 p-3 rounded-lg shadow-lg">
          <p className="text-gray-200 font-medium">{data.name}</p>
          <p className="text-primary">{data.value.toFixed(2)}h</p>
          <p className="text-gray-400 text-sm">{data.percentage.toFixed(1)}%</p>
        </div>
      )
    }
    return null
  }

  // const CustomLegend = ({ payload }: any) => (
  //   <div className="flex flex-wrap gap-4 mt-4">
  //     {payload?.map((entry: any) => (
  //       <div key={entry.value} className="flex items-center gap-2">
  //         <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }} />
  //         <span className="text-sm text-gray-300">{entry.value}</span>
  //       </div>
  //     ))}
  //   </div>
  // )

  return (
    <Card className={cn("bg-gray-900/50 border-gray-700 p-6", className)}>
      <div className="text-lg font-medium text-gray-200">Hours by Project</div>
      <div className="flex flex-row items-center justify-center h-full">
        <ResponsiveContainer width="100%" height={180}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={80}
              paddingAngle={4}
              dataKey="value"
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            {/* <Legend content={<CustomLegend />} /> */}
          </PieChart>
        </ResponsiveContainer>

        <div className="space-y-2 w-full p-2">
          {chartData.map((item) => (
            <div key={item.name} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="text-sm text-gray-300 truncate">{item.name}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-200">{item.value.toFixed(1)}h</span>
                <span className="text-gray-500">({item.percentage.toFixed(1)}%)</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  )
}
