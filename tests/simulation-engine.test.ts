// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// tests/simulation-engine.test.ts
// Einheitentests des Rechenkerns (Spezifikation 5.1). Ausführen: npm test

import { test, describe } from "node:test"
import assert from "node:assert/strict"
import {
  applyAction,
  computeScore,
  computeSchedule,
  createRun,
  formatTick,
  replay,
  scoreFuehrung,
  scoreKosten,
  scoreQualitaet,
  scoreStakeholder,
  scoreTeam,
  scoreTermin,
  SimError,
  starsFor,
  type Action,
  type Profile,
  type Scenario,
  type SimErrorCode,
  type SimState,
  type TaskDef,
} from "@/lib/simulation"
import { dayOf, halfOf, weekdayName, weekOf } from "@/lib/simulation/calendar"
import { getCtx } from "@/lib/simulation/context"
import { deadlineTick, scaleEffect } from "@/lib/simulation/events"
import { earnedValue, plannedValue } from "@/lib/simulation/kpi"
import { DEFAULT_PARAMS } from "@/lib/simulation/params"
import { newDefects, qualityIndexFromRho, runReviews, runTest } from "@/lib/simulation/quality"
import { assessHonesty, boardDecision } from "@/lib/simulation/report"
import { REPORT_FORECAST_DAY_MAX } from "@/lib/simulation/types"
import { hazardPerTick } from "@/lib/simulation/risk"
import { dayEndPeople, talk } from "@/lib/simulation/team"
import {
  fitDetail,
  grossCapacity,
  isWorkable,
  learnFactor,
  motivationFactor,
  overtimeFactor,
  teamFactor,
  workTick,
} from "@/lib/simulation/work"
import { honestReport, miniScenario, playMini } from "./helpers/simulation-mini"

const P = DEFAULT_PARAMS
const near = (actual: number, expected: number, digits: number, msg?: string) =>
  assert.ok(Math.abs(actual - expected) < 0.5 * 10 ** -digits, `${msg ?? ""} erwartet ${expected}, erhalten ${actual}`)

function expectSimError(fn: () => unknown, code: SimErrorCode): SimError {
  try {
    fn()
  } catch (error) {
    assert.ok(error instanceof SimError, `SimError erwartet, erhalten ${String(error)}`)
    assert.equal(error.code, code, error.message)
    return error
  }
  assert.fail(`SimError ${code} erwartet`)
}

/** Arbeitskopie mit freier Hand für Tests der internen Module */
function fresh(seed = 1): { s: SimState; sc: Scenario } {
  const sc = miniScenario()
  return { s: createRun(sc, seed), sc }
}

// Profile aus Spezifikation 2.4 und 2.5 (nur Zahlen, für Referenzwerte der Passung)
const PERSON: Record<string, Profile> = {
  seraina: [6, 0, 2, 3, 4],
  luca: [2, 3, 5, 2, 2],
  martin: [5, 0, 1, 1, 2],
  nadia: [1, 0, 0, 3, 6],
  marco: [2, 6, 4, 2, 2],
  elena: [0, 5, 6, 1, 1],
}

// Vorgänge V01–V18 aus Spezifikation 2.4: [id, phase, Vorgänger, Aufwand, Personen, Plansatz, Profil]
const WOLKENRIED_TASKS: Array<[string, "R" | "E", string[], number, number, number, Profile]> = [
  ["V01", "R", [], 48, 3, 155, [3, 1, 1, 1, 4]],
  ["V02", "R", ["V01"], 64, 2, 120, [6, 0, 2, 3, 2]],
  ["V03", "R", ["V01"], 24, 1, 195, [0, 5, 4, 0, 0]],
  ["V04", "R", ["V02"], 48, 2, 150, [2, 1, 0, 6, 3]],
  ["V05", "R", ["V02", "V03"], 128, 2, 195, [1, 5, 6, 0, 0]],
  ["V06", "R", ["V02", "V03"], 32, 1, 165, [3, 4, 4, 1, 0]],
  ["V07", "R", ["V03"], 64, 2, 120, [4, 0, 5, 0, 0]],
  ["V08", "R", ["V02"], 48, 2, 165, [2, 2, 5, 0, 3]],
  ["V09", "R", ["V03", "V04"], 64, 2, 165, [4, 5, 2, 3, 0]],
  ["V10", "R", ["V09"], 32, 2, 165, [5, 4, 2, 1, 1]],
  ["V11", "R", ["V05", "V06", "V07", "V08", "V10"], 48, 2, 160, [3, 4, 4, 2, 0]],
  ["V12", "R", ["V11"], 48, 3, 125, [5, 1, 2, 2, 3]],
  ["V13", "R", ["V09"], 64, 2, 120, [4, 0, 0, 3, 5]],
  ["V14", "R", ["V04"], 24, 1, 115, [2, 0, 0, 3, 6]],
  ["V15", "E", ["V12", "V13"], 48, 2, 120, [4, 0, 0, 2, 6]],
  ["V16", "E", ["V12"], 64, 2, 130, [2, 3, 4, 1, 3]],
  ["V17", "E", ["V14", "V15", "V16"], 128, 2, 160, [4, 4, 3, 4, 3]],
  ["V18", "E", ["V17"], 96, 3, 155, [4, 3, 3, 1, 4]],
]
const TASK_PROFILE: Record<string, Profile> = Object.fromEntries(WOLKENRIED_TASKS.map((t) => [t[0], t[6]]))

