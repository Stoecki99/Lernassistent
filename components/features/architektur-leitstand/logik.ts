// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// components/features/architektur-leitstand/logik.ts
// Reine Hilfen der Oberfläche (ohne React, ohne Browser): Kennzahl-Kacheln mit SLO-Ampel, Massnahmen-Katalog,
// mögliche Ziele je Massnahme, Rückstau je Queue, Nachrichtenfluss je Verbindung, Zeitreise (Zustand bei Minute),
// Bereinigung des Editor-Modells. Geprüft in tests/architektur-leitstand-ui.test.ts.

import {
  ArchSimFehler,
  KATEGORIE_VON,
  MASSNAHMEN_KOSTEN,
  THEMEN,
  planFuer,
  pruefeAktion,
  starte,
  stationsLink,
  wendeAn,
  werteFuer,
  type Aktion,
  type AktionTyp,
  type ArchModell,
  type ElementTyp,
  type Kategorie,
  type KennzahlPunkt,
  type MessZustand,
  type Mission,
  type ModellElement,
  type ModellVerbindung,
  type Zustand,
} from "@/lib/archsim"

// ---------- Formate (Schweizer Schreibweise) ----------

export function zahl(x: number, stellen = 0): string {
  return x.toLocaleString("de-CH", { minimumFractionDigits: stellen, maximumFractionDigits: stellen })
}
export function prozent(x: number, stellen = 1): string {
  return `${zahl(x * 100, stellen)} %`
}
export function ms(x: number | null): string {
  if (x === null) return "–"
  return x >= 10000 ? `${zahl(x / 1000, 1)} s` : `${zahl(Math.round(x))} ms`
}
export function chf(x: number): string {
  return `${zahl(Math.round(x))} CHF`
}
export function minuteText(t: number): string {
  return `Minute ${t}`
}

// ---------- Ampel ----------

export type Ampel = "gut" | "knapp" | "schlecht" | "neutral"
export const AMPEL_FORM: Record<Ampel, string> = { gut: "●", knapp: "▲", schlecht: "■", neutral: "○" }

export interface Kachel {
  id: "verfuegbarkeit" | "p95" | "fehler" | "durchsatz" | "kosten" | "rueckstau"
  titel: string
  wert: string
  /** Zusatzzeile (Ziel, jetzt, Prognose) */
  unter: string
  ampel: Ampel
  /** Ampelwort, z. B. «im Ziel» */
  ampelText: string
  reihe: number[]
  hilfe: string
}

/** Verfügbarkeit bisher (erfolgreich ÷ angefragt), 1 ohne Anfragen */
export function verfuegbarkeitBisher(z: Zustand): number {
  return z.summen.angefragt > 0 ? z.summen.erfolgreich / z.summen.angefragt : 1
}

/** Kosten am Ende, wenn die aktuelle Kostenrate bleibt */
export function kostenPrognose(mission: Mission, z: Zustand): number {
  const letzter = z.verlauf[z.verlauf.length - 1]
  const kosten = z.kosten.betrieb + z.kosten.massnahmen
  const rate = letzter?.kostenRate ?? 0
  return kosten + (rate / 60) * Math.max(0, mission.dauer - z.tick)
}

/** true, wenn der Rückstau in den letzten Minuten gewachsen ist */
function rueckstauWaechst(v: KennzahlPunkt[]): boolean {
  if (v.length < 3) return false
  const a = v[v.length - 3].rueckstau
  const b = v[v.length - 1].rueckstau
  return b > a + 50
}

