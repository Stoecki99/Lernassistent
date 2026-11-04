// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// components/features/leitstand/format.ts
// Anzeigehilfen des Leitstands: Zahlen (Schweizer Format), Ampeln, Bezeichnungen, Stationen.

import pmgtFach from "@/content/lernseiten/pmgt/fach.json"
import type { Ampel, Channel, Rating, TaskStatus, TeamPhase } from "@/lib/simulation/core"
import type { IconName } from "./Icon"
import type { DisplayStatus } from "./logic"

/** CHF 168'400 (gerundet auf Franken, Apostroph als Tausendertrennzeichen) */
export function chf(value: number): string {
  return `CHF ${tausender(Math.round(value))}`
}

export function tausender(value: number): string {
  const sign = value < 0 ? "−" : ""
  const s = Math.abs(Math.round(value)).toString()
  return sign + s.replace(/\B(?=(\d{3})+(?!\d))/g, "'")
}

/** Kennzahl als Prozent (1.02 → «102 %») */
export function ratioPct(value: number): string {
  return `${Math.round(value * 100)} %`
}

export function pct(value: number): string {
  return `${Math.round(value)} %`
}

export function stunden(value: number): string {
  return `${(Math.round(value * 10) / 10).toLocaleString("de-CH")} h`
}

export function tag(value: number): string {
  return `Tag ${(Math.round(value * 10) / 10).toLocaleString("de-CH")}`
}

export const AMPEL_FORM: Record<Ampel, string> = { gruen: "●", gelb: "▲", rot: "■" }
export const AMPEL_TEXT: Record<Ampel, string> = { gruen: "Grün", gelb: "Gelb", rot: "Rot" }

// Gebietskürzel und -namen je Szenario: areaLabelsOf (lib/simulation/labels.ts, K1 in 2.11.13)

export const STATUS_TEXT: Record<TaskStatus, string> = {
  offen: "offen",
  bereit: "bereit",
  laufend: "läuft",
  fertig: "fertig",
}

/** Anzeige-Status mit Symbol (Text bleibt immer sichtbar) */
export const DISPLAY_STATUS_TEXT: Record<DisplayStatus, string> = {
  offen: "offen",
  bereit: "bereit",
  laufend: "läuft",
  fertig: "fertig",
  blockiert: "blockiert",
}
export const DISPLAY_STATUS_ICON: Record<DisplayStatus, IconName> = {
  offen: "offen",
  bereit: "bereit",
  laufend: "laufend",
  fertig: "fertig",
  blockiert: "blockiert",
}

export const PHASE_TEXT: Record<TeamPhase, string> = {
  orientierung: "Orientierung",
  sturm: "Sturm",
  normierung: "Normierung",
  leistung: "Leistung",
}

export const CHANNEL_SYMBOL: Record<Channel, IconName> = { mail: "mail", anruf: "anruf", besuch: "besuch", system: "system" }
export const CHANNEL_TEXT: Record<Channel, string> = { mail: "Mail", anruf: "Anruf", besuch: "Besuch", system: "Mitteilung" }

export const RATING_TEXT: Record<Rating, string> = { gut: "Gut entschieden", mittel: "Teilweise gut", schlecht: "Ungünstig" }
export const RATING_FORM: Record<Rating, string> = { gut: "●", mittel: "▲", schlecht: "■" }
export const RATING_AMPEL: Record<Rating, Ampel> = { gut: "gruen", mittel: "gelb", schlecht: "rot" }

export const ORIGIN_TEXT: Record<string, string> = {
  kern: "Kernteam",
  linie: "Linie",
  lieferant: "Lieferant",
  beratung: "Beratung",
}

export const SHARE_OPTIONS = [1, 0.75, 0.5, 0.25] as const
export const PRIORITIES = ["A", "B", "C", "D", "E", "F"] as const

/** Abzeichen aus 3.13 (Name, Symbol, Bedingung) */
export const ACHIEVEMENTS: Record<string, { name: string; icon: string; text: string }> = {
  leitstand_einfuehrung: { name: "Erster Schichtwechsel", icon: "🎛️", text: "Einführungslauf abgeschlossen" },
  leitstand_ernstfall: { name: "Onlineschalter eröffnet", icon: "🏛️", text: "Ernstfall Wolkenried abgeschlossen" },
  leitstand_hochmatt: { name: "Stipendien-Assistent eingeführt", icon: "🎓", text: "Ernstfall Hochmatt abgeschlossen" },
  leitstand_drei_sterne: { name: "Leitstand-Profi", icon: "⭐", text: "Ernstfall mit mindestens 820 Punkten" },
  leitstand_punktlandung: { name: "Punktlandung", icon: "🎯", text: "Bis Tag 40 und im Budget" },
  leitstand_klartext: { name: "Klartext", icon: "📣", text: "Alle Berichte mit Ehrlichkeit ab 85" },
  leitstand_teamgeist: { name: "Teamgeist", icon: "🤝", text: "Teammotivation nie unter 80" },
  leitstand_risikoprofi: { name: "Risikoprofi", icon: "🛡️", text: "Risiko-Index im Mittel ab 100 und früh vorgesorgt" },
  leitstand_null_fehler: { name: "Null-Fehler-Abnahme", icon: "✅", text: "Höchstens 3 Restmängel" },
}

const STATIONS: Record<string, string> = Object.fromEntries(pmgtFach.pfad.map((p) => [p.slug, p.titel]))

export function stationTitle(slug: string): string {
  return STATIONS[slug] ?? slug
}

export function stationNumber(slug: string): string {
  return slug.split("-")[0] ?? slug
}

export function stationHref(slug: string): string {
  return `/lernseiten/pmgt/${slug}`
}

/** Rückmeldungen enthalten am Ende «→ ICB … · Station 16 /lernseiten/pmgt/…». Für die Anzeige den Pfad entfernen. */
export function splitFeedback(text: string): { main: string; reference: string } {
  const i = text.indexOf("→")
  const main = (i >= 0 ? text.slice(0, i) : text).trim()
  const reference = i >= 0 ? text.slice(i + 1).replace(/\s*\/lernseiten\/pmgt\/[a-z0-9-]+/g, "").trim() : ""
  return { main, reference }
}

/** Einfaches Markdown-light (Absätze, Listen, **fett**) in Blöcke zerlegen; ohne HTML-Einschleusung. */
export type BriefBlock = { kind: "p"; parts: Array<{ bold: boolean; text: string }> } | { kind: "ul"; items: Array<Array<{ bold: boolean; text: string }>> }

function inline(text: string): Array<{ bold: boolean; text: string }> {
  return text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean).map((t) =>
    t.startsWith("**") && t.endsWith("**") ? { bold: true, text: t.slice(2, -2) } : { bold: false, text: t }
  )
}

export function parseBrief(text: string): BriefBlock[] {
  const blocks: BriefBlock[] = []
  for (const para of text.split(/\n{2,}/)) {
    const lines = para.split("\n").map((l) => l.trim()).filter(Boolean)
    if (lines.length === 0) continue
    if (lines.every((l) => /^[-*] /.test(l))) blocks.push({ kind: "ul", items: lines.map((l) => inline(l.slice(2))) })
    else blocks.push({ kind: "p", parts: inline(lines.join(" ")) })
  }
  return blocks
}
