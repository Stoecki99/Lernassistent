// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// lib/badges.ts
// Badge-Vergabe-Logik: Prueft Bedingungen und vergibt neue Badges.

import { prisma } from "@/lib/prisma"
import { achievementStats, prismaErrorCode } from "@/lib/leitstand"
import { MISSION_IDS } from "@/lib/archsim"
import { ladeArchsimAbzeichenStatistik } from "@/lib/architektur-leitstand"
import { archsimAbzeichenErfuellt, type ArchsimAbzeichenStatistik } from "@/lib/architektur-leitstand-regeln"
import {
  SPIEL_ABZEICHEN_BEDINGUNGEN,
  ladeSpielAbzeichenStatistik,
  spielAbzeichenErfuellt,
  type SpielAbzeichenStatistik,
} from "@/lib/spielstand"

type BadgeDb = Pick<typeof prisma, "$transaction">

/**
 * Ein Abzeichen vergeben: UserBadge per create (nicht upsert) und Punkte erst danach, in einer Transaktion.
 * Hat eine gleichzeitige Anfrage das Abzeichen schon vergeben, scheitert create mit P2002; die Transaktion
 * wird zurückgerollt und es gibt keine Punkte. Liefert true, wenn diese Anfrage vergeben hat.
 */
export async function awardBadge(
  userId: string,
  badge: { id: string; points: number },
  db: BadgeDb = prisma,
): Promise<boolean> {
  try {
    await db.$transaction(async (tx) => {
      await tx.userBadge.create({ data: { userId, badgeId: badge.id } })
      if (badge.points > 0) {
        await tx.user.update({ where: { id: userId }, data: { points: { increment: badge.points } } })
      }
    })
    return true
  } catch (error: unknown) {
    if (prismaErrorCode(error) === "P2002") return false
    throw error
  }
}

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
  return awardEarnedBadges(userId, badges, existingUserBadges, (condition) => evaluateCondition(condition, userStats))
}

/**
 * Nur die Abzeichen der Modellierspiele (Spielstand) prüfen und vergeben: weniger Abfragen als
 * checkAndAwardBadges, für POST /api/spielstand. Idempotent wie awardBadge.
 */
export async function checkAndAwardSpielBadges(userId: string): Promise<AwardedBadge[]> {
  const badges = await prisma.badge.findMany({ where: { condition: { in: SPIEL_ABZEICHEN_BEDINGUNGEN } } })
  if (badges.length === 0) return []
  const existingUserBadges: Array<{ badgeId: string }> = await prisma.userBadge.findMany({
    where: { userId, badgeId: { in: badges.map((badge) => badge.id) } },
    select: { badgeId: true },
  })
  if (existingUserBadges.length === badges.length) return []
  const stats = await ladeSpielAbzeichenStatistik(userId)
  return awardEarnedBadges(userId, badges, existingUserBadges, (condition) => spielAbzeichenErfuellt(condition, stats) === true)
}

async function awardEarnedBadges(
  userId: string,
  badges: Array<{ id: string; name: string; icon: string; description: string; condition: string; points: number }>,
  existingUserBadges: Array<{ badgeId: string }>,
  isEarned: (condition: string) => boolean,
): Promise<AwardedBadge[]> {
  const existingBadgeIds = new Set(
    existingUserBadges.map((ub: { badgeId: string }) => ub.badgeId)
  )
  const newBadges: AwardedBadge[] = []

  for (const badge of badges) {
    if (existingBadgeIds.has(badge.id)) {
      continue
    }

    if (!isEarned(badge.condition)) {
      continue
    }

    if (!(await awardBadge(userId, badge))) continue

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
  /** Leitstand: achievements aller abgeschlossenen Läufe mit neuem Startwert (Spezifikation 4.7) */
  leitstandAchievements: Set<string>
  /** Modellierspiele (Spielstand) im Fach avsw */
  spielStats: SpielAbzeichenStatistik
  /** Architektur-Leitstand: abgeschlossene Läufe mit neuem Startwert */
  archsimStats: ArchsimAbzeichenStatistik
}

async function getUserStatsForBadges(userId: string): Promise<UserBadgeStats> {
  const [user, totalReviews, totalCardsCreated, quizStats, simulationRuns, spielStats, archsimStats] = await Promise.all([
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
    prisma.simulationRun.findMany({
      where: { userId, status: "abgeschlossen", seedReused: false },
      select: { status: true, seedReused: true, scoreDetail: true },
    }),
    ladeSpielAbzeichenStatistik(userId),
    ladeArchsimAbzeichenStatistik(userId),
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
    leitstandAchievements: achievementStats(simulationRuns),
    spielStats,
    archsimStats,
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
    // Leitstand (3.13): der Rechenkern liefert die erfuellten Bedingungen je Lauf
    case "leitstand_einfuehrung":
    case "leitstand_ernstfall":
    case "leitstand_drei_sterne":
    case "leitstand_punktlandung":
    case "leitstand_klartext":
    case "leitstand_teamgeist":
    case "leitstand_risikoprofi":
    case "leitstand_null_fehler":
      return stats.leitstandAchievements.has(condition)
    // Architektur-Leitstand (archsim_*), siehe ARCHSIM_ABZEICHEN_BEDINGUNGEN
    case "archsim_erste_mission":
    case "archsim_drei_sterne":
    case "archsim_alle_missionen":
      return archsimAbzeichenErfuellt(condition, stats.archsimStats, MISSION_IDS) ?? false
    default:
      // Modellierspiele (avsw_spiel_*), siehe SPIEL_ABZEICHEN in lib/spielstand.ts
      return spielAbzeichenErfuellt(condition, stats.spielStats) ?? false
  }
}
