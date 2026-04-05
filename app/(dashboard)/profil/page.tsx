// app/(dashboard)/profil/page.tsx
// Profil-Seite: Name, E-Mail, Statistiken-Uebersicht, Badge-Sammlung, Logout.

import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import StatistikWidget from "@/components/features/StatistikWidget"
import BadgeCard from "@/components/features/BadgeCard"
import LogoutButton from "@/components/features/LogoutButton"

export const metadata = {
  title: "Profil \u2014 Lernassistent",
}

interface BadgeWithStatus {
  id: string
  name: string
  icon: string
  description: string
  points: number
  earned: boolean
  awardedAt: string | null
}

interface BadgeRecord {
  id: string
  name: string
  icon: string
  description: string
  condition: string
  points: number
  createdAt: Date
}

interface UserBadgeRecord {
  badgeId: string
  awardedAt: Date
}

async function getProfilData(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      name: true,
      email: true,
      streak: true,
      longestStreak: true,
      points: true,
      createdAt: true,
    },
  })

  const allBadges: BadgeRecord[] = await prisma.badge.findMany({
    orderBy: { points: "asc" },
  })

  const userBadges: UserBadgeRecord[] = await prisma.userBadge.findMany({
    where: { userId },
    select: { badgeId: true, awardedAt: true },
  })

  const totalReviews = await prisma.review.count({
    where: { card: { deck: { userId } } },
  })

  const quizCount = await prisma.quizResult.count({
    where: { userId },
  })

  const userBadgeMap = new Map<string, Date>(
    userBadges.map((ub: UserBadgeRecord) => [ub.badgeId, ub.awardedAt])
  )

  const badges: BadgeWithStatus[] = allBadges.map((badge: BadgeRecord) => ({
    id: badge.id,
    name: badge.name,
    icon: badge.icon,
    description: badge.description,
    points: badge.points,
    earned: userBadgeMap.has(badge.id),
    awardedAt: userBadgeMap.get(badge.id)?.toISOString() ?? null,
  }))

  return {
    name: user?.name ?? "Student",
    email: user?.email ?? "",
    streak: user?.streak ?? 0,
    longestStreak: user?.longestStreak ?? 0,
    points: user?.points ?? 0,
    memberSince: user?.createdAt?.toLocaleDateString("de-DE", {
      month: "long",
      year: "numeric",
    }) ?? "",
    totalReviews,
    quizCount,
    badges,
    earnedBadgeCount: userBadges.length,
  }
}

export default async function ProfilPage() {
  const user = await getCurrentUser()

  if (!user) {
    redirect("/login")
  }

  const profil = await getProfilData(user.id)
  const initials = profil.name
    .split(" ")
    .map((part: string) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)

  return (
    <div className="space-y-6">
      {/* Header */}
      <h1 className="text-2xl md:text-3xl font-extrabold text-text-dark">
        Profil
      </h1>

      {/* User-Info Card */}
      <div className="bg-surface-card rounded-2xl shadow-card p-6 flex items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-primary/10 text-primary flex items-center justify-center font-extrabold text-xl flex-shrink-0">
          {initials}
        </div>
        <div className="min-w-0">
          <p className="text-xl font-extrabold text-text-dark truncate">
            {profil.name}
          </p>
          <p className="text-sm text-text-light truncate">{profil.email}</p>
          <p className="text-xs text-text-light mt-1">
            Mitglied seit {profil.memberSince}
          </p>
        </div>
      </div>

      {/* Statistiken Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatistikWidget
          icon={"\uD83D\uDD25"}
          title="Streak"
          value={`${profil.streak} Tage`}
          subtitle={`Rekord: ${profil.longestStreak}`}
          color="accent"
        />
        <StatistikWidget
          icon="&#11088;"
          title="Punkte"
          value={profil.points.toLocaleString("de-DE")}
          color="accent"
        />
        <StatistikWidget
          icon="&#128218;"
          title="Karten gelernt"
          value={profil.totalReviews.toLocaleString("de-DE")}
          color="primary"
        />
        <StatistikWidget
          icon="&#129504;"
          title="Quizze"
          value={profil.quizCount}
          color="secondary"
        />
      </div>

      {/* Badge-Sammlung */}
      <div>
        <h2 className="text-lg font-extrabold text-text-dark mb-3">
          Badges ({profil.earnedBadgeCount} / {profil.badges.length})
        </h2>
        {profil.badges.length === 0 ? (
          <p className="text-sm text-text-light bg-surface-card rounded-2xl shadow-card p-5 text-center">
            Noch keine Badges verfügbar. Lerne weiter!
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {profil.badges.map((badge) => (
              <BadgeCard
                key={badge.id}
                icon={badge.icon}
                name={badge.name}
                description={badge.description}
                earned={badge.earned}
                awardedAt={badge.awardedAt}
                points={badge.points}
              />
            ))}
          </div>
        )}
      </div>

      {/* Logout */}
      <div className="bg-surface-card rounded-2xl shadow-card p-4">
        <LogoutButton />
      </div>
    </div>
  )
}
