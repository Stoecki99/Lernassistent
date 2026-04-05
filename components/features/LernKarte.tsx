"use client"

// components/features/LernKarte.tsx
// Einzelne Lernkarte mit Flip-Animation, optionalem Hinweis und Bewertungs-Buttons.
// Zeigt Vorderseite, optional Hinweis-Button, flippt bei Klick, zeigt Rueckseite + 4 Rating-Buttons.

import { useState, useRef } from "react"
import CardMarkdown from "@/components/ui/CardMarkdown"

interface CardData {
  id: string
  front: string
  back: string
  hint?: string | null
  state: number
}

interface PreviewData {
  rating: number
  label: string
  scheduledDays: number
  intervalText: string
}

interface LernKarteProps {
  card: CardData
  previews: PreviewData[]
  onRate: (rating: number, duration: number) => Promise<void>
  loading: boolean
}

/** Farben und Styles fuer die 4 Bewertungs-Buttons */
const RATING_STYLES: Record<number, { bg: string; hover: string; shadow: string }> = {
  1: {
    bg: "bg-red-500",
    hover: "hover:bg-red-600",
    shadow: "shadow-[0_4px_0_#991b1b]",
  },
  2: {
    bg: "bg-orange-500",
    hover: "hover:bg-orange-600",
    shadow: "shadow-[0_4px_0_#9a3412]",
  },
  3: {
    bg: "bg-primary",
    hover: "hover:bg-primary-dark",
    shadow: "shadow-button",
  },
  4: {
    bg: "bg-secondary",
    hover: "hover:bg-secondary-dark",
    shadow: "shadow-button-secondary",
  },
}

const STATE_LABELS: Record<number, string> = {
  0: "Neu",
  1: "Lernen",
  2: "Wiederholen",
  3: "Erneut lernen",
}

export default function LernKarte({
  card,
  previews,
  onRate,
  loading,
}: LernKarteProps) {
  const [isFlipped, setIsFlipped] = useState(false)
  const [isRating, setIsRating] = useState(false)
  const [showHint, setShowHint] = useState(false)
  const startTimeRef = useRef<number>(Date.now())

  const handleFlip = () => {
    if (!isFlipped) {
      setIsFlipped(true)
    }
  }

  const handleRate = async (rating: number) => {
    if (isRating) return
    setIsRating(true)

    const duration = Math.round((Date.now() - startTimeRef.current) / 1000)

    try {
      await onRate(rating, duration)
    } finally {
      setIsFlipped(false)
      setIsRating(false)
      setShowHint(false)
      startTimeRef.current = Date.now()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Hinweis per H-Taste anzeigen (nur auf Vorderseite)
    if (!isFlipped && card.hint && (e.key === "h" || e.key === "H")) {
      e.preventDefault()
      setShowHint(true)
      return
    }

    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      handleFlip()
    }

    // Tastaturkuerzel fuer Bewertung (1-4) wenn Karte umgedreht
    if (isFlipped && !isRating) {
      const num = parseInt(e.key)
      if (num >= 1 && num <= 4) {
        e.preventDefault()
        void handleRate(num)
      }
    }
  }

  return (
    <div className="flex flex-col items-center flex-1">
      {/* Flip-Karte */}
      <div
        className="relative w-full max-w-lg cursor-pointer perspective-1000 mb-6"
        onClick={handleFlip}
        role="button"
        tabIndex={0}
        onKeyDown={handleKeyDown}
        aria-label={
          isFlipped
            ? "Rueckseite wird angezeigt"
            : "Klicke zum Umdrehen"
        }
      >
        <div
          className={`relative w-full min-h-[280px] sm:min-h-[320px] transition-transform duration-500 transform-style-preserve-3d ${
            isFlipped ? "rotate-y-180" : ""
          }`}
        >
          {/* Vorderseite */}
          <div className="absolute inset-0 w-full bg-white rounded-2xl shadow-card p-6 sm:p-8 backface-hidden flex flex-col justify-center items-center">
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-gray-100 text-text-light mb-4">
              {STATE_LABELS[card.state] ?? "Unbekannt"}
            </span>
            <div className="text-xl sm:text-2xl font-bold text-text-dark text-center break-words leading-relaxed">
              <CardMarkdown content={card.front} />
            </div>

            {/* Hinweis-Button */}
            {card.hint && !showHint && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setShowHint(true)
                }}
                className="mt-4 px-4 py-2 text-sm font-bold text-accent bg-accent/10 rounded-xl hover:bg-accent/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
                aria-label="Hinweis anzeigen"
              >
                Hinweis anzeigen (H)
              </button>
            )}

            {/* Hinweis-Anzeige */}
            {card.hint && showHint && (
              <div className="mt-4 px-4 py-3 bg-accent/5 rounded-xl border border-accent/20 max-w-full">
                <p className="text-xs font-bold text-accent mb-1">Hinweis</p>
                <div className="text-sm text-text-dark">
                  <CardMarkdown content={card.hint} />
                </div>
              </div>
            )}

            <p className="text-sm text-text-light mt-4">
              Tippe zum Umdrehen
            </p>
          </div>

          {/* Rueckseite */}
          <div className="absolute inset-0 w-full bg-white rounded-2xl shadow-card p-6 sm:p-8 backface-hidden rotate-y-180 flex flex-col justify-center items-center">
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-primary/10 text-primary mb-4">
              Antwort
            </span>
            <div className="text-xl sm:text-2xl font-bold text-text-dark text-center break-words leading-relaxed">
              <CardMarkdown content={card.back} />
            </div>
          </div>
        </div>
      </div>

      {/* Bewertungs-Buttons (nur sichtbar wenn Karte umgedreht) */}
      <div
        className={`w-full max-w-lg transition-all duration-300 ${
          isFlipped
            ? "opacity-100 translate-y-0"
            : "opacity-0 translate-y-4 pointer-events-none"
        }`}
      >
        <p className="text-center text-sm text-text-light mb-3">
          Wie gut wusstest du die Antwort?
        </p>
        <div className="grid grid-cols-4 gap-2 sm:gap-3">
          {previews.map((preview) => {
            const style = RATING_STYLES[preview.rating]
            if (!style) return null

            return (
              <button
                key={preview.rating}
                onClick={() => void handleRate(preview.rating)}
                disabled={isRating || loading}
                aria-label={`Bewertung: ${preview.label} — naechste Wiederholung in ${preview.intervalText}`}
                className={`flex flex-col items-center justify-center py-3 sm:py-4 px-1 rounded-xl text-white font-bold ${style.bg} ${style.hover} ${style.shadow} btn-press disabled:opacity-50 disabled:cursor-not-allowed transition-colors min-h-[72px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2`}
              >
                <span className="text-xs sm:text-sm font-extrabold">
                  {preview.label}
                </span>
                <span className="text-[10px] sm:text-xs font-normal opacity-80 mt-1">
                  {preview.intervalText}
                </span>
              </button>
            )
          })}
        </div>
        <p className="text-center text-xs text-text-light mt-3">
          Tastatur: 1-4 zum Bewerten, H fuer Hinweis
        </p>
      </div>
    </div>
  )
}
