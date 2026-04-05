"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"

interface DeckWithStats {
  id: string
  name: string
  description: string | null
  color: string
  icon: string
  _count: { cards: number }
  dueCount: number
  newCount: number
}

export default function LernenPage() {
  const [decks, setDecks] = useState<DeckWithStats[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    async function fetchDecks() {
      try {
        const response = await fetch("/api/decks")
        if (!response.ok) throw new Error("Fehler beim Laden")
        const data = await response.json()

        const decksWithStats = await Promise.all(
          data.map(async (deck: DeckWithStats) => {
            try {
              const statsResponse = await fetch(
                `/api/lernen/naechste?deckId=${deck.id}&countOnly=true`
              )
              if (statsResponse.ok) {
                const stats = await statsResponse.json()
                return {
                  ...deck,
                  dueCount: stats.dueCount ?? 0,
                  newCount: stats.newCount ?? 0,
                }
              }
            } catch {
              // Ignore stats errors for individual decks
            }
            return { ...deck, dueCount: 0, newCount: 0 }
          })
        )

        setDecks(decksWithStats)
      } catch (error) {
        console.error("Fehler beim Laden der Decks:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchDecks()
  }, [])

  if (loading) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">Lernen</h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-white rounded-2xl shadow-md p-6 animate-pulse"
            >
              <div className="h-12 w-12 bg-gray-200 rounded-xl mb-4" />
              <div className="h-5 bg-gray-200 rounded w-3/4 mb-2" />
              <div className="h-4 bg-gray-200 rounded w-1/2" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (decks.length === 0) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">Lernen</h1>
        <div className="bg-white rounded-2xl shadow-md p-12 text-center">
          <div className="text-6xl mb-4">&#128218;</div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">
            Noch keine Decks vorhanden
          </h2>
            <p className="text-gray-500 mb-6">
              Erstelle zuerst ein Deck mit Karteikarten, um mit dem Lernen zu
              beginnen.
            </p>
          <Link
            href="/decks/neu"
            className="inline-flex items-center gap-2 bg-primary text-white font-bold px-6 py-3 rounded-xl hover:bg-primary-dark transition-colors"
          >
            Erstes Deck erstellen
          </Link>
        </div>
      </div>
    )
  }

  const totalDue = decks.reduce((sum, d) => sum + d.dueCount, 0)
  const totalNew = decks.reduce((sum, d) => sum + d.newCount, 0)

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Lernen</h1>
        <p className="text-gray-500 mt-1">
          {totalDue > 0 || totalNew > 0
            ? `${totalDue} fällige und ${totalNew} neue Karten warten auf dich!`
            : "Alle Karten sind aktuell gelernt. Gut gemacht!"}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {decks.map((deck) => {
          const totalCards = deck._count?.cards ?? 0
          const hasDueCards = deck.dueCount > 0 || deck.newCount > 0

          return (
            <button
              key={deck.id}
              onClick={() => router.push(`/lernen/${deck.id}`)}
              disabled={totalCards === 0}
              className={`bg-white rounded-2xl shadow-md p-6 text-left transition-all hover:shadow-lg ${
                totalCards === 0
                  ? "opacity-50 cursor-not-allowed"
                  : "hover:scale-[1.02] cursor-pointer"
              }`}
            >
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl mb-4"
                style={{ backgroundColor: deck.color + "20" }}
              >
                {deck.icon}
              </div>
              <h3 className="font-bold text-gray-800 text-lg mb-1">
                {deck.name}
              </h3>
              {deck.description && (
                <p className="text-gray-500 text-sm mb-3 line-clamp-2">
                  {deck.description}
                </p>
              )}
              <div className="flex items-center gap-3 text-sm">
                {totalCards === 0 ? (
                  <span className="text-gray-400">Keine Karten</span>
                ) : hasDueCards ? (
                  <>
                    {deck.dueCount > 0 && (
                      <span className="inline-flex items-center gap-1 text-orange-500 font-semibold">
                        {deck.dueCount} faellig
                      </span>
                    )}
                    {deck.newCount > 0 && (
                        <span className="inline-flex items-center gap-1 text-blue-500 font-semibold">
                        {deck.newCount} neu
                      </span>
                    )}
                  </>
                ) : (
                  <span className="text-primary font-semibold">
                    Alles gelernt
                  </span>
                )}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
