// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// lib/lernseiten.ts
// Liest die Inhaltsdateien der Lernseiten (nur serverseitig).
// Die Gesamtpruefung fuer Skript und Tests liegt in lib/lernseiten-pruefung.ts.
// Ordnerstruktur und Format: docs/lernseiten-format.md

import fs from "node:fs"
import path from "node:path"
import type { z } from "zod"
import {
  fachSchema,
  seiteSchema,
  filmSchema,
  quizSchema,
  spickSchema,
  type Fach,
  type Seite,
  type Film,
  type QuizFrage,
  type SpickEintrag,
} from "@/lib/validations/lernseite"

export const STANDARD_BASIS = path.join(process.cwd(), "content", "lernseiten")
export const FACH_ORDNER = /^[a-z0-9]+$/
export const THEMA_ORDNER = /^\d{2}-[a-z0-9-]+$/

export type FachKurz = Fach & { slug: string; anzahlThemen: number }

export interface ThemaKurz {
  slug: string
  titel: string
  sektion: string
  vorlesung: string
  dauer_min: number
  weight: number
  lernziele: string[]
}

export interface ThemaVoll {
  fach: Fach & { slug: string }
  slug: string
  seite: Seite
  film: Film
  quiz: QuizFrage[]
  spick: SpickEintrag[]
}

export type SpickzettelEintrag = SpickEintrag & { thema: string; themaSlug: string }

// ---------------------------------------------------------------------------
// Hilfsfunktionen
// ---------------------------------------------------------------------------

export function unterordner(pfad: string): string[] {
  if (!fs.existsSync(pfad)) return []
  return fs
    .readdirSync(pfad, { withFileTypes: true })
    .filter((eintrag) => eintrag.isDirectory())
    .map((eintrag) => eintrag.name)
    .sort()
}

function themenOrdner(fachPfad: string): string[] {
  return unterordner(fachPfad).filter((name) => THEMA_ORDNER.test(name))
}

/** Liest eine JSON-Datei und prueft sie gegen ein Schema. Wirft mit verstaendlicher Meldung. */
export function lese<S extends z.ZodType>(datei: string, schema: S, basis: string): z.infer<S> {
  const name = path.relative(basis, datei).replace(/\\/g, "/")
  if (!fs.existsSync(datei)) {
    throw new Error(`${name}: Datei fehlt.`)
  }
  let roh: unknown
  try {
    roh = JSON.parse(fs.readFileSync(datei, "utf8"))
  } catch (error) {
    throw new Error(`${name}: ungültiges JSON (${(error as Error).message}).`)
  }
  const ergebnis = schema.safeParse(roh)
  if (!ergebnis.success) {
    const details = ergebnis.error.issues
      .map((issue) => `${issue.path.join(".") || "(Wurzel)"}: ${issue.message}`)
      .join("; ")
    throw new Error(`${name}: ${details}`)
  }
  return ergebnis.data
}

/** Normalisiert ein Fach aus der URL und gibt den Ordnerpfad zurueck, sonst null. */
function fachPfad(fach: string, basis: string): string | null {
  const slug = fach.toLowerCase()
  if (!FACH_ORDNER.test(slug)) return null
  const pfad = path.join(basis, slug)
  return fs.existsSync(path.join(pfad, "fach.json")) ? pfad : null
}

// ---------------------------------------------------------------------------
// Laden
// ---------------------------------------------------------------------------

/** Alle Faecher mit Anzahl Themen, sortiert nach Kuerzel. */
export function ladeFaecher(basis = STANDARD_BASIS): FachKurz[] {
  return unterordner(basis)
    .filter((slug) => FACH_ORDNER.test(slug) && fs.existsSync(path.join(basis, slug, "fach.json")))
    .map((slug) => {
      const pfad = path.join(basis, slug)
      const fach = lese(path.join(pfad, "fach.json"), fachSchema, basis)
      return { ...fach, slug, anzahlThemen: themenOrdner(pfad).length }
    })
    .sort((a, b) => a.kuerzel.localeCompare(b.kuerzel))
}

/** Ein Fach mit seinen Themen (sortiert nach weight) oder null, wenn es das Fach nicht gibt. */
export function ladeFach(
  fach: string,
  basis = STANDARD_BASIS,
): { fach: FachKurz; themen: ThemaKurz[] } | null {
  const pfad = fachPfad(fach, basis)
  if (!pfad) return null

  const slug = path.basename(pfad)
  const daten = lese(path.join(pfad, "fach.json"), fachSchema, basis)
  const themen = themenOrdner(pfad)
    .map((themaSlug): ThemaKurz => {
      const seite = lese(path.join(pfad, themaSlug, "seite.json"), seiteSchema, basis)
      return {
        slug: themaSlug,
        titel: seite.titel,
        sektion: seite.sektion,
        vorlesung: seite.vorlesung,
        dauer_min: seite.dauer_min,
        weight: seite.weight,
        lernziele: seite.lernziele,
      }
    })
    .sort((a, b) => a.weight - b.weight)

  return { fach: { ...daten, slug, anzahlThemen: themen.length }, themen }
}

/** Ein Thema mit allen Dateien oder null, wenn es das Fach oder Thema nicht gibt. */
export function ladeThema(fach: string, thema: string, basis = STANDARD_BASIS): ThemaVoll | null {
  const pfad = fachPfad(fach, basis)
  if (!pfad || !THEMA_ORDNER.test(thema)) return null

  const themaPfad = path.join(pfad, thema)
  if (!fs.existsSync(path.join(themaPfad, "seite.json"))) return null

  return {
    fach: { ...lese(path.join(pfad, "fach.json"), fachSchema, basis), slug: path.basename(pfad) },
    slug: thema,
    seite: lese(path.join(themaPfad, "seite.json"), seiteSchema, basis),
    film: lese(path.join(themaPfad, "film.json"), filmSchema, basis),
    quiz: lese(path.join(themaPfad, "quiz.json"), quizSchema, basis),
    spick: lese(path.join(themaPfad, "spick.json"), spickSchema, basis),
  }
}

/** Spickzettel-Eintraege aller Themen eines Fachs, in Themen-Reihenfolge. */
export function ladeSpickzettel(fach: string, basis = STANDARD_BASIS): SpickzettelEintrag[] {
  const ergebnis = ladeFach(fach, basis)
  if (!ergebnis) return []
  const pfad = path.join(basis, ergebnis.fach.slug)
  return ergebnis.themen.flatMap((thema) =>
    lese(path.join(pfad, thema.slug, "spick.json"), spickSchema, basis).map((eintrag) => ({
      ...eintrag,
      thema: thema.titel,
      themaSlug: thema.slug,
    })),
  )
}
