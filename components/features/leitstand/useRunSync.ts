// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

"use client"

// components/features/leitstand/useRunSync.ts
// Synchronisation des Aktionsprotokolls mit der API (Spezifikation 4.6, 4.8 «useRunSync»).
// Sammelt Aktionen und sendet sie: alle 10 Aktionen, alle 20 s, bei Pause, Periodenende und Seitenwechsel.
// Nicht gesendete Aktionen liegen zusätzlich im localStorage, damit ein Neuladen am gleichen Takt weiterspielt.
// Die Sende-Regeln (409 nach verlorener Antwort, 401, 422, neue Versuche) stehen in syncQueue.ts.

import { useCallback, useEffect, useRef, useState } from "react"
import type { Action } from "@/lib/simulation/core"
import type { LeitstandApi } from "./api"
import { SyncQueue, resumePending, type PendingBackup, type SyncStatus } from "./syncQueue"

export type { SyncStatus } from "./syncQueue"

const BATCH_SIZE = 10
const INTERVAL_MS = 20_000

function backupKey(runId: string): string {
  return `leitstand-ausstehend-${runId}`
}

function writeBackup(runId: string, backup: PendingBackup | null): void {
  try {
    if (!backup || backup.actions.length === 0) window.localStorage.removeItem(backupKey(runId))
    else window.localStorage.setItem(backupKey(runId), JSON.stringify(backup))
  } catch {
    // Gesperrter Speicher: dann gilt nur der Versand an die API
  }
}

/**
 * Ausstehende Aktionen aus dem letzten Besuch (mit Zod geprüft). Ist der Anfang schon auf dem Server
 * (verlorene Antwort), wird nur der Rest übernommen; passt die Sicherung nicht, wird sie verworfen.
 */
export function readPendingBackup(runId: string, serverCount: number): Action[] {
  try {
    const raw = window.localStorage.getItem(backupKey(runId))
    if (!raw) return []
    const rest = resumePending(JSON.parse(raw) as unknown, serverCount)
    if (rest) return rest
    window.localStorage.removeItem(backupKey(runId))
  } catch {
    // ungültige Sicherung verwerfen
    try {
      window.localStorage.removeItem(backupKey(runId))
    } catch {
      // gesperrter Speicher
    }
  }
  return []
}

export interface RunSync {
  status: SyncStatus
  /** Aktion anhängen (nach erfolgreicher Anwendung im Browser). */
  push: (action: Action) => void
  /** Sofort senden (Pause, Periodenende, vor dem Abschluss). Liefert true, wenn danach nichts mehr aussteht. */
  flush: () => Promise<boolean>
  /** Anzahl Aktionen, die der Server bestätigt hat. */
  confirmed: () => number
  /** Aktionen im Protokoll insgesamt (bestätigt + ausstehend) */
  total: () => number
}

export function useRunSync(options: {
  api: LeitstandApi
  runId: string
  /** Aktionen, die der Server beim Laden kannte */
  initialCount: number
  /** Beim Laden bereits ausstehende Aktionen (aus der Sicherung) */
  initialPending: Action[]
  enabled: boolean
  onConflict: (message: string) => void
  onRejected: (message: string) => void
  onAuthExpired: () => void
}): RunSync {
  const { api, runId, enabled } = options
  const handlersRef = useRef({ onConflict: options.onConflict, onRejected: options.onRejected, onAuthExpired: options.onAuthExpired })
  handlersRef.current = { onConflict: options.onConflict, onRejected: options.onRejected, onAuthExpired: options.onAuthExpired }
  const [status, setStatus] = useState<SyncStatus>(options.initialPending.length > 0 ? "ausstehend" : "gespeichert")

  const queueRef = useRef<SyncQueue | null>(null)
  if (queueRef.current === null) {
    queueRef.current = new SyncQueue({
      api,
      runId,
      confirmed: options.initialCount,
      pending: options.initialPending,
      saveBackup: (backup) => writeBackup(runId, backup),
      onStatus: setStatus,
      onConflict: (message) => handlersRef.current.onConflict(message),
      onRejected: (message) => handlersRef.current.onRejected(message),
      onAuthExpired: () => handlersRef.current.onAuthExpired(),
    })
  }
  const queue = queueRef.current

  useEffect(() => () => queue.dispose(), [queue])

  const flush = useCallback((): Promise<boolean> => {
    if (!enabled) return Promise.resolve(queue.pendingCount === 0)
    return queue.flush()
  }, [enabled, queue])

  const push = useCallback(
    (action: Action) => {
      queue.push(action)
      if (enabled && queue.pendingCount >= BATCH_SIZE && !queue.busy) void queue.flush()
    },
    [enabled, queue]
  )

  // Alle 20 s senden
  useEffect(() => {
    if (!enabled) return
    const id = window.setInterval(() => {
      if (queue.pendingCount > 0 && !queue.busy) void queue.flush()
    }, INTERVAL_MS)
    return () => window.clearInterval(id)
  }, [enabled, queue])

  // Ausstehende Aktionen aus dem letzten Besuch gleich senden
  useEffect(() => {
    if (enabled && queue.pendingCount > 0) void queue.flush()
  }, [enabled, queue])

  // Seitenwechsel und Verlassen: mit keepalive senden (die Sicherung im localStorage bleibt als Rückfall)
  useEffect(() => {
    if (!enabled) return
    const sendKeepalive = () => {
      if (queue.pendingCount === 0 || queue.busy) return
      void queue.flush(true)
    }
    const onHide = () => {
      if (document.visibilityState === "hidden") sendKeepalive()
    }
    document.addEventListener("visibilitychange", onHide)
    window.addEventListener("pagehide", sendKeepalive)
    return () => {
      document.removeEventListener("visibilitychange", onHide)
      window.removeEventListener("pagehide", sendKeepalive)
    }
  }, [enabled, queue])

  const confirmed = useCallback(() => queue.confirmed, [queue])
  const total = useCallback(() => queue.confirmed + queue.pendingCount, [queue])

  return { status, push, flush, confirmed, total }
}
