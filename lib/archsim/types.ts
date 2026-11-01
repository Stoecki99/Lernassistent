// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// lib/archsim/types.ts
// Typen des Simulator-Kerns (Vertrag: docs/architektur-modell.md, Abschnitte 2, 4, 5, 9).
// Alles JSON-sicher: keine Map, Set, Date, undefined in Feldern des Zustands, keine NaN/Infinity.

// ---------- Vokabular (Abschnitt 2, 3, 5) ----------

export const ELEMENT_TYPEN = [
  "akteur", "web", "mobile",
  "cdn", "gateway", "lastverteiler", "ingress",
  "auth",
  "dienst", "monolith", "funktion", "orchestrator",
  "queue", "topic", "broker", "bus",
  "mesh",
  "datenbank", "nosql", "cache", "suche", "speicher",
  "extern",
  "knoten", "cluster", "pod", "container", "artefakt",
  "paket", "grenze", "schnittstelle",
  "filter", "peer", "plugin",
  "monitor",
] as const
export type ElementTyp = (typeof ELEMENT_TYPEN)[number]

/** Gruppen-Typen umrahmen andere Elemente (`in`), tragen selbst keine Last. */
export const GRUPPEN_TYPEN = ["knoten", "cluster", "pod", "paket", "grenze"] as const satisfies readonly ElementTyp[]

export const KATEGORIEN = ["client", "zugang", "sicherheit", "dienst", "messaging", "daten", "extern", "infrastruktur"] as const
export type Kategorie = (typeof KATEGORIEN)[number]

export const VERBINDUNGS_ARTEN = ["sync", "async", "daten", "abhaengigkeit", "realisiert", "deploy", "stream"] as const
export type VerbindungsArt = (typeof VERBINDUNGS_ARTEN)[number]

export const ELEMENT_ZUSTAENDE = ["ok", "langsam", "ausfall", "neu"] as const
export type ElementZustand = (typeof ELEMENT_ZUSTAENDE)[number]

// ---------- Modell (Abschnitt 4) ----------

/** Simulationswerte je Element (Abschnitt 9). Fehlende Felder kommen aus den Standardwerten des Typs (params.ts). */
export interface SimWerte {
  /** Anfragen pro Sekunde je Instanz (CPU-Grenze) */
  kapazitaet?: number
  /** Grundlatenz (Bedienzeit) in ms */
  latenz?: number
  /** Anzahl Instanzen (Repliken) beim Start */
  instanzen?: number
  /** Grundfehlerquote 0–1 */
  fehlerquote?: number
  /** CHF pro Stunde und Instanz */
  kostenProInstanz?: number
  /** Nur Messaging: Nachrichten, die gepuffert werden können */
  puffer?: number
  /** Ergänzung: gleichzeitig bearbeitbare Anfragen je Instanz (Threads, Verbindungen) */
  parallel?: number
  /** Ergänzung: nur Cache, Trefferquote 0–1 im warmen Zustand */
  trefferquote?: number
  /** Ergänzung: Obergrenze für Skalierung und Autoscaling */
  maxInstanzen?: number
}

export interface Steckbrief {
  was?: string
  kann?: string
  wofuer?: string
  technologie?: string
  warum?: string
}

export interface ModellElement {
  id: string
  typ: ElementTyp
  name: string
  technologie?: string
  x?: number
  y?: number
  in?: string
  stereotyp?: string
  info?: Steckbrief
  zustand?: ElementZustand
  sim?: SimWerte
}

/** Ergänzung zu Abschnitt 9: Resilienz-Einstellungen je Verbindung (Startwerte; Aktionen ändern sie im Zustand). */
export interface VerbindungSim {
  /** Timeout des Aufrufers in ms (ohne Angabe: STANDARD_TIMEOUT_MS) */
  timeoutMs?: number
  /** Wiederholungen nach einem Fehlversuch (0–5) */
  retries?: number
  circuitBreaker?: boolean
  bulkhead?: boolean
  /** Bei offenem Circuit Breaker gibt es eine Ersatzantwort (degradiert, aber erfolgreich) statt eines Fehlers */
  fallback?: boolean
}

