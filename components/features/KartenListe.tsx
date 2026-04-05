"use client"

// components/features/KartenListe.tsx
// Liste aller Karten eines Decks mit Bearbeiten, Loeschen und Neue-Karte-Funktionalitaet.

import { useState } from "react"
import { useRouter } from "next/navigation"
import Modal from "@/components/ui/Modal"
import KarteAnzeige from "@/components/features/KarteAnzeige"

interface CardData {
  id: string
  front: string
  back: string
  hint?: string | null
  state: number
  due: string
}

interface KartenListeProps {
  cards: CardData[]
  deckId: string
}

export default function KartenListe({ cards, deckId }: KartenListeProps) {
  const router = useRouter()
  const [showNewCardForm, setShowNewCardForm] = useState(false)
  const [editingCard, setEditingCard] = useState<CardData | null>(null)
  const [deletingCard, setDeletingCard] = useState<CardData | null>(null)
  const [previewCard, setPreviewCard] = useState<CardData | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState("")

  // Formular-State
  const [front, setFront] = useState("")
  const [back, setBack] = useState("")
  const [hint, setHint] = useState("")

  function resetForm() {
    setFront("")
    setBack("")
    setHint("")
    setError("")
    setIsSubmitting(false)
  }

  function openNewCardForm() {
    resetForm()
    setShowNewCardForm(true)
  }

  function openEditForm(card: CardData) {
    setFront(card.front)
    setBack(card.back)
    setHint(card.hint ?? "")
    setError("")
    setEditingCard(card)
  }

  async function handleCreateCard() {
    if (!front.trim() || !back.trim()) {
      setError("Beide Seiten muessen ausgefuellt sein.")
      return
    }

    setIsSubmitting(true)
    setError("")

    try {
      const response = await fetch("/api/karten", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ front: front.trim(), back: back.trim(), hint: hint.trim() || undefined, deckId }),
      })

      if (!response.ok) {
        const data: { error?: string } = await response.json()
        setError(data.error ?? "Karte konnte nicht erstellt werden.")
        return
      }

      setShowNewCardForm(false)
      resetForm()
      router.refresh()
    } catch {
      setError("Karte konnte nicht erstellt werden.")
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleUpdateCard() {
    if (!editingCard) return
    if (!front.trim() || !back.trim()) {
      setError("Beide Seiten muessen ausgefuellt sein.")
      return
    }

    setIsSubmitting(true)
    setError("")

    try {
      const response = await fetch(`/api/karten/${editingCard.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ front: front.trim(), back: back.trim(), hint: hint.trim() || null }),
      })

      if (!response.ok) {
        const data: { error?: string } = await response.json()
        setError(data.error ?? "Karte konnte nicht aktualisiert werden.")
        return
      }

      setEditingCard(null)
      resetForm()
      router.refresh()
    } catch {
      setError("Karte konnte nicht aktualisiert werden.")
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleDeleteCard() {
    if (!deletingCard) return

    setIsSubmitting(true)

    try {
      const response = await fetch(`/api/karten/${deletingCard.id}`, {
        method: "DELETE",
      })

      if (response.ok) {
        setDeletingCard(null)
        router.refresh()
      }
    } catch {
      // Fehler still behandeln
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-extrabold text-text-dark">
          Karten ({cards.length})
        </h2>
        <div className="flex gap-2">
          <button
            onClick={openNewCardForm}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-white font-bold rounded-xl text-sm shadow-button hover:bg-primary-dark active:translate-y-1 active:shadow-none transition-all"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
              <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
            </svg>
            Neue Karte
          </button>
          <a
            href={`/import?deckId=${deckId}`}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-secondary text-white font-bold rounded-xl text-sm shadow-button-secondary hover:bg-secondary-dark active:translate-y-1 active:shadow-none transition-all"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
              <path d="M9.25 13.25a.75.75 0 001.5 0V4.636l2.955 3.129a.75.75 0 001.09-1.03l-4.25-4.5a.75.75 0 00-1.09 0l-4.25 4.5a.75.75 0 101.09 1.03L9.25 4.636v8.614z" />
              <path d="M3.5 12.75a.75.75 0 00-1.5 0v2.5A2.75 2.75 0 004.75 18h10.5A2.75 2.75 0 0018 15.25v-2.5a.75.75 0 00-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5z" />
            </svg>
            Importieren
          </a>
        </div>
      </div>

      {cards.length > 0 ? (
        <div className="space-y-3">
          {cards.map((card) => (
            <CardRow
              key={card.id}
              card={card}
              onEdit={() => openEditForm(card)}
              onDelete={() => setDeletingCard(card)}
              onPreview={() => setPreviewCard(card)}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-surface-card rounded-2xl shadow-card">
          <span className="text-5xl block mb-3" aria-hidden="true">&#128195;</span>
          <h3 className="text-lg font-extrabold text-text-dark mb-1">
            Dieses Deck hat noch keine Karten
          </h3>
          <p className="text-text-light mb-4">
            Fuege jetzt welche hinzu und starte mit dem Lernen!
          </p>
          <div className="flex justify-center gap-3">
            <button
              onClick={openNewCardForm}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-primary text-white font-bold rounded-xl shadow-button hover:bg-primary-dark active:translate-y-1 active:shadow-none transition-all"
            >
              Karte erstellen
            </button>
            <a
              href={`/import?deckId=${deckId}`}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-secondary text-white font-bold rounded-xl shadow-button-secondary hover:bg-secondary-dark active:translate-y-1 active:shadow-none transition-all"
            >
              Karten importieren
            </a>
          </div>
        </div>
      )}

      {/* Neue Karte Modal */}
      <Modal
        isOpen={showNewCardForm}
        onClose={() => { setShowNewCardForm(false); resetForm() }}
        title="Neue Karte erstellen"
        actions={
          <>
            <button
              onClick={() => { setShowNewCardForm(false); resetForm() }}
              className="px-4 py-2 bg-gray-100 text-text font-bold rounded-xl hover:bg-gray-200 transition-colors"
            >
              Abbrechen
            </button>
            <button
              onClick={handleCreateCard}
              disabled={isSubmitting}
              className="px-4 py-2 bg-primary text-white font-bold rounded-xl hover:bg-primary-dark transition-colors disabled:opacity-50"
            >
              {isSubmitting ? "Wird erstellt..." : "Karte erstellen"}
            </button>
          </>
        }
      >
        <CardForm
          front={front}
          back={back}
          hint={hint}
          onFrontChange={setFront}
          onBackChange={setBack}
          onHintChange={setHint}
          error={error}
        />
      </Modal>

      {/* Bearbeiten Modal */}
      <Modal
        isOpen={editingCard !== null}
        onClose={() => { setEditingCard(null); resetForm() }}
        title="Karte bearbeiten"
        actions={
          <>
            <button
              onClick={() => { setEditingCard(null); resetForm() }}
              className="px-4 py-2 bg-gray-100 text-text font-bold rounded-xl hover:bg-gray-200 transition-colors"
            >
              Abbrechen
            </button>
            <button
              onClick={handleUpdateCard}
              disabled={isSubmitting}
              className="px-4 py-2 bg-primary text-white font-bold rounded-xl hover:bg-primary-dark transition-colors disabled:opacity-50"
            >
              {isSubmitting ? "Wird gespeichert..." : "Speichern"}
            </button>
          </>
        }
      >
        <CardForm
          front={front}
          back={back}
          hint={hint}
          onFrontChange={setFront}
          onBackChange={setBack}
          onHintChange={setHint}
          error={error}
        />
      </Modal>

      {/* Loeschen-Modal */}
      <Modal
        isOpen={deletingCard !== null}
        onClose={() => setDeletingCard(null)}
        title="Karte loeschen?"
        actions={
          <>
            <button
              onClick={() => setDeletingCard(null)}
              className="px-4 py-2 bg-gray-100 text-text font-bold rounded-xl hover:bg-gray-200 transition-colors"
            >
              Abbrechen
            </button>
            <button
              onClick={handleDeleteCard}
              disabled={isSubmitting}
              className="px-4 py-2 bg-red-500 text-white font-bold rounded-xl hover:bg-red-600 transition-colors disabled:opacity-50"
            >
              {isSubmitting ? "Wird geloescht..." : "Loeschen"}
            </button>
          </>
        }
      >
        <p className="text-text">
          Bist du sicher, dass du diese Karte loeschen moechtest? Dies kann nicht rueckgaengig gemacht werden.
        </p>
        {deletingCard && (
          <div className="mt-3 p-3 bg-gray-50 rounded-lg">
            <p className="text-sm font-semibold text-text-dark">{deletingCard.front}</p>
            <p className="text-sm text-text-light mt-1">{deletingCard.back}</p>
          </div>
        )}
      </Modal>

      {/* Vorschau-Modal */}
      <Modal
        isOpen={previewCard !== null}
        onClose={() => setPreviewCard(null)}
        title="Kartenvorschau"
      >
        {previewCard && (
          <div className="py-2">
            <KarteAnzeige
              front={previewCard.front}
              back={previewCard.back}
              hint={previewCard.hint}
              state={previewCard.state}
            />
          </div>
        )}
      </Modal>
    </div>
  )
}

// Hilfskomponente: Karten-Zeile in der Liste
interface CardRowProps {
  card: CardData
  onEdit: () => void
  onDelete: () => void
  onPreview: () => void
}

const STATE_LABELS: Record<number, { label: string; color: string }> = {
  0: { label: "Neu", color: "bg-secondary/10 text-secondary" },
  1: { label: "Lernen", color: "bg-accent/10 text-accent" },
  2: { label: "Wiederholen", color: "bg-primary/10 text-primary" },
  3: { label: "Erneut lernen", color: "bg-red-100 text-red-600" },
}

function CardRow({ card, onEdit, onDelete, onPreview }: CardRowProps) {
  const stateInfo = STATE_LABELS[card.state] ?? STATE_LABELS[0]

  return (
    <div className="bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow p-4 flex items-center justify-between gap-4">
      <button
        onClick={onPreview}
        className="min-w-0 flex-1 text-left"
      >
        <p className="font-semibold text-text-dark truncate">{card.front}</p>
        <p className="text-sm text-text-light truncate mt-0.5">{card.back}</p>
      </button>

      <div className="flex items-center gap-2 shrink-0">
        <span className={`text-xs font-bold px-2.5 py-1 rounded-full whitespace-nowrap ${stateInfo.color}`}>
          {stateInfo.label}
        </span>

        <button
          onClick={onEdit}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-text-light hover:bg-gray-100 hover:text-secondary transition-colors"
          aria-label="Karte bearbeiten"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
            <path d="M2.695 14.763l-1.262 3.154a.5.5 0 00.65.65l3.155-1.262a4 4 0 001.343-.885L17.5 5.5a2.121 2.121 0 00-3-3L3.58 13.42a4 4 0 00-.885 1.343z" />
          </svg>
        </button>

        <button
          onClick={onDelete}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-text-light hover:bg-red-50 hover:text-red-500 transition-colors"
          aria-label="Karte loeschen"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
            <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.519.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
          </svg>
        </button>
      </div>
    </div>
  )
}

// Hilfskomponente: Formular fuer Karten-Erstellung/Bearbeitung
interface CardFormProps {
  front: string
  back: string
  hint: string
  onFrontChange: (value: string) => void
  onBackChange: (value: string) => void
  onHintChange: (value: string) => void
  error: string
}

function CardForm({ front, back, hint, onFrontChange, onBackChange, onHintChange, error }: CardFormProps) {
  return (
    <div className="space-y-4">
      {error && (
        <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm font-semibold">
          {error}
        </div>
      )}
      <div>
        <label htmlFor="card-front" className="block text-sm font-bold text-text-dark mb-1">
          Vorderseite
        </label>
        <textarea
          id="card-front"
          value={front}
          onChange={(e) => onFrontChange(e.target.value)}
          placeholder="Frage oder Begriff..."
          rows={3}
          maxLength={2000}
          className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl text-text focus:border-primary focus:outline-none transition-colors resize-none"
        />
        <p className="text-xs text-text-light mt-1 text-right">{front.length}/2000</p>
      </div>
      <div>
        <label htmlFor="card-hint" className="block text-sm font-bold text-text-dark mb-1">
          Hinweis <span className="font-normal text-text-light">(optional)</span>
        </label>
        <textarea
          id="card-hint"
          value={hint}
          onChange={(e) => onHintChange(e.target.value)}
          placeholder="Tipp oder Eselsbruecke..."
          rows={2}
          maxLength={500}
          className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl text-text focus:border-accent focus:outline-none transition-colors resize-none"
        />
        <p className="text-xs text-text-light mt-1 text-right">{hint.length}/500</p>
      </div>
      <div>
        <label htmlFor="card-back" className="block text-sm font-bold text-text-dark mb-1">
          Rueckseite
        </label>
        <textarea
          id="card-back"
          value={back}
          onChange={(e) => onBackChange(e.target.value)}
          placeholder="Antwort oder Definition..."
          rows={3}
          maxLength={2000}
          className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl text-text focus:border-primary focus:outline-none transition-colors resize-none"
        />
        <p className="text-xs text-text-light mt-1 text-right">{back.length}/2000</p>
      </div>
    </div>
  )
}
