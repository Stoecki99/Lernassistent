// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// components/features/ipma/format.ts
// Anzeige-Hilfen des Prüfungssimulators (Spezifikation 4.4, 6.8): Punkte aus Viertelpunkten, Prozent,
// Zeiten, Bezeichnungen. Rein, ohne React.

import type { AttemptMode, AttemptVariant, ClientItem, MasteryLevelView, SolvedItem } from "@/lib/ipma/types"

/** Viertelpunkte je Punkt (RASTER_TOTAL in lib/ipma/competences.ts) */
export const QUARTERS = 4
/** Bestehensgrenzen (EXAM_CONFIG: passPercent, minCompetences); nur Anzeige, entschieden wird auf dem Server */
export const PASS_PERCENT = 60
export const MIN_COMPETENCES = 23
export const TOTAL_COMPETENCES = 28
/** Dauer der Übungsprüfung in Minuten (EXAM_CONFIG.exam.durationMin) für «mit Pausen» */
export const EXAM_MINUTES = 180

const NUMBER = new Intl.NumberFormat("de-CH", { maximumFractionDigits: 2 })
const PERCENT = new Intl.NumberFormat("de-CH", { maximumFractionDigits: 1 })

/** Viertelpunkte als Punkte («78», «78.5») */
export function points(quarters: number): string {
  return NUMBER.format(quarters / QUARTERS)
}

export function percent(value: number): string {
  return `${PERCENT.format(value)} %`
}

/** Bestehensgrenze in Punkten für eine Höchstpunktzahl (Viertelpunkte) */
export function passLimit(maxPointsQ: number): string {
  return points((maxPointsQ * PASS_PERCENT) / 100)
}

/** Sekunden als «2:14:05» bzw. «14:05» */
export function clock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const mm = String(m).padStart(h > 0 ? 2 : 1, "0")
  const ss = String(sec).padStart(2, "0")
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}

/** Sekunden als Text für Vorleser («2 Stunden 14 Minuten») */
export function clockWords(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const parts: string[] = []
  if (h > 0) parts.push(`${h} ${h === 1 ? "Stunde" : "Stunden"}`)
  if (m > 0 || h === 0) parts.push(`${m} ${m === 1 ? "Minute" : "Minuten"}`)
  return parts.join(" ")
}

export function date(iso: string): string {
  return new Date(iso).toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit", year: "numeric" })
}

export function dateTime(iso: string): string {
  return new Date(iso).toLocaleString("de-CH", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
}

export const MODE_LABEL: Record<AttemptMode, string> = {
  exam: "Übungsprüfung",
  short: "Kurzprüfung",
  training: "Training",
  gaps: "Lücken schliessen",
}

export const VARIANT_LABEL: Record<AttemptVariant, string> = {
  strict: "Echtbedingungen",
  pausable: "mit Pausen",
}

/** Stufen der Beherrschung (4.4): Zeichen und Wort, nie Farbe allein */
export const LEVEL: Record<MasteryLevelView, { word: string; sign: string }> = {
  secure: { word: "sicher", sign: "✓" },
  close: { word: "knapp", sign: "~" },
  gap: { word: "Lücke", sign: "✗" },
  untrained: { word: "noch nicht geübt", sign: "○" },
}

export const LETTERS = ["A", "B", "C", "D"] as const

export function typeLabel(item: Pick<ClientItem, "type" | "points">): string {
  const kind = item.type === "mc" ? "Multiple Choice" : "Offene Frage"
  return `${kind} · ${item.points} ${item.points === 1 ? "Punkt" : "Punkte"}`
}

/** Hat die Position eine Lösung (SolvedItem)? */
export function isSolved(item: ClientItem | SolvedItem): item is SolvedItem {
  return "questionId" in item
}

/** Beantwortet = Wahl getroffen bzw. Text nicht leer */
export function isAnswered(item: Pick<ClientItem, "type" | "choice" | "text">): boolean {
  return item.type === "mc" ? item.choice !== null : (item.text ?? "").trim() !== ""
}

/** Offene Position, die nach Raster selbst bewertet werden muss (4.2) */
export function needsSelfAssessment(item: SolvedItem): boolean {
  return item.type === "offen" && (item.text ?? "").trim() !== "" && item.selfScores.length === 0
}

/** Stationsnummer aus dem Slug («17-persoenliche-kompetenzen» → «17») */
export function stationNumber(slug: string): string {
  const m = /^(\d+)-/.exec(slug)
  return m ? m[1] : ""
}

export function stationHref(slug: string): string {
  return `/lernseiten/pmgt/${encodeURIComponent(slug)}`
}

export function trainingHref(competence: string): string {
  return `/ipma/training?kompetenz=${encodeURIComponent(competence)}`
}
