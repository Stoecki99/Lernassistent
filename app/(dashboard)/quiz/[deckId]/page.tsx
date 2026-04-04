// app/(dashboard)/quiz/[deckId]/page.tsx
// Server Component: Laedt Deck-Info und rendert die Quiz-Session.

import { redirect, notFound } from "next/navigation"
import { getCurrentUser } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import QuizSession from "@/components/features/QuizSession"

interface QuizPageProps {
  params: Promise<{ deckId: string }>
  searchParams: Promise<{ type?: string; count?: string }>
}

export default async function QuizDeckPage({
  params,
  searchParams,
}: QuizPageProps) {
  const user = await getCurrentUser()

  if (!user) {
    redirect("/login")
  }

  const { deckId } = await params
  const { type, count } = await searchParams

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

  const quizType = type === "true_false" || type === "free_text"
    ? type
    : "multiple_choice"

  const questionCount = [5, 10, 15, 20].includes(Number(count))
    ? (Number(count) as 5 | 10 | 15 | 20)
    : 5

  return (
    <QuizSession
      deck={{
        id: deck.id,
        name: deck.name,
        color: deck.color,
        icon: deck.icon,
        cardCount: deck._count.cards,
      }}
      quizType={quizType}
      questionCount={questionCount}
    />
  )
}
