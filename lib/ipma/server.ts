// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// lib/ipma/server.ts
// Serverlogik des IPMA-Prüfungssimulators (Spezifikation 5, 6.4, 6.6, 6.9, 6.10): Zugang, Rate-Limits,
// Fehlerantworten, Körpergrenze, Versuche anlegen, Antworten speichern, Prüfen (Training), Selbstbewertung,
// Claude-Bewertung (AP5), Pause, Abgabe, Abschluss (Punkte, Abzeichen, Station 24), Abbruch, Übersicht.
// Alle Abläufe bekommen ihre Abhängigkeiten über IpmaDeps (Datenbank, Session, Uhr, Pool), damit
// tests/ipma-api.test.ts sie mit einer Fake-Prisma-Schicht prüfen kann. NUR SERVER.

import { NextResponse } from "next/server"
import { Prisma, type PrismaClient } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/auth"
import { IPMA_GRADER_COST_FACTOR, anthropic } from "@/lib/claude"
import { checkApiCostLimit, incrementApiUsage } from "@/lib/subscription"
import { checkAndAwardBadges } from "@/lib/badges"
import {
  LeitstandError,
  hasLeitstandAccess,
  newSeed,
  prismaErrorCode,
  readLimitedText,
  retryOnPrismaCodes,
} from "@/lib/leitstand"
import { fortschrittSchreibdaten, type LernStatus } from "@/lib/validations/lernfortschritt"
import type { CreateAttemptInput, SaveItemInput } from "@/lib/validations/ipma"
import { COMPETENCE_IDS, RASTER_TOTAL, type CompetenceId } from "./competences"
import { CONFIG_VERSION, EXAM_CONFIG, configSnapshot, type ExamConfig } from "./config"
import { IpmaError } from "./errors"
import { billableTokens, gradeOpenAnswer, totalTokens, type GradeFailure, type GraderClient } from "./grader"
import { loadPool, loadStationCatalog, type Pool } from "./pool"
import { mastery, weakestCompetences, type Mastery } from "./review"
import type { StationCatalog } from "./scoring"
import { selectExam, selectGaps, selectShort, selectTraining, type Exposure, type SelectedItem } from "./selection"
import type {
  AttemptMode,
  AttemptSummary,
  AttemptView,
  AwardedBadgeView,
  FinishView,
  OverviewView,
  SolvedItem,
} from "./types"
import {
  asMode,
  asStatus,
  buildAttemptView,
  checkAnswerWindow,
  computePointsAward,
  currentActiveSeconds,
  gradedAnswers,
  isExamMode,
  isExpired,
  originalChoice,
  percentFloor,
  planLeitner,
  readConfig,
  resultOf,
  secondsBetween,
  toAttemptSummary,
  toSolvedItem,
  type QuestionStateRow,
  type StoredAttempt,
  type StoredItem,
} from "./view"

export { IpmaError } from "./errors"
export * from "./view"

// ---------- Konstanten ----------

/** Lernpfad-Station, die der Simulator meldet (6.9) */
export const IPMA_STATION = { fach: "pmgt", thema: "24-ipma-pruefungssimulator" } as const

/** Grösse des Anfrage-Körpers höchstens 16 KB (6.6) */
export const MAX_BODY_BYTES = 16 * 1024

export const NO_CACHE = { "Cache-Control": "private, no-store" } as const

/** Versuche der Start-Transaktion bei P2002 (Teil-Index) und der Abschluss-Transaktion bei P2034 */
const CREATE_ATTEMPTS = 3
const FINISH_ATTEMPTS = 3

/** Letzte Versuche je Modus in der Übersicht (6.6) */
const RECENT_PER_MODE = 10

const MODES: readonly AttemptMode[] = ["exam", "short", "training", "gaps"]

// ---------- Abhängigkeiten ----------

export interface IpmaUser {
  id: string
  email?: string | null
}

export type RatePurpose = keyof typeof RATE_LIMITS

/** Abhängigkeiten der Abläufe; in den Routen defaultDeps(), in den Tests Attrappen */
export interface IpmaDeps {
  db: PrismaClient
  getUser: () => Promise<IpmaUser | null>
  hasPro: (user: IpmaUser) => Promise<boolean>
  now: () => Date
  pool: () => Pool
  catalog: () => StationCatalog
  seed: () => number
  rateLimit: (userId: string, purpose: RatePurpose) => boolean
  awardBadges: (userId: string) => Promise<AwardedBadgeView[]>
  config: ExamConfig
  /** Claude-Bewertung (4.3); fehlt sie, antwortet «assess» nach den Vorbedingungen 502 AI_UNAVAILABLE */
  ai?: IpmaAiDeps
}

/** Abhängigkeiten der Claude-Bewertung (4.3); in den Tests Attrappen */
export interface IpmaAiDeps {
  client: GraderClient
  /** Monatsdeckel (lib/subscription.ts, gemeinsam mit Chat und Quiz) noch nicht erreicht */
  checkBudget: (userId: string) => Promise<boolean>
  /** Tokens auf das Konto buchen (Sonnet-Preise, siehe billableTokens) */
  recordUsage: (userId: string, inputTokens: number, outputTokens: number) => Promise<void>
  /** Tageszähler (4.3 Schritt 4) */
  quota: AssessQuota
}

export interface AssessQuota {
  available: (userId: string, now: Date) => boolean
  consume: (userId: string, now: Date) => void
}

let catalogCache: StationCatalog | null = null

/** Stationen des Lernpfads PMGT; je Prozess einmal gelesen (neue Stationen kommen mit einem neuen Image) */
function cachedCatalog(): StationCatalog {
  if (!catalogCache) catalogCache = loadStationCatalog()
  return catalogCache
}

async function sessionUser(): Promise<IpmaUser | null> {
  const user = await getCurrentUser()
  return user?.id ? { id: user.id, email: user.email } : null
}

/** Abhängigkeiten für die Routen */
export function defaultDeps(): IpmaDeps {
  return {
    db: prisma,
    getUser: sessionUser,
    hasPro: hasProAccess,
    now: () => new Date(),
    pool: loadPool,
    catalog: cachedCatalog,
    seed: newSeed,
    rateLimit: checkRateLimit,
    awardBadges: checkAndAwardBadges,
    config: EXAM_CONFIG,
    ai: defaultAiDeps(process.env.ANTHROPIC_API_KEY),
  }
}

/**
 * Claude-Bewertung nur mit gesetztem API-Schlüssel. Ohne Schlüssel fehlt sie: «assess» antwortet dann nach den
 * Vorbedingungen 502 AI_UNAVAILABLE (freundliche Meldung, Selbstbewertung gilt), ohne den Tageszähler zu belasten.
 */
export function defaultAiDeps(apiKey: string | undefined): IpmaAiDeps | undefined {
  if (!apiKey?.trim()) return undefined
  return {
    client: anthropic,
    checkBudget: checkApiCostLimit,
    recordUsage: incrementApiUsage,
    quota: dailyAssessQuota,
  }
}

// ---------- Zugang (5, Entscheid 9 Nr. 1) ----------

