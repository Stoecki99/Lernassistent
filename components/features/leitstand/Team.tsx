// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

"use client"

// components/features/leitstand/Team.tsx
// Team (4.8): Karte je Person mit Rolle, Herkunft, Pensum, Motivation (Kleinkurve), Profil, Zuweisungen A–F,
// Überstunden und Abwesenheiten; Aktionen Gespräch, Weiterbildung, Überstufe; Persönlichkeit aufklappbar.
// Jede Karte mit gezeichnetem Porträt; Profil als Stufenbalken (0–6), Motivation und Auslastung als Balken mit Zahl.

import { useState } from "react"
import { AREAS, areaLabelsOf, dayOf, fitFor, type AreaId, type PersonDef } from "@/lib/simulation/core"
import styles from "@/app/(leitstand)/leitstand.module.css"
import { useLeitstand } from "./context"
import { ORIGIN_TEXT, PRIORITIES, SHARE_OPTIONS, chf } from "./format"
import { absentNow, fitInTeam, personLoad, teamOf } from "./logic"
import Verlauf from "./charts/Verlauf"
import Avatar from "./Avatar"
import Icon from "./Icon"

const NEED_TEXT: Record<string, string> = {
  anerkennung: "Anerkennung",
  klarheit: "Klarheit",
  autonomie: "Autonomie",
  entwicklung: "Entwicklung",
  zugehoerigkeit: "Zugehörigkeit",
  sicherheit: "Sicherheit",
}
const TRAIT_TEXT: Record<string, string> = {
  gruendlich: "gründlich",
  schnell: "schnell",
  verzettelt: "verzettelt sich leicht",
  lernt_schnell: "lernt schnell",
}
const TOLERANCE_TEXT: Record<string, string> = { tief: "tief (2 Tage)", mittel: "mittel (5 Tage)", hoch: "hoch (8 Tage)" }

export default function Team() {
  const { scenario, state } = useLeitstand()
  const people = scenario.people.filter((p) => state.people[p.id] && (state.people[p.id].available || !p.hidden))
  return (
    <div className={styles.ansicht}>
      <p className="hint">
        Priorität A arbeitet zuerst; ist A nicht bearbeitbar, arbeitet die Person an B und so weiter. Der Anteil begrenzt, wie viel der
        Kapazität in einen Vorgang fliesst.
      </p>
      <div className={styles.teamRaster}>
        {people.map((p) => (
          <PersonKarte key={p.id} def={p} />
        ))}
      </div>
    </div>
  )
}