/** Mini-Szenario mit dem Netzplan aus 2.4 (ohne Ereignisse und Risiken), für PV und Netzplan */
function wolkenriedNetwork(): Scenario {
  const base = miniScenario()
  const tasks: TaskDef[] = WOLKENRIED_TASKS.map(([id, phase, predecessors, effortHours, plannedPersons, plannedRate, profile]) => ({
    id, name: id, description: id, phase, predecessors, effortHours, plannedPersons, plannedRate, profile,
  }))
  return {
    ...base,
    id: "netz-test",
    tasks,
    events: [],
    risks: [],
    changeRequests: [],
    phases: [
      { id: "R", label: "R", gateTick: null },
      { id: "E", label: "E", gateTick: 40 },
    ],
    calendar: { ...base.calendar, targetDay: 40, planEndDay: 36, hardStopTick: 100 },
  }
}

describe("Kalender (3.1)", () => {
  test("Takt 0, 7, 39", () => {
    assert.equal(formatTick(0), "Mo, Woche 1 · Tag 1 · Vormittag")
    assert.equal(formatTick(7), "Do, Woche 1 · Tag 4 · Nachmittag")
    assert.equal(formatTick(39), "Fr, Woche 4 · Tag 20 · Nachmittag")
    assert.equal(weekdayName(39), "Fr")
    assert.equal(weekOf(39), 4)
    assert.equal(dayOf(39), 19)
    assert.equal(halfOf(7), 1)
  })
  test("Fristen: Woche endet Freitag Nachmittag, Freitag-Mail Folgewoche", () => {
    assert.equal(deadlineTick({ type: "woche" }, 3), 10) // Di VM → nach Fr NM (Takt 9)
    assert.equal(deadlineTick({ type: "woche" }, 8), 20) // Fr VM → nach Fr NM der Folgewoche
    assert.equal(deadlineTick({ type: "takte", ticks: 2 }, 6), 8)
    assert.equal(deadlineTick({ type: "keinAufschub" }, 6), null)
  })
})

describe("Passung (3.4, Anhang 8.1)", () => {
  const fit = (person: Profile, task: string, colleagues: Profile[] = []) => fitDetail(person, TASK_PROFILE[task], colleagues, P).fit
  test("Referenzwerte aus 3.4 auf 3 Nachkommastellen", () => {
    near(fit(PERSON.seraina, "V02"), 1.0, 3, "Seraina V02")
    near(fit(PERSON.martin, "V02"), 0.832, 3, "Martin V02")
    near(fit(PERSON.martin, "V02", [PERSON.seraina]), 0.832, 3, "Martin V02 mit Seraina")
    near(fit(PERSON.seraina, "V09"), 0.75, 3, "Seraina V09")
    near(fit(PERSON.seraina, "V09", [PERSON.marco]), 0.99, 3, "Seraina V09 mit Dario")
    near(fit(PERSON.elena, "V05"), 0.982, 3, "Elena V05")
  })
  test("Stichproben aus Tabelle 8.1 (2 Nachkommastellen)", () => {
    near(fit(PERSON.seraina, "V01"), 1.03, 2)
    near(fit(PERSON.seraina, "V05"), 0.46, 2)
    near(fit(PERSON.luca, "V16"), 0.99, 2)
    near(fit(PERSON.marco, "V03"), 1.02, 2)
    near(fit(PERSON.elena, "V03"), 1.05, 2)
    near(fit(PERSON.nadia, "V14"), 0.96, 2)
    near(fit(PERSON.nadia, "V05"), 0.35, 2)
  })
  test("Grenzen 0.35 und 1.15", () => {
    assert.equal(fitDetail([0, 0, 0, 0, 0], [6, 6, 6, 6, 6], [], P).fit, 0.35)
    assert.equal(fitDetail([6, 6, 6, 6, 6], [3, 3, 3, 3, 3], [], P).fit, 1.15)
  })
  test("fitFor über die Schnittstelle", async () => {
    const { fitFor } = await import("@/lib/simulation")
    const { s, sc } = fresh()
    assert.equal(fitFor(s, sc, "P01", "V01"), fitDetail(s.people.P01.profile, sc.tasks[0].profile, [], P).fit)
  })
})

describe("Kapazität (3.3)", () => {
  test("Pensum, Überstufe, Abwesenheit, availabilityOverrides", () => {
    const { s, sc } = fresh()
    const ctx = getCtx(sc)
    assert.equal(grossCapacity(s, ctx, "P01", 0), 4)
    assert.equal(grossCapacity(s, ctx, "P03", 0), 2)
    assert.equal(grossCapacity(s, ctx, "P03", 4), 1) // Tag 3: Pensum 0.25
    s.people.P01.overtime = 1
    near(grossCapacity(s, ctx, "P01", 0), 4.8, 9)
    s.people.P01.overtime = 2
    near(grossCapacity(s, ctx, "P01", 0), 5.6, 9)
    s.people.P01.absences.push({ fromTick: 0, toTick: 2, reason: "krank" })
    assert.equal(grossCapacity(s, ctx, "P01", 1), 0)
    assert.equal(grossCapacity(s, ctx, "P04", 0), 0) // verdeckt
  })
  test("Termine verringern die Kapazität und kosten Stunden × Satz", () => {
    const { s, sc } = fresh()
    const ctx = getCtx(sc)
    s.people.P01.assignments = [{ taskId: "V01", share: 1 }]
    talk(s, ctx, "P01", 0)
    workTick(s, ctx, 0)
    near(s.tasks.V01.paidHours, 3, 9)
    assert.equal(s.hours.fuehrung, 1)
    assert.equal(s.finance.byCategory.fuehrung, 100)
  })
})

