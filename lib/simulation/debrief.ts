// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// lib/simulation/debrief.ts
// Nachbesprechung: Wendepunkte und Lessons Learned (Spezifikation 3.14).

import { getCtx, type Ctx } from "./context"
import { computeSchedule } from "./schedule"
import { historyMean, scoreState } from "./score"
import { fitDetail } from "./work"
import type { Debrief, KpiPoint, LessonLearned, Scenario, SimState, TimelineEntry } from "./types"

const WINDOW_TICKS = 10 // 5 Tage

function kpiDistance(a: KpiPoint, b: KpiPoint, siStart: number): number {
  // Summe |Δ| in Prozentpunkten über SPI, CPI, QI, Teammotivation, SI (3.14)
  return (
    Math.abs(a.spi - b.spi) * 100 +
    Math.abs(a.cpi - b.cpi) * 100 +
    Math.abs(a.qi - b.qi) +
    Math.abs(a.motivation - b.motivation) +
    (siStart > 0 ? (Math.abs(a.si - b.si) / siStart) * 100 : 0)
  )
}

function pointAt(history: KpiPoint[], tick: number): KpiPoint | null {
  let best: KpiPoint | null = null
  for (const h of history) if (h.tick <= tick) best = h
  return best ?? history[0] ?? null
}

/** Wendepunkte (3.14): höchstens 8, nach Grösse sortiert */
function turningPoints(state: SimState, ctx: Ctx): TimelineEntry[] {
  const out: TimelineEntry[] = []
  for (const entry of state.timeline) {
    if (entry.kind === "entscheid") {
      const [eventId, optionId] = entry.ref.split("/")
      const option = ctx.events[eventId]?.options.find((o) => o.id === optionId)
      if (!option || option.rating === "mittel") continue
      const a = pointAt(state.history, entry.tick - 1)
      const b = pointAt(state.history, entry.tick + WINDOW_TICKS)
      const size = a && b ? kpiDistance(a, b, ctx.siStart) : 0
      out.push({ ...entry, magnitude: Math.max(5, size) })
    } else if (entry.kind === "standard" || entry.kind === "risiko" || entry.kind === "meilenstein" || entry.kind === "bericht") {
      out.push(entry)
    }
  }
  // Kennzahl-Sprung: SPI, CPI, QI, Teammotivation oder SI ändert sich innert 5 Tagen um ≥ 10 Prozentpunkte
  const keys: Array<{ key: keyof KpiPoint; label: string; factor: number }> = [
    { key: "spi", label: "SPI", factor: 100 },
    { key: "cpi", label: "CPI", factor: 100 },
    { key: "qi", label: "Qualität", factor: 1 },
    { key: "motivation", label: "Teammotivation", factor: 1 },
    { key: "si", label: "Stakeholder", factor: ctx.siStart > 0 ? 100 / ctx.siStart : 0 },
  ]
  for (const { key, label, factor } of keys) {
    let lastJumpTick = -Infinity
    for (let i = WINDOW_TICKS; i < state.history.length; i++) {
      const now = state.history[i]
      const then = state.history[i - WINDOW_TICKS]
      const delta = (now[key] - then[key]) * factor
      if (Math.abs(delta) >= 10 && now.tick - lastJumpTick > WINDOW_TICKS) {
        lastJumpTick = now.tick
        out.push({
          tick: now.tick,
          kind: "vorgang",
          ref: `kennzahl:${String(key)}`,
          text: `${label} ${delta > 0 ? "steigt" : "fällt"} innert 5 Tagen um ${Math.abs(delta).toFixed(0)} Prozentpunkte`,
          magnitude: Math.abs(delta),
        })
      }
    }
  }
  return out.sort((a, b) => b.magnitude - a.magnitude || a.tick - b.tick).slice(0, 8)
}

function lesson(id: string, text: string, stations: string[], icb: string[], lostPoints: number, positive = false): LessonLearned {
  return { id, text, stations, icb, lostPoints, positive }
}

/** Mittlere Passung (allein) auf einem Vorgang, gewichtet nach Stunden */
function meanFit(state: SimState, ctx: Ctx, taskId: string): number | null {
  const task = state.tasks[taskId]
  let num = 0
  let den = 0
  for (const [pid, h] of Object.entries(task.hoursByPerson)) {
    num += h * fitDetail(state.people[pid].profile, ctx.tasks[taskId].profile, [], ctx.params).fit
    den += h
  }
  return den > 0 ? num / den : null
}

