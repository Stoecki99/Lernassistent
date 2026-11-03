// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// tests/helpers/archsim-strategien.ts
// Musterstrategien, naive Modelle und Mini-Missionen für die Tests des Simulator-Kerns (lib/archsim).

import { ladeMission, type Aktion, type ArchModell, type Mission } from "@/lib/archsim"

export function mission(id: string): Mission {
  const m = ladeMission(id)
  if (!m) throw new Error(`Mission ${id} fehlt`)
  return m
}

const as = (element: string, min: number, max: number): Aktion => ({ typ: "autoscaling", element, an: true, min, max })

export interface Strategie {
  aktionen: Aktion[]
  modell?: ArchModell
}

/** Naives Modell für M4: alles synchron, kein Cache, kein CDN, keine Queue */
export function naivesTicketModell(m: Mission): ArchModell {
  return {
    ...m.modell,
    elemente: [
      ...m.modell.elemente,
      { id: "gw", typ: "gateway", name: "API-Gateway", x: 2, y: 1 },
      { id: "ticket", typ: "dienst", name: "Ticketservice", x: 3, y: 1 },
      { id: "ticket-db", typ: "datenbank", name: "Ticket-DB", x: 4, y: 0 },
      { id: "zahlung", typ: "dienst", name: "Zahlungsservice", x: 4, y: 2 },
      { id: "zahlung-db", typ: "datenbank", name: "Zahlungs-DB", x: 5, y: 3 },
    ],
    verbindungen: [
      ...m.modell.verbindungen,
      { id: "app-gw", von: "fan-app", nach: "gw", art: "sync" },
      { id: "gw-ticket", von: "gw", nach: "ticket", art: "sync" },
      { id: "ticket-db-zugriff", von: "ticket", nach: "ticket-db", art: "daten" },
      { id: "ticket-zahlung", von: "ticket", nach: "zahlung", art: "sync" },
      { id: "zahlung-psp", von: "zahlung", nach: "psp", art: "sync" },
      { id: "zahlung-mailer", von: "zahlung", nach: "mailer", art: "sync" },
      { id: "zahlung-db-zugriff", von: "zahlung", nach: "zahlung-db", art: "daten" },
    ],
  }
}

/** Ohne Massnahmen (bei M4: naives Modell) */
export function ohneMassnahmen(m: Mission): Strategie {
  return m.art === "modellieren" ? { aktionen: [], modell: naivesTicketModell(m) } : { aktionen: [] }
}

/** Vernünftige Musterstrategie je Mission (siehe Mission.musterstrategie) */
export function muster(m: Mission): Strategie {
  switch (m.id) {
    case "m1-velokurier":
      return { aktionen: [{ typ: "cache", element: "db" }, as("mono", 2, 8)] }
    case "m2-black-friday":
      return {
        aktionen: [
          { typ: "cdn", element: "shop" },
          { typ: "cache", element: "katalog-db" },
          as("katalog", 2, 10), as("best", 2, 10), as("lager", 2, 10), as("zahlung", 2, 10), as("versand", 1, 10),
          { typ: "weiter", minuten: 25 },
          { typ: "skalieren", element: "katalog", instanzen: 6 },
          { typ: "skalieren", element: "best", instanzen: 6 },
          { typ: "skalieren", element: "lager", instanzen: 6 },
          { typ: "skalieren", element: "zahlung", instanzen: 6 },
          { typ: "weiter", minuten: 38 },
          { typ: "rollback", element: "lager" },
        ],
      }
    case "m3-zahlungsanbieter":
      return {
        aktionen: [
          { typ: "queue", verbindung: "kauf-zahlung" },
          { typ: "timeout", verbindung: "zahlung-psp", ms: 1500 },
          { typ: "retry", verbindung: "zahlung-psp", versuche: 1 },
          { typ: "circuitBreaker", verbindung: "zahlung-psp", an: true },
          { typ: "weiter", minuten: 50 },
          { typ: "skalieren", element: "zahlung", instanzen: 3 },
        ],
      }
    case "m4-ticketplattform":
      return {
        modell: m.musterloesung,
        aktionen: m4Massnahmen(m.musterloesung as ArchModell),
      }
    default:
      throw new Error(`Keine Musterstrategie für ${m.id}`)
  }
}

/** Massnahmen der Musterstrategie M4 für ein beliebiges Modell (Verbindungs-ID aus von/nach, wie sie der Editor vergibt) */
export function m4Massnahmen(modell: ArchModell): Aktion[] {
  const zp = modell.verbindungen.find((v) => v.von === "zahlung" && v.nach === "psp")?.id
  if (!zp) throw new Error("Verbindung Zahlungsservice → Zahlungsanbieter fehlt")
  return [
    as("ticket", 2, 12), as("zahlung", 1, 6),
    { typ: "timeout", verbindung: zp, ms: 2000 },
    { typ: "retry", verbindung: zp, versuche: 1 },
    { typ: "circuitBreaker", verbindung: zp, an: true },
    { typ: "weiter", minuten: 17 },
    { typ: "skalieren", element: "ticket", instanzen: 8 },
  ]
}

