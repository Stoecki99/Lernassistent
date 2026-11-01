// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// lib/simulation/engine.ts
// Rechenkern: createRun, applyAction, advance, replay, stepTick (Spezifikation 3.1, 3.2, 3.12, 4.3).
// Reine Funktionen: applyAction arbeitet auf einer Kopie und wirft bei ungültigen Aktionen SimError.

import { actionSchema } from "../validations/simulation"
import { dayOf, formatTick, halfOf, weekdayOf, weekIndexOf } from "./calendar"
import { clamp, getCtx, type Ctx } from "./context"
import { SimError } from "./errors"
import { acknowledge, applyEffects, applyScheduled, checkEvents, decide, defer, hasPendingNew } from "./events"
import { computeKpis, toKpiPoint } from "./kpi"
import { ENGINE_VERSION } from "./params"
import { restmaengel, runReviews, runTest } from "./quality"
import { assessHonesty, boardDecision, changeRequestAvailable, reportTruth } from "./report"
import { clampRiskValue, initiallyVisible, markRiskReviewed, windowTicks } from "./risk"
import { baseline } from "./schedule"
import { scoreState } from "./score"
import { addCalendarEntry, clampMotivation, dayEndPeople, plAppointmentsOnDay, startTraining, talk, teamEvent, teamMotivation, updateTeamPhase } from "./team"
import {
  AREAS,
  COST_CATEGORIES,
  HOUR_CATEGORIES,
  type Action,
  type AreaId,
  type CostCategory,
  type HourCategory,
  type PersonState,
  type RunPhase,
  type Scenario,
  type SimState,
  type StatusReportInput,
  type TaskState,
} from "./types"
import { bookCost, phaseOpen, workTick } from "./work"

const MAX_ASSIGNMENTS = 6 // 3.2

// ---------- Start ----------

function zeroRecord<K extends string>(keys: readonly K[]): Record<K, number> {
  const out = {} as Record<K, number>
  for (const k of keys) out[k] = 0
  return out
}

/** Neuer Lauf (4.3): Zustand aus Szenario und Startwert, Phase «planung» */
export function createRun(scenario: Scenario, seed: number): SimState {
  if (!Number.isSafeInteger(seed)) throw new SimError("INVALID_ACTION", "Der Startwert muss eine ganze Zahl sein.")
  const ctx = getCtx(scenario)
  const tasks: Record<string, TaskState> = {}
  for (const id of ctx.taskIds) {
    const def = ctx.tasks[id]
    tasks[id] = {
      status: def.predecessors.length === 0 ? "bereit" : "offen",
      plannedEffort: def.effortHours,
      // Plankosten = Aufwand × Plansatz (2.4)
      bac: def.effortHours * def.plannedRate,
      remaining: def.effortHours,
      done: 0,
      paidHours: 0,
      hoursByPerson: {},
      startTick: null,
      endTick: null,
      blockedUntilTick: 0,
      reviews: 0,
      reviewsDone: 0,
      latentDefects: 0,
      foundEarly: 0,
      foundLate: 0,
      testDone: false,
    }
  }
  const people: Record<string, PersonState> = {}
  for (const id of ctx.personIds) {
    const def = ctx.people[id]
    people[id] = {
      available: def.hidden !== true,
      learnStart: ctx.params.learnStart,
      assignments: [],
      overtime: 0,
      overtimeStreakDays: 0,
      overtimeTotalDays: 0,
      motivation: def.startMotivation,
      profile: [...def.profile] as PersonState["profile"],
      pensumMods: [],
      absences: [],
      hoursByArea: zeroRecord(AREAS) as Record<AreaId, number>,
      idleDays: 0,
      lastTalkTick: null,
      lastLunchTick: null,
      lastTeamEveningTick: null,
      trainingDone: false,
      pendingQualifications: [],
      reassignmentsThisWeek: 0,
      appointmentHours: 0,
      dayPaidHours: 0,
      weekIdleDays: 0,
      weekOvertimeDays: 0,
      lastWorkTick: null,
    }
  }
  const risks: SimState["risks"] = {}
  for (const id of ctx.riskIds) {
    const def = ctx.risks[id]
    risks[id] = {
      probability: def.probability,
      impact: def.impact,
      visible: initiallyVisible(def),
      status: "offen",
      measuresTaken: [],
      accepted: false,
      occurredTick: null,
    }
  }
  const state: SimState = {
    engineVersion: ENGINE_VERSION,
    scenarioId: scenario.id,
    scenarioVersion: scenario.version,
    seed,
    rng: seed | 0,
    tick: 0,
    eventsCheckedTick: -1,
    phase: "planung",
    period: 0,
    pause: null,
    tasks,
    people,
    stakeholders: Object.fromEntries(ctx.stakeholderIds.map((id) => [id, ctx.stakeholders[id].startSatisfaction])),
    risks,
    inbox: [],
    scheduledEffects: [],
    calendar: [],
    finance: { ac: 0, byCategory: zeroRecord(COST_CATEGORIES) as Record<CostCategory, number>, budget: scenario.budget.total, budgetSupplements: 0 },
    hours: zeroRecord(HOUR_CATEGORIES) as Record<HourCategory, number>,
    teamPhase: "orientierung",
    teamPhaseSinceTick: 0,
    flags: {},
    changeRequests: {},
    reports: [],
    decisions: [],
    history: [],
    timeline: [],
    separations: [],
    stats: {
      defaults: 0,
      riskReviewedWeeks: [],
      burnouts: 0,
      lateDefectsFound: 0,
      earlyDefectsFound: 0,
      idleCoreDays: 0,
      minTeamMotivation: 0,
      ressourcenausgleich: { okDays: 0, allDays: 0 },
      risksTreatedEarly: [],
    },
    result: null,
  }
  state.stats.minTeamMotivation = teamMotivation(state, ctx)
  return state
}

