"use client"

// components/features/ImportFormular.tsx
// Import-Formular fuer Karteikarten aus CSV oder Anki-Format.
// Unterstuetzt Drag & Drop, Datei-Upload, Vorschau und Fortschrittsanzeige.

import { useState, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"

interface ImportFormularProps {
  deckId: string
  deckName: string
}

interface ParseError {
  line: number
  message: string
}

interface PreviewCard {
  front: string
  back: string
}

type ImportFormat = "csv" | "anki"

export default function ImportFormular({ deckId, deckName }: ImportFormularProps) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [file, setFile] = useState<File | null>(null)
  const [format, setFormat] = useState<ImportFormat>("csv")
  const [preview, setPreview] = useState<PreviewCard[]>([])
  const [totalParsed, setTotalParsed] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [importResult, setImportResult] = useState<{
    success: boolean
    message: string
    imported: number
    errors: ParseError[]
  } | null>(null)
  const [error, setError] = useState("")

  function isCsvHeader(line: string): boolean {
    const lower = line.toLowerCase()
    return (
      (lower.includes("vorderseite") && lower.includes("rueckseite")) ||
      (lower.includes("front") && lower.includes("back")) ||
      (lower.includes("frage") && lower.includes("antwort")) ||
      (lower.includes("question") && lower.includes("answer"))
    )
  }

  function parsePreview(content: string, fmt: ImportFormat): { cards: PreviewCard[]; total: number } {
    const separator = fmt === "csv" ? ";" : "\t"
    const lines = content.split(/\r?\n/).filter((line) => line.trim() !== "")

    const cards: PreviewCard[] = []
    let startIndex = 0

    if (fmt === "csv" && lines.length > 0 && isCsvHeader(lines[0])) {
      startIndex = 1
    }

    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i]

      if (fmt === "anki" && (line.startsWith("#") || line.startsWith("tags:"))) {
        continue
      }

      if (!line.includes(separator)) continue

      const sepIndex = line.indexOf(separator)
      const front = line.substring(0, sepIndex).trim()
      const back = line.substring(sepIndex + 1).trim()

      if (front && back) {
        cards.push({ front, back })
      }
    }

    return { cards: cards.slice(0, 5), total: cards.length }
  }

  const handleFile = useCallback(async (selectedFile: File) => {
    setFile(selectedFile)
    setError("")
    setImportResult(null)

    if (selectedFile.size > 5 * 1024 * 1024) {
      setError("Die Datei ist zu gross. Maximale Groesse: 5 MB.")
      setPreview([])
      setTotalParsed(0)
      return
    }

    try {
      const content = await selectedFile.text()
      const { cards, total } = parsePreview(content, format)
      setPreview(cards)
      setTotalParsed(total)

      if (total === 0) {
        setError("Keine gueltigen Karten in der Datei gefunden. Pruefe das Format.")
      }
    } catch {
      setError("Datei konnte nicht gelesen werden.")
      setPreview([])
      setTotalParsed(0)
    }
  }, [format])

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(true)
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)

    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile) {
      handleFile(droppedFile)
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      handleFile(selectedFile)
    }
  }

  async function handleFormatChange(newFormat: ImportFormat) {
    setFormat(newFormat)
    setImportResult(null)

    if (file) {
      try {
        const content = await file.text()
        const { cards, total } = parsePreview(content, newFormat)
        setPreview(cards)
        setTotalParsed(total)
        setError(total === 0 ? "Keine gueltigen Karten in der Datei gefunden. Pruefe das Format." : "")
      } catch {
        setPreview([])
        setTotalParsed(0)
      }
    }
  }

  async function handleImport() {
    if (!file) return

    setIsImporting(true)
    setError("")
    setImportResult(null)

    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("deckId", deckId)
      formData.append("format", format)

      const response = await fetch("/api/karten/import", {
        method: "POST",
        body: formData,
      })

      const data: {
        message?: string
        error?: string
        imported?: number
        errors?: ParseError[]
      } = await response.json()

      if (!response.ok) {
        setImportResult({
          success: false,
          message: data.error ?? "Import fehlgeschlagen.",
          imported: 0,
          errors: data.errors ?? [],
        })
        return
      }

      setImportResult({
        success: true,
        message: data.message ?? "Karten erfolgreich importiert!",
        imported: data.imported ?? 0,
        errors: data.errors ?? [],
      })

      router.refresh()
    } catch {
      setImportResult({
        success: false,
        message: "Import fehlgeschlagen. Bitte versuche es erneut.",
        imported: 0,
        errors: [],
      })
    } finally {
      setIsImporting(false)
    }
  }

  function resetAll() {
    setFile(null)
    setPreview([])
    setTotalParsed(0)
    setError("")
    setImportResult(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  return (
    <div className="space-y-6">
      {/* Deck-Info */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <p className="text-sm text-text-light">Importiert in:</p>
        <p className="font-bold text-text-dark">{deckName}</p>
      </div>

      {/* Format-Auswahl */}
      <div>
        <label className="block text-sm font-bold text-text-dark mb-2">Format</label>
        <div className="flex gap-3">
          <FormatButton
            active={format === "csv"}
            onClick={() => handleFormatChange("csv")}
            label="CSV"
            description="Semikolon-getrennt"
          />
          <FormatButton
            active={format === "anki"}
            onClick={() => handleFormatChange("anki")}
            label="Anki"
            description="Tab-getrennt (.txt)"
          />
        </div>
      </div>

      {/* Format-Hinweis */}
      <div className="bg-secondary/5 rounded-xl p-4 text-sm">
        {format === "csv" ? (
          <>
            <p className="font-bold text-secondary mb-1">CSV-Format</p>
            <p className="text-text-light">
              Jede Zeile: <code className="bg-white px-1.5 py-0.5 rounded text-xs font-mono">Vorderseite;Rueckseite</code>
            </p>
            <p className="text-text-light mt-1">Die erste Zeile kann optional ein Header sein.</p>
          </>
        ) : (
          <>
            <p className="font-bold text-secondary mb-1">Anki-Format</p>
            <p className="text-text-light">
              Jede Zeile: <code className="bg-white px-1.5 py-0.5 rounded text-xs font-mono">Vorderseite[TAB]Rueckseite</code>
            </p>
            <p className="text-text-light mt-1">Kommentarzeilen (mit #) werden uebersprungen.</p>
          </>
        )}
      </div>

      {/* Drag & Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
          isDragging
            ? "border-primary bg-primary/5"
            : file
              ? "border-primary/30 bg-primary/5"
              : "border-gray-300 hover:border-primary/50 hover:bg-gray-50"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.txt,.tsv"
          onChange={handleFileSelect}
          className="hidden"
        />

        {file ? (
          <div>
            <span className="text-4xl block mb-2" aria-hidden="true">&#128196;</span>
            <p className="font-bold text-text-dark">{file.name}</p>
            <p className="text-sm text-text-light mt-1">
              {(file.size / 1024).toFixed(1)} KB
            </p>
            <button
              onClick={(e) => { e.stopPropagation(); resetAll() }}
              className="mt-3 text-sm font-bold text-red-500 hover:text-red-600 transition-colors"
            >
              Andere Datei waehlen
            </button>
          </div>
        ) : (
          <div>
            <span className="text-4xl block mb-2" aria-hidden="true">&#128228;</span>
            <p className="font-bold text-text-dark">Datei hierher ziehen</p>
            <p className="text-sm text-text-light mt-1">oder klicken zum Auswaehlen</p>
            <p className="text-xs text-text-light mt-2">CSV, TXT oder TSV (max. 5 MB)</p>
          </div>
        )}
      </div>

      {/* Fehler */}
      {error && (
        <div className="p-4 bg-red-50 text-red-600 rounded-xl text-sm font-semibold">
          {error}
        </div>
      )}

      {/* Vorschau */}
      {preview.length > 0 && !importResult && (
        <div>
          <h3 className="text-sm font-bold text-text-dark mb-3">
            Vorschau ({totalParsed} {totalParsed === 1 ? "Karte" : "Karten"} erkannt)
          </h3>
          <div className="space-y-2">
            {preview.map((card, index) => (
              <div key={index} className="bg-white rounded-xl shadow-sm p-3 flex gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-text-dark truncate">{card.front}</p>
                </div>
                <div className="text-text-light shrink-0 self-center">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                    <path fillRule="evenodd" d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-text-light truncate">{card.back}</p>
                </div>
              </div>
            ))}
            {totalParsed > 5 && (
              <p className="text-xs text-text-light text-center py-1">
                ... und {totalParsed - 5} weitere Karten
              </p>
            )}
          </div>
        </div>
      )}

      {/* Import-Button */}
      {file && !importResult && totalParsed > 0 && (
        <button
          onClick={handleImport}
          disabled={isImporting}
          className="w-full py-3 bg-primary text-white font-bold rounded-xl shadow-button hover:bg-primary-dark active:translate-y-1 active:shadow-none transition-all disabled:opacity-50 disabled:active:translate-y-0"
        >
          {isImporting ? (
            <span className="inline-flex items-center gap-2">
              <svg className="animate-spin w-5 h-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Importiere {totalParsed} Karten...
            </span>
          ) : (
            `${totalParsed} ${totalParsed === 1 ? "Karte" : "Karten"} importieren`
          )}
        </button>
      )}

      {/* Import-Ergebnis */}
      {importResult && (
        <div className={`rounded-xl p-5 ${importResult.success ? "bg-primary/5" : "bg-red-50"}`}>
          <div className="text-center mb-4">
            <span className="text-4xl block mb-2" aria-hidden="true">
              {importResult.success ? "\u{1F389}" : "\u{26A0}\u{FE0F}"}
            </span>
            <p className={`font-bold text-lg ${importResult.success ? "text-primary-dark" : "text-red-600"}`}>
              {importResult.message}
            </p>
          </div>

          {importResult.errors.length > 0 && (
            <div className="mt-4">
              <p className="text-sm font-bold text-text-dark mb-2">
                Fehler ({importResult.errors.length}):
              </p>
              <div className="max-h-40 overflow-y-auto space-y-1">
                {importResult.errors.map((err, index) => (
                  <p key={index} className="text-xs text-red-600 bg-white rounded px-3 py-1.5">
                    Zeile {err.line}: {err.message}
                  </p>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-3 mt-5 justify-center">
            <button
              onClick={resetAll}
              className="px-5 py-2.5 bg-white text-text font-bold rounded-xl hover:bg-gray-50 transition-colors shadow-sm"
            >
              Weitere importieren
            </button>
            <a
              href={`/decks/${deckId}`}
              className="px-5 py-2.5 bg-primary text-white font-bold rounded-xl hover:bg-primary-dark transition-colors shadow-button active:translate-y-1 active:shadow-none"
            >
              Zum Deck
            </a>
          </div>
        </div>
      )}
    </div>
  )
}

// Hilfskomponente: Format-Auswahl-Button
interface FormatButtonProps {
  active: boolean
  onClick: () => void
  label: string
  description: string
}

function FormatButton({ active, onClick, label, description }: FormatButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 p-3 rounded-xl border-2 text-left transition-all ${
        active
          ? "border-primary bg-primary/5"
          : "border-gray-200 hover:border-gray-300"
      }`}
    >
      <p className={`font-bold text-sm ${active ? "text-primary-dark" : "text-text-dark"}`}>
        {label}
      </p>
      <p className="text-xs text-text-light">{description}</p>
    </button>
  )
}
