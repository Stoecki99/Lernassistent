// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// lib/simulation/score.ts
// Punkte 0–1000, Sterne, Abzeichen-Bedingungen (Spezifikation 3.13).

import { clamp, getCtx, round, safeDiv, type Ctx } from "./context"
import { SimError } from "./errors"
import { ratingValue } from "./events"
import { currentSi } from "./kpi"
import { restmaengel } from "./quality"
import { windowTicks } from "./risk"
import type { RunResult, Scenario, SimState } from "./types"

/**
 * Termin (max 250): E ≤ Ziel − 2: 250 · bis Ziel: linear auf 230 · danach max(0, 230 − 23 × (E − Ziel)).
 * Bei genehmigtem CR4 (Flag terminVerschoben) zwischen Ziel und Ziel + 5 halber Abzug. Abbruch: 0.
 * Einführungslauf: Grenzen Ziel − 0.5 und Ziel (3.13).
 */
export function scoreTermin(endDay: number, targetDay: number, opts: { intro: boolean; aborted: boolean; shifted: boolean }): number {
  if (opts.aborted) return 0
  const full = opts.intro ? targetDay - 0.5 : targetDay - 2
  if (endDay <= full) return 250
  if (endDay <= targetDay) return 250 - (20 * (endDay - full)) / (targetDay - full)
  const late = endDay - targetDay
  const deduction = opts.shifted ? 11.5 * Math.min(late, 5) + 23 * Math.max(0, late - 5) : 23 * late
  return Math.max(0, 230 - deduction)
}

/**
 * Kosten (max 200): B = Budget ohne Nachträge + 0.5 × genehmigte Nachträge.
 * AC ≤ 0.95 B: 200 · AC ≤ B: linear 200 → 160 · AC > B: max(0, 160 − 160 × (AC − B) ÷ (0.15 B)) (3.13)
 */
export function scoreKosten(ac: number, budgetWithoutSupplements: number, supplements: number): number {
  const b = budgetWithoutSupplements + 0.5 * supplements
  if (b <= 0) return 0
  if (ac <= 0.95 * b) return 200
  if (ac <= b) return 200 - (40 * (ac - 0.95 * b)) / (0.05 * b)
  return Math.max(0, 160 - (160 * (ac - b)) / (0.15 * b))
}

/** Qualität (max 200): 200 × clamp((25 − R) ÷ 20, 0, 1) (3.13) */
export function scoreQualitaet(r: number): number {
  return 200 * clamp((25 - r) / 20, 0, 1)
}

/** Stakeholder (max 150): 150 × clamp((SI − 40) ÷ 50, 0, 1); Abbruch: SI − 20 (3.13) */
export function scoreStakeholder(si: number, aborted: boolean): number {
  const value = aborted ? si - 20 : si
  return 150 * clamp((value - 40) / 50, 0, 1)
}

/** Team (max 100): 100 × clamp((M̄ − 60) ÷ 40, 0, 1) − 10 je Ausfall durch Überlastung (3.13) */
export function scoreTeam(meanMotivation: number, burnouts: number): number {
  return Math.max(0, 100 * clamp((meanMotivation - 60) / 40, 0, 1) - 10 * burnouts)
}

/**
 * Führung (max 100): 40 × H̄ ÷ 100 + 30 × RMI̅ ÷ 120 + 30 × Entscheidquote;
 * Entscheidquote = Σ Bewertung ÷ Anzahl Entscheide − 0.05 je Standardentscheid, clamp 0–1 (3.13).
 */
export function scoreFuehrung(meanHonesty: number, meanRmi: number, decisionQuote: number): number {
  return (40 * meanHonesty) / 100 + (30 * meanRmi) / 120 + 30 * clamp(decisionQuote, 0, 1)
}

/** Sterne: ★ ab 500, ★★ ab 680, ★★★ ab 820 (3.13) */
export function starsFor(total: number, thresholds: readonly number[]): 0 | 1 | 2 | 3 {
  if (total >= thresholds[2]) return 3
  if (total >= thresholds[1]) return 2
  if (total >= thresholds[0]) return 1
  return 0
}

/** Entscheidquote (3.12, 3.13): Standardentscheid zählt 0 und zusätzlich −0.05 */
export function decisionQuote(state: SimState): number {
  const n = state.decisions.length
  if (n === 0) return 1
  let sum = 0
  for (const d of state.decisions) sum += d.defaulted ? 0 : ratingValue(d.rating)
  return clamp(sum / n - 0.05 * state.stats.defaults, 0, 1)
}

