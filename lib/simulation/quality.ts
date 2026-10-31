// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// lib/simulation/quality.ts
// Qualität: Fehler, Reviews, Tests, Korrekturzeit, QI, Restmängel (Spezifikation 3.6).

import { clamp, round, safeDiv, type Ctx } from "./context"
import type { PersonDef, SimState, TaskState } from "./types"

/**
 * Neue Fehler einer Person in einem Vorgang (3.6):
 * eff × DEF_BASE × (1 + 0.15 × G) × m_ot × m_mot × m_trait × m_team
 */
export function newDefects(input: {
  eff: number
  gap: number
  overtimeLevel: number
  overtimeStreak: number
  motivation: number
  traits: PersonDef["traits"]
  teamExcess: number
  defBase: number
}): number {
  // m_ot = 1 + 0.15 × Überstufe + 0.02 × max(0, Serie − 5)
  const mOt = 1 + 0.15 * input.overtimeLevel + 0.02 * Math.max(0, input.overtimeStreak - 5)
  // m_mot = 1.3 wenn m < 60 · 1.1 wenn m < 80 · sonst 1.0
  const mMot = input.motivation < 60 ? 1.3 : input.motivation < 80 ? 1.1 : 1.0
  // m_trait = gründlich 0.8 · schnell 1.2 · sonst 1.0
  let mTrait = 1
  if (input.traits.includes("gruendlich")) mTrait *= 0.8
  if (input.traits.includes("schnell")) mTrait *= 1.2
  // m_team = 1.1 wenn x ≥ 2
  const mTeam = input.teamExcess >= 2 ? 1.1 : 1.0
  return input.eff * input.defBase * (1 + 0.15 * input.gap) * mOt * mMot * mTrait * mTeam
}

/** Fortschritt = erledigt ÷ (erledigt + Rest); fertig = 1 (3.6, 3.10) */
export function progressOf(task: TaskState): number {
  if (task.status === "fertig") return 1
  return safeDiv(task.done, task.done + task.remaining, 0)
}

/**
 * Reviews (3.6): bei r Reviews finden sie bei Fortschritt k/r statt.
 * Aufwand REVIEW_SHARE × Planaufwand, Entdeckung Fehlerlast × REVIEW_DETECT, Korrektur früh FIX_EARLY je Fehler.
 * Liefert die Anzahl ausgelöster Reviews.
 */
export function runReviews(state: SimState, ctx: Ctx, taskId: string): number {
  const task = state.tasks[taskId]
  const p = ctx.params
  let count = 0
  while (task.reviewsDone < task.reviews && task.status !== "fertig") {
    const k = task.reviewsDone + 1
    if (progressOf(task) + 1e-9 < k / task.reviews) break
    const reviewEffort = p.reviewShare * task.plannedEffort
    const found = task.latentDefects * p.reviewDetect
    task.latentDefects -= found
    task.remaining += reviewEffort + found * p.fixEarly
    task.foundEarly += found
    task.reviewsDone = k
    state.stats.earlyDefectsFound += found
    state.hours.review += reviewEffort
    state.hours.korrektur_frueh += found * p.fixEarly
    count++
  }
  return count
}

/**
 * Tests (3.6): beim Start des Testvorgangs (erste bezahlte Stunde) finden sie in jedem geprüften Vorgang
 * Fehlerlast × Entdeckungsrate; Korrektur FIX_LATE je Fehler landet im Restaufwand des Testvorgangs.
 * Liefert die Anzahl gefundener Fehler.
 */
export function runTest(state: SimState, ctx: Ctx, taskId: string): number {
  const def = ctx.tasks[taskId]
  const task = state.tasks[taskId]
  if (!def.test || task.testDone || task.startTick === null) return 0
  let total = 0
  for (const coveredId of [...def.test.covers].sort()) {
    const covered = state.tasks[coveredId]
    if (!covered) continue
    const found = covered.latentDefects * def.test.detectionRate
    covered.latentDefects -= found
    covered.foundLate += found
    total += found
  }
  task.remaining += total * ctx.params.fixLate
  task.testDone = true
  state.stats.lateDefectsFound += total
  state.hours.korrektur_spaet += total * ctx.params.fixLate
  return total
}

/** Σ Fehlerlast aller Vorgänge (ungerundet) */
export function totalLatentDefects(state: SimState): number {
  let sum = 0
  for (const id of Object.keys(state.tasks).sort()) sum += state.tasks[id].latentDefects
  return sum
}

/** Σ effektive Stunden (erledigt) aller Vorgänge */
export function totalEffectiveHours(state: SimState): number {
  let sum = 0
  for (const id of Object.keys(state.tasks).sort()) sum += state.tasks[id].done
  return sum
}

/** ρ = Σ Fehlerlast ÷ max(1, Σ effektive Stunden) × 100 (3.6) */
export function defectDensity(state: SimState): number {
  return (totalLatentDefects(state) / Math.max(1, totalEffectiveHours(state))) * 100
}

/** QI = clamp(100 × (1.5 − 0.5 × ρ ÷ RHO_REF), 0, 130) (3.6) */
export function qualityIndexFromRho(rho: number, rhoRef: number): number {
  return clamp(100 * (1.5 - (0.5 * rho) / rhoRef), 0, 130)
}

export function qualityIndex(state: SimState, ctx: Ctx): number {
  return qualityIndexFromRho(defectDensity(state), ctx.params.rhoRef)
}

/** Restmängel = Σ Fehlerlast × Faktor (Wirkung restmaengelFactor), eine Nachkommastelle (3.6) */
export function restmaengel(state: SimState): number {
  const factor = typeof state.flags.restmaengelFactor === "number" ? state.flags.restmaengelFactor : 1
  return round(totalLatentDefects(state) * factor, 1)
}
