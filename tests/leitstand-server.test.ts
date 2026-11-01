// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// tests/leitstand-server.test.ts
// Serverhilfen des Leitstands ohne Datenbank: Körpergrenze als Strom (auch ohne content-length),
// Rate-Limits, Wiederholung bei Prisma-Fehlercodes (P2002/P2034) und Abzeichen-Vergabe per create.

import { describe, test } from "node:test"
import assert from "node:assert/strict"
import { awardBadge } from "@/lib/badges"
import {
  LeitstandError,
  MAX_BODY_BYTES,
  RATE_LIMITS,
  checkRateLimit,
  prismaErrorCode,
  readJsonBody,
  readLimitedText,
  retryOnPrismaCodes,
} from "@/lib/leitstand"

/** Anfrage mit Strom-Körper ohne content-length; zählt gelesene Stücke */
function streamRequest(totalBytes: number, chunkBytes = 16 * 1024): { request: Request; pulled: () => number; cancelled: () => boolean } {
  let sent = 0
  let pulls = 0
  let wasCancelled = false
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      pulls += 1
      if (sent >= totalBytes) {
        controller.close()
        return
      }
      const size = Math.min(chunkBytes, totalBytes - sent)
      sent += size
      controller.enqueue(new Uint8Array(size).fill(0x20))
    },
    cancel() {
      wasCancelled = true
    },
  })
  const request = new Request("http://localhost/api", { method: "POST", body, duplex: "half" } as RequestInit)
  assert.equal(request.headers.get("content-length"), null)
  return { request, pulled: () => pulls, cancelled: () => wasCancelled }
}

function expectLimit(error: unknown): true {
  assert.ok(error instanceof LeitstandError)
  assert.equal(error.status, 413)
  return true
}

describe("Körpergrenze 256 KB", () => {
  test("Strom ohne content-length über der Grenze: 413, Lesen abgebrochen", async () => {
    const s = streamRequest(10 * MAX_BODY_BYTES)
    await assert.rejects(readLimitedText(s.request), expectLimit)
    assert.equal(s.cancelled(), true)
    assert.ok(s.pulled() <= MAX_BODY_BYTES / (16 * 1024) + 3, `nur bis knapp über die Grenze gelesen (${s.pulled()} Stücke)`)
  })

  test("Strom ohne content-length unter der Grenze: Text vollständig", async () => {
    const s = streamRequest(MAX_BODY_BYTES)
    const text = await readLimitedText(s.request)
    assert.equal(text.length, MAX_BODY_BYTES)
  })

  test("content-length über der Grenze: 413 ohne zu lesen", async () => {
    const request = new Request("http://localhost/api", {
      method: "POST",
      body: "{}",
      headers: { "content-length": String(MAX_BODY_BYTES + 1) },
    })
    await assert.rejects(readLimitedText(request), expectLimit)
  })

  test("readJsonBody: leerer Körper → Ersatzwert, ungültiges JSON → 400", async () => {
    assert.deepEqual(await readJsonBody(new Request("http://localhost/api", { method: "POST" }), {}), {})
    await assert.rejects(readJsonBody(new Request("http://localhost/api", { method: "POST", body: "{kaputt" })), (e: unknown) => {
      assert.ok(e instanceof LeitstandError)
      assert.equal(e.status, 400)
      return true
    })
  })
})

describe("Rate-Limits", () => {
  test("finish, Lesen und Abbrechen sind begrenzt", () => {
    assert.equal(RATE_LIMITS.finish, 10)
    assert.ok(RATE_LIMITS.read > 0)
    assert.ok(RATE_LIMITS.abort > 0)
  })

  test("finish: 10 Anfragen je Minute, die elfte abgelehnt; je Zweck getrennt", () => {
    const user = `rate-${Math.random()}`
    for (let i = 0; i < RATE_LIMITS.finish; i++) assert.equal(checkRateLimit(user, "finish"), true)
    assert.equal(checkRateLimit(user, "finish"), false)
    assert.equal(checkRateLimit(user, "read"), true)
  })
})

/** Prisma-ähnlicher Fehler mit Code */
const prismaError = (code: string) => Object.assign(new Error(code), { code })

