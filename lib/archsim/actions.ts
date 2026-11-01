// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// lib/archsim/actions.ts
// Massnahmen prüfen und anwenden (9.6). Arbeitet auf einer Arbeitskopie des Zustands (mutierend);
// engine.ts kopiert vorher. Ungültige Aktionen werfen ArchSimFehler mit deutscher Meldung.

import { deploymentAktiv } from "./events"
import { ArchSimFehler } from "./fehler"
import { K, MASSNAHMEN_KOSTEN, werteFuer } from "./params"
import { elementIndex, istDaten, kategorie, LAST_ARTEN, traegtLast } from "./routing"
import type { Aktion, AktionTyp, ElementLaufzeit, Mission, ModellElement, ModellVerbindung, VerbindungLaufzeit, Zustand } from "./types"

const AUFRUF_ARTEN = ["sync", "abhaengigkeit", "daten"] as const

export function leereMessung(): ElementLaufzeit["messung"] {
  return { last: 0, auslastung: 0, latenzMs: 0, fehlerquote: 0, zustand: "leer" }
}

export function neueElementLaufzeit(el: ModellElement, tick: number): ElementLaufzeit {
  const w = werteFuer(el.typ, el.sim)
  return {
    instanzen: Math.max(traegtLast(el) && !w.unbegrenzt ? 1 : 0, Math.round(w.instanzen)),
    geplant: [],
    autoscaling: null,
    tiefSeit: 0,
    replikate: 0,
    rateLimit: 0,
    seit: tick,
    messung: leereMessung(),
  }
}

export function neueVerbindungLaufzeit(v: ModellVerbindung): VerbindungLaufzeit {
  return {
    timeoutMs: v.sim?.timeoutMs ?? K.STANDARD_TIMEOUT_MS,
    retries: v.sim?.retries ?? 0,
    circuitBreaker: v.sim?.circuitBreaker ?? false,
    cbStatus: "zu",
    cbBis: 0,
    bulkhead: v.sim?.bulkhead ?? false,
    fallback: v.sim?.fallback ?? false,
  }
}

// ---------- Hilfen ----------

function element(z: Zustand, id: string): ModellElement {
  const el = z.modell.elemente.find((e) => e.id === id)
  if (!el) throw new ArchSimFehler("UNBEKANNT", `Element «${id}» gibt es im Modell nicht.`)
  return el
}

function verbindung(z: Zustand, id: string): ModellVerbindung {
  const v = z.modell.verbindungen.find((x) => x.id === id)
  if (!v) throw new ArchSimFehler("UNBEKANNT", `Verbindung «${id}» gibt es im Modell nicht.`)
  return v
}

function ganzzahl(x: number, lo: number, hi: number, was: string): void {
  if (!Number.isInteger(x) || x < lo || x > hi) throw new ArchSimFehler("UNGUELTIG", `${was} muss eine ganze Zahl von ${lo} bis ${hi} sein.`)
}

function skalierbar(el: ModellElement): number {
  const w = werteFuer(el.typ, el.sim)
  if (!traegtLast(el) || w.unbegrenzt) throw new ArchSimFehler("UNGUELTIG", `«${el.name}» lässt sich nicht skalieren.`)
  if (w.maxInstanzen <= 1) {
    const tipp = el.typ === "datenbank" ? " Für Lesezugriffe hilft eine Read-Replica, für häufige Lesezugriffe ein Cache." : ""
    throw new ArchSimFehler("UNGUELTIG", `«${el.name}» lässt sich nicht horizontal skalieren.${tipp}`)
  }
  return w.maxInstanzen
}

function aufrufVerbindung(z: Zustand, id: string): ModellVerbindung {
  const v = verbindung(z, id)
  if (!(AUFRUF_ARTEN as readonly string[]).includes(v.art)) {
    throw new ArchSimFehler("UNGUELTIG", `Auf der Verbindung «${v.label ?? v.id}» (${v.art}) wartet niemand auf eine Antwort; diese Massnahme wirkt nur auf Aufrufe.`)
  }
  return v
}

