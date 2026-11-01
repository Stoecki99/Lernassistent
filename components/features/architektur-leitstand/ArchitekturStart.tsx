// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

"use client"

// components/features/architektur-leitstand/ArchitekturStart.tsx
// Missionswahl: Karten mit Schwierigkeit, Art, Lernzielen, Bausteinen, Bestwert und Sternen, «Fortsetzen»,
// Freischalten (nächste Mission ab einem Stern in der vorherigen), Fortschritt über alle Missionen, letzte Läufe.

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import styles from "@/app/(architektur-leitstand)/architektur-leitstand.module.css"
import { ApiFehler, archApi, type LaeufeAntwort } from "./api"
import Dialog from "./Dialog"

export interface MissionMeta {
  id: string
  nummer: number
  titel: string
  untertitel: string
  firma: string
  schwierigkeit: number
  art: "vorgegeben" | "modellieren"
  gefuehrt: boolean
  dauer: number
  budget: number
  p95Ms: number
  verfuegbarkeit: number
  lernziele: Array<{ text: string; link: string }>
  /** Kategorien der Elemente im Startmodell bzw. in der Palette (Farbpunkte) */
  bausteine: Array<{ name: string; kategorie: string }>
  ereignisse: number
}

const STATUS_TEXT: Record<string, string> = { aktiv: "läuft", abgeschlossen: "abgeschlossen", abgebrochen: "abgebrochen", veraltet: "veraltet" }

function Sterne({ n, gross = false }: { n: number; gross?: boolean }) {
  return (
    <span className={gross ? styles.sterneMittel : styles.sterneKlein} aria-label={`${n} von 3 Sternen`}>
      {[1, 2, 3].map((i) => (
        <span key={i} aria-hidden="true" className={i <= n ? styles.sternAn : styles.sternAus}>
          ★
        </span>
      ))}
    </span>
  )
}

