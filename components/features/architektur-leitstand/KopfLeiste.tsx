// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

"use client"

// components/features/architektur-leitstand/KopfLeiste.tsx
// Zeitsteuerung: Minute mit Fortschrittsbalken (Ereignisse ab Beginn sichtbar), Start/Pause, Tempo 1×/2×/4×,
// «Minute vor», Speicherstand. 1× = 1 Sekunde je simulierte Minute.

import type { Mission, Zustand } from "@/lib/archsim"
import styles from "@/app/(architektur-leitstand)/architektur-leitstand.module.css"
import type { SyncStatus } from "./useLaufSync"

export type Tempo = 0 | 1 | 2 | 4

export const TAKT_MS: Record<Exclude<Tempo, 0>, number> = { 1: 1000, 2: 500, 4: 250 }

const SYNC_TEXT: Record<SyncStatus, string> = {
  gespeichert: "gespeichert",
  ausstehend: "wird gespeichert …",
  speichert: "speichert …",
  offline: "nicht gespeichert, neuer Versuch folgt",
  fehler: "Speicherfehler",
  abgemeldet: "Anmeldung abgelaufen",
}
const ANGESAGT: ReadonlySet<SyncStatus> = new Set<SyncStatus>(["fehler", "offline", "abgemeldet"])

export default function KopfLeiste({
  mission,
  zustand,
  tempo,
  setTempo,
  laeuft,
  onSchritt,
  syncStatus,
  kuerzel,
  gesperrt,
}: {
  mission: Mission
  zustand: Zustand
  tempo: Tempo
  setTempo: (t: Tempo) => void
  laeuft: boolean
  onSchritt: () => void
  syncStatus: SyncStatus
  kuerzel: boolean
  gesperrt: boolean
}) {
  const beendet = zustand.phase === "beendet"
  const anteil = Math.min(1, zustand.tick / mission.dauer)
  const sichtbar = mission.ereignisse.filter((e) => {
    const s = zustand.ereignisse[e.id]?.status
    return s && s !== "geplant"
  })
  const aktiv = sichtbar.filter((e) => zustand.ereignisse[e.id]?.status === "aktiv")
  const phase = beendet ? "Mission beendet" : zustand.phase === "bereit" ? "Vorbereitung: Massnahmen wirken sofort" : laeuft ? "Zeit läuft" : "Pause"

  return (
    <div className={styles.kopf}>
      <div className={styles.uhr}>
        <span className={styles.uhrZahl}>
          <span className="sr-only">Minute </span>
          {zustand.tick}
          <small> / {mission.dauer} min</small>
        </span>
        <span className={`${styles.phase} ${laeuft ? styles.phaseLaeuft : ""}`}>
          <span aria-hidden="true">{laeuft ? "●" : beendet ? "■" : "❚❚"}</span> {phase}
        </span>
      </div>

      <div className={styles.zeitleiste} role="img" aria-label={`Fortschritt ${Math.round(anteil * 100)} Prozent${aktiv.length ? `, aktiv: ${aktiv.map((e) => e.titel).join(", ")}` : ""}`}>
        <div className={styles.zeitFuellung} style={{ width: `${anteil * 100}%` }} />
        {sichtbar.map((e) => (
          <span
            key={e.id}
            className={`${styles.zeitEreignis} ${zustand.ereignisse[e.id]?.status === "aktiv" ? styles.zeitEreignisAktiv : ""}`}
            style={{ left: `${(e.tick / mission.dauer) * 100}%`, width: `${(Math.min(e.dauer, mission.dauer - e.tick) / mission.dauer) * 100}%` }}
            title={e.titel}
          />
        ))}
      </div>

      {!beendet && (
        <div className={styles.tempo} role="group" aria-label="Zeitsteuerung">
          <button
            type="button"
            className={`btn ${zustand.phase === "bereit" || tempo === 0 ? "primary" : ""} ${styles.play}`}
            onClick={() => setTempo(tempo === 0 ? 1 : 0)}
            disabled={gesperrt}
            aria-keyshortcuts={kuerzel ? "Space" : undefined}
          >
            <span aria-hidden="true">{tempo === 0 ? "▶" : "❚❚"}</span> {tempo === 0 ? (zustand.phase === "bereit" ? "Lasttest starten" : "Weiter") : "Pause"}
          </button>
          {[1, 2, 4].map((t) => (
            <button
              key={t}
              type="button"
              className={`btn ${styles.tempoKnopf} ${tempo === t ? styles.tempoAn : ""}`}
              aria-pressed={tempo === t}
              onClick={() => setTempo(t as Tempo)}
              disabled={gesperrt}
              aria-keyshortcuts={kuerzel ? String(t) : undefined}
              aria-label={`Tempo ${t}-fach`}
            >
              {t}×
            </button>
          ))}
          <button type="button" className={`btn ${styles.tempoKnopf}`} onClick={onSchritt} disabled={gesperrt || laeuft} aria-keyshortcuts={kuerzel ? "N" : undefined}>
            +1 min
          </button>
        </div>
      )}

      <span className={`${styles.sync} ${styles[`sync_${syncStatus}`]}`}>
        <span aria-hidden="true">{syncStatus === "gespeichert" ? "✓" : syncStatus === "fehler" || syncStatus === "abgemeldet" ? "■" : "…"}</span> {SYNC_TEXT[syncStatus]}
      </span>
      <span className="sr-only" aria-live="polite">
        {ANGESAGT.has(syncStatus) ? SYNC_TEXT[syncStatus] : ""}
      </span>
    </div>
  )
}
