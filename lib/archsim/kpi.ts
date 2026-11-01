// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// lib/archsim/kpi.ts
// Kennzahlen (9.5): Latenzverteilung als verschobene Exponentialverteilung je Anfrageklasse,
// p50/p95 als Quantil der Mischung (Bisektion), Gesamtkennzahlen über den ganzen Lauf.

import { median } from "./util"
import type { Gesamtkennzahlen, Mission, Zustand } from "./types"

/** Anteil w einer Mischung: Latenz = a + Exp(Mittel m) (a = fester Teil, m = schwankender Teil) */
export interface LatenzKomponente {
  w: number
  a: number
  m: number
}

function cdf(k: LatenzKomponente, x: number): number {
  if (x <= k.a) return 0
  if (k.m <= 0) return 1
  return 1 - Math.exp(-(x - k.a) / k.m)
}

/** Quantil p (0–1) der Mischung; null, wenn kein Gewicht vorhanden ist. */
export function quantilMischung(komponenten: LatenzKomponente[], p: number): number | null {
  const ks = komponenten.filter((k) => k.w > 0 && Number.isFinite(k.a) && Number.isFinite(k.m))
  const summe = ks.reduce((s, k) => s + k.w, 0)
  if (summe <= 0) return null
  let lo = 0
  let hi = Math.max(...ks.map((k) => k.a + 25 * Math.max(k.m, 0) + 1))
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2
    const f = ks.reduce((s, k) => s + k.w * cdf(k, mid), 0) / summe
    if (f < p) lo = mid
    else hi = mid
  }
  return hi
}

/** Kennzahlen über den ganzen Lauf */
export function gesamtKennzahlen(mission: Mission, z: Zustand): Gesamtkennzahlen {
  const s = z.summen
  const v = z.verlauf
  const p95 = v.map((p) => p.p95).filter((x): x is number => x !== null)
  const p50 = v.map((p) => p.p50).filter((x): x is number => x !== null)
  const kosten = z.kosten.betrieb + z.kosten.massnahmen
  return {
    verfuegbarkeit: s.angefragt > 0 ? s.erfolgreich / s.angefragt : 1,
    fehlerquote: s.angefragt > 0 ? s.fehler / s.angefragt : 0,
    p50Median: median(p50),
    p95Median: median(p95),
    p95Max: p95.length > 0 ? Math.max(...p95) : null,
    sloQuote: v.length > 0 ? v.filter((p) => p.sloOk).length / v.length : 0,
    durchsatzMittel: v.length > 0 ? v.reduce((a, p) => a + p.durchsatz, 0) / v.length : 0,
    kosten,
    kostenBetrieb: z.kosten.betrieb,
    kostenMassnahmen: z.kosten.massnahmen,
    budget: mission.budget,
    rueckstauEnde: v.length > 0 ? v[v.length - 1].rueckstau : 0,
    rueckstauMax: v.reduce((a, p) => Math.max(a, p.rueckstau), 0),
    kritischVerloren: s.kritischVerloren,
    verlorenQuote: s.kritischAngefragt > 0 ? s.kritischVerloren / s.kritischAngefragt : 0,
    nachrichtenVerloren: s.nachrichtenVerloren,
    degradiertQuote: s.erfolgreich > 0 ? s.degradiert / s.erfolgreich : 0,
  }
}
