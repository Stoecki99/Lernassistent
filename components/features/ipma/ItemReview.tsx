// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

"use client"

// components/features/ipma/ItemReview.tsx
// Fragen durchsehen (Spezifikation 4.4, 6.8 ItemReview): Liste aller Positionen mit Filter (falsch, markiert,
// offen, Kompetenz); je Frage eigene Antwort, Lösung, Erklärung, Fundstelle mit Link. Nur mit SolvedItem.

import type { SolvedItem } from "@/lib/ipma/types"
import { useState } from "react"
import styles from "@/app/(ipma)/ipma.module.css"
import AiAssessment from "./AiAssessment"
import FeedbackPanel from "./FeedbackPanel"
import { points } from "./format"
import QuestionView from "./QuestionView"
import SelfAssessment from "./SelfAssessment"

type Filter = "alle" | "falsch" | "markiert" | "offen"

function verdict(item: SolvedItem): string {
  if (item.correct === true) return "✓ richtig"
  if (item.correct === false) return "✗ falsch"
  return "○ nicht bewertet"
}

export default function ItemReview({ attemptId, items, canUseAi }: { attemptId: string; items: SolvedItem[]; canUseAi: boolean }) {
  const [filter, setFilter] = useState<Filter>("alle")
  const [competence, setCompetence] = useState<string>("")
  const competences = Array.from(new Set(items.map((i) => i.competence))).sort()
  const visible = items.filter((i) => {
    if (competence && i.competence !== competence) return false
    if (filter === "falsch") return i.correct !== true
    if (filter === "markiert") return i.flagged
    if (filter === "offen") return i.type === "offen"
    return true
  })

  return (
    <section className="card stack" aria-labelledby="durchsicht-titel">
      <h2 id="durchsicht-titel">Fragen durchsehen</h2>
      <div className={styles.filterLeiste}>
        <span role="group" aria-label="Filter" className={styles.filterLeiste}>
          {(
            [
              ["alle", "Alle"],
              ["falsch", "Falsch"],
              ["markiert", "Markiert"],
              ["offen", "Offene Fragen"],
            ] as const
          ).map(([value, label]) => (
            <button key={value} type="button" className={`btn ${styles.klein} ${filter === value ? "on" : ""}`} aria-pressed={filter === value} onClick={() => setFilter(value)}>
              {label}
            </button>
          ))}
        </span>
        <label>
          <span className="sr-only">Kompetenz</span>
          <select className={`btn ${styles.klein}`} value={competence} onChange={(e) => setCompetence(e.target.value)}>
            <option value="">Alle Kompetenzen</option>
            {competences.map((c) => (
              <option key={c} value={c}>
                Kompetenz {c}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="hint" aria-live="polite">
        {visible.length} von {items.length} Fragen
      </p>
      <ul className={styles.durchsicht}>
        {visible.map((item) => (
          <li key={item.position}>
            <details>
              <summary>
                <strong>Frage {item.position}</strong>
                <span>{item.type === "mc" ? "Multiple Choice" : "Offen"}</span>
                <span>{verdict(item)}</span>
                <span className="hint">
                  {item.pointsQ !== null ? points(item.pointsQ) : "0"} / {item.points} · Kompetenz {item.competence}
                  {item.flagged ? " · ⚑" : ""}
                </span>
              </summary>
              <div className={styles.durchsichtInhalt}>
                {item.type === "mc" ? (
                  <QuestionView item={item} total={items.length} readOnly hideHeading />
                ) : (
                  <>
                    <p className={styles.frageText}>{item.question}</p>
                    <SelfAssessment attemptId={attemptId} item={item} editable={false} onSaved={() => undefined} />
                    <AiAssessment attemptId={attemptId} item={item} canUseAi={canUseAi} allowed={false} onSaved={() => undefined} />
                  </>
                )}
                <FeedbackPanel item={item} />
              </div>
            </details>
          </li>
        ))}
      </ul>
    </section>
  )
}
