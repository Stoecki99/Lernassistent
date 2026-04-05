"use client"

// components/features/KarteAnzeige.tsx
// Einzelne Karteikarte mit Vorderseite/Rueckseite, optionalem Hinweis und Flip-Animation.

import { useState } from "react"
import CardMarkdown from "@/components/ui/CardMarkdown"

interface KarteAnzeigeProps {
  front: string
  back: string
  hint?: string | null
  state?: number
}

const STATE_LABELS: Record<number, { label: string; color: string }> = {
  0: { label: "Neu", color: "bg-secondary/10 text-secondary" },
  1: { label: "Lernen", color: "bg-accent/10 text-accent" },
  2: { label: "Wiederholen", color: "bg-primary/10 text-primary" },
  3: { label: "Erneut lernen", color: "bg-red-100 text-red-600" },
}

export default function KarteAnzeige({ front, back, hint, state }: KarteAnzeigeProps) {
  const [isFlipped, setIsFlipped] = useState(false)
  const [showHint, setShowHint] = useState(false)
  const stateInfo = state !== undefined ? STATE_LABELS[state] : null

  return (
    <div
      className="relative w-full cursor-pointer perspective-1000"
      onClick={() => setIsFlipped((prev) => !prev)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          setIsFlipped((prev) => !prev)
        }
        if (!isFlipped && hint && (e.key === "h" || e.key === "H")) {
          e.preventDefault()
          setShowHint(true)
        }
      }}
      aria-label={isFlipped ? "Rueckseite anzeigen" : "Vorderseite anzeigen"}
    >
      <div
        className={`relative w-full min-h-[120px] transition-transform duration-500 transform-style-preserve-3d ${
          isFlipped ? "rotate-y-180" : ""
        }`}
      >
        {/* Vorderseite */}
        <div className="absolute inset-0 w-full bg-white rounded-xl shadow-sm p-5 backface-hidden flex flex-col justify-center">
          {stateInfo && (
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full self-start mb-3 ${stateInfo.color}`}>
              {stateInfo.label}
            </span>
          )}
          <div className="font-semibold text-text-dark text-center break-words">
            <CardMarkdown content={front} />
          </div>

          {hint && !showHint && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                setShowHint(true)
              }}
              className="mt-3 px-3 py-1.5 text-xs font-bold text-accent bg-accent/10 rounded-lg hover:bg-accent/20 transition-colors self-center"
            >
              Hinweis
            </button>
          )}

          {hint && showHint && (
            <div className="mt-3 px-3 py-2 bg-accent/5 rounded-lg border border-accent/20">
              <p className="text-xs font-bold text-accent mb-1">Hinweis</p>
              <div className="text-xs text-text-dark">
                <CardMarkdown content={hint} />
              </div>
            </div>
          )}

          <p className="text-xs text-text-light text-center mt-3">
            Klicke zum Umdrehen
          </p>
        </div>

        {/* Rueckseite */}
        <div className="absolute inset-0 w-full bg-white rounded-xl shadow-sm p-5 backface-hidden rotate-y-180 flex flex-col justify-center">
          <p className="text-xs font-bold text-primary mb-3 text-center">Antwort</p>
          <div className="font-semibold text-text-dark text-center break-words">
            <CardMarkdown content={back} />
          </div>
          <p className="text-xs text-text-light text-center mt-3">
            Klicke zum Zurueckdrehen
          </p>
        </div>
      </div>
    </div>
  )
}
