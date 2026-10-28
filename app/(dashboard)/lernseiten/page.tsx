// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// app/(dashboard)/lernseiten/page.tsx
// Liste aller Faecher mit Lernseiten (Kacheln wie bei den Decks).

import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/auth"
import { ladeFaecher } from "@/lib/lernseiten"
import LernseiteKarte from "@/components/features/lernseiten/LernseiteKarte"

export const metadata = {
  title: "Lernseiten",
}

export default async function LernseitenPage() {
  const user = await getCurrentUser()

  if (!user) {
    redirect("/login")
  }

  const faecher = ladeFaecher()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-extrabold text-text-dark">Lernseiten</h1>
        <p className="text-text-light mt-1">
          Interaktive Erklärungen mit Lösungsschritten, Lösungsfilm und Selbsttest.
        </p>
      </div>

      {faecher.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {faecher.map((fach) => (
            <LernseiteKarte
              key={fach.slug}
              slug={fach.slug}
              kuerzel={fach.kuerzel}
              titel={fach.titel}
              icon={fach.icon}
              farbe={fach.farbe}
              anzahlThemen={fach.anzahlThemen}
            />
          ))}
        </div>
      ) : (
        <p className="text-text-light py-16 text-center">Noch keine Lernseiten vorhanden.</p>
      )}
    </div>
  )
}
