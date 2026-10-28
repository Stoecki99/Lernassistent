// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// lib/lernseiten.ts
// Liest und prueft die Inhaltsdateien der Lernseiten (nur serverseitig).
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
import { szenenAufloesen } from "@/lib/lernseiten-film"

const STANDARD_BASIS = path.join(process.cwd(), "content", "lernseiten")
const FACH_ORDNER = /^[a-z0-9]+$/
const THEMA_ORDNER = /^\d{2}-[a-z0-9-]+$/

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

function unterordner(pfad: string): string[] {
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
function lese<S extends z.ZodType>(datei: string, schema: S, basis: string): z.infer<S> {
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

/** Namen der Seiten auf oberster Ebene der App (inkl. Routen-Gruppen wie (dashboard)). */
export function appSeiten(appPfad = path.join(process.cwd(), "app")): string[] {
  const namen: string[] = []
  for (const name of unterordner(appPfad)) {
    if (name.startsWith("(") && name.endsWith(")")) {
      namen.push(...unterordner(path.join(appPfad, name)))
    } else {
      namen.push(name)
    }
  }
  return namen
    .filter((name) => !name.startsWith("[") && !name.startsWith("_"))
    .map((name) => name.toLowerCase())
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

// ---------------------------------------------------------------------------
// Gesamtpruefung (Pruefskript und Tests)
// ---------------------------------------------------------------------------

function pruefeFilm(film: Film, name: string): string[] {
  const fehler: string[] = []
  const phIds = new Set(
    film.texte.flatMap((t) => [...t.matchAll(/data-ph="([^"]+)"/g)].map((m) => m[1])),
  )

  szenenAufloesen(film.szenen).forEach((szene, i) => {
    const nr = `${name}: Szene ${i + 1}`
    if (szene.phase >= film.phasen.length) {
      fehler.push(`${nr}: phase ${szene.phase} gibt es nicht.`)
    }
    if (typeof szene.text === "number" && szene.text >= film.texte.length) {
      fehler.push(`${nr}: texte[${szene.text}] gibt es nicht.`)
    }
    for (const id of szene.hl) {
      if (!phIds.has(id)) fehler.push(`${nr}: data-ph «${id}» kommt in texte nicht vor.`)
    }
    if (szene.wb > film.woerterbuch.length) {
      fehler.push(`${nr}: wb ${szene.wb} ist grösser als das Wörterbuch.`)
    }
    for (const index of szene.wbAktiv) {
      if (index >= szene.wb) {
        fehler.push(`${nr}: wbAktiv ${index} ist nicht sichtbar (wb ${szene.wb}).`)
      }
    }
  })
  return fehler
}

/**
 * Prueft alle Inhalte und gibt eine Liste von Fehlermeldungen zurueck (leer = alles gut).
 * `reserviert`: Namen von App-Seiten, die nicht als Fachordner verwendet werden duerfen.
 */
export function pruefeAlleInhalte(basis = STANDARD_BASIS, reserviert: string[] = appSeiten()): string[] {
  const fehler: string[] = []
  const quizIds = new Map<string, string>()

  const versuche = <T>(fn: () => T): T | null => {
    try {
      return fn()
    } catch (error) {
      fehler.push((error as Error).message)
      return null
    }
  }

  for (const ordner of unterordner(basis)) {
    if (!FACH_ORDNER.test(ordner)) {
      fehler.push(`${ordner}: Fachordner nur mit a-z und 0-9.`)
      continue
    }
    if (reserviert.includes(ordner)) {
      fehler.push(`${ordner}: Fachordner heisst wie eine App-Seite (/${ordner}).`)
    }

    const pfad = path.join(basis, ordner)
    const fach = versuche(() => lese(path.join(pfad, "fach.json"), fachSchema, basis))
    if (!fach) continue
    if (fach.kuerzel.toLowerCase() !== ordner) {
      fehler.push(`${ordner}: Kürzel «${fach.kuerzel}» passt nicht zum Ordnernamen.`)
    }
    const sektionen = new Set(fach.sektionen.map((s) => s.id))

    for (const thema of unterordner(pfad)) {
      if (!THEMA_ORDNER.test(thema)) {
        fehler.push(`${ordner}/${thema}: Themenordner muss «NN-slug» heissen.`)
        continue
      }
      const name = `${ordner}/${thema}`
      const themaPfad = path.join(pfad, thema)

      const seite = versuche(() => lese(path.join(themaPfad, "seite.json"), seiteSchema, basis))
      if (seite && !sektionen.has(seite.sektion)) {
        fehler.push(`${name}/seite.json: Sektion «${seite.sektion}» gibt es in fach.json nicht.`)
      }

      const film = versuche(() => lese(path.join(themaPfad, "film.json"), filmSchema, basis))
      if (film) fehler.push(...pruefeFilm(film, `${name}/film.json`))

      const quiz = versuche(() => lese(path.join(themaPfad, "quiz.json"), quizSchema, basis))
      const praefix = `${ordner}-${thema.slice(0, 2)}-`
      for (const frage of quiz ?? []) {
        if (!frage.id.startsWith(praefix)) {
          fehler.push(`${name}/quiz.json: Quiz-ID «${frage.id}» muss mit «${praefix}» beginnen.`)
        }
        const frueher = quizIds.get(frage.id)
        if (frueher) {
          fehler.push(`${name}/quiz.json: Quiz-ID «${frage.id}» ist doppelt (auch in ${frueher}).`)
        }
        quizIds.set(frage.id, name)
      }

      versuche(() => lese(path.join(themaPfad, "spick.json"), spickSchema, basis))
    }
  }
  return fehler
}
