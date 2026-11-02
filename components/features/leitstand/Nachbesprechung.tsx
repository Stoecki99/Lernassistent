// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

"use client"

// components/features/leitstand/Nachbesprechung.tsx
// Nachbesprechung (3.14): Punkte je Teil, Sterne, Abzeichen, Zeitstrahl mit Wendepunkten, Lessons Learned,
// Gegenüberstellung der Berichte, Kurven und Links auf die Stationen.

import { useEffect, useState } from "react"
import { debrief, formatTick } from "@/lib/simulation/core"
import styles from "@/app/(leitstand)/leitstand.module.css"
import { useLeitstand } from "./context"
import { ACHIEVEMENTS, chf, stationHref, stationNumber, stationTitle } from "./format"
import { AbgleichTabelle } from "./Statusbericht"
import KurvenDiagramm from "./charts/KurvenDiagramm"
import { evCurves } from "./BudgetAnsicht"
import type { FinishResponse } from "./api"
import Avatar from "./Avatar"
import Icon, { type IconName } from "./Icon"
import { MotivationBalken } from "./Team"

const PARTS: Array<{ key: "termin" | "kosten" | "qualitaet" | "stakeholder" | "team" | "fuehrung"; label: string; max: number; text: string }> = [
  { key: "termin", label: "Termin", max: 250, text: "" }, // Text hängt vom Terminziel ab, siehe terminText
  { key: "kosten", label: "Kosten", max: 200, text: "Ist-Kosten gegen Budget (Nachträge zählen halb)." },
  { key: "qualitaet", label: "Qualität", max: 200, text: "Restmängel bei der Abnahme; 5 oder weniger gibt volle Punkte." },
  { key: "stakeholder", label: "Stakeholder", max: 150, text: "Zufriedenheit am Ende." },
  { key: "team", label: "Team", max: 100, text: "Mittlere Teammotivation über den ganzen Lauf." },
  { key: "fuehrung", label: "Führung", max: 100, text: "Ehrlichkeit der Berichte, Risiko-Index und Qualität der Entscheide." },
]

/** Termin-Erklärung je Szenario (3.13): volle Punkte bis Ziel − 2 (Einführungslauf Ziel − 0.5) */
function terminText(targetDay: number, intro: boolean): string {
  return `Ende bis Tag ${intro ? targetDay - 0.5 : targetDay - 2} volle Punkte, danach Abzug je Tag.`
}

const KIND_ICON: Record<string, IconName> = {
  ereignis: "mail",
  entscheid: "fertig",
  standard: "uhr",
  risiko: "risiko",
  meilenstein: "meilenstein",
  bericht: "bericht",
  gemeinderat: "stakeholder",
  vorgang: "vorgaenge",
}

