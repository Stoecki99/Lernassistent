// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

"use client"

// components/features/architektur-leitstand/Modellierphase.tsx
// Modellierphase (Missionen mit Modellierauftrag): Auftrag mit markierbaren Textstellen (data-baustein),
// Engine-Editor mit der Palette der Mission (vorgegebene Elemente fest), Live-Prüfung mit validiere
// (Lauffähigkeit und Anforderungen als Checkliste ✓/✗). Entwurf bleibt im Browser gesichert.
// «Lasttest starten» speichert das Modell beim Server (danach ist es fest).

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { validiere, type ArchModell, type Mission } from "@/lib/archsim"
import styles from "@/app/(architektur-leitstand)/architektur-leitstand.module.css"
import { useEngine, type EditorHandle } from "./engine"
import HtmlText from "./HtmlText"
import Dialog from "./Dialog"
import { bausteineIm } from "./html"
import { editorModellBereinigen } from "./logik"

function entwurfSchluessel(laufId: string): string {
  return `archsim-entwurf-${laufId}`
}

function entwurfLesen(laufId: string): ArchModell | null {
  try {
    const roh = window.localStorage.getItem(entwurfSchluessel(laufId))
    return roh ? editorModellBereinigen(JSON.parse(roh) as unknown) : null
  } catch {
    return null
  }
}

function entwurfSchreiben(laufId: string, m: ArchModell | null): void {
  try {
    if (m) window.localStorage.setItem(entwurfSchluessel(laufId), JSON.stringify(m))
    else window.localStorage.removeItem(entwurfSchluessel(laufId))
  } catch {
    // ohne Speicher gilt der Entwurf bis zum Neuladen
  }
}

