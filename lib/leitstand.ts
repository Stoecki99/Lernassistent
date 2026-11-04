// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// lib/leitstand.ts
// Serverlogik des Leitstands (Projektsimulator): Speicherung als Startwert + Aktionsprotokoll,
// Nachspielen auf dem Server, Punkte, Abzeichen-Statistik, Lernfortschritt Station 23,
// Zugangsprüfung (nur Pro und Admin) und Rate-Limit. Spezifikation 4.5–4.7 und 7.
// Die reinen Hilfen (verifyAndAppend, computePointsAward, achievementStats, checkRunVersion,
// summarize) arbeiten ohne Datenbank und sind in tests/simulation-api.test.ts geprüft.

import { randomInt } from "node:crypto"
import { NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/auth"
import { getUserPlan } from "@/lib/subscription"
import { fortschrittSchreibdaten, type LernStatus } from "@/lib/validations/lernfortschritt"
import { MAX_ACTIONS_PER_RUN } from "@/lib/validations/simulation"
import {
  ENGINE_VERSION,
  SimError,
  computeKpis,
  computeScore,
  loadScenario,
  replay,
  type Action,
  type RunPhase,
  type RunResult,
  type Scenario,
  type SimState,
} from "@/lib/simulation"

// ---------- Konstanten ----------

export const RUN_STATUS = ["aktiv", "abgeschlossen", "abgebrochen", "veraltet"] as const
export type RunStatus = (typeof RUN_STATUS)[number]

/** Lernpfad-Station, die der Leitstand meldet (4.7) */
export const LEITSTAND_STATION = { fach: "pmgt", thema: "23-leitstand" } as const
/**
 * Standard-Ernstfall für die Laufliste ohne scenarioId (Bestwert). Station 23 «erledigt» setzt jeder
 * abgeschlossene Ernstfall (kind «main»: Wolkenried oder Hochmatt), siehe stationDoneFor (K3, 2.11.13).
 */
export const ERNSTFALL_SCENARIO_ID = "wolkenried"

/** Höchstwerte für den Startwert (4.6: crypto.randomInt(1, 2147483647)) */
const SEED_MIN = 1
const SEED_MAX_EXCLUSIVE = 2_147_483_647

/** Höchstens 100 Punkte ins Konto je Lauf (4.7) */
export const MAX_POINTS_PER_RUN = 100

/** Grösse des Anfrage-Körpers höchstens 256 KB (4.6) */
export const MAX_BODY_BYTES = 256 * 1024

export const NO_CACHE = { "Cache-Control": "private, no-store" } as const

/** Die acht Abzeichen aus 3.13 (Badge.condition) */
export const LEITSTAND_BADGE_CONDITIONS = [
  "leitstand_einfuehrung",
  "leitstand_ernstfall",
  "leitstand_drei_sterne",
  "leitstand_punktlandung",
  "leitstand_klartext",
  "leitstand_teamgeist",
  "leitstand_risikoprofi",
  "leitstand_null_fehler",
] as const

// ---------- Fehler ----------

export type LeitstandErrorCode =
  | "CONFLICT"
  | "NOT_ACTIVE"
  | "OUTDATED"
  | "INVALID_ACTION"
  | "LIMIT"
  | "NOT_FINISHED"
  | "NOT_FOUND"
  | "BAD_REQUEST"
  // Architektur-Leitstand (lib/architektur-leitstand.ts)
  | "LOCKED"
  | "INVALID_MODEL"

/** Fachlicher Fehler mit HTTP-Status; die Meldung ist für die Oberfläche bestimmt. */
export class LeitstandError extends Error {
  readonly status: 400 | 404 | 409 | 413 | 422
  readonly code: LeitstandErrorCode
  readonly extra: Record<string, unknown>

  constructor(status: LeitstandError["status"], code: LeitstandErrorCode, message: string, extra: Record<string, unknown> = {}) {
    super(message)
    this.name = "LeitstandError"
    this.status = status
    this.code = code
    this.extra = extra
  }
}

/** Antwort für einen Fehler: LeitstandError mit Meldung, alles andere generisch 500 (Projektmuster). */
export function errorResponse(error: unknown, logTag: string, genericMessage: string): NextResponse {
  if (error instanceof LeitstandError) {
    return NextResponse.json({ error: error.message, code: error.code, ...error.extra }, { status: error.status, headers: NO_CACHE })
  }
  console.error(logTag, error)
  return NextResponse.json({ error: genericMessage }, { status: 500, headers: NO_CACHE })
}

// ---------- Reine Hilfen (ohne Datenbank) ----------

/** Felder eines gespeicherten Laufs, die das Nachspielen braucht */
export interface StoredRun {
  status: string
  seed: number
  scenarioId: string
  scenarioVersion: string
  engineVersion: number
  actions: unknown
  actionCount: number
}

/** Kleine Zusammenfassung für Listen (4.5), vom Server aus dem Nachspielen berechnet */
export interface RunSummary {
  tag: number
  phase: RunPhase
  spi: number
  cpi: number
  qi: number
  motivation: number
  si: number
  rmi: number
}

const round3 = (value: number): number => Math.round(value * 1000) / 1000

export function summarize(state: SimState, scenario: Scenario): RunSummary {
  const k = computeKpis(state, scenario)
  return {
    tag: k.day,
    phase: state.phase,
    spi: round3(k.spi),
    cpi: round3(k.cpi),
    qi: round3(k.qi),
    motivation: round3(k.teamMotivation),
    si: round3(k.si),
    rmi: round3(k.rmi),
  }
}

/** true, wenn Szenario- oder Rechenkern-Version nicht mehr zum gespeicherten Lauf passt (4.5) */
export function isOutdated(run: Pick<StoredRun, "scenarioVersion" | "engineVersion">, scenario: Scenario): boolean {
  return run.scenarioVersion !== scenario.version || run.engineVersion !== ENGINE_VERSION
}

/**
 * Status nach der Versionsprüfung: Ein aktiver Lauf mit abweichender Version wird «veraltet».
 * Abgeschlossene Läufe behalten ihr gespeichertes Ergebnis (Bestwert bleibt gültig).
 */
export function checkRunVersion(run: Pick<StoredRun, "status" | "scenarioVersion" | "engineVersion">, scenario: Scenario): string {
  if (run.status === "aktiv" && isOutdated(run, scenario)) return "veraltet"
  return run.status
}

/** Gespeichertes Protokoll als Aktionsliste. Jede Aktion prüft replay ohnehin erneut. */
export function storedActions(json: unknown): Action[] {
  if (!Array.isArray(json)) throw new Error("Gespeichertes Aktionsprotokoll ist keine Liste.")
  return json as Action[]
}

/** Wandelt einen SimError beim Nachspielen in 422 mit Index und Meldung (4.6) */
function replayOrThrow(scenario: Scenario, seed: number, actions: Action[]): SimState {
  try {
    return replay(scenario, seed, actions)
  } catch (error) {
    if (error instanceof SimError) {
      throw new LeitstandError(422, "INVALID_ACTION", error.message, {
        index: error.actionIndex ?? null,
        simCode: error.code,
        details: error.details,
      })
    }
    throw error
  }
}

export interface AppendInput {
  fromIndex: number
  actions: Action[]
}

export interface AppendResult {
  actions: Action[]
  state: SimState
  actionCount: number
  tick: number
  phase: RunPhase
  summary: RunSummary
}

/**
 * Prüft einen Anhang ans Aktionsprotokoll und spielt das ganze Protokoll nach (4.6).
 * Wirft LeitstandError: 409 bei veralteter Version, nicht aktivem Lauf oder fromIndex ≠ actionCount;
 * 422 bei ungültiger Aktion (mit Index im Gesamtprotokoll) oder mehr als MAX_ACTIONS_PER_RUN.
 * Der gespeicherte Lauf bleibt unverändert (rein).
 */
export function verifyAndAppend(run: StoredRun, input: AppendInput, scenario: Scenario): AppendResult {
  if (isOutdated(run, scenario)) {
    throw new LeitstandError(409, "OUTDATED", "Dieser Lauf stammt aus einer älteren Version und kann nicht weitergespielt werden.", {
      status: "veraltet",
    })
  }
  if (run.status !== "aktiv") {
    throw new LeitstandError(409, "NOT_ACTIVE", "Dieser Lauf ist nicht mehr aktiv.", { status: run.status })
  }
  if (input.fromIndex !== run.actionCount) {
    throw new LeitstandError(409, "CONFLICT", "Konflikt: Der Lauf wurde inzwischen an anderer Stelle weitergespielt.", {
      actionCount: run.actionCount,
    })
  }
  const previous = storedActions(run.actions)
  if (previous.length !== run.actionCount) {
    throw new Error(`Aktionsprotokoll (${previous.length}) passt nicht zu actionCount (${run.actionCount}).`)
  }
  const all = [...previous, ...input.actions]
  if (all.length > MAX_ACTIONS_PER_RUN) {
    throw new LeitstandError(422, "LIMIT", `Höchstens ${MAX_ACTIONS_PER_RUN} Aktionen je Lauf.`)
  }
  const state = replayOrThrow(scenario, run.seed, all)
  return {
    actions: all,
    state,
    actionCount: all.length,
    tick: state.tick,
    phase: state.phase,
    summary: summarize(state, scenario),
  }
}

/**
 * Punkte ins Konto (4.7, Entscheid 7 Nr. 4): Verbesserung des Bestwerts ÷ 10, gerundet,
 * höchstens 100 je Lauf; Wiederholungen mit bekanntem Startwert geben nichts.
 * oldBest = bisheriger Bestwert (null = erster Lauf, zählt voll).
 */
export function computePointsAward(oldBest: number | null, newScore: number, seedReused: boolean): number {
  if (seedReused) return 0
  const improvement = Math.max(0, newScore - (oldBest ?? 0))
  return Math.min(MAX_POINTS_PER_RUN, Math.round(improvement / 10))
}

/** Setzt der Abschluss dieses Szenarios Station 23 auf «erledigt»? Jeder Ernstfall zählt (K3), der Einführungslauf nicht. */
export function stationDoneFor(scenario: Pick<Scenario, "kind">): boolean {
  return scenario.kind === "main"
}

/** Ausschnitt eines Laufs für die Abzeichen-Statistik */
export interface AchievementRun {
  status: string
  seedReused: boolean
  scoreDetail: unknown
}

function achievementsOf(scoreDetail: unknown): string[] {
  if (!scoreDetail || typeof scoreDetail !== "object") return []
  const list = (scoreDetail as { achievements?: unknown }).achievements
  return Array.isArray(list) ? list.filter((a): a is string => typeof a === "string") : []
}

/**
 * Vereinigung der achievements aller abgeschlossenen Läufe mit neuem Startwert (4.7, 3.13).
 * Einführungsläufe liefern nur «leitstand_einfuehrung» (der Rechenkern vergibt dort nichts anderes).
 */
export function achievementStats(runs: AchievementRun[]): Set<string> {
  const out = new Set<string>()
  for (const run of runs) {
    if (run.status !== "abgeschlossen" || run.seedReused) continue
    for (const a of achievementsOf(run.scoreDetail)) out.add(a)
  }
  return out
}

/** Fehlercode eines Prisma-Fehlers (P2002 eindeutig verletzt, P2034 Schreibkonflikt/Deadlock), sonst undefined */
export function prismaErrorCode(error: unknown): string | undefined {
  if (error && typeof error === "object" && "code" in error) {
    const code = (error as { code: unknown }).code
    return typeof code === "string" ? code : undefined
  }
  return undefined
}

/**
 * fn bis zu attempts Mal ausführen, solange der Prisma-Fehlercode in codes liegt (z. B. Transaktion neu starten).
 * Andere Fehler und der letzte Fehlschlag gehen unverändert weiter.
 */
export async function retryOnPrismaCodes<T>(codes: readonly string[], attempts: number, fn: () => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn()
    } catch (error) {
      const code = prismaErrorCode(error)
      if (attempt >= attempts || code === undefined || !codes.includes(code)) throw error
    }
  }
}

