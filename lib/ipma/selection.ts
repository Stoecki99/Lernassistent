// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// lib/ipma/selection.ts
// Deterministische Auswahl der Fragen je Modus (Spezifikation 3.2–3.5, 6.5). Rein, ohne Datenbank.
// Gleicher Startwert + gleicher Pool + gleiche Vorgeschichte (exposure, states) = gleiches Ergebnis.
// Der Zufall wird in fester Reihenfolge gezogen (Kompetenzen nach ID, Kandidaten nach ID).
// Nur Server: die Datei sieht den Pool mit Lösungen (6.6 «Bündel»).

import { nextRandom } from "../simulation/rng"
import { AREA_IDS, COMPETENCE_IDS, getCompetence, type AreaId, type CompetenceId } from "./competences"
import { EXAM_CONFIG, type ExamConfig } from "./config"
import { IpmaError } from "./errors"
import { isDue, type LeitnerState, type Mastery } from "./review"
import type { PoolQuestion } from "../validations/ipma-pool"
import type { QuestionType } from "./types"

/** Kontakt eines Kontos mit einer Frage (aus IpmaQuestionState) */
export interface Exposure { seenCount: number; lastSeenAt: number | null } // ms seit 1970

export interface SelectedItem {
  position: number
  questionId: string
  questionVersion: number
  type: QuestionType
  competence: CompetenceId
  optionOrder: number[] // MC: Anzeigeposition → Originalindex; offen: []
}

/** Zufallsquelle mit Zustand (mulberry32 aus lib/simulation/rng.ts) */
export interface Rng { next(): number }

/** Zufallsquelle zum Startwert (6.5) */
export function createRng(seed: number): Rng {
  let state = seed | 0
  return {
    next() {
      const [value, next] = nextRandom(state)
      state = next
      return value
    },
  }
}

/** Fisher-Yates-Mischung mit der Zufallsquelle; das Original bleibt unverändert (6.5) */
export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const out = items.slice()
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1))
    const tmp = out[i]
    out[i] = out[j]
    out[j] = tmp
  }
  return out
}

type Exposures = ReadonlyMap<string, Exposure>
type States = ReadonlyMap<string, LeitnerState>

const TYPE_LABEL: Record<QuestionType, string> = { mc: "MC", offen: "offen" }

function tooSmall(competence: CompetenceId, type: QuestionType | null): IpmaError {
  const what = type ? ` (${TYPE_LABEL[type]})` : ""
  return new IpmaError(422, "POOL_TOO_SMALL", `Zu wenige Fragen für ${competence}${what}.`, { competence, type })
}

/** Nur geprüfte Fragen, feste Grundordnung nach ID (6.5) */
function eligiblePool(pool: readonly PoolQuestion[]): PoolQuestion[] {
  return pool.filter((q) => q.status === "geprueft").sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
}

function candidates(eligible: readonly PoolQuestion[], competence: CompetenceId, type: QuestionType | null): PoolQuestion[] {
  return eligible.filter((q) => q.kompetenz === competence && (type === null || q.typ === type))
}

const seen = (exposure: Exposures, id: string) => exposure.get(id)?.seenCount ?? 0
const lastSeen = (exposure: Exposures, id: string) => exposure.get(id)?.lastSeenAt ?? 0

/** Sortiert nach (Kategorie, Zeit, Zufallsrang, ID); der Zufallsrang wird in ID-Ordnung gezogen. */
function rankBy(
  cands: readonly PoolQuestion[],
  rng: Rng,
  key: (q: PoolQuestion) => [number, number],
): PoolQuestion[] {
  const rows = cands.map((q) => ({ q, k: key(q), r: rng.next() }))
  rows.sort((a, b) => a.k[0] - b.k[0] || a.k[1] - b.k[1] || a.r - b.r || (a.q.id < b.q.id ? -1 : 1))
  return rows.map((row) => row.q)
}

/** Prüfungen (6.5): nie gesehene zuerst, dann am längsten nicht gesehene */
function rankForExam(cands: readonly PoolQuestion[], rng: Rng, exposure: Exposures): PoolQuestion[] {
  return rankBy(cands, rng, (q) => [seen(exposure, q.id), lastSeen(exposure, q.id)])
}