export interface ModellVerbindung {
  id: string
  von: string
  nach: string
  art: VerbindungsArt
  label?: string
  info?: string
  sim?: VerbindungSim
}

export interface AblaufSchritt {
  von?: string
  nach?: string
  art?: VerbindungsArt
  text: string
  parallel?: boolean
  bei?: string
  fehler?: boolean
}

export interface Ablauf {
  id: string
  name: string
  schritte: AblaufSchritt[]
}

export interface ArchModell {
  titel?: string
  ansicht?: "komponenten" | "verteilung" | "kontext"
  richtung?: "rechts" | "unten"
  elemente: ModellElement[]
  verbindungen: ModellVerbindung[]
  ablaeufe?: Ablauf[]
}

// ---------- Mission ----------

/**
 * Anfrageklasse: ein Anteil der Gesamtlast, der beim Einstieg beginnt und die Ziele der Reihe nach erreicht.
 * Der Weg wird aus den Verbindungen des Modells abgeleitet (routing.ts), Datenhaltung der Dienste hängt automatisch an.
 */
export interface Anfrageklasse {
  id: string
  name: string
  /** Anteil an der Gesamtlast; alle Klassen zusammen = 1 */
  anteil: number
  einstieg: string
  ziele: string[]
  /** Schreibt Daten: umgeht Cache und Read-Replica */
  schreibend?: boolean
  /** Geschäftskritisch (z. B. Bestellung, Zahlung): Fehler zählen als «verloren» */
  kritisch?: boolean
  /** Anteil, den ein CDN direkt beantworten kann (Bilder, statische Seiten), 0–1 */
  statischAnteil?: number
}

export interface LastPunkt {
  /** Minute */
  t: number
  /** Anfragen pro Sekunde (linear zwischen den Punkten) */
  rps: number
}

export type EreignisWirkung =
  | { art: "lastspitze"; faktor: number }
  | { art: "ausfall"; element: string }
  | { art: "langsam"; element: string; faktor: number }
  | { art: "deployment"; element: string; fehlerquote: number }

export type EreignisArt = EreignisWirkung["art"]

export interface Ereignis {
  id: string
  /** Startminute */
  tick: number
  /** Dauer in Minuten */
  dauer: number
  titel: string
  text: string
  wirkung: EreignisWirkung
}

export type HinweisBedingung =
  | { tick: number }
  | { ereignis: string }
  | { auslastung: string; ueber: number }
  | { fehlerquoteUeber: number }
  | { p95Ueber: number }

export interface Hinweis {
  id: string
  wenn: HinweisBedingung
  text: string
}

export interface Lernziel {
  text: string
  /** Slug der AVSW-Station, z. B. "04-resilienz-konsistenz" */
  station: string
  /** Abschnitt (Anker) der Station, z. B. "resilienz" */
  abschnitt?: string
}

export interface PaletteEintrag {
  id: string
  typ: ElementTyp
  name: string
  technologie?: string
  /** Gehört nicht in die Lösung */
  ablenker?: boolean
  sim?: SimWerte
  info?: Steckbrief
}

interface AnforderungBasis {
  id: string
  /** Anforderung aus dem Auftrag, z. B. «Zahlungen dürfen nicht verloren gehen» */
  text: string
  /** Begründung für die Rückmeldung */
  warum: string
  station?: string
}

export type Anforderung =
  | (AnforderungBasis & { art: "element"; element: string })
  | (AnforderungBasis & { art: "pfad"; von: string; nach: string })
  | (AnforderungBasis & { art: "entkoppelt"; von: string; nach: string })
  | (AnforderungBasis & { art: "cache"; element: string })
  | (AnforderungBasis & { art: "vorgeschaltet"; einstieg: string; bis: string; typ: ElementTyp })
  | (AnforderungBasis & { art: "keineVerbindung"; von: string; nach: string })
  | (AnforderungBasis & { art: "eigeneDaten"; elemente: string[] })

