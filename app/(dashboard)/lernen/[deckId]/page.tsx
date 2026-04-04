// app/(dashboard)/lernen/[deckId]/page.tsx
// Server Component: Laedt Deck-Info und rendert den Lernmodus.

import { redirect, notFound } from "next/navigation"
import { getCurrentUser } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import LernSession from "@/components/features/LernSession"

interface LernenPageProps {
  params: Promise<{ deckId: string }>
}

export default async function LernenPage({ params }: LernenPageProps) {
  const user = await getCurrentUser()

  if (!user) {
    redirect("/login")
  }

  const { deckId } = await params

  const deck = await prisma.deck.findUnique({
    where: { id: deckId, userId: user.id },
    select: {
      id: true,
      name: true,
      color: true,
      icon: true,
      _count: { select: { cards: true } },
    },
  })

  if (!deck) {
    notFound()
  }

  return (
    <LernSession
      deck={{
        id: deck.id,
        name: deck.name,
        color: deck.color,
        icon: deck.icon,
        cardCount: deck._count.cards,
      }}
    />
  )
}