// ---------- Prüfhilfen ----------

function requirePhase(state: SimState, phases: RunPhase[]): void {
  if (!phases.includes(state.phase)) {
    throw new SimError("WRONG_PHASE", `Diese Aktion ist in der Phase «${state.phase}» nicht möglich.`)
  }
}

function requirePerson(state: SimState, ctx: Ctx, personId: string): PersonState {
  const person = state.people[personId]
  if (!person || !ctx.people[personId]) throw new SimError("UNKNOWN_ID", `Unbekannte Person ${personId}.`)
  return person
}

function requireAvailablePerson(state: SimState, ctx: Ctx, personId: string): PersonState {
  const person = requirePerson(state, ctx, personId)
  if (!person.available) throw new SimError("NOT_ALLOWED", `${ctx.people[personId].name} gehört (noch) nicht zum Team.`)
  return person
}

function requireTask(state: SimState, ctx: Ctx, taskId: string): TaskState {
  const task = state.tasks[taskId]
  if (!task || !ctx.tasks[taskId]) throw new SimError("UNKNOWN_ID", `Unbekannter Vorgang ${taskId}.`)
  return task
}

/** Umplanung (3.7): Bedürfnis Klarheit ab der 3. Änderung derselben Woche −3 je Änderung, nur im Lauf */
function countReassignment(state: SimState, ctx: Ctx, personId: string): void {
  if (state.phase !== "lauf") return
  const person = state.people[personId]
  person.reassignmentsThisWeek++
  if (person.reassignmentsThisWeek >= 3 && ctx.people[personId].needs.includes("klarheit")) {
    person.motivation = clampMotivation(person.motivation - 3)
  }
}

function openAssignments(state: SimState, person: PersonState): number {
  return person.assignments.filter((a) => state.tasks[a.taskId]?.status !== "fertig").length
}

function requireCalendarSlot(state: SimState, ctx: Ctx): void {
  if (plAppointmentsOnDay(state, dayOf(state.tick)) >= ctx.params.calendarMaxPerDay) {
    throw new SimError("CALENDAR_FULL", `Dein Kalender ist voll: höchstens ${ctx.params.calendarMaxPerDay} Termine pro Tag.`)
  }
}

