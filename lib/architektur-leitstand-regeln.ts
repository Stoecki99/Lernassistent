// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// lib/architektur-leitstand-regeln.ts
// Reine Regeln des Architektur-Leitstands ohne Datenbank und ohne Node-Importe:
// Nachspielen bis zum aktuellen Stand, Zusammenfassung, Punkte ins Konto, Freischalten der Missionen,
// Abzeichen-Bedingungen. Läuft auf dem Server (lib/architektur-leitstand.ts) und in der Entwicklungs-Attrappe.
// Geprüft in tests/architektur-leitstand-api.test.ts.

import {
  ArchSimFehler,
  ARCHSIM_VERSION,
  gesamtKennzahlen,
  starte,
  wendeAn,
  type Aktion,
  type ArchModell,
  type Ergebnis,
  type Mission,
  type Phase,
  type Zustand,
} from "@/lib/archsim"

export const LAUF_STATUS = ["aktiv", "abgeschlossen", "abgebrochen", "veraltet"] as const
export type LaufStatus = (typeof LAUF_STATUS)[number]

/** Lernpfad-Station, die der Architektur-Leitstand meldet */
export const ARCHSIM_STATION = { fach: "avsw", thema: "11-architektur-leitstand" } as const

/** Höchstens 100 Punkte ins Konto je Lauf (wie Leitstand) */
export const MAX_PUNKTE_PRO_LAUF = 100

// ---------- Nachspielen ----------

/**
 * Startet die Mission und wendet alle Aktionen an, ohne danach bis zum Ende zu laufen
 * (im Gegensatz zu spieleNach). Fehler tragen den Index der Aktion (ArchSimFehler.aktionIndex).
 */
export function nachspielen(mission: Mission, seed: number, aktionen: Aktion[], modell?: ArchModell): Zustand {
  let z = starte(mission, seed, mission.art === "modellieren" ? modell : undefined)
  for (let i = 0; i < aktionen.length; i++) {
    try {
      z = wendeAn(mission, z, aktionen[i])
    } catch (e) {
      if (e instanceof ArchSimFehler) e.aktionIndex = i
      throw e
    }
  }
  return z
}

// ---------- Zusammenfassung für Listen ----------

export interface LaufZusammenfassung {
  /** nächste zu simulierende Minute */
  minute: number
  phase: Phase
  /** Verfügbarkeit bisher 0–1 */
  verfuegbarkeit: number
  /** Median der p95 je Minute in ms (null ohne Messung) */
  p95: number | null
  /** Kosten bisher in CHF */
  kosten: number
  rueckstau: number
}

const runde = (x: number, stellen: number): number => {
  const f = 10 ** stellen
  return Math.round(x * f) / f
}

export function zusammenfassen(mission: Mission, z: Zustand): LaufZusammenfassung {
  const k = gesamtKennzahlen(mission, z)
  return {
    minute: z.tick,
    phase: z.phase,
    verfuegbarkeit: runde(k.verfuegbarkeit, 5),
    p95: k.p95Median === null ? null : Math.round(k.p95Median),
    kosten: runde(k.kosten, 2),
    rueckstau: Math.round(k.rueckstauEnde),
  }
}

/** Gespeichertes Ergebnis (scoreDetail): ohne den grossen Zustand, der sich jederzeit nachrechnen lässt */
export interface GespeichertesErgebnis {
  score: Ergebnis["score"]
  kennzahlen: Ergebnis["kennzahlen"]
  nachbesprechung: Ergebnis["nachbesprechung"]
  validierung: Ergebnis["validierung"]
}

export function ergebnisFuerSpeicher(e: Ergebnis): GespeichertesErgebnis {
  return { score: e.score, kennzahlen: e.kennzahlen, nachbesprechung: e.nachbesprechung, validierung: e.validierung }
}

// ---------- Versionen ----------

/** true, wenn Missions- oder Kern-Version nicht mehr zum gespeicherten Lauf passt */
export function istVeraltet(lauf: { missionVersion: number; engineVersion: number }, mission: Mission): boolean {
  return lauf.missionVersion !== mission.version || lauf.engineVersion !== ARCHSIM_VERSION
}

