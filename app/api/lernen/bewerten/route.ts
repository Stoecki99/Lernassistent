// POST /api/lernen/bewerten
// Auth: erforderlich
// Body: { cardId, rating (1-4), duration (Sekunden) }
// Aktualisiert FSRS-Werte der Karte, erstellt Review-Eintrag.
// Aktualisiert Streak und Punkte des Users.

import { NextResponse } from "next/server"
import { getAuthSession } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { bewertungSchema } from "@/lib/validations/lernen"
import {
  type FSRSCard,
  type RatingType,
  scheduleCard,
} from "@/lib/fsrs"

/** Punkte pro bewertete Karte */
const POINTS_PER_REVIEW = 10

export async function POST(request: Request) {
  try {
    const session = await getAuthSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Nicht autorisiert." }, { status: 401 })
    }

    const body: unknown = await request.json()
    const parsed = bewertungSchema.safeParse(body)

    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message ?? "Ungueltige Eingabe."
      return NextResponse.json({ error: firstError }, { status: 400 })
    }

    const { cardId, rating, duration } = parsed.data

    // Karte laden und pruefen ob sie dem User gehoert
    const card = await prisma.card.findFirst({
      where: {
        id: cardId,
        deck: { userId: session.user.id },
      },
      select: {
        id: true,
        due: true,
        stability: true,
        difficulty: true,
        elapsedDays: true,
        scheduledDays: true,
        reps: true,
        lapses: true,
        state: true,
        lastReview: true,
      },
    })

    if (!card) {
      return NextResponse.json(
        { error: "Karte nicht gefunden." },
        { status: 404 }
      )
    }

    // FSRS-Berechnung durchfuehren
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

    const result = scheduleCard(fsrsCard, rating as RatingType)
    const updatedCard = result.card

    // Karte und Review in einer Transaktion aktualisieren
    await prisma.$transaction([
      // Karte aktualisieren
      prisma.card.update({
        where: { id: cardId },
        data: {
          due: updatedCard.due,
          stability: updatedCard.stability,
          difficulty: updatedCard.difficulty,
          elapsedDays: updatedCard.elapsedDays,
          scheduledDays: updatedCard.scheduledDays,
          reps: updatedCard.reps,
          lapses: updatedCard.lapses,
          state: updatedCard.state,
          lastReview: updatedCard.lastReview,
        },
      }),
      // Review-Eintrag erstellen
      prisma.review.create({
        data: {
          cardId,
          rating,
          duration,
        },
      }),
    ])

    // Streak und Punkte aktualisieren
    await updateUserStreak(session.user.id)

    return NextResponse.json({
      success: true,
      card: {
        scheduledDays: updatedCard.scheduledDays,
        due: updatedCard.due.toISOString(),
        state: updatedCard.state,
      },
    })
  } catch (error) {
    console.error("[lernen/bewerten]", error)
    return NextResponse.json(
      { error: "Bewertung konnte nicht gespeichert werden." },
      { status: 500 }
    )
  }
}

/**
 * Aktualisiert Streak, longestStreak und Punkte des Users.
 * Streak-Logik:
 * - lastStudyDate === gestern: streak++
 * - lastStudyDate === heute: streak bleibt (nur Punkte addieren)
 * - Sonst: streak = 1 (Neustart)
 */
async function updateUserStreak(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      streak: true,
      longestStreak: true,
      points: true,
      lastStudyDate: true,
    },
  })

  if (!user) return

  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000)

  let newStreak = user.streak

  if (user.lastStudyDate) {
    const lastDate = new Date(
      user.lastStudyDate.getFullYear(),
      user.lastStudyDate.getMonth(),
      user.lastStudyDate.getDate()
    )

    if (lastDate.getTime() === today.getTime()) {
      // Heute schon gelernt: Streak bleibt, nur Punkte addieren
      await prisma.user.update({
        where: { id: userId },
        data: { points: user.points + POINTS_PER_REVIEW },
      })
      return
    } else if (lastDate.getTime() === yesterday.getTime()) {
      // Gestern gelernt: Streak erhoehen
      newStreak = user.streak + 1
    } else {
      // Laenger als gestern: Streak zuruecksetzen
      newStreak = 1
    }
  } else {
    // Erster Tag: Streak = 1
    newStreak = 1
  }

  const newLongestStreak = Math.max(user.longestStreak, newStreak)

  await prisma.user.update({
    where: { id: userId },
    data: {
      streak: newStreak,
      longestStreak: newLongestStreak,
      points: user.points + POINTS_PER_REVIEW,
      lastStudyDate: now,
    },
  })
}