// ---------- Takt (3.1) ----------

type StepResult = "continued" | "paused" | "stopped"

function applyQualifications(state: SimState, ctx: Ctx, tick: number): void {
  for (const pid of ctx.personIds) {
    const person = state.people[pid]
    if (person.pendingQualifications.length === 0) continue
    const due = person.pendingQualifications.filter((q) => q.readyTick <= tick)
    person.pendingQualifications = person.pendingQualifications.filter((q) => q.readyTick > tick)
    for (const q of due) {
      const k = AREAS.indexOf(q.area)
      // Weiterbildung: Profil +1 im Gebiet, höchstens 6 (3.4)
      person.profile[k] = clamp(person.profile[k] + q.delta, 0, 6)
    }
  }
}

function bumpStakeholder(state: SimState, id: string, delta: number): void {
  if (state.stakeholders[id] === undefined) return
  state.stakeholders[id] = clamp(state.stakeholders[id] + delta, 0, 100)
}

/** Meilenstein (S4, 3.7): eingehalten → S01 +5 und alle Mot +3, sonst S01 −5 */
function milestoneReached(state: SimState, ctx: Ctx, taskId: string, tick: number): void {
  const def = ctx.tasks[taskId]
  if (!def.milestone) return
  const end = (tick + 1) / 2
  const isFinal = ctx.successors[taskId].length === 0
  const planned = isFinal ? ctx.scenario.calendar.targetDay : baseline(ctx.scenario)[taskId].ef
  const kept = end <= planned + 1e-9
  bumpStakeholder(state, "S01", kept ? 5 : -5)
  if (kept) {
    for (const pid of ctx.personIds) {
      const p = state.people[pid]
      if (p.available) p.motivation = clampMotivation(p.motivation + 3)
    }
  }
  state.timeline.push({
    tick,
    kind: "meilenstein",
    ref: taskId,
    text: `${def.milestone} ${kept ? "eingehalten" : "verfehlt"}: Tag ${end} (Plan ${planned})`,
    magnitude: 10,
  })
}

/** Stakeholder-Wochenregeln (3.8), Freitag Nachmittag */
function weeklyStakeholderRules(state: SimState, ctx: Ctx): void {
  const k = computeKpis(state, ctx.scenario)
  // S01 Auftraggeberin: +1 wenn SPI ≥ 0.97 und CPI ≥ 0.95; −2 wenn SPI < 0.90 oder CPI < 0.90
  if (k.spi >= 0.97 && k.cpi >= 0.95) bumpStakeholder(state, "S01", 1)
  else if (k.spi < 0.9 || k.cpi < 0.9) bumpStakeholder(state, "S01", -2)
  // S02 Präsident: −2 wenn EAC > Budget
  if (k.eac > state.finance.budget) bumpStakeholder(state, "S02", -2)
  // Linie: −2 je eigene Person mit Überstunden in dieser Woche; +1 wenn keine
  // Lieferant: +1 ohne Leerlauf; −1 bei > 2 Tagen Leerlauf
  for (const sid of ctx.stakeholderIds) {
    const line = ctx.personIds.filter((pid) => ctx.people[pid].lineManager === sid && ctx.people[pid].origin === "linie")
    if (line.length > 0) {
      const withOt = line.filter((pid) => state.people[pid].weekOvertimeDays > 0).length
      bumpStakeholder(state, sid, withOt > 0 ? -2 * withOt : 1)
    }
    const supplier = ctx.personIds.filter((pid) => ctx.people[pid].lineManager === sid && ctx.people[pid].origin === "lieferant" && state.people[pid].available)
    if (supplier.length > 0) {
      const idle = supplier.reduce((s, pid) => s + state.people[pid].weekIdleDays, 0)
      if (idle === 0) bumpStakeholder(state, sid, 1)
      else if (idle > 2) bumpStakeholder(state, sid, -1)
    }
  }
}