/**
 * Pro oder Admin (Claude-Bewertung): gleiche Regel wie der Leitstand (ADMIN_EMAIL oder Plan «pro», nicht
 * abgelaufen). Bewusst an hasLeitstandAccess gebunden, damit es nur eine Regel gibt (kein Umbau am Leitstand).
 */
export async function hasProAccess(user: IpmaUser): Promise<boolean> {
  return hasLeitstandAccess(user)
}

/** Eingeloggt (sonst 401). Der Simulator steht allen Konten offen; nur «assess» verlangt zusätzlich Pro. */
export async function requireIpmaUser(deps: Pick<IpmaDeps, "getUser">): Promise<{ user: IpmaUser; response?: undefined } | { user?: undefined; response: NextResponse }> {
  const user = await deps.getUser()
  if (!user?.id) {
    return { response: NextResponse.json({ error: "Nicht autorisiert." }, { status: 401, headers: NO_CACHE }) }
  }
  return { user }
}

// ---------- Rate-Limit (6.6) ----------

/** Anfragen je Minute und Konto (6.6); Claude-Bewertung zusätzlich mit Tageszähler (AP5) */
export const RATE_LIMITS = {
  read: 60,
  create: 10,
  save: 120,
  check: 60,
  pause: 30,
  submit: 10,
  finish: 10,
  self: 120,
  assess: 10,
  abort: 10,
} as const

const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const RATE_WINDOW_MS = 60 * 1000

/** Rate-Limit im Speicher je Konto und Zweck (Muster Leitstand) */
export function checkRateLimit(userId: string, purpose: RatePurpose): boolean {
  const now = Date.now()
  if (rateLimitMap.size > 5000) {
    for (const [key, value] of rateLimitMap) if (now > value.resetAt) rateLimitMap.delete(key)
  }
  const key = `ipma:${purpose}:${userId}`
  const entry = rateLimitMap.get(key)
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS })
    return true
  }
  if (entry.count >= RATE_LIMITS[purpose]) return false
  entry.count += 1
  return true
}

export function rateLimitResponse(): NextResponse {
  return NextResponse.json(
    { error: "Zu viele Anfragen. Bitte kurz warten." },
    { status: 429, headers: { ...NO_CACHE, "Retry-After": "60" } },
  )
}

// ---------- Fehler und Körper ----------

/** Antwort für einen Fehler: IpmaError mit Meldung, alles andere generisch 500 (6.7, Projektmuster) */
export function errorResponse(error: unknown, logTag: string, genericMessage: string): NextResponse {
  if (error instanceof IpmaError) {
    return NextResponse.json({ error: error.message, code: error.code, ...error.extra }, { status: error.status, headers: NO_CACHE })
  }
  console.error(logTag, error)
  return NextResponse.json({ error: genericMessage }, { status: 500, headers: NO_CACHE })
}

/**
 * JSON-Körper mit Grenze 16 KB (6.6) über readLimitedText des Leitstands (stückweise, auch ohne content-length).
 * Leerer Körper ergibt emptyValue. Zu gross → 413, kein JSON → 400.
 */
export async function readJsonBody(request: Request, emptyValue?: unknown): Promise<unknown> {
  let text: string
  try {
    text = await readLimitedText(request, MAX_BODY_BYTES)
  } catch (error) {
    if (error instanceof LeitstandError && error.status === 413) throw new IpmaError(413, "BAD_REQUEST", "Anfrage zu gross.")
    throw error
  }
  if (text.trim() === "" && emptyValue !== undefined) return emptyValue
  try {
    return JSON.parse(text) as unknown
  } catch {
    throw new IpmaError(400, "BAD_REQUEST", "Ungültige Eingabe.")
  }
}

// ---------- Datenbank-Hilfen ----------

type Db = Prisma.TransactionClient

const ATTEMPT_SELECT = {
  id: true,
  userId: true,
  mode: true,
  variant: true,
  status: true,
  itemCount: true,
  startedAt: true,
  deadlineAt: true,
  pausedAt: true,
  resumedAt: true,
  activeSeconds: true,
  submittedAt: true,
  finishedAt: true,
  config: true,
  result: true,
  pointsQ: true,
  maxPointsQ: true,
  shownCount: true,
  passed: true,
  pointsAwarded: true,
} as const

const ITEM_SELECT = {
  position: true,
  questionId: true,
  questionVersion: true,
  type: true,
  competence: true,
  optionOrder: true,
  choice: true,
  text: true,
  flagged: true,
  locked: true,
  answeredAt: true,
  selfScores: true,
  selfAssessedAt: true,
  aiStatus: true,
  aiScores: true,
  aiFeedback: true,
  aiAssessedAt: true,
  scoreSource: true,
  rasterPoints: true,
  correct: true,
  pointsQ: true,
} as const

const notFound = () => new IpmaError(404, "NOT_FOUND", "Versuch nicht gefunden.")

/** Versuch eines Kontos; fremd oder nicht vorhanden → 404 (nie 403, 6.6) */
async function requireOwnAttempt(db: Db, userId: string, id: string): Promise<StoredAttempt> {
  const attempt = await db.ipmaAttempt.findFirst({ where: { id, userId }, select: ATTEMPT_SELECT })
  if (!attempt) throw notFound()
  return attempt
}

async function loadItems(db: Db, attemptId: string): Promise<StoredItem[]> {
  return db.ipmaAttemptItem.findMany({ where: { attemptId }, orderBy: { position: "asc" }, select: ITEM_SELECT })
}

async function requireItem(db: Db, attemptId: string, position: number): Promise<StoredItem> {
  const item = await db.ipmaAttemptItem.findFirst({ where: { attemptId, position }, select: ITEM_SELECT })
  if (!item) throw new IpmaError(404, "NOT_FOUND", "Frage nicht gefunden.")
  return item
}

/** Station 24 im Lernpfad (6.9); «erledigt» wird nie zurückgestuft (fortschrittSchreibdaten) */
export async function markIpmaStation(
  db: Db,
  userId: string,
  status: LernStatus,
  quiz: { richtig: number; gesamt: number } | null = null,
): Promise<void> {
  const daten = fortschrittSchreibdaten({ ...IPMA_STATION, status, quiz })
  await db.lernfortschritt.upsert({
    where: { userId_fach_thema: { userId, ...IPMA_STATION } },
    create: { userId, ...IPMA_STATION, ...daten.create },
    update: { ...daten.update, updatedAt: new Date() },
  })
}

/** Leitner-Zustände eines Kontos (für Auswahl, Prüfen und Abschluss) */
async function loadStates(db: Db, userId: string, questionIds?: readonly string[]) {
  return db.ipmaQuestionState.findMany({
    where: questionIds ? { userId, questionId: { in: [...questionIds] } } : { userId },
    select: { questionId: true, box: true, dueAt: true, seenCount: true, correctCount: true, lastSeenAt: true },
  })
}

