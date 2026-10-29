// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// lib/lernseiten-pruefung.ts
// Gesamtpruefung aller Lernpfad-Inhalte. Nur fuer scripts/lernseiten-pruefen.ts
// und Tests — bewusst getrennt von lib/lernseiten.ts, damit das Output-Tracing
// der Seiten den Quellordner app/ nicht ins Image kopiert.
// Regeln: docs/lernpfad-format.md

import fs from "node:fs"
import path from "node:path"
import { fachSchema, type Fach } from "@/lib/validations/lernseite"
import { STANDARD_BASIS, FACH_SLUG, THEMA_SLUG, unterordner, lese, themaDatei } from "@/lib/lernseiten"

export interface PruefErgebnis {
  /** Verstoesse: das Skript bricht ab, der Docker-Build stoppt. */
  fehler: string[]
  /** Erlaubt, aber erwaehnenswert (z. B. Station folgt noch). */
  hinweise: string[]
}

const CSS_PFAD = "/lernpfad/lernpfad.css"
const JS_PFAD = "/lernpfad/lernpfad.js"

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
// HTML-Hilfen (bewusst einfach: Regex statt Parser, reicht fuer die Pflichtpruefung)
// ---------------------------------------------------------------------------

/** Wert eines Attributs in einem Start-Tag oder null. */
function attribut(tag: string, name: string): string | null {
  const muster = new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'>]+))`, "i")
  const treffer = tag.match(muster)
  if (!treffer) return null
  return (treffer[1] ?? treffer[2] ?? treffer[3] ?? "").trim()
}

/** Alle Start-Tags der genannten Elemente mit Position. */
function startTags(html: string, namen: string): { tag: string; name: string; index: number }[] {
  const muster = new RegExp(`<(${namen})\\b[^>]*>`, "gi")
  return [...html.matchAll(muster)].map((t) => ({ tag: t[0], name: t[1].toLowerCase(), index: t.index ?? 0 }))
}

function zeigtAuf(wert: string | null, ziel: string): boolean {
  return wert === ziel || (wert?.startsWith(`${ziel}?`) ?? false)
}

/** true, wenn die Adresse auf einen anderen Server zeigt (https://, http://, //). */
function istExtern(adresse: string): boolean {
  return /^\s*(?:[a-z][a-z0-9+.-]*:)?\/\//i.test(adresse)
}

function kurz(wert: string): string {
  return wert.length > 80 ? `${wert.slice(0, 77)}…` : wert
}

// Elemente und Attribute, die beim Laden der Seite etwas nachladen.
const RESSOURCEN_TAGS = "script|link|img|iframe|source|video|audio|embed|object|track|base|image|use"
const RESSOURCEN_ATTRIBUTE = ["src", "href", "xlink:href", "srcset", "data", "poster"]

