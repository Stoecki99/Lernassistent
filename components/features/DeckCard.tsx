// components/features/DeckCard.tsx
// Deck-Vorschau-Karte mit farbigem Akzent, Name, Icon und Karten-Anzahl.

import Link from "next/link"

interface DeckCardProps {
  id: string
  name: string
  icon: string
  color: string
  cardCount: number
}

export default function DeckCard({ id, name, icon, color, cardCount }: DeckCardProps) {
  return (
    <Link
      href={`/decks/${id}`}
      className="group block bg-surface-card rounded-2xl shadow-card hover:shadow-card-hover transition-all duration-200 hover:-translate-y-1 overflow-hidden"
    >
      {/* Farbiger Top-Border */}
      <div className="h-2 w-full" style={{ backgroundColor: color }} />

      <div className="p-5">
        {/* Icon */}
        <span className="text-4xl block mb-3" aria-hidden="true">
          {icon}
        </span>

        {/* Name */}
        <h3 className="font-extrabold text-text-dark text-lg truncate group-hover:text-primary transition-colors">
          {name}
        </h3>

        {/* Karten-Anzahl */}
        <p className="text-sm text-text-light mt-1">
          {cardCount === 0
            ? "Keine Karten"
            : cardCount === 1
              ? "1 Karte"
              : `${cardCount} Karten`}
        </p>
      </div>
    </Link>
  )
}
