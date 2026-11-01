// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// POST /api/archsim/runs/[id]/model
// Auth: erforderlich, nur Pro oder Admin. Rate-Limit 30/min. Body höchstens 256 KB.
// Body: { modell: ArchModell } (Zod-Schema des Simulator-Kerns: höchstens 60 Elemente, 150 Verbindungen)
// Nur Missionen zum Modellieren, nur solange keine Aktion gespeichert ist (danach 409).
// Das Modell muss lauffähig sein (validiere(...).gueltig, sonst 422 INVALID_MODEL mit details);
// nicht erfüllte Anforderungen sind erlaubt und kosten beim Abschluss Punkte.
// Antwort: { ok: true, anforderungen: AnforderungErgebnis[] }

import { NextResponse } from "next/server"
import { LeitstandError } from "@/lib/leitstand"
import {
  NO_CACHE,
  errorResponse,
  limitAntwort,
  pruefeArchsimLimit,
  readJsonBody,
  requireArchsimUser,
  setzeModell,
} from "@/lib/architektur-leitstand"
import { laufIdSchema, modellSetzenSchema } from "@/lib/validations/architektur-leitstand"

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const auth = await requireArchsimUser()
    if (auth.response) return auth.response
    const userId = auth.user.id
    if (!pruefeArchsimLimit(userId, "modell")) return limitAntwort()

    const { id } = await params
    const parsedId = laufIdSchema.safeParse(id)
    if (!parsedId.success) throw new LeitstandError(400, "BAD_REQUEST", "Ungültige Lauf-ID.")

    const parsed = modellSetzenSchema.safeParse(await readJsonBody(request))
    if (!parsed.success) {
      const issue = parsed.error.issues[0]
      return NextResponse.json(
        { error: issue?.message ?? "Ungültiges Modell.", path: issue?.path.map(String) ?? [] },
        { status: 400, headers: NO_CACHE },
      )
    }

    const res = await setzeModell(userId, parsedId.data, parsed.data.modell)
    return NextResponse.json(res, { headers: NO_CACHE })
  } catch (error) {
    return errorResponse(error, "[archsim/runs/id/model/POST]", "Modell konnte nicht gespeichert werden.")
  }
}
