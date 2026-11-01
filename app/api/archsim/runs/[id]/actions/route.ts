// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// POST /api/archsim/runs/[id]/actions
// Auth: erforderlich, nur Pro oder Admin. Rate-Limit 60/min. Body höchstens 256 KB.
// Body: { abIndex, aktionen: Aktion[] (1–200) }
// Hängt Aktionen ans Protokoll; der Server spielt das ganze Protokoll mit dem Simulator-Kern nach.
// 409: abIndex ≠ aktionCount (Antwort enthält aktionCount), Lauf nicht aktiv, veraltet oder ohne Modell
// 422: ungültige Aktion { error, code: "INVALID_ACTION", index, simCode, details } oder Höchstzahl; Protokoll unverändert
// Antwort: { aktionCount, tick, phase, zusammenfassung }

import { NextResponse } from "next/server"
import { LeitstandError } from "@/lib/leitstand"
import {
  NO_CACHE,
  errorResponse,
  haengeAktionenAn,
  limitAntwort,
  pruefeArchsimLimit,
  readJsonBody,
  requireArchsimUser,
} from "@/lib/architektur-leitstand"
import { aktionenAnhaengenSchema, laufIdSchema } from "@/lib/validations/architektur-leitstand"

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const auth = await requireArchsimUser()
    if (auth.response) return auth.response
    const userId = auth.user.id
    if (!pruefeArchsimLimit(userId, "aktionen")) return limitAntwort()

    const { id } = await params
    const parsedId = laufIdSchema.safeParse(id)
    if (!parsedId.success) throw new LeitstandError(400, "BAD_REQUEST", "Ungültige Lauf-ID.")

    const parsed = aktionenAnhaengenSchema.safeParse(await readJsonBody(request))
    if (!parsed.success) {
      const issue = parsed.error.issues[0]
      return NextResponse.json(
        { error: issue?.message ?? "Ungültige Eingabe.", path: issue?.path.map(String) ?? [] },
        { status: 400, headers: NO_CACHE },
      )
    }

    const res = await haengeAktionenAn(userId, parsedId.data, parsed.data)
    return NextResponse.json(res, { headers: NO_CACHE })
  } catch (error) {
    return errorResponse(error, "[archsim/runs/id/actions/POST]", "Aktionen konnten nicht gespeichert werden.")
  }
}
