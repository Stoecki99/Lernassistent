// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

"use client"

// components/features/architektur-leitstand/Lastkurve.tsx
// Verlauf über die Mission als eigenes SVG (keine Pakete): Last mit Durchsatz und Fehlern als Flächen,
// p95 mit SLO-Linie oder Kosten mit Budget und Prognose. Ereignisse als Bänder mit Beschriftung,
// eigene Massnahmen als Rauten auf der Zeitachse, optional ein Zeiger (Zeitreise in der Nachbesprechung).
// Barrierefrei: role="img" mit Zusammenfassung und eine gleichwertige Tabelle zum Aufklappen.

import { useEffect, useRef, useState } from "react"
import { aktionText, type KennzahlPunkt, type Mission, type Zustand } from "@/lib/archsim"
import styles from "@/app/(architektur-leitstand)/architektur-leitstand.module.css"
import { chf, kostenPrognose, ms, prozent, zahl } from "./logik"

type Modus = "last" | "p95" | "kosten"

const MODI: Array<[Modus, string]> = [
  ["last", "Last und Fehler"],
  ["p95", "Antwortzeit p95"],
  ["kosten", "Kosten"],
]

const RAND = { l: 46, r: 12, o: 26, u: 26 }

function pfad(punkte: Array<[number, number]>): string {
  return punkte.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join("")
}

function schoeneSkala(max: number): number[] {
  if (max <= 0) return [0, 1]
  const roh = max / 4
  const p = 10 ** Math.floor(Math.log10(roh))
  const schritt = [1, 2, 2.5, 5, 10].map((f) => f * p).find((s) => s >= roh) ?? roh
  const out: number[] = []
  for (let v = 0; v <= max + schritt * 0.01; v += schritt) out.push(v)
  if (out[out.length - 1] < max) out.push(out[out.length - 1] + schritt)
  return out
}

