// components/features/StatistikWidget.tsx
// Wiederverwendbares Dashboard-Widget fuer verschiedene Statistiken.

interface StatistikWidgetProps {
  icon: string
  title: string
  value: string | number
  subtitle?: string
  trend?: "up" | "down" | "neutral"
  color?: "primary" | "secondary" | "accent" | "default"
}

const colorConfig: Record<string, { bg: string; iconBg: string; text: string }> = {
  primary: {
    bg: "bg-primary/5",
    iconBg: "bg-primary/10",
    text: "text-primary-dark",
  },
  secondary: {
    bg: "bg-secondary/5",
    iconBg: "bg-secondary/10",
    text: "text-secondary-dark",
  },
  accent: {
    bg: "bg-accent/5",
    iconBg: "bg-accent/10",
    text: "text-accent-dark",
  },
  default: {
    bg: "bg-surface-card",
    iconBg: "bg-gray-100",
    text: "text-text-dark",
  },
}

const trendIcons: Record<string, { symbol: string; color: string }> = {
  up: { symbol: "\u2191", color: "text-primary" },
  down: { symbol: "\u2193", color: "text-red-500" },
  neutral: { symbol: "\u2192", color: "text-text-light" },
}

export default function StatistikWidget({
  icon,
  title,
  value,
  subtitle,
  trend,
  color = "default",
}: StatistikWidgetProps) {
  const colors = colorConfig[color]

  return (
    <div className={`${colors.bg} rounded-2xl shadow-card p-4 flex items-start gap-3`}>
      <div
        className={`${colors.iconBg} w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0`}
        aria-hidden="true"
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-text-light font-semibold truncate">{title}</p>
        <div className="flex items-baseline gap-2">
          <p className={`text-xl font-extrabold ${colors.text}`}>{value}</p>
          {trend && (
            <span className={`text-sm font-bold ${trendIcons[trend].color}`}>
              {trendIcons[trend].symbol}
            </span>
          )}
        </div>
        {subtitle && (
          <p className="text-xs text-text-light mt-0.5">{subtitle}</p>
        )}
      </div>
    </div>
  )
}