export default function Modellierphase({
  mission,
  laufId,
  startModell,
  onFertig,
  gesperrt,
}: {
  mission: Mission
  laufId: string
  /** Modell vom Server (Wiederholung oder zurück zum Bearbeiten) */
  startModell: ArchModell | null
  /** Modell speichern; liefert eine Fehlermeldung oder null */
  onFertig: (m: ArchModell) => Promise<string | null>
  gesperrt: string | null
}) {
  const { engine, fehler: engineFehler } = useEngine()
  const flaeche = useRef<HTMLDivElement>(null)
  const editor = useRef<EditorHandle | null>(null)
  const [modell, setModell] = useState<ArchModell>(() => startModell ?? mission.modell)
  const [markiert, setMarkiert] = useState<string[]>([])
  const [frage, setFrage] = useState<"start" | "zuruecksetzen" | null>(null)
  const [laedt, setLaedt] = useState(false)
  const [meldung, setMeldung] = useState<string | null>(null)
  const auftrag = mission.auftrag ?? ""
  const bausteine = useMemo(() => bausteineIm(auftrag), [auftrag])

  // Editor einmal anlegen; der Editor hält das Modell, onChange meldet jede Änderung
  useEffect(() => {
    const el = flaeche.current
    if (!engine || !el || editor.current) return
    const start = startModell ?? entwurfLesen(laufId) ?? mission.modell
    setModell(start)
    editor.current = engine.editor(el, {
      palette: (mission.palette ?? []).map((p) => ({ id: p.id, typ: p.typ, name: p.name, technologie: p.technologie })),
      modell: start,
      fest: mission.modell.elemente.map((e) => e.id),
      raster: { spalten: 7, zeilen: 4 },
      breit: false,
      onChange: (roh: unknown) => {
        const m = editorModellBereinigen(roh)
        setModell(m)
        entwurfSchreiben(laufId, m)
      },
    })
  }, [engine, mission, laufId, startModell])

  const v = useMemo(() => validiere(mission, modell), [mission, modell])
  const offen = v.anforderungen.filter((a) => !a.erfuellt)
  const imModell = useMemo(() => new Set(modell.elemente.map((e) => e.id)), [modell])

  const umschalten = useCallback(
    (id: string) => {
      setMarkiert((m) => (m.includes(id) ? m.filter((x) => x !== id) : [...m, id]))
      if (imModell.has(id)) {
        editor.current?.markiere([], undefined)
        editor.current?.markiere([id], "ar-markiert")
      }
    },
    [imModell],
  )

  const starten = async () => {
    setFrage(null)
    setLaedt(true)
    setMeldung(null)
    const f = await onFertig(modell)
    setLaedt(false)
    if (f) setMeldung(f)
    else entwurfSchreiben(laufId, null)
  }

  return (
    <div className={styles.modellieren}>
      <section className={`card ${styles.auftrag}`} aria-labelledby="al-auftrag-titel">
        <p className="eyebrow">Auftrag · {mission.firma}</p>
        <h2 id="al-auftrag-titel" className={styles.h2klein}>
          Modelliere die Architektur
        </h2>
        <p className="hint">
          Markiere im Text die Bausteine (antippen), setze sie aus der Palette auf die Fläche und verbinde sie mit der passenden Art (sync, async, Daten).
          Nicht jeder Baustein der Palette gehört in die Lösung.
        </p>
        <div className={styles.auftragText}>
          <HtmlText
            html={auftrag}
            onBaustein={umschalten}
            klasse={(id) =>
              [styles.baustein, markiert.includes(id) ? styles.bausteinMarkiert : "", imModell.has(id) ? styles.bausteinGesetzt : ""].filter(Boolean).join(" ")
            }
            zustand={(id) => [markiert.includes(id) ? "markiert" : "", imModell.has(id) ? "im Modell" : ""].filter(Boolean).join(", ")}
          />
        </div>
        <p className={styles.bausteinZaehler}>
          {bausteine.filter((b) => imModell.has(b)).length} von {bausteine.length} Bausteinen aus dem Text im Modell
        </p>
      </section>

      <div className={styles.modellierRaster}>
        <section className={`card ${styles.editorKarte}`} aria-label="Modellierfläche">
          {!engine && (
            <p className="hint" role="status">
              {engineFehler ? "Der Editor konnte nicht geladen werden. Lade die Seite neu." : "Editor wird geladen …"}
            </p>
          )}
          <div ref={flaeche} className={styles.editor} />
        </section>

        <aside className={`card ${styles.pruefung}`} aria-labelledby="al-pruefung-titel">
          <h3 id="al-pruefung-titel" className={styles.h3}>
            Prüfung live
          </h3>
          <p className={`${styles.pruefZeile} ${v.gueltig ? styles.pruefOk : styles.pruefFehlt}`}>
            <span aria-hidden="true">{v.gueltig ? "✓" : "✗"}</span> {v.gueltig ? "Lauffähig: Alle Anfragen erreichen ihr Ziel." : "Noch nicht lauffähig"}
          </p>
          {!v.gueltig && (
            <ul className={styles.pruefFehler}>
              {v.fehler.slice(0, 6).map((f, i) => (
                <li key={i}>{f}</li>
              ))}
            </ul>
          )}
          <h4 className={styles.h4}>
            Anforderungen ({v.anforderungen.length - offen.length} von {v.anforderungen.length})
          </h4>
          <ul className={styles.checkliste}>
            {v.anforderungen.map((a) => (
              <li key={a.id} className={a.erfuellt ? styles.checkOk : styles.checkOffen}>
                <span className={styles.checkSymbol} aria-hidden="true">
                  {a.erfuellt ? "✓" : "✗"}
                </span>
                <span>
                  <span className="sr-only">{a.erfuellt ? "erfüllt: " : "offen: "}</span>
                  {a.text}
                  {!a.erfuellt && v.gueltig && <span className={styles.checkHinweis}>{a.rueckmeldung}</span>}
                </span>
              </li>
            ))}
          </ul>
          {v.hinweise.length > 0 && (
            <details className={styles.hinweisListe}>
              <summary>{v.hinweise.length} Hinweise</summary>
              <ul>
                {v.hinweise.map((h, i) => (
                  <li key={i}>{h}</li>
                ))}
              </ul>
            </details>
          )}
          {meldung && (
            <p className={styles.sperrGrund} role="alert">
              ■ {meldung}
            </p>
          )}
          <div className={styles.pruefKnoepfe}>
            <button type="button" className="btn primary" disabled={!v.gueltig || laedt || gesperrt !== null} onClick={() => (offen.length > 0 ? setFrage("start") : void starten())}>
              {laedt ? "Wird gespeichert …" : "Lasttest starten"}
            </button>
            <button type="button" className="btn" onClick={() => setFrage("zuruecksetzen")} disabled={laedt}>
              Neu beginnen
            </button>
          </div>
          {gesperrt && <p className="hint">{gesperrt}</p>}
          <p className="hint">Nach dem Start ist das Modell fest; im Lasttest kannst du skalieren und Resilienz einstellen.</p>
        </aside>
      </div>

      {frage === "start" && (
        <Dialog titel="Lasttest trotzdem starten?" onEscape={() => setFrage(null)}>
          <p>
            {offen.length} {offen.length === 1 ? "Anforderung ist" : "Anforderungen sind"} noch nicht erfüllt. Das kostet je 75 Punkte, und der Lasttest
            zeigt dir, was fehlt.
          </p>
          <ul className={styles.pruefFehler}>
            {offen.map((a) => (
              <li key={a.id}>{a.text}</li>
            ))}
          </ul>
          <div className={styles.dialogKnoepfe}>
            <button type="button" className="btn" onClick={() => setFrage(null)}>
              Weiter modellieren
            </button>
            <button type="button" className="btn primary" onClick={() => void starten()}>
              Trotzdem starten
            </button>
          </div>
        </Dialog>
      )}
      {frage === "zuruecksetzen" && (
        <Dialog titel="Modell zurücksetzen?" onEscape={() => setFrage(null)}>
          <p>Dein Entwurf wird verworfen; nur die vorgegebenen Elemente bleiben.</p>
          <div className={styles.dialogKnoepfe}>
            <button type="button" className="btn" onClick={() => setFrage(null)}>
              Abbrechen
            </button>
            <button
              type="button"
              className="btn primary"
              onClick={() => {
                editor.current?.setzeModell(mission.modell)
                setModell(mission.modell)
                entwurfSchreiben(laufId, null)
                setMarkiert([])
                setFrage(null)
              }}
            >
              Zurücksetzen
            </button>
          </div>
        </Dialog>
      )}
    </div>
  )
}
