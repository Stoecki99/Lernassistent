// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// tests/leitstand-sync.test.ts
// Sende-Logik des Aktionsprotokolls (components/features/leitstand/syncQueue.ts) mit einer Fake-API:
// Reihenfolge, keine Doppelsendung, 409 nach verlorener Antwort, 422, offline mit neuem Versuch, 401,
// dazu Sicherung (resumePending), Wartezeiten (retryDelay) und Retry-After (parseRetryAfter).

import { describe, test } from "node:test"
import assert from "node:assert/strict"
import type { Action } from "@/lib/simulation/core"
import { ApiError, parseRetryAfter } from "@/components/features/leitstand/api"
import {
  MAX_PER_KEEPALIVE,
  MAX_PER_REQUEST,
  RETRY_BASE_MS,
  RETRY_MAX_MS,
  SyncQueue,
  resumePending,
  retryDelay,
  type PendingBackup,
  type SyncApi,
  type SyncStatus,
} from "@/components/features/leitstand/syncQueue"

const adv = (n = 1): Action => ({ type: "advance", ticks: n })
const acts = (count: number): Action[] => Array.from({ length: count }, (_, i) => adv((i % 3) + 1))

/** Fake-Server: hält das Protokoll, prüft fromIndex wie die echte Route und kann Fehler einspielen */
class FakeServer implements SyncApi {
  log: Action[] = []
  calls: Array<{ fromIndex: number; count: number; keepalive: boolean }> = []
  inflight = 0
  maxInflight = 0
  /** Nächste Antworten: Fehler werfen oder Anfrage annehmen und Antwort «verlieren» */
  script: Array<ApiError | Error | "lose"> = []

  async appendActions(_id: string, fromIndex: number, actions: Action[], keepalive = false) {
    this.calls.push({ fromIndex, count: actions.length, keepalive })
    this.inflight += 1
    this.maxInflight = Math.max(this.maxInflight, this.inflight)
    await new Promise((r) => setTimeout(r, 1))
    this.inflight -= 1
    const step = this.script.shift()
    if (step instanceof Error) throw step
    if (fromIndex !== this.log.length) {
      throw new ApiError(409, "Konflikt", { actionCount: this.log.length })
    }
    this.log.push(...actions)
    if (step === "lose") throw new Error("Verbindung abgebrochen")
    return { actionCount: this.log.length }
  }
}

interface Harness {
  server: FakeServer
  queue: SyncQueue
  statuses: SyncStatus[]
  backups: Array<PendingBackup | null>
  events: string[]
  timers: Array<{ fn: () => void; ms: number; cancelled: boolean }>
}

function setup(opts: { confirmed?: number; pending?: Action[]; server?: FakeServer } = {}): Harness {
  const server = opts.server ?? new FakeServer()
  const statuses: SyncStatus[] = []
  const backups: Array<PendingBackup | null> = []
  const events: string[] = []
  const timers: Harness["timers"] = []
  const queue = new SyncQueue({
    api: server,
    runId: "lauf",
    confirmed: opts.confirmed ?? server.log.length,
    pending: opts.pending,
    saveBackup: (b) => backups.push(b),
    onStatus: (s) => statuses.push(s),
    onConflict: (m) => events.push(`konflikt:${m}`),
    onRejected: (m) => events.push(`abgelehnt:${m}`),
    onAuthExpired: () => events.push("abgemeldet"),
    schedule: (fn, ms) => {
      const t = { fn, ms, cancelled: false }
      timers.push(t)
      return () => {
        t.cancelled = true
      }
    },
  })
  return { server, queue, statuses, backups, events, timers }
}

