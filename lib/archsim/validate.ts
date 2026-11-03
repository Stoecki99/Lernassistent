// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// lib/archsim/validate.ts
// Modellprüfung (9.8): Struktur nach Vertrag (Abschnitte 2, 4, 5), Lauffähigkeit (alle Anfrageklassen kommen an)
// und Pflichtanforderungen aus dem Auftrag (selbst modellierte Missionen).

import { werteFuer } from "./params"
import { elementIndex, istDaten, istMessaging, kategorie, LAST_ARTEN, planFuer, traegtLast } from "./routing"
import {
  ELEMENT_TYPEN,
  GRUPPEN_TYPEN,
  VERBINDUNGS_ARTEN,
  type Anforderung,
  type AnforderungErgebnis,
  type ArchModell,
  type Mission,
  type ModellElement,
  type ValidierungsErgebnis,
} from "./types"

export const ID_MUSTER = /^[a-z0-9][a-z0-9-]{0,59}$/
export const MAX_ELEMENTE = 60
export const MAX_VERBINDUNGEN = 150

function istGruppe(el: ModellElement | undefined): boolean {
  return !!el && (GRUPPEN_TYPEN as readonly string[]).includes(el.typ)
}

/** Strukturprüfung des Modells (Vertrag Abschnitt 4). Liefert deutsche Fehlermeldungen, leer = in Ordnung. */
export function pruefeModell(modell: ArchModell): string[] {
  const fehler: string[] = []
  if (!modell || !Array.isArray(modell.elemente) || !Array.isArray(modell.verbindungen)) return ["Das Modell braucht Elemente und Verbindungen."]
  if (modell.elemente.length > MAX_ELEMENTE) fehler.push(`Höchstens ${MAX_ELEMENTE} Elemente.`)
  if (modell.verbindungen.length > MAX_VERBINDUNGEN) fehler.push(`Höchstens ${MAX_VERBINDUNGEN} Verbindungen.`)
  const ids = new Set<string>()
  for (const x of [...modell.elemente, ...modell.verbindungen]) {
    if (typeof x.id !== "string" || !ID_MUSTER.test(x.id)) fehler.push(`Ungültige ID «${String(x.id)}» (erlaubt: a-z, 0-9, Bindestrich).`)
    else if (ids.has(x.id)) fehler.push(`Die ID «${x.id}» kommt mehrfach vor.`)
    ids.add(x.id)
  }
  const els = elementIndex(modell)
  for (const e of modell.elemente) {
    if (!(ELEMENT_TYPEN as readonly string[]).includes(e.typ)) fehler.push(`Element «${e.id}»: unbekannter Typ «${String(e.typ)}».`)
    if (typeof e.name !== "string" || e.name.trim() === "") fehler.push(`Element «${e.id}» braucht einen Namen.`)
    if (e.in !== undefined) {
      if (!istGruppe(els[e.in])) fehler.push(`Element «${e.id}»: «${e.in}» ist keine Gruppe.`)
      let tiefe = 0
      let g: string | undefined = e.in
      const gesehen = new Set<string>([e.id])
      while (g !== undefined && els[g]) {
        if (gesehen.has(g)) {
          fehler.push(`Gruppen von «${e.id}» enthalten sich gegenseitig.`)
          break
        }
        gesehen.add(g)
        tiefe++
        g = els[g].in
      }
      if (tiefe > 3) fehler.push(`Element «${e.id}» ist tiefer als 3 Gruppen verschachtelt.`)
    }
    if (e.sim) {
      for (const [k, v] of Object.entries(e.sim)) {
        if (typeof v !== "number" || !Number.isFinite(v) || v < 0) fehler.push(`Element «${e.id}»: Simulationswert «${k}» ungültig.`)
      }
    }
  }
  for (const v of modell.verbindungen) {
    if (!(VERBINDUNGS_ARTEN as readonly string[]).includes(v.art)) fehler.push(`Verbindung «${v.id}»: unbekannte Art «${String(v.art)}».`)
    const von = els[v.von]
    const nach = els[v.nach]
    if (!von) fehler.push(`Verbindung «${v.id}»: Element «${v.von}» fehlt.`)
    if (!nach) fehler.push(`Verbindung «${v.id}»: Element «${v.nach}» fehlt.`)
    if (von && nach && v.art !== "deploy" && (istGruppe(von) || istGruppe(nach))) {
      fehler.push(`Verbindung «${v.id}»: Gruppen sind nur mit «deploy» verbunden.`)
    }
    if (v.von === v.nach) fehler.push(`Verbindung «${v.id}» zeigt auf sich selbst.`)
  }
  return fehler
}

