"use client"

// app/(dashboard)/decks/neu/page.tsx
// Formular zum Erstellen eines neuen Decks mit Name, Beschreibung, Farbe und Icon.

import { useState } from "react"
import { useRouter } from "next/navigation"
import { AVAILABLE_COLORS } from "@/lib/validations/deck"

const AVAILABLE_ICONS = [
  "📚", "📖", "🧠", "🔬", "🧪", "💊",
  "📐", "🔢", "🌍", "🏛️", "💻", "🎨",
  "🎵", "⚖️", "🩺", "📝", "🗣️", "🇬🇧",
  "🇫🇷", "🇪🇸", "🇯🇵", "🇨🇳", "📊", "🧬",
]

export default function NewDeckPage() {
  const router = useRouter()
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [color, setColor] = useState<string>(AVAILABLE_COLORS[0])
  const [icon, setIcon] = useState(AVAILABLE_ICONS[0])
  const [error, setError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError("")

    if (!name.trim()) {
      setError("Bitte gib einen Namen für dein Deck ein.")
      return
    }

    if (name.length > 100) {
      setError("Der Deck-Name darf maximal 100 Zeichen lang sein.")
      return
    }

    if (description.length > 500) {
      setError("Die Beschreibung darf maximal 500 Zeichen lang sein.")
      return
    }

    setIsSubmitting(true)

    try {
      const response = await fetch("/api/decks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), description: description.trim(), color, icon }),
      })

      if (!response.ok) {
        const data = await response.json() as { error?: string }
        setError(data.error ?? "Deck konnte nicht erstellt werden.")
        return
      }

      router.push("/decks")
      router.refresh()
    } catch {
      setError("Verbindungsfehler. Bitte versuche es erneut.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="max-w-xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-extrabold text-text-dark">
          Neus Deck erstellen
        </h1>
        <p className="text-text-light mt-1">
          Erstelle ein Deck, um deine Karteikarten zu organisieren.
        </p>
      </div>

      {/* Formular */}
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Fehler-Anzeige */}
        {error && (
          <div className="bg-red-50 text-red-600 text-sm font-semibold px-4 py-3 rounded-xl">
            {error}
          </div>
        )}

        {/* Name */}
        <div>
          <label htmlFor="deck-name" className="block text-sm font-bold text-text-dark mb-1.5">
            Name *
          </label>
          <input
            id="deck-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="z.B. Biologie Semester 2"
            maxLength={100}
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-text focus:outline-none focus:border-primary transition-colors"
            autoFocus
          />
          <p className="text-xs text-text-light mt-1">{name.length}/100 Zeichen</p>
        </div>

        {/* Beschreibung */}
        <div>
          <label htmlFor="deck-description" className="block text-sm font-bold text-text-dark mb-1.5">
            Beschreibung (optional)
          </label>
          <textarea
            id="deck-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Worum geht es in diesem Deck?"
            maxLength={500}
            rows={3}
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-text focus:outline-none focus:border-primary transition-colors resize-none"
          />
          <p className="text-xs text-text-light mt-1">{description.length}/500 Zeichen</p>
        </div>

        {/* Farbe */}
        <div>
          <label className="block text-sm font-bold text-text-dark mb-2">
            Farbe
          </label>
          <div className="flex flex-wrap gap-3">
            {AVAILABLE_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={`w-10 h-10 rounded-full transition-all duration-150 ${
                  color === c
                    ? "ring-4 ring-offset-2 ring-gray-400 scale-110"
                    : "hover:scale-110"
                }`}
                style={{ backgroundColor: c }}
                aria-label={`Farbe ${c}`}
                aria-pressed={color === c}
              />
            ))}
          </div>
        </div>

        {/* Icon */}
        <div>
          <label className="block text-sm font-bold text-text-dark mb-2">
            Icon
          </label>
          <div className="flex flex-wrap gap-2">
            {AVAILABLE_ICONS.map((i) => (
              <button
                key={i}
                type="button"
                onClick={() => setIcon(i)}
                className={`w-11 h-11 flex items-center justify-center text-2xl rounded-xl transition-all duration-150 ${
                  icon === i
                    ? "bg-primary/10 ring-2 ring-primary scale-110"
                    : "bg-gray-100 hover:bg-gray-200 hover:scale-105"
                }`}
                aria-label={`Icon ${i}`}
                aria-pressed={icon === i}
              >
                {i}
              </button>
            ))}
          </div>
        </div>

        {/* Vorschau */}
        <div>
          <label className="block text-sm font-bold text-text-dark mb-2">
            Vorschau
          </label>
          <div className="bg-surface-card rounded-2xl shadow-card overflow-hidden inline-block">
            <div className="h-2 w-full" style={{ backgroundColor: color }} />
            <div className="p-5">
              <span className="text-4xl block mb-2">{icon}</span>
              <p className="font-extrabold text-text-dark text-lg">
                {name || "Deck-Name"}
              </p>
              <p className="text-sm text-text-light mt-1">0 Karten</p>
            </div>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex-1 px-6 py-3 bg-primary text-white font-bold rounded-2xl shadow-button hover:bg-primary-dark active:translate-y-1 active:shadow-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? "Wird erstellt..." : "Deck erstellen"}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="px-6 py-3 bg-gray-100 text-text font-bold rounded-2xl hover:bg-gray-200 transition-colors"
          >
            Abbrechen
          </button>
        </div>
      </form>
    </div>
  )
}
