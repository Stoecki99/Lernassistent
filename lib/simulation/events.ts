// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// lib/simulation/events.ts
// Bedingungen, Wirkungen, Auslöser, Fristen, Entscheide, Risiko-Eintritte
// (Spezifikation 2.7, 3.1 Schritt 1–2, 3.9, 3.12).

import { dayOf, tickOf, weekdayOf } from "./calendar"
import { clamp, round, type Ctx } from "./context"
import { SimError } from "./errors"
import { ampelRank, computeKpis } from "./kpi"
import { draw } from "./rng"
import { clampRiskValue, hazardPerTick, markRiskReviewed, updateVisibility, windowTicks } from "./risk"
import { addCalendarEntry, clampMotivation } from "./team"
import { bookCost } from "./work"
import type {
  Condition,
  Deadline,
  Effect,
  EventDef,
  InboxItem,
  KpiSnapshot,
  MetricKey,
  OptionDef,
  PersonId,
  PersonTarget,
  SimState,
} from "./types"

// ---------- Kennzahlen für Bedingungen ----------

/** Einmal berechnete Kennzahlen je Prüfschritt (computeKpis ist nicht ganz billig) */
export interface KpiMemo {
  snapshot: KpiSnapshot | null
}

export function newMemo(): KpiMemo {
  return { snapshot: null }
}

function kpis(state: SimState, ctx: Ctx, memo: KpiMemo): KpiSnapshot {
  if (!memo.snapshot) memo.snapshot = computeKpis(state, ctx.scenario)
  return memo.snapshot
}

/** Wert einer Kennzahl für Bedingungen (4.3 MetricKey). si = SI absolut 0–100; trueOverall: gruen 0, gelb 1, rot 2. */
export function metricValue(state: SimState, ctx: Ctx, key: MetricKey, memo: KpiMemo): number {
  switch (key) {
    case "day":
      return dayOf(state.tick) + 1
    case "lastHonesty":
      return state.reports.length > 0 ? state.reports[state.reports.length - 1].honesty : 100
    case "spi":
      return kpis(state, ctx, memo).spi
    case "cpi":
      return kpis(state, ctx, memo).cpi
    case "qi":
      return kpis(state, ctx, memo).qi
    case "teamMotivation":
      return kpis(state, ctx, memo).teamMotivation
    case "si":
      return kpis(state, ctx, memo).si
    case "rmi":
      return kpis(state, ctx, memo).rmi
    case "restmaengel":
      return kpis(state, ctx, memo).restmaengel
    case "trueOverall":
      return ampelRank(kpis(state, ctx, memo).ampeln.gesamt)
  }
}

function compare(a: number, op: "<" | "<=" | ">" | ">=" | "==", b: number): boolean {
  switch (op) {
    case "<":
      return a < b
    case "<=":
      return a <= b
    case ">":
      return a > b
    case ">=":
      return a >= b
    case "==":
      return Math.abs(a - b) < 1e-9
  }
}

/** Bedingung auswerten (4.3 Condition) */
export function evalCondition(state: SimState, ctx: Ctx, cond: Condition, memo: KpiMemo): boolean {
  if ("all" in cond) return cond.all.every((c) => evalCondition(state, ctx, c, memo))
  if ("any" in cond) return cond.any.some((c) => evalCondition(state, ctx, c, memo))
  if ("not" in cond) return !evalCondition(state, ctx, cond.not, memo)
  if ("person" in cond) {
    const person = state.people[cond.person]
    if (!person) return false
    const v = cond.metric === "motivation" ? person.motivation : person.overtimeStreakDays
    return compare(v, cond.op, cond.value)
  }
  if ("metric" in cond) return compare(metricValue(state, ctx, cond.metric, memo), cond.op, cond.value)
  if ("flag" in cond) {
    const v = state.flags[cond.flag]
    if (cond.equals === undefined) return v !== undefined && v !== false && v !== 0 && v !== ""
    return v === cond.equals
  }
  if ("taskDefects" in cond) {
    const task = state.tasks[cond.taskDefects]
    return task ? compare(task.latentDefects, cond.op, cond.value) : false
  }
  if ("task" in cond) {
    const task = state.tasks[cond.task]
    if (!task) return false
    return cond.status === "gestartet" ? task.startTick !== null : task.status === cond.status
  }
  if ("decided" in cond) {
    return state.decisions.some((d) => d.eventId === cond.decided && (cond.optionId === undefined || d.optionId === cond.optionId))
  }
  if ("talkedWith" in cond) {
    const person = state.people[cond.talkedWith]
    if (!person || person.lastTalkTick === null) return false
    return cond.sinceTick === undefined || person.lastTalkTick >= cond.sinceTick
  }
  if ("riskMeasure" in cond) {
    return state.risks[cond.riskMeasure]?.measuresTaken.includes(cond.measureId) ?? false
  }
  return false
}

