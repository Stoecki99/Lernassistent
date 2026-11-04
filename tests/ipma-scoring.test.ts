// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// tests/ipma-scoring.test.ts
// Auswertung in Viertelpunkten, Regeln 60 % und 23/28, Quellen, Gewichte, Stärken/Schwächen,
// Empfehlung, Leitner und Beherrschung (Spezifikation 7.3).

import { describe, test } from "node:test"
import assert from "node:assert/strict"
import { COMPETENCE_IDS, type CompetenceId } from "@/lib/ipma/competences"
import { EXAM_CONFIG, configSnapshot, type ConfigSnapshot } from "@/lib/ipma/config"
import { answerScore, mastery, masteryLevel, nextLeitner, type GradedAnswer } from "@/lib/ipma/review"
import { evaluateAttempt, isCorrect, itemPointsQ, recommendStations, type ScoredItem, type StationCatalog } from "@/lib/ipma/scoring"

const CFG: ConfigSnapshot = configSnapshot(EXAM_CONFIG)
const DAY = 24 * 60 * 60 * 1000
const NOW = Date.UTC(2026, 11, 1)
const EXTRA_MC: CompetenceId[] = ["3.01", "3.02", "3.03", "3.04"]
const EXTRA_OF: CompetenceId[] = ["3.05", "3.06"]

/** 90 Positionen wie eine Übungsprüfung: je Kompetenz 2 MC + 1 offen, dazu 4 MC + 2 offen aus Practice */
function examSkeleton(): ScoredItem[] {
  const items: ScoredItem[] = []
  for (const id of COMPETENCE_IDS) {
    items.push({ type: "mc", competence: id }, { type: "mc", competence: id }, { type: "offen", competence: id })
  }
  for (const id of EXTRA_MC) items.push({ type: "mc", competence: id })
  for (const id of EXTRA_OF) items.push({ type: "offen", competence: id })
  return items
}

/** Alle richtig (MC) bzw. volle Rasterpunkte, ausser in den Kompetenzen `failed` (alles falsch, 0 Punkte) */
function examWithFailed(failed: readonly CompetenceId[]): ScoredItem[] {
  return examSkeleton().map((i) => failed.includes(i.competence)
    ? { ...i, correctOption: false, rasterPoints: 0 }
    : { ...i, correctOption: true, rasterPoints: 4 })
}

/**
 * Genau `mcCorrect` richtige MC (zuerst die erste MC jeder Kompetenz, damit alle 28 nachgewiesen sind) und
 * die Rasterpunkte der 30 offenen Fragen aus `raster` (der Reihe nach).
 */
function examWithPoints(mcCorrect: number, raster: readonly number[]): ScoredItem[] {
  const items = examSkeleton()
  const mcIdx = items.map((it, i) => (it.type === "mc" ? i : -1)).filter((i) => i >= 0)
  const firstPerComp = mcIdx.filter((i, k) => k % 2 === 0 && i < 84)
  const order = [...firstPerComp, ...mcIdx.filter((i) => !firstPerComp.includes(i))]
  const correct = new Set(order.slice(0, mcCorrect))
  let o = 0
  return items.map((it, i) => it.type === "mc"
    ? { ...it, correctOption: correct.has(i) }
    : { ...it, rasterPoints: raster[o++] ?? 0 })
}

/** 30 Rasterwerte mit der Summe `total` aus Zweien und Einsen */
function rasterSum(total: number): number[] {
  const twos = Math.min(30, Math.floor(total / 2))
  const out: number[] = Array.from({ length: 30 }, (_, i) => (i < twos ? 2 : 0))
  let rest = total - twos * 2
  for (let i = 29; i >= 0 && rest > 0; i--) if (out[i] === 0) { out[i] = 1; rest -= 1 }
  return out
}

/** Rasterwerte so, dass jede offene Frage 2 Punkte hat, ausser `ones` Fragen mit 1 */
function rasterMixed(ones: number, zeros = 0): number[] {
  return Array.from({ length: 30 }, (_, i) => (i < zeros ? 0 : i < zeros + ones ? 1 : 2))
}

