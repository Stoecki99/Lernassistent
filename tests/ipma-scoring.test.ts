// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// tests/ipma-scoring.test.ts
// Auswertung in Viertelpunkten (Format Musterprüfung VZPM, Nachtrag 8.9), Regeln 60 % und 23/28, Quellen,
// alte Schnappschüsse, Stärken/Schwächen,
// Empfehlung, Leitner und Beherrschung (Spezifikation 7.3).

import { describe, test } from "node:test"
import assert from "node:assert/strict"
import { COMPETENCE_IDS, type CompetenceId } from "@/lib/ipma/competences"
import { EXAM_CONFIG, configSnapshot, type ConfigSnapshot } from "@/lib/ipma/config"
import { answerScore, mastery, masteryLevel, nextLeitner, type GradedAnswer } from "@/lib/ipma/review"
import { evaluateAttempt, isCorrect, itemPointsQ, recommendStations, type ScoredItem, type StationCatalog } from "@/lib/ipma/scoring"
import { attemptRasterPoints, readConfig } from "@/lib/ipma/view"

const CFG: ConfigSnapshot = configSnapshot(EXAM_CONFIG)
/** Schnappschuss der Konfiguration 1 (vor Nachtrag 8.9): offen 2 Punkte, 120 Punkte */
const CFG_V1: ConfigSnapshot = { weights: { mc: 1, offen: 2 }, rasterMax: 4, passPercent: 60, minCompetences: 23, openCorrectRaster: 2 }
const DAY = 24 * 60 * 60 * 1000
const NOW = Date.UTC(2026, 11, 1)
// Aufteilung wie die Musterprüfung: 14 Kompetenzen MC (je 4, vier davon 5), 14 offen (je 2, zwei davon 3)
const MC_COMPS = COMPETENCE_IDS.filter((_, i) => i % 2 === 0)
const OPEN_COMPS = COMPETENCE_IDS.filter((_, i) => i % 2 === 1)
const EXTRA_MC = MC_COMPS.slice(0, 4)
const EXTRA_OF = OPEN_COMPS.slice(0, 2)

/** 90 Positionen wie eine Übungsprüfung (Nachtrag 8.9); Zusatzfragen am Schluss */
function examSkeleton(): ScoredItem[] {
  const items: ScoredItem[] = []
  for (const id of COMPETENCE_IDS) {
    const mc = MC_COMPS.includes(id)
    for (let k = 0; k < (mc ? 4 : 2); k++) items.push({ type: mc ? "mc" : "offen", competence: id })
  }
  for (const id of EXTRA_MC) items.push({ type: "mc", competence: id })
  for (const id of EXTRA_OF) items.push({ type: "offen", competence: id })
  return items
}

/** Alle richtig (MC) bzw. volle Halbpunkte (`full`), ausser in den Kompetenzen `failed` (alles falsch, 0 Punkte) */
function examWithFailed(failed: readonly CompetenceId[], skeleton: ScoredItem[] = examSkeleton(), full = 6): ScoredItem[] {
  return skeleton.map((i) => failed.includes(i.competence)
    ? { ...i, correctOption: false, rasterPoints: 0 }
    : { ...i, correctOption: true, rasterPoints: full })
}

/**
 * Genau `mcCorrect` richtige MC (zuerst die erste MC jeder Kompetenz, damit alle nachgewiesen sind) und
 * die Halbpunkte der 30 offenen Fragen aus `raster` (der Reihe nach).
 */
function examWithPoints(mcCorrect: number, raster: readonly number[]): ScoredItem[] {
  const items = examSkeleton()
  const mcIdx = items.map((it, i) => (it.type === "mc" ? i : -1)).filter((i) => i >= 0)
  const firstPerComp = MC_COMPS.map((id) => items.findIndex((it) => it.competence === id))
  const order = [...firstPerComp, ...mcIdx.filter((i) => !firstPerComp.includes(i))]
  const correct = new Set(order.slice(0, mcCorrect))
  let o = 0
  return items.map((it, i) => it.type === "mc"
    ? { ...it, correctOption: correct.has(i) }
    : { ...it, rasterPoints: raster[o++] ?? 0 })
}

