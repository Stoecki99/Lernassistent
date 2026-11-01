// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// GET /api/archsim/runs/[id]
// Auth: erforderlich, nur Pro oder Admin. Rate-Limit 60/min (Lesen, gemeinsam mit der Liste).
// Lauf mit Aktionsprotokoll und Modell zum Weiterspielen. Ein aktiver Lauf mit abweichender Missions- oder
// Kern-Version wird als «veraltet» gespeichert.
// Antwort: { id, missionId, missionVersion, engineVersion, seed, seedReused, status, aktionen, aktionCount, modell,
//            tick, summary, score, stars, ergebnis, pointsAwarded, veraltet, createdAt, finishedAt }

// DELETE /api/archsim/runs/[id]
// Auth: erforderlich, nur Pro oder Admin. Rate-Limit 10/min.
// Bricht einen aktiven Lauf ab (Status «abgebrochen», kein Löschen). Abgeschlossener Lauf → 409.
// Antwort: { ok: true }

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { LeitstandError } from "@/lib/leitstand"
import { istVeraltet, statusNachVersion } from "@/lib/architektur-leitstand-regeln"
import {
  NO_CACHE,
  errorResponse,
  limitAntwort,
  pruefeArchsimLimit,
  requireArchsimUser,
  requireMission,
} from "@/lib/architektur-leitstand"
import { laufIdSchema } from "@/lib/validations/architektur-leitstand"

interface RouteParams {
  params: Promise<{ id: string }>
}

async function laufId(params: RouteParams["params"]): Promise<string> {
  const { id } = await params
  const parsed = laufIdSchema.safeParse(id)
  if (!parsed.success) throw new LeitstandError(400, "BAD_REQUEST", "Ungültige Lauf-ID.")
  return parsed.data
}

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const auth = await requireArchsimUser()
    if (auth.response) return auth.response
    const userId = auth.user.id
    if (!pruefeArchsimLimit(userId, "lesen")) return limitAntwort()
    const id = await laufId(params)

    const lauf = await prisma.architekturLauf.findFirst({
      where: { id, userId },
      select: {
        id: true,
        missionId: true,
        missionVersion: true,
        engineVersion: true,
        seed: true,
        seedReused: true,
        status: true,
        aktionen: true,
        aktionCount: true,
        modell: true,
        tick: true,
        summary: true,
        score: true,
        stars: true,
        scoreDetail: true,
        pointsAwarded: true,
        createdAt: true,
        finishedAt: true,
      },
    })
    if (!lauf) throw new LeitstandError(404, "NOT_FOUND", "Lauf nicht gefunden.")

    const mission = requireMission(lauf.missionId)
    let status = lauf.status
    if (statusNachVersion(lauf, mission) === "veraltet") {
      await prisma.architekturLauf.updateMany({ where: { id, userId, status: "aktiv" }, data: { status: "veraltet" } })
      status = "veraltet"
    }

    const { scoreDetail, ...rest } = lauf
    return NextResponse.json(
      {
        ...rest,
        status,
        ergebnis: scoreDetail,
        veraltet: istVeraltet(lauf, mission),
        createdAt: lauf.createdAt.toISOString(),
        finishedAt: lauf.finishedAt?.toISOString() ?? null,
      },
      { headers: NO_CACHE },
    )
  } catch (error) {
    return errorResponse(error, "[archsim/runs/id/GET]", "Lauf konnte nicht geladen werden.")
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const auth = await requireArchsimUser()
    if (auth.response) return auth.response
    const userId = auth.user.id
    if (!pruefeArchsimLimit(userId, "abbrechen")) return limitAntwort()
    const id = await laufId(params)

    const res = await prisma.architekturLauf.updateMany({ where: { id, userId, status: "aktiv" }, data: { status: "abgebrochen" } })
    if (res.count === 0) {
      const lauf = await prisma.architekturLauf.findFirst({ where: { id, userId }, select: { status: true } })
      if (!lauf) throw new LeitstandError(404, "NOT_FOUND", "Lauf nicht gefunden.")
      if (lauf.status === "abgeschlossen") {
        throw new LeitstandError(409, "NOT_ACTIVE", "Ein abgeschlossener Lauf kann nicht abgebrochen werden.", { status: lauf.status })
      }
      // «abgebrochen» oder «veraltet»: nichts zu tun
    }
    return NextResponse.json({ ok: true }, { headers: NO_CACHE })
  } catch (error) {
    return errorResponse(error, "[archsim/runs/id/DELETE]", "Lauf konnte nicht abgebrochen werden.")
  }
}
