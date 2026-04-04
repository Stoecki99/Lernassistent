// GET /api/karten?deckId=X
// Auth: erforderlich
// Gibt alle Karten eines Decks zurueck (nur eigene Decks)

// POST /api/karten
// Auth: erforderlich
// Erstellt eine neue Karte in einem Deck (nur eigene Decks)

import { NextResponse } from "next/server"
import { getAuthSession } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { createCardSchema } from "@/lib/validations/karte"
import { z } from "zod"

const deckIdQuerySchema = z.string().cuid("Ungueltige Deck-ID.")

export async function GET(request: Request) {
  try {
    const session = await getAuthSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Nicht autorisiert." }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const deckId = searchParams.get("deckId")

    if (!deckId) {
      return NextResponse.json({ error: "deckId ist erforderlich." }, { status: 400 })
    }

    const parsedDeckId = deckIdQuerySchema.safeParse(deckId)
    if (!parsedDeckId.success) {
      return NextResponse.json({ error: "Ungueltige Deck-ID." }, { status: 400 })
    }

    const deck = await prisma.deck.findUnique({
      where: { id: deckId, userId: session.user.id },
      select: { id: true },
    })

    if (!deck) {
      return NextResponse.json({ error: "Deck nicht gefunden." }, { status: 404 })
    }

    const cards = await prisma.card.findMany({
      where: { deckId },
      select: {
        id: true,
        front: true,
        back: true,
        state: true,
        due: true,
        reps: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json(cards)
  } catch (error) {
    console.error("[karten/GET]", error)
    return NextResponse.json(
      { error: "Karten konnten nicht geladen werden." },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const session = await getAuthSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Nicht autorisiert." }, { status: 401 })
    }

    const body: unknown = await request.json()
    const parsed = createCardSchema.safeParse(body)

    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message ?? "Ungueltige Eingabe."
      return NextResponse.json({ error: firstError }, { status: 400 })
    }

    const { front, back, deckId } = parsed.data

    const deck = await prisma.deck.findUnique({
      where: { id: deckId, userId: session.user.id },
      select: { id: true },
    })

    if (!deck) {
      return NextResponse.json({ error: "Deck nicht gefunden." }, { status: 404 })
    }

    const card = await prisma.card.create({
      data: { front, back, deckId },
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

    return NextResponse.json(card, { status: 201 })
  } catch (error) {
    console.error("[karten/POST]", error)
    return NextResponse.json(
      { error: "Karte konnte nicht erstellt werden." },
      { status: 500 }
    )
  }
}
