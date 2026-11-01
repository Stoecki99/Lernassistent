// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// components/features/architektur-leitstand/syncQueue.ts
// Sende-Logik des Aktionsprotokolls ohne React und ohne Browser-Objekte (Muster: components/features/leitstand/syncQueue.ts).
// useLaufSync.ts bindet sie an Zeitgeber und Seitenereignisse; tests/architektur-leitstand-sync.test.ts prüft sie.
//
// Regeln:
// - Reihenfolge bleibt erhalten; höchstens eine Anfrage gleichzeitig (keine Doppelsendung).
// - Aufeinanderfolgende «weiter» werden zusammengefasst, solange sie noch nicht unterwegs sind
//   (weiter 3 = dreimal weiter 1; der Server sieht dasselbe Ergebnis, das Protokoll bleibt klein).
// - 409 mit aktionCount im Bereich abIndex < aktionCount ≤ abIndex + Paketgrösse: Die Antwort ging verloren,
//   der Server hat den Anfang des Pakets schon. Dieser Teil gilt als bestätigt, die Warteschlange wird gekürzt.
// - 409 sonst: Konflikt, Senden endet (Lauf neu laden).
// - 400/403/404/413/422: abgelehnt, Senden endet (Lauf neu laden).
// - 401: Anmeldung abgelaufen; Senden endet, die Sicherung im Browser bleibt erhalten.
// - 429, 5xx, keine Antwort: später erneut, mit wachsendem Abstand oder nach Retry-After.

import { z } from "zod"
import { aktionSchema, type Aktion } from "@/lib/archsim"
import { ApiFehler } from "./api"

export type SyncStatus = "gespeichert" | "ausstehend" | "speichert" | "offline" | "fehler" | "abgemeldet"

/** Höchstens so viele Aktionen je Anfrage (aktionenAnhaengenSchema: 1–200) */
export const MAX_JE_ANFRAGE = 200
/** keepalive-Anfragen dürfen höchstens 64 KB tragen; kleine Pakete bleiben sicher darunter */
export const MAX_JE_KEEPALIVE = 40
/** Höchstwert für zusammengefasste Minuten (aktionSchema: weiter 1–600) */
export const MAX_MINUTEN = 600
export const RETRY_BASIS_MS = 2_000
export const RETRY_MAX_MS = 60_000

export interface Sicherung {
  abIndex: number
  aktionen: Aktion[]
}

const sicherungSchema = z.object({
  abIndex: z.number().int().min(0),
  aktionen: z.array(aktionSchema),
})

/**
 * Ausstehende Aktionen aus einer Sicherung, passend zum Stand des Servers.
 * - abIndex = serverCount: alle Aktionen fehlen noch
 * - abIndex < serverCount ≤ abIndex + Länge: der Anfang ist schon gespeichert (verlorene Antwort), Rest weiterverwenden
 * - sonst (Lücke, Server weiter, ungültige Daten): null = Sicherung verwerfen
 */
export function sicherungFortsetzen(roh: unknown, serverCount: number): Aktion[] | null {
  const p = sicherungSchema.safeParse(roh)
  if (!p.success) return null
  const { abIndex, aktionen } = p.data
  if (abIndex > serverCount) return null
  const erledigt = serverCount - abIndex
  if (erledigt > aktionen.length) return null
  return aktionen.slice(erledigt)
}

/** Wartezeit vor dem n-ten neuen Versuch (n ≥ 1); Retry-After des Servers hat Vorrang */
export function wartezeit(versuch: number, retryAfterMs?: number): number {
  if (retryAfterMs !== undefined && retryAfterMs >= 0) return Math.min(retryAfterMs, 5 * RETRY_MAX_MS)
  return Math.min(RETRY_MAX_MS, RETRY_BASIS_MS * 2 ** Math.max(0, versuch - 1))
}

export interface SyncApi {
  aktionenAnhaengen(id: string, abIndex: number, aktionen: Aktion[], keepalive?: boolean): Promise<{ aktionCount: number }>
}

export interface SyncOptionen {
  api: SyncApi
  laufId: string
  /** Aktionen, die der Server beim Laden kannte */
  bestaetigt: number
  /** Beim Laden bereits ausstehende Aktionen (aus der Sicherung) */
  ausstehend?: Aktion[]
  sichern?: (s: Sicherung | null) => void
  onStatus?: (s: SyncStatus) => void
  onKonflikt?: (meldung: string) => void
  onAbgelehnt?: (meldung: string) => void
  onAbgemeldet?: () => void
  /** Zeitgeber für neue Versuche (Tests: Fake); liefert eine Abbruchfunktion */
  planen?: (fn: () => void, ms: number) => () => void
}

const ABGELEHNT = new Set([400, 403, 404, 413, 422])

/** Warteschlange der ungesendeten Aktionen eines Laufs */
export class SyncWarteschlange {
  private readonly o: SyncOptionen
  private bestaetigtZahl: number
  private schlange: Aktion[]
  /** Anzahl Aktionen am Anfang der Schlange, die gerade gesendet werden (nicht mehr zusammenfassen) */
  private unterwegs = 0
  private laufend: Promise<boolean> | null = null
  private gestoppt = false
  private versuch = 0
  private abbruchRetry: (() => void) | null = null
  private aktuell: SyncStatus

