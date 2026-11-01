// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// app/(lernpfad)/lernseiten/[fach]/page.tsx
// Lernpfad eines Fachs: alle Stationen nach Sektion als Pfad, mit dem Fortschritt des
// eingeloggten Kontos. Reihenfolge, Titel und Sektionen kommen aus fach.json (lib/lernseiten.ts),
// der Fortschritt aus dem Modell Lernfortschritt (gleiche Daten wie GET /api/lernfortschritt).

import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { ladeFach, type StationMitStatus } from "@/lib/lernseiten"
import styles from "../../lernpfad.module.css"

export const dynamic = "force-dynamic"

interface LernpfadPageProps {
  params: Promise<{ fach: string }>
}

type Zustand = "erledigt" | "begonnen" | "offen" | "folgt"

interface Eintrag {
  status: string
  quizRichtig: number | null
  quizGesamt: number | null
}

interface StationAnzeige extends StationMitStatus {
  nummer: number
  zustand: Zustand
  quiz: { richtig: number; gesamt: number } | null
}

/** Kuerzerer Titel fuer die Ueberschrift, wo der Titel aus fach.json den Studiengang enthaelt. */
const KURZTITEL: Record<string, string> = {
  mstw: "Mathematik und Statistik",
  pmgt: "Projektmanagement",
  ps: "PowerShell",
}

/** Status-Texte wie in der Abschluss-Box der Themenseiten (lernpfad.js). */
const ZUSTAND_TEXT: Record<Zustand, { symbol: string; text: string }> = {
  erledigt: { symbol: "✓", text: "Erledigt" },
  begonnen: { symbol: "◐", text: "Begonnen" },
  offen: { symbol: "○", text: "Offen" },
  folgt: { symbol: "…", text: "Folgt" },
}

export async function generateMetadata({ params }: LernpfadPageProps): Promise<Metadata> {
  // Next loest Metadaten auch bei einer Weiterleitung auf: ohne Login keine Inhalte lesen.
  const basis: Metadata = { robots: { index: false, follow: false } }
  if (!(await getCurrentUser())) return { ...basis, title: "Lernpfad" }
  const { fach } = await params
  const geladen = ladeFach(fach)
  return { ...basis, title: geladen ? `Lernpfad ${geladen.fach.kuerzel}` : "Seite nicht gefunden" }
}

/** Fortschritt des Kontos pro Thema oder null, wenn die Datenbank nicht antwortet. */
async function ladeFortschritt(userId: string, fach: string): Promise<Map<string, Eintrag> | null> {
  try {
    const eintraege = await prisma.lernfortschritt.findMany({
      where: { userId, fach },
      select: { thema: true, status: true, quizRichtig: true, quizGesamt: true },
    })
    return new Map(eintraege.map(({ thema, ...eintrag }) => [thema, eintrag]))
  } catch (error) {
    console.error("[lernpfad/fortschritt]", error)
    return null
  }
}

function zustandVon(station: StationMitStatus, eintrag: Eintrag | undefined): Zustand {
  // «erledigt» zeigen wir auch, falls die Datei inzwischen fehlt: die Zaehlung bleibt stimmig
  if (eintrag?.status === "erledigt") return "erledigt"
  if (!station.verfuegbar) return "folgt"
  return eintrag?.status === "begonnen" ? "begonnen" : "offen"
}

function quizVon(eintrag: Eintrag | undefined): StationAnzeige["quiz"] {
  if (!eintrag || eintrag.quizRichtig === null || eintrag.quizGesamt === null || eintrag.quizGesamt <= 0) {
    return null
  }
  return { richtig: eintrag.quizRichtig, gesamt: eintrag.quizGesamt }
}

function anzahl(n: number, einzahl: string, mehrzahl: string): string {
  return `${n} ${n === 1 ? einzahl : mehrzahl}`
}

