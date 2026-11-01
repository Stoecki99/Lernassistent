// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// components/features/leitstand/scenarioLoader.ts
// Szenarien im Browser: statischer JSON-Import ohne erneute Zod-Prüfung (Spezifikation 4.4).
// Dynamischer Import, damit nur der gespielte Lauf das grosse Szenario lädt.

import type { Scenario } from "@/lib/simulation/core"

const cache = new Map<string, Scenario>()

export async function loadClientScenario(id: string): Promise<Scenario | null> {
  const hit = cache.get(id)
  if (hit) return hit
  let raw: unknown
  if (id === "einfuehrung") raw = (await import("@/content/simulation/einfuehrung.json")).default
  else if (id === "wolkenried") raw = (await import("@/content/simulation/wolkenried.json")).default
  else return null
  // Die Tests (5.5) stellen sicher, dass die Dateien dem Schema entsprechen.
  const scenario = raw as Scenario
  cache.set(id, scenario)
  return scenario
}
