// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// lib/validations/simulation.ts
// Zod-Schemas des Leitstands: Szenario, Aktionen, Statusbericht, API-Eingaben.
// Vertrag: docs/leitstand-spezifikation.md, Abschnitte 4.3, 4.4, 4.6.

import { z } from "zod"
import pmgtFach from "../../content/lernseiten/pmgt/fach.json"
import type { Action, Condition, Effect, Scenario, StatusReportInput } from "../simulation/types"

// ---------- Grundbausteine ----------

/**
 * IDs von Vorgängen, Personen, Stakeholdern, Risiken, Ereignissen, Anträgen, Massnahmen, Hinweisen.
 * Abweichung von 4.3 (^[A-Z]\d{2}$): der Einführungslauf nutzt H1–H6, der Katalog E20b, CR1, M1, HW01.
 */
export const ID_PATTERN = /^[A-Z]{1,2}\d{1,2}[a-z]?$/
const idField = z.string().regex(ID_PATTERN, "Ungültige ID.")
const optionIdField = z.string().regex(/^[A-Z]$/, "Options-ID muss ein Grossbuchstabe sein.")
const flagKey = z.string().min(1).max(60).regex(/^[A-Za-z][A-Za-z0-9_]*$/, "Ungültiger Flag-Name.")
const ICB_PATTERN = /^[123]\.(0[1-9]|1[0-3])$/

/** Stations-Slugs aus content/lernseiten/pmgt/fach.json (4.4) */
export const PMGT_STATIONS: readonly string[] = pmgtFach.pfad.map((p) => p.slug)

const text = (max: number) => z.string().min(1, "Text fehlt.").max(max, `Text zu lang (höchstens ${max} Zeichen).`)
const level = z.number().int().min(0).max(6)
const profileSchema = z.tuple([level, level, level, level, level])
const tickField = z.number().int().min(0).max(1000)
const areaSchema = z.enum(["bau", "ent", "dat", "ux", "kom"])
const needSchema = z.enum(["anerkennung", "klarheit", "autonomie", "entwicklung", "zugehoerigkeit", "sicherheit"])
const traitSchema = z.enum(["gruendlich", "schnell", "verzettelt", "lernt_schnell"])
const teamPhaseSchema = z.enum(["orientierung", "sturm", "normierung", "leistung"])
const taskStatusSchema = z.enum(["offen", "bereit", "laufend", "fertig"])
const costCategorySchema = z.enum(["arbeit", "ueberzeit", "fuehrung", "anlass", "weiterbildung", "risiko", "ereignis"])
const ampelSchema = z.enum(["gruen", "gelb", "rot"], { message: "Ampel muss gruen, gelb oder rot sein." })
const reportAreaSchema = z.enum(["termine", "kosten", "qualitaet", "team", "risiken"])
const metricSchema = z.enum(["spi", "cpi", "qi", "teamMotivation", "si", "rmi", "day", "restmaengel", "trueOverall", "lastHonesty"])
const personTargetSchema = z.union([z.enum(["alle", "kern", "linie", "lieferant", "beratung"]), idField])
const flagValue = z.union([z.string().max(100), z.number(), z.boolean()])

// ---------- Bedingungen und Wirkungen ----------

export const conditionSchema: z.ZodType<Condition> = z.lazy(() =>
  z.union([
    z.object({ all: z.array(conditionSchema) }).strict(),
    z.object({ any: z.array(conditionSchema) }).strict(),
    z.object({ not: conditionSchema }).strict(),
    z.object({ metric: metricSchema, op: z.enum(["<", "<=", ">", ">=", "=="]), value: z.number() }).strict(),
    z.object({ flag: flagKey, equals: flagValue.optional() }).strict(),
    z.object({ task: idField, status: z.union([taskStatusSchema, z.literal("gestartet")]) }).strict(),
    z.object({ taskDefects: idField, op: z.enum([">", "<"]), value: z.number() }).strict(),
    z.object({ person: idField, metric: z.enum(["motivation", "overtimeStreak"]), op: z.enum([">", "<"]), value: z.number() }).strict(),
    z.object({ decided: idField, optionId: optionIdField.optional() }).strict(),
    z.object({ talkedWith: idField, sinceTick: tickField.optional() }).strict(),
    z.object({ riskMeasure: idField, measureId: idField }).strict(),
  ]),
)

const timing = {
  delayTicks: z.number().int().min(0).max(200).optional(),
  chance: z.number().gt(0).max(1).optional(),
  when: conditionSchema.optional(),
}
const ticks = z.number().int().min(0).max(200)
const delta = z.number().min(-1000).max(1000)

