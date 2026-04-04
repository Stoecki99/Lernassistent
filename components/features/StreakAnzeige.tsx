"use client"

// components/features/StreakAnzeige.tsx
// Erweiterte Streak-Anzeige mit Flammen-Animation und Motivationstext.

interface StreakAnzeigeProps {
  currentStreak: number
  longestStreak: number
}

const motivationTexts: Record<string, string> = {
  none: "Starte heute deinen Streak!",
  low: "Guter Anfang! Bleib dran!",
  medium: "Laeuft super! Weiter so!",
  high: "Unglaublich! Du bist on fire!",
  legendary: "Legendaer! Nicht aufzuhalten!",
}

function getMotivationLevel(streak: number): string {
  if (streak === 0) return "none"
  if (streak < 3) return "low"
  if (streak < 7) return "medium"
  if (streak < 30) return "high"
  return "legendary"
}

export default function StreakAnzeige({ currentStreak, longestStreak }: StreakAnzeigeProps) {
  const level = getMotivationLevel(currentStreak)
  const isActive = currentStreak > 0

  return (
    <div className="bg-surface-card rounded-2xl shadow-card p-5 text-center">
      {/* Flammen-Icon mit Animation */}
      <div className="relative inline-block mb-2">
        <span
          className={`text-5xl inline-block ${isActive ? "animate-streak-flame" : "opacity-30 grayscale"}`}
          aria-hidden="true"
        >
          {"\uD83D\uDD25"}
        </span>
      </div>

      {/* Streak-Zaehler */}
      <p className={`text-4xl font-extrabold ${isActive ? "text-accent" : "text-text-light"}`}>
        {currentStreak}
      </p>
      <p className="text-sm font-semibold text-text-light mt-1">
        {currentStreak === 1 ? "Tag Streak" : "Tage Streak"}
      </p>

      {/* Laengster Streak */}
      <div className="mt-3 pt-3 border-t border-gray-100">
        <p className="text-xs text-text-light">
          Laengster Streak: <span className="font-bold text-text">{longestStreak} Tage</span>
        </p>
      </div>

      {/* Motivationstext */}
      <p className="text-sm font-semibold text-accent-dark mt-2">
        {motivationTexts[level]}
      </p>

      {/* CSS Flame Animation — injected via style tag */}
      <style>{`
        @keyframes streakFlame {
          0%, 100% { transform: scale(1) rotate(0deg); }
          25% { transform: scale(1.1) rotate(-3deg); }
          50% { transform: scale(1.05) rotate(2deg); }
          75% { transform: scale(1.12) rotate(-2deg); }
        }
        .animate-streak-flame {
          animation: streakFlame 1.5s ease-in-out infinite;
        }
      `}</style>
    </div>
  )
}
