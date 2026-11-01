// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// lib/simulation/report.ts
// Statusbericht: Abgleich mit den Ist-Daten (Ehrlichkeit H) und Entscheid des Gemeinderats (Spezifikation 3.11).

import { clamp, safeDiv, type Ctx } from "./context"
import { applyEffects, evalCondition, newMemo } from "./events"
import { ampelRank } from "./kpi"
import { REPORT_FORECAST_DAY_MAX, type Ampel, type BoardDecision, type KpiSnapshot, type ReportArea, type ReportRecord, type SimState, type StatusReportInput } from "./types"

export const REPORT_AREAS: readonly ReportArea[] = ["termine", "kosten", "qualitaet", "team", "risiken"]
const AMPEL_KEYS: ReadonlyArray<ReportArea | "gesamt"> = ["gesamt", ...REPORT_AREAS]
const AREA_LABEL: Record<ReportArea | "gesamt", string> = {
  gesamt: "Gesamt",
  termine: "Termine",
  kosten: "Kosten",
  qualitaet: "Qualität",
  team: "Team",
  risiken: "Risiken",
}
const AMPEL_LABEL: Record<Ampel, string> = { gruen: "Grün", gelb: "Gelb", rot: "Rot" }

export interface HonestyResult {
  honesty: number
  findings: string[]
  /** mindestens eine Ampel besser gemeldet als gemessen */
  embellished: boolean
}

/** Wahrheit für den Bericht: Ampeln, Fertigstellungsgrad EV ÷ BAC, Prognose, EAC (3.11) */
export function reportTruth(k: KpiSnapshot): ReportRecord["truth"] {
  return {
    ampeln: { ...k.ampeln },
    progress: safeDiv(k.ev, k.bac, 0) * 100,
    forecastEndDay: k.forecastEndDay,
    eac: k.eac,
  }
}

/**
 * Ehrlichkeit H (3.11), Start 100:
 * Ampel 1 Stufe besser −10 (Gesamt −15) · 2 Stufen besser −25 (Gesamt −30) · schlechter −5 (Schwarzmalerei);
 * Fertigstellungsgrad > 10 Prozentpunkte daneben −10; Prognose Endtag < Rechenkern − 2 −15 (Rechenkern höchstens
 * REPORT_FORECAST_DAY_MAX, weil das Formular nicht mehr zulässt);
 * Endkosten < EAC × 0.95 −15; gelber/roter Bereich ohne passende Massnahme −5 je Bereich;
 * Flag zusageGruen und geschönt: Ampel-Abzüge doppelt; Flag zusageGelb und Abweichungen leer −10.
 */
export function assessHonesty(input: StatusReportInput, truth: ReportRecord["truth"], ctx: Ctx, flags: SimState["flags"]): HonestyResult {
  const findings: string[] = []
  let ampelDeduction = 0
  let other = 0
  let embellished = false
  for (const key of AMPEL_KEYS) {
    const diff = ampelRank(truth.ampeln[key]) - ampelRank(input.ampeln[key])
    const label = `${AREA_LABEL[key]}: gemeldet ${AMPEL_LABEL[input.ampeln[key]]}, gemessen ${AMPEL_LABEL[truth.ampeln[key]]}`
    if (diff === 1) {
      const d = key === "gesamt" ? 15 : 10
      ampelDeduction += d
      embellished = true
      findings.push(`${label} (−${d})`)
    } else if (diff >= 2) {
      const d = key === "gesamt" ? 30 : 25
      ampelDeduction += d
      embellished = true
      findings.push(`${label} (−${d})`)
    } else if (diff < 0) {
      ampelDeduction += 5
      findings.push(`${label}: Schwarzmalerei (−5)`)
    }
  }
  if (flags.zusageGruen === true && embellished) {
    findings.push(`Zusage «Grün» an die Auftraggeberin und geschönter Bericht: Ampel-Abzüge doppelt (−${ampelDeduction})`)
    ampelDeduction *= 2
  }
  if (Math.abs(input.progressPercent - truth.progress) > 10) {
    other += 10
    findings.push(`Fertigstellungsgrad ${input.progressPercent} % statt ${truth.progress.toFixed(0)} % (−10)`)
  }
  if (input.forecastEndDay < Math.min(truth.forecastEndDay, REPORT_FORECAST_DAY_MAX) - 2) {
    other += 15
    findings.push(`Prognose Endtag ${input.forecastEndDay} zu optimistisch, Rechenkern ${truth.forecastEndDay.toFixed(1)} (−15)`)
  }
  if (input.forecastCostChf < truth.eac * 0.95) {
    other += 15
    findings.push(`Prognose Endkosten CHF ${Math.round(input.forecastCostChf)} unter EAC CHF ${Math.round(truth.eac)} (−15)`)
  }
  const covered = new Set<ReportArea>()
  for (const mid of input.measures) for (const area of ctx.scenario.reportMeasures.find((m) => m.id === mid)?.areas ?? []) covered.add(area)
  for (const area of REPORT_AREAS) {
    if (truth.ampeln[area] !== "gruen" && !covered.has(area)) {
      other += 5
      findings.push(`${AREA_LABEL[area]} ist ${AMPEL_LABEL[truth.ampeln[area]]}, aber ohne passende Massnahme (−5)`)
    }
  }
  if (flags.zusageGelb === true && input.deviations.trim() === "") {
    other += 10
    findings.push("Zusage «Gelb ohne Einzelheiten»: keine Abweichungen begründet (−10)")
  }
  return { honesty: clamp(100 - ampelDeduction - other, 0, 100), findings, embellished }
}

