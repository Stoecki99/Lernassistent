// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

"use client"

// components/features/ipma/useItemSync.ts
// Autospeichern der Antworten (Spezifikation 6.8 useItemSync):
// - MC-Wahl und Markierung sofort, Freitext 1.5 s nach der letzten Eingabe und bei flush() (Fragenwechsel, Prüfen, Abgabe)
// - Sicherung im localStorage (mit Zod geprüft) bis zur Bestätigung durch den Server; Neuladen verliert nichts
// - 429/5xx/offline → neuer Versuch nach 2 s, 4 s … 60 s; 401 → «Anmeldung abgelaufen», Sicherung bleibt
// - 409/422 (gesperrt, nicht mehr aktiv, TIME_UP) → onFatal (die Seite lädt den Versuch neu)
// Anfragen laufen nacheinander (eine gleichzeitig), damit die Reihenfolge der Änderungen erhalten bleibt.

import { useCallback, useEffect, useRef, useState } from "react"
import { z } from "zod"
import { ipmaApi, IpmaApiError, type SaveBody } from "./api"

export type SyncState = "saved" | "pending" | "saving" | "retry" | "offline" | "auth" | "error"

const TEXT_DELAY_MS = 1500
const BACKOFF_MS = [2000, 4000, 8000, 16000, 32000, 60000]

const patchSchema = z
  .object({
    choice: z.number().int().min(0).max(3).nullable().optional(),
    text: z.string().max(3000).nullable().optional(),
    flagged: z.boolean().optional(),
  })
  .strict()
const backupSchema = z.record(z.string().regex(/^\d{1,2}$/), patchSchema)

export const backupKey = (attemptId: string) => `ipma-sicherung-${attemptId}`

/** Gesicherte, noch nicht bestätigte Änderungen lesen (ungültige Daten werden verworfen) */
export function readBackup(attemptId: string): Map<number, SaveBody> {
  try {
    const raw = window.localStorage.getItem(backupKey(attemptId))
    if (!raw) return new Map()
    const parsed = backupSchema.safeParse(JSON.parse(raw))
    if (!parsed.success) return new Map()
    return new Map(Object.entries(parsed.data).map(([k, v]) => [Number(k), v]))
  } catch {
    return new Map()
  }
}

function writeBackup(attemptId: string, entries: Map<number, SaveBody>): void {
  try {
    if (entries.size === 0) window.localStorage.removeItem(backupKey(attemptId))
    else window.localStorage.setItem(backupKey(attemptId), JSON.stringify(Object.fromEntries(entries)))
  } catch {
    // Gesperrter Speicher: ohne Sicherung weiter
  }
}

export function clearBackup(attemptId: string): void {
  try {
    window.localStorage.removeItem(backupKey(attemptId))
  } catch {
    // nichts zu tun
  }
}

export interface ItemSync {
  state: SyncState
  /** Änderung vormerken; text wird verzögert gesendet, choice und flagged sofort */
  queue: (position: number, patch: SaveBody) => void
  /** Alles Vorgemerkte sofort senden; true, wenn danach nichts mehr offen ist */
  flush: () => Promise<boolean>
  /** Noch nicht bestätigte Änderungen vorhanden */
  hasPending: () => boolean
}