export function kacheln(mission: Mission, z: Zustand): Kachel[] {
  const v = z.verlauf
  const p = v[v.length - 1]
  const slo = mission.slo
  const fehlerZiel = 1 - slo.verfuegbarkeit

  const verfBisher = verfuegbarkeitBisher(z)
  const verfAmpel: Ampel = v.length === 0 ? "neutral" : verfBisher >= slo.verfuegbarkeit ? "gut" : verfBisher >= slo.verfuegbarkeit - 0.02 ? "knapp" : "schlecht"

  const p95 = p ? p.p95 : null
  const p95Ampel: Ampel = !p ? "neutral" : p95 === null ? "schlecht" : p95 <= slo.p95Ms ? "gut" : p95 <= slo.p95Ms * 1.5 ? "knapp" : "schlecht"

  const fq = p ? p.fehlerquote : 0
  const fehlerAmpel: Ampel = !p ? "neutral" : fq <= fehlerZiel ? "gut" : fq <= Math.max(0.05, fehlerZiel * 5) ? "knapp" : "schlecht"

  const kosten = z.kosten.betrieb + z.kosten.massnahmen
  const prognose = kostenPrognose(mission, z)
  const kostenAmpel: Ampel = prognose <= mission.budget * 0.9 ? "gut" : prognose <= mission.budget ? "knapp" : "schlecht"

  const verlorenQuote = z.summen.kritischAngefragt > 0 ? z.summen.kritischVerloren / z.summen.kritischAngefragt : 0
  const rueckstau = p ? p.rueckstau : 0
  const rueckAmpel: Ampel = verlorenQuote > 0.01 ? "schlecht" : rueckstauWaechst(v) || verlorenQuote > 0.001 ? "knapp" : v.length === 0 ? "neutral" : "gut"

  const text = (a: Ampel, gut: string, knapp: string, schlecht: string): string =>
    a === "gut" ? gut : a === "knapp" ? knapp : a === "schlecht" ? schlecht : "noch keine Messung"

  return [
    {
      id: "verfuegbarkeit",
      titel: "Verfügbarkeit",
      wert: v.length ? prozent(verfBisher, 2) : "–",
      unter: `Ziel ≥ ${prozent(slo.verfuegbarkeit, 1)}${p ? ` · jetzt ${prozent(p.verfuegbarkeit, 1)}` : ""}`,
      ampel: verfAmpel,
      ampelText: text(verfAmpel, "im Ziel", "knapp verfehlt", "verletzt"),
      reihe: v.map((x) => x.verfuegbarkeit * 100),
      hilfe: "Anteil erfolgreich beantworteter Anfragen über die ganze Mission bisher. Das SLO gilt für die ganze Mission.",
    },
    {
      id: "p95",
      titel: "Antwortzeit p95",
      wert: p ? ms(p95) : "–",
      unter: `Ziel ≤ ${ms(slo.p95Ms)}${p ? ` · p50 ${ms(p.p50)}` : ""}`,
      ampel: p95Ampel,
      ampelText: text(p95Ampel, "im Ziel", "zu langsam", p95 === null && p ? "keine Antwort" : "viel zu langsam"),
      reihe: v.map((x) => x.p95 ?? slo.p95Ms * 3),
      hilfe: "95 % der erfolgreichen Anfragen der letzten Minute waren schneller als dieser Wert. Steigt stark, sobald ein Element über rund 80 % ausgelastet ist.",
    },
    {
      id: "fehler",
      titel: "Fehlerquote",
      wert: p ? prozent(fq, fq < 0.01 ? 2 : 1) : "–",
      unter: p ? `${zahl(Math.round((p.last * 60 - p.durchsatz * 60)))} Fehler in der letzten Minute` : "abgewiesen, Timeout oder Fehler",
      ampel: fehlerAmpel,
      ampelText: text(fehlerAmpel, "tief", "erhöht", "hoch"),
      reihe: v.map((x) => x.fehlerquote * 100),
      hilfe: "Anteil der Anfragen der letzten Minute, die scheiterten: Timeout, Überlast, Ausfall, Rate Limit oder Fehler einer Abhängigkeit.",
    },
    {
      id: "durchsatz",
      titel: "Durchsatz",
      wert: p ? `${zahl(p.durchsatz)} /s` : "–",
      unter: p ? `Last ${zahl(p.last)} Anfragen/s` : "erfolgreiche Anfragen pro Sekunde",
      ampel: "neutral",
      ampelText: "Information",
      reihe: v.map((x) => x.durchsatz),
      hilfe: "Erfolgreich beantwortete Anfragen pro Sekunde (inkl. Ersatzantworten). Liegt er unter der Last, gehen Anfragen verloren.",
    },
    {
      id: "kosten",
      titel: "Kosten",
      wert: chf(kosten),
      unter: `Prognose ${chf(prognose)} von ${chf(mission.budget)}`,
      ampel: kostenAmpel,
      ampelText: text(kostenAmpel, "im Budget", "knapp", "über Budget"),
      reihe: v.map((x) => x.kosten),
      hilfe: "Betrieb (Instanzen × CHF/h) und Einmalkosten der Massnahmen. Prognose: so viel kostet es am Ende, wenn alles bleibt, wie es ist.",
    },
    {
      id: "rueckstau",
      titel: "Rückstau",
      wert: p ? zahl(rueckstau) : "–",
      unter: `verloren: ${zahl(Math.round(z.summen.kritischVerloren))} kritische Vorgänge`,
      ampel: rueckAmpel,
      ampelText: text(rueckAmpel, "unter Kontrolle", rueckstauWaechst(v) ? "wächst" : "Verluste", "Verluste"),
      reihe: v.map((x) => x.rueckstau),
      hilfe: "Nachrichten, die in Queues auf Verarbeitung warten. Ein Puffer fängt Spitzen ab; wächst er dauernd, fehlt Kapazität beim Konsumenten. Verloren = gescheiterte kritische Vorgänge (z. B. Zahlungen).",
    },
  ]
}