export default async function LernpfadPage({ params }: LernpfadPageProps) {
  // Auch hier pruefen: Layouts laufen bei Navigation innerhalb der App nicht neu.
  const user = await getCurrentUser()

  // user.id statt nur user: die Prisma-Abfrage unten braucht eine gueltige Konto-ID
  if (!user?.id) {
    redirect("/login")
  }

  const { fach: fachParam } = await params
  const geladen = ladeFach(fachParam)

  if (!geladen) {
    notFound()
  }

  const { fach, pfad } = geladen
  const fortschritt = await ladeFortschritt(user.id, fach.slug)

  const stationen: StationAnzeige[] = pfad.map((station, index) => {
    const eintrag = fortschritt?.get(station.slug)
    return { ...station, nummer: index + 1, zustand: zustandVon(station, eintrag), quiz: quizVon(eintrag) }
  })

  const gesamt = stationen.length
  const erledigt = stationen.filter((s) => s.zustand === "erledigt").length
  const begonnen = stationen.filter((s) => s.zustand === "begonnen").length
  const verfuegbar = stationen.filter((s) => s.verfuegbar).length
  const prozent = gesamt > 0 ? Math.round((erledigt / gesamt) * 1000) / 10 : 0
  const weiter = stationen.find((s) => s.verfuegbar && s.zustand !== "erledigt")
  // Auf halbe Stunden gerundet, Dezimalpunkt wie auf den Themenseiten
  const stunden = Math.round(stationen.reduce((summe, s) => summe + s.dauer_min, 0) / 30) / 2

  const titel = KURZTITEL[fach.slug] ?? fach.titel
  const sektionen = fach.sektionen
    .map((sektion) => ({ ...sektion, stationen: stationen.filter((s) => s.sektion === sektion.id) }))
    .filter((sektion) => sektion.stationen.length > 0)

  return (
    <>
      <header className="stack">
        <span className="eyebrow">
          {fach.kuerzel} · {fach.semester}
        </span>
        <h1>Lernpfad {titel}</h1>
        <p className="lead">
          {fach.beschreibung} {anzahl(gesamt, "Station", "Stationen")}, zusammen rund {stunden} Stunden. Geh sie
          der Reihe nach durch. Jede Station endet mit einem Selbsttest.
        </p>
      </header>

      <section aria-labelledby="stand-titel">
        <h2 id="stand-titel">Dein Stand</h2>
        <div className={`card stack ${styles.stand}`}>
          <p className={styles.standZahl}>
            <strong>{erledigt}</strong> von {gesamt} Stationen erledigt
          </p>
          <div className={styles.balken} aria-hidden="true">
            <div className={styles.balkenFuellung} style={{ width: `${prozent}%` }} />
          </div>
          <p className="hint">
            {begonnen > 0 && <>{anzahl(begonnen, "Station", "Stationen")} begonnen · </>}
            {verfuegbar === gesamt
              ? "Alle Stationen sind bereit."
              : `${verfuegbar} von ${gesamt} Stationen sind bereit, die übrigen folgen.`}
          </p>
          {fortschritt === null && (
            <p className={`hint ${styles.fehler}`} role="status">
              Dein Fortschritt konnte gerade nicht geladen werden. Lade die Seite später nochmals.
            </p>
          )}
          {weiter ? (
            <div className="row">
              <a className={`btn primary ${styles.weiter}`} href={`/lernseiten/${fach.slug}/${weiter.slug}`}>
                Weiter bei: {weiter.nummer} · {weiter.titel} <span aria-hidden="true">→</span>
              </a>
            </div>
          ) : (
            <p>
              {erledigt === gesamt
                ? "Du hast alle Stationen erledigt. Wiederhole einzelne Stationen vor der Prüfung."
                : verfuegbar === 0
                  ? "Die ersten Stationen folgen bald."
                  : "Du hast alle bereiten Stationen erledigt. Die nächsten folgen bald."}
            </p>
          )}
        </div>
      </section>

      {sektionen.map((sektion) => {
        const sektionErledigt = sektion.stationen.filter((s) => s.zustand === "erledigt").length
        return (
          <section key={sektion.id} aria-labelledby={`sektion-${sektion.id}`}>
            <span className="eyebrow">
              {anzahl(sektion.stationen.length, "Station", "Stationen")} · {sektionErledigt} erledigt
            </span>
            <h2 id={`sektion-${sektion.id}`}>{sektion.titel}</h2>
            {/* role="list": Safari liest Listen ohne Aufzaehlungszeichen sonst nicht als Liste vor */}
            <ol className={styles.pfad} role="list" start={sektion.stationen[0].nummer}>
              {sektion.stationen.map((station) => {
                const istWeiter = station.slug === weiter?.slug
                const klassen = [
                  styles.station,
                  styles[station.zustand],
                  station.verfuegbar ? styles.verfuegbar : "",
                  istWeiter ? styles.aktuell : "",
                ]
                  .filter(Boolean)
                  .join(" ")
                const zustandText = ZUSTAND_TEXT[station.zustand]
                return (
                  <li key={station.slug} className={klassen}>
                    <span className={styles.knoten} aria-hidden="true">
                      {station.zustand === "erledigt" ? "✓" : station.nummer}
                    </span>
                    <div className={styles.karte}>
                      {istWeiter && <span className={styles.hierWeiter}>Hier geht es weiter</span>}
                      <h3 className={styles.stationTitel}>
                        {station.verfuegbar ? (
                          <a
                            className={styles.stationLink}
                            href={`/lernseiten/${fach.slug}/${station.slug}`}
                            aria-current={istWeiter ? "step" : undefined}
                          >
                            <span className="sr-only">Station {station.nummer}: </span>
                            {station.titel}
                          </a>
                        ) : (
                          <>
                            <span className="sr-only">Station {station.nummer}: </span>
                            {station.titel}
                          </>
                        )}
                      </h3>
                      <p className={styles.meta}>
                        <span>Vorlesung {station.vorlesung}</span>
                        <span>{station.dauer_min} min</span>
                      </p>
                      <p className={styles.kurz}>{station.kurz}</p>
                      <p className={styles.zustand}>
                        <span
                          className={
                            station.zustand === "folgt" ? `status ${styles.statusFolgt}` : `status ${station.zustand}`
                          }
                        >
                          <span aria-hidden="true">{zustandText.symbol}</span> {zustandText.text}
                        </span>
                        {station.quiz && (
                          <span className={styles.quiz}>
                            Selbsttest: {station.quiz.richtig} / {station.quiz.gesamt} richtig
                          </span>
                        )}
                      </p>
                    </div>
                  </li>
                )
              })}
            </ol>
          </section>
        )
      })}

      <section aria-labelledby="hinweis-titel">
        <h2 id="hinweis-titel">So entsteht dein Fortschritt</h2>
        <ul className={`prose ${styles.hinweisListe}`}>
          <li>
            <b>Begonnen:</b> Sobald du eine Station öffnest, gilt sie als begonnen.
          </li>
          <li>
            <b>Selbsttest:</b> Beantworte am Ende der Station alle Fragen. Dein letztes Ergebnis steht hier bei der
            Station.
          </li>
          <li>
            <b>Erledigt:</b> Klick am Ende der Station auf «Thema als erledigt markieren». Erledigt bleibt erledigt,
            auch wenn du die Station später wiederholst.
          </li>
          <li>Dein Fortschritt gehört zu deinem Konto und gilt auf jedem Gerät, auf dem du eingeloggt bist.</li>
        </ul>
      </section>
    </>
  )
}
