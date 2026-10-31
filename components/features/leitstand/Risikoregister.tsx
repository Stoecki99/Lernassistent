// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

"use client"

// components/features/leitstand/Risikoregister.tsx
// Risikoregister (4.8, 3.9): Reiter Identifizieren / Bewerten (5×5-Matrix) / Massnahmen / Überwachen; Knopf «Register geprüft».

import { useState } from "react"
import { dayOf, type RiskDef } from "@/lib/simulation"
import styles from "@/app/(leitstand)/leitstand.module.css"
import { personName, useLeitstand } from "./context"
import { chf, pct } from "./format"
import RisikoMatrix from "./charts/RisikoMatrix"

type Tab = "identifizieren" | "bewerten" | "massnahmen" | "ueberwachen"
const TABS: Array<[Tab, string]> = [
  ["identifizieren", "Identifizieren"],
  ["bewerten", "Bewerten"],
  ["massnahmen", "Massnahmen"],
  ["ueberwachen", "Überwachen"],
]
const STRATEGY: Record<string, string> = { vermeiden: "vermeiden", vermindern: "vermindern", uebertragen: "übertragen", akzeptieren: "akzeptieren" }
const STATUS: Record<string, string> = { offen: "offen", eingetreten: "eingetreten", vorbei: "vorbei" }

