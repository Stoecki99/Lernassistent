// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// lib/simulation/context.ts
// Interne Hilfen: Nachschlagetabellen zum Szenario (einmal je Szenario-Objekt berechnet), Rundung, Grenzen.

import { resolveParams } from "./params"
import type {
  ChangeRequestDef,
  EventDef,
  Params,
  PersonDef,
  RiskDef,
  Scenario,
  StakeholderDef,
  TaskDef,
} from "./types"

/** clamp(x, a, b) begrenzt x auf [a, b] (Abschnitt 3) */
export function clamp(x: number, a: number, b: number): number {
  return Math.min(b, Math.max(a, x))
}

/** Rundet auf n Nachkommastellen, ohne -0 */
export function round(x: number, digits = 0): number {
  const f = 10 ** digits
  const r = Math.round(x * f) / f
  return r === 0 ? 0 : r
}

/** Division mit Absicherung gegen 0 (3.15: keine NaN/Infinity im Zustand) */
export function safeDiv(a: number, b: number, fallback: number): number {
  return b === 0 || !Number.isFinite(b) ? fallback : a / b
}

export function byId<T extends { id: string }>(a: T, b: T): number {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

export function sortedKeys(record: Record<string, unknown>): string[] {
  return Object.keys(record).sort()
}

export interface Ctx {
  scenario: Scenario
  params: Params
  tasks: Record<string, TaskDef>
  people: Record<string, PersonDef>
  stakeholders: Record<string, StakeholderDef>
  risks: Record<string, RiskDef>
  events: Record<string, EventDef>
  changeRequests: Record<string, ChangeRequestDef>
  taskIds: string[]
  personIds: string[]
  stakeholderIds: string[]
  riskIds: string[]
  eventIds: string[]
  /** Nachfolger je Vorgang */
  successors: Record<string, string[]>
  /** Σ Gewicht × Startzufriedenheit ÷ Σ Gewicht (2.3) */
  siStart: number
  hardStopTick: number
}

const cache = new WeakMap<Scenario, Ctx>()

function index<T extends { id: string }>(items: T[]): Record<string, T> {
  const out: Record<string, T> = {}
  for (const item of items) out[item.id] = item
  return out
}

export function getCtx(scenario: Scenario): Ctx {
  const hit = cache.get(scenario)
  if (hit) return hit
  const successors: Record<string, string[]> = {}
  for (const t of scenario.tasks) successors[t.id] = []
  for (const t of scenario.tasks) for (const p of t.predecessors) successors[p]?.push(t.id)
  for (const k of Object.keys(successors)) successors[k].sort()
  const ctx: Ctx = {
    scenario,
    params: resolveParams(scenario.params),
    tasks: index(scenario.tasks),
    people: index(scenario.people),
    stakeholders: index(scenario.stakeholders),
    risks: index(scenario.risks),
    events: index(scenario.events),
    changeRequests: index(scenario.changeRequests),
    taskIds: scenario.tasks.map((t) => t.id).sort(),
    personIds: scenario.people.map((p) => p.id).sort(),
    stakeholderIds: scenario.stakeholders.map((s) => s.id).sort(),
    riskIds: scenario.risks.map((r) => r.id).sort(),
    eventIds: scenario.events.map((e) => e.id).sort(),
    successors,
    siStart: stakeholderIndex(
      scenario.stakeholders,
      Object.fromEntries(scenario.stakeholders.map((s) => [s.id, s.startSatisfaction])),
    ),
    hardStopTick: scenario.calendar.hardStopTick,
  }
  cache.set(scenario, ctx)
  return ctx
}

/** Stakeholder-Index SI = Σ(Gewicht × Zufriedenheit) ÷ Σ Gewicht, Gewicht = Einfluss × Interesse (2.3) */
export function stakeholderIndex(defs: StakeholderDef[], satisfaction: Record<string, number>): number {
  let num = 0
  let den = 0
  for (const s of defs) {
    const w = s.influence * s.interest
    num += w * (satisfaction[s.id] ?? s.startSatisfaction)
    den += w
  }
  return safeDiv(num, den, 0)
}
