// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// tests/simulation-determinism.test.ts
// Determinismus und JSON-Reinheit des Rechenkerns mit dem Mini-Szenario (Spezifikation 5.3).

import { test, describe } from "node:test"
import assert from "node:assert/strict"
import { AREAS, applyAction, createRun, nextRandom, replay, SimError, type Action, type SimState } from "@/lib/simulation"
import { miniScenario, playMini } from "./helpers/simulation-mini"

function sequence(seed: number, n: number): number[] {
  const out: number[] = []
  let s = seed
  for (let i = 0; i < n; i++) {
    const [x, next] = nextRandom(s)
    out.push(Number(x.toFixed(10)))
    s = next
  }
  return out
}

/** Prüft rekursiv, dass nur JSON-Werte vorkommen (keine NaN/Infinity, undefined, Map, Set, Date) */
function assertJsonPure(value: unknown, path = "state"): void {
  if (value === null || typeof value === "string" || typeof value === "boolean") return
  if (typeof value === "number") {
    assert.ok(Number.isFinite(value), `${path} ist keine endliche Zahl`)
    return
  }
  if (Array.isArray(value)) {
    value.forEach((v, i) => assertJsonPure(v, `${path}[${i}]`))
    return
  }
  assert.equal(typeof value, "object", `${path} hat Typ ${typeof value}`)
  assert.equal(Object.getPrototypeOf(value), Object.prototype, `${path} ist kein einfaches Objekt`)
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    assert.notEqual(v, undefined, `${path}.${k} ist undefined`)
    assertJsonPure(v, `${path}.${k}`)
  }
}

describe("Zufallsgenerator (3.15)", () => {
  test("Referenzwerte mulberry32", () => {
    assert.deepEqual(sequence(12345, 3), [0.9797282678, 0.3067522645, 0.4842054215])
    assert.deepEqual(sequence(1, 3), [0.6270739406, 0.0027357212, 0.52744704])
  })
})

describe("Determinismus (5.3)", () => {
  const sc = miniScenario()

  test("gleicher Startwert + gleiches Protokoll → gleicher Endzustand (3 Startwerte)", () => {
    for (const seed of [11, 222, 3333]) {
      const a = playMini(seed)
      const b = playMini(seed)
      assert.deepEqual(a.state, b.state)
      assert.deepEqual(replay(sc, seed, a.actions), a.state)
    }
  })

  test("replay in Stücken mit JSON-Zwischenstand = replay am Stück", () => {
    const { state, actions } = playMini(42, sc, 1)
    for (const cut of [1, Math.floor(actions.length / 3), Math.floor(actions.length / 2), actions.length - 1]) {
      let s = replay(sc, 42, actions.slice(0, cut))
      s = JSON.parse(JSON.stringify(s)) as SimState
      for (const a of actions.slice(cut)) s = applyAction(s, a, sc)
      assert.deepEqual(s, state, `Schnitt bei ${cut}`)
    }
  })

  test("verschiedene Startwerte → Unterschiede bei Risiken oder Posteingang", () => {
    const fingerprints = new Set<string>()
    for (let seed = 1; seed <= 10; seed++) {
      const { state } = playMini(seed, sc, 1)
      fingerprints.add(JSON.stringify([Object.values(state.risks).map((r) => r.occurredTick), state.inbox.map((i) => [i.eventId, i.arrivedTick])]))
    }
    assert.ok(fingerprints.size > 1)
  })

  test("Zustand ist JSON-rein", () => {
    for (const seed of [1, 7]) {
      const { state } = playMini(seed)
      assertJsonPure(state)
      const text = JSON.stringify(state)
      assert.deepEqual(JSON.parse(text), state)
    }
    assertJsonPure(createRun(sc, 99))
  })
})

