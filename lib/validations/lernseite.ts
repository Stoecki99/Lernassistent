// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// lib/validations/lernseite.ts
// Zod-Schemas fuer die Inhaltsdateien der Lernseiten (content/lernseiten/).
// Format-Beschreibung: docs/lernseiten-format.md

import { z } from "zod"

const text = z.string().min(1)
const hexColorRegex = /^#[0-9A-Fa-f]{6}$/

export const fachSchema = z.object({
  kuerzel: z.string().regex(/^[A-Za-z0-9]+$/, "Kürzel: nur Buchstaben und Ziffern."),
  titel: text,
  beschreibung: text,
  icon: z.string().min(1).max(10),
  farbe: z.string().regex(hexColorRegex, "Farbe als #RRGGBB."),
  semester: text,
  sektionen: z
    .array(z.object({ id: z.string().regex(/^[a-z0-9-]+$/), titel: text }))
    .min(1),
})

const begriffSchema = z.object({
  name: text,
  analogie: text,
  beispiel: text,
})

const sortierUebungSchema = z
  .object({
    frage: text,
    kategorien: z.array(text).min(2).max(4),
    elemente: z
      .array(
        z.object({
          text: text,
          kategorie: z.number().int().min(0),
          begruendung: text,
        }),
      )
      .min(3),
  })
  .refine((u) => u.elemente.every((e) => e.kategorie < u.kategorien.length), {
    message: "Übung: kategorie zeigt auf eine nicht vorhandene Kategorie.",
  })

const aufgabeSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  titel: text,
  aufgabe: text,
  woerterbuch: z.array(z.object({ symbol: text, bedeutung: text })).optional(),
  stepper: z
    .array(
      z.object({
        methode: z.number().int().min(0),
        formel: text,
        warum: text,
      }),
    )
    .min(1),
})

export const seiteSchema = z
  .object({
    titel: text,
    sektion: text,
    vorlesung: text,
    beispiele: z.array(text),
    weight: z.number().int(),
    dauer_min: z.number().int().positive(),
    lernziele: z.array(text).min(1),
    musterloesung: z.boolean(),
    einleitung: text.optional(),
    bausteine: z.object({
      begriffe: z.array(begriffSchema).min(3).max(5),
      uebung: sortierUebungSchema,
    }),
    schritte: z.object({
      muster: text,
      methode: z.array(text).min(1),
      aufgaben: z.array(aufgabeSchema).min(1),
    }),
    analyse: z
      .object({
        titel: text,
        text: text,
        brillen: z
          .array(z.object({ name: text, formel: text, erklaerung: text }))
          .min(2),
        fragen: z.array(z.object({ frage: text, antwort: text })),
      })
      .optional(),
    merke: z.array(text).min(4).max(6),
  })
  .refine(
    (s) =>
      s.schritte.aufgaben.every((a) =>
        a.stepper.every((st) => st.methode < s.schritte.methode.length),
      ),
    { message: "Stepper: methode zeigt auf einen nicht vorhandenen Methodenschritt." },
  )
  .refine(
    (s) => new Set(s.schritte.aufgaben.map((a) => a.id)).size === s.schritte.aufgaben.length,
    { message: "Aufgaben-IDs müssen innerhalb der Seite eindeutig sein." },
  )

const szeneSchema = z.object({
  phase: z.number().int().min(-1).optional(),
  text: z.union([z.literal("alle"), z.number().int().min(0), z.null()]).optional(),
  hl: z.array(z.string()).optional(),
  wb: z.number().int().min(0).optional(),
  wbAktiv: z.array(z.number().int().min(0)).optional(),
  formel: z.string().optional(),
  sage: text,
})

export const filmSchema = z.object({
  phasen: z.array(text).min(1),
  texte: z.array(text),
  woerterbuch: z.array(text),
  szenen: z.array(szeneSchema).min(15).max(35),
})

export const quizSchema = z
  .array(
    z
      .object({
        id: z.string().regex(/^[a-z0-9]+-\d{2}-[a-z0-9-]+$/, "Quiz-ID: <fach>-<NN>-<nr>."),
        frage: text,
        optionen: z.array(text).min(2).max(6),
        richtig: z.number().int().min(0),
        erklaerung: text,
        tags: z.array(z.string()),
        niveau: z.number().int().min(1).max(3),
      })
      .refine((f) => f.richtig < f.optionen.length, {
        message: "Quiz: richtig zeigt auf eine nicht vorhandene Option.",
      }),
  )
  .min(6)
  .max(10)

export const spickSchema = z.array(
  z.object({
    begriff: text,
    kurz: text,
    formel: text.optional(),
    quelle: text,
  }),
)

export type Fach = z.infer<typeof fachSchema>
export type Seite = z.infer<typeof seiteSchema>
export type Film = z.infer<typeof filmSchema>
export type FilmSzeneRoh = z.infer<typeof szeneSchema>
export type QuizFrage = z.infer<typeof quizSchema>[number]
export type SpickEintrag = z.infer<typeof spickSchema>[number]