/** Bewertete Antworten aller Versuche eines Kontos (Beherrschung 4.4) */
export async function loadMastery(db: Db, userId: string, cfg: ExamConfig = EXAM_CONFIG): Promise<Map<CompetenceId, Mastery>> {
  const attempts = await db.ipmaAttempt.findMany({ where: { userId }, select: { id: true, startedAt: true } })
  if (!attempts.length) return mastery([], cfg)
  const startedAt = new Map(attempts.map((a) => [a.id, a.startedAt]))
  const items = await db.ipmaAttemptItem.findMany({
    where: { attemptId: { in: attempts.map((a) => a.id) }, correct: { not: null } },
    select: {
      attemptId: true,
      type: true,
      competence: true,
      correct: true,
      rasterPoints: true,
      answeredAt: true,
      selfAssessedAt: true,
      aiAssessedAt: true,
    },
  })
  const answers = gradedAnswers(items, (index) => startedAt.get(items[index].attemptId) ?? new Date(0))
  return mastery(answers, cfg)
}

/**
 * Leitner-Fächer nachführen (3.5) und die Anzahl erstmals richtiger Fragen liefern (6.10).
 * Gleiche Ergebnisse werden zu je einem updateMany zusammengefasst (höchstens 10 statt 90 Abfragen).
 */
async function applyLeitner(
  db: Db,
  userId: string,
  graded: readonly { questionId: string; correct: boolean }[],
  now: Date,
): Promise<number> {
  if (!graded.length) return 0
  const rows = await loadStates(db, userId, graded.map((g) => g.questionId))
  const states = new Map<string, QuestionStateRow>(rows.map((r) => [r.questionId, r]))
  const { updates, firstCorrect } = planLeitner(graded, states, now)
  const groups = new Map<string, { box: number; dueAt: Date; correct: boolean; ids: string[] }>()
  const missing = updates.filter((u) => !u.exists)
  for (const u of updates.filter((x) => x.exists)) {
    const key = `${u.box}:${u.correct}`
    const g = groups.get(key) ?? { box: u.box, dueAt: u.dueAt, correct: u.correct, ids: [] }
    g.ids.push(u.questionId)
    groups.set(key, g)
  }
  for (const g of groups.values()) {
    await db.ipmaQuestionState.updateMany({
      where: { userId, questionId: { in: g.ids } },
      data: {
        box: g.box,
        dueAt: g.dueAt,
        lastCorrect: g.correct,
        ...(g.correct ? { correctCount: { increment: 1 } } : {}),
      },
    })
  }
  if (missing.length) {
    await db.ipmaQuestionState.createMany({
      data: missing.map((u) => ({
        userId,
        questionId: u.questionId,
        box: u.box,
        dueAt: u.dueAt,
        seenCount: 1,
        correctCount: u.correct ? 1 : 0,
        lastCorrect: u.correct,
        lastSeenAt: now,
      })),
      skipDuplicates: true,
    })
  }
  return firstCorrect
}

function lookupFor(pool: Pool) {
  return (id: string) => pool.byId.get(id) ?? null
}

async function viewOf(deps: IpmaDeps, user: IpmaUser, attempt: StoredAttempt, items: StoredItem[]): Promise<AttemptView> {
  return buildAttemptView(attempt, items, {
    lookup: lookupFor(deps.pool()),
    catalog: deps.catalog(),
    now: deps.now(),
    canUseAi: await deps.hasPro(user),
  })
}

function solvedOf(deps: IpmaDeps, attempt: StoredAttempt, item: StoredItem): SolvedItem {
  return toSolvedItem(item, deps.pool().byId.get(item.questionId) ?? null, {
    weights: readConfig(attempt.config).weights,
    catalog: deps.catalog(),
  })
}

// ---------- Anlegen (POST /api/ipma/attempts) ----------

/** Auswahl je Modus (6.5, Nachtrag 8.4 Nr. 6); Startwert vom Server, nie an den Client */
function selectFor(
  input: CreateAttemptInput,
  pool: Pool,
  seed: number,
  exposure: ReadonlyMap<string, Exposure>,
  states: ReadonlyMap<string, { box: number; dueAt: number | null }>,
  masteryMap: ReadonlyMap<CompetenceId, Mastery> | null,
  now: Date,
  cfg: ExamConfig,
): { items: SelectedItem[]; competences: CompetenceId[] } {
  switch (input.mode) {
    case "exam":
      return { items: selectExam(pool.questions, seed, exposure, cfg), competences: [] }
    case "short":
      return { items: selectShort(pool.questions, seed, exposure, masteryMap ?? new Map(), cfg), competences: [] }
    case "training": {
      const competences = COMPETENCE_IDS.filter((id) => input.competences.includes(id))
      const items = selectTraining(pool.questions, seed, exposure, states, {
        competences,
        type: input.type,
        count: input.count,
        now: now.getTime(),
      })
      return { items, competences }
    }
    case "gaps": {
      const competences = weakestCompetences(masteryMap ?? new Map(), cfg)
      return { items: selectGaps(pool.questions, seed, exposure, states, competences, now.getTime(), cfg), competences }
    }
  }
}

/**
 * Neuer Versuch (6.4, 6.6): Auswahl mit Kontakt und Leitner-Fächern des Kontos, höchstens ein aktiver Versuch
 * je Modus (sonst 409 ACTIVE_EXISTS mit activeAttemptId; mit replaceActive wird der alte «aborted»),
 * Kontakt der gewählten Fragen nachführen, Station 24 «begonnen». Der Teil-Index «IpmaAttempt_aktiv_eindeutig»
 * fängt gleichzeitige Starts ab (P2002 → neuer Versuch, nach drei Versuchen 409).
 */