/** Training (3.4): nie gesehen, dann fällig (früheste zuerst), dann am längsten nicht gesehen */
function rankForTraining(cands: readonly PoolQuestion[], rng: Rng, exposure: Exposures, states: States, now: number): PoolQuestion[] {
  return rankBy(cands, rng, (q) => {
    if (seen(exposure, q.id) === 0) return [0, 0]
    const st = states.get(q.id)
    if (isDue(st, now)) return [1, st?.dueAt ?? 0]
    return [2, lastSeen(exposure, q.id)]
  })
}

/** Lücken schliessen (3.5): fällig (früheste zuerst), dann neu, dann am längsten nicht gesehen */
function rankForGaps(cands: readonly PoolQuestion[], rng: Rng, exposure: Exposures, states: States, now: number): PoolQuestion[] {
  return rankBy(cands, rng, (q) => {
    const st = states.get(q.id)
    if (isDue(st, now)) return [0, st?.dueAt ?? 0]
    if (seen(exposure, q.id) === 0) return [1, 0]
    return [2, lastSeen(exposure, q.id)]
  })
}

/** Nimmt der Reihe nach bis `count`, überspringt Fragen einer schon verwendeten Gruppe (2.2 «gruppe») */
function takeWithGroups(ranked: readonly PoolQuestion[], count: number, usedGroups: Set<string>): PoolQuestion[] {
  const out: PoolQuestion[] = []
  for (const q of ranked) {
    if (out.length >= count) break
    if (q.gruppe && usedGroups.has(q.gruppe)) continue
    if (q.gruppe) usedGroups.add(q.gruppe)
    out.push(q)
  }
  return out
}

/** Positionen und Reihenfolge der Optionen (6.5): «blocks» = MC zuerst, dann offen; «mixed» = alles gemischt */
function finalize(chosen: readonly PoolQuestion[], rng: Rng, layout: "blocks" | "mixed"): SelectedItem[] {
  const ordered = layout === "blocks"
    ? [...shuffle(chosen.filter((q) => q.typ === "mc"), rng), ...shuffle(chosen.filter((q) => q.typ === "offen"), rng)]
    : shuffle(chosen, rng)
  return ordered.map((q, i) => ({
    position: i + 1,
    questionId: q.id,
    questionVersion: q.version,
    type: q.typ,
    competence: q.kompetenz,
    optionOrder: q.typ === "mc" ? (q.optionenFest ? [0, 1, 2, 3] : shuffle([0, 1, 2, 3], rng)) : [],
  }))
}

/**
 * Kompetenzen für die Zusatzfragen der Übungsprüfung (3.2). Abweichung zu 6.5 (dort Fisher-Yates):
 * bevorzugt werden Kompetenzen mit den meisten nie gesehenen, dann den meisten verfügbaren Fragen dieses Typs;
 * Gleichstand per Zufall. So wiederholt die zweite Prüfung nur, was der Pool erzwingt, und eine Kompetenz mit
 * zu wenigen Fragen bekommt keine Zusatzfrage.
 */
function pickExtras(
  eligible: readonly PoolQuestion[],
  area: AreaId,
  type: QuestionType,
  count: number,
  rng: Rng,
  exposure: Exposures,
): CompetenceId[] {
  const comps = COMPETENCE_IDS.filter((id) => getCompetence(id).area === area)
  if (count < 0 || count > comps.length) throw new Error(`Zusatzfragen ${type}: ${count} passt nicht zu ${comps.length} Kompetenzen`)
  const rows = comps.map((id) => {
    const cands = candidates(eligible, id, type)
    return { id, unseen: cands.filter((q) => seen(exposure, q.id) === 0).length, avail: cands.length, r: rng.next() }
  })
  rows.sort((a, b) => b.unseen - a.unseen || b.avail - a.avail || a.r - b.r)
  return rows.slice(0, count).map((row) => row.id)
}

/**
 * Übungsprüfung (3.2, 6.5): je Kompetenz perCompetence (2 MC + 1 offen), dazu die Zusatzfragen aus extraArea
 * (4 MC + 2 offen); Positionen 1–60 MC, 61–90 offen, je Block gemischt.
 * Wirft IpmaError 422 POOL_TOO_SMALL, wenn eine Kompetenz zu wenige geprüfte Fragen hat.
 */