describe("SyncQueue: Reihenfolge und Doppelsendung", () => {
  test("sendet alle Aktionen in Reihenfolge und meldet «gespeichert»", async () => {
    const h = setup()
    const list = acts(25)
    for (const a of list) h.queue.push(a)
    assert.equal(await h.queue.flush(), true)
    assert.deepEqual(h.server.log, list)
    assert.equal(h.queue.confirmed, 25)
    assert.equal(h.queue.pendingCount, 0)
    assert.equal(h.queue.status, "gespeichert")
    assert.equal(h.backups.at(-1), null)
  })

  test("gleichzeitige flush-Aufrufe: höchstens eine Anfrage, keine Aktion doppelt", async () => {
    const h = setup()
    const list = acts(30)
    for (const a of list.slice(0, 10)) h.queue.push(a)
    const p1 = h.queue.flush()
    for (const a of list.slice(10)) h.queue.push(a)
    const p2 = h.queue.flush()
    const p3 = h.queue.flush(true)
    await Promise.all([p1, p2, p3])
    await h.queue.flush()
    assert.equal(h.server.maxInflight, 1)
    assert.deepEqual(h.server.log, list)
    const sent = h.server.calls.reduce((n, c) => n + c.count, 0)
    assert.equal(sent, 30, "keine Aktion doppelt gesendet")
  })

  test("Pakete: höchstens MAX_PER_REQUEST, mit keepalive höchstens MAX_PER_KEEPALIVE", async () => {
    const h = setup()
    for (const a of acts(MAX_PER_REQUEST + 5)) h.queue.push(a)
    await h.queue.flush()
    assert.deepEqual(h.server.calls.map((c) => c.count), [MAX_PER_REQUEST, 5])

    const k = setup()
    for (const a of acts(MAX_PER_KEEPALIVE + 1)) k.queue.push(a)
    await k.queue.flush(true)
    assert.deepEqual(k.server.calls.map((c) => [c.count, c.keepalive]), [
      [MAX_PER_KEEPALIVE, true],
      [1, true],
    ])
  })

  test("Sicherung: fromIndex = bestätigt, actions = ausstehend", async () => {
    const h = setup()
    h.queue.push(adv())
    h.queue.push(adv(2))
    assert.deepEqual(h.backups.at(-1), { fromIndex: 0, actions: [adv(), adv(2)] })
  })
})

describe("SyncQueue: 409 nach verlorener Antwort", () => {
  test("Server hat das Paket, Antwort ging verloren: Teil bestätigen, Rest weitersenden, nichts doppelt", async () => {
    const h = setup()
    const list = acts(15)
    for (const a of list.slice(0, 10)) h.queue.push(a)
    h.server.script.push("lose")
    assert.equal(await h.queue.flush(), false)
    assert.equal(h.queue.status, "offline")
    assert.equal(h.queue.confirmed, 0, "Browser weiss noch nichts von der Speicherung")
    for (const a of list.slice(10)) h.queue.push(a)
    // neuer Versuch: fromIndex 0 mit 15 Aktionen → 409 actionCount 10 → 5 Aktionen ab 10
    assert.equal(await h.queue.flush(), true)
    assert.deepEqual(h.server.log, list)
    assert.equal(h.queue.confirmed, 15)
    assert.deepEqual(
      h.server.calls.map((c) => [c.fromIndex, c.count]),
      [
        [0, 10],
        [0, 15],
        [10, 5],
      ],
    )
    assert.deepEqual(h.events, [])
  })

  test("Server hat das ganze Paket: alles bestätigt, keine weitere Anfrage", async () => {
    const h = setup()
    for (const a of acts(4)) h.queue.push(a)
    h.server.script.push("lose")
    await h.queue.flush()
    assert.equal(await h.queue.flush(), true)
    assert.equal(h.queue.confirmed, 4)
    assert.equal(h.server.calls.length, 2)
  })

  test("409 ausserhalb des Pakets (anderswo weitergespielt): Konflikt, Sicherung gelöscht, Senden endet", async () => {
    const server = new FakeServer()
    server.log = acts(30) // anderer Tab ist 30 Aktionen weiter
    const h = setup({ server, confirmed: 10 })
    for (const a of acts(5)) h.queue.push(a)
    assert.equal(await h.queue.flush(), false)
    assert.equal(h.events.length, 1)
    assert.match(h.events[0], /^konflikt:/)
    assert.equal(h.queue.stopped, true)
    assert.equal(h.queue.status, "fehler")
    assert.equal(h.backups.at(-1), null)
    h.queue.push(adv())
    assert.equal(h.queue.pendingCount, 5, "nach Stopp keine neuen Aktionen")
  })

  test("409 ohne actionCount: Konflikt", async () => {
    const h = setup()
    h.queue.push(adv())
    h.server.script.push(new ApiError(409, "Nicht aktiv"))
    await h.queue.flush()
    assert.deepEqual(h.events, ["konflikt:Nicht aktiv"])
  })
})

