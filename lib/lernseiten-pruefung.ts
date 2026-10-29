// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// lib/lernseiten-pruefung.ts
// Gesamtpruefung aller Lernpfad-Inhalte. Nur fuer scripts/lernseiten-pruefen.ts
// und Tests — bewusst getrennt von lib/lernseiten.ts, damit das Output-Tracing
// der Seiten den Quellordner app/ nicht ins Image kopiert.
// Regeln: docs/lernpfad-format.md

import fs from "node:fs"
import path from "node:path"
import { fachSchema, type Fach, type Station } from "@/lib/validations/lernseite"
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

/** Namen auf oberster Ebene von public/ (Ordner und Dateien), z. B. «lernpfad». */
export function publicNamen(publicPfad = path.join(process.cwd(), "public")): string[] {
  if (!fs.existsSync(publicPfad)) return []
  return fs.readdirSync(publicPfad).map((name) => name.toLowerCase())
}

/**
 * Namen, die kein Fachordner tragen darf: Die Kurzlinks /<fach> und /<fach>/… (next.config.js)
 * wuerden App-Seiten, Dateien aus public/ (z. B. /lernpfad/lernpfad.css) und /_next verdecken.
 */
export function reservierteNamen(): string[] {
  return [...new Set([...appSeiten(), ...publicNamen(), "_next"])]
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

// ---------------------------------------------------------------------------
// Inline-Scripts: externe Adressen in Aufrufen, die etwas laden
// ---------------------------------------------------------------------------

/** Beginnt ein «/» nach diesem Zeichen bzw. Wort eine Regex (und keine Division)? */
function regexMoeglich(letztes: string, bisher: string): boolean {
  if (letztes === "" || "(,=:[!&|?{};+-*%~^<>".includes(letztes)) return true
  return /(?:^|[^\w$])(?:return|typeof|case|do|else|in|of|delete|void|throw|new|instanceof|yield|await)$/.test(
    bisher.slice(-40).trimEnd(),
  )
}

/**
 * Entfernt JavaScript-Kommentare und laesst Strings, Template-Strings (auch verschachtelt
 * ueber ${…}) und Regex-Literale stehen. Bewusst einfach, reicht fuer die Pruefung:
 * eine Adresse in einem Kommentar soll nicht als Ladeaufruf gelten.
 */
export function ohneJsKommentare(code: string): string {
  let aus = ""
  let i = 0
  // Letztes Zeichen ausserhalb von Leerraum und Kommentaren: entscheidet, ob «/» eine Regex beginnt
  let letztes = ""
  // Klammertiefe je offenem ${…} in einem Template-String
  const tiefen: number[] = []
  let imTemplate = false

  while (i < code.length) {
    const z = code[i]
    if (imTemplate) {
      if (z === "\\") {
        aus += code.slice(i, i + 2)
        i += 2
      } else if (z === "`") {
        aus += z
        i++
        imTemplate = false
        letztes = z
      } else if (z === "$" && code[i + 1] === "{") {
        aus += "${"
        i += 2
        tiefen.push(0)
        imTemplate = false
        letztes = "{"
      } else {
        aus += z
        i++
      }
      continue
    }

    const n = code[i + 1]
    if (z === "/" && n === "/") {
      const ende = code.indexOf("\n", i)
      i = ende === -1 ? code.length : ende
      continue
    }
    if (z === "/" && n === "*") {
      const ende = code.indexOf("*/", i + 2)
      i = ende === -1 ? code.length : ende + 2
      aus += " "
      continue
    }
    if (z === "`") {
      aus += z
      i++
      imTemplate = true
      continue
    }
    if (z === '"' || z === "'") {
      let j = i + 1
      while (j < code.length && code[j] !== z && code[j] !== "\n") j += code[j] === "\\" ? 2 : 1
      aus += code.slice(i, j + 1)
      i = j + 1
      letztes = z
      continue
    }
    if (z === "}" && tiefen.length > 0) {
      if (tiefen[tiefen.length - 1] === 0) {
        tiefen.pop()
        aus += z
        i++
        imTemplate = true
        continue
      }
      tiefen[tiefen.length - 1]--
    } else if (z === "{" && tiefen.length > 0) {
      tiefen[tiefen.length - 1]++
    }
    if (z === "/" && regexMoeglich(letztes, aus)) {
      // Regex-Literal bis zum unmaskierten «/» ausserhalb einer Zeichenklasse
      let j = i + 1
      let klasse = false
      while (j < code.length && code[j] !== "\n") {
        const c = code[j]
        if (c === "\\") {
          j += 2
          continue
        }
        if (c === "[") klasse = true
        else if (c === "]") klasse = false
        else if (c === "/" && !klasse) break
        j++
      }
      aus += code.slice(i, j + 1)
      i = j + 1
      letztes = "/"
      continue
    }
    aus += z
    if (!/\s/.test(z)) letztes = z
    i++
  }
  return aus
}

// Adresse auf einem anderen Server direkt nach dem Anfuehrungszeichen: https://host…, wss://host…, //host…
const EXTERNE_ADRESSE = String.raw`["'\x60]\s*((?:[a-z][a-z0-9+.-]*:)?\/\/[a-z0-9-]+(?:\.[a-z0-9-]+)*[^"'\x60\s]*)`

// Aufrufe, die beim Ausfuehren etwas nachladen. Nicht dabei: href (Links auf Quellen sind erlaubt),
// createElementNS("http://www.w3.org/2000/svg", …) und Adressen in gewoehnlichem Text.
const LADE_AUFRUF = new RegExp(
  String.raw`(?:\bfetch\s*\(|\bimport\s*\(|\b(?:import|from)\s+|\.src\s*=|\bsrc\s*:|` +
    String.raw`\.setAttribute(?:NS)?\s*\([^()]*?["'](?:src|srcset|poster|data|xlink:href)["']\s*,|` +
    String.raw`\bnew\s+(?:Worker|SharedWorker|WebSocket|EventSource|Audio)\s*\(|` +
    String.raw`\.open\s*\(\s*["'][a-z]+["']\s*,|\b(?:sendBeacon|importScripts)\s*\()\s*` +
    EXTERNE_ADRESSE,
  "gi",
)
// CSS in Strings, z. B. el.style.background = "url(https://…)". Klein geschrieben, damit new URL(…) nicht zaehlt.
const CSS_URL = /\burl\(\s*["']?\s*((?:[a-zA-Z][a-zA-Z0-9+.-]*:)?\/\/[a-zA-Z0-9-]+[^"')\s]*)/g

/** Externe Adressen in Inline-Scripts (ohne src), die geladen wuerden. */
function externeSkriptAdressen(html: string): string[] {
  const fehler: string[] = []
  for (const treffer of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)) {
    if (attribut(`<script${treffer[1]}>`, "src") !== null) continue
    const code = ohneJsKommentare(treffer[2])
    for (const t of code.matchAll(LADE_AUFRUF)) {
      fehler.push(`externe Adresse in einem Inline-Script (${kurz(t[0].replace(/\s+/g, " "))}).`)
    }
    for (const t of code.matchAll(CSS_URL)) {
      fehler.push(`externe Adresse in einem Inline-Script (${kurz(t[0])}).`)
    }
  }
  return fehler
}

/** Schluessel des Farbschemas, muss zu lernpfad.js und ThemaWahl.tsx passen. */
const THEMA_SCHLUESSEL = "lernpfad-theme"

/** true, wenn vor <body> ein Inline-Script das gespeicherte Farbschema setzt. */
function hatThemaStart(html: string, bodyIndex: number): boolean {
  return [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)].some(
    (t) =>
      (t.index ?? 0) < bodyIndex &&
      attribut(`<script${t[1]}>`, "src") === null &&
      t[2].includes(THEMA_SCHLUESSEL) &&
      t[2].includes("data-theme"),
  )
}

/** Wandelt die gaengigen Zeichenreferenzen in Attributwerten zurueck (fuer den Titel-Vergleich). */
function entitaetenAufloesen(wert: string): string {
  return wert
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
}

/**
 * Prueft <link rel="next"> gegen den Pfad: Er zeigt auf die naechste Station laut fach.json,
 * `title` ist deren Titel. Die letzte Station (naechste = null) hat keinen.
 */
export function pruefeNaechsteStation(html: string, fach: string, naechste: Station | null): string[] {
  const quelle = html.replace(/<!--[\s\S]*?-->/g, "")
  const links = startTags(quelle, "link").filter(({ tag }) =>
    (attribut(tag, "rel") ?? "").toLowerCase().split(/\s+/).includes("next"),
  )

  if (!naechste) {
    return links.length > 0 ? ['<link rel="next"> gehört nicht auf die letzte Station (weglassen).'] : []
  }

  const href = `/lernseiten/${fach}/${naechste.slug}`
  if (links.length === 0) {
    return [`<link rel="next" href="${href}" title="${naechste.titel}"> fehlt.`]
  }
  if (links.length > 1) {
    return ['<link rel="next"> steht mehrfach in der Seite.']
  }

  const fehler: string[] = []
  const tag = links[0].tag
  const istHref = attribut(tag, "href")
  if (istHref !== href) {
    fehler.push(`<link rel="next"> zeigt auf «${kurz(istHref ?? "nichts")}», erwartet ${href}.`)
  }
  const titel = attribut(tag, "title")
  if (titel === null || entitaetenAufloesen(titel) !== naechste.titel) {
    fehler.push(`<link rel="next"> braucht title="${naechste.titel}" (gefunden: ${titel === null ? "nichts" : `«${kurz(titel)}»`}).`)
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

  const bodyIndex = startTags(quelle, "body")[0]?.index ?? quelle.length
  if (!hatThemaStart(quelle, bodyIndex)) {
    fehler.push(`Theme-Startskript im <head> fehlt (setzt data-theme aus «${THEMA_SCHLUESSEL}», siehe _vorlage.html).`)
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
  fehler.push(...externeSkriptAdressen(quelle))
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
 * `reserviert`: Namen, die nicht als Fachordner verwendet werden duerfen (siehe reservierteNamen).
 */
export function pruefeAlleInhalte(basis = STANDARD_BASIS, reserviert: string[] = reservierteNamen()): PruefErgebnis {
  const fehler: string[] = []
  const hinweise: string[] = []

  for (const ordner of unterordner(basis)) {
    if (ignoriert(ordner)) continue
    if (!FACH_SLUG.test(ordner)) {
      fehler.push(`${ordner}: Fachordner nur mit a-z und 0-9.`)
      continue
    }
    if (reserviert.includes(ordner)) {
      fehler.push(
        `${ordner}: Fachordner heisst wie eine App-Seite oder ein Eintrag in public/ (/${ordner}); der Kurzlink würde sie verdecken.`,
      )
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
      const meldungen = pruefeThemaHtml(html, ordner, slug)
      const position = fach.pfad.findIndex((station) => station.slug === slug)
      if (position >= 0) {
        meldungen.push(...pruefeNaechsteStation(html, ordner, fach.pfad[position + 1] ?? null))
      }
      for (const meldung of meldungen) {
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
