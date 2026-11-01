// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// lib/archsim/engine.ts
// Rechenkern (docs/architektur-modell.md 9.2–9.7): starte, wendeAn, schritt, spieleNach.
// Ein Tick = 1 simulierte Minute im eingeschwungenen Zustand. Reine Funktionen nach aussen:
// jede öffentliche Funktion arbeitet auf einer Kopie und gibt einen neuen Zustand zurück.

import { leereMessung, neueElementLaufzeit, neueVerbindungLaufzeit, pruefeAktion, wendeMassnahmeAn, zielInstanzen } from "./actions"
import { debrief } from "./debrief"
import { ereignisseFuer, grundlast, type Wirkungen } from "./events"
import { ArchSimFehler } from "./fehler"
import { gesamtKennzahlen, quantilMischung, type LatenzKomponente } from "./kpi"
import { ARCHSIM_VERSION, K, werteFuer, type TypWerte } from "./params"
import { draw } from "./rng"
import { elementIndex, planFuer, type Plan, type PlanKnoten } from "./routing"
import { bewerte } from "./score"
import { klone } from "./util"
import { ergaenzeAusPalette, validiere } from "./validate"
import type {
  Aktion,
  ArchModell,
  Ergebnis,
  KennzahlPunkt,
  KnotenSpeicher,
  MessZustand,
  Mission,
  ModellElement,
  VerbindungLaufzeit,
  Zustand,
} from "./types"

// ---------- Start ----------

/**
 * Neuer Lauf. Bei Missionen der Art "modellieren" ist `modell` das Modell des Spielers (muss gültig sein),
 * sonst wird das Missionsmodell verwendet.
 */
export function starte(mission: Mission, seed: number, modell?: ArchModell): Zustand {
  if (!Number.isSafeInteger(seed)) throw new ArchSimFehler("UNGUELTIG", "Der Startwert muss eine ganze Zahl sein.")
  let basis: ArchModell
  if (mission.art === "modellieren") {
    if (!modell) throw new ArchSimFehler("MODELL", "Für diese Mission brauchst du zuerst ein eigenes Modell.")
    const v = validiere(mission, modell)
    if (!v.gueltig) throw new ArchSimFehler("MODELL", "Das Modell ist noch nicht lauffähig.", v.fehler)
    basis = ergaenzeAusPalette(mission, modell)
  } else {
    if (modell) throw new ArchSimFehler("UNGUELTIG", "Diese Mission hat ein vorgegebenes Modell.")
    basis = mission.modell
  }
  const m = klone(basis)
  const z: Zustand = {
    version: ARCHSIM_VERSION,
    missionId: mission.id,
    missionVersion: mission.version,
    seed,
    rng: seed | 0,
    tick: 0,
    phase: "bereit",
    modell: m,
    elemente: Object.fromEntries(m.elemente.map((e) => [e.id, neueElementLaufzeit(e, -K.CACHE_AUFWAERMEN)])),
    verbindungen: Object.fromEntries(m.verbindungen.map((v) => [v.id, neueVerbindungLaufzeit(v)])),
    knoten: {},
    puffer: {},
    ereignisse: Object.fromEntries(mission.ereignisse.map((e) => [e.id, { status: "geplant" as const }])),
    kosten: { betrieb: 0, massnahmen: 0 },
    summen: {
      angefragt: 0, erfolgreich: 0, degradiert: 0, fehler: 0, abgewiesen: 0,
      kritischAngefragt: 0, kritischVerloren: 0, nachrichten: 0, nachrichtenVerloren: 0,
    },
    verlauf: [],
    protokoll: [],
    hinweise: [],
  }
  return z
}

// ---------- Aktionen ----------

/** Wendet eine Aktion an (inkl. «weiter») und gibt einen neuen Zustand zurück. */
export function wendeAn(mission: Mission, zustand: Zustand, aktion: Aktion): Zustand {
  pruefeVersion(mission, zustand)
  pruefeAktion(mission, zustand, aktion)
  const z = klone(zustand)
  if (aktion.typ === "weiter") {
    for (let i = 0; i < aktion.minuten && z.phase !== "beendet"; i++) minute(mission, z)
  } else {
    wendeMassnahmeAn(mission, z, aktion)
  }
  return z
}

/** Wendet die Aktionen an und simuliert danach genau eine Minute (bequemer Takt für die Oberfläche). */
export function schritt(mission: Mission, zustand: Zustand, aktionen: Aktion[] = []): Zustand {
  let z = zustand
  for (const a of aktionen) z = wendeAn(mission, z, a)
  if (z.phase === "beendet") return z
  return wendeAn(mission, z, { typ: "weiter", minuten: 1 })
}