export function selectExam(
  pool: readonly PoolQuestion[],
  seed: number,
  exposure: Exposures,
  cfg: ExamConfig = EXAM_CONFIG,
): SelectedItem[] {
  const rng = createRng(seed)
  const eligible = eligiblePool(pool)
  const types: QuestionType[] = ["mc", "offen"]
  const quota = new Map<CompetenceId, Record<QuestionType, number>>(
    COMPETENCE_IDS.map((id) => [id, { mc: cfg.exam.perCompetence.mc, offen: cfg.exam.perCompetence.offen }]),
  )
  for (const t of types) {
    const extra = cfg.exam[t] - COMPETENCE_IDS.length * cfg.exam.perCompetence[t]
    for (const id of pickExtras(eligible, cfg.exam.extraArea, t, extra, rng, exposure)) {
      const q = quota.get(id)
      if (q) q[t] += 1
    }
  }
  const chosen: PoolQuestion[] = []
  const usedGroups = new Set<string>()
  for (const id of COMPETENCE_IDS) {
    for (const t of types) {
      const need = quota.get(id)?.[t] ?? 0
      const ranked = rankForExam(candidates(eligible, id, t), rng, exposure)
      const picked = takeWithGroups(ranked, need, usedGroups)
      if (picked.length < need) throw tooSmall(id, t)
      chosen.push(...picked)
    }
  }
  return finalize(chosen, rng, "blocks")
}

/** Verteilt `total` anteilig auf die Bereiche (grösster Rest, Gleichstand in Bereichsreihenfolge) */
function apportion(total: number, weights: Record<AreaId, number>): Record<AreaId, number> {
  const sumW = AREA_IDS.reduce((s, a) => s + weights[a], 0)
  const exact = AREA_IDS.map((a) => ({ a, v: (total * weights[a]) / sumW }))
  const out = { perspective: 0, people: 0, practice: 0 } as Record<AreaId, number>
  for (const e of exact) out[e.a] = Math.floor(e.v)
  let rest = total - AREA_IDS.reduce((s, a) => s + out[a], 0)
  const byRemainder = exact.slice().sort((x, y) => (y.v - Math.floor(y.v)) - (x.v - Math.floor(x.v)))
  for (const e of byRemainder) {
    if (rest <= 0) break
    out[e.a] += 1
    rest -= 1
  }
  return out
}

/**
 * Kurzprüfung (3.3, 6.5): 20 verschiedene Kompetenzen nach perArea, je Bereich zuerst «noch nicht geübt»,
 * dann tiefste Beherrschung, Gleichstand per Zufall; je Kompetenz eine Frage, davon `short.offen` offen
 * (anteilig je Bereich, per Zufall; nur Kompetenzen mit offener Frage). Reihenfolge wie die Prüfung.
 */
export function selectShort(
  pool: readonly PoolQuestion[],
  seed: number,
  exposure: Exposures,
  masteryMap: ReadonlyMap<CompetenceId, Mastery>,
  cfg: ExamConfig = EXAM_CONFIG,
): SelectedItem[] {
  const rng = createRng(seed)
  const eligible = eligiblePool(pool)
  const openPerArea = apportion(cfg.short.offen, cfg.short.perArea)
  const typeOf = new Map<CompetenceId, QuestionType>()
  for (const area of AREA_IDS) {
    const rows = COMPETENCE_IDS.filter((id) => getCompetence(id).area === area).map((id) => {
      const m = masteryMap.get(id)
      return { id, untrained: !m || m.level === "untrained", value: m?.value ?? 0, r: rng.next() }
    })
    rows.sort((a, b) =>
      Number(b.untrained) - Number(a.untrained) || (a.untrained ? 0 : a.value - b.value) || a.r - b.r)
    const picked = rows.slice(0, cfg.short.perArea[area]).map((row) => row.id)
    const hasOpen = (id: CompetenceId) => candidates(eligible, id, "offen").length > 0
    const forOpen = shuffle(picked, rng).sort((a, b) => Number(hasOpen(b)) - Number(hasOpen(a)))
    forOpen.forEach((id, i) => typeOf.set(id, i < openPerArea[area] ? "offen" : "mc"))
  }
  const chosen: PoolQuestion[] = []
  const usedGroups = new Set<string>()
  for (const id of COMPETENCE_IDS) {
    const t = typeOf.get(id)
    if (!t) continue
    const picked = takeWithGroups(rankForExam(candidates(eligible, id, t), rng, exposure), 1, usedGroups)
    if (picked.length < 1) throw tooSmall(id, t)
    chosen.push(...picked)
  }
  return finalize(chosen, rng, "blocks")
}