// ---------- Wirkungen ----------

export interface EffectSource {
  /** z. B. "E05/A", "R02", "CR1", "Massnahme R01-M1" */
  source: string
  /** Skalierung numerischer Wirkungen: A_aktuell ÷ A_start (3.9); 1 = keine */
  scale: number
}

/** Ganze Einheiten, mindestens 1, Vorzeichen bleibt (3.9 «mindestens 1 Einheit, wenn A ≥ 1») */
function scaleUnits(x: number, scale: number): number {
  if (x === 0 || scale === 1) return x
  const v = Math.round(Math.abs(x) * scale)
  return Math.sign(x) * Math.max(1, v)
}

/**
 * Numerische Wirkungen × A_aktuell ÷ A_start (3.9, 2.8 Skalierung):
 * Stunden auf ganze Stunden, Takte (= halbe Tage) auf ganze Takte, mindestens 1 Einheit.
 * Motivation und Zufriedenheit werden nicht skaliert.
 */
export function scaleEffect(effect: Effect, scale: number): Effect {
  if (scale === 1) return effect
  switch (effect.type) {
    case "effort":
      return { ...effect, hours: scaleUnits(effect.hours, scale) }
    case "effortPercent":
      return { ...effect, percentOfPlan: effect.percentOfPlan * scale }
    case "hours":
      return { ...effect, hours: scaleUnits(effect.hours, scale) }
    case "absence":
    case "pensum":
    case "block":
      return { ...effect, ticks: scaleUnits(effect.ticks, scale) }
    case "cost":
      return { ...effect, chf: round(effect.chf * scale, 2) }
    case "defects":
      return { ...effect, delta: effect.delta * scale }
    default:
      return effect
  }
}

function resolveTargets(state: SimState, ctx: Ctx, target: PersonTarget): PersonId[] {
  if (ctx.people[target]) return [target]
  return ctx.personIds.filter((pid) => {
    if (!state.people[pid].available) return false
    if (target === "alle") return true
    return ctx.people[pid].origin === target
  })
}

function startTickFor(state: SimState, fromDay: number | undefined, offset: number): number {
  return fromDay !== undefined ? tickOf(fromDay) : state.tick + offset
}

function stripTiming(effect: Effect): Effect {
  const copy: Effect = { ...effect }
  delete copy.delayTicks
  delete copy.chance
  return copy
}

/** Wendet eine Liste von Wirkungen in Listenreihenfolge an (3.15) */
export function applyEffects(state: SimState, ctx: Ctx, effects: Effect[], src: EffectSource): void {
  for (const e of effects) applyEffect(state, ctx, e, src)
}

/**
 * Eine Wirkung anwenden (4.3 Effect, 3.12): chance zieht sofort einen Zufallswert; delayTicks legt die Wirkung
 * in scheduledEffects ab; when wird bei der Ausführung geprüft.
 */
