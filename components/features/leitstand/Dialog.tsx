// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

"use client"

// components/features/leitstand/Dialog.tsx
// Modaler Dialog mit Fokusfalle (4.8 Barrierefreiheit). Auf schmalen Schirmen ein Vollbild-Blatt von unten.

import { useEffect, useId, useRef } from "react"
import styles from "@/app/(leitstand)/leitstand.module.css"

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export default function Dialog({
  title,
  kicker,
  onEscape,
  children,
  wide = false,
}: {
  title: string
  kicker?: React.ReactNode
  /** Esc: nur wenn erlaubt (z. B. «Bis morgen überlegen»); ohne Handler bleibt der Dialog offen */
  onEscape?: () => void
  children: React.ReactNode
  wide?: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const escRef = useRef(onEscape)
  escRef.current = onEscape

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const el = ref.current
    el?.querySelector<HTMLElement>("h2")?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (!el) return
      if (e.key === "Escape") {
        if (escRef.current) {
          e.preventDefault()
          escRef.current()
        }
        return
      }
      if (e.key !== "Tab") return
      const items = Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((n) => n.offsetParent !== null)
      if (items.length === 0) return
      const first = items[0]
      const last = items[items.length - 1]
      if (e.shiftKey && (document.activeElement === first || document.activeElement === el.querySelector("h2"))) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener("keydown", onKey)
    const body = document.body
    const overflow = body.style.overflow
    body.style.overflow = "hidden"
    return () => {
      document.removeEventListener("keydown", onKey)
      body.style.overflow = overflow
      previous?.focus?.()
    }
  }, [])

  return (
    <div className={styles.dialogHinter}>
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby={titleId} className={`${styles.dialog} ${wide ? styles.dialogBreit : ""}`}>
        {kicker && <div className={styles.dialogKicker}>{kicker}</div>}
        <h2 id={titleId} tabIndex={-1} className={styles.dialogTitel}>
          {title}
        </h2>
        {children}
      </div>
    </div>
  )
}
