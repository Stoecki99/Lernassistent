// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// lib/archsim/debrief.ts
// Nachbesprechung (9.10): Zeitachse mit Ursache → Wirkung, regelbasierte Lehren mit «was hätte geholfen»
// und Links auf die AVSW-Stationen.

import { elementIndex, kategorie } from "./routing"
import type {
  Aktion,
  ArchModell,
  Gesamtkennzahlen,
  KennzahlPunkt,
  Lehre,
  Mission,
  Nachbesprechung,
  Score,
  ZeitachsenEintrag,
  Zustand,
} from "./types"

export const STATIONS_PFAD = "/lernseiten/avsw"

export function stationsLink(station: string, abschnitt?: string): string {
  return `${STATIONS_PFAD}/${station}${abschnitt ? `#${abschnitt}` : ""}`
}

/** Lernstationen der Themen (Slug + Abschnitt) */
export const THEMEN = {
  skalieren: { station: "05-microservices", abschnitt: "objekte" },
  caching: { station: "10-fallstudie", abschnitt: "verfahren" },
  gateway: { station: "02-soa-apis", abschnitt: "gateway" },
  messaging: { station: "03-eda-message-broker", abschnitt: "messaging" },
  resilienz: { station: "03-eda-message-broker", abschnitt: "resilienz" },
  outbox: { station: "03-eda-message-broker", abschnitt: "transaktionen" },
  leitstand: { station: "11-architektur-leitstand" },
} as const

const pct = (x: number, n = 1) => `${(x * 100).toFixed(n)} %`
const ms = (x: number | null) => (x === null ? "–" : `${Math.round(x)} ms`)

function name(modell: ArchModell, id: string | null): string {
  if (!id) return "–"
  return modell.elemente.find((e) => e.id === id)?.name ?? modell.verbindungen.find((v) => v.id === id)?.label ?? id
}

function kantenName(modell: ArchModell, id: string): string {
  const v = modell.verbindungen.find((x) => x.id === id)
  if (!v) return id
  return `${name(modell, v.von)} → ${name(modell, v.nach)}`
}

/** Mittelwerte eines Fensters im Verlauf */
function fenster(v: KennzahlPunkt[], von: number, bis: number): { verf: number; p95: number | null } | null {
  const ps = v.filter((p) => p.t >= von && p.t < bis)
  if (ps.length === 0) return null
  const p95s = ps.map((p) => p.p95).filter((x): x is number => x !== null)
  const angefragt = ps.reduce((s, p) => s + p.last, 0)
  const ok = ps.reduce((s, p) => s + p.durchsatz, 0)
  return { verf: angefragt > 0 ? ok / angefragt : 1, p95: p95s.length ? p95s.reduce((a, b) => a + b, 0) / p95s.length : null }
}

function vergleich(v: KennzahlPunkt[], vorher: [number, number], nachher: [number, number]): string {
  const a = fenster(v, vorher[0], vorher[1])
  const b = fenster(v, nachher[0], nachher[1])
  if (!a || !b) return "Wirkung im Verlauf noch nicht messbar."
  const dV = b.verf - a.verf
  const dP = a.p95 !== null && b.p95 !== null ? b.p95 - a.p95 : 0
  if (Math.abs(dV) < 0.002 && Math.abs(dP) < Math.max(20, (a.p95 ?? 0) * 0.1)) {
    return `Kaum Veränderung (Verfügbarkeit ${pct(b.verf)}, p95 ${ms(b.p95)}).`
  }
  return `Verfügbarkeit ${pct(a.verf)} → ${pct(b.verf)}, p95 ${ms(a.p95)} → ${ms(b.p95)}.`
}

