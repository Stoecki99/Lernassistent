// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// lib/validations/lernseite.ts
// Zod-Schema fuer fach.json (Fach, Sektionen, Lernpfad).
// Format-Beschreibung: docs/lernpfad-format.md

import { z } from "zod"

/** Fachordner und Fach in der Adresse: nur a-z und 0-9. */
export const FACH_SLUG = /^[a-z0-9]+$/

/** Station im Pfad: «NN-name», Teile aus a-z und 0-9, je durch einen Bindestrich getrennt. */
export const THEMA_SLUG = /^\d{2}-[a-z0-9]+(?:-[a-z0-9]+)*$/

const text = z.string().trim().min(1)
const hexColorRegex = /^#[0-9A-Fa-f]{6}$/

const sektionSchema = z.strictObject({
  id: z.string().regex(/^[a-z0-9-]+$/, "Sektions-ID: nur a-z, 0-9 und Bindestrich."),
  titel: text,
})

export const stationSchema = z.strictObject({
  slug: z.string().regex(THEMA_SLUG, "Slug: «NN-name» (z. B. «08-kombinatorik»)."),
  titel: text,
  sektion: text,
  vorlesung: text,
  dauer_min: z.number().int().positive().max(600),
  kurz: text,
})

export const fachSchema = z
  .strictObject({
    kuerzel: z.string().regex(/^[A-Za-z0-9]+$/, "Kürzel: nur Buchstaben und Ziffern."),
    titel: text,
    beschreibung: text,
    icon: z.string().min(1).max(10),
    farbe: z.string().regex(hexColorRegex, "Farbe als #RRGGBB."),
    semester: text,
    sektionen: z.array(sektionSchema).min(1),
    pfad: z.array(stationSchema).min(1),
  })
  .superRefine((fach, ctx) => {
    const sektionen = new Set<string>()
    fach.sektionen.forEach((sektion, i) => {
      if (sektionen.has(sektion.id)) {
        ctx.addIssue({
          code: "custom",
          path: ["sektionen", i, "id"],
          message: `Sektion «${sektion.id}» ist doppelt.`,
        })
      }
      sektionen.add(sektion.id)
    })

    const slugs = new Set<string>()
    fach.pfad.forEach((station, i) => {
      if (slugs.has(station.slug)) {
        ctx.addIssue({
          code: "custom",
          path: ["pfad", i, "slug"],
          message: `Slug «${station.slug}» ist doppelt.`,
        })
      }
      slugs.add(station.slug)
      if (!sektionen.has(station.sektion)) {
        ctx.addIssue({
          code: "custom",
          path: ["pfad", i, "sektion"],
          message: `Sektion «${station.sektion}» gibt es in «sektionen» nicht.`,
        })
      }
    })
  })

export type Fach = z.infer<typeof fachSchema>
export type Station = z.infer<typeof stationSchema>
export type Sektion = z.infer<typeof sektionSchema>
