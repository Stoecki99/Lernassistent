// app/(dashboard)/dashboard/page.tsx
// Dashboard-Hauptseite mit Begruessung, Streak, Fortschritt und Schnellzugriff.

import { redirect } from "next/navigation"
import Link from "next/link"
import { getCurrentUser } from "@/lib/auth"
import StreakBadge from "@/components/ui/StreakBadge"
import ProgressBar from "@/components/ui/ProgressBar"

export const metadata = {
  title: "Dashboard — Lernassistent",
}

// Platzhalter-Daten bis die DB-Integration steht
const PLACEHOLDER_STATS = {
  streakDays: 5,
  cardsToday: 12,
  cardsDailyGoal: 30,
  totalPoints: 1250,
  recentActivity: [
    { label: "Biologie Deck gelernt", time: "vor 2 Stunden" },
    { label: "Quiz: Chemie bestanden", time: "vor 5 Stunden" },
    { label: "10 neue Karten erstellt", time: "gestern" },
  ],
}

export default async function DashboardPage() {
  const user = await getCurrentUser()

  if (!user) {
    redirect("/login")
  }

  const firstName = user.name?.split(" ")[0] ?? "Student"
  const stats = PLACEHOLDER_STATS

  return (
    <div className="space-y-6">
      {/* Begruessung */}
      <div>
        <h1 className="text-2xl md:text-3xl font-extrabold text-text-dark">
          Hallo, {firstName}! &#128075;
        </h1>
        <p className="text-text-light mt-1">Bereit zum Lernen?</p>
      </div>

      {/* Streak + Punkte */}
      <div className="flex flex-wrap gap-3">
        <StreakBadge days={stats.streakDays} size="md" />
        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-secondary/10 text-secondary font-bold">
          <span aria-hidden="true">&#11088;</span>
          <span>{stats.totalPoints.toLocaleString("de-DE")} Punkte</span>
        </div>
      </div>

      {/* Tages-Fortschritt */}
      <div className="bg-surface-card rounded-2xl shadow-card p-5">
        <div className="flex justify-between items-center mb-3">
          <h2 className="font-bold text-text-dark">Tagesfortschritt</h2>
          <span className="text-sm text-text-light">
            {stats.cardsToday} / {stats.cardsDailyGoal} Karten
          </span>
        </div>
        <ProgressBar
          value={stats.cardsToday}
          max={stats.cardsDailyGoal}
          color="primary"
          size="lg"
        />
        <p className="text-sm text-text-light mt-2">
          Noch {stats.cardsDailyGoal - stats.cardsToday} Karten bis zum Tagesziel!
        </p>
      </div>

      {/* Schnellzugriff-Buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <QuickActionCard
          href="/lernen"
          icon="&#128218;"
          title="Weiterlernen"
          description="Faellige Karten wiederholen"
          color="primary"
        />
        <QuickActionCard
          href="/decks"
          icon="&#10133;"
          title="Neues Deck"
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

      {/* Letzte Aktivitaet */}
      <div className="bg-surface-card rounded-2xl shadow-card p-5">
        <h2 className="font-bold text-text-dark mb-3">Letzte Aktivitaet</h2>
        <ul className="space-y-3">
          {stats.recentActivity.map((activity, index) => (
            <li key={index} className="flex justify-between items-center">
              <span className="text-sm text-text">{activity.label}</span>
              <span className="text-xs text-text-light whitespace-nowrap ml-4">
                {activity.time}
              </span>
            </li>
          ))}
        </ul>
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
