// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// tests/simulation-api.test.ts
// API des Leitstands ohne Datenbank (Spezifikation 5.7): Zod-Schemas der Routen und die reinen
// Serverhilfen aus lib/leitstand.ts (verifyAndAppend, computePointsAward, achievementStats, checkRunVersion).
// Ausfuehren: npm test

import fs from "node:fs"
import path from "node:path"
import { test, describe } from "node:test"
import assert from "node:assert/strict"
import { ENGINE_VERSION, SCENARIO_IDS, loadScenario, replay, type Action } from "@/lib/simulation"
import { CATALOG_IDS, SCENARIO_CATALOG } from "@/lib/simulation/catalog"
import {
  LEITSTAND_BADGE_CONDITIONS,
  LeitstandError,
  achievementStats,
  checkRunVersion,
  computePointsAward,
  errorResponse,
  newSeed,
  stationDoneFor,
  verifyAndAppend,
  type StoredRun,
} from "@/lib/leitstand"
import { appendActionsSchema, createRunSchema, MAX_ACTIONS_PER_RUN, runIdSchema } from "@/lib/validations/simulation"
import { ACHIEVEMENTS } from "@/components/features/leitstand/format"
import { miniScenario, playMini } from "./helpers/simulation-mini"

const SEED = 4242
const scenario = miniScenario()
const played = playMini(SEED)

function storedRun(actions: Action[], overrides: Partial<StoredRun> = {}): StoredRun {
  return {
    status: "aktiv",
    seed: SEED,
    scenarioId: scenario.id,
    scenarioVersion: scenario.version,
    engineVersion: ENGINE_VERSION,
    actions: structuredClone(actions),
    actionCount: actions.length,
    ...overrides,
  }
}

/** Erwartet einen LeitstandError mit Status (und optional Code) */
function expectError(fn: () => unknown, status: number, code?: string): LeitstandError {
  try {
    fn()
  } catch (error) {
    assert.ok(error instanceof LeitstandError, `LeitstandError erwartet, erhalten: ${String(error)}`)
    assert.equal(error.status, status)
    if (code) assert.equal(error.code, code)
    return error
  }
  assert.fail(`Fehler ${status} erwartet`)
}

describe("verifyAndAppend", () => {
  test("Lauf ist im Mini-Szenario abgeschlossen (Voraussetzung der Tests)", () => {
    assert.equal(played.state.phase, "abgeschlossen")
    assert.ok(played.actions.length > 20)
  })

  test("fromIndex ≠ actionCount → Konflikt (409) mit aktuellem actionCount", () => {
    const run = storedRun(played.actions.slice(0, 5))
    const err = expectError(() => verifyAndAppend(run, { fromIndex: 4, actions: [played.actions[5]] }, scenario), 409, "CONFLICT")
    assert.match(err.message, /Konflikt/)
    assert.equal(err.extra.actionCount, 5)
    expectError(() => verifyAndAppend(run, { fromIndex: 6, actions: [played.actions[5]] }, scenario), 409, "CONFLICT")
  })

  test("ungültige Aktion in der Mitte → 422 mit Index und Meldung, Protokoll unverändert", () => {
    const base = played.actions.slice(0, 3)
    const run = storedRun(base)
    const before = structuredClone(run)
    const batch: Action[] = [played.actions[3], { type: "assign", personId: "P99", taskId: "V01" }, played.actions[4]]
    const err = expectError(() => verifyAndAppend(run, { fromIndex: 3, actions: batch }, scenario), 422, "INVALID_ACTION")
    assert.equal(err.extra.index, 4, "Index im Gesamtprotokoll")
    assert.ok(err.message.length > 0)
    assert.equal(typeof err.extra.simCode, "string")
    assert.deepEqual(run, before, "gespeicherter Lauf bleibt unverändert")
  })

  test("gültige Anhänge in zwei Teilen ergeben das gleiche Ergebnis wie am Stück", () => {
    const all = played.actions
    const cut = Math.floor(all.length / 2)

    const whole = verifyAndAppend(storedRun([]), { fromIndex: 0, actions: all }, scenario)

    const first = verifyAndAppend(storedRun([]), { fromIndex: 0, actions: all.slice(0, cut) }, scenario)
    const second = verifyAndAppend(storedRun(first.actions), { fromIndex: cut, actions: all.slice(cut) }, scenario)

    assert.equal(second.actionCount, all.length)
    assert.equal(second.actionCount, whole.actionCount)
    assert.equal(second.tick, whole.tick)
    assert.equal(second.phase, "abgeschlossen")
    assert.deepEqual(second.summary, whole.summary)
    assert.deepEqual(second.state, whole.state)
    assert.deepEqual(whole.state, replay(scenario, SEED, all), "gleich wie direktes Nachspielen")
    assert.equal(first.summary.phase, first.phase)
  })

  test("Lauf «abgeschlossen», «abgebrochen» oder «veraltet» → Anhängen abgelehnt (409)", () => {
    for (const status of ["abgeschlossen", "abgebrochen", "veraltet"]) {
      const run = storedRun(played.actions.slice(0, 2), { status })
      expectError(() => verifyAndAppend(run, { fromIndex: 2, actions: [played.actions[2]] }, scenario), 409, "NOT_ACTIVE")
    }
  })

  test("Versionsabweichung von Szenario oder Rechenkern → veraltet", () => {
    const actions = played.actions.slice(0, 2)
    const oldScenario = storedRun(actions, { scenarioVersion: "0.9.0" })
    const oldEngine = storedRun(actions, { engineVersion: ENGINE_VERSION + 1 })
    assert.equal(checkRunVersion(oldScenario, scenario), "veraltet")
    assert.equal(checkRunVersion(oldEngine, scenario), "veraltet")
    assert.equal(checkRunVersion(storedRun(actions), scenario), "aktiv")
    // abgeschlossene Läufe behalten ihr Ergebnis
    assert.equal(checkRunVersion(storedRun(actions, { status: "abgeschlossen", scenarioVersion: "0.9.0" }), scenario), "abgeschlossen")
    const err = expectError(() => verifyAndAppend(oldScenario, { fromIndex: 2, actions: [played.actions[2]] }, scenario), 409, "OUTDATED")
    assert.equal(err.extra.status, "veraltet")
    expectError(() => verifyAndAppend(oldEngine, { fromIndex: 2, actions: [played.actions[2]] }, scenario), 409, "OUTDATED")
  })

  test("mehr als MAX_ACTIONS_PER_RUN Aktionen → 422 LIMIT", () => {
    const filler: Action[] = Array.from({ length: MAX_ACTIONS_PER_RUN }, () => ({ type: "riskReview" }))
    const run = storedRun(filler)
    expectError(() => verifyAndAppend(run, { fromIndex: MAX_ACTIONS_PER_RUN, actions: [{ type: "riskReview" }] }, scenario), 422, "LIMIT")
  })
})

