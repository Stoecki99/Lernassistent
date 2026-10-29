// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// lib/lernseiten.ts
// Liest Faecher, Lernpfade und Themenseiten (nur serverseitig).
// Jede Themenseite ist eine fertige HTML-Datei: content/lernseiten/<fach>/<slug>.html
// Die Gesamtpruefung fuer Skript und Tests liegt in lib/lernseiten-pruefung.ts.
// Format: docs/lernpfad-format.md

import fs from "node:fs"
import path from "node:path"
import type { z } from "zod"
import {
  fachSchema,
  FACH_SLUG,
  THEMA_SLUG,
  type Fach,
  type Station,
} from "@/lib/validations/lernseite"

export { FACH_SLUG, THEMA_SLUG }

export const STANDARD_BASIS = path.join(process.cwd(), "content", "lernseiten")

/** Fach ohne Pfad, mit Ordnername und Zaehlern (fuer Kacheln und Kopfzeilen). */
export type FachKurz = Omit<Fach, "pfad"> & {
  slug: string
  /** Stationen, fuer die es schon eine HTML-Datei gibt. */
  anzahlThemen: number
  /** Alle Stationen im Pfad, auch die, die noch folgen. */
  anzahlStationen: number
}

/** Station im Lernpfad; `verfuegbar` = HTML-Datei vorhanden (sonst «folgt»). */
export type StationMitStatus = Station & { verfuegbar: boolean }

export interface FachMitPfad {
  fach: FachKurz
  pfad: StationMitStatus[]
}

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

function istDatei(pfad: string): boolean {
  try {
    return fs.statSync(pfad).isFile()
  } catch {
    return false
  }
}

/** Pfad der HTML-Datei einer Station im Fachordner. */
export function themaDatei(fachOrdner: string, slug: string): string {
  return path.join(fachOrdner, `${slug}.html`)
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

/** Normalisiert ein Fach aus der Adresse und liest dessen fach.json, sonst null. */
function ladeFachDaten(
  fach: string,
  basis: string,
): { slug: string; ordner: string; daten: Fach } | null {
  if (typeof fach !== "string") return null
  const slug = fach.toLowerCase()
  if (!FACH_SLUG.test(slug)) return null
  const ordner = path.join(basis, slug)
  const datei = path.join(ordner, "fach.json")
  if (!istDatei(datei)) return null
  return { slug, ordner, daten: lese(datei, fachSchema, basis) }
}

function fachKurz(slug: string, daten: Fach, pfad: StationMitStatus[]): FachKurz {
  // Rohpfad bewusst weglassen: er steht mit Verfuegbarkeit in FachMitPfad.pfad.
  return {
    kuerzel: daten.kuerzel,
    titel: daten.titel,
    beschreibung: daten.beschreibung,
    icon: daten.icon,
    farbe: daten.farbe,
    semester: daten.semester,
    sektionen: daten.sektionen,
    slug,
    anzahlThemen: pfad.filter((station) => station.verfuegbar).length,
    anzahlStationen: pfad.length,
  }
}

function pfadMitStatus(ordner: string, daten: Fach): StationMitStatus[] {
  return daten.pfad.map((station) => ({
    ...station,
    verfuegbar: istDatei(themaDatei(ordner, station.slug)),
  }))
}

// ---------------------------------------------------------------------------
// Laden
// ---------------------------------------------------------------------------

/** Alle Faecher mit Anzahl verfuegbarer Themen, sortiert nach Kuerzel. */
export function ladeFaecher(basis = STANDARD_BASIS): FachKurz[] {
  return unterordner(basis)
    .filter((slug) => FACH_SLUG.test(slug) && istDatei(path.join(basis, slug, "fach.json")))
    .map((slug) => {
      const ordner = path.join(basis, slug)
      const daten = lese(path.join(ordner, "fach.json"), fachSchema, basis)
      return fachKurz(slug, daten, pfadMitStatus(ordner, daten))
    })
    .sort((a, b) => a.kuerzel.localeCompare(b.kuerzel))
}

/** Ein Fach mit seinem Lernpfad (Reihenfolge aus fach.json) oder null, wenn es das Fach nicht gibt. */
export function ladeFach(fach: string, basis = STANDARD_BASIS): FachMitPfad | null {
  const geladen = ladeFachDaten(fach, basis)
  if (!geladen) return null
  const pfad = pfadMitStatus(geladen.ordner, geladen.daten)
  return { fach: fachKurz(geladen.slug, geladen.daten, pfad), pfad }
}

/**
 * HTML einer Themenseite oder null, wenn Fach, Station oder Datei fehlen.
 * Nur Slugs aus dem Pfad von fach.json kommen in einen Dateipfad (kein Pfad-Traversal).
 */
export function ladeThemaHtml(fach: string, thema: string, basis = STANDARD_BASIS): string | null {
  if (typeof thema !== "string" || !THEMA_SLUG.test(thema)) return null

  const geladen = ladeFachDaten(fach, basis)
  if (!geladen) return null
  if (!geladen.daten.pfad.some((station) => station.slug === thema)) return null

  const datei = themaDatei(geladen.ordner, thema)
  // Zusaetzliche Absicherung: die Datei muss direkt im Fachordner liegen.
  if (path.dirname(path.resolve(datei)) !== path.resolve(geladen.ordner)) return null
  if (!istDatei(datei)) return null

  return fs.readFileSync(datei, "utf8")
}
