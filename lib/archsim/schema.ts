// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// lib/archsim/schema.ts
// Zod-Schemas: Modell (Vertrag Abschnitt 4), Mission, Aktion, Aktionsprotokoll (für die API).
// Client- und servertauglich (nur zod).

import { z } from "zod"
import { AKTION_TYPEN, ELEMENT_TYPEN, ELEMENT_ZUSTAENDE, VERBINDUNGS_ARTEN, type Aktion, type ArchModell, type Mission } from "./types"

const id = z.string().regex(/^[a-z0-9][a-z0-9-]{0,59}$/, "Ungültige ID (a-z, 0-9, Bindestrich).")
const text = (max: number) => z.string().min(1).max(max)
const zahl = z.number().finite()
const nichtNegativ = zahl.min(0)
const anteil = zahl.min(0).max(1)
const stationSlug = z.string().regex(/^\d{2}-[a-z0-9-]+$/, "Ungültiger Stations-Slug.")

export const simWerteSchema = z
  .object({
    kapazitaet: nichtNegativ.optional(),
    latenz: nichtNegativ.optional(),
    instanzen: z.number().int().min(0).max(100).optional(),
    fehlerquote: anteil.optional(),
    kostenProInstanz: nichtNegativ.optional(),
    puffer: nichtNegativ.optional(),
    parallel: nichtNegativ.optional(),
    trefferquote: anteil.optional(),
    maxInstanzen: z.number().int().min(1).max(200).optional(),
  })
  .strict()

const steckbriefSchema = z
  .object({ was: text(2000).optional(), kann: text(2000).optional(), wofuer: text(2000).optional(), technologie: text(2000).optional(), warum: text(2000).optional() })
  .strict()

export const elementSchema = z
  .object({
    id,
    typ: z.enum(ELEMENT_TYPEN),
    name: text(80),
    technologie: text(80).optional(),
    x: zahl.min(0).max(100).optional(),
    y: zahl.min(0).max(100).optional(),
    in: id.optional(),
    stereotyp: text(60).optional(),
    info: steckbriefSchema.optional(),
    zustand: z.enum(ELEMENT_ZUSTAENDE).optional(),
    sim: simWerteSchema.optional(),
  })
  .strict()

export const verbindungSchema = z
  .object({
    id,
    von: id,
    nach: id,
    art: z.enum(VERBINDUNGS_ARTEN),
    label: text(80).optional(),
    info: text(2000).optional(),
    sim: z
      .object({
        timeoutMs: z.number().int().min(50).max(60000).optional(),
        retries: z.number().int().min(0).max(5).optional(),
        circuitBreaker: z.boolean().optional(),
        bulkhead: z.boolean().optional(),
        fallback: z.boolean().optional(),
      })
      .strict()
      .optional(),
  })
  .strict()

const ablaufSchema = z
  .object({
    id,
    name: text(120),
    schritte: z
      .array(
        z
          .object({
            von: id.optional(),
            nach: id.optional(),
            art: z.enum(VERBINDUNGS_ARTEN).optional(),
            text: text(1000),
            parallel: z.boolean().optional(),
            bei: id.optional(),
            fehler: z.boolean().optional(),
          })
          .strict(),
      )
      .max(60),
  })
  .strict()

export const modellSchema: z.ZodType<ArchModell> = z
  .object({
    titel: text(120).optional(),
    ansicht: z.enum(["komponenten", "verteilung", "kontext"]).optional(),
    richtung: z.enum(["rechts", "unten"]).optional(),
    elemente: z.array(elementSchema).max(60),
    verbindungen: z.array(verbindungSchema).max(150),
    ablaeufe: z.array(ablaufSchema).max(20).optional(),
  })
  .strict()

const minuten = z.number().int().min(1).max(600)

export const aktionSchema: z.ZodType<Aktion> = z.discriminatedUnion("typ", [
  z.object({ typ: z.literal("weiter"), minuten }).strict(),
  z.object({ typ: z.literal("skalieren"), element: id, instanzen: z.number().int().min(1).max(200) }).strict(),
  z.object({ typ: z.literal("autoscaling"), element: id, an: z.boolean(), min: z.number().int().min(1).max(200).optional(), max: z.number().int().min(1).max(200).optional() }).strict(),
  z.object({ typ: z.literal("cache"), element: id }).strict(),
  z.object({ typ: z.literal("cdn"), element: id }).strict(),
  z.object({ typ: z.literal("queue"), verbindung: id }).strict(),
  z.object({ typ: z.literal("circuitBreaker"), verbindung: id, an: z.boolean() }).strict(),
  z.object({ typ: z.literal("timeout"), verbindung: id, ms: z.number().int().min(50).max(60000) }).strict(),
  z.object({ typ: z.literal("retry"), verbindung: id, versuche: z.number().int().min(0).max(5) }).strict(),
  z.object({ typ: z.literal("readReplica"), element: id, anzahl: z.number().int().min(0).max(5) }).strict(),
  z.object({ typ: z.literal("rateLimit"), element: id, proSekunde: z.number().int().min(0).max(1000000) }).strict(),
  z.object({ typ: z.literal("bulkhead"), verbindung: id, an: z.boolean() }).strict(),
  z.object({ typ: z.literal("rollback"), element: id }).strict(),
])

/** Eingabe für das Nachrechnen auf dem Server: Mission, Seed, Aktionen, bei «modellieren» das Modell */
export const protokollSchema = z
  .object({
    missionId: id,
    seed: z.number().int().min(0).max(2 ** 31 - 1),
    aktionen: z.array(aktionSchema).max(2000),
    modell: modellSchema.optional(),
  })
  .strict()

