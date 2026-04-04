// components/ui/StreakBadge.tsx
// Streak-Anzeige mit Flammen-Icon und Tage-Zaehler.

interface StreakBadgeProps {
  days: number
  size?: "sm" | "md" | "lg"
}

const sizeConfig: Record<string, { icon: string; text: string; container: string }> = {
  sm: { icon: "text-lg", text: "text-sm", container: "px-2 py-1 gap-1" },
  md: { icon: "text-2xl", text: "text-base", container: "px-3 py-1.5 gap-1.5" },
  lg: { icon: "text-3xl", text: "text-lg", container: "px-4 py-2 gap-2" },
}

export default function StreakBadge({ days, size = "md" }: StreakBadgeProps) {
  const config = sizeConfig[size]
  const isActive = days > 0

  return (
    <div
      className={`inline-flex items-center rounded-full font-bold ${config.container} ${
        isActive
          ? "bg-accent/10 text-accent"
          : "bg-gray-100 text-text-light"
      }`}
    >
      <span className={config.icon} aria-hidden="true">
        {isActive ? "\uD83D\uDD25" : "\u2744\uFE0F"}
      </span>
      <span className={config.text}>
        {days} {days === 1 ? "Tag" : "Tage"}
      </span>
    </div>
  )
}
