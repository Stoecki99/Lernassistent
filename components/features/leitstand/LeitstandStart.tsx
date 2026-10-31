// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

"use client"

// components/features/leitstand/LeitstandStart.tsx
// Startseite (4.8): je Szenario Start, Weiterspielen, Bestwert und letzte Läufe.
// Ein neuer Start bricht einen laufenden Lauf ab (4.5 «nach Rückfrage»).

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import styles from "@/app/(leitstand)/leitstand.module.css"
import { leitstandApi, type RunListResponse } from "./api"
import { chf } from "./format"
import Dialog from "./Dialog"

export interface ScenarioMeta {
  id: string
  slug: "einfuehrung" | "ernstfall"
  label: string
  title: string
  kind: "intro" | "main"
  days: number
  tasks: number
  people: number
  events: number
  budget: number
  periods: string[]
}

const STATUS_TEXT: Record<string, string> = {
  aktiv: "läuft",
  abgeschlossen: "abgeschlossen",
  abgebrochen: "abgebrochen",
  veraltet: "veraltet",
}

function Sterne({ n }: { n: number }) {
  return (
    <span className={styles.sterneKlein} aria-label={`${n} von 3 Sternen`}>
      {[1, 2, 3].map((i) => (
        <span key={i} aria-hidden="true" className={i <= n ? styles.sternAn : styles.sternAus}>
          ★
        </span>
      ))}
    </span>
  )
}

