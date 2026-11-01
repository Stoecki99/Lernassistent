// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

"use client"

// components/features/ipma/FeedbackPanel.tsx
// Lösung einer Position (Spezifikation 3.4, 6.8 FeedbackPanel): richtig/falsch mit Zeichen und Wort,
// Erklärung, Hinweis zur gewählten Option, Fundstelle mit Link zur Station. Nur mit SolvedItem
// (also erst nach «Prüfen» bzw. nach der Abgabe).

import type { SolvedItem } from "@/lib/ipma/types"
import styles from "@/app/(ipma)/ipma.module.css"
import { LETTERS, points, stationHref, stationNumber } from "./format"

export function SourceLine({ item }: { item: SolvedItem }) {
  const s = item.source
  const parts: string[] = [`Kompetenz ${item.competence}`]
  if (s.icbPage > 0) parts.push(`Swiss ICB S. ${s.icbPage}`)
  if (s.indicators.length) parts.push(`Indikatoren ${s.indicators.join(", ")}`)
  if (s.lb) parts.push(s.lb)
  if (s.book) parts.push(s.book)
  return (
    <p className={styles.fundstelle}>
      <strong>Fundstelle:</strong> {parts.join(" · ")}
      {s.station && (
        <>
          {" · "}
          {s.station.available ? (
            <a href={stationHref(s.station.slug)} target="_blank" rel="noopener noreferrer">
              Station {stationNumber(s.station.slug)} {s.station.title}
              <span className="sr-only"> (öffnet in neuem Tab)</span>
            </a>
          ) : (
            <span>
              Station {stationNumber(s.station.slug)} {s.station.title} (folgt)
            </span>
          )}
        </>
      )}
      {s.note ? ` · ${s.note}` : ""}
    </p>
  )
}

export default function FeedbackPanel({ item }: { item: SolvedItem }) {
  if (item.type === "mc") {
    const right = item.correct === true
    const hint = item.choice !== null ? item.optionHints?.[item.choice] : undefined
    const rightHint = item.correctOption !== undefined && item.correctOption !== item.choice ? item.optionHints?.[item.correctOption] : undefined
    return (
      <div className={`${styles.rueckmeldung} ${right ? styles.rueckRichtig : styles.rueckFalsch}`}>
        <p className={styles.rueckTitel}>
          {right ? "✓ Richtig" : item.choice === null ? "✗ Nicht beantwortet" : "✗ Falsch"}
          {!right && item.correctOption !== undefined ? ` · richtig ist ${LETTERS[item.correctOption]}` : ""}
          {item.pointsQ !== null ? ` · ${points(item.pointsQ)} von ${item.points} ${item.points === 1 ? "Punkt" : "Punkten"}` : ""}
        </p>
        {hint && (
          <p>
            <strong>Zu deiner Wahl ({LETTERS[item.choice ?? 0]}):</strong> {hint}
          </p>
        )}
        {rightHint && (
          <p>
            <strong>Zu {LETTERS[item.correctOption ?? 0]}:</strong> {rightHint}
          </p>
        )}
        {item.explanation && (
          <p>
            <strong>Erklärung:</strong> {item.explanation}
          </p>
        )}
        <SourceLine item={item} />
        {item.revised && <p className="hint">Diese Frage wurde seit deinem Versuch überarbeitet.</p>}
        {item.withdrawn && <p className="hint">Diese Frage wurde zurückgezogen.</p>}
      </div>
    )
  }
  return (
    <div className={styles.rueckmeldung}>
      {item.explanation && (
        <p>
          <strong>Erklärung:</strong> {item.explanation}
        </p>
      )}
      <SourceLine item={item} />
      {item.revised && <p className="hint">Diese Frage wurde seit deinem Versuch überarbeitet.</p>}
      {item.withdrawn && <p className="hint">Diese Frage wurde zurückgezogen.</p>}
    </div>
  )
}