/** Startwert für einen neuen Lauf (4.6) */
export function newSeed(): number {
  return randomInt(SEED_MIN, SEED_MAX_EXCLUSIVE)
}

// ---------- Anfrage-Hilfen ----------

/**
 * Liest den Körper als Text, höchstens maxBytes. Der Strom wird stückweise gelesen und beim Überschreiten
 * abgebrochen, damit auch ohne (oder mit falschem) content-length nie mehr als die Grenze im Speicher landet.
 */
export async function readLimitedText(request: Request, maxBytes: number = MAX_BODY_BYTES): Promise<string> {
  const declared = Number(request.headers.get("content-length") ?? "0")
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw new LeitstandError(413, "LIMIT", "Anfrage zu gross.")
  }
  if (!request.body) return ""
  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > maxBytes) {
      await reader.cancel().catch(() => undefined)
      throw new LeitstandError(413, "LIMIT", "Anfrage zu gross.")
    }
    chunks.push(value)
  }
  return new TextDecoder().decode(Buffer.concat(chunks))
}

/**
 * Liest den JSON-Körper mit Grössenprüfung (256 KB, siehe readLimitedText).
 * Leerer Körper ergibt emptyValue (für finish mit «{}» oder ohne Körper).
 */
export async function readJsonBody(request: Request, emptyValue?: unknown): Promise<unknown> {
  const text = await readLimitedText(request)
  if (text.trim() === "" && emptyValue !== undefined) return emptyValue
  try {
    return JSON.parse(text) as unknown
  } catch {
    throw new LeitstandError(400, "BAD_REQUEST", "Ungültige Eingabe.")
  }
}

