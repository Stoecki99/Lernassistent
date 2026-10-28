// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// components/features/lernseiten/LernseiteKarte.tsx
// Kachel fuer ein Fach in der Lernseiten-Liste (Stil wie DeckCard).

import Link from "next/link"

interface LernseiteKarteProps {
  slug: string
  kuerzel: string
  titel: string
  icon: string
  farbe: string
  anzahlThemen: number
}

export default function LernseiteKarte({ slug, kuerzel, titel, icon, farbe, anzahlThemen }: LernseiteKarteProps) {
  return (
    <Link
      href={`/lernseiten/${slug}`}
      className="group block bg-surface-card rounded-2xl shadow-card hover:shadow-card-hover transition-all duration-200 hover:-translate-y-1 overflow-hidden"
    >
      {/* Farbiger Top-Border */}
      <div className="h-2 w-full" style={{ backgroundColor: farbe }} />

      <div className="p-5">
        <span className="text-4xl block mb-3 font-extrabold" style={{ color: farbe }} aria-hidden="true">
          {icon}
        </span>
        <h3 className="font-extrabold text-text-dark text-lg truncate group-hover:text-primary transition-colors">
          {kuerzel}
        </h3>
        <p className="text-sm text-text mt-0.5 line-clamp-2">{titel}</p>
        <p className="text-sm text-text-light mt-1">
          {anzahlThemen === 0 ? "Noch keine Themen" : anzahlThemen === 1 ? "1 Thema" : `${anzahlThemen} Themen`}
        </p>
      </div>
    </Link>
  )
}
