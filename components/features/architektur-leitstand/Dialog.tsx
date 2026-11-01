// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

"use client"

// components/features/architektur-leitstand/Dialog.tsx
// Modaler Dialog mit Fokusfalle (wie components/features/leitstand/Dialog.tsx). Auf schmalen Schirmen ein Blatt von unten.
// Tab und Umschalt+Tab kreisen im Dialog; Fokus, der hinausgelangt, wird zurückgeholt; Hintergrund «inert»
// (Live-Regionen ausgenommen); Esc schliesst, wenn onEscape gesetzt ist; danach Fokus zurück auf den Auslöser.

import { useEffect, useId, useRef } from "react"
import styles from "@/app/(architektur-leitstand)/architektur-leitstand.module.css"

const FOKUSSIERBAR = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export default function Dialog({
  titel,
  kicker,
  onEscape,
  children,
  breit = false,
}: {
  titel: string
  kicker?: React.ReactNode
  onEscape?: () => void
  children: React.ReactNode
  breit?: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  const titelId = useId()
  const escRef = useRef(onEscape)
  escRef.current = onEscape

  useEffect(() => {
    const vorher = document.activeElement as HTMLElement | null
    const el = ref.current
    el?.querySelector<HTMLElement>("h2")?.focus()
    const inertZurueck = el ? hintergrundInert(el) : () => undefined
    const onFocusIn = (e: FocusEvent) => {
      if (!el || !(e.target instanceof Node) || el.contains(e.target)) return
      el.querySelector<HTMLElement>("h2")?.focus()
    }
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
      const items = Array.from(el.querySelectorAll<HTMLElement>(FOKUSSIERBAR)).filter((n) => n.offsetParent !== null)
      if (items.length === 0) return
      const erstes = items[0]
      const letztes = items[items.length - 1]
      if (e.shiftKey && (document.activeElement === erstes || document.activeElement === el.querySelector("h2"))) {
        e.preventDefault()
        letztes.focus()
      } else if (!e.shiftKey && document.activeElement === letztes) {
        e.preventDefault()
        erstes.focus()
      }
    }
    document.addEventListener("focusin", onFocusIn)
    document.addEventListener("keydown", onKey)
    const body = document.body
    const overflow = body.style.overflow
    body.style.overflow = "hidden"
    return () => {
      document.removeEventListener("keydown", onKey)
      document.removeEventListener("focusin", onFocusIn)
      inertZurueck()
      body.style.overflow = overflow
      vorher?.focus?.()
    }
  }, [])

  return (
    <div className={styles.dialogHinter}>
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby={titelId} className={`${styles.dialog} ${breit ? styles.dialogBreit : ""}`}>
        {kicker && <div className={styles.dialogKicker}>{kicker}</div>}
        <h2 id={titelId} tabIndex={-1} className={styles.dialogTitel}>
          {titel}
        </h2>
        {children}
      </div>
    </div>
  )
}

function hintergrundInert(dialog: HTMLElement): () => void {
  const geaendert: HTMLElement[] = []
  let node: HTMLElement | null = dialog
  while (node && node !== document.body) {
    const parent: HTMLElement | null = node.parentElement
    if (!parent) break
    for (const s of Array.from(parent.children)) {
      if (s === node || !(s instanceof HTMLElement) || s.inert) continue
      if (s.tagName === "SCRIPT" || s.tagName === "STYLE") continue
      if (s.hasAttribute("aria-live")) continue
      s.inert = true
      geaendert.push(s)
    }
    node = parent
  }
  return () => {
    for (const e of geaendert) e.inert = false
  }
}
