// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// lib/validations/ipma-pool.ts
// Zod-Schema des Fragenpools content/ipma/fragen/*.json (Spezifikation 2.2, 2.3).
// Feldnamen deutsch wie im Inhaltsformat (Ausnahme in CLAUDE.md), Code-Namen englisch.

import { z } from "zod"
import { COMPETENCE_IDS, COMPETENCES, RASTER_TOTAL } from "../ipma/competences"
import fach from "../../content/lernseiten/pmgt/fach.json"

// Abweichung zu 2.3: Die Stationen stehen in fach.json unter «pfad», nicht unter «stationen».
const STATION_SLUGS: ReadonlySet<string> = new Set(fach.pfad.map((s: { slug: string }) => s.slug))
const text = (min: number, max: number) => z.string().trim().min(min).max(max)
const competenceId = z.enum(COMPETENCE_IDS)
const kciId = z.string().regex(/^[123]\.\d{2}\.\d{2}$/)

/** Formulierungen, die in MC-Optionen verboten sind (Qualitätsregel 2.5) */
export const FORBIDDEN_OPTION_PATTERNS: readonly RegExp[] = [
  /\balle (oben )?(genannten|obigen)\b/i,
  /\bkeine der (oben )?(genannten|obigen)\b/i,
  /\b(antworten|optionen) [a-d] und [a-d]\b/i,
  /\bbeide (oben )?genannten\b/i,
]

/** Prüft einen Stations-Slug gegen content/lernseiten/pmgt/fach.json (2.2) */
export function isKnownStation(slug: string): boolean {
  return STATION_SLUGS.has(slug)
}

const fundstelleSchema = z.object({
  lb: text(3, 80).optional(),
  icb: z.object({
    seite: z.number().int().min(31).max(156),
    indikatoren: z.array(kciId).min(1).max(4),
  }).strict(),
  station: z.string().refine((s) => STATION_SLUGS.has(s), "Unbekannte Station.").optional(),
  buch: text(3, 40).optional(),
  hinweis: text(3, 200).optional(),
}).strict()

const base = {
  id: z.string().regex(/^[123]\.\d{2}-(mc|of)-\d{2}$/),
  kompetenz: competenceId,
  schwierigkeit: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  frage: text(15, 900),
  fundstelle: fundstelleSchema,
  gruppe: z.string().regex(/^[a-z0-9-]{3,40}$/).optional(),
  status: z.enum(["entwurf", "geprueft", "zurueckgezogen"]),
  version: z.number().int().min(1),
}

const mcSchema = z.object({
  ...base,
  typ: z.literal("mc"),
  optionen: z.array(text(1, 300)).length(4),
  richtig: z.number().int().min(0).max(3),
  optionenFest: z.boolean().optional(),
  erklaerung: text(40, 1000),
  optionHinweise: z.array(z.string().trim().max(300)).length(4).optional(),
}).strict()

const rasterSchema = z.array(
  z.object({ kriterium: text(10, 300), punkte: z.number().int().min(1).max(RASTER_TOTAL) }).strict(),
).min(2).max(4)

const offenSchema = z.object({
  ...base,
  typ: z.literal("offen"),
  musterloesung: text(80, 2500),
  bewertungsraster: rasterSchema,
  erklaerung: text(0, 1000).optional(),
  umfang: text(3, 60).optional(),
}).strict()

export const questionSchema = z.discriminatedUnion("typ", [mcSchema, offenSchema])
export type PoolQuestion = z.output<typeof questionSchema>
export type McQuestion = z.output<typeof mcSchema>
export type OpenQuestion = z.output<typeof offenSchema>
export type QuestionStatus = PoolQuestion["status"]

const KCI_COUNT: ReadonlyMap<string, number> = new Map(COMPETENCES.map((c) => [c.id, c.kciCount]))

/** Normalisiert eine Option für den Doppel-Vergleich (2.3) */
function normalizeOption(o: string): string {
  return o.toLowerCase().replace(/\s+/g, " ")
}

// Abweichung zu 2.3: fragen.min(0) statt min(1), damit alle 28 Dateien schon vor AP2 existieren können
// (leere Liste). Den Mindestumfang erzwingt validatePool je nach POOL_STAGE.
export const competenceFileSchema = z.object({
  kompetenz: competenceId,
  herkunft: z.literal("eigen"),
  fragen: z.array(questionSchema).max(40),
}).strict().superRefine((file, ctx) => {
  const kciCount = KCI_COUNT.get(file.kompetenz) ?? 0
  for (const [i, q] of file.fragen.entries()) {
    const path = ["fragen", i]
    if (q.kompetenz !== file.kompetenz || !q.id.startsWith(`${file.kompetenz}-`))
      ctx.addIssue({ code: "custom", path, message: `${q.id}: Kompetenz passt nicht zur Datei.` })
    if ((q.typ === "mc") !== q.id.includes("-mc-"))
      ctx.addIssue({ code: "custom", path, message: `${q.id}: ID-Kürzel passt nicht zum Typ.` })
    for (const k of q.fundstelle.icb.indikatoren) {
      const nr = Number(k.slice(5))
      if (!k.startsWith(`${file.kompetenz}.`) || nr < 1 || nr > kciCount)
        ctx.addIssue({ code: "custom", path, message: `${q.id}: Indikator ${k} gehört nicht zu ${file.kompetenz}.` })
    }
    if (q.typ === "mc") {
      const norm = q.optionen.map(normalizeOption)
      if (new Set(norm).size !== 4) ctx.addIssue({ code: "custom", path, message: `${q.id}: Optionen doppelt.` })
      if (q.optionen.some((o) => FORBIDDEN_OPTION_PATTERNS.some((p) => p.test(o))))
        ctx.addIssue({ code: "custom", path, message: `${q.id}: verbotene Sammeloption.` })
      if (q.optionHinweise && q.optionHinweise[q.richtig] !== "")
        ctx.addIssue({ code: "custom", path, message: `${q.id}: Hinweis der richtigen Option muss leer sein.` })
    } else {
      const sum = q.bewertungsraster.reduce((s, r) => s + r.punkte, 0)
      if (sum !== RASTER_TOTAL)
        ctx.addIssue({ code: "custom", path, message: `${q.id}: Raster ergibt ${sum} statt ${RASTER_TOTAL} Punkte.` })
    }
  }
})

export type CompetenceFile = z.output<typeof competenceFileSchema>
