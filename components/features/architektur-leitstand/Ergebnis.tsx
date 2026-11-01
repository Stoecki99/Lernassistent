// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

"use client"

// components/features/architektur-leitstand/Ergebnis.tsx
// Ergebnis und Nachbesprechung: Punkte (hochzählend) und Sterne (nacheinander), Bestwert, Konto-Punkte, Abzeichen,
// Aufschlüsselung score.teile mit Erklärung, Zeitreise (Zeitachse Ursache → Wirkung anklicken: Zeiger im Verlauf,
// Diagramm zeigt den Zustand dieser Minute), Lehren mit Links, Lernziele, Musterstrategie,
// «Nochmals mit gleichem Seed» und «Neuer Lauf».

import { useEffect, useMemo, useState } from "react"
import { stationsLink, type Aktion, type ArchModell, type Mission, type ZeitachsenArt, type Zustand } from "@/lib/archsim"
import type { GespeichertesErgebnis } from "@/lib/architektur-leitstand-regeln"
import styles from "@/app/(architektur-leitstand)/architektur-leitstand.module.css"
import type { AbschlussAntwort } from "./api"
import LiveDiagramm from "./LiveDiagramm"
import Lastkurve from "./Lastkurve"
import { chf, ms, prozent, zahl, zustandBei } from "./logik"

const ART: Record<ZeitachsenArt, { symbol: string; text: string }> = {
  ereignis: { symbol: "⚡", text: "Ereignis" },
  aktion: { symbol: "◆", text: "deine Massnahme" },
  stoerung: { symbol: "■", text: "Störung" },
  erholung: { symbol: "●", text: "Erholung" },
  retrysturm: { symbol: "↻", text: "Retry-Sturm" },
  circuitbreaker: { symbol: "⊘", text: "Circuit Breaker" },
  verlust: { symbol: "✗", text: "Verluste" },
}

function useHochzaehlen(ziel: number): number {
  const [wert, setWert] = useState(0)
  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setWert(ziel)
      return
    }
    let frame = 0
    const start = performance.now()
    const schritt = (jetzt: number) => {
      const f = Math.min(1, (jetzt - start) / 1400)
      setWert(Math.round(ziel * (1 - Math.pow(1 - f, 3))))
      if (f < 1) frame = requestAnimationFrame(schritt)
    }
    frame = requestAnimationFrame(schritt)
    return () => cancelAnimationFrame(frame)
  }, [ziel])
  return wert
}

