// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

"use client"

// components/features/lernseiten/Selbsttest.tsx
// Multiple-Choice-Selbsttest: eine Frage nach der anderen, Erklaerung nach dem
// Antworten, Punktestand, «Neu starten». Ergebnisse werden nicht gespeichert.
// Fokus wird nach jedem Schritt gezielt gesetzt, damit er nicht verloren geht.

import { useEffect, useRef, useState } from "react"
import type { QuizFrage } from "@/lib/validations/lernseite"
import LernInhalt from "@/components/features/lernseiten/LernInhalt"

const BUCHSTABEN = "ABCDEF"

export default function Selbsttest({ fragen }: { fragen: QuizFrage[] }) {
  const [index, setIndex] = useState(0)
  const [gewaehlt, setGewaehlt] = useState<number | null>(null)
  const [punkte, setPunkte] = useState(0)
  const [fertig, setFertig] = useState(false)
  const [interagiert, setInteragiert] = useState(false)

  const frageRef = useRef<HTMLDivElement>(null)
  const weiterRef = useRef<HTMLButtonElement>(null)
  const ergebnisRef = useRef<HTMLDivElement>(null)

  const frage = fragen[index]
  const istLetzte = index === fragen.length - 1

  // Fokus nachfuehren: nach der Antwort auf «Weiter», bei neuer Frage auf die Frage,
  // am Ende auf das Ergebnis. Beim ersten Laden der Seite nicht springen.
  useEffect(() => {
    if (!interagiert) return
    if (fertig) ergebnisRef.current?.focus()
    else if (gewaehlt !== null) weiterRef.current?.focus()
    else frageRef.current?.focus()
  }, [index, gewaehlt, fertig, interagiert])

  function antworte(option: number) {
    if (gewaehlt !== null) return
    setInteragiert(true)
    setGewaehlt(option)
    if (option === frage.richtig) setPunkte((p) => p + 1)
  }

  function weiter() {
    if (istLetzte) {
      setFertig(true)
      return
    }
    setIndex((i) => i + 1)
    setGewaehlt(null)
  }

  function neuStarten() {
    setIndex(0)
    setGewaehlt(null)
    setPunkte(0)
    setFertig(false)
  }

  if (fertig) {
    const alle = punkte === fragen.length
    return (
      <div
        ref={ergebnisRef}
        tabIndex={-1}
        className="bg-surface-card rounded-2xl shadow-card p-6 text-center animate-scale-in"
      >
        <p className="text-4xl font-extrabold text-text-dark">
          {punkte} / {fragen.length}
        </p>
        <p className="mt-2 text-text">
          {alle
            ? "Alles richtig. Du kannst das Thema."
            : "Schau dir die Erklärungen der falschen Fragen nochmals an und starte neu."}
        </p>
        <button
          type="button"
          onClick={neuStarten}
          className="mt-5 px-6 py-3 bg-primary text-white font-bold rounded-xl shadow-button hover:bg-primary-dark btn-press"
        >
          Neu starten
        </button>
      </div>
    )
  }

  return (
    <div className="bg-surface-card rounded-2xl shadow-card p-5 sm:p-6">
      <div className="flex items-center justify-between text-sm font-bold text-text-light mb-3">
        <span>
          Frage {index + 1} von {fragen.length}
        </span>
        <span>{punkte === 1 ? "1 Punkt" : `${punkte} Punkte`}</span>
      </div>

      <div ref={frageRef} tabIndex={-1} className="text-lg font-bold text-text-dark mb-4">
        <LernInhalt inhalt={frage.frage} />
      </div>

      <div className="space-y-2">
        {frage.optionen.map((option, i) => {
          let stil = "border-gray-200 hover:border-secondary hover:bg-secondary/5"
          let zeichen = BUCHSTABEN[i]
          let hinweis = ""
          if (gewaehlt !== null) {
            if (i === frage.richtig) {
              stil = "border-primary bg-primary/10"
              zeichen = "✓"
              hinweis = " (richtige Antwort)"
            } else if (i === gewaehlt) {
              stil = "border-[#FF4B4B] bg-[#FF4B4B]/10"
              zeichen = "✗"
              hinweis = " (deine Antwort, falsch)"
            } else {
              stil = "border-gray-200 opacity-60"
            }
          }
          return (
            <button
              key={i}
              type="button"
              onClick={() => antworte(i)}
              disabled={gewaehlt !== null}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left font-semibold text-text-dark transition-colors ${stil}`}
            >
              <span
                className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-sm font-bold flex-shrink-0"
                aria-hidden="true"
              >
                {zeichen}
              </span>
              <span className="sr-only">{BUCHSTABEN[i]}: </span>
              <LernInhalt inhalt={option} inline className="flex-1" />
              {hinweis && <span className="sr-only">{hinweis}</span>}
            </button>
          )
        })}
      </div>

      {/* Live-Region bleibt immer im DOM, damit Screenreader die Rueckmeldung vorlesen */}
      <div aria-live="polite" className="mt-4">
        {gewaehlt !== null && (
          <div
            className={`rounded-xl p-4 ${
              gewaehlt === frage.richtig ? "bg-primary/10 text-text-dark" : "bg-[#FF4B4B]/10 text-text-dark"
            }`}
          >
            <p className="font-extrabold mb-1">
              {gewaehlt === frage.richtig ? "✓ Richtig." : "✗ Leider falsch."}
            </p>
            <LernInhalt inhalt={frage.erklaerung} />
          </div>
        )}
      </div>

      {gewaehlt !== null && (
        <button
          ref={weiterRef}
          type="button"
          onClick={weiter}
          className="mt-3 w-full py-3 bg-primary text-white font-bold rounded-xl shadow-button hover:bg-primary-dark btn-press"
        >
          {istLetzte ? "Ergebnis anzeigen" : "Weiter"}
        </button>
      )}
    </div>
  )
}
