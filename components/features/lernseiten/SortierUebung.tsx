// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

"use client"

// components/features/lernseiten/SortierUebung.tsx
// Mini-Uebung mit Sofort-Feedback: jedes Element einer Kategorie zuordnen.

import { useState } from "react"
import type { Seite } from "@/lib/validations/lernseite"
import LernInhalt from "@/components/features/lernseiten/LernInhalt"

type Uebung = Seite["bausteine"]["uebung"]

export default function SortierUebung({ uebung }: { uebung: Uebung }) {
  const [antworten, setAntworten] = useState<(number | null)[]>(() => uebung.elemente.map(() => null))

  const beantwortet = antworten.filter((a) => a !== null).length
  const richtig = antworten.filter((a, i) => a === uebung.elemente[i].kategorie).length

  function waehle(element: number, kategorie: number) {
    setAntworten((alt) => alt.map((a, i) => (i === element ? kategorie : a)))
  }

  return (
    <div className="bg-surface-card rounded-2xl shadow-card p-5 sm:p-6">
      <div className="flex items-baseline justify-between gap-3 mb-4">
        <h3 className="font-extrabold text-text-dark text-lg">
          Mini-Übung: <LernInhalt inhalt={uebung.frage} inline />
        </h3>
        <span className="text-sm font-bold text-text-light whitespace-nowrap" aria-live="polite">
          {richtig} / {uebung.elemente.length}
        </span>
      </div>

      <ul className="space-y-3">
        {uebung.elemente.map((element, i) => {
          const antwort = antworten[i]
          const istRichtig = antwort === element.kategorie
          return (
            <li key={i} className="rounded-xl border-2 border-gray-100 p-3">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1 font-semibold text-text-dark">
                  <LernInhalt inhalt={element.text} inline />
                </div>
                <div className="flex flex-wrap gap-2" role="group" aria-label="Kategorie wählen">
                  {uebung.kategorien.map((kategorie, k) => {
                    let stil = "border-gray-200 text-text hover:border-secondary hover:bg-secondary/5"
                    if (antwort !== null) {
                      if (k === element.kategorie) stil = "border-primary bg-primary/10 text-primary-dark"
                      else if (k === antwort) stil = "border-[#FF4B4B] bg-[#FF4B4B]/10 text-[#C53030]"
                      else stil = "border-gray-200 text-text-light opacity-60"
                    }
                    return (
                      <button
                        key={k}
                        type="button"
                        onClick={() => waehle(i, k)}
                        disabled={antwort !== null}
                        aria-pressed={antwort === k}
                        className={`px-3 py-1.5 rounded-lg border-2 text-sm font-bold transition-colors ${stil}`}
                      >
                        {kategorie}
                      </button>
                    )
                  })}
                </div>
              </div>
              {antwort !== null && (
                <p className={`mt-2 text-sm ${istRichtig ? "text-primary-dark" : "text-[#C53030]"}`}>
                  <span className="font-bold">{istRichtig ? "Richtig. " : "Nicht ganz. "}</span>
                  <LernInhalt inhalt={element.begruendung} inline />
                </p>
              )}
            </li>
          )
        })}
      </ul>

      {beantwortet === uebung.elemente.length && (
        <div className="mt-4 flex items-center justify-between gap-3">
          <p className="font-bold text-text-dark">
            {richtig === uebung.elemente.length
              ? "Alles richtig zugeordnet."
              : `${richtig} von ${uebung.elemente.length} richtig.`}
          </p>
          <button
            type="button"
            onClick={() => setAntworten(uebung.elemente.map(() => null))}
            className="px-4 py-2 rounded-xl border-2 border-gray-200 font-bold text-text hover:border-secondary"
          >
            Nochmals
          </button>
        </div>
      )}
    </div>
  )
}
