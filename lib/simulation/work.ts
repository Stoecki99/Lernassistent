// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// lib/simulation/work.ts
// Kapazität (3.3), Verteilung nach Priorität (3.2), Passung und Leistung (3.4), Kosten der Arbeit (3.5).

import { dayOf } from "./calendar"
import { clamp, type Ctx } from "./context"
import { newDefects } from "./quality"
import { AREAS, type AreaId, type CostCategory, type PersonDef, type PersonState, type Profile, type SimState, type TaskDef } from "./types"

// ---------- Passung (3.4) ----------

/** Gewicht der Lücke: 1.0 wenn r ≥ 4 · 0.6 wenn r ∈ {2,3} · 0.3 wenn r = 1 · 0 wenn r = 0 (3.4) */
function gapWeight(r: number): number {
  if (r >= 4) return 1
  if (r >= 2) return 0.6
  if (r >= 1) return 0.3
  return 0
}

export interface FitDetail {
  fit: number
  /** gewichtete Lücke G */
  gap: number
  /** Überqualifikation O */
  over: number
}

/**
 * Passung (3.4):
 * q_eff[k] = max(q_p[k], max Kolleg q[k] − HELP)
 * G = Σ w[k] × max(0, r[k] − q_eff[k]);  O = Σ_{r[k] ≥ 3} min(2, max(0, q_eff[k] − r[k]))
 * fit = clamp(1 − C_GAP × G + C_OVER × O, fitMin, fitMax)
 */
export function fitDetail(
  own: Profile,
  required: Profile,
  colleagues: Profile[],
  p: { help: number; cGap: number; cOver: number; fitMin: number; fitMax: number },
): FitDetail {
  let gap = 0
  let over = 0
  for (let k = 0; k < AREAS.length; k++) {
    let q = own[k]
    for (const c of colleagues) q = Math.max(q, c[k] - p.help)
    const r = required[k]
    gap += gapWeight(r) * Math.max(0, r - q)
    if (r >= 3) over += Math.min(2, Math.max(0, q - r))
  }
  const fit = clamp(1 - p.cGap * gap + p.cOver * over, p.fitMin, p.fitMax)
  return { fit, gap, over }
}

/** Hauptgebiet eines Vorgangs: Gebiet mit höchster Anforderung, bei Gleichstand das erste (3.4 Lernkurve) */
export function mainArea(profile: Profile): AreaId {
  let best = 0
  for (let k = 1; k < AREAS.length; k++) if (profile[k] > profile[best]) best = k
  return AREAS[best]
}

// ---------- Faktoren (3.4) ----------

/** f_team: x = n − n_plan; x ≤ 0 → 1; sonst max(teamMin, 1 − 0.05·x − 0.01·x·(x−1)) */
export function teamFactor(excess: number, p: { teamLinear: number; teamQuad: number; teamMin: number }): number {
  if (excess <= 0) return 1
  return Math.max(p.teamMin, 1 - p.teamLinear * excess - p.teamQuad * excess * (excess - 1))
}

/** f_mot = clamp(0.6 + 0.4 × m/100, 0.6, 1.08) (3.4) */
export function motivationFactor(m: number): number {
  return clamp(0.6 + (0.4 * m) / 100, 0.6, 1.08)
}

/** f_ot: Serie s ≤ 5 → 1; sonst max(0.8, 1 − 0.02 × (s − 5)) (3.4) */
export function overtimeFactor(streakDays: number): number {
  if (streakDays <= 5) return 1
  return Math.max(0.8, 1 - 0.02 * (streakDays - 5))
}

/** Stunden, nach denen die Lernkurve durchlaufen ist (lernt schnell: 8 statt 16, 2.5) */
export function learnHoursFor(def: PersonDef, learnHours: number): number {
  return def.traits.includes("lernt_schnell") ? learnHours / 2 : learnHours
}

/**
 * f_learn (3.4): 1.0, wenn die Person schon ≥ L Stunden im Hauptgebiet des Vorgangs gearbeitet hat;
 * sonst learnStart + (1 − learnStart) × min(1, h_bisher(p,v) ÷ L)
 */
export function learnFactor(person: PersonState, def: PersonDef, area: AreaId, hoursOnTask: number, learnHours: number): number {
  const l = learnHoursFor(def, learnHours)
  if (person.hoursByArea[area] >= l) return 1
  return person.learnStart + (1 - person.learnStart) * Math.min(1, hoursOnTask / l)
}

/** f_trait: gründlich 0.95 · schnell 1.05 · verzettelt 0.9 bei > 3 bearbeitbaren Zuweisungen (2.5, 3.4) */
export function traitFactor(def: PersonDef, workableAssignments: number): number {
  let f = 1
  if (def.traits.includes("gruendlich")) f *= 0.95
  if (def.traits.includes("schnell")) f *= 1.05
  if (def.traits.includes("verzettelt") && workableAssignments > 3) f *= 0.9
  return f
}

