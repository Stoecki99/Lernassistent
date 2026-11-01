// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// lib/simulation/types.ts
// Typen des Leitstands (Projektsimulator). Normativ: docs/leitstand-spezifikation.md, Abschnitt 4.3.
// Ergänzungen gegenüber 4.3 sind mit «Ergänzung AP1» markiert und in der Spezifikation nachgetragen.

export const AREAS = ["bau", "ent", "dat", "ux", "kom"] as const
export type AreaId = (typeof AREAS)[number]
/** Stufen 0–6 je Gebiet, Reihenfolge wie AREAS */
export type Profile = [number, number, number, number, number]

export type TaskId = string
export type PersonId = string
export type StakeholderId = string
export type RiskId = string
export type EventId = string
export type Need = "anerkennung" | "klarheit" | "autonomie" | "entwicklung" | "zugehoerigkeit" | "sicherheit"
export type Trait = "gruendlich" | "schnell" | "verzettelt" | "lernt_schnell"
export type Tolerance = "tief" | "mittel" | "hoch"
export type Ampel = "gruen" | "gelb" | "rot"
export type Rating = "gut" | "mittel" | "schlecht"
export type Channel = "mail" | "anruf" | "besuch" | "system"

// ---------- Parameter (3.16) ----------
/** Ergänzung AP1: konkrete Schlüssel statt `[key: string]: unknown` (Abschnitt 3.16). */
export interface Params {
  hoursPerTick: number
  periodTicks: number
  hardStopTick: number
  otStep: number
  otSurcharge: number
  help: number
  cGap: number
  cOver: number
  fitMin: number
  fitMax: number
  teamLinear: number
  teamQuad: number
  teamMin: number
  phaseFactor: Record<TeamPhase, number>
  motBase: number
  motDrift: number
  learnStart: number
  learnHours: number
  otTolerance: Record<Tolerance, number>
  defBase: number
  reviewShare: number
  reviewDetect: number
  fixEarly: number
  fixLate: number
  rhoRef: number
  riskProb: [number, number, number, number, number]
  talkBoost: number
  talkCooldownDays: number
  calendarMaxPerDay: number
  starThresholds: [number, number, number]
}

/** Teilweise Überschreibung durch das Szenario; Objekte werden schlüsselweise gemischt. */
export type ParamsOverride = Partial<Omit<Params, "phaseFactor" | "otTolerance">> & {
  phaseFactor?: Partial<Record<TeamPhase, number>>
  otTolerance?: Partial<Record<Tolerance, number>>
}

// ---------- Szenario ----------
export type ReportArea = "termine" | "kosten" | "qualitaet" | "team" | "risiken"

export interface Scenario {
  id: string
  version: string
  kind: "intro" | "main"
  title: string
  briefing: string
  calendar: {
    periods: Array<{ id: number; startTick: number; endTick: number; label: string; report: "status" | "final" }>
    targetDay: number
    planEndDay: number
    hardStopTick: number
  }
  budget: { total: number; currency: "CHF" }
  phases: Array<{ id: "R" | "E"; label: string; gateTick: number | null }>
  tasks: TaskDef[]
  people: PersonDef[]
  stakeholders: StakeholderDef[]
  risks: RiskDef[]
  events: EventDef[]
  changeRequests: ChangeRequestDef[]
  reportMeasures: Array<{ id: string; label: string; areas: ReportArea[] }>
  coach: { name: string }
  defaultDecider: { name: string; stakeholderId: StakeholderId }
  trainingCost: number
  hints?: HintDef[]
  params?: ParamsOverride
}

export interface TaskDef {
  id: TaskId
  name: string
  description: string
  phase: "R" | "E"
  predecessors: TaskId[]
  effortHours: number
  plannedPersons: number
  plannedRate: number
  profile: Profile
  minDays?: number
  milestone?: string
  test?: { covers: TaskId[]; detectionRate: number }
}

export interface PersonDef {
  id: PersonId
  name: string
  age: number
  role: string
  origin: "kern" | "linie" | "lieferant" | "beratung"
  lineManager?: StakeholderId
  pensum: number
  availabilityOverrides?: Array<{ fromDay: number; toDay: number; pensum: number }>
  rate: number
  profile: Profile
  startMotivation: number
  needs: Need[]
  traits: Trait[]
  overtimeTolerance: Tolerance
  hidden?: boolean
  bio: string
  strengths: string
  weaknesses: string
  overtimeBehaviour: string
}