/** Projektende (3.8): S09, S10, S11 je Restmangel über 5: −1, höchstens −10 */
function projectEnd(state: SimState): void {
  const r = restmaengel(state)
  if (r <= 5) return
  const delta = -Math.min(10, Math.floor(r - 5))
  for (const id of ["S09", "S10", "S11"]) bumpStakeholder(state, id, delta)
}

function updateStatuses(state: SimState, ctx: Ctx, tick: number): void {
  for (const id of ctx.taskIds) {
    const task = state.tasks[id]
    if (task.status === "fertig") continue
    if (task.startTick !== null) task.status = "laufend"
    else {
      const def = ctx.tasks[id]
      const predsDone = def.predecessors.every((p) => state.tasks[p].status === "fertig")
      task.status = predsDone && phaseOpen(state, ctx, def, tick) ? "bereit" : "offen"
    }
  }
}

/**
 * Ein Takt (3.1, feste Reihenfolge). Gibt es nach Schritt 2 neue Ereignisse, endet der Takt dort;
 * der nächste Aufruf fährt mit Schritt 3 fort (eventsCheckedTick).
 */
export function stepTick(state: SimState, ctx: Ctx): StepResult {
  const t = state.tick
  if (state.eventsCheckedTick < t) {
    // Schritt 1: fällige verzögerte Wirkungen
    applyScheduled(state, ctx, t)
    applyQualifications(state, ctx, t)
    state.separations = state.separations.filter((s) => s.untilTick > t)
    // Auflage des Gemeinderats: wöchentlicher Zusatzbericht (1 h im Kalender der Projektleitung, 3.11)
    if (state.flags.auflage === true && weekdayOf(t) === 0 && halfOf(t) === 0) {
      addCalendarEntry(state, { tick: t, kind: "zusatzbericht", personIds: [], hours: 1 })
    }
    // Schritt 2: Ereignisse prüfen
    const fresh = checkEvents(state, ctx, t)
    state.eventsCheckedTick = t
    if (fresh > 0 || hasPendingNew(state)) {
      state.pause = "ereignis"
      return "paused"
    }
  }

  // Schritte 3–5: Kapazität, Verteilung, Leistung
  const { hadWorkable } = workTick(state, ctx, t)

  // Schritt 6: Reviews und Tests
  for (const id of ctx.taskIds) {
    const task = state.tasks[id]
    if (task.status === "fertig") continue
    if (ctx.tasks[id].test && task.startTick !== null && !task.testDone) runTest(state, ctx, id)
    runReviews(state, ctx, id)
  }

  // Schritt 7: Abschluss (Restaufwand ≤ 0.001 und alle Reviews erledigt)
  for (const id of ctx.taskIds) {
    const task = state.tasks[id]
    if (task.status === "fertig" || task.startTick === null) continue
    if (task.remaining <= 0.001 && task.reviewsDone >= task.reviews) {
      task.status = "fertig"
      task.remaining = 0
      task.endTick = t
      // Zuweisungen auf fertige Vorgänge entfallen (Entscheid AP1, hält die Prioritätenliste A–F frei)
      for (const pid of ctx.personIds) {
        state.people[pid].assignments = state.people[pid].assignments.filter((a) => a.taskId !== id)
      }
      state.timeline.push({ tick: t, kind: "vorgang", ref: id, text: `${ctx.tasks[id].name} abgeschlossen`, magnitude: 0 })
      milestoneReached(state, ctx, id, t)
    }
  }
  updateStatuses(state, ctx, t)

  // Zeitpunkt nach dem Takt (τ = (t+1)/2) gilt ab hier für alle Kennzahlen
  state.tick = t + 1

  // Schritt 8: Tagesende
  if (halfOf(t) === 1) {
    dayEndPeople(state, ctx, t, hadWorkable)
    updateTeamPhase(state, ctx, t)
    if (weekdayOf(t) === 4) {
      weeklyStakeholderRules(state, ctx)
      if (!state.stats.riskReviewedWeeks.includes(weekIndexOf(t))) {
        state.timeline.push({ tick: t, kind: "ereignis", ref: "S6", text: `${ctx.scenario.coach.name}: Prüfe das Risikoregister.`, magnitude: 0 })
      }
      for (const pid of ctx.personIds) {
        const p = state.people[pid]
        p.reassignmentsThisWeek = 0
        p.weekIdleDays = 0
        p.weekOvertimeDays = 0
      }
    }
  }

  // Schritt 9: Kennzahlen
  const k = computeKpis(state, ctx.scenario)
  state.history.push(toKpiPoint(k, t))
  state.stats.minTeamMotivation = Math.min(state.stats.minTeamMotivation, k.teamMotivation)

  // Schritt 10: Ende prüfen
  if (ctx.taskIds.every((id) => state.tasks[id].status === "fertig")) {
    projectEnd(state)
    state.phase = "abschlussbericht"
    state.pause = "projektende"
    // Ereignisse, die am Projektende fällig werden (z. B. E38 «V18 fertig»), noch zustellen;
    // sie sind vor dem Abschlussbericht zu entscheiden (EVENT_PENDING)
    checkEvents(state, ctx, state.tick)
    state.eventsCheckedTick = state.tick
    return "stopped"
  }
  if (state.tick >= ctx.hardStopTick) {
    state.phase = "abschlussbericht"
    state.pause = "abbruch"
    state.flags.abbruch = true
    return "stopped"
  }
  const period = ctx.scenario.calendar.periods[state.period]
  if (period && period.report === "status" && t >= period.endTick) {
    state.phase = "periodenende"
    state.pause = "periodenende"
    state.timeline.push({ tick: t, kind: "bericht", ref: "S1", text: "Periodenende: Der Statusbericht ist fällig.", magnitude: 0 })
    return "stopped"
  }
  return "continued"
}

