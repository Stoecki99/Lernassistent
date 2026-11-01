// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// components/features/architektur-leitstand/api.ts
// Client für die API des Architektur-Leitstands (docs/architektur-leitstand.md).
// Zwei Umsetzungen hinter derselben Schnittstelle (wie der Leitstand):
// - httpApi: echte Routen unter /api/archsim/runs
// - mockApi.ts: Attrappe im Browser-Speicher, nur für die Entwicklung der Oberfläche
// Die Wahl trifft ARCHSIM_API (unten). Die Attrappe wird nur ausserhalb der Produktion und nur dynamisch geladen.
// Diese Datei importiert vom Simulator-Kern ausschliesslich Typen.

import type { Aktion, AnforderungErgebnis, ArchModell, Phase } from "@/lib/archsim"
import type { GespeichertesErgebnis, LaufStatus, LaufZusammenfassung } from "@/lib/architektur-leitstand-regeln"

export type { LaufStatus, LaufZusammenfassung, GespeichertesErgebnis }

export interface LaufListenEintrag {
  id: string
  missionId: string
  status: LaufStatus
  seedReused: boolean
  aktionCount: number
  tick: number
  summary: LaufZusammenfassung | null
  score: number | null
  stars: number | null
  pointsAwarded: number
  createdAt: string
  finishedAt: string | null
}

export interface MissionsStand {
  missionId: string
  bestwert: { score: number; stars: number; laufId: string } | null
  sterne: number
  aktiv: { laufId: string; minute: number; modellGesetzt: boolean } | null
  freigeschaltet: boolean
}

export interface LaeufeAntwort {
  laeufe: LaufListenEintrag[]
  missionen: MissionsStand[]
}

export interface StartAntwort {
  id: string
  missionId: string
  seed: number
  seedReused: boolean
  missionVersion: number
  engineVersion: number
}

export interface LaufDetail {
  id: string
  missionId: string
  missionVersion: number
  engineVersion: number
  seed: number
  seedReused: boolean
  status: LaufStatus
  aktionen: Aktion[]
  aktionCount: number
  modell: ArchModell | null
  ergebnis: GespeichertesErgebnis | null
  pointsAwarded: number
  veraltet: boolean
}

export interface AnhangAntwort {
  aktionCount: number
  tick: number
  phase: Phase
  zusammenfassung: LaufZusammenfassung
}

export interface NeuesAbzeichen {
  name: string
  icon?: string
  description?: string
  points?: number
}

export interface AbschlussAntwort {
  ergebnis: GespeichertesErgebnis
  neueAbzeichen: NeuesAbzeichen[]
  bestwertVerbessert: boolean
  punkte: number
}

export interface ModellAntwort {
  ok: true
  anforderungen: AnforderungErgebnis[]
}

/** Fehler der API mit HTTP-Status (0 = keine Antwort, z. B. offline) und Zusatzangaben */
export class ApiFehler extends Error {
  readonly status: number
  readonly index?: number
  readonly aktionCount?: number
  readonly retryAfterMs?: number
  readonly code?: string
  readonly details: string[]
  constructor(
    status: number,
    message: string,
    extra: { index?: number; aktionCount?: number; retryAfterMs?: number; code?: string; details?: string[] } = {},
  ) {
    super(message)
    this.name = "ApiFehler"
    this.status = status
    this.index = extra.index
    this.aktionCount = extra.aktionCount
    this.retryAfterMs = extra.retryAfterMs
    this.code = extra.code
    this.details = extra.details ?? []
  }
}

/** Retry-After in Millisekunden (Sekunden oder HTTP-Datum); ungültig → undefined */
export function retryAfterLesen(value: string | null, now: number = Date.now()): number | undefined {
  if (!value) return undefined
  const sekunden = Number(value)
  if (Number.isFinite(sekunden) && sekunden >= 0) return sekunden * 1000
  const datum = Date.parse(value)
  return Number.isFinite(datum) ? Math.max(0, datum - now) : undefined
}