// ---------- Kapazität (3.3) ----------

/** Pensum(p, t): Grundpensum, ersetzt durch availabilityOverrides, plus Ereignis-Wirkungen (3.3) */
export function pensumAt(state: SimState, ctx: Ctx, personId: string, tick: number): number {
  const def = ctx.people[personId]
  const day1 = dayOf(tick) + 1
  let pensum = def.pensum
  for (const o of def.availabilityOverrides ?? []) {
    if (day1 >= o.fromDay && day1 <= o.toDay) pensum = o.pensum
  }
  for (const m of state.people[personId].pensumMods) {
    if (tick >= m.fromTick && tick < m.toTick) pensum += m.delta
  }
  return Math.max(0, pensum)
}

export function isAbsent(person: PersonState, tick: number): boolean {
  return person.absences.some((a) => tick >= a.fromTick && tick < a.toTick)
}

/** Verfügbar(p, t) = 0 bei Abwesenheit oder nicht freigeschalteter Person, sonst 1 (3.3) */
export function isPresent(person: PersonState, tick: number): boolean {
  return person.available && !isAbsent(person, tick)
}

/** Bruttokapazität: hoursPerTick × Pensum × (1 + OT_STEP × Überstufe) × Verfügbar (3.3, vor Abzug der Termine) */
export function grossCapacity(state: SimState, ctx: Ctx, personId: string, tick: number): number {
  const person = state.people[personId]
  if (!isPresent(person, tick)) return 0
  return ctx.params.hoursPerTick * pensumAt(state, ctx, personId, tick) * (1 + ctx.params.otStep * person.overtime)
}

/** Überstunden-Anteil der bezahlten Stunden: OT_STEP × Stufe ÷ (1 + OT_STEP × Stufe) (3.3) */
export function overtimeShare(level: number, otStep: number): number {
  return (otStep * level) / (1 + otStep * level)
}

// ---------- Bearbeitbarkeit (3.2) ----------

/** Phasentor (2.4): Phase mit gateTick braucht Flag phaseReleased und t ≥ gateTick */
export function phaseOpen(state: SimState, ctx: Ctx, def: TaskDef, tick: number): boolean {
  const phase = ctx.scenario.phases.find((ph) => ph.id === def.phase)
  if (!phase || phase.gateTick === null) return true
  return state.flags.phaseReleased === true && tick >= phase.gateTick
}

/** Bearbeitbar: nicht fertig, alle Vorgänger fertig, nicht blockiert, Phasentor offen (3.2) */
export function isWorkable(state: SimState, ctx: Ctx, taskId: string, tick: number): boolean {
  const task = state.tasks[taskId]
  const def = ctx.tasks[taskId]
  if (!task || !def || task.status === "fertig") return false
  if (task.blockedUntilTick > tick) return false
  for (const pre of def.predecessors) if (state.tasks[pre]?.status !== "fertig") return false
  return phaseOpen(state, ctx, def, tick)
}

/** Trennung aus Wirkung `separate` (E07 C): Leistung × factor, wenn beide im selben Vorgang arbeiten */
export function separationFactor(state: SimState, personId: string, team: string[], tick: number): number {
  let f = 1
  for (const s of state.separations) {
    if (s.untilTick <= tick || !s.personIds.includes(personId)) continue
    const other = s.personIds[0] === personId ? s.personIds[1] : s.personIds[0]
    if (team.includes(other)) f *= s.factor
  }
  return f
}

// ---------- Takt: Kapazität, Verteilung, Leistung, Kosten ----------

export function bookCost(state: SimState, category: CostCategory, chf: number): void {
  if (chf === 0) return
  state.finance.ac += chf
  state.finance.byCategory[category] += chf
}

export interface WorkTickResult {
  /** Personen, die in diesem Takt mindestens eine bearbeitbare Zuweisung hatten */
  hadWorkable: Record<string, boolean>
}

/**
 * Schritte 3–5 von stepTick (3.1): Kapazität, Verteilung, Leistung, Fehler, Stunden und Kosten.
 * Arbeitet direkt auf `state` (Arbeitskopie).
 */
