// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

"use client"

// components/features/leitstand/useRunSync.ts
// Synchronisation des Aktionsprotokolls mit der API (Spezifikation 4.6, 4.8 «useRunSync»).
// Sammelt Aktionen und sendet sie: alle 10 Aktionen, alle 20 s, bei Pause, Periodenende und Seitenwechsel.
// Nicht gesendete Aktionen liegen zusätzlich im localStorage, damit ein Neuladen am gleichen Takt weiterspielt.
// Bei 409 (Konflikt) und 422 (ungültig) meldet der Hook den Fehler; die Lauf-Ansicht lädt dann neu.

import { useCallback, useEffect, useRef, useState } from "react"
import type { Action } from "@/lib/simulation"
import { ApiError, type LeitstandApi } from "./api"

const BATCH_SIZE = 10
const INTERVAL_MS = 20_000
const MAX_PER_REQUEST = 200
/** keepalive-Anfragen dürfen höchstens 64 KB tragen; kleine Pakete bleiben sicher darunter */
const MAX_PER_KEEPALIVE = 40

export type SyncStatus = "gespeichert" | "ausstehend" | "speichert" | "offline" | "fehler"

interface PendingBackup {
  fromIndex: number
  actions: Action[]
}

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

/** Ausstehende Aktionen aus dem letzten Besuch, nur wenn sie genau an das gespeicherte Protokoll anschliessen. */
export function readPendingBackup(runId: string, serverCount: number): Action[] {
  try {
    const raw = window.localStorage.getItem(backupKey(runId))
    if (!raw) return []
    const parsed = JSON.parse(raw) as PendingBackup
    if (parsed && parsed.fromIndex === serverCount && Array.isArray(parsed.actions)) return parsed.actions
    window.localStorage.removeItem(backupKey(runId))
  } catch {
    // ungültige Sicherung verwerfen
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
}): RunSync {
  const { api, runId, enabled } = options
  const confirmedRef = useRef(options.initialCount)
  const queueRef = useRef<Action[]>([...options.initialPending])
  const inflightRef = useRef<Promise<boolean> | null>(null)
  const stoppedRef = useRef(false)
  const handlersRef = useRef({ onConflict: options.onConflict, onRejected: options.onRejected })
  handlersRef.current = { onConflict: options.onConflict, onRejected: options.onRejected }
  const [status, setStatus] = useState<SyncStatus>(options.initialPending.length > 0 ? "ausstehend" : "gespeichert")

  const send = useCallback(
    async (keepalive: boolean): Promise<boolean> => {
      if (stoppedRef.current || !enabled) return queueRef.current.length === 0
      while (queueRef.current.length > 0) {
        const batch = queueRef.current.slice(0, keepalive ? MAX_PER_KEEPALIVE : MAX_PER_REQUEST)
        const fromIndex = confirmedRef.current
        setStatus("speichert")
        try {
          const res = await api.appendActions(runId, fromIndex, batch, keepalive)
          confirmedRef.current = res.actionCount
          queueRef.current = queueRef.current.slice(batch.length)
          writeBackup(runId, { fromIndex: confirmedRef.current, actions: queueRef.current })
        } catch (error) {
          if (error instanceof ApiError && error.status === 409) {
            stoppedRef.current = true
            setStatus("fehler")
            writeBackup(runId, null)
            handlersRef.current.onConflict(error.message)
            return false
          }
          if (error instanceof ApiError && (error.status === 422 || error.status === 400 || error.status === 404 || error.status === 403)) {
            stoppedRef.current = true
            setStatus("fehler")
            writeBackup(runId, null)
            handlersRef.current.onRejected(error.message)
            return false
          }
          // Netz- oder Serverfehler: später erneut versuchen, Sicherung bleibt
          setStatus("offline")
          return false
        }
      }
      setStatus("gespeichert")
      return true
    },
    [api, runId, enabled]
  )

  const flush = useCallback((): Promise<boolean> => {
    if (inflightRef.current) {
      // Laufende Sendung abwarten und danach den Rest senden
      return inflightRef.current.then(() => flush())
    }
    const p = send(false).finally(() => {
      inflightRef.current = null
    })
    inflightRef.current = p
    return p
  }, [send])

  const push = useCallback(
    (action: Action) => {
      if (stoppedRef.current) return
      queueRef.current.push(action)
      writeBackup(runId, { fromIndex: confirmedRef.current, actions: queueRef.current })
      setStatus((s) => (s === "speichert" ? s : "ausstehend"))
      if (queueRef.current.length >= BATCH_SIZE) void flush()
    },
    [flush, runId]
  )

  // Alle 20 s senden
  useEffect(() => {
    if (!enabled) return
    const id = window.setInterval(() => {
      if (queueRef.current.length > 0) void flush()
    }, INTERVAL_MS)
    return () => window.clearInterval(id)
  }, [enabled, flush])

  // Ausstehende Aktionen aus dem letzten Besuch gleich senden
  useEffect(() => {
    if (enabled && queueRef.current.length > 0) void flush()
  }, [enabled, flush])

  // Seitenwechsel und Verlassen: mit keepalive senden (die Sicherung im localStorage bleibt als Rückfall)
  useEffect(() => {
    if (!enabled) return
    const sendKeepalive = () => {
      if (queueRef.current.length === 0 || inflightRef.current) return
      const p = send(true).finally(() => {
        inflightRef.current = null
      })
      inflightRef.current = p
    }
    const onHide = () => {
      if (document.visibilityState === "hidden") sendKeepalive()
    }
    const onPageHide = () => sendKeepalive()
    document.addEventListener("visibilitychange", onHide)
    window.addEventListener("pagehide", onPageHide)
    return () => {
      document.removeEventListener("visibilitychange", onHide)
      window.removeEventListener("pagehide", onPageHide)
    }
  }, [enabled, send])

  const confirmed = useCallback(() => confirmedRef.current, [])

  return { status, push, flush, confirmed }
}
