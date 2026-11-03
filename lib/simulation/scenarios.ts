// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// lib/simulation/scenarios.ts
// Szenarien laden: statischer JSON-Import + Zod-Prüfung, im Speicher zwischengespeichert (Spezifikation 4.4).
// Der Client importiert die JSON-Dateien direkt ohne erneute Prüfung; die Tests stellen die Gültigkeit sicher.
// K3 (2.11.13): Szenarien aus dem Verzeichnis (catalog.ts) ohne statischen Import liest der Server aus
// content/simulation (im Container vorhanden, siehe Dockerfile). Fehlt die Datei, gilt das Szenario als
// unbekannt (Startseite zeigt «folgt», API antwortet 400) statt den Build zu brechen.

import fs from "node:fs"
import path from "node:path"
import einfuehrung from "../../content/simulation/einfuehrung.json"
import wolkenried from "../../content/simulation/wolkenried.json"
import { parseScenario } from "../validations/simulation"
import { CATALOG_IDS } from "./catalog"
import type { Scenario } from "./types"

const STATIC_SOURCES: Record<string, unknown> = {
  einfuehrung,
  wolkenried,
}

const SCENARIO_DIR = path.join(process.cwd(), "content", "simulation")

function filePath(id: string): string {
  return path.join(SCENARIO_DIR, `${id}.json`)
}

/** Nachgelieferte Szenarien: im Verzeichnis, aber ohne statischen Import (z. B. hochmatt) */
const FILE_IDS: readonly string[] = CATALOG_IDS.filter((id) => !Object.prototype.hasOwnProperty.call(STATIC_SOURCES, id))

/** IDs aller ladbaren Szenarien (statisch importiert oder Datei vorhanden) */
export const SCENARIO_IDS: readonly string[] = [
  ...Object.keys(STATIC_SOURCES),
  ...FILE_IDS.filter((id) => fs.existsSync(filePath(id))),
].sort()

const cache = new Map<string, Scenario>()

function rawSource(id: string): unknown {
  if (Object.prototype.hasOwnProperty.call(STATIC_SOURCES, id)) return STATIC_SOURCES[id]
  if (!FILE_IDS.includes(id)) return undefined
  const file = filePath(id)
  if (!fs.existsSync(file)) return undefined
  return JSON.parse(fs.readFileSync(file, "utf8")) as unknown
}

/** Geprüftes Szenario oder null, wenn die ID unbekannt ist (oder die Datei fehlt). Wirft bei ungültigem Inhalt. */
export function loadScenario(id: string): Scenario | null {
  const hit = cache.get(id)
  if (hit) return hit
  const raw = rawSource(id)
  if (raw === undefined) return null
  const scenario = parseScenario(raw)
  cache.set(id, scenario)
  return scenario
}