  constructor(o: SyncOptionen) {
    this.o = o
    this.bestaetigtZahl = o.bestaetigt
    this.schlange = [...(o.ausstehend ?? [])]
    this.aktuell = this.schlange.length > 0 ? "ausstehend" : "gespeichert"
  }

  get bestaetigt(): number {
    return this.bestaetigtZahl
  }
  get anzahlAusstehend(): number {
    return this.schlange.length
  }
  get istGestoppt(): boolean {
    return this.gestoppt
  }
  get status(): SyncStatus {
    return this.aktuell
  }
  get beschaeftigt(): boolean {
    return this.laufend !== null
  }
  /** Ausstehende Aktionen (Kopie) */
  get offene(): Aktion[] {
    return [...this.schlange]
  }

  /** Aktion anhängen (nach erfolgreicher Anwendung im Browser); «weiter» wird wenn möglich zusammengefasst */
  push(aktion: Aktion): void {
    if (this.gestoppt) return
    const letzte = this.schlange[this.schlange.length - 1]
    if (
      aktion.typ === "weiter" &&
      letzte?.typ === "weiter" &&
      this.schlange.length > this.unterwegs &&
      letzte.minuten + aktion.minuten <= MAX_MINUTEN
    ) {
      this.schlange[this.schlange.length - 1] = { typ: "weiter", minuten: letzte.minuten + aktion.minuten }
    } else {
      this.schlange.push(aktion)
    }
    this.sicherungSchreiben()
    if (this.aktuell !== "speichert" && this.aktuell !== "offline") this.setStatus("ausstehend")
  }

  /** Alles Ausstehende senden; liefert true, wenn danach nichts mehr aussteht */
  flush(keepalive = false): Promise<boolean> {
    if (this.laufend) {
      if (keepalive) return this.laufend
      return this.laufend.then(() => this.flush())
    }
    const p = this.senden(keepalive).finally(() => {
      this.laufend = null
    })
    this.laufend = p
    return p
  }

  dispose(): void {
    this.abbruchRetry?.()
    this.abbruchRetry = null
  }

  private setStatus(s: SyncStatus): void {
    if (s === this.aktuell) return
    this.aktuell = s
    this.o.onStatus?.(s)
  }

  private sicherungSchreiben(): void {
    this.o.sichern?.(this.schlange.length > 0 ? { abIndex: this.bestaetigtZahl, aktionen: [...this.schlange] } : null)
  }

  private stoppen(s: SyncStatus, sicherungLoeschen: boolean): void {
    this.gestoppt = true
    this.dispose()
    if (sicherungLoeschen) this.o.sichern?.(null)
    this.setStatus(s)
  }

  private bestaetigen(count: number): void {
    const erledigt = count - this.bestaetigtZahl
    this.bestaetigtZahl = count
    this.schlange = this.schlange.slice(erledigt)
    this.sicherungSchreiben()
  }

  private retryPlanen(retryAfterMs?: number): void {
    if (this.abbruchRetry || this.gestoppt) return
    this.versuch += 1
    const planen = this.o.planen ?? standardPlanen
    this.abbruchRetry = planen(() => {
      this.abbruchRetry = null
      void this.flush()
    }, wartezeit(this.versuch, retryAfterMs))
  }

  private async senden(keepalive: boolean): Promise<boolean> {
    if (this.gestoppt) return this.schlange.length === 0
    while (this.schlange.length > 0) {
      const paket = this.schlange.slice(0, keepalive ? MAX_JE_KEEPALIVE : MAX_JE_ANFRAGE)
      const abIndex = this.bestaetigtZahl
      this.unterwegs = paket.length
      this.setStatus("speichert")
      try {
        const res = await this.o.api.aktionenAnhaengen(this.o.laufId, abIndex, paket, keepalive)
        this.unterwegs = 0
        if (res.aktionCount !== abIndex + paket.length) {
          this.stoppen("fehler", true)
          this.o.onKonflikt?.("Der gespeicherte Stand passt nicht zum Browser.")
          return false
        }
        this.bestaetigen(res.aktionCount)
        this.versuch = 0
        this.abbruchRetry?.()
        this.abbruchRetry = null
      } catch (error) {
        this.unterwegs = 0
        const status = error instanceof ApiFehler ? error.status : 0
        if (status === 409 && error instanceof ApiFehler) {
          const n = error.aktionCount
          if (n !== undefined && n > abIndex && n <= abIndex + paket.length) {
            this.bestaetigen(n)
            continue
          }
          this.stoppen("fehler", true)
          this.o.onKonflikt?.(error.message)
          return false
        }
        if (status === 401) {
          this.stoppen("abgemeldet", false)
          this.o.onAbgemeldet?.()
          return false
        }
        if (ABGELEHNT.has(status) && error instanceof ApiFehler) {
          this.stoppen("fehler", true)
          this.o.onAbgelehnt?.(error.message)
          return false
        }
        this.setStatus("offline")
        this.retryPlanen(error instanceof ApiFehler ? error.retryAfterMs : undefined)
        return false
      }
    }
    this.setStatus("gespeichert")
    return true
  }
}

function standardPlanen(fn: () => void, ms: number): () => void {
  const id = setTimeout(fn, ms)
  return () => clearTimeout(id)
}
