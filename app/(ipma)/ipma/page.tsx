// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// app/(ipma)/ipma/page.tsx
// Startseite des Prüfungssimulators (Spezifikation 6.8). Daten lädt IpmaStart über GET /api/ipma/overview;
// serverseitig kommen nur die Stationstitel dazu.

import IpmaStart from "@/components/features/ipma/IpmaStart"
import styles from "../ipma.module.css"
import { stationTitles } from "../stations"

export const metadata = {
  title: "IPMA-Prüfungssimulator",
}

export default async function IpmaPage({
  searchParams,
}: {
  searchParams: Promise<{ start?: string }> | { start?: string }
}) {
  const params = await searchParams
  const start = params?.start === "exam" || params?.start === "short" ? params.start : null
  return (
    <div className={styles.start}>
      <header className={styles.startKopf}>
        <p className="eyebrow">Lernpfad PMGT · Station 24</p>
        <h1>IPMA-Prüfungssimulator</h1>
        <p className="lead">
          Übe die Zertifizierungsprüfung IPMA Level D: eine volle Übungsprüfung unter Echtbedingungen, kurze Prüfungen, gezieltes Training je Kompetenz und Wiederholung deiner Lücken.
          Die Fragen sind eigene Übungsfragen nach dem Kompetenzmodell ICB4, keine Originalfragen der Prüfung.
        </p>
      </header>
      <IpmaStart stations={stationTitles()} start={start} />
    </div>
  )
}
