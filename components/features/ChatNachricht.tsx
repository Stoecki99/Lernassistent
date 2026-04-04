"use client"

// components/features/ChatNachricht.tsx
// Einzelne Chat-Nachricht mit Markdown-Rendering und CSV-Export.

import { useState } from "react"

interface ChatNachrichtProps {
  role: "user" | "assistant"
  content: string
  createdAt: string
  onCsvExport: (csv: string) => void
  onCsvImport: (csv: string) => void
}

/** Extrahiert alle ```csv ... ``` Bloecke aus dem Text */
function extractCsvBlocks(text: string): string[] {
  const regex = /```csv\s*\n([\s\S]*?)```/g
  const blocks: string[] = []
  let match = regex.exec(text)

  while (match !== null) {
    const csvContent = match[1]?.trim()
    if (csvContent) {
      blocks.push(csvContent)
    }
    match = regex.exec(text)
  }

  return blocks
}

/** Einfaches Markdown-Rendering: Code-Bloecke, Inline-Code, Bold, Zeilenumbrueche */
function renderMarkdown(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = []
  const lines = text.split("\n")
  let inCodeBlock = false
  let codeContent = ""
  let codeLanguage = ""
  let blockIndex = 0

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Code-Block Start
    if (!inCodeBlock && line.startsWith("```")) {
      inCodeBlock = true
      codeLanguage = line.slice(3).trim()
      codeContent = ""
      continue
    }

    // Code-Block Ende
    if (inCodeBlock && line.startsWith("```")) {
      inCodeBlock = false
      parts.push(
        <pre
          key={`code-${blockIndex}`}
          className="bg-gray-100 rounded-xl p-3 my-2 overflow-x-auto text-sm font-mono"
        >
          <code>{codeContent}</code>
        </pre>
      )
      blockIndex++
      codeLanguage = ""
      continue
    }

    // Innerhalb eines Code-Blocks
    if (inCodeBlock) {
      codeContent += (codeContent ? "\n" : "") + line
      continue
    }

    // Regulaere Zeile: Inline-Code und Bold rendern
    parts.push(
      <span key={`line-${i}`}>
        {i > 0 && !inCodeBlock && <br />}
        {renderInline(line, i)}
      </span>
    )
  }

  // Falls Code-Block nicht geschlossen wurde
  if (inCodeBlock && codeContent) {
    parts.push(
      <pre
        key={`code-unclosed-${blockIndex}`}
        className="bg-gray-100 rounded-xl p-3 my-2 overflow-x-auto text-sm font-mono"
      >
        <code>{codeContent}</code>
      </pre>
    )
  }

  return parts
}

/** Inline-Rendering: Bold und Inline-Code */
function renderInline(text: string, lineIndex: number): React.ReactNode[] {
  const parts: React.ReactNode[] = []
  const regex = /(\*\*(.+?)\*\*)|(`(.+?)`)/g
  let lastIndex = 0
  let partIndex = 0
  let match = regex.exec(text)

  while (match !== null) {
    // Text vor dem Match
    if (match.index > lastIndex) {
      parts.push(
        <span key={`${lineIndex}-text-${partIndex}`}>
          {text.slice(lastIndex, match.index)}
        </span>
      )
      partIndex++
    }

    if (match[2]) {
      // Bold
      parts.push(
        <strong key={`${lineIndex}-bold-${partIndex}`} className="font-bold">
          {match[2]}
        </strong>
      )
    } else if (match[4]) {
      // Inline-Code
      parts.push(
        <code
          key={`${lineIndex}-code-${partIndex}`}
          className="bg-gray-100 px-1.5 py-0.5 rounded text-sm font-mono"
        >
          {match[4]}
        </code>
      )
    }

    lastIndex = match.index + match[0].length
    partIndex++
    match = regex.exec(text)
  }

  // Restlicher Text
  if (lastIndex < text.length) {
    parts.push(
      <span key={`${lineIndex}-rest-${partIndex}`}>
        {text.slice(lastIndex)}
      </span>
    )
  }

  return parts
}

function formatTime(isoString: string): string {
  const date = new Date(isoString)
  return date.toLocaleTimeString("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
  })
}

export default function ChatNachricht({
  role,
  content,
  createdAt,
  onCsvExport,
  onCsvImport,
}: ChatNachrichtProps) {
  const csvBlocks = role === "assistant" ? extractCsvBlocks(content) : []
  const isUser = role === "user"

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-3`}>
      <div
        className={`max-w-[85%] md:max-w-[70%] rounded-2xl px-4 py-3 ${
          isUser
            ? "bg-primary-light/20 text-text-dark"
            : "bg-white text-text shadow-sm border border-gray-100"
        }`}
      >
        {/* Nachrichten-Inhalt */}
        <div className="text-[15px] leading-relaxed break-words whitespace-pre-wrap">
          {renderMarkdown(content)}
        </div>

        {/* CSV-Export Buttons */}
        {csvBlocks.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {csvBlocks.map((csv, index) => (
              <div key={index} className="flex gap-2">
                <button
                  type="button"
                  onClick={() => onCsvExport(csv)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-secondary text-white text-sm font-semibold rounded-lg hover:bg-secondary-dark transition-colors"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className="w-4 h-4"
                  >
                    <path d="M10.75 2.75a.75.75 0 00-1.5 0v8.614L6.295 8.235a.75.75 0 10-1.09 1.03l4.25 4.5a.75.75 0 001.09 0l4.25-4.5a.75.75 0 00-1.09-1.03l-2.955 3.129V2.75z" />
                    <path d="M3.5 12.75a.75.75 0 00-1.5 0v2.5A2.75 2.75 0 004.75 18h10.5A2.75 2.75 0 0018 15.25v-2.5a.75.75 0 00-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5z" />
                  </svg>
                  Als CSV exportieren
                </button>
                <button
                  type="button"
                  onClick={() => onCsvImport(csv)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary-dark transition-colors"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className="w-4 h-4"
                  >
                    <path d="M9.25 13.25a.75.75 0 001.5 0V4.636l2.955 3.129a.75.75 0 001.09-1.03l-4.25-4.5a.75.75 0 00-1.09 0l-4.25 4.5a.75.75 0 101.09 1.03L9.25 4.636v8.614z" />
                    <path d="M3.5 12.75a.75.75 0 00-1.5 0v2.5A2.75 2.75 0 004.75 18h10.5A2.75 2.75 0 0018 15.25v-2.5a.75.75 0 00-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5z" />
                  </svg>
                  In Deck importieren
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Zeitstempel */}
        <div
          className={`text-xs mt-1.5 ${
            isUser ? "text-primary-dark/50" : "text-text-light/60"
          }`}
        >
          {formatTime(createdAt)}
        </div>
      </div>
    </div>
  )
}