function bump(state: SimState, id: string, delta: number): void {
  if (state.stakeholders[id] === undefined) return
  state.stakeholders[id] = clamp(state.stakeholders[id] + delta, 0, 100)
}

/** Rollen-IDs nach 2.3; fehlt eine ID im Szenario, entfällt die Wirkung */
export const SPONSOR_ID = "S01"
export const PRESIDENT_ID = "S02"
export const BOARD_ID = "S03"

/** Ist der Meilenstein der Phase R erreicht? (3.11 «V12 fertig»: Meilenstein-Vorgänge der Phase R) */
function phaseMilestoneDone(state: SimState, ctx: Ctx): boolean {
  const milestones = ctx.scenario.tasks.filter((t) => t.phase === "R" && t.milestone)
  const relevant = milestones.length > 0 ? milestones : ctx.scenario.tasks.filter((t) => t.phase === "R")
  return relevant.every((t) => state.tasks[t.id].status === "fertig")
}

/**
 * Entscheid des Gemeinderats (3.11, nur Statusbericht 1, deterministisch).
 * Phasenfreigabe, Budgetnachtrag, Änderungsanträge (2.9, zusätzlich H ≥ 70), Ehrlichkeit allgemein.
 */
export function boardDecision(state: SimState, ctx: Ctx, input: StatusReportInput, honesty: number, embellished: boolean): BoardDecision {
  const reasons: string[] = []
  const hasMeasure = input.measures.length > 0
  const honest = honesty >= 70

  // Phasenfreigabe
  let phaseRelease: BoardDecision["phaseRelease"]
  if (phaseMilestoneDone(state, ctx)) {
    phaseRelease = "erteilt"
    reasons.push("Phasenfreigabe erteilt: Der Meilenstein der Realisierung ist erreicht.")
  } else if (honest && hasMeasure) {
    phaseRelease = "erteilt"
    reasons.push("Phasenfreigabe erteilt: Meilenstein noch offen, aber ehrlicher Bericht mit Massnahmen.")
  } else {
    phaseRelease = "mitAuflage"
    reasons.push("Phasenfreigabe mit Auflage: wöchentlicher Zusatzbericht an den Gemeinderat.")
    bump(state, SPONSOR_ID, -8)
    bump(state, BOARD_ID, -5)
    state.flags.auflage = true
  }
  state.flags.phaseReleased = true

  // Budgetnachtrag X: H ≥ 70, X ≤ 10 % des Budgets, ≥ 1 Massnahme → genehmigt; H ≥ 70, X ≤ 20 % → halb
  let budgetApprovedChf = 0
  const x = input.budgetSupplementChf
  if (x > 0) {
    const budget = state.finance.budget
    if (honest && x <= 0.1 * budget && hasMeasure) {
      budgetApprovedChf = x
      reasons.push(`Budgetnachtrag CHF ${Math.round(x)} genehmigt.`)
    } else if (honest && x <= 0.2 * budget) {
      budgetApprovedChf = x / 2
      reasons.push(`Budgetnachtrag zur Hälfte genehmigt (CHF ${Math.round(x / 2)}).`)
    } else {
      reasons.push("Budgetnachtrag abgelehnt.")
      if (!honest) {
        state.flags.vertrauensverlust = true
        bump(state, SPONSOR_ID, -10)
      }
    }
    if (budgetApprovedChf > 0) {
      state.finance.budget += budgetApprovedChf
      state.finance.budgetSupplements += budgetApprovedChf
      // S03 −3 je genehmigte CHF 10'000 (anteilig)
      bump(state, BOARD_ID, (-3 * budgetApprovedChf) / 10000)
    }
  }

  // Änderungsanträge: Regeln 2.9, zusätzlich H ≥ 70
  const changeRequests: Record<string, "genehmigt" | "abgelehnt"> = {}
  const memo = newMemo()
  for (const crId of [...input.changeRequestIds].sort()) {
    const cr = ctx.changeRequests[crId]
    if (!cr) continue
    if (honest && evalCondition(state, ctx, cr.approveWhen, memo)) {
      changeRequests[crId] = "genehmigt"
      state.changeRequests[crId] = "genehmigt"
      applyEffects(state, ctx, cr.effects, { source: crId, scale: 1 })
      reasons.push(`${crId} «${cr.label}» genehmigt.`)
    } else {
      changeRequests[crId] = "abgelehnt"
      state.changeRequests[crId] = "abgelehnt"
      reasons.push(`${crId} «${cr.label}» abgelehnt.`)
    }
  }

  // Ehrlichkeit allgemein: H ≥ 85 → S03 +5, S01 +3 (+8 mit berichtVorbesprochen); H < 70 → S03 −10
  if (honesty >= 85) {
    bump(state, BOARD_ID, 5)
    bump(state, SPONSOR_ID, state.flags.berichtVorbesprochen === true ? 8 : 3)
  } else if (!honest) {
    bump(state, BOARD_ID, -10)
  }
  // E20 B: Zusage «Grün», aber ehrlich berichtet → Vertrauensbruch bei der Auftraggeberin (2.8)
  if (state.flags.zusageGruen === true && !embellished) bump(state, SPONSOR_ID, -10)

  return { phaseRelease, budgetApprovedChf, changeRequests, reasons }
}

/** Ist ein Änderungsantrag im aktuellen Zustand beantragbar? (2.9 «Verfügbar») */
export function changeRequestAvailable(state: SimState, ctx: Ctx, crId: string): boolean {
  const cr = ctx.changeRequests[crId]
  if (!cr) return false
  const status = state.changeRequests[crId]
  if (status === "verfuegbar") return true
  if (status !== undefined) return false
  return cr.availableWhen === undefined || evalCondition(state, ctx, cr.availableWhen, newMemo())
}
