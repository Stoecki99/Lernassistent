// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// lib/archsim/params.ts
// Standardwerte je Elementtyp und Konstanten des Simulators (docs/architektur-modell.md, Abschnitt 9.1).
// Werte sind didaktisch vereinfacht, Grössenordnungen orientieren sich an üblichen Cloud-Setups.

import type { AktionTyp, ElementTyp, Kategorie, SimWerte } from "./types"

/** Version des Kerns. Erhöhen, sobald alte Aktionsprotokolle anders verlaufen würden. */
export const ARCHSIM_VERSION = 1

export type TypWerte = Required<Omit<SimWerte, "trefferquote" | "puffer">> & {
  puffer: number
  trefferquote: number
  /** Trägt das Element Last? (Gruppen, Artefakte, Monitoring: nein) */
  traegtLast: boolean
  /** Kapazität unbegrenzt (Clients) */
  unbegrenzt: boolean
}

const basis = (w: Partial<TypWerte>): TypWerte => ({
  kapazitaet: 100,
  latenz: 20,
  instanzen: 1,
  fehlerquote: 0.0002,
  kostenProInstanz: 10,
  parallel: 100,
  maxInstanzen: 20,
  puffer: 0,
  trefferquote: 0,
  traegtLast: true,
  unbegrenzt: false,
  ...w,
})

const client = basis({ kapazitaet: 0, latenz: 30, fehlerquote: 0, kostenProInstanz: 0, parallel: 0, maxInstanzen: 1, unbegrenzt: true })
const passiv = basis({ kapazitaet: 0, latenz: 0, fehlerquote: 0, kostenProInstanz: 0, parallel: 0, maxInstanzen: 1, traegtLast: false })
const dienst = basis({ kapazitaet: 120, latenz: 25, parallel: 100, kostenProInstanz: 10 })
const messaging = basis({ kapazitaet: 3000, latenz: 4, parallel: 5000, kostenProInstanz: 12, puffer: 200000, fehlerquote: 0.0002, maxInstanzen: 6 })

/** Standardwerte je Typ (Abschnitt 9.1). `latenz` = Bedienzeit ohne Warteschlange. */
export const TYP_WERTE: Record<ElementTyp, TypWerte> = {
  akteur: client,
  web: client,
  mobile: client,
  cdn: basis({ kapazitaet: 50000, latenz: 15, parallel: 100000, kostenProInstanz: 8, fehlerquote: 0.0001, maxInstanzen: 1 }),
  gateway: basis({ kapazitaet: 1500, latenz: 3, parallel: 1000, kostenProInstanz: 6, fehlerquote: 0.0002 }),
  lastverteiler: basis({ kapazitaet: 5000, latenz: 1, parallel: 10000, kostenProInstanz: 4, fehlerquote: 0.0001 }),
  ingress: basis({ kapazitaet: 3000, latenz: 2, parallel: 5000, kostenProInstanz: 4, fehlerquote: 0.0001 }),
  auth: basis({ kapazitaet: 400, latenz: 15, parallel: 200, kostenProInstanz: 6 }),
  dienst,
  monolith: basis({ kapazitaet: 50, latenz: 60, parallel: 150, kostenProInstanz: 16, maxInstanzen: 12 }),
  funktion: basis({ kapazitaet: 80, latenz: 40, parallel: 80, kostenProInstanz: 3, maxInstanzen: 100 }),
  orchestrator: basis({ kapazitaet: 200, latenz: 20, parallel: 300, kostenProInstanz: 10 }),
  queue: messaging,
  topic: messaging,
  broker: messaging,
  bus: basis({ kapazitaet: 600, latenz: 20, parallel: 1000, kostenProInstanz: 30, puffer: 50000, maxInstanzen: 4 }),
  mesh: basis({ kapazitaet: 10000, latenz: 1, parallel: 10000, kostenProInstanz: 2, fehlerquote: 0.0001 }),
  datenbank: basis({ kapazitaet: 400, latenz: 6, parallel: 300, kostenProInstanz: 25, maxInstanzen: 1 }),
  nosql: basis({ kapazitaet: 1500, latenz: 4, parallel: 1000, kostenProInstanz: 20, maxInstanzen: 12 }),
  cache: basis({ kapazitaet: 8000, latenz: 1, parallel: 10000, kostenProInstanz: 8, fehlerquote: 0.0001, trefferquote: 0.85, maxInstanzen: 6 }),
  suche: basis({ kapazitaet: 600, latenz: 15, parallel: 600, kostenProInstanz: 20, maxInstanzen: 8 }),
  speicher: basis({ kapazitaet: 3000, latenz: 30, parallel: 5000, kostenProInstanz: 3, maxInstanzen: 1 }),
  extern: basis({ kapazitaet: 200, latenz: 250, parallel: 400, kostenProInstanz: 0, fehlerquote: 0.001, maxInstanzen: 1 }),
  knoten: passiv,
  cluster: passiv,
  pod: passiv,
  container: passiv,
  artefakt: passiv,
  paket: passiv,
  grenze: passiv,
  schnittstelle: passiv,
  filter: dienst,
  peer: dienst,
  plugin: dienst,
  monitor: passiv,
}

