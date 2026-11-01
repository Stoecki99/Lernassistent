// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

"use client"

// components/features/leitstand/Auslastung.tsx
// Auslastung je Person und Woche (4.8) aus dem Verlauf der bezahlten Projektstunden; Kennzahl Ressourcenausgleich (3.10).

import styles from "@/app/(leitstand)/leitstand.module.css"
import { useLeitstand } from "./context"
import { pct } from "./format"
import AuslastungsDiagramm, { type AuslastungsZeile } from "./charts/AuslastungsDiagramm"
import type { Trace } from "./logic"

const TICKS_PER_WEEK = 10

/** Kumulierte Stunden nach `tick` abgeschlossenen Takten (letzter Eintrag ≤ tick). */
function hoursAt(trace: Trace, personId: string, tick: number): number {
  const series = trace.hours[personId] ?? []
  let value = 0
  for (let i = 0; i < trace.ticks.length; i++) {
    if (trace.ticks[i] > tick) break
    value = series[i] ?? value
  }
  return value
}

export default function Auslastung() {
  const { state, scenario, trace, kpis } = useLeitstand()
  const now = state.tick
  const weekCount = Math.max(1, Math.ceil(Math.max(now, 1) / TICKS_PER_WEEK))
  const people = scenario.people.filter((p) => state.people[p.id]?.available || (!p.hidden && state.people[p.id]))
  const rows: AuslastungsZeile[] = people.map((p) => ({
    personId: p.id,
    name: p.name,
    weeks: Array.from({ length: weekCount }, (_, w) => {
      const from = w * TICKS_PER_WEEK
      const to = Math.min(now, (w + 1) * TICKS_PER_WEEK)
      if (to <= from) return null
      const hours = hoursAt(trace, p.id, to) - hoursAt(trace, p.id, from)
      const days = (to - from) / 2
      return (hours / Math.max(1e-9, 8 * p.pensum * days)) * 100
    }),
  }))
  const assigned = people.filter((p) => state.people[p.id].assignments.length > 0)

  return (
    <div className={styles.ansicht}>
      <div className={styles.raster2}>
        <div className="card stack">
          <h3>Ressourcenausgleich</h3>
          <p className={styles.grossZahl}>{pct(kpis.ressourcenausgleich)}</p>
          <p className="hint">Anteil der Personentage mit einer Auslastung zwischen 50 % und 100 % des Pensums.</p>
        </div>
        <div className="card stack">
          <h3>Belegung jetzt</h3>
          <ul className={styles.liste}>
            {assigned.map((p) => (
              <li key={p.id}>
                {p.name}: {state.people[p.id].assignments.length} Zuweisung(en), Pensum {Math.round(p.pensum * 100)} %
                {state.people[p.id].overtime > 0 ? ` · Überstunden +${state.people[p.id].overtime * 20} %` : ""}
              </li>
            ))}
            {assigned.length === 0 && <li className="hint">Noch niemand zugewiesen.</li>}
          </ul>
        </div>
      </div>
      <div className="card stack">
        <h3>Auslastung je Woche</h3>
        {now === 0 ? (
          <p className="hint">Die Auslastung erscheint, sobald die Zeit läuft.</p>
        ) : (
          <>
            <AuslastungsDiagramm rows={rows} weekCount={weekCount} />
            <p className={styles.legende}>
              <span className={styles.legendeIst}>bis 100 %</span>
              <span className={styles.legendeUeber}>über 100 % (schraffiert, Überstunden)</span>
              <span className={styles.legendeUnter}>unter 50 % (Leerlauf)</span>
            </p>
          </>
        )}
      </div>
    </div>
  )
}
