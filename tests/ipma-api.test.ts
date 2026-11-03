// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// tests/ipma-api.test.ts
// API des IPMA-Prüfungssimulators ohne Datenbank (Spezifikation 7.4): Zod-Schemas, reine Serverhilfen
// (toClientItem, toSolvedItem, buildAttemptView, checkAnswerWindow, computePointsAward) und die Routen-Abläufe
// aus lib/ipma/handlers.ts mit einer Fake-Prisma-Schicht (tests/helpers/ipma-fake-db.ts).
// Ausführen: npm test

import { describe, test } from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import type { NextResponse } from "next/server"
import { ipmaAchievementStats } from "@/lib/ipma/achievements"
import { COMPETENCE_IDS } from "@/lib/ipma/competences"
import { EXAM_CONFIG, configSnapshot } from "@/lib/ipma/config"
import {
  handleAbortAttempt,
  handleAssess,
  handleCheckItem,
  handleCreateAttempt,
  handleFinish,
  handleGetAttempt,
  handleOverview,
  handlePause,
  handleSaveItem,
  handleSelfAssess,
  handleSubmit,
  type ParamsInput,
} from "@/lib/ipma/handlers"
import { buildPool, type Pool } from "@/lib/ipma/pool"
import {
  IpmaError,
  RATE_LIMITS,
  buildAttemptView,
  checkAnswerWindow,
  checkRateLimit,
  computePointsAward,
  toClientItem,
  toSolvedItem,
  type IpmaDeps,
  type IpmaUser,
  type StoredAttempt,
  type StoredItem,
} from "@/lib/ipma/server"
import type { AttemptView, SolvedItem } from "@/lib/ipma/types"
import { createAttemptSchema, saveItemSchema, selfAssessSchema } from "@/lib/validations/ipma"
import type { McQuestion, PoolQuestion } from "@/lib/validations/ipma-pool"
import { createFakeDb, fakeId, type FakeDb } from "./helpers/ipma-fake-db"
import { miniSources } from "./helpers/ipma-mini"

const POOL: Pool = buildPool(miniSources(3, 2), null)
const START = new Date("2026-11-20T08:00:00.000Z")
const FORBIDDEN_KEYS = [
  "correctOption", "richtig", "explanation", "erklaerung", "optionHints", "optionHinweise", "modelAnswer",
  "musterloesung", "rubric", "bewertungsraster", "source", "fundstelle", "optionOrder", "seed", "questionId",
  "competence",
]

// ---------- Hilfen ----------

interface Ctx {
  fake: FakeDb
  deps: IpmaDeps
  clock: { now: Date }
  user: IpmaUser
}

function context(opts: { pro?: boolean; user?: IpmaUser | null; fake?: FakeDb; clock?: { now: Date } } = {}): Ctx {
  const user: IpmaUser = { id: "user-a", email: "a@example.test" }
  const fake = opts.fake ?? createFakeDb(["user-a", "user-b"])
  const clock = opts.clock ?? { now: new Date(START) }
  const sessionUser = opts.user === undefined ? user : opts.user
  let seed = 1000
  const deps: IpmaDeps = {
    db: fake.db,
    getUser: async () => sessionUser,
    hasPro: async () => opts.pro === true,
    now: () => new Date(clock.now),
    pool: () => POOL,
    catalog: () => new Map([["10-netzplan-und-gantt", { title: "Netzplan und Gantt", available: true }]]),
    seed: () => ++seed,
    rateLimit: () => true,
    awardBadges: async () => [],
    config: EXAM_CONFIG,
  }
  return { fake, deps, clock, user: sessionUser ?? user }
}

function req(method: string, body?: unknown, raw?: string): Request {
  const init: RequestInit = { method }
  if (raw !== undefined) init.body = raw
  else if (body !== undefined) init.body = JSON.stringify(body)
  return new Request("http://localhost/api/ipma", init)
}

interface Res<T = Record<string, unknown>> {
  status: number
  body: T
  text: string
  headers: Headers
}

async function call<T = Record<string, unknown>>(p: Promise<NextResponse>): Promise<Res<T>> {
  const r = await p
  const text = await r.text()
  return { status: r.status, body: JSON.parse(text) as T, text, headers: r.headers }
}

const params = (id: string, position?: number): ParamsInput => ({ id, ...(position !== undefined ? { position: String(position) } : {}) })

async function start(ctx: Ctx, body: unknown): Promise<string> {
  const res = await call<{ id: string }>(handleCreateAttempt(req("POST", body), ctx.deps))
  assert.equal(res.status, 201, res.text)
  return res.body.id
}

function itemsOf(ctx: Ctx, attemptId: string) {
  return ctx.fake.tables().ipmaAttemptItem
    .filter((i) => i.attemptId === attemptId)
    .sort((a, b) => Number(a.position) - Number(b.position))
}

/** Anzeigeposition der richtigen Option einer gespeicherten MC-Position */
function rightDisplay(row: Record<string, unknown>): number {
  const q = POOL.byId.get(String(row.questionId)) as McQuestion
  return (row.optionOrder as number[]).indexOf(q.richtig)
}

