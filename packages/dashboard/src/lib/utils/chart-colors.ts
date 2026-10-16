// Color palette for charts
const CHART_COLORS = [
  "#004D61", // primary green
  "#3b82f6", // blue
  "#f59e0b", // amber
  "#8b5cf6", // purple
  "#06b6d4", // cyan
  "#f97316", // orange
  "#ec4899", // pink
  "#10b981", // emerald
  "#6366f1", // indigo
  "#f43f5e", // rose
  "#64748b", // slate
  "#059669", // green
  "#dc2626", // red
]

// Better hash function to reduce collisions
function hashString(str: string): number {
  let hash = 0
  if (str.length === 0) return hash

  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & 0xffffffff // Convert to 32-bit integer
  }

  // Additional mixing to reduce collisions
  hash = hash ^ (hash >>> 16)
  hash = hash * 0x85ebca6b
  hash = hash ^ (hash >>> 13)
  hash = hash * 0xc2b2ae35
  hash = hash ^ (hash >>> 16)

  return Math.abs(hash)
}

// Get consistent color for a project
export function getProjectColor(projectName: string): string {
  const hash = hashString(projectName)
  const colorIndex = hash % CHART_COLORS.length
  return CHART_COLORS[colorIndex]
}

// Get colors for multiple projects in consistent order
export function getProjectColors(projectNames: string[]): Record<string, string> {
  const colorMap: Record<string, string> = {}
  const usedColors = new Set<string>()

  projectNames.forEach((projectName) => {
    let color = getProjectColor(projectName)

    // If color is already used, find next available color
    if (usedColors.has(color)) {
      const availableColors = CHART_COLORS.filter((c) => !usedColors.has(c))
      if (availableColors.length > 0) {
        color = availableColors[0]
      }
    }

    usedColors.add(color)
    colorMap[projectName] = color
  })

  return colorMap
}
