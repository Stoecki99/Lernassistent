// components/ui/ProgressBar.tsx
// Wiederverwendbarer Fortschrittsbalken mit optionalem Label.

interface ProgressBarProps {
  value: number
  max: number
  label?: string
  color?: "primary" | "secondary" | "accent"
  size?: "sm" | "md" | "lg"
  showPercentage?: boolean
}

const colorClasses: Record<string, string> = {
  primary: "bg-primary",
  secondary: "bg-secondary",
  accent: "bg-accent",
}

const sizeClasses: Record<string, string> = {
  sm: "h-2",
  md: "h-3",
  lg: "h-4",
}

export default function ProgressBar({
  value,
  max,
  label,
  color = "primary",
  size = "md",
  showPercentage = false,
}: ProgressBarProps) {
  const percentage = max > 0 ? Math.min(Math.round((value / max) * 100), 100) : 0

  return (
    <div className="w-full">
      {(label || showPercentage) && (
        <div className="flex justify-between items-center mb-1">
          {label && (
            <span className="text-sm font-semibold text-text-light">{label}</span>
          )}
          {showPercentage && (
            <span className="text-sm font-bold text-text">{percentage}%</span>
          )}
        </div>
      )}
      <div className={`w-full bg-gray-200 rounded-full overflow-hidden ${sizeClasses[size]}`}>
        <div
          className={`${colorClasses[color]} ${sizeClasses[size]} rounded-full transition-all duration-500 ease-out`}
          style={{ width: `${percentage}%` }}
          role="progressbar"
          aria-valuenow={value}
          aria-valuemin={0}
          aria-valuemax={max}
        />
      </div>
    </div>
  )
}
