// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// tests/helpers/ipma-fake-db.ts
// Fake-Prisma-Schicht für tests/ipma-api.test.ts (Spezifikation 7.4): Tabellen im Speicher mit genau den
// Abfragen, die lib/ipma/server.ts braucht (where mit Gleichheit, in, not, gte, lte; data mit increment;
// select; orderBy; take). Transaktionen laufen nacheinander und werden bei Fehlern zurückgenommen.
// Der Teil-Index «IpmaAttempt_aktiv_eindeutig» wird bei create nachgebildet (P2002). Nur für Tests.

import type { PrismaClient } from "@prisma/client"

type Row = Record<string, unknown>
type Where = Record<string, unknown>
type Data = Record<string, unknown>

interface Tables {
  ipmaAttempt: Row[]
  ipmaAttemptItem: Row[]
  ipmaQuestionState: Row[]
  lernfortschritt: Row[]
  user: Row[]
}

const prismaError = (code: string) => Object.assign(new Error(code), { code })

let idCounter = 0
/** cuid-ähnliche ID (besteht z.cuid) */
export function fakeId(): string {
  idCounter += 1
  return `cfake${String(idCounter).padStart(8, "0")}${Math.random().toString(36).slice(2, 10)}`
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v) && !(v instanceof Date)
}

function same(a: unknown, b: unknown): boolean {
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime()
  return a === b
}

function compare(a: unknown, b: unknown): number {
  const x = a instanceof Date ? a.getTime() : a
  const y = b instanceof Date ? b.getTime() : b
  if (typeof x === "number" && typeof y === "number") return x - y
  return String(x).localeCompare(String(y))
}

function matchValue(value: unknown, cond: unknown): boolean {
  if (isPlainObject(cond)) {
    for (const [op, arg] of Object.entries(cond)) {
      if (op === "in") { if (!(arg as unknown[]).some((x) => same(value, x))) return false }
      else if (op === "not") { if (arg === null ? value === null || value === undefined : same(value, arg)) return false }
      else if (op === "gte") { if (value === null || value === undefined || compare(value, arg) < 0) return false }
      else if (op === "lte") { if (value === null || value === undefined || compare(value, arg) > 0) return false }
      else if (op === "gt") { if (value === null || value === undefined || compare(value, arg) <= 0) return false }
      else if (op === "lt") { if (value === null || value === undefined || compare(value, arg) >= 0) return false }
      else throw new Error(`Fake: Operator ${op} fehlt`)
    }
    return true
  }
  if (cond === null) return value === null || value === undefined
  return same(value, cond)
}

/** Zusammengesetzte eindeutige Schlüssel (z. B. userId_fach_thema) werden flach verglichen */
function flatten(where: Where): Where {
  const out: Where = {}
  for (const [k, v] of Object.entries(where)) {
    if (k.includes("_") && isPlainObject(v)) Object.assign(out, v)
    else out[k] = v
  }
  return out
}

function matches(row: Row, where: Where = {}): boolean {
  return Object.entries(flatten(where)).every(([k, cond]) => cond === undefined || matchValue(row[k], cond))
}

function apply(row: Row, data: Data): void {
  for (const [k, v] of Object.entries(data)) {
    if (v === undefined) continue
    if (isPlainObject(v) && "increment" in v) row[k] = Number(row[k] ?? 0) + Number(v.increment)
    else row[k] = Array.isArray(v) ? [...v] : v
  }
}

function pick(row: Row, select?: Record<string, unknown>): Row {
  if (!select) return { ...row }
  const out: Row = {}
  for (const [k, v] of Object.entries(select)) if (v === true) out[k] = Array.isArray(row[k]) ? [...(row[k] as unknown[])] : row[k]
  return out
}

function sortRows(rows: Row[], orderBy?: Record<string, "asc" | "desc"> | Record<string, "asc" | "desc">[]): Row[] {
  if (!orderBy) return rows
  const list = Array.isArray(orderBy) ? orderBy : [orderBy]
  return rows.slice().sort((a, b) => {
    for (const o of list) {
      const [k, dir] = Object.entries(o)[0]
      const c = compare(a[k], b[k])
      if (c !== 0) return dir === "desc" ? -c : c
    }
    return 0
  })
}

const DEFAULTS: Record<keyof Tables, () => Row> = {
  ipmaAttempt: () => ({
    variant: "strict", competences: [], deadlineAt: null, pausedAt: null, resumedAt: null, activeSeconds: 0,
    submittedAt: null, finishedAt: null, pointsQ: null, maxPointsQ: null, shownCount: null, passed: null,
    result: null, pointsAwarded: 0, createdAt: new Date(), updatedAt: new Date(),
  }),
  ipmaAttemptItem: () => ({
    optionOrder: [], choice: null, text: null, flagged: false, answeredAt: null, locked: false, selfScores: [],
    selfAssessedAt: null, aiStatus: "none", aiScores: [], aiFeedback: null, aiTokens: 0, aiAssessedAt: null,
    scoreSource: null, rasterPoints: null, correct: null, pointsQ: null,
  }),
  ipmaQuestionState: () => ({ box: 0, dueAt: null, seenCount: 0, correctCount: 0, lastCorrect: null, lastSeenAt: null }),
  lernfortschritt: () => ({ quizRichtig: null, quizGesamt: null, createdAt: new Date(), updatedAt: new Date() }),
  user: () => ({ points: 0 }),
}

