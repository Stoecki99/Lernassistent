// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// lib/ipma/handlers.ts
// HTTP-Abläufe der Routen app/api/ipma/** (Spezifikation 6.6) nach dem Muster des Leitstands:
// Session → 401, Rate-Limit → 429 mit Retry-After, Körper ≤ 16 KB → 413, Zod → 400 mit erster Meldung,
// IDs als cuid → 400, fremde Versuche → 404, fachliche Fehler als IpmaError, sonst 500 generisch,
// immer «Cache-Control: private, no-store». Die Route-Dateien rufen diese Funktionen mit defaultDeps() auf;
// tests/ipma-api.test.ts mit einer Fake-Prisma-Schicht.

import { NextResponse } from "next/server"
import type { z } from "zod"
import {
  attemptIdSchema,
  createAttemptSchema,
  emptyBodySchema,
  pauseSchema,
  positionSchema,
  saveItemSchema,
  selfAssessSchema,
} from "@/lib/validations/ipma"
import {
  IpmaError,
  NO_CACHE,
  abortAttempt,
  assertAssessable,
  checkItem,
  createAttempt,
  errorResponse,
  finishAttempt,
  getAttemptView,
  getOverview,
  rateLimitResponse,
  readJsonBody,
  requireIpmaUser,
  saveAnswer,
  selfAssess,
  setPaused,
  submitAttempt,
  type IpmaDeps,
  type IpmaUser,
  type RatePurpose,
} from "./server"

/** Pfad-Parameter der Routen (Next liefert sie je nach Version als Objekt oder Promise) */
export interface RawParams {
  id?: string
  position?: string
}
export type ParamsInput = RawParams | Promise<RawParams>

/** Gemeinsamer Rahmen: Session, Rate-Limit, Fehlerantwort */
async function guarded(
  deps: IpmaDeps,
  purpose: RatePurpose,
  logTag: string,
  genericMessage: string,
  fn: (user: IpmaUser) => Promise<NextResponse>,
): Promise<NextResponse> {
  try {
    const auth = await requireIpmaUser(deps)
    if (auth.response) return auth.response
    if (!deps.rateLimit(auth.user.id, purpose)) return rateLimitResponse()
    return await fn(auth.user)
  } catch (error) {
    return errorResponse(error, logTag, genericMessage)
  }
}

function ok(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, { status, headers: NO_CACHE })
}

async function attemptId(params: ParamsInput): Promise<string> {
  const { id } = await params
  const parsed = attemptIdSchema.safeParse(id)
  if (!parsed.success) throw new IpmaError(400, "BAD_REQUEST", "Ungültige Versuch-ID.")
  return parsed.data
}

async function itemParams(params: ParamsInput): Promise<{ id: string; position: number }> {
  const id = await attemptId(params)
  const { position } = await params
  const parsed = positionSchema.safeParse(position)
  if (!parsed.success) throw new IpmaError(400, "BAD_REQUEST", "Ungültige Position.")
  return { id, position: parsed.data }
}

/** Körper lesen und mit Zod prüfen; Fehler → 400 mit der ersten Meldung */
async function parseBody<S extends z.ZodType>(request: Request, schema: S, emptyValue?: unknown): Promise<z.output<S>> {
  const parsed = schema.safeParse(await readJsonBody(request, emptyValue))
  if (!parsed.success) {
    throw new IpmaError(400, "BAD_REQUEST", parsed.error.issues[0]?.message ?? "Ungültige Eingabe.")
  }
  return parsed.data
}

/** GET /api/ipma/overview */
export function handleOverview(_request: Request, deps: IpmaDeps): Promise<NextResponse> {
  return guarded(deps, "read", "[ipma/overview/GET]", "Übersicht konnte nicht geladen werden.", async (user) =>
    ok(await getOverview(deps, user)))
}

/** POST /api/ipma/attempts */
export function handleCreateAttempt(request: Request, deps: IpmaDeps): Promise<NextResponse> {
  return guarded(deps, "create", "[ipma/attempts/POST]", "Versuch konnte nicht gestartet werden.", async (user) => {
    const input = await parseBody(request, createAttemptSchema)
    return ok(await createAttempt(deps, user.id, input), 201)
  })
}

/** GET /api/ipma/attempts/[id] */
export function handleGetAttempt(_request: Request, params: ParamsInput, deps: IpmaDeps): Promise<NextResponse> {
  return guarded(deps, "read", "[ipma/attempts/id/GET]", "Versuch konnte nicht geladen werden.", async (user) =>
    ok(await getAttemptView(deps, user, await attemptId(params))))
}