export const effectSchema: z.ZodType<Effect> = z.lazy(() =>
  z.discriminatedUnion("type", [
    z.object({ type: z.literal("motivation"), target: personTargetSchema, delta, needFilter: needSchema.optional(), ...timing }).strict(),
    z.object({ type: z.literal("stakeholder"), id: idField, delta, ...timing }).strict(),
    z.object({ type: z.literal("effort"), taskId: idField, hours: delta, fallbackTaskId: idField.optional(), ...timing }).strict(),
    z
      .object({ type: z.literal("effortPercent"), taskId: idField, percentOfPlan: z.number().min(-100).max(500), of: z.enum(["plan", "rest"]).optional(), ...timing })
      .strict(),
    z.object({ type: z.literal("plan"), taskId: idField, effortHours: delta, bacDelta: z.number().min(-1e6).max(1e6), ...timing }).strict(),
    z.object({ type: z.literal("cost"), chf: z.number().min(-1e6).max(1e6), category: costCategorySchema, label: text(160), ...timing }).strict(),
    z.object({ type: z.literal("hours"), personId: idField, hours: z.number().min(0).max(80), ...timing }).strict(),
    z
      .object({
        type: z.literal("absence"),
        personId: z.union([idField, z.literal("zufallLinie")]),
        fromOffsetTicks: ticks,
        ticks,
        reason: text(80),
        fromDay: z.number().int().min(1).max(60).optional(),
        ...timing,
      })
      .strict(),
    z
      .object({
        type: z.literal("pensum"),
        personId: idField,
        delta: z.number().min(-1).max(1),
        fromOffsetTicks: ticks,
        ticks,
        fromDay: z.number().int().min(1).max(60).optional(),
        ...timing,
      })
      .strict(),
    z.object({ type: z.literal("block"), taskId: z.union([idField, z.literal("laufendeEnt3")]), ticks, ...timing }).strict(),
    z.object({ type: z.literal("defects"), taskId: idField, delta, ...timing }).strict(),
    z
      .object({ type: z.literal("risk"), riskId: idField, deltaProbability: z.number().int().min(-4).max(4).optional(), deltaImpact: z.number().int().min(-4).max(4).optional(), reveal: z.boolean().optional(), ...timing })
      .strict(),
    z.object({ type: z.literal("revealAllRisks"), ...timing }).strict(),
    z.object({ type: z.literal("qualification"), personId: idField, area: areaSchema, delta: z.number().int().min(-6).max(6), delayTicks: ticks, chance: timing.chance, when: timing.when }).strict(),
    z.object({ type: z.literal("addPerson"), personId: idField, fromOffsetTicks: ticks, learnStart: z.number().min(0.5).max(1).optional(), ...timing }).strict(),
    z.object({ type: z.literal("removePerson"), personId: idField, fromOffsetTicks: ticks, ...timing }).strict(),
    z.object({ type: z.literal("overtime"), target: personTargetSchema, level: z.union([z.literal(0), z.literal(1), z.literal(2)]), ticks: ticks.optional(), ...timing }).strict(),
    z.object({ type: z.literal("flag"), key: flagKey, value: flagValue, ...timing }).strict(),
    z.object({ type: z.literal("budget"), deltaChf: z.number().min(-1e6).max(1e6), ...timing }).strict(),
    z.object({ type: z.literal("teamPhase"), phase: teamPhaseSchema, ...timing }).strict(),
    z.object({ type: z.literal("changeRequestAvailable"), crId: idField, ...timing }).strict(),
    z.object({ type: z.literal("applyChangeRequest"), crId: idField, ...timing }).strict(),
    z.object({ type: z.literal("restmaengelFactor"), factor: z.number().min(0).max(10), ...timing }).strict(),
    z.object({ type: z.literal("riskReviewed"), ...timing }).strict(),
    z.object({ type: z.literal("separate"), personIds: z.tuple([idField, idField]), ticks, factor: z.number().min(0).max(1), ...timing }).strict(),
    z.object({ type: z.literal("fixAllDefects"), taskId: idField, hoursPerDefect: z.number().min(0).max(20), ...timing }).strict(),
  ]),
)

// ---------- Szenario ----------

const triggerSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("tick"), tick: tickField }).strict(),
  z
    .object({
      type: z.literal("condition"),
      fromTick: tickField,
      toTick: tickField,
      when: conditionSchema,
      chance: z.number().gt(0).max(1).optional(),
      everyTicks: z.number().int().min(1).max(200).optional(),
    })
    .strict(),
  z.object({ type: z.literal("risk"), riskId: idField }).strict(),
  z.object({ type: z.literal("followUp"), eventId: idField, optionId: optionIdField.optional(), delayTicks: ticks }).strict(),
  z.object({ type: z.literal("phaseChange"), teamPhase: teamPhaseSchema }).strict(),
])

const deadlineSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("woche") }).strict(),
  z.object({ type: z.literal("takte"), ticks: z.number().int().min(1).max(40) }).strict(),
  z.object({ type: z.literal("keinAufschub") }).strict(),
])

const optionSchema = z
  .object({
    id: optionIdField,
    label: text(160),
    rating: z.enum(["gut", "mittel", "schlecht"]),
    effects: z.array(effectSchema).max(60),
    feedback: text(700),
  })
  .strict()

const eventSchema = z
  .object({
    id: idField,
    channel: z.enum(["mail", "anruf", "besuch", "system"]),
    sender: z.object({ name: text(120), personId: idField.optional(), stakeholderId: idField.optional() }).strict(),
    title: text(120),
    body: text(900),
    bodyVariants: z.array(z.object({ when: conditionSchema, body: text(900) }).strict()).max(5).optional(),
    trigger: triggerSchema,
    deadline: deadlineSchema,
    options: z.array(optionSchema).min(1).max(4),
    defaultOptionId: optionIdField.optional(),
    icb: z.array(z.string().regex(ICB_PATTERN, "Ungültige ICB-Kennung.")).min(1).max(6),
    stations: z.array(z.string().max(80)).max(6),
    scaleByRisk: idField.optional(),
    maxOccurrences: z.number().int().min(1).max(20).optional(),
  })
  .strict()

const taskSchema = z
  .object({
    id: idField,
    name: text(120),
    description: text(600),
    phase: z.enum(["R", "E"]),
    predecessors: z.array(idField).max(10),
    effortHours: z.number().positive().max(2000),
    plannedPersons: z.number().int().min(1).max(4),
    plannedRate: z.number().positive().max(500),
    profile: profileSchema,
    minDays: z.number().positive().max(60).optional(),
    milestone: text(80).optional(),
    test: z.object({ covers: z.array(idField).min(1), detectionRate: z.number().gt(0).max(1) }).strict().optional(),
  })
  .strict()

const personSchema = z
  .object({
    id: idField,
    name: text(120),
    age: z.number().int().min(16).max(80),
    role: text(120),
    origin: z.enum(["kern", "linie", "lieferant", "beratung"]),
    lineManager: idField.optional(),
    pensum: z.number().min(0.1).max(1),
    availabilityOverrides: z
      .array(z.object({ fromDay: z.number().int().min(1), toDay: z.number().int().min(1), pensum: z.number().min(0).max(1) }).strict())
      .max(10)
      .optional(),
    rate: z.number().positive().max(500),
    profile: profileSchema,
    startMotivation: z.number().min(0).max(120),
    needs: z.array(needSchema).min(1).max(2),
    traits: z.array(traitSchema).max(2),
    overtimeTolerance: z.enum(["tief", "mittel", "hoch"]),
    hidden: z.boolean().optional(),
    bio: text(900),
    strengths: text(900),
    weaknesses: text(900),
    overtimeBehaviour: text(900),
  })
  .strict()

const stakeholderSchema = z
  .object({
    id: idField,
    name: text(120),
    role: text(200),
    influence: z.number().int().min(1).max(5),
    interest: z.number().int().min(1).max(5),
    startSatisfaction: z.number().min(0).max(100),
  })
  .strict()

const riskMeasureSchema = z
  .object({
    id: idField,
    label: text(200),
    strategy: z.enum(["vermeiden", "vermindern", "uebertragen", "akzeptieren"]),
    costChf: z.number().min(0).max(1e6),
    effort: z
      .union([
        z.object({ personId: idField, hours: z.number().positive().max(80) }).strict(),
        z.object({ taskId: idField, hours: z.number().positive().max(200) }).strict(),
      ])
      .optional(),
    deltaProbability: z.number().int().min(-4).max(4).optional(),
    deltaImpact: z.number().int().min(-4).max(4).optional(),
    sideEffects: z.array(effectSchema).max(10).optional(),
  })
  .strict()