// ---------- Aktionen ----------

function startPeriod(state: SimState, ctx: Ctx): void {
  requirePhase(state, ["planung"])
  // Planung abschliessen (3.2): Periode 1 alle Vorgänge der Phase R, danach alle nicht fertigen Vorgänge besetzt
  const required = ctx.taskIds.filter((id) => {
    if (state.tasks[id].status === "fertig") return false
    return state.period === 0 ? ctx.tasks[id].phase === "R" : true
  })
  const missing = required.filter((id) => !ctx.personIds.some((pid) => state.people[pid].assignments.some((a) => a.taskId === id)))
  if (missing.length > 0) {
    throw new SimError("PLAN_INCOMPLETE", `Noch nicht besetzt: ${missing.join(", ")}.`, missing)
  }
  state.phase = "lauf"
  state.pause = null
}

function advanceTicks(state: SimState, ctx: Ctx, ticks: number): void {
  requirePhase(state, ["lauf"])
  if (hasPendingNew(state)) {
    // Blockade (3.1): solange ein Ereignis «neu» ist, läuft keine Zeit
    state.pause = "ereignis"
    return
  }
  state.pause = null
  for (let i = 0; i < ticks; i++) {
    const result = stepTick(state, ctx)
    if (result !== "continued") return
  }
}