export async function createAttempt(deps: IpmaDeps, userId: string, input: CreateAttemptInput): Promise<{ id: string }> {
  const db = deps.db
  const cfg = deps.config
  const now = deps.now()
  const pool = deps.pool()
  const rows = await loadStates(db, userId)
  const exposure = new Map<string, Exposure>(rows.map((r) => [r.questionId, { seenCount: r.seenCount, lastSeenAt: r.lastSeenAt?.getTime() ?? null }]))
  const states = new Map(rows.map((r) => [r.questionId, { box: r.box, dueAt: r.dueAt?.getTime() ?? null }]))
  const masteryMap = input.mode === "short" || input.mode === "gaps" ? await loadMastery(db, userId, cfg) : null
  const seed = deps.seed()
  const { items, competences } = selectFor(input, pool, seed, exposure, states, masteryMap, now, cfg)

  const mode = input.mode
  const variant = input.mode === "exam" ? input.variant : "strict"
  const durationMin = mode === "exam" && variant === "strict" ? cfg.exam.durationMin : mode === "short" ? cfg.short.durationMin : null
  const deadlineAt = durationMin === null ? null : new Date(now.getTime() + durationMin * 60 * 1000)
  const known = new Set(rows.map((r) => r.questionId))
  const ids = items.map((i) => i.questionId)

  const createTx = () => db.$transaction(async (tx) => {
    const active = await tx.ipmaAttempt.findFirst({ where: { userId, mode, status: "active" }, select: { id: true } })
    if (active) {
      if (!input.replaceActive) {
        throw new IpmaError(409, "ACTIVE_EXISTS", "In diesem Modus läuft bereits ein Versuch.", { activeAttemptId: active.id })
      }
      await tx.ipmaAttempt.updateMany({ where: { userId, mode, status: "active" }, data: { status: "aborted" } })
    }
    const created = await tx.ipmaAttempt.create({
      data: {
        userId,
        mode,
        variant,
        status: "active",
        seed,
        poolVersion: pool.version,
        configVersion: CONFIG_VERSION,
        config: configSnapshot(cfg) as unknown as Prisma.InputJsonValue,
        competences,
        itemCount: items.length,
        startedAt: now,
        deadlineAt,
        resumedAt: variant === "pausable" ? now : null,
      },
      select: { id: true },
    })
    await tx.ipmaAttemptItem.createMany({
      data: items.map((i) => ({
        attemptId: created.id,
        position: i.position,
        questionId: i.questionId,
        questionVersion: i.questionVersion,
        type: i.type,
        competence: i.competence,
        optionOrder: i.optionOrder,
        selfScores: [],
        aiScores: [],
      })),
    })
    const seen = ids.filter((id) => known.has(id))
    if (seen.length) {
      await tx.ipmaQuestionState.updateMany({
        where: { userId, questionId: { in: seen } },
        data: { seenCount: { increment: 1 }, lastSeenAt: now },
      })
    }
    const fresh = ids.filter((id) => !known.has(id))
    if (fresh.length) {
      await tx.ipmaQuestionState.createMany({
        data: fresh.map((questionId) => ({ userId, questionId, seenCount: 1, lastSeenAt: now })),
        skipDuplicates: true,
      })
    }
    await markIpmaStation(tx, userId, "begonnen")
    return { id: created.id }
  })
  try {
    return await retryOnPrismaCodes(["P2002"], CREATE_ATTEMPTS, createTx)
  } catch (error) {
    if (prismaErrorCode(error) === "P2002") {
      throw new IpmaError(409, "CONFLICT", "Gleichzeitig wurde ein anderer Versuch gestartet. Bitte erneut versuchen.")
    }
    throw error
  }
}

// ---------- Lesen (GET /api/ipma/attempts/[id]) ----------

/** Eigener Versuch als AttemptView; ein abgelaufener Versuch mit Uhr wird hier abgegeben (3.2) */
export async function getAttemptView(deps: IpmaDeps, user: IpmaUser, id: string): Promise<AttemptView> {
  let attempt = await requireOwnAttempt(deps.db, user.id, id)
  if (isExpired(attempt, deps.now(), deps.config.exam.graceSeconds)) {
    await submitInternal(deps, user.id, attempt)
    attempt = await requireOwnAttempt(deps.db, user.id, id)
  }
  const items = asStatus(attempt.status) === "aborted" ? [] : await loadItems(deps.db, id)
  return viewOf(deps, user, attempt, items)
}

// ---------- Antwort speichern (PUT items/[position]) ----------

/**
 * Antwort, Wahl oder Markierung speichern (6.4, 6.6): nur aktiv, nicht gesperrt, bei Echtbedingungen bis
 * deadlineAt + 30 s (sonst 422 TIME_UP). choice ist die Anzeigeposition und wird über optionOrder in den
 * Originalindex übersetzt. Optimistische Sperre: updateMany mit locked false; 0 Zeilen → 409 LOCKED.
 */
export async function saveAnswer(
  deps: IpmaDeps,
  userId: string,
  id: string,
  position: number,
  input: SaveItemInput,
): Promise<{ saved: true; answeredCount: number }> {
  const db = deps.db
  const now = deps.now()
  const attempt = await requireOwnAttempt(db, userId, id)
  checkAnswerWindow(attempt, now, deps.config.exam.graceSeconds)
  const item = await requireItem(db, id, position)
  if (item.locked) throw new IpmaError(409, "LOCKED", "Diese Antwort ist gesperrt.")

  const data: Prisma.IpmaAttemptItemUpdateManyMutationInput = {}
  if (input.flagged !== undefined) data.flagged = input.flagged
  if (item.type === "mc") {
    if (input.text !== undefined) throw new IpmaError(400, "BAD_REQUEST", "Freitext gibt es nur bei offenen Fragen.")
    if (input.choice !== undefined) {
      data.choice = input.choice === null ? null : originalChoice(item.optionOrder, input.choice)
      data.answeredAt = input.choice === null ? null : now
    }
  } else {
    if (input.choice !== undefined) throw new IpmaError(400, "BAD_REQUEST", "Eine Auswahl gibt es nur bei Multiple Choice.")
    if (input.text !== undefined) {
      const text = input.text === null || input.text.trim() === "" ? null : input.text
      data.text = text
      data.answeredAt = text === null ? null : now
    }
  }
  if (Object.keys(data).length) {
    const saved = await db.ipmaAttemptItem.updateMany({ where: { attemptId: id, position, locked: false }, data })
    if (saved.count === 0) throw new IpmaError(409, "LOCKED", "Diese Antwort ist gesperrt.")
  }
  const answeredCount = await db.ipmaAttemptItem.count({ where: { attemptId: id, answeredAt: { not: null } } })
  return { saved: true, answeredCount }
}

// ---------- Prüfen im Training (POST items/[position]/check) ----------

/**
 * «Prüfen» im Training und in «Lücken schliessen» (3.4, 6.6): Position sperren, MC bewerten, Leitner-Fach
 * (MC und leere offene Antwort sofort), 1 Punkt für eine erstmals richtige Frage. Gibt nur diese Lösung frei.
 */
export async function checkItem(deps: IpmaDeps, userId: string, id: string, position: number): Promise<SolvedItem> {
  const db = deps.db
  const now = deps.now()
  const attempt = await requireOwnAttempt(db, userId, id)
  if (isExamMode(asMode(attempt.mode))) {
    throw new IpmaError(409, "CONFLICT", "In einer Prüfung gibt es die Lösung erst nach der Abgabe.")
  }
  if (attempt.status !== "active") throw new IpmaError(409, "NOT_ACTIVE", "Dieser Versuch ist nicht mehr aktiv.", { status: attempt.status })
  const item = await requireItem(db, id, position)
  if (item.locked) throw new IpmaError(409, "LOCKED", "Diese Frage wurde schon geprüft.")

  const cfg = readConfig(attempt.config)
  const question = deps.pool().byId.get(item.questionId) ?? null
  const data: Prisma.IpmaAttemptItemUpdateManyMutationInput = { locked: true }
  let correct: boolean | null = null
  if (item.type === "mc") {
    correct = question?.typ === "mc" && item.choice !== null && item.choice === question.richtig
    data.correct = correct
    data.scoreSource = "mc"
    data.pointsQ = correct ? cfg.weights.mc * RASTER_TOTAL : 0
  } else if (item.text === null || item.text.trim() === "") {
    correct = false
    data.correct = false
    data.rasterPoints = 0
    data.scoreSource = "self"
    data.pointsQ = 0
  }

  await db.$transaction(async (tx) => {
    const saved = await tx.ipmaAttemptItem.updateMany({ where: { attemptId: id, position, locked: false }, data })
    if (saved.count === 0) throw new IpmaError(409, "LOCKED", "Diese Frage wurde schon geprüft.")
    if (correct !== null) await awardTrainingPoints(tx, userId, id, [{ questionId: item.questionId, correct }], now)
  })
  return solvedOf(deps, attempt, await requireItem(db, id, position))
}