function mean(values: number[], fallback: number): number {
  return values.length === 0 ? fallback : values.reduce((a, b) => a + b, 0) / values.length
}

/** Endzeitpunkt E in Tagen = τ des Abschlusstakts des letzten Vorgangs; null, wenn nicht alle fertig */
export function projectEndDay(state: SimState): number | null {
  let end = -1
  for (const id of Object.keys(state.tasks).sort()) {
    const t = state.tasks[id]
    if (t.status !== "fertig" || t.endTick === null) return null
    end = Math.max(end, t.endTick)
  }
  return end < 0 ? null : (end + 1) / 2
}

/** Risiken mit Massnahme vor Fensterbeginn zählen für «Risikoprofi» */
export function treatedBeforeWindow(ctx: Ctx, riskId: string, tick: number): boolean {
  const def = ctx.risks[riskId]
  return def ? tick < windowTicks(def).from : false
}

/** Ergebnis ohne Phasenprüfung (intern; computeScore prüft die Phase) */
export function scoreState(state: SimState, scenario: Scenario): RunResult {
  const ctx = getCtx(scenario)
  const intro = scenario.kind === "intro"
  const endDayDone = projectEndDay(state)
  const aborted = endDayDone === null
  const endDay = endDayDone ?? state.tick / 2

  let r = restmaengel(state)
  if (aborted) {
    // Abbruch: +1 Restmangel je 8 h Restaufwand (3.13)
    let rest = 0
    for (const id of ctx.taskIds) rest += state.tasks[id].remaining
    r += rest / 8
  }
  const si = currentSi(state, ctx)
  const meanMot = mean(state.history.map((h) => h.motivation), 100)
  const meanRmi = mean(state.history.map((h) => h.rmi), 0)
  const meanH = mean(state.reports.map((x) => x.honesty), 100)

  const termin = round(
    scoreTermin(endDay, scenario.calendar.targetDay, { intro, aborted, shifted: state.flags.terminVerschoben === true }),
  )
  const kosten = round(
    scoreKosten(state.finance.ac, state.finance.budget - state.finance.budgetSupplements, state.finance.budgetSupplements),
  )
  const qualitaet = round(scoreQualitaet(r))
  const stakeholder = round(scoreStakeholder(si, aborted))
  const team = round(scoreTeam(meanMot, state.stats.burnouts))
  const fuehrung = round(scoreFuehrung(meanH, meanRmi, decisionQuote(state)))
  const total = termin + kosten + qualitaet + stakeholder + team + fuehrung

  const achievements: string[] = []
  if (intro) {
    achievements.push("leitstand_einfuehrung")
  } else {
    achievements.push("leitstand_ernstfall")
    if (total >= 820) achievements.push("leitstand_drei_sterne")
    if (!aborted && endDay <= scenario.calendar.targetDay && state.finance.ac <= state.finance.budget - state.finance.budgetSupplements) {
      achievements.push("leitstand_punktlandung")
    }
    if (state.reports.length > 0 && state.reports.every((x) => x.honesty >= 85)) achievements.push("leitstand_klartext")
    if (state.stats.minTeamMotivation >= 80 && state.stats.burnouts === 0) achievements.push("leitstand_teamgeist")
    if (meanRmi >= 100 && state.stats.risksTreatedEarly.length >= 3) achievements.push("leitstand_risikoprofi")
    if (!aborted && r <= 3) achievements.push("leitstand_null_fehler")
  }

  return {
    ended: aborted ? "abbruch" : "fertig",
    endDay: round(endDay, 1),
    score: { total, termin, kosten, qualitaet, stakeholder, team, fuehrung },
    stars: starsFor(total, ctx.params.starThresholds),
    restmaengel: round(r, 1),
    achievements,
  }
}

/** Punkte, Sterne, Abzeichen (3.13); nur bei Phase «abgeschlossen» */
export function computeScore(state: SimState, scenario: Scenario): RunResult {
  if (state.phase !== "abgeschlossen") {
    throw new SimError("WRONG_PHASE", "Punkte gibt es erst nach dem Abschlussbericht.")
  }
  return scoreState(state, scenario)
}

/** Mittelwert einer Kennzahl über den Verlauf (für Nachbesprechung und Abzeichen) */
export function historyMean(state: SimState, key: "motivation" | "rmi" | "qi" | "si"): number {
  return safeDiv(
    state.history.reduce((s, h) => s + h[key], 0),
    state.history.length,
    0,
  )
}