function riskMeasure(state: SimState, ctx: Ctx, riskId: string, measureId: string): void {
  const def = ctx.risks[riskId]
  const risk = state.risks[riskId]
  if (!def || !risk) throw new SimError("UNKNOWN_ID", `Unbekanntes Risiko ${riskId}.`)
  if (!risk.visible) throw new SimError("NOT_ALLOWED", "Dieses Risiko ist noch nicht im Register.")
  if (risk.status !== "offen") throw new SimError("NOT_ALLOWED", "Dieses Risiko ist nicht mehr offen.")
  const measure = def.measures.find((m) => m.id === measureId)
  if (!measure) throw new SimError("UNKNOWN_ID", `Unbekannte Massnahme ${measureId}.`)
  if (risk.measuresTaken.includes(measureId)) throw new SimError("LIMIT", "Jede Massnahme gibt es nur einmal.")
  risk.measuresTaken.push(measureId)
  // Kosten (Kostenart risiko), Stunden bei der Person (fuehrung, ab dem nächsten Takt) oder Mehraufwand am Vorgang (2.6)
  bookCost(state, "risiko", measure.costChf)
  if (measure.effort && "personId" in measure.effort) {
    const person = requirePerson(state, ctx, measure.effort.personId)
    person.appointmentHours += measure.effort.hours
    addCalendarEntry(state, { tick: state.tick, kind: "workshop", personIds: [measure.effort.personId], hours: measure.effort.hours })
  } else if (measure.effort && "taskId" in measure.effort) {
    const task = requireTask(state, ctx, measure.effort.taskId)
    if (task.status !== "fertig") task.remaining += measure.effort.hours
  }
  if (measure.deltaProbability) risk.probability = clampRiskValue(risk.probability + measure.deltaProbability)
  if (measure.deltaImpact) risk.impact = clampRiskValue(risk.impact + measure.deltaImpact)
  if (measure.sideEffects) applyEffects(state, ctx, measure.sideEffects, { source: `${riskId}-${measureId}`, scale: 1 })
  if (state.tick < windowTicks(def).from && !state.stats.risksTreatedEarly.includes(riskId)) {
    state.stats.risksTreatedEarly.push(riskId)
    state.stats.risksTreatedEarly.sort()
  }
}

function submitReport(state: SimState, ctx: Ctx, input: StatusReportInput): void {
  requirePhase(state, ["periodenende", "abschlussbericht"])
  if (hasPendingNew(state)) throw new SimError("EVENT_PENDING", "Zuerst die neuen Ereignisse im Posteingang entscheiden.")
  for (const mid of input.measures) {
    if (!ctx.scenario.reportMeasures.some((m) => m.id === mid)) throw new SimError("UNKNOWN_ID", `Unbekannte Massnahme ${mid}.`)
  }
  const kind = state.phase === "periodenende" ? "status" : "final"
  if (kind === "status") {
    for (const crId of input.changeRequestIds) {
      if (!ctx.changeRequests[crId]) throw new SimError("UNKNOWN_ID", `Unbekannter Änderungsantrag ${crId}.`)
      if (!changeRequestAvailable(state, ctx, crId)) throw new SimError("NOT_ALLOWED", `Der Antrag ${crId} ist nicht verfügbar.`)
    }
  }
  const truth = reportTruth(computeKpis(state, ctx.scenario))
  const { honesty, findings, embellished } = assessHonesty(input, truth, ctx, state.flags)
  const record: SimState["reports"][number] = { kind, tick: state.tick, input, truth, honesty, findings }
  state.reports.push(record)
  state.timeline.push({
    tick: state.tick,
    kind: "bericht",
    ref: kind,
    text: `${kind === "status" ? "Statusbericht" : "Abschlussbericht"}: Ehrlichkeit ${Math.round(honesty)}`,
    magnitude: honesty < 70 ? 100 - honesty : honesty >= 85 ? 10 : 0,
  })
  if (kind === "status") {
    for (const crId of input.changeRequestIds) state.changeRequests[crId] = "beantragt"
    record.board = boardDecision(state, ctx, input, honesty, embellished)
    state.timeline.push({ tick: state.tick, kind: "gemeinderat", ref: "S2", text: record.board.reasons.join(" "), magnitude: 0 })
    state.phase = "planung"
    state.period += 1
    state.pause = null
  } else {
    state.phase = "abgeschlossen"
    state.pause = null
    state.result = scoreState(state, ctx.scenario)
  }
}