function PersonKarte({ def }: { def: PersonDef }) {
  const { scenario, state, trace, run, readOnly } = useLeitstand()
  const person = state.people[def.id]
  const [taskId, setTaskId] = useState("")
  const [area, setArea] = useState<AreaId | "">("")
  const manager = def.lineManager ? scenario.stakeholders.find((s) => s.id === def.lineManager)?.name : null
  const absent = absentNow(state, def.id)
  const upcoming = person.absences.filter((a) => a.toTick > state.tick)
  const free = scenario.tasks.filter((t) => state.tasks[t.id].status !== "fertig" && !person.assignments.some((a) => a.taskId === t.id))
  const ids = person.assignments.map((a) => a.taskId)
  const canAct = !readOnly && person.available && (state.phase === "planung" || state.phase === "lauf")
  const lastTalk = person.lastTalkTick === null ? null : dayOf(state.tick) - dayOf(person.lastTalkTick)
  const load = personLoad(state, trace, scenario, def.id)

  function move(i: number, d: -1 | 1) {
    const next = [...ids]
    const j = i + d
    if (j < 0 || j >= next.length) return
    ;[next[i], next[j]] = [next[j], next[i]]
    run({ type: "reorder", personId: def.id, taskIds: next })
  }

  return (
    <article className={`card ${styles.personKarte} ${!person.available ? styles.inaktiv : ""}`} aria-labelledby={`p-${def.id}`}>
      <header className={styles.personKopf}>
        <Avatar name={def.name} role={def.role} size={72} decorative />
        <div className={styles.personTitel}>
          <h3 id={`p-${def.id}`}>{def.name}</h3>
          <p className={styles.personRolle}>{def.role}</p>
          <p className="hint">
            {ORIGIN_TEXT[def.origin]}
            {manager ? ` (${manager})` : ""} · {Math.round(def.pensum * 100)} % · {chf(def.rate)}/h
          </p>
        </div>
      </header>
      {!person.available && <p className="hint">Nicht im Team.</p>}
      {absent ? (
        <p className={styles.warnText}>
          <strong>▲ abwesend: {absent}</strong>
        </p>
      ) : null}
      <div className={styles.personWerte}>
        <div>
          <span className={styles.wertLabel}>Motivation</span>
          <MotivationBalken value={person.motivation} />
          {(trace.motivation[def.id]?.length ?? 0) > 1 && (
            <div className={styles.personVerlauf}>
              <Verlauf values={trace.motivation[def.id] ?? []} label={`Motivation ${def.name}`} min={50} max={110} reference={85} />
            </div>
          )}
        </div>
        <div>
          <span className={styles.wertLabel}>{load?.planned ? "Verplant" : "Auslastung letzter Tag"}</span>
          {load ? <LastBalken percent={load.percent} planned={load.planned} /> : <span className="hint">–</span>}
        </div>
      </div>
      <ProfilBalken profile={person.profile} />

      <ol className={styles.zuweisungen} aria-label={`Zuweisungen ${def.name}`}>
        {person.assignments.map((a, i) => {
          const fit = fitInTeam(state, scenario, def.id, a.taskId)
          const t = scenario.tasks.find((x) => x.id === a.taskId)
          return (
            <li key={a.taskId} className={styles.zuweisung}>
              <span className={styles.prio} aria-label={`Priorität ${PRIORITIES[i]}`}>
                {PRIORITIES[i]}
              </span>
              <span className={styles.zuweisungName}>
                <strong>{a.taskId}</strong> {t?.name}
                <span className={`${styles.kleinZahl} ${fit < 0.8 ? styles.warnText : ""}`}>
                  {" "}
                  · Passung {fit < 0.8 ? "▲ " : ""}
                  {fit.toFixed(2)}
                </span>
              </span>
              {canAct && (
                <span className={styles.zuweisungKnoepfe}>
                  <label>
                    <span className="sr-only">Anteil {a.taskId}</span>
                    <select
                      className={`btn ${styles.auswahlKlein}`}
                      value={a.share}
                      onChange={(e) =>
                        run({ type: "setShare", personId: def.id, taskId: a.taskId, share: Number(e.target.value) as 1 | 0.75 | 0.5 | 0.25 })
                      }
                    >
                      {SHARE_OPTIONS.map((s) => (
                        <option key={s} value={s}>
                          {s * 100} %
                        </option>
                      ))}
                    </select>
                  </label>
                  <button type="button" className={`btn ${styles.icon}`} disabled={i === 0} onClick={() => move(i, -1)} aria-label={`${a.taskId} höher priorisieren`}>
                    ↑
                  </button>
                  <button
                    type="button"
                    className={`btn ${styles.icon}`}
                    disabled={i === ids.length - 1}
                    onClick={() => move(i, 1)}
                    aria-label={`${a.taskId} tiefer priorisieren`}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className={`btn ${styles.icon}`}
                    onClick={() => run({ type: "unassign", personId: def.id, taskId: a.taskId })}
                    aria-label={`${a.taskId} entfernen`}
                  >
                    ✕
                  </button>
                </span>
              )}
            </li>
          )
        })}
        {person.assignments.length === 0 && <li className="hint">Keine Zuweisung.</li>}
      </ol>

      {canAct && person.assignments.length < 6 && (
        <div className="row">
          <label className={styles.wachsen}>
            <span className="sr-only">Vorgang für {def.name}</span>
            <select className={`btn ${styles.voll}`} value={taskId} onChange={(e) => setTaskId(e.target.value)}>
              <option value="">+ Vorgang zuweisen …</option>
              {free.map((t) => {
                const fit = fitFor(state, scenario, def.id, t.id, [...teamOf(state, scenario, t.id), def.id])
                return (
                  <option key={t.id} value={t.id}>
                    {t.id} {t.name} · Passung {fit.toFixed(2)}
                  </option>
                )
              })}
            </select>
          </label>
          <button
            type="button"
            className="btn"
            disabled={!taskId}
            onClick={() => {
              if (run({ type: "assign", personId: def.id, taskId })) setTaskId("")
            }}
          >
            Zuweisen
          </button>
        </div>
      )}

      {person.available && (
        <div className={styles.personAktionen}>
          <label className="row">
            <span>Überstunden</span>
            <select
              className={`btn ${styles.auswahlKlein}`}
              value={person.overtime}
              disabled={readOnly}
              onChange={(e) => run({ type: "setOvertime", personId: def.id, level: Number(e.target.value) as 0 | 1 | 2 })}
            >
              <option value={0}>keine</option>
              <option value={1}>+20 %</option>
              <option value={2}>+40 %</option>
            </select>
          </label>
          {person.overtimeStreakDays > 0 && (
            <span className={person.overtimeStreakDays > 5 ? styles.warnText : "hint"}>
              {person.overtimeStreakDays > 5 ? "▲ " : ""}
              {person.overtimeStreakDays} Tage am Stück
            </span>
          )}
          {canAct && (
            <button type="button" className="btn" onClick={() => run({ type: "talk", personId: def.id })}>
              Gespräch führen (1 h)
            </button>
          )}
          {lastTalk !== null && <span className="hint">letztes Gespräch vor {lastTalk} Tagen</span>}
        </div>
      )}

      {canAct && !person.trainingDone && (
        <div className="row">
          <label>
            <span className="sr-only">Gebiet der Weiterbildung</span>
            <select className={`btn ${styles.auswahlKlein}`} value={area} onChange={(e) => setArea(e.target.value as AreaId | "")}>
              <option value="">Weiterbildung …</option>
              {AREAS.map((a) => (
                <option key={a} value={a}>
                  {areaLabelsOf(scenario)[a].label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="btn"
            disabled={!area}
            onClick={() => {
              if (area && run({ type: "training", personId: def.id, area })) setArea("")
            }}
          >
            Anmelden ({chf(scenario.trainingCost)}, 2 Tage weg)
          </button>
        </div>
      )}
      {person.trainingDone && <p className="hint">Weiterbildung gebucht; wirkt einige Tage nach dem Kurs.</p>}

      {upcoming.length > 0 && (
        <p className="hint">
          Abwesend:{" "}
          {upcoming.map((a) => `Tag ${dayOf(a.fromTick) + 1}–${dayOf(Math.max(a.fromTick, a.toTick - 1)) + 1} (${a.reason})`).join(", ")}
        </p>
      )}

      <details className={styles.persoenlichkeit}>
        <summary>Persönlichkeit</summary>
        <p>{def.bio}</p>
        <p>
          <strong>Stärken:</strong> {def.strengths}
        </p>
        <p>
          <strong>Schwächen:</strong> {def.weaknesses}
        </p>
        <p>
          <strong>Überstunden:</strong> {def.overtimeBehaviour} Toleranz {TOLERANCE_TEXT[def.overtimeTolerance]}.
        </p>
        <p>
          <strong>Braucht:</strong> {def.needs.map((n) => NEED_TEXT[n]).join(", ")}
          {def.traits.length > 0 ? ` · ${def.traits.map((t) => TRAIT_TEXT[t]).join(", ")}` : ""}
        </p>
      </details>
    </article>
  )
}

/** Profil in fünf Gebieten als Stufenbalken 0–6 (Zahl daneben, Farbe nie allein). */
export function ProfilBalken({ profile }: { profile: readonly number[] }) {
  const { scenario } = useLeitstand()
  const labels = areaLabelsOf(scenario)
  return (
    <ul className={styles.profilStufen} aria-label="Profil, Stufen 0 bis 6">
      {AREAS.map((a, k) => (
        <li key={a}>
          <abbr title={labels[a].label}>{labels[a].short}</abbr>
          <span className={styles.stufen} aria-hidden="true">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <span key={n} className={n <= profile[k] ? styles.stufeAn : undefined} />
            ))}
          </span>
          <span className={styles.stufenZahl}>
            <span className="sr-only">{labels[a].label}: Stufe </span>
            {profile[k]}
          </span>
        </li>
      ))}
    </ul>
  )
}

/** Motivation mit Herz-Symbol, Balken (Skala bis 120) und Zahl; Schwellen wie die Ampel (95 / 85). */
export function MotivationBalken({ value, klein = false }: { value: number; klein?: boolean }) {
  const level = value >= 95 ? "gut" : value >= 85 ? "mittel" : "tief"
  return (
    <span className={`${styles.wertBalken} ${klein ? styles.wertBalkenKlein : ""} ${styles[`wert_${level}`]}`}>
      <Icon name="motivation" size={klein ? 12 : 16} />
      <span className={styles.wertSpur} aria-hidden="true">
        <span style={{ width: `${Math.min(100, (value / 120) * 100)}%` }} />
      </span>
      <span className={styles.wertZahl}>
        <span className="sr-only">Motivation </span>
        {Math.round(value)}
        {level === "tief" ? " ▲" : ""}
      </span>
    </span>
  )
}

/** Auslastung (Skala bis 150 %, Linie bei 100 %); über 100 % und unter 50 % markiert. */
export function LastBalken({ percent, planned, klein = false }: { percent: number; planned: boolean; klein?: boolean }) {
  const level = percent > 105 ? "tief" : percent < 50 ? "mittel" : "gut"
  return (
    <span className={`${styles.wertBalken} ${styles.lastBalken} ${klein ? styles.wertBalkenKlein : ""} ${styles[`wert_${level}`]}`}>
      <Icon name="auslastung" size={klein ? 12 : 16} />
      <span className={styles.wertSpur} aria-hidden="true">
        <span style={{ width: `${Math.min(100, (percent / 150) * 100)}%` }} />
        <i />
      </span>
      <span className={styles.wertZahl}>
        <span className="sr-only">{planned ? "verplant " : "Auslastung "}</span>
        {Math.round(percent)} %
      </span>
    </span>
  )
}
