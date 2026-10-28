// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

"use client"

// components/features/lernseiten/Brille.tsx
// Analyse/Folgebeispiel: umschaltbare Ansichten («Brillen») auf das Ergebnis
// plus aufklappbare Fragen mit Loesung.

import { useState } from "react"
import type { Seite } from "@/lib/validations/lernseite"
import LernInhalt from "@/components/features/lernseiten/LernInhalt"
import Zuordnung from "@/components/features/lernseiten/Zuordnung"

type Analyse = NonNullable<Seite["analyse"]>

export default function Brille({ analyse }: { analyse: Analyse }) {
  const [aktiv, setAktiv] = useState(0)
  const brille = analyse.brillen[aktiv]

  return (
    <div className="space-y-4">
      <div className="bg-surface-card rounded-2xl shadow-card p-5 sm:p-6">
        <h3 className="font-extrabold text-text-dark text-lg mb-2">{analyse.titel}</h3>
        <div className="text-text mb-4">
          <LernInhalt inhalt={analyse.text} />
        </div>

        <div className="flex flex-wrap gap-2 mb-4" role="group" aria-label="Ansicht wählen">
          {analyse.brillen.map((b, i) => (
            <button
              key={b.name}
              type="button"
              onClick={() => setAktiv(i)}
              aria-pressed={i === aktiv}
              className={`px-3 py-1.5 rounded-lg border-2 text-sm font-bold transition-colors ${
                i === aktiv
                  ? "bg-secondary text-white border-secondary"
                  : "border-gray-200 text-text hover:border-secondary"
              }`}
            >
              {b.name}
            </button>
          ))}
        </div>

        <Zuordnung>
          <div className="rounded-xl border-2 border-secondary/30 p-4 text-lg overflow-x-auto">
            <LernInhalt inhalt={brille.formel} />
          </div>
        </Zuordnung>
        <div className="mt-3 text-text" aria-live="polite">
          <LernInhalt inhalt={brille.erklaerung} />
        </div>
      </div>

      {analyse.fragen.length > 0 && (
        <div className="space-y-2">
          {analyse.fragen.map((f, i) => (
            <details key={i} className="group bg-surface-card rounded-xl shadow-card px-5 py-3">
              <summary className="cursor-pointer font-bold text-text-dark list-none flex items-start gap-2">
                <span className="text-secondary transition-transform group-open:rotate-90" aria-hidden="true">
                  ›
                </span>
                <LernInhalt inhalt={f.frage} inline />
              </summary>
              <div className="mt-2 pl-5 text-text">
                <LernInhalt inhalt={f.antwort} />
              </div>
            </details>
          ))}
        </div>
      )}
    </div>
  )
}
