// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// app/(dashboard)/lernseiten/[fach]/[thema]/page.tsx
// Lernseite eines Themas. Reihenfolge fix: Bausteine, Loesungsschritte,
// Analyse (optional), Loesungsfilm, Selbsttest, Auf einen Blick.

import Link from "next/link"
import { redirect, notFound } from "next/navigation"
import type { ReactNode } from "react"
import { getCurrentUser } from "@/lib/auth"
import { ladeThema } from "@/lib/lernseiten"
import LernInhalt from "@/components/features/lernseiten/LernInhalt"
import Bausteine from "@/components/features/lernseiten/Bausteine"
import LoesungsStepper from "@/components/features/lernseiten/LoesungsStepper"
import Brille from "@/components/features/lernseiten/Brille"
import LoesungsFilm from "@/components/features/lernseiten/LoesungsFilm"
import Selbsttest from "@/components/features/lernseiten/Selbsttest"
import Merke from "@/components/features/lernseiten/Merke"

interface ThemaPageProps {
  params: Promise<{ fach: string; thema: string }>
}

export async function generateMetadata({ params }: ThemaPageProps) {
  // Next loest Metadaten auch bei einem Redirect auf: ohne Login keine Inhalte lesen.
  if (!(await getCurrentUser())) return { title: "Lernseite" }
  const { fach, thema } = await params
  const ergebnis = ladeThema(fach, thema)
  return {
    title: ergebnis ? `${ergebnis.seite.titel} — ${ergebnis.fach.kuerzel}` : "Lernseite",
  }
}

function Abschnitt({ id, titel, children }: { id: string; titel: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-titel`} className="scroll-mt-6 space-y-4">
      <h2 id={`${id}-titel`} className="text-xl font-extrabold text-text-dark">
        {titel}
      </h2>
      {children}
    </section>
  )
}

export default async function ThemaPage({ params }: ThemaPageProps) {
  const user = await getCurrentUser()

  if (!user) {
    redirect("/login")
  }

  const { fach: fachParam, thema: themaParam } = await params
  const thema = ladeThema(fachParam, themaParam)

  if (!thema) {
    notFound()
  }

  const { fach, seite, film, quiz } = thema

  const inhalt = [
    { id: "bausteine", titel: "Schritt 0 · Bausteine" },
    { id: "loesungsschritte", titel: "Lösungsschritte" },
    ...(seite.analyse ? [{ id: "analyse", titel: "Analyse" }] : []),
    { id: "loesungsfilm", titel: "Lösungsfilm" },
    { id: "selbsttest", titel: "Selbsttest" },
    { id: "auf-einen-blick", titel: "Auf einen Blick" },
  ]

  return (
    <article className="space-y-10">
      <div className="space-y-4">
        <nav aria-label="Brotkrumen" className="text-sm text-text-light">
          <Link href="/lernseiten" className="hover:text-secondary-dark">
            Lernseiten
          </Link>
          <span aria-hidden="true"> › </span>
          <Link href={`/lernseiten/${fach.slug}`} className="hover:text-secondary-dark">
            {fach.kuerzel}
          </Link>
        </nav>

        <header>
          <h1 className="text-2xl md:text-3xl font-extrabold text-text-dark">{seite.titel}</h1>
          <p className="text-sm text-text-light mt-1">
            {seite.vorlesung} · Bsp. {seite.beispiele.join(", ")} · {seite.dauer_min} min
          </p>
        </header>

        {!seite.musterloesung && (
          <p className="rounded-xl bg-accent/10 border-2 border-accent/30 px-4 py-3 text-sm font-semibold text-text-dark">
            Eigene Lösung, nicht vom Dozenten bestätigt.
          </p>
        )}

        <div className="bg-surface-card rounded-2xl shadow-card p-5">
          <p className="text-xs font-bold uppercase tracking-wide text-text-light mb-2">Lernziele</p>
          <ul className="list-disc pl-5 space-y-1 text-text">
            {seite.lernziele.map((ziel, i) => (
              <li key={i}>{ziel}</li>
            ))}
          </ul>
          {seite.einleitung && (
            <div className="mt-4 text-text">
              <LernInhalt inhalt={seite.einleitung} />
            </div>
          )}
        </div>

        <nav aria-label="Inhalt" className="flex flex-wrap gap-2 text-sm font-bold">
          {inhalt.map((eintrag) => (
            <a
              key={eintrag.id}
              href={`#${eintrag.id}`}
              className="px-3 py-1.5 rounded-full border-2 border-gray-200 text-text hover:border-secondary hover:text-secondary-dark"
            >
              {eintrag.titel}
            </a>
          ))}
        </nav>
      </div>

      <Abschnitt id="bausteine" titel="Schritt 0 · Bausteine">
        <Bausteine bausteine={seite.bausteine} />
      </Abschnitt>

      <Abschnitt id="loesungsschritte" titel="Lösungsschritte">
        <div className="rounded-2xl bg-secondary/10 border-2 border-secondary/20 p-5 text-text-dark">
          <LernInhalt inhalt={seite.schritte.muster} />
        </div>
        {seite.schritte.aufgaben.map((aufgabe) => (
          <LoesungsStepper key={aufgabe.id} aufgabe={aufgabe} methode={seite.schritte.methode} />
        ))}
      </Abschnitt>

      {seite.analyse && (
        <Abschnitt id="analyse" titel="Analyse">
          <Brille analyse={seite.analyse} />
        </Abschnitt>
      )}

      <Abschnitt id="loesungsfilm" titel="Lösungsfilm">
        <LoesungsFilm film={film} selbsttestAnker="selbsttest" />
      </Abschnitt>

      <Abschnitt id="selbsttest" titel="Selbsttest">
        <Selbsttest fragen={quiz} />
      </Abschnitt>

      <Abschnitt id="auf-einen-blick" titel="Auf einen Blick">
        <Merke saetze={seite.merke} />
      </Abschnitt>

      <div className="pt-2">
        <Link href={`/lernseiten/${fach.slug}`} className="font-bold text-secondary-dark hover:underline">
          ← Zurück zu {fach.kuerzel}
        </Link>
      </div>
    </article>
  )
}
