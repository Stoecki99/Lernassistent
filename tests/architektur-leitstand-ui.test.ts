// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// tests/architektur-leitstand-ui.test.ts
// Reine Hilfen der Oberfläche: HTML-Leser ohne dangerouslySetInnerHTML, Editor-Modell bereinigen,
// Kennzahl-Ampeln, Massnahmen-Ziele und Sperrgründe, Rückstau und Fluss, Zeitreise, Chronik.

import { describe, test } from "node:test"
import assert from "node:assert/strict"
import { aktionText, modellSchema, starte, validiere, wendeAn, type Aktion } from "@/lib/archsim"
import { nachspielen } from "@/lib/architektur-leitstand-regeln"
import { bausteineIm, htmlLesen, htmlText } from "@/components/features/architektur-leitstand/html"
import {
  chronik,
  editorModellBereinigen,
  erlaubteMassnahmen,
  flussJeVerbindung,
  kacheln,
  kostenPrognose,
  massnahmenFuerElement,
  neueEreignisse,
  passtZu,
  rueckstauJeElement,
  standardAktion,
  strukturSchluessel,
  zieleFuer,
  zustandBei,
} from "@/components/features/architektur-leitstand/logik"
import { mission } from "./helpers/archsim-strategien"

const m1 = mission("m1-velokurier")
const m2 = mission("m2-black-friday")
const m3 = mission("m3-zahlungsanbieter")
const m4 = mission("m4-ticketplattform")

describe("HTML-Leser", () => {
  test("erlaubte Tags und Bausteine", () => {
    const k = htmlLesen('<p>Der <span data-baustein="ticket">Ticketservice</span> ist <strong>wichtig</strong>&amp; gut.</p>')
    assert.equal(k.length, 1)
    const p = k[0]
    assert.ok(p.art === "tag" && p.tag === "p")
    const span = p.art === "tag" ? p.kinder[1] : null
    assert.ok(span && span.art === "tag" && span.baustein === "ticket")
    assert.equal(htmlText('<p>A &amp; B</p><p>C</p>'), "A & B C")
  })

  test("Skripte, Ereignis-Attribute und unbekannte Tags bleiben Text", () => {
    const k = htmlLesen('<p onclick="x()">a</p><script>alert(1)</script><img src=x onerror=alert(1)>')
    const flach = JSON.stringify(k)
    assert.equal(flach.includes('"tag":"script"'), false)
    assert.equal(flach.includes('"tag":"img"'), false)
    assert.ok(htmlText('<script>alert(1)</script>').includes("<script>"), "als sichtbarer Text, React maskiert ihn")
  })

  test("Auftrag M4: alle Bausteine gefunden und in der Palette oder Vorgabe", () => {
    const b = bausteineIm(m4.auftrag ?? "")
    assert.ok(b.length >= 10)
    const bekannt = new Set([...(m4.palette ?? []).map((p) => p.id), ...m4.modell.elemente.map((e) => e.id)])
    for (const id of b) assert.ok(bekannt.has(id), id)
  })
})

describe("Editor-Modell bereinigen", () => {
  test("Felder der Engine (null, leere Texte, HTML im Namen) werden schema-gültig", () => {
    const roh = {
      titel: "",
      ansicht: "komponenten",
      richtung: "unten",
      elemente: [
        { id: "ticket", typ: "dienst", name: "Ticket&amp;service", technologie: "", stereotyp: "service", info: null, zustand: "ok", x: 2, y: 1 },
        { id: "gw", typ: "gateway", name: "<b>API</b>", technologie: "Kong", info: null, zustand: "ok" },
      ],
      verbindungen: [{ id: "v1", von: "gw", nach: "ticket", art: "sync", label: "", info: "" }],
      ablaeufe: [],
    }
    const m = editorModellBereinigen(roh)
    assert.ok(modellSchema.safeParse(m).success)
    assert.equal(m.elemente[0].name, "Ticket&service")
    assert.equal(m.elemente[1].name, "API")
    assert.equal(m.elemente[0].technologie, undefined)
    assert.equal(m.verbindungen[0].label, undefined)
  })

  test("Musterlösung bleibt nach dem Bereinigen gültig und lauffähig", () => {
    const m = editorModellBereinigen(JSON.parse(JSON.stringify(m4.musterloesung)))
    const v = validiere(m4, m)
    assert.equal(v.gueltig, true, v.fehler.join("; "))
    assert.ok(v.anforderungen.every((a) => a.erfuellt))
  })

  test("Strukturschlüssel ändert sich nur mit der Struktur", () => {
    const z = starte(m1, 1)
    const z2 = wendeAn(m1, z, { typ: "weiter", minuten: 3 })
    assert.equal(strukturSchluessel(z.modell), strukturSchluessel(z2.modell))
    const z3 = wendeAn(m1, z2, { typ: "cache", element: "db" })
    assert.notEqual(strukturSchluessel(z2.modell), strukturSchluessel(z3.modell))
  })
})

describe("Kennzahl-Kacheln", () => {
  test("vor dem Start neutral, sechs Kacheln", () => {
    const k = kacheln(m1, starte(m1, 1))
    assert.equal(k.length, 6)
    assert.equal(k.find((x) => x.id === "verfuegbarkeit")?.ampel, "neutral")
  })

  test("ohne Massnahmen über Mittag: p95 verletzt, mit Cache und Autoscaling im Ziel", () => {
    const ohne = nachspielen(m1, 3, [{ typ: "weiter", minuten: 50 }])
    assert.notEqual(kacheln(m1, ohne).find((x) => x.id === "p95")?.ampel, "gut")
    const mit = nachspielen(m1, 3, [{ typ: "cache", element: "db" }, { typ: "autoscaling", element: "mono", an: true, min: 2, max: 8 }, { typ: "weiter", minuten: 20 }])
    assert.equal(kacheln(m1, mit).find((x) => x.id === "p95")?.ampel, "gut")
    assert.ok(kostenPrognose(m1, mit) > mit.kosten.betrieb)
  })
})

