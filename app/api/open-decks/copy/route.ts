// POST /api/open-decks/copy
// Auth: erforderlich
// Kopiert ein freigegebenes OpenDeck in den eigenen Account.

import { NextResponse } from "next/server"
import { getAuthSession } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { copyDeckSchema } from "@/lib/validations/openDeck"

export async function POST(request: Request) {
  try {
    const session = await getAuthSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Nicht autorisiert." }, { status: 401 })
    }

    const body: unknown = await request.json()
    const parsed = copyDeckSchema.safeParse(body)

    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message ?? "Ungueltige Eingabe."
      return NextResponse.json({ error: firstError }, { status: 400 })
    }

    const sourceDeck = await prisma.deck.findFirst({
      where: { id: parsed.data.deckId, shareStatus: "approved" },
      include: {
        cards: {
          select: { front: true, back: true, hint: true },
        },
      },
    })

    if (!sourceDeck) {
      return NextResponse.json({ error: "OpenDeck nicht gefunden." }, { status: 404 })
    }

    // Deck + Karten in einer Transaction kopieren
    const newDeck = await prisma.$transaction(async (tx) => {
      const deck = await tx.deck.create({
        data: {
          name: sourceDeck.name,
          description: sourceDeck.description,
          color: sourceDeck.color,
          icon: sourceDeck.icon,
          userId: session.user.id,
        },
      })

      if (sourceDeck.cards.length > 0) {
        await tx.card.createMany({
          data: sourceDeck.cards.map((card) => ({
            front: card.front,
            back: card.back,
            hint: card.hint,
            deckId: deck.id,
          })),
        })
      }

      return deck
    })

    return NextResponse.json({ success: true, deckId: newDeck.id })
  } catch (error) {
    console.error("[open-decks/copy/POST]", error)
    return NextResponse.json(
      { error: "Deck konnte nicht kopiert werden." },
      { status: 500 }
    )
  }
}