/** 30 Halbpunkt-Werte: alle 3 (1.5 Punkte, «richtig»), die zwei Zusatzfragen am Schluss 0, `delta` auf der ersten */
function rasterHalf(delta = 0): number[] {
  return Array.from({ length: 30 }, (_, i) => (i >= 28 ? 0 : i === 0 ? 3 + delta : 3))
}

describe("Punkte und Bestehensregeln", () => {
  test("Höchstpunkte: 60 MC × 1 + 30 offen × 3 → 600 Viertelpunkte (150 Punkte)", () => {
    const r = evaluateAttempt(examWithFailed([]), CFG, "exam")
    assert.equal(r.maxPointsQ, 600)
    assert.equal(r.pointsQ, 600)
    assert.equal(r.competenceCount, 28)
  })

  test("Grenze genau: 90.0 Punkte (360) → passPoints true", () => {
    const items = examWithPoints(48, rasterHalf()) // 48 × 4 + 84 Halbpunkte × 2 = 192 + 168
    const r = evaluateAttempt(items, CFG, "exam")
    assert.equal(r.pointsQ, 360)
    assert.equal(r.passPoints, true)
    assert.equal(r.percent, 60)
    assert.equal(r.shownCount, 28)
  })

  test("knapp darunter: 89.5 Punkte (358) → passPoints false (59.7 %)", () => {
    const items = examWithPoints(48, rasterHalf(-1)) // 192 + 83 × 2 = 358
    const r = evaluateAttempt(items, CFG, "exam")
    assert.equal(r.pointsQ, 358)
    assert.equal(r.passPoints, false)
    assert.equal(r.percent, 59.7)
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
    assert.ok(no.percent >= 75) // 476 von 600
    assert.equal(no.passCompetences, false)
    assert.equal(no.passed, false)
  })

  test("beide Regeln verfehlt", () => {
    const failed: CompetenceId[] = OPEN_COMPS.slice(0, 13) // 13 offene Kompetenzen (28 Fragen) → 264 von 600 = 44 %
    const r = evaluateAttempt(examWithFailed(failed), CFG, "exam")
    assert.equal(r.pointsQ, 264)
    assert.equal(r.passPoints, false)
    assert.equal(r.passCompetences, false)
    assert.equal(r.passed, false)
  })

  test("offene Schwelle: 1.5 von 3 Punkten (3 Halbpunkte) → richtig, 1 Punkt → falsch, nicht bewertet → 0", () => {
    const base = { type: "offen" as const, competence: "3.11" as const }
    assert.equal(isCorrect({ ...base, rasterPoints: 3 }, CFG), true)
    assert.equal(isCorrect({ ...base, rasterPoints: 2 }, CFG), false)
    assert.equal(isCorrect({ ...base, rasterPoints: null }, CFG), false)
    assert.equal(itemPointsQ({ ...base, rasterPoints: null }, CFG), 0)
    assert.equal(itemPointsQ({ ...base, rasterPoints: 3 }, CFG), 6)
    assert.equal(itemPointsQ({ ...base, rasterPoints: 9 }, CFG), 12) // auf 3 Punkte begrenzt
    const r = evaluateAttempt([{ ...base, rasterPoints: null }, { ...base, rasterPoints: 6 }], CFG, "training")
    assert.equal(r.unassessedOpen, 1)
    assert.equal(r.pointsQ, 12)
    assert.equal(r.maxPointsQ, 24)
  })

  test("Kompetenz nur über offene Frage nachgewiesen (eine von zwei mit 1.5 Punkten)", () => {
    let first = true
    const items = examWithFailed([]).map((i) => {
      if (i.competence !== "2.09") return i
      const points = first ? 3 : 0
      first = false
      return { ...i, rasterPoints: points }
    })
    const r = evaluateAttempt(items, CFG, "exam")
    assert.deepEqual(r.competences["2.09"], { items: 2, correct: 1, shown: true })
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

  test("alter Schnappschuss (Konfiguration 1): bleibt bei 120 Punkten, offen richtig ab 2 von 4 Halbpunkten", () => {
    // Alte Übungsprüfung: je Kompetenz 2 MC + 1 offen, dazu 4 MC + 2 offen aus Practice
    const old: ScoredItem[] = []
    for (const id of COMPETENCE_IDS) old.push({ type: "mc", competence: id }, { type: "mc", competence: id }, { type: "offen", competence: id })
    for (const id of ["3.01", "3.02", "3.03", "3.04"] as const) old.push({ type: "mc", competence: id })
    for (const id of ["3.05", "3.06"] as const) old.push({ type: "offen", competence: id })
    const r = evaluateAttempt(examWithFailed([], old, 4), CFG_V1, "exam")
    assert.equal(r.maxPointsQ, 480)
    assert.equal(r.pointsQ, 480)
    assert.equal(isCorrect({ type: "offen", competence: "3.11", rasterPoints: 2 }, CFG_V1), true)
    assert.equal(itemPointsQ({ type: "offen", competence: "3.11", rasterPoints: 6 }, CFG_V1), 8) // höchstens 4 Halbpunkte
    // Gespeicherter Schnappschuss ohne rasterMax (Konfiguration 1) wird mit 4 Halbpunkten gelesen
    const stored = { weights: CFG_V1.weights, passPercent: 60, minCompetences: 23, openCorrectRaster: 2 }
    assert.deepEqual(readConfig(stored), CFG_V1)
    assert.deepEqual(readConfig(configSnapshot()), CFG)
  })

  test("Umrechnung alter Versuche: Raster schon auf 3 Punkte umgestellt, Versuch mit 4 Halbpunkten", () => {
    assert.equal(attemptRasterPoints([3, 2], [3, 3], CFG), 5)
    assert.equal(attemptRasterPoints([3, 3], [3, 3], CFG_V1), 4)
    assert.equal(attemptRasterPoints([2, 1], [3, 3], CFG_V1), 2) // 3 × 4 / 6
    assert.equal(attemptRasterPoints([2, 2], [2, 2], CFG_V1), 4)
  })

  test("Kurzprüfung: passCompetences null, bestanden nur nach Punkten", () => {
    const items: ScoredItem[] = COMPETENCE_IDS.slice(0, 20).map((id, i) => i < 14
      ? { type: "mc", competence: id, correctOption: i < 10 }
      : { type: "offen", competence: id, rasterPoints: 4 })
    const r = evaluateAttempt(items, CFG, "short") // 40 + 6 × 8 = 88 von 128 → 68.8 %
    assert.equal(r.passCompetences, null)
    assert.equal(r.maxPointsQ, 14 * 4 + 6 * 12)
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
    const changed = new Set<CompetenceId>()
    const items = examWithFailed(["2.07", "2.09", "1.03"]).map((i) => {
      if (changed.has(i.competence)) return i
      if (i.competence === "3.04") { changed.add("3.04"); return { ...i, correctOption: false } } // 3.04: 3/4
      if (i.competence === "3.11") { changed.add("3.11"); return { ...i, rasterPoints: 0 } } // 3.11: 1/2
      if (i.competence === "2.03") { changed.add("2.03"); return { ...i, rasterPoints: 2 } } // 2.03: 1/2 (1 Punkt < 1.5)
      return i
    })
    const r = evaluateAttempt(items, CFG, "exam", catalog)
    // nicht nachgewiesen (nach Anzahl Fragen), dann Anteil 1/2 (Gleichstand nach ID); 3.04 (3/4) fällt weg
    assert.deepEqual(r.weaknesses, ["1.03", "2.07", "2.09", "2.03", "3.11"])
    assert.equal(r.strengths.length, 3)
    assert.deepEqual(r.strengths, ["1.01", "1.05", "2.02"]) // 5 Fragen, alle richtig, vor den 4er-Kompetenzen
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

  test("offen 1 von 3 Punkten = falsch für das Fach; Beherrschung im Massstab des Versuchs", () => {
    const item: ScoredItem = { type: "offen", competence: "3.11", rasterPoints: 2 }
    assert.deepEqual(nextLeitner({ box: 3, dueAt: NOW }, isCorrect(item, CFG), NOW).box, 1)
    assert.equal(answerScore(item), 2 / 6)
    assert.equal(answerScore(item, 4), 0.5) // alter Versuch: 2 von 4 Halbpunkten
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