// ---------- Element-Zustände ----------

export const MESS_ZUSTAND: Record<MessZustand, { text: string; symbol: string }> = {
  ok: { text: "läuft", symbol: "●" },
  ausgelastet: { text: "ausgelastet", symbol: "▲" },
  ueberlast: { text: "überlastet", symbol: "■" },
  langsam: { text: "langsam", symbol: "◔" },
  ausfall: { text: "ausgefallen", symbol: "⚡" },
  fehlerhaft: { text: "fehlerhaft", symbol: "✗" },
  leer: { text: "ohne Last", symbol: "○" },
}

/** Zustand für setzeZustand der Engine: nur «ausfall» und «ok» (die übrigen Zustände färbt die Oberfläche selbst) */
export function engineZustand(z: MessZustand): "ok" | "ausfall" {
  return z === "ausfall" ? "ausfall" : "ok"
}

const GRUPPEN = new Set<ElementTyp>(["knoten", "cluster", "pod", "paket", "grenze"])

export function istGruppe(e: ModellElement): boolean {
  return GRUPPEN.has(e.typ)
}

export function kategorieVon(e: ModellElement | undefined): Kategorie | null {
  return e ? KATEGORIE_VON[e.typ] : null
}

/** Trägt Last mit begrenzter Kapazität (hat Auslastung) */
export function hatKapazitaet(e: ModellElement): boolean {
  const w = werteFuer(e.typ, e.sim)
  return w.traegtLast && !w.unbegrenzt
}

// ---------- Rückstau je Queue ----------

export interface Puffer {
  nachrichten: number
  /** Füllstand 0–1 (gepuffert ÷ Puffergrösse × Instanzen) */
  anteil: number
}

/** Gepufferte Nachrichten je Messaging-Element (über die Konsumenten-Knoten des Lastplans) */
export function rueckstauJeElement(mission: Mission, z: Zustand): Record<string, Puffer> {
  const out: Record<string, Puffer> = {}
  let plan
  try {
    plan = planFuer(mission.anfragen, z.modell)
  } catch {
    return out
  }
  for (const k of plan.knoten) {
    if (k.rolle !== "konsum" || k.parent < 0) continue
    const q = plan.knoten[k.parent]?.element
    if (!q) continue
    const n = z.puffer[k.key] ?? 0
    out[q] = { nachrichten: (out[q]?.nachrichten ?? 0) + n, anteil: 0 }
  }
  for (const [id, p] of Object.entries(out)) {
    const el = z.modell.elemente.find((e) => e.id === id)
    if (!el) continue
    const kap = werteFuer(el.typ, el.sim).puffer * Math.max(1, z.elemente[id]?.instanzen ?? 1)
    p.anteil = kap > 0 ? Math.min(1, p.nachrichten / kap) : 0
  }
  return out
}

// ---------- Nachrichtenfluss ----------

export interface Fluss {
  /** 0 = kein Fluss, 1–3 = wenig bis viel */
  stufe: 0 | 1 | 2 | 3
  /** Zustand am Ziel: ok, gestresst (ausgelastet, langsam), gestoert (Überlast, Ausfall, Fehler, offener CB) */
  lage: "ok" | "gestresst" | "gestoert"
}

const STRESS = new Set<MessZustand>(["ausgelastet", "langsam"])
const STOERUNG = new Set<MessZustand>(["ueberlast", "ausfall", "fehlerhaft"])

function stufeFuer(rps: number): Fluss["stufe"] {
  if (rps <= 0.01) return 0
  if (rps < 40) return 1
  if (rps < 400) return 2
  return 3
}