/** Freie Rasterzelle in der Nähe (für eingefügte Elemente) */
function freieZelle(z: Zustand, x: number, y: number): { x: number; y: number } {
  const belegt = new Set(z.modell.elemente.filter((e) => e.x !== undefined && e.y !== undefined).map((e) => `${e.x},${e.y}`))
  const kandidaten = [
    [x, y], [x, y + 1], [x, y - 1], [x + 1, y + 1], [x - 1, y + 1], [x + 1, y - 1], [x - 1, y - 1], [x, y + 2], [x + 1, y + 2], [x - 1, y + 2],
  ]
  for (const [cx, cy] of kandidaten) if (cy >= 0 && cx >= 0 && !belegt.has(`${cx},${cy}`)) return { x: cx, y: cy }
  let yy = y + 3
  while (belegt.has(`${x},${yy}`)) yy++
  return { x, y: yy }
}

function eindeutigeId(z: Zustand, basis: string): string {
  const ids = new Set([...z.modell.elemente.map((e) => e.id), ...z.modell.verbindungen.map((v) => v.id)])
  const b = basis.slice(0, 50)
  if (!ids.has(b)) return b
  let i = 2
  while (ids.has(`${b}-${i}`)) i++
  return `${b}-${i}`
}

function neuesElement(z: Zustand, el: ModellElement): void {
  z.modell.elemente.push(el)
  z.elemente[el.id] = neueElementLaufzeit(el, z.tick)
}

function neueVerbindung(z: Zustand, v: ModellVerbindung): void {
  z.modell.verbindungen.push(v)
  z.verbindungen[v.id] = neueVerbindungLaufzeit(v)
}

/** Instanzzahl, die nach Abschluss aller Starts aktiv ist */
export function zielInstanzen(rt: ElementLaufzeit): number {
  return rt.instanzen + rt.geplant.reduce((s, g) => s + g.anzahl, 0)
}

function setzeInstanzen(z: Zustand, id: string, ziel: number): void {
  const rt = z.elemente[id]
  if (z.phase === "bereit") {
    rt.instanzen = ziel
    rt.geplant = []
    return
  }
  const jetzt = zielInstanzen(rt)
  if (ziel > jetzt) {
    rt.geplant.push({ ab: z.tick + K.START_VERZOEGERUNG, anzahl: ziel - jetzt })
  } else if (ziel < jetzt) {
    rt.geplant = []
    rt.instanzen = Math.min(rt.instanzen, ziel)
    if (rt.instanzen < ziel) rt.geplant.push({ ab: z.tick + K.START_VERZOEGERUNG, anzahl: ziel - rt.instanzen })
  }
}

// ---------- Prüfen ----------