/** Leitner nachführen und 1 Punkt je erstmals richtiger Frage gutschreiben (Training, Lücken; 6.10) */
async function awardTrainingPoints(
  tx: Db,
  userId: string,
  attemptId: string,
  graded: readonly { questionId: string; correct: boolean }[],
  now: Date,
): Promise<void> {
  const points = await applyLeitner(tx, userId, graded, now)
  if (points > 0) {
    await tx.user.update({ where: { id: userId }, data: { points: { increment: points } } })
    await tx.ipmaAttempt.updateMany({ where: { id: attemptId, userId }, data: { pointsAwarded: { increment: points } } })
  }
}

// ---------- Selbstbewertung (PUT items/[position]/self) ----------

/**
 * Selbstbewertung einer offenen Antwort (4.2, 6.6): nur gesperrte, nicht leere offene Antworten; je Kriterium
 * 0 … Höchstwert des Rasters. Massgebend, solange keine Claude-Bewertung vorliegt. Prüfung: nur «submitted»,
 * änderbar bis zum Abschluss (das Ergebnis rechnet die Ansicht neu). Training/Lücken: einmal, mit Leitner und Punkt.
 */
export async function selfAssess(
  deps: IpmaDeps,
  userId: string,
  id: string,
  position: number,
  scores: readonly number[],
): Promise<SolvedItem> {
  const db = deps.db
  const now = deps.now()
  const attempt = await requireOwnAttempt(db, userId, id)
  const exam = isExamMode(asMode(attempt.mode))
  const status = asStatus(attempt.status)
  if (exam && status === "active") throw new IpmaError(409, "NOT_SUBMITTED", "Die Selbstbewertung folgt nach der Abgabe.")
  if ((exam && status !== "submitted") || (!exam && status !== "active")) {
    throw new IpmaError(409, "NOT_ACTIVE", "Dieser Versuch ist abgeschlossen.", { status })
  }
  const item = await requireItem(db, id, position)
  if (item.type !== "offen") throw new IpmaError(422, "NOT_OPEN", "Nur offene Fragen werden selbst bewertet.")
  if (!item.locked) throw new IpmaError(409, "NOT_SUBMITTED", "Zuerst «Prüfen» wählen.")
  if (item.text === null || item.text.trim() === "") {
    throw new IpmaError(422, "BAD_REQUEST", "Eine leere Antwort zählt 0 Punkte und wird nicht bewertet.")
  }
  if (!exam && item.selfAssessedAt !== null) throw new IpmaError(409, "LOCKED", "Diese Antwort ist schon bewertet.")
  const question = deps.pool().byId.get(item.questionId) ?? null
  if (!question || question.typ !== "offen") throw new IpmaError(422, "NOT_OPEN", "Zu dieser Frage gibt es kein Raster mehr.")
  const raster = question.bewertungsraster
  if (scores.length !== raster.length || scores.some((s, i) => s > raster[i].punkte)) {
    throw new IpmaError(400, "BAD_REQUEST", "Die Bewertung passt nicht zum Raster.")
  }

  const cfg = readConfig(attempt.config)
  const total = scores.reduce((s, v) => s + v, 0)
  const correct = total >= cfg.openCorrectRaster
  const aiDone = item.aiStatus === "done"
  const data: Prisma.IpmaAttemptItemUpdateManyMutationInput = {
    selfScores: [...scores],
    selfAssessedAt: now,
    ...(aiDone ? {} : { rasterPoints: total, scoreSource: "self", correct, pointsQ: cfg.weights.offen * total }),
  }
  await db.$transaction(async (tx) => {
    const saved = await tx.ipmaAttemptItem.updateMany({
      where: { attemptId: id, position, locked: true, ...(exam ? {} : { selfAssessedAt: null }) },
      data,
    })
    if (saved.count === 0) throw new IpmaError(409, "CONFLICT", "Die Antwort wurde inzwischen verändert.")
    if (!exam && !aiDone) await awardTrainingPoints(tx, userId, id, [{ questionId: item.questionId, correct }], now)
  })
  return solvedOf(deps, attempt, await requireItem(db, id, position))
}

// ---------- Claude-Bewertung (POST items/[position]/assess, 4.3, AP5) ----------

/** Bewertungen mit Claude je Konto und Tag (4.3 Schritt 4) */
export const ASSESS_DAILY_LIMIT = 60

/** Eine Sperre «pending», die älter ist, gilt als verwaist (Prozess abgebrochen) und darf übernommen werden */
export const AI_PENDING_STALE_MS = 2 * 60 * 1000

const dailyAssessMap = new Map<string, number>()

/** Kalendertag in der Schweiz (Tageszähler) */
function zurichDay(now: Date): string {
  return now.toLocaleDateString("sv-SE", { timeZone: "Europe/Zurich" })
}

/**
 * Tageszähler im Speicher je Konto (Muster Rate-Limit; nach einem Neustart beginnt er neu, der Monatsdeckel
 * bleibt in der Datenbank). Gezählt wird jeder Aufruf von Claude, auch fehlgeschlagene.
 */
export const dailyAssessQuota: AssessQuota = {
  available(userId, now) {
    return (dailyAssessMap.get(`${zurichDay(now)}:${userId}`) ?? 0) < ASSESS_DAILY_LIMIT
  },
  consume(userId, now) {
    const day = zurichDay(now)
    if (dailyAssessMap.size > 5000) {
      for (const key of dailyAssessMap.keys()) if (!key.startsWith(`${day}:`)) dailyAssessMap.delete(key)
    }
    const key = `${day}:${userId}`
    dailyAssessMap.set(key, (dailyAssessMap.get(key) ?? 0) + 1)
  },
}

function isStalePending(item: StoredItem, now: Date): boolean {
  return item.aiStatus === "pending" && (item.aiAssessedAt === null || now.getTime() - item.aiAssessedAt.getTime() > AI_PENDING_STALE_MS)
}

async function loadAssessable(deps: IpmaDeps, userId: string, id: string, position: number): Promise<{ attempt: StoredAttempt; item: StoredItem }> {
  const attempt = await requireOwnAttempt(deps.db, userId, id)
  const exam = isExamMode(asMode(attempt.mode))
  const status = asStatus(attempt.status)
  const item = await requireItem(deps.db, id, position)
  if (item.type !== "offen") throw new IpmaError(422, "NOT_OPEN", "Nur offene Fragen werden von Claude bewertet.")
  if (!item.locked || (exam && status === "active")) throw new IpmaError(409, "NOT_SUBMITTED", "Die Bewertung folgt nach der Abgabe bzw. nach «Prüfen».")
  if (status === "finished" || status === "aborted") throw new IpmaError(409, "NOT_ACTIVE", "Dieser Versuch ist abgeschlossen.", { status })
  if (item.text === null || item.text.trim() === "") throw new IpmaError(422, "BAD_REQUEST", "Eine leere Antwort wird nicht bewertet.")
  if (item.selfAssessedAt === null) throw new IpmaError(422, "SELF_FIRST", "Bitte zuerst selbst bewerten.")
  const retryable = item.aiStatus === "none" || item.aiStatus === "failed" || isStalePending(item, deps.now())
  if (!retryable) throw new IpmaError(409, "CONFLICT", "Diese Antwort ist schon bewertet oder wird gerade bewertet.")
  return { attempt, item }
}