export default function Ergebnis({
  mission,
  zustand,
  seed,
  aktionen,
  modell,
  ergebnis,
  abschluss,
  speichern,
  onErneutSpeichern,
  onWiederholen,
  onNeu,
  naechste,
  wiederholung,
  beschaeftigt,
}: {
  mission: Mission
  /** Endzustand (vollständiger Verlauf) */
  zustand: Zustand
  seed: number
  aktionen: Aktion[]
  modell: ArchModell | undefined
  ergebnis: GespeichertesErgebnis
  abschluss: AbschlussAntwort | null
  speichern: "laeuft" | "fertig" | "fehler" | "nur-ansehen"
  onErneutSpeichern: () => void
  onWiederholen: () => void
  onNeu: () => void
  naechste: { id: string; titel: string; frei: boolean } | null
  wiederholung: boolean
  beschaeftigt: boolean
}) {
  const s = ergebnis.score
  const total = useHochzaehlen(s.total)
  const [zeiger, setZeiger] = useState<number | null>(null)
  const zeitreise = useMemo(() => {
    if (zeiger === null) return null
    try {
      // Zustand am Ende der gewählten Minute (Verlaufspunkt t = zeiger)
      return zustandBei(mission, seed, aktionen, modell, Math.min(mission.dauer, zeiger + 1))
    } catch {
      return null
    }
  }, [zeiger, mission, seed, aktionen, modell])
  const k = ergebnis.kennzahlen
  const nb = ergebnis.nachbesprechung

  return (
    <div className={styles.ergebnis}>
      <section className={`card ${styles.ergebnisKopf}`} aria-labelledby="al-ergebnis-titel">
        <p className="eyebrow">Mission beendet · {mission.firma}</p>
        <h2 id="al-ergebnis-titel">{mission.titel}</h2>
        <p className={styles.punkteGross} aria-label={`${s.total} von 1000 Punkten`}>
          <span aria-hidden="true">{total}</span>
          <small aria-hidden="true"> / 1000</small>
        </p>
        <p className={styles.sterneGross} aria-label={`${s.sterne} von 3 Sternen`}>
          {[1, 2, 3].map((n) => (
            <span key={n} aria-hidden="true" className={`${styles.stern} ${n <= s.sterne ? styles.sternAn : styles.sternAus}`} style={{ animationDelay: `${0.4 + n * 0.35}s` }}>
              ★
            </span>
          ))}
        </p>
        <div className={styles.abzeichenZeile}>
          {abschluss?.bestwertVerbessert && <span className={styles.plakat}>Neuer Bestwert!</span>}
          {abschluss && abschluss.punkte > 0 && <span className={styles.plakat}>+{abschluss.punkte} Punkte im Konto</span>}
          {abschluss?.neueAbzeichen.map((a) => (
            <span key={a.name} className={`${styles.plakat} ${styles.plakatAbzeichen}`}>
              {a.icon ? <span aria-hidden="true">{a.icon} </span> : null}Abzeichen «{a.name}»
            </span>
          ))}
          {wiederholung && <span className={styles.plakatGrau}>Wiederholung: zählt nicht für Bestwert und Punkte</span>}
        </div>
        <p className={styles.speicherStand} role="status">
          {speichern === "laeuft" && "Ergebnis wird gespeichert …"}
          {speichern === "fertig" && "✓ Ergebnis gespeichert"}
          {speichern === "nur-ansehen" && "Gespeicherter Lauf"}
        </p>
        {speichern === "fehler" && (
          <p className={styles.sperrGrund} role="alert">
            ■ Das Ergebnis konnte nicht gespeichert werden.{" "}
            <button type="button" className={`btn ${styles.klein}`} onClick={onErneutSpeichern}>
              Erneut speichern
            </button>
          </p>
        )}
        <p className={styles.zusammenfassung}>{nb.zusammenfassung}</p>
        <div className="row">
          <button type="button" className="btn primary" onClick={onWiederholen} disabled={beschaeftigt}>
            ↻ Nochmals mit gleichem Seed
          </button>
          <button type="button" className="btn" onClick={onNeu} disabled={beschaeftigt}>
            Neuer Lauf
          </button>
          <a className="btn" href="/architektur-leitstand">
            Zur Missionswahl
          </a>
        </div>
        {naechste && (
          <p className={styles.naechste}>
            {naechste.frei ? (
              <>
                <span aria-hidden="true">🔓 </span>Nächste Mission frei: <strong>{naechste.titel}</strong>
              </>
            ) : (
              <>
                <span aria-hidden="true">🔒 </span>«{naechste.titel}» wird mit einem Stern in dieser Mission frei.
              </>
            )}
          </p>
        )}
      </section>

      <section className={`card ${styles.teile}`} aria-labelledby="al-teile-titel">
        <h3 id="al-teile-titel" className={styles.h3}>
          Punkte je Teil
        </h3>
        <ul className={styles.teilListe}>
          {s.teile.map((t) => {
            const neg = t.max === 0
            const anteil = neg ? 0 : t.punkte / t.max
            return (
              <li key={t.id} className={styles.teil}>
                <div className={styles.teilKopf}>
                  <span>{t.name}</span>
                  <strong>
                    {neg ? (t.punkte < 0 ? `−${Math.abs(t.punkte)}` : "0") : `${t.punkte} / ${t.max}`}
                  </strong>
                </div>
                {!neg && (
                  <div className={styles.balken} role="img" aria-label={`${t.punkte} von ${t.max}`}>
                    <span className={`${styles.balkenFuellung} ${anteil >= 0.8 ? styles.bGut : anteil >= 0.5 ? styles.bKnapp : styles.bSchlecht}`} style={{ width: `${anteil * 100}%` }} />
                  </div>
                )}
                <p className="hint">{t.erklaerung}</p>
              </li>
            )
          })}
        </ul>
        <dl className={styles.gesamtWerte}>
          <div>
            <dt>Verfügbarkeit</dt>
            <dd>{prozent(k.verfuegbarkeit, 2)}</dd>
          </div>
          <div>
            <dt>p95 (Median / max)</dt>
            <dd>
              {ms(k.p95Median)} / {ms(k.p95Max)}
            </dd>
          </div>
          <div>
            <dt>Minuten im SLO</dt>
            <dd>{prozent(k.sloQuote, 0)}</dd>
          </div>
          <div>
            <dt>Kosten</dt>
            <dd>
              {chf(k.kosten)} von {chf(k.budget)}
            </dd>
          </div>
          <div>
            <dt>Kritische Vorgänge verloren</dt>
            <dd>
              {zahl(Math.round(k.kritischVerloren))} ({prozent(k.verlorenQuote, 2)})
            </dd>
          </div>
          <div>
            <dt>Rückstau am Ende</dt>
            <dd>{zahl(Math.round(k.rueckstauEnde))}</dd>
          </div>
        </dl>
      </section>

      <section className={`card ${styles.zeitreise}`} aria-labelledby="al-zeitreise-titel">
        <div className={styles.zeileZwischen}>
          <h3 id="al-zeitreise-titel" className={styles.h3}>
            Zeitreise: Ursache → Wirkung
          </h3>
          <label className={styles.regler}>
            <span>Minute {zeiger ?? "–"}</span>
            <input
              type="range"
              min={0}
              max={mission.dauer}
              value={zeiger ?? 0}
              onChange={(e) => setZeiger(Number(e.target.value))}
              aria-label="Minute für die Zeitreise"
            />
          </label>
        </div>
        <p className="hint">Wähle einen Eintrag der Zeitachse oder tippe in die Kurve: Das Diagramm zeigt den Zustand dieser Minute.</p>
        <Lastkurve mission={mission} zustand={zustand} zeiger={zeiger} onZeiger={setZeiger} />
        <div className={styles.zeitreiseRaster}>
          <ol className={styles.zeitachse}>
            {nb.zeitachse.map((e, i) => (
              <li key={i}>
                <button
                  type="button"
                  className={`${styles.zeitEintrag} ${styles[`za_${e.art}`]} ${zeiger === e.tick ? styles.zeitEintragAn : ""}`}
                  onClick={() => setZeiger(e.tick)}
                  aria-pressed={zeiger === e.tick}
                >
                  <span className={styles.zeitMinute}>{e.tick}′</span>
                  <span className={styles.zeitSymbol} aria-hidden="true">
                    {ART[e.art].symbol}
                  </span>
                  <span className={styles.zeitText}>
                    <strong>{e.titel}</strong>
                    <span className="sr-only"> ({ART[e.art].text})</span>
                    {e.ursache && <span className={styles.ursache}>Ursache: {e.ursache}</span>}
                    {e.wirkung && <span className={styles.wirkung}>→ {e.wirkung}</span>}
                  </span>
                </button>
              </li>
            ))}
          </ol>
          <div className={styles.zeitreiseDiagramm}>
            {zeitreise ? (
              <LiveDiagramm mission={mission} zustand={zeitreise} auswahl={null} ablauf={false} hoehe={360} beschriftung={`Zustand in Minute ${zeiger}`} />
            ) : (
              <p className={styles.panelLeer}>Wähle eine Minute, um die Architektur in diesem Moment zu sehen.</p>
            )}
          </div>
        </div>
      </section>

      <section className={styles.lehren} aria-labelledby="al-lehren-titel">
        <h3 id="al-lehren-titel" className={styles.h3}>
          Lehren
        </h3>
        {nb.lehren.length === 0 && <p className="hint">Keine besonderen Auffälligkeiten: Die Architektur hat die Last ohne grössere Störung getragen.</p>}
        <ul className={styles.lehrenListe}>
          {nb.lehren.map((l) => (
            <li key={l.id} className={`card ${styles.lehre} ${l.positiv ? styles.lehrePositiv : styles.lehreNegativ}`}>
              <p className={styles.lehreKopf}>
                <span aria-hidden="true">{l.positiv ? "✓" : "!"}</span> <strong>{l.titel}</strong>
              </p>
              <p>{l.text}</p>
              {!l.positiv && l.haetteGeholfen && (
                <p className={styles.haette}>
                  <strong>Hätte geholfen:</strong> {l.haetteGeholfen}
                </p>
              )}
              <a href={l.link} target="_blank" rel="noopener">
                Zur Lernstation<span className="sr-only"> (neuer Tab)</span> →
              </a>
            </li>
          ))}
        </ul>
      </section>

      <section className={`card ${styles.abschlussInfos}`}>
        <div>
          <h3 className={styles.h3}>Lernziele</h3>
          <ul className={styles.lernzielListe}>
            {mission.lernziele.map((l, i) => (
              <li key={i}>
                <a href={stationsLink(l.station, l.abschnitt)} target="_blank" rel="noopener">
                  {l.text}
                </a>
              </li>
            ))}
          </ul>
        </div>
        {ergebnis.validierung && (
          <div>
            <h3 className={styles.h3}>Dein Modell</h3>
            <ul className={styles.checkliste}>
              {ergebnis.validierung.anforderungen.map((a) => (
                <li key={a.id} className={a.erfuellt ? styles.checkOk : styles.checkOffen}>
                  <span className={styles.checkSymbol} aria-hidden="true">
                    {a.erfuellt ? "✓" : "✗"}
                  </span>
                  <span>
                    <span className="sr-only">{a.erfuellt ? "erfüllt: " : "nicht erfüllt: "}</span>
                    {a.text}
                    {!a.erfuellt && <span className={styles.checkHinweis}>{a.rueckmeldung}</span>}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
        <details className={styles.muster}>
          <summary>So geht es auch: Musterstrategie</summary>
          <p>{mission.musterstrategie}</p>
        </details>
      </section>
    </div>
  )
}