/** Prüft eine Aktion gegen Mission und Zustand; wirft ArchSimFehler. */
export function pruefeAktion(mission: Mission, z: Zustand, a: Aktion): void {
  if (z.phase === "beendet") throw new ArchSimFehler("BEENDET", "Die Mission ist beendet.")
  if (a.typ !== "weiter" && !mission.erlaubteAktionen.includes(a.typ)) {
    throw new ArchSimFehler("NICHT_ERLAUBT", `Die Massnahme «${a.typ}» steht in dieser Mission nicht zur Verfügung.`)
  }
  const ziele = mission.aktionsZiele?.[a.typ]
  const zielId = "element" in a ? a.element : "verbindung" in a ? a.verbindung : null
  if (ziele && zielId !== null && !ziele.includes(zielId)) {
    throw new ArchSimFehler("NICHT_ERLAUBT", `Die Massnahme «${a.typ}» ist hier nur für ${ziele.join(", ")} vorgesehen.`)
  }
  switch (a.typ) {
    case "weiter":
      ganzzahl(a.minuten, 1, mission.dauer, "Die Anzahl Minuten")
      return
    case "skalieren": {
      const max = skalierbar(element(z, a.element))
      ganzzahl(a.instanzen, 1, max, "Die Anzahl Instanzen")
      return
    }
    case "autoscaling": {
      const max = skalierbar(element(z, a.element))
      if (a.an) {
        const lo = a.min ?? 1
        const hi = a.max ?? max
        ganzzahl(lo, 1, max, "Das Minimum")
        ganzzahl(hi, lo, max, "Das Maximum")
      }
      return
    }
    case "cache": {
      const el = element(z, a.element)
      if (!["datenbank", "nosql", "suche", "speicher"].includes(el.typ)) {
        throw new ArchSimFehler("UNGUELTIG", "Ein Cache gehört vor eine Datenhaltung (Datenbank, NoSQL, Suche, Speicher).")
      }
      const leser = z.modell.verbindungen.filter((v) => v.nach === el.id && LAST_ARTEN.includes(v.art))
      if (leser.length === 0) throw new ArchSimFehler("UNGUELTIG", `Niemand liest aus «${el.name}».`)
      const els = elementIndex(z.modell)
      const hatSchon = leser.some((v) => z.modell.verbindungen.some((w) => w.von === v.von && els[w.nach]?.typ === "cache"))
      if (hatSchon) throw new ArchSimFehler("UNGUELTIG", `Vor «${el.name}» liegt schon ein Cache.`)
      return
    }
    case "cdn": {
      const el = element(z, a.element)
      if (kategorie(el) !== "client") throw new ArchSimFehler("UNGUELTIG", "Ein CDN gehört direkt hinter die Clients (Browser, App).")
      const els = elementIndex(z.modell)
      const raus = z.modell.verbindungen.filter((v) => v.von === el.id && LAST_ARTEN.includes(v.art))
      if (raus.length === 0) throw new ArchSimFehler("UNGUELTIG", `«${el.name}» ruft nichts auf.`)
      if (raus.some((v) => els[v.nach]?.typ === "cdn")) throw new ArchSimFehler("UNGUELTIG", `Hinter «${el.name}» liegt schon ein CDN.`)
      return
    }
    case "queue": {
      const v = aufrufVerbindung(z, a.verbindung)
      const els = elementIndex(z.modell)
      if (v.art === "daten" || istDaten(els[v.nach]) || kategorie(els[v.von]) === "client") {
        throw new ArchSimFehler("UNGUELTIG", "Eine Queue entkoppelt zwei Dienste; vor Datenhaltung oder direkt nach dem Client passt sie nicht.")
      }
      return
    }
    case "circuitBreaker":
    case "bulkhead":
      aufrufVerbindung(z, a.verbindung)
      return
    case "timeout":
      aufrufVerbindung(z, a.verbindung)
      ganzzahl(a.ms, 50, 60000, "Der Timeout (ms)")
      return
    case "retry":
      aufrufVerbindung(z, a.verbindung)
      ganzzahl(a.versuche, 0, 5, "Die Anzahl Wiederholungen")
      return
    case "readReplica": {
      const el = element(z, a.element)
      if (el.typ !== "datenbank") throw new ArchSimFehler("UNGUELTIG", "Read-Replicas gibt es nur für relationale Datenbanken.")
      ganzzahl(a.anzahl, 0, 5, "Die Anzahl Replicas")
      return
    }
    case "rateLimit": {
      const el = element(z, a.element)
      if (kategorie(el) !== "zugang" || el.typ === "cdn") throw new ArchSimFehler("UNGUELTIG", "Rate Limiting setzt man am Zugang (API-Gateway, Lastverteiler, Ingress).")
      ganzzahl(a.proSekunde, 0, 1000000, "Das Rate Limit (Anfragen/s)")
      return
    }
    case "rollback": {
      const el = element(z, a.element)
      if (!deploymentAktiv(mission, z, el.id)) throw new ArchSimFehler("UNGUELTIG", `Bei «${el.name}» läuft kein fehlerhaftes Deployment.`)
      return
    }
  }
}

// ---------- Anwenden ----------