export interface StakeholderDef {
  id: StakeholderId
  name: string
  role: string
  influence: number
  interest: number
  startSatisfaction: number
}

export interface RiskDef {
  id: RiskId
  category: string
  title: string
  description: string
  probability: number
  impact: number
  window: { fromDay: number; toDay: number }
  visible: { fromDay?: number; byEvent?: EventId }
  onOccur: { eventId?: EventId; effects?: Effect[]; message?: string }
  measures: RiskMeasureDef[]
}

export interface RiskMeasureDef {
  id: string
  label: string
  strategy: "vermeiden" | "vermindern" | "uebertragen" | "akzeptieren"
  costChf: number
  effort?: { personId: PersonId; hours: number } | { taskId: TaskId; hours: number }
  deltaProbability?: number
  deltaImpact?: number
  sideEffects?: Effect[]
}

export type Deadline = { type: "woche" } | { type: "takte"; ticks: number } | { type: "keinAufschub" }

export interface EventDef {
  id: EventId
  channel: Channel
  sender: { name: string; personId?: PersonId; stakeholderId?: StakeholderId }
  title: string
  body: string
  bodyVariants?: Array<{ when: Condition; body: string }>
  trigger: Trigger
  deadline: Deadline
  options: OptionDef[]
  defaultOptionId?: string
  icb: string[]
  stations: string[]
  scaleByRisk?: RiskId
  maxOccurrences?: number
}

export type Trigger =
  | { type: "tick"; tick: number }
  | { type: "condition"; fromTick: number; toTick: number; when: Condition; chance?: number; everyTicks?: number }
  | { type: "risk"; riskId: RiskId }
  | { type: "followUp"; eventId: EventId; optionId?: string; delayTicks: number }
  | { type: "phaseChange"; teamPhase: TeamPhase }

export type Condition =
  | { all: Condition[] }
  | { any: Condition[] }
  | { not: Condition }
  | { metric: MetricKey; op: "<" | "<=" | ">" | ">=" | "=="; value: number }
  | { flag: string; equals?: string | number | boolean }
  | { task: TaskId; status: TaskStatus | "gestartet" }
  | { taskDefects: TaskId; op: ">" | "<"; value: number }
  | { person: PersonId; metric: "motivation" | "overtimeStreak"; op: ">" | "<"; value: number }
  | { decided: EventId; optionId?: string }
  | { talkedWith: PersonId; sinceTick?: number }
  /** Ergänzung AP1: Risikomassnahme genommen (z. B. E29 A «wenn R10-M1 genommen», E36 A). */
  | { riskMeasure: RiskId; measureId: string }

/**
 * Ergänzung AP1: "lastHonesty" (H des letzten Berichts, 100 ohne Bericht; für E24 A).
 * "trueOverall" ist als Zahl kodiert: gruen = 0, gelb = 1, rot = 2.
 */
export type MetricKey =
  | "spi" | "cpi" | "qi" | "teamMotivation" | "si" | "rmi" | "day" | "restmaengel" | "trueOverall" | "lastHonesty"

export type PersonTarget = PersonId | "alle" | "kern" | "linie" | "lieferant" | "beratung"

