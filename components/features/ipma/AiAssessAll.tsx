// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

"use client"

// components/features/ipma/AiAssessAll.tsx
// «Alle offenen Antworten bewerten» in der Auswertung einer abgegebenen Prüfung (Spezifikation 4.2, AP5):
// arbeitet die selbst bewerteten, noch nicht von Claude bewerteten Antworten nacheinander ab, mit Fortschritt
// und «Anhalten». Der Vergleich Selbst/Claude erscheint je Frage in AiAssessment.
// Stopp bei Monatsdeckel, Tageszähler oder fehlendem Pro; beim Rate-Limit (10/min) eine Pause, dann weiter.
// Während des Durchlaufs aria-disabled (Fokus bleibt), am Ende Fokus auf die Zusammenfassung; onRunningChange
// meldet den Durchlauf, damit die Seite «Abschliessen» so lange sperrt.

import type { SolvedItem } from "@/lib/ipma/types"
import { useEffect, useRef, useState } from "react"
import styles from "@/app/(ipma)/ipma.module.css"
import { IpmaApiError, errorMessage, ipmaApi } from "./api"

/** Pause nach einem 429 des Rate-Limits ohne Retry-After */
const RATE_PAUSE_MS = 60_000

function isCandidate(item: SolvedItem): boolean {
  return (
    item.type === "offen" &&
    (item.text ?? "").trim() !== "" &&
    item.selfScores.length > 0 &&
    (item.aiStatus === "none" || item.aiStatus === "failed")
  )
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

export default function AiAssessAll({
  attemptId,
  items,
  canUseAi,
  onItem,
  onDone,
  onAnnounce,
  onRunningChange,
}: {
  attemptId: string
  /** Beantwortete offene Fragen der Prüfung */
  items: SolvedItem[]
  canUseAi: boolean
  onItem: (item: SolvedItem) => void
  /** Nach dem Durchlauf (vorläufiges Ergebnis neu laden) */
  onDone: () => void
  onAnnounce?: (text: string) => void
  /** true beim Start, false am Ende des Durchlaufs */
  onRunningChange?: (running: boolean) => void
}) {
  const summaryRef = useRef<HTMLParagraphElement>(null)
  const focusSummary = useRef(false)
  const runningRef = useRef(onRunningChange)
  runningRef.current = onRunningChange
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [summary, setSummary] = useState<string | null>(null)
  const [pausing, setPausing] = useState(false)
  const stopRef = useRef(false)

  useEffect(
    () => () => {
      stopRef.current = true
    },
    [],
  )

  useEffect(() => {
    if (summary === null || !focusSummary.current) return
    focusSummary.current = false
    summaryRef.current?.focus()
  }, [summary])

  if (!canUseAi) return null
  const candidates = items.filter(isCandidate)
  const withoutSelf = items.filter((i) => i.selfScores.length === 0).length
  const running = progress !== null
  if (!running && candidates.length === 0 && summary === null) return null

  async function run() {
    const queue = items.filter(isCandidate)
    if (queue.length === 0) return
    stopRef.current = false
    runningRef.current?.(true)
    setSummary(null)
    setProgress({ done: 0, total: queue.length })
    onAnnounce?.(`Claude bewertet ${queue.length} ${queue.length === 1 ? "Antwort" : "Antworten"} nacheinander.`)
    let ok = 0
    let failed = 0
    let stopMessage: string | null = null

    for (let n = 0; n < queue.length && !stopRef.current; n += 1) {
      const item = queue[n]
      setProgress({ done: n, total: queue.length })
      onItem({ ...item, aiStatus: "pending" })
      let pausedOnce = false
      for (;;) {
        try {
          onItem(await ipmaApi.assess(attemptId, item.position))
          ok += 1
        } catch (e) {
          if (e instanceof IpmaApiError && e.status === 429 && e.code === null && !pausedOnce) {
            // Rate-Limit: einmal warten, dann dieselbe Antwort erneut
            pausedOnce = true
            setPausing(true)
            await wait(e.retryAfterMs ?? RATE_PAUSE_MS)
            setPausing(false)
            if (stopRef.current) {
              onItem(item)
              break
            }
            continue
          }
          if (e instanceof IpmaApiError && e.status === 502) {
            failed += 1
            onItem({ ...item, aiStatus: "failed" })
          } else if (e instanceof IpmaApiError && e.status === 409) {
            // Schon bewertet oder läuft in einem anderen Fenster: überspringen
            onItem(item)
          } else {
            onItem(item)
            stopMessage = errorMessage(e, "Die Bewertung durch Claude ist gerade nicht möglich. Deine Selbstbewertung gilt.")
            stopRef.current = true
          }
        }
        break
      }
    }

    const parts = [`${ok} von ${queue.length} ${queue.length === 1 ? "Antwort" : "Antworten"} von Claude bewertet.`]
    if (failed > 0) parts.push(`${failed} nicht möglich; dort gilt deine Selbstbewertung (erneut versuchen ist möglich).`)
    if (stopMessage) parts.push(`Angehalten: ${stopMessage}`)
    else if (ok + failed < queue.length) parts.push("Angehalten.")
    const text = parts.join(" ")
    setProgress(null)
    setPausing(false)
    // Die Zusammenfassung bekommt den Fokus und wird dabei vorgelesen
    focusSummary.current = true
    setSummary(text)
    runningRef.current?.(false)
    onDone()
  }

  return (
    <div className="stack">
      <div className="row">
        <button
          type="button"
          className="btn"
          disabled={!running && candidates.length === 0}
          aria-disabled={running || undefined}
          onClick={() => {
            if (!running) void run()
          }}
        >
          {running ? "Claude bewertet …" : "Alle offenen Antworten bewerten"}
        </button>
        {running && (
          <button type="button" className="btn" onClick={() => {
              stopRef.current = true
            }}>
            Anhalten
          </button>
        )}
        {!running && candidates.length > 0 && (
          <span className="hint">
            {candidates.length} {candidates.length === 1 ? "Antwort" : "Antworten"} nacheinander von Claude bewerten lassen
            {withoutSelf > 0 ? ` (${withoutSelf} zuerst selbst bewerten)` : ""}.
          </span>
        )}
      </div>
      {running && progress && (
        <div className="stack" role="status">
          <progress max={progress.total} value={progress.done} aria-label="Fortschritt der Bewertung durch Claude" />
          <span className="hint">
            {pausing
              ? "Kurze Pause wegen vieler Anfragen, danach geht es weiter …"
              : `Antwort ${progress.done + 1} von ${progress.total} wird bewertet …`}
          </span>
        </div>
      )}
      {summary && (
        <p className={styles.meldung} ref={summaryRef} tabIndex={-1}>
          {summary}
        </p>
      )}
    </div>
  )
}
