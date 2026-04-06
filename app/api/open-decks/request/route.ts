// POST /api/open-decks/request
// Auth: erforderlich
// Stellt eine Freigabe-Anfrage fuer ein eigenes Deck.

import { NextResponse } from "next/server"
import { getAuthSession } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { requestShareSchema, MIN_CARDS_FOR_SHARE } from "@/lib/validations/openDeck"

export async function POST(request: Request) {
  try {
    const session = await getAuthSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Nicht autorisiert." }, { status: 401 })
    }

    const body: unknown = await request.json()
    const parsed = requestShareSchema.safeParse(body)

    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message ?? "Ungueltige Eingabe."
      return NextResponse.json({ error: firstError }, { status: 400 })
    }

    const deck = await prisma.deck.findFirst({
      where: { id: parsed.data.deckId, userId: session.user.id },
      include: { _count: { select: { cards: true } } },
    })

    if (!deck) {
      return NextResponse.json({ error: "Deck nicht gefunden." }, { status: 404 })
    }

    if (deck.shareStatus === "pending") {
      return NextResponse.json({ error: "Freigabe-Anfrage laeuft bereits." }, { status: 400 })
    }

    if (deck.shareStatus === "approved") {
      return NextResponse.json({ error: "Deck ist bereits freigegeben." }, { status: 400 })
    }

    if (deck._count.cards < MIN_CARDS_FOR_SHARE) {
      return NextResponse.json(
        { error: `Das Deck muss mindestens ${MIN_CARDS_FOR_SHARE} Karten haben.` },
        { status: 400 }
      )
    }

    await prisma.deck.update({
      where: { id: deck.id },
      data: {
        shareStatus: "pending",
        shareRequestedAt: new Date(),
        shareReviewedAt: null,
        shareRejectionReason: null,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[open-decks/request/POST]", error)
    return NextResponse.json(
      { error: "Freigabe-Anfrage fehlgeschlagen." },
      { status: 500 }
    )
  }
}
