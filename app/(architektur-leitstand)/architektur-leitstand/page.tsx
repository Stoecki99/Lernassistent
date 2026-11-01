// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// app/(architektur-leitstand)/architektur-leitstand/page.tsx
// Missionswahl: Missionsdaten kommen serverseitig aus dem Simulator-Kern, Stand (Bestwert, Sterne, aktive Laeufe)
// laedt die Client-Komponente ueber die API.

import { KATEGORIE_VON, ladeMission, listeMissionen, stationsLink } from "@/lib/archsim"
import ArchitekturStart, { type MissionMeta } from "@/components/features/architektur-leitstand/ArchitekturStart"
import styles from "../architektur-leitstand.module.css"

export const metadata = {
  title: "Architektur-Leitstand · Missionen",
}

function meta(): MissionMeta[] {
  return listeMissionen().flatMap((k, i) => {
    const m = ladeMission(k.id)
    if (!m) return []
    const quelle = m.art === "modellieren" ? [...m.modell.elemente, ...(m.palette ?? []).filter((p) => !p.ablenker)] : m.modell.elemente
    const bausteine = quelle
      .map((e) => ({ name: e.name, kategorie: KATEGORIE_VON[e.typ] ?? "neutral" }))
      .filter((b) => b.kategorie !== "neutral")
    return [
      {
        id: m.id,
        nummer: i + 1,
        titel: m.titel,
        untertitel: m.untertitel,
        firma: m.firma,
        schwierigkeit: m.schwierigkeit,
        art: m.art,
        gefuehrt: m.gefuehrt,
        dauer: m.dauer,
        budget: m.budget,
        p95Ms: m.slo.p95Ms,
        verfuegbarkeit: m.slo.verfuegbarkeit,
        lernziele: m.lernziele.map((l) => ({ text: l.text, link: stationsLink(l.station, l.abschnitt) })),
        bausteine,
        ereignisse: m.ereignisse.length,
      },
    ]
  })
}

export default function ArchitekturLeitstandPage() {
  return (
    <div className={styles.start}>
      <header className={styles.startKopf}>
        <p className="eyebrow">Lernpfad AVSW · Station 11</p>
        <h1>Architektur-Leitstand</h1>
        <p className="lead">
          Du übernimmst den Betrieb einer verteilten Architektur: Last steigt, Abhängigkeiten stottern, Deployments gehen schief. Lies die Kennzahlen,
          triff Massnahmen und sieh live, wie das Diagramm reagiert. Am Ende zählen Punkte, Sterne und eine Nachbesprechung mit Ursache und Wirkung.
        </p>
      </header>
      <ArchitekturStart missionen={meta()} />
      <section className={`card stack ${styles.ablauf}`} aria-labelledby="al-ablauf">
        <h2 id="al-ablauf" className={styles.h2klein}>
          So läuft eine Mission
        </h2>
        <ol className={styles.schritte}>
          <li>
            <strong>Briefing:</strong> Auftrag, Ziele (SLO für p95 und Verfügbarkeit), Budget und Lernziele lesen.
          </li>
          <li>
            <strong>Modellieren</strong> (Mission 4): Architektur aus dem Auftrag bauen, die Live-Prüfung zeigt, was fehlt.
          </li>
          <li>
            <strong>Vorbereiten:</strong> Vor dem Start wirken Massnahmen sofort, zum Beispiel ein Cache vor der Datenbank.
          </li>
          <li>
            <strong>Steuern:</strong> Zeit starten (Leertaste, Tempo 1×, 2×, 4×), Elemente im Diagramm antippen, skalieren, Resilienz einstellen.
          </li>
          <li>
            <strong>Nachbesprechen:</strong> Punkte je Teil, Zeitreise durch Ursache und Wirkung, Lehren mit Links in den Lernpfad.
          </li>
        </ol>
        <p className="hint">Alle Firmen und Namen sind frei erfunden. Die Zahlen folgen einfachen Warteschlangen-Modellen und zeigen Grössenordnungen, keine echten Messungen.</p>
      </section>
    </div>
  )
}
