// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

"use client"

// components/features/ipma/AiAssessment.tsx
// Claude-Bewertung einer offenen Antwort (Spezifikation 4.2, 4.3, 6.8 AiAssessment): Knopf erst nach der
// Selbstbewertung, Ladezustand, Vergleich Selbst/Claude je Kriterium mit Begründung.
// Free-Konten: kurzer Hinweis statt Anfrage (Zugang 5), «Mehr erfahren» öffnet den Upgrade-Hinweis.
// Bis AP5 antwortet die Route mit 502 AI_UNAVAILABLE; die Meldung des Servers wird freundlich angezeigt.

import type { SolvedItem } from "@/lib/ipma/types"
import { useState } from "react"
import styles from "@/app/(ipma)/ipma.module.css"
import Dialog from "@/components/features/leitstand/Dialog"
import UpgradePrompt from "@/components/features/UpgradePrompt"
import { ipmaApi, errorMessage } from "./api"

export default function AiAssessment({
  attemptId,
  item,
  canUseAi,
  allowed,
  onSaved,
  onAnnounce,
}: {
  attemptId: string
  item: SolvedItem
  canUseAi: boolean
  /** Bewertung jetzt möglich (Versuch abgegeben bzw. Training aktiv) */
  allowed: boolean
  onSaved: (item: SolvedItem) => void
  onAnnounce?: (text: string) => void
}) {
  const [busy, setBusy] = useState(false)
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
    setMessage(null)
    onAnnounce?.("Claude bewertet deine Antwort …")
    try {
      const next = await ipmaApi.assess(attemptId, item.position)
      onSaved(next)
      onAnnounce?.("Die Bewertung durch Claude ist da.")
    } catch (e) {
      const text = errorMessage(e, "Die Bewertung durch Claude ist gerade nicht möglich. Deine Selbstbewertung gilt.")
      setMessage(text)
      onAnnounce?.(text)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="stack">
      {feedback ? (
        <div className="stack">
          <h4>Vergleich: Selbst und Claude</h4>
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
                        {item.selfScores[i] ?? "–"} / {r.points}
                      </td>
                      <td className="zahl">
                        {item.aiScores[i] ?? k?.punkte ?? "–"} / {r.points}
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
              <button type="button" className="btn" disabled={!selfDone || busy || item.aiStatus === "pending"} onClick={() => void assess()}>
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
