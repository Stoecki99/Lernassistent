"use client"

// components/features/ImportPageClient.tsx
// Client-Wrapper fuer die Import-Seite mit Deck-Auswahl und ImportFormular.

import { useState } from "react"
import ImportFormular from "@/components/features/ImportFormular"

interface DeckOption {
  id: string
  name: string
  icon: string
  color: string
}

interface ImportPageClientProps {
  decks: DeckOption[]
  preselectedDeckId: string | null
}

export default function ImportPageClient({ decks, preselectedDeckId }: ImportPageClientProps) {
  const initialDeck = preselectedDeckId
    ? decks.find((d) => d.id === preselectedDeckId) ?? decks[0]
    : decks[0]

  const [selectedDeckId, setSelectedDeckId] = useState(initialDeck.id)

  const selectedDeck = decks.find((d) => d.id === selectedDeckId) ?? decks[0]

  return (
    <div className="space-y-6">
      {/* Deck-Auswahl */}
      <div>
        <label htmlFor="deck-select" className="block text-sm font-bold text-text-dark mb-2">
          Ziel-Deck
        </label>
        <div className="relative">
          <select
            id="deck-select"
            value={selectedDeckId}
            onChange={(e) => setSelectedDeckId(e.target.value)}
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-text font-semibold focus:border-primary focus:outline-none transition-colors appearance-none bg-white pr-10"
          >
            {decks.map((deck) => (
              <option key={deck.id} value={deck.id}>
                {deck.icon} {deck.name}
              </option>
            ))}
          </select>
          <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-text-light">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
              <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
            </svg>
          </div>
        </div>
      </div>

      {/* Import-Formular */}
      <ImportFormular
        key={selectedDeckId}
        deckId={selectedDeckId}
        deckName={`${selectedDeck.icon} ${selectedDeck.name}`}
      />
    </div>
  )
}