export function workTick(state: SimState, ctx: Ctx, tick: number): WorkTickResult {
  const p = ctx.params
  const allocation: Record<string, Array<{ personId: string; hours: number }>> = {}
  const workableCount: Record<string, number> = {}
  const hadWorkable: Record<string, boolean> = {}
  const workable: Record<string, boolean> = {}
  for (const id of ctx.taskIds) workable[id] = isWorkable(state, ctx, id, tick)

  // Schritt 3 und 4: Kapazität (3.3) und Verteilung nach Priorität (3.2)
  for (const pid of ctx.personIds) {
    const person = state.people[pid]
    const def = ctx.people[pid]
    const workableAssignments = person.assignments.filter((a) => workable[a.taskId]).length
    workableCount[pid] = workableAssignments
    hadWorkable[pid] = workableAssignments > 0
    const gross = grossCapacity(state, ctx, pid, tick)
    if (gross <= 0) continue
    // Termine (Stundenart fuehrung) verringern die Kapazität; Kosten = Stunden × Satz (3.3, 3.5, 2.6)
    const appointment = Math.min(person.appointmentHours, gross)
    if (appointment > 0) {
      person.appointmentHours -= appointment
      if (person.appointmentHours < 1e-9) person.appointmentHours = 0
      state.hours.fuehrung += appointment
      bookCost(state, "fuehrung", appointment * def.rate)
      person.dayPaidHours += appointment
    }
    const capacity = gross - appointment
    let rest = capacity
    for (const a of person.assignments) {
      if (rest <= 1e-12) break
      if (!workable[a.taskId]) continue
      // h = min(Rest, share × Kapazität) (3.2)
      const h = Math.min(rest, a.share * capacity)
      if (h <= 0) continue
      const list = allocation[a.taskId] ?? []
      list.push({ personId: pid, hours: h })
      allocation[a.taskId] = list
      rest -= h
    }
  }

  // Schritt 5: Leistung je Vorgang (3.4), Fehler (3.6), Stunden und Kosten (3.5)
  for (const taskId of ctx.taskIds) {
    const entries = allocation[taskId]
    if (!entries || entries.length === 0) continue
    const def = ctx.tasks[taskId]
    const task = state.tasks[taskId]
    const team = entries.map((e) => e.personId)
    const excess = entries.length - def.plannedPersons
    const fTeam = teamFactor(excess, p)
    const fPhase = p.phaseFactor[state.teamPhase]
    const area = mainArea(def.profile)

    const parts = entries.map((e) => {
      const person = state.people[e.personId]
      const pdef = ctx.people[e.personId]
      const colleagues = team.filter((id) => id !== e.personId).map((id) => state.people[id].profile)
      const detail = fitDetail(person.profile, def.profile, colleagues, p)
      const factor =
        detail.fit *
        motivationFactor(person.motivation) *
        overtimeFactor(person.overtimeStreakDays) *
        learnFactor(person, pdef, area, task.hoursByPerson[e.personId] ?? 0, p.learnHours) *
        traitFactor(pdef, workableCount[e.personId]) *
        separationFactor(state, e.personId, team, tick)
      return { ...e, gap: detail.gap, contribution: e.hours * factor }
    })

    // eff(v) = f_team × f_phase × Σ_p [ h × fit × f_mot × f_ot × f_learn × f_trait ] (3.4)
    const raw = fTeam * fPhase * parts.reduce((s, x) => s + x.contribution, 0)
    // eff(v) = min(eff(v), Aufwand_plan ÷ (minDays × 2)), wenn minDays gesetzt (3.4)
    let eff = def.minDays ? Math.min(raw, task.plannedEffort / (def.minDays * 2)) : raw
    const capFactor = raw > 0 ? eff / raw : 0
    // Überschuss: anteilig kürzen, scale = Rest ÷ Leistung; gekürzte Stunden sind Leerlauf (3.2)
    let scale = 1
    if (eff > task.remaining) {
      scale = task.remaining > 0 ? task.remaining / eff : 0
      eff = task.remaining
    }

    for (const part of parts) {
      const person = state.people[part.personId]
      const pdef = ctx.people[part.personId]
      // Mindestdauer-Kappung wie Überschuss behandeln (3.2, Nachtrag AP5): Stunden, die wegen minDays
      // keine Leistung bringen, sind Leerlauf und werden nicht bezahlt (Prüfrechnung 8.2).
      const paid = part.hours * capFactor * scale
      if (paid <= 0) continue
      const effP = part.contribution * fTeam * fPhase * capFactor * scale
      task.latentDefects += newDefects({
        eff: effP,
        gap: part.gap,
        overtimeLevel: person.overtime,
        overtimeStreak: person.overtimeStreakDays,
        motivation: person.motivation,
        traits: pdef.traits,
        teamExcess: excess,
        defBase: p.defBase,
      })
      task.paidHours += paid
      task.hoursByPerson[part.personId] = (task.hoursByPerson[part.personId] ?? 0) + paid
      person.hoursByArea[area] += paid
      person.dayPaidHours += paid
      person.lastWorkTick = tick
      // Arbeit: bezahlte Stunden × Satz; Zuschlag: Überstunden × Satz × OT_SURCHARGE (3.5)
      const ot = paid * overtimeShare(person.overtime, p.otStep)
      state.hours.arbeit += paid - ot
      state.hours.ueberzeit += ot
      bookCost(state, "arbeit", paid * pdef.rate)
      bookCost(state, "ueberzeit", ot * pdef.rate * p.otSurcharge)
    }
    if (task.startTick === null && task.paidHours > 0) task.startTick = tick
    task.remaining = Math.max(0, task.remaining - eff)
    task.done += eff
  }
  return { hadWorkable }
}
