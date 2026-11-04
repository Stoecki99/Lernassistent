// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// tests/ipma-selection.test.ts
// Auswahl der Fragen (Spezifikation 7.2): Umfang, Abdeckung, Gruppen, Determinismus, Optionen, Exposure,
// zu kleiner Pool, nur geprüfte Fragen, Kurzprüfung, Training, Lücken schliessen.

import { describe, test } from "node:test"
import assert from "node:assert/strict"
import { COMPETENCE_IDS, getCompetence, type CompetenceId } from "@/lib/ipma/competences"
import { EXAM_CONFIG } from "@/lib/ipma/config"
import { IpmaError } from "@/lib/ipma/errors"
import { mastery, weakestCompetences, type GradedAnswer, type LeitnerState, type Mastery } from "@/lib/ipma/review"
import { createRng, selectExam, selectGaps, selectShort, selectTraining, shuffle, type Exposure, type SelectedItem } from "@/lib/ipma/selection"
import { fileOf, miniPool, rawOpen } from "./helpers/ipma-mini"

const NONE: ReadonlyMap<string, Exposure> = new Map()
const NO_STATES: ReadonlyMap<string, LeitnerState> = new Map()
const NOW = Date.UTC(2026, 11, 1)
const DAY = 24 * 60 * 60 * 1000
const POOL = miniPool()

function countBy<T>(list: readonly T[], key: (x: T) => string): Map<string, number> {
  const m = new Map<string, number>()
  for (const x of list) m.set(key(x), (m.get(key(x)) ?? 0) + 1)
  return m
}

/** Exposure nach einem Versuch nachführen (wie der Server beim Abschliessen) */
function addExposure(exposure: Map<string, Exposure>, items: readonly SelectedItem[], at: number): void {
  for (const it of items) {
    const old = exposure.get(it.questionId)
    exposure.set(it.questionId, { seenCount: (old?.seenCount ?? 0) + 1, lastSeenAt: at })
  }
}

function isPermutation(order: readonly number[]): boolean {
  return order.length === 4 && [...order].sort().join() === "0,1,2,3"
}