export type Effect = (
  | { type: "motivation"; target: PersonTarget; delta: number; needFilter?: Need }
  | { type: "stakeholder"; id: StakeholderId; delta: number }
  | { type: "effort"; taskId: TaskId; hours: number; fallbackTaskId?: TaskId }
  /** Ergänzung AP1: `of` = Bezugsgrösse, "plan" (Standard) oder "rest" (z. B. E13 B «Rest −50 %»). */
  | { type: "effortPercent"; taskId: TaskId; percentOfPlan: number; of?: "plan" | "rest" }
  | { type: "plan"; taskId: TaskId; effortHours: number; bacDelta: number }
  | { type: "cost"; chf: number; category: CostCategory; label: string }
  | { type: "hours"; personId: PersonId; hours: number }
  /** Ergänzung AP1: `fromDay` (1-basiert, absolut) ersetzt `fromOffsetTicks`, z. B. «Ferien Tag 27–31». */
  | { type: "absence"; personId: PersonId | "zufallLinie"; fromOffsetTicks: number; ticks: number; reason: string; fromDay?: number }
  | { type: "pensum"; personId: PersonId; delta: number; fromOffsetTicks: number; ticks: number; fromDay?: number }
  | { type: "block"; taskId: TaskId | "laufendeEnt3"; ticks: number }
  | { type: "defects"; taskId: TaskId; delta: number }
  | { type: "risk"; riskId: RiskId; deltaProbability?: number; deltaImpact?: number; reveal?: boolean }
  | { type: "revealAllRisks" }
  | { type: "qualification"; personId: PersonId; area: AreaId; delta: number; delayTicks: number }
  | { type: "addPerson"; personId: PersonId; fromOffsetTicks: number; learnStart?: number }
  | { type: "removePerson"; personId: PersonId; fromOffsetTicks: number }
  | { type: "overtime"; target: PersonTarget; level: 0 | 1 | 2; ticks?: number }
  | { type: "flag"; key: string; value: string | number | boolean }
  | { type: "budget"; deltaChf: number }
  | { type: "teamPhase"; phase: TeamPhase }
  | { type: "changeRequestAvailable"; crId: string }
  | { type: "applyChangeRequest"; crId: string }
  | { type: "restmaengelFactor"; factor: number }
  | { type: "riskReviewed" }
  /** Ergänzung AP1: zwei Personen arbeiten `ticks` Takte nicht im selben Vorgang, sonst Leistung × factor (E07 C). */
  | { type: "separate"; personIds: [PersonId, PersonId]; ticks: number; factor: number }
  /** Ergänzung AP1: alle Restmängel beheben, Vorgang + hoursPerDefect je Mangel (E35 B). */
  | { type: "fixAllDefects"; taskId: TaskId; hoursPerDefect: number }
) & { delayTicks?: number; chance?: number; when?: Condition }

export type EffectType = Effect["type"]

export interface OptionDef {
  id: string
  label: string
  rating: Rating
  effects: Effect[]
  feedback: string
}

export interface ChangeRequestDef {
  id: string
  label: string
  description: string
  availableWhen?: Condition
  approveWhen: Condition
  effects: Effect[]
}

export interface HintDef {
  id: string
  when: HintCondition
  text: string
  view?: ViewId
}
export type HintCondition =
  | { ui: "viewOpened"; view: ViewId }
  | { ui: "firstAssignment" }
  | { ui: "planningDone" }
  | { ui: "firstEvent" }
  | { ui: "firstFeedback" }
  | { ui: "finalReport" }
  | { state: Condition }
export type ViewId =
  | "uebersicht" | "vorgaenge" | "team" | "plan" | "auslastung" | "kalender"
  | "posteingang" | "risiken" | "budget" | "bericht" | "nachbesprechung"

// ---------- Zustand ----------
export type RunPhase = "planung" | "lauf" | "periodenende" | "abschlussbericht" | "abgeschlossen"
export type TaskStatus = "offen" | "bereit" | "laufend" | "fertig"
export type TeamPhase = "orientierung" | "sturm" | "normierung" | "leistung"
export type CostCategory = "arbeit" | "ueberzeit" | "fuehrung" | "anlass" | "weiterbildung" | "risiko" | "ereignis"
export type HourCategory =
  | "arbeit" | "ueberzeit" | "review" | "korrektur_frueh" | "korrektur_spaet" | "weiterbildung" | "fuehrung"

/** Höchster Prognose-Endtag im Statusbericht (Formular und Schema); assessHonesty misst nur bis hierhin */
export const REPORT_FORECAST_DAY_MAX = 60

export const COST_CATEGORIES: readonly CostCategory[] = [
  "arbeit", "ueberzeit", "fuehrung", "anlass", "weiterbildung", "risiko", "ereignis",
]
export const HOUR_CATEGORIES: readonly HourCategory[] = [
  "arbeit", "ueberzeit", "review", "korrektur_frueh", "korrektur_spaet", "weiterbildung", "fuehrung",
]