export function applyEffect(state: SimState, ctx: Ctx, raw: Effect, src: EffectSource): void {
  const effect = scaleEffect(raw, src.scale)
  if (effect.chance !== undefined && draw(state) >= effect.chance) return
  if (effect.delayTicks !== undefined && effect.delayTicks > 0) {
    state.scheduledEffects.push({ atTick: state.tick + effect.delayTicks, effect: stripTiming(effect), source: src.source })
    return
  }
  if (effect.when && !evalCondition(state, ctx, effect.when, newMemo())) return
  const now = state.tick
  switch (effect.type) {
    case "motivation": {
      for (const pid of resolveTargets(state, ctx, effect.target)) {
        if (effect.needFilter && !ctx.people[pid].needs.includes(effect.needFilter)) continue
        state.people[pid].motivation = clampMotivation(state.people[pid].motivation + effect.delta)
      }
      return
    }
    case "stakeholder": {
      if (state.stakeholders[effect.id] === undefined) return
      state.stakeholders[effect.id] = clamp(state.stakeholders[effect.id] + effect.delta, 0, 100)
      return
    }
    case "effort": {
      let task = state.tasks[effect.taskId]
      if (task?.status === "fertig" && effect.fallbackTaskId) task = state.tasks[effect.fallbackTaskId]
      if (!task || task.status === "fertig") return
      task.remaining = Math.max(0, task.remaining + effect.hours)
      return
    }
    case "effortPercent": {
      const task = state.tasks[effect.taskId]
      if (!task || task.status === "fertig") return
      const base = effect.of === "rest" ? task.remaining : task.plannedEffort
      task.remaining = Math.max(0, task.remaining + (base * effect.percentOfPlan) / 100)
      return
    }
    case "plan": {
      // Basisplanänderung (nur Änderungsanträge): Planaufwand, Restaufwand und BAC (3.10)
      const task = state.tasks[effect.taskId]
      if (!task || task.status === "fertig") return
      task.plannedEffort = Math.max(0, task.plannedEffort + effect.effortHours)
      task.remaining = Math.max(0, task.remaining + effect.effortHours)
      task.bac = Math.max(0, task.bac + effect.bacDelta)
      return
    }
    case "cost":
      bookCost(state, effect.category, effect.chf)
      return
    case "hours": {
      const person = state.people[effect.personId]
      if (!person) return
      person.appointmentHours += effect.hours
      addCalendarEntry(state, { tick: now, kind: "workshop", personIds: [effect.personId], hours: effect.hours })
      return
    }
    case "absence": {
      let pid: string | undefined = effect.personId
      if (pid === "zufallLinie") {
        const pool = ctx.personIds.filter((id) => ctx.people[id].origin === "linie" && state.people[id].available)
        pid = pool.length > 0 ? pool[Math.floor(draw(state) * pool.length)] : undefined
      }
      if (!pid || !state.people[pid]) return
      const from = startTickFor(state, effect.fromDay, effect.fromOffsetTicks)
      state.people[pid].absences.push({ fromTick: from, toTick: from + effect.ticks, reason: effect.reason })
      if (effect.reason === "ueberlastung") state.stats.burnouts++
      return
    }
    case "pensum": {
      const person = state.people[effect.personId]
      if (!person) return
      const from = startTickFor(state, effect.fromDay, effect.fromOffsetTicks)
      person.pensumMods.push({ fromTick: from, toTick: from + effect.ticks, delta: effect.delta })
      return
    }
    case "block": {
      const targets =
        effect.taskId === "laufendeEnt3"
          ? ctx.taskIds.filter((id) => {
              const t = state.tasks[id]
              return t.startTick !== null && t.status !== "fertig" && ctx.tasks[id].profile[1] >= 3
            })
          : [effect.taskId]
      for (const id of targets) {
        const task = state.tasks[id]
        if (task) task.blockedUntilTick = Math.max(task.blockedUntilTick, now + effect.ticks)
      }
      return
    }
    case "defects": {
      const task = state.tasks[effect.taskId]
      if (task) task.latentDefects = Math.max(0, task.latentDefects + effect.delta)
      return
    }
    case "risk": {
      const risk = state.risks[effect.riskId]
      if (!risk) return
      if (effect.deltaProbability) risk.probability = clampRiskValue(risk.probability + effect.deltaProbability)
      if (effect.deltaImpact) risk.impact = clampRiskValue(risk.impact + effect.deltaImpact)
      if (effect.reveal) risk.visible = true
      return
    }
    case "revealAllRisks":
      for (const id of ctx.riskIds) state.risks[id].visible = true
      return
    case "qualification": {
      // Profiländerung; der generische delayTicks-Mechanismus hat die Verzögerung bereits umgesetzt
      const person = state.people[effect.personId]
      if (person) person.pendingQualifications.push({ area: effect.area, delta: effect.delta, readyTick: now })
      return
    }
    case "addPerson": {
      if (effect.fromOffsetTicks > 0) {
        state.scheduledEffects.push({ atTick: now + effect.fromOffsetTicks, effect: { ...effect, fromOffsetTicks: 0 }, source: src.source })
        return
      }
      const person = state.people[effect.personId]
      if (!person) return
      person.available = true
      if (effect.learnStart !== undefined) person.learnStart = effect.learnStart
      return
    }
    case "removePerson": {
      if (effect.fromOffsetTicks > 0) {
        state.scheduledEffects.push({ atTick: now + effect.fromOffsetTicks, effect: { ...effect, fromOffsetTicks: 0 }, source: src.source })
        return
      }
      const person = state.people[effect.personId]
      if (person) person.available = false
      return
    }
    case "overtime": {
      const targets = resolveTargets(state, ctx, effect.target)
      for (const pid of targets) state.people[pid].overtime = effect.level
      if (effect.ticks && effect.ticks > 0) {
        state.scheduledEffects.push({
          atTick: now + effect.ticks,
          effect: { type: "overtime", target: effect.target, level: 0 },
          source: src.source,
        })
      }
      return
    }
    case "flag":
      state.flags[effect.key] = effect.value
      return
    case "budget":
      state.finance.budget += effect.deltaChf
      return
    case "teamPhase":
      state.teamPhase = effect.phase
      state.teamPhaseSinceTick = now
      return
    case "changeRequestAvailable":
      if (state.changeRequests[effect.crId] === undefined) state.changeRequests[effect.crId] = "verfuegbar"
      return
    case "applyChangeRequest": {
      const cr = ctx.changeRequests[effect.crId]
      if (!cr || state.changeRequests[effect.crId] === "genehmigt") return
      state.changeRequests[effect.crId] = "genehmigt"
      applyEffects(state, ctx, cr.effects, { source: cr.id, scale: 1 })
      return
    }
    case "restmaengelFactor": {
      const current = typeof state.flags.restmaengelFactor === "number" ? state.flags.restmaengelFactor : 1
      state.flags.restmaengelFactor = current * effect.factor
      return
    }
    case "riskReviewed":
      markRiskReviewed(state)
      return
    case "separate":
      state.separations.push({ personIds: [effect.personIds[0], effect.personIds[1]], untilTick: now + effect.ticks, factor: effect.factor })
      return
    case "fixAllDefects": {
      const target = state.tasks[effect.taskId]
      if (!target) return
      let total = 0
      for (const id of ctx.taskIds) {
        const t = state.tasks[id]
        total += t.latentDefects
        t.foundLate += t.latentDefects
        t.latentDefects = 0
      }
      target.remaining += total * effect.hoursPerDefect
      state.stats.lateDefectsFound += total
      state.hours.korrektur_spaet += total * effect.hoursPerDefect
      return
    }
  }
}

