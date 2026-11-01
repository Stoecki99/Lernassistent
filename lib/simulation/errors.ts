// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// lib/simulation/errors.ts
// Fehler des Rechenkerns mit deutscher Meldung für die Oberfläche (Spezifikation 4.3).

export type SimErrorCode =
  | "WRONG_PHASE"
  | "UNKNOWN_ID"
  | "INVALID_ACTION"
  | "LIMIT"
  | "PLAN_INCOMPLETE"
  | "EVENT_PENDING"
  | "CALENDAR_FULL"
  | "NOT_ALLOWED"

export class SimError extends Error {
  readonly code: SimErrorCode
  /** Zusatzangaben, z. B. Liste unbesetzter Vorgänge bei PLAN_INCOMPLETE */
  readonly details: string[]
  /** Index der fehlerhaften Aktion beim Nachspielen (replay, 4.6 «422 mit Index») */
  actionIndex?: number

  constructor(code: SimErrorCode, message: string, details: string[] = []) {
    super(message)
    this.name = "SimError"
    this.code = code
    this.details = details
  }
}
