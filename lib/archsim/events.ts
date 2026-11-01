// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// lib/archsim/events.ts
// Ereignisse (Lastspitze, Ausfall, langsame Abhängigkeit, fehlerhaftes Deployment) und Lastkurve (9.4).

import type { Ereignis, Mission, Zustand } from "./types"

export interface Wirkungen {
  lastFaktor: number
  ausfall: Record<string, true>
  /** Latenzfaktor je Element (höchster aktiver Wert) */
  langsam: Record<string, number>
  /** zusätzliche Fehlerquote je Element */
  deployment: Record<string, number>
  aktiv: string[]
}

export function istAktivIn(e: Ereignis, tick: number): boolean {
  return tick >= e.tick && tick < e.tick + e.dauer
}

/** Status der Ereignisse für Minute `tick` nachführen und Wirkungen sammeln (mutiert z.ereignisse). */
export function ereignisseFuer(mission: Mission, z: Zustand, tick: number): Wirkungen {
  const w: Wirkungen = { lastFaktor: 1, ausfall: {}, langsam: {}, deployment: {}, aktiv: [] }
  const sortiert = [...mission.ereignisse].sort((a, b) => a.tick - b.tick || (a.id < b.id ? -1 : 1))
  for (const e of sortiert) {
    const st = z.ereignisse[e.id] ?? (z.ereignisse[e.id] = { status: "geplant" })
    if (st.status === "behoben") continue
    if (istAktivIn(e, tick)) {
      st.status = "aktiv"
      w.aktiv.push(e.id)
      const wi = e.wirkung
      if (wi.art === "lastspitze") w.lastFaktor *= wi.faktor
      else if (wi.art === "ausfall") w.ausfall[wi.element] = true
      else if (wi.art === "langsam") w.langsam[wi.element] = Math.max(w.langsam[wi.element] ?? 1, wi.faktor)
      else w.deployment[wi.element] = (w.deployment[wi.element] ?? 0) + wi.fehlerquote
    } else if (tick >= e.tick + e.dauer) {
      st.status = "vorbei"
    }
  }
  return w
}

/** Grundlast der Lastkurve in Anfragen/s (linear zwischen den Punkten, ausserhalb konstant) */
export function grundlast(mission: Mission, tick: number): number {
  const p = mission.last.punkte
  if (p.length === 0) return 0
  if (tick <= p[0].t) return p[0].rps
  for (let i = 1; i < p.length; i++) {
    if (tick <= p[i].t) {
      const a = p[i - 1]
      const b = p[i]
      const f = b.t === a.t ? 1 : (tick - a.t) / (b.t - a.t)
      return a.rps + (b.rps - a.rps) * f
    }
  }
  return p[p.length - 1].rps
}

/** Aktives fehlerhaftes Deployment am Element? */
export function deploymentAktiv(mission: Mission, z: Zustand, element: string): Ereignis | null {
  for (const e of mission.ereignisse) {
    if (e.wirkung.art !== "deployment" || e.wirkung.element !== element) continue
    if (z.ereignisse[e.id]?.status === "aktiv") return e
  }
  return null
}
