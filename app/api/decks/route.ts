// GET /api/decks
// Auth: erforderlich
// Gibt alle Decks des eingeloggten Nutzers zurueck (mit Karten-Anzahl)

// POST /api/decks
// Auth: erforderlich
// Erstellt ein neues Deck

import { NextResponse } from "next/server"
import { getAuthSession } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { createDeckSchema } from "@/lib/validations/deck"

export async function GET() {
  try {
    const session = await getAuthSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Nicht autorisiert." }, { status: 401 })
    }

    const decks = await prisma.deck.findMany({
      where: { userId: session.user.id },
      include: {
        _count: {
          select: { cards: true },
        },
      },
      orderBy: { updatedAt: "desc" },
    })

    const result = decks.map((deck) => ({
      id: deck.id,
      name: deck.name,
      description: deck.description,
      color: deck.color,
      icon: deck.icon,
      cardCount: deck._count.cards,
      createdAt: deck.createdAt,
      updatedAt: deck.updatedAt,
    }))

    return NextResponse.json(result)
  } catch (error) {
    console.error("[decks/GET]", error)
    return NextResponse.json(
      { error: "Decks konnten nicht geladen werden." },
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
    const parsed = createDeckSchema.safeParse(body)

    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message ?? "Ungueltige Eingabe."
      return NextResponse.json({ error: firstError }, { status: 400 })
    }

    const { name, description, color, icon } = parsed.data

    const deck = await prisma.deck.create({
      data: {
        name,
        description: description || null,
        color,
        icon,
        userId: session.user.id,
      },
      select: {
        id: true,
        name: true,
        description: true,
        color: true,
        icon: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    return NextResponse.json(deck, { status: 201 })
  } catch (error) {
    console.error("[decks/POST]", error)
    return NextResponse.json(
      { error: "Deck konnte nicht erstellt werden." },
      { status: 500 }
    )
  }
}
