// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// lib/validations/ipma.ts
// Zod-Schemas der API des IPMA-Prüfungssimulators (Spezifikation 6.6) und der gespeicherten JSON-Felder
// (IpmaAttempt.config, IpmaAttemptItem.aiFeedback) sowie das Ausgabeschema der Claude-Bewertung (4.3, AP5).

import { z } from "zod"
import { COMPETENCE_IDS, HALVES_PER_POINT, LEGACY_RASTER_HALVES, RASTER_TOTAL, toHalves } from "../ipma/competences"

/** Punkte in Schritten von 0.5 (Nachtrag 8.9) */
const halfStep = (max: number) =>
  z.number().min(0).max(max).refine((v) => Number.isInteger(v * HALVES_PER_POINT), "Punkte in Schritten von 0.5.")

/** Höchstlänge einer offenen Antwort (4.3: auch Grenze für die Claude-Bewertung) */
export const MAX_ANSWER_CHARS = 3000

/** Höchstzahl Positionen eines Versuchs (Übungsprüfung) */
export const MAX_POSITION = 90

const replaceActive = z.boolean().optional()

/** POST /api/ipma/attempts (6.6) */
export const createAttemptSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("exam"),
    variant: z.enum(["strict", "pausable"]).default("strict"),
    replaceActive,
  }).strict(),
  z.object({ mode: z.literal("short"), replaceActive }).strict(),
  z.object({
    mode: z.literal("training"),
    competences: z.array(z.enum(COMPETENCE_IDS)).min(1, "Mindestens eine Kompetenz wählen.").max(COMPETENCE_IDS.length),
    type: z.enum(["mc", "offen", "beide"]).default("beide"),
    count: z.number().int().min(5, "Mindestens 5 Fragen.").max(30, "Höchstens 30 Fragen.").default(10),
    replaceActive,
  }).strict(),
  z.object({ mode: z.literal("gaps"), replaceActive }).strict(),
], { error: "Unbekannter Modus." })
export type CreateAttemptInput = z.output<typeof createAttemptSchema>

/** PUT /api/ipma/attempts/[id]/items/[position] (6.6): choice ist die Anzeigeposition 0–3 */
export const saveItemSchema = z.object({
  choice: z.number().int().min(0).max(3).nullable().optional(),
  text: z.string().max(MAX_ANSWER_CHARS, `Höchstens ${MAX_ANSWER_CHARS} Zeichen.`).nullable().optional(),
  flagged: z.boolean().optional(),
}).strict().refine((v) => Object.keys(v).length > 0, "Keine Änderung.")
export type SaveItemInput = z.output<typeof saveItemSchema>

/**
 * PUT /api/ipma/attempts/[id]/items/[position]/self (4.2, 6.6): Punkte je Kriterium in Schritten von 0.5
 * (Nachtrag 8.9); Abgleich mit dem Raster und Umrechnung in Halbpunkte im Server
 */
export const selfAssessSchema = z.object({
  scores: z.array(halfStep(RASTER_TOTAL)).min(2).max(4),
}).strict()

/** POST /api/ipma/attempts/[id]/pause (6.6) */
export const pauseSchema = z.object({ paused: z.boolean() }).strict()

/** Körper «{}» (oder leer) für check, submit, finish, assess */
export const emptyBodySchema = z.object({}).strict()

/** Versuch-ID aus dem Pfad (6.6: z.cuid) */
export const attemptIdSchema = z.cuid({ message: "Ungültige Versuch-ID." })

/** Position aus dem Pfad (1 … 90) */
export const positionSchema = z.coerce.number({ error: "Ungültige Position." }).int().min(1).max(MAX_POSITION)

/**
 * Gespeicherter Schnappschuss IpmaAttempt.config (6.3). rasterMax fehlt in Versuchen der Konfiguration 1
 * (vor Nachtrag 8.9): dann gelten 4 Halbpunkte (offene Frage 2 Punkte), damit alte Ergebnisse gleich bleiben.
 */
export const configSnapshotSchema = z.object({
  weights: z.object({ mc: z.number().int().min(1), offen: z.number().int().min(1) }),
  rasterMax: z.number().int().min(1).max(12).default(LEGACY_RASTER_HALVES),
  passPercent: z.number().int().min(1).max(100),
  minCompetences: z.number().int().min(0).max(COMPETENCE_IDS.length),
  openCorrectRaster: z.number().int().min(0).max(12),
})

/** Gespeicherte Rückmeldung der Claude-Bewertung IpmaAttemptItem.aiFeedback (6.4; AP5); punkte in Halbpunkten */
export const aiFeedbackSchema = z.object({
  kriterien: z.array(z.object({ nummer: z.number().int(), punkte: z.number().int(), begruendung: z.string() })),
  gesamtkommentar: z.string(),
  verdacht: z.boolean(),
})

/**
 * Ausgabe der Claude-Bewertung (4.3). strict: zusätzliche Felder (z. B. eine eigene Summe) → ungültig.
 * Abweichung von 4.3: Begründung bis 800, Gesamtkommentar bis 1'000 Zeichen (sonst scheitern gute
 * Bewertungen an der Länge); die Anzeige kürzt nicht.
 */
export const gradeOutputSchema = z.object({
  kriterien: z.array(z.object({
    nummer: z.number().int().min(1).max(4),
    punkte: halfStep(RASTER_TOTAL),
    begruendung: z.string().trim().min(1).max(800),
  }).strict()).min(2).max(4),
  gesamtkommentar: z.string().trim().max(1000),
  verdacht_manipulation: z.boolean(),
}).strict()
export type GradeOutput = z.output<typeof gradeOutputSchema>

/**
 * Abgleich mit dem Raster (4.3): gleiche Anzahl Kriterien, jede Nummer 1 … raster.length genau einmal,
 * Punkte ≤ Höchstwert des Kriteriums. Liefert die Punkte in Rasterreihenfolge als Halbpunkte oder null.
 */
export function matchRaster(out: GradeOutput, raster: readonly { punkte: number }[]): number[] | null {
  if (out.kriterien.length !== raster.length) return null
  const scores: (number | undefined)[] = raster.map(() => undefined)
  for (const k of out.kriterien) {
    const i = k.nummer - 1
    if (i < 0 || i >= raster.length || scores[i] !== undefined || toHalves(k.punkte) > toHalves(raster[i].punkte)) return null
    scores[i] = toHalves(k.punkte)
  }
  return scores.every((v): v is number => v !== undefined) ? scores : null
}
