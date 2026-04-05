"use client"

// components/features/ChatFenster.tsx
// Chat-Interface mit Streaming, Auto-Scroll, CSV-Export/Import,
// Datei-Upload und Interview-Willkommensnachricht.

import { useState, useRef, useEffect, useCallback } from "react"
import ChatNachricht from "@/components/features/ChatNachricht"

// ---------------------------------------------------------------------------
// Typen
// ---------------------------------------------------------------------------

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

interface FileAttachment {
  file: File
  preview: string // Dateiname + Groesse fuer Anzeige
}

interface ProcessedAttachment {
  type: "text" | "image"
  content: string
  filename: string
  mediaType?: string
}

// ---------------------------------------------------------------------------
// Stream-Metadaten-Protokoll (muss mit route.ts uebereinstimmen)
// ---------------------------------------------------------------------------

const STREAM_META_MARKER = "\n\n__CHAT_META__"
const STREAM_ERROR_MARKER = "\n\n__CHAT_ERROR__"

// ---------------------------------------------------------------------------
// Konstanten
// ---------------------------------------------------------------------------

const MAX_FILES = 3
const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5 MB
const ALLOWED_ACCEPT = ".pdf,.png,.jpg,.jpeg,.txt,.md"

// ---------------------------------------------------------------------------
// Hilfs-Funktionen
// ---------------------------------------------------------------------------

