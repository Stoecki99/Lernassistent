// GET /api/statistiken
// Auth: erforderlich
// Gibt umfassende Nutzer-Statistiken zurueck (Streak, Punkte, Lernzeit, Deck-Fortschritte, Badges).

import { NextResponse } from "next/server"
import { getAuthSession } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

interface DailyActivity {
  date: string
  cardsStudied: number
  minutesStudied: number
}

interface DeckProgress {
  deckId: string
  deckName: string
  deckIcon: string
  deckColor: string
  totalCards: number
  reviewCards: number
  progressPercent: number
}

interface ReviewRecord {
  createdAt: Date
  duration: number
}

interface QuizSummary {
  totalQuestions: number
  correctAnswers: number
}

interface DeckWithCards {
  id: string
  name: string
  icon: string
  color: string
  cards: Array<{ state: number }>
}

export async function GET() {
  try {
    const session = await getAuthSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Nicht autorisiert." }, { status: 401 })
    }

    const userId = session.user.id
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const weekStart = new Date(todayStart.getTime() - 6 * 24 * 60 * 60 * 1000)

    const [
      user,
      cardsStudiedToday,
      cardsStudiedWeek,
      cardsStudiedTotal,
      quizResults,
      reviewsLast7Days,
      decksWithCards,
      badgeCount,
      totalDurationResult,
    ] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { streak: true, longestStreak: true, points: true },
      }),
      prisma.review.count({
        where: {
          card: { deck: { userId } },
          createdAt: { gte: todayStart },
        },
      }),
      prisma.review.count({
        where: {
          card: { deck: { userId } },
          createdAt: { gte: weekStart },
        },
      }),
      prisma.review.count({
        where: { card: { deck: { userId } } },
      }),
      prisma.quizResult.findMany({
        where: { userId },
        select: { totalQuestions: true, correctAnswers: true },
      }) as Promise<QuizSummary[]>,
      prisma.review.findMany({
        where: {
          card: { deck: { userId } },
          createdAt: { gte: weekStart },
        },
        select: { createdAt: true, duration: true },
      }) as Promise<ReviewRecord[]>,
      prisma.deck.findMany({
        where: { userId },
        select: {
          id: true,
          name: true,
          icon: true,
          color: true,
          cards: { select: { state: true } },
        },
      }) as Promise<DeckWithCards[]>,
      prisma.userBadge.count({
        where: { userId },
      }),
      prisma.review.aggregate({
        where: { card: { deck: { userId } } },
        _sum: { duration: true },
      }),
    ])

    if (!user) {
      return NextResponse.json({ error: "Nutzer nicht gefunden." }, { status: 404 })
    }

    // Quiz-Durchschnittsnote
    const quizAverage = calculateQuizAverage(quizResults)

    // Lernzeit heute
    const todayReviews = reviewsLast7Days.filter(
      (r: ReviewRecord) => r.createdAt >= todayStart
    )
    const todayMinutes = Math.round(
      todayReviews.reduce((s: number, r: ReviewRecord) => s + r.duration, 0) / 60
    )

    // Gesamte Lernzeit
    const totalMinutes = Math.round((totalDurationResult._sum.duration ?? 0) / 60)

    // Letzte 7 Tage Aktivitaet
    const last7Days = buildLast7DaysActivity(reviewsLast7Days, todayStart)

    // Deck-Fortschritte
    const deckProgress: DeckProgress[] = decksWithCards.map((deck: DeckWithCards) => {
      const totalCards = deck.cards.length
      const reviewCards = deck.cards.filter((c: { state: number }) => c.state === 2).length
      const progressPercent = totalCards > 0 ? Math.round((reviewCards / totalCards) * 100) : 0

      return {
        deckId: deck.id,
        deckName: deck.name,
        deckIcon: deck.icon,
        deckColor: deck.color,
        totalCards,
        reviewCards,
        progressPercent,
      }
    })

    return NextResponse.json({
      streak: user.streak,
      longestStreak: user.longestStreak,
      points: user.points,
      cardsStudied: {
        today: cardsStudiedToday,
        week: cardsStudiedWeek,
        total: cardsStudiedTotal,
      },
      quizAverage,
      studyTime: {
        todayMinutes,
        totalMinutes,
      },
      last7Days,
      deckProgress,
      badgeCount,
    })
  } catch (error) {
    console.error("[statistiken]", error)
    return NextResponse.json(
      { error: "Statistiken konnten nicht geladen werden." },
      { status: 500 }
    )
  }
}

function calculateQuizAverage(results: QuizSummary[]): number {
  if (results.length === 0) return 0
  const totalCorrect = results.reduce((sum: number, r: QuizSummary) => sum + r.correctAnswers, 0)
  const totalQuestions = results.reduce((sum: number, r: QuizSummary) => sum + r.totalQuestions, 0)
  if (totalQuestions === 0) return 0
  return Math.round((totalCorrect / totalQuestions) * 100)
}

function buildLast7DaysActivity(
  reviews: ReviewRecord[],
  todayStart: Date
): DailyActivity[] {
  const days: DailyActivity[] = []

  for (let i = 6; i >= 0; i--) {
    const dayStart = new Date(todayStart.getTime() - i * 24 * 60 * 60 * 1000)
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000)

    const dayReviews = reviews.filter(
      (r: ReviewRecord) => r.createdAt >= dayStart && r.createdAt < dayEnd
    )

    days.push({
      date: dayStart.toISOString().split("T")[0],
      cardsStudied: dayReviews.length,
      minutesStudied: Math.round(
        dayReviews.reduce((sum: number, r: ReviewRecord) => sum + r.duration, 0) / 60
      ),
    })
  }

  return days
}