describe("Punkte und Bestehensregeln", () => {
  test("Höchstpunkte: 60 MC + 30 offen mit Gewicht 1/2 → 480 Viertelpunkte (120 Punkte)", () => {
    const r = evaluateAttempt(examWithFailed([]), CFG, "exam")
    assert.equal(r.maxPointsQ, 480)
    assert.equal(r.pointsQ, 480)
    assert.equal(r.competenceCount, 28)
  })

  test("Grenze genau: 72.0 Punkte (288) → passPoints true", () => {
    const items = examWithPoints(48, rasterMixed(12)) // 48 × 4 + (18 × 2 + 12 × 1) × 2 = 192 + 96
    const r = evaluateAttempt(items, CFG, "exam")
    assert.equal(r.pointsQ, 288)
    assert.equal(r.passPoints, true)
    assert.equal(r.percent, 60)
  })

  test("knapp darunter: 71.5 Punkte (286) → passPoints false (59.6 %)", () => {
    const items = examWithPoints(48, rasterMixed(11, 1)) // 192 + (18 × 2 + 11) × 2 = 286
    const r = evaluateAttempt(items, CFG, "exam")
    assert.equal(r.pointsQ, 286)
    assert.equal(r.passPoints, false)
    assert.equal(r.percent, 59.6)
    assert.equal(r.shownCount, 28)
    assert.equal(r.passed, false) // 28 Kompetenzen, aber Punkte verfehlt
    assert.equal(r.passCompetences, true)
  })

  test("Kompetenzen genau: 23 nachgewiesen und ≥ 60 % → bestanden; 22 → nicht bestanden", () => {
    const ok = evaluateAttempt(examWithFailed(["2.01", "2.02", "2.03", "2.04", "2.05"]), CFG, "exam")
    assert.equal(ok.shownCount, 23)
    assert.equal(ok.passPoints, true)
    assert.equal(ok.passed, true)
    const no = evaluateAttempt(examWithFailed(["2.01", "2.02", "2.03", "2.04", "2.05", "2.06"]), CFG, "exam")
    assert.equal(no.shownCount, 22)
    assert.equal(no.passPoints, true)
    assert.ok(no.percent >= 80)
    assert.equal(no.passCompetences, false)
    assert.equal(no.passed, false)
  })

  test("beide Regeln verfehlt", () => {
    const failed: CompetenceId[] = ["1.01", "1.02", "1.03", "1.04", "1.05", "2.01", "2.02", "2.03", "2.04", "2.05", "2.06", "2.07", "2.08"] // 13 × 16 Viertelpunkte verloren → 56.7 %
    const r = evaluateAttempt(examWithFailed(failed), CFG, "exam")
    assert.equal(r.passPoints, false)
    assert.equal(r.passCompetences, false)
    assert.equal(r.passed, false)
  })

  test("offene Schwelle: 2 → richtig, 1 → falsch, nicht bewertet → 0 Punkte und unassessedOpen", () => {
    const base = { type: "offen" as const, competence: "3.11" as const }
    assert.equal(isCorrect({ ...base, rasterPoints: 2 }, CFG), true)
    assert.equal(isCorrect({ ...base, rasterPoints: 1 }, CFG), false)
    assert.equal(isCorrect({ ...base, rasterPoints: null }, CFG), false)
    assert.equal(itemPointsQ({ ...base, rasterPoints: null }, CFG.weights), 0)
    assert.equal(itemPointsQ({ ...base, rasterPoints: 3 }, CFG.weights), 6)
    const r = evaluateAttempt([{ ...base, rasterPoints: null }, { ...base, rasterPoints: 4 }], CFG, "training")
    assert.equal(r.unassessedOpen, 1)
    assert.equal(r.pointsQ, 8)
  })

  test("Kompetenz nur über offene Frage nachgewiesen", () => {
    const items = examWithFailed([]).map((i) => i.competence === "2.09"
      ? { ...i, correctOption: false, rasterPoints: i.type === "offen" ? 2 : 0 }
      : i)
    const r = evaluateAttempt(items, CFG, "exam")
    assert.deepEqual(r.competences["2.09"], { items: 3, correct: 1, shown: true })
  })

  test("massgebende Quelle: Claude ersetzt die Selbstbewertung, sources zeigt beide Summen", () => {
    const items: ScoredItem[] = [
      { type: "mc", competence: "3.04", correctOption: true },
      { type: "offen", competence: "3.11", rasterPoints: 2, selfRasterPoints: 4, aiRasterPoints: 2 },
      { type: "offen", competence: "2.03", rasterPoints: 3, selfRasterPoints: 3, aiRasterPoints: null },
    ]
    const r = evaluateAttempt(items, CFG, "training")
    assert.equal(r.pointsQ, 4 + 4 + 6)
    assert.deepEqual(r.sources, { selfPointsQ: 4 + 8 + 6, aiPointsQ: 4 + 4 + 6 })
    const noAi = evaluateAttempt(items.map((i) => ({ ...i, aiRasterPoints: null })), CFG, "training")
    assert.equal(noAi.sources.aiPointsQ, null)
  })

  test("Gewichte geändert: 1/3 im Schnappschuss → 150 Punkte, Grenze 90; alter Versuch bleibt bei 120", () => {
    const items = examWithFailed([])
    const neu = { ...CFG, weights: { mc: 1, offen: 3 } }
    assert.equal(evaluateAttempt(items, neu, "exam").maxPointsQ, 600)
    assert.equal(evaluateAttempt(items, CFG, "exam").maxPointsQ, 480)
    // Grenze 90 Punkte = 360 Viertelpunkte: 48 richtige MC (192) + 56 Rasterpunkte × 3 (168)
    const exact = evaluateAttempt(examWithPoints(48, rasterSum(56)), neu, "exam")
    assert.equal(exact.pointsQ, 192 + 168)
    assert.equal(exact.passPoints, true)
    const below = evaluateAttempt(examWithPoints(47, rasterSum(56)), neu, "exam")
    assert.equal(below.passPoints, false)
  })

  test("Kurzprüfung: passCompetences null, bestanden nur nach Punkten", () => {
    const items: ScoredItem[] = COMPETENCE_IDS.slice(0, 20).map((id, i) => i < 14
      ? { type: "mc", competence: id, correctOption: i < 10 }
      : { type: "offen", competence: id, rasterPoints: 2 })
    const r = evaluateAttempt(items, CFG, "short") // 40 + 6 × 4 = 64 von 104 → 61.5 %
    assert.equal(r.passCompetences, null)
    assert.equal(r.maxPointsQ, 14 * 4 + 6 * 8)
    assert.equal(r.passed, r.passPoints)
    assert.equal(r.passed, true)
    assert.equal(r.competenceCount, 20)
  })
})

