// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// lib/ipma/competences.ts
// Die 28 Kompetenzen der ICB4 (Spezifikation 2.3, Anhang 10.1). Enthält keine Lösungen und darf
// deshalb auch in Client-Komponenten verwendet werden (6.2).

export const COMPETENCE_IDS = [
  "1.01", "1.02", "1.03", "1.04", "1.05",
  "2.01", "2.02", "2.03", "2.04", "2.05", "2.06", "2.07", "2.08", "2.09", "2.10",
  "3.01", "3.02", "3.03", "3.04", "3.05", "3.06", "3.07", "3.08", "3.09", "3.10", "3.11", "3.12", "3.13",
] as const
export type CompetenceId = (typeof COMPETENCE_IDS)[number]

export const AREA_IDS = ["perspective", "people", "practice"] as const
export type AreaId = (typeof AREA_IDS)[number]

export interface Area {
  id: AreaId
  title: string // Name nach ICB4
  label: string // deutsche Bezeichnung für die Oberfläche
}

/** Die drei Bereiche der ICB4 in fester Reihenfolge (1.5) */
export const AREAS: readonly Area[] = [
  { id: "perspective", title: "Perspective", label: "Kontext" },
  { id: "people", title: "People", label: "Menschen" },
  { id: "practice", title: "Practice", label: "Praktiken" },
]

export interface Competence {
  id: CompetenceId
  title: string // Titel nach Swiss ICB
  area: AreaId
  icbPage: number // erste Seite des Elements in der Swiss ICB
  kciCount: number // Anzahl Indikatoren (Summe 133)
  summary: string // ein Satz in eigenen Worten (Landkarte), kein ICB-Zitat
  stations: string[] // Slugs, wichtigste zuerst (Empfehlung «wiederholen»)
}

/** Summe der Rasterpunkte jeder offenen Frage (1.5, 2.2) */
export const RASTER_TOTAL = 4