/** DELETE /api/ipma/attempts/[id] */
export function handleAbortAttempt(_request: Request, params: ParamsInput, deps: IpmaDeps): Promise<NextResponse> {
  return guarded(deps, "abort", "[ipma/attempts/id/DELETE]", "Versuch konnte nicht abgebrochen werden.", async (user) =>
    ok(await abortAttempt(deps, user.id, await attemptId(params))))
}

/** PUT /api/ipma/attempts/[id]/items/[position] */
export function handleSaveItem(request: Request, params: ParamsInput, deps: IpmaDeps): Promise<NextResponse> {
  return guarded(deps, "save", "[ipma/items/PUT]", "Antwort konnte nicht gespeichert werden.", async (user) => {
    const { id, position } = await itemParams(params)
    const input = await parseBody(request, saveItemSchema)
    return ok(await saveAnswer(deps, user.id, id, position, input))
  })
}

/** POST /api/ipma/attempts/[id]/items/[position]/check */
export function handleCheckItem(request: Request, params: ParamsInput, deps: IpmaDeps): Promise<NextResponse> {
  return guarded(deps, "check", "[ipma/items/check/POST]", "Antwort konnte nicht geprüft werden.", async (user) => {
    const { id, position } = await itemParams(params)
    await parseBody(request, emptyBodySchema, {})
    return ok(await checkItem(deps, user.id, id, position))
  })
}

/** PUT /api/ipma/attempts/[id]/items/[position]/self */
export function handleSelfAssess(request: Request, params: ParamsInput, deps: IpmaDeps): Promise<NextResponse> {
  return guarded(deps, "self", "[ipma/items/self/PUT]", "Selbstbewertung konnte nicht gespeichert werden.", async (user) => {
    const { id, position } = await itemParams(params)
    const { scores } = await parseBody(request, selfAssessSchema)
    return ok(await selfAssess(deps, user.id, id, position, scores))
  })
}

/**
 * POST /api/ipma/attempts/[id]/items/[position]/assess (4.3): Schnittstelle für AP5.
 * Reihenfolge wie 4.3: 401 → 403 PRO_REQUIRED (Free) → 429 → 404 → Vorbedingungen (409/422) →
 * bis AP5 502 AI_UNAVAILABLE (die Selbstbewertung bleibt massgebend).
 */
export function handleAssess(request: Request, params: ParamsInput, deps: IpmaDeps): Promise<NextResponse> {
  return (async () => {
    try {
      const auth = await requireIpmaUser(deps)
      if (auth.response) return auth.response
      const user = auth.user
      if (!(await deps.hasPro(user))) {
        throw new IpmaError(403, "PRO_REQUIRED", "Die Bewertung durch Claude ist im Pro-Abo enthalten.")
      }
      if (!deps.rateLimit(user.id, "assess")) return rateLimitResponse()
      const { id, position } = await itemParams(params)
      await parseBody(request, emptyBodySchema, {})
      await assertAssessable(deps, user.id, id, position)
      throw new IpmaError(502, "AI_UNAVAILABLE", "Die Bewertung durch Claude ist gerade nicht möglich. Deine Selbstbewertung gilt.")
    } catch (error) {
      return errorResponse(error, "[ipma/items/assess/POST]", "Bewertung konnte nicht durchgeführt werden.")
    }
  })()
}

/** POST /api/ipma/attempts/[id]/pause */
export function handlePause(request: Request, params: ParamsInput, deps: IpmaDeps): Promise<NextResponse> {
  return guarded(deps, "pause", "[ipma/attempts/id/pause/POST]", "Pause konnte nicht gespeichert werden.", async (user) => {
    const id = await attemptId(params)
    const { paused } = await parseBody(request, pauseSchema)
    return ok(await setPaused(deps, user.id, id, paused))
  })
}

/** POST /api/ipma/attempts/[id]/submit */
export function handleSubmit(request: Request, params: ParamsInput, deps: IpmaDeps): Promise<NextResponse> {
  return guarded(deps, "submit", "[ipma/attempts/id/submit/POST]", "Prüfung konnte nicht abgegeben werden.", async (user) => {
    const id = await attemptId(params)
    await parseBody(request, emptyBodySchema, {})
    return ok(await submitAttempt(deps, user, id))
  })
}

/** POST /api/ipma/attempts/[id]/finish */
export function handleFinish(request: Request, params: ParamsInput, deps: IpmaDeps): Promise<NextResponse> {
  return guarded(deps, "finish", "[ipma/attempts/id/finish/POST]", "Versuch konnte nicht abgeschlossen werden.", async (user) => {
    const id = await attemptId(params)
    await parseBody(request, emptyBodySchema, {})
    return ok(await finishAttempt(deps, user, id))
  })
}