/**
 * Modell des Spielers für Missionen «modellieren» vereinheitlichen (Editor-Modell → Simulationsmodell):
 * Simulationswerte kommen nie vom Spieler, sondern aus Palette bzw. vorgegebenem Modell (sonst Standardwerte des Typs);
 * Verbindungen tragen nur bei vorgegebenen Verbindungen deren Werte, sonst Standard (Timeout, Retry usw. sind Aktionen).
 * Technologie und Steckbrief ergänzt, wenn sie fehlen. So erreicht ein im Editor gebautes Modell dieselben Werte wie die
 * Musterlösung, und ein von Hand geschicktes Modell kann sich keine Kapazität erschleichen.
 */
export function ergaenzeAusPalette(mission: Mission, modell: ArchModell): ArchModell {
  if (mission.art !== "modellieren") return modell
  const quelle = new Map<string, { sim?: ModellElement["sim"]; technologie?: string; info?: ModellElement["info"] }>()
  for (const p of mission.palette ?? []) quelle.set(p.id, p)
  for (const e of mission.modell.elemente) quelle.set(e.id, e)
  const vorgegebeneVerbindungen = new Map(mission.modell.verbindungen.map((v) => [v.id, v]))
  return {
    ...modell,
    elemente: modell.elemente.map((e) => {
      const { sim: _sim, ...rest } = e
      void _sim
      const out: ModellElement = { ...rest }
      const p = quelle.get(e.id)
      if (!p) return out
      if (p.sim) out.sim = { ...p.sim }
      if (!out.technologie && p.technologie) out.technologie = p.technologie
      if (!out.info && p.info) out.info = { ...p.info }
      return out
    }),
    verbindungen: modell.verbindungen.map((v) => {
      const { sim: _sim, ...rest } = v
      void _sim
      const vorgabe = vorgegebeneVerbindungen.get(v.id)
      return vorgabe?.sim && vorgabe.von === v.von && vorgabe.nach === v.nach ? { ...rest, sim: { ...vorgabe.sim } } : rest
    }),
  }
}

// ---------- Graph-Hilfen für Anforderungen ----------

function nachbarn(modell: ArchModell): Map<string, string[]> {
  const out = new Map<string, string[]>()
  for (const v of modell.verbindungen) {
    if (!LAST_ARTEN.includes(v.art)) continue
    const l = out.get(v.von) ?? []
    l.push(v.nach)
    out.set(v.von, l)
  }
  return out
}

/** Erreichbar über Lastverbindungen; `meide` sperrt Zwischenstationen */
function erreichbar(modell: ArchModell, von: string, nach: string, meide: (el: ModellElement) => boolean = () => false): boolean {
  const els = elementIndex(modell)
  const nb = nachbarn(modell)
  const gesehen = new Set([von])
  const q = [von]
  while (q.length > 0) {
    const a = q.shift() as string
    for (const n of nb.get(a) ?? []) {
      if (n === nach) return true
      if (gesehen.has(n) || !els[n] || meide(els[n])) continue
      gesehen.add(n)
      q.push(n)
    }
  }
  return false
}

function name(modell: ArchModell, id: string): string {
  return modell.elemente.find((e) => e.id === id)?.name ?? id
}

