// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// lib/ipma/view.ts
// Reine Serverhilfen des Prüfungssimulators ohne Datenbank (Spezifikation 6.6, 7.4): Umwandlung gespeicherter
// Positionen in ClientItem/SolvedItem (Allow-Liste), AttemptView, Uhr, Punkte ins Konto, Leitner-Plan.
// NUR SERVER: sieht die Poolfragen mit Lösungen. lib/ipma/server.ts exportiert alles weiter.

import type { IpmaAttempt, IpmaAttemptItem } from "@prisma/client"
import { RASTER_TOTAL, isCompetenceId, type CompetenceId } from "./competences"
import { EXAM_CONFIG, configSnapshot, type ConfigSnapshot, type Weights } from "./config"
import { IpmaError } from "./errors"
import { nextLeitner, type GradedAnswer, type LeitnerState } from "./review"
import { evaluateAttempt, type ScoredItem, type StationCatalog } from "./scoring"
import type {
  AiStatus,
  AttemptMode,
  AttemptResult,
  AttemptStatus,
  AttemptSummary,
  AttemptVariant,
  AttemptView,
  ClientItem,
  QuestionType,
  ScoreSource,
  SolvedItem,
} from "./types"
import { aiFeedbackSchema, configSnapshotSchema } from "../validations/ipma"
import type { PoolQuestion } from "../validations/ipma-pool"

/** Gespeicherte Position (Auszug aus IpmaAttemptItem) */
export type StoredItem = Pick<
  IpmaAttemptItem,
  | "position"
  | "questionId"
  | "questionVersion"
  | "type"
  | "competence"
  | "optionOrder"
  | "choice"
  | "text"
  | "flagged"
  | "locked"
  | "answeredAt"
  | "selfScores"
  | "selfAssessedAt"
  | "aiStatus"
  | "aiScores"
  | "aiFeedback"
  | "aiAssessedAt"
  | "scoreSource"
  | "rasterPoints"
  | "correct"
  | "pointsQ"
>

/** Gespeicherter Versuch (Auszug aus IpmaAttempt) */
export type StoredAttempt = Pick<
  IpmaAttempt,
  | "id"
  | "mode"
  | "variant"
  | "status"
  | "itemCount"
  | "startedAt"
  | "deadlineAt"
  | "pausedAt"
  | "resumedAt"
  | "activeSeconds"
  | "submittedAt"
  | "finishedAt"
  | "config"
  | "result"
  | "pointsQ"
  | "maxPointsQ"
  | "shownCount"
  | "passed"
  | "pointsAwarded"
>

/** Poolfrage zur ID (auch zurückgezogene) oder null */
export type QuestionLookup = (id: string) => PoolQuestion | null

const MODES: readonly AttemptMode[] = ["exam", "short", "training", "gaps"]
const STATUSES: readonly AttemptStatus[] = ["active", "submitted", "finished", "aborted"]
const AI_STATUSES: readonly AiStatus[] = ["none", "pending", "done", "failed"]
const SCORE_SOURCES: readonly ScoreSource[] = ["mc", "self", "ai"]

const MISSING_QUESTION = "Diese Frage ist nicht mehr im Fragenpool."

function oneOf<T extends string>(list: readonly T[], value: string | null, fallback: T): T {
  return value !== null && (list as readonly string[]).includes(value) ? (value as T) : fallback
}

export const asMode = (value: string): AttemptMode => oneOf(MODES, value, "training")
export const asStatus = (value: string): AttemptStatus => oneOf(STATUSES, value, "aborted")
export const asVariant = (value: string): AttemptVariant => (value === "pausable" ? "pausable" : "strict")
const asType = (value: string): QuestionType => (value === "offen" ? "offen" : "mc")

/** Prüfungen mit Uhr und Rückmeldung erst nach der Abgabe (3.1) */
export function isExamMode(mode: AttemptMode): boolean {
  return mode === "exam" || mode === "short"
}

