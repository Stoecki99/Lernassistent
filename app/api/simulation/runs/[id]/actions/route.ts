// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// POST /api/simulation/runs/[id]/actions
// Auth: erforderlich, nur Pro oder Admin. Rate-Limit 60/min. Body höchstens 256 KB.
// Body: { fromIndex, actions: Action[] (1–200) }
// Hängt Aktionen ans Protokoll; der Server spielt das ganze Protokoll nach (Spezifikation 4.5/4.6).
// 409: fromIndex ≠ actionCount (Antwort enthält actionCount), Lauf nicht aktiv oder veraltet
// 422: ungültige Aktion { error, code: "INVALID_ACTION", index, simCode, details }; Protokoll unverändert
// Antwort: { actionCount, tick, phase, summary }

import { NextResponse } from "next/server"
import {
  LeitstandError,
  NO_CACHE,
  appendActions,
  checkRateLimit,
  errorResponse,
  rateLimitResponse,
  readJsonBody,
  requireLeitstandUser,
} from "@/lib/leitstand"
import { appendActionsSchema, runIdSchema } from "@/lib/validations/simulation"

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const auth = await requireLeitstandUser()
    if (auth.response) return auth.response
    const userId = auth.user.id
    if (!checkRateLimit(userId, "actions")) return rateLimitResponse()

    const { id } = await params
    const parsedId = runIdSchema.safeParse(id)
    if (!parsedId.success) throw new LeitstandError(400, "BAD_REQUEST", "Ungültige Lauf-ID.")

    const body = await readJsonBody(request)
    const parsed = appendActionsSchema.safeParse(body)
    if (!parsed.success) {
      const issue = parsed.error.issues[0]
      return NextResponse.json(
        { error: issue?.message ?? "Ungültige Eingabe.", path: issue?.path.map(String) ?? [] },
        { status: 400, headers: NO_CACHE },
      )
    }

    const result = await appendActions(userId, parsedId.data, parsed.data)
    return NextResponse.json(result, { headers: NO_CACHE })
  } catch (error) {
    return errorResponse(error, "[simulation/runs/id/actions/POST]", "Aktionen konnten nicht gespeichert werden.")
  }
}
