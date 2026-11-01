// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// lib/simulation/scenarios.ts
// Szenarien laden: statischer JSON-Import + Zod-Prüfung, im Speicher zwischengespeichert (Spezifikation 4.4).
// Der Client importiert die JSON-Dateien direkt ohne erneute Prüfung; die Tests stellen die Gültigkeit sicher.

import einfuehrung from "../../content/simulation/einfuehrung.json"
import wolkenried from "../../content/simulation/wolkenried.json"
import { parseScenario } from "../validations/simulation"
import type { Scenario } from "./types"

const SOURCES: Record<string, unknown> = {
  einfuehrung,
  wolkenried,
}

export const SCENARIO_IDS: readonly string[] = Object.keys(SOURCES).sort()

const cache = new Map<string, Scenario>()

/** Geprüftes Szenario oder null, wenn die ID unbekannt ist. Wirft bei ungültigem Inhalt. */
export function loadScenario(id: string): Scenario | null {
  const hit = cache.get(id)
  if (hit) return hit
  if (!Object.prototype.hasOwnProperty.call(SOURCES, id)) return null
  const scenario = parseScenario(SOURCES[id])
  cache.set(id, scenario)
  return scenario
}
