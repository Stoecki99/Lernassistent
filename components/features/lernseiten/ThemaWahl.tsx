// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// components/features/lernseiten/ThemaWahl.tsx
// Farbschema der Lernpfad-Seite: Startskript (ThemaStart) und Umschalter Hell / Dunkel / Auto.
// Gleiches Verhalten wie die Kopfleiste der Themenseiten (public/lernpfad/lernpfad.js):
// gleicher Speicher-Schluessel, gleiche Werte, html[data-theme="light|dark"], Klassen aus lernpfad.css.
// Die Wahl gilt damit auf der Lernpfad-Seite und auf allen Themenseiten.

"use client"

import { useEffect, useState } from "react"

/** Muss zu THEME_SCHLUESSEL in public/lernpfad/lernpfad.js passen. */
const THEMA_SCHLUESSEL = "lernpfad-theme"

/** Setzt das gespeicherte Farbschema, bevor die Seite gezeichnet wird (kein Flackern). */
const STARTSKRIPT = `(function(){try{var w=window.localStorage.getItem("${THEMA_SCHLUESSEL}"),r=document.documentElement;if(w==="hell")r.setAttribute("data-theme","light");else if(w==="dunkel")r.setAttribute("data-theme","dark");}catch(e){}})();`

/**
 * Inline-Skript fuer den Anfang der Seite. Der Inhalt ist fester Text ohne
 * Benutzereingaben, daher ist dangerouslySetInnerHTML hier unbedenklich.
 * Laeuft nur beim Laden der ganzen Seite; bei Navigation in der App setzt ThemaWahl das Schema.
 */
export function ThemaStart() {
  return <script dangerouslySetInnerHTML={{ __html: STARTSKRIPT }} />
}

type Wahl = "hell" | "dunkel" | "auto"

const WAHLEN: { wert: Wahl; symbol: string; text: string; titel: string }[] = [
  { wert: "hell", symbol: "☀", text: "Hell", titel: "Hell" },
  { wert: "dunkel", symbol: "☾", text: "Dunkel", titel: "Dunkel" },
  { wert: "auto", symbol: "◐", text: "Auto", titel: "Automatisch, wie das System" },
]

function gespeicherteWahl(): Wahl {
  try {
    const wert = window.localStorage.getItem(THEMA_SCHLUESSEL)
    return wert === "hell" || wert === "dunkel" ? wert : "auto"
  } catch {
    // Gesperrter Speicher: Systemeinstellung verwenden
    return "auto"
  }
}

function anwenden(wahl: Wahl) {
  const root = document.documentElement
  if (wahl === "hell") root.setAttribute("data-theme", "light")
  else if (wahl === "dunkel") root.setAttribute("data-theme", "dark")
  else root.removeAttribute("data-theme")
}

export default function ThemaWahl() {
  // null bis nach dem Laden: Server und erster Client-Durchlauf zeigen denselben Stand
  const [wahl, setWahl] = useState<Wahl | null>(null)

  useEffect(() => {
    const gespeichert = gespeicherteWahl()
    setWahl(gespeichert)
    // Noetig bei Navigation innerhalb der App: dort laeuft das Startskript nicht
    anwenden(gespeichert)
    // Beim Verlassen die App-Seiten nicht einfaerben
    return () => document.documentElement.removeAttribute("data-theme")
  }, [])

  function waehlen(wert: Wahl) {
    setWahl(wert)
    anwenden(wert)
    try {
      window.localStorage.setItem(THEMA_SCHLUESSEL, wert)
    } catch {
      // Gesperrter Speicher: Wahl gilt nur bis zum Neuladen
    }
  }

  return (
    <div className="theme-wahl" role="group" aria-label="Farbschema">
      {WAHLEN.map(({ wert, symbol, text, titel }) => (
        <button
          key={wert}
          type="button"
          title={titel}
          aria-pressed={wahl === wert}
          onClick={() => waehlen(wert)}
        >
          <span aria-hidden="true">{symbol}</span>
          <span className="kopf-txt">{text}</span>
        </button>
      ))}
    </div>
  )
}
