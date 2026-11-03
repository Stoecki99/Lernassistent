// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// tests/simulation-balance.test.ts
// Abstimmung mit Strategie-Robotern (Spezifikation 5.4, AP5): je Roboter 20 feste Startwerte (1–20),
// Schwellen aus 5.4. Dazu Determinismus mit Roboter «gut» (5.3) und Laufzeit von replay (5.1).
// Hochmatt (2.11.14, K6) mit denselben Schwellen, eigener Musterbesetzung und eigenem Determinismus-Test.

import { describe, test } from "node:test"
import assert from "node:assert/strict"
import { performance } from "node:perf_hooks"
import { computeKpis, replay, type RunResult, type Scenario } from "@/lib/simulation"
import { einfuehrung, hochmatt, playBot, playIntroGut, playIntroNaiv, wolkenried, type BotName, type BotRun } from "./helpers/simulation-bots"

const SEEDS = Array.from({ length: 20 }, (_, i) => i + 1)
const BOTS: BotName[] = ["gut", "naiv", "schlecht"]

interface Row {
  bot: BotName
  seed: number
  result: RunResult
  cpi: number
}

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 === 1 ? s[m] : (s[m - 1] + s[m]) / 2
}

function stdev(values: number[]): number {
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  return Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length)
}

/** Läufe eines Ernstfalls: je Roboter und Startwert einmal gespielt und zwischengespeichert */
function balanceRuns(scenario: Scenario) {
  const runs = new Map<string, BotRun>()
  let rows: Row[] | null = null

  function run(bot: BotName, seed: number): BotRun {
    const key = `${bot}:${seed}`
    let r = runs.get(key)
    if (!r) {
      r = playBot(bot, seed, scenario)
      runs.set(key, r)
    }
    return r
  }

  function allRows(): Row[] {
    if (rows) return rows
    rows = []
    for (const bot of BOTS) {
      for (const seed of SEEDS) {
        const { state } = run(bot, seed)
        assert.equal(state.phase, "abgeschlossen", `${scenario.id} ${bot} ${seed}: Lauf nicht abgeschlossen`)
        assert.ok(state.result, `${scenario.id} ${bot} ${seed}: kein Ergebnis`)
        rows.push({ bot, seed, result: state.result, cpi: computeKpis(state, scenario).cpi })
      }
    }
    return rows
  }

  /** Tabelle Roboter × Startwert × Teilpunkte für die Ausgabe bei Fehlschlag (5.4) */
  function table(): string {
    const head = "Roboter  Seed  Total Termin Kosten Qual. Stake. Team Führ.  Endtag  CPI    Restm."
    const lines = allRows().map((r) => {
      const s = r.result.score
      return [
        r.bot.padEnd(8),
        String(r.seed).padStart(4),
        String(s.total).padStart(6),
        String(s.termin).padStart(6),
        String(s.kosten).padStart(6),
        String(s.qualitaet).padStart(5),
        String(s.stakeholder).padStart(6),
        String(s.team).padStart(4),
        String(s.fuehrung).padStart(5),
        String(r.result.endDay).padStart(7),
        r.cpi.toFixed(3).padStart(6),
        String(r.result.restmaengel).padStart(6),
      ].join(" ")
    })
    return [`Szenario ${scenario.id}`, head, ...lines].join("\n")
  }

  return { run, allRows, table, of: (bot: BotName) => allRows().filter((r) => r.bot === bot) }
}

/** Schwellen aus 5.4 (AP5); für Hochmatt (2.11.14, K6) unverändert übernommen */
function thresholdTests(b: ReturnType<typeof balanceRuns>): void {
  const check = (ok: boolean, message: string): void => assert.ok(ok, `${message}\n\n${b.table()}`)
  const total = (bot: BotName) => b.of(bot).map((r) => r.result.score.total)

  test("gut: Median Punkte ≥ 720", () => {
    check(median(total("gut")) >= 720, `Median gut = ${median(total("gut"))}`)
  })
  test("gut: 18 von 20 Startwerten ≥ 650", () => {
    const n = total("gut").filter((t) => t >= 650).length
    check(n >= 18, `nur ${n} von 20 Startwerten ≥ 650`)
  })
  test("gut: Median Endtag 36 bis 40", () => {
    const m = median(b.of("gut").map((r) => r.result.endDay))
    check(m >= 36 && m <= 40, `Median Endtag gut = ${m}`)
  })
  test("gut: Median CPI am Ende 0.92 bis 1.05", () => {
    const m = median(b.of("gut").map((r) => r.cpi))
    check(m >= 0.92 && m <= 1.05, `Median CPI gut = ${m.toFixed(3)}`)
  })
  test("gut: Streuung (Standardabweichung) ≤ 60 Punkte", () => {
    const sd = stdev(total("gut"))
    check(sd <= 60, `Standardabweichung gut = ${sd.toFixed(1)}`)
  })
  test("naiv: Median Punkte 350 bis 600", () => {
    const m = median(total("naiv"))
    check(m >= 350 && m <= 600, `Median naiv = ${m}`)
  })
  test("naiv: Median Endtag 42 bis 48", () => {
    const m = median(b.of("naiv").map((r) => r.result.endDay))
    check(m >= 42 && m <= 48, `Median Endtag naiv = ${m}`)
  })
  test("schlecht: Median Punkte ≤ 300", () => {
    const m = median(total("schlecht"))
    check(m <= 300, `Median schlecht = ${m}`)
  })
  test("Abstand gut − naiv (Median) ≥ 150", () => {
    const d = median(total("gut")) - median(total("naiv"))
    check(d >= 150, `Abstand = ${d}`)
  })
  test("kein Roboter erreicht 1000 Punkte", () => {
    check(b.allRows().every((r) => r.result.score.total < 1000), "ein Lauf erreicht 1000 Punkte")
  })
}

