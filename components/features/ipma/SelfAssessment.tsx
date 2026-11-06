// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

"use client"

// components/features/ipma/SelfAssessment.tsx
// Selbstbewertung einer offenen Antwort (Spezifikation 4.2, 6.8 SelfAssessment): eigene Antwort neben der
// Musterlösung, je Rasterkriterium Schaltflächen 0 … max in Schritten von 0.5 (aria-pressed, keine
// Schieberegler; Nachtrag 8.9), Summe in Punkten.
// Prüfung: änderbar, solange abgegeben und nicht abgeschlossen; Training: genau einmal (Nachtrag 8.5 Nr. 5).
// Speichern-Knopf mit aria-disabled (Fokus bleibt); verschwindet er nach dem Speichern (Training), erhält der
// Titel des Rasters den Fokus.

import type { SolvedItem } from "@/lib/ipma/types"
import { useEffect, useId, useRef, useState } from "react"
import styles from "@/app/(ipma)/ipma.module.css"
import { ipmaApi, errorMessage } from "./api"
import { pointWord, score, selfScoresKey } from "./format"

/** Wahlmöglichkeiten eines Kriteriums: 0, 0.5, … bis zum Höchstwert */
function steps(max: number): number[] {
  return Array.from({ length: Math.round(max * 2) + 1 }, (_, k) => k / 2)
}

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
  const titleRef = useRef<HTMLHeadingElement>(null)
  const focusAfterSave = useRef(false)
  const empty = (item.text ?? "").trim() === ""
  const done = item.selfScores.length > 0

  // Neue Daten vom Server (z. B. nach dem Speichern) übernehmen, aber nur bei geändertem Inhalt: Lädt die
  // Auswertung nach dem Speichern einer anderen Position den Versuch neu, bleibt die Auswahl hier erhalten
  const serverKey = selfScoresKey(item)
  const [syncedKey, setSyncedKey] = useState(serverKey)
  if (serverKey !== syncedKey) {
    setSyncedKey(serverKey)
    setScores(rubric.map((_, i) => item.selfScores[i] ?? null))
  }

  useEffect(() => {
    if (!focusAfterSave.current) return
    focusAfterSave.current = false
    if (!editable) titleRef.current?.focus()
  }, [editable, item.selfScores])

  const complete = scores.every((s) => s !== null)
  const sum = scores.reduce<number>((a, s) => a + (s ?? 0), 0)
  const max = rubric.reduce((a, r) => a + r.points, 0)
  const changed = scores.some((s, i) => s !== (item.selfScores[i] ?? null))
  const saveBlocked = !complete || busy || (done && !changed)

  async function save() {
    if (saveBlocked) return
    setBusy(true)
    setError(null)
    try {
      const next = await ipmaApi.self(attemptId, item.position, scores.map((s) => s ?? 0))
      setSaved(true)
      focusAfterSave.current = true
      onSaved(next)
      onAnnounce?.(`Selbstbewertung gespeichert: ${score(sum)} von ${score(max)} Punkten.`)
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
          <h4 id={`${id}-raster`} ref={titleRef} tabIndex={-1}>{empty ? "Bewertungsraster" : editable ? "Bewerte dich selbst nach dem Raster" : "Bewertung nach Raster"}</h4>
          <ul className={styles.raster} aria-labelledby={`${id}-raster`}>
            {rubric.map((r, i) => (
              <li key={i} className={styles.rasterZeile}>
                <span className={styles.rasterKriterium} id={`${id}-k${i}`}>
                  {i + 1}. {r.criterion} <span className={styles.leise}>(höchstens {score(r.points)})</span>
                </span>
                {!empty && (
                  <span className={styles.punkteWahl} role="group" aria-labelledby={`${id}-k${i}`}>
                    {steps(r.points).map((p) => (
                      <button
                        key={p}
                        type="button"
                        className={styles.punktKnopf}
                        aria-pressed={scores[i] === p}
                        aria-label={`${score(p)} ${pointWord(p)}`}
                        disabled={!editable || busy}
                        onClick={() => {
                          setSaved(false)
                          setScores((old) => old.map((s, j) => (j === i ? p : s)))
                        }}
                      >
                        {score(p)}
                      </button>
                    ))}
                  </span>
                )}
              </li>
            ))}
          </ul>
          {!empty && (
            <p className={styles.summe}>
              Summe: {complete ? score(sum) : "–"} von {score(max)} Punkten
              {/* Versuch vor Nachtrag 8.9 (offene Frage 2 Punkte): Umrechnung zeigen */}
              {complete && max !== item.points ? ` = ${score(Math.round((sum * item.points * 2) / Math.max(max, 0.5)) / 2)} von ${score(item.points)} Punkten in diesem Versuch` : ""}
            </p>
          )}
          {!empty && editable && (
            <div className="row">
              <button type="button" className="btn primary" aria-disabled={saveBlocked || undefined} onClick={() => void save()}>
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
              Massgebend: {SOURCE_TEXT[item.scoreSource]} · {score(item.rasterPoints)} von {score(item.points)} Punkten
            </p>
          )}
        </div>
      )}
    </div>
  )
}
