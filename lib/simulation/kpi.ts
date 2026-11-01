// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// lib/simulation/kpi.ts
// Earned Value, Kennzahlen, Ampeln und Verlauf (Spezifikation 3.10).

import { clamp, getCtx, safeDiv, stakeholderIndex, type Ctx } from "./context"
import { defectDensity, progressOf, qualityIndexFromRho, restmaengel, totalEffectiveHours } from "./quality"
import { riskIndex } from "./risk"
import { baseline, forecast } from "./schedule"
import { teamMotivation } from "./team"
import type { Ampel, KpiPoint, KpiSnapshot, ReportArea, Scenario, SimState } from "./types"

/** τ nach dem zuletzt gerechneten Takt: (t+1)/2 mit t = tick − 1, also tick/2 (3.1) */
export function currentTau(state: SimState): number {
  return state.tick / 2
}

/**
 * Vorgangs-IDs in fester Reihenfolge (Summen sind dann bitgleich). state.tasks enthält genau die Vorgänge
 * des Szenarios (engine.createRun), daher gilt ctx.taskIds; der Rückfall sortiert die Schlüssel selbst.
 */
function sortedTaskIds(state: SimState): readonly string[] {
  return Object.keys(state.tasks).sort()
}

/** BAC = Σ BAC_v (inkl. genehmigter Änderungsanträge) */
export function totalBac(state: SimState, taskIds: readonly string[] = sortedTaskIds(state)): number {
  let sum = 0
  for (const id of taskIds) sum += state.tasks[id].bac
  return sum
}

/** PV = Σ_v BAC_v × clamp((τ − FA_v) ÷ D_v, 0, 1), FA und D aus dem Basisplan (3.10) */
export function plannedValue(state: SimState, scenario: Scenario, tau: number): number {
  const base = baseline(scenario)
  let pv = 0
  for (const id of getCtx(scenario).taskIds) {
    const row = base[id]
    if (!row) continue
    const share = row.duration > 0 ? clamp((tau - row.es) / row.duration, 0, 1) : tau >= row.es ? 1 : 0
    pv += state.tasks[id].bac * share
  }
  return pv
}

/** EV = Σ_v BAC_v × Fortschritt_v (3.10) */
export function earnedValue(state: SimState, taskIds: readonly string[] = sortedTaskIds(state)): number {
  let ev = 0
  for (const id of taskIds) ev += state.tasks[id].bac * progressOf(state.tasks[id])
  return ev
}

/** SI absolut (2.3) */
export function currentSi(state: SimState, ctx: Ctx): number {
  return stakeholderIndex(ctx.scenario.stakeholders, state.stakeholders)
}

/** Ampelrang: gruen 0, gelb 1, rot 2 (auch Kodierung der Kennzahl trueOverall) */
export function ampelRank(a: Ampel): number {
  return a === "gruen" ? 0 : a === "gelb" ? 1 : 2
}

/** Ampeln (3.10) */
export function computeAmpeln(input: {
  spi: number
  cpi: number
  forecastEndDay: number
  eac: number
  budget: number
  qi: number
  teamMotivation: number
  rmi: number
  targetDay: number
}): Record<ReportArea | "gesamt", Ampel> {
  const { spi, cpi, forecastEndDay, eac, budget, qi, rmi, targetDay } = input
  const termine: Ampel =
    spi >= 0.95 && forecastEndDay <= targetDay ? "gruen" : spi >= 0.85 || forecastEndDay <= targetDay + 2 ? "gelb" : "rot"
  const kosten: Ampel = cpi >= 0.95 && eac <= budget ? "gruen" : cpi >= 0.85 || eac <= 1.05 * budget ? "gelb" : "rot"
  const qualitaet: Ampel = qi >= 95 ? "gruen" : qi >= 80 ? "gelb" : "rot"
  const team: Ampel = input.teamMotivation >= 90 ? "gruen" : input.teamMotivation >= 75 ? "gelb" : "rot"
  const risiken: Ampel = rmi >= 95 ? "gruen" : rmi >= 75 ? "gelb" : "rot"
  const others = [qualitaet, team, risiken]
  const othersYellow = others.filter((a) => a === "gelb").length
  const othersRed = others.filter((a) => a === "rot").length
  // Gesamt: Grün = Termine und Kosten grün, höchstens ein anderer Bereich gelb (keiner rot);
  // Gelb = kein Rot bei Termine/Kosten, höchstens ein Rot sonst; sonst Rot
  let gesamt: Ampel
  if (termine === "gruen" && kosten === "gruen" && othersRed === 0 && othersYellow <= 1) gesamt = "gruen"
  else if (termine !== "rot" && kosten !== "rot" && othersRed <= 1) gesamt = "gelb"
  else gesamt = "rot"
  return { termine, kosten, qualitaet, team, risiken, gesamt }
}

