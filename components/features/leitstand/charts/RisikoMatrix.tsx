// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

"use client"

// components/features/leitstand/charts/RisikoMatrix.tsx
// 5×5-Matrix Wahrscheinlichkeit × Auswirkung (3.9). Zellen sind Knöpfe; Pfeiltasten wandern im Raster.

import { useRef, useState } from "react"
import styles from "@/app/(leitstand)/leitstand.module.css"

export interface MatrixRisk {
  id: string
  title: string
  probability: number
  impact: number
}

type Zone = "rot" | "gelb" | "gruen"

function zone(value: number): Zone {
  return value >= 12 ? "rot" : value >= 6 ? "gelb" : "gruen"
}

/** Zonenname als Text, damit die Zone nicht nur über die Farbe erkennbar ist (4.8 «Farbe nie allein») */
export const ZONE_TEXT: Record<Zone, string> = {
  rot: "rote Zone, hohes Risiko",
  gelb: "gelbe Zone, mittleres Risiko",
  gruen: "grüne Zone, tiefes Risiko",
}

const LEGEND: Array<[Zone, string, string]> = [
  ["rot", "Rot: hoch", "Wert 12 bis 25"],
  ["gelb", "Gelb: mittel", "Wert 6 bis 10"],
  ["gruen", "Grün: tief", "Wert 1 bis 5"],
]

export default function RisikoMatrix({
  risks,
  selected,
  onSelect,
}: {
  risks: MatrixRisk[]
  selected: { w: number; a: number } | null
  onSelect: (cell: { w: number; a: number }) => void
}) {
  const [focus, setFocus] = useState<{ w: number; a: number }>(selected ?? { w: 3, a: 3 })
  const refs = useRef<Record<string, HTMLButtonElement | null>>({})

  function move(w: number, a: number) {
    const nw = Math.min(5, Math.max(1, w))
    const na = Math.min(5, Math.max(1, a))
    setFocus({ w: nw, a: na })
    refs.current[`${nw}-${na}`]?.focus()
  }

  function onKey(e: React.KeyboardEvent, w: number, a: number) {
    if (e.key === "ArrowUp") move(w + 1, a)
    else if (e.key === "ArrowDown") move(w - 1, a)
    else if (e.key === "ArrowLeft") move(w, a - 1)
    else if (e.key === "ArrowRight") move(w, a + 1)
    else return
    e.preventDefault()
  }

  return (
    <div className={styles.matrixRahmen}>
      <div className={styles.matrixAchseY} aria-hidden="true">
        Wahrscheinlichkeit →
      </div>
      <div role="grid" aria-label="Risikomatrix: Wahrscheinlichkeit (Zeilen) mal Auswirkung (Spalten)" className={styles.matrix}>
        {[5, 4, 3, 2, 1].map((w) => (
          <div role="row" key={w} className={styles.matrixZeile}>
            <span className={styles.matrixKopf} aria-hidden="true">
              {w}
            </span>
            {[1, 2, 3, 4, 5].map((a) => {
              const here = risks.filter((r) => r.probability === w && r.impact === a)
              const value = w * a
              const z = zone(value)
              const isSel = selected?.w === w && selected?.a === a
              const label = `Wahrscheinlichkeit ${w}, Auswirkung ${a}, Wert ${value}, ${ZONE_TEXT[z]}${
                here.length ? `: ${here.map((r) => `${r.id} ${r.title}`).join(", ")}` : ", kein Risiko"
              }`
              return (
                <div role="gridcell" key={a}>
                  <button
                    type="button"
                    ref={(el) => {
                      refs.current[`${w}-${a}`] = el
                    }}
                    tabIndex={focus.w === w && focus.a === a ? 0 : -1}
                    className={`${styles.matrixZelle} ${styles[`zone_${z}`]} ${isSel ? styles.matrixAktiv : ""}`}
                    aria-label={label}
                    aria-pressed={isSel}
                    onClick={() => {
                      setFocus({ w, a })
                      onSelect({ w, a })
                    }}
                    onKeyDown={(e) => onKey(e, w, a)}
                  >
                    <span className={styles.matrixWert} aria-hidden="true">
                      {value}
                    </span>
                    {here.length > 0 && (
                      <span className={styles.matrixIds} aria-hidden="true">
                        {here.map((r) => r.id).join(" ")}
                      </span>
                    )}
                  </button>
                </div>
              )
            })}
          </div>
        ))}
        <div className={styles.matrixZeile} aria-hidden="true">
          <span className={styles.matrixKopf} />
          {[1, 2, 3, 4, 5].map((a) => (
            <span key={a} className={styles.matrixKopf}>
              {a}
            </span>
          ))}
        </div>
      </div>
      <div className={styles.matrixAchseX} aria-hidden="true">
        Auswirkung →
      </div>
      <ul className={styles.matrixLegende} aria-label="Legende der Zonen">
        {LEGEND.map(([z, name, range]) => (
          <li key={z}>
            <span className={`${styles.matrixFeld} ${styles[`zone_${z}`]}`} aria-hidden="true" />
            <strong>{name}</strong> ({range})
          </li>
        ))}
      </ul>
    </div>
  )
}
