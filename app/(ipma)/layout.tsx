// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// app/(ipma)/layout.tsx
// Rahmen des IPMA-Prüfungssimulators (Spezifikation 6.8) wie der Leitstand: Lernpfad-Baukasten, breit,
// Akzent PMGT. Login-Prüfung serverseitig; Zugang für alle eingeloggten Konten (Entscheid 9.1).
// Die Claude-Bewertung prüft die API (nur Pro/Admin). middleware.ts bleibt unverändert.

import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/auth"
import ThemaWahl, { ThemaStart } from "@/components/features/lernseiten/ThemaWahl"
import styles from "./ipma.module.css"

export const metadata = {
  title: "IPMA-Prüfungssimulator",
  robots: "noindex, nofollow",
}

export default async function IpmaLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()
  if (!user?.id) {
    redirect("/login")
  }

  return (
    <>
      <ThemaStart />
      {/* Baukasten-CSS wie im Lernpfad-Layout als <link> im Body (Begründung dort) */}
      {/* eslint-disable-next-line @next/next/no-css-tags */}
      <link rel="stylesheet" href="/lernpfad/lernpfad.css" />
      <div lang="de-CH" className={styles.seite} data-fach="pmgt">
        <div className={`kopfleiste ${styles.kopfleiste}`}>
          <nav aria-label="Lernassistent" className={styles.kopfNav}>
            {/* Gewöhnlicher Link: die Lernpfad-Seite lädt neu */}
            <a className="kopf-zurueck" href="/lernseiten/pmgt">
              ← Lernpfad PMGT
            </a>
            <a className="kopf-zurueck" href="/ipma">
              Prüfungssimulator
            </a>
          </nav>
          <ThemaWahl />
        </div>
        <main className={`wrap ${styles.wrap}`}>{children}</main>
      </div>
    </>
  )
}
