// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

"use client"

// components/features/lernseiten/Zuordnung.tsx
// Bereich, in dem Elemente mit gleichem data-link gemeinsam aufleuchten
// (Hover, Tastaturfokus, Antippen). Beispiel: Satzstueck <-> Formelteil.
// Nur hier werden verknuepfte Stellen per Tastatur erreichbar (tabindex).

import { useEffect, useId, useRef, useState, type ReactNode } from "react"

function linkVon(ziel: EventTarget | null): string | null {
  if (!(ziel instanceof Element)) return null
  return ziel.closest("[data-link]")?.getAttribute("data-link") ?? null
}

export default function Zuordnung({ children, className = "" }: { children: ReactNode; className?: string }) {
  const bereichId = `zb-${useId().replace(/[^a-zA-Z0-9]/g, "")}`
  const bereichRef = useRef<HTMLDivElement>(null)
  const [aktiv, setAktiv] = useState<string | null>(null)

  // Nach jedem Render: neu dargestellte verknuepfte Stellen fokussierbar machen.
  useEffect(() => {
    bereichRef.current?.querySelectorAll<HTMLElement>("[data-link]").forEach((el) => {
      if (!el.hasAttribute("tabindex")) el.tabIndex = 0
    })
  })

  return (
    <div
      ref={bereichRef}
      id={bereichId}
      className={className}
      onMouseOver={(e) => setAktiv(linkVon(e.target))}
      onMouseLeave={() => setAktiv(null)}
      onFocus={(e) => setAktiv(linkVon(e.target))}
      onBlur={() => setAktiv(null)}
      onClick={(e) => setAktiv(linkVon(e.target))}
    >
      {aktiv && (
        // Laeuft nur nach einer Interaktion, also im Browser (CSS.escape vorhanden).
        // :not(:focus-visible) laesst den globalen Fokusring sichtbar.
        <style>{`#${bereichId} [data-link="${CSS.escape(aktiv)}"]:not(:focus-visible){background-color:#DBEAFE;box-shadow:0 0 0 2px #93C5FD;}#${bereichId} [data-link="${CSS.escape(aktiv)}"]:focus-visible{background-color:#DBEAFE;}`}</style>
      )}
      {children}
    </div>
  )
}
