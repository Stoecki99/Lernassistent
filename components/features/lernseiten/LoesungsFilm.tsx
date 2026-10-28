// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

"use client"

// components/features/lernseiten/LoesungsFilm.tsx
// Die ganze Aufgabe am Stueck: Szenen mit Timer-Balken, Phasenleiste,
// Steuerung (Zurueck, Play/Pause, Vor, Schieber, Tempo) und Endbildschirm.
// Play springt sofort zur ersten inhaltlichen Szene.

import { useEffect, useId, useMemo, useRef, useState } from "react"
import type { Film } from "@/lib/validations/lernseite"
import {
  ersteInhaltsSzene,
  szenenAufloesen,
  szenenDauerMs,
  TEMPI,
  type Tempo,
} from "@/lib/lernseiten-film"
import LernInhalt from "@/components/features/lernseiten/LernInhalt"

const knopf =
  "min-w-[44px] min-h-[44px] px-3 rounded-xl border-2 font-bold transition-colors aria-disabled:opacity-40 aria-disabled:cursor-not-allowed"

const TEMPO_NAMEN: Record<Tempo, string> = { langsam: "Langsam", normal: "Normal", schnell: "Schnell" }

export default function LoesungsFilm({ film, selbsttestAnker }: { film: Film; selbsttestAnker: string }) {
  const szenen = useMemo(() => szenenAufloesen(film.szenen), [film.szenen])
  const ersteSzene = ersteInhaltsSzene(szenen)
  const buehneId = `film-${useId().replace(/[^a-zA-Z0-9]/g, "")}`

  const [index, setIndex] = useState(0)
  const [spielt, setSpielt] = useState(false)
  const [fertig, setFertig] = useState(false)
  const [tempo, setTempo] = useState<Tempo>("normal")

  // Fortschritt der aktuellen Szene (0..1) ohne Re-Render pro Frame.
  const anteilRef = useRef(0)
  const balkenRef = useRef<HTMLDivElement>(null)
  const playRef = useRef<HTMLButtonElement>(null)

  const szene = szenen[index]
  const letzte = szenen.length - 1

  function setzeAnteil(anteil: number) {
    anteilRef.current = anteil
    if (balkenRef.current) balkenRef.current.style.width = `${anteil * 100}%`
  }

  function geheZu(ziel: number) {
    setzeAnteil(0)
    setFertig(false)
    setIndex(Math.max(0, Math.min(letzte, ziel)))
  }

  function playPause() {
    if (spielt) {
      setSpielt(false)
      return
    }
    if (fertig || index < ersteSzene) geheZu(ersteSzene)
    setSpielt(true)
  }

  function nochmals() {
    geheZu(ersteSzene)
    setSpielt(true)
    // Der Knopf «Nochmals» verschwindet: Fokus auf Play/Pause setzen, damit er nicht verloren geht.
    playRef.current?.focus()
  }

  useEffect(() => {
    if (!spielt) return
    const dauer = szenenDauerMs(szenen[index].sage, tempo)
    const start = performance.now() - anteilRef.current * dauer
    let frame = 0

    const tick = (jetzt: number) => {
      const anteil = Math.min(1, (jetzt - start) / dauer)
      setzeAnteil(anteil)
      if (anteil < 1) {
        frame = requestAnimationFrame(tick)
        return
      }
      if (index < szenen.length - 1) {
        setzeAnteil(0)
        setIndex(index + 1)
      } else {
        setSpielt(false)
        setFertig(true)
      }
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [spielt, index, tempo, szenen])

  const sichtbareTexte =
    szene.text === null ? [] : szene.text === "alle" ? film.texte : [film.texte[szene.text]]
  const vorherWb = index > 0 ? szenen[index - 1].wb : 0

  return (
    <div className="bg-surface-card rounded-2xl shadow-card p-4 sm:p-6">
      {/* Phasenleiste */}
      <ol className="flex flex-wrap gap-2 text-xs font-bold mb-4" aria-label="Phasen">
        {film.phasen.map((phase, i) => (
          <li
            key={i}
            aria-current={i === szene.phase ? "step" : undefined}
            className={`px-2.5 py-1 rounded-full border-2 ${
              i === szene.phase
                ? "bg-secondary text-white border-secondary"
                : i < szene.phase
                  ? "border-secondary text-secondary-dark"
                  : "border-gray-200 text-text-light"
            }`}
          >
            {phase}
          </li>
        ))}
      </ol>

      {/* Buehne */}
      <div id={buehneId} className="space-y-3">
        {szene.hl.length > 0 && (
          <style>
            {szene.hl
              .map((id) => `#${buehneId} [data-ph="${id}"]`)
              .join(",") + "{background-color:#FEF08A;border-radius:3px;box-shadow:0 0 0 2px #FDE047;}"}
          </style>
        )}

        {sichtbareTexte.length > 0 && (
          <div className="rounded-xl bg-surface p-4 text-text-dark space-y-2">
            {sichtbareTexte.map((t, i) => (
              <LernInhalt key={i} inhalt={t} />
            ))}
          </div>
        )}

        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          <div className="rounded-xl border-2 border-gray-100 p-3 min-h-[3rem]">
            <p className="text-xs font-bold uppercase tracking-wide text-text-light mb-1">Wörterbuch</p>
            {szene.wb === 0 ? (
              <p className="text-sm text-text-light">—</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {film.woerterbuch.slice(0, szene.wb).map((eintrag, i) => (
                  <li
                    key={i}
                    className={`rounded-md px-2 py-0.5 ${
                      szene.wbAktiv.includes(i) ? "bg-secondary/15 font-semibold" : ""
                    } ${i >= vorherWb ? "animate-fade-in" : ""}`}
                  >
                    <LernInhalt inhalt={eintrag} inline />
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="rounded-xl border-2 border-secondary/30 p-4 text-lg overflow-x-auto min-h-[3rem] flex items-center">
            {szene.formel ? (
              <LernInhalt key={index} inhalt={szene.formel} />
            ) : (
              <span className="text-sm text-text-light">Formel entsteht hier.</span>
            )}
          </div>
        </div>

        <div className="text-text-dark min-h-[3rem]" aria-live="polite">
          <LernInhalt key={index} inhalt={szene.sage} className="animate-fade-in" />
        </div>
      </div>

      {/* Timer-Balken */}
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mt-4" aria-hidden="true">
        <div ref={balkenRef} className="h-full bg-secondary" style={{ width: "0%" }} />
      </div>

      {/* Steuerung */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => index > 0 && geheZu(index - 1)}
          aria-disabled={index === 0}
          aria-label="Vorherige Szene"
          className={`${knopf} border-gray-200 text-text hover:border-secondary`}
        >
          ‹
        </button>
        <button
          type="button"
          ref={playRef}
          onClick={playPause}
          className={`${knopf} border-secondary bg-secondary text-white hover:bg-secondary-dark px-5`}
        >
          {spielt ? "Pause" : "Abspielen"}
        </button>
        <button
          type="button"
          onClick={() => index < letzte && geheZu(index + 1)}
          aria-disabled={index === letzte}
          aria-label="Nächste Szene"
          className={`${knopf} border-gray-200 text-text hover:border-secondary`}
        >
          ›
        </button>

        <label className="flex-1 min-w-[8rem] flex items-center gap-2 text-sm text-text-light">
          <span className="sr-only">Szene wählen</span>
          <input
            type="range"
            min={0}
            max={letzte}
            value={index}
            onChange={(e) => geheZu(Number(e.target.value))}
            className="w-full accent-[#1CB0F6]"
          />
          <span className="whitespace-nowrap font-bold">
            {index + 1} / {szenen.length}
          </span>
        </label>

        <label className="flex items-center gap-1 text-sm font-bold text-text-light">
          Tempo
          <select
            value={tempo}
            onChange={(e) => setTempo(e.target.value as Tempo)}
            className="ml-1 rounded-lg border-2 border-gray-200 bg-surface-card px-2 py-1.5 text-text"
          >
            {(Object.keys(TEMPI) as Tempo[]).map((t) => (
              <option key={t} value={t}>
                {TEMPO_NAMEN[t]}
              </option>
            ))}
          </select>
        </label>
      </div>

      {fertig && (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl bg-primary/10 p-4">
          <p className="font-bold text-text-dark flex-1">Ende des Films.</p>
          <button
            type="button"
            onClick={nochmals}
            className={`${knopf} border-gray-200 bg-surface-card text-text hover:border-secondary`}
          >
            Nochmals
          </button>
          <a
            href={`#${selbsttestAnker}`}
            className="min-h-[44px] inline-flex items-center px-4 rounded-xl bg-primary text-white font-bold shadow-button hover:bg-primary-dark"
          >
            Zum Selbsttest
          </a>
        </div>
      )}
    </div>
  )
}
