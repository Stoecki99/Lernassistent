// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

"use client"

// components/features/architektur-leitstand/Kennzahlen.tsx
// Kennzahl-Kacheln mit SLO-Ampel (Farbe + Form + Wort), Kleinkurve und Kurzhilfe.

import { useState } from "react"
import type { Mission, Zustand } from "@/lib/archsim"
import styles from "@/app/(architektur-leitstand)/architektur-leitstand.module.css"
import { AMPEL_FORM, kacheln, type Ampel } from "./logik"

export function AmpelMarke({ ampel, text }: { ampel: Ampel; text: string }) {
  return (
    <span className={`${styles.ampel} ${styles[`ampel_${ampel}`]}`}>
      <span aria-hidden="true">{AMPEL_FORM[ampel]}</span> {text}
    </span>
  )
}

function Kleinkurve({ reihe, ampel }: { reihe: number[]; ampel: Ampel }) {
  const w = 120
  const h = 28
  const r = reihe.slice(-40)
  if (r.length < 2) return <svg className={styles.kleinkurve} width={w} height={h} aria-hidden="true" />
  const lo = Math.min(...r)
  const hi = Math.max(...r)
  const sp = hi - lo || 1
  const d = r.map((v, i) => `${i ? "L" : "M"}${((i / (r.length - 1)) * (w - 4) + 2).toFixed(1)} ${(h - 3 - ((v - lo) / sp) * (h - 6)).toFixed(1)}`).join("")
  return (
    <svg className={`${styles.kleinkurve} ${styles[`kk_${ampel}`]}`} width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      <path d={`${d}L${w - 2} ${h}L2 ${h}Z`} className={styles.kkFlaeche} />
      <path d={d} className={styles.kkLinie} />
    </svg>
  )
}

export default function Kennzahlen({ mission, zustand }: { mission: Mission; zustand: Zustand }) {
  const [hilfe, setHilfe] = useState<string | null>(null)
  const liste = kacheln(mission, zustand)
  const offen = liste.find((k) => k.id === hilfe)
  return (
    <section className={styles.kennzahlen} aria-label="Kennzahlen">
      <ul className={styles.kacheln}>
        {liste.map((k) => (
          <li key={k.id} className={`${styles.kachel} ${styles[`kachel_${k.ampel}`]}`}>
            <button
              type="button"
              className={styles.kachelKnopf}
              aria-expanded={hilfe === k.id}
              aria-label={`${k.titel}: ${k.wert}, ${k.ampelText}. ${k.unter}. Erklärung ${hilfe === k.id ? "schliessen" : "zeigen"}`}
              onClick={() => setHilfe(hilfe === k.id ? null : k.id)}
            >
              <span className={styles.kachelTitel}>{k.titel}</span>
              <span className={styles.kachelWert}>{k.wert}</span>
              <AmpelMarke ampel={k.ampel} text={k.ampelText} />
              <span className={styles.kachelUnter}>{k.unter}</span>
              <Kleinkurve reihe={k.reihe} ampel={k.ampel} />
            </button>
          </li>
        ))}
      </ul>
      {offen && (
        <p className={`note ${styles.kachelHilfe}`} role="note">
          <strong>{offen.titel}:</strong> {offen.hilfe}
        </p>
      )}
    </section>
  )
}