export function useItemSync(attemptId: string, enabled: boolean, onFatal: (error: IpmaApiError) => void): ItemSync {
  const [state, setState] = useState<SyncState>("saved")
  const pending = useRef(new Map<number, SaveBody>()) // noch nicht gesendet
  const inflight = useRef<{ position: number; patch: SaveBody } | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const attempt = useRef(0)
  const blocked = useRef(false) // 401 oder fataler Fehler: nicht weiter senden
  const fatalRef = useRef(onFatal)
  fatalRef.current = onFatal
  const runRef = useRef<() => void>(() => undefined)

  const persist = useCallback(() => {
    const all = new Map<number, SaveBody>()
    if (inflight.current) all.set(inflight.current.position, inflight.current.patch)
    for (const [p, patch] of pending.current) all.set(p, { ...(all.get(p) ?? {}), ...patch })
    writeBackup(attemptId, all)
  }, [attemptId])

  const schedule = useCallback((ms: number) => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      timer.current = null
      runRef.current()
    }, ms)
  }, [])

  const run = useCallback(() => {
    if (!enabled || blocked.current || inflight.current) return
    const next = pending.current.entries().next()
    if (next.done) {
      setState("saved")
      persist()
      return
    }
    const [position, patch] = next.value
    pending.current.delete(position)
    inflight.current = { position, patch }
    setState("saving")
    ipmaApi
      .save(attemptId, position, patch)
      .then(() => {
        inflight.current = null
        attempt.current = 0
        persist()
        runRef.current()
      })
      .catch((e: unknown) => {
        inflight.current = null
        const err = e instanceof IpmaApiError ? e : new IpmaApiError(0, "Keine Verbindung zum Server.")
        const restore = () => pending.current.set(position, { ...patch, ...(pending.current.get(position) ?? {}) })
        if (err.status === 401) {
          restore()
          blocked.current = true
          persist()
          setState("auth")
          return
        }
        if (err.status === 0 || err.status === 429 || err.status >= 500) {
          restore()
          persist()
          setState(err.status === 0 || (typeof navigator !== "undefined" && !navigator.onLine) ? "offline" : "retry")
          const wait = err.retryAfterMs ?? BACKOFF_MS[Math.min(attempt.current, BACKOFF_MS.length - 1)]
          attempt.current += 1
          schedule(wait)
          return
        }
        if (err.status === 409 || err.status === 422) {
          blocked.current = true
          pending.current.clear()
          persist()
          setState("error")
          fatalRef.current(err)
          return
        }
        // 400 und Ähnliches: diese Änderung verwerfen, den Rest weiter senden
        console.error("[ipma/sync]", err.status, err.code)
        persist()
        setState("error")
        runRef.current()
      })
  }, [attemptId, enabled, persist, schedule])
  runRef.current = run

  const queue = useCallback(
    (position: number, patch: SaveBody) => {
      pending.current.set(position, { ...(pending.current.get(position) ?? {}), ...patch })
      persist()
      setState((s) => (s === "auth" ? s : "pending"))
      if (patch.text !== undefined && patch.choice === undefined && patch.flagged === undefined) schedule(TEXT_DELAY_MS)
      else {
        if (timer.current) clearTimeout(timer.current)
        timer.current = null
        run()
      }
    },
    [persist, run, schedule],
  )

  const flush = useCallback(async (): Promise<boolean> => {
    if (timer.current) {
      clearTimeout(timer.current)
      timer.current = null
    }
    attempt.current = 0
    run()
    const until = Date.now() + 10_000
    while (pending.current.size > 0 || inflight.current) {
      if (blocked.current || Date.now() > until) return false
      await new Promise((r) => setTimeout(r, 100))
      if (!inflight.current && pending.current.size > 0 && !timer.current) run()
    }
    return !blocked.current
  }, [run])

  const hasPending = useCallback(() => pending.current.size > 0 || inflight.current !== null, [])

  // Wieder online: sofort senden; beim Verlassen mit offenen Änderungen nachfragen (Sicherung bleibt ohnehin)
  useEffect(() => {
    const online = () => {
      attempt.current = 0
      runRef.current()
    }
    const leave = (e: BeforeUnloadEvent) => {
      if (pending.current.size > 0 || inflight.current) {
        e.preventDefault()
        e.returnValue = ""
      }
    }
    window.addEventListener("online", online)
    window.addEventListener("beforeunload", leave)
    return () => {
      window.removeEventListener("online", online)
      window.removeEventListener("beforeunload", leave)
      if (timer.current) clearTimeout(timer.current)
    }
  }, [])

  return { state, queue, flush, hasPending }
}
