// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// components/features/ipma/api.ts
// Client für den REST-Vertrag des Prüfungssimulators (Spezifikation 6.6, Nachtrag 8.5).
// Importiert aus lib/ipma ausschliesslich Typen (Test «Bündel» in tests/ipma-api.test.ts).

import type { AttemptView, FinishView, OverviewView, SolvedItem } from "@/lib/ipma/types"
import type { CompetenceId } from "@/lib/ipma/competences"

/** Fehler der API mit HTTP-Status (0 = keine Antwort, z. B. offline), Code und Zusatzangaben (6.7) */
export class IpmaApiError extends Error {
  readonly status: number
  readonly code: string | null
  readonly activeAttemptId: string | null
  readonly retryAfterMs: number | null
  constructor(status: number, message: string, code: string | null = null, activeAttemptId: string | null = null, retryAfterMs: number | null = null) {
    super(message)
    this.name = "IpmaApiError"
    this.status = status
    this.code = code
    this.activeAttemptId = activeAttemptId
    this.retryAfterMs = retryAfterMs
  }
}

function retryAfter(value: string | null): number | null {
  if (!value) return null
  const seconds = Number(value)
  return Number.isFinite(seconds) && seconds >= 0 ? seconds * 1000 : null
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(url, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
      cache: "no-store",
    })
  } catch {
    throw new IpmaApiError(0, "Keine Verbindung zum Server.")
  }
  let body: unknown = null
  try {
    body = await response.json()
  } catch {
    body = null
  }
  if (!response.ok) {
    const data = (body ?? {}) as { error?: unknown; code?: unknown; activeAttemptId?: unknown }
    throw new IpmaApiError(
      response.status,
      typeof data.error === "string" ? data.error : "Die Anfrage ist fehlgeschlagen.",
      typeof data.code === "string" ? data.code : null,
      typeof data.activeAttemptId === "string" ? data.activeAttemptId : null,
      retryAfter(response.headers.get("Retry-After")),
    )
  }
  return body as T
}

const attemptUrl = (id: string) => `/api/ipma/attempts/${encodeURIComponent(id)}`
const itemUrl = (id: string, position: number) => `${attemptUrl(id)}/items/${position}`

export type CreateAttemptBody =
  | { mode: "exam"; variant: "strict" | "pausable"; replaceActive?: boolean }
  | { mode: "short"; replaceActive?: boolean }
  | { mode: "training"; competences: CompetenceId[]; type: "mc" | "offen" | "beide"; count: number; replaceActive?: boolean }
  | { mode: "gaps"; replaceActive?: boolean }

export interface SaveBody {
  choice?: number | null
  text?: string | null
  flagged?: boolean
}

export const ipmaApi = {
  overview: () => request<OverviewView>("/api/ipma/overview"),
  create: (body: CreateAttemptBody) => request<{ id: string }>("/api/ipma/attempts", { method: "POST", body: JSON.stringify(body) }),
  get: (id: string) => request<AttemptView>(attemptUrl(id)),
  abort: (id: string) => request<{ ok: true }>(attemptUrl(id), { method: "DELETE" }),
  save: (id: string, position: number, body: SaveBody) =>
    request<{ saved: true; answeredCount: number }>(itemUrl(id, position), { method: "PUT", body: JSON.stringify(body) }),
  check: (id: string, position: number) => request<SolvedItem>(`${itemUrl(id, position)}/check`, { method: "POST", body: "{}" }),
  self: (id: string, position: number, scores: number[]) =>
    request<SolvedItem>(`${itemUrl(id, position)}/self`, { method: "PUT", body: JSON.stringify({ scores }) }),
  assess: (id: string, position: number) => request<SolvedItem>(`${itemUrl(id, position)}/assess`, { method: "POST", body: "{}" }),
  pause: (id: string, paused: boolean) =>
    request<{ activeSeconds: number; paused: boolean }>(`${attemptUrl(id)}/pause`, { method: "POST", body: JSON.stringify({ paused }) }),
  submit: (id: string) => request<AttemptView>(`${attemptUrl(id)}/submit`, { method: "POST", body: "{}" }),
  finish: (id: string) => request<FinishView>(`${attemptUrl(id)}/finish`, { method: "POST", body: "{}" }),
}

/** Freundliche Meldung für Fehler beim Start eines Versuchs (6.7) */
export function startErrorMessage(error: unknown): string {
  if (error instanceof IpmaApiError) {
    if (error.code === "POOL_TOO_SMALL") {
      return "Für diesen Modus gibt es noch zu wenige geprüfte Fragen. Der Fragenpool wird laufend ergänzt; im Training kannst du die vorhandenen Fragen schon jetzt üben."
    }
    if (error.status === 429) return "Zu viele Starts in kurzer Zeit. Bitte eine Minute warten."
    if (error.status === 401) return "Deine Anmeldung ist abgelaufen. Bitte neu anmelden."
    if (error.status === 0) return "Keine Verbindung zum Server. Bitte später erneut versuchen."
    if (error.status < 500) return error.message
  }
  return "Der Versuch konnte nicht gestartet werden. Bitte später erneut versuchen."
}

/** Codes der Claude-Bewertung (502), deren Meldung für die Oberfläche bestimmt ist */
const AI_CODES = new Set(["AI_UNAVAILABLE", "AI_INVALID", "AI_REFUSED"])

/** Allgemeine Meldung für einen Fehler (Status 500 nie mit Details) */
export function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof IpmaApiError) {
    if (error.status === 401) return "Deine Anmeldung ist abgelaufen. Bitte neu anmelden."
    if (error.status === 0) return "Keine Verbindung zum Server."
    if (error.status === 429) return error.code === "BUDGET" || error.code === "DAILY_LIMIT" ? error.message : "Zu viele Anfragen. Bitte kurz warten."
    if (error.status < 500 || (error.code !== null && AI_CODES.has(error.code))) return error.message
  }
  return fallback
}

/** Gespeicherter Abschluss (FinishView) für die Auswertungsseite, einmal angezeigt */
export const finishStorageKey = (id: string) => `ipma-abschluss-${id}`
/** Beherrschung vor «Lücken schliessen» (3.5 Vorher/Nachher) */
export const beforeStorageKey = (id: string) => `ipma-vorher-${id}`

export function storeSession(key: string, value: unknown): void {
  try {
    window.sessionStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Gesperrter Speicher: Anzeige entfällt
  }
}

export function readSession(key: string): unknown {
  try {
    const raw = window.sessionStorage.getItem(key)
    return raw === null ? null : (JSON.parse(raw) as unknown)
  } catch {
    return null
  }
}