const riskSchema = z
  .object({
    id: idField,
    category: text(60),
    title: text(160),
    description: text(600),
    probability: z.number().int().min(1).max(5),
    impact: z.number().int().min(1).max(5),
    window: z.object({ fromDay: z.number().int().min(1).max(60), toDay: z.number().int().min(1).max(60) }).strict(),
    visible: z.object({ fromDay: z.number().int().min(1).max(60).optional(), byEvent: idField.optional() }).strict(),
    onOccur: z.object({ eventId: idField.optional(), effects: z.array(effectSchema).max(20).optional(), message: text(600).optional() }).strict(),
    measures: z.array(riskMeasureSchema).max(5),
  })
  .strict()

const changeRequestSchema = z
  .object({
    id: idField,
    label: text(160),
    description: text(600),
    availableWhen: conditionSchema.optional(),
    approveWhen: conditionSchema,
    effects: z.array(effectSchema).max(20),
  })
  .strict()

const viewSchema = z.enum([
  "uebersicht", "vorgaenge", "team", "plan", "auslastung", "kalender", "posteingang", "risiken", "budget", "bericht", "nachbesprechung",
])
const hintSchema = z
  .object({
    id: idField,
    when: z.union([
      z.object({ ui: z.literal("viewOpened"), view: viewSchema }).strict(),
      z.object({ ui: z.enum(["firstAssignment", "planningDone", "firstEvent", "firstFeedback", "finalReport"]) }).strict(),
      z.object({ state: conditionSchema }).strict(),
    ]),
    text: text(400),
    view: viewSchema.optional(),
  })
  .strict()

const num = z.number().finite()
const paramsSchema = z
  .object({
    hoursPerTick: num, periodTicks: num, hardStopTick: num, otStep: num, otSurcharge: num, help: num,
    cGap: num, cOver: num, fitMin: num, fitMax: num, teamLinear: num, teamQuad: num, teamMin: num,
    phaseFactor: z.object({ orientierung: num, sturm: num, normierung: num, leistung: num }).partial().strict(),
    motBase: num, motDrift: num, learnStart: num, learnHours: num,
    otTolerance: z.object({ tief: num, mittel: num, hoch: num }).partial().strict(),
    defBase: num, reviewShare: num, reviewDetect: num, fixEarly: num, fixLate: num, rhoRef: num,
    riskProb: z.tuple([num, num, num, num, num]),
    talkBoost: num, talkCooldownDays: num, calendarMaxPerDay: num,
    starThresholds: z.tuple([num, num, num]),
  })
  .partial()
  .strict()

// ---------- Querverweise (superRefine, 4.4) ----------

type Issue = { path: (string | number)[]; message: string }

function duplicates(ids: string[]): string[] {
  const seen = new Set<string>()
  const dup = new Set<string>()
  for (const id of ids) (seen.has(id) ? dup : seen).add(id)
  return [...dup]
}

const PERSON_GROUPS = new Set(["alle", "kern", "linie", "lieferant", "beratung"])

