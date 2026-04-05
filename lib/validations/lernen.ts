// lib/validations/lernen.ts
// Zod-Schemas fuer Lernmodus API-Routen.

import { z } from "zod"

export const deckIdQuerySchema = z
  .string()
  .cuid("Ungültige Deck-ID.")

export const bewertungSchema = z.object({
  cardId: z
    .string()
    .cuid("Ungültige Karten-ID."),
  rating: z
    .number()
    .int()
    .min(1, "Bewertung muss zwischen 1 und 4 liegen.")
    .max(4, "Bewertung muss zwischen 1 und 4 liegen."),
  duration: z
    .number()
    .int()
    .min(0, "Dauer darf nicht negativ sein.")
    .max(3600, "Dauer darf maximal 3600 Sekunden betragen.")
    .default(0),
})

export type BewertungInput = z.infer<typeof bewertungSchema>