function generateTempId(): string {
  return `temp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function downloadCsv(csvContent: string): void {
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = `karteikarten-${Date.now()}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// ---------------------------------------------------------------------------
// Willkommens-Nachricht (Interview-Flow Start)
// ---------------------------------------------------------------------------

const WELCOME_MESSAGE: ChatMessage = {
  id: "welcome",
  role: "assistant",
  content:
    "Hallo! Ich bin dein Lernassistent. Lass uns gemeinsam Karteikarten erstellen!\n\nErzähl mir zuerst: **Welches Fach oder Modul lernst du gerade?**",
  createdAt: new Date().toISOString(),
}

// ---------------------------------------------------------------------------
// Komponente
// ---------------------------------------------------------------------------

export default function ChatFenster({ initialMessages, decks }: ChatFensterProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    // Willkommensnachricht nur wenn keine vorherigen Nachrichten
    if (initialMessages.length === 0) return [WELCOME_MESSAGE]
    return initialMessages
  })
  const [input, setInput] = useState("")
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showImportModal, setShowImportModal] = useState(false)
  const [csvToImport, setCsvToImport] = useState("")
  const [importLoading, setImportLoading] = useState(false)
  const [importResult, setImportResult] = useState<string | null>(null)
  const [attachedFiles, setAttachedFiles] = useState<FileAttachment[]>([])
  const [uploadProgress, setUploadProgress] = useState(false)
  const [showChips, setShowChips] = useState(initialMessages.length === 0)
  const [isDragOver, setIsDragOver] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Auto-Scroll
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  // Textarea-Hoehe automatisch anpassen
  function adjustTextareaHeight(): void {
    const textarea = textareaRef.current
    if (!textarea) return
    textarea.style.height = "auto"
    textarea.style.height = `${Math.min(textarea.scrollHeight, 150)}px`
  }

  // -------------------------------------------------------------------------
  // Datei-Upload
  // -------------------------------------------------------------------------

  function handleFileSelect(files: FileList | null): void {
    if (!files) return

    const newFiles: FileAttachment[] = []
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      if (attachedFiles.length + newFiles.length >= MAX_FILES) {
        setError(`Maximal ${MAX_FILES} Dateien erlaubt.`)
        break
      }
      if (file.size > MAX_FILE_SIZE) {
        setError(`"${file.name}" ist zu gross. Maximal 5 MB pro Datei.`)
        continue
      }
      newFiles.push({
        file,
        preview: `${file.name} (${formatFileSize(file.size)})`,
      })
    }

    setAttachedFiles((prev) => [...prev, ...newFiles])
    // File-Input zuruecksetzen
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  function removeAttachment(index: number): void {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== index))
  }

  async function uploadFiles(files: FileAttachment[]): Promise<ProcessedAttachment[]> {
    const formData = new FormData()
    for (const f of files) {
      formData.append("files", f.file)
    }

    const response = await fetch("/api/chat/upload", {
      method: "POST",
      body: formData,
    })

    if (!response.ok) {
      const data = await response.json().catch(() => null)
      throw new Error(
        (data as { error?: string } | null)?.error ?? "Upload fehlgeschlagen."
      )
    }

    const data: unknown = await response.json()
    return (data as { attachments: ProcessedAttachment[] }).attachments
  }

  // -------------------------------------------------------------------------
  // Drag & Drop
  // -------------------------------------------------------------------------

  function handleDragOver(e: React.DragEvent): void {
    e.preventDefault()
    setIsDragOver(true)
  }

  function handleDragLeave(e: React.DragEvent): void {
    e.preventDefault()
    setIsDragOver(false)
  }

  function handleDrop(e: React.DragEvent): void {
    e.preventDefault()
    setIsDragOver(false)
    handleFileSelect(e.dataTransfer.files)
  }

  // -------------------------------------------------------------------------
  // Nachricht senden
  // -------------------------------------------------------------------------

  async function handleSend(): Promise<void> {
    const trimmedInput = input.trim()
    if ((!trimmedInput && attachedFiles.length === 0) || isStreaming) return

    setError(null)
    setInput("")
    setShowChips(false)
    setIsStreaming(true)

    if (textareaRef.current) textareaRef.current.style.height = "auto"

    // Anzeige-Text mit Datei-Hinweisen
    const displayText = attachedFiles.length > 0
      ? `${trimmedInput}\n\n📎 ${attachedFiles.map((f) => f.preview).join(", ")}`
      : trimmedInput

    // User-Nachricht optimistic hinzufuegen
    const userTempId = generateTempId()
    const userMessage: ChatMessage = {
      id: userTempId,
      role: "user",
      content: displayText,
      createdAt: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, userMessage])

    // Placeholder fuer Assistant
    const assistantTempId = generateTempId()
    const assistantMessage: ChatMessage = {
      id: assistantTempId,
      role: "assistant",
      content: "",
      createdAt: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, assistantMessage])

    try {
      // Dateien hochladen falls vorhanden
      let processedAttachments: ProcessedAttachment[] | undefined
      if (attachedFiles.length > 0) {
        setUploadProgress(true)
        processedAttachments = await uploadFiles(attachedFiles)
        setUploadProgress(false)
        setAttachedFiles([])
      }

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmedInput || "Bitte analysiere die hochgeladenen Dateien.",
          attachments: processedAttachments,
        }),
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

        // Metadaten und Fehler-Marker vor Anzeige entfernen
        let displayContent = accumulated
        const metaIdx = displayContent.indexOf(STREAM_META_MARKER)
        if (metaIdx !== -1) displayContent = displayContent.slice(0, metaIdx)
        const errIdx = displayContent.indexOf(STREAM_ERROR_MARKER)
        if (errIdx !== -1) displayContent = displayContent.slice(0, errIdx)

        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantTempId
              ? { ...msg, content: displayContent }
              : msg
          )
        )
      }

      // Stream-Fehler erkennen
      const errorMarkerIdx = accumulated.indexOf(STREAM_ERROR_MARKER)
      if (errorMarkerIdx !== -1) {
        const streamError = accumulated.slice(errorMarkerIdx + STREAM_ERROR_MARKER.length)
        const visibleContent = accumulated.slice(0, errorMarkerIdx)
        if (!visibleContent.trim()) {
          // Kein Content vor dem Fehler — leere Nachricht entfernen
          setMessages((prev) => prev.filter((msg) => msg.id !== assistantTempId))
          setError(streamError)
        } else {
          // Teilweiser Content wurde gestreamt, Fehler anzeigen
          setError(streamError)
        }
        return
      }

      // Metadaten parsen fuer ID-Reconciliation (A4)
      const metaMarkerIdx = accumulated.indexOf(STREAM_META_MARKER)
      if (metaMarkerIdx !== -1) {
        const metaJson = accumulated.slice(metaMarkerIdx + STREAM_META_MARKER.length)
        try {
          const meta = JSON.parse(metaJson) as {
            userMessageId: string
            assistantMessageId: string
          }
          // Temp-IDs durch echte DB-IDs ersetzen
          setMessages((prev) =>
            prev.map((msg) => {
              if (msg.id === userTempId) return { ...msg, id: meta.userMessageId }
              if (msg.id === assistantTempId) return { ...msg, id: meta.assistantMessageId }
              return msg
            })
          )
        } catch {
          // Meta-Parsing optional — kein Fehler an User
        }
      }

      // Falls keine Antwort kam
      const finalContent = metaMarkerIdx !== -1
        ? accumulated.slice(0, metaMarkerIdx)
        : accumulated

      if (!finalContent.trim()) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantTempId
              ? { ...msg, content: "Entschuldigung, ich konnte keine Antwort generieren." }
              : msg
          )
        )
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Ein Fehler ist aufgetreten."
      setError(errorMessage)
      setMessages((prev) => prev.filter((msg) => msg.id !== assistantTempId))
      setAttachedFiles([])
      setUploadProgress(false)
    } finally {
      setIsStreaming(false)
    }
  }

  // Tastendruck
  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>): void {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // CSV-Aktionen
  function handleCsvExport(csv: string): void {
    downloadCsv(csv)
  }

  function handleCsvImport(csv: string): void {
    setCsvToImport(csv)
    setImportResult(null)
    setShowImportModal(true)
  }

  // Quick-Action Chip klick
  function handleChipClick(text: string): void {
    setInput(text)
    setShowChips(false)
    textareaRef.current?.focus()
  }

  // Import in Deck
  async function handleImportToDeck(deckId: string): Promise<void> {
    if (!csvToImport || importLoading) return

    setImportLoading(true)
    setImportResult(null)

    try {
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

  // -------------------------------------------------------------------------
  // Neuer Chat
  // -------------------------------------------------------------------------

  async function handleNewChat(): Promise<void> {
    if (isStreaming) return

    try {
      const res = await fetch("/api/chat", { method: "DELETE" })
      if (!res.ok) {
        setError("Chat konnte nicht zurueckgesetzt werden.")
        return
      }

      setMessages([WELCOME_MESSAGE])
      setInput("")
      setError(null)
      setAttachedFiles([])
      setShowChips(true)
      setCsvToImport("")
      setImportResult(null)
    } catch {
      setError("Netzwerkfehler beim Zuruecksetzen.")
    }
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div
      className="flex flex-col h-[calc(100vh-2rem)] md:h-[calc(100vh-4rem)] -mx-4 -my-6 md:-mx-8 md:-my-8"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
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
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold text-text-dark">Lernassistent</h1>
          <p className="text-xs text-text-light">
            Frag mich alles zum Lernen oder lass mich Karteikarten erstellen
          </p>
        </div>
        <button
          type="button"
          onClick={handleNewChat}
          disabled={isStreaming}
          className="px-3 py-2 text-sm font-bold text-primary bg-primary/10 rounded-xl hover:bg-primary/20 transition-colors disabled:opacity-50 min-h-[44px] min-w-[44px] shrink-0"
          title="Neuer Chat"
        >
          + Neuer Chat
        </button>
      </div>

      {/* Drag-Overlay */}
      {isDragOver && (
        <div
          className="absolute inset-0 z-40 bg-secondary/10 border-2 border-dashed border-secondary rounded-xl flex items-center justify-center pointer-events-none"
          role="status"
          aria-live="polite"
          aria-label="Dateien hier ablegen zum Hochladen"
        >
          <div className="bg-white rounded-xl px-6 py-4 shadow-lg text-center">
            <p className="text-lg font-bold text-secondary">Dateien hier ablegen</p>
            <p className="text-sm text-text-light">PDF, Bilder oder Text (max. 5 MB)</p>
          </div>
        </div>
      )}

      {/* Nachrichtenverlauf */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto px-4 py-4 md:px-6 bg-surface"
      >
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

        {/* Quick-Action Chips (D2) */}
        {showChips && messages.length <= 1 && (
          <div className="flex flex-wrap gap-2 mt-4 justify-center">
            {[
              { label: "Karteikarten erstellen", text: "Ich möchte Karteikarten erstellen." },
              { label: "Thema erklären", text: "Kannst du mir ein Thema erklären?" },
              { label: "Datei hochladen", text: "" },
            ].map((chip) => (
              <button
                key={chip.label}
                type="button"
                onClick={() => {
                  if (chip.label === "Datei hochladen") {
                    fileInputRef.current?.click()
                    setShowChips(false)
                  } else {
                    handleChipClick(chip.text)
                  }
                }}
                className="px-4 py-2 bg-white rounded-xl text-sm font-medium text-text-light border border-gray-200 hover:border-secondary hover:text-secondary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2"
              >
                {chip.label}
              </button>
            ))}
          </div>
        )}

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

      {/* Angehaengte Dateien Vorschau */}
      {attachedFiles.length > 0 && (
        <div className="px-4 py-2 bg-gray-50 border-t border-gray-100 flex flex-wrap gap-2">
          {attachedFiles.map((att, index) => (
            <div
              key={index}
              className="flex items-center gap-2 bg-white rounded-lg px-3 py-1.5 border border-gray-200 text-sm"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="w-4 h-4 text-text-light"
              >
                <path
                  fillRule="evenodd"
                  d="M15.621 4.379a3 3 0 00-4.242 0l-7 7a3 3 0 004.241 4.243h.001l.497-.5a.75.75 0 011.064 1.057l-.498.501a4.5 4.5 0 01-6.364-6.364l7-7a4.5 4.5 0 016.368 6.36l-3.455 3.553A2.625 2.625 0 119.52 9.52l3.45-3.451a.75.75 0 111.061 1.06l-3.45 3.451a1.125 1.125 0 001.587 1.595l3.454-3.553a3 3 0 000-4.242z"
                  clipRule="evenodd"
                />
              </svg>
              <span className="text-text truncate max-w-[200px]">{att.preview}</span>
              <button
                type="button"
                onClick={() => removeAttachment(index)}
                className="text-text-light hover:text-red-500 transition-colors"
                aria-label={`${att.file.name} entfernen`}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="w-4 h-4"
                >
                  <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Upload-Fortschritt */}
      {uploadProgress && (
        <div className="px-4 py-2 bg-secondary/5 border-t border-secondary/10">
          <p className="text-sm text-secondary flex items-center gap-2">
            <svg className="w-4 h-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Dateien werden verarbeitet...
          </p>
        </div>
      )}

      {/* Eingabefeld */}
      <div className="border-t border-gray-100 bg-white px-4 py-3 md:px-6 safe-area-bottom">
        <div className="flex items-end gap-2">
          {/* Upload-Button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isStreaming || attachedFiles.length >= MAX_FILES}
            aria-label="Datei anhängen"
            title="Datei anhängen (PDF, Bilder, Text)"
            className="flex-shrink-0 w-11 h-11 rounded-xl border border-gray-200 text-text-light flex items-center justify-center hover:border-secondary hover:text-secondary transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="w-5 h-5"
            >
              <path
                fillRule="evenodd"
                d="M15.621 4.379a3 3 0 00-4.242 0l-7 7a3 3 0 004.241 4.243h.001l.497-.5a.75.75 0 011.064 1.057l-.498.501a4.5 4.5 0 01-6.364-6.364l7-7a4.5 4.5 0 016.368 6.36l-3.455 3.553A2.625 2.625 0 119.52 9.52l3.45-3.451a.75.75 0 111.061 1.06l-3.45 3.451a1.125 1.125 0 001.587 1.595l3.454-3.553a3 3 0 000-4.242z"
                clipRule="evenodd"
              />
            </svg>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept={ALLOWED_ACCEPT}
            multiple
            onChange={(e) => handleFileSelect(e.target.files)}
            className="hidden"
            aria-hidden="true"
          />

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
            disabled={(!input.trim() && attachedFiles.length === 0) || isStreaming}
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
          Shift+Enter für Zeilenumbruch · Max. 5 MB pro Datei · PDF, Bilder oder Text
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
              Wähle ein Deck, in das die Karteikarten importiert werden sollen.
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