/** Determinismus (5.3) und Laufzeit von replay (5.1) mit Roboter «gut» */
function replayTests(scenario: Scenario, b: ReturnType<typeof balanceRuns>): void {
  for (const seed of [1, 7, 13]) {
    test(`Startwert ${seed}: gleicher Startwert + gleiches Protokoll = gleicher Endzustand`, () => {
      const { state, actions } = b.run("gut", seed)
      const again = replay(scenario, seed, actions)
      assert.deepEqual(JSON.parse(JSON.stringify(again)), JSON.parse(JSON.stringify(state)))
      assert.deepEqual(playBot("gut", seed, scenario).actions, actions)
    })
  }
  test("replay eines vollständigen Ernstfalls mit Roboter «gut» < 200 ms", () => {
    const { actions, state } = b.run("gut", 1)
    assert.equal(state.phase, "abgeschlossen")
    replay(scenario, 1, actions) // Aufwärmen (JIT, Szenario-Kontext)
    let best = Number.POSITIVE_INFINITY
    for (let i = 0; i < 3; i++) {
      const t0 = performance.now()
      replay(scenario, 1, actions)
      best = Math.min(best, performance.now() - t0)
    }
    assert.ok(best < 200, `replay dauerte ${best.toFixed(1)} ms (${actions.length} Aktionen)`)
  })
}

const scenario = wolkenried()
const wolkenriedRuns = balanceRuns(scenario)
const hochmattScenario = hochmatt()
const hochmattRuns = balanceRuns(hochmattScenario)

describe("Abstimmung mit Strategie-Robotern (5.4)", () => {
  thresholdTests(wolkenriedRuns)
})

describe("Abstimmung Hochmatt mit Strategie-Robotern (2.11.14, K6)", () => {
  thresholdTests(hochmattRuns)
})

describe("Einführungslauf «Hundeanmeldung online» (2.10, AP6)", () => {
  const intro = einfuehrung()
  const seeds = Array.from({ length: 10 }, (_, i) => i + 1)
  const gut = seeds.map((seed) => playIntroGut(seed, intro).state)
  const naiv = seeds.map((seed) => playIntroNaiv(seed, intro).state)
  const line = (bot: string, s: (typeof gut)[number], i: number) =>
    `${bot.padEnd(5)} ${String(i + 1).padStart(3)} ${s.result?.ended ?? "-"} Ende ${s.result?.endDay ?? "-"} ${JSON.stringify(s.result?.score ?? null)}`
  const introTable = () => [...gut.map((s, i) => line("gut", s, i)), ...naiv.map((s, i) => line("naiv", s, i))].join("\n")
  const pts = (xs: typeof gut) => xs.map((s) => s.result?.score.total ?? 0)

  test("alle Läufe abgeschlossen, keiner mit Abbruch", () => {
    for (const s of [...gut, ...naiv]) {
      assert.equal(s.phase, "abgeschlossen", introTable())
      assert.equal(s.result?.ended, "fertig", introTable())
    }
  })
  test("gut: Median Endtag ≤ 10 (Terminziel)", () => {
    const m = median(gut.map((s) => s.result?.endDay ?? 99))
    assert.ok(m <= 10, `Median Endtag gut = ${m}\n${introTable()}`)
  })
  test("gut: Median Punkte ≥ 680 (★★)", () => {
    const m = median(pts(gut))
    assert.ok(m >= 680, `Median gut = ${m}\n${introTable()}`)
  })
  test("naiv: deutlich schlechter (Median mindestens 80 Punkte tiefer, später fertig)", () => {
    const d = median(pts(gut)) - median(pts(naiv))
    assert.ok(d >= 80, `Abstand = ${d}\n${introTable()}`)
    assert.ok(median(naiv.map((s) => s.result?.endDay ?? 0)) > median(gut.map((s) => s.result?.endDay ?? 0)), introTable())
  })
})

describe("Determinismus und Leistung mit Roboter «gut» (5.3, 5.1)", () => {
  replayTests(scenario, wolkenriedRuns)
})

describe("Hochmatt: Determinismus und Leistung mit Roboter «gut» (5.3, 5.1)", () => {
  replayTests(hochmattScenario, hochmattRuns)
})
