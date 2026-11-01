// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// POST /api/archsim/runs/[id]/finish
// Auth: erforderlich, nur Pro oder Admin. Rate-Limit 10/min.
// Body: {} (oder leer)
// Spielt nach, verlangt das Missionsende (Phase «beendet», sonst 422), berechnet Punkte und Sterne auf dem Server,
// speichert, vergibt Konto-Punkte (Bestwert-Verbesserung ÷ 10, nur neuer Startwert), meldet Station 11 und
// prüft die Abzeichen. Idempotent: ein zweiter Aufruf liefert das gespeicherte Ergebnis (neueAbzeichen leer).
// Antwort: { ergebnis, neueAbzeichen, bestwertVerbessert, punkte }

import { NextResponse } from "next/server"
import { checkAndAwardBadges } from "@/lib/badges"
import { LeitstandError } from "@/lib/leitstand"
import {
  NO_CACHE,
  errorResponse,
  limitAntwort,
  pruefeArchsimLimit,
  readJsonBody,
  requireArchsimUser,
  schliesseLaufAb,
} from "@/lib/architektur-leitstand"
import { abschlussSchema, laufIdSchema } from "@/lib/validations/architektur-leitstand"

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const auth = await requireArchsimUser()
    if (auth.response) return auth.response
    const userId = auth.user.id
    if (!pruefeArchsimLimit(userId, "abschliessen")) return limitAntwort()

    const { id } = await params
    const parsedId = laufIdSchema.safeParse(id)
    if (!parsedId.success) throw new LeitstandError(400, "BAD_REQUEST", "Ungültige Lauf-ID.")

    const parsed = abschlussSchema.safeParse(await readJsonBody(request, {}))
    if (!parsed.success) return NextResponse.json({ error: "Ungültige Eingabe." }, { status: 400, headers: NO_CACHE })

    const res = await schliesseLaufAb(userId, parsedId.data)
    const neueAbzeichen = res.erstmals ? await checkAndAwardBadges(userId) : []

    return NextResponse.json(
      { ergebnis: res.ergebnis, neueAbzeichen, bestwertVerbessert: res.bestwertVerbessert, punkte: res.punkte },
      { headers: NO_CACHE },
    )
  } catch (error) {
    return errorResponse(error, "[archsim/runs/id/finish/POST]", "Lauf konnte nicht abgeschlossen werden.")
  }
}
