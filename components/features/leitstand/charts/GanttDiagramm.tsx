// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// components/features/leitstand/charts/GanttDiagramm.tsx
// Gantt: Basisplan (Umriss) und Prognose bzw. Ist (gefüllt) übereinander, heute als Linie.
// Kritischer Pfad mit Farbe, dickem Rand und dem Wort «kritisch». Erste Spalte bleibt beim Scrollen stehen.

import type { ScheduleRow, SimState, TaskDef } from "@/lib/simulation"
import styles from "@/app/(leitstand)/leitstand.module.css"

export default function GanttDiagramm({
  tasks,
  base,
  forecastRows,
  state,
  today,
  xMax,
  targetDay,
}: {
  tasks: TaskDef[]
  base: Record<string, ScheduleRow>
  forecastRows: Record<string, ScheduleRow>
  state: SimState
  today: number
  xMax: number
  targetDay: number
}) {
  const pos = (d: number) => `${Math.min(100, Math.max(0, (d / xMax) * 100))}%`
  const width = (a: number, b: number) => `${Math.max(0.6, ((b - a) / xMax) * 100)}%`
  const step = xMax <= 12 ? 1 : 5
  const ticks = Array.from({ length: Math.floor(xMax / step) + 1 }, (_, i) => i * step)

  return (
    <div className={styles.gantt} role="group" aria-label="Gantt-Diagramm: Basisplan und Prognose je Vorgang">
      <div className={styles.ganttInnen}>
        <div className={`${styles.ganttZeile} ${styles.ganttKopf}`} aria-hidden="true">
          <div className={styles.ganttLabel}>Vorgang</div>
          <div className={styles.ganttSpur}>
            {ticks.map((t) => (
              <span key={t} className={styles.ganttTick} style={{ left: pos(t) }}>
                {t}
              </span>
            ))}
          </div>
        </div>
        {tasks.map((t) => {
          const b = base[t.id]
          const f = forecastRows[t.id]
          const ts = state.tasks[t.id]
          const critical = f?.critical ?? b?.critical ?? false
          const done = ts.status === "fertig"
          return (
            <div key={t.id} className={`${styles.ganttZeile} ${critical ? styles.kritisch : ""}`}>
              <div className={styles.ganttLabel}>
                <strong>{t.id}</strong> <span className={styles.ganttName}>{t.name}</span>
                {critical && <span className={styles.kritischText}>kritisch</span>}
              </div>
              <div className={styles.ganttSpur}>
                {b && (
                  <span
                    className={styles.ganttPlan}
                    style={{ left: pos(b.es), width: width(b.es, b.ef) }}
                    title={`Basisplan Tag ${b.es.toFixed(1)}–${b.ef.toFixed(1)}`}
                  />
                )}
                {f && (
                  <span
                    className={`${styles.ganttIst} ${done ? styles.ganttFertig : ""}`}
                    style={{ left: pos(f.es), width: width(f.es, f.ef) }}
                    title={`${done ? "Ist" : "Prognose"} Tag ${f.es.toFixed(1)}–${f.ef.toFixed(1)}`}
                  />
                )}
                <span className="sr-only">
                  Basisplan Tag {b?.es.toFixed(1)} bis {b?.ef.toFixed(1)}; {done ? "Ist" : "Prognose"} Tag {f?.es.toFixed(1)} bis{" "}
                  {f?.ef.toFixed(1)}
                  {critical ? ", kritisch" : ""}
                </span>
              </div>
            </div>
          )
        })}
        <div className={styles.ganttLinien} aria-hidden="true">
          <div className={styles.ganttLabel} />
          <div className={styles.ganttSpur}>
            <span className={styles.ganttHeute} style={{ left: pos(today) }}>
              <span>heute</span>
            </span>
            <span className={styles.ganttZiel} style={{ left: pos(targetDay) }}>
              <span>Ziel</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
