// app/(dashboard)/open-decks/page.tsx
// OpenDecks: Von der Community geteilte und gepruefterte Decks.

import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import OpenDeckCard from "@/components/features/OpenDeckCard"

export const metadata = {
  title: "OpenDecks — Lernassistent",
}

export default async function OpenDecksPage() {
  const user = await getCurrentUser()

  if (!user) {
    redirect("/login")
  }

  const decks = await prisma.deck.findMany({
    where: { shareStatus: "approved" },
    include: {
      user: { select: { name: true } },
      _count: { select: { cards: true } },
    },
    orderBy: [{ isFeatured: "desc" }, { shareReviewedAt: "desc" }],
  })

  const serialized = decks.map((d) => ({
    id: d.id,
    name: d.name,
    description: d.description,
    color: d.color,
    icon: d.icon,
    cardCount: d._count.cards,
    authorName: d.user.name ?? "Anonym",
    isFeatured: d.isFeatured,
  }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-extrabold text-text-dark">
          OpenDecks
        </h1>
        <p className="text-text-light mt-1">
          Von der Community geteilte und gepruefete Decks
        </p>
      </div>

      {serialized.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {serialized.map((deck) => (
            <OpenDeckCard key={deck.id} deck={deck} />
          ))}
        </div>
      ) : (
        <div className="text-center py-16">
          <span className="text-6xl block mb-4" aria-hidden="true">&#127760;</span>
          <h2 className="text-xl font-extrabold text-text-dark mb-2">
            Noch keine OpenDecks vorhanden
          </h2>
          <p className="text-text-light max-w-md mx-auto">
            Sobald Decks von der Community geteilt und freigegeben werden, erscheinen sie hier.
          </p>
        </div>
      )}
    </div>
  )
}
