// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// lib/simulation/schedule.ts
// Netzplan mit Vorwärts- und Rückwärtsrechnung (Spezifikation 2.4) und Terminprognose (3.10).

import { getCtx, round, type Ctx } from "./context"
import { fitDetail, motivationFactor, pensumAt, teamFactor } from "./work"
import type { Scenario, ScheduleRow, SimState, TaskDef } from "./types"

const EPS = 1e-6

/** Topologische Reihenfolge (Kahn, bei Gleichstand nach ID). Zyklen prüft das Zod-Schema. */
export function topoOrder(tasks: TaskDef[]): string[] {
  const indeg: Record<string, number> = {}
  const succ: Record<string, string[]> = {}
  for (const t of tasks) {
    indeg[t.id] = t.predecessors.length
    succ[t.id] = []
  }
  for (const t of tasks) for (const p of t.predecessors) succ[p]?.push(t.id)
  const ready = tasks.filter((t) => indeg[t.id] === 0).map((t) => t.id).sort()
  const order: string[] = []
  while (ready.length > 0) {
    const id = ready.shift() as string
    order.push(id)
    for (const s of succ[id]) {
      indeg[s]--
      if (indeg[s] === 0) {
        ready.push(s)
        ready.sort()
      }
    }
  }
  return order
}

/**
 * Netzplan-Kern (2.4): FA = max(Untergrenze, max FE der Vorgänger), FE = FA + Dauer;
 * SE = min SA der Nachfolger (sonst Projektende), SA = SE − Dauer; GP = SA − FA; FP = min FA Nachfolger − FE.
 */
function cpm(ctx: Ctx, durations: Record<string, number>, minStart: Record<string, number>): ScheduleRow[] {
  const order = topoOrder(ctx.scenario.tasks)
  const es: Record<string, number> = {}
  const ef: Record<string, number> = {}
  for (const id of order) {
    let start = minStart[id] ?? 0
    for (const p of ctx.tasks[id].predecessors) start = Math.max(start, ef[p])
    es[id] = start
    ef[id] = start + durations[id]
  }
  const end = order.reduce((m, id) => Math.max(m, ef[id]), 0)
  const ls: Record<string, number> = {}
  const lf: Record<string, number> = {}
  for (const id of [...order].reverse()) {
    const succ = ctx.successors[id]
    lf[id] = succ.length === 0 ? end : Math.min(...succ.map((s) => ls[s]))
    ls[id] = lf[id] - durations[id]
  }
  return ctx.taskIds.map((id) => {
    const succ = ctx.successors[id]
    const free = (succ.length === 0 ? end : Math.min(...succ.map((s) => es[s]))) - ef[id]
    const total = ls[id] - es[id]
    return {
      taskId: id,
      duration: round(durations[id], 6),
      es: round(es[id], 6),
      ef: round(ef[id], 6),
      ls: round(ls[id], 6),
      lf: round(lf[id], 6),
      totalFloat: round(total, 6),
      freeFloat: round(free, 6),
      critical: Math.abs(total) < EPS,
    }
  })
}

/** Plandauer in Tagen = Aufwand ÷ (Personen × 8) (2.4) */
export function plannedDuration(def: TaskDef): number {
  return def.effortHours / (def.plannedPersons * 8)
}

/** Früheste Zeitpunkte durch Phasentore: gateTick in Tagen (gateTick ÷ 2), 2.4 «Phasentor» */
function gateStarts(ctx: Ctx): Record<string, number> {
  const out: Record<string, number> = {}
  for (const def of ctx.scenario.tasks) {
    const phase = ctx.scenario.phases.find((p) => p.id === def.phase)
    if (phase && phase.gateTick !== null) out[def.id] = phase.gateTick / 2
  }
  return out
}

/** Basisplan (2.4) oder Netzplan mit eigenen Dauern. Zeilen nach Vorgangs-ID sortiert. */
export function computeSchedule(scenario: Scenario, durations?: Record<string, number>): ScheduleRow[] {
  const ctx = getCtx(scenario)
  const dur: Record<string, number> = {}
  for (const def of scenario.tasks) dur[def.id] = durations?.[def.id] ?? plannedDuration(def)
  return cpm(ctx, dur, gateStarts(ctx))
}

/** Basisplan je Vorgang (für PV), im Szenario-Kontext zwischengespeichert */
const baselineCache = new WeakMap<Scenario, Record<string, ScheduleRow>>()
export function baseline(scenario: Scenario): Record<string, ScheduleRow> {
  const hit = baselineCache.get(scenario)
  if (hit) return hit
  const rows = Object.fromEntries(computeSchedule(scenario).map((r) => [r.taskId, r]))
  baselineCache.set(scenario, rows)
  return rows
}

/**
 * Tagesleistung der aktuellen Besetzung eines Vorgangs (3.10 Terminprognose, ohne Konflikte):
 * Σ 8 × Pensum × (1 + OT_STEP × Stufe) × Anteil × fit × f_mot, × f_team × f_phase.
 * Ohne Besetzung: Planpersonen × 8 × 0.85.
 */
export function dailyRate(state: SimState, ctx: Ctx, taskId: string): number {
  const def = ctx.tasks[taskId]
  const p = ctx.params
  const tick = state.tick
  const team = ctx.personIds.filter((pid) => {
    const person = state.people[pid]
    return person.available && person.assignments.some((a) => a.taskId === taskId)
  })
  let sum = 0
  for (const pid of team) {
    const person = state.people[pid]
    const share = person.assignments.find((a) => a.taskId === taskId)?.share ?? 1
    const colleagues = team.filter((id) => id !== pid).map((id) => state.people[id].profile)
    const fit = fitDetail(person.profile, def.profile, colleagues, p).fit
    sum +=
      2 * p.hoursPerTick * pensumAt(state, ctx, pid, tick) * (1 + p.otStep * person.overtime) * share * fit *
      motivationFactor(person.motivation)
  }
  const rate = sum * teamFactor(team.length - def.plannedPersons, p) * p.phaseFactor[state.teamPhase]
  return rate > EPS ? rate : def.plannedPersons * 8 * 0.85
}

/**
 * Terminprognose (3.10): Vorwärtsrechnung ab jetzt. Fertige Vorgänge mit Ist-Terminen,
 * offene und laufende mit Dauer = Rest ÷ Tagesleistung; Phasentor und Blockaden beachten.
 */
export function forecast(state: SimState, scenario: Scenario): { endDay: number; rows: ScheduleRow[] } {
  const ctx = getCtx(scenario)
  const now = state.tick / 2
  const durations: Record<string, number> = {}
  const minStart: Record<string, number> = {}
  for (const id of ctx.taskIds) {
    const def = ctx.tasks[id]
    const task = state.tasks[id]
    if (task.status === "fertig" && task.startTick !== null && task.endTick !== null) {
      minStart[id] = task.startTick / 2
      durations[id] = (task.endTick + 1) / 2 - task.startTick / 2
      continue
    }
    let start = Math.max(now, task.blockedUntilTick / 2)
    const phase = scenario.phases.find((p) => p.id === def.phase)
    if (phase && phase.gateTick !== null) start = Math.max(start, phase.gateTick / 2)
    minStart[id] = start
    let duration = task.remaining / dailyRate(state, ctx, id)
    if (def.minDays) duration = Math.max(duration, def.minDays * Math.min(1, task.remaining / Math.max(task.plannedEffort, EPS)))
    durations[id] = duration
  }
  const rows = cpm(ctx, durations, minStart)
  const endDay = rows.reduce((m, r) => Math.max(m, r.ef), 0)
  return { endDay: round(endDay, 6), rows }
}