export default function ArchitekturStart({ missionen }: { missionen: MissionMeta[] }) {
  const router = useRouter()
  const [daten, setDaten] = useState<LaeufeAntwort | null>(null)
  const [fehler, setFehler] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [frage, setFrage] = useState<MissionMeta | null>(null)

  useEffect(() => {
    let ab = false
    archApi
      .laeufe()
      .then((d) => {
        if (!ab) setDaten(d)
      })
      .catch((e: unknown) => {
        console.error("[architektur-leitstand]", e)
        if (!ab) setFehler(e instanceof ApiFehler && e.status === 403 ? e.message : "Die Läufe konnten nicht geladen werden. Bitte die Seite neu laden.")
      })
    return () => {
      ab = true
    }
  }, [])

  const starten = useCallback(
    async (m: MissionMeta, wiederholungVon?: string) => {
      setBusy(m.id)
      setFehler(null)
      try {
        const r = await archApi.starten(m.id, wiederholungVon)
        router.push(`/architektur-leitstand/${r.id}`)
      } catch (e) {
        console.error("[architektur-leitstand]", e)
        setFehler(e instanceof ApiFehler ? e.message : "Der Lauf konnte nicht gestartet werden.")
        setBusy(null)
      }
    },
    [router],
  )

  const sterneGesamt = daten?.missionen.reduce((s, m) => s + m.sterne, 0) ?? 0

  return (
    <>
      {fehler && (
        <p className={styles.fehlerText} role="alert">
          ■ {fehler}
        </p>
      )}

      <section className={`card ${styles.fortschritt}`} aria-label="Fortschritt über alle Missionen">
        <div className={styles.fortschrittKopf}>
          <h2 className={styles.h2klein}>Dein Weg durch den Leitstand</h2>
          <p className={styles.sternSumme}>
            <span aria-hidden="true">★</span> {sterneGesamt} von {missionen.length * 3} Sternen
          </p>
        </div>
        <ol className={styles.pfad}>
          {missionen.map((m) => {
            const st = daten?.missionen.find((x) => x.missionId === m.id)
            const frei = st?.freigeschaltet ?? m.nummer === 1
            return (
              <li key={m.id} className={`${styles.pfadPunkt} ${!frei ? styles.pfadGesperrt : st && st.sterne > 0 ? styles.pfadGeschafft : ""}`}>
                <span className={styles.pfadNummer} aria-hidden="true">
                  {frei ? m.nummer : "🔒"}
                </span>
                <span className={styles.pfadName}>{m.titel}</span>
                <Sterne n={st?.sterne ?? 0} />
              </li>
            )
          })}
        </ol>
      </section>

      <div className={styles.missionsRaster}>
        {missionen.map((m) => {
          const st = daten?.missionen.find((x) => x.missionId === m.id)
          const frei = st ? st.freigeschaltet : m.nummer === 1
          const aktiv = st?.aktiv ?? null
          const laeufe = daten?.laeufe.filter((l) => l.missionId === m.id) ?? []
          return (
            <article key={m.id} className={`card ${styles.missionKarte} ${styles[`stufe${m.schwierigkeit}`]} ${!frei ? styles.missionGesperrt : ""}`} aria-labelledby={`m-${m.id}`}>
              <div className={styles.missionBand} aria-hidden="true">
                {m.bausteine.map((b, i) => (
                  <span key={i} className={`${styles.bandPunkt} ar-k-${b.kategorie}`} />
                ))}
              </div>
              <p className="eyebrow">
                Mission {m.nummer} · {m.art === "modellieren" ? "selbst modellieren" : m.gefuehrt ? "geführt" : "Architektur vorgegeben"}
              </p>
              <h2 id={`m-${m.id}`} className={styles.missionTitel}>
                {m.titel}
              </h2>
              <p className={styles.missionUnter}>{m.untertitel}</p>
              <p className="hint">{m.firma}</p>
              <ul className={styles.fakten}>
                <li>
                  <span className={styles.schwierigkeit} aria-label={`Schwierigkeit ${m.schwierigkeit} von 3`}>
                    {[1, 2, 3].map((i) => (
                      <span key={i} aria-hidden="true" className={i <= m.schwierigkeit ? styles.sAn : styles.sAus}>
                        ●
                      </span>
                    ))}
                  </span>
                </li>
                <li>
                  <strong>{m.dauer}</strong> min
                </li>
                <li>
                  p95 ≤ <strong>{m.p95Ms}</strong> ms
                </li>
                <li>
                  ≥ <strong>{(m.verfuegbarkeit * 100).toLocaleString("de-CH", { maximumFractionDigits: 1 })}</strong> %
                </li>
                <li>
                  <strong>{m.budget}</strong> CHF
                </li>
              </ul>
              <details className={styles.lernzieleAuf}>
                <summary>Lernziele ({m.lernziele.length})</summary>
                <ul>
                  {m.lernziele.map((l, i) => (
                    <li key={i}>
                      <a href={l.link}>{l.text}</a>
                    </li>
                  ))}
                </ul>
              </details>

              {daten === null && !fehler ? (
                <p className="hint" role="status">
                  Stand wird geladen …
                </p>
              ) : (
                <>
                  {st?.bestwert && (
                    <p className={styles.bestwert}>
                      Bestwert <strong>{st.bestwert.score}</strong> Punkte <Sterne n={st.bestwert.stars} />
                    </p>
                  )}
                  {!frei ? (
                    <p className={styles.gesperrtText}>
                      <span aria-hidden="true">🔒 </span>Frei ab einem Stern in Mission {m.nummer - 1}.
                    </p>
                  ) : (
                    <div className="row">
                      {aktiv && (
                        <a className="btn primary" href={`/architektur-leitstand/${aktiv.laufId}`}>
                          Fortsetzen{aktiv.minute > 0 ? ` (Minute ${aktiv.minute})` : ""}
                        </a>
                      )}
                      <button type="button" className={`btn ${aktiv ? "" : "primary"}`} disabled={busy !== null} onClick={() => (aktiv ? setFrage(m) : void starten(m))}>
                        {busy === m.id ? "Wird gestartet …" : aktiv ? "Neu beginnen" : st?.bestwert ? "Nochmals spielen" : "Mission starten"}
                      </button>
                    </div>
                  )}
                  {laeufe.length > 0 && (
                    <details className={styles.laeufe}>
                      <summary>Letzte Läufe ({laeufe.length})</summary>
                      <ul>
                        {laeufe.slice(0, 6).map((l) => (
                          <li key={l.id} className={styles.laufZeile}>
                            <span>
                              {new Date(l.createdAt).toLocaleDateString("de-CH")} · {STATUS_TEXT[l.status] ?? l.status}
                              {l.score !== null ? ` · ${l.score} Punkte` : l.tick > 0 ? ` · Minute ${l.tick}` : ""}
                              {l.seedReused ? " · Wiederholung" : ""}
                            </span>
                            {(l.status === "abgeschlossen" || l.status === "aktiv") && (
                              <a className={`btn ${styles.klein}`} href={`/architektur-leitstand/${l.id}`}>
                                {l.status === "aktiv" ? "Öffnen" : "Nachbesprechung"}
                              </a>
                            )}
                            {l.status === "abgeschlossen" && frei && (
                              <button type="button" className={`btn ${styles.klein}`} disabled={busy !== null} onClick={() => void starten(m, l.id)}>
                                Gleicher Seed
                              </button>
                            )}
                          </li>
                        ))}
                      </ul>
                      <p className="hint">Wiederholungen mit gleichem Zufall zählen nicht für Bestwert, Punkte und Abzeichen.</p>
                    </details>
                  )}
                </>
              )}
            </article>
          )
        })}
      </div>

      {frage && (
        <Dialog titel="Laufenden Lauf abbrechen?" onEscape={() => setFrage(null)}>
          <p>In «{frage.titel}» läuft noch ein Lauf. Ein neuer Start bricht ihn ab; er lässt sich danach nicht mehr fortsetzen.</p>
          <div className={styles.dialogKnoepfe}>
            <button type="button" className="btn" onClick={() => setFrage(null)}>
              Abbrechen
            </button>
            <button
              type="button"
              className="btn primary"
              onClick={() => {
                const m = frage
                setFrage(null)
                void starten(m)
              }}
            >
              Ja, neu beginnen
            </button>
          </div>
        </Dialog>
      )}
    </>
  )
}
