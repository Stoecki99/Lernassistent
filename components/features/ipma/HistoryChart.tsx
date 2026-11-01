// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

"use client"

// components/features/ipma/HistoryChart.tsx
// Verlauf der Übungsprüfungen (Spezifikation 4.4, 6.8): eigenes SVG mit Linie «Prozent» und Grenze 60 %,
// Säulen «nachgewiesene Kompetenzen» mit Grenze 23; gleichwertige Tabelle (auch für Kurzprüfungen).
// Farbe nie allein: Linienarten und Beschriftung unterscheiden die Reihen.

import type { AttemptSummary } from "@/lib/ipma/types"
import { useId } from "react"
import styles from "@/app/(ipma)/ipma.module.css"
import { MIN_COMPETENCES, PASS_PERCENT, TOTAL_COMPETENCES, VARIANT_LABEL, date, percent, points } from "./format"

const W = 640
const H = 220
const PAD = { left: 40, right: 40, top: 14, bottom: 30 }

export default function HistoryChart({ exams, shorts }: { exams: AttemptSummary[]; shorts: AttemptSummary[] }) {
  const titleId = useId()
  const descId = useId()
  // Chronologisch, nur abgeschlossene mit Ergebnis
  const done = (list: AttemptSummary[]) =>
    list.filter((a) => a.status === "finished" && a.percent !== null).sort((a, b) => a.startedAt.localeCompare(b.startedAt))
  const examList = done(exams)
  const shortList = done(shorts)

  const innerW = W - PAD.left - PAD.right
  const innerH = H - PAD.top - PAD.bottom
  const step = examList.length > 0 ? innerW / examList.length : innerW
  const x = (i: number) => PAD.left + step * (i + 0.5)
  const yPercent = (p: number) => PAD.top + innerH - (p / 100) * innerH
  const yComp = (n: number) => PAD.top + innerH - (n / TOTAL_COMPETENCES) * innerH
  const barW = Math.min(36, step * 0.5)

  const desc =
    examList.length === 0
      ? "Noch keine abgeschlossene Übungsprüfung."
      : examList
          .map((a, i) => `Versuch ${i + 1} am ${date(a.startedAt)}: ${percent(a.percent ?? 0)}, ${a.shownCount ?? 0} Kompetenzen nachgewiesen`)
          .join("; ")

  return (
    <div className="stack">
      {examList.length === 0 ? (
        <p className="hint">Noch keine abgeschlossene Übungsprüfung. Nach der ersten Prüfung erscheint hier dein Verlauf.</p>
      ) : (
        <div className="tablebox">
          <svg className={styles.diagramm} viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby={`${titleId} ${descId}`}>
            <title id={titleId}>Verlauf der Übungsprüfungen</title>
            <desc id={descId}>{desc}</desc>
            {[0, 25, 50, 75, 100].map((p) => (
              <g key={p}>
                <line x1={PAD.left} x2={W - PAD.right} y1={yPercent(p)} y2={yPercent(p)} className={styles.diagrammRaster} />
                <text x={PAD.left - 6} y={yPercent(p) + 4} textAnchor="end" className={styles.diagrammText}>
                  {p} %
                </text>
              </g>
            ))}
            {[0, 7, 14, 21, 28].map((n) => (
              <text key={n} x={W - PAD.right + 6} y={yComp(n) + 4} className={styles.diagrammText}>
                {n}
              </text>
            ))}
            {examList.map((a, i) => (
              <rect
                key={a.id}
                x={x(i) - barW / 2}
                width={barW}
                y={yComp(a.shownCount ?? 0)}
                height={Math.max(0, PAD.top + innerH - yComp(a.shownCount ?? 0))}
                className={styles.diagrammSaeule}
              />
            ))}
            <line x1={PAD.left} x2={W - PAD.right} y1={yComp(MIN_COMPETENCES)} y2={yComp(MIN_COMPETENCES)} className={styles.grenzeKompetenzen} />
            <line x1={PAD.left} x2={W - PAD.right} y1={yPercent(PASS_PERCENT)} y2={yPercent(PASS_PERCENT)} className={styles.grenzePunkte} />
            {examList.length > 1 && (
              <polyline
                className={styles.diagrammLinie}
                points={examList.map((a, i) => `${x(i).toFixed(1)},${yPercent(a.percent ?? 0).toFixed(1)}`).join(" ")}
              />
            )}
            {examList.map((a, i) => (
              <g key={a.id}>
                <circle cx={x(i)} cy={yPercent(a.percent ?? 0)} r={4.5} className={styles.diagrammPunkt} />
                <text x={x(i)} y={H - 10} textAnchor="middle" className={styles.diagrammText}>
                  {i + 1}
                </text>
              </g>
            ))}
          </svg>
        </div>
      )}
      {examList.length > 0 && (
        <ul className={styles.legende}>
          <li>● Linie: Punkte in Prozent (links)</li>
          <li>▯ Säulen: nachgewiesene Kompetenzen (rechts)</li>
          <li>– – Grenze {PASS_PERCENT} %</li>
          <li>· · Grenze {MIN_COMPETENCES} Kompetenzen</li>
        </ul>
      )}
      {(examList.length > 0 || shortList.length > 0) && (
        <details>
          <summary>Als Tabelle zeigen</summary>
          <div className="tablebox">
            <table className={`tabelle ${styles.verlaufTabelle}`}>
              <caption>Abgeschlossene Prüfungen</caption>
              <thead>
                <tr>
                  <th scope="col">Datum</th>
                  <th scope="col">Art</th>
                  <th scope="col" className="zahl">
                    Punkte
                  </th>
                  <th scope="col" className="zahl">
                    Prozent
                  </th>
                  <th scope="col" className="zahl">
                    Kompetenzen
                  </th>
                  <th scope="col">Ergebnis</th>
                </tr>
              </thead>
              <tbody>
                {[...examList.map((a) => ({ a, art: `Übungsprüfung, ${VARIANT_LABEL[a.variant]}` })), ...shortList.map((a) => ({ a, art: "Kurzprüfung" }))].map(
                  ({ a, art }) => (
                    <tr key={a.id}>
                      <td>
                        <a href={`/ipma/${a.id}/auswertung`}>{date(a.startedAt)}</a>
                      </td>
                      <td>{art}</td>
                      <td className="zahl">
                        {points(a.pointsQ ?? 0)} / {points(a.maxPointsQ ?? 0)}
                      </td>
                      <td className="zahl">{percent(a.percent ?? 0)}</td>
                      <td className="zahl">{a.mode === "exam" ? `${a.shownCount ?? 0} / ${TOTAL_COMPETENCES}` : `${a.shownCount ?? 0}`}</td>
                      <td>{a.passed ? "✓ bestanden" : "✗ nicht bestanden"}</td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </div>
  )
}
