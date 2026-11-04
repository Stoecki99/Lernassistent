// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// app/(leitstand)/leitstand/page.tsx
// Startseite des Leitstands (4.8): Einfuehrungslauf und Ernstfaelle aus dem Verzeichnis (K3), laufende Laeufe, Bestwerte.
// Szenario-Kennzahlen kommen serverseitig aus loadScenario; Laeufe laedt die Client-Komponente ueber die API.

import { loadScenario } from "@/lib/simulation"
import { SCENARIO_CATALOG, type ScenarioCatalogEntry } from "@/lib/simulation/catalog"
import LeitstandStart, { type ScenarioMeta } from "@/components/features/leitstand/LeitstandStart"
import styles from "../leitstand.module.css"

export const metadata = {
  title: "Leitstand · Projektsimulator",
}

/** Karte je Szenario aus dem Verzeichnis (K3); fehlt die Datei noch, zeigt die Karte «folgt». */
function meta(entry: ScenarioCatalogEntry): ScenarioMeta {
  const base = {
    id: entry.id,
    slug: entry.start,
    label: entry.label,
    teaser: entry.teaser,
    emblem: entry.emblem,
    recommendation: entry.recommendation ?? null,
    kind: entry.kind,
  }
  let s: ReturnType<typeof loadScenario> = null
  try {
    s = loadScenario(entry.id)
  } catch (error) {
    // Ungültige Datei (z. B. halb fertig): Karte als «folgt» statt Absturz der Startseite
    console.error("[leitstand/start]", entry.id, error)
  }
  if (!s) return { ...base, available: false, title: entry.fallbackTitle, facts: null }
  return {
    ...base,
    available: true,
    title: s.title,
    facts: {
      days: s.calendar.targetDay,
      tasks: s.tasks.length,
      people: s.people.filter((p) => !p.hidden).length,
      events: s.events.length,
      budget: s.budget.total,
      periods: s.calendar.periods.map((p) => p.label),
    },
  }
}

export default async function LeitstandPage({
  searchParams,
}: {
  searchParams: Promise<{ start?: string }> | { start?: string }
}) {
  const params = await searchParams
  const scenarios = SCENARIO_CATALOG.map(meta)
  const start = scenarios.find((m) => m.available && m.slug === params?.start)?.slug ?? null

  return (
    <div className={styles.start}>
      <header className={styles.startKopf}>
        <p className="eyebrow">Lernpfad PMGT · Station 23</p>
        <h1>Leitstand</h1>
        <p className="lead">
          Du leitest ein Projekt der öffentlichen Verwaltung: Team besetzen, Zeit laufen lassen, auf Ereignisse entscheiden, ehrlich berichten.
          Kennzahlen, Gremium und Coach geben dir laufend Rückmeldung. Am Ende zählen Punkte, Sterne und Abzeichen.
        </p>
      </header>
      <LeitstandStart scenarios={scenarios} start={start} />
      <div className={`card stack ${styles.ablauf}`}>
        <h2>So läuft ein Lauf</h2>
        <ol className={styles.schritte}>
          <li>
            <strong>Planen:</strong> Vorgänge nach Profil, Pensum und kritischem Pfad besetzen, Reviews und Risikomassnahmen wählen.
          </li>
          <li>
            <strong>Durchführen:</strong> Zeit starten (Leertaste oder ▶, Tempo 1, 2, 4). Mails, Anrufe und Besuche halten die Zeit an.
          </li>
          <li>
            <strong>Steuern:</strong> Kennzahlen lesen (100 % = Plan), Prioritäten ändern, Gespräche führen, Register jede Woche prüfen.
          </li>
          <li>
            <strong>Berichten:</strong> Statusbericht an das Gremium (Gemeinderat oder Regierungsrat), am Ende der Abschlussbericht. Ehrlichkeit zahlt sich aus.
          </li>
          <li>
            <strong>Nachbesprechen:</strong> Punkte je Teil, Wendepunkte, Lessons Learned mit Links in den Lernpfad.
          </li>
        </ol>
        <p className="hint">Alle Namen, Personen und Organisationen sind frei erfunden.</p>
      </div>
    </div>
  )
}
