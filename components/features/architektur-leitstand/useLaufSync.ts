// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

"use client"

// components/features/architektur-leitstand/useLaufSync.ts
// Synchronisation des Aktionsprotokolls mit der API (Muster: components/features/leitstand/useRunSync.ts).
// Sendet alle 10 Aktionen, alle 15 s, bei Pause, Massnahmen, Missionsende und Seitenwechsel.
// Nicht gesendete Aktionen liegen zusätzlich im localStorage, damit ein Neuladen an derselben Minute weiterspielt.
// Die Sende-Regeln (409 nach verlorener Antwort, 401, 422, neue Versuche) stehen in syncQueue.ts.

import { useCallback, useEffect, useRef, useState } from "react"
import type { Aktion } from "@/lib/archsim"
import type { ArchApi } from "./api"
import { SyncWarteschlange, sicherungFortsetzen, type Sicherung, type SyncStatus } from "./syncQueue"

export type { SyncStatus } from "./syncQueue"

const PAKET = 10
const INTERVALL_MS = 15_000

function schluessel(laufId: string): string {
  return `archsim-ausstehend-${laufId}`
}

function sicherungSchreiben(laufId: string, s: Sicherung | null): void {
  try {
    if (!s || s.aktionen.length === 0) window.localStorage.removeItem(schluessel(laufId))
    else window.localStorage.setItem(schluessel(laufId), JSON.stringify(s))
  } catch {
    // Gesperrter Speicher: dann gilt nur der Versand an die API
  }
}

/** Ausstehende Aktionen aus dem letzten Besuch (mit Zod geprüft); passt die Sicherung nicht, wird sie verworfen */
export function sicherungLesen(laufId: string, serverCount: number): Aktion[] {
  try {
    const roh = window.localStorage.getItem(schluessel(laufId))
    if (!roh) return []
    const rest = sicherungFortsetzen(JSON.parse(roh) as unknown, serverCount)
    if (rest) return rest
    window.localStorage.removeItem(schluessel(laufId))
  } catch {
    try {
      window.localStorage.removeItem(schluessel(laufId))
    } catch {
      // gesperrter Speicher
    }
  }
  return []
}

export interface LaufSync {
  status: SyncStatus
  push: (a: Aktion) => void
  flush: () => Promise<boolean>
  /** Aktionen im Protokoll insgesamt (bestätigt + ausstehend, nach dem Zusammenfassen) */
  gesamt: () => number
}

export function useLaufSync(o: {
  api: ArchApi
  laufId: string
  bestaetigt: number
  ausstehend: Aktion[]
  aktiv: boolean
  onKonflikt: (m: string) => void
  onAbgelehnt: (m: string) => void
  onAbgemeldet: () => void
}): LaufSync {
  const { api, laufId, aktiv } = o
  const handler = useRef({ onKonflikt: o.onKonflikt, onAbgelehnt: o.onAbgelehnt, onAbgemeldet: o.onAbgemeldet })
  handler.current = { onKonflikt: o.onKonflikt, onAbgelehnt: o.onAbgelehnt, onAbgemeldet: o.onAbgemeldet }
  const [status, setStatus] = useState<SyncStatus>(o.ausstehend.length > 0 ? "ausstehend" : "gespeichert")

  const ref = useRef<SyncWarteschlange | null>(null)
  if (ref.current === null) {
    ref.current = new SyncWarteschlange({
      api,
      laufId,
      bestaetigt: o.bestaetigt,
      ausstehend: o.ausstehend,
      sichern: (s) => sicherungSchreiben(laufId, s),
      onStatus: setStatus,
      onKonflikt: (m) => handler.current.onKonflikt(m),
      onAbgelehnt: (m) => handler.current.onAbgelehnt(m),
      onAbgemeldet: () => handler.current.onAbgemeldet(),
    })
  }
  const q = ref.current

  useEffect(() => () => q.dispose(), [q])

  const flush = useCallback((): Promise<boolean> => {
    if (!aktiv) return Promise.resolve(q.anzahlAusstehend === 0)
    return q.flush()
  }, [aktiv, q])

  const push = useCallback(
    (a: Aktion) => {
      q.push(a)
      // Massnahmen gleich senden (sie sind selten und wichtig), «weiter» gesammelt
      if (aktiv && !q.beschaeftigt && (a.typ !== "weiter" || q.anzahlAusstehend >= PAKET)) void q.flush()
    },
    [aktiv, q],
  )

  useEffect(() => {
    if (!aktiv) return
    const id = window.setInterval(() => {
      if (q.anzahlAusstehend > 0 && !q.beschaeftigt) void q.flush()
    }, INTERVALL_MS)
    return () => window.clearInterval(id)
  }, [aktiv, q])

  useEffect(() => {
    if (aktiv && q.anzahlAusstehend > 0) void q.flush()
  }, [aktiv, q])

  useEffect(() => {
    if (!aktiv) return
    const keepalive = () => {
      if (q.anzahlAusstehend === 0 || q.beschaeftigt) return
      void q.flush(true)
    }
    const onHide = () => {
      if (document.visibilityState === "hidden") keepalive()
    }
    document.addEventListener("visibilitychange", onHide)
    window.addEventListener("pagehide", keepalive)
    return () => {
      document.removeEventListener("visibilitychange", onHide)
      window.removeEventListener("pagehide", keepalive)
    }
  }, [aktiv, q])

  const gesamt = useCallback(() => q.bestaetigt + q.anzahlAusstehend, [q])
  return { status, push, flush, gesamt }
}