describe("Stärken, Schwächen, Empfehlung", () => {
  const catalog: StationCatalog = new Map([
    ["17-persoenliche-kompetenzen", { title: "Persönliche und soziale Kompetenzen", available: true }],
    ["04-projektkontext", { title: "Kontext: Strategie, Portfolio, Governance", available: false }],
    ["16-fuehrung-team-meetings", { title: "Führung, Team, Meetings", available: true }],
    ["10-netzplan-und-gantt", { title: "Netzplan und Gantt", available: true }],
    ["13-chancen-und-risiken", { title: "Chancen und Risiken", available: true }],
  ])

  test("Schwächen: nicht nachgewiesene zuerst, dann tiefster Anteil, höchstens 5; Stärken höchstens 3", () => {
    const items = examWithFailed(["2.07", "2.09", "1.03"]).map((i) => {
      if (i.competence === "3.04" && i.type === "offen") return { ...i, rasterPoints: 0 } // 3.04: 3/4
      if (i.competence === "3.11" && i.type === "mc") return { ...i, correctOption: false } // 3.11: 1/3
      if (i.competence === "2.03" && i.type === "offen") return { ...i, rasterPoints: 1 } // 2.03: 2/3
      return i
    })
    const r = evaluateAttempt(items, CFG, "exam", catalog)
    assert.deepEqual(r.weaknesses, ["1.03", "2.07", "2.09", "3.11", "2.03"])
    assert.equal(r.strengths.length, 3)
    assert.deepEqual(r.strengths, ["3.01", "3.02", "3.03"]) // 4 Fragen, alle richtig, vor den 3er-Kompetenzen
    assert.ok(r.strengths.every((id) => !r.weaknesses.includes(id)))
  })

  test("Empfehlung: zusammengefasst, nach Anzahl sortiert, höchstens 4, unveröffentlichte available false", () => {
    const advice = recommendStations(["1.03", "2.07", "2.09", "3.11", "2.03", "1.01", "3.04"], catalog)
    assert.equal(advice.length, 4)
    assert.deepEqual(advice[0], { slug: "04-projektkontext", title: "Kontext: Strategie, Portfolio, Governance", competences: ["1.03", "1.01"], available: false })
    assert.deepEqual(advice[1].competences, ["2.07", "2.09"])
    assert.equal(advice[1].slug, "17-persoenliche-kompetenzen")
    assert.deepEqual(advice.slice(2).map((a) => a.slug), ["13-chancen-und-risiken", "16-fuehrung-team-meetings"])
    const unknown = recommendStations(["3.09"], new Map())
    assert.deepEqual(unknown, [{ slug: "21-beschaffung-und-vertraege", title: "21-beschaffung-und-vertraege", competences: ["3.09"], available: false }])
  })
})