describe("retryOnPrismaCodes", () => {
  test("wiederholt bei passendem Code und liefert den späteren Erfolg", async () => {
    let calls = 0
    const value = await retryOnPrismaCodes(["P2034"], 3, async () => {
      calls += 1
      if (calls < 3) throw prismaError("P2034")
      return "ok"
    })
    assert.equal(value, "ok")
    assert.equal(calls, 3)
  })

  test("gibt nach der letzten Wiederholung den Fehler weiter", async () => {
    let calls = 0
    await assert.rejects(
      retryOnPrismaCodes(["P2002"], 2, async () => {
        calls += 1
        throw prismaError("P2002")
      }),
      (e: unknown) => prismaErrorCode(e) === "P2002",
    )
    assert.equal(calls, 2)
  })

  test("andere Fehler sofort weiter", async () => {
    let calls = 0
    await assert.rejects(
      retryOnPrismaCodes(["P2034"], 3, async () => {
        calls += 1
        throw new Error("anders")
      }),
      /anders/,
    )
    assert.equal(calls, 1)
  })
})

/**
 * Fake für prisma.$transaction(fn): eigene Tabellen, Rücknahme bei Fehler. Transaktionen laufen nacheinander
 * (wie der eindeutige Index, der die zweite Einfügung bis zum Commit der ersten warten lässt).
 */
function fakeBadgeDb(existing: string[] = []) {
  const userBadges = new Set(existing)
  let points = 0
  let chain: Promise<unknown> = Promise.resolve()
  const run = async (fn: (tx: unknown) => Promise<unknown>) => {
      const staged = { badges: new Set(userBadges), points }
      const tx = {
        userBadge: {
          async create({ data }: { data: { userId: string; badgeId: string } }) {
            const key = `${data.userId}:${data.badgeId}`
            if (staged.badges.has(key)) throw prismaError("P2002")
            staged.badges.add(key)
            return data
          },
        },
        user: {
          async update({ data }: { data: { points: { increment: number } } }) {
            staged.points += data.points.increment
            return {}
          },
        },
      }
      const result = await fn(tx)
      // nur bei Erfolg übernehmen (Rücknahme sonst)
      userBadges.clear()
      for (const b of staged.badges) userBadges.add(b)
      points = staged.points
      return result
  }
  const db = {
    $transaction(fn: (tx: unknown) => Promise<unknown>) {
      const next = chain.then(() => run(fn))
      chain = next.catch(() => undefined)
      return next
    },
  }
  return { db: db as unknown as Parameters<typeof awardBadge>[2], points: () => points, has: (k: string) => userBadges.has(k) }
}

describe("awardBadge (create statt upsert)", () => {
  test("neues Abzeichen: angelegt und Punkte gutgeschrieben", async () => {
    const f = fakeBadgeDb()
    assert.equal(await awardBadge("u1", { id: "b1", points: 75 }, f.db), true)
    assert.equal(f.has("u1:b1"), true)
    assert.equal(f.points(), 75)
  })

  test("schon vergeben (gleichzeitige Anfrage): P2002 abgefangen, keine Punkte", async () => {
    const f = fakeBadgeDb(["u1:b1"])
    assert.equal(await awardBadge("u1", { id: "b1", points: 75 }, f.db), false)
    assert.equal(f.points(), 0)
  })

  test("zwei gleichzeitige Vergaben: nur eine zählt", async () => {
    const f = fakeBadgeDb()
    const results = await Promise.all([
      awardBadge("u1", { id: "b1", points: 50 }, f.db),
      awardBadge("u1", { id: "b1", points: 50 }, f.db),
    ])
    assert.deepEqual(results.filter(Boolean).length, 1)
    assert.equal(f.points(), 50)
  })

  test("anderer Fehler geht weiter", async () => {
    const db = {
      async $transaction() {
        throw new Error("Datenbank weg")
      },
    } as unknown as Parameters<typeof awardBadge>[2]
    await assert.rejects(awardBadge("u1", { id: "b1", points: 5 }, db), /Datenbank weg/)
  })
})
