// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// lib/lernseiten-film.ts
// Reine Funktionen fuer den Loesungsfilm der Lernseiten (ohne React, testbar).

import type { FilmSzeneRoh } from "@/lib/validations/lernseite"

export interface FilmSzene {
  phase: number
  text: "alle" | number | null
  hl: string[]
  wb: number
  wbAktiv: number[]
  formel: string
  sage: string
}

export const TEMPI = { langsam: 0.75, normal: 1, schnell: 1.5 } as const
export type Tempo = keyof typeof TEMPI

const MIN_DAUER_MS = 3500
const MS_PRO_ZEICHEN = 45

/**
 * Fuellt fehlende Felder jeder Szene mit dem Wert der vorherigen Szene.
 * Startwerte: Intro (-1), kein Text, keine Hervorhebung, leeres Woerterbuch und Formel.
 */
export function szenenAufloesen(szenen: FilmSzeneRoh[]): FilmSzene[] {
  let vorher: Omit<FilmSzene, "sage"> = {
    phase: -1,
    text: null,
    hl: [],
    wb: 0,
    wbAktiv: [],
    formel: "",
  }

  return szenen.map((roh) => {
    const szene: FilmSzene = {
      phase: roh.phase ?? vorher.phase,
      text: roh.text !== undefined ? roh.text : vorher.text,
      hl: roh.hl ?? vorher.hl,
      wb: roh.wb ?? vorher.wb,
      wbAktiv: roh.wbAktiv ?? vorher.wbAktiv,
      formel: roh.formel ?? vorher.formel,
      sage: roh.sage,
    }
    vorher = szene
    return szene
  })
}

/** Laenge des sichtbaren Textes ohne HTML-Tags. */
export function klartextLaenge(inhalt: string): number {
  return inhalt.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim().length
}

/** Anzeigedauer einer Szene: max(3,5 s, Zeichen x 45 ms) / Tempo. */
export function szenenDauerMs(sage: string, tempo: Tempo): number {
  const basis = Math.max(MIN_DAUER_MS, klartextLaenge(sage) * MS_PRO_ZEICHEN)
  return Math.round(basis / TEMPI[tempo])
}

/** Index der ersten Szene nach dem Intro (Play springt direkt dorthin). */
export function ersteInhaltsSzene(szenen: FilmSzene[]): number {
  const index = szenen.findIndex((s) => s.phase >= 0)
  return index === -1 ? 0 : index
}