export type AnforderungArt = Anforderung["art"]

export interface Slo {
  /** p95-Latenz in ms, die pro Minute nicht überschritten werden soll */
  p95Ms: number
  /** Verfügbarkeit 0–1 über die ganze Mission, z. B. 0.995 */
  verfuegbarkeit: number
}

export interface Mission {
  id: string
  version: number
  titel: string
  untertitel: string
  /** 1–3 */
  schwierigkeit: number
  /** "vorgegeben": Modell steht; "modellieren": Spieler baut das Modell aus der Palette */
  art: "vorgegeben" | "modellieren"
  /** Geführte Mission: Hinweise erscheinen im Lauf */
  gefuehrt: boolean
  firma: string
  /** Briefing als HTML-Absätze (nur feste Inhalte, keine Benutzereingaben) */
  briefing: string
  /** Nur "modellieren": Auftragstext (HTML) */
  auftrag?: string
  lernziele: Lernziel[]
  /** "vorgegeben": Startmodell; "modellieren": vorgegebener Teil (z. B. Clients, externe Dienste) */
  modell: ArchModell
  palette?: PaletteEintrag[]
  anforderungen?: Anforderung[]
  /** Musterlösung für "modellieren" (Tests, «Lösung zeigen») */
  musterloesung?: ArchModell
  anfragen: Anfrageklasse[]
  last: { punkte: LastPunkt[]; rauschen: number }
  /** Dauer in Minuten (Ticks) */
  dauer: number
  ereignisse: Ereignis[]
  erlaubteAktionen: AktionTyp[]
  /** Optional: erlaubte Ziele je Aktion (Element- oder Verbindungs-IDs) */
  aktionsZiele?: Partial<Record<AktionTyp, string[]>>
  /** Budget in CHF für Betrieb und Massnahmen über die ganze Mission */
  budget: number
  slo: Slo
  /** Kundinnen brechen nach dieser Zeit ab (Standard 10 000 ms) */
  clientTimeoutMs?: number
  hinweise?: Hinweis[]
  /** Kurzbeschreibung einer Musterstrategie (für Nachbesprechung und Lehrperson) */
  musterstrategie: string
}

// ---------- Aktionen ----------

export const AKTION_TYPEN = [
  "weiter",
  "skalieren",
  "autoscaling",
  "cache",
  "cdn",
  "queue",
  "circuitBreaker",
  "timeout",
  "retry",
  "readReplica",
  "rateLimit",
  "bulkhead",
  "rollback",
] as const
export type AktionTyp = (typeof AKTION_TYPEN)[number]

export type Aktion =
  /** Simulation um n Minuten weiterlaufen lassen */
  | { typ: "weiter"; minuten: number }
  /** Anzahl Instanzen setzen (hoch: nach Startzeit aktiv; vor dem Start und runter: sofort) */
  | { typ: "skalieren"; element: string; instanzen: number }
  | { typ: "autoscaling"; element: string; an: boolean; min?: number; max?: number }
  /** Cache vor eine Datenhaltung setzen (Cache-Aside für alle Dienste, die sie lesen) */
  | { typ: "cache"; element: string }
  /** CDN hinter einen Client (Einstieg) setzen */
  | { typ: "cdn"; element: string }
  /** Synchrone Verbindung über eine Queue entkoppeln */
  | { typ: "queue"; verbindung: string }
  | { typ: "circuitBreaker"; verbindung: string; an: boolean }
  | { typ: "timeout"; verbindung: string; ms: number }
  | { typ: "retry"; verbindung: string; versuche: number }
  | { typ: "readReplica"; element: string; anzahl: number }
  /** Höchstrate in Anfragen pro Sekunde am Element; 0 = aus */
  | { typ: "rateLimit"; element: string; proSekunde: number }
  | { typ: "bulkhead"; verbindung: string; an: boolean }
  /** Fehlerhaftes Deployment zurückrollen */
  | { typ: "rollback"; element: string }