export default function Risikoregister() {
  const { state, scenario, kpis, run, readOnly } = useLeitstand()
  const [tab, setTab] = useState<Tab>("bewerten")
  const [cell, setCell] = useState<{ w: number; a: number } | null>(null)
  const visible = scenario.risks.filter((r) => state.risks[r.id]?.visible)
  const week = Math.floor(dayOf(state.tick) / 5)
  const reviewedThisWeek = state.stats.riskReviewedWeeks.includes(week)
  const canAct = !readOnly && (state.phase === "planung" || state.phase === "lauf" || state.phase === "periodenende")
  const open = visible.filter((r) => state.risks[r.id].status === "offen")
  const inCell = cell ? open.filter((r) => state.risks[r.id].probability === cell.w && state.risks[r.id].impact === cell.a) : []

  return (
    <div className={styles.ansicht}>
      <div className={`card ${styles.zeileZwischen}`}>
        <div>
          <h3>Risiko-Index {pct(kpis.rmi)}</h3>
          <p className="hint">
            {reviewedThisWeek ? "● Diese Woche geprüft." : "▲ Diese Woche noch nicht geprüft."} Geprüfte Wochen: {state.stats.riskReviewedWeeks.length}
          </p>
        </div>
        <button type="button" className="btn primary" disabled={!canAct || reviewedThisWeek} onClick={() => run({ type: "riskReview" })}>
          {reviewedThisWeek ? "Register geprüft ✓" : "Register geprüft"}
        </button>
      </div>

      <div className="row" role="group" aria-label="Reiter des Risikoregisters">
        {TABS.map(([key, label]) => (
          <button key={key} type="button" className={`btn ${tab === key ? "on" : ""}`} aria-pressed={tab === key} onClick={() => setTab(key)}>
            {label}
          </button>
        ))}
      </div>

      {tab === "identifizieren" && (
        <div className={styles.risikoListe}>
          {visible.map((r) => (
            <RisikoKarte key={r.id} def={r} />
          ))}
          {visible.length === 0 && <p className="hint">Noch keine Risiken im Register.</p>}
        </div>
      )}

      {tab === "bewerten" && (
        <div className={styles.raster2}>
          <div className="card stack">
            <h3>Matrix</h3>
            <RisikoMatrix
              risks={open.map((r) => ({ id: r.id, title: r.title, probability: state.risks[r.id].probability, impact: state.risks[r.id].impact }))}
              selected={cell}
              onSelect={setCell}
            />
            <p className="hint">Pfeiltasten wandern im Raster, Eingabe wählt eine Zelle. Wert = Wahrscheinlichkeit × Auswirkung.</p>
          </div>
          <div className="stack">
            {cell === null ? (
              <p className="hint">Wähle eine Zelle, um die Risiken darin zu sehen.</p>
            ) : inCell.length === 0 ? (
              <p className="hint">
                Kein offenes Risiko mit Wahrscheinlichkeit {cell.w} und Auswirkung {cell.a}.
              </p>
            ) : (
              inCell.map((r) => <RisikoKarte key={r.id} def={r} withMeasures />)
            )}
          </div>
        </div>
      )}

      {tab === "massnahmen" && (
        <div className={styles.risikoListe}>
          {open.map((r) => (
            <RisikoKarte key={r.id} def={r} withMeasures />
          ))}
          {open.length === 0 && <p className="hint">Keine offenen Risiken.</p>}
        </div>
      )}

      {tab === "ueberwachen" && (
        <div className="tablebox">
          <table className={`tabelle ${styles.kartenTabelle}`}>
            <caption>Stand aller Risiken im Register</caption>
            <thead>
              <tr>
                <th scope="col">Risiko</th>
                <th scope="col">Fenster</th>
                <th scope="col" className="zahl">
                  W × A
                </th>
                <th scope="col">Behandlung</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => {
                const rs = state.risks[r.id]
                return (
                  <tr key={r.id}>
                    <th scope="row" data-label="Risiko">
                      {r.id} {r.title}
                    </th>
                    <td data-label="Fenster">
                      Tag {r.window.fromDay}–{r.window.toDay}
                    </td>
                    <td data-label="W × A" className="zahl">
                      {rs.probability} × {rs.impact} = {rs.probability * rs.impact}
                    </td>
                    <td data-label="Behandlung">
                      {rs.measuresTaken.length > 0 ? `Massnahme ${rs.measuresTaken.join(", ")}` : rs.accepted ? "akzeptiert" : "▲ keine"}
                    </td>
                    <td data-label="Status">
                      {STATUS[rs.status]}
                      {rs.occurredTick !== null ? ` (Tag ${dayOf(rs.occurredTick) + 1})` : ""}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      {!canAct && state.phase !== "abgeschlossen" && <p className="hint">Massnahmen sind in dieser Phase nicht möglich.</p>}
    </div>
  )

}

function RisikoKarte({ def, withMeasures = false }: { def: RiskDef; withMeasures?: boolean }) {
  const { state, scenario, run, readOnly } = useLeitstand()
  const canAct = !readOnly && (state.phase === "planung" || state.phase === "lauf" || state.phase === "periodenende")
  const rs = state.risks[def.id]
  const value = rs.probability * rs.impact
  const zone = value >= 12 ? "rot" : value >= 6 ? "gelb" : "gruen"
  const isOpen = rs.status === "offen"
  return (
    <article className={`card stack ${styles.risikoKarte}`}>
      <div className={styles.zeileZwischen}>
        <h4 className={styles.h4}>
          {def.id} · {def.title}
        </h4>
        <span className={`${styles.ampel} ${styles[`ampel_${zone}`]}`}>
          <span aria-hidden="true">{zone === "rot" ? "■" : zone === "gelb" ? "▲" : "●"}</span> Wert {value}
        </span>
      </div>
      <p className="hint">
        {def.category} · Fenster Tag {def.window.fromDay}–{def.window.toDay} · W {rs.probability} · A {rs.impact} · {STATUS[rs.status]}
      </p>
      <p>{def.description}</p>
      {withMeasures && isOpen && (
        <ul className={styles.massnahmen}>
          {def.measures.map((m) => {
            const taken = rs.measuresTaken.includes(m.id)
            const effort = m.effort ? ("personId" in m.effort ? `${m.effort.hours} h ${personName(scenario, m.effort.personId)}` : `${m.effort.hours} h auf ${m.effort.taskId}`) : null
            return (
              <li key={m.id} className={styles.massnahme}>
                <span>
                  <strong>{m.label}</strong>
                  <span className="hint">
                    {" "}
                    · {STRATEGY[m.strategy]} · {chf(m.costChf)}
                    {effort ? ` · ${effort}` : ""}
                    {m.deltaProbability ? ` · W ${m.deltaProbability > 0 ? "+" : ""}${m.deltaProbability}` : ""}
                    {m.deltaImpact ? ` · A ${m.deltaImpact > 0 ? "+" : ""}${m.deltaImpact}` : ""}
                  </span>
                </span>
                <button
                  type="button"
                  className={`btn ${styles.klein}`}
                  disabled={!canAct || taken}
                  onClick={() => run({ type: "riskMeasure", riskId: def.id, measureId: m.id })}
                >
                  {taken ? "umgesetzt ✓" : "Umsetzen"}
                </button>
              </li>
            )
          })}
          <li className={styles.massnahme}>
            <span>
              <strong>Risiko akzeptieren</strong>
              <span className="hint"> · ohne Kosten; zählt bei Wert über 6 nur halb</span>
            </span>
            <button
              type="button"
              className={`btn ${styles.klein}`}
              disabled={!canAct || rs.accepted}
              onClick={() => run({ type: "riskAccept", riskId: def.id })}
            >
              {rs.accepted ? "akzeptiert ✓" : "Akzeptieren"}
            </button>
          </li>
        </ul>
      )}
    </article>
  )
}