describe("Leitner und Beherrschung", () => {
  test("falsch → Fach 1, fällig +1 Tag; richtig aus Fach 5 → bleibt 5, +16 Tage; Fach + 1", () => {
    assert.deepEqual(nextLeitner({ box: 4, dueAt: NOW }, false, NOW), { box: 1, dueAt: NOW + DAY })
    assert.deepEqual(nextLeitner({ box: 5, dueAt: NOW }, true, NOW), { box: 5, dueAt: NOW + 16 * DAY })
    assert.deepEqual(nextLeitner(null, true, NOW), { box: 1, dueAt: NOW + DAY })
    assert.deepEqual(nextLeitner({ box: 2, dueAt: NOW }, true, NOW), { box: 3, dueAt: NOW + 4 * DAY })
  })

  test("offen 1/4 = falsch für das Fach", () => {
    const item: ScoredItem = { type: "offen", competence: "3.11", rasterPoints: 1 }
    assert.deepEqual(nextLeitner({ box: 3, dueAt: NOW }, isCorrect(item, CFG), NOW).box, 1)
    assert.equal(answerScore(item), 0.25)
  })

  test("Fenster 8, < 3 Antworten «noch nicht geübt», Grenzen 0.5 und 0.75", () => {
    const answers: GradedAnswer[] = []
    // 3.04: 10 Antworten, die ältesten zwei falsch, die neuesten acht richtig → 1.0
    for (let i = 0; i < 10; i++) answers.push({ competence: "3.04", score: i < 8 ? 1 : 0, at: NOW - i * DAY })
    answers.push({ competence: "2.07", score: 1, at: NOW }, { competence: "2.07", score: 1, at: NOW - DAY })
    const m = mastery(answers)
    assert.deepEqual(m.get("3.04"), { competence: "3.04", value: 1, answers: 8, level: "secure" })
    assert.equal(m.get("2.07")?.level, "untrained")
    assert.equal(m.get("1.01")?.value, null)
    assert.equal(m.size, 28)
    assert.equal(masteryLevel(0.75, 3), "secure")
    assert.equal(masteryLevel(0.749, 3), "close")
    assert.equal(masteryLevel(0.5, 3), "close")
    assert.equal(masteryLevel(0.499, 3), "gap")
    assert.equal(masteryLevel(1, 2), "untrained")
  })
})

describe("Selbstbewertung: Abgleich mit dem Server", () => {
  test("selfScoresKey hängt am Inhalt, nicht an Array-Referenzen", async () => {
    const { selfScoresKey } = await import("@/components/features/ipma/format")
    const rubric = [{ criterion: "a", points: 1 }, { criterion: "b", points: 2 }]
    const leer = selfScoresKey({ selfScores: [], rubric })
    // Neu geladener Versuch (neue Arrays, gleicher Inhalt): Auswahl der Karte bleibt erhalten
    assert.equal(selfScoresKey({ selfScores: [], rubric: rubric.map((r) => ({ ...r })) }), leer)
    // Gespeicherte Bewertung vom Server: Karte übernimmt sie
    assert.notEqual(selfScoresKey({ selfScores: [1, 2], rubric }), leer)
    assert.notEqual(selfScoresKey({ selfScores: [1, 1], rubric }), selfScoresKey({ selfScores: [1, 2], rubric }))
    assert.equal(selfScoresKey({ selfScores: [], rubric: undefined }), "|")
  })
})