function checkScenario(s: z.infer<typeof scenarioBaseSchema>): Issue[] {
  const issues: Issue[] = []
  const add = (path: Issue["path"], message: string) => issues.push({ path, message })
  const taskIds = new Set(s.tasks.map((t) => t.id))
  const personIds = new Set(s.people.map((p) => p.id))
  const stakeholderIds = new Set(s.stakeholders.map((x) => x.id))
  const riskIds = new Set(s.risks.map((r) => r.id))
  const eventIds = new Set(s.events.map((e) => e.id))
  const crIds = new Set(s.changeRequests.map((c) => c.id))
  const phaseIds = new Set(s.phases.map((p) => p.id))
  const stations = new Set(PMGT_STATIONS)

  const collections: Array<[string, string[]]> = [
    ["tasks", s.tasks.map((t) => t.id)],
    ["people", s.people.map((p) => p.id)],
    ["stakeholders", s.stakeholders.map((x) => x.id)],
    ["risks", s.risks.map((r) => r.id)],
    ["events", s.events.map((e) => e.id)],
    ["changeRequests", s.changeRequests.map((c) => c.id)],
    ["reportMeasures", s.reportMeasures.map((m) => m.id)],
    ["hints", (s.hints ?? []).map((h) => h.id)],
    ["phases", s.phases.map((p) => p.id)],
  ]
  for (const [name, ids] of collections) for (const d of duplicates(ids)) add([name], `Doppelte ID ${d}.`)

  // Ereignisse und Optionen für Verweise
  const optionsByEvent = new Map(s.events.map((e) => [e.id, new Set(e.options.map((o) => o.id))]))
  const measuresByRisk = new Map(s.risks.map((r) => [r.id, new Set(r.measures.map((m) => m.id))]))

  const checkCondition = (c: Condition, path: Issue["path"]): void => {
    if ("all" in c) return c.all.forEach((x, i) => checkCondition(x, [...path, "all", i]))
    if ("any" in c) return c.any.forEach((x, i) => checkCondition(x, [...path, "any", i]))
    if ("not" in c) return checkCondition(c.not, [...path, "not"])
    if ("task" in c && !taskIds.has(c.task)) add(path, `Unbekannter Vorgang ${c.task}.`)
    if ("taskDefects" in c && !taskIds.has(c.taskDefects)) add(path, `Unbekannter Vorgang ${c.taskDefects}.`)
    if ("person" in c && !personIds.has(c.person)) add(path, `Unbekannte Person ${c.person}.`)
    if ("talkedWith" in c && !personIds.has(c.talkedWith)) add(path, `Unbekannte Person ${c.talkedWith}.`)
    if ("decided" in c) {
      const opts = optionsByEvent.get(c.decided)
      if (!opts) add(path, `Unbekanntes Ereignis ${c.decided}.`)
      else if (c.optionId && !opts.has(c.optionId)) add(path, `Unbekannte Option ${c.optionId} bei ${c.decided}.`)
    }
    if ("riskMeasure" in c) {
      const ms = measuresByRisk.get(c.riskMeasure)
      if (!ms) add(path, `Unbekanntes Risiko ${c.riskMeasure}.`)
      else if (!ms.has(c.measureId)) add(path, `Unbekannte Massnahme ${c.measureId} bei ${c.riskMeasure}.`)
    }
  }

  const checkEffect = (e: Effect, path: Issue["path"]): void => {
    if (e.when) checkCondition(e.when, [...path, "when"])
    const task = (id: string) => {
      if (!taskIds.has(id)) add(path, `Unbekannter Vorgang ${id}.`)
    }
    const person = (id: string) => {
      if (!personIds.has(id)) add(path, `Unbekannte Person ${id}.`)
    }
    switch (e.type) {
      case "motivation":
      case "overtime":
        if (!PERSON_GROUPS.has(e.target)) person(e.target)
        return
      case "stakeholder":
        if (!stakeholderIds.has(e.id)) add(path, `Unbekannter Stakeholder ${e.id}.`)
        return
      case "effort":
        task(e.taskId)
        if (e.fallbackTaskId) task(e.fallbackTaskId)
        return
      case "effortPercent":
      case "plan":
      case "defects":
      case "fixAllDefects":
        task(e.taskId)
        return
      case "block":
        if (e.taskId !== "laufendeEnt3") task(e.taskId)
        return
      case "hours":
      case "pensum":
      case "qualification":
      case "addPerson":
      case "removePerson":
        person(e.personId)
        return
      case "absence":
        if (e.personId !== "zufallLinie") person(e.personId)
        return
      case "separate":
        e.personIds.forEach(person)
        return
      case "risk":
        if (!riskIds.has(e.riskId)) add(path, `Unbekanntes Risiko ${e.riskId}.`)
        return
      case "changeRequestAvailable":
      case "applyChangeRequest":
        if (!crIds.has(e.crId)) add(path, `Unbekannter Änderungsantrag ${e.crId}.`)
        return
      default:
        return
    }
  }

  // Vorgänge, Netzplan
  const byId = new Map(s.tasks.map((t) => [t.id, t]))
  s.tasks.forEach((t, i) => {
    if (!phaseIds.has(t.phase)) add(["tasks", i, "phase"], `Phase ${t.phase} fehlt in phases.`)
    t.predecessors.forEach((p, j) => {
      if (!taskIds.has(p)) add(["tasks", i, "predecessors", j], `Unbekannter Vorgänger ${p}.`)
      if (p === t.id) add(["tasks", i, "predecessors", j], "Ein Vorgang kann nicht sein eigener Vorgänger sein.")
      // Phase-E-Vorgänge nur Vorgänger in R oder E; R-Vorgänge nicht nach E
      if (t.phase === "R" && byId.get(p)?.phase === "E") add(["tasks", i, "predecessors", j], `${t.id} (Phase R) darf nicht auf ${p} (Phase E) folgen.`)
    })
    t.test?.covers.forEach((c, j) => {
      if (!taskIds.has(c)) add(["tasks", i, "test", "covers", j], `Unbekannter Vorgang ${c}.`)
    })
  })
  // Zyklen (Tiefensuche)
  const state = new Map<string, 0 | 1 | 2>()
  const visit = (id: string, trail: string[]): boolean => {
    const st = state.get(id) ?? 0
    if (st === 2) return false
    if (st === 1) {
      add(["tasks"], `Zyklus im Netzplan: ${[...trail, id].join(" → ")}.`)
      return true
    }
    state.set(id, 1)
    for (const p of byId.get(id)?.predecessors ?? []) if (byId.has(p) && visit(p, [...trail, id])) return true
    state.set(id, 2)
    return false
  }
  for (const t of s.tasks) if (visit(t.id, [])) break

  // Personen
  s.people.forEach((p, i) => {
    if (p.lineManager && !stakeholderIds.has(p.lineManager)) add(["people", i, "lineManager"], `Unbekannter Stakeholder ${p.lineManager}.`)
  })
  if (!stakeholderIds.has(s.defaultDecider.stakeholderId)) add(["defaultDecider"], `Unbekannter Stakeholder ${s.defaultDecider.stakeholderId}.`)

  // Risiken
  s.risks.forEach((r, i) => {
    if (r.window.toDay < r.window.fromDay) add(["risks", i, "window"], "Fenster: bis vor von.")
    if (r.visible.byEvent && !eventIds.has(r.visible.byEvent)) add(["risks", i, "visible"], `Unbekanntes Ereignis ${r.visible.byEvent}.`)
    if (r.onOccur.eventId && !eventIds.has(r.onOccur.eventId)) add(["risks", i, "onOccur"], `Unbekanntes Ereignis ${r.onOccur.eventId}.`)
    r.onOccur.effects?.forEach((e, j) => checkEffect(e, ["risks", i, "onOccur", "effects", j]))
    for (const d of duplicates(r.measures.map((m) => m.id))) add(["risks", i, "measures"], `Doppelte Massnahme ${d}.`)
    r.measures.forEach((m, j) => {
      if (m.effort && "personId" in m.effort && !personIds.has(m.effort.personId)) add(["risks", i, "measures", j], `Unbekannte Person ${m.effort.personId}.`)
      if (m.effort && "taskId" in m.effort && !taskIds.has(m.effort.taskId)) add(["risks", i, "measures", j], `Unbekannter Vorgang ${m.effort.taskId}.`)
      m.sideEffects?.forEach((e, k) => checkEffect(e, ["risks", i, "measures", j, "sideEffects", k]))
    })
  })

  // Ereignisse
  s.events.forEach((ev, i) => {
    const path = ["events", i]
    for (const d of duplicates(ev.options.map((o) => o.id))) add([...path, "options"], `Doppelte Option ${d}.`)
    if (ev.deadline.type !== "keinAufschub") {
      if (!ev.defaultOptionId) add([...path, "defaultOptionId"], `${ev.id}: Ereignis mit Aufschub braucht defaultOptionId.`)
    }
    if (ev.defaultOptionId && !ev.options.some((o) => o.id === ev.defaultOptionId)) {
      add([...path, "defaultOptionId"], `${ev.id}: defaultOptionId ${ev.defaultOptionId} ist keine Option.`)
    }
    // Ereignis mit Entscheid: mindestens eine Option «gut» (Abweichung von 4.4 «genau eine»: E07, E11 haben zwei)
    if (ev.options.length > 1 && !ev.options.some((o) => o.rating === "gut")) add([...path, "options"], `${ev.id}: keine Option mit Bewertung «gut».`)
    ev.stations.forEach((st, j) => {
      if (!stations.has(st)) add([...path, "stations", j], `Unbekannte Station ${st}.`)
    })
    if (ev.sender.personId && !personIds.has(ev.sender.personId)) add([...path, "sender"], `Unbekannte Person ${ev.sender.personId}.`)
    if (ev.sender.stakeholderId && !stakeholderIds.has(ev.sender.stakeholderId)) add([...path, "sender"], `Unbekannter Stakeholder ${ev.sender.stakeholderId}.`)
    if (ev.scaleByRisk && !riskIds.has(ev.scaleByRisk)) add([...path, "scaleByRisk"], `Unbekanntes Risiko ${ev.scaleByRisk}.`)
    const tr = ev.trigger
    if (tr.type === "risk" && !riskIds.has(tr.riskId)) add([...path, "trigger"], `Unbekanntes Risiko ${tr.riskId}.`)
    if (tr.type === "followUp") {
      const opts = optionsByEvent.get(tr.eventId)
      if (!opts) add([...path, "trigger"], `Unbekanntes Ereignis ${tr.eventId}.`)
      else if (tr.optionId && !opts.has(tr.optionId)) add([...path, "trigger"], `Unbekannte Option ${tr.optionId} bei ${tr.eventId}.`)
    }
    if (tr.type === "condition") {
      if (tr.toTick < tr.fromTick) add([...path, "trigger"], "Bedingung: toTick vor fromTick.")
      checkCondition(tr.when, [...path, "trigger", "when"])
    }
    ev.bodyVariants?.forEach((v, j) => checkCondition(v.when, [...path, "bodyVariants", j]))
    ev.options.forEach((o, j) => o.effects.forEach((e, k) => checkEffect(e, [...path, "options", j, "effects", k])))
  })

  // Änderungsanträge, Hinweise
  s.changeRequests.forEach((cr, i) => {
    if (cr.availableWhen) checkCondition(cr.availableWhen, ["changeRequests", i, "availableWhen"])
    checkCondition(cr.approveWhen, ["changeRequests", i, "approveWhen"])
    cr.effects.forEach((e, j) => checkEffect(e, ["changeRequests", i, "effects", j]))
  })
  s.hints?.forEach((h, i) => {
    if ("state" in h.when) checkCondition(h.when.state, ["hints", i, "when"])
  })

  // Kalender
  s.calendar.periods.forEach((p, i) => {
    if (p.endTick < p.startTick) add(["calendar", "periods", i], "Periode: endTick vor startTick.")
    if (p.endTick >= s.calendar.hardStopTick) add(["calendar", "periods", i], "Periode endet nach dem Abbruch.")
  })
  return issues
}

