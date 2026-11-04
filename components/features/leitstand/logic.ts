// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// components/features/leitstand/logic.ts
// Reine Hilfen der Oberfläche auf Basis des Rechenkerns (keine eigenen Spielregeln):
// Nachspielen mit Verlauf je Person, Team eines Vorgangs, Plan-Prüfung (3.2), PV-Kurve des Basisplans (3.10).

import {
  SimError,
  applyAction,
  computeSchedule,
  createRun,
  fitFor,
  forecast,
  type Action,
  type PersonId,
  type Scenario,
  type ScheduleRow,
  type SimState,
  type TaskId,
} from "@/lib/simulation/core"

/** Verlauf je Person nach jedem Takt: kumulierte Projektstunden und Motivation (für Auslastung und Kleinkurven). */
export interface Trace {
  ticks: number[]
  hours: Record<PersonId, number[]>
  motivation: Record<PersonId, number[]>
}

export function emptyTrace(state: SimState): Trace {
  const trace: Trace = { ticks: [], hours: {}, motivation: {} }
  for (const pid of Object.keys(state.people)) {
    trace.hours[pid] = []
    trace.motivation[pid] = []
  }
  recordTrace(trace, state)
  return trace
}

function paidHoursOf(state: SimState, personId: PersonId): number {
  let sum = 0
  for (const task of Object.values(state.tasks)) sum += task.hoursByPerson[personId] ?? 0
  return sum
}

/** Hängt den Zustand an, wenn ein neuer Takt erreicht ist. */
export function recordTrace(trace: Trace, state: SimState): void {
  const last = trace.ticks[trace.ticks.length - 1]
  if (last !== undefined && last >= state.tick) return
  trace.ticks.push(state.tick)
  for (const pid of Object.keys(state.people)) {
    ;(trace.hours[pid] ??= []).push(paidHoursOf(state, pid))
    ;(trace.motivation[pid] ??= []).push(state.people[pid].motivation)
  }
}

/** Nachspielen wie replay(), aber mit Verlauf. Wirft SimError mit actionIndex. */
export function replayTraced(scenario: Scenario, seed: number, actions: Action[]): { state: SimState; trace: Trace } {
  let state = createRun(scenario, seed)
  const trace = emptyTrace(state)
  for (let i = 0; i < actions.length; i++) {
    try {
      state = applyAction(state, actions[i], scenario)
    } catch (error) {
      if (error instanceof SimError) error.actionIndex = i
      throw error
    }
    recordTrace(trace, state)
  }
  return { state, trace }
}

/** Personen mit einer Zuweisung auf dem Vorgang (in Reihenfolge der Szenario-Personen). */
export function teamOf(state: SimState, scenario: Scenario, taskId: TaskId): PersonId[] {
  return scenario.people
    .map((p) => p.id)
    .filter((pid) => state.people[pid]?.available && state.people[pid].assignments.some((a) => a.taskId === taskId))
}

/** Passung einer Person im aktuellen Team des Vorgangs (mit Kollegenhilfe). */
export function fitInTeam(state: SimState, scenario: Scenario, personId: PersonId, taskId: TaskId): number {
  return fitFor(state, scenario, personId, taskId, teamOf(state, scenario, taskId))
}

/** Mittlere Passung der Besetzung oder null ohne Besetzung. */
export function meanFit(state: SimState, scenario: Scenario, taskId: TaskId): number | null {
  const team = teamOf(state, scenario, taskId)
  if (team.length === 0) return null
  return team.reduce((s, pid) => s + fitFor(state, scenario, pid, taskId, team), 0) / team.length
}

/** Basisplan nach Vorgang (Abschnitt 2.4). */
export function baselineRows(scenario: Scenario): Record<TaskId, ScheduleRow> {
  return Object.fromEntries(computeSchedule(scenario).map((r) => [r.taskId, r]))
}

/** PV-Kurve des Basisplans: PV(τ) = Σ BAC_v × clamp((τ − FA_v) ÷ D_v, 0, 1) (3.10). */
export function pvAt(state: SimState, base: Record<TaskId, ScheduleRow>, tau: number): number {
  let sum = 0
  for (const [id, row] of Object.entries(base)) {
    const bac = state.tasks[id]?.bac ?? 0
    const f = row.duration > 0 ? (tau - row.es) / row.duration : tau >= row.es ? 1 : 0
    sum += bac * Math.min(1, Math.max(0, f))
  }
  return sum
}

export interface PlanFinding {
  kind: "fehlt" | "warnung"
  text: string
  view: "vorgaenge" | "team" | "risiken"
}

