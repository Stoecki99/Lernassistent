// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

"use client"

// components/features/ipma/AiAssessment.tsx
// Claude-Bewertung einer offenen Antwort (Spezifikation 4.2, 4.3, 6.8 AiAssessment): Knopf erst nach der
// Selbstbewertung, Ladezustand, Vergleich Selbst/Claude je Kriterium mit Begründung.
// Free-Konten: kurzer Hinweis statt Anfrage (Zugang 5), «Mehr erfahren» öffnet den Upgrade-Hinweis.
// Fehler der Route (502 AI_UNAVAILABLE/AI_INVALID/AI_REFUSED, 429 BUDGET/DAILY_LIMIT) zeigen die Meldung des
// Servers; nach «failed» ist ein neuer Versuch möglich. «Alle bewerten» steht in AiAssessAll.
// Während der Anfrage aria-disabled (Fokus bleibt), danach Fokus auf den Titel des Vergleichs; onRunningChange
// meldet die laufende Bewertung, damit die Seite «Abschliessen» so lange sperrt.

import type { SolvedItem } from "@/lib/ipma/types"
import { useEffect, useRef, useState } from "react"
import styles from "@/app/(ipma)/ipma.module.css"
import Dialog from "@/components/features/leitstand/Dialog"
import UpgradePrompt from "@/components/features/UpgradePrompt"
import { ipmaApi, errorMessage } from "./api"
import { score } from "./format"

export default function AiAssessment({
  attemptId,
  item,
  canUseAi,
  allowed,
  onSaved,
  onAnnounce,
  onRunningChange,
}: {
  attemptId: string
  item: SolvedItem
  canUseAi: boolean
  /** Bewertung jetzt möglich (Versuch abgegeben bzw. Training aktiv) */
  allowed: boolean
  onSaved: (item: SolvedItem) => void
  onAnnounce?: (text: string) => void
  /** true beim Start, false am Ende einer Bewertung */
  onRunningChange?: (running: boolean) => void
}) {
  const [busy, setBusy] = useState(false)
  const titleRef = useRef<HTMLHeadingElement>(null)
  const focusTitle = useRef(false)
  const runningRef = useRef(onRunningChange)
  runningRef.current = onRunningChange
  const done = item.aiStatus === "done"

  // Nach der Bewertung ersetzt der Vergleich den Knopf: Fokus auf dessen Titel
  useEffect(() => {
    if (!done || !focusTitle.current) return
    focusTitle.current = false
    titleRef.current?.focus()
  }, [done])

  // Verlässt die Ansicht während einer Bewertung (z. B. Fragenwechsel), die Sperre trotzdem lösen
  const busyRef = useRef(false)
  useEffect(
    () => () => {
      if (busyRef.current) runningRef.current?.(false)
    },
    [],
  )

  const [message, setMessage] = useState<string | null>(null)
  const [proHint, setProHint] = useState(false)
  const [upgrade, setUpgrade] = useState(false)
  const rubric = item.rubric ?? []
  const empty = (item.text ?? "").trim() === ""
  if (empty || item.type !== "offen") return null

  const feedback = item.aiStatus === "done" ? item.aiFeedback : null
  const selfDone = item.selfScores.length > 0

  async function assess() {
    if (!canUseAi) {
      setProHint(true)
      return
    }
    setBusy(true)
    busyRef.current = true
    runningRef.current?.(true)
    setMessage(null)
    onAnnounce?.("Claude bewertet deine Antwort …")
    try {
      const next = await ipmaApi.assess(attemptId, item.position)
      focusTitle.current = true
      onSaved(next)
    } catch (e) {
      const text = errorMessage(e, "Die Bewertung durch Claude ist gerade nicht möglich. Deine Selbstbewertung gilt.")
      setMessage(text)
      onAnnounce?.(text)
    } finally {
      setBusy(false)
      busyRef.current = false
      runningRef.current?.(false)
    }
  }

  return (
    <div className="stack">
      {feedback ? (
        <div className="stack">
          <h4 ref={titleRef} tabIndex={-1}>
            Vergleich: Selbst und Claude
          </h4>
          <div className="tablebox">
            <table className={`tabelle ${styles.claudeTabelle}`}>
              <thead>
                <tr>
                  <th scope="col">Kriterium</th>
                  <th scope="col" className="zahl">
                    Selbst
                  </th>
                  <th scope="col" className="zahl">
                    Claude
                  </th>
                  <th scope="col">Begründung</th>
                </tr>
              </thead>
              <tbody>
                {rubric.map((r, i) => {
                  const k = feedback.kriterien.find((x) => x.nummer === i + 1)
                  return (
                    <tr key={i}>
                      <th scope="row">
                        {i + 1}. {r.criterion}
                      </th>
                      <td className="zahl">
                        {item.selfScores[i] !== undefined ? score(item.selfScores[i]) : "–"} / {score(r.points)}
                      </td>
                      <td className="zahl">
                        {item.aiScores[i] !== undefined ? score(item.aiScores[i]) : k ? score(k.punkte) : "–"} / {score(r.points)}
                      </td>
                      <td>{k?.begruendung ?? ""}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {feedback.gesamtkommentar && <p>{feedback.gesamtkommentar}</p>}
          {feedback.verdacht && (
            <p className={`${styles.meldung} ${styles.meldungWarn}`}>Deine Antwort enthält Anweisungen an die Bewertung; diese wurden ignoriert.</p>
          )}
          <p className="hint">Die Bewertung durch Claude ist massgebend; deine Selbstbewertung steht daneben.</p>
        </div>
      ) : (
        allowed && (
          <div className="stack">
            <div className="row">
              <button
                type="button"
                className="btn"
                disabled={!selfDone}
                aria-disabled={busy || item.aiStatus === "pending" || undefined}
                onClick={() => {
                  if (!busy && item.aiStatus !== "pending") void assess()
                }}
              >
                {busy || item.aiStatus === "pending" ? "Claude bewertet …" : "Von Claude bewerten lassen"}
              </button>
              {!selfDone && <span className="hint">Zuerst selbst bewerten, dann vergleichen.</span>}
            </div>
            <div aria-live="polite">
              {proHint && (
                <p className={styles.meldung}>
                  Die Bewertung durch Claude ist im Pro-Abo enthalten. Deine Selbstbewertung gilt.{" "}
                  <button type="button" className={`btn ${styles.klein}`} onClick={() => setUpgrade(true)}>
                    Mehr erfahren
                  </button>
                </p>
              )}
              {message && <p className={styles.meldung}>{message}</p>}
            </div>
          </div>
        )
      )}
      {upgrade && (
        <Dialog title="Bewertung durch Claude" onEscape={() => setUpgrade(false)} wide>
          <UpgradePrompt
            title="Claude-Bewertung freischalten"
            description="Mit Pro bewertet Claude deine offenen Antworten nach demselben Raster und begründet jedes Kriterium. Der Prüfungssimulator selbst mit Selbstbewertung bleibt für alle kostenlos."
          />
          <div className={styles.dialogKnoepfe}>
            <button type="button" className="btn" onClick={() => setUpgrade(false)}>
              Schliessen
            </button>
          </div>
        </Dialog>
      )}
    </div>
  )
}