const scenarioBaseSchema = z
  .object({
    id: z.string().min(1).max(40).regex(/^[a-z0-9-]+$/, "Ungültige Szenario-ID."),
    version: z.string().regex(/^\d+\.\d+\.\d+$/, "Version muss semver sein."),
    kind: z.enum(["intro", "main"]),
    title: text(120),
    briefing: text(8000),
    calendar: z
      .object({
        periods: z
          .array(
            z
              .object({ id: z.number().int().min(0), startTick: tickField, endTick: tickField, label: text(80), report: z.enum(["status", "final"]) })
              .strict(),
          )
          .min(1)
          .max(4),
        targetDay: z.number().positive().max(60),
        planEndDay: z.number().positive().max(60),
        hardStopTick: z.number().int().min(1).max(200),
      })
      .strict(),
    budget: z.object({ total: z.number().positive().max(1e7), currency: z.literal("CHF") }).strict(),
    phases: z.array(z.object({ id: z.enum(["R", "E"]), label: text(80), gateTick: tickField.nullable() }).strict()).min(1).max(2),
    tasks: z.array(taskSchema).min(1).max(40),
    people: z.array(personSchema).min(1).max(30),
    stakeholders: z.array(stakeholderSchema).min(1).max(30),
    risks: z.array(riskSchema).max(30),
    events: z.array(eventSchema).max(80),
    changeRequests: z.array(changeRequestSchema).max(20),
    reportMeasures: z.array(z.object({ id: idField, label: text(120), areas: z.array(reportAreaSchema).min(1) }).strict()).max(20),
    coach: z.object({ name: text(120) }).strict(),
    defaultDecider: z.object({ name: text(120), stakeholderId: idField }).strict(),
    trainingCost: z.number().min(0).max(1e5),
    hints: z.array(hintSchema).max(40).optional(),
    params: paramsSchema.optional(),
  })
  .strict()

