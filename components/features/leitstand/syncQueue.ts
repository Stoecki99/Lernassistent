// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// components/features/leitstand/syncQueue.ts
// Sende-Logik des Aktionsprotokolls ohne React und ohne Browser-Objekte (Spezifikation 4.6, 4.8 «useRunSync»).
// useRunSync.ts bindet sie an Zeitgeber und Seitenereignisse; tests/leitstand-sync.test.ts prüft sie mit einer Fake-API.
//
// Regeln:
// - Reihenfolge bleibt erhalten; höchstens eine Anfrage gleichzeitig (keine Doppelsendung).
// - 409 mit actionCount im Bereich fromIndex < actionCount ≤ fromIndex + Paketgrösse: Die Antwort ging verloren,
//   der Server hat den Anfang des Pakets schon. Dieser Teil gilt als bestätigt, die Warteschlange wird gekürzt.
// - 409 sonst: Konflikt, Senden endet (Lauf neu laden).
// - 400/403/404/422: abgelehnt, Senden endet (Lauf neu laden).
// - 401: Anmeldung abgelaufen; Senden endet, die Sicherung im Browser bleibt erhalten.
// - 429, 5xx, keine Antwort: später erneut, mit wachsendem Abstand oder nach Retry-After.

import { z } from "zod"
import type { Action } from "@/lib/simulation/core"
import { actionSchema } from "@/lib/validations/simulation"
import { ApiError } from "./api"

export type SyncStatus = "gespeichert" | "ausstehend" | "speichert" | "offline" | "fehler" | "abgemeldet"

/** Höchstens so viele Aktionen je Anfrage (appendActionsSchema: 1–200) */
export const MAX_PER_REQUEST = 200
/** keepalive-Anfragen dürfen höchstens 64 KB tragen; kleine Pakete bleiben sicher darunter */
export const MAX_PER_KEEPALIVE = 40
/** Wartezeit vor dem ersten neuen Versuch; verdoppelt sich bis RETRY_MAX_MS */
export const RETRY_BASE_MS = 2_000
export const RETRY_MAX_MS = 60_000

export interface PendingBackup {
  fromIndex: number
  actions: Action[]
}

const backupSchema = z.object({
  fromIndex: z.number().int().min(0),
  actions: z.array(actionSchema),
})

/**
 * Ausstehende Aktionen aus einer Sicherung, passend zum Stand des Servers.
 * - fromIndex = serverCount: alle Aktionen fehlen noch auf dem Server
 * - fromIndex < serverCount ≤ fromIndex + Länge: der Anfang ist schon gespeichert (verlorene Antwort), Rest weiterverwenden
 * - sonst (Lücke, Server weiter, ungültige Daten): null = Sicherung verwerfen
 */
export function resumePending(raw: unknown, serverCount: number): Action[] | null {
  const parsed = backupSchema.safeParse(raw)
  if (!parsed.success) return null
  const { fromIndex, actions } = parsed.data
  if (fromIndex > serverCount) return null
  const done = serverCount - fromIndex
  if (done > actions.length) return null
  return actions.slice(done)
}

/** Wartezeit vor dem n-ten neuen Versuch (n ≥ 1); Retry-After des Servers hat Vorrang */
export function retryDelay(attempt: number, retryAfterMs?: number): number {
  if (retryAfterMs !== undefined && retryAfterMs >= 0) return Math.min(retryAfterMs, 5 * RETRY_MAX_MS)
  return Math.min(RETRY_MAX_MS, RETRY_BASE_MS * 2 ** Math.max(0, attempt - 1))
}

export interface SyncApi {
  appendActions(id: string, fromIndex: number, actions: Action[], keepalive?: boolean): Promise<{ actionCount: number }>
}

export interface SyncQueueOptions {
  api: SyncApi
  runId: string
  /** Aktionen, die der Server beim Laden kannte */
  confirmed: number
  /** Beim Laden bereits ausstehende Aktionen (aus der Sicherung) */
  pending?: Action[]
  /** Sicherung schreiben (null = löschen) */
  saveBackup?: (backup: PendingBackup | null) => void
  onStatus?: (status: SyncStatus) => void
  onConflict?: (message: string) => void
  onRejected?: (message: string) => void
  onAuthExpired?: () => void
  /** Zeitgeber für neue Versuche (Tests: Fake); liefert eine Abbruchfunktion */
  schedule?: (fn: () => void, ms: number) => () => void
}

const REJECTED = new Set([400, 403, 404, 413, 422])

/** Warteschlange der ungesendeten Aktionen eines Laufs */
export class SyncQueue {
  private readonly opts: SyncQueueOptions
  private confirmedCount: number
  private queue: Action[]
  private inflight: Promise<boolean> | null = null
  private stoppedFlag = false
  private attempt = 0
  private cancelRetry: (() => void) | null = null
  private currentStatus: SyncStatus

