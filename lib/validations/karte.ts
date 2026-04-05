// lib/validations/karte.ts
// Zod-Schemas fuer Karten-Erstellung und -Aktualisierung.

import { z } from "zod"

export const createCardSchema = z.object({
  front: z
    .string()
    .min(1, "Die Vorderseite darf nicht leer sein.")
    .max(2000, "Die Vorderseite darf maximal 1000 Zeichen lang sein."),
  back: z
    .string()
    .min(1, "Die Rueckseite darf nicht leer sein.")
    .max(2000, "Die Rueckseite darf maximal 1000 Zeichen lang sein."),
  deckId: z
    .string()
    .cuid("Ungueltige Deck-ID."),
})

export const updateCardSchema = z.object({
  front: z
    .string()
    .min(1, "Die Vorderseite darf nicht leer sein.")
    .max(2000, "Die Vorderseite darf maximal 1000 Zeichen lang sein.")
    .optional(),
  back: z
    .string()
    .min(1, "Die Rueckseite darf nicht leer sein.")
    .max(2000, "Die Rueckseite darf maximal 1000 Zeichen lang sein.")
    .optional(),
})

export type CreateCardInput = z.infer<typeof createCardSchema>
export type UpdateCardInput = z.infer<typeof updateCardSchema>
