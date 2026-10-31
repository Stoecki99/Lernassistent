// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

"use client"

// components/features/leitstand/PlanPruefung.tsx
// Plan-Prüfung vor dem Start (3.2) und Knopf «Planung abschliessen» (Aktion startPeriod).

import styles from "@/app/(leitstand)/leitstand.module.css"
import { useLeitstand } from "./context"
import { planCheck } from "./logic"

export default function PlanPruefung() {
  const { state, scenario, run, setView, readOnly } = useLeitstand()
  if (state.phase !== "planung") return null
  const findings = planCheck(state, scenario)
  const missing = findings.filter((f) => f.kind === "fehlt")
  const warnings = findings.filter((f) => f.kind === "warnung")
  const periodLabel = scenario.calendar.periods[state.period]?.label ?? ""

  return (
    <div className={`card stack ${styles.planPruefung}`}>
      <div className={styles.zeileZwischen}>
        <div>
          <p className="eyebrow">Planung · {periodLabel}</p>
          <h3>Plan prüfen und starten</h3>
        </div>
        <button
          type="button"
          className="btn primary"
          disabled={readOnly}
          onClick={() => run({ type: "startPeriod" })}
          aria-describedby="plan-pruefung-stand"
        >
          Planung abschliessen ▶
        </button>
      </div>
      <p id="plan-pruefung-stand" className="hint">
        {missing.length > 0
          ? "Zuerst jeden Vorgang besetzen. Die übrigen Hinweise sind Empfehlungen."
          : warnings.length > 0
            ? `${warnings.length} Hinweise. Du kannst trotzdem starten.`
            : "Der Plan sieht gut aus."}
      </p>
      {findings.length > 0 && (
        <ul className={styles.befundListe}>
          {findings.slice(0, 12).map((f, i) => (
            <li key={i} className={f.kind === "fehlt" ? styles.befundFehlt : styles.befundWarn}>
              <span aria-hidden="true">{f.kind === "fehlt" ? "■" : "▲"}</span>
              <span className="sr-only">{f.kind === "fehlt" ? "Fehlt:" : "Hinweis:"}</span>
              <span>{f.text}</span>
              <button type="button" className={`btn ${styles.klein}`} onClick={() => setView(f.view)}>
                {f.view === "team" ? "Team" : f.view === "risiken" ? "Risiken" : "Vorgänge"}
              </button>
            </li>
          ))}
          {findings.length > 12 && <li className="hint">… und {findings.length - 12} weitere.</li>}
        </ul>
      )}
    </div>
  )
}