// ---------- Zustand ----------

export type Phase = "bereit" | "laeuft" | "beendet"

export type MessZustand = "ok" | "ausgelastet" | "ueberlast" | "langsam" | "ausfall" | "fehlerhaft" | "leer"

/** Messung eines Elements in der letzten Minute (für Einfärbung und Steckbrief der Oberfläche) */
export interface ElementMessung {
  /** angebotene Last in Anfragen pro Sekunde */
  last: number
  /** Auslastung ρ (CPU oder Threads, der höhere Wert) */
  auslastung: number
  /** eigene Antwortzeit in ms (Bedienzeit + Warteschlange) */
  latenzMs: number
  /** Anteil abgewiesener oder fehlerhafter Anfragen an diesem Element */
  fehlerquote: number
  zustand: MessZustand
}

export interface ElementLaufzeit {
  /** aktive Instanzen */
  instanzen: number
  /** Instanzen im Start: aktiv ab Minute `ab` */
  geplant: { ab: number; anzahl: number }[]
  autoscaling: { min: number; max: number } | null
  /** Minuten in Folge mit tiefer Auslastung (für Abbau durch Autoscaling) */
  tiefSeit: number
  replikate: number
  /** Rate Limit in Anfragen/s, 0 = aus */
  rateLimit: number
  /** Minute, ab der das Element besteht (Cache-Aufwärmen) */
  seit: number
  messung: ElementMessung
}

export type CbStatus = "zu" | "offen" | "halboffen"

export interface VerbindungLaufzeit {
  timeoutMs: number
  retries: number
  circuitBreaker: boolean
  cbStatus: CbStatus
  /** offen bis (exklusiv) Minute */
  cbBis: number
  bulkhead: boolean
  fallback: boolean
}

/** Gemessene Werte eines Aufrufknotens aus der Vorminute (für Rückkopplung: Retries, Threads, Puffer) */
export interface KnotenSpeicher {
  /** Fehlerwahrscheinlichkeit eines einzelnen Versuchs über die Kante (inkl. Timeout) */
  q: number
  /** mittlere Gesamtzeit auf der Kante je Aufruf inkl. Wiederholungen, ms */
  zeit: number
  /** Erfolgswahrscheinlichkeit des Teilbaums */
  s: number
}

export interface EreignisStatus {
  status: "geplant" | "aktiv" | "behoben" | "vorbei"
}

export interface Summen {
  angefragt: number
  erfolgreich: number
  degradiert: number
  fehler: number
  abgewiesen: number
  kritischAngefragt: number
  kritischVerloren: number
  nachrichten: number
  nachrichtenVerloren: number
}

export interface KennzahlPunkt {
  /** Minute */
  t: number
  /** angebotene Last, Anfragen/s */
  last: number
  /** erfolgreich beantwortete Anfragen/s (inkl. degradiert) */
  durchsatz: number
  /** Anteil fehlgeschlagener Anfragen 0–1 */
  fehlerquote: number
  /** Anteil erfolgreicher Anfragen 0–1 */
  verfuegbarkeit: number
  /** Latenz der erfolgreichen Anfragen in ms; null, wenn keine Anfrage erfolgreich war */
  p50: number | null
  p95: number | null
  /** Betriebskosten in CHF pro Stunde */
  kostenRate: number
  /** Kosten kumuliert (Betrieb + Massnahmen) in CHF */
  kosten: number
  /** gepufferte Nachrichten in allen Queues */
  rueckstau: number
  /** kritische Vorgänge verloren, kumuliert */
  verloren: number
  /** Anteil degradierter Antworten (Fallback) 0–1 */
  degradiert: number
  sloOk: boolean
  /** Element mit der höchsten Auslastung ≥ 0.85, sonst null */
  engpass: string | null
  /** Elemente mit CPU-Auslastung > 1 (mehr Last als Kapazität), sortiert */
  ueberlastet: string[]
  /** Elemente, deren Threads erschöpft sind (Warten auf langsame Aufrufe), sortiert */
  threadsErschoepft: string[]
  /** am stärksten ausgelastetes Element (CPU oder Threads) */
  auslastungMax: { element: string; wert: number } | null
  /** Verbindung, auf der Wiederholungen die Last mindestens um die Hälfte erhöhen, sonst null */
  retrySturm: string | null
  /** Verbindungen mit offenem Circuit Breaker */
  cbOffen: string[]
  /** aktive Ereignisse */
  ereignisse: string[]
}