  constructor(opts: SyncQueueOptions) {
    this.opts = opts
    this.confirmedCount = opts.confirmed
    this.queue = [...(opts.pending ?? [])]
    this.currentStatus = this.queue.length > 0 ? "ausstehend" : "gespeichert"
  }

  get confirmed(): number {
    return this.confirmedCount
  }
  get pendingCount(): number {
    return this.queue.length
  }
  get stopped(): boolean {
    return this.stoppedFlag
  }
  get status(): SyncStatus {
    return this.currentStatus
  }
  get busy(): boolean {
    return this.inflight !== null
  }

  /** Aktion anhängen (nach erfolgreicher Anwendung im Browser) */
  push(action: Action): void {
    if (this.stoppedFlag) return
    this.queue.push(action)
    this.backup()
    if (this.currentStatus !== "speichert" && this.currentStatus !== "offline") this.setStatus("ausstehend")
  }

  /**
   * Alles Ausstehende senden. Läuft schon eine Sendung, wird sie abgewartet und danach der Rest gesendet.
   * Liefert true, wenn danach nichts mehr aussteht.
   */
  flush(keepalive = false): Promise<boolean> {
    if (this.inflight) {
      if (keepalive) return this.inflight
      return this.inflight.then(() => this.flush())
    }
    const p = this.send(keepalive).finally(() => {
      this.inflight = null
    })
    this.inflight = p
    return p
  }

  /** Zeitgeber aufräumen (Komponente verlässt die Seite) */
  dispose(): void {
    this.cancelRetry?.()
    this.cancelRetry = null
  }

  private setStatus(status: SyncStatus): void {
    if (status === this.currentStatus) return
    this.currentStatus = status
    this.opts.onStatus?.(status)
  }

  private backup(): void {
    this.opts.saveBackup?.(this.queue.length > 0 ? { fromIndex: this.confirmedCount, actions: [...this.queue] } : null)
  }

  private stop(status: SyncStatus, clearBackup: boolean): void {
    this.stoppedFlag = true
    this.dispose()
    if (clearBackup) this.opts.saveBackup?.(null)
    this.setStatus(status)
  }

  /** Server hat count Aktionen bestätigt: Warteschlange um den bestätigten Teil kürzen */
  private acknowledge(count: number): void {
    const done = count - this.confirmedCount
    this.confirmedCount = count
    this.queue = this.queue.slice(done)
    this.backup()
  }

  private scheduleRetry(retryAfterMs?: number): void {
    if (this.cancelRetry || this.stoppedFlag) return
    this.attempt += 1
    const schedule = this.opts.schedule ?? defaultSchedule
    this.cancelRetry = schedule(() => {
      this.cancelRetry = null
      void this.flush()
    }, retryDelay(this.attempt, retryAfterMs))
  }

  private async send(keepalive: boolean): Promise<boolean> {
    if (this.stoppedFlag) return this.queue.length === 0
    while (this.queue.length > 0) {
      const batch = this.queue.slice(0, keepalive ? MAX_PER_KEEPALIVE : MAX_PER_REQUEST)
      const fromIndex = this.confirmedCount
      this.setStatus("speichert")
      try {
        const res = await this.opts.api.appendActions(this.opts.runId, fromIndex, batch, keepalive)
        if (res.actionCount !== fromIndex + batch.length) {
          // Unerwartete Antwort: wie Konflikt behandeln, statt Aktionen doppelt zu senden
          this.stop("fehler", true)
          this.opts.onConflict?.("Der gespeicherte Stand passt nicht zum Browser.")
          return false
        }
        this.acknowledge(res.actionCount)
        this.attempt = 0
        this.cancelRetry?.()
        this.cancelRetry = null
      } catch (error) {
        const status = error instanceof ApiError ? error.status : 0
        if (status === 409 && error instanceof ApiError) {
          const count = error.actionCount
          if (count !== undefined && count > fromIndex && count <= fromIndex + batch.length) {
            // Die letzte Antwort ging verloren: Anfang des Pakets ist gespeichert, Rest weitersenden
            this.acknowledge(count)
            continue
          }
          this.stop("fehler", true)
          this.opts.onConflict?.(error.message)
          return false
        }
        if (status === 401) {
          this.stop("abgemeldet", false)
          this.opts.onAuthExpired?.()
          return false
        }
        if (REJECTED.has(status) && error instanceof ApiError) {
          this.stop("fehler", true)
          this.opts.onRejected?.(error.message)
          return false
        }
        // 429, 5xx oder keine Antwort: Sicherung bleibt, später erneut
        this.setStatus("offline")
        this.scheduleRetry(error instanceof ApiError ? error.retryAfterMs : undefined)
        return false
      }
    }
    this.setStatus("gespeichert")
    return true
  }
}

function defaultSchedule(fn: () => void, ms: number): () => void {
  const id = setTimeout(fn, ms)
  return () => clearTimeout(id)
}
