// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// lib/archsim/routing.ts
// Aufrufbäume der Anfrageklassen aus dem Modell ableiten (docs/architektur-modell.md 9.3).
// Je Klasse: vom Einstieg aus jedes Ziel über den kürzesten Weg ab einem schon besuchten Element
// (Breitensuche, Gleichstand nach Besuchsreihenfolge und Verbindungs-ID), danach hängen an jedem Dienst
// seine Datenhaltungen. Ergebnis ist ein Plan mit Knoten (Klasse × Element) und einer Element-Reihenfolge.

import { KATEGORIE_VON, TYP_WERTE } from "./params"
import type { Anfrageklasse, ArchModell, Kategorie, ModellElement, ModellVerbindung, VerbindungsArt } from "./types"

/** Verbindungsarten, über die Last fliesst */
export const LAST_ARTEN: readonly VerbindungsArt[] = ["sync", "async", "daten", "abhaengigkeit", "stream"]

/**
 * Rolle eines Knotens gegenüber seinem Elternknoten:
 * - wurzel: Einstieg (Client)
 * - sync: Aufruf mit Warten auf Antwort (sync, abhängigkeit)
 * - daten: Zugriff auf Datenhaltung
 * - publish: Nachricht an Messaging-Element senden (wartet nur auf Bestätigung)
 * - konsum: Konsument liest aus dem Puffer eines Messaging-Elements (entkoppelt)
 * - asyncDirekt: asynchroner Aufruf ohne Puffer («fire and forget»; Nachricht geht bei Fehler verloren)
 */
export type KnotenRolle = "wurzel" | "sync" | "daten" | "publish" | "konsum" | "asyncDirekt"

/** Gewicht eines Aufrufs: voll, nur bei Cache-Fehltreffer (Cache-Aside, Read-Through), nur der nicht statische Rest hinter einem CDN */
export type KnotenGewicht = "voll" | "cacheMiss" | "cdnRest"

export interface PlanKnoten {
  key: string
  klasse: string
  element: string
  parent: number
  kante: string | null
  rolle: KnotenRolle
  gewicht: KnotenGewicht
  kinder: number[]
}

export interface Plan {
  knoten: PlanKnoten[]
  /** Element-IDs in Reihenfolge der Berechnung (Eltern vor Kindern) */
  ordnung: string[]
  knotenJeElement: Record<string, number[]>
  wurzeln: Record<string, number>
  fehler: string[]
}

export function kategorie(el: ModellElement | undefined): Kategorie | null {
  return el ? KATEGORIE_VON[el.typ] : null
}

export function istMessaging(el: ModellElement | undefined): boolean {
  return kategorie(el) === "messaging"
}

export function istDaten(el: ModellElement | undefined): boolean {
  return kategorie(el) === "daten"
}

export function traegtLast(el: ModellElement | undefined): boolean {
  return !!el && TYP_WERTE[el.typ].traegtLast
}

/** Durch dieses Element darf ein Weg hindurchführen (nicht nur enden) */
function durchlaessig(el: ModellElement): boolean {
  const k = kategorie(el)
  if (!traegtLast(el)) return false
  return k !== "client" && k !== "daten" && k !== "extern"
}

/** Elemente, die ihre Datenhaltung automatisch nutzen */
function nutztDaten(el: ModellElement): boolean {
  const k = kategorie(el)
  return k === "dienst" || k === "sicherheit"
}

export function lastKanten(modell: ArchModell): ModellVerbindung[] {
  return modell.verbindungen
    .filter((v) => LAST_ARTEN.includes(v.art))
    .slice()
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
}

export function elementIndex(modell: ArchModell): Record<string, ModellElement> {
  const out: Record<string, ModellElement> = {}
  for (const e of modell.elemente) out[e.id] = e
  return out
}

function rolleFuer(von: ModellElement, nach: ModellElement, v: ModellVerbindung): KnotenRolle {
  if (istMessaging(von)) return "konsum"
  if (istMessaging(nach)) return "publish"
  if (v.art === "async" || v.art === "stream") return "asyncDirekt"
  if (istDaten(nach)) return "daten"
  return "sync"
}