/** Szenario inkl. Querverweis-Prüfungen (4.4) */
export const scenarioSchema = scenarioBaseSchema.superRefine((s, ctx) => {
  for (const issue of checkScenario(s)) ctx.addIssue({ code: "custom", path: issue.path, message: issue.message })
})

/** Geprüftes Szenario; der Rückgabetyp stellt sicher, dass Schema und Typ aus 4.3 deckungsgleich sind. */
export function parseScenario(raw: unknown): Scenario {
  const result = scenarioSchema.safeParse(raw)
  if (!result.success) {
    const text = result.error.issues
      .slice(0, 10)
      .map((i) => `${i.path.join(".") || "(Wurzel)"}: ${i.message}`)
      .join("; ")
    throw new Error(`Szenario ungültig: ${text}`)
  }
  return result.data
}

// ---------- Aktionen ----------

const shareSchema = z.union([z.literal(0.25), z.literal(0.5), z.literal(0.75), z.literal(1)], {
  message: "Anteil muss 0.25, 0.5, 0.75 oder 1 sein.",
})

export const statusReportInputSchema: z.ZodType<StatusReportInput> = z
  .object({
    ampeln: z
      .object({ gesamt: ampelSchema, termine: ampelSchema, kosten: ampelSchema, qualitaet: ampelSchema, team: ampelSchema, risiken: ampelSchema })
      .strict(),
    progressPercent: z.number().min(0).max(100),
    forecastEndDay: z.number().min(1).max(60),
    forecastCostChf: z.number().min(0).max(1_000_000),
    deviations: z.string().max(1000, "Abweichungen: höchstens 1'000 Zeichen."),
    measures: z.array(idField).max(8),
    measuresText: z.string().max(500, "Massnahmen: höchstens 500 Zeichen."),
    budgetSupplementChf: z.number().min(0).max(100_000),
    changeRequestIds: z.array(idField).max(10),
  })
  .strict()

