"use client"

// components/features/OpenDeckCard.tsx
// Karte fuer ein freigegebenes OpenDeck mit Kopieren-Button.

import { useState } from "react"
import { useRouter } from "next/navigation"

interface OpenDeckData {
  id: string
  name: string
  description: string | null
  color: string
  icon: string
  cardCount: number
  authorName: string
}

interface OpenDeckCardProps {
  deck: OpenDeckData
}

export default function OpenDeckCard({ deck }: OpenDeckCardProps) {
  const router = useRouter()
  const [copying, setCopying] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleCopy() {
    setCopying(true)
    setError(null)

    try {
      const res = await fetch("/api/open-decks/copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deckId: deck.id }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? "Kopieren fehlgeschlagen.")
        return
      }

      const data = await res.json()
      router.push(`/decks/${data.deckId}`)
    } catch {
      setError("Netzwerkfehler.")
    } finally {
      setCopying(false)
    }
  }

  return (
    <div className="bg-surface-card rounded-2xl shadow-card p-5 flex flex-col">
      <div
        className="h-1.5 w-10 rounded-full mb-3"
        style={{ backgroundColor: deck.color }}
      />
      <span className="text-2xl mb-2">{deck.icon}</span>
      <h3 className="font-bold text-text-dark truncate">{deck.name}</h3>
      {deck.description && (
        <p className="text-xs text-text-light mt-1 line-clamp-2">{deck.description}</p>
      )}
      <div className="flex items-center gap-2 mt-2 text-xs text-text-light">
        <span>{deck.cardCount} Karten</span>
        <span>·</span>
        <span>von {deck.authorName}</span>
      </div>

      {error && (
        <p className="text-xs text-red-500 mt-2">{error}</p>
      )}

      <button
        onClick={handleCopy}
        disabled={copying}
        className="mt-4 w-full py-2.5 bg-primary text-white font-bold rounded-xl hover:bg-primary-dark transition-colors disabled:opacity-50 text-sm min-h-[44px]"
      >
        {copying ? "Wird kopiert..." : "In meine Decks kopieren"}
      </button>
    </div>
  )
}
