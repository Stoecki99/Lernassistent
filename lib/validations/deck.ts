// lib/validations/deck.ts
// Zod-Schemas fuer Deck-Erstellung und -Aktualisierung.

import { z } from "zod"

const DECK_COLORS = [
  "#58CC02",
  "#1CB0F6",
  "#FF9600",
  "#FF4B4B",
  "#A560E8",
  "#2B70C9",
  "#FF86D0",
  "#FFD900",
] as const

const hexColorRegex = /^#[0-9A-Fa-f]{6}$/

export const createDeckSchema = z.object({
  name: z
    .string()
    .min(1, "Der Deck-Name darf nicht leer sein.")
    .max(100, "Der Deck-Name darf maximal 100 Zeichen lang sein."),
  description: z
    .string()
    .max(500, "Die Beschreibung darf maximal 500 Zeichen lang sein.")
    .optional()
    .or(z.literal("")),
  color: z
    .string()
    .regex(hexColorRegex, "Bitte waehle eine gueltige Farbe.")
    .default("#58CC02"),
  icon: z
    .string()
    .min(1, "Bitte waehle ein Icon.")
    .max(10, "Das Icon ist zu lang.")
    .default("📚"),
})

export const updateDeckSchema = z.object({
  name: z
    .string()
    .min(1, "Der Deck-Name darf nicht leer sein.")
    .max(100, "Der Deck-Name darf maximal 100 Zeichen lang sein.")
    .optional(),
  description: z
    .string()
    .max(500, "Die Beschreibung darf maximal 500 Zeichen lang sein.")
    .optional()
    .or(z.literal("")),
  color: z
    .string()
    .regex(hexColorRegex, "Bitte waehle eine gueltige Farbe.")
    .optional(),
  icon: z
    .string()
    .min(1, "Bitte waehle ein Icon.")
    .max(10, "Das Icon ist zu lang.")
    .optional(),
})

export const AVAILABLE_COLORS = DECK_COLORS

export type CreateDeckInput = z.infer<typeof createDeckSchema>
export type UpdateDeckInput = z.infer<typeof updateDeckSchema>