/** Kompetenz einer gespeicherten Position (vom Server geschrieben; Fallback nur bei beschädigten Daten) */
function competenceOf(item: Pick<StoredItem, "competence">): CompetenceId {
  return isCompetenceId(item.competence) ? item.competence : "1.01"
}

/** Schnappschuss aus IpmaAttempt.config; ungültig → aktuelle Konfiguration (6.3) */
export function readConfig(json: unknown): ConfigSnapshot {
  const parsed = configSnapshotSchema.safeParse(json)
  return parsed.success ? parsed.data : configSnapshot()
}

function sum(values: readonly number[]): number {
  return values.reduce((s, v) => s + v, 0)
}

/** Anzeigeposition einer gespeicherten Wahl (Originalindex) über optionOrder; null ohne Wahl */
export function displayChoice(item: Pick<StoredItem, "choice" | "optionOrder">): number | null {
  if (item.choice === null) return null
  const index = item.optionOrder.indexOf(item.choice)
  return index >= 0 ? index : null
}

/** Originalindex zur Anzeigeposition (6.6 PUT items); ausserhalb → 400 */
export function originalChoice(optionOrder: readonly number[], display: number): number {
  const original = optionOrder[display]
  if (original === undefined) throw new IpmaError(400, "BAD_REQUEST", "Ungültige Auswahl.")
  return original
}

export interface ItemOptions {
  weights: Weights
  showCompetence: boolean
}

/**
 * Position ohne Lösung (6.6). Allow-Liste: jedes Feld einzeln, nie per Spread aus der Poolfrage.
 * Keine questionId (verrät die Kompetenz), kein optionOrder, keine Lösungsfelder; competence nur im Training.
 */
export function toClientItem(item: StoredItem, question: PoolQuestion | null, opts: ItemOptions): ClientItem {
  const type = asType(item.type)
  const out: ClientItem = {
    position: item.position,
    type,
    points: type === "mc" ? opts.weights.mc : opts.weights.offen,
    question: question?.frage ?? MISSING_QUESTION,
    choice: type === "mc" ? displayChoice(item) : null,
    text: type === "offen" ? item.text : null,
    flagged: item.flagged,
    locked: item.locked,
  }
  if (type === "mc") {
    out.options = question?.typ === "mc" ? item.optionOrder.map((i) => question.optionen[i] ?? "") : []
  }
  if (opts.showCompetence) out.competence = competenceOf(item)
  return out
}

/** Gespeicherte Claude-Rückmeldung (AP5) oder null */
function readAiFeedback(json: unknown): SolvedItem["aiFeedback"] {
  if (json === null || json === undefined) return null
  const parsed = aiFeedbackSchema.safeParse(json)
  return parsed.success ? parsed.data : null
}

/** Position mit freigegebener Lösung (6.6); Lösungsfelder einzeln aus der Poolfrage übernommen */
export function toSolvedItem(
  item: StoredItem,
  question: PoolQuestion | null,
  opts: { weights: Weights; catalog: StationCatalog },
): SolvedItem {
  const base = toClientItem(item, question, { weights: opts.weights, showCompetence: false })
  const fundstelle = question?.fundstelle
  const slug = fundstelle?.station
  const station = slug ? opts.catalog.get(slug) : undefined
  const source: SolvedItem["source"] = {
    icbPage: fundstelle?.icb.seite ?? 0,
    indicators: fundstelle ? [...fundstelle.icb.indikatoren] : [],
  }
  if (fundstelle?.lb) source.lb = fundstelle.lb
  if (slug) source.station = { slug, title: station?.title ?? slug, available: station?.available ?? false }
  if (fundstelle?.buch) source.book = fundstelle.buch
  if (fundstelle?.hinweis) source.note = fundstelle.hinweis

  const solved: SolvedItem = {
    ...base,
    questionId: item.questionId,
    competence: competenceOf(item),
    source,
    selfScores: [...item.selfScores],
    aiStatus: oneOf(AI_STATUSES, item.aiStatus, "none"),
    aiScores: [...item.aiScores],
    aiFeedback: readAiFeedback(item.aiFeedback),
    scoreSource: item.scoreSource === null ? null : oneOf(SCORE_SOURCES, item.scoreSource, "self"),
    rasterPoints: item.rasterPoints,
    correct: item.correct,
    pointsQ: item.pointsQ,
  }
  if (question?.typ === "mc") {
    const correctOption = item.optionOrder.indexOf(question.richtig)
    if (correctOption >= 0) solved.correctOption = correctOption
    solved.explanation = question.erklaerung
    const hints = question.optionHinweise
    if (hints) solved.optionHints = item.optionOrder.map((i) => hints[i] ?? "")
  } else if (question?.typ === "offen") {
    solved.modelAnswer = question.musterloesung
    solved.rubric = question.bewertungsraster.map((r) => ({ criterion: r.kriterium, points: r.punkte }))
    if (question.erklaerung) solved.explanation = question.erklaerung
  }
  if (question && question.version !== item.questionVersion) solved.revised = true
  if (!question || question.status === "zurueckgezogen") solved.withdrawn = true
  return solved
}