/** Fällige verzögerte Wirkungen anwenden (Schritt 1 von stepTick) */
export function applyScheduled(state: SimState, ctx: Ctx, tick: number): void {
  const due = state.scheduledEffects.filter((s) => s.atTick <= tick)
  if (due.length === 0) return
  state.scheduledEffects = state.scheduledEffects.filter((s) => s.atTick > tick)
  for (const s of due) applyEffect(state, ctx, s.effect, { source: s.source, scale: 1 })
}

// ---------- Fristen, Posteingang ----------

/**
 * Takt, bei dessen Ereignisprüfung der Standardentscheid fällt (2.7 Fristen):
 * «woche»: nach Freitag Nachmittag der laufenden Woche (trifft die Mail am Freitag ein: Folgewoche);
 * «takte»: Eingang + n; «keinAufschub»: null.
 */
export function deadlineTick(deadline: Deadline, arrivedTick: number): number | null {
  if (deadline.type === "keinAufschub") return null
  if (deadline.type === "takte") return arrivedTick + deadline.ticks
  const d = dayOf(arrivedTick)
  const wd = weekdayOf(arrivedTick)
  const friday = wd === 4 ? d + 5 : d - wd + 4
  return 2 * friday + 2
}

function occurrences(state: SimState, eventId: string): number {
  return state.inbox.filter((i) => i.eventId === eventId).length
}

/** Ereignis in den Posteingang legen (Status neu) */
export function deliverEvent(state: SimState, ctx: Ctx, eventId: string, tick: number, memo: KpiMemo): InboxItem | null {
  const def = ctx.events[eventId]
  if (!def) return null
  if (occurrences(state, eventId) >= (def.maxOccurrences ?? 1)) return null
  let variant: number | null = null
  for (let i = 0; i < (def.bodyVariants?.length ?? 0); i++) {
    if (def.bodyVariants && evalCondition(state, ctx, def.bodyVariants[i].when, memo)) {
      variant = i
      break
    }
  }
  const item: InboxItem = {
    eventId,
    arrivedTick: tick,
    deadlineTick: deadlineTick(def.deadline, tick),
    status: "neu",
    optionId: null,
    bodyVariantIndex: variant,
  }
  state.inbox.push(item)
  // Risiken mit visible.byEvent werden mit dem Ereignis sichtbar (2.6)
  for (const rid of ctx.riskIds) if (ctx.risks[rid].visible.byEvent === eventId) state.risks[rid].visible = true
  state.timeline.push({ tick, kind: "ereignis", ref: eventId, text: def.title, magnitude: 0 })
  return item
}