describe("Verteilung (3.2)", () => {
  function setup() {
    const { s, sc } = fresh()
    s.tasks.V01.status = "fertig"
    return { s, sc, ctx: getCtx(sc) }
  }
  test("Priorität A vor B", () => {
    const { s, ctx } = setup()
    s.people.P01.assignments = [{ taskId: "V02", share: 1 }, { taskId: "V03", share: 1 }]
    workTick(s, ctx, 0)
    near(s.tasks.V02.paidHours, 4, 9)
    assert.equal(s.tasks.V03.paidHours, 0)
  })
  test("A blockiert → B", () => {
    const { s, ctx } = setup()
    s.tasks.V02.blockedUntilTick = 5
    s.people.P01.assignments = [{ taskId: "V02", share: 1 }, { taskId: "V03", share: 1 }]
    workTick(s, ctx, 0)
    assert.equal(s.tasks.V02.paidHours, 0)
    near(s.tasks.V03.paidHours, 4, 9)
  })
  test("Anteil 0.5 → Rest an B", () => {
    const { s, ctx } = setup()
    s.people.P01.assignments = [{ taskId: "V02", share: 0.5 }, { taskId: "V03", share: 1 }]
    workTick(s, ctx, 0)
    near(s.tasks.V02.paidHours, 2, 9)
    near(s.tasks.V03.paidHours, 2, 9)
  })
  test("Vorgänger nicht fertig → nicht bearbeitbar", () => {
    const { s, sc } = fresh()
    const ctx = getCtx(sc)
    assert.equal(isWorkable(s, ctx, "V02", 0), false)
    s.people.P02.assignments = [{ taskId: "V02", share: 1 }, { taskId: "V01", share: 1 }]
    workTick(s, ctx, 0)
    assert.equal(s.tasks.V02.paidHours, 0)
    assert.ok(s.tasks.V01.paidHours > 0)
  })
  test("Phasentor: E erst mit phaseReleased und ab gateTick", () => {
    const { s, ctx } = setup()
    for (const id of ["V02", "V03"]) s.tasks[id].status = "fertig"
    assert.equal(isWorkable(s, ctx, "V04", 12), false)
    s.flags.phaseReleased = true
    assert.equal(isWorkable(s, ctx, "V04", 9), false)
    assert.equal(isWorkable(s, ctx, "V04", 10), true)
  })
  test("Überschuss wird anteilig gekürzt", () => {
    const { s, sc } = fresh()
    const ctx = getCtx(sc)
    s.tasks.V01.remaining = 1
    s.people.P01.assignments = [{ taskId: "V01", share: 1 }]
    workTick(s, ctx, 0)
    assert.equal(s.tasks.V01.remaining, 0)
    near(s.tasks.V01.done, 1, 9)
    assert.ok(s.tasks.V01.paidHours < 4 && s.tasks.V01.paidHours > 1)
  })
})

describe("Leistung (3.4)", () => {
  test("Teamgrösse 0.95 / 0.88 / 0.79", () => {
    assert.equal(teamFactor(0, P), 1)
    near(teamFactor(1, P), 0.95, 9)
    near(teamFactor(2, P), 0.88, 9)
    near(teamFactor(3, P), 0.79, 9)
    assert.equal(teamFactor(10, P), 0.6)
  })
  test("Motivation und Überstunden-Serie", () => {
    assert.equal(motivationFactor(100), 1)
    near(motivationFactor(50), 0.8, 9)
    assert.equal(motivationFactor(120), 1.08)
    assert.equal(motivationFactor(0), 0.6)
    assert.equal(overtimeFactor(5), 1)
    near(overtimeFactor(10), 0.9, 9)
    assert.equal(overtimeFactor(30), 0.8)
  })
  test("Lernkurve: Start 0.9, nach 16 h im Hauptgebiet 1.0, lernt schnell nach 8 h", () => {
    const { s, sc } = fresh()
    const ctx = getCtx(sc)
    const p1 = s.people.P01
    assert.equal(learnFactor(p1, ctx.people.P01, "bau", 0, 16), 0.9)
    near(learnFactor(p1, ctx.people.P01, "bau", 8, 16), 0.95, 9)
    p1.hoursByArea.bau = 16
    assert.equal(learnFactor(p1, ctx.people.P01, "bau", 0, 16), 1)
    assert.equal(learnFactor(s.people.P04, ctx.people.P04, "ent", 8, 16), 1)
  })
  test("Mindestdauer: Vorgang dauert mindestens minDays bei beliebiger Besetzung", () => {
    const { state } = playMini(3)
    const v4 = state.tasks.V04
    assert.ok(v4.startTick !== null && v4.endTick !== null)
    assert.ok((v4.endTick - v4.startTick + 1) / 2 >= 2, `V04 dauert ${(v4.endTick - v4.startTick + 1) / 2} Tage`)
  })
})