function externeRessourcen(html: string): string[] {
  const fehler: string[] = []

  for (const { tag, name } of startTags(html, RESSOURCEN_TAGS)) {
    for (const attr of RESSOURCEN_ATTRIBUTE) {
      const wert = attribut(tag, attr)
      if (!wert) continue
      const adressen = attr === "srcset" ? wert.split(",").map((teil) => teil.trim().split(/\s+/)[0]) : [wert]
      for (const adresse of adressen) {
        if (istExtern(adresse)) {
          fehler.push(`externe Ressource <${name} ${attr}="${kurz(adresse)}">.`)
        }
      }
    }
  }

  // CSS in <style>-Bloecken und style-Attributen: url(…) und @import
  const css = [
    ...[...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map((t) => t[1]),
    ...[...html.matchAll(/\sstyle\s*=\s*(?:"([^"]*)"|'([^']*)')/gi)].map((t) => t[1] ?? t[2] ?? ""),
  ]
  for (const block of css) {
    const muster = /(?:url\(\s*['"]?|@import\s+['"])\s*((?:[a-z][a-z0-9+.-]*:)?\/\/[^'")\s]*)/gi
    for (const treffer of block.matchAll(muster)) {
      fehler.push(`externe Ressource im CSS (${kurz(treffer[1])}).`)
    }
  }

  return fehler
}

/**
 * Prueft das Pflicht-Geruest einer Themenseite und meldet externe Ressourcen.
 * `fach` und `slug` muessen mit data-fach und data-thema im <body> uebereinstimmen.
 */
export function pruefeThemaHtml(html: string, fach: string, slug: string): string[] {
  const fehler: string[] = []
  const quelle = html.replace(/<!--[\s\S]*?-->/g, "")

  if (!/^﻿?\s*<!doctype html>/i.test(html)) {
    fehler.push("beginnt nicht mit <!doctype html>.")
  }

  const htmlTag = startTags(quelle, "html")[0]
  if (!htmlTag || attribut(htmlTag.tag, "lang") !== "de-CH") {
    fehler.push('<html lang="de-CH"> fehlt.')
  }

  const metas = startTags(quelle, "meta").map((m) => m.tag)
  if (!metas.some((m) => attribut(m, "charset")?.toLowerCase() === "utf-8")) {
    fehler.push('<meta charset="utf-8"> fehlt.')
  }
  if (!metas.some((m) => attribut(m, "name")?.toLowerCase() === "viewport" && attribut(m, "content"))) {
    fehler.push('<meta name="viewport" …> fehlt.')
  }

  const titel = quelle.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)
  if (!titel || !titel[1].trim()) {
    fehler.push("<title> fehlt oder ist leer.")
  }

  const stylesheet = startTags(quelle, "link").some(
    ({ tag }) =>
      (attribut(tag, "rel") ?? "").toLowerCase().split(/\s+/).includes("stylesheet") &&
      zeigtAuf(attribut(tag, "href"), CSS_PFAD),
  )
  if (!stylesheet) {
    fehler.push(`<link rel="stylesheet" href="${CSS_PFAD}"> fehlt.`)
  }

  const body = startTags(quelle, "body")[0]
  if (!body) {
    fehler.push("<body> fehlt.")
  } else {
    const datenFach = attribut(body.tag, "data-fach")
    const datenThema = attribut(body.tag, "data-thema")
    if (datenFach !== fach) {
      fehler.push(`<body data-fach="${fach}"> fehlt (gefunden: ${datenFach === null ? "nichts" : `«${kurz(datenFach)}»`}).`)
    }
    if (datenThema !== slug) {
      fehler.push(
        `<body data-thema="${slug}"> fehlt (gefunden: ${datenThema === null ? "nichts" : `«${kurz(datenThema)}»`}).`,
      )
    }
  }

  const skript = startTags(quelle, "script").find(({ tag }) => zeigtAuf(attribut(tag, "src"), JS_PFAD))
  if (!skript) {
    fehler.push(`<script src="${JS_PFAD}"></script> fehlt.`)
  } else if (body && skript.index < body.index) {
    fehler.push(`<script src="${JS_PFAD}"> gehört ans Ende von <body>, nicht in <head>.`)
  }

  fehler.push(...externeRessourcen(quelle))
  return fehler
}

// ---------------------------------------------------------------------------
// Gesamtpruefung
// ---------------------------------------------------------------------------

function ignoriert(name: string): boolean {
  return name.startsWith("_") || name.startsWith(".")
}

/**
 * Prueft alle Faecher unter `basis`.
 * `reserviert`: Namen von App-Seiten, die nicht als Fachordner verwendet werden duerfen.
 */
export function pruefeAlleInhalte(basis = STANDARD_BASIS, reserviert: string[] = appSeiten()): PruefErgebnis {
  const fehler: string[] = []
  const hinweise: string[] = []

  for (const ordner of unterordner(basis)) {
    if (ignoriert(ordner)) continue
    if (!FACH_SLUG.test(ordner)) {
      fehler.push(`${ordner}: Fachordner nur mit a-z und 0-9.`)
      continue
    }
    if (reserviert.includes(ordner)) {
      fehler.push(`${ordner}: Fachordner heisst wie eine App-Seite (/${ordner}).`)
    }

    const fachOrdner = path.join(basis, ordner)
    let fach: Fach
    try {
      fach = lese(path.join(fachOrdner, "fach.json"), fachSchema, basis)
    } catch (error) {
      fehler.push((error as Error).message)
      continue
    }
    if (fach.kuerzel.toLowerCase() !== ordner) {
      fehler.push(`${ordner}: Kürzel «${fach.kuerzel}» passt nicht zum Ordnernamen.`)
    }

    const slugs = new Set(fach.pfad.map((station) => station.slug))

    for (const eintrag of fs.readdirSync(fachOrdner, { withFileTypes: true })) {
      const name = eintrag.name
      if (ignoriert(name) || name === "fach.json") continue
      const anzeige = `${ordner}/${name}`

      if (!eintrag.isFile() || !name.endsWith(".html")) {
        hinweise.push(`${anzeige}: wird nicht ausgeliefert (nur fach.json und <slug>.html gehören in den Fachordner).`)
        continue
      }

      const slug = name.slice(0, -".html".length)
      if (!THEMA_SLUG.test(slug)) {
        fehler.push(`${anzeige}: Dateiname muss «NN-name.html» heissen.`)
      } else if (!slugs.has(slug)) {
        fehler.push(`${anzeige}: steht nicht im Pfad von ${ordner}/fach.json.`)
      }

      const html = fs.readFileSync(path.join(fachOrdner, name), "utf8")
      for (const meldung of pruefeThemaHtml(html, ordner, slug)) {
        fehler.push(`${anzeige}: ${meldung}`)
      }
    }

    for (const station of fach.pfad) {
      if (!fs.existsSync(themaDatei(fachOrdner, station.slug))) {
        hinweise.push(`${ordner}/${station.slug}: Station folgt (noch keine HTML-Datei).`)
      }
    }
  }

  return { fehler, hinweise }
}