/** Vollständige Kennzahlen zum aktuellen Zustand (3.10), inkl. Ampeln und Stundenarten */
export function computeKpis(state: SimState, scenario: Scenario): KpiSnapshot {
  const ctx = getCtx(scenario)
  const tau = currentTau(state)
  const bac = totalBac(state, ctx.taskIds)
  const pv = plannedValue(state, scenario, tau)
  const ev = earnedValue(state, ctx.taskIds)
  const ac = state.finance.ac
  // SPI = EV ÷ PV (PV = 0 → 1), CPI = EV ÷ AC (AC = 0 → 1)
  const spi = safeDiv(ev, pv, 1)
  const cpi = safeDiv(ev, ac, 1)
  // EAC = BAC ÷ CPI; CPI wird nach unten auf 0.05 begrenzt, damit EAC endlich bleibt (3.15)
  const eac = bac / Math.max(cpi, 0.05)
  const rho = defectDensity(state)
  const qi = qualityIndexFromRho(rho, ctx.params.rhoRef)
  const motivation = teamMotivation(state, ctx)
  const si = currentSi(state, ctx)
  const rmi = riskIndex(state, ctx)
  const forecastEndDay = forecast(state, scenario).endDay
  let paid = 0
  for (const id of ctx.taskIds) paid += state.tasks[id].paidHours
  const productivity = safeDiv(totalEffectiveHours(state), paid, 1) * 100
  const ra = state.stats.ressourcenausgleich
  let count = 0
  let foundEarly = 0
  let foundLate = 0
  for (const id of ctx.taskIds) {
    count += state.tasks[id].reviewsDone
    foundEarly += state.tasks[id].foundEarly
    foundLate += state.tasks[id].foundLate
  }
  return {
    tick: state.tick,
    tau,
    day: Math.floor(tau) + 1,
    bac,
    pv,
    ev,
    ac,
    sv: ev - pv,
    cv: ev - ac,
    spi,
    cpi,
    eac,
    etc: eac - ac,
    vac: bac - eac,
    budget: state.finance.budget,
    qi,
    rho,
    teamMotivation: motivation,
    si,
    siPercent: safeDiv(si, ctx.siStart, 1) * 100,
    rmi,
    productivity,
    forecastEndDay,
    restmaengel: restmaengel(state),
    ressourcenausgleich: safeDiv(ra.okDays, ra.allDays, 1) * 100,
    hours: { ...state.hours },
    costByCategory: { ...state.finance.byCategory },
    reviews: {
      count,
      foundEarly,
      foundLate,
      fixHoursEarly: foundEarly * ctx.params.fixEarly,
      fixHoursLate: foundLate * ctx.params.fixLate,
    },
    ampeln: computeAmpeln({
      spi,
      cpi,
      forecastEndDay,
      eac,
      budget: state.finance.budget,
      qi,
      teamMotivation: motivation,
      rmi,
      targetDay: scenario.calendar.targetDay,
    }),
  }
}

/** Eintrag für state.history (Schritt 9 von stepTick, 3.1) */
export function toKpiPoint(k: KpiSnapshot, tick: number): KpiPoint {
  return {
    tick,
    pv: k.pv,
    ev: k.ev,
    ac: k.ac,
    spi: k.spi,
    cpi: k.cpi,
    eac: k.eac,
    qi: k.qi,
    motivation: k.teamMotivation,
    si: k.si,
    rmi: k.rmi,
    productivity: k.productivity,
    forecastEndDay: k.forecastEndDay,
  }
}