/** Skalierung eines Ereignisses über scaleByRisk: A_aktuell ÷ A_start (3.9) */
function eventScale(state: SimState, ctx: Ctx, def: EventDef): number {
  if (!def.scaleByRisk) return 1
  const rdef = ctx.risks[def.scaleByRisk]
  const risk = state.risks[def.scaleByRisk]
  if (!rdef || !risk || rdef.impact === 0) return 1
  return risk.impact / rdef.impact
}

/** Bewertung g = 1, m = 0.5, s = 0 (3.12) */
export function ratingValue(rating: OptionDef["rating"]): number {
  return rating === "gut" ? 1 : rating === "mittel" ? 0.5 : 0
}

/** Option eines Ereignisses anwenden und protokollieren (decide, Standardentscheid) */
function applyOption(state: SimState, ctx: Ctx, item: InboxItem, option: OptionDef, defaulted: boolean): void {
  const def = ctx.events[item.eventId]
  item.status = defaulted ? "standard" : "entschieden"
  item.optionId = option.id
  state.decisions.push({ eventId: def.id, optionId: option.id, tick: state.tick, rating: option.rating, defaulted })
  applyEffects(state, ctx, option.effects, { source: `${def.id}/${option.id}`, scale: eventScale(state, ctx, def) })
  if (defaulted) {
    // Fristablauf (3.12): Standardentscheid durch die Vorgesetzte, S04 −3, Zähler defaults +1, Systemereignis S3
    const sid = ctx.scenario.defaultDecider.stakeholderId
    if (state.stakeholders[sid] !== undefined) state.stakeholders[sid] = clamp(state.stakeholders[sid] - 3, 0, 100)
    state.stats.defaults++
    state.timeline.push({
      tick: state.tick,
      kind: "standard",
      ref: def.id,
      text: `${ctx.scenario.defaultDecider.name} hat für dich entschieden: ${option.label}`,
      magnitude: 15,
    })
  } else {
    state.timeline.push({ tick: state.tick, kind: "entscheid", ref: `${def.id}/${option.id}`, text: option.label, magnitude: 0 })
  }
}

function openItem(state: SimState, ctx: Ctx, eventId: string): InboxItem {
  if (!ctx.events[eventId]) throw new SimError("UNKNOWN_ID", `Unbekanntes Ereignis ${eventId}.`)
  const item = state.inbox.find((i) => i.eventId === eventId && (i.status === "neu" || i.status === "aufgeschoben"))
  if (!item) throw new SimError("NOT_ALLOWED", `Das Ereignis ${eventId} ist nicht offen.`)
  return item
}

/** Aktion decide (3.12) */
export function decide(state: SimState, ctx: Ctx, eventId: string, optionId: string): void {
  const item = openItem(state, ctx, eventId)
  const option = ctx.events[eventId].options.find((o) => o.id === optionId)
  if (!option) throw new SimError("UNKNOWN_ID", `Unbekannte Option ${optionId} bei ${eventId}.`)
  applyOption(state, ctx, item, option, false)
}

/** Aktion defer (3.12): nur wenn die Frist einen Aufschub erlaubt */
export function defer(state: SimState, ctx: Ctx, eventId: string): void {
  const item = openItem(state, ctx, eventId)
  if (item.deadlineTick === null) throw new SimError("NOT_ALLOWED", "Dieses Ereignis lässt keinen Aufschub zu.")
  if (item.status !== "neu") throw new SimError("NOT_ALLOWED", "Dieses Ereignis ist bereits aufgeschoben.")
  item.status = "aufgeschoben"
}

/** Aktion acknowledge: Kenntnisnahme bei Ereignissen mit genau einer Option (2.7 «nur Zur Kenntnis») */
export function acknowledge(state: SimState, ctx: Ctx, eventId: string): void {
  const item = openItem(state, ctx, eventId)
  const def = ctx.events[eventId]
  if (def.options.length !== 1) throw new SimError("NOT_ALLOWED", "Dieses Ereignis verlangt einen Entscheid.")
  item.status = "gelesen"
  item.optionId = def.options[0].id
  applyEffects(state, ctx, def.options[0].effects, { source: `${def.id}/${def.options[0].id}`, scale: eventScale(state, ctx, def) })
}

// ---------- Risiko-Eintritt (3.9) ----------