/** Aktion auf einem (bereits kopierten) Zustand ausführen */
function applyInPlace(state: SimState, action: Action, ctx: Ctx): void {
  switch (action.type) {
    case "assign": {
      requirePhase(state, ["planung", "lauf"])
      const person = requireAvailablePerson(state, ctx, action.personId)
      const task = requireTask(state, ctx, action.taskId)
      if (task.status === "fertig") throw new SimError("NOT_ALLOWED", "Dieser Vorgang ist schon fertig.")
      if (person.assignments.some((a) => a.taskId === action.taskId)) {
        throw new SimError("INVALID_ACTION", "Diese Person ist dem Vorgang schon zugewiesen.")
      }
      if (openAssignments(state, person) >= MAX_ASSIGNMENTS) {
        throw new SimError("LIMIT", `Höchstens ${MAX_ASSIGNMENTS} Zuweisungen je Person (Priorität A–F).`)
      }
      const position = clamp(action.position ?? person.assignments.length, 0, person.assignments.length)
      person.assignments.splice(position, 0, { taskId: action.taskId, share: action.share ?? 1 })
      countReassignment(state, ctx, action.personId)
      return
    }
    case "unassign": {
      requirePhase(state, ["planung", "lauf"])
      const person = requirePerson(state, ctx, action.personId)
      requireTask(state, ctx, action.taskId)
      const index = person.assignments.findIndex((a) => a.taskId === action.taskId)
      if (index < 0) throw new SimError("INVALID_ACTION", "Diese Zuweisung gibt es nicht.")
      person.assignments.splice(index, 1)
      countReassignment(state, ctx, action.personId)
      return
    }
    case "reorder": {
      requirePhase(state, ["planung", "lauf"])
      const person = requirePerson(state, ctx, action.personId)
      const current = person.assignments.map((a) => a.taskId).sort()
      const wanted = [...action.taskIds].sort()
      if (current.length !== wanted.length || current.some((id, i) => id !== wanted[i])) {
        throw new SimError("INVALID_ACTION", "Die neue Reihenfolge muss genau die bestehenden Zuweisungen enthalten.")
      }
      person.assignments = action.taskIds.map((id) => person.assignments.find((a) => a.taskId === id) as PersonState["assignments"][number])
      countReassignment(state, ctx, action.personId)
      return
    }
    case "setShare": {
      requirePhase(state, ["planung", "lauf"])
      const person = requirePerson(state, ctx, action.personId)
      const a = person.assignments.find((x) => x.taskId === action.taskId)
      if (!a) throw new SimError("INVALID_ACTION", "Diese Zuweisung gibt es nicht.")
      a.share = action.share
      countReassignment(state, ctx, action.personId)
      return
    }
    case "setOvertime": {
      requirePhase(state, ["planung", "lauf", "periodenende"])
      requireAvailablePerson(state, ctx, action.personId).overtime = action.level
      return
    }
    case "setReviews": {
      requirePhase(state, ["planung", "lauf"])
      const task = requireTask(state, ctx, action.taskId)
      if (task.status === "fertig") throw new SimError("NOT_ALLOWED", "Reviews sind nur bis zum Abschluss änderbar.")
      if (action.count < task.reviewsDone) throw new SimError("NOT_ALLOWED", "Durchgeführte Reviews lassen sich nicht zurücknehmen.")
      task.reviews = action.count
      return
    }
    case "startPeriod":
      startPeriod(state, ctx)
      return
    case "advance":
      advanceTicks(state, ctx, action.ticks)
      return
    case "decide":
      requirePhase(state, ["planung", "lauf", "periodenende", "abschlussbericht"])
      decide(state, ctx, action.eventId, action.optionId)
      return
    case "defer":
      requirePhase(state, ["planung", "lauf", "periodenende", "abschlussbericht"])
      defer(state, ctx, action.eventId)
      return
    case "acknowledge":
      requirePhase(state, ["planung", "lauf", "periodenende", "abschlussbericht"])
      acknowledge(state, ctx, action.eventId)
      return
    case "talk": {
      requirePhase(state, ["planung", "lauf"])
      requireAvailablePerson(state, ctx, action.personId)
      requireCalendarSlot(state, ctx)
      talk(state, ctx, action.personId, state.tick)
      return
    }
    case "teamEvent": {
      requirePhase(state, ["planung", "lauf"])
      if (new Set(action.personIds).size !== action.personIds.length) {
        throw new SimError("INVALID_ACTION", "Jede Person nur einmal einladen.")
      }
      for (const pid of action.personIds) requireAvailablePerson(state, ctx, pid)
      requireCalendarSlot(state, ctx)
      bookCost(state, "anlass", teamEvent(state, ctx, action.kind, action.personIds, state.tick))
      return
    }
    case "training": {
      requirePhase(state, ["planung", "lauf"])
      const person = requireAvailablePerson(state, ctx, action.personId)
      if (person.trainingDone) throw new SimError("LIMIT", "Je Person höchstens eine Weiterbildung.")
      bookCost(state, "weiterbildung", ctx.scenario.trainingCost)
      startTraining(state, ctx, action.personId, action.area, state.tick)
      return
    }
    case "riskMeasure":
      requirePhase(state, ["planung", "lauf", "periodenende"])
      riskMeasure(state, ctx, action.riskId, action.measureId)
      return
    case "riskAccept": {
      requirePhase(state, ["planung", "lauf", "periodenende"])
      const risk = state.risks[action.riskId]
      if (!risk) throw new SimError("UNKNOWN_ID", `Unbekanntes Risiko ${action.riskId}.`)
      if (!risk.visible || risk.status !== "offen") throw new SimError("NOT_ALLOWED", "Dieses Risiko ist nicht offen im Register.")
      risk.accepted = true
      return
    }
    case "riskReview":
      requirePhase(state, ["planung", "lauf", "periodenende"])
      markRiskReviewed(state)
      return
    case "submitReport":
      submitReport(state, ctx, action.report)
      return
  }
}