/** Lässt die Mission ohne weitere Aktionen bis zum Ende laufen. */
export function beende(mission: Mission, zustand: Zustand): Zustand {
  if (zustand.phase === "beendet") return zustand
  return wendeAn(mission, zustand, { typ: "weiter", minuten: mission.dauer - zustand.tick })
}

/** Auswertung eines beendeten (oder laufenden) Zustands */
export function auswerten(mission: Mission, zustand: Zustand): Ergebnis {
  const validierung = mission.art === "modellieren" ? validiere(mission, zustand.modell) : null
  const kennzahlen = gesamtKennzahlen(mission, zustand)
  const score = bewerte(mission, zustand, kennzahlen, validierung)
  return { zustand, kennzahlen, score, nachbesprechung: debrief(mission, zustand, kennzahlen, score), validierung }
}

/**
 * Nachspielen für die Bewertung auf dem Server: gleicher Seed + gleiche Aktionen (+ gleiches Modell) = gleiches Ergebnis.
 * Läuft nach der letzten Aktion bis zum Ende. Fehler tragen den Index der Aktion.
 */
export function spieleNach(mission: Mission, seed: number, aktionen: Aktion[], modell?: ArchModell): Ergebnis {
  let z = starte(mission, seed, modell)
  for (let i = 0; i < aktionen.length; i++) {
    if (z.phase === "beendet") {
      const f = new ArchSimFehler("BEENDET", "Nach dem Ende der Mission sind keine Aktionen mehr möglich.")
      f.aktionIndex = i
      throw f
    }
    try {
      z = wendeAn(mission, z, aktionen[i])
    } catch (e) {
      if (e instanceof ArchSimFehler) e.aktionIndex = i
      throw e
    }
  }
  return auswerten(mission, beende(mission, z))
}

function pruefeVersion(mission: Mission, z: Zustand): void {
  if (z.missionId !== mission.id || z.missionVersion !== mission.version) {
    throw new ArchSimFehler("UNGUELTIG", "Der Spielstand gehört zu einer anderen Mission oder Missionsversion.")
  }
}

// ---------- Rechnung einer Minute ----------

interface ElRechnung {
  w: TypWerte
  /** Bedienzeit ms (inkl. «langsam») */
  S: number
  /** eigene Antwortzeit ms (Bedienzeit + Warteschlange) */
  R: number
  /** Anteil nach Rate Limit */
  rl: number
  /** Anteil, der Platz findet (CPU und Threads) */
  aSat: number
  /** Fehlerquote angenommener Anfragen */
  f: number
  ausfall: boolean
  unbegrenzt: boolean
  inst: number
  threadCap: number
  rhoCpu: number
  threadUtil: number
  angeboten: number
}

interface Stat {
  /** Erfolgswahrscheinlichkeit */
  s: number
  /** mittlere Latenz erfolgreicher Anfragen ms */
  L: number
  /** Grundlatenz ohne Warteschlangen ms */
  B: number
  /** mittlere Zeit bis zum Fehler ms */
  F: number
  /** Anteil degradierter Antworten (Fallback) */
  d: number
}

interface KantenErgebnis {
  S: number
  L: number
  F: number
  B: number
  D: number
  /** Fehlerwahrscheinlichkeit eines Versuchs */
  q: number
  /** mittlere Gesamtzeit je Aufruf inkl. Wiederholungen */
  zeit: number
}

const AUFRUF_ROLLEN = new Set(["sync", "daten", "publish"])

/** Latenzfaktor R/S: Sakasegawa-Näherung für M/M/c, ab RHO_GRENZE linear bis zur Kappung (9.2) */
export function latenzFaktor(rho: number, c: number): number {
  if (!(rho > 0)) return 1
  const cc = Math.max(1, c)
  const r = Math.min(rho, K.RHO_GRENZE)
  const wq = Math.pow(r, Math.sqrt(2 * (cc + 1)) - 1) / (cc * (1 - r))
  let f = 1 + wq
  if (rho > K.RHO_GRENZE) f += (K.LATENZ_KAPPUNG - f) * Math.min(1, (rho - K.RHO_GRENZE) / 0.25)
  return Math.min(f, K.LATENZ_KAPPUNG)
}

/** Lastmultiplikator durch Wiederholungen: 1 + q + q² + … + q^r */
export function retryFaktor(q: number, r: number): number {
  let s = 0
  for (let i = 0; i <= r; i++) s += Math.pow(q, i)
  return s
}

