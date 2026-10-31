// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

"use client"

// components/features/leitstand/KopfLeiste.tsx
// Uhr, Zeitraffer (Pause · 1× = 8 s je Halbtag · 2× · 4×), Periode, Posteingang, Speicherstand (4.8).

import { formatTick, formatTickShort } from "@/lib/simulation"
import styles from "@/app/(leitstand)/leitstand.module.css"
import { useLeitstand } from "./context"
import type { SyncStatus } from "./useRunSync"

export type Speed = 0 | 1 | 2 | 4

export const TICK_MS: Record<Exclude<Speed, 0>, number> = { 1: 8000, 2: 4000, 4: 2000 }

const SYNC_TEXT: Record<SyncStatus, string> = {
  gespeichert: "gespeichert",
  ausstehend: "wird gespeichert …",
  speichert: "speichert …",
  offline: "nicht gespeichert, neuer Versuch folgt",
  fehler: "Speicherfehler",
}

export default function KopfLeiste({
  speed,
  setSpeed,
  running,
  blockedByEvent,
  syncStatus,
}: {
  speed: Speed
  setSpeed: (s: Speed) => void
  running: boolean
  blockedByEvent: boolean
  syncStatus: SyncStatus
}) {
  const { state, scenario, setView, kpis } = useLeitstand()
  const open = state.inbox.filter((i) => i.status === "neu" || i.status === "aufgeschoben").length
  const fresh = state.inbox.filter((i) => i.status === "neu").length
  const periods = scenario.calendar.periods
  const period = periods[Math.min(state.period, periods.length - 1)]
  const daysLeft = period ? Math.max(0, (period.endTick + 1) / 2 - state.tick / 2) : 0
  const reportWord = period?.report === "status" ? "Statusbericht" : "Abschlussbericht"
  const isLauf = state.phase === "lauf"
  const phaseText: Record<string, string> = {
    planung: "Planung",
    lauf: blockedByEvent ? "Zeit angehalten: Ereignis" : speed === 0 ? "Pause" : "Zeit läuft",
    periodenende: "Periodenende",
    abschlussbericht: "Projektende",
    abgeschlossen: "Abgeschlossen",
  }

  return (
    <div className={styles.kopf}>
      <div className={styles.uhr}>
        <span className={styles.uhrLang}>{formatTick(state.tick)}</span>
        <span className={styles.uhrKurz} aria-hidden="true">
          {formatTickShort(state.tick)}
        </span>
        <span className={styles.phaseText}>{phaseText[state.phase]}</span>
      </div>

      {isLauf ? (
        <div className={styles.tempo} role="group" aria-label="Zeitraffer">
          <button
            type="button"
            className={`btn ${styles.playKnopf} ${speed > 0 ? "on" : ""}`}
            onClick={() => setSpeed(speed === 0 ? 1 : 0)}
            aria-label={speed === 0 ? "Zeit starten (Leertaste)" : "Pause (Leertaste)"}
            aria-keyshortcuts="Space"
            disabled={blockedByEvent}
          >
            <span aria-hidden="true">{speed === 0 ? "▶" : "⏸"}</span>
          </button>
          <div className={styles.tempoKnoepfe}>
            {([1, 2, 4] as const).map((s) => (
              <button
                key={s}
                type="button"
                className={`btn ${styles.tempoKnopf} ${speed === s ? "on" : ""}`}
                aria-pressed={speed === s}
                aria-keyshortcuts={String(s)}
                onClick={() => setSpeed(s)}
                disabled={blockedByEvent}
              >
                {s}×
              </button>
            ))}
          </div>
          <label className={styles.tempoAuswahl}>
            <span className="sr-only">Tempo</span>
            <select
              className="btn"
              value={speed}
              onChange={(e) => setSpeed(Number(e.target.value) as Speed)}
              disabled={blockedByEvent}
            >
              <option value={0}>Pause</option>
              <option value={1}>1×</option>
              <option value={2}>2×</option>
              <option value={4}>4×</option>
            </select>
          </label>
        </div>
      ) : (
        <div className={styles.tempo} />
      )}

      <div className={styles.periode}>
        <span>
          {period?.label ?? "Projekt"}
          {state.phase === "lauf" || state.phase === "planung" ? (
            <span className={styles.periodeRest}>
              {" "}
              · {reportWord} in {Math.ceil(daysLeft)} {Math.ceil(daysLeft) === 1 ? "Tag" : "Tagen"}
            </span>
          ) : null}
        </span>
        <span className={styles.periodeRest}>Prognose Tag {kpis.forecastEndDay.toFixed(1)} · Ziel {scenario.calendar.targetDay}</span>
      </div>

      <button
        type="button"
        className={`btn ${styles.postKnopf} ${fresh > 0 ? styles.postNeu : ""}`}
        onClick={() => setView("posteingang")}
        aria-keyshortcuts="P"
        aria-label={`Posteingang: ${open} offen${fresh > 0 ? `, ${fresh} neu` : ""}`}
      >
        <span aria-hidden="true">✉</span>
        <span aria-hidden="true">{open}</span>
      </button>

      <span className={`${styles.sync} ${syncStatus === "fehler" || syncStatus === "offline" ? styles.syncFehler : ""}`} role="status">
        <span aria-hidden="true">{syncStatus === "gespeichert" ? "✓" : syncStatus === "fehler" ? "!" : "…"}</span> {SYNC_TEXT[syncStatus]}
      </span>

      {running && speed > 0 && (
        <div className={styles.taktBalken} aria-hidden="true">
          <span key={`${state.tick}-${speed}`} style={{ animationDuration: `${TICK_MS[speed as 1 | 2 | 4]}ms` }} />
        </div>
      )}
    </div>
  )
}
