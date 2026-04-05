// lib/validations/import.ts
// Zod-Schema fuer den Karten-Import (CSV / Anki).

import { z } from "zod"

export const importSchema = z.object({
  deckId: z
    .string()
    .cuid("Ungültige Deck-ID."),
  format: z.enum(["csv", "anki"], {
    error: "Bitte wähle ein gültiges Format (CSV oder Anki).",
  }),
})

export type ImportInput = z.infer<typeof importSchema>