export interface TrainingOptions {
  competences: readonly CompetenceId[]
  type: QuestionType | "beide"
  count: number
  now: number // für «fällig» (ms seit 1970)
}

/**
 * Training (3.4, 6.5): nur gewählte Kompetenzen und Typ; je Kompetenz zuerst nie gesehen, dann fällig, dann
 * am längsten nicht gesehen; gleichmässig im Reigen über die Kompetenzen; Reihenfolge gemischt.
 * Hat der Pool weniger passende Fragen als `count`, kommen alle vorhandenen (ohne Fehler); keine → POOL_TOO_SMALL.
 */
export function selectTraining(
  pool: readonly PoolQuestion[],
  seed: number,
  exposure: Exposures,
  states: States,
  opts: TrainingOptions,
): SelectedItem[] {
  const rng = createRng(seed)
  const eligible = eligiblePool(pool)
  const comps = COMPETENCE_IDS.filter((id) => opts.competences.includes(id))
  const type = opts.type === "beide" ? null : opts.type
  const queues = comps.map((id) => ({ id, list: rankForTraining(candidates(eligible, id, type), rng, exposure, states, opts.now), next: 0 }))
  const round = shuffle(queues, rng)
  const chosen: PoolQuestion[] = []
  const usedGroups = new Set<string>()
  let progress = true
  while (chosen.length < opts.count && progress) {
    progress = false
    for (const queue of round) {
      if (chosen.length >= opts.count) break
      while (queue.next < queue.list.length) {
        const q = queue.list[queue.next++]
        if (q.gruppe && usedGroups.has(q.gruppe)) continue
        if (q.gruppe) usedGroups.add(q.gruppe)
        chosen.push(q)
        progress = true
        break
      }
    }
  }
  if (!chosen.length) throw tooSmall(comps[0] ?? COMPETENCE_IDS[0], type)
  return finalize(chosen, rng, "mixed")
}

/**
 * Lücken schliessen (3.5, 6.5): je gewählter Kompetenz (aus weakestCompetences) perCompetence Fragen, zuerst
 * fällige, dann neue, dann am längsten nicht gesehene; mindestens eine offene, wenn vorhanden. Reihenfolge gemischt.
 */
export function selectGaps(
  pool: readonly PoolQuestion[],
  seed: number,
  exposure: Exposures,
  states: States,
  competences: readonly CompetenceId[],
  now: number,
  cfg: ExamConfig = EXAM_CONFIG,
): SelectedItem[] {
  const rng = createRng(seed)
  const eligible = eligiblePool(pool)
  const chosen: PoolQuestion[] = []
  const usedGroups = new Set<string>()
  for (const id of competences) {
    const ranked = rankForGaps(candidates(eligible, id, null), rng, exposure, states, now)
    const picked = takeWithGroups(ranked, cfg.gaps.perCompetence, usedGroups)
    if (picked.length && !picked.some((q) => q.typ === "offen")) {
      const open = ranked.find((q) => q.typ === "offen" && !picked.includes(q) && !(q.gruppe && usedGroups.has(q.gruppe)))
      if (open) {
        if (picked.length >= cfg.gaps.perCompetence) {
          const dropped = picked.pop()
          if (dropped?.gruppe) usedGroups.delete(dropped.gruppe)
        }
        if (open.gruppe) usedGroups.add(open.gruppe)
        picked.push(open)
      }
    }
    chosen.push(...picked)
  }
  if (!chosen.length) throw tooSmall(competences[0] ?? COMPETENCE_IDS[0], null)
  return finalize(chosen, rng, "mixed")
}
