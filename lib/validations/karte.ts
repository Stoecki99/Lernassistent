// lib/validations/karte.ts
// Zod-Schemas fuer Karten-Erstellung und -Aktualisierung.

import { z } from "zod"

const hintField = z
  .string()
  .max(500, "Der Hinweis darf maximal 500 Zeichen lang sein.")
  .optional()
  .or(z.literal(""))

export const createCardSchema = z.object({
  front: z
    .string()
    .min(1, "Die Vorderseite darf nicht leer sein.")
    .max(2000, "Die Vorderseite darf maximal 2000 Zeichen lang sein."),
  back: z
    .string()
    .min(1, "Die Rückseite darf nicht leer sein.")
    .max(2000, "Die Rückseite darf maximal 2000 Zeichen lang sein."),
  hint: hintField,
  deckId: z
    .string()
    .cuid("Ungültige Deck-ID."),
})

export const updateCardSchema = z.object({
  front: z
    .string()
    .min(1, "Die Vorderseite darf nicht leer sein.")
    .max(2000, "Die Vorderseite darf maximal 2000 Zeichen lang sein.")
    .optional(),
  back: z
    .string()
    .min(1, "Die Rückseite darf nicht leer sein.")
    .max(2000, "Die Rückseite darf maximal 2000 Zeichen lang sein.")
    .optional(),
  hint: hintField,
})

export type CreateCardInput = z.infer<typeof createCardSchema>
export type UpdateCardInput = z.infer<typeof updateCardSchema>
