// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// components/features/leitstand/Hinweis.tsx
// Eingeblendeter Hinweis des Einführungslaufs (2.10): je einmal, schliessbar, «Hinweise aus».
// Die Live-Region bleibt dauerhaft im DOM, damit Bildschirmleser neue Hinweise zuverlässig ansagen.

import styles from "@/app/(leitstand)/leitstand.module.css"

export default function Hinweis({
  hint,
  coach,
  onClose,
  onAllOff,
}: {
  /** null = kein Hinweis sichtbar (Region bleibt leer im DOM) */
  hint: { text: string } | null
  coach: string
  onClose: () => void
  onAllOff: () => void
}) {
  return (
    <div aria-live="polite">
      {hint && (
        <aside className={styles.hinweis} aria-label="Hinweis">
          <span className={styles.hinweisIcon} aria-hidden="true">
            💡
          </span>
          <div className={styles.hinweisText}>
            <strong>Tipp von {coach}</strong>
            <p>{hint.text}</p>
          </div>
          <div className={styles.hinweisKnoepfe}>
            <button type="button" className={`btn ${styles.klein}`} onClick={onClose}>
              Verstanden
            </button>
            <button type="button" className={`btn ${styles.klein}`} onClick={onAllOff}>
              Hinweise aus
            </button>
          </div>
        </aside>
      )}
    </div>
  )
}
