// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// lib/simulation/labels.ts
// Bezeichnungen je Szenario (Kern-Erweiterungen K1 und K2, Spezifikation 2.11.13):
// Gebietskürzel und -namen sowie der Name des Gremiums. Rein darstellend, ohne Einfluss auf die Rechnung.
// Fehlen die Felder im Szenario, gelten die Wolkenrieder Bezeichnungen.

import { AREAS, type AreaId, type AreaLabel, type Scenario } from "./types"

/** Wolkenried (2.5): Standard für Szenarien ohne `areas` */
export const DEFAULT_AREA_LABELS: readonly AreaLabel[] = [
  { id: "bau", short: "BAU", label: "Fachwissen Bau und Verwaltung" },
  { id: "ent", short: "ENT", label: "Entwicklung" },
  { id: "dat", short: "DAT", label: "Daten und Schnittstellen" },
  { id: "ux", short: "UX", label: "Benutzerführung" },
  { id: "kom", short: "KOM", label: "Kommunikation und Schulung" },
]

/** Standard für Szenarien ohne `board` */
export const DEFAULT_BOARD_NAME = "Gemeinderat"

/** Gebietsbezeichnungen des Szenarios als Nachschlagetabelle je Gebiet */
export function areaLabelsOf(scenario: Pick<Scenario, "areas">): Record<AreaId, AreaLabel> {
  const list = scenario.areas && scenario.areas.length === AREAS.length ? scenario.areas : DEFAULT_AREA_LABELS
  const out = {} as Record<AreaId, AreaLabel>
  AREAS.forEach((id, i) => {
    out[id] = list[i]?.id === id ? list[i] : DEFAULT_AREA_LABELS[i]
  })
  return out
}

/** Name des Gremiums (Phasenfreigabe, Budgetnachtrag, Anträge), z. B. «Gemeinderat» oder «Regierungsrat» */
export function boardNameOf(scenario: Pick<Scenario, "board">): string {
  return scenario.board?.name ?? DEFAULT_BOARD_NAME
}