describe("Zufallsprotokoll (Fuzz, 5.3)", () => {
  const sc = miniScenario()
  const people = sc.people.map((p) => p.id)
  const tasks = sc.tasks.map((t) => t.id)
  const ampeln = ["gruen", "gelb", "rot"] as const
  const shares = [0.25, 0.5, 0.75, 1] as const

  function randomAction(state: SimState, rnd: () => number): Action {
    const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rnd() * xs.length)]
    const open = state.inbox.find((i) => i.status === "neu" || i.status === "aufgeschoben")
    const r = rnd()
    if (open && r < 0.3) {
      const def = sc.events.find((e) => e.id === open.eventId)
      const kind = rnd()
      if (kind < 0.6) return { type: "decide", eventId: open.eventId, optionId: pick(def?.options.map((o) => o.id) ?? ["A"]) }
      if (kind < 0.8) return { type: "defer", eventId: open.eventId }
      return { type: "acknowledge", eventId: open.eventId }
    }
    if (r < 0.55) return { type: "advance", ticks: 1 + Math.floor(rnd() * 6) }
    const k = Math.floor(rnd() * 16)
    switch (k) {
      case 0:
      case 1:
        return { type: "assign", personId: pick(people), taskId: pick(tasks), share: pick(shares) }
      case 2:
        return { type: "unassign", personId: pick(people), taskId: pick(tasks) }
      case 3:
        return { type: "setShare", personId: pick(people), taskId: pick(tasks), share: pick(shares) }
      case 4:
        return { type: "setOvertime", personId: pick(people), level: pick([0, 1, 2] as const) }
      case 5:
        return { type: "setReviews", taskId: pick(tasks), count: pick([0, 1, 2, 3] as const) }
      case 6:
      case 7:
        return { type: "startPeriod" }
      case 8:
        return { type: "talk", personId: pick(people) }
      case 9:
        return { type: "teamEvent", kind: pick(["mittagessen", "teamabend"] as const), personIds: [pick(people)] }
      case 10:
        return { type: "training", personId: pick(people), area: pick(AREAS) }
      case 11:
        return { type: "riskMeasure", riskId: pick(["R01", "R02"]), measureId: pick(["M1", "M2"]) }
      case 12:
        return { type: "riskAccept", riskId: pick(["R01", "R02"]) }
      case 13:
        return { type: "riskReview" }
      case 14:
        return { type: "reorder", personId: pick(people), taskIds: [...(state.people[pick(people)]?.assignments.map((a) => a.taskId) ?? [])].reverse() }
      default:
        return {
          type: "submitReport",
          report: {
            ampeln: { gesamt: pick(ampeln), termine: pick(ampeln), kosten: pick(ampeln), qualitaet: pick(ampeln), team: pick(ampeln), risiken: pick(ampeln) },
            progressPercent: Math.floor(rnd() * 101),
            forecastEndDay: 1 + Math.floor(rnd() * 59),
            forecastCostChf: Math.floor(rnd() * 30000),
            deviations: rnd() < 0.5 ? "" : "Text",
            measures: rnd() < 0.5 ? [] : ["M1", "M4"],
            measuresText: "",
            budgetSupplementChf: pick([0, 500, 1500, 4000]),
            changeRequestIds: rnd() < 0.3 ? ["CR1"] : [],
          },
        }
    }
  }

  test("50 Läufe mit zufälligen Aktionen: nur SimError, Invarianten halten", () => {
    const reached: string[] = []
    for (let run = 0; run < 50; run++) {
      let rng = 1000 + run
      const rnd = () => {
        const [x, next] = nextRandom(rng)
        rng = next
        return x
      }
      let state = createRun(sc, run + 1)
      for (let i = 0; i < 160 && state.phase !== "abgeschlossen"; i++) {
        const action = randomAction(state, rnd)
        let next: SimState
        try {
          next = applyAction(state, action, sc)
        } catch (error) {
          assert.ok(error instanceof SimError, `Lauf ${run}, Aktion ${JSON.stringify(action)}: ${String(error)}`)
          continue
        }
        assert.ok(next.tick >= state.tick, "tick fällt")
        assert.ok(next.finance.ac >= state.finance.ac - 1e-9, "ac fällt")
        for (const t of Object.values(next.tasks)) assert.ok(t.remaining >= 0, "remaining < 0")
        for (const p of Object.values(next.people)) assert.ok(p.motivation >= 0 && p.motivation <= 120, "Motivation ausserhalb 0–120")
        for (const v of Object.values(next.stakeholders)) assert.ok(v >= 0 && v <= 100, "Zufriedenheit ausserhalb 0–100")
        for (const h of next.history) assert.ok(h.si >= 0 && h.si <= 100, "SI ausserhalb 0–100")
        state = next
      }
      assertJsonPure(state)
      reached.push(state.phase)
    }
    // Der Zufall soll auch über die Planung hinaus kommen
    assert.ok(reached.filter((p) => p !== "planung").length >= 10, reached.join(","))
  })
})
