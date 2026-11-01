// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// tests/helpers/simulation-bots.ts
// Strategie-Roboter «gut», «naiv», «schlecht» für die Abstimmung (Spezifikation 5.4, AP5).
// Nur für Tests, nicht im Produktivcode. Jeder Roboter liefert Endzustand und Aktionsprotokoll,
// damit die Tests auch replay und Determinismus prüfen können.

import {
  applyAction,
  computeKpis,
  computeSchedule,
  createRun,
  fitFor,
  loadScenario,
  SimError,
  type Action,
  type Scenario,
  type SimState,
  type StatusReportInput,
} from "@/lib/simulation"

export type BotName = "gut" | "naiv" | "schlecht"

export interface BotRun {
  state: SimState
  actions: Action[]
}

/** Musterbesetzung (Anhang 8.2, abgestimmt in AP5): Zuweisungen je Person in Prioritätsreihenfolge */
export const MUSTERBESETZUNG: Readonly<Record<string, readonly string[]>> = {
  P01: ["V01", "V02", "V04", "V09", "V10", "V12", "V15", "V17", "V18"],
  P02: ["V01", "V05", "V06", "V07", "V11", "V16", "V18"],
  P03: ["V01", "V02", "V04", "V08", "V12", "V13", "V15", "V17", "V18"],
  P04: ["V02", "V07", "V12", "V13"],
  P05: ["V10", "V12", "V15"],
  P06: ["V01", "V14", "V13", "V15", "V18"],
  P07: ["V04", "V09", "V11", "V16"],
  P08: ["V07", "V06"],
  P09: ["V03", "V09", "V10", "V05", "V11", "V17", "V18"],
  P10: ["V05", "V11", "V16"],
  P11: ["V04", "V14", "V17"],
  P12: ["V08", "V16"],
}

/** Ramon (P13, nur über E08): gezielt auf Vorgänge mit Entwicklungs- und Datenanteil */
const RAMON: readonly string[] = ["V06", "V07", "V08"]

const MAX_OPEN = 6
const MAX_STEPS = 6000

export function wolkenried(): Scenario {
  const s = loadScenario("wolkenried")
  if (!s) throw new Error("Szenario wolkenried fehlt")
  return s
}

class Runner {
  state: SimState
  readonly actions: Action[] = []
  constructor(readonly scenario: Scenario, seed: number) {
    this.state = createRun(scenario, seed)
  }
  act(a: Action): void {
    this.state = applyAction(this.state, a, this.scenario)
    this.actions.push(a)
  }
  /** Aktion versuchen; SimError (z. B. Kalender voll) wird geschluckt */
  tryAct(a: Action): boolean {
    try {
      this.act(a)
      return true
    } catch (error) {
      if (error instanceof SimError) return false
      throw error
    }
  }
  openAssignments(personId: string): number {
    return this.state.people[personId].assignments.filter((a) => this.state.tasks[a.taskId].status !== "fertig").length
  }
  /** Prioritätenlisten nachtragen, sobald Platz frei ist (8.2: höchstens 6 gleichzeitig) */
  fill(plan: Readonly<Record<string, readonly string[]>>): void {
    for (const pid of Object.keys(plan).sort()) {
      const person = this.state.people[pid]
      if (!person || !person.available) continue
      for (const taskId of plan[pid]) {
        if (this.state.tasks[taskId].status === "fertig") continue
        if (person.assignments.some((a) => a.taskId === taskId)) continue
        if (this.openAssignments(pid) >= MAX_OPEN) break
        this.act({ type: "assign", personId: pid, taskId })
      }
    }
  }
  /**
   * Vor «Planung abschliessen» (3.2): Vorgänge ohne Zuweisung, weil die geplante Person schon 6 offene hat,
   * bekommen die passendste (worst: unpassendste) Person mit freiem Platz.
   */
  cover(worst = false): void {
    const s = this.state
    for (const task of [...this.scenario.tasks].sort((a, b) => (a.id < b.id ? -1 : 1))) {
      if (s.tasks[task.id].status === "fertig") continue
      if (s.period === 0 && task.phase !== "R") continue
      if (Object.values(this.state.people).some((p) => p.assignments.some((a) => a.taskId === task.id))) continue
      const candidates = Object.keys(this.state.people)
        .filter((pid) => this.state.people[pid].available && this.openAssignments(pid) < MAX_OPEN)
        .map((pid) => ({ pid, fit: fitFor(this.state, this.scenario, pid, task.id) }))
        .sort((a, b) => (worst ? a.fit - b.fit : b.fit - a.fit) || (a.pid < b.pid ? -1 : 1))
      if (candidates[0]) this.act({ type: "assign", personId: candidates[0].pid, taskId: task.id })
    }
  }
}

