// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// lib/ipma/scoring.ts
// Auswertung eines Versuchs in Viertelpunkten (Spezifikation 4.1, 4.2, 4.4). Reine Funktionen.
// Offene Fragen: Rasterpunkte in Halbpunkten (0 … rasterMax des Schnappschusses; Nachtrag 8.9).

import { COMPETENCE_IDS, POINT_Q, getCompetence, type CompetenceId } from "./competences"
import type { ConfigSnapshot } from "./config"
import type { AttemptMode, AttemptResult, StationAdvice } from "./types"

/** Bewertete Position für die Auswertung (4.4) */
export interface ScoredItem {
  type: "mc" | "offen"
  competence: CompetenceId
  correctOption?: boolean // MC
  rasterPoints?: number | null // offen: massgebend in Halbpunkten 0 … rasterMax, null = nicht bewertet
  selfRasterPoints?: number | null // offen: Selbstbewertung in Halbpunkten (nur für sources)
  aiRasterPoints?: number | null // offen: Claude-Bewertung in Halbpunkten (nur für sources)
}

/** Titel und Verfügbarkeit der Stationen (Server: lib/ipma/pool.ts loadStationCatalog) */
export type StationCatalog = ReadonlyMap<string, { title: string; available: boolean }>

const MAX_STRENGTHS = 3
const MAX_WEAKNESSES = 5
const MAX_STATIONS = 4
const STRENGTH_MIN_ITEMS = 2

function sum(values: readonly number[]): number {
  return values.reduce((s, v) => s + v, 0)
}

type ScoreConfig = Pick<ConfigSnapshot, "weights" | "rasterMax">

function clampRaster(points: number | null | undefined, rasterMax: number): number {
  return Math.max(0, Math.min(rasterMax, Math.trunc(points ?? 0)))
}

/** Erreichte Viertelpunkte einer Position (4.1, 4.2): MC weights.mc × 4, offen weights.offen × Halbpunkte */
export function itemPointsQ(item: ScoredItem, cfg: ScoreConfig): number {
  if (item.type === "mc") return item.correctOption ? cfg.weights.mc * POINT_Q : 0
  return cfg.weights.offen * clampRaster(item.rasterPoints, cfg.rasterMax)
}

/** Höchste Viertelpunkte einer Position (4.4): MC 4, offen 2 × 6 = 12 (3 Punkte) */
export function itemMaxQ(item: ScoredItem, cfg: ScoreConfig): number {
  return item.type === "mc" ? cfg.weights.mc * POINT_Q : cfg.weights.offen * cfg.rasterMax
}

/**
 * «Richtig» für «nachgewiesen» und das Leitner-Fach (1.5, 4.2): offen ab openCorrectRaster Halbpunkten
 * (seit Nachtrag 8.9: 3 = die Hälfte von 3 Punkten)
 */
export function isCorrect(item: ScoredItem, cfg: Pick<ConfigSnapshot, "openCorrectRaster" | "rasterMax">): boolean {
  return item.type === "mc" ? item.correctOption === true : clampRaster(item.rasterPoints, cfg.rasterMax) >= cfg.openCorrectRaster
}

/**
 * Empfehlung «Diese Stationen wiederholen» (4.4): je Schwäche die erste Station der Kompetenz, gleiche
 * zusammengefasst, sortiert nach Anzahl abgedeckter Schwächen (bei Gleichstand erste Nennung zuerst),
 * höchstens 4. Unbekannte oder unveröffentlichte Stationen erscheinen mit available false.
 */
export function recommendStations(weaknesses: readonly CompetenceId[], catalog: StationCatalog): StationAdvice[] {
  const groups = new Map<string, { order: number; competences: CompetenceId[] }>()
  for (const id of weaknesses) {
    const slug = getCompetence(id).stations[0]
    if (!slug) continue
    const g = groups.get(slug) ?? { order: groups.size, competences: [] }
    g.competences.push(id)
    groups.set(slug, g)
  }
  return [...groups.entries()]
    .sort((a, b) => b[1].competences.length - a[1].competences.length || a[1].order - b[1].order)
    .slice(0, MAX_STATIONS)
    .map(([slug, g]) => {
      const info = catalog.get(slug)
      return { slug, title: info?.title ?? slug, competences: g.competences, available: info?.available ?? false }
    })
}

