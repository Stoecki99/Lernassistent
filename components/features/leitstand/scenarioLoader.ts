// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// components/features/leitstand/scenarioLoader.ts
// Szenarien im Browser: JSON-Import ohne erneute Zod-Prüfung (Spezifikation 4.4).
// Dynamischer Import, damit nur der gespielte Lauf sein Szenario lädt: webpack legt jede Datei aus
// content/simulation als eigenes Teilpaket an und lädt nur das angeforderte (K3, 2.11.13).
// Erlaubt sind nur IDs aus dem Verzeichnis (catalog.ts); fehlt die Datei, kommt null zurück.

import type { Scenario } from "@/lib/simulation/core"
import { CATALOG_IDS } from "@/lib/simulation/catalog"

const cache = new Map<string, Scenario>()

export async function loadClientScenario(id: string): Promise<Scenario | null> {
  const hit = cache.get(id)
  if (hit) return hit
  if (!CATALOG_IDS.includes(id)) return null
  let raw: unknown
  try {
    const mod = (await import(`../../../content/simulation/${id}.json`)) as { default: unknown }
    raw = mod.default
  } catch (error) {
    console.error("[leitstand] Szenario nicht verfügbar", id, error)
    return null
  }
  // Die Tests (5.5) stellen sicher, dass die Dateien dem Schema entsprechen.
  const scenario = raw as Scenario
  cache.set(id, scenario)
  return scenario
}