function occurRisk(state: SimState, ctx: Ctx, riskId: string, tick: number, memo: KpiMemo): void {
  const def = ctx.risks[riskId]
  const risk = state.risks[riskId]
  risk.status = "eingetreten"
  risk.occurredTick = tick
  const scale = def.impact > 0 ? risk.impact / def.impact : 1
  const effects = def.onOccur.effects ?? []
  applyEffects(state, ctx, effects, { source: riskId, scale })
  let hours = 0
  for (const e of effects) {
    const scaled = scaleEffect(e, scale)
    if (scaled.type === "effort" || scaled.type === "hours") hours += Math.abs(scaled.hours)
    if (scaled.type === "effortPercent") hours += Math.abs((ctx.tasks[scaled.taskId]?.effortHours ?? 0) * scaled.percentOfPlan) / 100
  }
  state.timeline.push({
    tick,
    kind: "risiko",
    ref: riskId,
    text: def.onOccur.message ?? def.title,
    magnitude: hours / 4,
  })
  if (def.onOccur.eventId) deliverEvent(state, ctx, def.onOccur.eventId, tick, memo)
  for (const eid of ctx.eventIds) {
    const trig = ctx.events[eid].trigger
    if (trig.type === "risk" && trig.riskId === riskId && eid !== def.onOccur.eventId) deliverEvent(state, ctx, eid, tick, memo)
  }
}

// ---------- Ereignisprüfung (Schritt 2 von stepTick, 3.1) ----------

/**
 * Fristabläufe → Standardentscheid; feste Zeitpunkte, Folgeereignisse, Teamphasen; Bedingungen (mit Zufall);
 * Risiko-Eintritte. Iteration nach ID. Liefert die Zahl neuer Ereignisse.
 */
export function checkEvents(state: SimState, ctx: Ctx, tick: number): number {
  const memo = newMemo()
  const before = state.inbox.length

  // Fristabläufe
  for (const item of state.inbox) {
    if ((item.status === "neu" || item.status === "aufgeschoben") && item.deadlineTick !== null && item.deadlineTick <= tick) {
      const def = ctx.events[item.eventId]
      const option = def.options.find((o) => o.id === def.defaultOptionId) ?? def.options[0]
      applyOption(state, ctx, item, option, true)
    }
  }

  // Feste Zeitpunkte, Folgeereignisse, Teamphasen
  for (const eid of ctx.eventIds) {
    const trig = ctx.events[eid].trigger
    if (trig.type === "tick" && trig.tick === tick) deliverEvent(state, ctx, eid, tick, memo)
    if (trig.type === "followUp") {
      const d = state.decisions.find((x) => x.eventId === trig.eventId && (trig.optionId === undefined || x.optionId === trig.optionId))
      if (d && tick >= d.tick + trig.delayTicks && occurrences(state, eid) === 0) deliverEvent(state, ctx, eid, tick, memo)
    }
    if (trig.type === "phaseChange" && state.teamPhase === trig.teamPhase && occurrences(state, eid) === 0) {
      deliverEvent(state, ctx, eid, tick, memo)
    }
  }

  // Bedingungen mit Zufall
  for (const eid of ctx.eventIds) {
    const def = ctx.events[eid]
    const trig = def.trigger
    if (trig.type !== "condition") continue
    if (tick < trig.fromTick || tick > trig.toTick) continue
    if (trig.everyTicks && (tick - trig.fromTick) % trig.everyTicks !== 0) continue
    if (occurrences(state, eid) >= (def.maxOccurrences ?? 1)) continue
    if (!evalCondition(state, ctx, trig.when, memo)) continue
    if (trig.chance !== undefined && draw(state) >= trig.chance) continue
    deliverEvent(state, ctx, eid, tick, memo)
  }

  // Risiko-Eintritte: je Takt einmal ziehen, nach ID (3.9)
  updateVisibility(state, ctx, tick)
  for (const rid of ctx.riskIds) {
    const risk = state.risks[rid]
    if (risk.status !== "offen") continue
    const win = windowTicks(ctx.risks[rid])
    if (tick > win.to) {
      risk.status = "vorbei"
      continue
    }
    if (tick < win.from) continue
    const h = hazardPerTick(risk.probability, win.count, ctx.params.riskProb)
    if (draw(state) < h) occurRisk(state, ctx, rid, tick, memo)
  }

  return state.inbox.slice(before).filter((i) => i.status === "neu").length
}

export function hasPendingNew(state: SimState): boolean {
  return state.inbox.some((i) => i.status === "neu")
}
