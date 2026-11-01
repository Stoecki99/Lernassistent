// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// components/features/leitstand/charts/AuslastungsDiagramm.tsx
// Auslastung je Person und Woche (4.8): Balken in %, Linie bei 100 %, Überlast schraffiert.
// u = bezahlte Projektstunden ÷ (8 × Pensum × Arbeitstage) wie beim Ressourcenausgleich (3.10).

import styles from "@/app/(leitstand)/leitstand.module.css"

export interface AuslastungsZeile {
  personId: string
  name: string
  /** Auslastung je Woche in % (null = Woche noch nicht begonnen) */
  weeks: Array<number | null>
}

export default function AuslastungsDiagramm({ rows, weekCount }: { rows: AuslastungsZeile[]; weekCount: number }) {
  const MAX = 150
  return (
    <div className="tablebox">
      <table className={`tabelle ${styles.auslastung}`}>
        <caption>Auslastung je Person und Woche in Prozent; 100 % entspricht dem Pensum, darüber sind Überstunden.</caption>
        <thead>
          <tr>
            <th scope="col">Person</th>
            {Array.from({ length: weekCount }, (_, w) => (
              <th key={w} scope="col" className="zahl">
                W{w + 1}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.personId}>
              <th scope="row">{row.name}</th>
              {row.weeks.map((u, w) => (
                <td key={w} className={styles.auslastungZelle}>
                  {u === null ? (
                    <span className={styles.leer}>–</span>
                  ) : (
                    <div className={styles.auslastungBalken} aria-label={`Woche ${w + 1}: ${Math.round(u)} %`} role="img">
                      <span
                        className={`${styles.auslastungFuellung} ${u > 100 ? styles.ueberlast : u < 50 ? styles.unterlast : ""}`}
                        style={{ height: `${(Math.min(u, MAX) / MAX) * 100}%` }}
                      />
                      <span className={styles.auslastungLinie} style={{ bottom: `${(100 / MAX) * 100}%` }} />
                      <span className={styles.auslastungWert} aria-hidden="true">
                        {Math.round(u)}
                      </span>
                    </div>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
