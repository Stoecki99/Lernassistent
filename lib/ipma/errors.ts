// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// lib/ipma/errors.ts
// Fachlicher Fehler des Prüfungssimulators (Spezifikation 6.7), Muster LeitstandError.
// Eigene Datei ohne Next- oder Prisma-Abhängigkeit, damit die reinen Module (selection.ts) sie werfen
// können; lib/ipma/server.ts (AP3) exportiert sie weiter und ergänzt errorResponse.

export type IpmaErrorCode =
  | "BAD_REQUEST"
  | "NOT_FOUND"
  | "CONFLICT"
  | "ACTIVE_EXISTS"
  | "NOT_ACTIVE"
  | "LOCKED"
  | "TIME_UP"
  | "POOL_TOO_SMALL"
  | "NOT_SUBMITTED"
  | "NOT_OPEN"
  | "SELF_FIRST"
  | "PRO_REQUIRED"
  | "BUDGET"
  | "DAILY_LIMIT"
  | "AI_INVALID"
  | "AI_REFUSED"
  | "AI_UNAVAILABLE"

/** Fachlicher Fehler mit HTTP-Status; die Meldung ist für die Oberfläche bestimmt (6.7). */
export class IpmaError extends Error {
  readonly status: 400 | 403 | 404 | 409 | 413 | 422 | 429 | 502
  readonly code: IpmaErrorCode
  readonly extra: Record<string, unknown>

  constructor(status: IpmaError["status"], code: IpmaErrorCode, message: string, extra: Record<string, unknown> = {}) {
    super(message)
    this.name = "IpmaError"
    this.status = status
    this.code = code
    this.extra = extra
  }
}
