// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// lib/ipma/pool.ts
// Fragenpool laden (Spezifikation 2.3, 6.2): statische Importe der 28 Dateien, Zod-Prüfung, Prüfungen über
// den ganzen Pool, Zwischenspeicher und POOL_VERSION. NUR SERVER: enthält alle Lösungen (6.6 «Bündel»).

import { createHash } from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import f1_01 from "../../content/ipma/fragen/1-01.json"
import f1_02 from "../../content/ipma/fragen/1-02.json"
import f1_03 from "../../content/ipma/fragen/1-03.json"
import f1_04 from "../../content/ipma/fragen/1-04.json"
import f1_05 from "../../content/ipma/fragen/1-05.json"
import f2_01 from "../../content/ipma/fragen/2-01.json"
import f2_02 from "../../content/ipma/fragen/2-02.json"
import f2_03 from "../../content/ipma/fragen/2-03.json"
import f2_04 from "../../content/ipma/fragen/2-04.json"
import f2_05 from "../../content/ipma/fragen/2-05.json"
import f2_06 from "../../content/ipma/fragen/2-06.json"
import f2_07 from "../../content/ipma/fragen/2-07.json"
import f2_08 from "../../content/ipma/fragen/2-08.json"
import f2_09 from "../../content/ipma/fragen/2-09.json"
import f2_10 from "../../content/ipma/fragen/2-10.json"
import f3_01 from "../../content/ipma/fragen/3-01.json"
import f3_02 from "../../content/ipma/fragen/3-02.json"
import f3_03 from "../../content/ipma/fragen/3-03.json"
import f3_04 from "../../content/ipma/fragen/3-04.json"
import f3_05 from "../../content/ipma/fragen/3-05.json"
import f3_06 from "../../content/ipma/fragen/3-06.json"
import f3_07 from "../../content/ipma/fragen/3-07.json"
import f3_08 from "../../content/ipma/fragen/3-08.json"
import f3_09 from "../../content/ipma/fragen/3-09.json"
import f3_10 from "../../content/ipma/fragen/3-10.json"
import f3_11 from "../../content/ipma/fragen/3-11.json"
import f3_12 from "../../content/ipma/fragen/3-12.json"
import f3_13 from "../../content/ipma/fragen/3-13.json"
import fach from "../../content/lernseiten/pmgt/fach.json"
import { competenceFileSchema, type CompetenceFile, type PoolQuestion } from "../validations/ipma-pool"
import { COMPETENCE_IDS, type CompetenceId } from "./competences"
import { POOL_MINIMUM } from "./config"
import type { StationCatalog } from "./scoring"

/** Rohdaten in fester Reihenfolge der Kompetenzen (2.1: 1-01.json … 3-13.json) */
const SOURCES: readonly unknown[] = [
  f1_01, f1_02, f1_03, f1_04, f1_05,
  f2_01, f2_02, f2_03, f2_04, f2_05, f2_06, f2_07, f2_08, f2_09, f2_10,
  f3_01, f3_02, f3_03, f3_04, f3_05, f3_06, f3_07, f3_08, f3_09, f3_10, f3_11, f3_12, f3_13,
]

export interface Pool {
  version: string // SHA-256 der Dateien, 12 Zeichen
  files: CompetenceFile[]
  questions: PoolQuestion[] // alle Status; die Auswahl filtert selbst auf «geprueft»
  byId: ReadonlyMap<string, PoolQuestion>
}

/** Fragetext für den Dubletten-Vergleich: klein, ohne Satzzeichen, einfache Leerzeichen (2.3) */
export function normalizeText(text: string): string {
  return text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim()
}

/** Dateiname zur Kompetenz (2.1): "3.04" → "3-04.json" */
export function poolFileName(id: CompetenceId): string {
  return `${id.replace(".", "-")}.json`
}

/**
 * Prüfungen über den ganzen Pool (2.3): alle 28 Dateien genau einmal, IDs eindeutig, keine zwei Fragen mit
 * gleichem normalisiertem Text, je Kompetenz mindestens `minimum` geprüfte Fragen (null = nicht erzwungen,
 * siehe POOL_STAGE). Liefert die Fehlermeldungen; leer = gültig.
 */
