"use client"

// components/features/DeckDetailClient.tsx
// Client-Komponente fuer die Deck-Einzelansicht mit Loeschen-Modal und Aktionen.

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Modal from "@/components/ui/Modal"
import KartenListe from "@/components/features/KartenListe"

interface CardSummary {
  id: string
  front: string
  back: string
  state: number
  due: string
}

interface DeckData {
  id: string
  name: string
  description: string | null
  color: string
  icon: string
  cardCount: number
  shareStatus: string
  shareRejectionReason: string | null
  progress: {
    newCards: number
    learningCards: number
    reviewCards: number
  }
  cards: CardSummary[]
}

interface DeckDetailClientProps {
  deck: DeckData
}

const MIN_CARDS_FOR_SHARE = 20

export default function DeckDetailClient({ deck }: DeckDetailClientProps) {
  const router = useRouter()
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [shareStatus, setShareStatus] = useState(deck.shareStatus)
  const [shareLoading, setShareLoading] = useState(false)
  const [shareError, setShareError] = useState<string | null>(null)

  async function handleShareRequest() {
    setShareLoading(true)
    setShareError(null)

    try {
      const res = await fetch("/api/open-decks/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deckId: deck.id }),
      })

      if (!res.ok) {
        const data = await res.json()
        setShareError(data.error ?? "Anfrage fehlgeschlagen.")
        return
      }

      setShareStatus("pending")
    } catch {
      setShareError("Netzwerkfehler.")
    } finally {
      setShareLoading(false)
    }
  }

  async function handleDelete() {
    setIsDeleting(true)

    try {
      const response = await fetch(`/api/decks/${deck.id}`, { method: "DELETE" })

      if (response.ok) {
        router.push("/decks")
        router.refresh()
      }
    } catch {
      // Fehler still behandeln — Modal bleibt offen
    } finally {
      setIsDeleting(false)
      setShowDeleteModal(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Zurueck-Link */}
      <Link
        href="/decks"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-text-light hover:text-text transition-colors"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
          <path fillRule="evenodd" d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z" clipRule="evenodd" />
        </svg>
        Zurück zu Decks
      </Link>

      {/* Deck Header */}
      <div className="bg-surface-card rounded-2xl shadow-card overflow-hidden">
        <div className="h-3 w-full" style={{ backgroundColor: deck.color }} />
        <div className="p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <span className="text-5xl">{deck.icon}</span>
              <div>
                <h1 className="text-2xl md:text-3xl font-extrabold text-text-dark">
                  {deck.name}
                </h1>
                {deck.description && (
                  <p className="text-text-light mt-1">{deck.description}</p>
                )}
              </div>
            </div>
          </div>

          {/* Statistiken */}
          <div className="flex flex-wrap gap-4 mt-5">
            <StatBadge label="Gesamt" value={deck.cardCount} color="bg-gray-100 text-text" />
            <StatBadge label="Neu" value={deck.progress.newCards} color="bg-secondary/10 text-secondary" />
            <StatBadge label="Lernen" value={deck.progress.learningCards} color="bg-accent/10 text-accent" />
            <StatBadge label="Wiederholen" value={deck.progress.reviewCards} color="bg-primary/10 text-primary" />
          </div>

          {/* Aktions-Buttons */}
          <div className="flex flex-wrap gap-3 mt-6">
            <Link
              href={`/lernen/${deck.id}`}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-white font-bold rounded-xl shadow-button hover:bg-primary-dark active:translate-y-1 active:shadow-none transition-all"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
              </svg>
              Lernen starten
            </Link>
            <button
              onClick={() => setShowDeleteModal(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-red-50 text-red-600 font-bold rounded-xl hover:bg-red-100 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.519.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
              </svg>
              Löschen
            </button>

            {/* OpenDeck Share */}
            {shareStatus === "none" && deck.cardCount >= MIN_CARDS_FOR_SHARE && (
              <button
                onClick={handleShareRequest}
                disabled={shareLoading}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-secondary/10 text-secondary font-bold rounded-xl hover:bg-secondary/20 transition-colors disabled:opacity-50"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                  <path d="M21.721 12.752a9.711 9.711 0 00-.945-5.003 12.754 12.754 0 01-4.339 2.708 18.991 18.991 0 01-.214 4.772 17.165 17.165 0 005.498-2.477zM14.634 15.55a17.324 17.324 0 00.332-4.647c-.952.227-1.945.347-2.966.347-1.021 0-2.014-.12-2.966-.347a17.515 17.515 0 00.332 4.647 17.385 17.385 0 005.268 0z" />
                </svg>
                {shareLoading ? "Wird gesendet..." : "Als OpenDeck teilen"}
              </button>
            )}
            {shareStatus === "none" && deck.cardCount < MIN_CARDS_FOR_SHARE && (
              <span className="inline-flex items-center gap-2 px-5 py-2.5 text-text-light text-sm">
                Mind. {MIN_CARDS_FOR_SHARE} Karten zum Teilen noetig
              </span>
            )}
            {shareStatus === "pending" && (
              <span className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-50 text-yellow-700 font-bold rounded-xl text-sm">
                Freigabe ausstehend
              </span>
            )}
            {shareStatus === "approved" && (
              <span className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary font-bold rounded-xl text-sm">
                Als OpenDeck geteilt
              </span>
            )}
            {shareStatus === "rejected" && (
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 font-bold rounded-xl text-sm">
                  Abgelehnt{deck.shareRejectionReason ? `: ${deck.shareRejectionReason}` : ""}
                </span>
                <button
                  onClick={handleShareRequest}
                  disabled={shareLoading}
                  className="px-4 py-2 bg-secondary/10 text-secondary font-bold rounded-xl text-sm hover:bg-secondary/20 transition-colors disabled:opacity-50"
                >
                  Erneut anfragen
                </button>
              </div>
            )}
          </div>

          {shareError && (
            <p className="text-sm text-red-500 mt-2">{shareError}</p>
          )}
        </div>
      </div>

      {/* Karten-Liste */}
      <KartenListe cards={deck.cards} deckId={deck.id} />

      {/* Loeschen-Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Deck löschen?"
        actions={
          <>
            <button
              onClick={() => setShowDeleteModal(false)}
              className="px-4 py-2 bg-gray-100 text-text font-bold rounded-xl hover:bg-gray-200 transition-colors"
            >
              Abbrechen
            </button>
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="px-4 py-2 bg-red-500 text-white font-bold rounded-xl hover:bg-red-600 transition-colors disabled:opacity-50"
            >
              {isDeleting ? "Wird gelöscht..." : "Endgültig löschen"}
            </button>
          </>
        }
      >
        <p className="text-text">
          Bist du sicher, dass du das Deck <strong>&ldquo;{deck.name}&rdquo;</strong> loeschen moechtest?
          Alle {deck.cardCount} Karten werden unwiderruflich geloescht.
        </p>
      </Modal>
    </div>
  )
}

// Hilfskomponente fuer Statistik-Badge
interface StatBadgeProps {
  label: string
  value: number
  color: string
}

function StatBadge({ label, value, color }: StatBadgeProps) {
  return (
    <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold ${color}`}>
      <span>{value}</span>
      <span className="font-semibold">{label}</span>
    </div>
  )
}
