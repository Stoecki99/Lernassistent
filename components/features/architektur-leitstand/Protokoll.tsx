// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

"use client"

// components/features/architektur-leitstand/Protokoll.tsx
// Chronik des Laufs: Ereignisse, Hinweise und eigene Massnahmen, neueste zuerst.

import { aktionText, type Mission, type Zustand } from "@/lib/archsim"
import styles from "@/app/(architektur-leitstand)/architektur-leitstand.module.css"
import { chronik } from "./logik"

const SYMBOL = { aktion: "◆", ereignis: "⚡", hinweis: "💡" } as const
const ART_TEXT = { aktion: "Massnahme", ereignis: "Ereignis", hinweis: "Hinweis" } as const

export default function Protokoll({ mission, zustand }: { mission: Mission; zustand: Zustand }) {
  const zeilen = chronik(mission, zustand, aktionText)
  return (
    <section className={`card ${styles.protokoll}`} aria-labelledby="al-protokoll-titel">
      <h3 id="al-protokoll-titel" className={styles.h3}>
        Protokoll
      </h3>
      {zeilen.length === 0 ? (
        <p className="hint">Noch nichts passiert. Massnahmen vor dem Start wirken sofort und ohne Startzeit.</p>
      ) : (
        <ol className={styles.protokollListe}>
          {zeilen.map((z, i) => (
            <li key={i} className={styles[`pz_${z.art}`]}>
              <span className={styles.protokollMinute}>{z.tick}′</span>
              <span aria-hidden="true">{SYMBOL[z.art]}</span>
              <span>
                <span className="sr-only">{ART_TEXT[z.art]}: </span>
                {z.text}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