describe("SyncQueue: Fehlerarten", () => {
  test("422: abgelehnt, Sicherung gelöscht, keine weiteren Anfragen", async () => {
    const h = setup()
    h.queue.push(adv())
    h.server.script.push(new ApiError(422, "Ungültige Aktion", { index: 0 }))
    assert.equal(await h.queue.flush(), false)
    assert.deepEqual(h.events, ["abgelehnt:Ungültige Aktion"])
    assert.equal(h.backups.at(-1), null)
    await h.queue.flush()
    assert.equal(h.server.calls.length, 1)
    assert.equal(h.timers.length, 0)
  })

  test("401: «abgemeldet», onAuthExpired, Sicherung bleibt erhalten", async () => {
    const h = setup()
    h.queue.push(adv())
    h.queue.push(adv(2))
    h.server.script.push(new ApiError(401, "Nicht autorisiert."))
    assert.equal(await h.queue.flush(), false)
    assert.deepEqual(h.events, ["abgemeldet"])
    assert.equal(h.queue.status, "abgemeldet")
    assert.deepEqual(h.backups.at(-1), { fromIndex: 0, actions: [adv(), adv(2)] }, "Sicherung nicht gelöscht")
    assert.equal(h.timers.length, 0, "kein neuer Versuch")
  })

  test("offline: Status «offline», neuer Versuch mit wachsendem Abstand, danach gespeichert", async () => {
    const h = setup()
    h.queue.push(adv())
    h.server.script.push(new Error("offline"), new ApiError(503, "Wartung"))
    assert.equal(await h.queue.flush(), false)
    assert.equal(h.queue.status, "offline")
    assert.equal(h.timers.length, 1)
    assert.equal(h.timers[0].ms, RETRY_BASE_MS)

    h.timers[0].fn()
    await new Promise((r) => setTimeout(r, 10))
    assert.equal(h.timers.length, 2)
    assert.equal(h.timers[1].ms, RETRY_BASE_MS * 2, "Abstand verdoppelt")

    h.timers[1].fn()
    await new Promise((r) => setTimeout(r, 10))
    assert.equal(h.queue.status, "gespeichert")
    assert.deepEqual(h.server.log, [adv()])
    assert.deepEqual(h.events, [])
  })

  test("429 mit Retry-After: Wartezeit vom Server", async () => {
    const h = setup()
    h.queue.push(adv())
    h.server.script.push(new ApiError(429, "Zu viele Anfragen", { retryAfterMs: 60_000 }))
    await h.queue.flush()
    assert.equal(h.timers[0].ms, 60_000)
  })

  test("Erfolg nach Fehler setzt den Abstand zurück und bricht geplante Versuche ab", async () => {
    const h = setup()
    h.queue.push(adv())
    h.server.script.push(new Error("offline"))
    await h.queue.flush()
    assert.equal(await h.queue.flush(), true)
    assert.equal(h.timers[0].cancelled, true)
  })
})

describe("resumePending (Sicherung beim Neuladen)", () => {
  const a = acts(5)
  test("Sicherung schliesst an: alle Aktionen", () => {
    assert.deepEqual(resumePending({ fromIndex: 3, actions: a }, 3), a)
  })
  test("Anfang schon auf dem Server: Rest weiterverwenden", () => {
    assert.deepEqual(resumePending({ fromIndex: 3, actions: a }, 5), a.slice(2))
    assert.deepEqual(resumePending({ fromIndex: 3, actions: a }, 8), [])
  })
  test("Lücke, Server weiter oder ungültige Daten: verwerfen", () => {
    assert.equal(resumePending({ fromIndex: 3, actions: a }, 2), null)
    assert.equal(resumePending({ fromIndex: 3, actions: a }, 9), null)
    assert.equal(resumePending({ fromIndex: -1, actions: a }, 0), null)
    assert.equal(resumePending({ fromIndex: 0, actions: [{ type: "unbekannt" }] }, 0), null)
    assert.equal(resumePending("kaputt", 0), null)
    assert.equal(resumePending(null, 0), null)
  })
})

describe("Wartezeiten", () => {
  test("retryDelay verdoppelt bis RETRY_MAX_MS; Retry-After hat Vorrang", () => {
    assert.equal(retryDelay(1), RETRY_BASE_MS)
    assert.equal(retryDelay(2), RETRY_BASE_MS * 2)
    assert.equal(retryDelay(50), RETRY_MAX_MS)
    assert.equal(retryDelay(1, 7000), 7000)
  })
  test("parseRetryAfter: Sekunden, HTTP-Datum, ungültig", () => {
    assert.equal(parseRetryAfter("60"), 60_000)
    const now = Date.parse("2026-11-01T10:00:00Z")
    assert.equal(parseRetryAfter("Sun, 01 Nov 2026 10:00:30 GMT", now), 30_000)
    assert.equal(parseRetryAfter("bald"), undefined)
    assert.equal(parseRetryAfter(null), undefined)
  })
})
