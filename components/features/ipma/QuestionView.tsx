// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

"use client"

// components/features/ipma/QuestionView.tsx
// Eine Frage (Spezifikation 6.8 QuestionView): <fieldset> mit <legend>, MC als native Radiogruppe
// (Optionen als ganze Flächen ≥ 44 px), offen als Textfeld mit Zähler (aria-describedby).
// Mit Lösung (SolvedItem) markiert die Ansicht richtige und gewählte Option mit Zeichen und Wort.

import type { ClientItem, SolvedItem } from "@/lib/ipma/types"
import { useId } from "react"
import styles from "@/app/(ipma)/ipma.module.css"
import { LETTERS, isSolved, typeLabel } from "./format"

export const MAX_TEXT = 3000

export default function QuestionView({
  item,
  total,
  headingRef,
  readOnly,
  onChoice,
  onText,
  showCompetence,
  hideHeading = false,
}: {
  item: ClientItem | SolvedItem
  total: number
  headingRef?: React.Ref<HTMLHeadingElement>
  readOnly: boolean
  onChoice?: (choice: number | null) => void
  onText?: (text: string) => void
  showCompetence?: boolean
  /** In der Durchsicht steht die Nummer schon in der Zusammenfassung */
  hideHeading?: boolean
}) {
  const id = useId()
  const solved = isSolved(item) ? item : null
  const text = item.text ?? ""
  const competence = item.competence

  return (
    <div className={styles.frage}>
      <div className={styles.frageKopf} hidden={hideHeading}>
        <h2 ref={headingRef} tabIndex={-1} className={styles.frageTitel} id={`${id}-titel`}>
          Frage {item.position} von {total}
        </h2>
        <span className="hint">
          {typeLabel(item)}
          {showCompetence && competence ? ` · Kompetenz ${competence}` : ""}
          {item.flagged ? " · ⚑ markiert" : ""}
        </span>
      </div>

      {item.type === "mc" ? (
        <fieldset className={styles.antworten}>
          <legend className={styles.frageText}>{item.question}</legend>
          {(item.options ?? []).map((option, index) => {
            const chosen = item.choice === index
            const right = solved?.correctOption === index
            const wrongChosen = solved !== null && chosen && !right
            const cls = right ? styles.optionRichtig : wrongChosen ? styles.optionFalsch : ""
            return (
              <label key={index} className={`${styles.option} ${cls}`}>
                <input
                  type="radio"
                  name={`${id}-wahl`}
                  value={index}
                  checked={chosen}
                  disabled={readOnly}
                  onChange={() => onChoice?.(index)}
                />
                {/* Buchstabe gehört zur Beschriftung, damit «richtig ist B» auch mit Screenreader nachvollziehbar ist */}
                <span className={styles.optionBuchstabe}>
                  {LETTERS[index]}
                  <span className="sr-only">:</span>
                </span>
                <span className={styles.optionText}>{option}</span>
                {solved && (right || chosen) && (
                  <span className={styles.optionMarke}>
                    {right ? "✓ richtig" : "✗ falsch"}
                    {chosen ? " · deine Wahl" : ""}
                  </span>
                )}
              </label>
            )
          })}
          {!readOnly && item.choice !== null && (
            <div>
              <button type="button" className={`btn ${styles.klein}`} onClick={() => onChoice?.(null)}>
                Auswahl zurücksetzen
              </button>
            </div>
          )}
        </fieldset>
      ) : (
        <fieldset className={styles.antworten}>
          <legend className={styles.frageText}>{item.question}</legend>
          <label htmlFor={`${id}-text`}>
            <strong>Deine Antwort</strong>
          </label>
          <textarea
            id={`${id}-text`}
            className={styles.textfeld}
            rows={10}
            maxLength={MAX_TEXT}
            value={text}
            readOnly={readOnly}
            aria-describedby={`${id}-zaehler`}
            onChange={(e) => onText?.(e.target.value)}
          />
          <span id={`${id}-zaehler`} className={styles.zaehler}>
            {text.length} von {MAX_TEXT} Zeichen
          </span>
        </fieldset>
      )}
    </div>
  )
}
