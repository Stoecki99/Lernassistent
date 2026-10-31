// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

"use client"

// components/features/leitstand/Kennzahlen.tsx
// Kennzahl-Kacheln (4.8): Wert, Ampel mit Form und Wort, Trendpfeil, Kleinkurve, Kurzhilfe.
// 100 % entspricht dem Plan, mehr ist besser (1.5 «Kennzahl über 100 %»).

import { useState } from "react"
import type { Ampel as AmpelWert, KpiPoint } from "@/lib/simulation"
import styles from "@/app/(leitstand)/leitstand.module.css"
import { useLeitstand } from "./context"
import { AMPEL_FORM, AMPEL_TEXT } from "./format"
import Verlauf from "./charts/Verlauf"

export function Ampel({ wert, kurz = false }: { wert: AmpelWert; kurz?: boolean }) {
  return (
    <span className={`${styles.ampel} ${styles[`ampel_${wert}`]}`}>
      <span aria-hidden="true">{AMPEL_FORM[wert]}</span>
      <span className={kurz ? "sr-only" : undefined}>{AMPEL_TEXT[wert]}</span>
    </span>
  )
}

/** Stakeholder haben in 3.10 keine Ampel; die Oberfläche nutzt die Schwellen der Motivation (≥ 95 / ≥ 85). */
function siAmpel(siPercent: number): AmpelWert {
  return siPercent >= 95 ? "gruen" : siPercent >= 85 ? "gelb" : "rot"
}

interface Kachel {
  key: string
  label: string
  value: number
  ampel: AmpelWert
  series: number[]
  help: string
  detail: string
}

function trend(series: number[]): { symbol: string; text: string } {
  if (series.length < 3) return { symbol: "→", text: "gleich" }
  const now = series[series.length - 1]
  const before = series[Math.max(0, series.length - 3)]
  const d = now - before
  if (d > 0.5) return { symbol: "↗", text: "steigt" }
  if (d < -0.5) return { symbol: "↘", text: "sinkt" }
  return { symbol: "→", text: "gleich" }
}

export default function Kennzahlen() {
  const { kpis, state, scenario } = useLeitstand()
  const [help, setHelp] = useState<string | null>(null)
  const h = state.history
  const pick = (f: (p: KpiPoint) => number) => h.map(f)
  const siStart = scenario.stakeholders.length > 0 && h.length > 0 && kpis.siPercent > 0 ? kpis.si / (kpis.siPercent / 100) : 1
  const kacheln: Kachel[] = [
    {
      key: "termine",
      label: "Termine",
      value: kpis.spi * 100,
      ampel: kpis.ampeln.termine,
      series: pick((p) => p.spi * 100),
      help: "SPI = EV ÷ PV. Unter 100 % hast du weniger geschafft als geplant.",
      detail: `SPI ${kpis.spi.toFixed(2)} · Prognose Tag ${kpis.forecastEndDay.toFixed(1)}`,
    },
    {
      key: "kosten",
      label: "Kosten",
      value: kpis.cpi * 100,
      ampel: kpis.ampeln.kosten,
      series: pick((p) => p.cpi * 100),
      help: "CPI = EV ÷ AC. Unter 100 % kostet die geleistete Arbeit mehr als geplant.",
      detail: `CPI ${kpis.cpi.toFixed(2)}`,
    },
    {
      key: "qualitaet",
      label: "Qualität",
      value: kpis.qi,
      ampel: kpis.ampeln.qualitaet,
      series: pick((p) => p.qi),
      help: "Qualitätsindex aus den unentdeckten Fehlern je 100 h. 100 % entspricht guter Passung und einem Review je Vorgang.",
      detail: `Restmängel ${kpis.restmaengel.toFixed(1)}`,
    },
    {
      key: "team",
      label: "Motivation",
      value: kpis.teamMotivation,
      ampel: kpis.ampeln.team,
      series: pick((p) => p.motivation),
      help: "Teammotivation, nach Pensum gewichtet. Gespräche, Anlässe und gute Entscheide heben sie, Dauer-Überstunden senken sie.",
      detail: "Teammittel",
    },
    {
      key: "stakeholder",
      label: "Stakeholder",
      value: kpis.siPercent,
      ampel: siAmpel(kpis.siPercent),
      series: pick((p) => (p.si / siStart) * 100),
      help: "Zufriedenheit aller Stakeholder (gewichtet nach Einfluss und Interesse) im Vergleich zum Start.",
      detail: `Index ${Math.round(kpis.si)} von 100`,
    },
    {
      key: "risiken",
      label: "Risiko",
      value: kpis.rmi,
      ampel: kpis.ampeln.risiken,
      series: pick((p) => p.rmi),
      help: "Risiko-Index: Anteil behandelter Risiken und regelmässige Prüfung des Registers (jede Woche «Register geprüft»).",
      detail: "Abdeckung und Prüfung",
    },
  ]

  return (
    <div className={styles.kacheln} role="list" aria-label="Kennzahlen">
      {kacheln.map((k) => {
        const t = trend(k.series)
        const open = help === k.key
        return (
          <div
            key={k.key}
            role="listitem"
            className={`${styles.kachel} ${styles[`kachel_${k.ampel}`]}`}
            aria-label={`${k.label} ${Math.round(k.value)} Prozent, Ampel ${AMPEL_TEXT[k.ampel]}, Trend ${t.text}`}
          >
            <div className={styles.kachelKopf}>
              <span className={styles.kachelLabel}>{k.label}</span>
              <button
                type="button"
                className={styles.hilfeKnopf}
                aria-expanded={open}
                aria-label={`Kurzhilfe ${k.label}`}
                onClick={() => setHelp(open ? null : k.key)}
              >
                ?
              </button>
            </div>
            <div className={styles.kachelWert} aria-hidden="true">
              {Math.round(k.value)}
              <small> %</small>
            </div>
            <div className={styles.kachelFuss} aria-hidden="true">
              <Ampel wert={k.ampel} />
              <span className={styles.trend} title={`Trend: ${t.text}`}>
                {t.symbol}
              </span>
            </div>
            <div className={styles.kachelKurve} aria-hidden="true">
              <Verlauf values={k.series.slice(-40)} label={k.label} reference={100} />
            </div>
            <p className={styles.kachelDetail}>{k.detail}</p>
            {open && <p className={styles.kachelHilfe}>{k.help}</p>}
          </div>
        )
      })}
    </div>
  )
}