async function getView(ctx: Ctx, id: string): Promise<Res<AttemptView>> {
  return call<AttemptView>(handleGetAttempt(req("GET"), params(id), ctx.deps))
}

// ---------- Zod-Schemas ----------

describe("Zod-Schemas", () => {
  test("createAttemptSchema: Vorgaben und Grenzen", () => {
    const exam = createAttemptSchema.parse({ mode: "exam" })
    assert.equal(exam.mode === "exam" && exam.variant, "strict")
    const training = createAttemptSchema.parse({ mode: "training", competences: ["3.04"] })
    assert.ok(training.mode === "training" && training.count === 10 && training.type === "beide")
    assert.equal(createAttemptSchema.safeParse({ mode: "training", competences: [] }).success, false)
    assert.equal(createAttemptSchema.safeParse({ mode: "training", competences: ["3.14"] }).success, false)
    assert.equal(createAttemptSchema.safeParse({ mode: "training", competences: ["3.04"], count: 31 }).success, false)
    assert.equal(createAttemptSchema.safeParse({ mode: "short", variant: "pausable" }).success, false)
    assert.equal(createAttemptSchema.safeParse({ mode: "exam", seed: 5 }).success, false)
  })

  test("saveItemSchema und selfAssessSchema", () => {
    assert.equal(saveItemSchema.safeParse({ text: "x".repeat(3001) }).success, false)
    assert.equal(saveItemSchema.safeParse({ text: "x".repeat(3000) }).success, true)
    assert.equal(saveItemSchema.safeParse({ choice: 4 }).success, false)
    assert.equal(saveItemSchema.safeParse({}).success, false)
    assert.equal(saveItemSchema.safeParse({ choice: null }).success, true)
    assert.equal(selfAssessSchema.safeParse({ scores: [5, 0] }).success, false)
    assert.equal(selfAssessSchema.safeParse({ scores: [1] }).success, false)
  })
})

// ---------- Reine Hilfen ----------

const MC: PoolQuestion = POOL.questions.find((q) => q.typ === "mc") as PoolQuestion
const OPEN: PoolQuestion = POOL.questions.find((q) => q.typ === "offen") as PoolQuestion

function storedItem(over: Partial<StoredItem> = {}): StoredItem {
  return {
    position: 1, questionId: MC.id, questionVersion: 1, type: "mc", competence: MC.kompetenz, optionOrder: [3, 0, 2, 1],
    choice: null, text: null, flagged: false, locked: false, answeredAt: null, selfScores: [], selfAssessedAt: null,
    aiStatus: "none", aiScores: [], aiFeedback: null, aiAssessedAt: null, scoreSource: null, rasterPoints: null,
    correct: null, pointsQ: null, ...over,
  }
}

function storedAttempt(over: Partial<StoredAttempt> = {}): StoredAttempt {
  return {
    id: fakeId(), mode: "exam", variant: "strict", status: "active", itemCount: 2, startedAt: START,
    deadlineAt: new Date(START.getTime() + 180 * 60_000), pausedAt: null, resumedAt: null, activeSeconds: 0,
    submittedAt: null, finishedAt: null, config: { ...configSnapshot(), weights: { ...EXAM_CONFIG.weights } }, result: null, pointsQ: null, maxPointsQ: null,
    shownCount: null, passed: null, pointsAwarded: 0, ...over,
  }
}

const lookup = (id: string) => POOL.byId.get(id) ?? null

describe("toClientItem / toSolvedItem", () => {
  test("Anzeige ↔ Original: optionOrder [3,0,2,1], Original 2 = Anzeige 2; correctOption = Anzeige der richtigen", () => {
    const item = storedItem({ choice: 2 })
    const client = toClientItem(item, MC, { weights: EXAM_CONFIG.weights, showCompetence: false })
    assert.equal(client.choice, 2)
    const mc = MC as McQuestion
    assert.deepEqual(client.options, [mc.optionen[3], mc.optionen[0], mc.optionen[2], mc.optionen[1]])
    const solved = toSolvedItem(item, MC, { weights: EXAM_CONFIG.weights, catalog: new Map() })
    assert.equal(solved.correctOption, [3, 0, 2, 1].indexOf(mc.richtig))
    assert.equal(solved.questionId, MC.id)
  })

  test("ClientItem enthält nur die Allow-Liste", () => {
    const client = toClientItem(storedItem(), MC, { weights: EXAM_CONFIG.weights, showCompetence: false })
    assert.deepEqual(Object.keys(client).sort(), ["choice", "flagged", "locked", "options", "points", "position", "question", "text", "type"])
    const training = toClientItem(storedItem(), MC, { weights: EXAM_CONFIG.weights, showCompetence: true })
    assert.equal(training.competence, MC.kompetenz)
  })

  test("buildAttemptView eines aktiven Prüfungsversuchs: keine verbotenen Schlüssel und Texte", () => {
    const items = [storedItem(), storedItem({ position: 2, questionId: OPEN.id, type: "offen", competence: OPEN.kompetenz, optionOrder: [], text: "Meine Antwort" })]
    const view = buildAttemptView(storedAttempt(), items, { lookup, catalog: new Map(), now: START, canUseAi: false })
    const json = JSON.stringify(view)
    for (const key of FORBIDDEN_KEYS) assert.equal(json.includes(`"${key}"`), false, `Schlüssel ${key} vor der Abgabe`)
    assert.equal(json.includes((MC as McQuestion).erklaerung), false)
    assert.equal(json.includes(OPEN.typ === "offen" ? OPEN.musterloesung : "-"), false)
    assert.equal(view.result, null)
  })

  test("abgebrochen: nur Kopfdaten", () => {
    const view = buildAttemptView(storedAttempt({ status: "aborted" }), [storedItem()], { lookup, catalog: new Map(), now: START, canUseAi: false })
    assert.deepEqual(view.items, [])
  })
})

