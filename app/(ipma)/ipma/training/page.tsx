// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// app/(ipma)/ipma/training/page.tsx
// Auswahl des Trainings (Spezifikation 3.4). Direktaufruf mit ?kompetenz=3.04 (auch mehrfach oder
// kommagetrennt) aus Station 02, Station 24 und der Auswertung wählt die Kompetenz vor.

import { isCompetenceId, type CompetenceId } from "@/lib/ipma/competences"
import TrainingSetup from "@/components/features/ipma/TrainingSetup"
import styles from "../../ipma.module.css"

export const metadata = {
  title: "Training · IPMA-Prüfungssimulator",
}

type Search = { kompetenz?: string | string[] }

export default async function TrainingPage({ searchParams }: { searchParams: Promise<Search> | Search }) {
  const params = await searchParams
  const raw = params?.kompetenz
  const values = (Array.isArray(raw) ? raw : raw ? [raw] : []).flatMap((v) => v.split(","))
  const preselect = Array.from(new Set(values.map((v) => v.trim()).filter(isCompetenceId))) as CompetenceId[]
  return (
    <div className={styles.start}>
      <header className={styles.startKopf}>
        <p className="eyebrow">IPMA-Prüfungssimulator</p>
        <h1>Training</h1>
        <p className="lead">Wähle, was du üben willst. Nach jeder Frage prüfst du sofort und siehst Lösung, Erklärung und Fundstelle. Die Kompetenz ist im Training sichtbar.</p>
      </header>
      <TrainingSetup preselect={preselect} />
    </div>
  )
}
