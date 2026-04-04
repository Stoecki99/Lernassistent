"use client"

// components/features/QuizAuswahl.tsx
// Quiz-Auswahl: Deck, Quiz-Typ und Fragenanzahl waehlen, dann starten.

import { useState } from "react"
import { useRouter } from "next/navigation"

interface DeckOption {
  id: string
  name: string
  icon: string
  color: string
  cardCount: number
}

interface QuizAuswahlProps {
  decks: DeckOption[]
}

const QUIZ_TYPES = [
  {
    value: "multiple_choice",
    label: "Multiple Choice",
    description: "Waehle die richtige Antwort aus 4 Optionen",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8">
        <path fillRule="evenodd" d="M2.625 6.75a1.125 1.125 0 112.25 0 1.125 1.125 0 01-2.25 0zm4.875 0A.75.75 0 018.25 6h12a.75.75 0 010 1.5h-12a.75.75 0 01-.75-.75zM2.625 12a1.125 1.125 0 112.25 0 1.125 1.125 0 01-2.25 0zM7.5 12a.75.75 0 01.75-.75h12a.75.75 0 010 1.5h-12A.75.75 0 017.5 12zm-4.875 5.25a1.125 1.125 0 112.25 0 1.125 1.125 0 01-2.25 0zm4.875 0a.75.75 0 01.75-.75h12a.75.75 0 010 1.5h-12a.75.75 0 01-.75-.75z" clipRule="evenodd" />
      </svg>
    ),
    minCards: 4,
    color: "primary",
  },
  {
    value: "true_false",
    label: "Wahr / Falsch",
    description: "Entscheide ob die Zuordnung stimmt",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8">
        <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" />
      </svg>
    ),
    minCards: 2,
    color: "secondary",
  },
  {
    value: "free_text",
    label: "Freitext",
    description: "Tippe die Antwort selbst ein — KI bewertet",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8">
        <path fillRule="evenodd" d="M4.125 3C3.089 3 2.25 3.84 2.25 4.875V18a3 3 0 003 3h15a3 3 0 003-3V4.875C23.25 3.84 22.41 3 21.375 3H4.125zM9.75 8.625a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5a.75.75 0 01.75-.75zm2.25 2.25a.75.75 0 000 1.5h3a.75.75 0 000-1.5h-3z" clipRule="evenodd" />
      </svg>
    ),
    minCards: 1,
    color: "accent",
  },
] as const

const QUESTION_COUNTS = [5, 10, 15, 20] as const

const colorMap: Record<string, { bg: string; border: string; text: string; shadow: string }> = {
  primary: {
    bg: "bg-primary/10",
    border: "border-primary",
    text: "text-primary",
    shadow: "shadow-button",
  },
  secondary: {
    bg: "bg-secondary/10",
    border: "border-secondary",
    text: "text-secondary",
    shadow: "shadow-button-secondary",
  },
  accent: {
    bg: "bg-accent/10",
    border: "border-accent",
    text: "text-accent",
    shadow: "shadow-button-accent",
  },
}

export default function QuizAuswahl({ decks }: QuizAuswahlProps) {
  const router = useRouter()
  const [selectedDeck, setSelectedDeck] = useState<string>("")
  const [selectedType, setSelectedType] = useState<string>("multiple_choice")
  const [selectedCount, setSelectedCount] = useState<number>(5)

  const currentDeck = decks.find((d) => d.id === selectedDeck)
  const currentType = QUIZ_TYPES.find((t) => t.value === selectedType)
  const canStart =
    selectedDeck &&
    currentDeck &&
    currentType &&
    currentDeck.cardCount >= currentType.minCards

  const handleStart = () => {
    if (!canStart) return
    router.push(
      `/quiz/${selectedDeck}?type=${selectedType}&count=${selectedCount}`
    )
  }

  return (
    <div className="space-y-8">
      {/* Schritt 1: Deck waehlen */}
      <div>
        <h2 className="text-lg font-bold text-text-dark mb-3">
          1. Deck waehlen
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {decks.map((deck) => (
            <button
              key={deck.id}
              onClick={() => setSelectedDeck(deck.id)}
              className={`text-left p-4 rounded-2xl border-2 transition-all duration-200 ${
                selectedDeck === deck.id
                  ? "border-primary bg-primary/5 shadow-card"
                  : "border-transparent bg-surface-card shadow-card hover:shadow-card-hover hover:-translate-y-0.5"
              }`}
            >
              <div
                className="h-1.5 w-10 rounded-full mb-3"
                style={{ backgroundColor: deck.color }}
              />
              <span className="text-2xl block mb-1">{deck.icon}</span>
              <p className="font-bold text-text-dark text-sm truncate">
                {deck.name}
              </p>
              <p className="text-xs text-text-light mt-0.5">
                {deck.cardCount} {deck.cardCount === 1 ? "Karte" : "Karten"}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Schritt 2: Quiz-Typ waehlen */}
      <div>
        <h2 className="text-lg font-bold text-text-dark mb-3">
          2. Quiz-Typ waehlen
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {QUIZ_TYPES.map((type) => {
            const colors = colorMap[type.color]!
            const isSelected = selectedType === type.value
            const tooFewCards =
              currentDeck && currentDeck.cardCount < type.minCards

            return (
              <button
                key={type.value}
                onClick={() => setSelectedType(type.value)}
                disabled={!!tooFewCards}
                className={`relative text-left p-5 rounded-2xl border-2 transition-all duration-200 ${
                  tooFewCards
                    ? "opacity-40 cursor-not-allowed border-transparent bg-gray-50"
                    : isSelected
                      ? `${colors.border} ${colors.bg} shadow-card`
                      : "border-transparent bg-surface-card shadow-card hover:shadow-card-hover hover:-translate-y-0.5"
                }`}
              >
                <div className={`mb-3 ${isSelected ? colors.text : "text-text-light"}`}>
                  {type.icon}
                </div>
                <p className="font-bold text-text-dark">{type.label}</p>
                <p className="text-xs text-text-light mt-1">
                  {type.description}
                </p>
                {tooFewCards && (
                  <p className="text-xs text-red-500 mt-2">
                    Mind. {type.minCards} Karten noetig
                  </p>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Schritt 3: Fragenanzahl waehlen */}
      <div>
        <h2 className="text-lg font-bold text-text-dark mb-3">
          3. Anzahl Fragen
        </h2>
        <div className="flex gap-3">
          {QUESTION_COUNTS.map((count) => {
            const tooMany = currentDeck && count > currentDeck.cardCount

            return (
              <button
                key={count}
                onClick={() => setSelectedCount(count)}
                disabled={!!tooMany}
                className={`flex-1 py-3 rounded-xl font-bold text-lg transition-all duration-200 ${
                  tooMany
                    ? "opacity-30 cursor-not-allowed bg-gray-100 text-text-light"
                    : selectedCount === count
                      ? "bg-primary text-white shadow-button"
                      : "bg-surface-card text-text-dark shadow-card hover:shadow-card-hover"
                }`}
              >
                {count}
              </button>
            )
          })}
        </div>
      </div>

      {/* Start-Button */}
      <button
        onClick={handleStart}
        disabled={!canStart}
        className="w-full py-4 bg-primary text-white font-extrabold text-lg rounded-2xl shadow-button hover:bg-primary-dark btn-press disabled:opacity-50 disabled:cursor-not-allowed transition-all"
      >
        Quiz starten
      </button>
    </div>
  )
}