export function aktionText(a: Aktion, modell: ArchModell): string {
  switch (a.typ) {
    case "weiter":
      return `${a.minuten} Minuten weiter`
    case "skalieren":
      return `«${name(modell, a.element)}» auf ${a.instanzen} Instanzen skaliert`
    case "autoscaling":
      return a.an ? `Autoscaling für «${name(modell, a.element)}» eingeschaltet` : `Autoscaling für «${name(modell, a.element)}» ausgeschaltet`
    case "cache":
      return `Cache vor «${name(modell, a.element)}» gesetzt`
    case "cdn":
      return `CDN hinter «${name(modell, a.element)}» gesetzt`
    case "queue":
      return `Aufruf ${kantenName(modell, a.verbindung)} über eine Queue entkoppelt`
    case "circuitBreaker":
      return `Circuit Breaker auf ${kantenName(modell, a.verbindung)} ${a.an ? "eingeschaltet" : "ausgeschaltet"}`
    case "timeout":
      return `Timeout auf ${kantenName(modell, a.verbindung)} = ${a.ms} ms`
    case "retry":
      return `Wiederholungen auf ${kantenName(modell, a.verbindung)} = ${a.versuche}`
    case "readReplica":
      return `${a.anzahl} Read-Replica(s) für «${name(modell, a.element)}»`
    case "rateLimit":
      return a.proSekunde > 0 ? `Rate Limit ${a.proSekunde}/s an «${name(modell, a.element)}»` : `Rate Limit an «${name(modell, a.element)}» aufgehoben`
    case "bulkhead":
      return `Bulkhead auf ${kantenName(modell, a.verbindung)} ${a.an ? "eingeschaltet" : "ausgeschaltet"}`
    case "rollback":
      return `Deployment von «${name(modell, a.element)}» zurückgerollt`
  }
}

