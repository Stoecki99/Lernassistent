// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// tests/simulation-schema.test.ts
// Zod-Schemas des Leitstands: Szenario (an der Fixture), Aktionen, API-Eingaben (Spezifikation 5.5).
// Die Prüfung der echten Szenarien (wolkenried, einfuehrung) gehört zu AP2.

import { test, describe } from "node:test"
import assert from "node:assert/strict"
import {
  actionSchema,
  appendActionsSchema,
  createRunSchema,
  runIdSchema,
  scenarioSchema,
  statusReportInputSchema,
} from "@/lib/validations/simulation"
import { rawFixture } from "./helpers/simulation-mini"

type Json = Record<string, unknown>

function mutate(fn: (s: Json & { tasks: Json[]; events: Json[]; people: Json[] }) => void): Json {
  const s = rawFixture() as Json & { tasks: Json[]; events: Json[]; people: Json[] }
  fn(s)
  return s
}

function messages(raw: unknown): string {
  const r = scenarioSchema.safeParse(raw)
  return r.success ? "" : r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(" | ")
}

describe("Szenario-Schema (4.4) an der Fixture", () => {
  test("Fixture ist gültig", () => {
    assert.equal(messages(rawFixture()), "")
  })

  const invalid: Array<[string, (s: Json & { tasks: Json[]; events: Json[]; people: Json[] }) => void, RegExp]> = [
    ["doppelte ID", (s) => { s.tasks[1].id = "V01" }, /Doppelte ID V01/],
    ["unbekannter Vorgänger", (s) => { s.tasks[1].predecessors = ["V09"] }, /Unbekannter Vorgänger V09/],
    ["Zyklus", (s) => { s.tasks[0].predecessors = ["V02"] }, /Zyklus/],
    ["Profilwert 7", (s) => { s.tasks[0].profile = [7, 0, 0, 0, 0] }, /tasks\.0\.profile/],
    ["ICB 3.14", (s) => { s.events[0].icb = ["3.14"] }, /ICB/],
    ["unbekannte Station", (s) => { s.events[0].stations = ["99-gibt-es-nicht"] }, /Unbekannte Station/],
    ["Aufschub ohne defaultOptionId", (s) => { delete s.events[0].defaultOptionId }, /braucht defaultOptionId/],
    ["Text zu lang", (s) => { s.events[0].body = "x".repeat(901) }, /zu lang/],
    ["unbekannte Person in Wirkung", (s) => {
      ;(s.events[2].options as Json[])[1].effects = [{ type: "motivation", target: "P77", delta: 1 }]
    }, /Unbekannte Person P77/],
    ["Folgeereignis mit unbekannter Option", (s) => { (s.events[4].trigger as Json).optionId = "Z" }, /Unbekannte Option Z/],
    ["Phase R nach Phase E", (s) => { s.tasks[3].phase = "R"; s.tasks[2].phase = "E"; s.tasks[3].predecessors = ["V03"] }, /Phase R/],
    ["Entscheid ohne Option «gut»", (s) => {
      for (const o of s.events[1].options as Json[]) o.rating = "mittel"
    }, /keine Option mit Bewertung/],
    ["unbekanntes Feld", (s) => { s.tasks[0].extra = 1 }, /tasks\.0/],
  ]
  for (const [name, fn, pattern] of invalid) {
    test(`abgelehnt: ${name}`, () => {
      const text = messages(mutate(fn))
      assert.match(text, pattern, text || "(gültig)")
    })
  }

  test("IDs H1, E20b und CR1 sind gültig", () => {
    const text = messages(
      mutate((s) => {
        s.events[0].id = "E20b"
        ;(s.events[4].trigger as Json).eventId = "E20b"
        s.tasks[0].id = "H1"
        s.tasks[1].predecessors = ["H1"]
        s.tasks[2].predecessors = ["H1"]
        ;(s.tasks[3].test as Json).covers = ["H1", "V02", "V03"]
      }),
    )
    assert.equal(text, "")
  })
})