/**
 * Musterlösung so, wie sie aus dem Editor kommt: Verbindungs-IDs v1…vn (vorgegebene bleiben), Standard-Labels leer,
 * keine Simulationswerte, Engine-Füllfelder ("" und null); danach Bereinigung der Oberfläche (editorModellBereinigen).
 */
export function editorRohModell(m: Mission, quelle: ArchModell): unknown {
  const vorgegeben = new Set(m.modell.verbindungen.map((v) => v.id))
  let n = 0
  return JSON.parse(
    JSON.stringify({
      elemente: quelle.elemente.map(({ sim: _sim, ...e }) => ({ ...e, info: null, technologie: "", stereotyp: "" })),
      verbindungen: quelle.verbindungen.map((v) => ({ id: vorgegeben.has(v.id) ? v.id : `v${++n}`, von: v.von, nach: v.nach, art: v.art, label: "", info: "" })),
    }),
  )
}

// ---------- Mini-Missionen für Plausibilitätstests ----------

/**
 * Kleine Mission: Web → Gateway → Dienst → Datenbank, eine lesende Klasse, konstante Last.
 * `anpassen` darf das Objekt verändern (Tests bauen Varianten).
 */
export function miniMission(anpassen?: (m: Mission) => void): Mission {
  const m: Mission = {
    id: "mini",
    version: 1,
    titel: "Mini",
    untertitel: "Test",
    schwierigkeit: 1,
    art: "vorgegeben",
    gefuehrt: false,
    firma: "Test AG",
    briefing: "<p>Test</p>",
    lernziele: [{ text: "Test", station: "03-eda-message-broker" }],
    modell: {
      elemente: [
        { id: "web", typ: "web", name: "Web", x: 0, y: 0 },
        { id: "gw", typ: "gateway", name: "Gateway", x: 1, y: 0 },
        { id: "svc", typ: "dienst", name: "Dienst", x: 2, y: 0, sim: { instanzen: 1 } },
        { id: "db", typ: "datenbank", name: "DB", x: 3, y: 0 },
      ],
      verbindungen: [
        { id: "web-gw", von: "web", nach: "gw", art: "sync" },
        { id: "gw-svc", von: "gw", nach: "svc", art: "sync" },
        { id: "svc-db", von: "svc", nach: "db", art: "daten" },
      ],
    },
    anfragen: [{ id: "lesen", name: "Lesen", anteil: 1, einstieg: "web", ziele: ["svc"] }],
    last: { punkte: [{ t: 0, rps: 80 }], rauschen: 0 },
    dauer: 20,
    ereignisse: [],
    erlaubteAktionen: ["skalieren", "autoscaling", "cache", "cdn", "queue", "circuitBreaker", "timeout", "retry", "readReplica", "rateLimit", "bulkhead", "rollback"],
    budget: 100,
    slo: { p95Ms: 300, verfuegbarkeit: 0.99 },
    musterstrategie: "Test",
  }
  anpassen?.(m)
  return m
}

/**
 * Mini-Mission mit zwei Klassen über ein Gateway: «lesen» (Katalog) und «kaufen» (Kauf → Zahlung → externer Anbieter).
 * Für Kaskaden-, Timeout-, Circuit-Breaker- und Queue-Tests.
 */
export function kaskadenMission(anpassen?: (m: Mission) => void): Mission {
  return miniMission((m) => {
    m.modell = {
      elemente: [
        { id: "web", typ: "web", name: "Web", x: 0, y: 1 },
        { id: "gw", typ: "gateway", name: "Gateway", x: 1, y: 1, sim: { parallel: 200 } },
        { id: "katalog", typ: "dienst", name: "Katalog", x: 2, y: 0, sim: { instanzen: 3 } },
        { id: "kauf", typ: "dienst", name: "Kauf", x: 2, y: 1, sim: { instanzen: 2 } },
        { id: "zahlung", typ: "dienst", name: "Zahlung", x: 3, y: 1, sim: { instanzen: 2, parallel: 200 } },
        { id: "psp", typ: "extern", name: "Anbieter", x: 4, y: 1, sim: { kapazitaet: 400, parallel: 300, latenz: 200 } },
      ],
      verbindungen: [
        { id: "web-gw", von: "web", nach: "gw", art: "sync" },
        { id: "gw-katalog", von: "gw", nach: "katalog", art: "sync" },
        { id: "gw-kauf", von: "gw", nach: "kauf", art: "sync" },
        { id: "kauf-zahlung", von: "kauf", nach: "zahlung", art: "sync" },
        { id: "zahlung-psp", von: "zahlung", nach: "psp", art: "sync", sim: { timeoutMs: 10000, retries: 3 } },
      ],
    }
    m.anfragen = [
      { id: "lesen", name: "Lesen", anteil: 0.7, einstieg: "web", ziele: ["katalog"] },
      { id: "kaufen", name: "Kaufen", anteil: 0.3, einstieg: "web", ziele: ["kauf", "zahlung", "psp"], schreibend: true, kritisch: true },
    ]
    m.last = { punkte: [{ t: 0, rps: 220 }], rauschen: 0 }
    m.dauer = 30
    m.budget = 300
    anpassen?.(m)
  })
}
