// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// lib/ipma/config.ts
// Einzige Stelle für die Werte und Grenzen des Prüfungssimulators (Spezifikation 6.3). Seit Nachtrag 8.9
// geeicht nach der Musterprüfung 2023 des VZPM (nur Format, keine Inhalte). Wer bewertungsrelevante Werte
// ändert, erhöht CONFIG_VERSION; alte Versuche rechnen mit ihrem gespeicherten Schnappschuss weiter.

import { RASTER_HALVES, type AreaId } from "./competences"

/** 1 = Annahmen (MC 1, offen 2 Punkte, 120 Punkte); 2 = Musterprüfung VZPM 2023 (offen 3 Punkte, 150 Punkte) */
export const CONFIG_VERSION = 2

/**
 * Gewichte (ganzzahlig ≥ 1): mc = Punkte je MC-Frage (× 4 Viertelpunkte); offen = Viertelpunkte je Halbpunkt
 * des Rasters (2: ein Halbpunkt ist ein halber Punkt). Beide Werte sind seit Version 1 unverändert.
 */
export interface Weights { mc: number; offen: number }

export interface ExamConfig {
  weights: Weights // mc 1, offen 2
  rasterMax: number // Halbpunkte einer offenen Frage: 6 = höchstens 3 Punkte (Musterprüfung)
  passPercent: number // 60 (Musterprüfung: 90 von 150 Punkten)
  minCompetences: number // 23 von 28
  openCorrectRaster: number // Halbpunkte, ab denen eine offene Frage «richtig» ist: 3 = 1.5 von 3 Punkten
  exam: {
    mc: number // 60 MC-Fragen
    offen: number // 30 offene Fragen
    mcCompetences: number // 14 Kompetenzen im MC-Teil, die übrigen 14 im offenen Teil
    partMinutes: { mc: number; offen: number } // Richtzeiten je Teil (75 + 105 min), nur Anzeige
    durationMin: number
    graceSeconds: number
  }
  short: { mc: number; offen: number; perArea: Record<AreaId, number>; durationMin: number }
  training: { minCount: number; maxCount: number; defaultCount: number }
  gaps: { competences: number; perCompetence: number; masteryWindow: number; minAnswers: number }
}

export const EXAM_CONFIG: ExamConfig = {
  weights: { mc: 1, offen: 2 },
  rasterMax: RASTER_HALVES,
  passPercent: 60,
  minCompetences: 23,
  openCorrectRaster: 3,
  exam: { mc: 60, offen: 30, mcCompetences: 14, partMinutes: { mc: 75, offen: 105 }, durationMin: 180, graceSeconds: 30 },
  short: { mc: 14, offen: 6, perArea: { perspective: 4, people: 7, practice: 9 }, durationMin: 40 },
  training: { minCount: 5, maxCount: 30, defaultCount: 10 },
  gaps: { competences: 3, perCompetence: 4, masteryWindow: 8, minAnswers: 3 },
}

/** Kopie, die jeder Versuch in IpmaAttempt.config speichert; die Auswertung rechnet nur damit (6.3). */
export type ConfigSnapshot = Pick<ExamConfig, "weights" | "rasterMax" | "passPercent" | "minCompetences" | "openCorrectRaster">

/** Schnappschuss der bewertungsrelevanten Werte (6.3) */
export function configSnapshot(cfg: ExamConfig = EXAM_CONFIG): ConfigSnapshot {
  return {
    weights: { mc: cfg.weights.mc, offen: cfg.weights.offen },
    rasterMax: cfg.rasterMax,
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

/**
 * Ausbaustufe der Bewertungsraster (Nachtrag 8.9):
 * - "uebergang": Raster mit Summe 3 (Schritte von 0.5) gelten; Raster des Altbestands mit ganzen Punkten und
 *   Summe 4 werden beim Laden auf Summe 3 umgerechnet (scaleLegacyRaster in lib/validations/ipma-pool.ts)
 * - "neu": nur noch Summe 3; ein Raster mit Summe 4 ist ein Fehler
 * Der Agent für den Fragenpool stellt alle Raster um und schaltet danach auf "neu".
 */
export type RasterStage = "uebergang" | "neu"
export const RASTER_STAGE: RasterStage = "uebergang"