function ergebnisKante(cs: Stat, v: VerbindungLaufzeit | undefined, rolle: string, rb: number): KantenErgebnis {
  const T = v?.timeoutMs ?? K.STANDARD_TIMEOUT_MS
  const r = v && AUFRUF_ROLLEN.has(rolle) ? v.retries : 0
  const a = K.LATENZ_FEST * cs.B
  const m = Math.max(cs.L - a, 0.01)
  let pTo: number
  let tS: number
  let tOk: number
  if (T <= a) {
    pTo = 1
    tS = T
    tOk = T
  } else {
    const e = Math.exp(-(T - a) / m)
    pTo = e
    tS = a + m * (1 - e)
    tOk = 1 - e > 1e-12 ? a + m - ((T - a) * e) / (1 - e) : a
  }
  const tF = Math.min(cs.F, T)
  const q = Math.min(1, Math.max(0, 1 - cs.s * (1 - pTo)))
  const t1 = cs.s * tS + (1 - cs.s) * tF
  const tq = q > 1e-12 ? (cs.s * pTo * T + (1 - cs.s) * tF) / q : 0
  const versuche = retryFaktor(q, r)
  let S = 1 - Math.pow(q, r + 1)
  let erwFehl = 0
  if (S > 1e-12) {
    for (let k = 0; k <= r; k++) erwFehl += k * Math.pow(q, k) * (1 - q)
    erwFehl /= S
  }
  const L = tOk + erwFehl * tq + K.NETZ_MS
  let F = q > 1e-12 ? (r + 1) * tq : tF
  let zeit = t1 * versuche + K.NETZ_MS
  if (rb > 0) {
    const S2 = S * (1 - rb)
    const fm = 1 - S2
    F = fm > 1e-12 ? ((1 - S) * (1 - rb) * F + rb * K.SCHNELL_MS) / fm : F
    zeit = zeit * (1 - rb) + rb * K.SCHNELL_MS
    S = S2
  }
  return { S, L, F, B: cs.B + K.NETZ_MS, D: cs.d, q, zeit }
}

/** Rückkopplung glätten: Messwerte über die Minute gemittelt statt Sprung (9.2) */
function glaette(alt: KnotenSpeicher | undefined, neu: KnotenSpeicher): KnotenSpeicher {
  if (!alt) return neu
  const g = K.GLAETTUNG
  return { q: alt.q + g * (neu.q - alt.q), zeit: alt.zeit + g * (neu.zeit - alt.zeit), s: alt.s + g * (neu.s - alt.s) }
}

function klasseVon(mission: Mission, id: string) {
  return mission.anfragen.find((k) => k.id === id)
}

/** Instanzen aktivieren, deren Startzeit erreicht ist (Minute z.tick) */
function starteInstanzen(z: Zustand): void {
  for (const rt of Object.values(z.elemente)) {
    if (rt.geplant.length === 0) continue
    const fertig = rt.geplant.filter((g) => g.ab <= z.tick)
    if (fertig.length === 0) continue
    rt.instanzen += fertig.reduce((s, g) => s + g.anzahl, 0)
    rt.geplant = rt.geplant.filter((g) => g.ab > z.tick)
  }
}