export interface SimState {
  engineVersion: number
  scenarioId: string
  scenarioVersion: string
  seed: number
  rng: number
  tick: number
  eventsCheckedTick: number
  phase: RunPhase
  period: number
  pause: PauseReason | null
  tasks: Record<TaskId, TaskState>
  people: Record<PersonId, PersonState>
  stakeholders: Record<StakeholderId, number>
  risks: Record<RiskId, RiskState>
  inbox: InboxItem[]
  scheduledEffects: Array<{ atTick: number; effect: Effect; source: string }>
  calendar: CalendarEntry[]
  finance: { ac: number; byCategory: Record<CostCategory, number>; budget: number; budgetSupplements: number }
  hours: Record<HourCategory, number>
  teamPhase: TeamPhase
  teamPhaseSinceTick: number
  flags: Record<string, string | number | boolean>
  changeRequests: Record<string, "verfuegbar" | "beantragt" | "genehmigt" | "abgelehnt">
  reports: ReportRecord[]
  decisions: DecisionRecord[]
  history: KpiPoint[]
  timeline: TimelineEntry[]
  /** Ergänzung AP1: aktive Trennungen aus Wirkung `separate` (E07 C). */
  separations: Array<{ personIds: [PersonId, PersonId]; untilTick: number; factor: number }>
  stats: {
    defaults: number
    riskReviewedWeeks: number[]
    burnouts: number
    lateDefectsFound: number
    earlyDefectsFound: number
    idleCoreDays: number
    minTeamMotivation: number
    ressourcenausgleich: { okDays: number; allDays: number }
    /** Ergänzung AP1: Risiken mit Massnahme vor Fensterbeginn (Abzeichen «Risikoprofi», 3.13). */
    risksTreatedEarly: RiskId[]
  }
  result: RunResult | null
}

export type PauseReason = "ereignis" | "periodenende" | "projektende" | "abbruch"

export interface TaskState {
  status: TaskStatus
  plannedEffort: number
  bac: number
  remaining: number
  done: number
  paidHours: number
  hoursByPerson: Record<PersonId, number>
  startTick: number | null
  endTick: number | null
  blockedUntilTick: number
  reviews: number
  reviewsDone: number
  latentDefects: number
  foundEarly: number
  foundLate: number
  testDone: boolean
}

export interface Assignment {
  taskId: TaskId
  share: 0.25 | 0.5 | 0.75 | 1
}

export interface PersonState {
  available: boolean
  learnStart: number
  assignments: Assignment[]
  overtime: 0 | 1 | 2
  overtimeStreakDays: number
  overtimeTotalDays: number
  motivation: number
  profile: Profile
  pensumMods: Array<{ fromTick: number; toTick: number; delta: number }>
  absences: Array<{ fromTick: number; toTick: number; reason: string }>
  hoursByArea: Record<AreaId, number>
  idleDays: number
  lastTalkTick: number | null
  lastLunchTick: number | null
  lastTeamEveningTick: number | null
  trainingDone: boolean
  pendingQualifications: Array<{ area: AreaId; delta: number; readyTick: number }>
  reassignmentsThisWeek: number
  /** Ergänzung AP1: noch nicht abgearbeitete Termin- und Massnahmenstunden (3.3 «Termine»). */
  appointmentHours: number
  /** Ergänzung AP1: bezahlte Projektstunden des laufenden Tags (Ressourcenausgleich, Leerlauf). */
  dayPaidHours: number
  /** Ergänzung AP1: Wochenzähler für die Stakeholder-Wochenregeln (3.8). */
  weekIdleDays: number
  weekOvertimeDays: number
  /** Ergänzung AP1: letzter Takt mit bezahlten Projektstunden (Teammotivation, 3.7). */
  lastWorkTick: number | null
}

export interface RiskState {
  probability: number
  impact: number
  visible: boolean
  status: "offen" | "eingetreten" | "vorbei"
  measuresTaken: string[]
  accepted: boolean
  occurredTick: number | null
}

export interface InboxItem {
  eventId: EventId
  arrivedTick: number
  /** Takt, bei dessen Ereignisprüfung der Standardentscheid fällt; null = kein Aufschub. */
  deadlineTick: number | null
  status: "neu" | "aufgeschoben" | "entschieden" | "standard" | "gelesen"
  optionId: string | null
  bodyVariantIndex: number | null
}

export interface CalendarEntry {
  id: string
  tick: number
  kind: "gespraech" | "mittagessen" | "teamabend" | "weiterbildung" | "workshop" | "zusatzbericht"
  personIds: PersonId[]
  area?: AreaId
  /** Ergänzung AP1: Stunden je teilnehmende Person (fehlt = 0). */
  hours?: number
}

export interface DecisionRecord {
  eventId: EventId
  optionId: string
  tick: number
  rating: Rating
  defaulted: boolean
}

export interface ReportRecord {
  kind: "status" | "final"
  tick: number
  input: StatusReportInput
  truth: { ampeln: Record<ReportArea | "gesamt", Ampel>; progress: number; forecastEndDay: number; eac: number }
  honesty: number
  findings: string[]
  board?: BoardDecision
}

export interface StatusReportInput {
  ampeln: Record<ReportArea | "gesamt", Ampel>
  progressPercent: number
  forecastEndDay: number
  forecastCostChf: number
  deviations: string
  measures: string[]
  measuresText: string
  budgetSupplementChf: number
  changeRequestIds: string[]
}

