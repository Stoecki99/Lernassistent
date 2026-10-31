// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// lib/simulation/calendar.ts
// Zeitmodell (Spezifikation 3.1): Takt = Halbtag, Tag d = ⌊t/2⌋ (0-basiert), Woche ⌊d/5⌋+1.

const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr"] as const

/** Tag (0-basiert) eines Takts, 3.1 */
export function dayOf(tick: number): number {
  return Math.floor(tick / 2)
}

/** Woche (1-basiert), 3.1 */
export function weekOf(tick: number): number {
  return Math.floor(dayOf(tick) / 5) + 1
}

/** Wochenindex (0-basiert), z. B. für stats.riskReviewedWeeks */
export function weekIndexOf(tick: number): number {
  return Math.floor(dayOf(tick) / 5)
}

/** Wochentag 0 = Mo … 4 = Fr, 3.1 */
export function weekdayOf(tick: number): number {
  return dayOf(tick) % 5
}

/** Halbtag 0 = Vormittag, 1 = Nachmittag, 3.1 */
export function halfOf(tick: number): 0 | 1 {
  return tick % 2 === 0 ? 0 : 1
}

/** Zeitpunkt nach Takt t in Tagen: τ = (t+1)/2, 3.1 */
export function tauAfter(tick: number): number {
  return (tick + 1) / 2
}

/** Takt aus Tag (1-basiert) und Halbtag: Takt = 2·(Tag − 1) + Halbtag (2.7) */
export function tickOf(day1: number, half: 0 | 1 = 0): number {
  return 2 * (day1 - 1) + half
}

export function weekdayName(tick: number): string {
  return WEEKDAYS[weekdayOf(tick)]
}

/** Anzeige «Di, Woche 3 · Tag 12 · Nachmittag» (4.2) */
export function formatTick(tick: number): string {
  const half = halfOf(tick) === 0 ? "Vormittag" : "Nachmittag"
  return `${weekdayName(tick)}, Woche ${weekOf(tick)} · Tag ${dayOf(tick) + 1} · ${half}`
}

/** Kurzform für schmale Bildschirme «Di · T12 · NM» (4.8) */
export function formatTickShort(tick: number): string {
  return `${weekdayName(tick)} · T${dayOf(tick) + 1} · ${halfOf(tick) === 0 ? "VM" : "NM"}`
}
