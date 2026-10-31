// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

"use client"

// components/features/leitstand/BudgetAnsicht.tsx
// Budget (4.8): Kurven PV/EV/AC, Earned-Value-Tabelle, Kosten nach Kostenart, Stundenarten, Reviews und Korrekturzeit.

import {
  COST_CATEGORIES,
  HOUR_CATEGORIES,
  type CostCategory,
  type HourCategory,
  type KpiSnapshot,
  type Scenario,
  type ScheduleRow,
  type SimState,
} from "@/lib/simulation"
import styles from "@/app/(leitstand)/leitstand.module.css"
import { useLeitstand } from "./context"
import { chf, stunden } from "./format"
import KurvenDiagramm, { type Marke, type Reihe } from "./charts/KurvenDiagramm"
import { pvAt } from "./logic"

const COST_TEXT: Record<CostCategory, string> = {
  arbeit: "Arbeit",
  ueberzeit: "Überzeitzuschlag",
  fuehrung: "Termine (Führung)",
  anlass: "Anlässe",
  weiterbildung: "Weiterbildung",
  risiko: "Risikomassnahmen",
  ereignis: "Ereignisse",
}

const HOUR_TEXT: Record<HourCategory, string> = {
  arbeit: "Arbeit",
  ueberzeit: "Überstunden",
  review: "Reviews",
  korrektur_frueh: "Korrektur früh (Review)",
  korrektur_spaet: "Korrektur spät (Test)",
  weiterbildung: "Weiterbildung",
  fuehrung: "Termine",
}

/** Kurven PV (ganzer Basisplan), EV und AC (bis heute) in Tagen; Reihenfarben und Linienarten nach 4.8. */
export function evCurves(state: SimState, scenario: Scenario, base: Record<string, ScheduleRow>, kpis: KpiSnapshot) {
  const xMax = Math.max(scenario.calendar.targetDay, Math.ceil(kpis.forecastEndDay), Math.ceil(state.tick / 2))
  const pv: Array<[number, number]> = []
  for (let d = 0; d <= xMax; d += 0.5) pv.push([d, pvAt(state, base, d)])
  const ev: Array<[number, number]> = [[0, 0]]
  const ac: Array<[number, number]> = [[0, 0]]
  for (const p of state.history) {
    const tau = (p.tick + 1) / 2
    ev.push([tau, p.ev])
    ac.push([tau, p.ac])
  }
  const reihen: Reihe[] = [
    { key: "pv", label: "PV", color: "var(--s1)", dash: "voll", points: pv },
    { key: "ev", label: "EV", color: "var(--s3)", dash: "punkt", points: ev },
    { key: "ac", label: "AC", color: "var(--s2)", dash: "strich", points: ac },
  ]
  const marken: Marke[] = [
    { axis: "y", value: kpis.budget, label: `Budget ${Math.round(kpis.budget / 1000)}k` },
    { axis: "x", value: state.tick / 2, label: "heute" },
  ]
  return { reihen, marken, xMax }
}

export default function BudgetAnsicht() {
  const { state, scenario, kpis, base } = useLeitstand()
  const curves = evCurves(state, scenario, base, kpis)
  const tableX = Array.from({ length: Math.floor(curves.xMax / 5) + 1 }, (_, i) => i * 5)
  const rows: Array<[string, string, string]> = [
    ["PV", "Geplanter Wert (Plankosten der geplanten Arbeit bis heute)", chf(kpis.pv)],
    ["EV", "Fertigstellungswert (Plankosten der erledigten Arbeit)", chf(kpis.ev)],
    ["AC", "Ist-Kosten", chf(kpis.ac)],
    ["SV", "Terminabweichung EV − PV", chf(kpis.sv)],
    ["CV", "Kostenabweichung EV − AC", chf(kpis.cv)],
    ["SPI", "EV ÷ PV", kpis.spi.toFixed(2)],
    ["CPI", "EV ÷ AC", kpis.cpi.toFixed(2)],
    ["EAC", "Prognose Gesamtkosten BAC ÷ CPI", chf(kpis.eac)],
    ["ETC", "Restkosten EAC − AC", chf(kpis.etc)],
    ["VAC", "Abweichung am Ende BAC − EAC", chf(kpis.vac)],
    ["BAC", "Plankosten gesamt", chf(kpis.bac)],
    ["Budget", "Kredit inkl. genehmigter Nachträge", chf(kpis.budget)],
  ]
  const costTotal = Math.max(1, COST_CATEGORIES.reduce((s, c) => s + kpis.costByCategory[c], 0))

  return (
    <div className={styles.ansicht}>
      <div className="card stack">
        <h3>Earned Value</h3>
        <KurvenDiagramm
          title="Earned Value: PV, EV und AC über die Zeit"
          desc={`PV als durchgezogene, EV als gepunktete und AC als gestrichelte Linie. Heute: PV ${chf(kpis.pv)}, EV ${chf(kpis.ev)}, AC ${chf(kpis.ac)}, Budget ${chf(kpis.budget)}.`}
          reihen={curves.reihen}
          xMax={curves.xMax}
          xLabel={(x) => `Tag ${x}`}
          yLabel={(y) => (y >= 1000 ? `${Math.round(y / 1000)}k` : String(Math.round(y)))}
          marken={curves.marken}
          tableX={tableX}
          height={260}
        />
        <p className="hint">
          Durch Korrekturzeit kann der EV eines Vorgangs sinken: Der Fertigstellungsgrad wird neu eingeschätzt.
        </p>
      </div>
      <div className={styles.raster2}>
        <div className="card stack">
          <h3>Kennzahlen</h3>
          <div className="tablebox">
            <table className={`tabelle ${styles.kartenTabelle}`}>
              <tbody>
                {rows.map(([k, text, v]) => (
                  <tr key={k}>
                    <th scope="row">{k}</th>
                    <td className="hint">{text}</td>
                    <td className="zahl">{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="card stack">
          <h3>Kosten nach Kostenart</h3>
          <ul className={styles.balkenListe}>
            {COST_CATEGORIES.map((c) => (
              <li key={c}>
                <span>{COST_TEXT[c]}</span>
                <span className={styles.balkenSpur} aria-hidden="true">
                  <span style={{ width: `${(kpis.costByCategory[c] / costTotal) * 100}%` }} />
                </span>
                <span className={styles.balkenZahl}>{chf(kpis.costByCategory[c])}</span>
              </li>
            ))}
          </ul>
          <h3>Stundenarten</h3>
          <ul className={styles.balkenListe}>
            {HOUR_CATEGORIES.map((c) => (
              <li key={c}>
                <span>{HOUR_TEXT[c]}</span>
                <span className={styles.balkenZahl}>{stunden(kpis.hours[c])}</span>
              </li>
            ))}
          </ul>
          <h3>Reviews und Korrekturzeit</h3>
          <p>
            {kpis.reviews.count} Reviews · Fehler früh gefunden {kpis.reviews.foundEarly.toFixed(1)} ({stunden(kpis.reviews.fixHoursEarly)}) · spät
            im Test {kpis.reviews.foundLate.toFixed(1)} ({stunden(kpis.reviews.fixHoursLate)})
          </p>
          <p className="hint">Ein Fehler kostet früh 1 h, spät im Test 3 h, und die späte Korrektur trifft den kritischen Pfad.</p>
        </div>
      </div>
    </div>
  )
}