export interface BoardDecision {
  phaseRelease: "erteilt" | "mitAuflage" | null
  budgetApprovedChf: number
  changeRequests: Record<string, "genehmigt" | "abgelehnt">
  reasons: string[]
}

export interface KpiPoint {
  tick: number
  pv: number
  ev: number
  ac: number
  spi: number
  cpi: number
  eac: number
  qi: number
  motivation: number
  /** SI absolut 0–100 (Anzeige in % des Startwerts über KpiSnapshot.siPercent) */
  si: number
  rmi: number
  productivity: number
  forecastEndDay: number
}

export interface TimelineEntry {
  tick: number
  kind: "ereignis" | "entscheid" | "standard" | "risiko" | "meilenstein" | "bericht" | "gemeinderat" | "vorgang"
  ref: string
  text: string
  magnitude: number
}

export interface RunResult {
  ended: "fertig" | "abbruch"
  endDay: number
  score: { total: number; termin: number; kosten: number; qualitaet: number; stakeholder: number; team: number; fuehrung: number }
  stars: 0 | 1 | 2 | 3
  restmaengel: number
  achievements: string[]
}

// ---------- Aktionen ----------
export type Action =
  | { type: "assign"; personId: PersonId; taskId: TaskId; position?: number; share?: Assignment["share"] }
  | { type: "unassign"; personId: PersonId; taskId: TaskId }
  | { type: "reorder"; personId: PersonId; taskIds: TaskId[] }
  | { type: "setShare"; personId: PersonId; taskId: TaskId; share: Assignment["share"] }
  | { type: "setOvertime"; personId: PersonId; level: 0 | 1 | 2 }
  | { type: "setReviews"; taskId: TaskId; count: 0 | 1 | 2 | 3 }
  | { type: "startPeriod" }
  | { type: "advance"; ticks: number }
  | { type: "decide"; eventId: EventId; optionId: string }
  | { type: "defer"; eventId: EventId }
  | { type: "acknowledge"; eventId: EventId }
  | { type: "talk"; personId: PersonId }
  | { type: "teamEvent"; kind: "mittagessen" | "teamabend"; personIds: PersonId[] }
  | { type: "training"; personId: PersonId; area: AreaId }
  | { type: "riskMeasure"; riskId: RiskId; measureId: string }
  | { type: "riskAccept"; riskId: RiskId }
  | { type: "riskReview" }
  | { type: "submitReport"; report: StatusReportInput }

// ---------- Ergebnisse der Schnittstelle (Ergänzung AP1, in 4.3 nur genannt) ----------
export interface ScheduleRow {
  taskId: TaskId
  duration: number
  /** Frühester Anfang (FA) als Zeitpunkt in Tagen ab Projektstart */
  es: number
  /** Frühestes Ende (FE) */
  ef: number
  /** Spätester Anfang (SA) */
  ls: number
  /** Spätestes Ende (SE) */
  lf: number
  /** Gesamtpuffer (GP) */
  totalFloat: number
  /** Freier Puffer (FP) */
  freeFloat: number
  critical: boolean
}

export interface KpiSnapshot {
  tick: number
  /** Zeitpunkt τ in Tagen (3.1) */
  tau: number
  day: number
  bac: number
  pv: number
  ev: number
  ac: number
  sv: number
  cv: number
  spi: number
  cpi: number
  eac: number
  etc: number
  vac: number
  budget: number
  qi: number
  rho: number
  teamMotivation: number
  si: number
  siPercent: number
  rmi: number
  productivity: number
  forecastEndDay: number
  restmaengel: number
  ressourcenausgleich: number
  hours: Record<HourCategory, number>
  costByCategory: Record<CostCategory, number>
  reviews: { count: number; foundEarly: number; foundLate: number; fixHoursEarly: number; fixHoursLate: number }
  ampeln: Record<ReportArea | "gesamt", Ampel>
}

export interface LessonLearned {
  id: string
  text: string
  stations: string[]
  icb: string[]
  lostPoints: number
  positive: boolean
}

export interface Debrief {
  turningPoints: TimelineEntry[]
  lessons: LessonLearned[]
  reports: Array<{
    kind: ReportRecord["kind"]
    tick: number
    reported: ReportRecord["input"]
    truth: ReportRecord["truth"]
    honesty: number
    findings: string[]
  }>
  result: RunResult | null
}