function baueKlasse(
  klasse: Anfrageklasse,
  modell: ArchModell,
  els: Record<string, ModellElement>,
  ausgehend: Record<string, ModellVerbindung[]>,
  knoten: PlanKnoten[],
  fehler: string[],
): number {
  const wurzelEl = els[klasse.einstieg]
  if (!wurzelEl) {
    fehler.push(`Anfrage «${klasse.name}»: Einstieg «${klasse.einstieg}» fehlt im Modell.`)
    return -1
  }
  const besucht = new Map<string, number>() // Element → Knotenindex
  const pfadVon = new Map<number, string>() // Knotenindex → Pfadschlüssel
  const neu = (element: string, parent: number, kante: string | null, rolle: KnotenRolle, gewicht: KnotenGewicht): number => {
    const pfad = parent < 0 ? element : `${pfadVon.get(parent)}>${element}`
    const idx = knoten.length
    knoten.push({ key: `${klasse.id}:${pfad}`, klasse: klasse.id, element, parent, kante, rolle, gewicht, kinder: [] })
    if (parent >= 0) knoten[parent].kinder.push(idx)
    pfadVon.set(idx, pfad)
    besucht.set(element, idx)
    return idx
  }
  const wurzel = neu(wurzelEl.id, -1, null, "wurzel", "voll")
  const reihenfolge: string[] = [wurzelEl.id]

  /** Breitensuche ab den Quellen (in dieser Reihenfolge) bis zum Ziel; null, wenn unerreichbar */
  const suche = (quellen: string[], ziel: string): Map<string, { von: string; kante: ModellVerbindung }> | null => {
    const vorgaenger = new Map<string, { von: string; kante: ModellVerbindung }>()
    const warteschlange: string[] = [...quellen]
    const gesehen = new Set<string>(reihenfolge)
    while (warteschlange.length > 0) {
      const aktuell = warteschlange.shift() as string
      // Von besuchten Elementen darf man weiter, wenn sie durchlässig sind oder die Wurzel
      if (aktuell !== wurzelEl.id && !durchlaessig(els[aktuell])) continue
      for (const v of ausgehend[aktuell] ?? []) {
        const nachEl = els[v.nach]
        if (!nachEl || gesehen.has(v.nach) || !traegtLast(nachEl)) continue
        if (kategorie(nachEl) === "client") continue
        gesehen.add(v.nach)
        vorgaenger.set(v.nach, { von: aktuell, kante: v })
        if (v.nach === ziel) return vorgaenger
        warteschlange.push(v.nach)
      }
    }
    return null
  }

  let vorigesZiel = wurzelEl.id
  for (const ziel of klasse.ziele) {
    if (besucht.has(ziel)) {
      vorigesZiel = ziel
      continue
    }
    if (!els[ziel]) {
      fehler.push(`Anfrage «${klasse.name}»: Ziel «${ziel}» fehlt im Modell.`)
      continue
    }
    // Zuerst vom vorigen Ziel aus weiter (die Anfrage ist dort), sonst ab allen besuchten Elementen
    const vorgaenger = suche([vorigesZiel], ziel) ?? suche(reihenfolge, ziel)
    if (!vorgaenger) {
      fehler.push(`Anfrage «${klasse.name}» kommt nicht bis «${els[ziel].name}»: Es fehlt eine Verbindung.`)
      continue
    }
    const weg: { element: string; kante: ModellVerbindung }[] = []
    let schritt = ziel
    while (!besucht.has(schritt)) {
      const vg = vorgaenger.get(schritt) as { von: string; kante: ModellVerbindung }
      weg.unshift({ element: schritt, kante: vg.kante })
      schritt = vg.von
    }
    let parent = besucht.get(schritt) as number
    for (const w of weg) {
      const vonEl = els[knoten[parent].element]
      const gewicht: KnotenGewicht = vonEl.typ === "cdn" ? "cdnRest" : "voll"
      parent = neu(w.element, parent, w.kante.id, rolleFuer(vonEl, els[w.element], w.kante), gewicht)
      reihenfolge.push(w.element)
    }
    vorigesZiel = ziel
  }

  // Datenhaltung anhängen: jeder Dienst nutzt seine Datenhaltungen; Cache-Aside, wenn ein Cache dabei ist
  const anzahlVorher = knoten.length
  const kandidaten: number[] = []
  for (let i = wurzel; i < anzahlVorher; i++) if (knoten[i].klasse === klasse.id) kandidaten.push(i)
  for (const idx of kandidaten) {
    const el = els[knoten[idx].element]
    if (!nutztDaten(el)) continue
    const datenKanten = (ausgehend[el.id] ?? []).filter((v) => istDaten(els[v.nach]) && !besucht.has(v.nach))
    const hatCache = datenKanten.some((v) => els[v.nach].typ === "cache")
    for (const v of datenKanten) {
      if (besucht.has(v.nach)) continue
      const ziel = els[v.nach]
      const gewicht: KnotenGewicht = hatCache && ziel.typ !== "cache" ? "cacheMiss" : "voll"
      const c = neu(ziel.id, idx, v.id, "daten", gewicht)
      // Read-Through: Datenhaltung hinter dem Cache
      if (ziel.typ === "cache") {
        for (const w of (ausgehend[ziel.id] ?? []).filter((x) => istDaten(els[x.nach]) && !besucht.has(x.nach))) {
          neu(w.nach, c, w.id, "daten", "cacheMiss")
        }
      }
    }
  }
  return wurzel
}

