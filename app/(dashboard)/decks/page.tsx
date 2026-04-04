// app/(dashboard)/decks/page.tsx
// Deck-Uebersicht: zeigt alle Decks des Nutzers als Grid mit DeckCards.

import { redirect } from "next/navigation"
import Link from "next/link"
import { getCurrentUser } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import DeckCard from "@/components/features/DeckCard"

export const metadata = {
  title: "Meine Decks — Lernassistent",
}

export default async function DecksPage() {
  const user = await getCurrentUser()

  if (!user) {
    redirect("/login")
  }

  const decks = await prisma.deck.findMany({
    where: { userId: user.id },
    include: {
      _count: {
        select: { cards: true },
      },
    },
    orderBy: { updatedAt: "desc" },
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-text-dark">
            Meine Decks
          </h1>
          <p className="text-text-light mt-1">
            {decks.length === 0
              ? "Erstelle dein erstes Deck und starte mit dem Lernen!"
              : `${decks.length} ${decks.length === 1 ? "Deck" : "Decks"} insgesamt`}
          </p>
        </div>
      </div>

      {/* Grid */}
      {decks.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {decks.map((deck) => (
            <DeckCard
              key={deck.id}
              id={deck.id}
              name={deck.name}
              icon={deck.icon}
              color={deck.color}
              cardCount={deck._count.cards}
            />
          ))}

          {/* Neues Deck erstellen Card */}
          <Link
            href="/decks/neu"
            className="flex flex-col items-center justify-center bg-surface-card rounded-2xl shadow-card hover:shadow-card-hover border-2 border-dashed border-gray-200 hover:border-primary transition-all duration-200 hover:-translate-y-1 p-5 min-h-[160px]"
          >
            <span className="text-4xl text-primary mb-2" aria-hidden="true">+</span>
            <span className="font-bold text-text-light group-hover:text-primary text-center">
              Neues Deck erstellen
            </span>
          </Link>
        </div>
      ) : (
        /* Empty State */
        <div className="text-center py-16">
          <span className="text-6xl block mb-4" aria-hidden="true">&#128218;</span>
          <h2 className="text-xl font-extrabold text-text-dark mb-2">
            Noch keine Decks vorhanden
          </h2>
          <p className="text-text-light mb-6 max-w-md mx-auto">
            Erstelle dein erstes Deck und beginne, Karteikarten hinzuzufuegen.
            Mit regelmaessigem Lernen erreichst du deine Ziele!
          </p>
          <Link
            href="/decks/neu"
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white font-bold rounded-2xl shadow-button hover:bg-primary-dark active:translate-y-1 active:shadow-none transition-all"
          >
            <span aria-hidden="true">+</span>
            Erstes Deck erstellen
          </Link>
        </div>
      )}
    </div>
  )
}
