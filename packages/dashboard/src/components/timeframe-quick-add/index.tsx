import { Button } from "@/components/ui/button"

interface TimeframeQuickAddProps {
  onAddTime: (minutes: number) => void
}

const timeOptions = [
  { label: "+15m", minutes: 15 },
  { label: "+30m", minutes: 30 },
  { label: "+1h", minutes: 60 },
  { label: "+2h", minutes: 120 },
  { label: "+4h", minutes: 240 },
]

export function TimeframeQuickAdd({ onAddTime }: TimeframeQuickAddProps) {
  return (
    <div className="flex items-center gap-2 mt-2">
      {timeOptions.map((option) => (
        <Button
          key={option.label}
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onAddTime(option.minutes)}
          className="text-xs hover:bg-gray-800"
        >
          {option.label}
        </Button>
      ))}
    </div>
  )
}
