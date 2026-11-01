// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

"use client"

// components/features/architektur-leitstand/LiveDiagramm.tsx
// Live-Diagramm mit der Engine (Architektur.diagramm). Gezeichnet wird zustand.modell; neu gezeichnet nur,
// wenn sich die Struktur ändert (Massnahmen wie Cache, CDN, Queue fügen Elemente ein). Pro Minute wird nur
// die Darstellung nachgeführt: Zustandsfarbe je Element (Klassen al-z-*), Auslastung und Instanzen als Plakette,
// Rückstau-Balken an Queues, Nachrichtenfluss als wandernde Punkte (SVG animateMotion, nicht bei
// prefers-reduced-motion), Circuit-Breaker-Status an der Verbindung. «Ausfall» und «neu» setzt die Engine
// selbst (setzeZustand). Klick oder Enter auf ein Element bzw. Klick auf eine Verbindung wählt sie aus.

import { useEffect, useMemo, useRef } from "react"
import type { Mission, Zustand } from "@/lib/archsim"
import styles from "@/app/(architektur-leitstand)/architektur-leitstand.module.css"
import { useEngine, wenigerBewegung, type DiagrammHandle } from "./engine"
import { MESS_ZUSTAND, engineZustand, flussJeVerbindung, hatKapazitaet, rueckstauJeElement, strukturSchluessel, zahl, zielInstanzen } from "./logik"

export type Auswahl = { art: "element" | "verbindung"; id: string } | null

const NS = "http://www.w3.org/2000/svg"
const ZUSTAENDE = ["ok", "ausgelastet", "ueberlast", "langsam", "ausfall", "fehlerhaft", "leer"]
/** So lange (Minuten) bleibt ein eingefügtes Element als «neu» hervorgehoben */
const NEU_MINUTEN = 4

function svg<K extends keyof SVGElementTagNameMap>(tag: K, attr: Record<string, string | number>, klasse?: string): SVGElementTagNameMap[K] {
  const e = document.createElementNS(NS, tag)
  for (const [k, v] of Object.entries(attr)) e.setAttribute(k, String(v))
  if (klasse) e.setAttribute("class", klasse)
  return e
}

function plakette(text: string, cx: number, y: number, klasse: string): SVGGElement {
  const g = svg("g", {}, `al-plakette ${klasse}`)
  const b = Math.max(34, text.length * 7.6 + 16)
  g.append(svg("rect", { x: cx - b / 2, y, width: b, height: 20, rx: 10 }))
  const t = svg("text", { x: cx, y: y + 14.6, "text-anchor": "middle" })
  t.textContent = text
  g.append(t)
  return g
}

function groesse(g: Element): { w: number; h: number } {
  const ring = g.querySelector(".ar-ring")
  const w = Number(ring?.getAttribute("width") ?? 132) - 12
  const h = Number(ring?.getAttribute("height") ?? 72) - 12
  return { w, h }
}

const CB_TEXT = { zu: "CB zu", offen: "CB offen", halboffen: "CB halb" } as const