function useCountUp(target: number): number {
  const [value, setValue] = useState(0)
  useEffect(() => {
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    if (reduce) {
      setValue(target)
      return
    }
    let frame = 0
    const start = performance.now()
    const step = (now: number) => {
      const f = Math.min(1, (now - start) / 1200)
      setValue(Math.round(target * (1 - Math.pow(1 - f, 3))))
      if (f < 1) frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [target])
  return value
}

export default function Nachbesprechung({
  finish,
  finishError,
  best,
}: {
  finish: FinishResponse | null
  finishError: string | null
  best: number | null
}) {
  const { state, scenario, kpis, base } = useLeitstand()
  const d = debrief(state, scenario)
  const result = finish?.result ?? d.result
  const total = useCountUp(result?.score.total ?? 0)
  if (!result) return null
  const curves = evCurves(state, scenario, base, kpis)
  const isIntro = scenario.kind === "intro"

  return (
    <div className={styles.ansicht}>
      <div className={`card ${styles.ergebnis}`}>
        <div className={styles.ergebnisKopf}>
          <p className="eyebrow">{result.ended === "fertig" ? "Projekt abgeschlossen" : `Projekt abgebrochen (Tag ${scenario.calendar.hardStopTick / 2})`}</p>
          <h2>Nachbesprechung</h2>
          <p className={styles.punkte} aria-label={`${result.score.total} von 1000 Punkten`}>
            <span aria-hidden="true">{total}</span>
            <small aria-hidden="true"> / 1000 Punkte</small>
          </p>
          <p className={styles.sterne} aria-label={`${result.stars} von 3 Sternen`}>
            {[1, 2, 3].map((n) => (
              <span key={n} aria-hidden="true" className={n <= result.stars ? styles.sternAn : styles.sternAus}>
                ★
              </span>
            ))}
          </p>
          <p className="hint">
            Ende {result.ended === "fertig" ? `Tag ${result.endDay}` : "nicht erreicht"} · Restmängel {result.restmaengel.toFixed(1)} · Kosten {chf(kpis.ac)} von{" "}
            {chf(kpis.budget)}
            {best !== null && !isIntro ? ` · Bestwert bisher ${best}` : ""}
          </p>
          {finish?.improvedBest && <p className={styles.okText}>● Neuer Bestwert!</p>}
          {finish && finish.pointsAwarded > 0 && <p className={styles.okText}>+{finish.pointsAwarded} Punkte in deinem Konto.</p>}
          {isIntro && <p className="hint">Der Einführungslauf zählt nicht für den Bestwert. Bereit für den Ernstfall?</p>}
          {finishError && (
            <p className={styles.fehlerText} role="alert">
              ■ {finishError}
            </p>
          )}
        </div>
        <ul className={styles.teilPunkte}>
          {PARTS.map((p) => (
            <li key={p.key}>
              <div className={styles.zeileZwischen}>
                <strong>{p.label}</strong>
                <span>
                  {result.score[p.key]} / {p.max}
                </span>
              </div>
              <div
                className={styles.fortschritt}
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={p.max}
                aria-valuenow={result.score[p.key]}
                aria-label={`${p.label}: ${result.score[p.key]} von ${p.max}`}
              >
                <span style={{ width: `${(result.score[p.key] / p.max) * 100}%` }} />
              </div>
              <p className="hint">{p.key === "termin" ? terminText(scenario.calendar.targetDay, isIntro) : p.text}</p>
            </li>
          ))}
        </ul>
      </div>

      <div className="card stack">
        <h3>Abzeichen</h3>
        {result.achievements.length === 0 ? (
          <p className="hint">In diesem Lauf kein Abzeichen. Die Lessons Learned zeigen, wo Punkte liegen.</p>
        ) : (
          <ul className={styles.abzeichen}>
            {result.achievements.map((a) => {
              const info = ACHIEVEMENTS[a]
              return (
                <li key={a} className={styles.abzeichenKarte}>
                  <span className={styles.abzeichenIcon} aria-hidden="true">
                    {info?.icon ?? "🏅"}
                  </span>
                  <strong>{info?.name ?? a}</strong>
                  <span className="hint">{info?.text}</span>
                </li>
              )
            })}
          </ul>
        )}
        {finish && finish.newBadges.length > 0 && (
          <p className={styles.okText}>Neu im Konto: {finish.newBadges.map((b) => `${b.icon ?? ""} ${b.name}`.trim()).join(", ")}</p>
        )}
      </div>

      <TeamAmEnde />

      <div className="card stack">
        <h3>Zeitstrahl: Wendepunkte</h3>
        <ol className={styles.zeitstrahl}>
          {d.turningPoints.map((t, i) => (
            <li key={i} className={styles.zeitpunkt}>
              <span className={styles.zeitIcon}>
                <Icon name={KIND_ICON[t.kind] ?? "phase"} size={16} />
              </span>
              <span className={styles.zeitTag}>{formatTick(t.tick)}</span>
              <span>{t.text}</span>
            </li>
          ))}
          {d.turningPoints.length === 0 && <li className="hint">Keine grossen Wendepunkte, ein ruhiger Lauf.</li>}
        </ol>
      </div>

      <div className="card stack">
        <h3>Lessons Learned</h3>
        <ul className={styles.lessons}>
          {d.lessons.map((l) => (
            <li key={l.id} className={l.positive ? styles.lessonGut : styles.lessonLern}>
              <p>
                <span aria-hidden="true">{l.positive ? "● " : "▲ "}</span>
                <strong>{l.text}</strong>
                {!l.positive && l.lostPoints > 0 && <span className="hint"> · rund {Math.round(l.lostPoints)} Punkte entgangen</span>}
              </p>
              <p className="row">
                {l.icb.map((i) => (
                  <span key={i} className={styles.icb}>
                    ICB {i}
                  </span>
                ))}
                {l.stations.map((s) => (
                  <a key={s} className={`btn ${styles.klein}`} href={stationHref(s)} target="_blank" rel="noopener">
                    Station {stationNumber(s)}: {stationTitle(s)}
                    <span className="sr-only"> (neuer Tab)</span>
                  </a>
                ))}
              </p>
            </li>
          ))}
          {d.lessons.length === 0 && <li className="hint">Keine Auffälligkeiten.</li>}
        </ul>
      </div>

      {d.reports.length > 0 && (
        <div className="card stack">
          <h3>Berichte: gemeldet und gemessen</h3>
          {d.reports.map((r, i) => (
            <div key={i} className="stack">
              <h4 className={styles.h4}>
                {r.kind === "status" ? "Statusbericht" : "Abschlussbericht"} · Ehrlichkeit {Math.round(r.honesty)}
                {r.honesty < 70 ? " · ▲ Schönfärberei" : r.honesty >= 85 ? " · ● Klartext" : ""}
              </h4>
              <AbgleichTabelle reported={r.reported.ampeln} truth={r.truth.ampeln} />
              <p className="hint">
                Gemeldet: {r.reported.progressPercent} % fertig, Ende Tag {r.reported.forecastEndDay}, Kosten {chf(r.reported.forecastCostChf)} · Gemessen:{" "}
                {Math.round(r.truth.progress)} %, Tag {r.truth.forecastEndDay.toFixed(1)}, {chf(r.truth.eac)}
              </p>
              {r.reported.deviations && <blockquote className={styles.zitat}>{r.reported.deviations}</blockquote>}
            </div>
          ))}
        </div>
      )}

      <div className="card stack">
        <h3>Verlauf</h3>
        <KurvenDiagramm
          title="Earned Value über den ganzen Lauf"
          desc={`PV, EV und AC. Am Ende EV ${chf(kpis.ev)}, AC ${chf(kpis.ac)}.`}
          reihen={curves.reihen}
          xMax={curves.xMax}
          xLabel={(x) => `Tag ${x}`}
          yLabel={(y) => `${Math.round(y / 1000)}k`}
          marken={curves.marken.filter((m) => m.axis === "y")}
          tableX={Array.from({ length: Math.floor(curves.xMax / 5) + 1 }, (_, i) => i * 5)}
        />
        <KurvenDiagramm
          title="Kennzahlen über die Zeit"
          desc="SPI, CPI in Prozent, Qualitätsindex und Teammotivation je Takt."
          reihen={[
            { key: "spi", label: "SPI", color: "var(--s1)", dash: "voll", points: state.history.map((p) => [(p.tick + 1) / 2, p.spi * 100]) },
            { key: "cpi", label: "CPI", color: "var(--s2)", dash: "strich", points: state.history.map((p) => [(p.tick + 1) / 2, p.cpi * 100]) },
            { key: "qi", label: "QI", color: "var(--s3)", dash: "punkt", points: state.history.map((p) => [(p.tick + 1) / 2, p.qi]) },
            { key: "mot", label: "Motivation", color: "var(--s4)", dash: "voll", points: state.history.map((p) => [(p.tick + 1) / 2, p.motivation]) },
          ]}
          xMax={curves.xMax}
          yMin={40}
          yMax={120}
          xLabel={(x) => `Tag ${x}`}
          yLabel={(y) => `${Math.round(y)} %`}
          marken={[{ axis: "y", value: 100, label: "Plan 100 %" }]}
          tableX={Array.from({ length: Math.floor(curves.xMax / 5) + 1 }, (_, i) => i * 5)}
        />
      </div>

      <div className="card stack">
        <h3>Weiter im Lernpfad</h3>
        <p>Halte deine wichtigsten Erkenntnisse fest. Die Reflexionsfragen stehen in Station 23.</p>
        <div className="row">
          <a className="btn primary" href={stationHref("23-leitstand")}>
            Station 23 öffnen
          </a>
          <a className="btn" href="/leitstand">
            Zur Startseite des Leitstands
          </a>
        </div>
      </div>
    </div>
  )
}

/** Team-Übersicht am Ende: Bild, Rolle, Motivation (Balken mit Zahl) und geleistete Projektstunden. */
function TeamAmEnde() {
  const { scenario, state } = useLeitstand()
  const people = scenario.people.filter((p) => state.people[p.id]?.available || Object.values(state.tasks).some((t) => (t.hoursByPerson[p.id] ?? 0) > 0))
  const hoursOf = (pid: string) => Object.values(state.tasks).reduce((sum, t) => sum + (t.hoursByPerson[pid] ?? 0), 0)
  return (
    <section className="card stack" aria-labelledby="team-ende">
      <h3 id="team-ende" className={styles.titelMitSymbol}>
        <Icon name="team" size={18} /> Dein Team am Ende
      </h3>
      <ul className={styles.teamEnde}>
        {people.map((p) => (
          <li key={p.id}>
            <Avatar name={p.name} role={p.role} size={52} accessory={false} />
            <span className={styles.teamEndeText}>
              <strong>{p.name}</strong>
              <span className="hint">{p.role}</span>
              <MotivationBalken value={state.people[p.id].motivation} klein />
              <span className={styles.kleinZahl}>{Math.round(hoursOf(p.id))} h im Projekt</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