export interface ProtokollEintrag {
  tick: number
  aktion: Aktion
}

export interface Zustand {
  version: number
  missionId: string
  missionVersion: number
  seed: number
  rng: number
  /** nächste zu simulierende Minute (0 … dauer) */
  tick: number
  phase: Phase
  /** aktuelles Modell inkl. der durch Aktionen eingefügten Elemente (Cache, CDN, Queue) */
  modell: ArchModell
  elemente: Record<string, ElementLaufzeit>
  verbindungen: Record<string, VerbindungLaufzeit>
  knoten: Record<string, KnotenSpeicher>
  /** gepufferte Nachrichten je Konsumenten-Knoten */
  puffer: Record<string, number>
  ereignisse: Record<string, EreignisStatus>
  kosten: { betrieb: number; massnahmen: number }
  summen: Summen
  verlauf: KennzahlPunkt[]
  /** angewendete Aktionen ohne «weiter» */
  protokoll: ProtokollEintrag[]
  /** ausgelöste Hinweise (geführte Missionen) */
  hinweise: { id: string; tick: number }[]
}

// ---------- Auswertung ----------

export interface Gesamtkennzahlen {
  verfuegbarkeit: number
  fehlerquote: number
  p50Median: number | null
  p95Median: number | null
  p95Max: number | null
  /** Anteil Minuten mit eingehaltenem SLO */
  sloQuote: number
  durchsatzMittel: number
  kosten: number
  kostenBetrieb: number
  kostenMassnahmen: number
  budget: number
  rueckstauEnde: number
  rueckstauMax: number
  kritischVerloren: number
  /** verlorene kritische Vorgänge ÷ kritische Anfragen */
  verlorenQuote: number
  nachrichtenVerloren: number
  degradiertQuote: number
}

export interface ScoreTeil {
  id: "verfuegbarkeit" | "latenz" | "slo" | "kosten" | "daten" | "anforderungen"
  name: string
  punkte: number
  max: number
  erklaerung: string
}

export interface Score {
  total: number
  sterne: 0 | 1 | 2 | 3
  teile: ScoreTeil[]
  schwellen: readonly [number, number, number]
}

export type ZeitachsenArt = "ereignis" | "aktion" | "stoerung" | "erholung" | "retrysturm" | "circuitbreaker" | "verlust"

export interface ZeitachsenEintrag {
  tick: number
  art: ZeitachsenArt
  titel: string
  ursache: string
  wirkung: string
}

export interface Lehre {
  id: string
  titel: string
  text: string
  haetteGeholfen: string
  /** Link auf die Lernstation, z. B. /lernseiten/avsw/04-resilienz-konsistenz#resilienz */
  link: string
  station: string
  positiv: boolean
}

export interface Nachbesprechung {
  zusammenfassung: string
  zeitachse: ZeitachsenEintrag[]
  lehren: Lehre[]
  lernziele: { text: string; link: string }[]
}

export interface AnforderungErgebnis {
  id: string
  text: string
  erfuellt: boolean
  rueckmeldung: string
}

export interface ValidierungsErgebnis {
  /** Struktur in Ordnung und alle Anfrageklassen kommen an: Lasttest startbar */
  gueltig: boolean
  fehler: string[]
  hinweise: string[]
  anforderungen: AnforderungErgebnis[]
}

export interface Ergebnis {
  zustand: Zustand
  kennzahlen: Gesamtkennzahlen
  score: Score
  nachbesprechung: Nachbesprechung
  validierung: ValidierungsErgebnis | null
}
