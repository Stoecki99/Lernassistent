// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// GET /api/simulation/runs?scenarioId=
// Auth: erforderlich, nur Pro oder Admin (sonst 403). Rate-Limit 60/min (Lesen).
// Eigene Läufe ohne Aktionsprotokoll, neueste zuerst, höchstens 20.
// best = Bestwert des Szenarios (ohne scenarioId: «wolkenried»), nur Ernstfall und nur Läufe mit neuem Startwert.
// Antwort: { runs: RunListItem[], best: { score, stars, runId } | null }

// POST /api/simulation/runs
// Auth: erforderlich, nur Pro oder Admin. Rate-Limit 10/min.
// Body: { scenarioId, repeatOfRunId? }
// Neuer Lauf; ein aktiver Lauf desselben Szenarios wird abgebrochen. Station 23 «begonnen».
// Antwort 201: { id, scenarioId, seed, seedReused, scenarioVersion, engineVersion }

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import {
  ERNSTFALL_SCENARIO_ID,
  NO_CACHE,
  checkRateLimit,
  createRunForUser,
  errorResponse,
  findBest,
  rateLimitResponse,
  readJsonBody,
  requireLeitstandUser,
  requireScenario,
} from "@/lib/leitstand"
import { createRunSchema, listRunsQuerySchema } from "@/lib/validations/simulation"

const LIST_LIMIT = 20

export async function GET(request: Request) {
  try {
    const auth = await requireLeitstandUser()
    if (auth.response) return auth.response
    const userId = auth.user.id
    if (!checkRateLimit(userId, "read")) return rateLimitResponse()

    const { searchParams } = new URL(request.url)
    const parsed = listRunsQuerySchema.safeParse({ scenarioId: searchParams.get("scenarioId") ?? undefined })
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message ?? "Ungültige Eingabe."
      return NextResponse.json({ error: firstError }, { status: 400, headers: NO_CACHE })
    }
    const scenarioId = parsed.data.scenarioId
    const bestScenario = requireScenario(scenarioId ?? ERNSTFALL_SCENARIO_ID)

    const [runs, best] = await Promise.all([
      prisma.simulationRun.findMany({
        where: { userId, ...(scenarioId ? { scenarioId } : {}) },
        orderBy: { createdAt: "desc" },
        take: LIST_LIMIT,
        select: {
          id: true,
          scenarioId: true,
          scenarioVersion: true,
          engineVersion: true,
          status: true,
          seedReused: true,
          actionCount: true,
          tick: true,
          summary: true,
          score: true,
          stars: true,
          pointsAwarded: true,
          createdAt: true,
          updatedAt: true,
          finishedAt: true,
        },
      }),
      bestScenario.kind === "main" ? findBest(prisma, userId, bestScenario.id) : Promise.resolve(null),
    ])

    return NextResponse.json(
      {
        runs: runs.map((run) => ({
          ...run,
          createdAt: run.createdAt.toISOString(),
          updatedAt: run.updatedAt.toISOString(),
          finishedAt: run.finishedAt?.toISOString() ?? null,
        })),
        best,
      },
      { headers: NO_CACHE },
    )
  } catch (error) {
    return errorResponse(error, "[simulation/runs/GET]", "Läufe konnten nicht geladen werden.")
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireLeitstandUser()
    if (auth.response) return auth.response
    const userId = auth.user.id
    if (!checkRateLimit(userId, "createRun")) return rateLimitResponse()

    const body = await readJsonBody(request)
    const parsed = createRunSchema.safeParse(body)
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message ?? "Ungültige Eingabe."
      return NextResponse.json({ error: firstError }, { status: 400, headers: NO_CACHE })
    }

    const created = await createRunForUser(userId, parsed.data.scenarioId, parsed.data.repeatOfRunId)
    return NextResponse.json(created, { status: 201, headers: NO_CACHE })
  } catch (error) {
    return errorResponse(error, "[simulation/runs/POST]", "Lauf konnte nicht gestartet werden.")
  }
}
