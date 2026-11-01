// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// app/(architektur-leitstand)/layout.tsx
// Rahmen des Architektur-Leitstands wie app/(leitstand)/layout.tsx: Login-Pruefung serverseitig, Zugang nur fuer
// Pro und Admin (hasLeitstandAccess, gleiche Pruefung wie die API), Free-Konten sehen den Upgrade-Hinweis.
// Akzent des Fachs AVSW (data-fach="avsw"), breit bis 1'280 px. Lernpfad-CSS und Zeichen-Engine
// (public/lernpfad/architektur.css und .js) werden hier eingebunden; die Engine laeuft ohne lernpfad.js
// (sie nutzt window.Lernpfad nur fuer Formeln, die der Leitstand nicht braucht).

import Script from "next/script"
import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/auth"
import { hasLeitstandAccess } from "@/lib/leitstand"
import ThemaWahl, { ThemaStart } from "@/components/features/lernseiten/ThemaWahl"
import UpgradePrompt from "@/components/features/UpgradePrompt"
import styles from "./architektur-leitstand.module.css"

export const metadata = {
  title: "Architektur-Leitstand",
  robots: "noindex, nofollow",
}

export default async function ArchitekturLeitstandLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()
  if (!user?.id) {
    redirect("/login")
  }
  const erlaubt = await hasLeitstandAccess({ id: user.id, email: user.email })

  return (
    <>
      <ThemaStart />
      {/* Baukasten- und Engine-CSS wie im Leitstand als <link> im Body */}
      {/* eslint-disable-next-line @next/next/no-css-tags */}
      <link rel="stylesheet" href="/lernpfad/lernpfad.css" />
      {/* eslint-disable-next-line @next/next/no-css-tags */}
      <link rel="stylesheet" href="/lernpfad/architektur.css" />
      <div lang="de-CH" className={styles.seite} data-fach="avsw">
        <div className={`kopfleiste ${styles.kopfleiste}`}>
          <nav aria-label="Lernassistent">
            {/* Gewoehnlicher Link: die Lernpfad-Seite laedt neu */}
            <a className="kopf-zurueck" href="/lernseiten/avsw">
              ← Lernpfad AVSW
            </a>
          </nav>
          <ThemaWahl />
        </div>
        <main className={`wrap ${styles.wrap}`}>
          {erlaubt ? (
            children
          ) : (
            <UpgradePrompt
              title="Architektur-Leitstand freischalten"
              description="Der Architektur-Leitstand, der Simulator des Lernpfads AVSW, ist im Pro-Plan enthalten. Mit Pro steuerst du Architekturen durch Lastspitzen und Ausfälle, modellierst selbst und erhältst Punkte, Sterne und Abzeichen."
            />
          )}
        </main>
      </div>
      {erlaubt && <Script src="/lernpfad/architektur.js" strategy="afterInteractive" />}
    </>
  )
}