/** Sekunden zwischen zwei Zeitpunkten (abgerundet, nie negativ) */
export function secondsBetween(from: Date, to: Date): number {
  return Math.max(0, Math.floor((to.getTime() - from.getTime()) / 1000))
}

/**
 * Bisher gearbeitete Sekunden (3.2): «mit Pausen» = gespeicherte aktive Zeit plus laufender Abschnitt seit dem
 * letzten Start; sonst Zeit seit Beginn, bei Echtbedingungen höchstens bis deadlineAt. Nach der Abgabe gespeichert.
 */
export function currentActiveSeconds(
  attempt: Pick<StoredAttempt, "status" | "variant" | "startedAt" | "deadlineAt" | "pausedAt" | "resumedAt" | "activeSeconds">,
  now: Date,
): number {
  if (attempt.status !== "active") return attempt.activeSeconds
  if (attempt.variant === "pausable") {
    const running = attempt.pausedAt ? 0 : secondsBetween(attempt.resumedAt ?? attempt.startedAt, now)
    return attempt.activeSeconds + running
  }
  const end = attempt.deadlineAt && attempt.deadlineAt < now ? attempt.deadlineAt : now
  return secondsBetween(attempt.startedAt, end)
}

/** true, wenn ein aktiver Versuch mit Uhr über deadlineAt + Nachfrist liegt (3.2: Server gibt selbst ab) */
export function isExpired(
  attempt: Pick<StoredAttempt, "status" | "deadlineAt">,
  now: Date,
  graceSeconds: number = EXAM_CONFIG.exam.graceSeconds,
): boolean {
  return attempt.status === "active" && attempt.deadlineAt !== null &&
    now.getTime() > attempt.deadlineAt.getTime() + graceSeconds * 1000
}

/**
 * Darf eine Antwort gespeichert werden (6.6 PUT items)? Nur aktive Versuche (sonst 409 NOT_ACTIVE) und bei
 * Echtbedingungen höchstens bis deadlineAt + Nachfrist (sonst 422 TIME_UP).
 */
export function checkAnswerWindow(
  attempt: Pick<StoredAttempt, "status" | "deadlineAt">,
  now: Date,
  graceSeconds: number = EXAM_CONFIG.exam.graceSeconds,
): void {
  if (attempt.status !== "active") {
    throw new IpmaError(409, "NOT_ACTIVE", "Dieser Versuch ist nicht mehr aktiv.", { status: attempt.status })
  }
  if (isExpired(attempt, now, graceSeconds)) {
    throw new IpmaError(422, "TIME_UP", "Die Zeit ist abgelaufen. Die Prüfung wird abgegeben.")
  }
}

/** Ganze Prozent (abgerundet) für Bestwert und Punkte ins Konto */
export function percentFloor(pointsQ: number, maxPointsQ: number): number {
  return maxPointsQ > 0 ? Math.floor((pointsQ * 100) / maxPointsQ) : 0
}

/** Höchstens 100 Punkte ins Konto je Übungsprüfung (6.10) */
export const MAX_POINTS_PER_EXAM = 100

