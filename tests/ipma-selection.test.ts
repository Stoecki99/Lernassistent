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

/** Teil einer Kompetenz in einer Übungsprüfung: "mc", "offen" oder "beide" (darf nie vorkommen) */
function partOf(items: readonly SelectedItem[], id: CompetenceId): { mc: number; offen: number } {
  const mine = items.filter((i) => i.competence === id)
  return { mc: mine.filter((i) => i.type === "mc").length, offen: mine.filter((i) => i.type === "offen").length }
}

describe("selectExam (Format Musterprüfung VZPM, Nachtrag 8.9)", () => {
  // Übungsprüfung braucht je Kompetenz bis 5 MC bzw. 3 offene Fragen
  const EXAM_POOL = miniPool(5, 3)
  const exam = selectExam(EXAM_POOL, 12345, NONE, EXAM_CONFIG)

  test("Umfang: 60 MC auf 1–60, 30 offene auf 61–90", () => {
    assert.equal(exam.length, 90)
    assert.deepEqual(exam.map((i) => i.position), Array.from({ length: 90 }, (_, i) => i + 1))
    assert.ok(exam.slice(0, 60).every((i) => i.type === "mc"))
    assert.ok(exam.slice(60).every((i) => i.type === "offen"))
  })

  test("Abdeckung: alle 28 Kompetenzen, je genau in einem Teil; 14 × MC (4–5), 14 × offen (2–3)", () => {
    for (const seed of [1, 2, 3, 99, 2147483646]) {
      const items = selectExam(EXAM_POOL, seed, NONE)
      const parts = COMPETENCE_IDS.map((id) => ({ id, ...partOf(items, id) }))
      assert.equal(new Set(items.map((i) => i.competence)).size, 28, `Startwert ${seed}`)
      for (const p of parts) assert.ok((p.mc === 0) !== (p.offen === 0), `${p.id}: ${p.mc} MC, ${p.offen} offen`)
      const mcComps = parts.filter((p) => p.mc > 0)
      const openComps = parts.filter((p) => p.offen > 0)
      assert.equal(mcComps.length, 14)
      assert.equal(openComps.length, 14)
      assert.ok(mcComps.every((p) => p.mc === 4 || p.mc === 5))
      assert.ok(openComps.every((p) => p.offen === 2 || p.offen === 3))
      assert.equal(mcComps.filter((p) => p.mc === 5).length, 4)
      assert.equal(openComps.filter((p) => p.offen === 3).length, 2)
      // Je Bereich anteilig: Perspective 2–3, People 5, Practice 6–7 Kompetenzen im MC-Teil
      const mcIn = (area: string) => mcComps.filter((p) => getCompetence(p.id).area === area).length
      assert.ok([2, 3].includes(mcIn("perspective")), `Startwert ${seed}: Perspective ${mcIn("perspective")}`)
      assert.equal(mcIn("people"), 5)
      assert.equal(mcIn("perspective") + mcIn("practice"), 9)
    }
  })

  test("Zufall: die Aufteilung der Kompetenzen wechselt mit dem Startwert", () => {
    const splits = new Set(Array.from({ length: 20 }, (_, i) => {
      const items = selectExam(EXAM_POOL, 500 + i, NONE)
      return COMPETENCE_IDS.filter((id) => partOf(items, id).mc > 0).join()
    }))
    assert.ok(splits.size >= 10, `nur ${splits.size} verschiedene Aufteilungen`)
  })

  test("keine Frage doppelt, keine zwei Fragen derselben Gruppe", () => {
    const pool = miniPool(6, 3, (files) => {
      for (const q of fileOf(files, "3.04").fragen.filter((x) => x.typ === "mc").slice(0, 2)) q.gruppe = "netzplan-puffer"
      for (const q of fileOf(files, "2.07").fragen.filter((x) => x.typ === "offen")) q.gruppe = "glasl-stufen"
      fileOf(files, "2.07").fragen.push(rawOpen("2.07", 4), rawOpen("2.07", 5))
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
    const exposure = new Map<string, Exposure>([[EXAM_POOL[0].id, { seenCount: 1, lastSeenAt: NOW }]])
    for (const seed of [7, 4242, 987654321]) {
      assert.deepEqual(selectExam(EXAM_POOL, seed, exposure), selectExam(EXAM_POOL, seed, exposure))
    }
  })

  test("Zufall: 10 Startwerte → verschiedene Auswahlen und Reihenfolgen", () => {
    const runs = Array.from({ length: 10 }, (_, i) => selectExam(EXAM_POOL, 1000 + i, NONE))
    const sets = new Set(runs.map((r) => r.map((i) => i.questionId).sort().join()))
    const orders = new Set(runs.map((r) => r.map((i) => i.questionId).join()))
    assert.ok(sets.size >= 2, `nur ${sets.size} verschiedene Auswahlen`)
    assert.ok(orders.size >= 2, `nur ${orders.size} verschiedene Reihenfolgen`)
  })

  test("Optionen: Permutation, optionenFest bleibt [0,1,2,3], gleichmässig über 200 Startwerte (± 10 %)", () => {
    const pool = miniPool(5, 3, (files) => { for (const q of fileOf(files, "1.01").fragen) if (q.typ === "mc") q.optionenFest = true })
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
    // Je Kompetenz 6 MC und 3 offen; gesehen: mc-01, mc-02, of-01 → 4 MC und 2 offene nie gesehen
    const pool = miniPool(6, 3)
    const exposure = new Map<string, Exposure>()
    for (const q of pool) if (/-(mc-0[12]|of-01)$/.test(q.id)) exposure.set(q.id, { seenCount: 1, lastSeenAt: NOW })
    for (const seed of [5, 6, 7]) {
      const items = selectExam(pool, seed, exposure)
      for (const id of COMPETENCE_IDS) {
        const picked = items.filter((i) => i.competence === id)
        const seenCount = picked.filter((i) => exposure.has(i.questionId)).length
        const unseenAvail = picked[0]?.type === "mc" ? 4 : 2
        assert.equal(seenCount, Math.max(0, picked.length - unseenAvail), `Startwert ${seed}: ${id}`)
      }
    }
  })

  test("Pool zu klein → POOL_TOO_SMALL mit Kompetenz in der Meldung; sonst nie", () => {
    // 3.04 ohne offene Fragen: kommt immer in den MC-Teil, kein Fehler
    const noOpen = miniPool(5, 3, (files) => { fileOf(files, "3.04").fragen = fileOf(files, "3.04").fragen.filter((q) => q.typ === "mc") })
    for (let seed = 1; seed <= 30; seed++) {
      const items = selectExam(noOpen, seed, NONE)
      assert.ok(partOf(items, "3.04").mc >= 4, `Startwert ${seed}`)
    }
    // 3.04 mit nur 1 MC und 1 offenen Frage: passt in keinen Teil
    const tiny = miniPool(5, 3, (files) => {
      fileOf(files, "3.04").fragen = fileOf(files, "3.04").fragen.filter((q) => q.id === "3.04-mc-01" || q.id === "3.04-of-01")
    })
    assert.throws(() => selectExam(tiny, 1, NONE), (e: unknown) =>
      e instanceof IpmaError && e.status === 422 && e.code === "POOL_TOO_SMALL" && e.message.includes("3.04"))
    // Je Kompetenz nur 3 MC: der MC-Teil braucht 4
    assert.throws(() => selectExam(miniPool(3, 3), 1, NONE), (e: unknown) => e instanceof IpmaError && e.code === "POOL_TOO_SMALL")
    // Nur je 4 MC und 2 offen: die Zusatzfragen finden keinen Platz
    assert.throws(() => selectExam(miniPool(4, 2), 1, NONE), (e: unknown) => e instanceof IpmaError && e.code === "POOL_TOO_SMALL")
    for (let seed = 1; seed <= 50; seed++) assert.doesNotThrow(() => selectExam(EXAM_POOL, seed, NONE))
  })

  test("nur geprüfte Fragen: entwurf und zurueckgezogen nie gewählt", () => {
    const pool = miniPool(6, 4, (files) => {
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
