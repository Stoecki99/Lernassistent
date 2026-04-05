// app/(dashboard)/quiz/page.tsx
// Quiz-Auswahl: Deck und Quiz-Typ waehlen, dann Quiz starten.

import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import QuizAuswahl from "@/components/features/QuizAuswahl"

export const metadata = {
  title: "Quiz — Lernassistent",
}

export default async function QuizPage() {
  const user = await getCurrentUser()

  if (!user) {
    redirect("/login")
  }

  const decks = await prisma.deck.findMany({
    where: { userId: user.id },
    include: {
      _count: { select: { cards: true } },
    },
    orderBy: { updatedAt: "desc" },
  })

  const deckOptions = decks.map((deck) => ({
    id: deck.id,
    name: deck.name,
    icon: deck.icon,
    color: deck.color,
    cardCount: deck._count.cards,
  }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-extrabold text-text-dark">
          Quiz
        </h1>
        <p className="text-text-light mt-1">
          Teste dein Wissen mit verschiedenen Quiz-Typen!
        </p>
      </div>

      {deckOptions.length > 0 ? (
        <QuizAuswahl decks={deckOptions} userEmail={user.email ?? ""} />
      ) : (
        <div className="text-center py-16">
          <span className="text-6xl block mb-4" aria-hidden="true">
            &#10068;
          </span>
          <h2 className="text-xl font-extrabold text-text-dark mb-2">
            Noch keine Decks vorhanden
          </h2>
          <p className="text-text-light mb-6 max-w-md mx-auto">
            Erstelle zuerst ein Deck mit Karteikarten, um ein Quiz zu starten.
          </p>
          <a
            href="/decks/neu"
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white font-bold rounded-2xl shadow-button hover:bg-primary-dark active:translate-y-1 active:shadow-none transition-all"
          >
            Deck erstellen
          </a>
        </div>
      )}
    </div>
  )
}

