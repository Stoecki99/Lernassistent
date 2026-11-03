// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// lib/simulation/core.ts
// Rechenkern ohne Szenario-Daten (Spezifikation 4.2, 4.3). Einstieg für Client-Komponenten:
// Diese Datei importiert die Szenario-JSON nicht, damit sie nicht in jedem Browser-Bündel landen.
// Server und Tests importieren lib/simulation/index.ts (Kern + loadScenario).

import { getCtx } from "./context"
import { fitDetail, isWorkable } from "./work"
import { evalCondition, newMemo } from "./events"
import { changeRequestAvailable } from "./report"
import type { Condition, PersonId, Scenario, SimState, TaskId } from "./types"

export { ENGINE_VERSION, DEFAULT_PARAMS, resolveParams } from "./params"
export { SimError, type SimErrorCode } from "./errors"
export { createRun, applyAction, advance, replay } from "./engine"
export { computeSchedule, forecast } from "./schedule"
export { computeKpis, computeAmpeln } from "./kpi"
export { computeScore, scoreTermin, scoreKosten, scoreQualitaet, scoreStakeholder, scoreTeam, scoreFuehrung, starsFor } from "./score"
export { debrief } from "./debrief"
export { nextRandom } from "./rng"
export { dayOf, weekOf, weekdayOf, halfOf, tauAfter, tickOf, formatTick, formatTickShort } from "./calendar"
export type * from "./types"
export { AREAS, COST_CATEGORIES, HOUR_CATEGORIES } from "./types"
export { DEFAULT_AREA_LABELS, DEFAULT_BOARD_NAME, areaLabelsOf, boardNameOf } from "./labels"

/**
 * Passung einer Person auf einem Vorgang (3.4) mit dem aktuellen Profil.
 * team = weitere Personen im Vorgang (Kollegenhilfe); die Person selbst wird ignoriert.
 */
export function fitFor(state: SimState, scenario: Scenario, personId: PersonId, taskId: TaskId, team: PersonId[] = []): number {
  const ctx = getCtx(scenario)
  const person = state.people[personId]
  const task = ctx.tasks[taskId]
  if (!person || !task) return 0
  const colleagues = team.filter((id) => id !== personId && state.people[id]).map((id) => state.people[id].profile)
  return fitDetail(person.profile, task.profile, colleagues, ctx.params).fit
}

// ---------- Ergänzung AP4 (Oberfläche): reine Lesehilfen, ändern den Zustand nicht ----------

/** Bedingung auswerten (4.3 Condition), z. B. für eingeblendete Hinweise mit `{ state: … }`. */
export function evaluateCondition(state: SimState, scenario: Scenario, condition: Condition): boolean {
  return evalCondition(state, getCtx(scenario), condition, newMemo())
}

/** Ist ein Änderungsantrag im Statusbericht wählbar (2.9, 3.11)? */
export function isChangeRequestAvailable(state: SimState, scenario: Scenario, crId: string): boolean {
  return changeRequestAvailable(state, getCtx(scenario), crId)
}

/** Ist ein Vorgang im aktuellen Takt bearbeitbar (3.2: Vorgänger fertig, nicht blockiert, Phasentor)? */
export function isTaskWorkable(state: SimState, scenario: Scenario, taskId: TaskId): boolean {
  return isWorkable(state, getCtx(scenario), taskId, state.tick)
}
