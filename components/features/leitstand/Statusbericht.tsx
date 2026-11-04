// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

"use client"

// components/features/leitstand/Statusbericht.tsx
// Statusbericht und Abschlussbericht (3.11): Ampeln, Fertigstellungsgrad, Prognosen, Abweichungen,
// Massnahmen M1–M8, Budgetnachtrag und Änderungsanträge; aktuelle Zahlen daneben sichtbar.
// Danach die Antwort des Gremiums (nur Statusbericht; Name je Szenario, K2 in 2.11.13).

import { useState } from "react"
import { REPORT_FORECAST_DAY_MAX } from "@/lib/simulation/types"
import { boardNameOf, isChangeRequestAvailable, type Ampel as AmpelWert, type ReportArea, type ReportRecord, type StatusReportInput } from "@/lib/simulation/core"
import { statusReportInputSchema } from "@/lib/validations/simulation"
import styles from "@/app/(leitstand)/leitstand.module.css"
import { useLeitstand } from "./context"
import { AMPEL_FORM, AMPEL_TEXT, chf, pct } from "./format"
import { Ampel } from "./Kennzahlen"

const AREAS: Array<[ReportArea | "gesamt", string]> = [
  ["gesamt", "Gesamt"],
  ["termine", "Termine"],
  ["kosten", "Kosten"],
  ["qualitaet", "Qualität"],
  ["team", "Team"],
  ["risiken", "Risiken"],
]
const AMPELN: AmpelWert[] = ["gruen", "gelb", "rot"]

