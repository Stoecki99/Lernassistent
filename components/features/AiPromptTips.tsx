"use client"

// components/features/AiPromptTips.tsx
// Zeigt kopierbare KI-Prompts fuer optimale Karteikarten-Erstellung.
// Framework: Rolle → Ziel → Kontext → Regeln → Output-Format

import { useState } from "react"

interface PromptCard {
  title: string
  description: string
  prompt: string
  icon: string
}

const prompts: PromptCard[] = [
  {
    title: "Vorlesungsstoff aufarbeiten",
    icon: "\uD83C\uDFEB",
    description: "Wandelt Vorlesungsfolien, Skripte oder Mitschriften in pruefungsrelevante Karteikarten um.",
    prompt: `# ROLLE
Du bist ein erfahrener Hochschul-Lerntutor, spezialisiert auf das Fach [⚠️ FACH HIER EINSETZEN, z.B. "Betriebswirtschaftslehre", "Organische Chemie", "Strafrecht AT"]. Du kennst die gaengigen Pruefungsformate und weisst, welche Konzepte typischerweise abgefragt werden.

# ZIEL
Erstelle aus den beigefuegten Unterlagen Karteikarten, die fuer Spaced Repetition optimiert sind. Die Karten sollen langfristiges Verstaendnis foerdern — nicht kurzfristiges Auswendiglernen.

# KONTEXT
[⚠️ HIER DEINE UNTERLAGEN EINFUEGEN: Vorlesungsfolien, Skript-Auszuege, Mitschriften, oder Datei-Upload. Je mehr Material du bereitstellst, desto besser und vollstaendiger werden die Karten.]

# REGELN FUER GUTE KARTEIKARTEN
1. **Ein Konzept pro Karte** — niemals mehrere Fakten auf eine Karte packen
2. **Frage statt Luecke** — formuliere echte Fragen ("Was bewirkt...?", "Warum...?", "Wie unterscheiden sich...?")
3. **Mische Schwierigkeitsgrade** — 40% Wissen (Definition), 30% Verstaendnis (Erklaerung/Vergleich), 30% Anwendung (Fallbeispiel/Berechnung)
4. **Hinweis bei schwierigen Karten** — gib einen kurzen Tipp der auf die Loesung hinfuehrt ohne sie zu verraten (z.B. "Denke an die 3 Saeulen von...", "Gegenteil von X")
5. **Praegnante Antworten** — maximal 2-3 Saetze oder Stichpunkte. Nutze **Fettdruck** fuer Schluesselwoerter
6. **Keine trivialen Karten** — ueberspringe Offensichtliches. Fokus auf pruefungsrelevante Zusammenhaenge
7. **Nutze Markdown** — **fett**, \`code\`, Listen mit - fuer strukturierte Antworten

# OUTPUT-FORMAT
CSV mit Semikolon-Trennung, 3 Spalten. Keine Kopfzeile. Keine Erklaerung, nur die Daten.

Vorderseite;Hinweis;Rueckseite

Falls kein Hinweis noetig ist, lasse die mittlere Spalte leer (doppeltes Semikolon: Frage;;Antwort).

# BEISPIEL
Was ist das Prinzip der Gewaltenteilung?;Denke an Montesquieu und 3 Staatsgewalten;Aufteilung der Staatsmacht in **Legislative** (Gesetzgebung), **Exekutive** (Ausfuehrung) und **Judikative** (Rechtsprechung) zur gegenseitigen Kontrolle
Warum ist Diversifikation im Portfolio wichtig?;;Reduziert das **unsystematische Risiko**: Verluste einzelner Anlagen werden durch Gewinne anderer ausgeglichen. Das **systematische Risiko** (Marktrisiko) bleibt bestehen`,
  },
  {
    title: "Pruefungsvorbereitung",
    icon: "\uD83C\uDFAF",
    description: "Generiert die wahrscheinlichsten Pruefungsfragen mit Musterantworten.",
    prompt: `# ROLLE
Du bist ein erfahrener Dozent im Fach [⚠️ FACH HIER EINSETZEN] an einer Fachhochschule. Du erstellst seit Jahren Pruefungen und weisst genau, welche Fragen gestellt werden und wie eine optimale Antwort aussieht.

# ZIEL
Analysiere die beigefuegten Unterlagen und erstelle die 25 wahrscheinlichsten Pruefungsfragen als Karteikarten. Priorisiere nach Pruefungsrelevanz — was wuerde ein Dozent abfragen?

# KONTEXT
[⚠️ HIER DEINE UNTERLAGEN EINFUEGEN: Vorlesungsfolien, Skripte, alte Pruefungen falls vorhanden. Lade so viele Unterlagen wie moeglich hoch — das verbessert die Qualitaet der Fragen erheblich.]

Zusaetzliche Infos (falls bekannt):
- Pruefungsformat: [⚠️ z.B. "schriftlich, 90 Min, offene Fragen" oder "Multiple Choice"]
- Semester/Modul: [⚠️ z.B. "3. Semester, Modul Datenbanken"]
- Schwerpunkte laut Dozent: [⚠️ falls bekannt, sonst loeschen]

# REGELN
1. **Mische Fragetypen**: Definitionen, Vergleiche ("Unterschied zwischen X und Y?"), Anwendung ("Wie wuerdest du... loesen?"), Bewertung ("Welche Vor-/Nachteile hat...?")
2. **Pruefungsniveau beachten** — FH-Niveau: anwendungsorientiert, nicht rein theoretisch
3. **Hinweise bei komplexen Fragen** — ein kurzer Tipp der die Denkrichtung vorgibt
4. **Musterantworten** — so wie ein Student sie in der Pruefung schreiben wuerde (praegnant, strukturiert)
5. **Nutze Markdown** — **fett** fuer Kernbegriffe, Listen fuer Aufzaehlungen

# OUTPUT-FORMAT
CSV mit Semikolon-Trennung, 3 Spalten. Keine Kopfzeile. Keine Erklaerung, nur die Daten.

Vorderseite;Hinweis;Rueckseite

Falls kein Hinweis noetig, Spalte leer lassen (Frage;;Antwort).`,
  },
  {
    title: "Fachbegriffe & Definitionen",
    icon: "\uD83D\uDCD6",
    description: "Erstellt praezise Definitions-Karten mit Kontext und Eselsbruecken.",
    prompt: `# ROLLE
Du bist ein Lerntutor, spezialisiert auf Fachterminologie im Bereich [⚠️ FACH HIER EINSETZEN]. Du hilfst Studierenden, Begriffe nicht nur auswendig zu lernen, sondern zu verstehen und im Kontext einzuordnen.

# ZIEL
Erstelle fuer jeden Fachbegriff in den beigefuegten Unterlagen eine Karteikarte. Die Karte soll den Begriff erklaeren UND eine Eselsbruecke oder einen Merktipp als Hinweis liefern.

# KONTEXT
[⚠️ HIER DEINE UNTERLAGEN EINFUEGEN: Glossar, Vorlesungsfolien, Lehrbuch-Kapitel. Alternativ: Liste die Begriffe auf, die du lernen musst.]

# REGELN
1. **Frage-Formulierung** — immer als echte Frage: "Was bedeutet...?", "Was beschreibt der Begriff...?"
2. **Antwort** — erst eine kurze Definition (1-2 Saetze), dann ein konkretes Beispiel oder eine Abgrenzung
3. **Hinweis bei jedem Begriff** — eine Eselsbruecke, Wortherkunft (Etymologie), Analogie oder Abgrenzung zu aehnlichen Begriffen
4. **Markdown nutzen** — **Fettdruck** fuer den definierten Begriff in der Antwort
5. **Kein Jargon in Erklaerungen** — die Antwort soll einfacher sein als die Quelle

# OUTPUT-FORMAT
CSV mit Semikolon-Trennung, 3 Spalten. Keine Kopfzeile. Keine Erklaerung.

Vorderseite;Hinweis;Rueckseite

# BEISPIEL
Was bedeutet "Amortisation"?;Lateinisch "ad mortem" = zum Tod — etwas wird "abgetoetet";Die schrittweise **Tilgung** einer Schuld durch regelmaessige Zahlungen. Auch: Zeitpunkt, ab dem eine Investition ihre Kosten eingespielt hat
Was ist der Unterschied zwischen Effektivitaet und Effizienz?;Effektiv = die RICHTIGEN Dinge tun, Effizient = die Dinge RICHTIG tun;**Effektivitaet**: Grad der Zielerreichung ("Tun wir das Richtige?"). **Effizienz**: Verhaeltnis von Output zu Input ("Tun wir es mit minimalem Aufwand?")`,
  },
  {
    title: "Zusammenfassung — Ganzes Modul",
    icon: "\uD83E\uDDE0",
    description: "Fasst ein komplettes Modul in eine ueberschaubare Kartenmenge zusammen.",
    prompt: `# ROLLE
Du bist ein erfahrener Lerncoach, spezialisiert auf effiziente Pruefungsvorbereitung. Du kannst grosse Stoffmengen auf das Wesentliche reduzieren, ohne wichtige Zusammenhaenge zu verlieren.

# ZIEL
Fasse den gesamten beigefuegten Stoff in maximal 40 Karteikarten zusammen. Jede Karte soll ein eigenstaendiges Konzept abdecken. Am Ende soll ein Student, der nur diese Karten lernt, die wichtigsten Zusammenhaenge des Moduls verstanden haben.

# KONTEXT
[⚠️ HIER ALLE VERFUEGBAREN UNTERLAGEN EINFUEGEN ODER HOCHLADEN:
- Vorlesungsfolien (alle Wochen)
- Skript / Lehrbuch-Kapitel
- Uebungsaufgaben und Loesungen
- Alte Pruefungen (falls vorhanden)
- Eigene Notizen

Je mehr Material du bereitstellst, desto besser kann priorisiert werden!]

Modul: [⚠️ z.B. "Einfuehrung in die Volkswirtschaftslehre, HS2025"]
Pruefungsdatum: [⚠️ falls bekannt]

# REGELN
1. **Priorisiere gnadenlos** — nur das, was pruefungsrelevant ist. Lieber 30 exzellente Karten als 40 mittlmaessige
2. **Beginne mit Grundlagen** — die ersten 5-10 Karten sollen fundamentale Konzepte abdecken, auf denen der Rest aufbaut
3. **Verknuepfe Themen** — wo moeglich, verweise in Hinweisen auf verwandte Karten ("Haengt zusammen mit: Angebot/Nachfrage")
4. **Mische Fragetypen** — Definitionen, Erklaerungen, Vergleiche, Anwendungen
5. **Hinweise als Verknuepfung** — der Hinweis soll helfen, das Konzept im Gesamtkontext einzuordnen
6. **Markdown** — **fett**, Listen, \`code\` fuer Formeln oder Fachbegriffe

# OUTPUT-FORMAT
CSV mit Semikolon-Trennung, 3 Spalten. Keine Kopfzeile. Keine Erklaerung.

Vorderseite;Hinweis;Rueckseite

Falls kein Hinweis noetig, Spalte leer lassen (Frage;;Antwort).`,
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
          Professionelle Prompts fuer Claude, ChatGPT oder jedes andere KI-Chat-Interface.
          Kopiere einen Prompt, ersetze die markierten Stellen, und lade deine Unterlagen hoch.
        </p>
      </div>

      {/* Wichtiger Hinweis */}
      <div className="bg-accent/5 border border-accent/20 rounded-2xl p-4">
        <p className="text-sm font-bold text-accent-dark flex items-center gap-2">
          <span aria-hidden="true">&#9888;&#65039;</span>
          Wichtig fuer beste Ergebnisse
        </p>
        <ul className="text-sm text-text mt-2 space-y-1 list-disc list-inside">
          <li>Ersetze alle <code className="bg-white px-1 py-0.5 rounded text-xs font-mono text-accent">[⚠️ ...]</code> Platzhalter mit deinen Angaben</li>
          <li><strong>Lade so viele Unterlagen wie moeglich hoch</strong> — Folien, Skripte, Uebungen, alte Pruefungen</li>
          <li>Die KI kann nur so gute Karten erstellen, wie der Kontext den du ihr gibst</li>
          <li>Speichere die CSV-Ausgabe als <code className="bg-white px-1 py-0.5 rounded text-xs font-mono">.csv</code>-Datei und importiere sie oben</li>
        </ul>
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
          <li>Fuege den Prompt ein und <strong>ersetze alle Platzhalter</strong> mit deinem Stoff</li>
          <li><strong>Lade deine Unterlagen als Datei hoch</strong> (PDF, Bilder von Folien, etc.)</li>
          <li>Kopiere die CSV-Ausgabe und speichere sie als <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">.csv</code>-Datei</li>
          <li>Importiere die Datei oben — Format: CSV, 3 Spalten: <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">Vorderseite;Hinweis;Rueckseite</code></li>
        </ol>
      </div>
    </div>
  )
}

function PromptCardItem({ title, description, prompt, icon }: PromptCard) {
  const [copied, setCopied] = useState(false)
  const [expanded, setExpanded] = useState(false)

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
        <h3 className="font-bold text-text-dark text-sm flex items-center gap-2">
          <span aria-hidden="true">{icon}</span>
          {title}
        </h3>
        <p className="text-xs text-text-light mt-0.5">{description}</p>
      </div>

      <pre
        className={`flex-1 bg-surface rounded-xl p-3 text-xs text-text whitespace-pre-wrap font-mono leading-relaxed overflow-auto ${
          expanded ? "max-h-[500px]" : "max-h-32"
        } transition-all duration-300 cursor-pointer`}
        onClick={() => setExpanded((prev) => !prev)}
      >
        {prompt}
      </pre>

      <div className="flex items-center justify-between">
        <button
          onClick={() => setExpanded((prev) => !prev)}
          className="text-xs text-text-light hover:text-text transition-colors"
        >
          {expanded ? "Weniger anzeigen" : "Mehr anzeigen"}
        </button>

        <button
          onClick={handleCopy}
          className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
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
    </div>
  )
}
