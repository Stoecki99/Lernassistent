// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// components/features/architektur-leitstand/mockApi.ts
// Attrappe der API im Browser-Speicher (localStorage), nur für die Entwicklung der Oberfläche ohne Datenbank.
// Spielt das Protokoll mit demselben Kern und denselben Regeln nach wie der Server, damit 409/422 genauso entstehen.
// Wird von api.ts nur dynamisch und nur ausserhalb der Produktion geladen (ARCHSIM_API = "attrappe").

import { ArchSimFehler, ARCHSIM_VERSION, MISSION_IDS, auswerten, beende, ladeMission, validiere, type Mission } from "@/lib/archsim"
import {
  besteSterne,
  ergebnisFuerSpeicher,
  missionFreigeschaltet,
  nachspielen,
  punkteFuerVerbesserung,
  zusammenfassen,
} from "@/lib/architektur-leitstand-regeln"
import { MAX_AKTIONEN_PRO_LAUF } from "@/lib/validations/architektur-leitstand"
import { ApiFehler, type ArchApi, type LaufDetail, type LaufListenEintrag, type MissionsStand } from "./api"

const SCHLUESSEL = "archsim-attrappe-v1"

interface AttrappenLauf extends LaufDetail {
  tick: number
  summary: LaufListenEintrag["summary"]
  score: number | null
  stars: number | null
  createdAt: string
  finishedAt: string | null
}

function lesen(): AttrappenLauf[] {
  try {
    const roh = window.localStorage.getItem(SCHLUESSEL)
    const p: unknown = roh ? JSON.parse(roh) : []
    return Array.isArray(p) ? (p as AttrappenLauf[]) : []
  } catch {
    return []
  }
}

function schreiben(l: AttrappenLauf[]): void {
  try {
    window.localStorage.setItem(SCHLUESSEL, JSON.stringify(l))
  } catch {
    // Speicher voll oder gesperrt
  }
}

function neueId(): string {
  const b = new Uint8Array(12)
  crypto.getRandomValues(b)
  return "c" + Array.from(b, (x) => (x % 36).toString(36)).join("") + Date.now().toString(36).slice(-6)
}

function neuerSeed(): number {
  const v = new Uint32Array(1)
  crypto.getRandomValues(v)
  return 1 + (v[0] % 2147483646)
}

function mission(id: string): Mission {
  const m = ladeMission(id)
  if (!m) throw new ApiFehler(400, "Unbekannte Mission.")
  return m
}

function finden(laeufe: AttrappenLauf[], id: string): AttrappenLauf {
  const l = laeufe.find((x) => x.id === id)
  if (!l) throw new ApiFehler(404, "Lauf nicht gefunden.")
  return l
}