/** Fluss je Verbindung: genutzte Kanten des Lastplans, Stärke nach der Last am Ziel, Farbe nach dessen Zustand */
export function flussJeVerbindung(mission: Mission, z: Zustand): Record<string, Fluss> {
  const out: Record<string, Fluss> = {}
  if (z.verlauf.length === 0) return out
  const genutzt = new Set<string>()
  try {
    for (const k of planFuer(mission.anfragen, z.modell).knoten) if (k.kante) genutzt.add(k.kante)
  } catch {
    return out
  }
  const einstiege = new Set(mission.anfragen.map((a) => a.einstieg))
  const last = z.verlauf[z.verlauf.length - 1].last
  for (const v of z.modell.verbindungen) {
    const zum = z.elemente[v.nach]?.messung
    // Nutzerin → Client trägt die ganze Last, auch wenn der Lastplan erst beim Client beginnt
    const zumEinstieg = einstiege.has(v.nach) && kategorieVon(z.modell.elemente.find((e) => e.id === v.von)) === "client"
    if (!genutzt.has(v.id) && !zumEinstieg) continue
    const rps = zumEinstieg ? last : zum?.last ?? 0
    const cb = z.verbindungen[v.id]
    const offen = !!cb && cb.circuitBreaker && cb.cbStatus === "offen"
    const zust = zum?.zustand ?? "ok"
    out[v.id] = {
      stufe: offen ? 1 : stufeFuer(rps),
      lage: offen || STOERUNG.has(zust) ? "gestoert" : STRESS.has(zust) ? "gestresst" : "ok",
    }
  }
  return out
}

// ---------- Massnahmen ----------

export type ZielArt = "element" | "verbindung"

export interface MassnahmeInfo {
  typ: Exclude<AktionTyp, "weiter">
  titel: string
  /** Wirkung in einem Satz */
  wirkung: string
  /** Wann sinnvoll */
  wann: string
  ziel: ZielArt
  symbol: string
  einmalkosten: number
  link: string
}

const link = (t: { station: string; abschnitt?: string }) => stationsLink(t.station, "abschnitt" in t ? t.abschnitt : undefined)

