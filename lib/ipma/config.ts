// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// lib/ipma/config.ts
// Einzige Stelle für Annahmen und Grenzen des Prüfungssimulators (Spezifikation 6.3).
// Werte als ANNAHME dürfen hier geändert werden; danach CONFIG_VERSION erhöhen.

import type { AreaId } from "./competences"

export const CONFIG_VERSION = 1

export interface Weights { mc: number; offen: number } // ganzzahlig ≥ 1

export interface ExamConfig {
  weights: Weights // ANNAHME: mc 1, offen 2
  passPercent: number // 60
  minCompetences: number // 23
  openCorrectRaster: number // ANNAHME: 2 von 4 Rasterpunkten = «richtig»
  exam: {
    mc: number
    offen: number
    perCompetence: { mc: number; offen: number }
    extraArea: AreaId
    durationMin: number
    graceSeconds: number
  }
  short: { mc: number; offen: number; perArea: Record<AreaId, number>; durationMin: number }
  training: { minCount: number; maxCount: number; defaultCount: number }
  gaps: { competences: number; perCompetence: number; masteryWindow: number; minAnswers: number }
}

export const EXAM_CONFIG: ExamConfig = {
  weights: { mc: 1, offen: 2 },
  passPercent: 60,
  minCompetences: 23,
  openCorrectRaster: 2,
  exam: { mc: 60, offen: 30, perCompetence: { mc: 2, offen: 1 }, extraArea: "practice", durationMin: 180, graceSeconds: 30 },
  short: { mc: 14, offen: 6, perArea: { perspective: 4, people: 7, practice: 9 }, durationMin: 40 },
  training: { minCount: 5, maxCount: 30, defaultCount: 10 },
  gaps: { competences: 3, perCompetence: 4, masteryWindow: 8, minAnswers: 3 },
}

/** Kopie, die jeder Versuch in IpmaAttempt.config speichert; die Auswertung rechnet nur damit (6.3). */
export type ConfigSnapshot = Pick<ExamConfig, "weights" | "passPercent" | "minCompetences" | "openCorrectRaster">

/** Schnappschuss der bewertungsrelevanten Werte (6.3) */
export function configSnapshot(cfg: ExamConfig = EXAM_CONFIG): ConfigSnapshot {
  return {
    weights: { mc: cfg.weights.mc, offen: cfg.weights.offen },
    passPercent: cfg.passPercent,
    minCompetences: cfg.minCompetences,
    openCorrectRaster: cfg.openCorrectRaster,
  }
}

/** Leitner-Fächer 1 … 5: fällig nach so vielen Tagen (3.5) */
export const LEITNER_DAYS = [1, 2, 4, 8, 16] as const

/**
 * Ausbaustufe des Fragenpools (2.4, 7.1). Bestimmt, welche Prüfungen über den ganzen Pool als Fehler gelten:
 * - "aufbau": nur Format; Mindestumfang und Indikator-Abdeckung als Warnung (AP1, solange Fragen im Entwurf sind)
 * - "teil1": Mindestumfang 4 MC + 2 offen geprüft je Kompetenz als Fehler, Abdeckung als Warnung
 * - "teil2": Mindestumfang 6 MC + 3 offen als Fehler, Abdeckung als Fehler
 * AP2 schaltet die Stufe beim Meilenstein «Teil 1» bzw. «Teil 2» um.
 */
export type PoolStage = "aufbau" | "teil1" | "teil2"
export const POOL_STAGE: PoolStage = "teil2"

export const POOL_STAGE_MINIMUM: Record<PoolStage, { mc: number; offen: number } | null> = {
  aufbau: null,
  teil1: { mc: 4, offen: 2 },
  teil2: { mc: 6, offen: 3 },
}

/** Mindestzahl geprüfter Fragen je Kompetenz in der aktuellen Stufe; null = noch nicht erzwungen (2.3) */
export const POOL_MINIMUM: { mc: number; offen: number } | null = POOL_STAGE_MINIMUM[POOL_STAGE]
