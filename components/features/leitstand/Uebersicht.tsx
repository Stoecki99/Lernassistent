// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

"use client"

// components/features/leitstand/Uebersicht.tsx
// Übersicht (4.8): Prognose Endtag und EAC, Kurve PV/EV/AC, heutige Termine, kritischer Pfad jetzt, Posteingang-Vorschau.

import { forecast, formatTick, dayOf } from "@/lib/simulation/core"
import styles from "@/app/(leitstand)/leitstand.module.css"
import { useLeitstand, personName, taskName } from "./context"
import { CHANNEL_ICON, CHANNEL_TEXT, chf, tausender } from "./format"
import KurvenDiagramm from "./charts/KurvenDiagramm"
import { evCurves } from "./BudgetAnsicht"
import PlanPruefung from "./PlanPruefung"

const KIND_TEXT: Record<string, string> = {
  gespraech: "Gespräch",
  mittagessen: "Mittagessen",
  teamabend: "Teamabend",
  weiterbildung: "Weiterbildung",
  workshop: "Massnahme",
  zusatzbericht: "Zusatzbericht",
}

export { KIND_TEXT }

export default function Uebersicht() {
  const { state, scenario, kpis, base, setView, openEvent } = useLeitstand()
  const fc = forecast(state, scenario)
  const fcRows = Object.fromEntries(fc.rows.map((r) => [r.taskId, r]))
  const criticalNow = scenario.tasks.filter((t) => fcRows[t.id]?.critical && state.tasks[t.id].status !== "fertig")
  const running = criticalNow.filter((t) => state.tasks[t.id].status === "laufend")
  const today = dayOf(state.tick)
  const appointments = state.calendar.filter((c) => dayOf(c.tick) === today)
  const openItems = state.inbox.filter((i) => i.status === "neu" || i.status === "aufgeschoben")
  const curves = evCurves(state, scenario, base, kpis)

  return (
    <div className={styles.ansicht}>
      {state.phase === "planung" && <PlanPruefung />}
      <div className={styles.raster2}>
        <div className="card stack">
          <h3>Prognose</h3>
          <p className={styles.grossZahl}>
            Ende Tag {kpis.forecastEndDay.toFixed(1)}
            <small>
              {" "}
              (Plan {scenario.calendar.planEndDay}, Ziel {scenario.calendar.targetDay})
            </small>
          </p>
          <p className={styles.grossZahl}>
            EAC {chf(kpis.eac)}
            <small> / Budget {tausender(kpis.budget)}</small>
          </p>
          <KurvenDiagramm
            title="Kurven PV, EV und AC"
            desc={`Geplanter Wert, Fertigstellungswert und Ist-Kosten bis heute. PV ${chf(kpis.pv)}, EV ${chf(kpis.ev)}, AC ${chf(kpis.ac)}.`}
            reihen={curves.reihen}
            xMax={curves.xMax}
            xLabel={(x) => `T${x}`}
            yLabel={(y) => `${Math.round(y / 1000)}k`}
            marken={curves.marken}
            height={200}
          />
        </div>
        <div className="card stack">
          <h3>Kritischer Pfad jetzt</h3>
          {criticalNow.length === 0 ? (
            <p className="hint">Alle kritischen Vorgänge sind fertig.</p>
          ) : (
            <>
              {(running.length > 0 ? running : criticalNow.slice(0, 1)).map((t) => {
                const ts = state.tasks[t.id]
                const progress = ts.done + ts.remaining > 0 ? ts.done / (ts.done + ts.remaining) : 0
                return (
                  <div key={t.id} className={styles.pfadJetzt}>
                    <div className={styles.zeileZwischen}>
                      <strong>
                        {t.id} {t.name}
                      </strong>
                      <span>{Math.round(progress * 100)} %</span>
                    </div>
                    <div
                      className={styles.fortschritt}
                      role="progressbar"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={Math.round(progress * 100)}
                      aria-label={`Fortschritt ${t.id}`}
                    >
                      <span style={{ width: `${progress * 100}%` }} />
                    </div>
                  </div>
                )
              })}
              <p className="hint">
                danach{" "}
                {criticalNow
                  .filter((t) => !running.includes(t))
                  .slice(running.length > 0 ? 0 : 1, 5)
                  .map((t) => t.id)
                  .join(", ") || "–"}
              </p>
            </>
          )}
          <button type="button" className="btn" onClick={() => setView("plan")}>
            Plan ansehen
          </button>

          <h3>Heute im Kalender</h3>
          {appointments.length === 0 ? (
            <p className="hint">Keine Termine heute.</p>
          ) : (
            <ul className={styles.liste}>
              {appointments.map((c) => (
                <li key={c.id}>
                  {KIND_TEXT[c.kind]} {c.personIds.length > 0 ? `mit ${c.personIds.map((p) => personName(scenario, p)).join(", ")}` : ""}{" "}
                  <span className="hint">{formatTick(c.tick)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="card stack">
        <div className={styles.zeileZwischen}>
          <h3>Posteingang</h3>
          <button type="button" className="btn" onClick={() => setView("posteingang")}>
            Alle anzeigen
          </button>
        </div>
        {openItems.length === 0 ? (
          <p className="hint">Nichts Offenes. Gut so.</p>
        ) : (
          <ul className={styles.postListe}>
            {openItems.slice(0, 4).map((i) => {
              const def = scenario.events.find((e) => e.id === i.eventId)
              if (!def) return null
              return (
                <li key={`${i.eventId}-${i.arrivedTick}`}>
                  <button type="button" className={styles.postEintrag} onClick={() => openEvent(i.eventId)}>
                    <span className={styles.postIcon} aria-hidden="true">
                      {CHANNEL_ICON[def.channel]}
                    </span>
                    <span className={styles.postText}>
                      <strong>{def.title}</strong>
                      <span className="hint">
                        {CHANNEL_TEXT[def.channel]} · {def.sender.name}
                      </span>
                    </span>
                    <span className={`status ${i.status === "neu" ? "begonnen" : "offen"}`}>{i.status}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
      {state.phase === "lauf" && (
        <p className="hint">
          Laufende Vorgänge: {scenario.tasks.filter((t) => state.tasks[t.id].status === "laufend").map((t) => `${t.id} ${taskName(scenario, t.id)}`).join(" · ") || "keine"}
        </p>
      )}
    </div>
  )
}
