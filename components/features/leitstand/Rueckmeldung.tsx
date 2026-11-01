// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// components/features/leitstand/Rueckmeldung.tsx
// Rückmeldung des Coachs nach einem Entscheid (3.12): Bewertung als Form und Text, ICB, Station im Lernpfad.

import type { EventDef, OptionDef } from "@/lib/simulation/core"
import styles from "@/app/(leitstand)/leitstand.module.css"
import { RATING_AMPEL, RATING_FORM, RATING_TEXT, splitFeedback, stationHref, stationNumber, stationTitle } from "./format"

export default function Rueckmeldung({
  event,
  option,
  coach,
  defaulted = false,
  decider,
  number,
}: {
  event: EventDef
  option: OptionDef
  coach: string
  defaulted?: boolean
  decider?: string
  /** Angezeigte Nummer der Option (gemischte Reihenfolge) */
  number: number
}) {
  const { main, reference } = splitFeedback(option.feedback)
  const ampel = RATING_AMPEL[option.rating]
  return (
    <div className={`${styles.rueckmeldung} ${styles[`rueck_${ampel}`]}`} role="status">
      <div className={styles.rueckKopf}>
        <span className={`${styles.ampel} ${styles[`ampel_${ampel}`]}`}>
          <span aria-hidden="true">{RATING_FORM[option.rating]}</span> {RATING_TEXT[option.rating]}
        </span>
        <span className={styles.rueckVon}>Rückmeldung von {coach}</span>
      </div>
      {defaulted && (
        <p className={styles.rueckStandard}>
          Die Frist ist abgelaufen. {decider ?? "Die Vorgesetzte"} hat für dich entschieden: Option {number}.
        </p>
      )}
      <p>
        <strong>
          {number} · {option.label}
        </strong>
      </p>
      <p>{main}</p>
      {reference && <p className={styles.rueckIcb}>{reference}</p>}
      <div className="row">
        <span className={styles.icbListe} aria-label="ICB-Elemente">
          {event.icb.map((i) => (
            <span key={i} className={styles.icb}>
              ICB {i}
            </span>
          ))}
        </span>
        {event.stations.map((slug) => (
          <a key={slug} className={`btn ${styles.klein}`} href={stationHref(slug)} target="_blank" rel="noopener">
            Station {stationNumber(slug)} öffnen: {stationTitle(slug)}
            <span className="sr-only"> (neuer Tab)</span>
            <span aria-hidden="true"> ↗</span>
          </a>
        ))}
      </div>
    </div>
  )
}