export default function Lastkurve({
  mission,
  zustand,
  zeiger,
  onZeiger,
  hoehe = 210,
}: {
  mission: Mission
  zustand: Zustand
  /** Minute des Zeigers (Zeitreise) */
  zeiger?: number | null
  onZeiger?: (minute: number) => void
  hoehe?: number
}) {
  const [modus, setModus] = useState<Modus>("last")
  const box = useRef<HTMLDivElement>(null)
  const [breite, setBreite] = useState(640)

  useEffect(() => {
    const el = box.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setBreite(Math.max(280, Math.round(e.contentRect.width))))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const v: KennzahlPunkt[] = zustand.verlauf
  const B = breite
  const H = hoehe
  const x0 = RAND.l
  const x1 = B - RAND.r
  const y0 = H - RAND.u
  const y1 = RAND.o
  const xs = (t: number) => x0 + ((x1 - x0) * t) / mission.dauer
  const slo = mission.slo

  let yMax = 1
  if (modus === "last") yMax = Math.max(10, ...v.map((p) => p.last)) * 1.08
  if (modus === "p95") yMax = Math.max(slo.p95Ms * 2, Math.min(slo.p95Ms * 6, Math.max(0, ...v.map((p) => p.p95 ?? 0)) * 1.1))
  const prognose = kostenPrognose(mission, zustand)
  if (modus === "kosten") yMax = Math.max(mission.budget * 1.15, prognose * 1.05)
  const skala = schoeneSkala(yMax)
  const top = skala[skala.length - 1]
  const ys = (w: number) => y0 - ((y0 - y1) * Math.min(w, top)) / top

  // Punkte liegen in der Mitte ihrer Minute
  const mx = (p: KennzahlPunkt) => xs(p.t + 0.5)

  const ereignisse = mission.ereignisse.filter((e) => {
    const s = zustand.ereignisse[e.id]?.status
    return s && s !== "geplant"
  })
  const aktionen = zustand.protokoll

  const beschreibung =
    v.length === 0
      ? "Noch keine Messwerte."
      : modus === "last"
        ? `Minute 0 bis ${v.length - 1}: Last bis ${zahl(Math.max(...v.map((p) => p.last)))} Anfragen pro Sekunde, Fehleranteil höchstens ${prozent(Math.max(...v.map((p) => p.fehlerquote)))}.`
        : modus === "p95"
          ? `p95 bis ${ms(Math.max(...v.map((p) => p.p95 ?? 0)))}, Ziel ${ms(slo.p95Ms)}; ${v.filter((p) => p.sloOk).length} von ${v.length} Minuten im Ziel.`
          : `Kosten bisher ${chf(zustand.kosten.betrieb + zustand.kosten.massnahmen)}, Prognose ${chf(prognose)}, Budget ${chf(mission.budget)}.`

  const klick = (ev: React.MouseEvent<SVGSVGElement>) => {
    if (!onZeiger) return
    const r = ev.currentTarget.getBoundingClientRect()
    const x = ((ev.clientX - r.left) / r.width) * B
    const t = Math.round(((x - x0) / (x1 - x0)) * mission.dauer)
    onZeiger(Math.max(0, Math.min(mission.dauer, t)))
  }

  return (
    <div className={styles.kurve}>
      <div className={styles.kurveKopf}>
        <h3 className={styles.h3}>Verlauf</h3>
        <div className={styles.segment} role="group" aria-label="Kurve wählen">
          {MODI.map(([m, text]) => (
            <button key={m} type="button" className={`${styles.segKnopf} ${modus === m ? styles.segAn : ""}`} aria-pressed={modus === m} onClick={() => setModus(m)}>
              {text}
            </button>
          ))}
        </div>
      </div>
      <div ref={box} className={styles.kurveFlaeche}>
        <svg
          width={B}
          height={H}
          viewBox={`0 0 ${B} ${H}`}
          role="img"
          aria-label={`Verlauf ${MODI.find(([m]) => m === modus)?.[1]}. ${beschreibung}`}
          onClick={onZeiger ? klick : undefined}
          className={onZeiger ? styles.kurveKlickbar : undefined}
        >
          {/* Ereignisse als Bänder */}
          {ereignisse.map((e) => {
            const a = xs(e.tick)
            const b = xs(Math.min(mission.dauer, e.tick + e.dauer))
            return (
              <g key={e.id} className={styles.kEreignis}>
                <rect x={a} y={y1 - 14} width={Math.max(2, b - a)} height={y0 - y1 + 14} />
                <text x={a + 4} y={y1 - 3}>
                  {e.titel.length > 28 && b - a < 180 ? `${e.titel.slice(0, 26)}…` : e.titel}
                </text>
              </g>
            )
          })}
          {/* Raster */}
          {skala.map((s) => (
            <g key={s} className={styles.kRaster}>
              <line x1={x0} x2={x1} y1={ys(s)} y2={ys(s)} />
              <text x={x0 - 6} y={ys(s) + 4} textAnchor="end">
                {modus === "p95" ? (s >= 1000 ? `${zahl(s / 1000, 1)} s` : zahl(s)) : modus === "kosten" ? zahl(s) : zahl(s)}
              </text>
            </g>
          ))}
          {Array.from({ length: Math.floor(mission.dauer / 10) + 1 }, (_, i) => i * 10).map((t) => (
            <text key={t} className={styles.kAchse} x={xs(t)} y={H - 8} textAnchor="middle">
              {t}
            </text>
          ))}
          <text className={styles.kAchse} x={x0 - 6} y={14} textAnchor="end">
            {modus === "last" ? "Anfr./s" : modus === "p95" ? "ms" : "CHF"}
          </text>

          {modus === "last" && v.length > 0 && (
            <>
              <path className={styles.kFehler} d={`${pfad(v.map((p) => [mx(p), ys(p.last)]))}L${mx(v[v.length - 1]).toFixed(1)} ${ys(v[v.length - 1].durchsatz).toFixed(1)}${pfad(v.map((p) => [mx(p), ys(p.durchsatz)] as [number, number]).reverse()).replace(/^M/, "L")}Z`} />
              <path className={styles.kDurchsatzFlaeche} d={`${pfad(v.map((p) => [mx(p), ys(p.durchsatz)]))}L${mx(v[v.length - 1]).toFixed(1)} ${y0}L${mx(v[0]).toFixed(1)} ${y0}Z`} />
              <path className={styles.kLast} d={pfad(v.map((p) => [mx(p), ys(p.last)]))} />
              <path className={styles.kDurchsatz} d={pfad(v.map((p) => [mx(p), ys(p.durchsatz)]))} />
            </>
          )}
          {modus === "p95" && (
            <>
              <line className={styles.kSlo} x1={x0} x2={x1} y1={ys(slo.p95Ms)} y2={ys(slo.p95Ms)} />
              <text className={styles.kSloText} x={x1 - 4} y={ys(slo.p95Ms) - 5} textAnchor="end">
                SLO {ms(slo.p95Ms)}
              </text>
              {v.length > 0 && <path className={styles.kP95} d={pfad(v.map((p) => [mx(p), ys(p.p95 ?? top)]))} />}
              {v.filter((p) => !p.sloOk).map((p) => (
                <rect key={p.t} className={styles.kVerletzt} x={xs(p.t)} y={y0 - 5} width={Math.max(1, xs(1) - xs(0))} height={5} />
              ))}
            </>
          )}
          {modus === "kosten" && (
            <>
              <line className={styles.kSlo} x1={x0} x2={x1} y1={ys(mission.budget)} y2={ys(mission.budget)} />
              <text className={styles.kSloText} x={x1 - 4} y={ys(mission.budget) - 5} textAnchor="end">
                Budget {chf(mission.budget)}
              </text>
              {v.length > 0 && <path className={styles.kKosten} d={pfad(v.map((p) => [mx(p), ys(p.kosten)]))} />}
              {v.length > 0 && zustand.phase !== "beendet" && (
                <path className={styles.kPrognose} d={pfad([[mx(v[v.length - 1]), ys(v[v.length - 1].kosten)], [xs(mission.dauer), ys(prognose)]])} />
              )}
            </>
          )}

          {/* eigene Massnahmen */}
          {aktionen.map((a, i) => (
            <path key={i} className={styles.kAktion} d={`M${xs(a.tick)} ${y0 - 6}l6 6l-6 6l-6 -6Z`}>
              <title>{`Minute ${a.tick}: ${aktionText(a.aktion, zustand.modell)}`}</title>
            </path>
          ))}
          {/* jetzt */}
          {zustand.phase !== "beendet" && v.length > 0 && <line className={styles.kJetzt} x1={xs(zustand.tick)} x2={xs(zustand.tick)} y1={y1} y2={y0} />}
          {zeiger !== undefined && zeiger !== null && (
            <g className={styles.kZeiger}>
              <line x1={xs(zeiger)} x2={xs(zeiger)} y1={y1 - 14} y2={y0} />
              <text x={Math.min(x1 - 30, xs(zeiger) + 4)} y={y0 - 8}>
                {zeiger}
              </text>
            </g>
          )}
          <line className={styles.kAchsenLinie} x1={x0} x2={x1} y1={y0} y2={y0} />
        </svg>
      </div>
      <p className={`hint ${styles.kurveLegende}`}>
        {modus === "last" ? (
          <>
            <span className={styles.lgLast} aria-hidden="true" /> Last · <span className={styles.lgDurchsatz} aria-hidden="true" /> erfolgreich ·{" "}
            <span className={styles.lgFehler} aria-hidden="true" /> gescheitert
          </>
        ) : modus === "p95" ? (
          <>
            <span className={styles.lgP95} aria-hidden="true" /> p95 · <span className={styles.lgSlo} aria-hidden="true" /> SLO · rote Striche: Minute ausserhalb SLO
          </>
        ) : (
          <>
            <span className={styles.lgKosten} aria-hidden="true" /> Kosten · <span className={styles.lgSlo} aria-hidden="true" /> Budget · gestrichelt: Prognose
          </>
        )}{" "}
        · <span className={styles.lgEreignis} aria-hidden="true" /> Ereignis · ◆ deine Massnahme · Minuten auf der Achse
        {onZeiger ? " · Antippen setzt den Zeiger" : ""}
      </p>
      <details className={styles.tabelleAuf}>
        <summary>Als Tabelle zeigen</summary>
        <div className="tablebox">
          <table className={styles.tabelle}>
            <caption className="sr-only">Kennzahlen je Minute</caption>
            <thead>
              <tr>
                <th scope="col">Minute</th>
                <th scope="col">Last /s</th>
                <th scope="col">Durchsatz /s</th>
                <th scope="col">Fehler</th>
                <th scope="col">p95</th>
                <th scope="col">Kosten</th>
                <th scope="col">Rückstau</th>
              </tr>
            </thead>
            <tbody>
              {v.map((p) => (
                <tr key={p.t}>
                  <th scope="row">{p.t}</th>
                  <td>{zahl(p.last)}</td>
                  <td>{zahl(p.durchsatz)}</td>
                  <td>{prozent(p.fehlerquote)}</td>
                  <td>{ms(p.p95)}</td>
                  <td>{chf(p.kosten)}</td>
                  <td>{zahl(p.rueckstau)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  )
}