export default function Statusbericht() {
  const { state, scenario, kpis, run, readOnly } = useLeitstand()
  const writable = !readOnly && (state.phase === "periodenende" || state.phase === "abschlussbericht")
  const kind = state.phase === "periodenende" ? "status" : "final"
  const [ampeln, setAmpeln] = useState<Partial<Record<ReportArea | "gesamt", AmpelWert>>>({})
  const [progress, setProgress] = useState("")
  const [endDay, setEndDay] = useState("")
  const [cost, setCost] = useState("")
  const [deviations, setDeviations] = useState("")
  const [measures, setMeasures] = useState<string[]>([])
  const [measuresText, setMeasuresText] = useState("")
  const [supplement, setSupplement] = useState("0")
  const [crs, setCrs] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const pendingNew = state.inbox.some((i) => i.status === "neu")
  const availableCrs = scenario.changeRequests.filter((c) => isChangeRequestAvailable(state, scenario, c.id))

  if (!writable) {
    return <BerichtArchiv />
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const missing = AREAS.filter(([k]) => !ampeln[k]).map(([, l]) => l)
    if (missing.length > 0) {
      setError(`Bitte für jeden Bereich eine Ampel wählen: ${missing.join(", ")}.`)
      return
    }
    const input: StatusReportInput = {
      ampeln: ampeln as Record<ReportArea | "gesamt", AmpelWert>,
      progressPercent: Number(progress),
      forecastEndDay: Number(endDay),
      forecastCostChf: Number(cost),
      deviations: deviations.trim(),
      measures,
      measuresText: measuresText.trim(),
      budgetSupplementChf: kind === "status" ? Number(supplement || 0) : 0,
      changeRequestIds: kind === "status" ? crs : [],
    }
    const parsed = statusReportInputSchema.safeParse(input)
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Bitte die Angaben prüfen.")
      return
    }
    run({ type: "submitReport", report: parsed.data })
  }

  const toggle = (list: string[], id: string, on: boolean) => (on ? [...list, id] : list.filter((x) => x !== id))

  return (
    <div className={`${styles.ansicht} ${styles.berichtRaster}`}>
      <form className="card stack" onSubmit={submit} noValidate aria-labelledby="bericht-titel">
        <p className="eyebrow">{kind === "status" ? "Periodenende" : "Projektende"}</p>
        <h3 id="bericht-titel">{kind === "status" ? `Statusbericht an den ${boardNameOf(scenario)}` : "Abschlussbericht"}</h3>
        <p className="hint">
          Melde ehrlich. Der Leitstand vergleicht deine Angaben mit den gemessenen Zahlen. Schönfärberei kostet Vertrauen und Punkte.
        </p>
        {pendingNew && <p className={styles.warnText}>▲ Zuerst die neuen Ereignisse im Posteingang entscheiden.</p>}

        <fieldset className={styles.feldgruppe}>
          <legend>Ampeln</legend>
          {AREAS.map(([key, label]) => (
            <div key={key} className={styles.ampelWahl} role="radiogroup" aria-label={`Ampel ${label}`}>
              <span className={styles.ampelWahlLabel}>{label}</span>
              {AMPELN.map((a) => (
                <label key={a} className={`${styles.ampelOption} ${ampeln[key] === a ? styles[`ampel_${a}`] : ""}`}>
                  <input type="radio" name={`ampel-${key}`} checked={ampeln[key] === a} onChange={() => setAmpeln((x) => ({ ...x, [key]: a }))} />
                  <span aria-hidden="true">{AMPEL_FORM[a]}</span> {AMPEL_TEXT[a]}
                </label>
              ))}
            </div>
          ))}
        </fieldset>

        <div className={styles.formRaster}>
          <label className={styles.feld}>
            <span>Fertigstellungsgrad in %</span>
            <input className={styles.eingabe} type="number" inputMode="decimal" min={0} max={100} required value={progress} onChange={(e) => setProgress(e.target.value)} />
          </label>
          <label className={styles.feld}>
            <span>Prognose Endtag</span>
            <input className={styles.eingabe} type="number" inputMode="decimal" min={1} max={REPORT_FORECAST_DAY_MAX} step={0.5} required value={endDay} onChange={(e) => setEndDay(e.target.value)} />
          </label>
          <label className={styles.feld}>
            <span>Prognose Endkosten CHF</span>
            <input className={styles.eingabe} type="number" inputMode="numeric" min={0} max={1000000} step={100} required value={cost} onChange={(e) => setCost(e.target.value)} />
          </label>
        </div>

        <label className={styles.feld}>
          <span>Abweichungen und Begründung ({deviations.length} / 1000)</span>
          <textarea className={styles.eingabe} rows={4} maxLength={1000} value={deviations} onChange={(e) => setDeviations(e.target.value)} />
        </label>

        <fieldset className={styles.feldgruppe}>
          <legend>Massnahmen</legend>
          <div className={styles.checkRaster}>
            {scenario.reportMeasures.map((m) => (
              <label key={m.id} className="row">
                <input type="checkbox" checked={measures.includes(m.id)} onChange={(e) => setMeasures((x) => toggle(x, m.id, e.target.checked))} /> {m.id}{" "}
                {m.label}
              </label>
            ))}
          </div>
          <label className={styles.feld}>
            <span>Weitere Massnahmen ({measuresText.length} / 500)</span>
            <textarea className={styles.eingabe} rows={2} maxLength={500} value={measuresText} onChange={(e) => setMeasuresText(e.target.value)} />
          </label>
        </fieldset>

        {kind === "status" && (
          <fieldset className={styles.feldgruppe}>
            <legend>Anträge an den {boardNameOf(scenario)}</legend>
            <label className={styles.feld}>
              <span>Budgetnachtrag CHF</span>
              <input className={styles.eingabe} type="number" inputMode="numeric" min={0} max={100000} step={1000} value={supplement} onChange={(e) => setSupplement(e.target.value)} />
            </label>
            {availableCrs.length === 0 ? (
              <p className="hint">Zurzeit ist kein Änderungsantrag möglich.</p>
            ) : (
              availableCrs.map((c) => (
                <label key={c.id} className={styles.antrag}>
                  <input type="checkbox" checked={crs.includes(c.id)} onChange={(e) => setCrs((x) => toggle(x, c.id, e.target.checked))} />
                  <span>
                    <strong>
                      {c.id} {c.label}
                    </strong>
                    <span className="hint"> {c.description}</span>
                  </span>
                </label>
              ))
            )}
          </fieldset>
        )}

        {error && (
          <p className={styles.fehlerText} role="alert">
            ■ {error}
          </p>
        )}
        <div className="row">
          <button type="submit" className="btn primary" disabled={pendingNew}>
            {kind === "status" ? "Bericht einreichen" : "Abschlussbericht einreichen"}
          </button>
        </div>
      </form>

      <aside className="card stack" aria-label="Aktuelle Zahlen">
        <h3>Aktuelle Zahlen</h3>
        <dl className={styles.zahlenListe}>
          <dt>Fertigstellungsgrad (EV ÷ BAC)</dt>
          <dd>{pct((kpis.ev / Math.max(1, kpis.bac)) * 100)}</dd>
          <dt>Prognose Endtag</dt>
          <dd>Tag {kpis.forecastEndDay.toFixed(1)} (Ziel {scenario.calendar.targetDay})</dd>
          <dt>EAC</dt>
          <dd>
            {chf(kpis.eac)} (Budget {chf(kpis.budget)})
          </dd>
          <dt>SPI · CPI</dt>
          <dd>
            {kpis.spi.toFixed(2)} · {kpis.cpi.toFixed(2)}
          </dd>
          <dt>Qualität · Team · Risiko</dt>
          <dd>
            {pct(kpis.qi)} · {pct(kpis.teamMotivation)} · {pct(kpis.rmi)}
          </dd>
        </dl>
        <h4 className={styles.h4}>Ampeln im Leitstand</h4>
        <ul className={styles.liste}>
          {AREAS.map(([key, label]) => (
            <li key={key}>
              {label}: <Ampel wert={kpis.ampeln[key]} />
            </li>
          ))}
        </ul>
        <p className="hint">Massnahmen passen zu Bereichen: Termine M1 M2 M3 M7 M8 · Kosten M3 M7 · Qualität M4 · Team M6 · Risiken M5.</p>
      </aside>
    </div>
  )
}

