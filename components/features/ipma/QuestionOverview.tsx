// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

"use client"

// components/features/ipma/QuestionOverview.tsx
// Übersicht aller Fragen (Spezifikation 3.2, 6.8 QuestionOverview): Nummer und Zustand als Zeichen und Text
// (● beantwortet, ○ offen, ⚑ markiert; im Training ✓/✗ geprüft), Filter, Sprung, aria-current.
// Wird im Dialog (Blatt von unten auf schmalen Schirmen) gezeigt.

import type { ClientItem, SolvedItem } from "@/lib/ipma/types"
import { useState } from "react"
import styles from "@/app/(ipma)/ipma.module.css"
import { isAnswered, isSolved } from "./format"

type Filter = "alle" | "offen" | "markiert"

function stateOf(item: ClientItem | SolvedItem, training: boolean): { sign: string; words: string[] } {
  const words: string[] = []
  let sign: string
  if (training && isSolved(item)) {
    if (item.type === "mc" || item.correct !== null) {
      sign = item.correct ? "✓" : "✗"
      words.push(item.correct ? "geprüft, richtig" : "geprüft, falsch")
    } else {
      sign = "◐"
      words.push("geprüft, Selbstbewertung offen")
    }
  } else if (isAnswered(item)) {
    sign = "●"
    words.push("beantwortet")
  } else {
    sign = "○"
    words.push("offen")
  }
  if (item.flagged) words.push("markiert")
  return { sign, words }
}

export default function QuestionOverview({
  items,
  current,
  training,
  onJump,
}: {
  items: (ClientItem | SolvedItem)[]
  current: number
  training: boolean
  onJump: (index: number) => void
}) {
  const [filter, setFilter] = useState<Filter>("alle")
  const answered = items.filter(isAnswered).length
  const flagged = items.filter((i) => i.flagged).length
  const checked = items.filter(isSolved).length
  const visible = (item: ClientItem | SolvedItem) =>
    filter === "alle" ? true : filter === "markiert" ? item.flagged : training ? !isSolved(item) : !isAnswered(item)

  const groups = training
    ? [{ title: "Fragen", list: items }]
    : [
        { title: "Multiple Choice", list: items.filter((i) => i.type === "mc") },
        { title: "Offene Fragen", list: items.filter((i) => i.type === "offen") },
      ].filter((g) => g.list.length > 0)

  return (
    <div className="stack">
      <p>
        {training ? `${checked} von ${items.length} geprüft` : `${answered} von ${items.length} beantwortet`} · {flagged} markiert
      </p>
      <div className={styles.filterLeiste} role="group" aria-label="Filter">
        {(
          [
            ["alle", "Alle"],
            ["offen", training ? "Nur ungeprüfte" : "Nur offene"],
            ["markiert", "Nur markierte"],
          ] as const
        ).map(([value, label]) => (
          <button key={value} type="button" className={`btn ${styles.klein} ${filter === value ? "on" : ""}`} aria-pressed={filter === value} onClick={() => setFilter(value)}>
            {label}
          </button>
        ))}
      </div>
      {groups.map((g) => {
        const list = g.list.filter(visible)
        return (
          <div key={g.title} className={styles.uebersichtGruppe}>
            <h3>{g.title}</h3>
            {list.length === 0 ? (
              <p className="hint">Keine Fragen in diesem Filter.</p>
            ) : (
              <ul className={styles.uebersichtRaster}>
                {list.map((item) => {
                  const index = items.indexOf(item)
                  const s = stateOf(item, training)
                  const cls = [styles.uebersichtFeld, isAnswered(item) ? styles.feldBeantwortet : "", item.flagged ? styles.feldMarkiert : "", index === current ? styles.feldAktuell : ""].join(" ")
                  return (
                    <li key={item.position}>
                      <button
                        type="button"
                        className={cls}
                        aria-current={index === current ? "step" : undefined}
                        aria-label={`Frage ${item.position}: ${s.words.join(", ")}`}
                        onClick={() => onJump(index)}
                      >
                        <span aria-hidden="true" className={styles.feldZeichen}>
                          {item.flagged ? "⚑" : s.sign}
                        </span>
                        <span aria-hidden="true">{item.position}</span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        )
      })}
    </div>
  )
}