describe("Qualität (3.6)", () => {
  test("Fehlerformel", () => {
    const base = { eff: 10, gap: 0, overtimeLevel: 0, overtimeStreak: 0, motivation: 100, traits: [], teamExcess: 0, defBase: 0.05 }
    near(newDefects(base), 0.5, 9)
    const worst = newDefects({ ...base, gap: 2, overtimeLevel: 1, overtimeStreak: 7, motivation: 70, traits: ["gruendlich"], teamExcess: 2 })
    near(worst, 10 * 0.05 * 1.3 * (1 + 0.15 + 0.04) * 1.1 * 0.8 * 1.1, 9)
    near(newDefects({ ...base, motivation: 50, traits: ["schnell"] }), 0.5 * 1.3 * 1.2, 9)
  })
  test("Review bei 50 % und 100 %", () => {
    const { s, sc } = fresh()
    const ctx = getCtx(sc)
    const v = s.tasks.V01
    v.reviews = 2
    v.done = 8
    v.remaining = 8
    v.latentDefects = 4
    assert.equal(runReviews(s, ctx, "V01"), 1)
    assert.equal(v.reviewsDone, 1)
    near(v.latentDefects, 2, 9)
    near(v.remaining, 8 + 0.03 * 16 + 2 * 1.0, 9)
    assert.equal(runReviews(s, ctx, "V01"), 0)
    v.done += v.remaining
    v.remaining = 0
    assert.equal(runReviews(s, ctx, "V01"), 1)
    assert.equal(v.reviewsDone, 2)
    near(s.stats.earlyDefectsFound, 3, 9)
  })
  test("Test findet 60 % beim Start, Korrektur 3 h im Testvorgang", () => {
    const base = miniScenario()
    const sc: Scenario = {
      ...base,
      id: "test-60",
      tasks: base.tasks.map((t) => (t.id === "V04" ? { ...t, test: { covers: ["V01", "V02", "V03"], detectionRate: 0.6 } } : t)),
    }
    const s = createRun(sc, 1)
    const ctx = getCtx(sc)
    for (const id of ["V01", "V02", "V03"]) s.tasks[id].latentDefects = 10
    assert.equal(runTest(s, ctx, "V04"), 0) // noch nicht gestartet
    s.tasks.V04.startTick = 12
    near(runTest(s, ctx, "V04"), 18, 9)
    near(s.tasks.V01.latentDefects, 4, 9)
    near(s.tasks.V04.remaining, 32 + 18 * 3, 9)
    assert.equal(s.tasks.V04.testDone, true)
    assert.equal(runTest(s, ctx, "V04"), 0)
  })
  test("QI 100 bei ρ = 2.5, Grenzen 0 und 130", () => {
    assert.equal(qualityIndexFromRho(2.5, 2.5), 100)
    assert.equal(qualityIndexFromRho(0, 2.5), 130)
    assert.equal(qualityIndexFromRho(10, 2.5), 0)
  })
})

describe("Kosten (3.5)", () => {
  test("Zuschlag 25 % nur auf den Überstundenanteil", () => {
    const { s, sc } = fresh()
    const ctx = getCtx(sc)
    s.people.P01.overtime = 1
    s.people.P01.assignments = [{ taskId: "V01", share: 1 }]
    workTick(s, ctx, 0)
    near(s.tasks.V01.paidHours, 4.8, 9)
    near(s.hours.ueberzeit, 0.8, 9)
    near(s.hours.arbeit, 4.0, 9)
    near(s.finance.byCategory.arbeit, 480, 9)
    near(s.finance.byCategory.ueberzeit, 20, 9)
  })
  test("Anlässe und Weiterbildung ohne Arbeitsstunden", () => {
    const sc = miniScenario()
    let s = createRun(sc, 1)
    s = applyAction(s, { type: "teamEvent", kind: "mittagessen", personIds: ["P01", "P02"] }, sc)
    assert.equal(s.finance.byCategory.anlass, 90)
    assert.equal(s.people.P01.motivation, 104)
    s = applyAction(s, { type: "teamEvent", kind: "teamabend", personIds: ["P03"] }, sc)
    assert.equal(s.finance.byCategory.anlass, 210)
    s = applyAction(s, { type: "training", personId: "P02", area: "ux" }, sc)
    assert.equal(s.finance.byCategory.weiterbildung, 1500)
    assert.equal(s.hours.arbeit, 0)
    assert.equal(grossCapacity(s, getCtx(sc), "P02", 3), 0)
    assert.equal(s.people.P02.pendingQualifications[0].readyTick, 14)
  })
})

describe("Motivation (3.7)", () => {
  test("Rückkehr zum Grundwert", () => {
    const { s, sc } = fresh()
    s.people.P01.motivation = 60
    dayEndPeople(s, getCtx(sc), 1, { P01: true, P02: true, P03: true, P04: true })
    near(s.people.P01.motivation, 60 + 0.03 * 25, 9)
  })
  test("Gespräch +8 / +12 / +2", () => {
    const sc = miniScenario()
    let s = createRun(sc, 1)
    s = applyAction(s, { type: "talk", personId: "P02" }, sc) // Autonomie: +8
    assert.equal(s.people.P02.motivation, 108)
    s = applyAction(s, { type: "talk", personId: "P01" }, sc) // Anerkennung: +12
    assert.equal(s.people.P01.motivation, 112)
    s = applyAction(s, { type: "talk", personId: "P01" }, sc) // < 5 Tage: +2
    assert.equal(s.people.P01.motivation, 114)
  })
  test("Klarheit: −3 ab der 3. Umplanung derselben Woche (im Lauf)", () => {
    const sc = miniScenario()
    let s = createRun(sc, 1)
    for (const t of ["V01", "V02", "V03"]) s = applyAction(s, { type: "assign", personId: "P03", taskId: t }, sc)
    assert.equal(s.people.P03.motivation, 90) // in der Planung ohne Wirkung
    s = applyAction(s, { type: "startPeriod" }, sc)
    s = applyAction(s, { type: "unassign", personId: "P03", taskId: "V02" }, sc)
    s = applyAction(s, { type: "assign", personId: "P03", taskId: "V02" }, sc)
    assert.equal(s.people.P03.motivation, 90)
    s = applyAction(s, { type: "setShare", personId: "P03", taskId: "V02", share: 0.5 }, sc)
    assert.equal(s.people.P03.motivation, 87)
  })
})