export interface ArchApi {
  readonly kind: "http" | "attrappe"
  laeufe(missionId?: string): Promise<LaeufeAntwort>
  starten(missionId: string, wiederholungVon?: string): Promise<StartAntwort>
  lauf(id: string): Promise<LaufDetail>
  aktionenAnhaengen(id: string, abIndex: number, aktionen: Aktion[], keepalive?: boolean): Promise<AnhangAntwort>
  modellSetzen(id: string, modell: ArchModell): Promise<ModellAntwort>
  abschliessen(id: string): Promise<AbschlussAntwort>
  abbrechen(id: string): Promise<void>
}

// ---------- Echte API ----------

async function anfrage<T>(url: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(url, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
      cache: "no-store",
    })
  } catch {
    throw new ApiFehler(0, "Keine Verbindung zum Server.")
  }
  let body: unknown = null
  try {
    body = await response.json()
  } catch {
    body = null
  }
  if (!response.ok) {
    const d = (body ?? {}) as { error?: unknown; index?: unknown; aktionCount?: unknown; code?: unknown; details?: unknown }
    throw new ApiFehler(response.status, typeof d.error === "string" ? d.error : "Die Anfrage ist fehlgeschlagen.", {
      index: typeof d.index === "number" ? d.index : undefined,
      aktionCount: typeof d.aktionCount === "number" ? d.aktionCount : undefined,
      retryAfterMs: retryAfterLesen(response.headers.get("Retry-After")),
      code: typeof d.code === "string" ? d.code : undefined,
      details: Array.isArray(d.details) ? d.details.filter((x): x is string => typeof x === "string") : [],
    })
  }
  return body as T
}

const basis = "/api/archsim/runs"
const lauf = (id: string) => `${basis}/${encodeURIComponent(id)}`

export const httpApi: ArchApi = {
  kind: "http",
  laeufe: (missionId) => anfrage(missionId ? `${basis}?missionId=${encodeURIComponent(missionId)}` : basis),
  starten: (missionId, wiederholungVon) =>
    anfrage(basis, { method: "POST", body: JSON.stringify(wiederholungVon ? { missionId, wiederholungVon } : { missionId }) }),
  lauf: (id) => anfrage(lauf(id)),
  aktionenAnhaengen: (id, abIndex, aktionen, keepalive = false) =>
    anfrage(`${lauf(id)}/actions`, { method: "POST", body: JSON.stringify({ abIndex, aktionen }), keepalive }),
  modellSetzen: (id, modell) => anfrage(`${lauf(id)}/model`, { method: "POST", body: JSON.stringify({ modell }) }),
  abschliessen: (id) => anfrage(`${lauf(id)}/finish`, { method: "POST", body: "{}" }),
  abbrechen: async (id) => {
    await anfrage(lauf(id), { method: "DELETE" })
  },
}

/**
 * Welche Umsetzung gilt. Für die Entwicklung der Oberfläche ohne Datenbank auf "attrappe" stellen;
 * im Produktions-Build gilt immer http (die Attrappe wird dort nie geladen).
 */
const ARCHSIM_API = "http" as "http" | "attrappe"

/** Attrappe erst beim ersten Aufruf laden (eigener Chunk, nur in der Entwicklung) */
function attrappeLaden(): ArchApi {
  const laden = () => import("./mockApi").then((m) => m.mockApi)
  return {
    kind: "attrappe",
    laeufe: async (...a) => (await laden()).laeufe(...a),
    starten: async (...a) => (await laden()).starten(...a),
    lauf: async (...a) => (await laden()).lauf(...a),
    aktionenAnhaengen: async (...a) => (await laden()).aktionenAnhaengen(...a),
    modellSetzen: async (...a) => (await laden()).modellSetzen(...a),
    abschliessen: async (...a) => (await laden()).abschliessen(...a),
    abbrechen: async (...a) => (await laden()).abbrechen(...a),
  }
}

// NODE_ENV zuerst: im Produktions-Build wird die Bedingung zu false und der Chunk der Attrappe fällt weg
export const archApi: ArchApi = process.env.NODE_ENV !== "production" && ARCHSIM_API === "attrappe" ? attrappeLaden() : httpApi
