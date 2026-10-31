// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// lib/simulation/params.ts
// Startwerte der Parameter (Spezifikation 3.16). Nur AP5 «Abstimmung» ändert sie, mit Begründung.

import type { Params, ParamsOverride } from "./types"

/** Version des Rechenkerns. Erhöhen, sobald alte Aktionsprotokolle anders verlaufen würden (4.5). */
export const ENGINE_VERSION = 1

export const DEFAULT_PARAMS: Params = {
  hoursPerTick: 4, // 3.1
  periodTicks: 40, // 3.1
  hardStopTick: 100, // 3.1 (Szenario: calendar.hardStopTick hat Vorrang)
  otStep: 0.2, // 3.3
  otSurcharge: 0.25, // 3.5
  help: 2, // 3.4 Kollegenhilfe
  cGap: 0.06, // 3.4
  cOver: 0.025, // 3.4
  fitMin: 0.35, // 3.4
  fitMax: 1.15, // 3.4
  teamLinear: 0.05, // 3.4
  teamQuad: 0.01, // 3.4
  teamMin: 0.6, // 3.4
  phaseFactor: { orientierung: 0.95, sturm: 0.92, normierung: 1.0, leistung: 1.04 }, // 3.4
  motBase: 85, // 3.7
  motDrift: 0.03, // 3.7
  learnStart: 0.9, // 3.4
  learnHours: 16, // 3.4
  otTolerance: { tief: 2, mittel: 5, hoch: 8 }, // 2.5
  defBase: 0.05, // 3.6
  reviewShare: 0.03, // 3.6
  reviewDetect: 0.5, // 3.6
  fixEarly: 1.0, // 3.6
  fixLate: 3.0, // 3.6
  rhoRef: 2.5, // 3.6
  riskProb: [0.05, 0.15, 0.3, 0.5, 0.7], // 3.9
  talkBoost: 8, // 3.7
  talkCooldownDays: 5, // 3.7
  calendarMaxPerDay: 4, // 3.5
  starThresholds: [500, 680, 820], // 3.13
}

/** Mischt `scenario.params` über DEFAULT_PARAMS (Abschnitt 3: «Ein Szenario darf einzelne Werte überschreiben»). */
export function resolveParams(override?: ParamsOverride): Params {
  if (!override) return DEFAULT_PARAMS
  return {
    ...DEFAULT_PARAMS,
    ...override,
    phaseFactor: { ...DEFAULT_PARAMS.phaseFactor, ...override.phaseFactor },
    otTolerance: { ...DEFAULT_PARAMS.otTolerance, ...override.otTolerance },
  }
}