function zeitachse(mission: Mission, z: Zustand): ZeitachsenEintrag[] {
  const v = z.verlauf
  const m = z.modell
  const out: ZeitachsenEintrag[] = []

  for (const e of mission.ereignisse) {
    if (e.tick >= z.tick) continue
    out.push({
      tick: e.tick,
      art: "ereignis",
      titel: e.titel,
      ursache: e.text,
      wirkung: vergleich(v, [e.tick - 3, e.tick], [e.tick, e.tick + Math.min(e.dauer, 5)]),
    })
  }

  for (const p of z.protokoll) {
    out.push({
      tick: p.tick,
      art: "aktion",
      titel: aktionText(p.aktion, m),
      ursache: "Deine Massnahme.",
      wirkung: p.tick === 0 ? "Vorbereitung vor dem Start, wirkt von der ersten Minute an." : vergleich(v, [p.tick - 3, p.tick], [p.tick + 2, p.tick + 7]),
    })
  }

  // Störungsphasen: mindestens 2 Minuten SLO verletzt
  let start = -1
  for (let i = 0; i <= v.length; i++) {
    const verletzt = i < v.length && !v[i].sloOk
    if (verletzt && start < 0) start = i
    if (!verletzt && start >= 0) {
      const lang = i - start
      if (lang >= 2) {
        const p0 = v[start]
        const phase = v.slice(start, i)
        const schlimmst = phase.reduce((a, p) => (p.verfuegbarkeit < a.verfuegbarkeit ? p : a), phase[0])
        const p95max = phase.reduce((a, p) => Math.max(a, p.p95 ?? 0), 0)
        const engpass = phase.find((p) => p.engpass)?.engpass ?? null
        const ursachen: string[] = []
        if (engpass) ursachen.push(`Engpass «${name(m, engpass)}»`)
        const ev = [...new Set(phase.flatMap((p) => p.ereignisse))]
        if (ev.length) ursachen.push(`Ereignis: ${ev.map((id) => mission.ereignisse.find((e) => e.id === id)?.titel ?? id).join(", ")}`)
        const sturm = phase.find((p) => p.retrySturm)?.retrySturm
        if (sturm) ursachen.push(`Retry-Sturm auf ${kantenName(m, sturm)}`)
        const max = phase.reduce<KennzahlPunkt["auslastungMax"]>((a, p) => (p.auslastungMax && (!a || p.auslastungMax.wert > a.wert) ? p.auslastungMax : a), null)
        const erschoepft = [...new Set(phase.flatMap((p) => p.threadsErschoepft))]
        if (erschoepft.length) ursachen.push(`Threads erschöpft bei ${erschoepft.map((id) => `«${name(m, id)}»`).join(", ")} (warten auf langsame Aufrufe)`)
        if (ursachen.length === 0 && max) ursachen.push(`«${name(m, max.element)}» zu ${Math.round(max.wert * 100)} % ausgelastet; die Warteschlange verlängert die Antwortzeit`)
        if (ursachen.length === 0) ursachen.push("Last über der Kapazität")
        out.push({
          tick: p0.t,
          art: "stoerung",
          titel: `SLO verletzt (${lang} Minuten)`,
          ursache: ursachen.join("; ") + ".",
          wirkung: `Schlimmste Minute ${schlimmst.t}: Verfügbarkeit ${pct(schlimmst.verfuegbarkeit)}, p95 bis ${Math.round(p95max)} ms.`,
        })
        if (i < v.length) {
          out.push({ tick: v[i].t, art: "erholung", titel: "Wieder im SLO", ursache: "Last, Kapazität und Abhängigkeiten wieder im Gleichgewicht.", wirkung: `Verfügbarkeit ${pct(v[i].verfuegbarkeit)}, p95 ${ms(v[i].p95)}.` })
        }
      }
      start = -1
    }
  }

  const sturm = v.find((p) => p.retrySturm)
  if (sturm && sturm.retrySturm) {
    out.push({
      tick: sturm.t,
      art: "retrysturm",
      titel: "Retry-Sturm beginnt",
      ursache: `Viele Aufrufe auf ${kantenName(m, sturm.retrySturm)} schlagen fehl und werden wiederholt.`,
      wirkung: "Die Wiederholungen vervielfachen die Last genau dort, wo es schon klemmt; der Dienst kommt nicht mehr hoch.",
    })
  }
  const cbGesehen = new Set<string>()
  for (const p of v) {
    for (const id of p.cbOffen) {
      if (cbGesehen.has(id)) continue
      cbGesehen.add(id)
      out.push({
        tick: p.t,
        art: "circuitbreaker",
        titel: `Circuit Breaker öffnet: ${kantenName(m, id)}`,
        ursache: "Die Fehlerquote auf der Verbindung lag über 50 %.",
        wirkung: "Aufrufe scheitern sofort oder liefern die Ersatzantwort; Threads bleiben frei, die Abhängigkeit kann sich erholen.",
      })
    }
  }
  const kritAnteil = mission.anfragen.filter((k) => k.kritisch).reduce((s, k) => s + k.anteil, 0)
  const verlust = v.find((p, i) => i > 0 && p.verloren - v[i - 1].verloren >= Math.max(5, 0.02 * p.last * 60 * kritAnteil))
  if (verlust) {
    out.push({
      tick: verlust.t,
      art: "verlust",
      titel: "Kritische Vorgänge gehen verloren",
      ursache: "Bestellungen oder Zahlungen scheitern synchron oder ein Puffer läuft über.",
      wirkung: `Bis zum Schluss ${Math.round(z.summen.kritischVerloren)} verlorene Vorgänge.`,
    })
  }
  const rang: Record<string, number> = { ereignis: 0, aktion: 1, stoerung: 2, retrysturm: 3, circuitbreaker: 4, verlust: 5, erholung: 6 }
  out.sort((a, b) => a.tick - b.tick || rang[a.art] - rang[b.art])
  return out.slice(0, 24)
}

interface Regel {
  lehre: Omit<Lehre, "link" | "station"> & { thema: keyof typeof THEMEN }
  gewicht: number
}