describe("checkAnswerWindow (Uhr auf dem Server)", () => {
  const attempt = storedAttempt()
  const deadline = attempt.deadlineAt as Date
  test("+29 s erlaubt, +30 s erlaubt, +31 s → 422 TIME_UP", () => {
    checkAnswerWindow(attempt, new Date(deadline.getTime() + 29_000))
    checkAnswerWindow(attempt, new Date(deadline.getTime() + 30_000))
    assert.throws(() => checkAnswerWindow(attempt, new Date(deadline.getTime() + 31_000)),
      (e: unknown) => e instanceof IpmaError && e.status === 422 && e.code === "TIME_UP")
  })
  test("nicht aktiv → 409 NOT_ACTIVE", () => {
    assert.throws(() => checkAnswerWindow({ ...attempt, status: "submitted" }, START),
      (e: unknown) => e instanceof IpmaError && e.status === 409)
  })
})

describe("computePointsAward (6.10: nur Bestwert-Verbesserung)", () => {
  test("Bestwert 0 → 65 % gibt 65; danach 60 % gibt 0; danach 80 % gibt 15", () => {
    assert.equal(computePointsAward(null, 65), 65)
    assert.equal(computePointsAward(65, 60), 0)
    assert.equal(computePointsAward(65, 80), 15)
    assert.equal(computePointsAward(65.9, 66.2), 1)
  })
})

describe("ipmaAchievementStats (6.10)", () => {
  const exam = (over: Record<string, unknown>) => ({
    mode: "exam", variant: "strict", status: "finished", pointsQ: 300, maxPointsQ: 480, shownCount: 24, passed: true, ...over,
  })
  test("Prüfungsluft, Bestanden, Souverän nur unter Echtbedingungen, Kompass, Lückenschliesser", () => {
    const a = ipmaAchievementStats([exam({ variant: "pausable", pointsQ: 400, shownCount: 28 })], [])
    assert.deepEqual([...a].sort(), ["ipma_erste_pruefung", "ipma_kompass"])
    const b = ipmaAchievementStats([exam({ pointsQ: 384, shownCount: 26 })], [])
    assert.ok(b.has("ipma_bestanden") && b.has("ipma_souveraen") && !b.has("ipma_kompass"))
    const gaps = Array.from({ length: 10 }, () => ({ ...exam({}), mode: "gaps" }))
    assert.ok(ipmaAchievementStats(gaps, []).has("ipma_lueckenschliesser"))
    assert.equal(ipmaAchievementStats(gaps.slice(1), []).has("ipma_lueckenschliesser"), false)
  })
  test("Landkarte komplett: alle 28 «sicher»", () => {
    const answers = COMPETENCE_IDS.flatMap((competence) => [1, 2, 3].map((at) => ({ competence, score: 1, at })))
    assert.ok(ipmaAchievementStats([], answers).has("ipma_landkarte"))
    assert.equal(ipmaAchievementStats([], answers.slice(3)).has("ipma_landkarte"), false)
  })
})

// ---------- Routen-Abläufe ----------

describe("Ohne Session: 401 bei jeder Route", () => {
  test("alle Handler", async () => {
    const ctx = context({ user: null })
    const id = fakeId()
    const calls: Promise<NextResponse>[] = [
      handleOverview(req("GET"), ctx.deps),
      handleCreateAttempt(req("POST", { mode: "exam" }), ctx.deps),
      handleGetAttempt(req("GET"), params(id), ctx.deps),
      handleAbortAttempt(req("DELETE"), params(id), ctx.deps),
      handleSaveItem(req("PUT", { choice: 1 }), params(id, 1), ctx.deps),
      handleCheckItem(req("POST", {}), params(id, 1), ctx.deps),
      handleSelfAssess(req("PUT", { scores: [1, 1] }), params(id, 1), ctx.deps),
      handleAssess(req("POST", {}), params(id, 1), ctx.deps),
      handlePause(req("POST", { paused: true }), params(id), ctx.deps),
      handleSubmit(req("POST", {}), params(id), ctx.deps),
      handleFinish(req("POST", {}), params(id), ctx.deps),
    ]
    for (const p of calls) {
      const res = await call(p)
      assert.equal(res.status, 401)
      assert.equal(res.headers.get("cache-control"), "private, no-store")
    }
  })
})

