// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// app/(leitstand)/layout.tsx
// Rahmen des Leitstands (Spezifikation 4.8) wie app/(lernpfad)/layout.tsx, aber breit (bis 1'280 px)
// und mit dem Akzent des Fachs PMGT. Login-Pruefung serverseitig; Zugang nur fuer Pro und Admin (Abschnitt 7).
// Free-Konten sehen den bestehenden Upgrade-Hinweis. middleware.ts bleibt unveraendert.

import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/auth"
import { hasLeitstandAccess } from "@/lib/leitstand"
import ThemaWahl, { ThemaStart } from "@/components/features/lernseiten/ThemaWahl"
import UpgradePrompt from "@/components/features/UpgradePrompt"
import styles from "./leitstand.module.css"

export const metadata = {
  title: "Leitstand · Projektsimulator",
  robots: "noindex, nofollow",
}

export default async function LeitstandLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()
  if (!user?.id) {
    redirect("/login")
  }
  // Gleiche Pruefung wie die API (Pro nicht abgelaufen oder Admin), siehe lib/leitstand.ts
  const allowed = await hasLeitstandAccess({ id: user.id, email: user.email })

  return (
    <>
      <ThemaStart />
      {/* Baukasten-CSS wie im Lernpfad-Layout als <link> im Body (Begruendung dort) */}
      {/* eslint-disable-next-line @next/next/no-css-tags */}
      <link rel="stylesheet" href="/lernpfad/lernpfad.css" />
      <div lang="de-CH" className={styles.seite} data-fach="pmgt">
        <div className={`kopfleiste ${styles.kopfleiste}`}>
          <nav aria-label="Lernassistent">
            {/* Gewoehnlicher Link: die Lernpfad-Seite laedt neu */}
            <a className="kopf-zurueck" href="/lernseiten/pmgt">
              ← Lernpfad PMGT
            </a>
          </nav>
          <ThemaWahl />
        </div>
        <main className={`wrap ${styles.wrap}`}>
          {allowed ? (
            children
          ) : (
            <UpgradePrompt
              title="Leitstand freischalten"
              description="Der Leitstand, der Projektsimulator des Lernpfads PMGT, ist im Pro-Plan enthalten. Mit Pro planst, führst und steuerst du Projekte der öffentlichen Verwaltung, etwa den Onlineschalter Wolkenried oder den Stipendien-Assistenten Hochmatt, und erhältst Punkte, Sterne und Abzeichen."
            />
          )}
        </main>
      </div>
    </>
  )
}