/**
 * Punkte ins Konto für eine abgeschlossene Übungsprüfung (6.10): Verbesserung des Bestwerts in ganzen
 * Prozentpunkten, erster Versuch voll, höchstens 100. Ganze Prozent abgerundet, damit sich kleine
 * Verbesserungen nicht über viele Versuche aufsummieren (Summe ≤ 100 je Konto).
 */
export function computePointsAward(oldBestPercent: number | null, newPercent: number): number {
  const improvement = Math.floor(newPercent) - Math.floor(oldBestPercent ?? 0)
  return Math.min(MAX_POINTS_PER_EXAM, Math.max(0, improvement))
}

/** Bewertete Positionen für evaluateAttempt (4.4); Training und Lücken nur gesperrte Positionen */
export function scoredItems(items: readonly StoredItem[], mode: AttemptMode): ScoredItem[] {
  const relevant = isExamMode(mode) ? items : items.filter((i) => i.locked)
  return relevant.map((i): ScoredItem => {
    const competence = competenceOf(i)
    if (asType(i.type) === "mc") return { type: "mc", competence, correctOption: i.correct === true }
    const self = i.selfScores.length ? sum(i.selfScores) : i.scoreSource === "self" ? i.rasterPoints : null
    const ai = i.aiStatus === "done" && i.aiScores.length ? sum(i.aiScores) : null
    return { type: "offen", competence, rasterPoints: i.rasterPoints, selfRasterPoints: self, aiRasterPoints: ai }
  })
}

/** Ergebnis eines Versuchs aus den gespeicherten Positionen mit dem Schnappschuss des Versuchs (4.4, 6.3) */
export function resultOf(
  attempt: Pick<StoredAttempt, "mode" | "config">,
  items: readonly StoredItem[],
  catalog: StationCatalog,
): AttemptResult {
  const mode = asMode(attempt.mode)
  return evaluateAttempt(scoredItems(items, mode), readConfig(attempt.config), mode, catalog)
}

/** Gespeichertes Ergebnis (IpmaAttempt.result) oder null */
function storedResult(json: unknown): AttemptResult | null {
  if (!json || typeof json !== "object" || Array.isArray(json)) return null
  return json as AttemptResult
}

export interface ViewContext {
  lookup: QuestionLookup
  catalog: StationCatalog
  now: Date
  canUseAi: boolean
}

/**
 * Antwort von GET /api/ipma/attempts/[id] (6.6, Regeln für Lösungen):
 * - active, exam/short: nur ClientItem ohne Kompetenz
 * - active, training/gaps: ClientItem mit Kompetenz, gesperrte Positionen als SolvedItem
 * - submitted, finished: SolvedItem für alle Positionen und Ergebnis (submitted: vorläufig, aus den Positionen)
 * - aborted: nur Kopfdaten
 */
export function buildAttemptView(attempt: StoredAttempt, items: readonly StoredItem[], ctx: ViewContext): AttemptView {
  const mode = asMode(attempt.mode)
  const status = asStatus(attempt.status)
  const weights = readConfig(attempt.config).weights
  const sorted = items.slice().sort((a, b) => a.position - b.position)
  const solved = (i: StoredItem) => toSolvedItem(i, ctx.lookup(i.questionId), { weights, catalog: ctx.catalog })

  let viewItems: AttemptView["items"] = []
  if (status === "active") {
    viewItems = sorted.map((i) =>
      !isExamMode(mode) && i.locked
        ? solved(i)
        : toClientItem(i, ctx.lookup(i.questionId), { weights, showCompetence: !isExamMode(mode) }))
  } else if (status === "submitted" || status === "finished") {
    viewItems = sorted.map(solved)
  }

  let result: AttemptResult | null = null
  if (status === "finished") result = storedResult(attempt.result) ?? resultOf(attempt, items, ctx.catalog)
  else if (status === "submitted") result = resultOf(attempt, items, ctx.catalog)

  return {
    id: attempt.id,
    mode,
    variant: asVariant(attempt.variant),
    status,
    startedAt: attempt.startedAt.toISOString(),
    deadlineAt: attempt.deadlineAt?.toISOString() ?? null,
    serverNow: ctx.now.toISOString(),
    activeSeconds: currentActiveSeconds(attempt, ctx.now),
    paused: status === "active" && attempt.pausedAt !== null,
    items: viewItems,
    result,
    canUseAi: ctx.canUseAi,
  }
}