export const MASSNAHMEN: Record<Exclude<AktionTyp, "weiter">, MassnahmeInfo> = {
  skalieren: {
    typ: "skalieren", titel: "Skalieren", symbol: "⧉", ziel: "element", einmalkosten: MASSNAHMEN_KOSTEN.skalieren, link: link(THEMEN.skalieren),
    wirkung: "Mehr Instanzen teilen sich die Last. Neue Instanzen sind nach 2 Minuten bereit und kosten laufend.",
    wann: "Ein zustandsloser Dienst ist über 75 % ausgelastet.",
  },
  autoscaling: {
    typ: "autoscaling", titel: "Autoscaling", symbol: "⇅", ziel: "element", einmalkosten: MASSNAHMEN_KOSTEN.autoscaling, link: link(THEMEN.skalieren),
    wirkung: "Startet ab 75 % Auslastung selbst neue Instanzen (Ziel 60 %) und baut bei Flaute ab. Reagiert mit rund 3 Minuten Verzögerung.",
    wann: "Die Last schwankt; du willst nicht dauernd von Hand skalieren.",
  },
  cache: {
    typ: "cache", titel: "Cache davor", symbol: "⚡", ziel: "element", einmalkosten: MASSNAHMEN_KOSTEN.cache, link: link(THEMEN.caching),
    wirkung: "Fängt Lesezugriffe auf eine Datenhaltung ab (rund 85 % Treffer, nach 3 Minuten warm). Schreiben geht weiter an die Datenbank.",
    wann: "Eine Datenbank ist der Engpass und wird vor allem gelesen.",
  },
  cdn: {
    typ: "cdn", titel: "CDN", symbol: "◎", ziel: "element", einmalkosten: MASSNAHMEN_KOSTEN.cdn, link: link(THEMEN.caching),
    wirkung: "Liefert Bilder und statische Seiten nah bei den Nutzenden aus; nur der Rest erreicht deine Dienste.",
    wann: "Viele Anfragen holen statische Inhalte.",
  },
  queue: {
    typ: "queue", titel: "Queue dazwischen", symbol: "▤", ziel: "verbindung", einmalkosten: MASSNAHMEN_KOSTEN.queue, link: link(THEMEN.messaging),
    wirkung: "Entkoppelt einen Aufruf: Der Aufrufer wartet nicht mehr, Aufträge werden gepuffert statt verloren.",
    wann: "Ein kritischer Vorgang darf nicht verloren gehen, auch wenn der Empfänger klemmt.",
  },
  circuitBreaker: {
    typ: "circuitBreaker", titel: "Circuit Breaker", symbol: "⊘", ziel: "verbindung", einmalkosten: MASSNAHMEN_KOSTEN.circuitBreaker, link: link(THEMEN.resilienz),
    wirkung: "Unterbricht Aufrufe an eine gestörte Abhängigkeit ab 50 % Fehlern, damit Threads frei bleiben. Nach 2 Minuten folgen Probeaufrufe.",
    wann: "Eine Abhängigkeit ist langsam oder fällt aus und reisst den Aufrufer mit.",
  },
  timeout: {
    typ: "timeout", titel: "Timeout", symbol: "⏱", ziel: "verbindung", einmalkosten: MASSNAHMEN_KOSTEN.timeout, link: link(THEMEN.resilienz),
    wirkung: "So lange wartet der Aufrufer höchstens. Kurz = Threads schnell wieder frei, zu kurz = unnötige Fehler.",
    wann: "Ein Aufruf hängt viel länger, als eine Kundin warten würde.",
  },
  retry: {
    typ: "retry", titel: "Wiederholungen", symbol: "↻", ziel: "verbindung", einmalkosten: MASSNAHMEN_KOSTEN.retry, link: link(THEMEN.resilienz),
    wirkung: "Versucht fehlgeschlagene Aufrufe erneut. Hilft bei kurzen Aussetzern, verschlimmert Überlast (Retry-Sturm).",
    wann: "Einzelne Aufrufe scheitern zufällig, die Gegenseite hat Reserve.",
  },
  readReplica: {
    typ: "readReplica", titel: "Read-Replica", symbol: "⧈", ziel: "element", einmalkosten: MASSNAHMEN_KOSTEN.readReplica, link: link(THEMEN.caching),
    wirkung: "Lesekopie der Datenbank: Lesezugriffe verteilen sich, Schreiben bleibt beim Original. Kostet laufend wie eine Instanz.",
    wann: "Eine relationale Datenbank ist mit Lesen ausgelastet.",
  },
  rateLimit: {
    typ: "rateLimit", titel: "Rate Limiting", symbol: "⛉", ziel: "element", einmalkosten: MASSNAHMEN_KOSTEN.rateLimit, link: link(THEMEN.gateway),
    wirkung: "Weist Anfragen über einer Höchstrate am Eingang sofort ab und schützt die Dienste dahinter vor dem Kollaps.",
    wann: "Mehr Last kommt, als das System je verkraften kann.",
  },
  bulkhead: {
    typ: "bulkhead", titel: "Bulkhead", symbol: "▥", ziel: "verbindung", einmalkosten: MASSNAHMEN_KOSTEN.bulkhead, link: link(THEMEN.resilienz),
    wirkung: "Gibt einem Aufruf nur 25 % der Threads. Eine hängende Abhängigkeit blockiert dann nicht mehr alle anderen Anfragen.",
    wann: "Ein Aufrufer bedient mehrere Abhängigkeiten, und eine davon klemmt.",
  },
  rollback: {
    typ: "rollback", titel: "Rollback", symbol: "⎌", ziel: "element", einmalkosten: MASSNAHMEN_KOSTEN.rollback, link: link(THEMEN.skalieren),
    wirkung: "Rollt ein fehlerhaftes Deployment auf die letzte gute Version zurück.",
    wann: "Seit einem Deployment steigt die Fehlerquote eines Dienstes.",
  },
}

/** Erlaubte Massnahmen der Mission in fester Reihenfolge */
export function erlaubteMassnahmen(mission: Mission): MassnahmeInfo[] {
  const reihenfolge = Object.keys(MASSNAHMEN) as Array<keyof typeof MASSNAHMEN>
  return reihenfolge.filter((t) => mission.erlaubteAktionen.includes(t)).map((t) => MASSNAHMEN[t])
}

const AUFRUF_ARTEN = new Set(["sync", "abhaengigkeit", "daten"])
const DATENHALTUNG = new Set<ElementTyp>(["datenbank", "nosql", "suche", "speicher"])

