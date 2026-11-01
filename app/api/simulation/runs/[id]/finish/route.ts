// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// POST /api/simulation/runs/[id]/finish
// Auth: erforderlich, nur Pro oder Admin. Rate-Limit 10/min.
// Body: {} (oder leer)
// Spielt nach, verlangt Phase «abgeschlossen» (sonst 422), berechnet die Punkte auf dem Server,
// speichert, vergibt Konto-Punkte (Bestwert-Verbesserung ÷ 10, nur Ernstfall mit neuem Startwert),
// setzt Station 23 im Lernpfad (pmgt) auf «erledigt» (nur Ernstfall) und prüft die Abzeichen.
// Idempotent: ein zweiter Aufruf liefert das gespeicherte Ergebnis (newBadges leer).
// Antwort: { result: RunResult, newBadges, improvedBest, pointsAwarded }

import { NextResponse } from "next/server"
import { z } from "zod"
import { checkAndAwardBadges } from "@/lib/badges"
import {
  LeitstandError,
  NO_CACHE,
  checkRateLimit,
  errorResponse,
  finishRun,
  rateLimitResponse,
  readJsonBody,
  requireLeitstandUser,
} from "@/lib/leitstand"
import { runIdSchema } from "@/lib/validations/simulation"

const finishSchema = z.object({}).strict()

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const auth = await requireLeitstandUser()
    if (auth.response) return auth.response
    const userId = auth.user.id
    if (!checkRateLimit(userId, "finish")) return rateLimitResponse()

    const { id } = await params
    const parsedId = runIdSchema.safeParse(id)
    if (!parsedId.success) throw new LeitstandError(400, "BAD_REQUEST", "Ungültige Lauf-ID.")

    const parsed = finishSchema.safeParse(await readJsonBody(request, {}))
    if (!parsed.success) {
      return NextResponse.json({ error: "Ungültige Eingabe." }, { status: 400, headers: NO_CACHE })
    }

    const outcome = await finishRun(userId, parsedId.data)
    const newBadges = outcome.firstFinish ? await checkAndAwardBadges(userId) : []

    return NextResponse.json(
      {
        result: outcome.result,
        newBadges,
        improvedBest: outcome.improvedBest,
        pointsAwarded: outcome.pointsAwarded,
      },
      { headers: NO_CACHE },
    )
  } catch (error) {
    return errorResponse(error, "[simulation/runs/id/finish/POST]", "Lauf konnte nicht abgeschlossen werden.")
  }
}
