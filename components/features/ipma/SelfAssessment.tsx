// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

"use client"

// components/features/ipma/SelfAssessment.tsx
// Selbstbewertung einer offenen Antwort (Spezifikation 4.2, 6.8 SelfAssessment): eigene Antwort neben der
// Musterlösung, je Rasterkriterium Schaltflächen 0 … max (aria-pressed, keine Schieberegler), Summe.
// Prüfung: änderbar, solange abgegeben und nicht abgeschlossen; Training: genau einmal (Nachtrag 8.5 Nr. 5).

import type { SolvedItem } from "@/lib/ipma/types"
import { useEffect, useId, useState } from "react"
import styles from "@/app/(ipma)/ipma.module.css"
import { ipmaApi, errorMessage } from "./api"
import { QUARTERS, points } from "./format"

const SOURCE_TEXT = { mc: "automatisch", self: "Selbstbewertung", ai: "Claude" } as const

export default function SelfAssessment({
  attemptId,
  item,
  editable,
  onSaved,
  onAnnounce,
}: {
  attemptId: string
  item: SolvedItem
  /** Bewerten erlaubt (Prüfung abgegeben bzw. Training ohne bisherige Bewertung) */
  editable: boolean
  onSaved: (item: SolvedItem) => void
  onAnnounce?: (text: string) => void
}) {
  const id = useId()
  const rubric = item.rubric ?? []
  const [scores, setScores] = useState<(number | null)[]>(() => rubric.map((_, i) => item.selfScores[i] ?? null))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const empty = (item.text ?? "").trim() === ""
  const done = item.selfScores.length > 0

  // Neue Daten vom Server (z. B. nach dem Speichern) übernehmen
  useEffect(() => {
    setScores((item.rubric ?? []).map((_, i) => item.selfScores[i] ?? null))
  }, [item.selfScores, item.rubric])

  const complete = scores.every((s) => s !== null)
  const sum = scores.reduce<number>((a, s) => a + (s ?? 0), 0)
  const max = rubric.reduce((a, r) => a + r.points, 0)
  const changed = scores.some((s, i) => s !== (item.selfScores[i] ?? null))

  async function save() {
    if (!complete) return
    setBusy(true)
    setError(null)
    try {
      const next = await ipmaApi.self(attemptId, item.position, scores.map((s) => s ?? 0))
      setSaved(true)
      onSaved(next)
      onAnnounce?.(`Selbstbewertung gespeichert: ${sum} von ${max} Rasterpunkten.`)
    } catch (e) {
      setError(errorMessage(e, "Die Selbstbewertung konnte nicht gespeichert werden."))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="stack">
      <div className={styles.vergleich}>
        <div>
          <h4>Deine Antwort</h4>
          {empty ? <p className={styles.leise}>Keine Antwort, zählt 0 Punkte.</p> : <p className={styles.vorformatiert}>{item.text}</p>}
        </div>
        <div>
          <h4>Musterlösung</h4>
          <p className={styles.vorformatiert}>{item.modelAnswer ?? "–"}</p>
          <p className="hint">Andere fachlich richtige Antworten sind gleichwertig.</p>
        </div>
      </div>

      {rubric.length > 0 && (
        <div className="stack">
          <h4 id={`${id}-raster`}>{empty ? "Bewertungsraster" : editable ? "Bewerte dich selbst nach dem Raster" : "Bewertung nach Raster"}</h4>
          <ul className={styles.raster} aria-labelledby={`${id}-raster`}>
            {rubric.map((r, i) => (
              <li key={i} className={styles.rasterZeile}>
                <span className={styles.rasterKriterium} id={`${id}-k${i}`}>
                  {i + 1}. {r.criterion} <span className={styles.leise}>(höchstens {r.points})</span>
                </span>
                {!empty && (
                  <span className={styles.punkteWahl} role="group" aria-labelledby={`${id}-k${i}`}>
                    {Array.from({ length: r.points + 1 }, (_, p) => (
                      <button
                        key={p}
                        type="button"
                        className={styles.punktKnopf}
                        aria-pressed={scores[i] === p}
                        aria-label={`${p} ${p === 1 ? "Punkt" : "Punkte"}`}
                        disabled={!editable || busy}
                        onClick={() => {
                          setSaved(false)
                          setScores((old) => old.map((s, j) => (j === i ? p : s)))
                        }}
                      >
                        {p}
                      </button>
                    ))}
                  </span>
                )}
              </li>
            ))}
          </ul>
          {!empty && (
            <p className={styles.summe}>
              Summe: {complete ? sum : "–"} von {max} Rasterpunkten
              {complete ? ` = ${points((sum * item.points * QUARTERS) / Math.max(max, 1))} von ${item.points} Punkten` : ""}
            </p>
          )}
          {!empty && editable && (
            <div className="row">
              <button type="button" className="btn primary" disabled={!complete || busy || (done && !changed)} onClick={() => void save()}>
                {busy ? "Wird gespeichert …" : done ? "Bewertung ändern" : "Bewertung speichern"}
              </button>
              {!complete && <span className="hint">Wähle für jedes Kriterium eine Punktzahl.</span>}
              {saved && !changed && <span className={styles.okText}>✓ gespeichert</span>}
            </div>
          )}
          {error && (
            <p className={styles.fehlerText} role="alert">
              {error}
            </p>
          )}
          {item.scoreSource && item.rasterPoints !== null && (
            <p className="hint">
              Massgebend: {SOURCE_TEXT[item.scoreSource]} · {item.rasterPoints} von {max} Rasterpunkten
              {item.pointsQ !== null ? ` · ${points(item.pointsQ)} ${item.pointsQ === QUARTERS ? "Punkt" : "Punkte"}` : ""}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