describe("Massnahmen", () => {
  test("M1: Cache-Ziel ist die Datenbank; nach dem Einfügen gesperrt mit Grund", () => {
    let z = starte(m1, 1)
    const ziele = zieleFuer(m1, z, "cache")
    assert.deepEqual(ziele.map((x) => x.id), ["db"])
    assert.equal(ziele[0].grund, null)
    z = wendeAn(m1, z, standardAktion("cache", "db", z))
    const nachher = zieleFuer(m1, z, "cache").find((x) => x.id === "db")
    assert.ok(nachher?.grund && nachher.grund.includes("schon"))
  })

  test("Datenbank lässt sich nicht skalieren, Monolith schon", () => {
    const z = starte(m1, 1)
    assert.equal(passtZu("skalieren", m1, z.modell, "db"), false)
    assert.equal(passtZu("skalieren", m1, z.modell, "mono"), true)
    assert.deepEqual(massnahmenFuerElement(m1, z, "db").eigene.map((m) => m.typ).sort(), ["cache", "readReplica"])
  })

  test("M3: Ziele aus aktionsZiele, Queue nur zwischen Kauf und Zahlung", () => {
    const z = starte(m3, 1)
    assert.deepEqual(zieleFuer(m3, z, "queue").map((x) => x.id), ["kauf-zahlung"])
    assert.equal(passtZu("circuitBreaker", m3, z.modell, "gw-angebot"), false)
    const auf = massnahmenFuerElement(m3, z, "zahlung").aufrufe.map((v) => v.id)
    assert.deepEqual(auf, ["zahlung-psp"])
  })

  test("Standardaktionen sind für alle erlaubten Massnahmen und Ziele schema-gültig", () => {
    for (const mi of [m1, m2, m3]) {
      const z = starte(mi, 1)
      for (const info of erlaubteMassnahmen(mi)) {
        for (const ziel of zieleFuer(mi, z, info.typ)) {
          const a = standardAktion(info.typ, ziel.id, z)
          assert.equal(a.typ, info.typ)
        }
      }
    }
  })
})

describe("Rückstau, Fluss, Ereignisse", () => {
  test("M3 mit Queue: Rückstau an der Queue während des Ausfalls", () => {
    const z = nachspielen(m3, 2, [{ typ: "queue", verbindung: "kauf-zahlung" }, { typ: "weiter", minuten: 45 }])
    const r = rueckstauJeElement(m3, z)
    const q = Object.keys(r).find((id) => id.startsWith("queue"))
    assert.ok(q, "Queue gefunden")
    assert.ok(r[q as string].nachrichten > 0)
    assert.ok(r[q as string].anteil >= 0 && r[q as string].anteil <= 1)
  })

  test("Fluss auf genutzten Verbindungen, auch Nutzerin → Client", () => {
    const z = nachspielen(m1, 2, [{ typ: "weiter", minuten: 5 }])
    const f = flussJeVerbindung(m1, z)
    assert.ok(f["app-lb"]?.stufe > 0)
    assert.ok(f["kundin-app"]?.stufe > 0)
    assert.deepEqual(flussJeVerbindung(m1, starte(m1, 2)), {})
  })

  test("neue Ereignisse beim Übergang", () => {
    const a = nachspielen(m1, 2, [{ typ: "weiter", minuten: 38 }])
    const b = wendeAn(m1, a, { typ: "weiter", minuten: 1 })
    assert.deepEqual(neueEreignisse(a, b), ["regen"])
    assert.deepEqual(neueEreignisse(b, b), [])
  })
})

describe("Zeitreise und Chronik", () => {
  const aktionen: Aktion[] = [{ typ: "cache", element: "db" }, { typ: "weiter", minuten: 20 }, { typ: "skalieren", element: "mono", instanzen: 4 }, { typ: "weiter", minuten: 60 }]
  test("Zustand bei Minute t entspricht dem Nachspielen bis t", () => {
    const z = zustandBei(m1, 9, aktionen, undefined, 30)
    assert.equal(z.tick, 30)
    const vergleich = nachspielen(m1, 9, [{ typ: "cache", element: "db" }, { typ: "weiter", minuten: 20 }, { typ: "skalieren", element: "mono", instanzen: 4 }, { typ: "weiter", minuten: 10 }])
    assert.deepEqual(z.verlauf, vergleich.verlauf)
    assert.equal(zustandBei(m1, 9, aktionen, undefined, 0).tick, 0)
    assert.equal(zustandBei(m1, 9, aktionen, undefined, 500).phase, "beendet")
  })

  test("Chronik: neueste zuerst, mit Ereignis, Hinweisen und Massnahmen", () => {
    const z = nachspielen(m1, 9, aktionen)
    const c = chronik(m1, z, aktionText)
    assert.ok(c.some((x) => x.art === "ereignis"))
    assert.ok(c.some((x) => x.art === "aktion"))
    assert.ok(c.some((x) => x.art === "hinweis"))
    for (let i = 1; i < c.length; i++) assert.ok(c[i - 1].tick >= c[i].tick)
  })
})