/** Lessons Learned (3.14): regelbasiert, höchstens 5, nach entgangenen Punkten sortiert */
function lessons(state: SimState, ctx: Ctx, scenario: Scenario): LessonLearned[] {
  const out: LessonLearned[] = []
  const result = state.result ?? scoreState(state, scenario)
  const s = result.score
  const target = scenario.calendar.targetDay
  const critical = computeSchedule(scenario).filter((r) => r.critical).map((r) => r.taskId)

  const weakCritical = critical.some((id) => {
    const fit = meanFit(state, ctx, id)
    const people = Object.keys(state.tasks[id].hoursByPerson)
    const onlyPartTime = people.length > 0 && people.every((pid) => ctx.people[pid].pensum < 1)
    return (fit !== null && fit < 0.8) || onlyPartTime
  })
  if (weakCritical) {
    out.push(lesson("L01", "Beste Leute auf den kritischen Pfad, Pensum einrechnen.", ["10-netzplan-und-gantt", "11-ressourcen-und-kosten"], ["3.04", "3.08"], 250 - s.termin))
  }
  if (state.stats.lateDefectsFound >= 10) {
    out.push(lesson("L02", "Reviews sind günstiger als Korrektur im Test.", ["20-qualitaet-und-aenderungen"], ["3.06"], 200 - s.qualitaet))
  }
  if (ctx.personIds.some((pid) => state.people[pid].overtimeTotalDays > 10)) {
    out.push(lesson("L03", "Überstunden helfen kurz, schaden lang.", ["11-ressourcen-und-kosten", "17-persoenliche-kompetenzen"], ["2.05"], 100 - s.team))
  }
  if (state.stats.defaults >= 1) {
    out.push(lesson("L04", "Aufschieben ist teuer: entscheiden oder delegieren.", ["17-persoenliche-kompetenzen"], ["2.10"], 15 * state.stats.defaults))
  }
  if (state.reports.some((r) => r.honesty < 70)) {
    out.push(lesson("L05", "Ehrlich berichten, Massnahmen und Anträge mitbringen.", ["19-statusbericht"], ["2.02", "3.10"], 100 - s.fuehrung))
  }
  const meanRmi = historyMean(state, "rmi")
  if (state.history.length > 0 && meanRmi < 80) {
    out.push(lesson("L06", "Risikoregister wöchentlich pflegen.", ["13-chancen-und-risiken"], ["3.11"], (30 * (120 - meanRmi)) / 120))
  }
  if (state.history.filter((h) => h.motivation < 75).length > 10) {
    out.push(lesson("L07", "Gespräche und Anlässe gezielt einsetzen.", ["16-fuehrung-team-meetings"], ["2.05", "2.06"], 100 - s.team))
  }
  if (ctx.stakeholderIds.some((id) => state.stakeholders[id] < 40)) {
    out.push(lesson("L08", "Stakeholder aktiv bewirtschaften.", ["14-stakeholder"], ["3.12"], 150 - s.stakeholder))
  }
  // Umfang ohne Antrag geändert (Ereignis-IDs aus 2.7)
  const scopeWithoutCr = ["E02/B", "E11/B", "E13/B", "E28/B"]
  if (state.decisions.some((d) => scopeWithoutCr.includes(`${d.eventId}/${d.optionId}`))) {
    out.push(lesson("L09", "Änderungen über den Änderungsprozess steuern.", ["06-leistungsumfang-und-arbeitspakete", "20-qualitaet-und-aenderungen"], ["3.03"], 20))
  }
  if (state.stats.idleCoreDays > 5) {
    out.push(lesson("L10", "Ressourcen ausgleichen, Prioritäten B–F nutzen.", ["11-ressourcen-und-kosten"], ["3.08"], state.stats.idleCoreDays))
  }
  const lineConflicts = ["E05/B", "E05/C", "E25/C"]
  if (state.decisions.some((d) => lineConflicts.includes(`${d.eventId}/${d.optionId}`))) {
    out.push(lesson("L11", "Mit der Linie über Interessen verhandeln.", ["15-organisation-und-rollen"], ["1.04"], 15))
  }
  if (state.finance.ac > state.finance.budget && state.finance.budgetSupplements === 0) {
    out.push(lesson("L12", "Abweichung früh melden und Nachtrag beantragen.", ["18-earned-value"], ["3.07"], 200 - s.kosten))
  }
  if (state.reports.some((r) => r.board?.phaseRelease === "mitAuflage")) {
    out.push(lesson("L13", "Meilensteine sind Qualitätstore.", ["03-hermes"], ["3.01", "1.02"], 13))
  }
  if (result.ended === "fertig" && result.endDay <= target - 2) {
    out.push(lesson("L14", "Gut gemacht: Plan und Steuerung haben getragen.", ["10-netzplan-und-gantt", "18-earned-value"], ["3.04", "3.10"], 0, true))
  }
  if (result.ended === "fertig" && result.restmaengel <= 3) {
    out.push(lesson("L15", "Gut gemacht: Qualität von Anfang an.", ["20-qualitaet-und-aenderungen"], ["3.06"], 0, true))
  }
  return out
    .sort((a, b) => Number(a.positive) - Number(b.positive) || b.lostPoints - a.lostPoints || (a.id < b.id ? -1 : 1))
    .slice(0, 5)
}

/** Nachbesprechung (3.14) */
export function debrief(state: SimState, scenario: Scenario): Debrief {
  const ctx = getCtx(scenario)
  return {
    turningPoints: turningPoints(state, ctx),
    lessons: lessons(state, ctx, scenario),
    reports: state.reports.map((r) => ({
      kind: r.kind,
      tick: r.tick,
      reported: r.input,
      truth: r.truth,
      honesty: r.honesty,
      findings: r.findings,
    })),
    result: state.result,
  }
}
