// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

"use client"

// components/features/architektur-leitstand/Briefing.tsx
// Briefing vor dem Lauf: Firma, Auftrag, Ziele (SLO), Budget, Dauer, Massnahmen, Lernziele mit Links auf die Stationen.

import { stationsLink, type Mission } from "@/lib/archsim"
import styles from "@/app/(architektur-leitstand)/architektur-leitstand.module.css"
import HtmlText from "./HtmlText"
import { chf, erlaubteMassnahmen, ms, prozent } from "./logik"

export default function Briefing({
  mission,
  weiterText,
  onWeiter,
  wiederholung,
}: {
  mission: Mission
  weiterText: string
  onWeiter: () => void
  wiederholung: boolean
}) {
  return (
    <article className={`card ${styles.briefing}`} aria-labelledby="al-briefing-titel">
      <div className={styles.briefingKopf}>
        <p className="eyebrow">
          Briefing · {mission.firma}
          {mission.gefuehrt ? " · geführt" : ""}
        </p>
        <h2 id="al-briefing-titel">{mission.titel}</h2>
        <p className="lead">{mission.untertitel}</p>
      </div>
      <div className={styles.briefingRaster}>
        <div className={`${styles.prosa} stack`}>
          <HtmlText html={mission.briefing} />
          {wiederholung && <p className="note">Wiederholung mit dem gleichen Zufall wie dein früherer Lauf: Er zählt nicht für Bestwert und Punkte.</p>}
        </div>
        <aside className={styles.ziele} aria-label="Ziele">
          <h3 className={styles.h3}>Ziele (SLO)</h3>
          <ul className={styles.zielListe}>
            <li>
              <span className={styles.zielSymbol} aria-hidden="true">
                ◷
              </span>
              <span>
                <strong>p95 ≤ {ms(mission.slo.p95Ms)}</strong>
                <br />
                <span className="hint">95 % der Anfragen jeder Minute schneller</span>
              </span>
            </li>
            <li>
              <span className={styles.zielSymbol} aria-hidden="true">
                ✓
              </span>
              <span>
                <strong>Verfügbarkeit ≥ {prozent(mission.slo.verfuegbarkeit, 1)}</strong>
                <br />
                <span className="hint">über die ganze Mission</span>
              </span>
            </li>
            <li>
              <span className={styles.zielSymbol} aria-hidden="true">
                ₣
              </span>
              <span>
                <strong>Budget {chf(mission.budget)}</strong>
                <br />
                <span className="hint">Betrieb und Massnahmen</span>
              </span>
            </li>
            <li>
              <span className={styles.zielSymbol} aria-hidden="true">
                ⏱
              </span>
              <span>
                <strong>{mission.dauer} Minuten</strong>
                <br />
                <span className="hint">1 Sekunde Echtzeit je Minute bei Tempo 1×</span>
              </span>
            </li>
          </ul>
          <h3 className={styles.h3}>Deine Werkzeuge</h3>
          <p className={styles.werkzeuge}>
            {erlaubteMassnahmen(mission).map((m) => (
              <span key={m.typ} className={styles.werkzeug}>
                <span aria-hidden="true">{m.symbol}</span> {m.titel}
              </span>
            ))}
          </p>
        </aside>
      </div>
      <div className={styles.lernziele}>
        <h3 className={styles.h3}>Lernziele</h3>
        <ul>
          {mission.lernziele.map((l, i) => (
            <li key={i}>
              {l.text}{" "}
              <a href={stationsLink(l.station, l.abschnitt)} target="_blank" rel="noopener">
                Station {l.station.slice(0, 2)} öffnen<span className="sr-only"> (neuer Tab)</span>
              </a>
            </li>
          ))}
        </ul>
      </div>
      <div className={styles.punkteRegel}>
        <h3 className={styles.h3}>So wird bewertet</h3>
        <p className="hint">
          Verfügbarkeit 300 · Antwortzeit 200 · SLO-Minuten 150 · Kosten 200 · Datensicherheit 150 Punkte
          {mission.art === "modellieren" ? " · −75 je nicht erfüllte Anforderung" : ""}. ★ ab 400, ★★ ab 650, ★★★ ab 820 Punkten.
        </p>
      </div>
      <div className="row">
        <button type="button" className="btn primary" onClick={onWeiter}>
          {weiterText}
        </button>
      </div>
    </article>
  )
}