/** Simuliert die Minute z.tick auf der Arbeitskopie z (mutierend) und hängt den Kennzahlpunkt an. */
function minute(mission: Mission, z: Zustand): void {
  const t = z.tick
  if (z.phase === "bereit") z.phase = "laeuft"

  // 1. Instanzen, deren Start abgeschlossen ist
  starteInstanzen(z)

  // 2. Ereignisse und Last
  const wi: Wirkungen = ereignisseFuer(mission, z, t)
  const rauschen = (2 * draw(z) - 1) * mission.last.rauschen
  const lambda = Math.max(0, grundlast(mission, t) * wi.lastFaktor * (1 + rauschen))

  const plan: Plan = planFuer(mission.anfragen, z.modell)
  const els = elementIndex(z.modell)
  const N = plan.knoten.length
  const lam = new Array<number>(N).fill(0)
  const zufluss = new Array<number>(N).fill(0)
  const verfuegbar = new Array<number>(N).fill(0)
  const aufrufe = new Array<number>(N).fill(0)
  const versuche = new Array<number>(N).fill(1)
  const bulkheadAb = new Array<number>(N).fill(0)
  const rech: Record<string, ElRechnung> = {}
  let abgewiesen = 0

  for (const [kid, idx] of Object.entries(plan.wurzeln)) {
    const k = klasseVon(mission, kid)
    if (k) lam[idx] = lambda * k.anteil
  }

  const prev = (key: string, el: ModellElement | undefined): KnotenSpeicher =>
    z.knoten[key] ?? { q: 0, zeit: el ? werteFuer(el.typ, el.sim).latenz : 0, s: 1 }

  /** Trefferquote eines Caches (warm nach CACHE_AUFWAERMEN Minuten, 0 bei Ausfall) */
  const treffer = (cacheId: string): number => {
    const el = els[cacheId]
    if (!el || wi.ausfall[cacheId]) return 0
    const w = werteFuer(el.typ, el.sim)
    const alter = t - z.elemente[cacheId].seit
    return w.trefferquote * Math.min(1, Math.max(0, alter) / K.CACHE_AUFWAERMEN)
  }

  const gewicht = (i: number): number => {
    const k = plan.knoten[i]
    if (k.gewicht === "voll") return 1
    const klasse = klasseVon(mission, k.klasse)
    if (k.gewicht === "cdnRest") {
      const cdn = plan.knoten[k.parent].element
      return wi.ausfall[cdn] ? 1 : 1 - (klasse?.statischAnteil ?? 0)
    }
    // cacheMiss: Cache ist Elternknoten (Read-Through) oder Geschwister (Cache-Aside)
    if (klasse?.schreibend) return 1
    const p = plan.knoten[k.parent]
    let cacheId: string | null = els[p.element]?.typ === "cache" ? p.element : null
    if (!cacheId) {
      for (const s of p.kinder) if (els[plan.knoten[s].element]?.typ === "cache") cacheId = plan.knoten[s].element
    }
    return cacheId ? 1 - treffer(cacheId) : 1
  }

  /** Anteil der Aufrufe, die ein Circuit Breaker durchlässt: zu 1, halboffen PROBE, offen 0 */
  const cbDurch = (k: PlanKnoten): number => {
    const v = k.kante ? z.verbindungen[k.kante] : undefined
    if (!v || !v.circuitBreaker || !AUFRUF_ROLLEN.has(k.rolle)) return 1
    return v.cbStatus === "offen" ? 0 : v.cbStatus === "halboffen" ? K.CB_PROBE : 1
  }

  // 3. Last von oben nach unten (Elemente in Plan-Reihenfolge)
  for (const e of plan.ordnung) {
    const el = els[e]
    if (!el) continue
    const rt = z.elemente[e]
    const w = werteFuer(el.typ, el.sim)
    const idxs = plan.knotenJeElement[e] ?? []
    const ausfall = !!wi.ausfall[e]
    const S = w.latenz * (wi.langsam[e] ?? 1)
    const inst = ausfall ? 0 : rt.instanzen

    // Konsumenten: Puffer abbauen. Worker ziehen Nachrichten bis 80 % der CPU-Kapazität nach (Prefetch),
    // auch wenn sie an einer langsamen Abhängigkeit hängen: dann belegen sie die Threads des Dienstes.
    const konsum = idxs.filter((i) => plan.knoten[i].rolle === "konsum")
    if (konsum.length > 0) {
      const kap = inst * w.kapazitaet * K.KONSUM_ANTEIL
      let gesamt = 0
      for (const i of konsum) {
        verfuegbar[i] = (z.puffer[plan.knoten[i].key] ?? 0) + zufluss[i] * 60
        gesamt += verfuegbar[i]
      }
      const abbau = Math.min(gesamt / 60, kap)
      for (const i of konsum) lam[i] = gesamt > 0 ? (abbau * verfuegbar[i]) / gesamt : 0
    }

    const angeboten = idxs.reduce((s, i) => s + lam[i], 0)
    let r: ElRechnung
    if (w.unbegrenzt) {
      r = { w, S, R: S, rl: 1, aSat: 1, f: 0, ausfall: false, unbegrenzt: true, inst, threadCap: 0, rhoCpu: 0, threadUtil: 0, angeboten }
    } else {
      const rl = rt.rateLimit > 0 && angeboten > rt.rateLimit ? rt.rateLimit / angeboten : 1
      abgewiesen += angeboten * (1 - rl) * 60
      // Datenbank: Lesezugriffe verteilen sich auf Primär + Replicas
      let effektiv = angeboten
      if (el.typ === "datenbank" && rt.replikate > 0) {
        effektiv = idxs.reduce((s, i) => s + lam[i] * (klasseVon(mission, plan.knoten[i].klasse)?.schreibend ? 1 : 1 / (1 + rt.replikate)), 0)
      }
      const muCpu = inst * w.kapazitaet
      const rhoCpu = muCpu > 0 ? (effektiv * rl) / muCpu : effektiv > 0 ? 99 : 0
      // Überlast: Anfragen über der Kapazität scheitern; zusätzlich geht Arbeit an Anfragen verloren,
      // deren Aufrufer schon aufgegeben hat (Goodput sinkt, metastabile Überlast)
      const aCpu = rhoCpu > 1 ? (1 / rhoCpu) * (1 - K.UEBERLAST_VERLUST * Math.min(1, rhoCpu - 1)) : 1
      const R = S * latenzFaktor(rhoCpu, inst)
      // Threads: gehalten wird eigene Antwortzeit + Warten auf Aufrufe (ohne abgeschottete Verbindungen)
      let bedarf = 0
      for (const i of idxs) {
        let h = R
        for (const c of plan.knoten[i].kinder) {
          const ck = plan.knoten[c]
          if (!AUFRUF_ROLLEN.has(ck.rolle)) continue
          const v = ck.kante ? z.verbindungen[ck.kante] : undefined
          if (v?.bulkhead) continue
          h += gewicht(c) * cbDurch(ck) * prev(ck.key, els[ck.element]).zeit
        }
        bedarf += lam[i] * rl * aCpu * (h / 1000)
      }
      const threadCap = inst * w.parallel
      const threadUtil = threadCap > 0 ? bedarf / threadCap : bedarf > 0 ? 99 : 0
      const aThr = threadUtil > 1 ? 1 / threadUtil : 1
      const f = Math.min(1, w.fehlerquote + (wi.deployment[e] ?? 0))
      r = { w, S, R, rl, aSat: inst > 0 ? aCpu * aThr : 0, f, ausfall: inst === 0, unbegrenzt: false, inst, threadCap, rhoCpu, threadUtil, angeboten }
    }
    rech[e] = r

    // Weitergeben an die Kinder
    for (const i of idxs) {
      const durch = lam[i] * r.rl * r.aSat * (1 - r.f)
      for (const c of plan.knoten[i].kinder) {
        const ck = plan.knoten[c]
        if (ck.rolle === "konsum") {
          zufluss[c] += durch
          continue
        }
        aufrufe[c] = durch * gewicht(c)
        const rate = aufrufe[c] * cbDurch(ck)
        if (rate <= 0) continue
        const v = ck.kante ? z.verbindungen[ck.kante] : undefined
        const p = prev(ck.key, els[ck.element])
        const mult = AUFRUF_ROLLEN.has(ck.rolle) && v ? retryFaktor(p.q, v.retries) : 1
        versuche[c] = mult
        let rb = 0
        if (v?.bulkhead && AUFRUF_ROLLEN.has(ck.rolle)) {
          const pool = K.BULKHEAD_ANTEIL * r.threadCap
          const noetig = (rate * p.zeit) / 1000
          rb = noetig > pool ? 1 - pool / noetig : 0
        }
        bulkheadAb[c] = rb
        lam[c] += rate * mult * (1 - rb)
      }
    }
  }

  // 4. Antwortzeiten und Erfolg von unten nach oben
  const stat: Stat[] = new Array(N)
  const neueKnoten: Record<string, KnotenSpeicher> = {}
  const neuePuffer: Record<string, number> = {}
  const kantenQ: Record<string, { sw: number; sq: number; max: number }> = {}
  const pufferJeMessaging: Record<string, number[]> = {}
  let nachrichten = 0
  let nachrichtenVerloren = 0
  let kritischVerlorenAsync = 0

  for (let i = N - 1; i >= 0; i--) {
    const k = plan.knoten[i]
    const r = rech[k.element]
    if (!r) {
      stat[i] = { s: 0, L: K.SCHNELL_MS, B: K.SCHNELL_MS, F: K.SCHNELL_MS, d: 0 }
      continue
    }
    let sOwn: number
    let schnell: number
    let saett: number
    if (r.unbegrenzt) {
      sOwn = 1
      schnell = 0
      saett = 0
    } else if (r.ausfall) {
      sOwn = 0
      schnell = 1
      saett = 0
    } else {
      schnell = 1 - r.rl + r.rl * r.aSat * r.f
      saett = r.rl * (1 - r.aSat)
      sOwn = r.rl * r.aSat * (1 - r.f)
    }
    let sAcc = sOwn
    let tAcc = r.R
    let bAcc = r.S
    let fehlMasse = schnell + saett
    let fehlZeit = schnell * r.S + saett * K.SAETTIGUNG_WARTEN_MS
    let dAcc = 0
    const klasse = klasseVon(mission, k.klasse)
    const durch = lam[i] * r.rl * r.aSat * (1 - r.f)
    for (const c of k.kinder) {
      const ck = plan.knoten[c]
      const cs = stat[c]
      if (ck.rolle === "konsum") {
        // Erfolgreich verarbeitete Nachrichten verlassen den Puffer, fehlgeschlagene werden erneut zugestellt
        const verarbeitet = lam[c] * 60 * cs.s
        neuePuffer[ck.key] = Math.max(0, verfuegbar[c] - verarbeitet)
        nachrichten += zufluss[c] * 60
        ;(pufferJeMessaging[k.element] ??= []).push(c)
        neueKnoten[ck.key] = glaette(z.knoten[ck.key], { q: 1 - cs.s, zeit: 0, s: cs.s })
        continue
      }
      const gf = gewicht(c)
      if (ck.rolle === "asyncDirekt") {
        const n = durch * gf * 60
        const verloren = n * (1 - cs.s)
        nachrichten += n
        nachrichtenVerloren += verloren
        if (klasse?.kritisch) kritischVerlorenAsync += verloren
        neueKnoten[ck.key] = glaette(z.knoten[ck.key], { q: 1 - cs.s, zeit: K.SCHNELL_MS, s: cs.s })
        continue
      }
      const v = ck.kante ? z.verbindungen[ck.kante] : undefined
      const echt = ergebnisKante(cs, v, ck.rolle, bulkheadAb[c])
      let ke: KantenErgebnis = echt
      const durchCb = cbDurch(ck)
      if (durchCb < 1) {
        // Abgewiesene Aufrufe: sofortiger Fehler oder Ersatzantwort (Fallback); gemischt mit den Probe-Aufrufen
        const fb = v?.fallback ?? false
        const p = durchCb
        const S = p * echt.S + (1 - p) * (fb ? 1 : 0)
        const sEcht = p * echt.S
        const sCb = (1 - p) * (fb ? 1 : 0)
        const fEcht = p * (1 - echt.S)
        const fCb = (1 - p) * (fb ? 0 : 1)
        ke = {
          S,
          L: S > 1e-12 ? (sEcht * echt.L + sCb * K.SCHNELL_MS) / S : K.SCHNELL_MS,
          F: fEcht + fCb > 1e-12 ? (fEcht * echt.F + fCb * K.SCHNELL_MS) / (fEcht + fCb) : K.SCHNELL_MS,
          B: p * echt.B + (1 - p) * K.SCHNELL_MS,
          D: S > 1e-12 ? (sEcht * echt.D + sCb) / S : 0,
          q: echt.q,
          zeit: p * echt.zeit + (1 - p) * K.SCHNELL_MS,
        }
      }
      neueKnoten[ck.key] = glaette(z.knoten[ck.key], { q: echt.q, zeit: ke.zeit, s: cs.s })
      if (ck.kante && v) {
        const kq = (kantenQ[ck.kante] ??= { sw: 0, sq: 0, max: 0 })
        kq.sw += aufrufe[c]
        kq.sq += aufrufe[c] * echt.q
        kq.max = Math.max(kq.max, echt.q)
      }
      const fm = sAcc * gf * (1 - ke.S)
      fehlZeit += fm * (tAcc + ke.F)
      fehlMasse += fm
      tAcc += gf * ke.L
      bAcc += gf * ke.B
      sAcc *= 1 - gf * (1 - ke.S)
      dAcc = 1 - (1 - dAcc) * (1 - gf * ke.D)
    }
    stat[i] = { s: sAcc, L: tAcc, B: bAcc, F: fehlMasse > 1e-12 ? fehlZeit / fehlMasse : r.S, d: dAcc }
  }

  // Pufferüberlauf je Messaging-Element
  for (const [mid, cs] of Object.entries(pufferJeMessaging)) {
    const el = els[mid]
    const kap = werteFuer(el.typ, el.sim).puffer * Math.max(1, z.elemente[mid].instanzen)
    const summe = cs.reduce((s, c) => s + neuePuffer[plan.knoten[c].key], 0)
    if (summe > kap) {
      const faktor = kap / summe
      for (const c of cs) {
        const key = plan.knoten[c].key
        const weg = neuePuffer[key] * (1 - faktor)
        neuePuffer[key] -= weg
        nachrichtenVerloren += weg
        if (klasseVon(mission, plan.knoten[c].klasse)?.kritisch) kritischVerlorenAsync += weg
      }
    }
  }

  // 5. Ergebnis je Anfrageklasse (Kundinnen-Timeout)
  const Tc = mission.clientTimeoutMs ?? K.CLIENT_TIMEOUT_MS
  const komponenten: LatenzKomponente[] = []
  let angefragt = 0
  let erfolgreich = 0
  let degradiert = 0
  for (const klasse of mission.anfragen) {
    const idx = plan.wurzeln[klasse.id]
    const anfragen = lambda * klasse.anteil * 60
    let ok = 0
    if (idx !== undefined) {
      const st = stat[idx]
      const a = K.LATENZ_FEST * st.B
      const m = Math.max(st.L - a, 0.01)
      const pTo = Tc <= a ? 1 : Math.exp(-(Tc - a) / m)
      ok = st.s * (1 - pTo)
      komponenten.push({ w: lambda * klasse.anteil * ok, a, m })
      degradiert += anfragen * ok * st.d
    }
    angefragt += anfragen
    erfolgreich += anfragen * ok
    if (klasse.kritisch) {
      z.summen.kritischAngefragt += anfragen
      z.summen.kritischVerloren += anfragen * (1 - ok)
    }
  }
  z.summen.kritischVerloren += kritischVerlorenAsync
  z.summen.angefragt += angefragt
  z.summen.erfolgreich += erfolgreich
  z.summen.degradiert += degradiert
  z.summen.fehler += angefragt - erfolgreich
  z.summen.abgewiesen += abgewiesen
  z.summen.nachrichten += nachrichten
  z.summen.nachrichtenVerloren += nachrichtenVerloren
  z.knoten = neueKnoten
  z.puffer = neuePuffer

  // 6. Messungen je Element
  let engpass: string | null = null
  let engpassWert: number = K.ENGPASS
  const ueberlastet: string[] = []
  const threadsErschoepft: string[] = []
  let auslastungMax: KennzahlPunkt["auslastungMax"] = null
  for (const el of z.modell.elemente) {
    const rt = z.elemente[el.id]
    if (!rt) continue
    const r = rech[el.id]
    const deploy = (wi.deployment[el.id] ?? 0) > 0
    if (!r) {
      rt.messung = { ...leereMessung(), zustand: wi.ausfall[el.id] ? "ausfall" : wi.langsam[el.id] ? "langsam" : deploy ? "fehlerhaft" : "leer" }
      continue
    }
    const aus = Math.max(r.rhoCpu, r.threadUtil)
    let zustand: MessZustand = "ok"
    if (r.unbegrenzt) zustand = "ok"
    else if (wi.ausfall[el.id]) zustand = "ausfall"
    else if (aus > 1) zustand = "ueberlast"
    else if (wi.langsam[el.id]) zustand = "langsam"
    else if (deploy) zustand = "fehlerhaft"
    else if (aus >= K.ENGPASS) zustand = "ausgelastet"
    else if (r.angeboten <= 0) zustand = "leer"
    rt.messung = {
      last: r.angeboten,
      auslastung: r.unbegrenzt ? 0 : Math.min(aus, 99),
      latenzMs: r.R,
      fehlerquote: r.unbegrenzt ? 0 : Math.min(1, Math.max(0, 1 - r.rl * r.aSat * (1 - r.f))),
      zustand,
    }
    if (!r.unbegrenzt && !r.ausfall && r.angeboten > 0) {
      if (r.rhoCpu > 1) ueberlastet.push(el.id)
      if (r.threadUtil > 1) threadsErschoepft.push(el.id)
      if (!auslastungMax || aus > auslastungMax.wert) auslastungMax = { element: el.id, wert: Math.min(aus, 99) }
    }
    // Engpass: höchste CPU-Auslastung (Ursache); Thread-Erschöpfung (Symptom) nur, wenn keine CPU knapp ist
    const gewichtet = r.rhoCpu >= K.ENGPASS ? 100 + r.rhoCpu : aus
    if (!r.unbegrenzt && !r.ausfall && aus >= K.ENGPASS && gewichtet > engpassWert && r.angeboten > 0) {
      engpassWert = gewichtet
      engpass = el.id
    }
  }

  // 7. Kosten
  let kostenRate = 0
  for (const el of z.modell.elemente) {
    const rt = z.elemente[el.id]
    if (!rt) continue
    const w = werteFuer(el.typ, el.sim)
    kostenRate += (zielInstanzen(rt) + rt.replikate) * w.kostenProInstanz
  }
  z.kosten.betrieb += kostenRate / 60

  // 8. Kennzahlpunkt
  let retrySturm: string | null = null
  let sturmWert = 1.5
  for (let i = 0; i < N; i++) {
    const k = plan.knoten[i]
    if (k.kante && versuche[i] >= sturmWert && aufrufe[i] > 0 && cbDurch(k) === 1) {
      sturmWert = versuche[i]
      retrySturm = k.kante
    }
  }
  const verf = angefragt > 0 ? erfolgreich / angefragt : 1
  const p95 = quantilMischung(komponenten, 0.95)
  const p50 = quantilMischung(komponenten, 0.5)
  const rueckstau = Object.values(z.puffer).reduce((s, x) => s + x, 0)
  const punkt: KennzahlPunkt = {
    t,
    last: lambda,
    durchsatz: erfolgreich / 60,
    fehlerquote: 1 - verf,
    verfuegbarkeit: verf,
    p50,
    p95,
    kostenRate,
    kosten: z.kosten.betrieb + z.kosten.massnahmen,
    rueckstau,
    verloren: z.summen.kritischVerloren,
    degradiert: erfolgreich > 0 ? degradiert / erfolgreich : 0,
    sloOk: (angefragt === 0 || (p95 !== null && p95 <= mission.slo.p95Ms)) && verf >= mission.slo.verfuegbarkeit,
    engpass,
    ueberlastet: ueberlastet.sort(),
    threadsErschoepft: threadsErschoepft.sort(),
    auslastungMax,
    retrySturm,
    cbOffen: Object.keys(z.verbindungen).filter((id) => z.verbindungen[id].circuitBreaker && z.verbindungen[id].cbStatus === "offen").sort(),
    ereignisse: wi.aktiv,
  }
  z.verlauf.push(punkt)

  // 9. Circuit Breaker nachführen (zu → offen → halboffen → zu/offen)
  for (const [id, v] of Object.entries(z.verbindungen)) {
    if (!v.circuitBreaker) continue
    const kq = kantenQ[id]
    const q = kq ? (kq.sw > 0 ? kq.sq / kq.sw : kq.max) : 0
    if (v.cbStatus === "zu") {
      if (kq && kq.sw > 0 && q >= K.CB_SCHWELLE) {
        v.cbStatus = "offen"
        v.cbBis = t + 1 + K.CB_OFFEN_MINUTEN
      }
    } else if (v.cbStatus === "offen") {
      if (t + 1 >= v.cbBis) v.cbStatus = "halboffen"
    } else if (q >= K.CB_SCHWELLE) {
      v.cbStatus = "offen"
      v.cbBis = t + 1 + K.CB_OFFEN_MINUTEN
    } else {
      v.cbStatus = "zu"
    }
  }

  // 10. Autoscaling (misst CPU-Auslastung wie ein Horizontal Pod Autoscaler)
  for (const el of z.modell.elemente) {
    const rt = z.elemente[el.id]
    if (!rt?.autoscaling) continue
    const r = rech[el.id]
    const rho = r ? r.rhoCpu : 0
    const ziel = zielInstanzen(rt)
    if (rho > K.AS_HOCH && !wi.ausfall[el.id]) {
      const neu = Math.min(rt.autoscaling.max, Math.ceil((Math.max(rt.instanzen, 1) * rho) / K.AS_ZIEL))
      if (neu > ziel) rt.geplant.push({ ab: t + 1 + K.START_VERZOEGERUNG, anzahl: neu - ziel })
      rt.tiefSeit = 0
    } else if (rho < K.AS_TIEF) {
      rt.tiefSeit++
      if (rt.tiefSeit >= K.AS_TIEF_MINUTEN && rt.geplant.length === 0 && rt.instanzen > rt.autoscaling.min) {
        rt.instanzen--
        rt.tiefSeit = 0
      }
    } else {
      rt.tiefSeit = 0
    }
  }

  // 11. Hinweise (geführte Missionen)
  for (const h of mission.hinweise ?? []) {
    if (z.hinweise.some((x) => x.id === h.id)) continue
    const b = h.wenn
    let an = false
    if ("tick" in b) an = t >= b.tick
    else if ("ereignis" in b) an = wi.aktiv.includes(b.ereignis)
    else if ("auslastung" in b) an = (z.elemente[b.auslastung]?.messung.auslastung ?? 0) > b.ueber
    else if ("fehlerquoteUeber" in b) an = punkt.fehlerquote > b.fehlerquoteUeber
    else an = punkt.p95 !== null && punkt.p95 > b.p95Ueber
    if (an) z.hinweise.push({ id: h.id, tick: t })
  }

  z.tick = t + 1
  starteInstanzen(z)
  if (z.tick >= mission.dauer) z.phase = "beendet"
}