// Rate-Limit im Speicher je Konto und Zweck (wie Chat): Fenster 1 Minute
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const RATE_WINDOW_MS = 60 * 1000

/** Anfragen je Minute und Konto: Anhängen, Starten, Abschliessen (Nachspielen + Transaktion), Lesen, Abbrechen */
export const RATE_LIMITS = { actions: 60, createRun: 10, finish: 10, read: 60, abort: 10 } as const

export function checkRateLimit(userId: string, purpose: keyof typeof RATE_LIMITS): boolean {
  const now = Date.now()
  if (rateLimitMap.size > 5000) {
    for (const [key, value] of rateLimitMap) if (now > value.resetAt) rateLimitMap.delete(key)
  }
  const key = `${purpose}:${userId}`
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

// ---------- Zugang (Entscheid 7 Nr. 6: nur Pro und Admin) ----------

export interface LeitstandUser {
  id: string
  email?: string | null
}

/** Admin wie im übrigen Projekt (ADMIN_EMAIL) oder Plan «pro», nicht abgelaufen (getUserPlan). */
export async function hasLeitstandAccess(user: LeitstandUser): Promise<boolean> {
  const adminEmail = process.env.ADMIN_EMAIL
  if (adminEmail && user.email === adminEmail) return true
  const { plan } = await getUserPlan(user.id)
  return plan === "pro"
}

/** Für Routen: eingeloggt (sonst 401) und Pro/Admin (sonst 403). */
export async function requireLeitstandUser(): Promise<{ user: LeitstandUser; response?: undefined } | { user?: undefined; response: NextResponse }> {
  const sessionUser = await getCurrentUser()
  if (!sessionUser?.id) {
    return { response: NextResponse.json({ error: "Nicht autorisiert." }, { status: 401, headers: NO_CACHE }) }
  }
  const user: LeitstandUser = { id: sessionUser.id, email: sessionUser.email }
  if (!(await hasLeitstandAccess(user))) {
    return {
      response: NextResponse.json(
        { error: "Der Leitstand ist im Pro-Abo enthalten.", code: "PRO_REQUIRED" },
        { status: 403, headers: NO_CACHE },
      ),
    }
  }
  return { user }
}

// ---------- Datenbank ----------

/** Szenario laden; unbekannt → 400 */
export function requireScenario(scenarioId: string): Scenario {
  const scenario = loadScenario(scenarioId)
  if (!scenario) throw new LeitstandError(400, "BAD_REQUEST", "Unbekanntes Szenario.")
  return scenario
}

type Db = Prisma.TransactionClient

/** Station 23 «begonnen» / «erledigt»; «erledigt» wird nie zurückgestuft (fortschrittSchreibdaten). */
export async function markStation(db: Db, userId: string, status: LernStatus): Promise<void> {
  const daten = fortschrittSchreibdaten({ ...LEITSTAND_STATION, status, quiz: null })
  await db.lernfortschritt.upsert({
    where: { userId_fach_thema: { userId, ...LEITSTAND_STATION } },
    create: { userId, ...LEITSTAND_STATION, ...daten.create },
    update: { ...daten.update, updatedAt: new Date() },
  })
}

/** Bestwert eines Szenarios: nur abgeschlossene Läufe mit neuem Startwert (4.6, 7 Nr. 1) */
export async function findBest(
  db: Db,
  userId: string,
  scenarioId: string,
  excludeRunId?: string,
): Promise<{ score: number; stars: number; runId: string } | null> {
  const best = await db.simulationRun.findFirst({
    where: {
      userId,
      scenarioId,
      status: "abgeschlossen",
      seedReused: false,
      score: { not: null },
      ...(excludeRunId ? { id: { not: excludeRunId } } : {}),
    },
    orderBy: [{ score: "desc" }, { finishedAt: "asc" }],
    select: { id: true, score: true, stars: true },
  })
  if (!best || best.score === null) return null
  return { score: best.score, stars: best.stars ?? 0, runId: best.id }
}

export interface CreatedRun {
  id: string
  scenarioId: string
  seed: number
  seedReused: boolean
  scenarioVersion: string
  engineVersion: number
}

/**
 * Neuer Lauf (4.6 POST runs): Startwert neu oder vom eigenen abgeschlossenen Lauf übernommen,
 * alten aktiven Lauf desselben Szenarios abbrechen, Station 23 «begonnen».
 * Der Teil-Index «SimulationRun_aktiv_eindeutig» erlaubt nur einen aktiven Lauf: Legt eine gleichzeitige
 * Anfrage zuerst einen an, scheitert create mit P2002; dann neuer Versuch (der spätere Start gewinnt),
 * nach drei Versuchen 409.
 */
export async function createRunForUser(userId: string, scenarioId: string, repeatOfRunId?: string): Promise<CreatedRun> {
  const scenario = requireScenario(scenarioId)

  let seed = newSeed()
  let seedReused = false
  if (repeatOfRunId) {
    const source = await prisma.simulationRun.findFirst({
      where: { id: repeatOfRunId, userId, scenarioId, status: "abgeschlossen" },
      select: { seed: true },
    })
    if (!source) throw new LeitstandError(404, "NOT_FOUND", "Lauf zum Wiederholen nicht gefunden.")
    seed = source.seed
    seedReused = true
  }

  const createTx = () => prisma.$transaction(async (tx) => {
    await tx.simulationRun.updateMany({
      where: { userId, scenarioId, status: "aktiv" },
      data: { status: "abgebrochen" },
    })
    const run = await tx.simulationRun.create({
      data: {
        userId,
        scenarioId,
        scenarioVersion: scenario.version,
        engineVersion: ENGINE_VERSION,
        seed,
        seedReused,
        status: "aktiv",
        actions: [],
        actionCount: 0,
        tick: 0,
      },
      select: { id: true },
    })
    await markStation(tx, userId, "begonnen")
    return { id: run.id, scenarioId, seed, seedReused, scenarioVersion: scenario.version, engineVersion: ENGINE_VERSION }
  })
  try {
    return await retryOnPrismaCodes(["P2002"], 3, createTx)
  } catch (error) {
    if (prismaErrorCode(error) === "P2002") {
      throw new LeitstandError(409, "CONFLICT", "Gleichzeitig wurde ein anderer Lauf gestartet. Bitte erneut versuchen.")
    }
    throw error
  }
}

/** Lauf eines Kontos laden; fremd oder nicht vorhanden → 404 */
async function requireOwnRun(userId: string, runId: string) {
  const run = await prisma.simulationRun.findFirst({
    where: { id: runId, userId },
    select: {
      id: true,
      status: true,
      seed: true,
      seedReused: true,
      scenarioId: true,
      scenarioVersion: true,
      engineVersion: true,
      actions: true,
      actionCount: true,
      score: true,
      scoreDetail: true,
      pointsAwarded: true,
    },
  })
  if (!run) throw new LeitstandError(404, "NOT_FOUND", "Lauf nicht gefunden.")
  return run
}

/** Aktiven Lauf mit abweichender Version als «veraltet» speichern */
async function markOutdated(userId: string, runId: string): Promise<void> {
  await prisma.simulationRun.updateMany({ where: { id: runId, userId, status: "aktiv" }, data: { status: "veraltet" } })
}

/** POST runs/[id]/actions: prüfen, nachspielen, mit optimistischer Sperre speichern (4.6) */
export async function appendActions(userId: string, runId: string, input: AppendInput) {
  const run = await requireOwnRun(userId, runId)
  const scenario = requireScenario(run.scenarioId)
  if (checkRunVersion(run, scenario) === "veraltet") await markOutdated(userId, runId)

  const result = verifyAndAppend(run, input, scenario)

  const saved = await prisma.simulationRun.updateMany({
    where: { id: runId, userId, status: "aktiv", actionCount: input.fromIndex },
    data: {
      actions: result.actions as unknown as Prisma.InputJsonValue,
      actionCount: result.actionCount,
      tick: result.tick,
      summary: result.summary as unknown as Prisma.InputJsonValue,
    },
  })
  if (saved.count === 0) {
    // Gleichzeitiger Anhang: aktuellen Stand mitgeben, damit der Browser eine verlorene Antwort erkennt (4.6)
    const now = await prisma.simulationRun.findFirst({ where: { id: runId, userId }, select: { actionCount: true, status: true } })
    throw new LeitstandError(409, "CONFLICT", "Konflikt: Der Lauf wurde inzwischen an anderer Stelle weitergespielt.", {
      ...(now ? { actionCount: now.actionCount, status: now.status } : {}),
    })
  }
  return { actionCount: result.actionCount, tick: result.tick, phase: result.phase, summary: result.summary }
}

/** Versuche der Abschluss-Transaktion bei Serialisierungsfehlern */
const FINISH_ATTEMPTS = 3

export interface FinishOutcome {
  result: RunResult
  improvedBest: boolean
  pointsAwarded: number
  /** false, wenn der Lauf schon abgeschlossen war (idempotenter zweiter Aufruf) */
  firstFinish: boolean
}

/**
 * POST runs/[id]/finish (4.6, 4.7): nachspielen, Punkte auf dem Server berechnen, speichern,
 * Punkte ins Konto und Station 23 in einer Transaktion. Abzeichen vergibt die Route danach
 * (checkAndAwardBadges). Idempotent: ein zweiter Aufruf liefert das gespeicherte Ergebnis.
 * Die Transaktion läuft «Serializable»: Zwei gleichzeitige Abschlüsse desselben Szenarios lesen sonst
 * denselben alten Bestwert und vergäben die Verbesserung doppelt. Serialisierungsfehler (P2034) → neuer Versuch.
 */
export async function finishRun(userId: string, runId: string): Promise<FinishOutcome> {
  const run = await requireOwnRun(userId, runId)
  if (run.status === "abgeschlossen") return storedOutcome(userId, run)

  const scenario = requireScenario(run.scenarioId)
  if (checkRunVersion(run, scenario) === "veraltet") {
    await markOutdated(userId, runId)
    throw new LeitstandError(409, "OUTDATED", "Dieser Lauf stammt aus einer älteren Version und kann nicht abgeschlossen werden.", {
      status: "veraltet",
    })
  }
  if (run.status !== "aktiv") {
    throw new LeitstandError(409, "NOT_ACTIVE", "Dieser Lauf ist nicht mehr aktiv.", { status: run.status })
  }

  const state = replayOrThrow(scenario, run.seed, storedActions(run.actions))
  if (state.phase !== "abgeschlossen") {
    throw new LeitstandError(422, "NOT_FINISHED", "Der Lauf ist noch nicht abgeschlossen (Abschlussbericht fehlt).", { phase: state.phase })
  }
  const result = computeScore(state, scenario)
  const countsForBest = scenario.kind === "main" && !run.seedReused

  const finishTx = () => prisma.$transaction(async (tx) => {
    const oldBest = countsForBest ? await findBest(tx, userId, run.scenarioId, runId) : null
    const pointsAwarded = countsForBest ? computePointsAward(oldBest?.score ?? null, result.score.total, false) : 0
    const improvedBest = countsForBest && (oldBest === null || result.score.total > oldBest.score)

    const saved = await tx.simulationRun.updateMany({
      where: { id: runId, userId, status: "aktiv", actionCount: run.actionCount },
      data: {
        status: "abgeschlossen",
        tick: state.tick,
        summary: summarize(state, scenario) as unknown as Prisma.InputJsonValue,
        score: result.score.total,
        stars: result.stars,
        scoreDetail: result as unknown as Prisma.InputJsonValue,
        pointsAwarded,
        finishedAt: new Date(),
      },
    })
    if (saved.count === 0) return null // gleichzeitiger Abschluss oder Anhang: gespeicherten Stand liefern

    if (pointsAwarded > 0) {
      await tx.user.update({ where: { id: userId }, data: { points: { increment: pointsAwarded } } })
    }
    if (stationDoneFor(scenario)) await markStation(tx, userId, "erledigt")
    return { result, improvedBest, pointsAwarded, firstFinish: true }
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
  const outcome = await retryOnPrismaCodes(["P2034"], FINISH_ATTEMPTS, finishTx)

  if (outcome) return outcome
  const again = await requireOwnRun(userId, runId)
  if (again.status === "abgeschlossen") return storedOutcome(userId, again)
  throw new LeitstandError(409, "CONFLICT", "Konflikt: Der Lauf wurde inzwischen verändert.", { actionCount: again.actionCount })
}

async function storedOutcome(
  userId: string,
  run: { id: string; scenarioId: string; seedReused: boolean; scoreDetail: unknown; pointsAwarded: number },
): Promise<FinishOutcome> {
  const countsForBest = !run.seedReused && loadScenario(run.scenarioId)?.kind === "main"
  const best = countsForBest ? await findBest(prisma, userId, run.scenarioId) : null
  return {
    result: run.scoreDetail as RunResult,
    improvedBest: best?.runId === run.id,
    pointsAwarded: run.pointsAwarded,
    firstFinish: false,
  }
}