/** Element-Reihenfolge: Kahn auf dem Graphen der Plan-Kanten, bei Zyklen Rest nach ID */
function ordnung(knoten: PlanKnoten[]): string[] {
  const elemente = new Set<string>()
  const kanten = new Map<string, Set<string>>()
  const eingang = new Map<string, number>()
  for (const k of knoten) elemente.add(k.element)
  for (const e of elemente) {
    kanten.set(e, new Set())
    eingang.set(e, 0)
  }
  for (const k of knoten) {
    if (k.parent < 0) continue
    const von = knoten[k.parent].element
    if (von === k.element) continue
    const s = kanten.get(von) as Set<string>
    if (!s.has(k.element)) {
      s.add(k.element)
      eingang.set(k.element, (eingang.get(k.element) ?? 0) + 1)
    }
  }
  const sortiert = [...elemente].sort()
  const bereit = sortiert.filter((e) => eingang.get(e) === 0)
  const out: string[] = []
  while (bereit.length > 0) {
    bereit.sort()
    const e = bereit.shift() as string
    out.push(e)
    for (const n of [...(kanten.get(e) as Set<string>)].sort()) {
      const g = (eingang.get(n) ?? 0) - 1
      eingang.set(n, g)
      if (g === 0) bereit.push(n)
    }
  }
  for (const e of sortiert) if (!out.includes(e)) out.push(e)
  return out
}

const planCache = new Map<string, Plan>()

function schluessel(klassen: Anfrageklasse[], modell: ArchModell): string {
  const el = modell.elemente.map((e) => `${e.id}/${e.typ}`).join(",")
  const vb = modell.verbindungen.map((v) => `${v.id}/${v.von}/${v.nach}/${v.art}`).join(",")
  const kl = klassen.map((k) => `${k.id}/${k.einstieg}/${k.ziele.join("+")}`).join(",")
  return `${el}|${vb}|${kl}`
}

/** Plan für Anfrageklassen und Modell (zwischengespeichert nach Topologie) */
export function planFuer(klassen: Anfrageklasse[], modell: ArchModell): Plan {
  const key = schluessel(klassen, modell)
  const hit = planCache.get(key)
  if (hit) return hit
  const els = elementIndex(modell)
  const ausgehend: Record<string, ModellVerbindung[]> = {}
  for (const v of lastKanten(modell)) {
    if (!els[v.von] || !els[v.nach]) continue
    ;(ausgehend[v.von] ??= []).push(v)
  }
  const knoten: PlanKnoten[] = []
  const fehler: string[] = []
  const wurzeln: Record<string, number> = {}
  for (const k of klassen) {
    const w = baueKlasse(k, modell, els, ausgehend, knoten, fehler)
    if (w >= 0) wurzeln[k.id] = w
  }
  const knotenJeElement: Record<string, number[]> = {}
  knoten.forEach((k, i) => (knotenJeElement[k.element] ??= []).push(i))
  const plan: Plan = { knoten, ordnung: ordnung(knoten), knotenJeElement, wurzeln, fehler }
  if (planCache.size > 200) planCache.clear()
  planCache.set(key, plan)
  return plan
}
