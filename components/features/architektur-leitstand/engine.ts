// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

"use client"

// components/features/architektur-leitstand/engine.ts
// Zugriff auf die Zeichen-Engine window.Architektur (public/lernpfad/architektur.js, Vertrag
// docs/architektur-modell.md Abschnitt 6). Das Layout lädt das Skript mit next/script nach der Hydration;
// useEngine wartet darauf (kurzes Abfragen, nach 15 s Fehlermeldung statt endlosem Laden).

import { useEffect, useState } from "react"

export interface DiagrammHandle {
  setzeZustand(id: string, zustand: "ok" | "langsam" | "ausfall" | "neu"): boolean | null
  markiere(ids: string[]): void
  ablaufStarten(id: string): boolean
  modell(): unknown
  waehle?(id: string | null): void
}

export interface EditorHandle {
  modell(): unknown
  setzeModell(m: unknown): boolean
  markiere(ids: string[], klasse?: string): void
}

export interface ArchitekturEngine {
  version?: string
  diagramm(el: HTMLElement, modell: unknown, opt?: Record<string, unknown>): DiagrammHandle | null
  editor(el: HTMLElement, opt: Record<string, unknown>): EditorHandle | null
}

declare global {
  interface Window {
    Architektur?: ArchitekturEngine
  }
}

function bereit(): ArchitekturEngine | null {
  const a = typeof window !== "undefined" ? window.Architektur : undefined
  return a && typeof a.diagramm === "function" && typeof a.editor === "function" ? a : null
}

const WARTEN_MS = 15_000

/** Engine, sobald geladen; fehler = nach 15 s noch nicht da */
export function useEngine(): { engine: ArchitekturEngine | null; fehler: boolean } {
  const [engine, setEngine] = useState<ArchitekturEngine | null>(() => bereit())
  const [fehler, setFehler] = useState(false)
  useEffect(() => {
    if (engine) return
    const start = Date.now()
    const id = window.setInterval(() => {
      const e = bereit()
      if (e) {
        setEngine(e)
        window.clearInterval(id)
      } else if (Date.now() - start > WARTEN_MS) {
        setFehler(true)
        window.clearInterval(id)
      }
    }, 100)
    return () => window.clearInterval(id)
  }, [engine])
  return { engine, fehler }
}

/** prefers-reduced-motion */
export function wenigerBewegung(): boolean {
  return typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
}
