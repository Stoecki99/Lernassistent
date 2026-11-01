// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// components/features/leitstand/api.ts
// Client für den REST-Vertrag des Leitstands (Spezifikation 4.6).
// Zwei Umsetzungen hinter derselben Schnittstelle:
// - httpApi: echte Routen unter /api/simulation (AP3)
// - mockApi.ts: Attrappe im Browser-Speicher, nur für die Entwicklung der Oberfläche
// Die Wahl trifft LEITSTAND_API (unten). Die Attrappe wird nur in der Entwicklung und nur dynamisch
// geladen, damit Rechenkern und Szenarien nicht im Bündel der Startseite landen (Befund Bundle).
// Diese Datei importiert vom Rechenkern ausschliesslich Typen.

import type { Action, RunPhase, RunResult } from "@/lib/simulation/core"

export type RunStatus = "aktiv" | "abgeschlossen" | "abgebrochen" | "veraltet"

export interface RunSummary {
  tag: number
  phase: RunPhase
  spi: number
  cpi: number
  qi: number
  motivation: number
  si: number
  rmi: number
}

export interface RunListItem {
  id: string
  scenarioId: string
  status: RunStatus
  tick: number
  actionCount: number
  seedReused: boolean
  summary: RunSummary | null
  score: number | null
  stars: number | null
  createdAt: string
  updatedAt: string
  finishedAt: string | null
}

export interface RunListResponse {
  runs: RunListItem[]
  best: { score: number; stars: number; runId: string } | null
}

export interface CreateRunResponse {
  id: string
  seed: number
  scenarioVersion: string
  engineVersion: number
}

export interface RunDetail {
  id: string
  scenarioId: string
  seed: number
  status: RunStatus
  actions: Action[]
  scenarioVersion: string
  engineVersion: number
  seedReused: boolean
}

export interface AppendResponse {
  actionCount: number
  tick: number
  phase: RunPhase
  summary: RunSummary | null
}

export interface NewBadge {
  name: string
  icon?: string
  description?: string
}

export interface FinishResponse {
  result: RunResult
  newBadges: NewBadge[]
  improvedBest: boolean
  pointsAwarded: number
}

/** Zusatzangaben einer Fehlerantwort */
export interface ApiErrorDetails {
  /** 422: Index der fehlerhaften Aktion im Gesamtprotokoll */
  index?: number
  /** 409: Anzahl Aktionen, die der Server gespeichert hat */
  actionCount?: number
  /** 429/503: Wartezeit in Millisekunden aus Retry-After */
  retryAfterMs?: number
}

/** Fehler der API mit HTTP-Status (0 = keine Antwort, z. B. offline) und Zusatzangaben. */
export class ApiError extends Error {
  readonly status: number
  readonly index?: number
  readonly actionCount?: number
  readonly retryAfterMs?: number
  constructor(status: number, message: string, details: ApiErrorDetails = {}) {
    super(message)
    this.name = "ApiError"
    this.status = status
    this.index = details.index
    this.actionCount = details.actionCount
    this.retryAfterMs = details.retryAfterMs
  }
}

/** Retry-After in Millisekunden (Sekunden oder HTTP-Datum); ungültig → undefined */
export function parseRetryAfter(value: string | null, now: number = Date.now()): number | undefined {
  if (!value) return undefined
  const seconds = Number(value)
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000
  const date = Date.parse(value)
  return Number.isFinite(date) ? Math.max(0, date - now) : undefined
}

export interface LeitstandApi {
  readonly kind: "http" | "attrappe"
  listRuns(scenarioId: string): Promise<RunListResponse>
  createRun(scenarioId: string, repeatOfRunId?: string): Promise<CreateRunResponse>
  getRun(id: string): Promise<RunDetail>
  appendActions(id: string, fromIndex: number, actions: Action[], keepalive?: boolean): Promise<AppendResponse>
  finishRun(id: string): Promise<FinishResponse>
  abortRun(id: string): Promise<void>
}

// ---------- Echte API (AP3) ----------

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    cache: "no-store",
  })
  let body: unknown = null
  try {
    body = await response.json()
  } catch {
    body = null
  }
  if (!response.ok) {
    const data = (body ?? {}) as { error?: unknown; index?: unknown; actionCount?: unknown }
    const message = typeof data.error === "string" ? data.error : "Die Anfrage ist fehlgeschlagen."
    throw new ApiError(response.status, message, {
      index: typeof data.index === "number" ? data.index : undefined,
      actionCount: typeof data.actionCount === "number" ? data.actionCount : undefined,
      retryAfterMs: parseRetryAfter(response.headers.get("Retry-After")),
    })
  }
  return body as T
}

export const httpApi: LeitstandApi = {
  kind: "http",
  listRuns: (scenarioId) => request(`/api/simulation/runs?scenarioId=${encodeURIComponent(scenarioId)}`),
  createRun: (scenarioId, repeatOfRunId) =>
    request("/api/simulation/runs", {
      method: "POST",
      body: JSON.stringify(repeatOfRunId ? { scenarioId, repeatOfRunId } : { scenarioId }),
    }),
  getRun: (id) => request(`/api/simulation/runs/${encodeURIComponent(id)}`),
  appendActions: (id, fromIndex, actions, keepalive = false) =>
    request(`/api/simulation/runs/${encodeURIComponent(id)}/actions`, {
      method: "POST",
      body: JSON.stringify({ fromIndex, actions }),
      keepalive,
    }),
  finishRun: (id) => request(`/api/simulation/runs/${encodeURIComponent(id)}/finish`, { method: "POST", body: "{}" }),
  abortRun: async (id) => {
    await request(`/api/simulation/runs/${encodeURIComponent(id)}`, { method: "DELETE" })
  },
}

/**
 * Welche Umsetzung gilt. "http" sobald die Routen aus AP3 bereitstehen.
 * Die Attrappe bleibt für die lokale Entwicklung der Oberfläche erhalten; im Produktions-Build gilt immer http.
 */
const LEITSTAND_API = "http" as "http" | "attrappe"

/** Attrappe erst beim ersten Aufruf laden (eigener Chunk, nur in der Entwicklung) */
function lazyMockApi(): LeitstandApi {
  const load = () => import("./mockApi").then((m) => m.mockApi)
  return {
    kind: "attrappe",
    listRuns: async (...a) => (await load()).listRuns(...a),
    createRun: async (...a) => (await load()).createRun(...a),
    getRun: async (...a) => (await load()).getRun(...a),
    appendActions: async (...a) => (await load()).appendActions(...a),
    finishRun: async (...a) => (await load()).finishRun(...a),
    abortRun: async (...a) => (await load()).abortRun(...a),
  }
}

export const leitstandApi: LeitstandApi =
  LEITSTAND_API === "attrappe" && process.env.NODE_ENV !== "production" ? lazyMockApi() : httpApi
