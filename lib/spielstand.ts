// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// lib/spielstand.ts
// Serverlogik der Spielstand-API (docs/architektur-modell.md, Abschnitt 8):
// Bestwert race-sicher speichern, Punkte ins Konto, Rate-Limit, Abzeichen-Bedingungen.
// Die reinen Regeln (Bestwert, Punkte) liegen in lib/validations/spielstand.ts.

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { retryOnPrismaCodes } from "@/lib/leitstand"
import {
  MAX_STERNE,
  bewerteSpielstand,
  type SpielstandBewertung,
  type SpielstandEingabe,
} from "@/lib/validations/spielstand"

export const KEIN_CACHE = { "Cache-Control": "private, no-store" } as const

// ---------- Rate-Limit (im Speicher je Konto und Zweck, wie Chat und Leitstand) ----------

const limitMap = new Map<string, { anzahl: number; endetUm: number }>()
const LIMIT_FENSTER_MS = 60 * 1000

/** Anfragen je Minute und Konto */
export const SPIELSTAND_LIMITS = { lesen: 60, schreiben: 60 } as const

export function pruefeSpielstandLimit(userId: string, zweck: keyof typeof SPIELSTAND_LIMITS): boolean {
  const jetzt = Date.now()
  if (limitMap.size > 5000) {
    for (const [schluessel, eintrag] of limitMap) if (jetzt > eintrag.endetUm) limitMap.delete(schluessel)
  }
  const schluessel = `${zweck}:${userId}`
  const eintrag = limitMap.get(schluessel)
  if (!eintrag || jetzt > eintrag.endetUm) {
    limitMap.set(schluessel, { anzahl: 1, endetUm: jetzt + LIMIT_FENSTER_MS })
    return true
  }
  if (eintrag.anzahl >= SPIELSTAND_LIMITS[zweck]) return false
  eintrag.anzahl += 1
  return true
}

export function limitAntwort(): NextResponse {
  return NextResponse.json(
    { error: "Zu viele Anfragen. Bitte kurz warten." },
    { status: 429, headers: { ...KEIN_CACHE, "Retry-After": "60" } },
  )
}

// ---------- Speichern ----------

/**
 * Höchstzahl gespeicherter Levels je Konto und Fach. spiel und level kommen vom Browser;
 * ohne Grenze liessen sich mit erfundenen Namen beliebig viele Punkte sammeln.
 * Weiche Grenze: gleichzeitige erste Speicherungen können sie um wenige Zeilen überschreiten.
 */
export const MAX_SPIELSTAENDE_PRO_FACH = 300

/** Versuche bei gleichzeitigen Änderungen desselben Levels */
const SPEICHER_VERSUCHE = 4

/** Fehlercode für «Bestwert wurde gleichzeitig geändert» (wird wie P2002 neu versucht) */
const KONFLIKT_CODE = "SPIELSTAND_KONFLIKT"

/** Zu viele verschiedene Levels in einem Fach (MAX_SPIELSTAENDE_PRO_FACH) */
export class SpielstandVollFehler extends Error {
  constructor() {
    super("Zu viele Spielstände in diesem Fach.")
    this.name = "SpielstandVollFehler"
  }
}

type SpielstandDb = Pick<typeof prisma, "$transaction">

/**
 * Speichert den Bestwert eines Levels und schreibt die Punkte gut, beides in einer Transaktion.
 *
 * Race-Sicherheit ohne Serializable: Der alte Stand wird gelesen, die Änderung ist ein bedingtes Update
 * (nur wenn sterne und xp noch dem gelesenen Stand entsprechen). Ändert eine gleichzeitige Anfrage den Stand,
 * trifft das Update 0 Zeilen, die Transaktion schreibt nichts und läuft neu. Gleichzeitige erste Speicherungen
 * scheitern an @@unique (P2002) und laufen ebenfalls neu. So wird jede XP-Verbesserung genau einmal vergütet.
 */