describe("Ereignisse (3.12, 2.7)", () => {
  function started(seed = 1) {
    const sc = miniScenario()
    let s = createRun(sc, seed)
    for (const [p, t] of [["P01", "V01"], ["P02", "V02"], ["P03", "V03"]]) s = applyAction(s, { type: "assign", personId: p, taskId: t }, sc)
    s = applyAction(s, { type: "startPeriod" }, sc)
    return { s, sc }
  }
  test("fester Takt hält die Zeit an; advance ändert dann nichts", () => {
    const { s: s0, sc } = started()
    const s1 = applyAction(s0, { type: "advance", ticks: 5 }, sc)
    assert.equal(s1.tick, 0)
    assert.equal(s1.pause, "ereignis")
    assert.deepEqual(s1.inbox.map((i) => [i.eventId, i.status]), [["E01", "neu"]])
    const s2 = applyAction(s1, { type: "advance", ticks: 5 }, sc)
    assert.deepEqual(s2, s1)
    const s3 = applyAction(applyAction(s2, { type: "decide", eventId: "E01", optionId: "A" }, sc), { type: "advance", ticks: 1 }, sc)
    assert.equal(s3.tick, 1)
    assert.equal(s3.flags.kickoff, "gut")
  })
  test("Frist → Standardentscheid, S04 −3, Zähler, S3; Folgeereignis", () => {
    let { s, sc } = started()
    s = applyAction(s, { type: "advance", ticks: 1 }, sc)
    s = applyAction(s, { type: "defer", eventId: "E01" }, sc)
    s = applyAction(s, { type: "advance", ticks: 3 }, sc)
    const item = s.inbox.find((i) => i.eventId === "E01")
    assert.equal(item?.status, "standard")
    assert.equal(item?.optionId, "C")
    assert.equal(s.stakeholders.S04, 67)
    assert.equal(s.stats.defaults, 1)
    assert.ok(s.timeline.some((e) => e.kind === "standard" && e.ref === "E01"))
    assert.ok(s.decisions.some((d) => d.eventId === "E01" && d.defaulted))
    // Folgeereignis E05: 4 Takte nach dem Entscheid E01 C (Takt 2) → Takt 6
    for (let i = 0; i < 10 && !s.inbox.some((x) => x.eventId === "E05"); i++) {
      const open = s.inbox.find((x) => x.status === "neu")
      s = open
        ? applyAction(s, { type: "decide", eventId: open.eventId, optionId: sc.events.find((e) => e.id === open.eventId)?.options[0].id ?? "A" }, sc)
        : applyAction(s, { type: "advance", ticks: 1 }, sc)
    }
    assert.equal(s.inbox.find((x) => x.eventId === "E05")?.arrivedTick, 6)
  })
  test("verzögerte Wirkung erst am Takt", () => {
    let { s, sc } = started()
    s = applyAction(s, { type: "advance", ticks: 1 }, sc)
    s = applyAction(s, { type: "decide", eventId: "E01", optionId: "A" }, sc)
    s = applyAction(s, { type: "advance", ticks: 10 }, sc)
    assert.equal(s.inbox.at(-1)?.eventId, "E02")
    const before = s.stakeholders.S01
    s = applyAction(s, { type: "decide", eventId: "E02", optionId: "B" }, sc)
    assert.equal(s.stakeholders.S01, before)
    assert.deepEqual(s.scheduledEffects.map((x) => x.atTick), [s.tick + 4])
    let guard = 0
    while (s.tick < 8 && guard++ < 20) {
      const open = s.inbox.find((x) => x.status === "neu")
      s = open ? applyAction(s, { type: "decide", eventId: open.eventId, optionId: "A" }, sc) : applyAction(s, { type: "advance", ticks: 1 }, sc)
    }
    assert.equal(s.stakeholders.S01, before + 2)
    assert.equal(s.scheduledEffects.length, 0)
  })
  test("Bedingung mit Zufall: Eintrittstakt hängt vom Startwert ab", () => {
    const arrivals = new Set<number>()
    for (let seed = 1; seed <= 12; seed++) {
      const { state } = playMini(seed, miniScenario(), 1)
      const e3 = state.inbox.find((i) => i.eventId === "E03")
      if (e3) arrivals.add(e3.arrivedTick)
      if (e3) assert.ok(e3.arrivedTick >= 4, "frühestens Takt 4 und Tag 3")
    }
    assert.ok(arrivals.size >= 2, `Eintrittstakte: ${[...arrivals].join(", ")}`)
  })
  test("keinAufschub: defer scheitert mit NOT_ALLOWED", () => {
    const { state } = playMini(1, miniScenario(), 1)
    assert.ok(state.decisions.some((d) => d.eventId === "E03"))
    const sc = miniScenario()
    let s = started().s
    s = applyAction(s, { type: "advance", ticks: 1 }, sc)
    s = applyAction(s, { type: "decide", eventId: "E01", optionId: "A" }, sc)
    for (let i = 0; i < 30 && !s.inbox.some((x) => x.eventId === "E03" && x.status === "neu"); i++) {
      const open = s.inbox.find((x) => x.status === "neu")
      s = open ? applyAction(s, { type: "decide", eventId: open.eventId, optionId: "A" }, sc) : applyAction(s, { type: "advance", ticks: 1 }, sc)
    }
    expectSimError(() => applyAction(s, { type: "defer", eventId: "E03" }, sc), "NOT_ALLOWED")
  })
})

