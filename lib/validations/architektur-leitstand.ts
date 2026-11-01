// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// lib/validations/architektur-leitstand.ts
// Zod-Schemas der API des Architektur-Leitstands (docs/architektur-leitstand.md, Abschnitt API).
// Aktionen und Modell prüft der Simulator-Kern (lib/archsim/schema.ts); hier nur die Hüllen der Anfragen.

import { z } from "zod"
import { aktionSchema, modellSchema } from "@/lib/archsim"

/**
 * Höchstzahl Aktionen je Lauf. Eine Mission dauert höchstens 90 Minuten; die Oberfläche fasst
 * aufeinanderfolgende «weiter» zusammen. Musterstrategien brauchen < 30 Aktionen, Minute für Minute
 * gespielt mit vielen Massnahmen selten mehr als 200. Grenze ≈ 3 × das.
 */
export const MAX_AKTIONEN_PRO_LAUF = 600

/** Höchstens so viele Aktionen je Anfrage */
export const MAX_AKTIONEN_PRO_ANFRAGE = 200

export const laufIdSchema = z.cuid({ message: "Ungültige Lauf-ID." })

export const missionIdSchema = z.string().regex(/^[a-z0-9][a-z0-9-]{0,59}$/, "Ungültige Mission.")

/** POST /api/archsim/runs */
export const laufStartenSchema = z
  .object({
    missionId: missionIdSchema,
    /** Abgeschlossener eigener Lauf, dessen Startwert (und Modell) übernommen wird */
    wiederholungVon: laufIdSchema.optional(),
  })
  .strict()

/** GET /api/archsim/runs?missionId= */
export const laeufeAbfrageSchema = z.object({
  missionId: missionIdSchema.optional(),
})

/** POST /api/archsim/runs/[id]/actions */
export const aktionenAnhaengenSchema = z
  .object({
    abIndex: z.number().int().min(0, "abIndex darf nicht negativ sein.").max(MAX_AKTIONEN_PRO_LAUF),
    aktionen: z
      .array(aktionSchema)
      .min(1, "Mindestens eine Aktion.")
      .max(MAX_AKTIONEN_PRO_ANFRAGE, `Höchstens ${MAX_AKTIONEN_PRO_ANFRAGE} Aktionen je Anfrage.`),
  })
  .strict()

/** POST /api/archsim/runs/[id]/model */
export const modellSetzenSchema = z.object({ modell: modellSchema }).strict()

/** POST /api/archsim/runs/[id]/finish */
export const abschlussSchema = z.object({}).strict()

export type AktionenAnhaengen = z.infer<typeof aktionenAnhaengenSchema>