function lehren(mission: Mission, z: Zustand, kz: Gesamtkennzahlen): Lehre[] {
  const v = z.verlauf
  const m = z.modell
  const els = elementIndex(m)
  const regeln: Regel[] = []
  const getan = (typ: Aktion["typ"], ziel?: (a: Aktion) => boolean) => z.protokoll.some((p) => p.aktion.typ === typ && (!ziel || ziel(p.aktion)))

  // Engpässe zählen
  const engpassMinuten: Record<string, number> = {}
  for (const p of v) if (p.engpass) engpassMinuten[p.engpass] = (engpassMinuten[p.engpass] ?? 0) + 1
  const ueberMinuten: Record<string, number> = {}
  for (const p of v) for (const id of p.ueberlastet) ueberMinuten[id] = (ueberMinuten[id] ?? 0) + 1

  for (const [id, n] of Object.entries(ueberMinuten).sort((a, b) => b[1] - a[1])) {
    const el = els[id]
    if (!el || n < 4) continue
    if (["datenbank", "nosql", "suche"].includes(el.typ)) {
      if (!getan("cache") && !getan("readReplica")) {
        regeln.push({
          gewicht: n * 3,
          lehre: {
            id: "daten-engpass", thema: "caching", positiv: false,
            titel: `Die Datenhaltung «${el.name}» war ${n} Minuten überlastet`,
            text: "Eine Datenbank skaliert nicht einfach horizontal. Wenn die meisten Zugriffe lesend sind, ist jeder Lesezugriff, der die Datenbank gar nicht erreicht, der beste.",
            haetteGeholfen: "Ein Cache vor der Datenbank (Cache-Aside) fängt wiederholte Lesezugriffe ab; Read-Replicas verteilen den Rest. Schreibzugriffe bleiben auf dem Primärsystem.",
          },
        })
      }
    } else if (el.typ !== "extern" && !getan("skalieren", (a) => "element" in a && a.element === id) && !getan("autoscaling", (a) => "element" in a && a.element === id)) {
      regeln.push({
        gewicht: n * 3,
        lehre: {
          id: `engpass-${id}`, thema: "skalieren", positiv: false,
          titel: `«${el.name}» war ${n} Minuten überlastet und wurde nie skaliert`,
          text: "Ab etwa 80 % Auslastung wachsen Warteschlangen und damit die Antwortzeit stark (1 ÷ (1 − ρ)); über 100 % werden Anfragen abgewiesen.",
          haetteGeholfen: `«${el.name}» rechtzeitig skalieren (neue Instanzen brauchen 2 Minuten) oder Autoscaling mit genügend hohem Maximum einschalten.`,
        },
      })
    }
  }

  // Queue-Konsumenten, die an einer langsamen Abhängigkeit hängen und die Threads ihres Dienstes belegen
  const konsumenten = new Set(m.verbindungen.filter((x) => kategorie(els[x.von]) === "messaging" && els[x.nach]).map((x) => x.nach))
  const blockierteKonsumenten = new Set<string>()
  for (const id of [...konsumenten].sort()) {
    const n = v.filter((p) => p.threadsErschoepft.includes(id)).length
    if (n < 3) continue
    blockierteKonsumenten.add(id)
    regeln.push({
      gewicht: 80 + n * 3,
      lehre: {
        id: `konsument-blockiert-${id}`, thema: "resilienz", positiv: false,
        titel: `Die Worker von «${name(m, id)}» hingen ${n} Minuten an einer langsamen Abhängigkeit`,
        text: `Die Queue schützt den Auftraggeber, aber nicht den Konsumenten: «${name(m, id)}» zieht weiter Nachrichten nach und wartet bei jeder bis zum Timeout. So belegen die Worker alle Threads; auch Abfragen, die mit der Abhängigkeit nichts zu tun haben, scheitern oder werden langsam, und die Verarbeitung der Nachrichten verzögert sich.`,
        haetteGeholfen: "Auch der Konsument braucht Resilienz: kurzer Timeout und höchstens eine Wiederholung, ein Circuit Breaker zur Abhängigkeit (Nachrichten bleiben in der Queue, bis sie wieder antwortet) oder ein Bulkhead, der den Aufrufen nur einen Teil der Threads gibt.",
      },
    })
  }

  const sturmMinuten = v.filter((p) => p.retrySturm).length
  if (sturmMinuten >= 3) {
    const kante = v.find((p) => p.retrySturm)?.retrySturm as string
    regeln.push({
      gewicht: 40 + sturmMinuten * 3,
      lehre: {
        id: "retry-sturm", thema: "resilienz", positiv: false,
        titel: `Retry-Sturm auf ${kantenName(m, kante)} (${sturmMinuten} Minuten)`,
        text: "Wiederholungen helfen bei kurzen, zufälligen Fehlern. Ist die Abhängigkeit überlastet, vervielfachen sie die Last und halten die Störung am Leben, auch wenn der Auslöser vorbei ist.",
        haetteGeholfen: "Höchstens 1–2 Wiederholungen mit Backoff, ein kurzer Timeout und ein Circuit Breaker, der bei hoher Fehlerquote sofort ablehnt.",
      },
    })
  }

  for (const e of mission.ereignisse) {
    if (e.tick >= z.tick) continue
    const w = e.wirkung
    if (w.art === "langsam" || w.art === "ausfall") {
      const phase = v.filter((p) => p.t >= e.tick && p.t < e.tick + e.dauer)
      // Blockierte Queue-Konsumenten haben eine eigene Lehre
      const andere = new Set(phase.flatMap((p) => [...p.ueberlastet, ...p.threadsErschoepft]).filter((id) => id !== w.element && !blockierteKonsumenten.has(id)))
      const verf = fenster(v, e.tick, e.tick + e.dauer)?.verf ?? 1
      const eingehend = m.verbindungen.filter((x) => x.nach === w.element)
      const langeTimeouts = eingehend.filter((x) => (z.verbindungen[x.id]?.timeoutMs ?? 0) >= 5000)
      if (andere.size > 0 && verf < 0.97) {
        regeln.push({
          gewicht: 50 + andere.size * 10,
          lehre: {
            id: `kaskade-${e.id}`, thema: "resilienz", positiv: false,
            titel: `Fehlerkaskade: «${name(m, w.element)}» hat ${[...andere].map((id) => `«${name(m, id)}»`).join(", ")} mitgerissen`,
            text: "Wer synchron auf eine langsame Abhängigkeit wartet, hält Threads fest. Sind alle Threads belegt, scheitern auch Anfragen, die mit der Abhängigkeit nichts zu tun haben.",
            haetteGeholfen:
              (langeTimeouts.length > 0 ? `Kurzer Timeout auf ${langeTimeouts.map((x) => kantenName(m, x.id)).join(", ")} (heute ${z.verbindungen[langeTimeouts[0].id].timeoutMs} ms), ` : "") +
              "Circuit Breaker, damit Aufrufe bei Störung sofort abbrechen, und ein Bulkhead, der der Abhängigkeit nur einen Teil der Threads gibt.",
          },
        })
      }
    }
    if (w.art === "deployment") {
      const behoben = z.ereignisse[e.id]?.status === "behoben"
      const rb = z.protokoll.find((p) => p.aktion.typ === "rollback" && "element" in p.aktion && p.aktion.element === w.element)
      const dauer = rb ? rb.tick - e.tick : e.dauer
      if (!behoben || dauer > 4) {
        regeln.push({
          gewicht: 30 + dauer * 2,
          lehre: {
            id: `deployment-${e.id}`, thema: "skalieren", positiv: false,
            titel: `Fehlerhaftes Deployment von «${name(m, w.element)}» lief ${dauer} Minuten`,
            text: "Eine neue Version, die Fehler wirft, ist ein Ausfall auf Raten. Je schneller zurückgerollt wird, desto kleiner der Schaden.",
            haetteGeholfen: "Fehlerquote nach jedem Deployment beobachten und sofort zurückrollen (Rolling Update mit Rollback, Canary-Release).",
          },
        })
      }
    }
    if (w.art === "lastspitze") {
      const verf = fenster(v, e.tick, e.tick + e.dauer)?.verf ?? 1
      if (verf < 0.95 && !getan("cdn") && !getan("rateLimit") && !getan("autoscaling")) {
        regeln.push({
          gewicht: 30 + (1 - verf) * 100,
          lehre: {
            id: `spitze-${e.id}`, thema: "gateway", positiv: false,
            titel: `Die Lastspitze «${e.titel}» hat das System überrollt`,
            text: "Planbare Spitzen (Aktionen, Vorverkauf) brauchen Reserve: Kapazität vorher hochfahren, statische Inhalte weit vorne ausliefern und den Rest kontrolliert drosseln.",
            haetteGeholfen: "Vor der Spitze skalieren oder Autoscaling einschalten, CDN für statische Inhalte, Rate Limiting am API-Gateway gegen Überlast.",
          },
        })
      }
    }
  }

  const entkoppelbar = mission.art === "modellieren" || mission.erlaubteAktionen.includes("queue")
  if (kz.verlorenQuote > 0.005 && !entkoppelbar) {
    regeln.push({
      gewicht: 20 + kz.verlorenQuote * 200,
      lehre: {
        id: "verlust", thema: "skalieren", positiv: false,
        titel: `${pct(kz.verlorenQuote, 1)} der kritischen Vorgänge gingen verloren`,
        text: "Wenn das System überlastet ist, scheitern auch die Anfragen, die Geld bringen. Fehlende Kapazität ist für Kundinnen dasselbe wie ein Ausfall.",
        haetteGeholfen: "Den Engpass vor der Spitze beheben: rechtzeitig skalieren und Last von der Datenhaltung fernhalten.",
      },
    })
  }
  if (kz.verlorenQuote > 0.005 && entkoppelbar) {
    regeln.push({
      gewicht: 40 + kz.verlorenQuote * 1000,
      lehre: {
        id: "verlust", thema: "outbox", positiv: false,
        titel: `${pct(kz.verlorenQuote, 1)} der kritischen Vorgänge gingen verloren`,
        text: "Ein synchroner Aufruf scheitert, sobald der Empfänger nicht antwortet. Was nicht verloren gehen darf, gehört in eine dauerhafte Queue (bzw. Outbox) und wird verarbeitet, sobald der Empfänger wieder da ist.",
        haetteGeholfen: "Den Aufruf zum unzuverlässigen Dienst über eine Queue entkoppeln; Nachrichten bleiben im Puffer, bis sie verarbeitet sind.",
      },
    })
  }
  if (kz.nachrichtenVerloren > 0 && z.verlauf.some((p) => p.rueckstau > 0)) {
    regeln.push({
      gewicht: 35,
      lehre: {
        id: "puffer-ueberlauf", thema: "messaging", positiv: false,
        titel: "Ein Puffer ist übergelaufen",
        text: "Auch eine Queue ist endlich. Wenn Konsumenten dauerhaft langsamer sind als Produzenten, wächst der Rückstau, bis Nachrichten verworfen werden.",
        haetteGeholfen: "Konsumenten skalieren und den Rückstau überwachen (Backpressure).",
      },
    })
  }
  if (kz.rueckstauEnde > 0 && kz.rueckstauEnde > z.summen.nachrichten / Math.max(1, mission.dauer) * 5) {
    regeln.push({
      gewicht: 20,
      lehre: {
        id: "rueckstau", thema: "messaging", positiv: false,
        titel: `Am Ende warteten noch ${Math.round(kz.rueckstauEnde)} Nachrichten`,
        text: "Eine Queue kauft Zeit, löst aber das Kapazitätsproblem nicht. Der Rückstau muss nach der Störung wieder abgebaut werden.",
        haetteGeholfen: "Nach der Störung den Konsumenten vorübergehend hochskalieren, bis der Rückstau abgebaut ist, aber nur so weit, wie der Empfänger dahinter die Nachholarbeit verkraftet.",
      },
    })
  }
  if (kz.kosten > kz.budget) {
    regeln.push({
      gewicht: 25 + ((kz.kosten - kz.budget) / kz.budget) * 100,
      lehre: {
        id: "kosten", thema: "skalieren", positiv: false,
        titel: `Budget um ${(kz.kosten - kz.budget).toFixed(0)} CHF überschritten`,
        text: "Dauerhaft viele Instanzen kosten auch dann, wenn die Last gering ist.",
        haetteGeholfen: "Autoscaling mit sinnvollem Minimum statt fester Reserve; gezielt nur den Engpass skalieren.",
      },
    })
  }

  // Positive Rückmeldungen
  if (kz.sloQuote >= 0.95) {
    regeln.push({
      gewicht: 1,
      lehre: {
        id: "slo-gehalten", thema: "leitstand", positiv: true,
        titel: `SLO in ${pct(kz.sloQuote, 0)} der Minuten gehalten`,
        text: "Die Architektur hat Spitzen und Störungen getragen. Genau dafür sind Reserve, Entkopplung und Resilienzmuster da.",
        haetteGeholfen: "Nichts Wesentliches. Probiere, ob es mit weniger Kosten geht.",
      },
    })
  }
  if (z.verlauf.some((p) => p.rueckstau > 100) && kz.verlorenQuote <= 0.005 && kz.verfuegbarkeit >= mission.slo.verfuegbarkeit) {
    regeln.push({
      gewicht: 1,
      lehre: {
        id: "puffer-getragen", thema: "messaging", positiv: true,
        titel: "Die Queue hat die Störung abgefedert",
        text: "Während der Empfänger nicht verarbeiten konnte, haben sich die Nachrichten im Puffer gesammelt, statt verloren zu gehen. Die Kundinnen haben davon kaum etwas gemerkt.",
        haetteGeholfen: "Nichts. So funktioniert asynchrone Entkopplung.",
      },
    })
  }
  if (v.some((p) => p.cbOffen.length > 0) && kz.verfuegbarkeit >= mission.slo.verfuegbarkeit - 0.01) {
    regeln.push({
      gewicht: 1,
      lehre: {
        id: "cb-gewirkt", thema: "resilienz", positiv: true,
        titel: "Der Circuit Breaker hat die Kaskade verhindert",
        text: "Statt Threads mit Warten zu blockieren, wurden Aufrufe zur gestörten Abhängigkeit sofort abgebrochen. Der Rest des Systems blieb gesund.",
        haetteGeholfen: "Nichts. Prüfe noch, ob es eine sinnvolle Ersatzantwort (Fallback) gibt.",
      },
    })
  }

  const negativ = regeln.filter((r) => !r.lehre.positiv).sort((a, b) => b.gewicht - a.gewicht || (a.lehre.id < b.lehre.id ? -1 : 1))
  const positiv = regeln.filter((r) => r.lehre.positiv)
  const gesehen = new Set<string>()
  const out: Lehre[] = []
  for (const r of [...negativ, ...positiv]) {
    if (gesehen.has(r.lehre.id)) continue
    gesehen.add(r.lehre.id)
    const thema = THEMEN[r.lehre.thema]
    const { thema: _thema, ...rest } = r.lehre
    void _thema
    out.push({ ...rest, station: thema.station, link: stationsLink(thema.station, "abschnitt" in thema ? thema.abschnitt : undefined) })
    if (out.length >= 6) break
  }
  return out
}

export function debrief(mission: Mission, z: Zustand, kz: Gesamtkennzahlen, score: Score): Nachbesprechung {
  const zusammenfassung =
    `Verfügbarkeit ${pct(kz.verfuegbarkeit, 2)} (Ziel ${pct(mission.slo.verfuegbarkeit, 1)}), ` +
    `p95 im Median ${ms(kz.p95Median)} (Ziel < ${mission.slo.p95Ms} ms), ` +
    `SLO in ${pct(kz.sloQuote, 0)} der Minuten eingehalten, ` +
    `Kosten ${kz.kosten.toFixed(0)} von ${kz.budget} CHF, ` +
    `${Math.round(kz.kritischVerloren)} kritische Vorgänge verloren. ` +
    `${score.total} Punkte, ${score.sterne} ${score.sterne === 1 ? "Stern" : "Sterne"}.`
  return {
    zusammenfassung,
    zeitachse: zeitachse(mission, z),
    lehren: lehren(mission, z, kz),
    lernziele: mission.lernziele.map((l) => ({ text: l.text, link: stationsLink(l.station, l.abschnitt) })),
  }
}