/** Plan-Prüfung vor dem Start (3.2, nur Hinweise; «fehlt» blockiert den Start im Rechenkern). */
export function planCheck(state: SimState, scenario: Scenario): PlanFinding[] {
  const out: PlanFinding[] = []
  const base = baselineRows(scenario)
  const fc = forecast(state, scenario)
  const fcRows = Object.fromEntries(fc.rows.map((r) => [r.taskId, r]))
  const required = scenario.tasks.filter((t) => {
    if (state.tasks[t.id].status === "fertig") return false
    return state.period === 0 ? t.phase === "R" : true
  })
  const missing = required.filter((t) => teamOf(state, scenario, t.id).length === 0)
  if (missing.length > 0) {
    out.push({ kind: "fehlt", text: `Noch ohne Person: ${missing.map((t) => t.id).join(", ")}.`, view: "vorgaenge" })
  }
  for (const t of scenario.tasks) {
    const task = state.tasks[t.id]
    if (task.status === "fertig") continue
    const team = teamOf(state, scenario, t.id)
    const critical = base[t.id]?.critical ?? false
    if (critical && team.length > 0 && fcRows[t.id] && fcRows[t.id].duration > base[t.id].duration + 0.25) {
      out.push({
        kind: "warnung",
        text: `${t.id} liegt auf dem kritischen Pfad und dauert mit dieser Besetzung rund ${fcRows[t.id].duration.toFixed(1)} statt ${base[t.id].duration.toFixed(1)} Tage.`,
        view: "vorgaenge",
      })
    }
    for (const pid of team) {
      const fit = fitFor(state, scenario, pid, t.id, team)
      const def = scenario.people.find((p) => p.id === pid)
      if (fit < 0.8) {
        out.push({ kind: "warnung", text: `${def?.name ?? pid} passt schlecht zu ${t.id} (Passung ${fit.toFixed(2)}).`, view: "team" })
      }
      if (critical && def && def.pensum < 1) {
        out.push({ kind: "warnung", text: `${def.name} arbeitet ${Math.round(def.pensum * 100)} % auf dem kritischen Vorgang ${t.id}.`, view: "team" })
      }
    }
    if (task.reviews === 0 && !t.test) {
      out.push({ kind: "warnung", text: `${t.id} hat kein Review.`, view: "vorgaenge" })
    }
  }
  for (const r of scenario.risks) {
    const rs = state.risks[r.id]
    if (!rs || !rs.visible || rs.status !== "offen") continue
    if (rs.probability * rs.impact >= 12 && rs.measuresTaken.length === 0 && !rs.accepted) {
      out.push({ kind: "warnung", text: `Risiko ${r.id} «${r.title}» (Wert ${rs.probability * rs.impact}) hat keine Massnahme.`, view: "risiken" })
    }
  }
  return out
}

/** Personen, die heute Projektstunden leisten könnten, aber keinen bearbeitbaren Vorgang haben, werden im Team angezeigt. */
export function absentNow(state: SimState, personId: PersonId): string | null {
  const person = state.people[personId]
  const hit = person?.absences.find((a) => a.fromTick <= state.tick && state.tick < a.toTick)
  return hit ? hit.reason : null
}

/** FNV-1a über einen Text (32 Bit), nur für die Anzeige-Reihenfolge; verbraucht keinen Zufall des Rechenkerns. */
function hash32(text: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h >>> 0
}

/**
 * Optionen eines Ereignisses in einer je Lauf und Ereignis festen, gemischten Reihenfolge
 * (aus Startwert + Ereignis-ID, gleich nach dem Neuladen). Die Aktion sendet weiterhin die echte Options-ID.
 */
export function shuffledOptions<T extends { id: string }>(seed: number, eventId: string, options: T[]): T[] {
  return [...options].sort((a, b) => hash32(`${seed}|${eventId}|${a.id}`) - hash32(`${seed}|${eventId}|${b.id}`) || a.id.localeCompare(b.id))
}

/** Angezeigte Nummer (1, 2, 3 …) einer Option im gemischten Posteingang. */
export function optionNumber(seed: number, eventId: string, options: Array<{ id: string }>, optionId: string): number {
  return shuffledOptions(seed, eventId, options).findIndex((o) => o.id === optionId) + 1
}

/** Anzeige-Status eines Vorgangs: wie im Rechenkern, dazu «blockiert» = im Lauf bearbeitbar oder laufend, aber niemand besetzt. */
export type DisplayStatus = "offen" | "bereit" | "laufend" | "fertig" | "blockiert"

export function displayStatus(state: SimState, scenario: Scenario, taskId: TaskId): DisplayStatus {
  const status = state.tasks[taskId].status
  if (state.phase !== "planung" && (status === "bereit" || status === "laufend") && teamOf(state, scenario, taskId).length === 0) return "blockiert"
  return status
}

/**
 * Auslastung einer Person zur Anzeige: im Lauf die bezahlten Projektstunden des letzten Tages (2 Takte) gegen das Pensum,
 * in der Planung die Summe der Anteile ihrer Zuweisungen (100 % = ein Vorgang voll). null = nichts zu zeigen.
 */
export function personLoad(state: SimState, trace: Trace, scenario: Scenario, personId: PersonId): { percent: number; planned: boolean } | null {
  const person = state.people[personId]
  const def = scenario.people.find((p) => p.id === personId)
  if (!person || !def || !person.available) return null
  const series = trace.hours[personId] ?? []
  const n = trace.ticks.length
  if (state.tick === 0 || n < 2) {
    const shares = person.assignments.reduce((sum, a) => sum + a.share, 0)
    return { percent: Math.min(shares, 1) * 100, planned: true }
  }
  const back = Math.min(2, n - 1)
  const hours = (series[n - 1] ?? 0) - (series[n - 1 - back] ?? 0)
  const ticks = trace.ticks[n - 1] - trace.ticks[n - 1 - back]
  const capacity = 4 * def.pensum * Math.max(1, ticks)
  return { percent: (hours / Math.max(1e-9, capacity)) * 100, planned: false }
}