/** Passt die Massnahme grundsätzlich zum Ziel (Typ, Art)? Ob sie gerade geht, sagt pruefeAktion. */
export function passtZu(typ: MassnahmeInfo["typ"], mission: Mission, modell: ArchModell, zielId: string): boolean {
  const vorgesehen = mission.aktionsZiele?.[typ]
  if (vorgesehen && !vorgesehen.includes(zielId)) return false
  const els = modell.elemente
  if (MASSNAHMEN[typ].ziel === "element") {
    const e = els.find((x) => x.id === zielId)
    if (!e || istGruppe(e)) return false
    const w = werteFuer(e.typ, e.sim)
    switch (typ) {
      case "skalieren":
      case "autoscaling":
        return w.traegtLast && !w.unbegrenzt && w.maxInstanzen > 1
      case "cache":
        return DATENHALTUNG.has(e.typ)
      case "cdn":
        return KATEGORIE_VON[e.typ] === "client" && modell.verbindungen.some((v) => v.von === e.id && v.art !== "deploy" && v.art !== "realisiert")
      case "readReplica":
        return e.typ === "datenbank"
      case "rateLimit":
        return KATEGORIE_VON[e.typ] === "zugang" && e.typ !== "cdn"
      case "rollback":
        return mission.ereignisse.some((x) => x.wirkung.art === "deployment" && x.wirkung.element === e.id)
      default:
        return false
    }
  }
  const v = modell.verbindungen.find((x) => x.id === zielId)
  if (!v || !AUFRUF_ARTEN.has(v.art)) return false
  if (typ === "queue") {
    const nach = els.find((x) => x.id === v.nach)
    const von = els.find((x) => x.id === v.von)
    return v.art !== "daten" && KATEGORIE_VON[nach?.typ ?? "akteur"] !== "daten" && KATEGORIE_VON[von?.typ ?? "akteur"] !== "client"
  }
  return true
}

/** Ziel-Instanzen nach allen Starts */
export function zielInstanzen(z: Zustand, id: string): number {
  const rt = z.elemente[id]
  if (!rt) return 0
  return rt.instanzen + rt.geplant.reduce((s, g) => s + g.anzahl, 0)
}

export function maxInstanzen(z: Zustand, id: string): number {
  const e = z.modell.elemente.find((x) => x.id === id)
  return e ? werteFuer(e.typ, e.sim).maxInstanzen : 1
}

/** Aktion mit sinnvollem Standardwert (für Vorschlag und Prüfung) */
export function standardAktion(typ: MassnahmeInfo["typ"], ziel: string, z: Zustand): Aktion {
  const rt = z.elemente[ziel]
  const vt = z.verbindungen[ziel]
  switch (typ) {
    case "skalieren":
      return { typ, element: ziel, instanzen: Math.min(maxInstanzen(z, ziel), Math.max(1, zielInstanzen(z, ziel) + 1)) }
    case "autoscaling":
      return rt?.autoscaling
        ? { typ, element: ziel, an: false }
        : { typ, element: ziel, an: true, min: Math.max(1, zielInstanzen(z, ziel)), max: Math.min(maxInstanzen(z, ziel), Math.max(2, zielInstanzen(z, ziel) * 4)) }
    case "cache":
    case "cdn":
    case "rollback":
      return { typ, element: ziel }
    case "readReplica":
      return { typ, element: ziel, anzahl: Math.min(5, (rt?.replikate ?? 0) + 1) }
    case "rateLimit":
      return { typ, element: ziel, proSekunde: rt?.rateLimit ? 0 : 500 }
    case "queue":
      return { typ, verbindung: ziel }
    case "circuitBreaker":
      return { typ, verbindung: ziel, an: !(vt?.circuitBreaker ?? false) }
    case "bulkhead":
      return { typ, verbindung: ziel, an: !(vt?.bulkhead ?? false) }
    case "timeout":
      return { typ, verbindung: ziel, ms: 2000 }
    case "retry":
      return { typ, verbindung: ziel, versuche: (vt?.retries ?? 0) > 1 ? 1 : 0 }
  }
}

/** Grund, warum eine Aktion gerade nicht geht (Meldung des Kerns), oder null */
export function sperrGrund(mission: Mission, z: Zustand, a: Aktion): string | null {
  try {
    pruefeAktion(mission, z, a)
    return null
  } catch (e) {
    return e instanceof ArchSimFehler ? e.message : "Diese Massnahme geht gerade nicht."
  }
}

