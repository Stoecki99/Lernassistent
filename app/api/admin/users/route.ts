// PATCH /api/admin/users
// Auth: Eingeloggt + ADMIN_EMAIL
// Aendert den Plan eines Nutzers (Free/Pro).

import { NextResponse } from "next/server"
import { getAuthSession } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const updatePlanSchema = z.object({
  userId: z.string().cuid("Ungueltige User-ID."),
  plan: z.enum(["free", "pro"]),
  planExpiresAt: z.string().datetime().nullable().optional(),
})

export async function PATCH(request: Request) {
  try {
    const session = await getAuthSession()
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Nicht autorisiert." }, { status: 401 })
    }

    // Admin-E-Mail pruefen
    const adminEmail = process.env.ADMIN_EMAIL
    if (!adminEmail || session.user.email !== adminEmail) {
      return NextResponse.json({ error: "Nicht autorisiert." }, { status: 403 })
    }

    const body: unknown = await request.json()
    const parsed = updatePlanSchema.safeParse(body)

    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message ?? "Ungueltige Eingabe."
      return NextResponse.json({ error: firstError }, { status: 400 })
    }

    const { userId, plan, planExpiresAt } = parsed.data

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