/** Anhang 10.1; Stationen 02, 23 und 24 erscheinen nie in den Empfehlungen */
export const COMPETENCES: readonly Competence[] = [
  { id: "1.01", title: "Strategie", area: "perspective", icbPage: 31, kciCount: 5,
    summary: "Das Projekt leitet seinen Zweck aus der Strategie der Organisation ab und zeigt, wie es zu deren Zielen beiträgt.",
    stations: ["04-projektkontext", "12-wirtschaftlichkeit"] },
  { id: "1.02", title: "Governance, Strukturen und Prozesse", area: "perspective", icbPage: 35, kciCount: 7,
    summary: "Das Projekt fügt sich in die Strukturen und Abläufe der Organisation ein, etwa in Portfolio, Programme und Entscheidungswege.",
    stations: ["04-projektkontext", "15-organisation-und-rollen", "03-hermes"] },
  { id: "1.03", title: "Compliance, Standards und Regulationen", area: "perspective", icbPage: 40, kciCount: 6,
    summary: "Das Projekt hält die Gesetze, Normen, Standards und Verhaltensregeln ein, die für seinen Inhalt und sein Umfeld gelten.",
    stations: ["04-projektkontext", "03-hermes"] },
  { id: "1.04", title: "Macht und Interessen", area: "perspective", icbPage: 45, kciCount: 3,
    summary: "Die Projektleitung erkennt Einfluss, Interessen und informelle Macht im Umfeld und geht bewusst damit um.",
    stations: ["04-projektkontext", "14-stakeholder"] },
  { id: "1.05", title: "Kultur und Werte", area: "perspective", icbPage: 48, kciCount: 3,
    summary: "Die Projektleitung versteht die Kultur und die Werte der Organisation und ihres Umfelds und richtet das Vorgehen danach aus.",
    stations: ["04-projektkontext", "17-persoenliche-kompetenzen"] },
  { id: "2.01", title: "Selbstreflexion und Selbstmanagement", area: "people", icbPage: 53, kciCount: 5,
    summary: "Du kennst deine Stärken, Gefühle und Grenzen, teilst deine Zeit ein und bleibst auch unter Druck handlungsfähig.",
    stations: ["17-persoenliche-kompetenzen"] },
  { id: "2.02", title: "Persönliche Integrität und Verlässlichkeit", area: "people", icbPage: 57, kciCount: 5,
    summary: "Du handelst nach klaren Werten, hältst Zusagen ein und übernimmst Verantwortung für dein Tun.",
    stations: ["17-persoenliche-kompetenzen"] },
  { id: "2.03", title: "Persönliche Kommunikation", area: "people", icbPage: 59, kciCount: 5,
    summary: "Du übermittelst Informationen klar und passend zur Zielgruppe und prüfst, ob sie richtig verstanden wurden.",
    stations: ["16-fuehrung-team-meetings"] },
  { id: "2.04", title: "Beziehungen und Engagement", area: "people", icbPage: 62, kciCount: 5,
    summary: "Du baust tragfähige Beziehungen auf, hörst zu und weckst bei anderen Begeisterung für das Projekt.",
    stations: ["16-fuehrung-team-meetings"] },
  { id: "2.05", title: "Führung", area: "people", icbPage: 66, kciCount: 5,
    summary: "Du gibst die Richtung vor, triffst Entscheidungen und passt deinen Führungsstil der Lage und den Personen an.",
    stations: ["16-fuehrung-team-meetings", "22-simulation-verstehen"] },
  { id: "2.06", title: "Teamarbeit", area: "people", icbPage: 70, kciCount: 5,
    summary: "Du stellst ein Team zusammen, förderst die Zusammenarbeit und begleitest es durch die Phasen der Teambildung.",
    stations: ["16-fuehrung-team-meetings"] },
  { id: "2.07", title: "Konflikte und Krisen", area: "people", icbPage: 73, kciCount: 4,
    summary: "Du erkennst Konflikte und Krisen früh, schätzt ihre Eskalation ein und wählst ein passendes Vorgehen zur Lösung.",
    stations: ["17-persoenliche-kompetenzen"] },
  { id: "2.08", title: "Vielseitigkeit", area: "people", icbPage: 77, kciCount: 5,
    summary: "Du gehst Probleme mit Kreativität, verschiedenen Denkweisen und dem Blick fürs Ganze an.",
    stations: ["17-persoenliche-kompetenzen"] },
  { id: "2.09", title: "Verhandlungen", area: "people", icbPage: 81, kciCount: 5,
    summary: "Du verhandelst nach Interessen statt Positionen und erreichst Vereinbarungen, die für alle Beteiligten tragfähig sind.",
    stations: ["17-persoenliche-kompetenzen"] },
  { id: "2.10", title: "Ergebnisorientierung", area: "people", icbPage: 85, kciCount: 5,
    summary: "Du richtest das Handeln aller auf die Ergebnisse und den Nutzen des Projekts aus und räumst Hindernisse aus dem Weg.",
    stations: ["17-persoenliche-kompetenzen", "01-projekte-und-projektmanagement"] },
  { id: "3.01", title: "Projektdesign", area: "practice", icbPage: 89, kciCount: 5,
    summary: "Das Projekt bekommt ein passendes Gesamtkonzept aus Erfolgskriterien, Vorgehensmodell, Organisation und Steuerung.",
    stations: ["01-projekte-und-projektmanagement", "08-vorgehensmodelle", "03-hermes", "07-projektauftrag"] },
  { id: "3.02", title: "Anforderungen und Ziele", area: "practice", icbPage: 94, kciCount: 3,
    summary: "Bedürfnisse werden erhoben, als Anforderungen beschrieben und in prüfbare, priorisierte Ziele übersetzt.",
    stations: ["05-ziele-und-anforderungen"] },
  { id: "3.03", title: "Leistungsumfang und Lieferobjekte", area: "practice", icbPage: 97, kciCount: 4,
    summary: "Der Leistungsumfang wird abgegrenzt und in Lieferobjekte und Arbeitspakete gegliedert.",
    stations: ["06-leistungsumfang-und-arbeitspakete", "09-projektstrukturplan"] },
  { id: "3.04", title: "Ablauf und Termine", area: "practice", icbPage: 100, kciCount: 5,
    summary: "Vorgänge werden in eine Reihenfolge gebracht, terminiert und mit Netzplan und Meilensteinen geplant und verfolgt.",
    stations: ["10-netzplan-und-gantt", "08-vorgehensmodelle"] },
  { id: "3.05", title: "Organisation, Information und Dokumentation", area: "practice", icbPage: 103, kciCount: 4,
    summary: "Rollen, Zuständigkeiten, Informationsflüsse und die Projektdokumentation werden festgelegt und gepflegt.",
    stations: ["15-organisation-und-rollen", "19-statusbericht", "16-fuehrung-team-meetings", "03-hermes"] },
  { id: "3.06", title: "Qualität", area: "practice", icbPage: 107, kciCount: 5,
    summary: "Die Qualität von Vorgehen und Ergebnissen wird geplant, gesichert, geprüft und laufend verbessert.",
    stations: ["20-qualitaet-und-aenderungen"] },
  { id: "3.07", title: "Kosten und Finanzierung", area: "practice", icbPage: 111, kciCount: 5,
    summary: "Kosten werden geschätzt, budgetiert und finanziert und während des Projekts überwacht.",
    stations: ["11-ressourcen-und-kosten", "12-wirtschaftlichkeit", "18-earned-value"] },
  { id: "3.08", title: "Ressourcen", area: "practice", icbPage: 116, kciCount: 5,
    summary: "Personen und Sachmittel werden geplant, beschafft und zugeteilt, und ihre Auslastung wird gesteuert.",
    stations: ["11-ressourcen-und-kosten", "22-simulation-verstehen"] },
  { id: "3.09", title: "Beschaffung", area: "practice", icbPage: 119, kciCount: 4,
    summary: "Leistungen von Dritten werden ausgeschrieben, ausgewählt, vertraglich geregelt und abgenommen.",
    stations: ["21-beschaffung-und-vertraege"] },
  { id: "3.10", title: "Planung und Steuerung", area: "practice", icbPage: 123, kciCount: 6,
    summary: "Das Projekt wird über alle Phasen geplant, mit Soll-Ist-Vergleichen gesteuert und mit kontrollierten Änderungen weitergeführt.",
    stations: ["18-earned-value", "19-statusbericht", "07-projektauftrag", "22-simulation-verstehen"] },
  { id: "3.11", title: "Chancen und Risiken", area: "practice", icbPage: 129, kciCount: 5,
    summary: "Chancen und Risiken werden erkannt, bewertet, mit Massnahmen behandelt und laufend überwacht.",
    stations: ["13-chancen-und-risiken"] },
  { id: "3.12", title: "Stakeholder", area: "practice", icbPage: 133, kciCount: 5,
    summary: "Anspruchsgruppen werden erkannt, nach Einfluss und Haltung analysiert und gezielt einbezogen.",
    stations: ["14-stakeholder"] },
  { id: "3.13", title: "Change und Transformation", area: "practice", icbPage: 138, kciCount: 4,
    summary: "Die Veränderung in der Organisation wird vorbereitet, begleitet und nachhaltig verankert.",
    stations: ["20-qualitaet-und-aenderungen"] },
]

const BY_ID: ReadonlyMap<CompetenceId, Competence> = new Map(COMPETENCES.map((c) => [c.id, c]))

/** Kompetenz zur ID (Anhang 10.1); wirft bei einer unbekannten ID (Programmierfehler). */
export function getCompetence(id: CompetenceId): Competence {
  const c = BY_ID.get(id)
  if (!c) throw new Error(`Unbekannte Kompetenz ${id}`)
  return c
}

/** Typwächter für Eingaben aus Datenbank oder Adresse (1.5) */
export function isCompetenceId(value: string): value is CompetenceId {
  return BY_ID.has(value as CompetenceId)
}
