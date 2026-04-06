// app/(dashboard)/admin/page.tsx
// Admin-Bereich: Zeigt alle Nutzer mit Plan-Status und Speicherverbrauch.
// Zugang nur fuer eingeloggte User deren E-Mail mit ADMIN_EMAIL uebereinstimmt.

import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import AdminUserTable from "@/components/features/AdminUserTable"
import AdminMessages from "@/components/features/AdminMessages"
import AdminOpenDecks from "@/components/features/AdminOpenDecks"

export const metadata = {
  title: "Admin — Lernassistent",
  robots: "noindex, nofollow",
}

export default async function AdminPage() {
  const user = await getCurrentUser()

  if (!user?.email) {
    redirect("/login")
  }

  // Nur Admin-E-Mail darf zugreifen
  const adminEmail = process.env.ADMIN_EMAIL
  if (!adminEmail || user.email !== adminEmail) {
    redirect("/dashboard")
  }

  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      createdAt: true,
      plan: true,
      planExpiresAt: true,
      storageUsedBytes: true,
      apiTokensUsedThisMonth: true,
      _count: {
        select: {
          decks: true,
          chatMessages: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  })

  // Karten-Anzahl pro User
  const userCardCounts = await prisma.card.groupBy({
    by: ["deckId"],
    _count: { id: true },
  })

  const deckToUser = await prisma.deck.findMany({
    select: { id: true, userId: true },
  })

  const deckUserMap = new Map(deckToUser.map((d) => [d.id, d.userId]))
  const cardCountByUser = new Map<string, number>()

  for (const group of userCardCounts) {
    const userId = deckUserMap.get(group.deckId)
    if (userId) {
      cardCountByUser.set(userId, (cardCountByUser.get(userId) ?? 0) + group._count.id)
    }
  }

  const contactMessages = await prisma.contactMessage.findMany({
    orderBy: { createdAt: "desc" },
  })

  const serializedMessages = contactMessages.map((m) => ({
    id: m.id,
    name: m.name,
    email: m.email,
    subject: m.subject,
    message: m.message,
    emailSent: m.emailSent,
    read: m.read,
    createdAt: m.createdAt.toISOString(),
  }))

  const pendingDecks = await prisma.deck.findMany({
    where: { shareStatus: "pending" },
    include: {
      user: { select: { name: true, email: true } },
      _count: { select: { cards: true } },
    },
    orderBy: { shareRequestedAt: "desc" },
  })

  const serializedPendingDecks = pendingDecks.map((d) => ({
    id: d.id,
    name: d.name,
    description: d.description,
    icon: d.icon,
    cardCount: d._count.cards,
    userName: d.user.name ?? "Anonym",
    userEmail: d.user.email,
    requestedAt: d.shareRequestedAt?.toISOString() ?? d.createdAt.toISOString(),
  }))

  const serializedUsers = users.map((u) => ({
    id: u.id,
    name: u.name ?? "—",
    email: u.email,
    createdAt: u.createdAt.toISOString(),
    plan: u.plan as "free" | "pro",
    planExpiresAt: u.planExpiresAt?.toISOString() ?? null,
    storageUsedMB: Number(u.storageUsedBytes) / (1024 * 1024),
    apiTokensUsedThisMonth: u.apiTokensUsedThisMonth,
    deckCount: u._count.decks,
    cardCount: cardCountByUser.get(u.id) ?? 0,
    chatMessageCount: u._count.chatMessages,
  }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-extrabold text-text-dark">
          Admin Panel
        </h1>
        <p className="text-text-light mt-1">
          Nutzerverwaltung und Abo-Übersicht
        </p>
      </div>
      <AdminUserTable users={serializedUsers} />
      <AdminOpenDecks decks={serializedPendingDecks} />
      <AdminMessages messages={serializedMessages} />
    </div>
  )
}