describe("Risiko (3.9)", () => {
  test("Gefahr je Takt: W 3, 16 Takte → 1 − 0.7^(1/16)", () => {
    near(hazardPerTick(3, 16, P.riskProb), 1 - Math.pow(0.7, 1 / 16), 12)
    near(hazardPerTick(3, 16, P.riskProb), 0.02205, 5)
  })
  test("Massnahme senkt W, Stunden bei der Person, Kosten risiko", () => {
    const sc = miniScenario()
    let s = createRun(sc, 1)
    s = applyAction(s, { type: "riskMeasure", riskId: "R01", measureId: "M1" }, sc)
    assert.equal(s.risks.R01.probability, 2)
    assert.equal(s.finance.byCategory.risiko, 500)
    s = applyAction(s, { type: "riskMeasure", riskId: "R01", measureId: "M2" }, sc)
    assert.equal(s.risks.R01.impact, 2)
    assert.equal(s.people.P01.appointmentHours, 2)
    assert.deepEqual(s.stats.risksTreatedEarly, ["R01"])
    expectSimError(() => applyAction(s, { type: "riskMeasure", riskId: "R01", measureId: "M2" }, sc), "LIMIT")
    expectSimError(() => applyAction(s, { type: "riskMeasure", riskId: "R02", measureId: "M1" }, sc), "NOT_ALLOWED") // verdeckt
  })
  test("Skalierung der Wirkung mit A", () => {
    assert.deepEqual(scaleEffect({ type: "effort", taskId: "V02", hours: 8 }, 2 / 4), { type: "effort", taskId: "V02", hours: 4 })
    assert.deepEqual(scaleEffect({ type: "effort", taskId: "V02", hours: 1 }, 1 / 4), { type: "effort", taskId: "V02", hours: 1 })
    assert.deepEqual(scaleEffect({ type: "block", taskId: "V02", ticks: 10 }, 3 / 4), { type: "block", taskId: "V02", ticks: 8 })
    assert.deepEqual(scaleEffect({ type: "stakeholder", id: "S01", delta: -8 }, 0.5), { type: "stakeholder", id: "S01", delta: -8 })
  })
})

describe("Earned Value (3.10)", () => {
  test("PV-Referenzwerte aus 2.4", () => {
    const sc = wolkenriedNetwork()
    const s = createRun(sc, 1)
    const expected: Array<[number, number]> = [
      [9, 17880], [19, 63920], [29, 95280], [39, 112800], [49, 129440], [59, 142240], [69, 158520], [71, 162240],
    ]
    for (const [tick, pv] of expected) near(plannedValue(s, sc, (tick + 1) / 2), pv, 6, `PV nach Takt ${tick}`)
  })
  test("Netzplan 2.4: Ende 36, kritischer Pfad, Puffer V13 und V15", () => {
    const rows = computeSchedule(wolkenriedNetwork())
    const by = Object.fromEntries(rows.map((r) => [r.taskId, r]))
    assert.equal(Math.max(...rows.map((r) => r.ef)), 36)
    assert.deepEqual(rows.filter((r) => r.critical).map((r) => r.taskId), ["V01", "V02", "V04", "V09", "V10", "V11", "V12", "V16", "V17", "V18"])
    assert.deepEqual([by.V13.totalFloat, by.V13.freeFloat], [4, 3])
    assert.deepEqual([by.V15.es, by.V15.totalFloat], [20, 1])
    assert.deepEqual([by.V05.totalFloat, by.V14.totalFloat], [1, 12])
  })
  test("EV bei vorgegebenem Fortschritt; SPI/CPI bei PV = 0 und AC = 0", async () => {
    const { computeKpis } = await import("@/lib/simulation")
    const { s, sc } = fresh()
    const k0 = computeKpis(s, sc)
    assert.equal(k0.spi, 1)
    assert.equal(k0.cpi, 1)
    s.tasks.V01.done = 8
    s.tasks.V01.remaining = 8
    s.tasks.V02.status = "fertig"
    assert.equal(earnedValue(s), 1600 * 0.5 + 4800)
  })
})