describe("selectExam", () => {
  const exam = selectExam(POOL, 12345, NONE, EXAM_CONFIG)

  test("Umfang: 60 MC auf 1–60, 30 offene auf 61–90", () => {
    assert.equal(exam.length, 90)
    assert.deepEqual(exam.map((i) => i.position), Array.from({ length: 90 }, (_, i) => i + 1))
    assert.ok(exam.slice(0, 60).every((i) => i.type === "mc"))
    assert.ok(exam.slice(60).every((i) => i.type === "offen"))
  })

  test("Abdeckung: je Kompetenz ≥ 2 MC und ≥ 1 offen, Zusatzfragen nur aus Practice", () => {
    for (const seed of [1, 2, 3, 99, 2147483646]) {
      const items = selectExam(POOL, seed, NONE)
      for (const id of COMPETENCE_IDS) {
        const mine = items.filter((i) => i.competence === id)
        const mc = mine.filter((i) => i.type === "mc").length
        const offen = mine.filter((i) => i.type === "offen").length
        assert.ok(mc >= 2 && offen >= 1 && mine.length >= 3, `${id}: ${mc} MC, ${offen} offen`)
        if (getCompetence(id).area !== "practice") assert.deepEqual([mc, offen], [2, 1], id)
      }
    }
  })

  test("keine Frage doppelt, keine zwei Fragen derselben Gruppe", () => {
    const pool = miniPool(4, 2, (files) => {
      for (const q of fileOf(files, "3.04").fragen.slice(0, 2)) q.gruppe = "netzplan-puffer"
      for (const q of fileOf(files, "2.07").fragen.filter((x) => x.typ === "offen")) q.gruppe = "glasl-stufen"
      fileOf(files, "2.07").fragen.push(rawOpen("2.07", 3))
    })
    const grouped = new Set(pool.filter((q) => q.gruppe).map((q) => q.id))
    for (let seed = 1; seed <= 40; seed++) {
      const items = selectExam(pool, seed, NONE)
      assert.equal(new Set(items.map((i) => i.questionId)).size, 90)
      assert.ok(items.filter((i) => grouped.has(i.questionId) && i.competence === "3.04").length <= 1, `Startwert ${seed}: 3.04`)
      assert.ok(items.filter((i) => grouped.has(i.questionId) && i.competence === "2.07").length <= 1, `Startwert ${seed}: 2.07`)
    }
  })

  test("Determinismus: gleicher Startwert + Pool + Exposure → gleiches Ergebnis", () => {
    const exposure = new Map<string, Exposure>([[POOL[0].id, { seenCount: 1, lastSeenAt: NOW }]])
    for (const seed of [7, 4242, 987654321]) {
      assert.deepEqual(selectExam(POOL, seed, exposure), selectExam(POOL, seed, exposure))
    }
  })

  test("Zufall: 10 Startwerte → verschiedene Auswahlen und Reihenfolgen", () => {
    const runs = Array.from({ length: 10 }, (_, i) => selectExam(POOL, 1000 + i, NONE))
    const sets = new Set(runs.map((r) => r.map((i) => i.questionId).sort().join()))
    const orders = new Set(runs.map((r) => r.map((i) => i.questionId).join()))
    assert.ok(sets.size >= 2, `nur ${sets.size} verschiedene Auswahlen`)
    assert.ok(orders.size >= 2, `nur ${orders.size} verschiedene Reihenfolgen`)
  })

  test("Optionen: Permutation, optionenFest bleibt [0,1,2,3], gleichmässig über 200 Startwerte (± 10 %)", () => {
    const pool = miniPool(3, 2, (files) => { for (const q of fileOf(files, "1.01").fragen) if (q.typ === "mc") q.optionenFest = true })
    const cells = Array.from({ length: 4 }, () => [0, 0, 0, 0])
    let n = 0
    for (let seed = 1; seed <= 200; seed++) {
      for (const it of selectExam(pool, seed, NONE)) {
        if (it.type === "offen") { assert.deepEqual(it.optionOrder, []); continue }
        assert.ok(isPermutation(it.optionOrder), it.optionOrder.join())
        if (it.competence === "1.01") { assert.deepEqual(it.optionOrder, [0, 1, 2, 3]); continue }
        it.optionOrder.forEach((orig, pos) => { cells[pos][orig] += 1 })
        n += 1
      }
    }
    const expected = n / 4
    for (const row of cells) for (const c of row) assert.ok(Math.abs(c - expected) <= expected * 0.1, `${c} statt ~${expected}`)
  })

  test("Exposure: nie gesehene Fragen vor gesehenen", () => {
    const pool = miniPool(4, 2)
    const exposure = new Map<string, Exposure>()
    for (const q of pool) if (q.id.endsWith("-01") || q.id.endsWith("-mc-02")) exposure.set(q.id, { seenCount: 1, lastSeenAt: NOW })
    const items = selectExam(pool, 5, exposure)
    for (const id of COMPETENCE_IDS) {
      if (getCompetence(id).area === "practice") continue
      const picked = items.filter((i) => i.competence === id).map((i) => i.questionId).sort()
      assert.deepEqual(picked, [`${id}-mc-03`, `${id}-mc-04`, `${id}-of-02`], id)
    }
  })

  test("Exposure: zweite Prüfung bei 4 MC + 2 offen wiederholt nur, was der Pool erzwingt", () => {
    // Practice: 13 × 4 MC = 52 < 2 × 30 → mindestens 8 MC-Wiederholungen; 13 × 2 offen = 26 < 2 × 15 → 4.
    // Perspective und People: nie eine Wiederholung (Abweichung zu 7.2, dort «keine Wiederholung»).
    const pool = miniPool(4, 2)
    for (const seed of [11, 22, 33]) {
      const exposure = new Map<string, Exposure>()
      const first = selectExam(pool, seed, exposure)
      addExposure(exposure, first, NOW)
      const second = selectExam(pool, seed + 1, exposure)
      const firstIds = new Set(first.map((i) => i.questionId))
      const repeated = second.filter((i) => firstIds.has(i.questionId))
      assert.ok(repeated.every((i) => getCompetence(i.competence).area === "practice"), `Startwert ${seed}`)
      assert.equal(repeated.filter((i) => i.type === "mc").length, 8, `Startwert ${seed}: MC`)
      assert.equal(repeated.filter((i) => i.type === "offen").length, 4, `Startwert ${seed}: offen`)
    }
  })

  test("Pool zu klein → POOL_TOO_SMALL mit Kompetenz in der Meldung; sonst nie", () => {
    const noOpen = miniPool(3, 2, (files) => { fileOf(files, "3.04").fragen = fileOf(files, "3.04").fragen.filter((q) => q.typ === "mc") })
    assert.throws(() => selectExam(noOpen, 1, NONE), (e: unknown) =>
      e instanceof IpmaError && e.status === 422 && e.code === "POOL_TOO_SMALL" && e.message.includes("3.04"))
    // Jede Practice-Kompetenz hat nur 1 offene: die 2 Zusatzfragen finden keinen Platz
    const tight = miniPool(3, 1)
    assert.throws(() => selectExam(tight, 1, NONE), (e: unknown) => e instanceof IpmaError && e.code === "POOL_TOO_SMALL")
    // 1 offene nur in 3.04: die Zusatzfragen weichen auf andere Kompetenzen aus
    const one304 = miniPool(3, 2, (files) => { fileOf(files, "3.04").fragen = fileOf(files, "3.04").fragen.filter((q) => q.id !== "3.04-of-02") })
    for (let seed = 1; seed <= 50; seed++) {
      assert.doesNotThrow(() => selectExam(POOL, seed, NONE))
      assert.doesNotThrow(() => selectExam(one304, seed, NONE))
    }
  })

  test("nur geprüfte Fragen: entwurf und zurueckgezogen nie gewählt", () => {
    const pool = miniPool(4, 3, (files) => {
      for (const f of files) {
        f.fragen[0].status = "entwurf"
        const lastOpen = f.fragen.filter((q) => q.typ === "offen").at(-1)
        if (lastOpen) lastOpen.status = "zurueckgezogen"
      }
    })
    const blocked = new Set(pool.filter((q) => q.status !== "geprueft").map((q) => q.id))
    assert.equal(blocked.size, 56)
    for (let seed = 1; seed <= 30; seed++) {
      assert.ok(selectExam(pool, seed, NONE).every((i) => !blocked.has(i.questionId)), `Startwert ${seed}`)
    }
  })
})

