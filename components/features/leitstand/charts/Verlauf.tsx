// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// components/features/leitstand/charts/Verlauf.tsx
// Kleinkurve (Sparkline) als SVG ohne Text; skaliert frei, Linie bleibt gleich dick.

import styles from "@/app/(leitstand)/leitstand.module.css"

export default function Verlauf({
  values,
  label,
  min,
  max,
  reference,
  color = "var(--accent)",
}: {
  values: number[]
  label: string
  min?: number
  max?: number
  /** waagrechte Linie, z. B. 100 % */
  reference?: number
  color?: string
}) {
  if (values.length < 2) {
    return <span className={styles.verlaufLeer}>noch kein Verlauf</span>
  }
  const lo = Math.min(min ?? Infinity, ...values, reference ?? Infinity)
  const hi = Math.max(max ?? -Infinity, ...values, reference ?? -Infinity)
  const span = Math.max(hi - lo, 1e-9)
  const W = 100
  const H = 30
  const x = (i: number) => (i / (values.length - 1)) * W
  const y = (v: number) => H - 2 - ((v - lo) / span) * (H - 4)
  const first = values[0]
  const last = values[values.length - 1]
  return (
    <svg
      className={styles.verlauf}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={`${label}: von ${Math.round(first)} auf ${Math.round(last)}`}
    >
      <title>{`${label}: von ${Math.round(first)} auf ${Math.round(last)}`}</title>
      {reference !== undefined && (
        <line x1={0} x2={W} y1={y(reference)} y2={y(reference)} className={styles.verlaufRef} vectorEffect="non-scaling-stroke" />
      )}
      <polyline
        fill="none"
        stroke={color}
        strokeWidth={2}
        vectorEffect="non-scaling-stroke"
        strokeLinejoin="round"
        points={values.map((v, i) => `${x(i).toFixed(2)},${y(v).toFixed(2)}`).join(" ")}
      />
    </svg>
  )
}