function firstOption(scenario: Scenario, eventId: string, rating: "gut" | "schlecht" | null): Action {
  const def = scenario.events.find((e) => e.id === eventId)
  if (!def) throw new Error(`Ereignis ${eventId} fehlt`)
  if (def.options.length === 1) return { type: "acknowledge", eventId }
  const option = (rating ? def.options.find((o) => o.rating === rating) : undefined) ?? def.options[0]
  return { type: "decide", eventId, optionId: option.id }
}

/** Ehrlicher Bericht (5.4 «gut»): Wahrheit übernehmen, passende Massnahmen, Nachtrag = max(0, EAC − Budget) auf 1'000 */
export function honestReport(state: SimState, scenario: Scenario): StatusReportInput {
  const k = computeKpis(state, scenario)
  const areas = (["termine", "kosten", "qualitaet", "team", "risiken"] as const).filter((a) => k.ampeln[a] !== "gruen")
  const measures = scenario.reportMeasures.filter((m) => m.areas.some((a) => areas.includes(a))).map((m) => m.id)
  const supplement = Math.max(0, Math.ceil((k.eac - k.budget) / 1000) * 1000)
  return {
    ampeln: { ...k.ampeln },
    progressPercent: Math.round((k.ev / Math.max(1, k.bac)) * 100),
    forecastEndDay: Math.min(60, Math.max(1, Math.ceil(k.forecastEndDay))),
    forecastCostChf: Math.min(1_000_000, Math.ceil(k.eac)),
    deviations: areas.length > 0 ? "Abweichungen in " + areas.join(", ") + " mit Massnahmen." : "",
    measures,
    measuresText: "",
    budgetSupplementChf: Math.min(100_000, supplement),
    changeRequestIds: [],
  }
}

/** Geschönter Bericht (5.4 «naiv», «schlecht»): alles Grün, Prognosen = Plan */
export function greenReport(state: SimState, scenario: Scenario): StatusReportInput {
  const bac = scenario.tasks.reduce((s, t) => s + t.effortHours * t.plannedRate, 0)
  return {
    ampeln: { gesamt: "gruen", termine: "gruen", kosten: "gruen", qualitaet: "gruen", team: "gruen", risiken: "gruen" },
    progressPercent: Math.min(100, Math.round((state.tick / 2 / scenario.calendar.planEndDay) * 100)),
    forecastEndDay: scenario.calendar.planEndDay,
    forecastCostChf: bac,
    deviations: "",
    measures: [],
    measuresText: "",
    budgetSupplementChf: 0,
    changeRequestIds: [],
  }
}

// ---------- Roboter «gut» ----------

function takeRiskMeasures(r: Runner): void {
  const ctxRisks = r.scenario.risks
  for (const def of [...ctxRisks].sort((a, b) => (a.id < b.id ? -1 : 1))) {
    const risk = r.state.risks[def.id]
    if (!risk.visible || risk.status !== "offen") continue
    if (risk.probability * risk.impact < 9) continue
    for (const m of def.measures) {
      if (!risk.measuresTaken.includes(m.id)) r.tryAct({ type: "riskMeasure", riskId: def.id, measureId: m.id })
    }
  }
}

/**
 * Roboter «gut» (5.4): Musterbesetzung 8.2 (Ramon nach E08 A auf V06, V07, V08), Reviews 2 auf V05, V09
 * und 1 auf den übrigen R-Vorgängen, Risikomassnahmen ab Wert 9, Register jeden Montag, Ereignisse mit
 * der ersten Option «gut», Gespräche bei m < 85, Überstufe 1 auf dem kritischen Pfad bei Prognose > 38
 * (höchstens 5 Tage am Stück, nicht für Personen mit tiefer Überstunden-Toleranz), ehrliche Berichte.
 */