export function validatePool(
  files: readonly CompetenceFile[],
  minimum: { mc: number; offen: number } | null = POOL_MINIMUM,
): string[] {
  const errors: string[] = []
  const fileCount = new Map<string, number>()
  for (const f of files) fileCount.set(f.kompetenz, (fileCount.get(f.kompetenz) ?? 0) + 1)
  for (const id of COMPETENCE_IDS) {
    const n = fileCount.get(id) ?? 0
    if (n === 0) errors.push(`${poolFileName(id)}: Datei fehlt.`)
    if (n > 1) errors.push(`${poolFileName(id)}: Kompetenz ${id} kommt ${n}-mal vor.`)
  }
  const ids = new Map<string, string>()
  const texts = new Map<string, string>()
  for (const f of files) {
    for (const q of f.fragen) {
      if (ids.has(q.id)) errors.push(`${q.id}: ID doppelt (${ids.get(q.id)} und ${f.kompetenz}).`)
      else ids.set(q.id, f.kompetenz)
      const norm = normalizeText(q.frage)
      const other = texts.get(norm)
      if (other !== undefined && other !== q.id) errors.push(`${q.id}: gleicher Fragetext wie ${other}.`)
      else texts.set(norm, q.id)
    }
  }
  if (minimum) {
    for (const f of files) {
      const ok = f.fragen.filter((q) => q.status === "geprueft")
      const mc = ok.filter((q) => q.typ === "mc").length
      const offen = ok.filter((q) => q.typ === "offen").length
      if (mc < minimum.mc || offen < minimum.offen)
        errors.push(`${f.kompetenz}: ${mc} MC und ${offen} offene geprüft, verlangt ${minimum.mc} und ${minimum.offen}.`)
    }
  }
  return errors
}

/**
 * Prüft Rohdaten mit competenceFileSchema und validatePool (2.3). Wirft mit allen Meldungen, wenn etwas
 * ungültig ist. Für den Server über loadPool(); Tests übergeben eigene Rohdaten (Mini-Pool).
 */
export function buildPool(
  sources: readonly unknown[],
  minimum: { mc: number; offen: number } | null = POOL_MINIMUM,
): Pool {
  const errors: string[] = []
  const files: CompetenceFile[] = []
  sources.forEach((raw, i) => {
    const parsed = competenceFileSchema.safeParse(raw)
    if (parsed.success) files.push(parsed.data)
    else for (const issue of parsed.error.issues) errors.push(`Datei ${i + 1} ${issue.path.join(".")}: ${issue.message}`)
  })
  if (!errors.length) errors.push(...validatePool(files, minimum))
  if (errors.length) throw new Error(`Fragenpool ungültig:\n${errors.join("\n")}`)
  const questions = files.flatMap((f) => f.fragen)
  const version = createHash("sha256").update(JSON.stringify(sources)).digest("hex").slice(0, 12)
  return { version, files, questions, byId: new Map(questions.map((q) => [q.id, q])) }
}

let cache: Pool | null = null

/** Der geprüfte Fragenpool aus content/ipma/fragen (6.2), im Speicher zwischengespeichert */
export function loadPool(): Pool {
  if (!cache) cache = buildPool(SOURCES)
  return cache
}

/** Kurz-Version des Pools für IpmaAttempt.poolVersion (6.2) */
export function poolVersion(): string {
  return loadPool().version
}

/** Frage zur ID (auch zurückgezogene, für alte Versuche) oder null (6.2) */
export function getQuestion(id: string): PoolQuestion | null {
  return loadPool().byId.get(id) ?? null
}

/**
 * Titel und Verfügbarkeit der Stationen des Lernpfads PMGT für die Empfehlung (4.4): verfügbar, wenn die
 * Datei content/lernseiten/pmgt/<slug>.html existiert (Wellen 2 und 3 erscheinen sonst mit «folgt»).
 */
export function loadStationCatalog(basis: string = path.join(process.cwd(), "content", "lernseiten", "pmgt")): StationCatalog {
  return new Map(fach.pfad.map((s: { slug: string; titel: string }) => [
    s.slug,
    { title: s.titel, available: fs.existsSync(path.join(basis, `${s.slug}.html`)) },
  ]))
}