describe("Free-Konto: Simulator ohne 403, Claude-Bewertung 403", () => {
  test("Übungsprüfung starten, lesen, speichern, abgeben, abschliessen; Training prüfen", async () => {
    const ctx = context({ pro: false })
    const id = await start(ctx, { mode: "exam" })
    assert.equal((await getView(ctx, id)).status, 200)
    assert.equal((await call(handleSaveItem(req("PUT", { choice: 0 }), params(id, 1), ctx.deps))).status, 200)
    assert.equal((await call(handleSubmit(req("POST"), params(id), ctx.deps))).status, 200)
    assert.equal((await call(handleFinish(req("POST"), params(id), ctx.deps))).status, 200)
    const t = await start(ctx, { mode: "training", competences: ["3.04"], count: 5 })
    assert.equal((await call(handleCheckItem(req("POST"), params(t, 1), ctx.deps))).status, 200)
    assert.equal((await call(handleOverview(req("GET"), ctx.deps))).status, 200)
  })

  test("assess: Free → 403 PRO_REQUIRED; Pro ohne Claude-Abhängigkeit → Vorbedingungen, dann 502 AI_UNAVAILABLE", async () => {
    const free = context({ pro: false })
    const id = await start(free, { mode: "training", competences: ["1.01"], type: "offen", count: 5 })
    const res = await call(handleAssess(req("POST"), params(id, 1), free.deps))
    assert.equal(res.status, 403)
    assert.equal(res.body.code, "PRO_REQUIRED")

    const pro = context({ pro: true, fake: free.fake, clock: free.clock })
    assert.equal((await call(handleAssess(req("POST"), params(id, 1), pro.deps))).status, 409) // noch nicht geprüft
    await call(handleSaveItem(req("PUT", { text: "Zwei Punkte mit Begründung." }), params(id, 1), pro.deps))
    assert.equal((await call(handleCheckItem(req("POST"), params(id, 1), pro.deps))).status, 200)
    const selfFirst = await call(handleAssess(req("POST"), params(id, 1), pro.deps))
    assert.equal(selfFirst.status, 422)
    assert.equal(selfFirst.body.code, "SELF_FIRST")
    assert.equal((await call(handleSelfAssess(req("PUT", { scores: [2, 1] }), params(id, 1), pro.deps))).status, 200)
    const assess = await call(handleAssess(req("POST"), params(id, 1), pro.deps))
    assert.equal(assess.status, 502)
    assert.equal(assess.body.code, "AI_UNAVAILABLE")
  })
})

describe("Fremder Versuch und ungültige IDs", () => {
  test("404 (nie 403) bei GET, PUT, check, self, assess, pause, submit, finish, DELETE", async () => {
    const owner = context({ pro: true })
    const id = await start(owner, { mode: "exam", variant: "pausable" })
    const other = context({ pro: true, user: { id: "user-b" }, fake: owner.fake, clock: owner.clock })
    const calls: Promise<NextResponse>[] = [
      handleGetAttempt(req("GET"), params(id), other.deps),
      handleSaveItem(req("PUT", { choice: 1 }), params(id, 1), other.deps),
      handleCheckItem(req("POST"), params(id, 1), other.deps),
      handleSelfAssess(req("PUT", { scores: [1, 1] }), params(id, 61), other.deps),
      handleAssess(req("POST"), params(id, 61), other.deps),
      handlePause(req("POST", { paused: true }), params(id), other.deps),
      handleSubmit(req("POST"), params(id), other.deps),
      handleFinish(req("POST"), params(id), other.deps),
      handleAbortAttempt(req("DELETE"), params(id), other.deps),
    ]
    for (const p of calls) {
      const res = await call(p)
      assert.equal(res.status, 404, res.text)
      assert.equal(res.text.includes("optionen"), false)
    }
    assert.equal(owner.fake.tables().ipmaAttempt.find((a) => a.id === id)?.status, "active")
  })

  test("keine cuid → 400, unbekannte cuid → 404, Position ausserhalb → 400", async () => {
    const ctx = context()
    assert.equal((await getView(ctx, "kein-cuid")).status, 400)
    assert.equal((await getView(ctx, fakeId())).status, 404)
    const id = await start(ctx, { mode: "short" })
    assert.equal((await call(handleSaveItem(req("PUT", { choice: 1 }), params(id, 91), ctx.deps))).status, 400)
    assert.equal((await call(handleSaveItem(req("PUT", { choice: 1 }), params(id, 25), ctx.deps))).status, 404)
  })
})

