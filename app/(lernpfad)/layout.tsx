// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// app/(lernpfad)/layout.tsx
// Ganzseitiger Rahmen im Design des Lernpfad-Baukastens (ohne App-Seitenleiste).
// Prueft die Session serverseitig — ohne Login Weiterleitung zum Login.
// Die Themenseiten selbst (route.ts) sind fertige HTML-Dateien und nutzen dieses Layout nicht.

import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/auth"
import ThemaWahl, { ThemaStart } from "@/components/features/lernseiten/ThemaWahl"
import styles from "./lernpfad.module.css"

export default async function LernpfadLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getCurrentUser()

  if (!user) {
    redirect("/login")
  }

  return (
    <>
      <ThemaStart />
      {/*
        Baukasten-CSS als gewoehnliches <link> im Body, bewusst nicht ueber den CSS-Import von Next:
        - Die Datei gehoert auch zu den reinen HTML-Themenseiten und laedt fonts.css relativ nach.
        - Ohne `precedence` haengt React den Link nicht in den <head>. Er verschwindet mit dem
          Layout, die globalen Regeln (body, h1, a …) wirken also nie auf die App-Seiten.
        - Er steht nach den App-Stilen und gewinnt so gegen globals.css; Tailwind-Stile liegen
          in Cascade-Layern und verlieren ohnehin gegen lernpfad.css.
      */}
      {/* eslint-disable-next-line @next/next/no-css-tags */}
      <link rel="stylesheet" href="/lernpfad/lernpfad.css" />
      <div lang="de-CH" className={styles.seite}>
        <div className="kopfleiste">
          <nav aria-label="Lernassistent">
            {/* Gewoehnlicher Link: die App-Seite laedt neu und startet ohne Baukasten-Stile */}
            <a className="kopf-zurueck" href="/lernseiten">
              ← Lernassistent
            </a>
          </nav>
          <ThemaWahl />
        </div>
        <main className="wrap">{children}</main>
      </div>
    </>
  )
}