export async function speichereSpielstand(
  userId: string,
  eingabe: SpielstandEingabe,
  db: SpielstandDb = prisma,
): Promise<SpielstandBewertung> {
  const { fach, spiel, level, sterne, xp } = eingabe

  const versuch = () =>
    db.$transaction(async (tx) => {
      const alt = await tx.spielstand.findUnique({
        where: { userId_fach_spiel_level: { userId, fach, spiel, level } },
        select: { id: true, sterne: true, xp: true },
      })
      const bewertung = bewerteSpielstand(alt, { sterne, xp })
      if (!bewertung.verbessert) return { verbessert: false, punkte: 0 }

      if (alt) {
        const geaendert = await tx.spielstand.updateMany({
          where: { id: alt.id, sterne: alt.sterne, xp: alt.xp },
          data: { sterne: bewertung.stand.sterne, xp: bewertung.stand.xp },
        })
        if (geaendert.count === 0) throw Object.assign(new Error("Spielstand gleichzeitig geändert"), { code: KONFLIKT_CODE })
      } else {
        const anzahl = await tx.spielstand.count({ where: { userId, fach } })
        if (anzahl >= MAX_SPIELSTAENDE_PRO_FACH) throw new SpielstandVollFehler()
        await tx.spielstand.create({ data: { userId, fach, spiel, level, sterne, xp } })
      }

      if (bewertung.punkte > 0) {
        await tx.user.update({ where: { id: userId }, data: { points: { increment: bewertung.punkte } } })
      }
      return { verbessert: true, punkte: bewertung.punkte }
    })

  return retryOnPrismaCodes(["P2002", "P2034", KONFLIKT_CODE], SPEICHER_VERSUCHE, versuch)
}

// ---------- Abzeichen ----------

/** Fach, dessen Spiele für die Spiel-Abzeichen zählen */
export const SPIEL_ABZEICHEN_FACH = "avsw"

export interface SpielAbzeichenStatistik {
  /** Summe der besten Sterne aller Levels im Fach */
  sterneSumme: number
  /** Anzahl Levels mit 3 Sternen */
  dreiSterneLevels: number
}

/** Bedingungen (Badge.condition) der Spiel-Abzeichen; gleich wie Migration 20261101110000_add_spielstand und prisma/seed.ts */
export const SPIEL_ABZEICHEN: Record<string, (statistik: SpielAbzeichenStatistik) => boolean> = {
  avsw_spiel_fehlerfrei: (s) => s.dreiSterneLevels >= 1,
  avsw_spiel_sterne_10: (s) => s.sterneSumme >= 10,
  avsw_spiel_sterne_25: (s) => s.sterneSumme >= 25,
  avsw_spiel_sterne_45: (s) => s.sterneSumme >= 45,
}

export const SPIEL_ABZEICHEN_BEDINGUNGEN = Object.keys(SPIEL_ABZEICHEN)

/** true/false für eine Spiel-Bedingung, null für jede andere Bedingung */
export function spielAbzeichenErfuellt(bedingung: string, statistik: SpielAbzeichenStatistik): boolean | null {
  const regel = Object.hasOwn(SPIEL_ABZEICHEN, bedingung) ? SPIEL_ABZEICHEN[bedingung] : undefined
  return regel ? regel(statistik) : null
}

export async function ladeSpielAbzeichenStatistik(userId: string): Promise<SpielAbzeichenStatistik> {
  const [summe, dreiSterneLevels] = await Promise.all([
    prisma.spielstand.aggregate({ where: { userId, fach: SPIEL_ABZEICHEN_FACH }, _sum: { sterne: true } }),
    prisma.spielstand.count({ where: { userId, fach: SPIEL_ABZEICHEN_FACH, sterne: MAX_STERNE } }),
  ])
  return { sterneSumme: summe._sum.sterne ?? 0, dreiSterneLevels }
}