describe("Keine Lösungen vor der Abgabe", () => {
  test("GET eines aktiven Prüfungsversuchs: keine verbotenen Schlüssel, keine Erklärungen und Musterlösungen", async () => {
    const ctx = context()
    const id = await start(ctx, { mode: "exam" })
    await call(handleSaveItem(req("PUT", { choice: 2, flagged: true }), params(id, 1), ctx.deps))
    await call(handleSaveItem(req("PUT", { text: "Eine eigene Antwort." }), params(id, 61), ctx.deps))
    const res = await getView(ctx, id)
    assert.equal(res.status, 200)
    assert.equal(res.body.items.length, 90)
    for (const key of FORBIDDEN_KEYS) assert.equal(res.text.includes(`"${key}"`), false, `Schlüssel ${key} vor der Abgabe`)
    for (const row of itemsOf(ctx, id)) {
      const q = POOL.byId.get(String(row.questionId)) as PoolQuestion
      if (q.typ === "mc") assert.equal(res.text.includes(q.erklaerung), false)
      else assert.equal(res.text.includes(q.musterloesung), false)
      assert.equal(res.text.includes(q.id), false)
    }
    assert.equal(res.body.items[0].choice, 2)
    assert.equal(res.body.items[0].flagged, true)
    assert.equal(res.body.items[60].text, "Eine eigene Antwort.")
    assert.equal(res.body.result, null)
    assert.ok(res.body.serverNow && res.body.deadlineAt)
  })

  test("Training: vor «Prüfen» keine Lösung, danach genau für diese Position", async () => {
    const ctx = context()
    const id = await start(ctx, { mode: "training", competences: ["2.01", "3.04"], count: 6 })
    const before = await getView(ctx, id)
    assert.equal(before.text.includes('"correctOption"') || before.text.includes('"modelAnswer"'), false)
    assert.ok(before.body.items.every((i) => i.competence !== undefined), "Training zeigt die Kompetenz")
    const checked = await call<SolvedItem>(handleCheckItem(req("POST"), params(id, 3), ctx.deps))
    assert.equal(checked.status, 200)
    assert.equal(checked.body.position, 3)
    assert.ok(checked.body.questionId)
    const after = await getView(ctx, id)
    for (const item of after.body.items) {
      const solved = "questionId" in item
      assert.equal(solved, item.position === 3, `Position ${item.position}`)
    }
  })

  test("Prüfung: «Prüfen» abgelehnt (409)", async () => {
    const ctx = context()
    const id = await start(ctx, { mode: "short" })
    assert.equal((await call(handleCheckItem(req("POST"), params(id, 1), ctx.deps))).status, 409)
  })
})

describe("Anzeigeposition ↔ Original über die API", () => {
  test("Wahl der Anzeigeposition 2 speichert optionOrder[2]; nach Abgabe correctOption als Anzeigeposition", async () => {
    const ctx = context()
    const id = await start(ctx, { mode: "short" })
    await call(handleSaveItem(req("PUT", { choice: 2 }), params(id, 1), ctx.deps))
    const row = itemsOf(ctx, id)[0]
    assert.equal(row.choice, (row.optionOrder as number[])[2])
    const submitted = await call<AttemptView>(handleSubmit(req("POST"), params(id), ctx.deps))
    const first = submitted.body.items[0] as SolvedItem
    assert.equal(first.correctOption, rightDisplay(row))
    assert.equal(first.choice, 2)
  })
})

describe("Uhr und Zeitablauf", () => {
  test("Speichern bei deadlineAt + 29 s erlaubt, + 31 s → 422 TIME_UP; GET danach gibt ab", async () => {
    const ctx = context()
    const id = await start(ctx, { mode: "exam" })
    const deadline = START.getTime() + EXAM_CONFIG.exam.durationMin * 60_000
    ctx.clock.now = new Date(deadline + 29_000)
    assert.equal((await call(handleSaveItem(req("PUT", { choice: 1 }), params(id, 1), ctx.deps))).status, 200)
    ctx.clock.now = new Date(deadline + 31_000)
    const late = await call(handleSaveItem(req("PUT", { choice: 2 }), params(id, 1), ctx.deps))
    assert.equal(late.status, 422)
    assert.equal(late.body.code, "TIME_UP")
    const view = await getView(ctx, id)
    assert.equal(view.body.status, "submitted")
    assert.equal(view.body.activeSeconds, EXAM_CONFIG.exam.durationMin * 60)
    assert.ok(view.body.result)
  })

  test("Kurzprüfung: 40 Minuten; Training ohne Uhr", async () => {
    const ctx = context()
    const s = await start(ctx, { mode: "short" })
    assert.equal((await getView(ctx, s)).body.deadlineAt, new Date(START.getTime() + 40 * 60_000).toISOString())
    const t = await start(ctx, { mode: "training", competences: ["1.01"], count: 5 })
    assert.equal((await getView(ctx, t)).body.deadlineAt, null)
  })

  test("Variante «mit Pausen»: keine Frist, aktive Zeit ohne Pausen", async () => {
    const ctx = context()
    const id = await start(ctx, { mode: "exam", variant: "pausable" })
    ctx.clock.now = new Date(START.getTime() + 600_000)
    const paused = await call(handlePause(req("POST", { paused: true }), params(id), ctx.deps))
    assert.deepEqual(paused.body, { activeSeconds: 600, paused: true })
    ctx.clock.now = new Date(START.getTime() + 4 * 3600_000)
    assert.equal((await getView(ctx, id)).body.activeSeconds, 600)
    await call(handlePause(req("POST", { paused: false }), params(id), ctx.deps))
    ctx.clock.now = new Date(START.getTime() + 4 * 3600_000 + 60_000)
    const view = await getView(ctx, id)
    assert.equal(view.body.activeSeconds, 660)
    assert.equal(view.body.deadlineAt, null)
    assert.equal((await call(handleSaveItem(req("PUT", { choice: 1 }), params(id, 1), ctx.deps))).status, 200)
    const strict = await start(ctx, { mode: "short" })
    assert.equal((await call(handlePause(req("POST", { paused: true }), params(strict), ctx.deps))).status, 409)
  })
})

