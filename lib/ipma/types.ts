// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// lib/ipma/types.ts
// Typen für API und Oberfläche (Spezifikation 4.4, 6.6). Nur Typen: Client-Komponenten importieren
// diese Datei ausschliesslich mit «import type».

import type { CompetenceId } from "./competences"

export type AttemptMode = "exam" | "short" | "training" | "gaps"
export type AttemptVariant = "strict" | "pausable"
export type AttemptStatus = "active" | "submitted" | "finished" | "aborted"
export type QuestionType = "mc" | "offen"
export type AiStatus = "none" | "pending" | "done" | "failed"
export type ScoreSource = "mc" | "self" | "ai"

/** Ergebnis eines Versuchs (4.4); Punkte in Viertelpunkten */
export interface AttemptResult {
  pointsQ: number
  maxPointsQ: number
  percent: number // nur Anzeige, 1 Stelle
  passPoints: boolean
  shownCount: number
  competenceCount: number // geprüfte Kompetenzen (28 bei exam)
  passCompetences: boolean | null // null ausser exam
  passed: boolean
  unassessedOpen: number
  competences: Record<string, { items: number; correct: number; shown: boolean }>
  strengths: CompetenceId[]
  weaknesses: CompetenceId[]
  stations: StationAdvice[]
  sources: { selfPointsQ: number; aiPointsQ: number | null }
}

/** Empfehlung «Diese Stationen wiederholen» (4.4) */
export interface StationAdvice {
  slug: string
  title: string
  competences: CompetenceId[]
  available: boolean
}

/** Position vor der Freigabe der Lösung (6.6): nie competence bei exam/short, nie Lösungen */
export interface ClientItem {
  position: number
  type: QuestionType
  points: number
  question: string
  options?: string[]
  competence?: CompetenceId
  choice: number | null
  text: string | null
  flagged: boolean
  locked: boolean
}

/** Position mit freigegebener Lösung (6.6) */
export interface SolvedItem extends ClientItem {
  questionId: string
  competence: CompetenceId
  correctOption?: number
  explanation?: string
  optionHints?: string[]
  modelAnswer?: string
  rubric?: { criterion: string; points: number }[]
  source: {
    lb?: string
    icbPage: number
    indicators: string[]
    station?: { slug: string; title: string; available: boolean }
    book?: string
    note?: string
  }
  selfScores: number[]
  aiStatus: AiStatus
  aiScores: number[]
  aiFeedback: { kriterien: { nummer: number; punkte: number; begruendung: string }[]; gesamtkommentar: string; verdacht: boolean } | null
  scoreSource: ScoreSource | null
  rasterPoints: number | null
  correct: boolean | null
  pointsQ: number | null
  revised?: boolean // Version seit dem Versuch geändert
  withdrawn?: boolean
}

/** Antwort von GET /api/ipma/attempts/[id] (6.6) */
export interface AttemptView {
  id: string
  mode: AttemptMode
  variant: AttemptVariant
  status: AttemptStatus
  startedAt: string
  deadlineAt: string | null
  serverNow: string
  activeSeconds: number
  paused: boolean
  items: (ClientItem | SolvedItem)[]
  result: AttemptResult | null
  canUseAi: boolean
}
