// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// components/features/lernseiten/WerkzeugKarten.tsx
// Karten zu App-Werkzeugen (z. B. Leitstand, IPMA-Prüfungssimulator) am Anfang einer Sektion der
// Lernpfad-Seite. Daten aus fach.json (sektionen[].werkzeuge, geprüft in lib/validations/lernseite.ts);
// Zugang und Bestwerte rechnet die Seite serverseitig aus. Server-Komponente ohne Zustand.

import type { Werkzeug } from "@/lib/validations/lernseite"
import styles from "@/app/(lernpfad)/lernpfad.module.css"

export interface WerkzeugAnzeige extends Werkzeug {
  /** true: Karte braucht Pro und das Konto hat es nicht («Nur mit Pro»). */
  gesperrt: boolean
  /** Bestwert des Leitstand-Szenarios, falls vorhanden. */
  bestwert: { punkte: number; sterne: number } | null
}

interface WerkzeugKartenProps {
  sektionTitel: string
  werkzeuge: WerkzeugAnzeige[]
}

export default function WerkzeugKarten({ sektionTitel, werkzeuge }: WerkzeugKartenProps) {
  return (
    <ul className={styles.werkzeuge} role="list" aria-label={`Werkzeuge: ${sektionTitel}`}>
      {werkzeuge.map((werkzeug) => {
        const knopf = werkzeug.aktion === "starten" ? "Starten" : "Öffnen"
        return (
          <li key={werkzeug.href} className={styles.werkzeug}>
            <div className={styles.werkzeugKopf}>
              <span className={styles.werkzeugIcon} aria-hidden="true">
                {werkzeug.icon}
              </span>
              <h3 className={styles.werkzeugTitel}>
                {werkzeug.titel}
              </h3>
            </div>
            <p className={styles.kurz}>{werkzeug.kurz}</p>
            {(werkzeug.hinweis || werkzeug.gesperrt || werkzeug.bestwert) && (
              <p className={styles.zustand}>
                {werkzeug.gesperrt && <span className={`status ${styles.nurPro}`}>Nur mit Pro</span>}
                {werkzeug.hinweis && <span className={styles.quiz}>{werkzeug.hinweis}</span>}
                {werkzeug.bestwert && (
                  <span className={styles.quiz}>
                    Bestwert {werkzeug.bestwert.punkte} Punkte ·{" "}
                    <span aria-hidden="true">
                      {"★".repeat(werkzeug.bestwert.sterne)}
                      {"☆".repeat(Math.max(0, 3 - werkzeug.bestwert.sterne))}
                    </span>
                    <span className="sr-only">{werkzeug.bestwert.sterne} von 3 Sternen</span>
                  </span>
                )}
              </p>
            )}
            {/* Gewoehnlicher Link: Leitstand und Prüfungssimulator haben eigene Layouts und laden neu */}
            <a
              className={`btn ${werkzeug.gesperrt ? "" : "primary"} ${styles.werkzeugKnopf}`}
              href={werkzeug.href}
            >
              {knopf}
              <span className="sr-only">: {werkzeug.titel}</span>
              {werkzeug.gesperrt && <span className="sr-only"> (nur mit Pro)</span>}
              <span aria-hidden="true">→</span>
            </a>
          </li>
        )
      })}
    </ul>
  )
}
