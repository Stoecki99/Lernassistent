// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

"use client"

// components/features/ipma/CompetenceMap.tsx
// Kompetenz-Landkarte (Spezifikation 4.4, 6.8): 28 Felder in drei Bereichen, Stand als Zeichen und Wort
// (nie Farbe allein). Zwei Arten: Beherrschung über alle Versuche (Startseite) oder Ergebnis eines Versuchs
// (✓ nachgewiesen / ✗ nicht nachgewiesen, «2/3»). Klick oder Enter öffnet den Detail-Dialog.

import type { MasteryLevelView, OverviewView } from "@/lib/ipma/types"
import { useState } from "react"
import styles from "@/app/(ipma)/ipma.module.css"
import Dialog from "@/components/features/leitstand/Dialog"
import { AREAS, COMPETENCES, type Competence, type CompetenceId } from "@/lib/ipma/competences"
import { LEVEL, stationHref, stationNumber, trainingHref } from "./format"

export type MasteryEntry = OverviewView["mastery"][number]

export interface AttemptCompetence {
  items: number
  correct: number
  shown: boolean
  /** Positionen dieser Kompetenz im Versuch mit richtig/falsch (für den Dialog) */
  positions?: { position: number; correct: boolean | null }[]
}

/** Titel und Veröffentlichung der Stationen (app/(ipma)/stations.ts) */
export type StationTitles = Record<string, { title: string; available: boolean }>

type Props = { stations?: StationTitles; title?: string } & (
  | { kind: "mastery"; mastery: MasteryEntry[] }
  | { kind: "attempt"; competences: Record<string, AttemptCompetence>; mastery?: MasteryEntry[] }
)

type FieldState = MasteryLevelView | "shown" | "missing" | "none"

function masteryText(m: MasteryEntry | undefined): string {
  if (!m) return "noch keine Daten"
  const level = LEVEL[m.level]
  if (m.value === null || m.level === "untrained") return `${level.word} (${m.answers} ${m.answers === 1 ? "Antwort" : "Antworten"})`
  return `${level.word} · ${Math.round(m.value * 100)} % aus ${m.answers} ${m.answers === 1 ? "Antwort" : "Antworten"}`
}

export default function CompetenceMap(props: Props) {
  const [open, setOpen] = useState<Competence | null>(null)
  const masteryById = new Map<CompetenceId, MasteryEntry>((props.mastery ?? []).map((m) => [m.competence, m]))

  function field(c: Competence): { state: FieldState; sign: string; word: string; detail: string } {
    if (props.kind === "mastery") {
      const m = masteryById.get(c.id)
      const level = m?.level ?? "untrained"
      return { state: level, sign: LEVEL[level].sign, word: LEVEL[level].word, detail: masteryText(m) }
    }
    const a = props.competences[c.id]
    if (!a) return { state: "none", sign: "–", word: "nicht geprüft", detail: "in diesem Versuch nicht geprüft" }
    return a.shown
      ? { state: "shown", sign: "✓", word: `${a.correct}/${a.items}`, detail: `nachgewiesen, ${a.correct} von ${a.items} richtig` }
      : { state: "missing", sign: "✗", word: `${a.correct}/${a.items}`, detail: `nicht nachgewiesen, ${a.correct} von ${a.items} richtig` }
  }

  const detail = open ? field(open) : null
  const attemptEntry = open && props.kind === "attempt" ? props.competences[open.id] : undefined

  return (
    <div className={styles.landkarte}>
      {props.title && <h3>{props.title}</h3>}
      <ul className={styles.legende} aria-label="Legende">
        {props.kind === "mastery" ? (
          (Object.keys(LEVEL) as MasteryLevelView[]).map((k) => (
            <li key={k}>
              <span aria-hidden="true">{LEVEL[k].sign}</span> {LEVEL[k].word}
            </li>
          ))
        ) : (
          <>
            <li>
              <span aria-hidden="true">✓</span> nachgewiesen (mindestens eine richtige Antwort)
            </li>
            <li>
              <span aria-hidden="true">✗</span> nicht nachgewiesen
            </li>
            <li>«2/3» = richtig von gestellt</li>
          </>
        )}
      </ul>
      {AREAS.map((area) => {
        const list = COMPETENCES.filter((c) => c.area === area.id)
        return (
          <div key={area.id} className={styles.bereich}>
            <p className={styles.bereichTitel} id={`bereich-${area.id}`}>
              {area.title}
              <small>
                {area.label} · {list.length} Kompetenzen
              </small>
            </p>
            <ul className={styles.felder} aria-labelledby={`bereich-${area.id}`}>
              {list.map((c) => {
                const f = field(c)
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      className={`${styles.feld} ${styles[`stand_${f.state}`] ?? ""}`}
                      aria-label={`${c.id} ${c.title}: ${f.detail}. Details öffnen`}
                      onClick={() => setOpen(c)}
                    >
                      <span className={styles.feldNr}>{c.id}</span>
                      <span className={styles.feldTitel} aria-hidden="true">
                        {c.title}
                      </span>
                      <span className={styles.feldStand} aria-hidden="true">
                        {f.sign} {f.word}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        )
      })}

      {open && detail && (
        <Dialog title={`${open.id} ${open.title}`} kicker={AREAS.find((a) => a.id === open.area)?.title} onEscape={() => setOpen(null)}>
          <p>{open.summary}</p>
          <dl className="stack">
            {props.kind === "attempt" && (
              <div>
                <dt>
                  <strong>In diesem Versuch</strong>
                </dt>
                <dd>
                  {detail.sign} {detail.detail}
                  {attemptEntry?.positions && attemptEntry.positions.length > 0 && (
                    <ul className={styles.liste}>
                      {attemptEntry.positions.map((p) => (
                        <li key={p.position}>
                          Frage {p.position}: {p.correct === true ? "✓ richtig" : p.correct === false ? "✗ falsch" : "○ nicht bewertet"}
                        </li>
                      ))}
                    </ul>
                  )}
                </dd>
              </div>
            )}
            {(props.kind === "mastery" || masteryById.size > 0) && (
              <div>
                <dt>
                  <strong>Beherrschung über alle Versuche</strong>
                </dt>
                <dd>{masteryText(masteryById.get(open.id))}</dd>
              </div>
            )}
            <div>
              <dt>
                <strong>Stationen im Lernpfad</strong>
              </dt>
              <dd>
                <ul className={styles.liste}>
                  {open.stations.map((slug) => {
                    const info = props.stations?.[slug]
                    const label = `Station ${stationNumber(slug)}${info ? ` ${info.title}` : ""}`
                    return (
                      <li key={slug}>
                        {info && !info.available ? (
                          <span>
                            {label} <span className={styles.leise}>(folgt)</span>
                          </span>
                        ) : (
                          <a href={stationHref(slug)} target="_blank" rel="noopener noreferrer">
                            {label} <span className="sr-only">(öffnet in neuem Tab)</span>
                          </a>
                        )}
                      </li>
                    )
                  })}
                </ul>
              </dd>
            </div>
            <div>
              <dt>
                <strong>Swiss ICB</strong>
              </dt>
              <dd>
                ab Seite {open.icbPage} · {open.kciCount} Indikatoren
              </dd>
            </div>
          </dl>
          <div className={styles.dialogKnoepfe}>
            <a className="btn primary" href={trainingHref(open.id)}>
              Diese Kompetenz trainieren
            </a>
            <button type="button" className="btn" onClick={() => setOpen(null)}>
              Schliessen
            </button>
          </div>
        </Dialog>
      )}
    </div>
  )
}
