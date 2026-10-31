// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// tests/helpers/simulation-mini.ts
// Testhilfen für den Rechenkern: Mini-Szenario (Fixture) laden und mit einem einfachen Roboter durchspielen.
// Nur für Tests, nicht im Produktivcode.

import fs from "node:fs"
import path from "node:path"
import { applyAction, computeKpis, createRun, type Action, type Scenario, type SimState } from "@/lib/simulation"
import { parseScenario } from "@/lib/validations/simulation"

export const FIXTURE_PATH = path.join(process.cwd(), "tests", "fixtures", "mini-szenario.json")

export function rawFixture(): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(FIXTURE_PATH, "utf8")) as Record<string, unknown>
}

let cached: Scenario | null = null
export function miniScenario(): Scenario {
  if (!cached) cached = parseScenario(rawFixture())
  return cached
}

/** Ehrlicher Bericht: Wahrheit übernehmen, Massnahmen für alle nicht grünen Bereiche */
export function honestReport(state: SimState, scenario: Scenario): Extract<Action, { type: "submitReport" }>["report"] {
  const k = computeKpis(state, scenario)
  const areas = (["termine", "kosten", "qualitaet", "team", "risiken"] as const).filter((a) => k.ampeln[a] !== "gruen")
  const measures = scenario.reportMeasures.filter((m) => m.areas.some((a) => areas.includes(a))).map((m) => m.id)
  return {
    ampeln: { ...k.ampeln },
    progressPercent: Math.round((k.ev / Math.max(1, k.bac)) * 100),
    forecastEndDay: Math.min(60, Math.max(1, Math.ceil(k.forecastEndDay))),
    forecastCostChf: Math.min(1_000_000, Math.ceil(k.eac)),
    deviations: "Abweichungen begründet.",
    measures,
    measuresText: "",
    budgetSupplementChf: 0,
    changeRequestIds: [],
  }
}

/** Erste Option mit Bewertung «gut», sonst die erste */
export function goodOption(scenario: Scenario, eventId: string): Action {
  const def = scenario.events.find((e) => e.id === eventId)
  if (!def) throw new Error(`Ereignis ${eventId} fehlt`)
  if (def.options.length === 1) return { type: "acknowledge", eventId }
  const option = def.options.find((o) => o.rating === "gut") ?? def.options[0]
  return { type: "decide", eventId, optionId: option.id }
}

/** Einfacher Roboter «gut» für das Mini-Szenario: liefert Endzustand und Aktionsprotokoll */
export function playMini(seed: number, scenario: Scenario = miniScenario(), ticksPerStep = 4): { state: SimState; actions: Action[] } {
  let state = createRun(scenario, seed)
  const actions: Action[] = []
  const act = (a: Action) => {
    state = applyAction(state, a, scenario)
    actions.push(a)
  }
  const plan: Array<[string, string]> = [
    ["P01", "V01"], ["P01", "V04"], ["P02", "V02"], ["P02", "V04"], ["P03", "V03"], ["P01", "V02"],
  ]
  for (const [p, t] of plan) act({ type: "assign", personId: p, taskId: t })
  act({ type: "setReviews", taskId: "V02", count: 1 })
  act({ type: "riskMeasure", riskId: "R01", measureId: "M1" })
  act({ type: "riskReview" })
  act({ type: "startPeriod" })
  for (let guard = 0; guard < 500 && state.phase !== "abgeschlossen"; guard++) {
    const open = state.inbox.find((i) => i.status === "neu")
    if (open) {
      act(goodOption(scenario, open.eventId))
      continue
    }
    if (state.phase === "lauf") act({ type: "advance", ticks: ticksPerStep })
    else if (state.phase === "planung") act({ type: "startPeriod" })
    else act({ type: "submitReport", report: honestReport(state, scenario) })
  }
  return { state, actions }
}
