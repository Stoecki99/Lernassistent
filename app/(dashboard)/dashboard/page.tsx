// app/(dashboard)/dashboard/page.tsx
// Dashboard-Hauptseite mit echten Statistiken, Streak, Fortschritt und Schnellzugriff.

import { redirect } from "next/navigation"
import Link from "next/link"
import { getCurrentUser } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import StreakAnzeige from "@/components/features/StreakAnzeige"
import StatistikWidget from "@/components/features/StatistikWidget"
import WochenChart from "@/components/features/WochenChart"
import ProgressBar from "@/components/ui/ProgressBar"

export const metadata = {
  title: "Dashboard \u2014 Lernassistent",
}

const DAILY_GOAL = 30

interface DayActivity {
  date: string
  cardsStudied: number
  minutesStudied: number
}

interface QuizSummary {
  totalQuestions: number
  correctAnswers: number
}

interface ReviewRecord {
  createdAt: Date
  duration: number
}

async function getDashboardData(userId: string) {
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const weekStart = new Date(todayStart.getTime() - 6 * 24 * 60 * 60 * 1000)

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { streak: true, longestStreak: true, points: true },
  })

  const cardsToday = await prisma.review.count({
    where: {
      card: { deck: { userId } },
      createdAt: { gte: todayStart },
    },
  })

  const reviewsLast7Days: ReviewRecord[] = await prisma.review.findMany({
    where: {
      card: { deck: { userId } },
      createdAt: { gte: weekStart },
    },
    select: { createdAt: true, duration: true },
  })

  const quizResults: QuizSummary[] = await prisma.quizResult.findMany({
    where: { userId },
    select: { totalQuestions: true, correctAnswers: true },
  })

  const badgeCount = await prisma.userBadge.count({ where: { userId } })

  // Quiz-Durchschnitt
  const totalQ = quizResults.reduce((s: number, r: QuizSummary) => s + r.totalQuestions, 0)
  const totalC = quizResults.reduce((s: number, r: QuizSummary) => s + r.correctAnswers, 0)
  const quizAverage = totalQ > 0 ? Math.round((totalC / totalQ) * 100) : 0

  // Letzte 7 Tage
  const last7Days: DayActivity[] = []
  for (let i = 6; i >= 0; i--) {
    const dayStart = new Date(todayStart.getTime() - i * 24 * 60 * 60 * 1000)
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000)
    const dayReviews = reviewsLast7Days.filter(
      (r: ReviewRecord) => r.createdAt >= dayStart && r.createdAt < dayEnd
    )
    last7Days.push({
      date: dayStart.toISOString().split("T")[0],
      cardsStudied: dayReviews.length,
      minutesStudied: Math.round(
        dayReviews.reduce((s: number, r: ReviewRecord) => s + r.duration, 0) / 60
      ),
    })
  }

  return {
    streak: user?.streak ?? 0,
    longestStreak: user?.longestStreak ?? 0,
    points: user?.points ?? 0,
    cardsToday,
    quizAverage,
    quizCount: quizResults.length,
    badgeCount,
    last7Days,
  }
}

export default async function DashboardPage() {
  const user = await getCurrentUser()

  if (!user) {
    redirect("/login")
  }

  const firstName = user.name?.split(" ")[0] ?? "Student"
  const stats = await getDashboardData(user.id)

  return (
    <div className="space-y-6">
      {/* Begruessung */}
      <div>
        <h1 className="text-2xl md:text-3xl font-extrabold text-text-dark">
          Hallo, {firstName}! &#128075;
        </h1>
        <p className="text-text-light mt-1">Bereit zum Lernen?</p>
      </div>

      {/* Streak + Punkte Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <StreakAnzeige
          currentStreak={stats.streak}
          longestStreak={stats.longestStreak}
        />

        {/* Statistik-Widgets Grid */}
        <div className="grid grid-cols-2 gap-3">
          <StatistikWidget
            icon="&#11088;"
            title="Punkte"
            value={stats.points.toLocaleString("de-DE")}
            color="accent"
          />
          <StatistikWidget
            icon="&#128218;"
            title="Heute gelernt"
            value={stats.cardsToday}
            subtitle={`Ziel: ${DAILY_GOAL}`}
            color="primary"
          />
          <StatistikWidget
            icon="&#129504;"
            title="Quiz-Schnitt"
            value={stats.quizCount > 0 ? `${stats.quizAverage}%` : "\u2014"}
            subtitle={`${stats.quizCount} Quizze`}
            color="secondary"
          />
          <StatistikWidget
            icon="&#127942;"
            title="Badges"
            value={stats.badgeCount}
            color="default"
          />
        </div>
      </div>

      {/* Tages-Fortschritt */}
      <div className="bg-surface-card rounded-2xl shadow-card p-5">
        <div className="flex justify-between items-center mb-3">
          <h2 className="font-bold text-text-dark">Tagesfortschritt</h2>
          <span className="text-sm text-text-light">
            {stats.cardsToday} / {DAILY_GOAL} Karten
          </span>
        </div>
        <ProgressBar
          value={stats.cardsToday}
          max={DAILY_GOAL}
          color="primary"
          size="lg"
        />
        <p className="text-sm text-text-light mt-2">
          {stats.cardsToday >= DAILY_GOAL
            ? "Tagesziel erreicht! Grossartig!"
            : `Noch ${DAILY_GOAL - stats.cardsToday} Karten bis zum Tagesziel!`}
        </p>
      </div>

      {/* Wochen-Chart */}
      <WochenChart data={stats.last7Days} />

      {/* Schnellzugriff-Buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <QuickActionCard
          href="/lernen"
          icon="&#128218;"
          title="Weiterlernen"
          description="Fällige Karten wiederholen"
          color="primary"
        />
        <QuickActionCard
          href="/decks"
          icon="&#10133;"
          title="Neus Deck"
          description="Karteikarten erstellen"
          color="secondary"
        />
        <QuickActionCard
          href="/quiz"
          icon="&#127942;"
          title="Quiz starten"
          description="Wissen testen"
          color="accent"
        />
      </div>
    </div>
  )
}

// Schnellzugriff-Karte als lokale Hilfskomponente
interface QuickActionCardProps {
  href: string
  icon: string
  title: string
  description: string
  color: "primary" | "secondary" | "accent"
}

const colorConfig: Record<string, { bg: string; hover: string; text: string }> = {
  primary: {
    bg: "bg-primary/5",
    hover: "hover:bg-primary/10",
    text: "text-primary-dark",
  },
  secondary: {
    bg: "bg-secondary/5",
    hover: "hover:bg-secondary/10",
    text: "text-secondary-dark",
  },
  accent: {
    bg: "bg-accent/5",
    hover: "hover:bg-accent/10",
    text: "text-accent-dark",
  },
}

function QuickActionCard({ href, icon, title, description, color }: QuickActionCardProps) {
  const colors = colorConfig[color]

  return (
    <Link
      href={href}
      className={`block ${colors.bg} ${colors.hover} rounded-2xl p-4 transition-colors group`}
    >
      <span className="text-2xl" aria-hidden="true">{icon}</span>
      <h3 className={`font-bold mt-2 ${colors.text}`}>{title}</h3>
      <p className="text-sm text-text-light mt-0.5">{description}</p>
    </Link>
  )
}
