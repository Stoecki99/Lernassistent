"use client"

// components/features/LernSession.tsx
// Orchestriert die Lern-Sitzung: Laedt Karten, zeigt LernKarte, verarbeitet Bewertungen.

import { useState, useEffect, useCallback } from "react"
import LernKarte from "@/components/features/LernKarte"
import Link from "next/link"

interface DeckInfo {
  id: string
  name: string
  color: string
  icon: string
  cardCount: number
}

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

interface ProgressData {
  total: number
  due: number
  done: number
}

interface LernSessionProps {
  deck: DeckInfo
}

export default function LernSession({ deck }: LernSessionProps) {
  const [card, setCard] = useState<CardData | null>(null)
  const [previews, setPreviews] = useState<PreviewData[]>([])
  const [progress, setProgress] = useState<ProgressData>({
    total: deck.cardCount,
    due: 0,
    done: 0,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [finished, setFinished] = useState(false)
  const [reviewCount, setReviewCount] = useState(0)

  const fetchNextCard = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/lernen/naechste?deckId=${deck.id}`)
      if (!res.ok) {
        const data: { error?: string } = await res.json()
        throw new Error(data.error ?? "Fehler beim Laden")
      }

      const data: {
        card: CardData | null
        previews?: PreviewData[]
        progress: ProgressData
      } = await res.json()

      setProgress(data.progress)

      if (!data.card) {
        setFinished(true)
        setCard(null)
      } else {
        setCard(data.card)
        setPreviews(data.previews ?? [])
        setFinished(false)
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unbekannter Fehler"
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [deck.id])

  useEffect(() => {
    void fetchNextCard()
  }, [fetchNextCard])

  const handleRate = async (rating: number, duration: number) => {
    if (!card) return

    try {
      const res = await fetch("/api/lernen/bewerten", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cardId: card.id,
          rating,
          duration,
        }),
      })

      if (!res.ok) {
        const data: { error?: string } = await res.json()
        throw new Error(data.error ?? "Fehler beim Bewerten")
      }

      setReviewCount((prev) => prev + 1)
      await fetchNextCard()
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Bewertung fehlgeschlagen"
      setError(message)
    }
  }

  // Loading-Zustand
  if (loading && !card) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="mt-4 text-text-light">Karten werden geladen...</p>
      </div>
    )
  }

  // Fehler-Zustand
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <p className="text-red-500 font-semibold mb-4">{error}</p>
        <button
          onClick={() => void fetchNextCard()}
          className="px-6 py-3 bg-primary text-white font-bold rounded-xl shadow-button hover:bg-primary-dark btn-press"
        >
          Erneut versuchen
        </button>
      </div>
    )
  }

  // Fertig-Zustand
  if (finished) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <div className="text-6xl mb-6">🎉</div>
        <h2 className="text-2xl font-extrabold text-text-dark mb-2">
          Super gemacht!
        </h2>
        <p className="text-text-light mb-2">
          Du hast alle Karten für heute gelernt.
        </p>
        {reviewCount > 0 && (
          <p className="text-primary font-bold mb-6">
            +{reviewCount * 10} Punkte gesammelt!
          </p>
        )}
        <div className="flex flex-col gap-3 w-full max-w-xs">
          <Link
            href={`/decks/${deck.id}`}
            className="block text-center px-6 py-3 bg-primary text-white font-bold rounded-xl shadow-button hover:bg-primary-dark btn-press"
          >
            Zurück zum Deck
          </Link>
          <Link
            href="/decks"
            className="block text-center px-6 py-3 bg-white text-text-dark font-bold rounded-xl shadow-card hover:shadow-card-hover"
          >
            Alle Decks anzeigen
          </Link>
        </div>
      </div>
    )
  }

  // Lernmodus
  return (
    <div className="flex flex-col min-h-[60vh]">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <Link
          href={`/decks/${deck.id}`}
          className="text-text-light hover:text-text-dark transition-colors"
          aria-label="Zurück zum Deck"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </Link>
        <h1 className="text-lg font-bold text-text-dark truncate mx-4">
          {deck.icon} {deck.name}
        </h1>
        <span className="text-sm text-text-light whitespace-nowrap">
          {progress.done + reviewCount}/{progress.due + progress.done} heute
        </span>
      </div>

      {/* Fortschrittsbalken */}
      <div className="w-full bg-gray-200 rounded-full h-2.5 mb-6">
        <div
          className="h-2.5 rounded-full transition-all duration-500"
          style={{
            width:
              progress.due + progress.done > 0
                ? `${
                    ((progress.done + reviewCount) /
                      (progress.due + progress.done)) *
                    100
                  }%`
                : "0%",
            backgroundColor: deck.color,
          }}
        />
      </div>

      {/* Karte */}
      {card && (
        <LernKarte
          key={card.id}
          card={card}
          previews={previews}
          onRate={handleRate}
          loading={loading}
        />
      )}
    </div>
  )
}