export function playGut(seed: number, scenario: Scenario = wolkenried(), staffing: Readonly<Record<string, readonly string[]>> = MUSTERBESETZUNG): BotRun {
  const r = new Runner(scenario, seed)
  const critical = new Set(computeSchedule(scenario).filter((row) => row.critical).map((row) => row.taskId))
  const tolerance = Object.fromEntries(scenario.people.map((p) => [p.id, p.overtimeTolerance]))
  const plan: Record<string, readonly string[]> = { P13: RAMON, ...staffing }

  r.fill(plan)
  // Reviews: 2 auf V05, V09, 1 auf allen übrigen R-Vorgängen
  for (const t of scenario.tasks) {
    if (t.phase !== "R") continue
    r.act({ type: "setReviews", taskId: t.id, count: t.id === "V05" || t.id === "V09" ? 2 : 1 })
  }
  takeRiskMeasures(r)
  r.act({ type: "riskReview" })
  r.act({ type: "startPeriod" })

  let lastReviewWeek = 0
  let lastDay = -1
  for (let guard = 0; guard < MAX_STEPS && r.state.phase !== "abgeschlossen"; guard++) {
    const s = r.state
    const open = s.inbox.find((i) => i.status === "neu")
    if (open) {
      r.act(firstOption(scenario, open.eventId, "gut"))
      continue
    }
    if (s.phase === "planung") {
      r.fill(plan)
      r.cover()
      r.act({ type: "startPeriod" })
      continue
    }
    if (s.phase !== "lauf") {
      r.act({ type: "submitReport", report: honestReport(s, scenario) })
      continue
    }
    const day = Math.floor(s.tick / 2)
    if (day !== lastDay && s.tick % 2 === 0) {
      lastDay = day
      // Register jeden Montag prüfen, neue Risiken mit Wert ≥ 9 behandeln
      const week = Math.floor(day / 5) + 1
      if (day % 5 === 0 && week !== lastReviewWeek) {
        lastReviewWeek = week
        takeRiskMeasures(r)
        r.act({ type: "riskReview" })
      }
      // Gespräch mit jeder Person mit m < 85, höchstens 4 je Tag (Kalender)
      const low = Object.keys(s.people)
        .filter((pid) => r.state.people[pid].available && r.state.people[pid].motivation < 85)
        .sort((a, b) => r.state.people[a].motivation - r.state.people[b].motivation)
      for (const pid of low.slice(0, 4)) if (!r.tryAct({ type: "talk", personId: pid })) break
      // Überstufe 1 auf dem kritischen Pfad, wenn Prognose > 38, höchstens 5 Tage am Stück;
      // Personen mit tiefer Überstunden-Toleranz bleiben ohne Überstunden
      const forecast = computeKpis(r.state, scenario).forecastEndDay
      for (const pid of Object.keys(r.state.people).sort()) {
        const person = r.state.people[pid]
        if (!person.available) continue
        const onCritical = person.assignments.some((a) => critical.has(a.taskId) && r.state.tasks[a.taskId].status === "laufend")
        const want = forecast > 38 && onCritical && tolerance[pid] !== "tief" && person.overtimeStreakDays < 5 ? 1 : 0
        if (person.overtime !== want) r.act({ type: "setOvertime", personId: pid, level: want })
      }
    }
    r.act({ type: "advance", ticks: 1 })
    if (r.state.phase === "lauf" || r.state.phase === "planung") r.fill(plan)
  }
  return { state: r.state, actions: r.actions }
}

// ---------- Roboter «naiv» ----------

/**
 * Besetzung des Roboters «naiv» (5.4, abgestimmt in AP5): je Vorgang nach bester Einzelpassung so viele
 * Personen, bis ihre Pensen zusammen die geplante Personenzahl erreichen; wer im Basisplan schon einen
 * zeitgleichen Vorgang hat, kommt erst danach in Frage. Kritischer Pfad, Prioritäten, Reviews und
 * Risiken bleiben unbeachtet. worst («schlecht»): je Vorgang 1 Person mit der tiefsten Passung.
 * Höchstens 6 Vorgänge je Person und Phase; Phase E wird nach Abschluss der R-Vorgänge nachgetragen (3.2).
 */
