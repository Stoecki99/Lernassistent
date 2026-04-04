// GET /api/decks/[id]
// Auth: erforderlich
// Gibt ein einzelnes Deck mit Karten-Anzahl und Fortschritt zurueck

// PUT /api/decks/[id]
// Auth: erforderlich
// Aktualisiert Deck (Name, Farbe, Icon, Beschreibung)

// DELETE /api/decks/[id]
// Auth: erforderlich
// Loescht ein Deck (mit allen Karten via Cascade)

import { NextResponse } from "next/server"
import { getAuthSession } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { updateDeckSchema } from "@/lib/validations/deck"

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const session = await getAuthSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Nicht autorisiert." }, { status: 401 })
    }

    const { id } = await params

    const deck = await prisma.deck.findUnique({
      where: { id, userId: session.user.id },
      include: {
        _count: {
          select: { cards: true },
        },
        cards: {
          select: {
            state: true,
          },
        },
      },
    })

    if (!deck) {
      return NextResponse.json({ error: "Deck nicht gefunden." }, { status: 404 })
    }

    const totalCards = deck._count.cards
    const newCards = deck.cards.filter((c) => c.state === 0).length
    const learningCards = deck.cards.filter((c) => c.state === 1 || c.state === 3).length
    const reviewCards = deck.cards.filter((c) => c.state === 2).length

    return NextResponse.json({
      id: deck.id,
      name: deck.name,
      description: deck.description,
      color: deck.color,
      icon: deck.icon,
      cardCount: totalCards,
      progress: {
        newCards,
        learningCards,
        reviewCards,
      },
      createdAt: deck.createdAt,
      updatedAt: deck.updatedAt,
    })
  } catch (error) {
    console.error("[decks/[id]/GET]", error)
    return NextResponse.json(
      { error: "Deck konnte nicht geladen werden." },
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
    const parsed = updateDeckSchema.safeParse(body)

    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message ?? "Ungueltige Eingabe."
      return NextResponse.json({ error: firstError }, { status: 400 })
    }

    const existing = await prisma.deck.findUnique({
      where: { id, userId: session.user.id },
      select: { id: true },
    })

    if (!existing) {
      return NextResponse.json({ error: "Deck nicht gefunden." }, { status: 404 })
    }

    const { name, description, color, icon } = parsed.data

    const updatedDeck = await prisma.deck.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description: description || null }),
        ...(color !== undefined && { color }),
        ...(icon !== undefined && { icon }),
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

    return NextResponse.json(updatedDeck)
  } catch (error) {
    console.error("[decks/[id]/PUT]", error)
    return NextResponse.json(
      { error: "Deck konnte nicht aktualisiert werden." },
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

    const existing = await prisma.deck.findUnique({
      where: { id, userId: session.user.id },
      select: { id: true },
    })

    if (!existing) {
      return NextResponse.json({ error: "Deck nicht gefunden." }, { status: 404 })
    }

    await prisma.deck.delete({ where: { id } })

    return NextResponse.json({ message: "Deck erfolgreich geloescht." })
  } catch (error) {
    console.error("[decks/[id]/DELETE]", error)
    return NextResponse.json(
      { error: "Deck konnte nicht geloescht werden." },
      { status: 500 }
    )
  }
}
