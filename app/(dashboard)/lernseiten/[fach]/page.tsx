// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// app/(dashboard)/lernseiten/[fach]/page.tsx
// Fachuebersicht: Themen gruppiert nach Sektion plus gesammelter Spickzettel.

import Link from "next/link"
import { redirect, notFound } from "next/navigation"
import { getCurrentUser } from "@/lib/auth"
import { ladeFach, ladeSpickzettel } from "@/lib/lernseiten"
import Spickzettel from "@/components/features/lernseiten/Spickzettel"

interface FachPageProps {
  params: Promise<{ fach: string }>
}

export async function generateMetadata({ params }: FachPageProps) {
  const { fach } = await params
  const ergebnis = ladeFach(fach)
  return { title: ergebnis?.fach.kuerzel ?? "Lernseite" }
}

export default async function FachPage({ params }: FachPageProps) {
  const user = await getCurrentUser()

  if (!user) {
    redirect("/login")
  }

  const { fach: fachParam } = await params
  const ergebnis = ladeFach(fachParam)

  if (!ergebnis) {
    notFound()
  }

  const { fach, themen } = ergebnis
  const spickzettel = ladeSpickzettel(fach.slug)

  return (
    <div className="space-y-8">
      <nav aria-label="Brotkrumen" className="text-sm text-text-light">
        <Link href="/lernseiten" className="hover:text-secondary-dark">
          Lernseiten
        </Link>
        <span aria-hidden="true"> › </span>
        <span className="text-text">{fach.kuerzel}</span>
      </nav>

      <header className="flex items-start gap-4">
        <span className="text-5xl font-extrabold leading-none" style={{ color: fach.farbe }} aria-hidden="true">
          {fach.icon}
        </span>
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-text-dark">{fach.kuerzel}</h1>
          <p className="font-semibold text-text">{fach.titel}</p>
          <p className="text-sm text-text-light mt-1">
            {fach.beschreibung} · {fach.semester}
          </p>
        </div>
      </header>

      {fach.sektionen.map((sektion) => {
        const sektionsThemen = themen.filter((t) => t.sektion === sektion.id)
        return (
          <section key={sektion.id} aria-labelledby={`sektion-${sektion.id}`} className="space-y-3">
            <h2 id={`sektion-${sektion.id}`} className="text-lg font-extrabold text-text-dark">
              {sektion.titel}
            </h2>
            {sektionsThemen.length > 0 ? (
              <ul className="space-y-2">
                {sektionsThemen.map((thema) => (
                  <li key={thema.slug}>
                    <Link
                      href={`/lernseiten/${fach.slug}/${thema.slug}`}
                      className="group flex items-center gap-4 bg-surface-card rounded-2xl shadow-card hover:shadow-card-hover transition-all px-5 py-4"
                    >
                      <span
                        className="w-10 h-10 rounded-xl flex items-center justify-center font-extrabold text-white flex-shrink-0"
                        style={{ backgroundColor: fach.farbe }}
                      >
                        {thema.slug.slice(0, 2)}
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block font-extrabold text-text-dark group-hover:text-primary transition-colors">
                          {thema.titel}
                        </span>
                        <span className="block text-sm text-text-light truncate">
                          {thema.vorlesung} · {thema.lernziele[0]}
                        </span>
                      </span>
                      <span className="text-sm font-bold text-text-light whitespace-nowrap">
                        {thema.dauer_min} min
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-text-light">Noch keine Themen.</p>
            )}
          </section>
        )
      })}

      {spickzettel.length > 0 && (
        <section aria-labelledby="spickzettel" className="space-y-3">
          <h2 id="spickzettel" className="text-lg font-extrabold text-text-dark">
            Spickzettel
          </h2>
          <Spickzettel eintraege={spickzettel} fachSlug={fach.slug} />
        </section>
      )}
    </div>
  )
}