export interface ZielOption {
  id: string
  name: string
  /** null = möglich */
  grund: string | null
}

export function verbindungsName(modell: ArchModell, v: ModellVerbindung): string {
  const n = (id: string) => modell.elemente.find((e) => e.id === id)?.name ?? id
  return `${n(v.von)} → ${n(v.nach)}`
}

/** Mögliche Ziele einer Massnahme im aktuellen Modell, mit Sperrgrund */
export function zieleFuer(mission: Mission, z: Zustand, typ: MassnahmeInfo["typ"]): ZielOption[] {
  const info = MASSNAHMEN[typ]
  const kandidaten =
    info.ziel === "element"
      ? z.modell.elemente.filter((e) => passtZu(typ, mission, z.modell, e.id)).map((e) => ({ id: e.id, name: e.name }))
      : z.modell.verbindungen.filter((v) => passtZu(typ, mission, z.modell, v.id)).map((v) => ({ id: v.id, name: verbindungsName(z.modell, v) }))
  return kandidaten.map((k) => ({ ...k, grund: sperrGrund(mission, z, standardAktion(typ, k.id, z)) }))
}

/** Massnahmen für ein gewähltes Element (eigene) und seine ausgehenden Aufrufe */
export function massnahmenFuerElement(mission: Mission, z: Zustand, id: string): { eigene: MassnahmeInfo[]; aufrufe: ModellVerbindung[] } {
  const eigene = erlaubteMassnahmen(mission).filter((m) => m.ziel === "element" && passtZu(m.typ, mission, z.modell, id))
  const kantenTypen = erlaubteMassnahmen(mission).filter((m) => m.ziel === "verbindung")
  const aufrufe = z.modell.verbindungen.filter((v) => v.von === id && kantenTypen.some((m) => passtZu(m.typ, mission, z.modell, v.id)))
  return { eigene, aufrufe }
}

export function massnahmenFuerVerbindung(mission: Mission, z: Zustand, id: string): MassnahmeInfo[] {
  return erlaubteMassnahmen(mission).filter((m) => m.ziel === "verbindung" && passtZu(m.typ, mission, z.modell, id))
}

/** Laufende Kosten einer Instanz in CHF/h */
export function kostenProInstanz(z: Zustand, id: string): number {
  const e = z.modell.elemente.find((x) => x.id === id)
  return e ? werteFuer(e.typ, e.sim).kostenProInstanz : 0
}

// ---------- Ereignisse und Hinweise ----------

/** Ereignisse, die zwischen zwei Zuständen aktiv geworden sind */
export function neueEreignisse(vorher: Zustand, nachher: Zustand): string[] {
  return Object.keys(nachher.ereignisse).filter((id) => nachher.ereignisse[id].status === "aktiv" && vorher.ereignisse[id]?.status !== "aktiv")
}

export function neueHinweise(vorher: Zustand, nachher: Zustand): string[] {
  const alt = new Set(vorher.hinweise.map((h) => h.id))
  return nachher.hinweise.filter((h) => !alt.has(h.id)).map((h) => h.id)
}

// ---------- Zeitreise ----------

/**
 * Zustand bei Minute t (nach t simulierten Minuten), aus Startwert und Protokoll nachgespielt.
 * «weiter» wird an der Grenze geteilt; Massnahmen an Minute t sind schon angewendet.
 */
export function zustandBei(mission: Mission, seed: number, aktionen: Aktion[], modell: ArchModell | undefined, minute: number): Zustand {
  let z = starte(mission, seed, mission.art === "modellieren" ? modell : undefined)
  for (const a of aktionen) {
    if (z.phase === "beendet") break
    if (a.typ === "weiter") {
      const rest = minute - z.tick
      if (rest <= 0) break
      z = wendeAn(mission, z, { typ: "weiter", minuten: Math.min(rest, a.minuten) })
      if (a.minuten > rest) break
    } else {
      if (z.tick > minute) break
      z = wendeAn(mission, z, a)
    }
  }
  if (z.tick < minute && z.phase !== "beendet") z = wendeAn(mission, z, { typ: "weiter", minuten: Math.min(mission.dauer, minute) - z.tick })
  return z
}

// ---------- Modell aus dem Editor ----------

const ENTITAETEN: Record<string, string> = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'" }

