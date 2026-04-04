// components/features/BadgeCard.tsx
// Badge-Karte: Zeigt verdiente Badges farbig und nicht verdiente ausgegraut an.

interface BadgeCardProps {
  icon: string
  name: string
  description: string
  earned: boolean
  awardedAt?: string | null
  points: number
}

export default function BadgeCard({
  icon,
  name,
  description,
  earned,
  awardedAt,
  points,
}: BadgeCardProps) {
  return (
    <div
      className={`rounded-2xl p-4 text-center transition-all ${
        earned
          ? "bg-surface-card shadow-card border-2 border-accent/30"
          : "bg-gray-50 opacity-60 grayscale"
      }`}
    >
      {/* Badge-Icon */}
      <span className="text-4xl inline-block mb-2" aria-hidden="true">
        {icon}
      </span>

      {/* Name */}
      <p className={`font-bold text-sm ${earned ? "text-text-dark" : "text-text-light"}`}>
        {name}
      </p>

      {/* Beschreibung */}
      <p className="text-xs text-text-light mt-1">{description}</p>

      {/* Status */}
      {earned && awardedAt ? (
        <p className="text-xs text-accent font-semibold mt-2">
          +{points} Pkt. &middot;{" "}
          {new Date(awardedAt).toLocaleDateString("de-DE", {
            day: "numeric",
            month: "short",
          })}
        </p>
      ) : (
        <p className="text-xs text-text-light mt-2 italic">
          Noch nicht freigeschaltet
        </p>
      )}
    </div>
  )
}
