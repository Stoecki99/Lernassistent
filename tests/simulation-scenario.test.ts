// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// tests/simulation-scenario.test.ts
// Netzplan und Szenario (Spezifikation 5.2): computeSchedule ergibt die Tabelle aus 2.4,
// BAC, Aufwand, Budget und Einführungslauf stimmen.

import { describe, test } from "node:test"
import assert from "node:assert/strict"
import { computeSchedule, loadScenario, type Scenario } from "@/lib/simulation"

function scenario(id: string): Scenario {
  const s = loadScenario(id)
  if (!s) throw new Error(`Szenario ${id} fehlt`)
  return s
}

/** Tabelle «Netzplan und kritischer Pfad» aus 2.4: Dauer, FA, FE, SA, SE, GP, FP */
const NETZPLAN: Record<string, [number, number, number, number, number, number, number]> = {
  V01: [2, 0, 2, 0, 2, 0, 0],
  V02: [4, 2, 6, 2, 6, 0, 0],
  V03: [3, 2, 5, 4, 7, 2, 0],
  V04: [3, 6, 9, 6, 9, 0, 0],
  V05: [8, 6, 14, 7, 15, 1, 1],
  V06: [4, 6, 10, 11, 15, 5, 5],
  V07: [4, 5, 9, 11, 15, 6, 6],
  V08: [3, 6, 9, 12, 15, 6, 6],
  V09: [4, 9, 13, 9, 13, 0, 0],
  V10: [2, 13, 15, 13, 15, 0, 0],
  V11: [3, 15, 18, 15, 18, 0, 0],
  V12: [2, 18, 20, 18, 20, 0, 0],
  V13: [4, 13, 17, 17, 21, 4, 3],
  V14: [3, 9, 12, 21, 24, 12, 12],
  V15: [3, 20, 23, 21, 24, 1, 1],
  V16: [4, 20, 24, 20, 24, 0, 0],
  V17: [8, 24, 32, 24, 32, 0, 0],
  V18: [4, 32, 36, 32, 36, 0, 0],
}
const KRITISCH = ["V01", "V02", "V04", "V09", "V10", "V11", "V12", "V16", "V17", "V18"]

function near(actual: number, expected: number, label: string): void {
  assert.ok(Math.abs(actual - expected) < 1e-9, `${label}: ${actual} statt ${expected}`)
}

describe("Netzplan Wolkenried (2.4)", () => {
  const sc = scenario("wolkenried")
  const rows = computeSchedule(sc)

  test("FA, FE, SA, SE, GP, FP wie Tabelle 2.4", () => {
    assert.deepEqual(rows.map((r) => r.taskId).sort(), Object.keys(NETZPLAN).sort())
    for (const row of rows) {
      const [d, fa, fe, sa, se, gp, fp] = NETZPLAN[row.taskId]
      near(row.duration, d, `${row.taskId} Dauer`)
      near(row.es, fa, `${row.taskId} FA`)
      near(row.ef, fe, `${row.taskId} FE`)
      near(row.ls, sa, `${row.taskId} SA`)
      near(row.lf, se, `${row.taskId} SE`)
      near(row.totalFloat, gp, `${row.taskId} GP`)
      near(row.freeFloat, fp, `${row.taskId} FP`)
    }
  })

  test("Ende 36, kritischer Pfad V01 → V02 → V04 → V09 → V10 → V11 → V12 → V16 → V17 → V18", () => {
    near(Math.max(...rows.map((r) => r.ef)), 36, "Projektende")
    const critical = rows.filter((r) => r.critical).map((r) => r.taskId).sort()
    assert.deepEqual(critical, [...KRITISCH].sort())
  })

  test("calendar.planEndDay stimmt mit der Rechnung überein, Terminziel 40", () => {
    near(sc.calendar.planEndDay, Math.max(...rows.map((r) => r.ef)), "planEndDay")
    assert.equal(sc.calendar.targetDay, 40)
  })

  test("BAC 162'240, Σ Aufwand 1'072 h, Budget 180'000", () => {
    const effort = sc.tasks.reduce((s, t) => s + t.effortHours, 0)
    const bac = sc.tasks.reduce((s, t) => s + t.effortHours * t.plannedRate, 0)
    assert.equal(effort, 1072)
    assert.equal(bac, 162_240)
    assert.equal(sc.budget.total, 180_000)
    assert.equal(sc.budget.total - bac, 17_760)
  })
})

describe("Einführungslauf «Hundeanmeldung online» (2.10)", () => {
  const sc = scenario("einfuehrung")
  const rows = computeSchedule(sc)

  test("Ende 7.5, kritischer Pfad H1, H2, H5, H6", () => {
    near(Math.max(...rows.map((r) => r.ef)), 7.5, "Projektende")
    assert.deepEqual(rows.filter((r) => r.critical).map((r) => r.taskId).sort(), ["H1", "H2", "H5", "H6"])
    near(sc.calendar.planEndDay, 7.5, "planEndDay")
  })

  test("BAC 14'960 (136 h × 110), Kredit 16'500", () => {
    assert.equal(sc.tasks.reduce((s, t) => s + t.effortHours, 0), 136)
    assert.equal(sc.tasks.reduce((s, t) => s + t.effortHours * t.plannedRate, 0), 14_960)
    assert.equal(sc.budget.total, 16_500)
  })
})