/** Eingereichte Berichte mit Abgleich und Antwort des Gremiums. */
export function BerichtArchiv() {
  const { state, scenario } = useLeitstand()
  if (state.reports.length === 0) {
    const period = scenario.calendar.periods[state.period]
    return (
      <div className={styles.ansicht}>
        <div className="card stack">
          <h3>Bericht</h3>
          <p className="hint">
            Der {period?.report === "status" ? "Statusbericht" : "Abschlussbericht"} ist am Ende von «{period?.label}» fällig.
          </p>
        </div>
      </div>
    )
  }
  return (
    <div className={styles.ansicht}>
      {state.reports.map((r, i) => (
        <div key={i} className="card stack">
          <h3>
            {r.kind === "status" ? "Statusbericht" : "Abschlussbericht"} · Ehrlichkeit {Math.round(r.honesty)}
          </h3>
          <AbgleichTabelle reported={r.input.ampeln} truth={r.truth.ampeln} />
          {r.findings.length > 0 && (
            <ul className={styles.liste}>
              {r.findings.map((f, k) => (
                <li key={k}>{f}</li>
              ))}
            </ul>
          )}
          {r.board && <GremiumAntwort board={r.board} boardName={boardNameOf(scenario)} />}
        </div>
      ))}
    </div>
  )
}

export function AbgleichTabelle({
  reported,
  truth,
}: {
  reported: Record<ReportArea | "gesamt", AmpelWert>
  truth: Record<ReportArea | "gesamt", AmpelWert>
}) {
  return (
    <div className="tablebox">
      <table className="tabelle">
        <caption>Gemeldet und gemessen</caption>
        <thead>
          <tr>
            <th scope="col">Bereich</th>
            <th scope="col">Gemeldet</th>
            <th scope="col">Gemessen</th>
          </tr>
        </thead>
        <tbody>
          {AREAS.map(([k, label]) => (
            <tr key={k}>
              <th scope="row">{label}</th>
              <td>
                <Ampel wert={reported[k]} />
              </td>
              <td>
                <Ampel wert={truth[k]} />
                {reported[k] !== truth[k] ? <span className="hint"> · weicht ab</span> : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Entscheid des Gremiums; boardName aus boardNameOf(scenario), z. B. «Gemeinderat» oder «Regierungsrat». */
export function GremiumAntwort({ board, boardName }: { board: NonNullable<ReportRecord["board"]>; boardName: string }) {
  return (
    <div className={`note ${styles.gemeinderat}`}>
      <p>
        <b>Entscheid des {boardName}s</b>
      </p>
      <ul className={styles.liste}>
        <li>
          Phasenfreigabe:{" "}
          {board.phaseRelease === "erteilt" ? "● erteilt" : board.phaseRelease === "mitAuflage" ? "▲ erteilt mit Auflage (wöchentlicher Zusatzbericht)" : "–"}
        </li>
        <li>Budgetnachtrag genehmigt: {chf(board.budgetApprovedChf)}</li>
        {Object.entries(board.changeRequests).map(([id, v]) => (
          <li key={id}>
            {id}: {v === "genehmigt" ? "● genehmigt" : "■ abgelehnt"}
          </li>
        ))}
      </ul>
      {board.reasons.map((r, i) => (
        <p key={i} className="hint">
          {r}
        </p>
      ))}
    </div>
  )
}
