// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// lib/ipma/achievements.ts
// Abzeichen des Prüfungssimulators (Spezifikation 6.10): welche Bedingungen ipma_* ein Konto erfüllt.
// Rein, ohne Datenbank; lib/badges.ts liest die Daten und ruft ipmaAchievementStats auf.

import { COMPETENCE_IDS } from "./competences"
import { mastery, type GradedAnswer } from "./review"

/** Die sechs Abzeichen aus 6.10 (Badge.condition) */
export const IPMA_BADGE_CONDITIONS = [
  "ipma_erste_pruefung",
  "ipma_bestanden",
  "ipma_souveraen",
  "ipma_kompass",
  "ipma_lueckenschliesser",
  "ipma_landkarte",
] as const
export type IpmaBadgeCondition = (typeof IPMA_BADGE_CONDITIONS)[number]

/** Grenzen der Abzeichen (6.10) */
export const IPMA_BADGE_RULES = {
  souveraenPercent: 80,
  souveraenCompetences: 26,
  gapsRounds: 10,
} as const

/** Abgeschlossener Versuch (Auszug aus IpmaAttempt) */
export interface FinishedAttemptRow {
  mode: string
  variant: string
  status: string
  pointsQ: number | null
  maxPointsQ: number | null
  shownCount: number | null
  passed: boolean | null
}

/**
 * Erfüllte Bedingungen ipma_* (6.10): Prüfungsluft (erste Übungsprüfung), Bestanden und Souverän (nur
 * Echtbedingungen), Kompass (alle 28 nachgewiesen), Lückenschliesser (10 Runden), Landkarte (alle «sicher»).
 */
export function ipmaAchievementStats(attempts: readonly FinishedAttemptRow[], answers: readonly GradedAnswer[]): Set<IpmaBadgeCondition> {
  const out = new Set<IpmaBadgeCondition>()
  const finished = attempts.filter((a) => a.status === "finished")
  const exams = finished.filter((a) => a.mode === "exam")
  if (exams.length) out.add("ipma_erste_pruefung")
  const strict = exams.filter((a) => a.variant === "strict")
  if (strict.some((a) => a.passed === true)) out.add("ipma_bestanden")
  if (strict.some((a) =>
    a.pointsQ !== null && a.maxPointsQ !== null && a.maxPointsQ > 0 &&
    a.pointsQ * 100 >= a.maxPointsQ * IPMA_BADGE_RULES.souveraenPercent &&
    (a.shownCount ?? 0) >= IPMA_BADGE_RULES.souveraenCompetences)) out.add("ipma_souveraen")
  if (exams.some((a) => (a.shownCount ?? 0) >= COMPETENCE_IDS.length)) out.add("ipma_kompass")
  if (finished.filter((a) => a.mode === "gaps").length >= IPMA_BADGE_RULES.gapsRounds) out.add("ipma_lueckenschliesser")
  const map = mastery(answers)
  if (COMPETENCE_IDS.every((id) => map.get(id)?.level === "secure")) out.add("ipma_landkarte")
  return out
}
