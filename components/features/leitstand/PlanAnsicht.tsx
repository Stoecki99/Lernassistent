// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

"use client"

// components/features/leitstand/PlanAnsicht.tsx
// Plan (4.8): Umschalter Gantt / Netzplan (als Liste mit FA, FE, SA, SE, GP, FP); Basisplan und Prognose.

import { useState } from "react"
import { forecast } from "@/lib/simulation"
import styles from "@/app/(leitstand)/leitstand.module.css"
import { useLeitstand } from "./context"
import GanttDiagramm from "./charts/GanttDiagramm"

export default function PlanAnsicht() {
  const { state, scenario, base } = useLeitstand()
  const [mode, setMode] = useState<"gantt" | "netz">("gantt")
  const [netzBasis, setNetzBasis] = useState<"basis" | "prognose">("prognose")
  const fc = forecast(state, scenario)
  const fcRows = Object.fromEntries(fc.rows.map((r) => [r.taskId, r]))
  const xMax = Math.ceil(Math.max(scenario.calendar.targetDay, fc.endDay, scenario.calendar.planEndDay) + 1)
  const rows = netzBasis === "basis" ? base : fcRows
  const f1 = (x: number) => x.toFixed(1)

  return (
    <div className={styles.ansicht}>
      <div className="row" role="group" aria-label="Darstellung">
        <button type="button" className={`btn ${mode === "gantt" ? "on" : ""}`} aria-pressed={mode === "gantt"} onClick={() => setMode("gantt")}>
          Gantt
        </button>
        <button type="button" className={`btn ${mode === "netz" ? "on" : ""}`} aria-pressed={mode === "netz"} onClick={() => setMode("netz")}>
          Netzplan
        </button>
        <span className="hint">
          Prognose Ende Tag {f1(fc.endDay)} · Basisplan {scenario.calendar.planEndDay} · Ziel {scenario.calendar.targetDay}
        </span>
      </div>

      {mode === "gantt" ? (
        <div className="card stack">
          <p className={styles.legende}>
            <span className={styles.legendePlan}>Basisplan (Umriss)</span>
            <span className={styles.legendeIst}>Prognose bzw. Ist (gefüllt)</span>
            <span className={styles.legendeKritisch}>kritisch (dicker Rand)</span>
          </p>
          <GanttDiagramm
            tasks={scenario.tasks}
            base={base}
            forecastRows={fcRows}
            state={state}
            today={state.tick / 2}
            xMax={xMax}
            targetDay={scenario.calendar.targetDay}
          />
        </div>
      ) : (
        <div className="card stack">
          <div className="row" role="group" aria-label="Netzplan">
            <button
              type="button"
              className={`btn ${netzBasis === "prognose" ? "on" : ""}`}
              aria-pressed={netzBasis === "prognose"}
              onClick={() => setNetzBasis("prognose")}
            >
              Prognose
            </button>
            <button
              type="button"
              className={`btn ${netzBasis === "basis" ? "on" : ""}`}
              aria-pressed={netzBasis === "basis"}
              onClick={() => setNetzBasis("basis")}
            >
              Basisplan
            </button>
          </div>
          <div className="tablebox">
            <table className={`tabelle ${styles.kartenTabelle}`}>
              <caption>
                Netzplan {netzBasis === "basis" ? "Basisplan" : "Prognose"}: Zeitpunkte in Tagen ab Projektstart. FA/FE frühester Anfang/Ende, SA/SE
                spätester Anfang/Ende, GP Gesamtpuffer, FP freier Puffer.
              </caption>
              <thead>
                <tr>
                  <th scope="col">Vorgang</th>
                  <th scope="col">Vorgänger</th>
                  <th scope="col" className="zahl">
                    Dauer
                  </th>
                  <th scope="col" className="zahl">
                    FA
                  </th>
                  <th scope="col" className="zahl">
                    FE
                  </th>
                  <th scope="col" className="zahl">
                    SA
                  </th>
                  <th scope="col" className="zahl">
                    SE
                  </th>
                  <th scope="col" className="zahl">
                    GP
                  </th>
                  <th scope="col" className="zahl">
                    FP
                  </th>
                </tr>
              </thead>
              <tbody>
                {scenario.tasks.map((t) => {
                  const r = rows[t.id]
                  if (!r) return null
                  return (
                    <tr key={t.id} className={r.critical ? styles.kritisch : undefined}>
                      <th scope="row" data-label="Vorgang">
                        <span className={styles.vorgangId}>{t.id}</span> {t.name}
                        {r.critical && <span className={styles.kritischText}>kritisch</span>}
                      </th>
                      <td data-label="Vorgänger">{t.predecessors.join(", ") || "–"}</td>
                      <td data-label="Dauer" className="zahl">
                        {f1(r.duration)}
                      </td>
                      <td data-label="FA" className="zahl">
                        {f1(r.es)}
                      </td>
                      <td data-label="FE" className="zahl">
                        {f1(r.ef)}
                      </td>
                      <td data-label="SA" className="zahl">
                        {f1(r.ls)}
                      </td>
                      <td data-label="SE" className="zahl">
                        {f1(r.lf)}
                      </td>
                      <td data-label="GP" className="zahl">
                        {f1(r.totalFloat)}
                      </td>
                      <td data-label="FP" className="zahl">
                        {f1(r.freeFloat)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