export default function LeitstandStart({ scenarios, start }: { scenarios: ScenarioMeta[]; start: "einfuehrung" | "ernstfall" | null }) {
  const router = useRouter()
  const [lists, setLists] = useState<Record<string, RunListResponse | null>>({})
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<ScenarioMeta | null>(null)
  const [autoStarted, setAutoStarted] = useState(false)

  useEffect(() => {
    let cancelled = false
    Promise.all(scenarios.map((s) => leitstandApi.listRuns(s.id).then((r) => [s.id, r] as const)))
      .then((entries) => {
        if (!cancelled) setLists(Object.fromEntries(entries))
      })
      .catch((e: unknown) => {
        console.error("[leitstand]", e)
        if (!cancelled) setError("Die Läufe konnten nicht geladen werden. Bitte die Seite neu laden.")
      })
    return () => {
      cancelled = true
    }
  }, [scenarios])

  const create = useCallback(
    async (s: ScenarioMeta, repeatOfRunId?: string) => {
      setBusy(s.id)
      setError(null)
      try {
        const res = await leitstandApi.createRun(s.id, repeatOfRunId)
        router.push(`/leitstand/${res.id}`)
      } catch (e) {
        console.error("[leitstand]", e)
        setError("Der Lauf konnte nicht gestartet werden.")
        setBusy(null)
      }
    },
    [router]
  )

  function startNew(s: ScenarioMeta) {
    const active = lists[s.id]?.runs.find((r) => r.status === "aktiv")
    if (active) setConfirm(s)
    else void create(s)
  }

  // ?start=einfuehrung|ernstfall aus Station 23: ohne laufenden Lauf direkt starten, sonst zum Weiterspielen hinführen
  useEffect(() => {
    if (!start || autoStarted) return
    const s = scenarios.find((x) => x.slug === start)
    const list = s ? lists[s.id] : undefined
    if (!s || list === undefined) return
    setAutoStarted(true)
    const active = list?.runs.find((r) => r.status === "aktiv")
    if (!active) void create(s)
    else document.getElementById(`weiter-${s.id}`)?.focus()
  }, [start, autoStarted, scenarios, lists, create])

  return (
    <>
      {error && (
        <p className={styles.fehlerText} role="alert">
          ■ {error}
        </p>
      )}
      <div className={styles.startRaster}>
        {scenarios.map((s) => {
          const list = lists[s.id]
          const active = list?.runs.find((r) => r.status === "aktiv")
          const finished = list?.runs.filter((r) => r.status === "abgeschlossen") ?? []
          return (
            <article key={s.id} className={`card stack ${styles.szenarioKarte} ${s.kind === "main" ? styles.ernstfall : ""}`} aria-labelledby={`sz-${s.id}`}>
              <p className="eyebrow">{s.label}</p>
              <h2 id={`sz-${s.id}`}>{s.title}</h2>
              <p className="hint">
                {s.kind === "intro"
                  ? "Kurzes Übungsprojekt mit eingeblendeten Hinweisen. Ideal, um die Bedienung zu lernen."
                  : "Das Hauptprojekt: Realisierung und Einführung, Statusbericht an den Gemeinderat, Abschlussbericht."}
              </p>
              <ul className={styles.fakten}>
                <li>
                  <strong>{s.days}</strong> Tage Terminziel
                </li>
                <li>
                  <strong>{s.tasks}</strong> Vorgänge
                </li>
                <li>
                  <strong>{s.people}</strong> Personen
                </li>
                <li>
                  <strong>{chf(s.budget)}</strong> Kredit
                </li>
              </ul>
              <p className="hint">{s.periods.join(" · ")}</p>

              {list === undefined ? (
                <p className="hint" role="status">
                  Läufe werden geladen …
                </p>
              ) : (
                <>
                  {list?.best && (
                    <p className={styles.bestwert}>
                      Bestwert <strong>{list.best.score}</strong> Punkte <Sterne n={list.best.stars} />
                    </p>
                  )}
                  <div className="row">
                    {active && (
                      <a id={`weiter-${s.id}`} className="btn primary" href={`/leitstand/${active.id}`}>
                        Weiterspielen{active.summary ? ` (Tag ${active.summary.tag})` : ""}
                      </a>
                    )}
                    <button type="button" className={`btn ${active ? "" : "primary"}`} disabled={busy !== null} onClick={() => startNew(s)}>
                      {busy === s.id ? "Wird gestartet …" : active ? "Neu beginnen" : `${s.label} starten`}
                    </button>
                  </div>
                  {list && list.runs.length > 0 && (
                    <details className={styles.laeufe}>
                      <summary>Letzte Läufe ({list.runs.length})</summary>
                      <ul className={styles.liste}>
                        {list.runs.slice(0, 8).map((r) => (
                          <li key={r.id} className={styles.laufZeile}>
                            <span>
                              {new Date(r.createdAt).toLocaleDateString("de-CH")} · {STATUS_TEXT[r.status] ?? r.status}
                              {r.score !== null ? ` · ${r.score} Punkte` : r.summary ? ` · Tag ${r.summary.tag}` : ""}
                              {r.seedReused ? " · Wiederholung" : ""}
                            </span>
                            {(r.status === "abgeschlossen" || r.status === "aktiv") && (
                              <a className={`btn ${styles.klein}`} href={`/leitstand/${r.id}`}>
                                {r.status === "aktiv" ? "Öffnen" : "Nachbesprechung"}
                              </a>
                            )}
                            {r.status === "abgeschlossen" && (
                              <button type="button" className={`btn ${styles.klein}`} disabled={busy !== null} onClick={() => void create(s, r.id)}>
                                Gleich wiederholen
                              </button>
                            )}
                          </li>
                        ))}
                      </ul>
                      {finished.length > 0 && <p className="hint">Wiederholungen mit gleichem Zufall zählen nicht für Bestwert und Abzeichen.</p>}
                    </details>
                  )}
                </>
              )}
            </article>
          )
        })}
      </div>

      {confirm && (
        <Dialog title="Laufenden Lauf abbrechen?" onEscape={() => setConfirm(null)}>
          <p>
            Du hast im {confirm.label} einen laufenden Lauf. Ein neuer Start bricht ihn ab; er lässt sich danach nicht mehr fortsetzen.
          </p>
          <div className={styles.dialogKnoepfe}>
            <button
              type="button"
              className="btn primary"
              onClick={() => {
                const s = confirm
                setConfirm(null)
                void create(s)
              }}
            >
              Ja, neu beginnen
            </button>
            <button type="button" className="btn" onClick={() => setConfirm(null)}>
              Abbrechen
            </button>
          </div>
        </Dialog>
      )}
    </>
  )
}