/** Kopfdaten eines Versuchs für Listen (OverviewView) */
export function toAttemptSummary(a: StoredAttempt): AttemptSummary {
  const percent = a.pointsQ !== null && a.maxPointsQ ? Math.round((a.pointsQ * 1000) / a.maxPointsQ) / 10 : null
  return {
    id: a.id,
    mode: asMode(a.mode),
    variant: asVariant(a.variant),
    status: asStatus(a.status),
    itemCount: a.itemCount,
    startedAt: a.startedAt.toISOString(),
    deadlineAt: a.deadlineAt?.toISOString() ?? null,
    submittedAt: a.submittedAt?.toISOString() ?? null,
    finishedAt: a.finishedAt?.toISOString() ?? null,
    pointsQ: a.pointsQ,
    maxPointsQ: a.maxPointsQ,
    percent,
    shownCount: a.shownCount,
    passed: a.passed,
    pointsAwarded: a.pointsAwarded,
  }
}

/** Bewertete Position für die Beherrschung (4.4) */
export type GradedItem = Pick<StoredItem, "type" | "competence" | "correct" | "rasterPoints" | "answeredAt" | "selfAssessedAt" | "aiAssessedAt">

/** Bewertete Antworten (correct gesetzt) für mastery(); Zeitpunkt der letzten Bewertung bzw. Antwort */
export function gradedAnswers(items: readonly GradedItem[], fallbackAt: (index: number) => Date): GradedAnswer[] {
  const out: GradedAnswer[] = []
  items.forEach((i, index) => {
    if (i.correct === null) return
    const at = i.aiAssessedAt ?? i.selfAssessedAt ?? i.answeredAt ?? fallbackAt(index)
    const score = asType(i.type) === "mc"
      ? (i.correct ? 1 : 0)
      : Math.max(0, Math.min(RASTER_TOTAL, i.rasterPoints ?? 0)) / RASTER_TOTAL
    out.push({ competence: competenceOf(i), score, at: at.getTime() })
  })
  return out
}

/** Leitner-Zustand und Zähler einer Frage (Auszug aus IpmaQuestionState) */
export interface QuestionStateRow {
  questionId: string
  box: number
  dueAt: Date | null
  correctCount: number
}

export interface LeitnerUpdate {
  questionId: string
  box: number
  dueAt: Date
  correct: boolean
  exists: boolean
}

/**
 * Leitner-Plan für bewertete Fragen (3.5, 6.10): neues Fach und Fälligkeit je Frage sowie die Anzahl Fragen,
 * die zum ersten Mal richtig sind (correctCount vorher 0, Grundlage für 1 Punkt im Training).
 */
export function planLeitner(
  graded: readonly { questionId: string; correct: boolean }[],
  states: ReadonlyMap<string, QuestionStateRow>,
  now: Date,
): { updates: LeitnerUpdate[]; firstCorrect: number } {
  const updates: LeitnerUpdate[] = []
  let firstCorrect = 0
  const seen = new Set<string>()
  for (const g of graded) {
    if (seen.has(g.questionId)) continue
    seen.add(g.questionId)
    const prev = states.get(g.questionId)
    const prevState: LeitnerState | null = prev ? { box: prev.box, dueAt: prev.dueAt?.getTime() ?? null } : null
    const next = nextLeitner(prevState, g.correct, now.getTime())
    if (g.correct && (prev?.correctCount ?? 0) === 0) firstCorrect += 1
    updates.push({ questionId: g.questionId, box: next.box, dueAt: new Date(next.dueAt ?? now.getTime()), correct: g.correct, exists: prev !== undefined })
  }
  return { updates, firstCorrect }
}
