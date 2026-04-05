// app/(dashboard)/import/page.tsx
// Import-Seite: Deck-Auswahl und Import-Formular fuer Karteikarten.

import { redirect } from "next/navigation"
import Link from "next/link"
import { getCurrentUser } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import ImportPageClient from "@/components/features/ImportPageClient"
import AiPromptTips from "@/components/features/AiPromptTips"

export const metadata = {
  title: "Karten importieren — Lernassistent",
}

interface ImportPageProps {
  searchParams: Promise<{ deckId?: string }>
}

export default async function ImportPage({ searchParams }: ImportPageProps) {
  const user = await getCurrentUser()

  if (!user) {
    redirect("/login")
  }

  const { deckId } = await searchParams

  const decks = await prisma.deck.findMany({
    where: { userId: user.id },
    select: {
      id: true,
      name: true,
      icon: true,
      color: true,
    },
    orderBy: { updatedAt: "desc" },
  })

  if (decks.length === 0) {
    return (
      <div className="space-y-6">
        <Link
          href="/decks"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-text-light hover:text-text transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
            <path fillRule="evenodd" d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z" clipRule="evenodd" />
          </svg>
          Zurueck zu Decks
        </Link>

        <div className="text-center py-16">
          <span className="text-6xl block mb-4" aria-hidden="true">&#128218;</span>
          <h1 className="text-xl font-extrabold text-text-dark mb-2">
            Kein Deck vorhanden
          </h1>
          <p className="text-text-light mb-6 max-w-md mx-auto">
            Erstelle zuerst ein Deck, um Karten importieren zu koennen.
          </p>
          <Link
            href="/decks/neu"
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white font-bold rounded-2xl shadow-button hover:bg-primary-dark active:translate-y-1 active:shadow-none transition-all"
          >
            Deck erstellen
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Link
        href={deckId ? `/decks/${deckId}` : "/decks"}
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-text-light hover:text-text transition-colors"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
          <path fillRule="evenodd" d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z" clipRule="evenodd" />
        </svg>
        Zurueck
      </Link>

      <div>
        <h1 className="text-2xl md:text-3xl font-extrabold text-text-dark">
          Karten importieren
        </h1>
        <p className="text-text-light mt-1">
          Importiere Karteikarten aus einer CSV- oder Anki-Datei in dein Deck.
        </p>
      </div>

      <ImportPageClient
        decks={decks}
        preselectedDeckId={deckId ?? null}
      />

      {/* Trennlinie */}
      <div className="border-t border-gray-200 pt-6">
        <AiPromptTips />
      </div>
    </div>
  )
}
