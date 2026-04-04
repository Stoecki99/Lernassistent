// components/ui/Skeleton.tsx
// Wiederverwendbare Skeleton-Loader Komponente fuer Loading States.

interface SkeletonProps {
  variant?: "text" | "card" | "circle" | "rect"
  width?: string
  height?: string
  className?: string
  lines?: number
}

const variantStyles: Record<string, string> = {
  text: "h-4 rounded-md",
  card: "h-40 rounded-2xl",
  circle: "rounded-full",
  rect: "rounded-xl",
}

export default function Skeleton({
  variant = "rect",
  width,
  height,
  className = "",
  lines = 1,
}: SkeletonProps) {
  const baseStyle = variantStyles[variant]

  if (variant === "circle") {
    const size = width ?? "3rem"
    return (
      <div
        className={`skeleton-shimmer bg-gray-200 ${baseStyle} ${className}`}
        style={{ width: size, height: size }}
        aria-hidden="true"
      />
    )
  }

  if (variant === "text" && lines > 1) {
    return (
      <div className={`space-y-2 ${className}`} aria-hidden="true">
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className={`skeleton-shimmer bg-gray-200 ${baseStyle}`}
            style={{
              width: i === lines - 1 ? "75%" : width ?? "100%",
              height: height,
            }}
          />
        ))}
      </div>
    )
  }

  return (
    <div
      className={`skeleton-shimmer bg-gray-200 ${baseStyle} ${className}`}
      style={{ width: width ?? "100%", height: height }}
      aria-hidden="true"
    />
  )
}
