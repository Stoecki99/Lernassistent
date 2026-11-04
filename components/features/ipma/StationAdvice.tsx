// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// components/features/ipma/StationAdvice.tsx
// «Diese Stationen wiederholen» (Spezifikation 4.4, 6.8 StationAdvice): Titel, Link /lernseiten/pmgt/<slug>
// (neuer Tab), abgedeckte Schwächen; noch nicht veröffentlichte Stationen mit «folgt» ohne Link.

import type { StationAdvice as Advice } from "@/lib/ipma/types"
import styles from "@/app/(ipma)/ipma.module.css"
import { stationHref, stationNumber, trainingHref } from "./format"

export default function StationAdvice({ stations, weaknesses }: { stations: Advice[]; weaknesses: string[] }) {
  return (
    <section className="card stack" aria-labelledby="stationen-titel">
      <h2 id="stationen-titel">Diese Stationen wiederholen</h2>
      {stations.length === 0 ? (
        <p className="hint">Keine Schwächen in diesem Versuch. Weiter so!</p>
      ) : (
        <ul className={styles.stationen}>
          {stations.map((s) => (
            <li key={s.slug} className={styles.station}>
              <div>
                <strong>
                  {stationNumber(s.slug)} {s.title}
                </strong>
                <br />
                <span className="hint">deckt {s.competences.join(", ")} ab</span>
              </div>
              {s.available ? (
                <a className={`btn ${styles.klein}`} href={stationHref(s.slug)} target="_blank" rel="noopener noreferrer">
                  öffnen<span className="sr-only">: Station {stationNumber(s.slug)} {s.title} (neuer Tab)</span>
                </a>
              ) : (
                <span className={styles.leise}>(folgt)</span>
              )}
            </li>
          ))}
        </ul>
      )}
      {weaknesses.length > 0 && (
        <p className="hint">
          Gezielt trainieren:{" "}
          {weaknesses.map((c, i) => (
            <span key={c}>
              {i > 0 ? ", " : ""}
              <a href={trainingHref(c)}>{c}</a>
            </span>
          ))}
        </p>
      )}
    </section>
  )
}