describe("Aktionen (4.3)", () => {
  const report = {
    ampeln: { gesamt: "gelb", termine: "gelb", kosten: "gruen", qualitaet: "gruen", team: "gruen", risiken: "rot" },
    progressPercent: 50,
    forecastEndDay: 38,
    forecastCostChf: 170000,
    deviations: "",
    measures: ["M1"],
    measuresText: "",
    budgetSupplementChf: 0,
    changeRequestIds: ["CR1"],
  }
  const valid: unknown[] = [
    { type: "assign", personId: "P01", taskId: "V01" },
    { type: "assign", personId: "P01", taskId: "V01", position: 0, share: 0.5 },
    { type: "unassign", personId: "P01", taskId: "V01" },
    { type: "reorder", personId: "P01", taskIds: ["V02", "V01"] },
    { type: "setShare", personId: "P01", taskId: "V01", share: 0.75 },
    { type: "setOvertime", personId: "P01", level: 2 },
    { type: "setReviews", taskId: "V01", count: 3 },
    { type: "startPeriod" },
    { type: "advance", ticks: 1 },
    { type: "advance", ticks: 100 },
    { type: "decide", eventId: "E01", optionId: "A" },
    { type: "decide", eventId: "E20b", optionId: "B" },
    { type: "defer", eventId: "E01" },
    { type: "acknowledge", eventId: "E39" },
    { type: "talk", personId: "P01" },
    { type: "teamEvent", kind: "mittagessen", personIds: ["P01", "P02"] },
    { type: "training", personId: "P07", area: "ux" },
    { type: "riskMeasure", riskId: "R01", measureId: "M1" },
    { type: "riskAccept", riskId: "R01" },
    { type: "riskReview" },
    { type: "submitReport", report },
  ]
  test("jede Art gültig", () => {
    for (const a of valid) assert.equal(actionSchema.safeParse(a).success, true, JSON.stringify(a))
  })

  const invalidActions: unknown[] = [
    { type: "fly" },
    {},
    { type: "assign", personId: "P01", taskId: "V01", share: 0.3 },
    { type: "assign", personId: "../P01", taskId: "V01" },
    { type: "assign", personId: "P01" },
    { type: "unassign", personId: "P01", taskId: 5 },
    { type: "reorder", personId: "P01", taskIds: "V01" },
    { type: "setShare", personId: "P01", taskId: "V01", share: 0 },
    { type: "setOvertime", personId: "P01", level: 3 },
    { type: "setReviews", taskId: "V01", count: 4 },
    { type: "startPeriod", now: true },
    { type: "advance", ticks: 0 },
    { type: "advance", ticks: 101 },
    { type: "advance", ticks: 1.5 },
    { type: "decide", eventId: "E01", optionId: "AA" },
    { type: "defer" },
    { type: "acknowledge", eventId: "" },
    { type: "talk", personId: "p01" },
    { type: "teamEvent", kind: "grillfest", personIds: ["P01"] },
    { type: "teamEvent", kind: "teamabend", personIds: [] },
    { type: "training", personId: "P01", area: "xyz" },
    { type: "riskMeasure", riskId: "R01" },
    { type: "riskAccept" },
    { type: "riskReview", extra: 1 },
    { type: "submitReport", report: { ...report, ampeln: { ...report.ampeln, gesamt: "orange" } } },
    { type: "submitReport", report: { ...report, deviations: "x".repeat(1001) } },
    { type: "submitReport", report: { ...report, progressPercent: 101 } },
    { type: "submitReport", report: { ...report, forecastEndDay: 0 } },
    { type: "submitReport", report: { ...report, budgetSupplementChf: 100001 } },
  ]
  test("ungültige Aktionen werden abgelehnt", () => {
    for (const a of invalidActions) assert.equal(actionSchema.safeParse(a).success, false, JSON.stringify(a).slice(0, 120))
  })

  test("Statusbericht: alle sechs Ampeln Pflicht", () => {
    const { risiken: _ignored, ...rest } = report.ampeln
    void _ignored
    assert.equal(statusReportInputSchema.safeParse({ ...report, ampeln: rest }).success, false)
    assert.equal(statusReportInputSchema.safeParse(report).success, true)
  })
})

describe("API-Eingaben (4.6)", () => {
  const action = { type: "advance", ticks: 1 }
  test("fromIndex, Länge der Aktionsliste", () => {
    assert.equal(appendActionsSchema.safeParse({ fromIndex: 0, actions: [action] }).success, true)
    assert.equal(appendActionsSchema.safeParse({ fromIndex: -1, actions: [action] }).success, false)
    assert.equal(appendActionsSchema.safeParse({ fromIndex: 1.5, actions: [action] }).success, false)
    assert.equal(appendActionsSchema.safeParse({ fromIndex: 0, actions: [] }).success, false)
    assert.equal(appendActionsSchema.safeParse({ fromIndex: 0, actions: Array(201).fill(action) }).success, false)
    assert.equal(appendActionsSchema.safeParse({ fromIndex: 0, actions: Array(200).fill(action) }).success, true)
    assert.equal(appendActionsSchema.safeParse({ fromIndex: 0, actions: [{ type: "fly" }] }).success, false)
  })
  test("scenarioId ohne Pfadteile, Lauf-ID als cuid", () => {
    assert.equal(createRunSchema.safeParse({ scenarioId: "wolkenried" }).success, true)
    for (const scenarioId of ["../wolkenried", "Wolkenried", "a/b", "", "x".repeat(41)]) {
      assert.equal(createRunSchema.safeParse({ scenarioId }).success, false, scenarioId)
    }
    assert.equal(createRunSchema.safeParse({ scenarioId: "wolkenried", repeatOfRunId: "../x" }).success, false)
    assert.equal(runIdSchema.safeParse("cjld2cjxh0000qzrmn831i7rn").success, true)
    assert.equal(runIdSchema.safeParse("1; DROP TABLE").success, false)
  })
})