describe("Gesperrt und Eingaben", () => {
  test("Speichern nach Abgabe oder nach «Prüfen» → 409", async () => {
    const ctx = context()
    const exam = await start(ctx, { mode: "short" })
    await call(handleSubmit(req("POST"), params(exam), ctx.deps))
    assert.equal((await call(handleSaveItem(req("PUT", { choice: 1 }), params(exam, 1), ctx.deps))).status, 409)
    const t = await start(ctx, { mode: "training", competences: ["1.02"], type: "mc", count: 5 })
    await call(handleCheckItem(req("POST"), params(t, 1), ctx.deps))
    assert.equal((await call(handleSaveItem(req("PUT", { choice: 1 }), params(t, 1), ctx.deps))).status, 409)
    assert.equal((await call(handleCheckItem(req("POST"), params(t, 1), ctx.deps))).status, 409)
  })

  test("text 3'001 Zeichen, choice 4, Freitext bei MC, Körper > 16 KB, kein JSON", async () => {
    const ctx = context()
    const id = await start(ctx, { mode: "exam" })
    const status = async (p: Promise<NextResponse>) => (await call(p)).status
    assert.equal(await status(handleSaveItem(req("PUT", { text: "x".repeat(3001) }), params(id, 61), ctx.deps)), 400)
    assert.equal(await status(handleSaveItem(req("PUT", { choice: 4 }), params(id, 1), ctx.deps)), 400)
    assert.equal(await status(handleSaveItem(req("PUT", { text: "Freitext" }), params(id, 1), ctx.deps)), 400)
    assert.equal(await status(handleSaveItem(req("PUT", undefined, JSON.stringify({ text: "x".repeat(17 * 1024) })), params(id, 61), ctx.deps)), 413)
    assert.equal(await status(handleSaveItem(req("PUT", undefined, "{kaputt"), params(id, 61), ctx.deps)), 400)
  })

  test("Selbstbewertung: Wert über Raster, falsche Länge → 400; MC → 422; vor Abgabe → 409", async () => {
    const ctx = context()
    const id = await start(ctx, { mode: "exam" })
    await call(handleSaveItem(req("PUT", { text: "Meine Antwort mit zwei Punkten." }), params(id, 61), ctx.deps))
    assert.equal((await call(handleSelfAssess(req("PUT", { scores: [1, 1] }), params(id, 61), ctx.deps))).status, 409)
    await call(handleSubmit(req("POST"), params(id), ctx.deps))
    const status = async (scores: number[], position = 61) => (await call(handleSelfAssess(req("PUT", { scores }), params(id, position), ctx.deps))).status
    assert.equal(await status([3, 0]), 400) // Raster je Kriterium höchstens 2
    assert.equal(await status([1, 1, 1]), 400)
    assert.equal(await status([1, 1], 1), 422)
    assert.equal(await status([1, 1], 62), 422) // leere Antwort
    assert.equal(await status([2, 1]), 200)
    const view = await getView(ctx, id)
    const item = view.body.items[60] as SolvedItem
    assert.equal(item.rasterPoints, 3)
    assert.equal(item.scoreSource, "self")
    assert.equal(item.correct, true)
    assert.equal(await status([1, 0]), 200) // bis zum Abschluss änderbar
    assert.equal(((await getView(ctx, id)).body.items[60] as SolvedItem).rasterPoints, 1)
  })
})

describe("Ein aktiver Versuch je Modus", () => {
  test("zweiter Start ohne replaceActive → 409 mit activeAttemptId; mit replaceActive → alter «aborted»", async () => {
    const ctx = context()
    const first = await start(ctx, { mode: "exam" })
    const again = await call(handleCreateAttempt(req("POST", { mode: "exam", variant: "pausable" }), ctx.deps))
    assert.equal(again.status, 409)
    assert.equal(again.body.code, "ACTIVE_EXISTS")
    assert.equal(again.body.activeAttemptId, first)
    await start(ctx, { mode: "short" }) // anderer Modus erlaubt
    const second = await start(ctx, { mode: "exam", replaceActive: true })
    const rows = ctx.fake.tables().ipmaAttempt
    assert.equal(rows.find((a) => a.id === first)?.status, "aborted")
    assert.equal(rows.find((a) => a.id === second)?.status, "active")
    assert.deepEqual((await getView(ctx, first)).body.items, [])
  })

  test("Abbrechen: aktiv → aborted, abgegeben → 409", async () => {
    const ctx = context()
    const a = await start(ctx, { mode: "short" })
    assert.deepEqual((await call(handleAbortAttempt(req("DELETE"), params(a), ctx.deps))).body, { ok: true })
    assert.equal((await call(handleAbortAttempt(req("DELETE"), params(a), ctx.deps))).status, 200)
    const b = await start(ctx, { mode: "short" })
    await call(handleSubmit(req("POST"), params(b), ctx.deps))
    assert.equal((await call(handleAbortAttempt(req("DELETE"), params(b), ctx.deps))).status, 409)
  })
})