/** Eine Anforderung prüfen */
export function pruefeAnforderung(modell: ArchModell, a: Anforderung): AnforderungErgebnis {
  const els = elementIndex(modell)
  const res = (erfuellt: boolean, rueckmeldung: string): AnforderungErgebnis => ({ id: a.id, text: a.text, erfuellt, rueckmeldung })
  switch (a.art) {
    case "element":
      return els[a.element]
        ? res(true, `«${name(modell, a.element)}» ist da.`)
        : res(false, `Es fehlt «${a.element}». ${a.warum}`)
    case "pfad":
      return erreichbar(modell, a.von, a.nach)
        ? res(true, `Anfragen kommen von «${name(modell, a.von)}» bis «${name(modell, a.nach)}».`)
        : res(false, `Von «${name(modell, a.von)}» führt kein Weg zu «${name(modell, a.nach)}». ${a.warum}`)
    case "entkoppelt": {
      if (!erreichbar(modell, a.von, a.nach)) return res(false, `«${name(modell, a.von)}» erreicht «${name(modell, a.nach)}» gar nicht. ${a.warum}`)
      const direkt = erreichbar(modell, a.von, a.nach, (el) => istMessaging(el))
      return direkt
        ? res(false, `Es gibt einen Weg von «${name(modell, a.von)}» zu «${name(modell, a.nach)}» ohne Queue oder Broker dazwischen. ${a.warum}`)
        : res(true, `Zwischen «${name(modell, a.von)}» und «${name(modell, a.nach)}» puffert ein Messaging-Element.`)
    }
    case "cache": {
      const hat = modell.verbindungen.some((v) => v.von === a.element && LAST_ARTEN.includes(v.art) && els[v.nach]?.typ === "cache")
      return hat
        ? res(true, `«${name(modell, a.element)}» liest über einen Cache.`)
        : res(false, `«${name(modell, a.element)}» hat keinen Cache. ${a.warum}`)
    }
    case "vorgeschaltet": {
      if (!erreichbar(modell, a.einstieg, a.bis)) return res(false, `«${name(modell, a.einstieg)}» erreicht «${name(modell, a.bis)}» nicht. ${a.warum}`)
      const vorbei = erreichbar(modell, a.einstieg, a.bis, (el) => el.typ === a.typ)
      return vorbei
        ? res(false, `Anfragen kommen an einem Element vom Typ «${a.typ}» vorbei. ${a.warum}`)
        : res(true, `Alle Anfragen laufen über ein Element vom Typ «${a.typ}».`)
    }
    case "keineVerbindung": {
      const direkt = modell.verbindungen.some((v) => v.von === a.von && v.nach === a.nach)
      return direkt
        ? res(false, `«${name(modell, a.von)}» greift direkt auf «${name(modell, a.nach)}» zu. ${a.warum}`)
        : res(true, `Kein direkter Zugriff von «${name(modell, a.von)}» auf «${name(modell, a.nach)}».`)
    }
    case "eigeneDaten": {
      const probleme: string[] = []
      for (const d of a.elemente) {
        const eigene = modell.verbindungen
          .filter((v) => v.von === d && LAST_ARTEN.includes(v.art) && istDaten(els[v.nach]) && els[v.nach].typ !== "cache")
          .map((v) => v.nach)
        if (eigene.length === 0) {
          probleme.push(`«${name(modell, d)}» hat keine eigene Datenhaltung`)
          continue
        }
        const geteilt = eigene.filter((db) =>
          modell.verbindungen.some((v) => v.nach === db && v.von !== d && LAST_ARTEN.includes(v.art) && kategorie(els[v.von]) === "dienst"),
        )
        if (geteilt.length === eigene.length) probleme.push(`«${name(modell, d)}» teilt seine Datenbank mit einem anderen Dienst`)
      }
      return probleme.length === 0
        ? res(true, "Jeder Dienst besitzt seine Daten.")
        : res(false, `${probleme.join("; ")}. ${a.warum}`)
    }
  }
}

/**
 * Prüft ein Modell für eine Mission: Struktur, Palette (bei «modellieren»), Lauffähigkeit und Anforderungen.
 * `gueltig` = Lasttest startbar; nicht erfüllte Anforderungen kosten Punkte, verhindern den Start aber nicht.
 */
export function validiere(mission: Mission, roh: ArchModell): ValidierungsErgebnis {
  const fehler = pruefeModell(roh)
  const hinweise: string[] = []
  if (fehler.length > 0) return { gueltig: false, fehler, hinweise, anforderungen: [] }
  const modell = ergaenzeAusPalette(mission, roh)
  const els = elementIndex(modell)

  if (mission.art === "modellieren") {
    const erlaubt = new Map<string, string>()
    for (const p of mission.palette ?? []) erlaubt.set(p.id, p.typ)
    for (const e of mission.modell.elemente) erlaubt.set(e.id, e.typ)
    for (const e of modell.elemente) {
      const typ = erlaubt.get(e.id)
      if (typ === undefined) fehler.push(`«${e.name}» stammt nicht aus der Palette.`)
      else if (typ !== e.typ) fehler.push(`«${e.name}» muss vom Typ «${typ}» sein.`)
    }
    for (const e of mission.modell.elemente) {
      if (!els[e.id]) fehler.push(`Das vorgegebene Element «${e.name}» fehlt.`)
    }
  }

  // Lauffähigkeit: alle Anfrageklassen erreichen ihre Ziele
  if (fehler.length === 0) {
    const plan = planFuer(mission.anfragen, modell)
    fehler.push(...plan.fehler)
    if (plan.fehler.length === 0) {
      const belastet = new Set(plan.knoten.map((k) => k.element))
      for (const e of modell.elemente) {
        if (traegtLast(e) && !werteFuer(e.typ, e.sim).unbegrenzt && !belastet.has(e.id)) {
          hinweise.push(`«${e.name}» bekommt in diesem Lasttest keine Anfragen.`)
        }
      }
    }
  }
  const verbunden = new Set<string>()
  for (const v of modell.verbindungen) {
    verbunden.add(v.von)
    verbunden.add(v.nach)
  }
  for (const e of modell.elemente) {
    if (!istGruppe(e) && !verbunden.has(e.id) && e.in === undefined) hinweise.push(`«${e.name}» ist mit nichts verbunden.`)
  }

  const anforderungen = (mission.anforderungen ?? []).map((a) => pruefeAnforderung(modell, a))
  return { gueltig: fehler.length === 0, fehler, hinweise, anforderungen }
}