describe("Statusbericht (3.11)", () => {
  const ctx = getCtx(miniScenario())
  const allMeasures = ["M1", "M2", "M3", "M4", "M5", "M6", "M7", "M8"]
  const truth = (a: "gruen" | "gelb" | "rot") => ({
    ampeln: { gesamt: a, termine: a, kosten: a, qualitaet: a, team: a, risiken: a },
    progress: 50,
    forecastEndDay: 9,
    eac: 13000,
  })
  const input = (a: "gruen" | "gelb" | "rot", extra: Partial<Parameters<typeof assessHonesty>[0]> = {}) => ({
    ampeln: { gesamt: a, termine: a, kosten: a, qualitaet: a, team: a, risiken: a },
    progressPercent: 50,
    forecastEndDay: 9,
    forecastCostChf: 13000,
    deviations: "",
    measures: allMeasures,
    measuresText: "",
    budgetSupplementChf: 0,
    changeRequestIds: [],
    ...extra,
  })
  test("ehrlicher Bericht: H = 100", () => {
    assert.equal(assessHonesty(input("gelb"), truth("gelb"), ctx, {}).honesty, 100)
  })
  test("Ampeln 1 und 2 Stufen besser, Schwarzmalerei", () => {
    assert.equal(assessHonesty(input("gruen"), truth("gelb"), ctx, {}).honesty, 100 - 5 * 10 - 15)
    assert.equal(assessHonesty(input("gruen"), truth("rot"), ctx, {}).honesty, 0) // 5 × 25 + 30
    assert.equal(assessHonesty(input("gelb"), truth("gruen"), ctx, {}).honesty, 100 - 6 * 5)
  })
  test("Fertigstellungsgrad, Prognosen, fehlende Massnahmen, Zusagen", () => {
    assert.equal(assessHonesty(input("gelb", { progressPercent: 61 }), truth("gelb"), ctx, {}).honesty, 90)
    assert.equal(assessHonesty(input("gelb", { forecastEndDay: 6 }), truth("gelb"), ctx, {}).honesty, 85)
    assert.equal(assessHonesty(input("gelb", { forecastCostChf: 12000 }), truth("gelb"), ctx, {}).honesty, 85)
    assert.equal(assessHonesty(input("gelb", { measures: ["M4"] }), truth("gelb"), ctx, {}).honesty, 100 - 4 * 5)
    assert.equal(assessHonesty(input("gelb"), truth("gelb"), ctx, { zusageGelb: true }).honesty, 90)
    const t = { ...truth("gruen"), ampeln: { ...truth("gruen").ampeln, termine: "gelb" as const } }
    assert.equal(assessHonesty(input("gruen"), t, ctx, {}).honesty, 90)
    assert.equal(assessHonesty(input("gruen"), t, ctx, { zusageGruen: true }).honesty, 80)
  })
  test("Prognose über der Formulargrenze: Tag 60 gilt als ehrlich", () => {
    // Formular und Schema erlauben höchstens Tag 60 (REPORT_FORECAST_DAY_MAX); ein Rechenkern über 62 darf nicht bestrafen
    const t = { ...truth("gelb"), forecastEndDay: 76.7 }
    assert.equal(assessHonesty(input("gelb", { forecastEndDay: REPORT_FORECAST_DAY_MAX }), t, ctx, {}).honesty, 100)
    assert.equal(assessHonesty(input("gelb", { forecastEndDay: 50 }), t, ctx, {}).honesty, 85)
  })
  test("Gemeinderat: Phasenfreigabe", () => {
    const { s, sc } = fresh()
    const c = getCtx(sc)
    const base = input("gelb", { measures: ["M1"] })
    assert.equal(boardDecision(structuredClone(s), c, base, 80, false).phaseRelease, "erteilt")
    const s2 = structuredClone(s)
    const d = boardDecision(s2, c, base, 60, false)
    assert.equal(d.phaseRelease, "mitAuflage")
    assert.equal(s2.stakeholders.S01, 70 - 8)
    assert.equal(s2.stakeholders.S03, 65 - 5 - 10)
    assert.equal(s2.flags.auflage, true)
    const s3 = structuredClone(s)
    s3.tasks.V03.status = "fertig"
    assert.equal(boardDecision(s3, c, { ...base, measures: [] }, 50, false).phaseRelease, "erteilt")
    assert.equal(s3.flags.phaseReleased, true)
  })
  test("Gemeinderat: Budgetnachtrag ganz, halb, abgelehnt", () => {
    const { s, sc } = fresh()
    const c = getCtx(sc)
    const run = (x: number, h: number, measures = ["M1"]) => {
      const st = structuredClone(s)
      return { d: boardDecision(st, c, input("gelb", { budgetSupplementChf: x, measures }), h, false), st }
    }
    const full = run(1000, 80)
    assert.equal(full.d.budgetApprovedChf, 1000)
    assert.equal(full.st.finance.budget, 15000)
    assert.equal(full.st.finance.budgetSupplements, 1000)
    assert.equal(run(2500, 80).d.budgetApprovedChf, 1250)
    assert.equal(run(1000, 80, []).d.budgetApprovedChf, 500)
    assert.equal(run(5000, 80).d.budgetApprovedChf, 0)
    const lie = run(1000, 60)
    assert.equal(lie.d.budgetApprovedChf, 0)
    assert.equal(lie.st.flags.vertrauensverlust, true)
  })
  test("Gemeinderat: Änderungsanträge (2.9 + H ≥ 70) und Ehrlichkeit allgemein", () => {
    const { s, sc } = fresh()
    const c = getCtx(sc)
    const s1 = structuredClone(s)
    assert.equal(boardDecision(s1, c, input("gelb", { changeRequestIds: ["CR1"] }), 90, false).changeRequests.CR1, "abgelehnt")
    assert.equal(s1.stakeholders.S03, 70)
    assert.equal(s1.stakeholders.S01, 73)
    const s2 = structuredClone(s)
    s2.finance.ac = 5000 // CPI 0 < 0.95
    s2.flags.berichtVorbesprochen = true
    assert.equal(boardDecision(s2, c, input("gelb", { changeRequestIds: ["CR1"] }), 90, false).changeRequests.CR1, "genehmigt")
    assert.equal(s2.tasks.V04.plannedEffort, 24)
    assert.equal(s2.tasks.V04.bac, 4160 - 1040)
    assert.equal(s2.stakeholders.S01, 78)
    const s3 = structuredClone(s)
    s3.finance.ac = 5000
    assert.equal(boardDecision(s3, c, input("gelb", { changeRequestIds: ["CR1"] }), 60, false).changeRequests.CR1, "abgelehnt")
  })
  test("Ablauf: Periodenende → Bericht → Planung Periode 2 → Abschluss", () => {
    const { state } = playMini(2)
    assert.equal(state.phase, "abgeschlossen")
    assert.deepEqual(state.reports.map((r) => r.kind), ["status", "final"])
    assert.ok(state.reports[0].board)
    assert.equal(state.flags.phaseReleased, true)
    assert.ok(state.result)
    assert.deepEqual(computeScore(state, miniScenario()), state.result)
  })
})

