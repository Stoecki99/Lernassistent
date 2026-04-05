"use client"

// components/features/AiPromptTips.tsx
// Zeigt kopierbare KI-Prompts fuer optimale Karteikarten-Erstellung.

import { useState } from "react"

interface PromptCard {
  title: string
  description: string
  prompt: string
}

const prompts: PromptCard[] = [
  {
    title: "Allgemein — Text zu Karteikarten",
    description: "Wandelt beliebigen Lernstoff in Karteikarten um.",
    prompt: `Erstelle aus folgendem Text Karteikarten im CSV-Format (Semikolon-getrennt, eine Karte pro Zeile: Vorderseite;Rueckseite). Formuliere klare, praezise Fragen auf der Vorderseite und kurze Antworten auf der Rueckseite. Keine Kopfzeile.

Text:
[DEIN TEXT HIER EINFUEGEN]`,
  },
  {
    title: "Definitionen — Begriffe lernen",
    description: "Perfekt fuer Fachbegriffe und Vokabeln.",
    prompt: `Erstelle aus den folgenden Begriffen und Definitionen Karteikarten im CSV-Format (Semikolon-getrennt: Vorderseite;Rueckseite). Die Vorderseite soll den Begriff als Frage formulieren ("Was ist...?" / "Was bedeutet...?"), die Rueckseite die praegnante Definition. Keine Kopfzeile.

Begriffe:
[DEINE BEGRIFFE HIER EINFUEGEN]`,
  },
  {
    title: "Pruefungsvorbereitung — Top-Fragen",
    description: "Erstellt die wichtigsten Pruefungsfragen aus Vorlesungsstoff.",
    prompt: `Analysiere diesen Vorlesungsstoff und erstelle die 20 wichtigsten Pruefungsfragen als Karteikarten im CSV-Format (Semikolon-getrennt: Vorderseite;Rueckseite). Fokus auf Verstaendnisfragen, nicht nur Faktenwissen. Mische verschiedene Fragetypen (Definition, Erklaerung, Vergleich, Anwendung). Keine Kopfzeile.

Vorlesungsstoff:
[DEINEN STOFF HIER EINFUEGEN]`,
  },
  {
    title: "Zusammenfassung — Kapitel kompakt",
    description: "Fasst ein ganzes Kapitel in maximal 30 Karten zusammen.",
    prompt: `Fasse dieses Kapitel in maximal 30 Karteikarten zusammen (CSV-Format, Semikolon-getrennt: Vorderseite;Rueckseite). Decke alle Hauptkonzepte ab. Jede Karte soll eine eigenstaendige Lerneinheit sein. Keine Kopfzeile.

Kapitel:
[DEIN KAPITEL HIER EINFUEGEN]`,
  },
]

export default function AiPromptTips() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-extrabold text-text-dark flex items-center gap-2">
          <span aria-hidden="true">&#129302;</span>
          Karteikarten mit KI erstellen
        </h2>
        <p className="text-text-light mt-1 text-sm">
          Nutze diese Prompts in Claude oder ChatGPT, um optimale Karteikarten aus deinen
          Unterlagen zu erstellen. Kopiere den Output als CSV und importiere ihn hier.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {prompts.map((prompt) => (
          <PromptCardItem key={prompt.title} {...prompt} />
        ))}
      </div>

      {/* Anleitung */}
      <div className="bg-white rounded-2xl shadow-md p-5 space-y-3">
        <h3 className="font-bold text-text-dark text-sm flex items-center gap-2">
          <span aria-hidden="true">&#128161;</span>
          So gehts — Schritt fuer Schritt
        </h3>
        <ol className="text-sm text-text-light space-y-1.5 list-decimal list-inside">
          <li>Kopiere einen der Prompts oben</li>
          <li>
            Oeffne{" "}
            <a href="https://claude.ai" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-semibold">
              claude.ai
            </a>{" "}
            oder{" "}
            <a href="https://chatgpt.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-semibold">
              chatgpt.com
            </a>
          </li>
          <li>Fuege den Prompt ein und ersetze den Platzhalter mit deinem Lernstoff</li>
          <li>Kopiere die CSV-Ausgabe und speichere sie als <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">.csv</code>-Datei</li>
          <li>Importiere die Datei oben mit dem Format &quot;CSV&quot;</li>
        </ol>
      </div>
    </div>
  )
}

function PromptCardItem({ title, description, prompt }: PromptCard) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(prompt)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback: Selection-based copy
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow-md p-5 space-y-3 flex flex-col">
      <div>
        <h3 className="font-bold text-text-dark text-sm">{title}</h3>
        <p className="text-xs text-text-light mt-0.5">{description}</p>
      </div>

      <pre className="flex-1 bg-surface rounded-xl p-3 text-xs text-text whitespace-pre-wrap font-mono leading-relaxed overflow-auto max-h-40">
        {prompt}
      </pre>

      <button
        onClick={handleCopy}
        className={`self-end inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
          copied
            ? "bg-primary/10 text-primary"
            : "bg-primary text-white hover:bg-primary-dark active:translate-y-0.5"
        }`}
      >
        {copied ? (
          <>
            <span aria-hidden="true">&#10003;</span>
            Kopiert!
          </>
        ) : (
          <>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
              <path d="M7 3.5A1.5 1.5 0 018.5 2h3.879a1.5 1.5 0 011.06.44l3.122 3.12A1.5 1.5 0 0117 6.622V12.5a1.5 1.5 0 01-1.5 1.5h-1v-3.379a3 3 0 00-.879-2.121L10.5 5.379A3 3 0 008.379 4.5H7v-1z" />
              <path d="M4.5 6A1.5 1.5 0 003 7.5v9A1.5 1.5 0 004.5 18h7a1.5 1.5 0 001.5-1.5v-5.879a1.5 1.5 0 00-.44-1.06L9.44 6.439A1.5 1.5 0 008.378 6H4.5z" />
            </svg>
            Kopieren
          </>
        )}
      </button>
    </div>
  )
}