/**
 * Vorbedingungen der Claude-Bewertung (4.3 Schritte 6–7) ohne Aufruf von Claude: offene, gesperrte, nicht leere
 * Antwort, Versuch abgegeben (Prüfung) bzw. aktiv (Training), Selbstbewertung vorhanden, aiStatus none/failed
 * (oder eine verwaiste Sperre «pending»).
 */
export async function assertAssessable(deps: IpmaDeps, userId: string, id: string, position: number): Promise<StoredItem> {
  return (await loadAssessable(deps, userId, id, position)).item
}

/** Antwort an den Client bei einer gescheiterten Bewertung; die Selbstbewertung bleibt massgebend */
function assessFailure(reason: GradeFailure): IpmaError {
  switch (reason) {
    case "refusal":
      return new IpmaError(502, "AI_REFUSED", "Bewertung nicht möglich, deine Selbstbewertung gilt.")
    case "truncated":
    case "invalid":
      return new IpmaError(502, "AI_INVALID", "Die Bewertung durch Claude war unvollständig. Deine Selbstbewertung gilt; du kannst es erneut versuchen.")
    case "busy":
      return new IpmaError(502, "AI_UNAVAILABLE", "Claude ist gerade ausgelastet. Bitte in einer Minute erneut versuchen. Deine Selbstbewertung gilt.")
    case "unavailable":
      return new IpmaError(502, "AI_UNAVAILABLE", "Die Bewertung durch Claude ist gerade nicht möglich. Deine Selbstbewertung gilt.")
  }
}

/**
 * Claude-Bewertung einer offenen Antwort (4.3 Schritte 4–14, Entscheid 9 Nr. 4). Pro-Prüfung (403) und Rate-Limit
 * macht die Route. Ablauf: Tageszähler → Monatsdeckel → Vorbedingungen → Sperre «pending» per updateMany (gegen
 * Doppelauslösung) → Claude → Tokens buchen (immer, auch bei ungültiger Ausgabe) → Punkte selbst summieren und
 * speichern (scoreSource «ai», massgebend). Fehler setzen «failed» (neuer Versuch erlaubt), nach «done» nicht mehr.
 * Das Ergebnis einer abgegebenen Prüfung rechnet GET neu (Nachtrag 8.5 Nr. 6).
 */
export async function assessItem(deps: IpmaDeps, userId: string, id: string, position: number): Promise<SolvedItem> {
  const db = deps.db
  const now = deps.now()
  const ai = deps.ai
  if (!ai) {
    await assertAssessable(deps, userId, id, position)
    throw assessFailure("unavailable")
  }
  if (!ai.quota.available(userId, now)) {
    throw new IpmaError(429, "DAILY_LIMIT", `Heute sind keine weiteren Bewertungen durch Claude möglich (höchstens ${ASSESS_DAILY_LIMIT} am Tag). Deine Selbstbewertung gilt.`)
  }
  if (!(await ai.checkBudget(userId))) {
    throw new IpmaError(429, "BUDGET", "Das monatliche Kontingent für Claude ist aufgebraucht. Deine Selbstbewertung gilt.")
  }
  const { attempt, item } = await loadAssessable(deps, userId, id, position)
  const question = deps.pool().byId.get(item.questionId) ?? null
  if (!question || question.typ !== "offen") throw new IpmaError(422, "NOT_OPEN", "Zu dieser Frage gibt es kein Raster mehr.")

  // Optimistische Sperre (4.3 Schritt 8): nur eine Anfrage gewinnt; verwaiste Sperren werden übernommen
  let locked = await db.ipmaAttemptItem.updateMany({
    where: { attemptId: id, position, aiStatus: { in: ["none", "failed"] } },
    data: { aiStatus: "pending", aiAssessedAt: now },
  })
  if (locked.count === 0) {
    locked = await db.ipmaAttemptItem.updateMany({
      where: { attemptId: id, position, aiStatus: "pending", aiAssessedAt: { lt: new Date(now.getTime() - AI_PENDING_STALE_MS) } },
      data: { aiStatus: "pending", aiAssessedAt: now },
    })
  }
  if (locked.count === 0) throw new IpmaError(409, "CONFLICT", "Diese Antwort wird gerade bewertet.")

  const markFailed = () =>
    db.ipmaAttemptItem.updateMany({ where: { attemptId: id, position, aiStatus: "pending" }, data: { aiStatus: "failed" } })

  ai.quota.consume(userId, now)
  let result: Awaited<ReturnType<typeof gradeOpenAnswer>>
  try {
    result = await gradeOpenAnswer(ai.client, {
      frage: question.frage,
      musterloesung: question.musterloesung,
      raster: question.bewertungsraster,
      antwort: item.text ?? "",
    })
  } catch (error) {
    await markFailed()
    throw error
  }

  // Tokens immer buchen (4.3 Schritt 11); ein Fehler beim Buchen verhindert die Bewertung nicht
  const tokens = totalTokens(result.usage)
  if (tokens > 0) {
    const billable = billableTokens(result.usage, IPMA_GRADER_COST_FACTOR)
    try {
      await ai.recordUsage(userId, billable.input, billable.output)
    } catch (error) {
      console.error("[ipma/assess] Token-Erfassung", error)
    }
  }

  if (!result.ok) {
    await markFailed()
    if (result.reason !== "busy" && result.reason !== "unavailable") {
      console.warn("[ipma/assess] Bewertung gescheitert", { attemptId: id, position, reason: result.reason })
    }
    throw assessFailure(result.reason)
  }

  // Punkte selbst summieren (4.3 Schritt 13), nie eine Summe von Claude übernehmen
  const cfg = readConfig(attempt.config)
  const total = result.scores.reduce((sum, v) => sum + v, 0)
  const feedback: Prisma.InputJsonObject = {
    kriterien: result.feedback.kriterien.map((k) => ({ nummer: k.nummer, punkte: k.punkte, begruendung: k.begruendung })),
    gesamtkommentar: result.feedback.gesamtkommentar,
    verdacht: result.feedback.verdacht,
  }
  const saved = await db.ipmaAttemptItem.updateMany({
    where: { attemptId: id, position, aiStatus: "pending" },
    data: {
      aiStatus: "done",
      aiScores: result.scores,
      aiFeedback: feedback,
      aiTokens: tokens,
      aiAssessedAt: deps.now(),
      scoreSource: "ai",
      rasterPoints: total,
      correct: total >= cfg.openCorrectRaster,
      pointsQ: cfg.weights.offen * total,
    },
  })
  if (saved.count === 0) throw new IpmaError(409, "CONFLICT", "Die Antwort wurde inzwischen verändert.")
  if (result.feedback.verdacht) console.warn("[ipma/assess] Manipulationsverdacht", { attemptId: id, position })
  return solvedOf(deps, attempt, await requireItem(db, id, position))
}