function ohneTags(s: string): string {
  return s.replace(/<[^>]*>/g, "").replace(/&(amp|lt|gt|quot|#39);/g, (m) => ENTITAETEN[m] ?? m).replace(/\s+/g, " ").trim()
}

function text(s: unknown, max: number): string | undefined {
  if (typeof s !== "string") return undefined
  const t = ohneTags(s).slice(0, max)
  return t.length > 0 ? t : undefined
}

/**
 * Modell aus Architektur.editor().modell() in die Form des Kerns bringen: nur bekannte Felder,
 * keine leeren Texte oder null (die Engine füllt Felder mit "" und null auf), Namen ohne HTML.
 * Steckbriefe und Abläufe fallen weg; Technologie und Simulationswerte ergänzt der Kern aus der Palette.
 */
export function editorModellBereinigen(roh: unknown): ArchModell {
  const m = (roh ?? {}) as { elemente?: unknown; verbindungen?: unknown; titel?: unknown; ansicht?: unknown; richtung?: unknown }
  const elemente: ModellElement[] = []
  for (const r of Array.isArray(m.elemente) ? m.elemente : []) {
    const e = r as Record<string, unknown>
    if (typeof e.id !== "string" || typeof e.typ !== "string") continue
    const el: ModellElement = { id: e.id, typ: e.typ as ElementTyp, name: text(e.name, 80) ?? e.id }
    const tech = text(e.technologie, 80)
    if (tech) el.technologie = tech
    if (typeof e.x === "number" && Number.isFinite(e.x) && e.x >= 0 && e.x <= 100) el.x = e.x
    if (typeof e.y === "number" && Number.isFinite(e.y) && e.y >= 0 && e.y <= 100) el.y = e.y
    if (el.x === undefined || el.y === undefined) {
      delete el.x
      delete el.y
    }
    if (typeof e.in === "string" && e.in) el.in = e.in
    elemente.push(el)
  }
  const verbindungen: ModellVerbindung[] = []
  for (const r of Array.isArray(m.verbindungen) ? m.verbindungen : []) {
    const v = r as Record<string, unknown>
    if (typeof v.id !== "string" || typeof v.von !== "string" || typeof v.nach !== "string" || typeof v.art !== "string") continue
    const vb: ModellVerbindung = { id: v.id, von: v.von, nach: v.nach, art: v.art as ModellVerbindung["art"] }
    const label = text(v.label, 80)
    if (label) vb.label = label
    verbindungen.push(vb)
  }
  const out: ArchModell = { elemente, verbindungen }
  const titel = text(m.titel, 120)
  if (titel) out.titel = titel
  if (m.ansicht === "komponenten" || m.ansicht === "verteilung" || m.ansicht === "kontext") out.ansicht = m.ansicht
  if (m.richtung === "rechts" || m.richtung === "unten") out.richtung = m.richtung
  return out
}

/** Schlüssel der Struktur (Elemente, Lage, Verbindungen): neu zeichnen nur, wenn er sich ändert */
export function strukturSchluessel(m: ArchModell): string {
  return JSON.stringify([
    m.elemente.map((e) => [e.id, e.typ, e.name, e.x ?? null, e.y ?? null, e.in ?? null]),
    m.verbindungen.map((v) => [v.id, v.von, v.nach, v.art, v.label ?? null]),
  ])
}

// ---------- Protokoll ----------

export interface ProtokollZeile {
  tick: number
  art: "aktion" | "ereignis" | "hinweis"
  text: string
}

/** Chronik: eigene Massnahmen, Ereignisse (Beginn) und Hinweise, neueste zuerst */
export function chronik(mission: Mission, z: Zustand, aktionText: (a: Aktion, m: ArchModell) => string): ProtokollZeile[] {
  const out: ProtokollZeile[] = []
  for (const p of z.protokoll) out.push({ tick: p.tick, art: "aktion", text: aktionText(p.aktion, z.modell) })
  for (const e of mission.ereignisse) {
    const s = z.ereignisse[e.id]?.status
    if (s && s !== "geplant") out.push({ tick: e.tick, art: "ereignis", text: e.titel })
  }
  for (const h of z.hinweise) {
    const def = mission.hinweise?.find((x) => x.id === h.id)
    if (def) out.push({ tick: h.tick, art: "hinweis", text: def.text })
  }
  const rang = { ereignis: 0, hinweis: 1, aktion: 2 }
  return out.sort((a, b) => b.tick - a.tick || rang[b.art] - rang[a.art])
}
