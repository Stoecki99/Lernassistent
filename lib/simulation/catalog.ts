// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// lib/simulation/catalog.ts
// Verzeichnis der Szenarien (Kern-Erweiterung K3, Spezifikation 2.11.13): IDs, Startparameter und Texte
// der Startseite. Ohne Szenario-Daten und ohne Node-Module, damit Server, Browser und Tests es teilen.
// Die Szenario-Dateien lädt der Server über lib/simulation/scenarios.ts, der Browser über scenarioLoader.ts.

export interface ScenarioCatalogEntry {
  /** Szenario-ID = Dateiname in content/simulation ohne «.json» */
  id: string
  kind: "intro" | "main"
  /** Wert für /leitstand?start= (Station 23 verlinkt «einfuehrung» und «ernstfall») */
  start: string
  /** Überschrift der Karte über dem Titel */
  label: string
  /** Titel, solange die Szenario-Datei fehlt; sonst gilt der Titel aus der Datei */
  fallbackTitle: string
  /** Kurzbeschreibung auf der Startseite */
  teaser: string
  /** Name eines Sinnbilds aus avatarData.ts (Gruppe) als Bild der Karte */
  emblem: string
  /** Empfehlung zur Reihenfolge (nur Hinweis, kein Zugangsschutz) */
  recommendation?: string
}

export const SCENARIO_CATALOG: readonly ScenarioCatalogEntry[] = [
  {
    id: "einfuehrung",
    kind: "intro",
    start: "einfuehrung",
    label: "Einführungslauf",
    fallbackTitle: "Hundeanmeldung online",
    teaser: "Kurzes Übungsprojekt mit eingeblendeten Hinweisen. Ideal, um die Bedienung zu lernen.",
    emblem: "Hundehaltende",
  },
  {
    id: "wolkenried",
    kind: "main",
    start: "ernstfall",
    label: "Ernstfall · Gemeinde",
    fallbackTitle: "Onlineschalter Wolkenried",
    teaser:
      "Gemeinde Wolkenried: Baugesuche gehen künftig online ein. Realisierung und Einführung, Statusbericht an den Gemeinderat, Abschlussbericht.",
    emblem: "Gemeinde Wolkenried",
  },
  {
    id: "hochmatt",
    kind: "main",
    start: "hochmatt",
    label: "Ernstfall · Kanton",
    fallbackTitle: "Stipendien-Assistent Hochmatt",
    teaser:
      "Kanton Hochmatt: Ein KI-Assistent bereitet Stipendiengesuche vor, entscheiden bleibt Sache der Sachbearbeitung. Recht, Evaluation und Sicherheit, agile Sprints mit HERMES-Phasentor, Statusbericht an den Regierungsrat.",
    emblem: "Kanton Hochmatt",
    recommendation: "Empfohlen nach dem Ernstfall Wolkenried.",
  },
]

/** Alle bekannten Szenario-IDs (auch solche, deren Datei noch fehlt) */
export const CATALOG_IDS: readonly string[] = SCENARIO_CATALOG.map((e) => e.id)

export function catalogEntry(id: string): ScenarioCatalogEntry | undefined {
  return SCENARIO_CATALOG.find((e) => e.id === id)
}
