// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// app/(dashboard)/lernseiten/page.tsx
// Liste aller Faecher mit Lernseiten (Kacheln wie bei den Decks) und darunter die Simulatoren
// (Leitstand, IPMA-Prüfungssimulator). Bewusst hier statt in Sidebar/BottomNav: die Mobile-Leiste
// hat schon acht Einträge, und beide Simulatoren gehören zum Lernpfad PMGT.

import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/auth"
import { ladeFaecher } from "@/lib/lernseiten"
import LernseiteKarte from "@/components/features/lernseiten/LernseiteKarte"

const SIMULATOREN = [
  {
    href: "/leitstand",
    icon: "⚑",
    titel: "Leitstand",
    text: "Projektsimulator: ein Projekt selbst planen, führen und steuern.",
    zusatz: "Im Pro-Plan",
  },
  {
    href: "/ipma",
    icon: "🎯",
    titel: "IPMA-Prüfungssimulator",
    text: "Übungsprüfungen und Training für IPMA Level D.",
    zusatz: null,
  },
] as const

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

      <section aria-labelledby="simulatoren-titel" className="space-y-3">
        <div>
          <h2 id="simulatoren-titel" className="text-xl font-extrabold text-text-dark">
            Simulatoren
          </h2>
          <p className="text-text-light text-sm mt-1">Zum Lernpfad Projektmanagement (PMGT).</p>
        </div>
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4" role="list">
          {SIMULATOREN.map((sim) => (
            <li key={sim.href}>
              {/* Gewoehnlicher Link: Leitstand und Prüfungssimulator haben eigene Layouts */}
              <a
                href={sim.href}
                className="group flex items-start gap-4 h-full bg-surface-card rounded-2xl shadow-card hover:shadow-card-hover transition-all duration-200 hover:-translate-y-1 p-5 border-t-8"
                style={{ borderTopColor: "#FF9600" }}
              >
                <span className="text-3xl leading-none" aria-hidden="true">
                  {sim.icon}
                </span>
                <span className="min-w-0">
                  <span className="block font-extrabold text-text-dark text-lg group-hover:text-primary transition-colors">
                    {sim.titel}
                  </span>
                  <span className="block text-sm text-text mt-0.5">{sim.text}</span>
                  {sim.zusatz && <span className="block text-sm text-text-light mt-1">{sim.zusatz}</span>}
                </span>
              </a>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