/** Status nach der Versionsprüfung: ein aktiver Lauf mit abweichender Version wird «veraltet» */
export function statusNachVersion(lauf: { status: string; missionVersion: number; engineVersion: number }, mission: Mission): string {
  return lauf.status === "aktiv" && istVeraltet(lauf, mission) ? "veraltet" : lauf.status
}

// ---------- Punkte ----------

/**
 * Punkte ins Konto: Verbesserung des Bestwerts ÷ 10, gerundet, höchstens 100 je Lauf.
 * Wiederholungen mit bekanntem Startwert geben nichts. alterBest null = erster Lauf (zählt voll).
 */
export function punkteFuerVerbesserung(alterBest: number | null, neu: number, seedReused: boolean): number {
  if (seedReused) return 0
  const verbesserung = Math.max(0, neu - (alterBest ?? 0))
  return Math.min(MAX_PUNKTE_PRO_LAUF, Math.round(verbesserung / 10))
}

// ---------- Freischalten ----------

/**
 * Mission frei? Die erste immer, jede weitere ab einem Stern in der vorherigen.
 * sterne: beste Sterne je Mission aus abgeschlossenen Läufen.
 */
export function missionFreigeschaltet(missionIds: readonly string[], missionId: string, sterne: Record<string, number>): boolean {
  const i = missionIds.indexOf(missionId)
  if (i < 0) return false
  if (i === 0) return true
  return (sterne[missionIds[i - 1]] ?? 0) >= 1
}

/** Beste Sterne je Mission aus abgeschlossenen Läufen (auch Wiederholungen schalten frei) */
export function besteSterne(laeufe: Array<{ missionId: string; status: string; stars: number | null }>): Record<string, number> {
  const out: Record<string, number> = {}
  for (const l of laeufe) {
    if (l.status !== "abgeschlossen" || l.stars === null) continue
    out[l.missionId] = Math.max(out[l.missionId] ?? 0, l.stars)
  }
  return out
}

// ---------- Abzeichen ----------

/** Bedingungen der Abzeichen (Badge.condition), gleich wie prisma/seed.ts und die Migration */
export const ARCHSIM_ABZEICHEN_BEDINGUNGEN = ["archsim_erste_mission", "archsim_drei_sterne", "archsim_alle_missionen"] as const

export interface ArchsimAbzeichenStatistik {
  /** abgeschlossene Läufe mit neuem Startwert */
  abgeschlossen: number
  /** mindestens ein Lauf mit 3 Sternen */
  dreiSterne: boolean
  /** Missionen mit mindestens einem Stern */
  missionenMitStern: Set<string>
}

/** Statistik nur aus abgeschlossenen Läufen mit neuem Startwert (Wiederholungen zählen nicht) */
export function archsimAbzeichenStatistik(
  laeufe: Array<{ missionId: string; status: string; seedReused: boolean; stars: number | null }>,
): ArchsimAbzeichenStatistik {
  const out: ArchsimAbzeichenStatistik = { abgeschlossen: 0, dreiSterne: false, missionenMitStern: new Set() }
  for (const l of laeufe) {
    if (l.status !== "abgeschlossen" || l.seedReused) continue
    out.abgeschlossen += 1
    if ((l.stars ?? 0) >= 3) out.dreiSterne = true
    if ((l.stars ?? 0) >= 1) out.missionenMitStern.add(l.missionId)
  }
  return out
}

/** Erfüllt? null = keine Bedingung des Architektur-Leitstands */
export function archsimAbzeichenErfuellt(condition: string, s: ArchsimAbzeichenStatistik, missionIds: readonly string[]): boolean | null {
  switch (condition) {
    case "archsim_erste_mission":
      return s.abgeschlossen >= 1
    case "archsim_drei_sterne":
      return s.dreiSterne
    case "archsim_alle_missionen":
      return missionIds.length > 0 && missionIds.every((id) => s.missionenMitStern.has(id))
    default:
      return null
  }
}
