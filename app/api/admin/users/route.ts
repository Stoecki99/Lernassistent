// PATCH /api/admin/users
// Auth: Admin-Token erforderlich
// Aendert den Plan eines Nutzers (Free/Pro).

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const updatePlanSchema = z.object({
  token: z.string(),
  userId: z.string().cuid("Ungueltige User-ID."),
  plan: z.enum(["free", "pro"]),
  planExpiresAt: z.string().datetime().nullable().optional(),
})

export async function PATCH(request: Request) {
  try {
    const body: unknown = await request.json()
    const parsed = updatePlanSchema.safeParse(body)

    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message ?? "Ungueltige Eingabe."
      return NextResponse.json({ error: firstError }, { status: 400 })
    }

    const { token, userId, plan, planExpiresAt } = parsed.data

    // Admin-Token pruefen
    const adminSecret = process.env.ADMIN_SECRET
    if (!adminSecret || token !== adminSecret) {
      return NextResponse.json({ error: "Nicht autorisiert." }, { status: 403 })
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    })

    if (!user) {
      return NextResponse.json({ error: "Nutzer nicht gefunden." }, { status: 404 })
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        plan,
        planExpiresAt: planExpiresAt ? new Date(planExpiresAt) : null,
        // Bei Wechsel auf Free: API-Tokens zuruecksetzen
        ...(plan === "free" && { apiTokensUsedThisMonth: 0 }),
      },
      select: {
        id: true,
        plan: true,
        planExpiresAt: true,
      },
    })

    return NextResponse.json({
      message: `Plan auf "${plan}" gesetzt.`,
      user: {
        ...updatedUser,
        planExpiresAt: updatedUser.planExpiresAt?.toISOString() ?? null,
      },
    })
  } catch (error) {
    console.error("[admin/users/PATCH]", error)
    return NextResponse.json(
      { error: "Plan konnte nicht aktualisiert werden." },
      { status: 500 }
    )
  }
}