describe("shuffle und createRng", () => {
  test("Permutation, Original unverändert, deterministisch", () => {
    const list = [1, 2, 3, 4, 5, 6]
    const a = shuffle(list, createRng(9))
    assert.deepEqual(list, [1, 2, 3, 4, 5, 6])
    assert.deepEqual([...a].sort(), list)
    assert.deepEqual(a, shuffle(list, createRng(9)))
  })
})

/** Beherrschung aus einfachen Antworten: Wert je Kompetenz mit n Antworten */
function masteryOf(values: Partial<Record<CompetenceId, [number, number]>>): Map<CompetenceId, Mastery> {
  const answers: GradedAnswer[] = []
  for (const [id, pair] of Object.entries(values) as [CompetenceId, [number, number]][]) {
    const [value, n] = pair
    for (let i = 0; i < n; i++) answers.push({ competence: id, score: value, at: NOW - i * DAY })
  }
  return mastery(answers)
}

describe("selectShort", () => {
  test("20 verschiedene Kompetenzen, Bereiche 4/7/9, 14 MC + 6 offen, Reihenfolge wie Prüfung", () => {
    for (const seed of [1, 2, 3]) {
      const items = selectShort(POOL, seed, NONE, mastery([]))
      assert.equal(items.length, 20)
      assert.equal(new Set(items.map((i) => i.competence)).size, 20)
      const areas = countBy(items, (i) => getCompetence(i.competence).area)
      assert.deepEqual([areas.get("perspective"), areas.get("people"), areas.get("practice")], [4, 7, 9])
      assert.equal(items.filter((i) => i.type === "mc").length, 14)
      assert.ok(items.slice(0, 14).every((i) => i.type === "mc") && items.slice(14).every((i) => i.type === "offen"))
    }
  })

  test("Vorrang für «noch nicht geübt» und tiefe Beherrschung", () => {
    const m = masteryOf({ "2.01": [1, 8], "2.02": [1, 8], "2.03": [0.9, 8], "3.01": [0.2, 8] })
    for (const seed of [4, 5, 6]) {
      const comps = new Set(selectShort(POOL, seed, NONE, m).map((i) => i.competence))
      for (const id of ["2.01", "2.02", "2.03"] as const) assert.ok(!comps.has(id), `${id} trotz «sicher» gewählt`)
    }
  })
})

