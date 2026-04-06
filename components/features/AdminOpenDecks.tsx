"use client"

// components/features/AdminOpenDecks.tsx
// Admin-Bereich: Zeigt ausstehende OpenDeck-Freigabe-Anfragen.

import { useState } from "react"

interface PendingDeck {
  id: string
  name: string
  description: string | null
  icon: string
  cardCount: number
  userName: string
  userEmail: string
  requestedAt: string
}

interface AdminOpenDecksProps {
  decks: PendingDeck[]
}

export default function AdminOpenDecks({ decks: initialDecks }: AdminOpenDecksProps) {
  const [decks, setDecks] = useState(initialDecks)
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectionReason, setRejectionReason] = useState("")

  async function handleReview(deckId: string, action: "approve" | "reject") {
    setLoading(deckId)
    setError(null)

    try {
      const res = await fetch("/api/admin/open-decks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deckId,
          action,
          ...(action === "reject" && rejectionReason ? { rejectionReason } : {}),
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? "Fehler beim Review.")
        return
      }

      setDecks((prev) => prev.filter((d) => d.id !== deckId))
      setRejectingId(null)
      setRejectionReason("")
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
          OpenDeck-Anfragen
          {decks.length > 0 && (
            <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-accent/10 text-accent">
              {decks.length} ausstehend
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
          Keine ausstehenden Anfragen.
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
                  </div>
                  {deck.description && (
                    <p className="text-text-light text-sm mt-1">{deck.description}</p>
                  )}
                  <p className="text-xs text-text-light mt-2">
                    von {deck.userName} ({deck.userEmail}) · {new Date(deck.requestedAt).toLocaleString("de-CH")}
                  </p>
                </div>

                <div className="flex flex-col gap-2 shrink-0">
                  <button
                    onClick={() => handleReview(deck.id, "approve")}
                    disabled={loading === deck.id}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold bg-primary text-white hover:bg-primary-dark transition-colors disabled:opacity-50 min-h-[44px] min-w-[44px]"
                  >
                    {loading === deck.id ? "..." : "Genehmigen"}
                  </button>
                  <button
                    onClick={() => setRejectingId(rejectingId === deck.id ? null : deck.id)}
                    disabled={loading === deck.id}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold bg-red-50 text-red-500 hover:bg-red-100 transition-colors disabled:opacity-50 min-h-[44px] min-w-[44px]"
                  >
                    Ablehnen
                  </button>
                </div>
              </div>

              {rejectingId === deck.id && (
                <div className="mt-3 flex gap-2">
                  <input
                    type="text"
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="Grund (optional)"
                    maxLength={500}
                    className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-red-300 focus:outline-none"
                  />
                  <button
                    onClick={() => handleReview(deck.id, "reject")}
                    disabled={loading === deck.id}
                    className="px-4 py-2 rounded-lg text-xs font-bold bg-red-500 text-white hover:bg-red-600 transition-colors disabled:opacity-50 min-h-[44px]"
                  >
                    Ablehnen
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
