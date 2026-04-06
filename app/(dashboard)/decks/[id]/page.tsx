// app/(dashboard)/decks/[id]/page.tsx
// Einzelansicht eines Decks mit Header, Aktionen und Karten-Liste (Platzhalter).

import { redirect, notFound } from "next/navigation"
import { getCurrentUser } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import DeckDetailClient from "@/components/features/DeckDetailClient"

interface DeckPageProps {
  params: Promise<{ id: string }>
}

export default async function DeckDetailPage({ params }: DeckPageProps) {
  const user = await getCurrentUser()

  if (!user) {
    redirect("/login")
  }

  const { id } = await params

  const deck = await prisma.deck.findUnique({
    where: { id, userId: user.id },
    include: {
      _count: {
        select: { cards: true },
      },
      cards: {
        select: {
          id: true,
          front: true,
          back: true,
          hint: true,
          state: true,
          due: true,
        },
        orderBy: { createdAt: "desc" },
      },
    },
  })

  if (!deck) {
    notFound()
  }

  const totalCards = deck._count.cards
  const newCards = deck.cards.filter((c) => c.state === 0).length
  const learningCards = deck.cards.filter((c) => c.state === 1 || c.state === 3).length
  const reviewCards = deck.cards.filter((c) => c.state === 2).length

  return (
    <DeckDetailClient
      deck={{
        id: deck.id,
        name: deck.name,
        description: deck.description,
        color: deck.color,
        icon: deck.icon,
        cardCount: totalCards,
        shareStatus: deck.shareStatus,
        shareRejectionReason: deck.shareRejectionReason,
        progress: { newCards, learningCards, reviewCards },
        cards: deck.cards.map((c) => ({
          id: c.id,
          front: c.front,
          back: c.back,
          hint: c.hint,
          state: c.state,
          due: c.due.toISOString(),
        })),
      }}
    />
  )
}