describe("selectTraining", () => {
  test("nur gewählte Kompetenzen und Typ, Anzahl genau, gleichmässig (Differenz ≤ 1)", () => {
    const competences: CompetenceId[] = ["1.01", "2.07", "3.04"]
    for (const seed of [1, 2, 3]) {
      const items = selectTraining(POOL, seed, NONE, NO_STATES, { competences, type: "mc", count: 7, now: NOW })
      assert.equal(items.length, 7)
      assert.ok(items.every((i) => competences.includes(i.competence) && i.type === "mc"))
      const counts = [...countBy(items, (i) => i.competence).values()]
      assert.ok(Math.max(...counts) - Math.min(...counts) <= 1, counts.join())
    }
  })

  test("zuerst nie gesehen, dann fällig, dann am längsten nicht gesehen", () => {
    const exposure = new Map<string, Exposure>([
      ["3.04-mc-01", { seenCount: 2, lastSeenAt: NOW - 1 * DAY }],
      ["3.04-mc-02", { seenCount: 1, lastSeenAt: NOW - 5 * DAY }],
    ])
    const states = new Map<string, LeitnerState>([
      ["3.04-mc-01", { box: 1, dueAt: NOW - DAY }],
      ["3.04-mc-02", { box: 3, dueAt: NOW + DAY }],
    ])
    const pick = (count: number) => selectTraining(POOL, 3, exposure, states, { competences: ["3.04"], type: "mc", count, now: NOW })
      .map((i) => i.questionId).sort()
    assert.deepEqual(pick(1), ["3.04-mc-03"])
    assert.deepEqual(pick(2), ["3.04-mc-01", "3.04-mc-03"])
    assert.deepEqual(pick(3), ["3.04-mc-01", "3.04-mc-02", "3.04-mc-03"])
  })

  test("weniger passende Fragen als verlangt → alle vorhandenen", () => {
    const items = selectTraining(POOL, 1, NONE, NO_STATES, { competences: ["3.04"], type: "beide", count: 30, now: NOW })
    assert.equal(items.length, 5)
  })
})

describe("Lücken schliessen", () => {
  test("weakestCompetences: «noch nicht geübt» zuerst, dann tiefste Beherrschung, Gleichstand nach Antworten und ID", () => {
    const all: Partial<Record<CompetenceId, [number, number]>> = {}
    for (const id of COMPETENCE_IDS) all[id] = [1, 8]
    all["3.10"] = [0, 2] // noch nicht geübt (2 Antworten)
    all["2.05"] = [0.25, 8]
    all["1.04"] = [0.25, 4]
    all["3.13"] = [0.3, 8]
    assert.deepEqual(weakestCompetences(masteryOf(all)), ["3.10", "1.04", "2.05"])
    // ganz ohne Antworten: die ersten drei IDs
    assert.deepEqual(weakestCompetences(mastery([])), ["1.01", "1.02", "1.03"])
  })

  test("4 je Kompetenz, fällige vor neuen, mindestens eine offene", () => {
    const pool = miniPool(5, 2)
    const exposure = new Map<string, Exposure>()
    const states = new Map<string, LeitnerState>()
    for (const q of pool) exposure.set(q.id, { seenCount: 1, lastSeenAt: NOW - 3 * DAY })
    exposure.delete("2.07-mc-05") // neu
    states.set("2.07-mc-04", { box: 1, dueAt: NOW - DAY }) // fällig
    states.set("2.07-mc-03", { box: 2, dueAt: NOW - 2 * DAY }) // fällig
    const competences: CompetenceId[] = ["2.07", "3.04", "1.05"]
    const items = selectGaps(pool, 8, exposure, states, competences, NOW)
    assert.equal(items.length, 12)
    for (const id of competences) {
      const mine = items.filter((i) => i.competence === id)
      assert.equal(mine.length, 4, id)
      assert.ok(mine.some((i) => i.type === "offen"), `${id}: keine offene`)
    }
    const ids = items.map((i) => i.questionId)
    for (const id of ["2.07-mc-03", "2.07-mc-04", "2.07-mc-05"]) assert.ok(ids.includes(id), id)
  })
})
