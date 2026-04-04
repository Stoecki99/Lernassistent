"use client"

// components/features/ChatFenster.tsx
// Chat-Interface mit Streaming, Auto-Scroll und CSV-Export/Import.

import { useState, useRef, useEffect, useCallback } from "react"
import ChatNachricht from "@/components/features/ChatNachricht"

interface ChatMessage {
  id: string
  role: "user" | "assistant"
  content: string
  createdAt: string
}

interface DeckOption {
  id: string
  name: string
  icon: string
}

interface ChatFensterProps {
  initialMessages: ChatMessage[]
  decks: DeckOption[]
}

/** Generiert eine temporaere ID fuer optimistic updates */
function generateTempId(): string {
  return `temp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

/** Erstellt CSV-Download */
function downloadCsv(csvContent: string): void {
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = `karteikarten-${Date.now()}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

export default function ChatFenster({ initialMessages, decks }: ChatFensterProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages)
  const [input, setInput] = useState("")
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showImportModal, setShowImportModal] = useState(false)
  const [csvToImport, setCsvToImport] = useState("")
  const [importLoading, setImportLoading] = useState(false)
  const [importResult, setImportResult] = useState<string | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)

  /** Auto-Scroll nach unten */
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  /** Textarea-Hoehe automatisch anpassen */
  function adjustTextareaHeight(): void {
    const textarea = textareaRef.current
    if (!textarea) return
    textarea.style.height = "auto"
    textarea.style.height = `${Math.min(textarea.scrollHeight, 150)}px`
  }

  /** Nachricht senden */
  async function handleSend(): Promise<void> {
    const trimmedInput = input.trim()
    if (!trimmedInput || isStreaming) return

    setError(null)
    setInput("")
    setIsStreaming(true)

    // Textarea-Hoehe zuruecksetzen
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"
    }

    // User-Nachricht optimistic hinzufuegen
    const userMessage: ChatMessage = {
      id: generateTempId(),
      role: "user",
      content: trimmedInput,
      createdAt: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, userMessage])

    // Placeholder fuer Assistant-Antwort
    const assistantId = generateTempId()
    const assistantMessage: ChatMessage = {
      id: assistantId,
      role: "assistant",
      content: "",
      createdAt: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, assistantMessage])

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmedInput }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => null)
        const errorMessage =
          (errorData as { error?: string } | null)?.error ?? "Chat-Anfrage fehlgeschlagen."
        throw new Error(errorMessage)
      }

      if (!response.body) {
        throw new Error("Keine Streaming-Antwort erhalten.")
      }

      // Stream lesen
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let accumulated = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        accumulated += chunk

        // Assistant-Nachricht updaten
        const currentContent = accumulated
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantId
              ? { ...msg, content: currentContent }
              : msg
          )
        )
      }

      // Falls keine Antwort kam
      if (!accumulated.trim()) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantId
              ? { ...msg, content: "Entschuldigung, ich konnte keine Antwort generieren." }
              : msg
          )
        )
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Ein Fehler ist aufgetreten."
      setError(errorMessage)

      // Entferne die leere Assistant-Nachricht bei Fehler
      setMessages((prev) => prev.filter((msg) => msg.id !== assistantId))
    } finally {
      setIsStreaming(false)
    }
  }

  /** Tastendruck im Eingabefeld */
  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>): void {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  /** CSV exportieren als Download */
  function handleCsvExport(csv: string): void {
    downloadCsv(csv)
  }

  /** CSV direkt in Deck importieren (Modal oeffnen) */
  function handleCsvImport(csv: string): void {
    setCsvToImport(csv)
    setImportResult(null)
    setShowImportModal(true)
  }

  /** Import in ausgewaehltes Deck */
  async function handleImportToDeck(deckId: string): Promise<void> {
    if (!csvToImport || importLoading) return

    setImportLoading(true)
    setImportResult(null)

    try {
      // CSV als File-Objekt erstellen fuer den bestehenden Import-Endpunkt
      const blob = new Blob([csvToImport], { type: "text/csv" })
      const file = new File([blob], "chat-export.csv", { type: "text/csv" })

      const formData = new FormData()
      formData.append("file", file)
      formData.append("deckId", deckId)
      formData.append("format", "csv")

      const response = await fetch("/api/karten/import", {
        method: "POST",
        body: formData,
      })

      const data: unknown = await response.json()
      const result = data as { message?: string; error?: string; imported?: number }

      if (!response.ok) {
        setImportResult(result.error ?? "Import fehlgeschlagen.")
        return
      }

      setImportResult(result.message ?? "Import erfolgreich!")
      setTimeout(() => {
        setShowImportModal(false)
        setImportResult(null)
      }, 2000)
    } catch {
      setImportResult("Import fehlgeschlagen. Bitte versuche es erneut.")
    } finally {
      setImportLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-2rem)] md:h-[calc(100vh-4rem)] -mx-4 -my-6 md:-mx-8 md:-my-8">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 md:px-6 md:py-4 border-b border-gray-100 bg-white">
        <div className="w-10 h-10 rounded-full bg-secondary/10 flex items-center justify-center">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="w-5 h-5 text-secondary"
          >
            <path
              fillRule="evenodd"
              d="M4.848 2.771A49.144 49.144 0 0112 2.25c2.43 0 4.817.178 7.152.52 1.978.292 3.348 2.024 3.348 3.97v6.02c0 1.946-1.37 3.678-3.348 3.97a48.901 48.901 0 01-3.476.383.39.39 0 00-.297.17l-2.755 4.133a.75.75 0 01-1.248 0l-2.755-4.133a.39.39 0 00-.297-.17 48.9 48.9 0 01-3.476-.384c-1.978-.29-3.348-2.024-3.348-3.97V6.741c0-1.946 1.37-3.68 3.348-3.97z"
              clipRule="evenodd"
            />
          </svg>
        </div>
        <div>
          <h1 className="text-lg font-bold text-text-dark">Lernassistent</h1>
          <p className="text-xs text-text-light">
            Frag mich alles zum Lernen oder lass mich Karteikarten erstellen
          </p>
        </div>
      </div>

      {/* Nachrichtenverlauf */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto px-4 py-4 md:px-6 bg-surface"
      >
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 rounded-full bg-secondary/10 flex items-center justify-center mb-4">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="w-8 h-8 text-secondary"
              >
                <path
                  fillRule="evenodd"
                  d="M4.848 2.771A49.144 49.144 0 0112 2.25c2.43 0 4.817.178 7.152.52 1.978.292 3.348 2.024 3.348 3.97v6.02c0 1.946-1.37 3.678-3.348 3.97a48.901 48.901 0 01-3.476.383.39.39 0 00-.297.17l-2.755 4.133a.75.75 0 01-1.248 0l-2.755-4.133a.39.39 0 00-.297-.17 48.9 48.9 0 01-3.476-.384c-1.978-.29-3.348-2.024-3.348-3.97V6.741c0-1.946 1.37-3.68 3.348-3.97z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-text-dark mb-2">
              Hallo! Wie kann ich dir helfen?
            </h2>
            <p className="text-text-light max-w-md">
              Ich kann dir bei Themen helfen, Fragen beantworten und Karteikarten
              im CSV-Format erstellen, die du direkt importieren kannst.
            </p>
            <div className="flex flex-wrap gap-2 mt-6 justify-center">
              {[
                "Erklaere mir Photosynthese",
                "Erstelle 5 Karteikarten zum Thema Zellbiologie",
                "Was ist der Unterschied zwischen Mitose und Meiose?",
              ].map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => {
                    setInput(suggestion)
                    textareaRef.current?.focus()
                  }}
                  className="px-3 py-2 bg-white rounded-xl text-sm text-text-light border border-gray-200 hover:border-secondary hover:text-secondary transition-colors"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <ChatNachricht
            key={msg.id}
            role={msg.role}
            content={msg.content}
            createdAt={msg.createdAt}
            onCsvExport={handleCsvExport}
            onCsvImport={handleCsvImport}
          />
        ))}

        {/* Typing-Indicator */}
        {isStreaming && messages[messages.length - 1]?.content === "" && (
          <div className="flex justify-start mb-3">
            <div className="bg-white rounded-2xl px-4 py-3 shadow-sm border border-gray-100">
              <div className="flex gap-1.5 items-center h-5">
                <span className="w-2 h-2 bg-text-light/40 rounded-full animate-bounce [animation-delay:0ms]" />
                <span className="w-2 h-2 bg-text-light/40 rounded-full animate-bounce [animation-delay:150ms]" />
                <span className="w-2 h-2 bg-text-light/40 rounded-full animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Fehlermeldung */}
      {error && (
        <div className="px-4 py-2 bg-red-50 border-t border-red-100">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Eingabefeld */}
      <div className="border-t border-gray-100 bg-white px-4 py-3 md:px-6 safe-area-bottom">
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value)
              adjustTextareaHeight()
            }}
            onKeyDown={handleKeyDown}
            placeholder="Schreib eine Nachricht..."
            disabled={isStreaming}
            rows={1}
            className="flex-1 resize-none rounded-xl border border-gray-200 px-4 py-3 text-[15px] text-text placeholder:text-text-light/50 focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary/30 disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={!input.trim() || isStreaming}
            aria-label={isStreaming ? "Nachricht wird gesendet" : "Nachricht senden"}
            className="flex-shrink-0 w-11 h-11 rounded-xl bg-secondary text-white flex items-center justify-center hover:bg-secondary-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed btn-press focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2"
          >
            {isStreaming ? (
              <svg
                className="w-5 h-5 animate-spin"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="w-5 h-5"
              >
                <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
              </svg>
            )}
          </button>
        </div>
        <p className="text-xs text-text-light/50 mt-1.5 text-center">
          Shift+Enter fuer Zeilenumbruch
        </p>
      </div>

      {/* Import-Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" role="dialog" aria-modal="true" aria-labelledby="import-modal-title">
          <div className="bg-white rounded-2xl shadow-xl p-6 mx-4 w-full max-w-md">
            <h3 id="import-modal-title" className="text-lg font-bold text-text-dark mb-1">
              In Deck importieren
            </h3>
            <p className="text-sm text-text-light mb-4">
              Waehle ein Deck, in das die Karteikarten importiert werden sollen.
            </p>

            {importResult && (
              <div
                className={`mb-4 p-3 rounded-xl text-sm ${
                  importResult.includes("erfolgreich")
                    ? "bg-primary/10 text-primary-dark"
                    : "bg-red-50 text-red-600"
                }`}
              >
                {importResult}
              </div>
            )}

            {decks.length === 0 ? (
              <p className="text-sm text-text-light py-4 text-center">
                Du hast noch keine Decks. Erstelle zuerst ein Deck unter &quot;Decks&quot;.
              </p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {decks.map((deck) => (
                  <button
                    key={deck.id}
                    type="button"
                    onClick={() => handleImportToDeck(deck.id)}
                    disabled={importLoading}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-200 hover:border-primary hover:bg-primary/5 transition-colors text-left disabled:opacity-50"
                  >
                    <span className="text-xl">{deck.icon}</span>
                    <span className="font-semibold text-text">{deck.name}</span>
                  </button>
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                setShowImportModal(false)
                setImportResult(null)
              }}
              className="w-full mt-4 px-4 py-2.5 rounded-xl border border-gray-200 text-text-light font-semibold hover:bg-gray-50 transition-colors"
            >
              Abbrechen
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