function validateAction(action: unknown): Action {
  const parsed = actionSchema.safeParse(action)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    throw new SimError("INVALID_ACTION", `Ungültige Aktion: ${issue?.message ?? "unbekannter Fehler"}`)
  }
  return parsed.data
}

function afterAction(state: SimState): void {
  if (state.phase === "lauf") {
    if (hasPendingNew(state)) state.pause = "ereignis"
    else if (state.pause === "ereignis") state.pause = null
  }
}

/** Rein: liefert einen neuen Zustand oder wirft SimError. advance ist eine Aktion wie jede andere (4.3). */
export function applyAction(state: SimState, action: Action, scenario: Scenario): SimState {
  if (state.scenarioId !== scenario.id) throw new SimError("NOT_ALLOWED", "Zustand und Szenario passen nicht zusammen.")
  const valid = validateAction(action)
  const ctx = getCtx(scenario)
  const next = structuredClone(state)
  applyInPlace(next, valid, ctx)
  afterAction(next)
  return next
}

/** Bequemlichkeit für die Oberfläche; gleich wie applyAction(state, { type: "advance", ticks }) */
export function advance(state: SimState, ticks: number, scenario: Scenario): SimState {
  return applyAction(state, { type: "advance", ticks }, scenario)
}

/**
 * Nachspielen (4.5): Startwert + Aktionsprotokoll → Zustand. Wirft SimError mit actionIndex
 * der ersten ungültigen Aktion.
 */
export function replay(scenario: Scenario, seed: number, actions: Action[]): SimState {
  const ctx = getCtx(scenario)
  const state = createRun(scenario, seed)
  for (let i = 0; i < actions.length; i++) {
    try {
      applyInPlace(state, validateAction(actions[i]), ctx)
      afterAction(state)
    } catch (error) {
      if (error instanceof SimError) {
        error.actionIndex = i
      }
      throw error
    }
  }
  return state
}

/** Anzeige des aktuellen Takts für Meldungen */
export function describeNow(state: SimState): string {
  return formatTick(state.tick)
}