const ereignisSchema = z
  .object({
    id,
    tick: z.number().int().min(0),
    dauer: z.number().int().min(1),
    titel: text(120),
    text: text(1000),
    wirkung: z.discriminatedUnion("art", [
      z.object({ art: z.literal("lastspitze"), faktor: zahl.min(0).max(50) }).strict(),
      z.object({ art: z.literal("ausfall"), element: id }).strict(),
      z.object({ art: z.literal("langsam"), element: id, faktor: zahl.min(1).max(100) }).strict(),
      z.object({ art: z.literal("deployment"), element: id, fehlerquote: anteil }).strict(),
    ]),
  })
  .strict()

const hinweisSchema = z
  .object({
    id,
    wenn: z.union([
      z.object({ tick: z.number().int().min(0) }).strict(),
      z.object({ ereignis: id }).strict(),
      z.object({ auslastung: id, ueber: nichtNegativ }).strict(),
      z.object({ fehlerquoteUeber: anteil }).strict(),
      z.object({ p95Ueber: nichtNegativ }).strict(),
    ]),
    text: text(600),
  })
  .strict()

const anforderungBasis = { id, text: text(300), warum: text(600), station: stationSlug.optional() }

const anforderungSchema = z.discriminatedUnion("art", [
  z.object({ ...anforderungBasis, art: z.literal("element"), element: id }).strict(),
  z.object({ ...anforderungBasis, art: z.literal("pfad"), von: id, nach: id }).strict(),
  z.object({ ...anforderungBasis, art: z.literal("entkoppelt"), von: id, nach: id }).strict(),
  z.object({ ...anforderungBasis, art: z.literal("cache"), element: id }).strict(),
  z.object({ ...anforderungBasis, art: z.literal("vorgeschaltet"), einstieg: id, bis: id, typ: z.enum(ELEMENT_TYPEN) }).strict(),
  z.object({ ...anforderungBasis, art: z.literal("keineVerbindung"), von: id, nach: id }).strict(),
  z.object({ ...anforderungBasis, art: z.literal("eigeneDaten"), elemente: z.array(id).min(1) }).strict(),
])

export const missionSchema: z.ZodType<Mission> = z
  .object({
    id,
    version: z.number().int().min(1),
    titel: text(80),
    untertitel: text(120),
    schwierigkeit: z.number().int().min(1).max(3),
    art: z.enum(["vorgegeben", "modellieren"]),
    gefuehrt: z.boolean(),
    firma: text(80),
    briefing: text(4000),
    auftrag: text(6000).optional(),
    lernziele: z.array(z.object({ text: text(300), station: stationSlug, abschnitt: id.optional() }).strict()).min(1).max(8),
    modell: modellSchema,
    palette: z
      .array(
        z
          .object({ id, typ: z.enum(ELEMENT_TYPEN), name: text(80), technologie: text(80).optional(), ablenker: z.boolean().optional(), sim: simWerteSchema.optional(), info: steckbriefSchema.optional() })
          .strict(),
      )
      .max(40)
      .optional(),
    anforderungen: z.array(anforderungSchema).max(20).optional(),
    musterloesung: modellSchema.optional(),
    anfragen: z
      .array(
        z
          .object({
            id,
            name: text(80),
            anteil,
            einstieg: id,
            ziele: z.array(id).min(1).max(10),
            schreibend: z.boolean().optional(),
            kritisch: z.boolean().optional(),
            statischAnteil: anteil.optional(),
          })
          .strict(),
      )
      .min(1)
      .max(10),
    last: z
      .object({
        punkte: z.array(z.object({ t: z.number().int().min(0), rps: nichtNegativ }).strict()).min(1).max(100),
        rauschen: zahl.min(0).max(0.5),
      })
      .strict(),
    dauer: z.number().int().min(10).max(600),
    ereignisse: z.array(ereignisSchema).max(30),
    erlaubteAktionen: z.array(z.enum(AKTION_TYPEN)).max(AKTION_TYPEN.length),
    aktionsZiele: z.partialRecord(z.enum(AKTION_TYPEN), z.array(id).min(1)).optional(),
    budget: zahl.min(1),
    slo: z.object({ p95Ms: zahl.min(1), verfuegbarkeit: zahl.min(0.5).max(1) }).strict(),
    clientTimeoutMs: z.number().int().min(100).max(120000).optional(),
    hinweise: z.array(hinweisSchema).max(30).optional(),
    musterstrategie: text(2000),
  })
  .strict()
  .superRefine((m, ctx) => {
    const summe = m.anfragen.reduce((s, k) => s + k.anteil, 0)
    if (Math.abs(summe - 1) > 1e-6) ctx.addIssue({ code: "custom", message: `Anteile der Anfrageklassen ergeben ${summe}, nicht 1.` })
    for (let i = 1; i < m.last.punkte.length; i++) {
      if (m.last.punkte[i].t < m.last.punkte[i - 1].t) ctx.addIssue({ code: "custom", message: "Lastpunkte müssen nach Minute sortiert sein." })
    }
    if (m.art === "modellieren" && (!m.palette || !m.musterloesung || !m.auftrag)) {
      ctx.addIssue({ code: "custom", message: "Missionen zum Modellieren brauchen Auftrag, Palette und Musterlösung." })
    }
  }) as unknown as z.ZodType<Mission>

export function parseMission(roh: unknown): Mission {
  return missionSchema.parse(roh)
}

export function parseAktionen(roh: unknown): Aktion[] {
  return z.array(aktionSchema).max(2000).parse(roh)
}