describe("Abgabe, Abschluss, Punkte, Station 24", () => {
  async function playExam(ctx: Ctx, correctMc: boolean): Promise<string> {
    const id = await start(ctx, { mode: "exam" })
    for (const row of itemsOf(ctx, id)) {
      if (row.type !== "mc") continue
      const display = correctMc ? rightDisplay(row) : (rightDisplay(row) + 1) % 4
      await call(handleSaveItem(req("PUT", { choice: display }), params(id, Number(row.position)), ctx.deps))
    }
    return id
  }

  test("Abgabe und Abschluss idempotent, Punkte nur für Bestwert-Verbesserung, Station 24, Leitner", async () => {
    const ctx = context()
    const id = await playExam(ctx, true)
    const s1 = await call<AttemptView>(handleSubmit(req("POST"), params(id), ctx.deps))
    const s2 = await call<AttemptView>(handleSubmit(req("POST"), params(id), ctx.deps))
    assert.equal(s1.status, 200)
    assert.deepEqual(s2.body.items, s1.body.items)
    assert.equal(s1.body.result?.pointsQ, 240) // 60 MC richtig, 30 offene leer → 0
    assert.equal(s1.body.result?.maxPointsQ, 480)
    assert.equal(ctx.fake.tables().lernfortschritt[0]?.status, "begonnen")

    const f1 = await call<{ result: { pointsQ: number }; pointsAwarded: number; newBadges: unknown[] }>(handleFinish(req("POST"), params(id), ctx.deps))
    const f2 = await call<{ result: { pointsQ: number }; pointsAwarded: number; newBadges: unknown[] }>(handleFinish(req("POST"), params(id), ctx.deps))
    assert.equal(f1.status, 200)
    assert.equal(f1.body.pointsAwarded, 50)
    assert.deepEqual(f2.body.result, f1.body.result)
    assert.equal(f2.body.pointsAwarded, 50)
    assert.deepEqual(f2.body.newBadges, [])
    const user = () => ctx.fake.tables().user.find((u) => u.id === "user-a")
    assert.equal(user()?.points, 50, "Punkte nur einmal")
    const station = ctx.fake.tables().lernfortschritt.find((l) => l.thema === "24-ipma-pruefungssimulator")
    assert.equal(station?.status, "erledigt")
    assert.equal(station?.quizRichtig, 60)
    assert.equal(station?.quizGesamt, 120)
    const states = ctx.fake.tables().ipmaQuestionState.filter((s) => s.userId === "user-a")
    assert.ok(states.some((s) => s.box === 1 && s.lastCorrect === true), "richtige MC in Fach 1")
    assert.ok(states.some((s) => s.box === 1 && s.lastCorrect === false), "leere offene Fragen in Fach 1 (falsch)")
    assert.equal((await call(handleSaveItem(req("PUT", { choice: 1 }), params(id, 1), ctx.deps))).status, 409)

    // Zweite Prüfung schlechter: keine Punkte; Station bleibt «erledigt» mit neuem Ergebnis
    const worse = await playExam(ctx, false)
    await call(handleSubmit(req("POST"), params(worse), ctx.deps))
    const f3 = await call<{ pointsAwarded: number }>(handleFinish(req("POST"), params(worse), ctx.deps))
    assert.equal(f3.body.pointsAwarded, 0)
    assert.equal(user()?.points, 50)
    const station2 = ctx.fake.tables().lernfortschritt.find((l) => l.thema === "24-ipma-pruefungssimulator")
    assert.equal(station2?.status, "erledigt")
    assert.equal(station2?.quizRichtig, 0)
  })

  test("Abschluss einer Prüfung vor der Abgabe → 409 NOT_SUBMITTED; nach Ablauf gibt finish selbst ab", async () => {
    const ctx = context()
    const id = await start(ctx, { mode: "short" })
    const early = await call(handleFinish(req("POST"), params(id), ctx.deps))
    assert.equal(early.status, 409)
    assert.equal(early.body.code, "NOT_SUBMITTED")
    ctx.clock.now = new Date(START.getTime() + 41 * 60_000)
    assert.equal((await call(handleFinish(req("POST"), params(id), ctx.deps))).status, 200)
  })

  test("Training: 1 Punkt je erstmals richtiger Frage, Abschluss ohne weitere Punkte", async () => {
    const ctx = context()
    const id = await start(ctx, { mode: "training", competences: ["3.04"], type: "mc", count: 5 })
    const rows = itemsOf(ctx, id)
    for (const row of rows) {
      await call(handleSaveItem(req("PUT", { choice: rightDisplay(row) }), params(id, Number(row.position)), ctx.deps))
      const checked = await call<SolvedItem>(handleCheckItem(req("POST"), params(id, Number(row.position)), ctx.deps))
      assert.equal(checked.body.correct, true)
    }
    const user = () => ctx.fake.tables().user.find((u) => u.id === "user-a")
    assert.equal(user()?.points, rows.length)
    const fin = await call<{ pointsAwarded: number; result: { pointsQ: number } }>(handleFinish(req("POST"), params(id), ctx.deps))
    assert.equal(fin.status, 200)
    assert.equal(fin.body.pointsAwarded, rows.length)
    assert.equal(user()?.points, rows.length)

    // Zweites Training mit denselben Fragen: keine Punkte mehr
    const again = await start(ctx, { mode: "training", competences: ["3.04"], type: "mc", count: 5 })
    for (const row of itemsOf(ctx, again)) {
      await call(handleSaveItem(req("PUT", { choice: rightDisplay(row) }), params(again, Number(row.position)), ctx.deps))
      await call(handleCheckItem(req("POST"), params(again, Number(row.position)), ctx.deps))
    }
    assert.equal(user()?.points, rows.length)
  })

  test("erstmals richtig nur einmal, auch wenn der gelesene Leitner-Stand veraltet ist", async () => {
    const ctx = context()
    const first = await start(ctx, { mode: "training", competences: ["3.04"], type: "mc", count: 5 })
    const rows = itemsOf(ctx, first)
    for (const row of rows) {
      await call(handleSaveItem(req("PUT", { choice: rightDisplay(row) }), params(first, Number(row.position)), ctx.deps))
      await call(handleCheckItem(req("POST"), params(first, Number(row.position)), ctx.deps))
    }
    await call(handleFinish(req("POST"), params(first), ctx.deps))
    const user = () => ctx.fake.tables().user.find((u) => u.id === "user-a")
    assert.equal(user()?.points, rows.length)

    // Gleichzeitiger Ablauf: findMany liefert noch correctCount 0, die Datenbank ist schon weiter
    const states = ctx.fake.db.ipmaQuestionState as unknown as { findMany: (args: unknown) => Promise<Record<string, unknown>[]> }
    const original = states.findMany.bind(states)
    states.findMany = async (args) => (await original(args)).map((r) => ({ ...r, correctCount: 0 }))
    try {
      const again = await start(ctx, { mode: "training", competences: ["3.04"], type: "mc", count: 5 })
      for (const row of itemsOf(ctx, again)) {
        await call(handleSaveItem(req("PUT", { choice: rightDisplay(row) }), params(again, Number(row.position)), ctx.deps))
        await call(handleCheckItem(req("POST"), params(again, Number(row.position)), ctx.deps))
      }
    } finally {
      states.findMany = original
    }
    assert.equal(user()?.points, rows.length, "kein zweiter Punkt")
    const counts = ctx.fake.tables().ipmaQuestionState.filter((r) => r.userId === "user-a").map((r) => r.correctCount)
    assert.ok(counts.every((c) => c === 2), "correctCount weiter gezählt")
  })

  test("Lücken schliessen und Übersicht", async () => {
    const ctx = context()
    const id = await start(ctx, { mode: "gaps" })
    const attempt = ctx.fake.tables().ipmaAttempt.find((a) => a.id === id)
    assert.equal((attempt?.competences as string[]).length, 3)
    const overview = await call<{ active: { id: string }[]; mastery: unknown[]; pool: Record<string, { mc: number }>; canUseAi: boolean }>(
      handleOverview(req("GET"), ctx.deps))
    assert.equal(overview.status, 200)
    assert.deepEqual(overview.body.active.map((a) => a.id), [id])
    assert.equal(overview.body.mastery.length, 28)
    assert.equal(overview.body.pool["3.04"].mc, 3)
    assert.equal(overview.body.canUseAi, false)
    for (const key of ["optionOrder", "seed", "questionId", "erklaerung", "musterloesung"]) {
      assert.equal(JSON.stringify(overview.body).includes(`"${key}"`), false)
    }
  })
})

