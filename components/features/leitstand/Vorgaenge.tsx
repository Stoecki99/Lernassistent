// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

"use client"

// components/features/leitstand/Vorgaenge.tsx
// Vorgänge (4.8): Tabelle mit Status, Fortschritt, Rest, Personen, Passung, Produktivität, Reviews, Fehler, Puffer.
// Auf schmalen Schirmen eine Karte je Vorgang. Detail mit Profil gegen Team und Besetzung.

import { useState } from "react"
import { AREAS, fitFor, forecast, type Scenario, type SimState, type TaskDef } from "@/lib/simulation/core"
import styles from "@/app/(leitstand)/leitstand.module.css"
import { firstName, useLeitstand } from "./context"
import { AREA_LABEL, AREA_NAME, STATUS_TEXT, PRIORITIES, chf, stunden } from "./format"
import { fitInTeam, meanFit, teamOf } from "./logic"
import PlanPruefung from "./PlanPruefung"

export default function Vorgaenge() {
  const { state, scenario } = useLeitstand()
  const [open, setOpen] = useState<string | null>(null)
  const fc = forecast(state, scenario)
  const fcRows = Object.fromEntries(fc.rows.map((r) => [r.taskId, r]))

  return (
    <div className={styles.ansicht}>
      <PlanPruefung />
      <div className="tablebox">
        <table className={`tabelle ${styles.kartenTabelle} ${styles.vorgangTabelle}`}>
          <caption>Vorgänge mit Besetzung und Stand. «kritisch» = auf dem kritischen Pfad der Prognose.</caption>
          <thead>
            <tr>
              <th scope="col">Vorgang</th>
              <th scope="col">Status</th>
              <th scope="col">Fortschritt</th>
              <th scope="col" className="zahl">
                Rest
              </th>
              <th scope="col">Personen</th>
              <th scope="col" className="zahl">
                Passung
              </th>
              <th scope="col" className="zahl">
                Produktivität
              </th>
              <th scope="col">Reviews</th>
              <th scope="col" className="zahl">
                Fehler früh/spät
              </th>
              <th scope="col" className="zahl">
                Puffer
              </th>
              <th scope="col">
                <span className="sr-only">Detail</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {scenario.tasks.map((t) => {
              const ts = state.tasks[t.id]
              const team = teamOf(state, scenario, t.id)
              const fit = meanFit(state, scenario, t.id)
              const progress = ts.done + ts.remaining > 0 ? ts.done / (ts.done + ts.remaining) : 0
              const critical = fcRows[t.id]?.critical ?? false
              const productivity = ts.paidHours > 0 ? (ts.done / ts.paidHours) * 100 : null
              const isOpen = open === t.id
              return (
                <VorgangZeile
                  key={t.id}
                  def={t}
                  critical={critical}
                  isOpen={isOpen}
                  onToggle={() => setOpen(isOpen ? null : t.id)}
                  cells={{
                    status: STATUS_TEXT[ts.status],
                    statusKey: ts.status,
                    progress,
                    rest: stunden(ts.remaining),
                    team: team.map((pid) => firstName(scenario, pid)).join(", ") || "–",
                    teamMissing: team.length === 0 && ts.status !== "fertig",
                    fit: fit === null ? "–" : fit.toFixed(2),
                    fitLow: fit !== null && fit < 0.8,
                    productivity: productivity === null ? "–" : `${Math.round(productivity)} %`,
                    defects: `${ts.foundEarly.toFixed(1)} / ${ts.foundLate.toFixed(1)}`,
                    float: fcRows[t.id] ? `${fcRows[t.id].totalFloat.toFixed(1)} d` : "–",
                  }}
                />
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function VorgangZeile({
  def,
  critical,
  isOpen,
  onToggle,
  cells,
}: {
  def: TaskDef
  critical: boolean
  isOpen: boolean
  onToggle: () => void
  cells: {
    status: string
    statusKey: string
    progress: number
    rest: string
    team: string
    teamMissing: boolean
    fit: string
    fitLow: boolean
    productivity: string
    defects: string
    float: string
  }
}) {
  const { state, run, readOnly } = useLeitstand()
  const ts = state.tasks[def.id]
  const detailId = `vorgang-${def.id}`
  return (
    <>
      <tr className={`${critical ? styles.kritisch : ""} ${isOpen ? styles.zeileOffen : ""}`}>
        <th scope="row" data-label="Vorgang">
          <span className={styles.vorgangId}>{def.id}</span> {def.name}
          {critical && <span className={styles.kritischText}>kritisch</span>}
          {def.milestone && <span className={styles.meilenstein}>◆ {def.milestone}</span>}
        </th>
        <td data-label="Status">
          <span className={`${styles.statusChip} ${styles[`st_${cells.statusKey}`]}`}>{cells.status}</span>
        </td>
        <td data-label="Fortschritt">
          <div
            className={styles.fortschritt}
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(cells.progress * 100)}
            aria-label={`Fortschritt ${def.id}`}
          >
            <span style={{ width: `${cells.progress * 100}%` }} />
          </div>
          <span className={styles.kleinZahl}>{Math.round(cells.progress * 100)} %</span>
        </td>
        <td data-label="Rest" className="zahl">
          {cells.rest}
        </td>
        <td data-label="Personen" className={cells.teamMissing ? styles.fehlt : undefined}>
          {cells.teamMissing ? "■ unbesetzt" : cells.team}
        </td>
        <td data-label="Passung" className={`zahl ${cells.fitLow ? styles.warnText : ""}`}>
          {cells.fitLow ? "▲ " : ""}
          {cells.fit}
        </td>
        <td data-label="Produktivität" className="zahl">
          {cells.productivity}
        </td>
        <td data-label="Reviews">
          {ts.status === "fertig" || readOnly ? (
            `${ts.reviewsDone} / ${ts.reviews}`
          ) : (
            <label>
              <span className="sr-only">Reviews {def.id}</span>
              <select
                className={`btn ${styles.auswahlKlein}`}
                value={ts.reviews}
                onChange={(e) => run({ type: "setReviews", taskId: def.id, count: Number(e.target.value) as 0 | 1 | 2 | 3 })}
              >
                {[0, 1, 2, 3].map((n) => (
                  <option key={n} value={n} disabled={n < ts.reviewsDone}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
          )}
        </td>
        <td data-label="Fehler früh/spät" className="zahl">
          {cells.defects}
        </td>
        <td data-label="Puffer" className="zahl">
          {cells.float}
        </td>
        <td data-label="">
          <button type="button" className={`btn ${styles.klein}`} aria-expanded={isOpen} aria-controls={detailId} onClick={onToggle}>
            {isOpen ? "Schliessen" : "Besetzen"}
          </button>
        </td>
      </tr>
      {isOpen && (
        <tr className={styles.detailZeile}>
          <td colSpan={11} id={detailId}>
            <VorgangDetail def={def} />
          </td>
        </tr>
      )}
    </>
  )
}

export function VorgangDetail({ def }: { def: TaskDef }) {
  const { state, scenario, base, run, readOnly } = useLeitstand()
  const ts = state.tasks[def.id]
  const team = teamOf(state, scenario, def.id)
  const [personId, setPersonId] = useState("")
  const candidates = scenario.people.filter((p) => state.people[p.id]?.available && !team.includes(p.id))
  const b = base[def.id]
  const cost = Object.entries(ts.hoursByPerson).reduce((s, [pid, h]) => s + h * (scenario.people.find((p) => p.id === pid)?.rate ?? 0), 0)
  const duration = ts.startTick !== null ? ((ts.endTick ?? state.tick - 1) + 1) / 2 - ts.startTick / 2 : null
  const bestQ = AREAS.map((_, k) => team.reduce((m, pid) => Math.max(m, state.people[pid].profile[k]), 0))

  return (
    <div className={styles.detail}>
      <p>{def.description}</p>
      <div className={styles.raster2}>
        <div className="stack">
          <h4 className={styles.h4}>Profil des Vorgangs gegen das Team</h4>
          <ul className={styles.profilListe}>
            {AREAS.map((a, k) => (
              <li key={a}>
                <abbr title={AREA_NAME[a]}>{AREA_LABEL[a]}</abbr>
                <span className={styles.profilSpur} aria-hidden="true">
                  <span className={styles.profilSoll} style={{ width: `${(def.profile[k] / 6) * 100}%` }} />
                  <span className={styles.profilIst} style={{ width: `${(bestQ[k] / 6) * 100}%` }} />
                </span>
                <span className={`${styles.kleinZahl} ${bestQ[k] < def.profile[k] ? styles.warnText : ""}`}>
                  {bestQ[k] < def.profile[k] ? "▲ " : ""}Team {bestQ[k]} / nötig {def.profile[k]}
                </span>
              </li>
            ))}
          </ul>
          <p className="hint">Oberer Balken: Anforderung, unterer: beste Person im Team. Kollegenhilfe gleicht bis 2 Stufen aus.</p>
        </div>
        <div className="stack">
          <h4 className={styles.h4}>Basisplan und effektiv</h4>
          <table className="tabelle">
            <thead>
              <tr>
                <th scope="col" />
                <th scope="col" className="zahl">
                  Plan
                </th>
                <th scope="col" className="zahl">
                  Effektiv
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">Personen</th>
                <td className="zahl">{def.plannedPersons}</td>
                <td className="zahl">{team.length}</td>
              </tr>
              <tr>
                <th scope="row">Dauer</th>
                <td className="zahl">{b ? `${b.duration.toFixed(1)} d` : "–"}</td>
                <td className="zahl">{duration !== null ? `${duration.toFixed(1)} d` : "–"}</td>
              </tr>
              <tr>
                <th scope="row">Kosten</th>
                <td className="zahl">{chf(ts.bac)}</td>
                <td className="zahl">{chf(cost)}</td>
              </tr>
              <tr>
                <th scope="row">Aufwand</th>
                <td className="zahl">{stunden(ts.plannedEffort)}</td>
                <td className="zahl">{stunden(ts.paidHours)} bezahlt</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <h4 className={styles.h4}>Besetzung</h4>
      {team.length === 0 ? (
        <p className="hint">Noch niemand. Plan: {def.plannedPersons} Person(en).</p>
      ) : (
        <ul className={styles.liste}>
          {team.map((pid) => {
            const person = state.people[pid]
            const idx = person.assignments.findIndex((a) => a.taskId === def.id)
            const share = person.assignments[idx]?.share ?? 1
            const fit = fitInTeam(state, scenario, pid, def.id)
            return (
              <li key={pid} className={styles.besetzung}>
                <span>
                  <strong>{scenario.people.find((p) => p.id === pid)?.name}</strong> · Priorität {PRIORITIES[idx] ?? "?"} · Anteil{" "}
                  {Math.round(share * 100)} % · Passung{" "}
                  <span className={fit < 0.8 ? styles.warnText : undefined}>
                    {fit < 0.8 ? "▲ " : ""}
                    {fit.toFixed(2)}
                  </span>
                </span>
                {!readOnly && ts.status !== "fertig" && (
                  <button type="button" className={`btn ${styles.klein}`} onClick={() => run({ type: "unassign", personId: pid, taskId: def.id })}>
                    Entfernen
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}
      {!readOnly && ts.status !== "fertig" && (
        <div className="row">
          <label>
            <span className="sr-only">Person für {def.id}</span>
            <select className="btn" value={personId} onChange={(e) => setPersonId(e.target.value)}>
              <option value="">Person wählen …</option>
              {candidates.map((p) => {
                const fit = fitFor2(state, scenario, p.id, def.id, team)
                return (
                  <option key={p.id} value={p.id}>
                    {p.name} · Passung {fit.toFixed(2)} · Pensum {Math.round(p.pensum * 100)} %
                  </option>
                )
              })}
            </select>
          </label>
          <button
            type="button"
            className="btn primary"
            disabled={!personId}
            onClick={() => {
              if (run({ type: "assign", personId, taskId: def.id })) setPersonId("")
            }}
          >
            Zuweisen
          </button>
        </div>
      )}
    </div>
  )
}

/** Passung, wenn die Person zum bestehenden Team dazukäme. */
function fitFor2(state: SimState, scenario: Scenario, personId: string, taskId: string, team: string[]): number {
  return fitFor(state, scenario, personId, taskId, [...team, personId])
}
