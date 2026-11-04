// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

"use client"

// components/features/ipma/ExamClock.tsx
// Uhr der Prüfung (Spezifikation 3.2, 6.8 ExamClock):
// - Echtbedingungen: Restzeit = deadlineAt − (serverNow + seit dem Laden vergangene Zeit); bei 0 onExpire
// - mit Pausen: Restzeit = 180 min − aktive Zeit (activeSeconds + laufender Abschnitt); bei 0 onTimeUp (kein Zwang)
// role="timer" ohne laufende Ansage; Ansagen bei 30, 10 und 5 Minuten über onAnnounce (aria-live der Seite).

import { useEffect, useRef, useState } from "react"
import styles from "@/app/(ipma)/ipma.module.css"
import { clock, clockWords } from "./format"

const WARN_MINUTES = [30, 10, 5]

export interface ClockBase {
  /** Echtbedingungen: Ablauf in Client-Zeit (deadlineAt − Abweichung der Uhren) */
  deadlineClientMs: number | null
  /** mit Pausen: aktive Sekunden zum Zeitpunkt baseAtMs */
  activeSeconds: number
  baseAtMs: number
  paused: boolean
  limitSeconds: number
}

export function remainingSeconds(base: ClockBase, nowMs: number): number {
  if (base.deadlineClientMs !== null) return (base.deadlineClientMs - nowMs) / 1000
  const running = base.paused ? 0 : (nowMs - base.baseAtMs) / 1000
  return base.limitSeconds - (base.activeSeconds + running)
}

export default function ExamClock({
  base,
  onExpire,
  onAnnounce,
}: {
  base: ClockBase
  onExpire: () => void
  onAnnounce: (text: string) => void
}) {
  const [now, setNow] = useState(() => Date.now())
  const announced = useRef<Set<number> | null>(null)
  const expired = useRef(false)
  const expireRef = useRef(onExpire)
  expireRef.current = onExpire
  const announceRef = useRef(onAnnounce)
  announceRef.current = onAnnounce

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const rest = remainingSeconds(base, now)

  useEffect(() => {
    // Schwellen, die beim Laden schon unterschritten sind, nicht nachträglich ansagen
    if (announced.current === null) {
      announced.current = new Set(WARN_MINUTES.filter((m) => rest <= m * 60))
    }
    for (const m of WARN_MINUTES) {
      if (rest <= m * 60 && rest > 0 && !announced.current.has(m)) {
        announced.current.add(m)
        announceRef.current(`Noch ${m} Minuten.`)
      }
    }
    if (rest <= 0 && !expired.current) {
      expired.current = true
      expireRef.current()
    }
  }, [rest])

  const cls = rest <= 5 * 60 ? styles.uhrKnapp : rest <= 10 * 60 ? styles.uhrWarn : ""
  return (
    <span className={`${styles.uhr} ${cls}`} role="timer" aria-label={`Restzeit ${clockWords(rest)}${base.paused ? ", angehalten" : ""}`}>
      <span aria-hidden="true">⏱ {clock(rest)}</span>
      {base.paused && <span className={styles.leise}> (Pause)</span>}
    </span>
  )
}