/** Wendet eine geprüfte Aktion (ausser «weiter») auf die Arbeitskopie an und bucht Einmalkosten. */
export function wendeMassnahmeAn(mission: Mission, z: Zustand, a: Exclude<Aktion, { typ: "weiter" }>): void {
  let kosten = MASSNAHMEN_KOSTEN[a.typ as AktionTyp]
  switch (a.typ) {
    case "skalieren":
      setzeInstanzen(z, a.element, a.instanzen)
      break
    case "autoscaling": {
      const rt = z.elemente[a.element]
      if (!a.an) {
        rt.autoscaling = null
        kosten = 0
        break
      }
      const max = werteFuer(element(z, a.element).typ, element(z, a.element).sim).maxInstanzen
      rt.autoscaling = { min: a.min ?? 1, max: a.max ?? max }
      const ziel = zielInstanzen(rt)
      if (ziel < rt.autoscaling.min) setzeInstanzen(z, a.element, rt.autoscaling.min)
      if (ziel > rt.autoscaling.max) setzeInstanzen(z, a.element, rt.autoscaling.max)
      break
    }
    case "cache": {
      const db = element(z, a.element)
      const id = eindeutigeId(z, `cache-${db.id}`)
      const pos = freieZelle(z, db.x ?? 0, (db.y ?? 0) + 1)
      neuesElement(z, {
        id, typ: "cache", name: `Cache ${db.name}`, technologie: "Redis", x: pos.x, y: pos.y, zustand: "neu",
        info: { was: "Zwischenspeicher im Arbeitsspeicher.", wofuer: `Häufige Lesezugriffe auf «${db.name}» abfangen (Cache-Aside).` },
      })
      const leser = z.modell.verbindungen.filter((v) => v.nach === db.id && LAST_ARTEN.includes(v.art)).map((v) => v.von)
      for (const von of [...new Set(leser)].sort()) {
        neueVerbindung(z, { id: eindeutigeId(z, `${von}-${id}`), von, nach: id, art: "daten", label: "get/set" })
      }
      break
    }
    case "cdn": {
      const client = element(z, a.element)
      const id = eindeutigeId(z, `cdn-${client.id}`)
      const pos = freieZelle(z, (client.x ?? 0) + 1, client.y ?? 0)
      neuesElement(z, {
        id, typ: "cdn", name: "CDN", technologie: "Cloudflare", x: pos.x, y: pos.y, zustand: "neu",
        info: { was: "Content Delivery Network mit Servern nah bei den Nutzenden.", wofuer: "Bilder, Skripte und statische Seiten ausliefern, ohne die Dienste zu belasten." },
      })
      for (const v of z.modell.verbindungen) {
        if (v.von === client.id && LAST_ARTEN.includes(v.art)) v.von = id
      }
      neueVerbindung(z, { id: eindeutigeId(z, `${client.id}-${id}`), von: client.id, nach: id, art: "sync", label: "HTTPS" })
      break
    }
    case "queue": {
      const v = verbindung(z, a.verbindung)
      const nach = element(z, v.nach)
      const von = element(z, v.von)
      const id = eindeutigeId(z, `queue-${v.id}`)
      const pos = freieZelle(z, Math.round(((von.x ?? 0) + (nach.x ?? 0)) / 2), Math.max(von.y ?? 0, nach.y ?? 0) + 1)
      neuesElement(z, {
        id, typ: "queue", name: `Queue ${nach.name}`, technologie: "RabbitMQ", x: pos.x, y: pos.y, zustand: "neu",
        info: { was: "Dauerhafte Warteschlange.", wofuer: `Aufträge an «${nach.name}» puffern, damit «${von.name}» nicht warten muss.` },
      })
      v.nach = id
      v.art = "async"
      v.label = "Nachricht"
      neueVerbindung(z, { id: eindeutigeId(z, `${v.id}-konsum`), von: id, nach: nach.id, art: "async", label: "konsumiert" })
      break
    }
    case "circuitBreaker": {
      const rt = z.verbindungen[a.verbindung]
      rt.circuitBreaker = a.an
      if (!a.an) {
        rt.cbStatus = "zu"
        kosten = 0
      }
      break
    }
    case "bulkhead":
      z.verbindungen[a.verbindung].bulkhead = a.an
      if (!a.an) kosten = 0
      break
    case "timeout":
      z.verbindungen[a.verbindung].timeoutMs = a.ms
      break
    case "retry":
      z.verbindungen[a.verbindung].retries = a.versuche
      break
    case "readReplica": {
      const rt = z.elemente[a.element]
      kosten = a.anzahl > rt.replikate ? kosten : 0
      rt.replikate = a.anzahl
      break
    }
    case "rateLimit":
      z.elemente[a.element].rateLimit = a.proSekunde
      if (a.proSekunde === 0) kosten = 0
      break
    case "rollback": {
      const e = deploymentAktiv(mission, z, a.element)
      if (e) z.ereignisse[e.id] = { status: "behoben" }
      break
    }
  }
  z.kosten.massnahmen += kosten
  z.protokoll.push({ tick: z.tick, aktion: a })
}
