// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// components/features/leitstand/api.ts
// Client für den REST-Vertrag des Leitstands (Spezifikation 4.6).
// Zwei Umsetzungen hinter derselben Schnittstelle:
// - httpApi: echte Routen unter /api/simulation (AP3)
// - mockApi: Attrappe im Browser-Speicher (localStorage), nur für die Entwicklung der Oberfläche
// Die Wahl trifft LEITSTAND_API (unten). Die Attrappe spielt das Protokoll mit demselben Rechenkern nach,
// damit 409/422 genauso entstehen wie auf dem Server.

import {
  ENGINE_VERSION,
  SimError,
  computeKpis,
  replay,
  type Action,
  type RunPhase,
  type RunResult,
  type Scenario,
} from "@/lib/simulation"

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

/** Fehler der API mit HTTP-Status; bei 422 zusätzlich der Index der fehlerhaften Aktion. */
export class ApiError extends Error {
  readonly status: number
  readonly index?: number
  constructor(status: number, message: string, index?: number) {
    super(message)
    this.name = "ApiError"
    this.status = status
    this.index = index
  }
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
    const data = (body ?? {}) as { error?: unknown; index?: unknown }
    const message = typeof data.error === "string" ? data.error : "Die Anfrage ist fehlgeschlagen."
    const index = typeof data.index === "number" ? data.index : undefined
    throw new ApiError(response.status, message, index)
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

// ---------- Attrappe im Browser-Speicher ----------

const MOCK_KEY = "leitstand-attrappe-v1"

interface MockRun extends RunDetail {
  tick: number
  summary: RunSummary | null
  score: number | null
  stars: number | null
  scoreDetail: RunResult | null
  createdAt: string
  updatedAt: string
  finishedAt: string | null
}

function readMock(): MockRun[] {
  try {
    const raw = window.localStorage.getItem(MOCK_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? (parsed as MockRun[]) : []
  } catch {
    return []
  }
}

function writeMock(runs: MockRun[]): void {
  try {
    window.localStorage.setItem(MOCK_KEY, JSON.stringify(runs))
  } catch {
    // Speicher voll oder gesperrt: Attrappe arbeitet dann nur bis zum Neuladen
  }
}

function mockId(): string {
  const bytes = new Uint8Array(12)
  crypto.getRandomValues(bytes)
  return "c" + Array.from(bytes, (b) => (b % 36).toString(36)).join("") + Date.now().toString(36).slice(-6)
}

function mockSeed(): number {
  const v = new Uint32Array(1)
  crypto.getRandomValues(v)
  return 1 + (v[0] % 2147483646)
}

/** Szenario-Lader für die Attrappe; wird von der Lauf-Ansicht gesetzt (vermeidet den grossen JSON-Import auf der Startseite). */
type ScenarioLoader = (id: string) => Promise<Scenario | null>
let mockScenarioLoader: ScenarioLoader | null = null
export function setMockScenarioLoader(loader: ScenarioLoader): void {
  mockScenarioLoader = loader
}

async function mockScenario(id: string): Promise<Scenario> {
  const loader = mockScenarioLoader ?? (await import("./scenarioLoader")).loadClientScenario
  const scenario = await loader(id)
  if (!scenario) throw new ApiError(400, "Unbekanntes Szenario.")
  return scenario
}

function toListItem(run: MockRun): RunListItem {
  return {
    id: run.id,
    scenarioId: run.scenarioId,
    status: run.status,
    tick: run.tick,
    actionCount: run.actions.length,
    seedReused: run.seedReused,
    summary: run.summary,
    score: run.score,
    stars: run.stars,
    createdAt: run.createdAt,
    updatedAt: run.updatedAt,
    finishedAt: run.finishedAt,
  }
}

export const mockApi: LeitstandApi = {
  kind: "attrappe",
  async listRuns(scenarioId) {
    const runs = readMock()
      .filter((r) => r.scenarioId === scenarioId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    const scored = runs.filter((r) => r.score !== null && !r.seedReused)
    const bestRun = scored.sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0]
    return {
      runs: runs.slice(0, 20).map(toListItem),
      best: bestRun ? { score: bestRun.score ?? 0, stars: bestRun.stars ?? 0, runId: bestRun.id } : null,
    }
  },
  async createRun(scenarioId, repeatOfRunId) {
    const scenario = await mockScenario(scenarioId)
    const runs = readMock()
    const repeat = repeatOfRunId ? runs.find((r) => r.id === repeatOfRunId && r.status === "abgeschlossen") : undefined
    for (const r of runs) if (r.scenarioId === scenarioId && r.status === "aktiv") r.status = "abgebrochen"
    const now = new Date().toISOString()
    const run: MockRun = {
      id: mockId(),
      scenarioId,
      seed: repeat ? repeat.seed : mockSeed(),
      status: "aktiv",
      actions: [],
      scenarioVersion: scenario.version,
      engineVersion: ENGINE_VERSION,
      seedReused: Boolean(repeat),
      tick: 0,
      summary: null,
      score: null,
      stars: null,
      scoreDetail: null,
      createdAt: now,
      updatedAt: now,
      finishedAt: null,
    }
    runs.push(run)
    writeMock(runs)
    return { id: run.id, seed: run.seed, scenarioVersion: run.scenarioVersion, engineVersion: run.engineVersion }
  },
  async getRun(id) {
    const run = readMock().find((r) => r.id === id)
    if (!run) throw new ApiError(404, "Lauf nicht gefunden.")
    const { id: rid, scenarioId, seed, status, actions, scenarioVersion, engineVersion, seedReused } = run
    return { id: rid, scenarioId, seed, status, actions, scenarioVersion, engineVersion, seedReused }
  },
  async appendActions(id, fromIndex, actions) {
    const runs = readMock()
    const run = runs.find((r) => r.id === id)
    if (!run) throw new ApiError(404, "Lauf nicht gefunden.")
    if (run.status !== "aktiv") throw new ApiError(409, "Der Lauf ist nicht mehr aktiv.")
    if (fromIndex !== run.actions.length) throw new ApiError(409, "Konflikt: Der Lauf wurde anderswo weitergespielt.")
    const scenario = await mockScenario(run.scenarioId)
    const all = [...run.actions, ...actions]
    try {
      const state = replay(scenario, run.seed, all)
      const k = computeKpis(state, scenario)
      run.actions = all
      run.tick = state.tick
      run.summary = {
        tag: k.day,
        phase: state.phase,
        spi: k.spi,
        cpi: k.cpi,
        qi: k.qi,
        motivation: k.teamMotivation,
        si: k.si,
        rmi: k.rmi,
      }
      run.updatedAt = new Date().toISOString()
      writeMock(runs)
      return { actionCount: all.length, tick: state.tick, phase: state.phase, summary: run.summary }
    } catch (error) {
      if (error instanceof SimError) throw new ApiError(422, error.message, error.actionIndex)
      throw error
    }
  },
  async finishRun(id) {
    const runs = readMock()
    const run = runs.find((r) => r.id === id)
    if (!run) throw new ApiError(404, "Lauf nicht gefunden.")
    if (run.status === "abgeschlossen" && run.scoreDetail) {
      return { result: run.scoreDetail, newBadges: [], improvedBest: false, pointsAwarded: 0 }
    }
    const scenario = await mockScenario(run.scenarioId)
    const state = replay(scenario, run.seed, run.actions)
    if (state.phase !== "abgeschlossen" || !state.result) throw new ApiError(422, "Der Lauf ist noch nicht abgeschlossen.")
    const previousBest = runs
      .filter((r) => r.scenarioId === run.scenarioId && r.score !== null && !r.seedReused && r.id !== run.id)
      .reduce((m, r) => Math.max(m, r.score ?? 0), 0)
    run.status = "abgeschlossen"
    run.score = state.result.score.total
    run.stars = state.result.stars
    run.scoreDetail = state.result
    run.finishedAt = new Date().toISOString()
    writeMock(runs)
    const improvedBest = !run.seedReused && run.score > previousBest
    return { result: state.result, newBadges: [], improvedBest, pointsAwarded: 0 }
  },
  async abortRun(id) {
    const runs = readMock()
    const run = runs.find((r) => r.id === id)
    if (!run) throw new ApiError(404, "Lauf nicht gefunden.")
    run.status = "abgebrochen"
    writeMock(runs)
  },
}

/**
 * Welche Umsetzung gilt. "http" sobald die Routen aus AP3 bereitstehen.
 * Die Attrappe bleibt für die lokale Entwicklung der Oberfläche erhalten.
 */
const LEITSTAND_API = "http" as "http" | "attrappe"

export const leitstandApi: LeitstandApi = LEITSTAND_API === "http" ? httpApi : mockApi
