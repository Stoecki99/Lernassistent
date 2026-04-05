// app/admin/[token]/page.tsx
// Admin-Bereich: Zeigt alle Nutzer mit Plan-Status und Speicherverbrauch.
// Zugang nur mit korrektem Token (ADMIN_SECRET Env-Variable).

import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import AdminUserTable from "@/components/features/AdminUserTable"

interface AdminPageProps {
  params: Promise<{ token: string }>
}

export default async function AdminPage({ params }: AdminPageProps) {
  const { token } = await params
  const adminSecret = process.env.ADMIN_SECRET

  if (!adminSecret || token !== adminSecret) {
    notFound()
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

  // Karten-Anzahl pro User separat laden (via deck → cards)
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

  const serializedUsers = users.map((user) => ({
    id: user.id,
    name: user.name ?? "—",
    email: user.email,
    createdAt: user.createdAt.toISOString(),
    plan: user.plan as "free" | "pro",
    planExpiresAt: user.planExpiresAt?.toISOString() ?? null,
    storageUsedMB: Number(user.storageUsedBytes) / (1024 * 1024),
    apiTokensUsedThisMonth: user.apiTokensUsedThisMonth,
    deckCount: user._count.decks,
    cardCount: cardCountByUser.get(user.id) ?? 0,
    chatMessageCount: user._count.chatMessages,
  }))

  return (
    <AdminUserTable
      users={serializedUsers}
      adminToken={token}
    />
  )
}