/**
 * Ergebnis eines Versuchs (4.4). Entschieden wird ganzzahlig in Viertelpunkten:
 * bestanden nach Punkten, wenn pointsQ × 100 ≥ maxPointsQ × passPercent; bei exam zusätzlich
 * mindestens minCompetences nachgewiesene Kompetenzen.
 */
export function evaluateAttempt(
  items: readonly ScoredItem[],
  cfg: ConfigSnapshot,
  mode: AttemptMode,
  catalog: StationCatalog = new Map(),
): AttemptResult {
  const w = cfg.weights
  const pointsQ = sum(items.map((i) => itemPointsQ(i, cfg)))
  const maxPointsQ = sum(items.map((i) => itemMaxQ(i, cfg)))
  const passPoints = maxPointsQ > 0 && pointsQ * 100 >= maxPointsQ * cfg.passPercent
  const percent = maxPointsQ > 0 ? Math.round((pointsQ * 1000) / maxPointsQ) / 10 : 0

  const competences: AttemptResult["competences"] = {}
  for (const id of COMPETENCE_IDS) {
    const list = items.filter((i) => i.competence === id)
    if (!list.length) continue
    const correct = list.filter((i) => isCorrect(i, cfg)).length
    competences[id] = { items: list.length, correct, shown: correct > 0 }
  }
  const present = COMPETENCE_IDS.filter((id) => competences[id])
  const shownCount = present.filter((id) => competences[id].shown).length
  const passCompetences = mode === "exam" ? shownCount >= cfg.minCompetences : null
  const passed = mode === "exam" ? passPoints && passCompetences === true : passPoints

  const share = (id: CompetenceId) => competences[id].correct / competences[id].items
  const order = (id: CompetenceId) => COMPETENCE_IDS.indexOf(id)
  // Schwächen: alle nicht nachgewiesenen, dann tiefster Anteil; nur mit Anteil < 1; höchstens 5
  const weaknesses = present
    .filter((id) => share(id) < 1)
    .sort((a, b) =>
      Number(competences[b].shown === false) - Number(competences[a].shown === false) ||
      share(a) - share(b) ||
      competences[b].items - competences[a].items ||
      order(a) - order(b))
    .slice(0, MAX_WEAKNESSES)
  // Stärken: mindestens 2 Fragen, höchster Anteil (alle richtig zuerst), keine Schwäche; höchstens 3
  const strengths = present
    .filter((id) => competences[id].items >= STRENGTH_MIN_ITEMS && competences[id].shown && !weaknesses.includes(id))
    .sort((a, b) => share(b) - share(a) || competences[b].items - competences[a].items || order(a) - order(b))
    .slice(0, MAX_STRENGTHS)

  const open = items.filter((i) => i.type === "offen")
  const unassessedOpen = open.filter((i) => i.rasterPoints === null || i.rasterPoints === undefined).length
  const mcPointsQ = sum(items.filter((i) => i.type === "mc").map((i) => itemPointsQ(i, cfg)))
  const selfPointsQ = mcPointsQ + sum(open.map((i) =>
    w.offen * clampRaster(i.selfRasterPoints !== undefined ? i.selfRasterPoints : i.rasterPoints, cfg.rasterMax)))
  const hasAi = open.some((i) => i.aiRasterPoints !== null && i.aiRasterPoints !== undefined)
  const aiPointsQ = hasAi
    ? mcPointsQ + sum(open.map((i) => w.offen * clampRaster(i.aiRasterPoints ?? i.selfRasterPoints ?? i.rasterPoints, cfg.rasterMax)))
    : null

  return {
    pointsQ,
    maxPointsQ,
    percent,
    passPoints,
    shownCount,
    competenceCount: present.length,
    passCompetences,
    passed,
    unassessedOpen,
    competences,
    strengths,
    weaknesses,
    stations: recommendStations(weaknesses, catalog),
    sources: { selfPointsQ, aiPointsQ },
  }
}
