// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

"use client"

// components/features/leitstand/Auftrag.tsx
// Projektbeschreibung vor dem Start (4.8 Bedienfluss): Auftrag, Team, Budget, Termine, Stakeholder.

import styles from "@/app/(leitstand)/leitstand.module.css"
import { useLeitstand } from "./context"
import { ORIGIN_TEXT, chf, parseBrief } from "./format"

export default function Auftrag() {
  const { scenario, kpis, setView, state } = useLeitstand()
  const blocks = parseBrief(scenario.briefing)
  const team = scenario.people.filter((p) => !p.hidden)
  return (
    <div className={styles.raster2}>
      <div className="card stack">
        <p className="eyebrow">{scenario.kind === "intro" ? "Einführungslauf" : "Ernstfall"}</p>
        <h2>{scenario.title}</h2>
        <div className="prose stack">
          {blocks.map((b, i) =>
            b.kind === "p" ? (
              <p key={i}>
                {b.parts.map((p, k) => (p.bold ? <strong key={k}>{p.text}</strong> : <span key={k}>{p.text}</span>))}
              </p>
            ) : (
              <ul key={i} className={styles.liste}>
                {b.items.map((item, k) => (
                  <li key={k}>{item.map((p, j) => (p.bold ? <strong key={j}>{p.text}</strong> : <span key={j}>{p.text}</span>))}</li>
                ))}
              </ul>
            )
          )}
        </div>
        <div className="row">
          <button type="button" className="btn primary" onClick={() => setView("vorgaenge")}>
            {state.phase === "planung" ? "Zur Planung: Vorgänge besetzen" : "Zum Leitstand"}
          </button>
          <button type="button" className="btn" onClick={() => setView("team")}>
            Team ansehen
          </button>
        </div>
      </div>
      <div className="stack">
        <div className="card stack">
          <h3>Rahmen</h3>
          <dl className={styles.zahlenListe}>
            <dt>Plankosten (BAC)</dt>
            <dd>{chf(kpis.bac)}</dd>
            <dt>Kredit (Budget)</dt>
            <dd>{chf(scenario.budget.total)}</dd>
            <dt>Plan-Ende · Terminziel</dt>
            <dd>
              Tag {scenario.calendar.planEndDay} · Tag {scenario.calendar.targetDay}
            </dd>
            <dt>Perioden</dt>
            <dd>{scenario.calendar.periods.map((p) => p.label).join(" · ")}</dd>
            <dt>Vorgänge</dt>
            <dd>{scenario.tasks.length}</dd>
          </dl>
        </div>
        <div className="card stack">
          <h3>Team</h3>
          <ul className={styles.liste}>
            {team.map((p) => (
              <li key={p.id}>
                <strong>{p.name}</strong> · {p.role} · {ORIGIN_TEXT[p.origin]} · {Math.round(p.pensum * 100)} %
              </li>
            ))}
          </ul>
        </div>
        <div className="card stack">
          <h3>Stakeholder</h3>
          <ul className={styles.liste}>
            {scenario.stakeholders.map((s) => (
              <li key={s.id}>
                <strong>{s.name}</strong> · {s.role}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
