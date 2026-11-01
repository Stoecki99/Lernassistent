// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// lib/archsim/score.ts
// Punkte 0–1000 und Sterne 0–3 mit transparenten Kriterien (9.9).

import { K } from "./params"
import { clamp } from "./util"
import type { Gesamtkennzahlen, Mission, Score, ScoreTeil, ValidierungsErgebnis, Zustand } from "./types"

export const ABZUG_ANFORDERUNG = 75

const pct = (x: number, n = 1) => `${(x * 100).toFixed(n)} %`

/** Verfügbarkeit (300): voll ab Ziel, 0 bei 10 Prozentpunkten darunter, linear dazwischen */
export function punkteVerfuegbarkeit(a: number, ziel: number): number {
  return 300 * clamp((a - (ziel - 0.1)) / 0.1, 0, 1)
}

/** Latenz (200): Mittel über alle Minuten; Minute voll, wenn p95 ≤ SLO, 0 ab 2.5 × SLO */
export function punkteLatenz(z: Zustand, sloMs: number): number {
  if (z.verlauf.length === 0) return 0
  let s = 0
  for (const p of z.verlauf) {
    if (p.p95 === null) s += p.last > 0 ? 0 : 1
    else if (p.p95 <= sloMs) s += 1
    else s += clamp(1 - (p.p95 - sloMs) / (1.5 * sloMs), 0, 1)
  }
  return (200 * s) / z.verlauf.length
}

/** SLO-Einhaltung (150): Anteil Minuten mit beiden Zielen; voll ab 95 %, 0 bei 50 % */
export function punkteSlo(quote: number): number {
  return 150 * clamp((quote - 0.5) / 0.45, 0, 1)
}

/** Kosten (200): voll bis 75 % des Budgets, 140 beim Budget, 0 bei 140 % */
export function punkteKosten(k: number, budget: number): number {
  if (budget <= 0) return 0
  if (k <= 0.75 * budget) return 200
  if (k <= budget) return 200 - (60 * (k - 0.75 * budget)) / (0.25 * budget)
  return 140 * clamp(1 - (k - budget) / (0.4 * budget), 0, 1)
}

/** Daten (150): 120 für keine verlorenen kritischen Vorgänge (0 ab 2 %), 30 für abgebauten Rückstau (≤ 5 Minuten Arbeit) */
export function punkteDaten(kz: Gesamtkennzahlen, z: Zustand, dauer: number): number {
  const verlust = 120 * clamp(1 - kz.verlorenQuote / 0.02, 0, 1)
  const proMinute = z.summen.nachrichten / Math.max(1, dauer)
  const grenze = Math.max(1, proMinute * 5)
  const rueck = kz.rueckstauEnde <= grenze ? 30 : 30 * clamp(1 - (kz.rueckstauEnde - grenze) / (grenze * 4), 0, 1)
  return verlust + rueck
}

export function sterneFuer(total: number): 0 | 1 | 2 | 3 {
  const [a, b, c] = K.STERNE
  return total >= c ? 3 : total >= b ? 2 : total >= a ? 1 : 0
}

export function bewerte(mission: Mission, z: Zustand, kz: Gesamtkennzahlen, validierung: ValidierungsErgebnis | null): Score {
  const slo = mission.slo
  const teile: ScoreTeil[] = [
    {
      id: "verfuegbarkeit",
      name: "Verfügbarkeit",
      punkte: Math.round(punkteVerfuegbarkeit(kz.verfuegbarkeit, slo.verfuegbarkeit)),
      max: 300,
      erklaerung: `${pct(kz.verfuegbarkeit, 2)} erfolgreich (Ziel ${pct(slo.verfuegbarkeit, 1)}). Volle Punkte ab Ziel, keine ab ${pct(slo.verfuegbarkeit - 0.1, 1)}.`,
    },
    {
      id: "latenz",
      name: "Antwortzeit",
      punkte: Math.round(punkteLatenz(z, slo.p95Ms)),
      max: 200,
      erklaerung: `p95 im Median ${kz.p95Median === null ? "–" : Math.round(kz.p95Median) + " ms"}, schlimmste Minute ${kz.p95Max === null ? "–" : Math.round(kz.p95Max) + " ms"} (Ziel < ${slo.p95Ms} ms). Jede Minute zählt: voll bis zum Ziel, nichts ab ${Math.round(slo.p95Ms * 2.5)} ms.`,
    },
    {
      id: "slo",
      name: "SLO-Einhaltung",
      punkte: Math.round(punkteSlo(kz.sloQuote)),
      max: 150,
      erklaerung: `In ${pct(kz.sloQuote, 0)} der Minuten waren Antwortzeit und Verfügbarkeit im Ziel. Volle Punkte ab 95 %, keine unter 50 %.`,
    },
    {
      id: "kosten",
      name: "Kosten",
      punkte: Math.round(punkteKosten(kz.kosten, kz.budget)),
      max: 200,
      erklaerung: `${kz.kosten.toFixed(0)} CHF von ${kz.budget} CHF Budget (Betrieb ${kz.kostenBetrieb.toFixed(0)} CHF, Massnahmen ${kz.kostenMassnahmen.toFixed(0)} CHF). Volle Punkte bis 75 % des Budgets, 140 beim Budget, keine ab 140 %.`,
    },
    {
      id: "daten",
      name: "Datensicherheit",
      punkte: Math.round(punkteDaten(kz, z, mission.dauer)),
      max: 150,
      erklaerung: `${Math.round(kz.kritischVerloren)} kritische Vorgänge verloren (${pct(kz.verlorenQuote, 2)}, keine Punkte ab 2 %), Rückstau am Ende ${Math.round(kz.rueckstauEnde)} Nachrichten.`,
    },
  ]
  if (validierung && validierung.anforderungen.length > 0) {
    const offen = validierung.anforderungen.filter((a) => !a.erfuellt)
    teile.push({
      id: "anforderungen",
      name: "Anforderungen",
      punkte: offen.length === 0 ? 0 : -ABZUG_ANFORDERUNG * offen.length,
      max: 0,
      erklaerung:
        offen.length === 0
          ? "Alle Anforderungen aus dem Auftrag erfüllt."
          : `${offen.length} Anforderung(en) nicht erfüllt, je −${ABZUG_ANFORDERUNG}: ${offen.map((a) => a.text).join("; ")}.`,
    })
  }
  const total = Math.max(0, Math.min(1000, teile.reduce((s, t) => s + t.punkte, 0)))
  return { total, sterne: sterneFuer(total), teile, schwellen: K.STERNE }
}
