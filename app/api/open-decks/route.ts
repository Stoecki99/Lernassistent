// GET /api/open-decks
// Auth: erforderlich
// Gibt alle freigegebenen OpenDecks zurueck.

import { NextResponse } from "next/server"
import { getAuthSession } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  try {
    const session = await getAuthSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Nicht autorisiert." }, { status: 401 })
    }

    const decks = await prisma.deck.findMany({
      where: { shareStatus: "approved" },
      include: {
        user: { select: { name: true } },
        _count: { select: { cards: true } },
      },
      orderBy: [{ isFeatured: "desc" }, { shareReviewedAt: "desc" }],
    })

    const serialized = decks.map((d) => ({
      id: d.id,
      name: d.name,
      description: d.description,
      color: d.color,
      icon: d.icon,
      cardCount: d._count.cards,
      authorName: d.user.name ?? "Anonym",
      isFeatured: d.isFeatured,
      sharedAt: d.shareReviewedAt?.toISOString() ?? d.createdAt.toISOString(),
    }))

    return NextResponse.json({ decks: serialized })
  } catch (error) {
    console.error("[open-decks/GET]", error)
    return NextResponse.json(
      { error: "OpenDecks konnten nicht geladen werden." },
      { status: 500 }
    )
  }
}