describe("computePointsAward (4.7, Entscheid 7 Nr. 4)", () => {
  test("erster Lauf 735 → 74; zweiter 700 → 0; dritter 820 → 9; seedReused → 0", () => {
    assert.equal(computePointsAward(null, 735, false), 74)
    assert.equal(computePointsAward(735, 700, false), 0)
    assert.equal(computePointsAward(735, 820, false), 9)
    assert.equal(computePointsAward(null, 900, true), 0)
    assert.equal(computePointsAward(735, 990, true), 0)
  })

  test("höchstens 100 Punkte je Lauf", () => {
    assert.equal(computePointsAward(null, 1000, false), 100)
    assert.equal(computePointsAward(0, 1000, false), 100)
  })
})

describe("achievementStats", () => {
  test("Vereinigung der achievements, Wiederholungen und nicht abgeschlossene Läufe ausgeschlossen", () => {
    const stats = achievementStats([
      { status: "abgeschlossen", seedReused: false, scoreDetail: { achievements: ["leitstand_einfuehrung"] } },
      { status: "abgeschlossen", seedReused: false, scoreDetail: { achievements: ["leitstand_ernstfall", "leitstand_klartext"] } },
      { status: "abgeschlossen", seedReused: false, scoreDetail: { achievements: ["leitstand_ernstfall", "leitstand_null_fehler"] } },
      { status: "abgeschlossen", seedReused: true, scoreDetail: { achievements: ["leitstand_drei_sterne"] } },
      { status: "abgebrochen", seedReused: false, scoreDetail: { achievements: ["leitstand_teamgeist"] } },
      { status: "abgeschlossen", seedReused: false, scoreDetail: null },
      { status: "abgeschlossen", seedReused: false, scoreDetail: { achievements: "kaputt" } },
    ])
    assert.deepEqual(
      [...stats].sort(),
      ["leitstand_einfuehrung", "leitstand_ernstfall", "leitstand_klartext", "leitstand_null_fehler"],
    )
  })

  test("Abschluss-Abzeichen Hochmatt: in Liste, Anzeige, Seed und Migration", () => {
    const conditions: readonly string[] = LEITSTAND_BADGE_CONDITIONS
    assert.ok(conditions.includes("leitstand_ernstfall"))
    assert.ok(conditions.includes("leitstand_hochmatt"))
    for (const c of conditions) assert.ok(ACHIEVEMENTS[c], `Anzeige fehlt für ${c}`)
    const seed = fs.readFileSync(path.join(process.cwd(), "prisma", "seed.ts"), "utf8")
    const migration = fs.readFileSync(
      path.join(process.cwd(), "prisma", "migrations", "20261104090000_leitstand_hochmatt_abzeichen", "migration.sql"),
      "utf8",
    )
    for (const src of [seed, migration]) {
      assert.ok(src.includes("leitstand_hochmatt"))
      assert.ok(src.includes("Stipendien-Assistent eingeführt"))
    }
    assert.match(migration, /ON CONFLICT DO NOTHING/)
    const stats = achievementStats([
      { status: "abgeschlossen", seedReused: false, scoreDetail: { achievements: ["leitstand_hochmatt", "leitstand_klartext"] } },
    ])
    assert.deepEqual([...stats].sort(), ["leitstand_hochmatt", "leitstand_klartext"])
  })

  test("leere Liste ergibt leere Menge", () => {
    assert.equal(achievementStats([]).size, 0)
  })
})

