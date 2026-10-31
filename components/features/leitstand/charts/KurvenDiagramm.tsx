// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

"use client"

// components/features/leitstand/charts/KurvenDiagramm.tsx
// Liniendiagramm als eigenes SVG (Spezifikation 4.8): Reihen mit Linienart und Beschriftung am Linienende,
// waagrechte und senkrechte Marken (Budget, heute), gleichwertige Tabelle auf Knopfdruck.

import { useEffect, useId, useRef, useState } from "react"
import styles from "@/app/(leitstand)/leitstand.module.css"

export interface Reihe {
  key: string
  label: string
  /** CSS-Farbe, z. B. "var(--s1)" */
  color: string
  dash?: "voll" | "punkt" | "strich"
  points: Array<[number, number]>
}

export interface Marke {
  axis: "x" | "y"
  value: number
  label: string
}

const DASH: Record<NonNullable<Reihe["dash"]>, string | undefined> = {
  voll: undefined,
  punkt: "2 4",
  strich: "8 5",
}

/** Breite des Elternelements in Pixeln (für scharfe Schrift ohne Verzerrung). */
export function useWidth<T extends HTMLElement>(fallback = 640): [React.RefObject<T | null>, number] {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(fallback)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const update = () => setWidth(Math.max(240, Math.floor(el.getBoundingClientRect().width)))
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, width]
}

function niceMax(v: number): number {
  if (v <= 0) return 1
  const exp = Math.pow(10, Math.floor(Math.log10(v)))
  const f = v / exp
  const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10
  return nice * exp
}

export default function KurvenDiagramm(props: {
  title: string
  desc: string
  reihen: Reihe[]
  xMax: number
  yMax?: number
  yMin?: number
  xLabel: (x: number) => string
  yLabel: (y: number) => string
  marken?: Marke[]
  height?: number
  /** Zeilen für die Tabelle: x-Werte; die Werte holt die Tabelle aus den Reihen */
  tableX?: number[]
  compact?: boolean
}) {
  const { reihen, xMax, xLabel, yLabel, marken = [], height = 240, compact = false } = props
  const [ref, width] = useWidth<HTMLDivElement>()
  const [table, setTable] = useState(false)
  const id = useId()
  const allY = reihen.flatMap((r) => r.points.map((p) => p[1])).concat(marken.filter((m) => m.axis === "y").map((m) => m.value))
  const yMin = props.yMin ?? 0
  const yMax = props.yMax ?? niceMax(Math.max(...allY, yMin + 1) * 1.05)
  const padL = compact ? 8 : 56
  const padR = compact ? 8 : 74
  const padT = 14
  const padB = compact ? 8 : 28
  const w = width
  const h = height
  const sx = (x: number) => padL + (x / Math.max(xMax, 1e-9)) * (w - padL - padR)
  const sy = (y: number) => padT + (1 - (y - yMin) / Math.max(yMax - yMin, 1e-9)) * (h - padT - padB)
  const yTicks = compact ? [] : [0, 0.25, 0.5, 0.75, 1].map((f) => yMin + f * (yMax - yMin))
  const xStep = xMax <= 12 ? 2 : xMax <= 30 ? 5 : 10
  const xTicks = compact ? [] : Array.from({ length: Math.floor(xMax / xStep) + 1 }, (_, i) => i * xStep)

  // Beschriftungen am Linienende ohne Überlappung
  const ends = reihen
    .filter((r) => r.points.length > 0)
    .map((r) => ({ r, y: sy(r.points[r.points.length - 1][1]), x: sx(r.points[r.points.length - 1][0]) }))
    .sort((a, b) => a.y - b.y)
  for (let i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < 14) ends[i].y = ends[i - 1].y + 14

  const tableX = props.tableX ?? []
  const valueAt = (r: Reihe, x: number): number | null => {
    let best: [number, number] | null = null
    for (const p of r.points) if (p[0] <= x + 1e-9) best = p
    return best ? best[1] : null
  }

  return (
    <figure className={styles.diagramm}>
      <div ref={ref} className={styles.diagrammFlaeche}>
        <svg width={w} height={h} role="img" aria-labelledby={`${id}-t ${id}-d`} className={styles.svg}>
          <title id={`${id}-t`}>{props.title}</title>
          <desc id={`${id}-d`}>{props.desc}</desc>
          {yTicks.map((y) => (
            <g key={`y${y}`}>
              <line x1={padL} x2={w - padR} y1={sy(y)} y2={sy(y)} className={styles.gitter} />
              <text x={padL - 6} y={sy(y) + 4} textAnchor="end" className={styles.achse}>
                {yLabel(y)}
              </text>
            </g>
          ))}
          {xTicks.map((x) => (
            <text key={`x${x}`} x={sx(x)} y={h - 8} textAnchor="middle" className={styles.achse}>
              {xLabel(x)}
            </text>
          ))}
          {marken.map((m) =>
            m.axis === "y" ? (
              <g key={`m${m.label}`}>
                <line x1={padL} x2={w - padR} y1={sy(m.value)} y2={sy(m.value)} className={styles.marke} />
                {!compact && (
                  <text x={padL + 4} y={sy(m.value) - 4} className={styles.markeText}>
                    {m.label}
                  </text>
                )}
              </g>
            ) : (
              <g key={`m${m.label}`}>
                <line x1={sx(m.value)} x2={sx(m.value)} y1={padT} y2={h - padB} className={styles.marke} />
                {!compact && (
                  <text x={sx(m.value) + 4} y={h - padB - 6} className={styles.markeText}>
                    {m.label}
                  </text>
                )}
              </g>
            )
          )}
          {reihen.map((r) =>
            r.points.length > 0 ? (
              <polyline
                key={r.key}
                fill="none"
                stroke={r.color}
                strokeWidth={compact ? 2 : 2.5}
                strokeLinejoin="round"
                strokeLinecap="round"
                strokeDasharray={DASH[r.dash ?? "voll"]}
                points={r.points.map(([x, y]) => `${sx(x).toFixed(1)},${sy(y).toFixed(1)}`).join(" ")}
              />
            ) : null
          )}
          {!compact &&
            ends.map(({ r, x, y }) => (
              <text key={`l${r.key}`} x={Math.min(x + 6, w - padR + 6)} y={y + 4} fill={r.color} className={styles.reihenText}>
                {r.label}
              </text>
            ))}
        </svg>
      </div>
      {!compact && tableX.length > 0 && (
        <>
          <button type="button" className={`btn ${styles.klein}`} aria-expanded={table} onClick={() => setTable((v) => !v)}>
            {table ? "Tabelle ausblenden" : "Als Tabelle zeigen"}
          </button>
          {table && (
            <div className="tablebox">
              <table className="tabelle">
                <caption>{props.title}</caption>
                <thead>
                  <tr>
                    <th scope="col">Zeitpunkt</th>
                    {reihen.map((r) => (
                      <th key={r.key} scope="col" className="zahl">
                        {r.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tableX.map((x) => (
                    <tr key={x}>
                      <th scope="row">{xLabel(x)}</th>
                      {reihen.map((r) => {
                        const v = valueAt(r, x)
                        return (
                          <td key={r.key} className="zahl">
                            {v === null ? "–" : yLabel(v)}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </figure>
  )
}