// ---------- Pause (POST /pause) ----------

/**
 * Pause und Weiter in der Variante «mit Pausen» (3.2, 6.6): Pause zählt den laufenden Abschnitt zu
 * activeSeconds; Weiter setzt den neuen Start. Doppelte Aufrufe ändern nichts.
 */
export async function setPaused(deps: IpmaDeps, userId: string, id: string, paused: boolean): Promise<{ activeSeconds: number; paused: boolean }> {
  const db = deps.db
  const now = deps.now()
  const attempt = await requireOwnAttempt(db, userId, id)
  if (attempt.variant !== "pausable") throw new IpmaError(409, "CONFLICT", "Pausen gibt es nur in der Variante «mit Pausen».")
  if (attempt.status !== "active") throw new IpmaError(409, "NOT_ACTIVE", "Dieser Versuch ist nicht mehr aktiv.", { status: attempt.status })
  if (paused && attempt.pausedAt === null) {
    const add = secondsBetween(attempt.resumedAt ?? attempt.startedAt, now)
    await db.ipmaAttempt.updateMany({
      where: { id, userId, status: "active", pausedAt: null },
      data: { pausedAt: now, activeSeconds: { increment: add } },
    })
  } else if (!paused && attempt.pausedAt !== null) {
    await db.ipmaAttempt.updateMany({
      where: { id, userId, status: "active", pausedAt: { not: null } },
      data: { pausedAt: null, resumedAt: now },
    })
  }
  const after = await requireOwnAttempt(db, userId, id)
  return { activeSeconds: currentActiveSeconds(after, now), paused: after.status === "active" && after.pausedAt !== null }
}

// ---------- Abgabe (POST /submit) ----------

/**
 * Abgabe einer Prüfung (6.4) in einer Transaktion: Status «submitted», alle Positionen gesperrt, MC bewertet,
 * unbeantwortete offene Fragen mit 0 Punkten (scoreSource «self»), vorläufiges Ergebnis. Liefert false, wenn
 * der Versuch inzwischen nicht mehr aktiv war (gleichzeitige Abgabe).
 */
async function submitInternal(deps: IpmaDeps, userId: string, attempt: StoredAttempt): Promise<boolean> {
  const db = deps.db
  const now = deps.now()
  const cfg = readConfig(attempt.config)
  const pool = deps.pool()
  const items = await loadItems(db, attempt.id)
  const mcRight: number[] = []
  const mcWrong: number[] = []
  const openEmpty: number[] = []
  for (const i of items) {
    if (i.type === "mc") {
      const q = pool.byId.get(i.questionId)
      const right = q?.typ === "mc" && i.choice !== null && i.choice === q.richtig
      ;(right ? mcRight : mcWrong).push(i.position)
    } else if (i.text === null || i.text.trim() === "") {
      openEmpty.push(i.position)
    }
  }
  const scored: StoredItem[] = items.map((i) => {
    if (mcRight.includes(i.position)) return { ...i, locked: true, correct: true, scoreSource: "mc", pointsQ: cfg.weights.mc * RASTER_TOTAL }
    if (mcWrong.includes(i.position)) return { ...i, locked: true, correct: false, scoreSource: "mc", pointsQ: 0 }
    if (openEmpty.includes(i.position)) return { ...i, locked: true, correct: false, scoreSource: "self", rasterPoints: 0, pointsQ: 0 }
    return { ...i, locked: true }
  })
  const result = resultOf(attempt, scored, deps.catalog())

  return db.$transaction(async (tx) => {
    const updated = await tx.ipmaAttempt.updateMany({
      where: { id: attempt.id, userId, status: "active" },
      data: {
        status: "submitted",
        submittedAt: now,
        activeSeconds: currentActiveSeconds(attempt, now),
        pausedAt: null,
        result: result as unknown as Prisma.InputJsonValue,
        pointsQ: result.pointsQ,
        maxPointsQ: result.maxPointsQ,
        shownCount: result.shownCount,
        passed: result.passed,
      },
    })
    if (updated.count === 0) return false
    const where = (positions: number[]) => ({ attemptId: attempt.id, position: { in: positions } })
    if (mcRight.length) await tx.ipmaAttemptItem.updateMany({ where: where(mcRight), data: { locked: true, correct: true, scoreSource: "mc", pointsQ: cfg.weights.mc * RASTER_TOTAL } })
    if (mcWrong.length) await tx.ipmaAttemptItem.updateMany({ where: where(mcWrong), data: { locked: true, correct: false, scoreSource: "mc", pointsQ: 0 } })
    if (openEmpty.length) await tx.ipmaAttemptItem.updateMany({ where: where(openEmpty), data: { locked: true, correct: false, scoreSource: "self", rasterPoints: 0, pointsQ: 0 } })
    await tx.ipmaAttemptItem.updateMany({ where: { attemptId: attempt.id, locked: false }, data: { locked: true } })
    return true
  })
}

/** POST /submit (6.6): nur Prüfungen; idempotent (abgegeben oder abgeschlossen → gleiche Ansicht) */
export async function submitAttempt(deps: IpmaDeps, user: IpmaUser, id: string): Promise<AttemptView> {
  const attempt = await requireOwnAttempt(deps.db, user.id, id)
  if (!isExamMode(asMode(attempt.mode))) throw new IpmaError(409, "CONFLICT", "Nur Prüfungen werden abgegeben; Training wird abgeschlossen.")
  const status = asStatus(attempt.status)
  if (status === "aborted") throw new IpmaError(409, "NOT_ACTIVE", "Dieser Versuch wurde abgebrochen.", { status })
  if (status === "active") await submitInternal(deps, user.id, attempt)
  const after = await requireOwnAttempt(deps.db, user.id, id)
  if (asStatus(after.status) === "aborted") throw new IpmaError(409, "NOT_ACTIVE", "Dieser Versuch wurde abgebrochen.", { status: after.status })
  return viewOf(deps, user, after, await loadItems(deps.db, id))
}

// ---------- Abschluss (POST /finish) ----------

/**
 * Abschluss (6.4, 6.6, 6.9, 6.10) in einer Serializable-Transaktion: Ergebnis festschreiben, Leitner aller
 * Positionen (Prüfungen), Punkte (Übungsprüfung: Verbesserung des Bestwerts), Station 24 «erledigt» mit
 * Ergebnis (Übungsprüfung). Training/Lücken: offene Positionen werden gesperrt und bleiben unbewertet.
 * Idempotent: ein zweiter Aufruf liefert das gespeicherte Ergebnis ohne neue Punkte und Abzeichen.
 */