export default function LiveDiagramm({
  mission,
  zustand,
  auswahl,
  onAuswahl,
  hoehe,
  ablauf = true,
  beschriftung,
}: {
  mission: Mission
  zustand: Zustand
  auswahl: Auswahl
  onAuswahl?: (a: Auswahl) => void
  hoehe?: number
  /** Ablauf-Abspieler der Engine anbieten (nur im Leitstand, nicht in der Zeitreise) */
  ablauf?: boolean
  beschriftung?: string
}) {
  const { engine, fehler } = useEngine()
  const ref = useRef<HTMLDivElement>(null)
  const handleRef = useRef<DiagrammHandle | null>(null)
  const engineStand = useRef<Record<string, string>>({})
  const onAuswahlRef = useRef(onAuswahl)
  onAuswahlRef.current = onAuswahl
  const schluessel = useMemo(() => strukturSchluessel(zustand.modell), [zustand.modell])
  const zustandRef = useRef(zustand)
  zustandRef.current = zustand

  // Zeichnen (nur bei neuer Struktur)
  useEffect(() => {
    const el = ref.current
    if (!engine || !el) return
    const modell = zustandRef.current.modell
    const h = engine.diagramm(el, modell, {
      ablauf: ablauf && (modell.ablaeufe?.length ?? 0) > 0,
      ausfall: false,
      legende: true,
      steckbrief: false,
      textliste: true,
      breit: false,
      // Übersicht vor Lesbarkeit: das ganze System soll auf einen Blick passen (Zoom bleibt möglich)
      kMin: el.clientWidth < 600 ? 0.36 : 0.5,
      titel: "",
      hoehe: hoehe ?? 460,
    })
    handleRef.current = h
    engineStand.current = {}
    for (const e of modell.elemente) engineStand.current[e.id] = e.zustand ?? "ok"
    return () => {
      handleRef.current = null
    }
    // schluessel steht für die Struktur von zustand.modell
  }, [engine, schluessel, hoehe, ablauf])

  // Darstellung je Minute nachführen
  useEffect(() => {
    const el = ref.current
    const h = handleRef.current
    if (!el || !h) return
    const z = zustand
    const puffer = rueckstauJeElement(mission, z)
    const fluss = flussJeVerbindung(mission, z)
    const ruhig = wenigerBewegung()

    for (const g of Array.from(el.querySelectorAll<SVGGElement>(".ar-elemente > g.ar-el[data-id]"))) {
      const id = g.dataset.id ?? ""
      const e = z.modell.elemente.find((x) => x.id === id)
      const rt = z.elemente[id]
      if (!e || !rt) continue
      const mz = z.verlauf.length ? rt.messung.zustand : "leer"
      for (const k of ZUSTAENDE) g.classList.toggle(`al-z-${k}`, k === mz)

      // Engine-Zustand: Ausfall (⚡) und «neu» (eingefügte Elemente, einige Minuten lang)
      const neu = e.zustand === "neu" && z.tick - rt.seit < NEU_MINUTEN && mz !== "ausfall"
      const soll = neu ? "neu" : engineZustand(mz)
      if (engineStand.current[id] !== soll) {
        h.setzeZustand(id, soll)
        engineStand.current[id] = soll
      }

      // Plakette: Instanzen und Auslastung, Last am Einstieg, Rückstau an Queues
      g.querySelector(":scope > g.al-overlay")?.remove()
      if (z.verlauf.length === 0 && !hatKapazitaet(e)) continue
      const o = svg("g", {}, "al-overlay")
      const { w, h: hh } = groesse(g)
      const p = puffer[id]
      if (p) {
        const fach = g.querySelector(".ar-faecher rect")
        if (fach && p.anteil > 0) {
          const fx = Number(fach.getAttribute("x"))
          const fy = Number(fach.getAttribute("y"))
          const fw = Number(fach.getAttribute("width"))
          const fh = Number(fach.getAttribute("height"))
          o.append(svg("rect", { x: fx, y: fy, width: Math.max(2, fw * Math.max(0.03, p.anteil)), height: fh, rx: 2 }, `al-fuellung ${p.anteil > 0.7 ? "al-voll" : ""}`))
        }
        o.append(plakette(`▤ ${zahl(Math.round(p.nachrichten))}`, w / 2, hh - 6, p.nachrichten > 0 ? "al-pl-stau" : "al-pl-ruhig"))
      } else if (hatKapazitaet(e)) {
        const ziel = zielInstanzen(z, id)
        const startend = ziel > rt.instanzen ? ` +${ziel - rt.instanzen}` : ""
        const aus = z.verlauf.length ? ` · ${Math.round(rt.messung.auslastung * 100)} %` : ""
        const rep = rt.replikate > 0 ? ` +${rt.replikate}R` : ""
        o.append(plakette(`${rt.instanzen}×${startend}${rep}${aus}`, w / 2, hh - 6, `al-pl-${mz}`))
      } else if (rt.messung.last > 0) {
        o.append(plakette(`${zahl(rt.messung.last)} /s`, w / 2, hh - 6, "al-pl-last"))
      }
      if (rt.autoscaling) {
        const a = svg("text", { x: 4, y: -6 }, "al-as")
        a.textContent = `⇅ ${rt.autoscaling.min}–${rt.autoscaling.max}`
        o.append(a)
      }
      const titel = svg("title", {})
      titel.textContent = `${e.name}: ${MESS_ZUSTAND[mz].text}`
      o.append(titel)
      g.append(o)
    }

    for (const g of Array.from(el.querySelectorAll<SVGGElement>(".ar-kanten > g.ar-kante[data-id]"))) {
      const id = g.dataset.id ?? ""
      const f = fluss[id]
      const vt = z.verbindungen[id]
      const key = f ? `${f.stufe}-${f.lage}-${ruhig ? 1 : 0}` : "0"
      g.classList.toggle("al-fluss", !!f && f.stufe > 0)
      for (const l of ["ok", "gestresst", "gestoert"]) g.classList.toggle(`al-lage-${l}`, !!f && f.lage === l)
      const linie = g.querySelector<SVGPathElement>(".ar-linie")
      if (g.dataset.alFluss !== key) {
        g.dataset.alFluss = key
        g.querySelector(":scope > g.al-punkte")?.remove()
        if (f && f.stufe > 0 && !ruhig && linie) {
          const d = linie.getAttribute("d") ?? ""
          const punkte = svg("g", {}, "al-punkte")
          const dauer = f.stufe === 3 ? 0.9 : f.stufe === 2 ? 1.5 : 2.4
          for (let i = 0; i < f.stufe + 1; i++) {
            const c = svg("circle", { r: f.stufe === 3 ? 3.6 : 3 }, "al-punkt")
            const am = svg("animateMotion", { dur: `${dauer}s`, repeatCount: "indefinite", path: d, begin: `${(-dauer * i) / (f.stufe + 1)}s` })
            c.append(am)
            punkte.append(c)
          }
          g.append(punkte)
        }
      }
      // Circuit Breaker und Bulkhead als Plakette nahe beim Aufrufer
      g.querySelector(":scope > g.al-cb")?.remove()
      if (vt && (vt.circuitBreaker || vt.bulkhead) && linie) {
        const len = linie.getTotalLength?.() ?? 0
        if (len > 0) {
          const pt = linie.getPointAtLength(Math.min(len * 0.28, 70))
          const teile: string[] = []
          if (vt.circuitBreaker) teile.push(CB_TEXT[vt.cbStatus])
          if (vt.bulkhead) teile.push("▥ BH")
          const pl = plakette(teile.join(" · "), pt.x, pt.y - 10, `al-cb al-cb-${vt.circuitBreaker ? vt.cbStatus : "bh"}`)
          pl.classList.add("al-cb")
          g.append(pl)
        }
      }
    }
  }, [zustand, mission, schluessel, engine])

  // Auswahl hervorheben
  useEffect(() => {
    const el = ref.current
    if (!el) return
    for (const g of Array.from(el.querySelectorAll(".al-gewaehlt"))) g.classList.remove("al-gewaehlt")
    if (!auswahl) return
    const sel = auswahl.art === "element" ? `.ar-elemente > g.ar-el[data-id="${auswahl.id}"]` : `.ar-kanten > g.ar-kante[data-id="${auswahl.id}"]`
    el.querySelector(sel)?.classList.add("al-gewaehlt")
  }, [auswahl, schluessel, engine])

  // Auswahl per Klick (Element, Verbindung, Beschriftung) und Enter/Leertaste auf einem Element.
  // Capture-Phase, weil die Engine Klicks auf Elementen nicht weiterreicht.
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ziel = (t: EventTarget | null): Auswahl => {
      if (!(t instanceof Element)) return null
      const g = t.closest("[data-id]")
      if (!g || !el.contains(g)) return null
      const id = g.getAttribute("data-id") ?? ""
      if (g.classList.contains("ar-el")) return { art: "element", id }
      if (g.classList.contains("ar-kante") || g.classList.contains("ar-label")) return { art: "verbindung", id }
      return null
    }
    const onClick = (ev: MouseEvent) => {
      const a = ziel(ev.target)
      if (a) onAuswahlRef.current?.(a)
    }
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key !== "Enter" && ev.key !== " ") return
      const a = ziel(ev.target)
      if (a && a.art === "element") onAuswahlRef.current?.(a)
    }
    el.addEventListener("click", onClick, true)
    el.addEventListener("keydown", onKey, true)
    return () => {
      el.removeEventListener("click", onClick, true)
      el.removeEventListener("keydown", onKey, true)
    }
  }, [])

  return (
    <div className={styles.diagrammRahmen}>
      {!engine && (
        <p className={`hint ${styles.diagrammLaden}`} role="status">
          {fehler ? "Die Zeichen-Engine konnte nicht geladen werden. Lade die Seite neu; Kennzahlen und Massnahmen funktionieren weiter." : "Diagramm wird gezeichnet …"}
        </p>
      )}
      <div ref={ref} className={styles.diagramm} aria-label={beschriftung} />
    </div>
  )
}
