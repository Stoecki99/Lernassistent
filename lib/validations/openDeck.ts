// lib/validations/openDeck.ts
// Zod-Schemas fuer OpenDeck-Freigabe, Admin-Review und Deck-Kopie.

import { z } from "zod"

export const shareStatusValues = ["none", "pending", "approved", "rejected"] as const
export type ShareStatus = (typeof shareStatusValues)[number]

export const requestShareSchema = z.object({
  deckId: z.string().cuid("Ungueltige Deck-ID."),
})

export const reviewShareSchema = z.object({
  deckId: z.string().cuid("Ungueltige Deck-ID."),
  action: z.enum(["approve", "reject"]),
  rejectionReason: z.string().max(500).optional(),
})

export const copyDeckSchema = z.object({
  deckId: z.string().cuid("Ungueltige Deck-ID."),
})

export const MIN_CARDS_FOR_SHARE = 20
