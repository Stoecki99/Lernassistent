// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// lib/ipma/review.ts
// Wiederholung: Leitner-Fächer, Beherrschung je Kompetenz, schwächste Kompetenzen (Spezifikation 3.5, 4.4).
// Reine Funktionen ohne Datenbank; Zeitpunkte in ms seit 1970.

import { COMPETENCE_IDS, RASTER_HALVES, type CompetenceId } from "./competences"
import { EXAM_CONFIG, LEITNER_DAYS, type ExamConfig } from "./config"

const DAY_MS = 24 * 60 * 60 * 1000

/** Leitner-Zustand einer Frage für ein Konto (IpmaQuestionState.box/dueAt). box 0 = gesehen, nie bewertet. */
export interface LeitnerState {
  box: number
  dueAt: number | null
}

/**
 * Nächstes Fach nach einer bewerteten Antwort (3.5): falsch → Fach 1; richtig → Fach + 1 (höchstens 5).
 * Fällig nach LEITNER_DAYS[Fach − 1] Tagen ab `now`.
 */
export function nextLeitner(prev: LeitnerState | null, correct: boolean, now: number): LeitnerState {
  const old = prev ? Math.max(0, Math.min(LEITNER_DAYS.length, Math.trunc(prev.box))) : 0
  const box = correct ? Math.min(LEITNER_DAYS.length, old + 1) : 1
  return { box, dueAt: now + LEITNER_DAYS[box - 1] * DAY_MS }
}

/** Fällig (3.5): bewertet (Fach ≥ 1) und dueAt ≤ jetzt */
export function isDue(state: LeitnerState | undefined, now: number): boolean {
  return state !== undefined && state.box >= 1 && state.dueAt !== null && state.dueAt <= now
}

/** Eine bewertete Antwort für die Beherrschung (4.4): MC 1/0, offen Halbpunkte ÷ rasterMax */
export interface GradedAnswer {
  competence: CompetenceId
  score: number // 0 … 1
  at: number // Zeitpunkt der Bewertung
}

/** Wert einer Antwort für die Beherrschung (4.4); rasterMax aus dem Schnappschuss des Versuchs (Halbpunkte) */
export function answerScore(
  item: { type: "mc" | "offen"; correctOption?: boolean; rasterPoints?: number | null },
  rasterMax: number = RASTER_HALVES,
): number {
  if (item.type === "mc") return item.correctOption ? 1 : 0
  return Math.max(0, Math.min(rasterMax, item.rasterPoints ?? 0)) / rasterMax
}

export type MasteryLevel = "secure" | "close" | "gap" | "untrained" // sicher, knapp, Lücke, noch nicht geübt

export interface Mastery {
  competence: CompetenceId
  value: number | null // Mittelwert der letzten Antworten; null ohne Antworten
  answers: number // Anzahl Antworten im Fenster (höchstens masteryWindow)
  level: MasteryLevel
}

/** Stufe nach 4.4: < minAnswers «noch nicht geübt», ≥ 0.75 «sicher», ≥ 0.5 «knapp», sonst «Lücke» */
export function masteryLevel(value: number | null, answers: number, cfg: ExamConfig = EXAM_CONFIG): MasteryLevel {
  if (answers < cfg.gaps.minAnswers || value === null) return "untrained"
  if (value >= 0.75) return "secure"
  if (value >= 0.5) return "close"
  return "gap"
}

/**
 * Beherrschung aller 28 Kompetenzen (4.4): je Kompetenz die letzten `masteryWindow` Antworten (nach Zeitpunkt),
 * Mittelwert. Kompetenzen ohne Antworten erscheinen mit value null.
 */
export function mastery(answers: readonly GradedAnswer[], cfg: ExamConfig = EXAM_CONFIG): Map<CompetenceId, Mastery> {
  const lists = new Map<CompetenceId, GradedAnswer[]>()
  for (const a of answers) {
    const list = lists.get(a.competence) ?? []
    list.push(a)
    lists.set(a.competence, list)
  }
  const out = new Map<CompetenceId, Mastery>()
  for (const id of COMPETENCE_IDS) {
    const recent = (lists.get(id) ?? []).slice().sort((x, y) => y.at - x.at).slice(0, cfg.gaps.masteryWindow)
    const value = recent.length ? recent.reduce((s, a) => s + a.score, 0) / recent.length : null
    out.set(id, { competence: id, value, answers: recent.length, level: masteryLevel(value, recent.length, cfg) })
  }
  return out
}

/**
 * Die schwächsten Kompetenzen für «Lücken schliessen» (3.5): «noch nicht geübt» zuerst, dann tiefste
 * Beherrschung; bei Gleichstand weniger Antworten zuerst, dann Reihenfolge der IDs.
 */
export function weakestCompetences(
  masteryMap: ReadonlyMap<CompetenceId, Mastery>,
  cfg: ExamConfig = EXAM_CONFIG,
): CompetenceId[] {
  const rows = COMPETENCE_IDS.map((id, index) => {
    const m = masteryMap.get(id)
    const answers = m?.answers ?? 0
    const untrained = !m || m.level === "untrained"
    return { id, index, untrained, value: m?.value ?? 0, answers }
  })
  rows.sort((a, b) => {
    if (a.untrained !== b.untrained) return a.untrained ? -1 : 1
    if (!a.untrained && a.value !== b.value) return a.value - b.value
    if (a.answers !== b.answers) return a.answers - b.answers
    return a.index - b.index
  })
  return rows.slice(0, cfg.gaps.competences).map((r) => r.id)
}