describe("Rate-Limit", () => {
  test("11. Start in einer Minute → 429 mit Retry-After", async () => {
    const ctx = context()
    const rateUser = { id: `rate-${Math.random()}` }
    const deps: IpmaDeps = { ...ctx.deps, getUser: async () => rateUser, rateLimit: checkRateLimit }
    for (let i = 0; i < RATE_LIMITS.create; i++) {
      assert.notEqual((await call(handleCreateAttempt(req("POST", { mode: "unbekannt" }), deps))).status, 429)
    }
    const res = await call(handleCreateAttempt(req("POST", { mode: "exam" }), deps))
    assert.equal(res.status, 429)
    assert.equal(res.headers.get("retry-after"), "60")
  })
})

describe("Bündel (statisch)", () => {
  const roots = ["components/features/ipma", "app/(ipma)"].map((p) => path.join(process.cwd(), p))
  const files = (dir: string): string[] => !fs.existsSync(dir) ? [] : fs.readdirSync(dir, { withFileTypes: true })
    .flatMap((e) => e.isDirectory() ? files(path.join(dir, e.name)) : /\.(tsx?|jsx?)$/.test(e.name) ? [path.join(dir, e.name)] : [])
  test("Client-Module importieren weder Pool, Server, Grader, Auswahl noch Inhalte; types nur als «import type»", () => {
    for (const file of roots.flatMap(files)) {
      const src = fs.readFileSync(file, "utf8")
      assert.equal(/from\s+["']@\/content\/ipma/.test(src), false, file)
      assert.equal(/from\s+["']@\/lib\/ipma\/(pool|server|grader|selection|handlers|view)["']/.test(src), false, file)
      for (const m of src.matchAll(/^import\s+(type\s+)?[^;]*from\s+["']@\/lib\/ipma\/types["']/gm)) {
        assert.ok(m[1], `${file}: lib/ipma/types nur mit «import type»`)
      }
    }
  })
})
