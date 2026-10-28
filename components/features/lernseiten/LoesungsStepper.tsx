// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

"use client"

// components/features/lernseiten/LoesungsStepper.tsx
// Eine Aufgabe Schritt fuer Schritt: Zurueck / Weiter / Ganze Loesung.
// Aufgabentext, Woerterbuch und Formel liegen in einem Zuordnungs-Bereich,
// damit Satzstueck und Formelteil gemeinsam aufleuchten.

import { useState } from "react"
import type { Seite } from "@/lib/validations/lernseite"
import LernInhalt from "@/components/features/lernseiten/LernInhalt"
import Woerterbuch from "@/components/features/lernseiten/Woerterbuch"
import Zuordnung from "@/components/features/lernseiten/Zuordnung"

type Aufgabe = Seite["schritte"]["aufgaben"][number]

const knopf =
  "px-4 py-2 rounded-xl border-2 font-bold transition-colors aria-disabled:opacity-40 aria-disabled:cursor-not-allowed"

export default function LoesungsStepper({ aufgabe, methode }: { aufgabe: Aufgabe; methode: string[] }) {
  const [schritt, setSchritt] = useState(0)
  const letzter = aufgabe.stepper.length - 1
  const aktuell = aufgabe.stepper[schritt]

  return (
    <div className="bg-surface-card rounded-2xl shadow-card p-5 sm:p-6">
      <h3 className="font-extrabold text-text-dark text-lg mb-3">{aufgabe.titel}</h3>

      <Zuordnung className="space-y-4">
        <div className="rounded-xl bg-surface p-4 text-text-dark">
          <LernInhalt inhalt={aufgabe.aufgabe} />
        </div>

        {aufgabe.woerterbuch && aufgabe.woerterbuch.length > 0 && (
          <Woerterbuch eintraege={aufgabe.woerterbuch} />
        )}

        <ol className="flex flex-wrap gap-2 text-xs font-bold" aria-label="Lösungsmethode">
          {methode.map((m, i) => (
            <li
              key={i}
              aria-current={i === aktuell.methode ? "step" : undefined}
              className={`px-2.5 py-1 rounded-full border-2 ${
                i === aktuell.methode
                  ? "bg-secondary text-white border-secondary"
                  : i < aktuell.methode
                    ? "border-secondary text-secondary-dark"
                    : "border-gray-200 text-text-light"
              }`}
            >
              {m}
            </li>
          ))}
        </ol>

        <div className="rounded-xl border-2 border-secondary/30 p-4 text-lg overflow-x-auto">
          <LernInhalt inhalt={aktuell.formel} />
        </div>
      </Zuordnung>

      <div className="mt-3 text-text" aria-live="polite">
        <span className="font-bold text-text-light">Warum: </span>
        <LernInhalt inhalt={aktuell.warum} inline />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setSchritt((s) => Math.max(0, s - 1))}
          aria-disabled={schritt === 0}
          className={`${knopf} border-gray-200 text-text hover:border-secondary`}
        >
          Zurück
        </button>
        <button
          type="button"
          onClick={() => setSchritt((s) => Math.min(letzter, s + 1))}
          aria-disabled={schritt === letzter}
          className={`${knopf} border-secondary bg-secondary text-white hover:bg-secondary-dark`}
        >
          Weiter
        </button>
        <button
          type="button"
          onClick={() => setSchritt(letzter)}
          aria-disabled={schritt === letzter}
          className={`${knopf} border-gray-200 text-text hover:border-secondary`}
        >
          Ganze Lösung
        </button>
        <span className="ml-auto text-sm font-bold text-text-light">
          Schritt {schritt + 1} / {aufgabe.stepper.length}
        </span>
      </div>
    </div>
  )
}
