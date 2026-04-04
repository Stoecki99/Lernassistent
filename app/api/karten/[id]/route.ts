// GET /api/karten/[id]
// Auth: erforderlich
// Gibt eine einzelne Karte zurueck (nur eigene Karten)

// PUT /api/karten/[id]
// Auth: erforderlich
// Aktualisiert eine Karte (nur eigene Karten)

// DELETE /api/karten/[id]
// Auth: erforderlich
// Loescht eine Karte (nur eigene Karten)

import { NextResponse } from "next/server"
import { getAuthSession } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { updateCardSchema } from "@/lib/validations/karte"

interface RouteParams {
  params: Promise<{ id: string }>
}

async function getOwnedCard(cardId: string, userId: string) {
  return prisma.card.findFirst({
    where: {
      id: cardId,
      deck: { userId },
    },
    select: {
      id: true,
      front: true,
      back: true,
      deckId: true,
      state: true,
      due: true,
      stability: true,
      difficulty: true,
      reps: true,
      lapses: true,
      createdAt: true,
      updatedAt: true,
    },
  })
}

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const session = await getAuthSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Nicht autorisiert." }, { status: 401 })
    }

    const { id } = await params

    const card = await getOwnedCard(id, session.user.id)

    if (!card) {
      return NextResponse.json({ error: "Karte nicht gefunden." }, { status: 404 })
    }

    return NextResponse.json(card)
  } catch (error) {
    console.error("[karten/[id]/GET]", error)
    return NextResponse.json(
      { error: "Karte konnte nicht geladen werden." },
      { status: 500 }
    )
  }
}

export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const session = await getAuthSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Nicht autorisiert." }, { status: 401 })
    }

    const { id } = await params
    const body: unknown = await request.json()
    const parsed = updateCardSchema.safeParse(body)

    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message ?? "Ungueltige Eingabe."
      return NextResponse.json({ error: firstError }, { status: 400 })
    }

    const existing = await getOwnedCard(id, session.user.id)

    if (!existing) {
      return NextResponse.json({ error: "Karte nicht gefunden." }, { status: 404 })
    }

    const { front, back } = parsed.data

    const updatedCard = await prisma.card.update({
      where: { id },
      data: {
        ...(front !== undefined && { front }),
        ...(back !== undefined && { back }),
      },
      select: {
        id: true,
        front: true,
        back: true,
        state: true,
        due: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    return NextResponse.json(updatedCard)
  } catch (error) {
    console.error("[karten/[id]/PUT]", error)
    return NextResponse.json(
      { error: "Karte konnte nicht aktualisiert werden." },
      { status: 500 }
    )
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const session = await getAuthSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Nicht autorisiert." }, { status: 401 })
    }

    const { id } = await params

    const existing = await getOwnedCard(id, session.user.id)

    if (!existing) {
      return NextResponse.json({ error: "Karte nicht gefunden." }, { status: 404 })
    }

    await prisma.card.delete({ where: { id } })

    return NextResponse.json({ message: "Karte erfolgreich geloescht." })
  } catch (error) {
    console.error("[karten/[id]/DELETE]", error)
    return NextResponse.json(
      { error: "Karte konnte nicht geloescht werden." },
      { status: 500 }
    )
  }
}
