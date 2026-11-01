// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// lib/validations/spielstand.ts
// Zod-Schemas und Bestwert-Regeln fuer GET/POST /api/spielstand.
// Vertrag: docs/architektur-modell.md (Abschnitt 8), Doku: docs/lernpfad-format.md (Spielstand-API)

import { z } from "zod"

export const MAX_STERNE = 3
export const MAX_XP = 500
/** Punkte ins Konto = Verbesserung der besten XP ÷ PUNKTE_TEILER, abgerundet */
export const PUNKTE_TEILER = 10

const fachFeld = z.string().max(40).regex(/^[a-z0-9]+$/, "Ungültiges Fach.")
const spielFeld = z.string().regex(/^[a-z0-9-]{1,60}$/, "Ungültiges Spiel.")
const levelFeld = z.string().regex(/^[a-z0-9-]{1,40}$/, "Ungültiges Level.")
const sterneFeld = z
  .number({ message: "Sterne müssen eine ganze Zahl sein." })
  .int("Sterne müssen eine ganze Zahl sein.")
  .min(0, "Sterne dürfen nicht negativ sein.")
  .max(MAX_STERNE, `Höchstens ${MAX_STERNE} Sterne.`)
const xpFeld = z
  .number({ message: "XP müssen eine ganze Zahl sein." })
  .int("XP müssen eine ganze Zahl sein.")
  .min(0, "XP dürfen nicht negativ sein.")
  .max(MAX_XP, `Höchstens ${MAX_XP} XP.`)

/** Query von GET /api/spielstand?fach=… */
export const spielstandAbfrageSchema = z.object({
  fach: fachFeld,
})

/** Body von POST /api/spielstand. Unbekannte Felder werden verworfen. */
export const spielstandEingabeSchema = z.object({
  fach: fachFeld,
  spiel: spielFeld,
  level: levelFeld,
  sterne: sterneFeld,
  xp: xpFeld,
})

export type SpielstandEingabe = z.output<typeof spielstandEingabeSchema>

export interface Bestwert {
  sterne: number
  xp: number
}

/** true, wenn neu besser ist als alt: mehr Sterne, bei gleich vielen Sternen mehr XP. Ohne alten Stand immer true. */
export function istBesser(neu: Bestwert, alt: Bestwert | null): boolean {
  if (!alt) return true
  if (neu.sterne !== alt.sterne) return neu.sterne > alt.sterne
  return neu.xp > alt.xp
}

/**
 * Punkte ins Konto fuer eine Verbesserung: (neue beste XP − alte beste XP) ÷ 10, abgerundet, nie negativ.
 * Ohne alten Stand zaehlt die alte XP als 0. Mehr Sterne mit weniger XP ergibt 0 Punkte.
 */
export function spielstandPunkte(altXp: number | null, neuXp: number): number {
  const verbesserung = Math.max(0, neuXp - (altXp ?? 0))
  return Math.floor(verbesserung / PUNKTE_TEILER)
}

export interface SpielstandBewertung {
  /** Der gespeicherte Bestwert ändert sich (oder es ist der erste Eintrag) */
  verbessert: boolean
  /** Punkte ins Konto; 0, wenn nicht verbessert */
  punkte: number
  /** Neuer gespeicherter Stand: Sterne und XP je für sich das Maximum (XP sinkt nie, sonst zahlte eine Verbesserung doppelt) */
  stand: Bestwert
}

/** Bestwert-Regel als reine Funktion: ob gespeichert wird, was gespeichert wird und wie viele Punkte es gibt. */
export function bewerteSpielstand(alt: Bestwert | null, neu: Bestwert): SpielstandBewertung {
  const stand: Bestwert = alt
    ? { sterne: Math.max(alt.sterne, neu.sterne), xp: Math.max(alt.xp, neu.xp) }
    : { sterne: neu.sterne, xp: neu.xp }
  const verbessert = !alt || stand.sterne > alt.sterne || stand.xp > alt.xp
  if (!verbessert) return { verbessert: false, punkte: 0, stand }
  return { verbessert: true, punkte: spielstandPunkte(alt?.xp ?? null, stand.xp), stand }
}