export function naivePlan(scenario: Scenario, state: SimState, worst = false): Record<string, string[]> {
  const plan: Record<string, string[]> = {}
  const rows = Object.fromEntries(computeSchedule(scenario).map((row) => [row.taskId, row]))
  const phaseOf = Object.fromEntries(scenario.tasks.map((t) => [t.id, t.phase]))
  const pensum = Object.fromEntries(scenario.people.map((p) => [p.id, p.pensum]))
  const full = (pid: string, phase: string) => (plan[pid] ?? []).filter((id) => phaseOf[id] === phase).length >= MAX_OPEN
  const overlaps = (pid: string, taskId: string) =>
    (plan[pid] ?? []).some((other) => rows[other].es < rows[taskId].ef - 1e-9 && rows[taskId].es < rows[other].ef - 1e-9)
  const people = scenario.people.filter((p) => state.people[p.id].available).map((p) => p.id).sort()
  for (const task of [...scenario.tasks].sort((a, b) => (a.id < b.id ? -1 : 1))) {
    const ranked = people
      .filter((pid) => !full(pid, task.phase))
      .map((pid) => ({ pid, fit: fitFor(state, scenario, pid, task.id) }))
      .sort((a, b) => (worst ? a.fit - b.fit : b.fit - a.fit) || (a.pid < b.pid ? -1 : 1))
    if (worst) {
      if (ranked[0]) (plan[ranked[0].pid] ??= []).push(task.id)
      continue
    }
    const free = ranked.filter((x) => !overlaps(x.pid, task.id))
    const order = [...free, ...ranked.filter((x) => !free.includes(x))]
    let fte = 0
    for (const { pid } of order) {
      if (fte >= task.plannedPersons - 1e-9) break
      ;(plan[pid] ??= []).push(task.id)
      fte += pensum[pid]
    }
  }
  return plan
}

export function playNaiv(seed: number, scenario: Scenario = wolkenried()): BotRun {
  const r = new Runner(scenario, seed)
  const plan = naivePlan(scenario, r.state)
  r.fill(plan)
  r.act({ type: "startPeriod" })
  for (let guard = 0; guard < MAX_STEPS && r.state.phase !== "abgeschlossen"; guard++) {
    const s = r.state
    const open = s.inbox.find((i) => i.status === "neu")
    if (open) r.act(firstOption(scenario, open.eventId, null))
    else if (s.phase === "lauf") {
      r.act({ type: "advance", ticks: 1 })
      if (r.state.phase === "lauf") r.fill(plan)
    } else if (s.phase === "planung") {
      r.fill(plan)
      r.cover()
      r.act({ type: "startPeriod" })
    } else r.act({ type: "submitReport", report: greenReport(s, scenario) })
  }
  return { state: r.state, actions: r.actions }
}

// ---------- Roboter «schlecht» ----------

export function playSchlecht(seed: number, scenario: Scenario = wolkenried()): BotRun {
  const r = new Runner(scenario, seed)
  const plan = naivePlan(scenario, r.state, true)
  r.fill(plan)
  for (const pid of Object.keys(r.state.people).sort()) {
    if (r.state.people[pid].available) r.act({ type: "setOvertime", personId: pid, level: 2 })
  }
  r.act({ type: "startPeriod" })
  for (let guard = 0; guard < MAX_STEPS && r.state.phase !== "abgeschlossen"; guard++) {
    const s = r.state
    const open = s.inbox.find((i) => i.status === "neu")
    if (open) {
      // Immer aufschieben; wo das nicht geht, die erste schlechte Option (nimmt Umfangserweiterungen an)
      if (open.deadlineTick !== null) r.act({ type: "defer", eventId: open.eventId })
      else r.act(firstOption(scenario, open.eventId, "schlecht"))
    } else if (s.phase === "lauf") {
      r.act({ type: "advance", ticks: 1 })
      if (r.state.phase === "lauf") r.fill(plan)
    } else if (s.phase === "planung") {
      r.fill(plan)
      r.cover(true)
      r.act({ type: "startPeriod" })
    } else r.act({ type: "submitReport", report: greenReport(s, scenario) })
  }
  return { state: r.state, actions: r.actions }
}

export function playBot(name: BotName, seed: number, scenario: Scenario = wolkenried()): BotRun {
  if (name === "gut") return playGut(seed, scenario)
  if (name === "naiv") return playNaiv(seed, scenario)
  return playSchlecht(seed, scenario)
}

// ---------- Einführungslauf «Hundeanmeldung online» (2.10, AP6) ----------

export function einfuehrung(): Scenario {
  const s = loadScenario("einfuehrung")
  if (!s) throw new Error("Szenario einfuehrung fehlt")
  return s
}

