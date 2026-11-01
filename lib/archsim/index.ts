// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// lib/archsim/index.ts
// Öffentliche Schnittstelle des Simulator-Kerns (docs/architektur-modell.md, Abschnitt 9).
// Reines TypeScript ohne Node-Importe: läuft im Browser (Spielen) und auf dem Server (Nachrechnen).

import { parseMission } from "./schema"
import { MISSIONEN } from "./scenarios"
import type { Mission } from "./types"

export { starte, wendeAn, schritt, beende, auswerten, spieleNach, latenzFaktor, retryFaktor } from "./engine"
export { pruefeAktion } from "./actions"
export { validiere, pruefeModell, pruefeAnforderung, ergaenzeAusPalette } from "./validate"
export { gesamtKennzahlen, quantilMischung } from "./kpi"
export { bewerte, sterneFuer } from "./score"
export { debrief, aktionText, stationsLink, THEMEN } from "./debrief"
export { planFuer, kategorie } from "./routing"
export { grundlast } from "./events"
export { ARCHSIM_VERSION, K, TYP_WERTE, KATEGORIE_VON, MASSNAHMEN_KOSTEN, werteFuer } from "./params"
export { ArchSimFehler, type ArchSimFehlerCode } from "./fehler"
export { nextRandom } from "./rng"
export { missionSchema, modellSchema, aktionSchema, protokollSchema, parseMission, parseAktionen } from "./schema"
export { MISSIONEN } from "./scenarios"
export type * from "./types"
export { AKTION_TYPEN, ELEMENT_TYPEN, GRUPPEN_TYPEN, KATEGORIEN, VERBINDUNGS_ARTEN, ELEMENT_ZUSTAENDE } from "./types"

const cache = new Map<string, Mission>()

/** IDs aller Missionen in Spielreihenfolge */
export const MISSION_IDS: readonly string[] = MISSIONEN.map((m) => m.id)

/** Geprüfte Mission oder null, wenn die ID unbekannt ist. Wirft bei ungültigem Inhalt. */
export function ladeMission(id: string): Mission | null {
  const hit = cache.get(id)
  if (hit) return hit
  const roh = MISSIONEN.find((m) => m.id === id)
  if (!roh) return null
  const m = parseMission(roh)
  cache.set(id, m)
  return m
}

export interface MissionsKarte {
  id: string
  titel: string
  untertitel: string
  schwierigkeit: number
  art: Mission["art"]
  gefuehrt: boolean
  firma: string
  dauer: number
  budget: number
  slo: Mission["slo"]
}

/** Übersicht für die Missionsauswahl */
export function listeMissionen(): MissionsKarte[] {
  return MISSIONEN.map((m) => ({
    id: m.id,
    titel: m.titel,
    untertitel: m.untertitel,
    schwierigkeit: m.schwierigkeit,
    art: m.art,
    gefuehrt: m.gefuehrt,
    firma: m.firma,
    dauer: m.dauer,
    budget: m.budget,
    slo: m.slo,
  }))
}
