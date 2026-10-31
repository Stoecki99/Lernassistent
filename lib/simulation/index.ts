// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// lib/simulation/index.ts
// Öffentliche Schnittstelle des Rechenkerns (Spezifikation 4.3). Nur diese Datei importieren.

import { getCtx } from "./context"
import { fitDetail } from "./work"
import type { PersonId, Scenario, SimState, TaskId } from "./types"

export { ENGINE_VERSION, DEFAULT_PARAMS, resolveParams } from "./params"
export { SimError, type SimErrorCode } from "./errors"
export { createRun, applyAction, advance, replay } from "./engine"
export { computeSchedule, forecast } from "./schedule"
export { computeKpis, computeAmpeln } from "./kpi"
export { computeScore, scoreTermin, scoreKosten, scoreQualitaet, scoreStakeholder, scoreTeam, scoreFuehrung, starsFor } from "./score"
export { debrief } from "./debrief"
export { nextRandom } from "./rng"
export { dayOf, weekOf, weekdayOf, halfOf, tauAfter, tickOf, formatTick, formatTickShort } from "./calendar"
export { loadScenario, SCENARIO_IDS } from "./scenarios"
export type * from "./types"
export { AREAS } from "./types"

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