describe("Punkte (3.13)", () => {
  const main = { intro: false, aborted: false, shifted: false }
  test("Termin", () => {
    assert.equal(scoreTermin(38, 40, main), 250)
    assert.equal(scoreTermin(39, 40, main), 240)
    assert.equal(scoreTermin(40, 40, main), 230)
    assert.equal(scoreTermin(41, 40, main), 207)
    assert.equal(scoreTermin(50, 40, main), 0)
    assert.equal(scoreTermin(42, 40, { ...main, shifted: true }), 207)
    assert.equal(scoreTermin(47, 40, { ...main, shifted: true }), 230 - 57.5 - 46)
    assert.equal(scoreTermin(30, 40, { ...main, aborted: true }), 0)
    assert.equal(scoreTermin(9.5, 10, { ...main, intro: true }), 250)
    assert.equal(scoreTermin(10, 10, { ...main, intro: true }), 230)
    assert.equal(scoreTermin(11, 10, { ...main, intro: true }), 207)
  })
  test("Kosten", () => {
    assert.equal(scoreKosten(95000, 100000, 0), 200)
    assert.equal(scoreKosten(100000, 100000, 0), 160)
    near(scoreKosten(97500, 100000, 0), 180, 9)
    near(scoreKosten(115000, 100000, 0), 0, 9)
    assert.equal(scoreKosten(130000, 100000, 0), 0)
    assert.equal(scoreKosten(105000, 100000, 10000), 160) // B = 100'000 + 5'000
  })
  test("Qualität, Stakeholder, Team, Führung", () => {
    assert.equal(scoreQualitaet(5), 200)
    assert.equal(scoreQualitaet(25), 0)
    assert.equal(scoreQualitaet(15), 100)
    assert.equal(scoreStakeholder(90, false), 150)
    assert.equal(scoreStakeholder(40, false), 0)
    assert.equal(scoreStakeholder(65, false), 75)
    assert.equal(scoreStakeholder(85, true), 75)
    assert.equal(scoreTeam(100, 0), 100)
    assert.equal(scoreTeam(60, 0), 0)
    assert.equal(scoreTeam(80, 1), 40)
    assert.equal(scoreFuehrung(100, 120, 1), 100)
    assert.equal(scoreFuehrung(50, 60, 0.5), 20 + 15 + 15)
  })
  test("Sterne-Schwellen", () => {
    const t = P.starThresholds
    assert.deepEqual([499, 500, 679, 680, 819, 820].map((x) => starsFor(x, t)), [0, 1, 1, 2, 2, 3])
  })
  test("computeScore nur bei Phase abgeschlossen; Summe der gerundeten Teile", () => {
    const sc = miniScenario()
    expectSimError(() => computeScore(createRun(sc, 1), sc), "WRONG_PHASE")
    const { state } = playMini(1)
    const r = computeScore(state, sc)
    const sum = r.score.termin + r.score.kosten + r.score.qualitaet + r.score.stakeholder + r.score.team + r.score.fuehrung
    assert.equal(r.score.total, sum)
    assert.ok(Number.isInteger(r.score.total))
    assert.ok(r.achievements.includes("leitstand_ernstfall"))
  })
  test("Abschluss-Abzeichen je Szenario: Wolkenried «Onlineschalter eröffnet», Hochmatt eigenes", () => {
    const { state } = playMini(1)
    const base = miniScenario()
    const wolkenried = computeScore(state, { ...base, id: "wolkenried" })
    const hochmatt = computeScore(state, { ...base, id: "hochmatt" })
    assert.ok(wolkenried.achievements.includes("leitstand_ernstfall"))
    assert.ok(!wolkenried.achievements.includes("leitstand_hochmatt"))
    assert.ok(hochmatt.achievements.includes("leitstand_hochmatt"))
    assert.ok(!hochmatt.achievements.includes("leitstand_ernstfall"))
    // Die übrigen Abzeichen gelten szenarioübergreifend: gleicher Lauf, gleiche Liste
    const rest = (a: string[]) => a.filter((x) => x !== "leitstand_ernstfall" && x !== "leitstand_hochmatt")
    assert.deepEqual(rest(hochmatt.achievements), rest(wolkenried.achievements))
    assert.deepEqual(hochmatt.score, wolkenried.score)
  })
})

describe("Fehler (SimError)", () => {
  const sc = miniScenario()
  const s0 = createRun(sc, 1)
  test("jede Art mindestens einmal; Zustand bleibt unverändert", () => {
    const snapshot = structuredClone(s0)
    expectSimError(() => applyAction(s0, { type: "advance", ticks: 1 }, sc), "WRONG_PHASE")
    expectSimError(() => applyAction(s0, { type: "assign", personId: "P99", taskId: "V01" }, sc), "UNKNOWN_ID")
    expectSimError(() => applyAction(s0, { type: "advance", ticks: 0 }, sc), "INVALID_ACTION")
    expectSimError(() => applyAction(s0, { type: "assign", personId: "P04", taskId: "V01" }, sc), "NOT_ALLOWED")
    const e = expectSimError(() => applyAction(s0, { type: "startPeriod" }, sc), "PLAN_INCOMPLETE")
    assert.deepEqual(e.details, ["V01", "V02", "V03"])
    const trained = applyAction(s0, { type: "training", personId: "P01", area: "ux" }, sc)
    expectSimError(() => applyAction(trained, { type: "training", personId: "P01", area: "ent" }, sc), "LIMIT")
    let busy = s0
    for (const p of ["P01", "P02", "P03", "P01"]) busy = applyAction(busy, { type: "talk", personId: p }, sc)
    expectSimError(() => applyAction(busy, { type: "talk", personId: "P02" }, sc), "CALENDAR_FULL")
    const pending: SimState = structuredClone(s0)
    pending.phase = "abschlussbericht"
    pending.inbox.push({ eventId: "E03", arrivedTick: 0, deadlineTick: null, status: "neu", optionId: null, bodyVariantIndex: null })
    expectSimError(() => applyAction(pending, { type: "submitReport", report: honestReport(pending, sc) }, sc), "EVENT_PENDING")
    assert.deepEqual(s0, snapshot)
  })
  test("replay meldet den Index der ungültigen Aktion", () => {
    const actions: Action[] = [{ type: "assign", personId: "P01", taskId: "V01" }, { type: "advance", ticks: 1 }]
    const e = expectSimError(() => replay(sc, 1, actions), "WRONG_PHASE")
    assert.equal(e.actionIndex, 1)
  })
})

describe("Leistung (Zeit)", () => {
  test("replay eines vollständigen Laufs < 200 ms", () => {
    const sc = miniScenario()
    const { state, actions } = playMini(5, sc, 1)
    const t0 = performance.now()
    const again = replay(sc, 5, actions)
    const ms = performance.now() - t0
    assert.deepEqual(again, state)
    assert.ok(ms < 200, `${ms.toFixed(0)} ms`)
  })
})
