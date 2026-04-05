// GET /api/lernen/naechste?deckId=X
// Auth: erforderlich
// Gibt die naechste faellige Karte zurueck (FSRS-basiert).
// Prioritaet: 1. Neue Karten (state=0), 2. Faellige Karten (due <= now)
// Gibt null wenn keine Karten faellig.

import { NextResponse } from "next/server"
import { getAuthSession } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { deckIdQuerySchema } from "@/lib/validations/lernen"
import {
  type FSRSCard,
  type RatingType,
  Rating,
  previewSchedule,
  formatInterval,
} from "@/lib/fsrs"

interface PreviewItem {
  rating: RatingType
  label: string
  scheduledDays: number
  intervalText: string
}

export async function GET(request: Request) {
  try {
    const session = await getAuthSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Nicht autorisiert." }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const deckId = searchParams.get("deckId")

    if (!deckId) {
      return NextResponse.json(
        { error: "deckId ist erforderlich." },
        { status: 400 }
      )
    }

    const countOnly = searchParams.get("countOnly") === "true"

    const parsed = deckIdQuerySchema.safeParse(deckId)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Ungueltige Deck-ID." },
        { status: 400 }
      )
    }

    // Pruefe ob das Deck dem User gehoert
    const deck = await prisma.deck.findUnique({
      where: { id: deckId, userId: session.user.id },
      select: { id: true, name: true },
    })

    if (!deck) {
      return NextResponse.json(
        { error: "Deck nicht gefunden." },
        { status: 404 }
      )
    }

    const now = new Date()

    // Count-only mode: nur Zaehler zurueckgeben
    if (countOnly) {
      const [dueCount, newCount] = await Promise.all([
        prisma.card.count({
          where: {
            deckId,
            state: { gt: 0 },
            due: { lte: now },
          },
        }),
        prisma.card.count({
          where: {
            deckId,
            state: 0,
          },
        }),
      ])

      return NextResponse.json({ dueCount, newCount })
    }

    // Zaehle Karten fuer Fortschrittsanzeige
    const totalCards = await prisma.card.count({
      where: { deckId },
    })

    const dueCards = await prisma.card.count({
      where: {
        deckId,
        OR: [
          { state: 0 }, // Neue Karten
          { due: { lte: now } }, // Faellige Karten
        ],
      },
    })

    // Prioritaet 1: Neue Karten (state=0)
    let card = await prisma.card.findFirst({
      where: { deckId, state: 0 },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        front: true,
        back: true,
        state: true,
        stability: true,
        difficulty: true,
        elapsedDays: true,
        scheduledDays: true,
        reps: true,
        lapses: true,
        due: true,
        lastReview: true,
      },
    })

    // Prioritaet 2: Faellige Karten (due <= now, state > 0)
    if (!card) {
      card = await prisma.card.findFirst({
        where: {
          deckId,
          state: { gt: 0 },
          due: { lte: now },
        },
        orderBy: { due: "asc" }, // Aelteste zuerst
        select: {
          id: true,
          front: true,
          back: true,
          state: true,
          stability: true,
          difficulty: true,
          elapsedDays: true,
          scheduledDays: true,
          reps: true,
          lapses: true,
          due: true,
          lastReview: true,
        },
      })
    }

    // Keine Karten faellig
    if (!card) {
      return NextResponse.json({
        card: null,
        progress: { total: totalCards, due: 0, done: totalCards },
      })
    }

    // Vorschau-Intervalle berechnen
    const fsrsCard: FSRSCard = {
      due: card.due,
      stability: card.stability,
      difficulty: card.difficulty,
      elapsedDays: card.elapsedDays,
      scheduledDays: card.scheduledDays,
      reps: card.reps,
      lapses: card.lapses,
      state: card.state as FSRSCard["state"],
      lastReview: card.lastReview,
    }

    const previews = previewSchedule(fsrsCard)
    const previewItems: PreviewItem[] = [
      {
        rating: Rating.Again,
        label: "Nochmal",
        scheduledDays: previews[Rating.Again].scheduledDays,
        intervalText: formatInterval(
          previews[Rating.Again].scheduledDays,
          previews[Rating.Again].due
        ),
      },
      {
        rating: Rating.Hard,
        label: "Schwer",
        scheduledDays: previews[Rating.Hard].scheduledDays,
        intervalText: formatInterval(
          previews[Rating.Hard].scheduledDays,
          previews[Rating.Hard].due
        ),
      },
      {
        rating: Rating.Good,
        label: "Gut",
        scheduledDays: previews[Rating.Good].scheduledDays,
        intervalText: formatInterval(
          previews[Rating.Good].scheduledDays,
          previews[Rating.Good].due
        ),
      },
      {
        rating: Rating.Easy,
        label: "Leicht",
        scheduledDays: previews[Rating.Easy].scheduledDays,
        intervalText: formatInterval(
          previews[Rating.Easy].scheduledDays,
          previews[Rating.Easy].due
        ),
      },
    ]

    // Berechne bereits heute gelernte Karten
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    const reviewedToday = await prisma.review.count({
      where: {
        card: { deckId },
        createdAt: { gte: todayStart },
      },
    })

    return NextResponse.json({
      card: {
        id: card.id,
        front: card.front,
        back: card.back,
        state: card.state,
      },
      previews: previewItems,
      progress: {
        total: totalCards,
        due: dueCards,
        done: reviewedToday,
      },
    })
  } catch (error) {
    console.error("[lernen/naechste]", error)
    return NextResponse.json(
      { error: "Naechste Karte konnte nicht geladen werden." },
      { status: 500 }
    )
  }
}
