// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// GET /api/archsim/runs?missionId=
// Auth: erforderlich, nur Pro oder Admin (sonst 403). Rate-Limit 60/min (Lesen).
// Eigene Läufe ohne Aktionsprotokoll und Modell, neueste zuerst, höchstens 30 (optional nur eine Mission),
// dazu je Mission: Bestwert (nur neuer Startwert), beste Sterne, aktiver Lauf, freigeschaltet.
// Antwort: { laeufe: LaufListenEintrag[], missionen: MissionsStand[] }

// POST /api/archsim/runs
// Auth: erforderlich, nur Pro oder Admin. Rate-Limit 10/min.
// Body: { missionId, wiederholungVon? }
// Neuer Lauf mit Startwert vom Server; ein aktiver Lauf derselben Mission wird abgebrochen.
// 409 LOCKED: Mission noch gesperrt (vorherige Mission ohne Stern). Station 11 «begonnen».
// Antwort 201: { id, missionId, seed, seedReused, missionVersion, engineVersion }

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import {
  NO_CACHE,
  errorResponse,
  limitAntwort,
  missionsStand,
  pruefeArchsimLimit,
  readJsonBody,
  requireArchsimUser,
  requireMission,
  starteLauf,
} from "@/lib/architektur-leitstand"
import { laeufeAbfrageSchema, laufStartenSchema } from "@/lib/validations/architektur-leitstand"

const LISTE_MAX = 30

export async function GET(request: Request) {
  try {
    const auth = await requireArchsimUser()
    if (auth.response) return auth.response
    const userId = auth.user.id
    if (!pruefeArchsimLimit(userId, "lesen")) return limitAntwort()

    const { searchParams } = new URL(request.url)
    const parsed = laeufeAbfrageSchema.safeParse({ missionId: searchParams.get("missionId") ?? undefined })
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe." }, { status: 400, headers: NO_CACHE })
    }
    const missionId = parsed.data.missionId
    if (missionId) requireMission(missionId)

    const [laeufe, missionen] = await Promise.all([
      prisma.architekturLauf.findMany({
        where: { userId, ...(missionId ? { missionId } : {}) },
        orderBy: { createdAt: "desc" },
        take: LISTE_MAX,
        select: {
          id: true,
          missionId: true,
          status: true,
          seedReused: true,
          aktionCount: true,
          tick: true,
          summary: true,
          score: true,
          stars: true,
          pointsAwarded: true,
          createdAt: true,
          finishedAt: true,
        },
      }),
      missionsStand(userId),
    ])

    return NextResponse.json(
      {
        laeufe: laeufe.map((l) => ({ ...l, createdAt: l.createdAt.toISOString(), finishedAt: l.finishedAt?.toISOString() ?? null })),
        missionen,
      },
      { headers: NO_CACHE },
    )
  } catch (error) {
    return errorResponse(error, "[archsim/runs/GET]", "Läufe konnten nicht geladen werden.")
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireArchsimUser()
    if (auth.response) return auth.response
    const userId = auth.user.id
    if (!pruefeArchsimLimit(userId, "starten")) return limitAntwort()

    const parsed = laufStartenSchema.safeParse(await readJsonBody(request))
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe." }, { status: 400, headers: NO_CACHE })
    }
    const lauf = await starteLauf(userId, parsed.data.missionId, parsed.data.wiederholungVon)
    return NextResponse.json(lauf, { status: 201, headers: NO_CACHE })
  } catch (error) {
    return errorResponse(error, "[archsim/runs/POST]", "Lauf konnte nicht gestartet werden.")
  }
}