export async function finishAttempt(deps: IpmaDeps, user: IpmaUser, id: string): Promise<FinishView> {
  const db = deps.db
  const userId = user.id
  let attempt = await requireOwnAttempt(db, userId, id)
  const mode = asMode(attempt.mode)
  const exam = isExamMode(mode)
  if (asStatus(attempt.status) === "finished") return storedFinish(attempt)
  if (attempt.status === "aborted") throw new IpmaError(409, "NOT_ACTIVE", "Dieser Versuch wurde abgebrochen.", { status: attempt.status })
  if (exam && attempt.status === "active") {
    if (!isExpired(attempt, deps.now(), deps.config.exam.graceSeconds)) {
      throw new IpmaError(409, "NOT_SUBMITTED", "Bitte die Prüfung zuerst abgeben.")
    }
    await submitInternal(deps, userId, attempt)
    attempt = await requireOwnAttempt(db, userId, id)
    if (asStatus(attempt.status) === "finished") return storedFinish(attempt)
  }
  const expected = exam ? "submitted" : "active"
  if (attempt.status !== expected) throw new IpmaError(409, "NOT_ACTIVE", "Dieser Versuch kann nicht abgeschlossen werden.", { status: attempt.status })

  const now = deps.now()
  const catalog = deps.catalog()
  const finishTx = () => db.$transaction(async (tx) => {
    const items = await loadItems(tx, id)
    const result = resultOf(attempt, items, catalog)

    let pointsAwarded = attempt.pointsAwarded
    if (exam) {
      const graded = items.filter((i) => i.correct !== null).map((i) => ({ questionId: i.questionId, correct: i.correct === true }))
      await applyLeitner(tx, userId, graded, now)
      pointsAwarded = 0
      if (mode === "exam") {
        const others = await tx.ipmaAttempt.findMany({
          where: { userId, mode: "exam", status: "finished", id: { not: id } },
          select: { pointsQ: true, maxPointsQ: true },
        })
        const best = others.reduce<number | null>((b, o) =>
          o.pointsQ === null || !o.maxPointsQ ? b : Math.max(b ?? 0, percentFloor(o.pointsQ, o.maxPointsQ)), null)
        pointsAwarded = computePointsAward(best, percentFloor(result.pointsQ, result.maxPointsQ))
      }
    }

    const saved = await tx.ipmaAttempt.updateMany({
      where: { id, userId, status: expected },
      data: {
        status: "finished",
        finishedAt: now,
        result: result as unknown as Prisma.InputJsonValue,
        pointsQ: result.pointsQ,
        maxPointsQ: result.maxPointsQ,
        shownCount: result.shownCount,
        passed: result.passed,
        pointsAwarded,
      },
    })
    if (saved.count === 0) return null
    if (!exam) await tx.ipmaAttemptItem.updateMany({ where: { attemptId: id, locked: false }, data: { locked: true } })
    if (exam && pointsAwarded > 0) {
      await tx.user.update({ where: { id: userId }, data: { points: { increment: pointsAwarded } } })
    }
    if (mode === "exam") {
      await markIpmaStation(tx, userId, "erledigt", {
        richtig: Math.floor(result.pointsQ / RASTER_TOTAL),
        gesamt: Math.floor(result.maxPointsQ / RASTER_TOTAL),
      })
    }
    return { result, pointsAwarded }
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })

  const outcome = await retryOnPrismaCodes(["P2034"], FINISH_ATTEMPTS, finishTx)
  if (!outcome) {
    const again = await requireOwnAttempt(db, userId, id)
    if (asStatus(again.status) === "finished") return storedFinish(again)
    throw new IpmaError(409, "CONFLICT", "Der Versuch wurde inzwischen verändert.", { status: again.status })
  }
  const newBadges = await deps.awardBadges(userId)
  return { result: outcome.result, newBadges, pointsAwarded: outcome.pointsAwarded }
}

function storedFinish(attempt: StoredAttempt): FinishView {
  const result = attempt.result
  if (!result || typeof result !== "object" || Array.isArray(result)) {
    throw new Error("Abgeschlossener Versuch ohne gespeichertes Ergebnis.")
  }
  return { result: result as unknown as FinishView["result"], newBadges: [], pointsAwarded: attempt.pointsAwarded }
}

// ---------- Abbruch (DELETE) ----------

/** DELETE (6.6): aktiv → «aborted» (kein Löschen); abgegeben/abgeschlossen → 409; schon abgebrochen → ok */
export async function abortAttempt(deps: IpmaDeps, userId: string, id: string): Promise<{ ok: true }> {
  const updated = await deps.db.ipmaAttempt.updateMany({ where: { id, userId, status: "active" }, data: { status: "aborted", pausedAt: null } })
  if (updated.count === 0) {
    const attempt = await requireOwnAttempt(deps.db, userId, id)
    if (attempt.status !== "aborted") {
      throw new IpmaError(409, "NOT_ACTIVE", "Ein abgegebener oder abgeschlossener Versuch kann nicht abgebrochen werden.", { status: attempt.status })
    }
  }
  return { ok: true }
}

// ---------- Übersicht (GET /api/ipma/overview) ----------

/** Startseite (6.6): Beherrschung, fällige Fragen, Pool je Kompetenz, aktive und letzte Versuche, Bestwert */
export async function getOverview(deps: IpmaDeps, user: IpmaUser): Promise<OverviewView> {
  const db = deps.db
  const now = deps.now()
  const userId = user.id
  const [masteryMap, dueCount, active, recentLists, finishedExams, canUseAi] = await Promise.all([
    loadMastery(db, userId, deps.config),
    db.ipmaQuestionState.count({ where: { userId, box: { gte: 1 }, dueAt: { lte: now } } }),
    db.ipmaAttempt.findMany({ where: { userId, status: "active" }, orderBy: { startedAt: "desc" }, select: ATTEMPT_SELECT }),
    Promise.all(MODES.map((mode) => db.ipmaAttempt.findMany({
      where: { userId, mode, status: { not: "active" } },
      orderBy: { startedAt: "desc" },
      take: RECENT_PER_MODE,
      select: ATTEMPT_SELECT,
    }))),
    db.ipmaAttempt.findMany({
      where: { userId, mode: "exam", status: "finished" },
      select: { id: true, pointsQ: true, maxPointsQ: true },
    }),
    deps.hasPro(user),
  ])

  const pool: OverviewView["pool"] = {}
  for (const id of COMPETENCE_IDS) pool[id] = { mc: 0, offen: 0 }
  for (const q of deps.pool().questions) {
    if (q.status !== "geprueft") continue
    pool[q.kompetenz][q.typ] += 1
  }

  let bestExam: OverviewView["bestExam"] = null
  for (const e of finishedExams) {
    if (e.pointsQ === null || !e.maxPointsQ) continue
    const percent = Math.round((e.pointsQ * 1000) / e.maxPointsQ) / 10
    if (!bestExam || percent > bestExam.percent) bestExam = { attemptId: e.id, percent, pointsQ: e.pointsQ, maxPointsQ: e.maxPointsQ }
  }

  const recent = {} as Record<AttemptMode, AttemptSummary[]>
  MODES.forEach((mode, i) => { recent[mode] = recentLists[i].map(toAttemptSummary) })

  return {
    serverNow: now.toISOString(),
    canUseAi,
    mastery: COMPETENCE_IDS.map((id) => {
      const m = masteryMap.get(id)
      return { competence: id, value: m?.value ?? null, answers: m?.answers ?? 0, level: m?.level ?? "untrained" }
    }),
    dueCount,
    pool,
    active: active.map(toAttemptSummary),
    recent,
    bestExam,
  }
}