/** Eindeutige Schlüssel je Tabelle (für createMany skipDuplicates und P2002) */
const UNIQUE: Partial<Record<keyof Tables, string[][]>> = {
  ipmaAttemptItem: [["attemptId", "position"]],
  ipmaQuestionState: [["userId", "questionId"]],
  lernfortschritt: [["userId", "fach", "thema"]],
}

function violates(table: keyof Tables, rows: Row[], row: Row): boolean {
  if (table === "ipmaAttempt" && row.status === "active") {
    return rows.some((r) => r.userId === row.userId && r.mode === row.mode && r.status === "active")
  }
  return (UNIQUE[table] ?? []).some((keys) => rows.some((r) => keys.every((k) => same(r[k], row[k]))))
}

function delegate(tables: () => Tables, table: keyof Tables) {
  const rows = () => tables()[table]
  return {
    async findFirst(args: { where?: Where; select?: Record<string, unknown>; orderBy?: Record<string, "asc" | "desc"> }) {
      const found = sortRows(rows().filter((r) => matches(r, args.where)), args.orderBy)[0]
      return found ? pick(found, args.select) : null
    },
    async findUnique(args: { where: Where; select?: Record<string, unknown> }) {
      const found = rows().find((r) => matches(r, args.where))
      return found ? pick(found, args.select) : null
    },
    async findMany(args: { where?: Where; select?: Record<string, unknown>; orderBy?: Record<string, "asc" | "desc">; take?: number } = {}) {
      let list = sortRows(rows().filter((r) => matches(r, args.where)), args.orderBy)
      if (args.take !== undefined) list = list.slice(0, args.take)
      return list.map((r) => pick(r, args.select))
    },
    async count(args: { where?: Where } = {}) {
      return rows().filter((r) => matches(r, args.where)).length
    },
    async create(args: { data: Data; select?: Record<string, unknown> }) {
      const row: Row = { id: fakeId(), ...DEFAULTS[table]() }
      apply(row, args.data)
      if (violates(table, rows(), row)) throw prismaError("P2002")
      rows().push(row)
      return pick(row, args.select)
    },
    async createMany(args: { data: Data[]; skipDuplicates?: boolean }) {
      let count = 0
      for (const d of args.data) {
        const row: Row = { id: fakeId(), ...DEFAULTS[table]() }
        apply(row, d)
        if (violates(table, rows(), row)) {
          if (args.skipDuplicates) continue
          throw prismaError("P2002")
        }
        rows().push(row)
        count += 1
      }
      return { count }
    },
    async updateMany(args: { where?: Where; data: Data }) {
      const list = rows().filter((r) => matches(r, args.where))
      for (const r of list) { apply(r, args.data); if ("updatedAt" in r) r.updatedAt = new Date() }
      return { count: list.length }
    },
    async update(args: { where: Where; data: Data; select?: Record<string, unknown> }) {
      const found = rows().find((r) => matches(r, args.where))
      if (!found) throw prismaError("P2025")
      apply(found, args.data)
      return pick(found, args.select)
    },
    async upsert(args: { where: Where; create: Data; update: Data }) {
      const found = rows().find((r) => matches(r, args.where))
      if (found) { apply(found, args.update); return { ...found } }
      const row: Row = { id: fakeId(), ...DEFAULTS[table]() }
      apply(row, args.create)
      rows().push(row)
      return { ...row }
    },
  }
}

export interface FakeDb {
  db: PrismaClient
  tables: () => Tables
  /** Anzahl ausgeführter Transaktionen (für Idempotenz-Prüfungen) */
  transactions: () => number
}

/** Neue Fake-Datenbank; users = Konten mit Punktestand 0 */
export function createFakeDb(users: string[] = []): FakeDb {
  let current: Tables = {
    ipmaAttempt: [],
    ipmaAttemptItem: [],
    ipmaQuestionState: [],
    lernfortschritt: [],
    user: users.map((id) => ({ id, points: 0 })),
  }
  let txCount = 0
  let chain: Promise<unknown> = Promise.resolve()
  const tables = () => current
  const client = {
    ipmaAttempt: delegate(tables, "ipmaAttempt"),
    ipmaAttemptItem: delegate(tables, "ipmaAttemptItem"),
    ipmaQuestionState: delegate(tables, "ipmaQuestionState"),
    lernfortschritt: delegate(tables, "lernfortschritt"),
    user: delegate(tables, "user"),
    $transaction(fn: (tx: unknown) => Promise<unknown>) {
      const run = async () => {
        txCount += 1
        const backup = structuredClone(current)
        try {
          return await fn(client)
        } catch (error) {
          current = backup
          throw error
        }
      }
      const next = chain.then(run)
      chain = next.catch(() => undefined)
      return next
    },
  }
  return { db: client as unknown as PrismaClient, tables, transactions: () => txCount }
}