export const actionSchema: z.ZodType<Action> = z.discriminatedUnion(
  "type",
  [
    z.object({ type: z.literal("assign"), personId: idField, taskId: idField, position: z.number().int().min(0).max(5).optional(), share: shareSchema.optional() }).strict(),
    z.object({ type: z.literal("unassign"), personId: idField, taskId: idField }).strict(),
    z.object({ type: z.literal("reorder"), personId: idField, taskIds: z.array(idField).max(6) }).strict(),
    z.object({ type: z.literal("setShare"), personId: idField, taskId: idField, share: shareSchema }).strict(),
    z.object({ type: z.literal("setOvertime"), personId: idField, level: z.union([z.literal(0), z.literal(1), z.literal(2)]) }).strict(),
    z
      .object({ type: z.literal("setReviews"), taskId: idField, count: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)], { message: "Reviews: 0 bis 3." }) })
      .strict(),
    z.object({ type: z.literal("startPeriod") }).strict(),
    z.object({ type: z.literal("advance"), ticks: z.number().int().min(1, "Mindestens 1 Takt.").max(100, "Höchstens 100 Takte.") }).strict(),
    z.object({ type: z.literal("decide"), eventId: idField, optionId: optionIdField }).strict(),
    z.object({ type: z.literal("defer"), eventId: idField }).strict(),
    z.object({ type: z.literal("acknowledge"), eventId: idField }).strict(),
    z.object({ type: z.literal("talk"), personId: idField }).strict(),
    z.object({ type: z.literal("teamEvent"), kind: z.enum(["mittagessen", "teamabend"]), personIds: z.array(idField).min(1).max(20) }).strict(),
    z.object({ type: z.literal("training"), personId: idField, area: areaSchema }).strict(),
    z.object({ type: z.literal("riskMeasure"), riskId: idField, measureId: idField }).strict(),
    z.object({ type: z.literal("riskAccept"), riskId: idField }).strict(),
    z.object({ type: z.literal("riskReview") }).strict(),
    z.object({ type: z.literal("submitReport"), report: statusReportInputSchema }).strict(),
  ],
  { message: "Unbekannte Aktion." },
)

// ---------- API-Eingaben (4.6) ----------

/** Höchstens 5'000 Aktionen je Lauf (4.5) */
export const MAX_ACTIONS_PER_RUN = 5000

export const runIdSchema = z.cuid({ message: "Ungültige Lauf-ID." })

/** POST /api/simulation/runs */
export const createRunSchema = z
  .object({
    scenarioId: z.string().min(1).max(40).regex(/^[a-z0-9-]+$/, "Ungültiges Szenario."),
    repeatOfRunId: runIdSchema.optional(),
  })
  .strict()

/** GET /api/simulation/runs?scenarioId= */
export const listRunsQuerySchema = z.object({
  scenarioId: z.string().min(1).max(40).regex(/^[a-z0-9-]+$/, "Ungültiges Szenario.").optional(),
})

/** POST /api/simulation/runs/[id]/actions */
export const appendActionsSchema = z
  .object({
    fromIndex: z.number().int().min(0, "fromIndex darf nicht negativ sein.").max(MAX_ACTIONS_PER_RUN),
    actions: z.array(actionSchema).min(1, "Mindestens eine Aktion.").max(200, "Höchstens 200 Aktionen je Anfrage."),
  })
  .strict()
