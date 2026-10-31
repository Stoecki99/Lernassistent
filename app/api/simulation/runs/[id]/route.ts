// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// GET /api/simulation/runs/[id]
// Auth: erforderlich, nur Pro oder Admin
// Lauf mit Aktionsprotokoll zum Weiterspielen. Ein aktiver Lauf mit abweichender Szenario- oder
// Rechenkern-Version wird als «veraltet» gespeichert; outdated = Version weicht ab.
// Antwort: { id, scenarioId, scenarioVersion, engineVersion, seed, seedReused, status, actions, actionCount,
//            tick, summary, score, stars, result, pointsAwarded, outdated, createdAt, updatedAt, finishedAt }

// DELETE /api/simulation/runs/[id]
// Auth: erforderlich, nur Pro oder Admin
// Bricht einen aktiven Lauf ab (Status «abgebrochen», kein Löschen). Abgeschlossener Lauf → 409.
// Antwort: { ok: true }

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import {
  LeitstandError,
  NO_CACHE,
  checkRunVersion,
  errorResponse,
  isOutdated,
  requireLeitstandUser,
  requireScenario,
} from "@/lib/leitstand"
import { runIdSchema } from "@/lib/validations/simulation"

interface RouteParams {
  params: Promise<{ id: string }>
}

async function parseId(params: RouteParams["params"]): Promise<string> {
  const { id } = await params
  const parsed = runIdSchema.safeParse(id)
  if (!parsed.success) throw new LeitstandError(400, "BAD_REQUEST", "Ungültige Lauf-ID.")
  return parsed.data
}

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const auth = await requireLeitstandUser()
    if (auth.response) return auth.response
    const userId = auth.user.id
    const id = await parseId(params)

    const run = await prisma.simulationRun.findFirst({
      where: { id, userId },
      select: {
        id: true,
        scenarioId: true,
        scenarioVersion: true,
        engineVersion: true,
        seed: true,
        seedReused: true,
        status: true,
        actions: true,
        actionCount: true,
        tick: true,
        summary: true,
        score: true,
        stars: true,
        scoreDetail: true,
        pointsAwarded: true,
        createdAt: true,
        updatedAt: true,
        finishedAt: true,
      },
    })
    if (!run) throw new LeitstandError(404, "NOT_FOUND", "Lauf nicht gefunden.")

    const scenario = requireScenario(run.scenarioId)
    let status = run.status
    if (checkRunVersion(run, scenario) === "veraltet") {
      await prisma.simulationRun.updateMany({ where: { id, userId, status: "aktiv" }, data: { status: "veraltet" } })
      status = "veraltet"
    }

    const { scoreDetail, ...rest } = run
    return NextResponse.json(
      {
        ...rest,
        status,
        result: scoreDetail,
        outdated: isOutdated(run, scenario),
        createdAt: run.createdAt.toISOString(),
        updatedAt: run.updatedAt.toISOString(),
        finishedAt: run.finishedAt?.toISOString() ?? null,
      },
      { headers: NO_CACHE },
    )
  } catch (error) {
    return errorResponse(error, "[simulation/runs/id/GET]", "Lauf konnte nicht geladen werden.")
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const auth = await requireLeitstandUser()
    if (auth.response) return auth.response
    const userId = auth.user.id
    const id = await parseId(params)

    const updated = await prisma.simulationRun.updateMany({
      where: { id, userId, status: "aktiv" },
      data: { status: "abgebrochen" },
    })
    if (updated.count === 0) {
      const run = await prisma.simulationRun.findFirst({ where: { id, userId }, select: { status: true } })
      if (!run) throw new LeitstandError(404, "NOT_FOUND", "Lauf nicht gefunden.")
      if (run.status === "abgeschlossen") {
        throw new LeitstandError(409, "NOT_ACTIVE", "Ein abgeschlossener Lauf kann nicht abgebrochen werden.", { status: run.status })
      }
      // «abgebrochen» oder «veraltet»: nichts zu tun
    }
    return NextResponse.json({ ok: true }, { headers: NO_CACHE })
  } catch (error) {
    return errorResponse(error, "[simulation/runs/id/DELETE]", "Lauf konnte nicht abgebrochen werden.")
  }
}
