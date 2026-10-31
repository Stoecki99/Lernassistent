// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// lib/simulation/risk.ts
// Risikoregister: Eintrittsgefahr, Fenster, Sichtbarkeit, Risiko-Index RMI (Spezifikation 3.9, 2.6).

import { dayOf, weekIndexOf } from "./calendar"
import { clamp, safeDiv, type Ctx } from "./context"
import type { RiskDef, RiskState, SimState } from "./types"

/** Fenster in Takten: [2·(von − 1), 2·bis − 1] (Tage 1-basiert, einschliesslich; 2.6, 2.7) */
export function windowTicks(def: RiskDef): { from: number; to: number; count: number } {
  const from = 2 * (def.window.fromDay - 1)
  const to = 2 * def.window.toDay - 1
  return { from, to, count: Math.max(1, to - from + 1) }
}

/**
 * Gefahr je Takt (3.9): h = 1 − (1 − p_gesamt(W))^(1/N), p_gesamt = riskProb[W − 1].
 * W wird auf 1–5 begrenzt.
 */
export function hazardPerTick(probability: number, windowCount: number, riskProb: readonly number[]): number {
  const w = clamp(Math.round(probability), 1, 5)
  const total = riskProb[w - 1]
  return 1 - Math.pow(1 - total, 1 / Math.max(1, windowCount))
}

/** W und A nie unter 1 und nie über 5 (2.6) */
export function clampRiskValue(x: number): number {
  return clamp(x, 1, 5)
}

/** Sichtbarkeit nachführen: ab visible.fromDay (Tag 1-basiert); byEvent setzt events.ts beim Eintreffen (2.6) */
export function updateVisibility(state: SimState, ctx: Ctx, tick: number): void {
  const day1 = dayOf(tick) + 1
  for (const id of ctx.riskIds) {
    const def = ctx.risks[id]
    const risk = state.risks[id]
    if (!risk.visible && def.visible.fromDay !== undefined && day1 >= def.visible.fromDay) risk.visible = true
  }
}

/** Startsichtbarkeit: leer = ab Start sichtbar (4.3 RiskDef.visible) */
export function initiallyVisible(def: RiskDef): boolean {
  return def.visible.fromDay === undefined && def.visible.byEvent === undefined
}

export function isOpen(risk: RiskState): boolean {
  return risk.status === "offen"
}

/** behandelt_r = 1 mit Massnahme · 1 akzeptiert und Wert ≤ 6 · 0.5 akzeptiert und Wert > 6 · sonst 0 (3.9) */
function treated(risk: RiskState): number {
  const value = risk.probability * risk.impact
  if (risk.measuresTaken.length > 0) return 1
  if (risk.accepted) return value <= 6 ? 1 : 0.5
  return 0
}

/**
 * Risiko-Index (3.9):
 * Abdeckung = Σ Wert × behandelt ÷ Σ Wert (sichtbare, offene Risiken; keine → 1)
 * Regelmässig = geprüfte Wochen ÷ begonnene Wochen (vor dem Start: 1)
 * RMI = clamp(120 × (0.6 × Abdeckung + 0.4 × Regelmässig), 0, 120)
 */
export function riskIndex(state: SimState, ctx: Ctx): number {
  let sum = 0
  let covered = 0
  for (const id of ctx.riskIds) {
    const risk = state.risks[id]
    if (!risk.visible || !isOpen(risk)) continue
    const value = risk.probability * risk.impact
    sum += value
    covered += value * treated(risk)
  }
  const coverage = safeDiv(covered, sum, 1)
  return clamp(120 * (0.6 * coverage + 0.4 * regularity(state)), 0, 120)
}

/** Regelmässigkeit der Registerprüfung (3.9); vor dem ersten Takt 1 */
export function regularity(state: SimState): number {
  if (state.tick === 0) return 1
  // Begonnene Wochen: bis und mit der Woche des zuletzt gerechneten Takts. Eine Prüfung am Montagmorgen
  // (vor dem ersten Takt der Woche) zählt für die neue Woche, sobald diese begonnen hat.
  const begun = weekIndexOf(state.tick - 1) + 1
  const reviewed = new Set(state.stats.riskReviewedWeeks.filter((w) => w < begun)).size
  return clamp(safeDiv(reviewed, begun, 1), 0, 1)
}

/** Registerprüfung in der Woche des aktuellen Takts vermerken (Aktion riskReview, Wirkung riskReviewed) */
export function markRiskReviewed(state: SimState): void {
  const week = weekIndexOf(state.tick)
  if (!state.stats.riskReviewedWeeks.includes(week)) {
    state.stats.riskReviewedWeeks.push(week)
    state.stats.riskReviewedWeeks.sort((a, b) => a - b)
  }
  state.flags.registerGeprueft = true
}