describe("Fehlerantworten", () => {
  test("LeitstandError wird mit Status, Meldung und Zusatzfeldern ausgeliefert", async () => {
    const response = errorResponse(new LeitstandError(409, "CONFLICT", "Konflikt", { actionCount: 7 }), "[test]", "Generisch")
    assert.equal(response.status, 409)
    assert.equal(response.headers.get("Cache-Control"), "private, no-store")
    assert.deepEqual(await response.json(), { error: "Konflikt", code: "CONFLICT", actionCount: 7 })
  })

  test("andere Fehler → 500 mit generischer Meldung ohne Details", async () => {
    const original = console.error
    console.error = () => {}
    try {
      const response = errorResponse(new Error("geheimes Detail"), "[test]", "Generisch")
      assert.equal(response.status, 500)
      assert.deepEqual(await response.json(), { error: "Generisch" })
    } finally {
      console.error = original
    }
  })
})

describe("Zod-Schemas der Routen", () => {
  test("appendActionsSchema", () => {
    assert.ok(appendActionsSchema.safeParse({ fromIndex: 0, actions: [{ type: "startPeriod" }] }).success)
    assert.equal(appendActionsSchema.safeParse({ fromIndex: -1, actions: [{ type: "startPeriod" }] }).success, false)
    assert.equal(appendActionsSchema.safeParse({ fromIndex: 0, actions: [] }).success, false)
    const tooMany = Array.from({ length: 201 }, () => ({ type: "riskReview" }))
    assert.equal(appendActionsSchema.safeParse({ fromIndex: 0, actions: tooMany }).success, false)
    assert.equal(appendActionsSchema.safeParse({ fromIndex: 0, actions: [{ type: "hack" }] }).success, false)
    assert.equal(appendActionsSchema.safeParse({ fromIndex: 0, actions: [{ type: "startPeriod" }], extra: 1 }).success, false)
  })

  test("createRunSchema", () => {
    assert.ok(createRunSchema.safeParse({ scenarioId: "wolkenried" }).success)
    assert.ok(createRunSchema.safeParse({ scenarioId: "einfuehrung", repeatOfRunId: "ckv9q2x3k0000abcd1234efgh" }).success)
    assert.equal(createRunSchema.safeParse({ scenarioId: "Wolken Ried" }).success, false)
    assert.equal(createRunSchema.safeParse({ scenarioId: "wolkenried", repeatOfRunId: "nicht-cuid!" }).success, false)
    assert.equal(createRunSchema.safeParse({}).success, false)
  })

  test("runIdSchema verlangt eine cuid", () => {
    assert.ok(runIdSchema.safeParse("ckv9q2x3k0000abcd1234efgh").success)
    assert.equal(runIdSchema.safeParse("../etc/passwd").success, false)
    assert.equal(runIdSchema.safeParse("").success, false)
  })
})

describe("Startwert", () => {
  test("liegt in 1 … 2'147'483'646", () => {
    for (let i = 0; i < 200; i++) {
      const seed = newSeed()
      assert.ok(Number.isInteger(seed) && seed >= 1 && seed <= 2_147_483_646)
    }
  })
})

describe("Szenario-Verzeichnis (K3, 2.11.13)", () => {
  test("Einführung und beide Ernstfälle sind verzeichnet, Startparameter eindeutig", () => {
    assert.deepEqual([...CATALOG_IDS].sort(), ["einfuehrung", "hochmatt", "wolkenried"])
    const starts = SCENARIO_CATALOG.map((e) => e.start)
    assert.equal(new Set(starts).size, starts.length)
    // Station 23 verlinkt ?start=einfuehrung und ?start=ernstfall
    assert.equal(SCENARIO_CATALOG.find((e) => e.start === "ernstfall")?.id, "wolkenried")
    assert.equal(SCENARIO_CATALOG.find((e) => e.start === "einfuehrung")?.id, "einfuehrung")
  })

  test("ladbare Szenarien passen zum Verzeichnis (Art, ID)", () => {
    assert.ok(SCENARIO_IDS.includes("einfuehrung") && SCENARIO_IDS.includes("wolkenried"))
    for (const id of SCENARIO_IDS) {
      const s = loadScenario(id)
      const entry = SCENARIO_CATALOG.find((e) => e.id === id)
      assert.ok(s && entry, id)
      assert.equal(s.id, id)
      assert.equal(s.kind, entry.kind, id)
    }
  })

  test("fehlende Datei oder fremde ID ergibt null statt Absturz", () => {
    assert.equal(loadScenario("gibt-es-nicht"), null)
    assert.equal(loadScenario("../package"), null)
    if (!SCENARIO_IDS.includes("hochmatt")) assert.equal(loadScenario("hochmatt"), null)
  })

  test("Station 23 «erledigt» bei jedem Ernstfall, nicht beim Einführungslauf", () => {
    assert.equal(stationDoneFor({ kind: "main" }), true)
    assert.equal(stationDoneFor({ kind: "intro" }), false)
  })
})
