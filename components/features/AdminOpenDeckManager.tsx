"use client"

// components/features/AdminOpenDeckManager.tsx
// Admin-Bereich: Verwaltung genehmigter OpenDecks (Loeschen, Favorit).

import { useState } from "react"

interface ApprovedDeck {
  id: string
  name: string
  description: string | null
  icon: string
  color: string
  cardCount: number
  userName: string
  userEmail: string
  isFeatured: boolean
  approvedAt: string
}

interface AdminOpenDeckManagerProps {
  decks: ApprovedDeck[]
}

export default function AdminOpenDeckManager({ decks: initialDecks }: AdminOpenDeckManagerProps) {
  const [decks, setDecks] = useState(initialDecks)
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  async function handleToggleFeatured(deckId: string) {
    setLoading(deckId)
    setError(null)

    try {
      const res = await fetch("/api/admin/open-decks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deckId }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? "Fehler beim Aendern.")
        return
      }

      const data = await res.json()
      setDecks((prev) =>
        prev.map((d) =>
          d.id === deckId ? { ...d, isFeatured: data.isFeatured } : d
        )
      )
    } catch {
      setError("Netzwerkfehler.")
    } finally {
      setLoading(null)
    }
  }

  async function handleDelete(deckId: string) {
    setLoading(deckId)
    setError(null)

    try {
      const res = await fetch("/api/admin/open-decks", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deckId }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? "Fehler beim Loeschen.")
        return
      }

      setDecks((prev) => prev.filter((d) => d.id !== deckId))
      setConfirmDeleteId(null)
    } catch {
      setError("Netzwerkfehler.")
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-text-dark">
          OpenDeck-Verwaltung
          {decks.length > 0 && (
            <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-primary/10 text-primary">
              {decks.length} aktiv
            </span>
          )}
        </h2>
      </div>

      {error && (
        <div className="px-4 py-3 rounded-xl bg-red-50 text-red-600 font-semibold text-sm">
          {error}
        </div>
      )}

      {decks.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-md p-8 text-center text-text-light">
          Keine aktiven OpenDecks.
        </div>
      ) : (
        <div className="space-y-3">
          {decks.map((deck) => (
            <div
              key={deck.id}
              className="bg-white rounded-2xl shadow-md p-5"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xl">{deck.icon}</span>
                    <span className="font-bold text-text-dark">{deck.name}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-text-light font-medium">
                      {deck.cardCount} Karten
                    </span>
                    {deck.isFeatured && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 font-bold">
                        Favorit
                      </span>
                    )}
                  </div>
                  {deck.description && (
                    <p className="text-text-light text-sm mt-1">{deck.description}</p>
                  )}
                  <p className="text-xs text-text-light mt-2">
                    von {deck.userName} ({deck.userEmail}) · genehmigt am {new Date(deck.approvedAt).toLocaleString("de-CH")}
                  </p>
                </div>

                <div className="flex flex-col gap-2 shrink-0">
                  <button
                    onClick={() => handleToggleFeatured(deck.id)}
                    disabled={loading === deck.id}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors disabled:opacity-50 min-h-[44px] min-w-[44px] ${
                      deck.isFeatured
                        ? "bg-yellow-100 text-yellow-700 hover:bg-yellow-200"
                        : "bg-gray-100 text-text-light hover:bg-gray-200"
                    }`}
                  >
                    {loading === deck.id ? "..." : deck.isFeatured ? "Favorit entfernen" : "Als Favorit"}
                  </button>
                  {confirmDeleteId === deck.id ? (
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleDelete(deck.id)}
                        disabled={loading === deck.id}
                        className="px-2 py-1.5 rounded-lg text-xs font-bold bg-red-500 text-white hover:bg-red-600 transition-colors disabled:opacity-50 min-h-[44px]"
                      >
                        {loading === deck.id ? "..." : "Ja"}
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        className="px-2 py-1.5 rounded-lg text-xs font-bold bg-gray-100 text-text-light hover:bg-gray-200 transition-colors min-h-[44px]"
                      >
                        Nein
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDeleteId(deck.id)}
                      disabled={loading === deck.id}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold bg-red-50 text-red-500 hover:bg-red-100 transition-colors disabled:opacity-50 min-h-[44px] min-w-[44px]"
                    >
                      Entfernen
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