export const KATEGORIE_VON: Record<ElementTyp, Kategorie | null> = {
  akteur: "client",
  web: "client",
  mobile: "client",
  cdn: "zugang",
  gateway: "zugang",
  lastverteiler: "zugang",
  ingress: "zugang",
  auth: "sicherheit",
  dienst: "dienst",
  monolith: "dienst",
  funktion: "dienst",
  orchestrator: "dienst",
  queue: "messaging",
  topic: "messaging",
  broker: "messaging",
  bus: "messaging",
  mesh: "infrastruktur",
  datenbank: "daten",
  nosql: "daten",
  cache: "daten",
  suche: "daten",
  speicher: "daten",
  extern: "extern",
  knoten: "infrastruktur",
  cluster: "infrastruktur",
  pod: "infrastruktur",
  container: "infrastruktur",
  artefakt: "infrastruktur",
  paket: null,
  grenze: null,
  schnittstelle: null,
  filter: "dienst",
  peer: "dienst",
  plugin: "dienst",
  monitor: "infrastruktur",
}

/** Einmalkosten der Massnahmen in CHF (Aufwand für Umsetzung und Konfiguration). Instanzen kosten zusätzlich laufend. */
export const MASSNAHMEN_KOSTEN: Record<AktionTyp, number> = {
  weiter: 0,
  skalieren: 0,
  autoscaling: 15,
  cache: 40,
  cdn: 30,
  queue: 60,
  circuitBreaker: 20,
  timeout: 5,
  retry: 5,
  readReplica: 10,
  rateLimit: 10,
  bulkhead: 20,
  rollback: 5,
}

/** Konstanten des Rechenkerns (Abschnitt 9.2–9.6) */
export const K = {
  /** Timeout eines Aufrufers ohne eigene Einstellung (typischer HTTP-Client-Standard) */
  STANDARD_TIMEOUT_MS: 30000,
  /** Kundinnen brechen ab (Mission kann überschreiben) */
  CLIENT_TIMEOUT_MS: 10000,
  /** Obergrenze des Latenzfaktors R/S (Kappung der Warteschlange) */
  LATENZ_KAPPUNG: 40,
  /** Auslastung, ab der die Formel nicht mehr gilt (Überlast-Bereich) */
  RHO_GRENZE: 0.97,
  /** Wartezeit einer Anfrage, die keinen Platz findet, bis der Aufrufer aufgibt (ms) */
  SAETTIGUNG_WARTEN_MS: 5000,
  /** Überlast: Anteil der Kapazität, der bei ρ ≥ 2 an Anfragen verloren geht, deren Aufrufer schon aufgegeben hat */
  UEBERLAST_VERLUST: 0.3,
  /** Bulkhead: Anteil des Thread-Pools für eine abgeschottete Verbindung */
  BULKHEAD_ANTEIL: 0.25,
  /** Circuit Breaker: öffnet ab dieser Fehlerquote … */
  CB_SCHWELLE: 0.5,
  /** … und bleibt so viele Minuten offen, dann halboffen */
  CB_OFFEN_MINUTEN: 2,
  /** Halboffen: Anteil der Aufrufe, die als Probe durchgehen */
  CB_PROBE: 0.1,
  /** Startzeit neuer Instanzen in Minuten */
  START_VERZOEGERUNG: 2,
  /** Autoscaling: Zielauslastung, Schwellen für Auf- und Abbau, Minuten tiefer Last bis Abbau */
  AS_ZIEL: 0.6,
  AS_HOCH: 0.75,
  AS_TIEF: 0.3,
  AS_TIEF_MINUTEN: 3,
  /** Konsument zieht Nachrichten bis zu diesem Anteil seiner Kapazität */
  KONSUM_ANTEIL: 0.8,
  /** Cache braucht so viele Minuten, bis er warm ist */
  CACHE_AUFWAERMEN: 3,
  /** Anteil der Bedienzeit, der fest ist (Verschiebung der Latenzverteilung) */
  LATENZ_FEST: 0.8,
  /** Netzwerk-Laufzeit je internem Aufruf in ms */
  NETZ_MS: 1,
  /** Antwortzeit eines offenen Circuit Breakers bzw. einer schnellen Ablehnung in ms */
  SCHNELL_MS: 1,
  /** Auslastung, ab der ein Element als Engpass gilt */
  ENGPASS: 0.85,
  /** Glättung der Rückkopplung aus der Vorminute (Anteil des neuen Werts), dämpft Schwingungen */
  GLAETTUNG: 0.5,
  /** Sternschwellen (Punkte) */
  STERNE: [400, 650, 820] as const,
} as const

/** Wirksame Simulationswerte eines Elements: Typ-Standard, überschrieben durch `sim` */
export function werteFuer(typ: ElementTyp, sim?: SimWerte): TypWerte {
  const w = TYP_WERTE[typ]
  return sim ? { ...w, ...stripUndefined(sim) } : w
}

function stripUndefined<T extends object>(o: T): Partial<T> {
  const out: Partial<T> = {}
  for (const [k, v] of Object.entries(o)) if (v !== undefined) (out as Record<string, unknown>)[k] = v
  return out
}