export const mockApi: ArchApi = {
  kind: "attrappe",
  async laeufe(missionId) {
    const alle = lesen().sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    const sterne = besteSterne(alle)
    const missionen: MissionsStand[] = MISSION_IDS.map((id) => {
      const best = alle
        .filter((l) => l.missionId === id && l.status === "abgeschlossen" && !l.seedReused && l.score !== null)
        .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0]
      const aktiv = alle.find((l) => l.missionId === id && l.status === "aktiv")
      return {
        missionId: id,
        bestwert: best ? { score: best.score ?? 0, stars: best.stars ?? 0, laufId: best.id } : null,
        sterne: sterne[id] ?? 0,
        aktiv: aktiv ? { laufId: aktiv.id, minute: aktiv.tick, modellGesetzt: aktiv.modell !== null } : null,
        freigeschaltet: missionFreigeschaltet(MISSION_IDS, id, sterne),
      }
    })
    const laeufe: LaufListenEintrag[] = alle
      .filter((l) => !missionId || l.missionId === missionId)
      .slice(0, 30)
      .map((l) => ({
        id: l.id,
        missionId: l.missionId,
        status: l.status,
        seedReused: l.seedReused,
        aktionCount: l.aktionen.length,
        tick: l.tick,
        summary: l.summary,
        score: l.score,
        stars: l.stars,
        pointsAwarded: l.pointsAwarded,
        createdAt: l.createdAt,
        finishedAt: l.finishedAt,
      }))
    return { laeufe, missionen }
  },
  async starten(missionId, wiederholungVon) {
    const m = mission(missionId)
    const alle = lesen()
    if (!missionFreigeschaltet(MISSION_IDS, missionId, besteSterne(alle))) throw new ApiFehler(409, "Diese Mission ist noch gesperrt.", { code: "LOCKED" })
    const quelle = wiederholungVon ? alle.find((l) => l.id === wiederholungVon && l.status === "abgeschlossen") : undefined
    if (wiederholungVon && !quelle) throw new ApiFehler(404, "Lauf zum Wiederholen nicht gefunden.")
    for (const l of alle) if (l.missionId === missionId && l.status === "aktiv") l.status = "abgebrochen"
    const jetzt = new Date().toISOString()
    const lauf: AttrappenLauf = {
      id: neueId(),
      missionId,
      missionVersion: m.version,
      engineVersion: ARCHSIM_VERSION,
      seed: quelle ? quelle.seed : neuerSeed(),
      seedReused: Boolean(quelle),
      status: "aktiv",
      aktionen: [],
      aktionCount: 0,
      modell: quelle && m.art === "modellieren" ? quelle.modell : null,
      ergebnis: null,
      pointsAwarded: 0,
      veraltet: false,
      tick: 0,
      summary: null,
      score: null,
      stars: null,
      createdAt: jetzt,
      finishedAt: null,
    }
    alle.push(lauf)
    schreiben(alle)
    return { id: lauf.id, missionId, seed: lauf.seed, seedReused: lauf.seedReused, missionVersion: lauf.missionVersion, engineVersion: lauf.engineVersion }
  },
  async lauf(id) {
    const l = finden(lesen(), id)
    return { ...l, aktionCount: l.aktionen.length }
  },
  async aktionenAnhaengen(id, abIndex, aktionen) {
    const alle = lesen()
    const l = finden(alle, id)
    if (l.status !== "aktiv") throw new ApiFehler(409, "Der Lauf ist nicht mehr aktiv.")
    if (abIndex !== l.aktionen.length) throw new ApiFehler(409, "Konflikt: Der Lauf wurde anderswo weitergespielt.", { aktionCount: l.aktionen.length })
    const m = mission(l.missionId)
    const neu = [...l.aktionen, ...aktionen]
    if (neu.length > MAX_AKTIONEN_PRO_LAUF) throw new ApiFehler(422, `Höchstens ${MAX_AKTIONEN_PRO_LAUF} Aktionen je Lauf.`)
    try {
      const z = nachspielen(m, l.seed, neu, l.modell ?? undefined)
      l.aktionen = neu
      l.aktionCount = neu.length
      l.tick = z.tick
      l.summary = zusammenfassen(m, z)
      schreiben(alle)
      return { aktionCount: neu.length, tick: z.tick, phase: z.phase, zusammenfassung: l.summary }
    } catch (e) {
      if (e instanceof ArchSimFehler) throw new ApiFehler(422, e.message, { index: e.aktionIndex })
      throw e
    }
  },
  async modellSetzen(id, modell) {
    const alle = lesen()
    const l = finden(alle, id)
    const m = mission(l.missionId)
    if (m.art !== "modellieren") throw new ApiFehler(400, "Diese Mission hat ein vorgegebenes Modell.")
    if (l.aktionen.length > 0) throw new ApiFehler(409, "Der Lasttest läuft schon.", { aktionCount: l.aktionen.length })
    const v = validiere(m, modell)
    if (!v.gueltig) throw new ApiFehler(422, "Das Modell ist noch nicht lauffähig.", { details: v.fehler })
    l.modell = modell
    schreiben(alle)
    return { ok: true, anforderungen: v.anforderungen }
  },
  async abschliessen(id) {
    const alle = lesen()
    const l = finden(alle, id)
    if (l.status === "abgeschlossen" && l.ergebnis) return { ergebnis: l.ergebnis, neueAbzeichen: [], bestwertVerbessert: false, punkte: l.pointsAwarded }
    const m = mission(l.missionId)
    const z = nachspielen(m, l.seed, l.aktionen, l.modell ?? undefined)
    if (z.phase !== "beendet") throw new ApiFehler(422, "Die Mission ist noch nicht zu Ende.")
    const e = auswerten(m, beende(m, z))
    const alt = alle
      .filter((x) => x.missionId === l.missionId && x.status === "abgeschlossen" && !x.seedReused && x.score !== null && x.id !== l.id)
      .reduce<number | null>((max, x) => Math.max(max ?? 0, x.score ?? 0), null)
    const punkte = punkteFuerVerbesserung(alt, e.score.total, l.seedReused)
    l.status = "abgeschlossen"
    l.score = e.score.total
    l.stars = e.score.sterne
    l.ergebnis = ergebnisFuerSpeicher(e)
    l.pointsAwarded = punkte
    l.finishedAt = new Date().toISOString()
    schreiben(alle)
    return { ergebnis: l.ergebnis, neueAbzeichen: [], bestwertVerbessert: !l.seedReused && (alt === null || e.score.total > alt), punkte }
  },
  async abbrechen(id) {
    const alle = lesen()
    const l = finden(alle, id)
    if (l.status === "aktiv") l.status = "abgebrochen"
    schreiben(alle)
  },
}
