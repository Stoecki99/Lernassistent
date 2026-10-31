// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// components/features/leitstand/Hinweis.tsx
// Eingeblendeter Hinweis des Einführungslaufs (2.10): je einmal, schliessbar, «Hinweise aus».

import styles from "@/app/(leitstand)/leitstand.module.css"

export default function Hinweis({
  text,
  coach,
  onClose,
  onAllOff,
}: {
  text: string
  coach: string
  onClose: () => void
  onAllOff: () => void
}) {
  return (
    <aside className={styles.hinweis} aria-label="Hinweis" aria-live="polite">
      <span className={styles.hinweisIcon} aria-hidden="true">
        💡
      </span>
      <div className={styles.hinweisText}>
        <strong>Tipp von {coach}</strong>
        <p>{text}</p>
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
  )
}
