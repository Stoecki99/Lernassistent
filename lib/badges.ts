// lib/badges.ts
// Badge-Vergabe-Logik: Prueft Bedingungen und vergibt neue Badges.

import { prisma } from "@/lib/prisma"

interface AwardedBadge {
  name: string
  icon: string
  description: string
  points: number
}

/**
 * Prueft alle Badge-Bedingungen fuer einen User und vergibt neue Badges.
 * Gibt ein Array der neu verdienten Badges zurueck (fuer Toast-Notifications).
 */
export async function checkAndAwardBadges(userId: string): Promise<AwardedBadge[]> {
  const badges = await prisma.badge.findMany()
  const existingUserBadges: Array<{ badgeId: string }> = await prisma.userBadge.findMany({
    where: { userId },
    select: { badgeId: true },
  })
  const userStats = await getUserStatsForBadges(userId)

  const existingBadgeIds = new Set(
    existingUserBadges.map((ub: { badgeId: string }) => ub.badgeId)
  )
  const newBadges: AwardedBadge[] = []

  for (const badge of badges) {
    if (existingBadgeIds.has(badge.id)) {
      continue
    }

    const earned = evaluateCondition(badge.condition, userStats)
    if (!earned) {
      continue
    }

    try {
      await prisma.$transaction([
        prisma.userBadge.upsert({
          where: { userId_badgeId: { userId, badgeId: badge.id } },
          update: {},
          create: { userId, badgeId: badge.id },
        }),
        prisma.user.update({
          where: { id: userId },
          data: { points: { increment: badge.points } },
        }),
      ])
    } catch (error: unknown) {
      // Unique constraint violation (P2002) — Badge already awarded by concurrent request
      if (
        error instanceof Error &&
        "code" in error &&
        (error as { code: string }).code === "P2002"
      ) {
        continue
      }
      throw error
    }

    newBadges.push({
      name: badge.name,
      icon: badge.icon,
      description: badge.description,
      points: badge.points,
    })
  }

  return newBadges
}

interface UserBadgeStats {
  streak: number
  totalReviews: number
  totalCardsCreated: number
  totalQuizzes: number
  hasPerfectQuiz: boolean
}

async function getUserStatsForBadges(userId: string): Promise<UserBadgeStats> {
  const [user, totalReviews, totalCardsCreated, quizStats] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { streak: true },
    }),
    prisma.review.count({
      where: { card: { deck: { userId } } },
    }),
    prisma.card.count({
      where: { deck: { userId } },
    }),
    prisma.quizResult.findMany({
      where: { userId },
      select: { totalQuestions: true, correctAnswers: true },
    }),
  ])

  const totalQuizzes = quizStats.length
  const hasPerfectQuiz = quizStats.some(
    (q) => q.totalQuestions > 0 && q.correctAnswers === q.totalQuestions
  )

  return {
    streak: user?.streak ?? 0,
    totalReviews,
    totalCardsCreated,
    totalQuizzes,
    hasPerfectQuiz,
  }
}

function evaluateCondition(condition: string, stats: UserBadgeStats): boolean {
  switch (condition) {
    case "first_card":
      return stats.totalReviews >= 1
    case "streak_3":
      return stats.streak >= 3
    case "streak_7":
      return stats.streak >= 7
    case "streak_30":
      return stats.streak >= 30
    case "cards_100":
      return stats.totalCardsCreated >= 100
    case "quiz_10":
      return stats.totalQuizzes >= 10
    case "quiz_perfect":
      return stats.hasPerfectQuiz
    case "cards_studied_500":
      return stats.totalReviews >= 500
    default:
      return false
  }
}