/**
 * Gute Besetzung des Einführungslaufs (2.10): alle vier am Auftakt H1, danach die drei parallelen
 * Vorgänge so verteilt, dass niemand leer läuft (Aylin und Nadia auf H2, Luca auf H4 und H3,
 * Jasmin auf H3), zum Schluss Test H5 und Aufschalten H6 mit den passenden Profilen.
 */
export const INTRO_BESETZUNG: Readonly<Record<string, readonly string[]>> = {
  P02: ["H1", "H4", "H3", "H5", "H6"],
  P03: ["H1", "H2", "H5", "H6"],
  P06: ["H1", "H2", "H6"],
  P07: ["H1", "H3", "H5", "H6"],
}

/**
 * Roboter «gut» für den Einführungslauf: gute Besetzung, 1 Review je Vorgang, Risikomassnahme
 * «Testexport», Register wöchentlich geprüft, Ereignisse mit der Option «gut», ehrlicher Abschlussbericht.
 */
export function playIntroGut(seed: number, scenario: Scenario = einfuehrung(), staffing: Readonly<Record<string, readonly string[]>> = INTRO_BESETZUNG): BotRun {
  const r = new Runner(scenario, seed)
  r.fill(staffing)
  for (const t of scenario.tasks) r.act({ type: "setReviews", taskId: t.id, count: 1 })
  for (const def of scenario.risks) {
    for (const m of def.measures) r.tryAct({ type: "riskMeasure", riskId: def.id, measureId: m.id })
  }
  r.act({ type: "riskReview" })
  r.act({ type: "startPeriod" })
  let lastWeek = 1
  for (let guard = 0; guard < MAX_STEPS && r.state.phase !== "abgeschlossen"; guard++) {
    const s = r.state
    const open = s.inbox.find((i) => i.status === "neu")
    if (open) r.act(firstOption(scenario, open.eventId, "gut"))
    else if (s.phase === "lauf") {
      const week = Math.floor(Math.floor(s.tick / 2) / 5) + 1
      if (week !== lastWeek && s.tick % 2 === 0) {
        lastWeek = week
        r.act({ type: "riskReview" })
      }
      r.act({ type: "advance", ticks: 1 })
    } else r.act({ type: "submitReport", report: honestReport(s, scenario) })
  }
  return { state: r.state, actions: r.actions }
}

/**
 * Besetzung einer Anfängerin ohne Planung (5.4 «naiv» wörtlich): je Vorgang die geplante Anzahl Personen
 * nach bester Einzelpassung, ohne Pensum, Überschneidungen und Folgeaufgaben zu beachten.
 */
export function introNaivePlan(scenario: Scenario, state: SimState): Record<string, string[]> {
  const plan: Record<string, string[]> = {}
  const people = scenario.people.filter((p) => state.people[p.id].available).map((p) => p.id).sort()
  for (const task of [...scenario.tasks].sort((a, b) => (a.id < b.id ? -1 : 1))) {
    const ranked = people
      .filter((pid) => (plan[pid] ?? []).length < MAX_OPEN)
      .map((pid) => ({ pid, fit: fitFor(state, scenario, pid, task.id) }))
      .sort((a, b) => b.fit - a.fit || (a.pid < b.pid ? -1 : 1))
    for (const { pid } of ranked.slice(0, task.plannedPersons)) (plan[pid] ??= []).push(task.id)
  }
  return plan
}

/**
 * Roboter «naiv» für den Einführungslauf: Besetzung ohne Planung (introNaivePlan), keine Reviews,
 * keine Massnahmen, Register nie geprüft, Ereignisse Option A, geschönter Abschlussbericht.
 */
export function playIntroNaiv(seed: number, scenario: Scenario = einfuehrung()): BotRun {
  const r = new Runner(scenario, seed)
  r.fill(introNaivePlan(scenario, r.state))
  r.act({ type: "startPeriod" })
  for (let guard = 0; guard < MAX_STEPS && r.state.phase !== "abgeschlossen"; guard++) {
    const s = r.state
    const open = s.inbox.find((i) => i.status === "neu")
    if (open) r.act(firstOption(scenario, open.eventId, null))
    else if (s.phase === "lauf") r.act({ type: "advance", ticks: 1 })
    else r.act({ type: "submitReport", report: greenReport(s, scenario) })
  }
  return { state: r.state, actions: r.actions }
}
