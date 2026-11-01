// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// tests/archsim-validate.test.ts
// Modellprüfung (validate.ts): Struktur nach Vertrag, Palette, Lauffähigkeit und Anforderungen der Mission M4.

import { describe, test } from "node:test"
import assert from "node:assert/strict"
import { ArchSimFehler, pruefeModell, spieleNach, starte, validiere, type ArchModell } from "@/lib/archsim"
import { mission, naivesTicketModell } from "./helpers/archsim-strategien"

const m4 = mission("m4-ticketplattform")
const muster = m4.musterloesung as ArchModell

function ohne(modell: ArchModell, verbindungen: string[], elemente: string[] = []): ArchModell {
  return {
    ...modell,
    elemente: modell.elemente.filter((e) => !elemente.includes(e.id)),
    verbindungen: modell.verbindungen.filter((v) => !verbindungen.includes(v.id) && !elemente.includes(v.von) && !elemente.includes(v.nach)),
  }
}

function erfuellt(modell: ArchModell): Record<string, boolean> {
  return Object.fromEntries(validiere(m4, modell).anforderungen.map((a) => [a.id, a.erfuellt]))
}

describe("Struktur (Vertrag Abschnitt 4)", () => {
  test("Musterlösung ohne Fehler", () => {
    assert.deepEqual(pruefeModell(muster), [])
  })
  test("doppelte und ungültige IDs, unbekannte Typen und Arten, fehlende Enden", () => {
    const kaputt: ArchModell = {
      elemente: [
        { id: "a", typ: "dienst", name: "A" },
        { id: "a", typ: "dienst", name: "A2" },
        { id: "B_x", typ: "dienst", name: "B" },
        { id: "c", typ: "raumschiff" as never, name: "C" },
        { id: "g", typ: "grenze", name: "Zone" },
      ],
      verbindungen: [
        { id: "v1", von: "a", nach: "fehlt", art: "sync" },
        { id: "v2", von: "a", nach: "g", art: "sync" },
        { id: "v3", von: "a", nach: "a", art: "telepathie" as never },
      ],
    }
    const f = pruefeModell(kaputt).join("\n")
    assert.match(f, /mehrfach/)
    assert.match(f, /Ungültige ID «B_x»/)
    assert.match(f, /unbekannter Typ/)
    assert.match(f, /«fehlt» fehlt/)
    assert.match(f, /Gruppen sind nur mit «deploy»/)
    assert.match(f, /unbekannte Art/)
    assert.match(f, /auf sich selbst/)
  })
  test("Gruppen: `in` muss auf eine Gruppe zeigen, höchstens 3 Ebenen", () => {
    const tief: ArchModell = {
      elemente: [
        { id: "g1", typ: "grenze", name: "1" },
        { id: "g2", typ: "cluster", name: "2", in: "g1" },
        { id: "g3", typ: "knoten", name: "3", in: "g2" },
        { id: "g4", typ: "pod", name: "4", in: "g3" },
        { id: "s", typ: "dienst", name: "S", in: "g4" },
        { id: "t", typ: "dienst", name: "T", in: "s" },
      ],
      verbindungen: [],
    }
    const f = pruefeModell(tief).join("\n")
    assert.match(f, /tiefer als 3/)
    assert.match(f, /«s» ist keine Gruppe/)
  })
})

describe("M4 «Modelliere die Ticketplattform»", () => {
  test("Musterlösung: gültig und alle Anforderungen erfüllt", () => {
    const v = validiere(m4, muster)
    assert.ok(v.gueltig, v.fehler.join("; "))
    assert.ok(v.anforderungen.length >= 5)
    assert.ok(v.anforderungen.every((a) => a.erfuellt), v.anforderungen.filter((a) => !a.erfuellt).map((a) => a.rueckmeldung).join("; "))
  })

  test("naives Modell: lauffähig, aber CDN, Cache und Entkopplung der Zahlung fehlen", () => {
    const v = validiere(m4, naivesTicketModell(m4))
    assert.ok(v.gueltig, v.fehler.join("; "))
    const e = Object.fromEntries(v.anforderungen.map((a) => [a.id, a.erfuellt]))
    assert.deepEqual(e, { "a-gateway": true, "a-cdn": false, "a-cache": false, "a-zahlung": false, "a-mail": true, "a-daten": true })
    const zahlung = v.anforderungen.find((a) => a.id === "a-zahlung")
    assert.match(zahlung?.rueckmeldung ?? "", /ohne Queue/)
  })

  test("«Zahlungen dürfen nicht verloren gehen»: synchroner Bypass an der Queue vorbei zählt nicht", () => {
    const bypass: ArchModell = { ...muster, verbindungen: [...muster.verbindungen, { id: "bypass", von: "ticket", nach: "zahlung", art: "sync" }] }
    assert.equal(erfuellt(bypass)["a-zahlung"], false)
    const asyncOhneBroker: ArchModell = {
      ...ohne(muster, ["ticket-queue", "queue-zahlung"], ["queue"]),
      verbindungen: [...ohne(muster, ["ticket-queue", "queue-zahlung"], ["queue"]).verbindungen, { id: "direkt", von: "ticket", nach: "zahlung", art: "async" }],
    }
    assert.equal(erfuellt(asyncOhneBroker)["a-zahlung"], false, "async ohne Puffer ist nicht verlustsicher")
  })

  test("geteilte Datenbank verletzt «Jeder Dienst besitzt seine Daten»", () => {
    const geteilt: ArchModell = {
      ...ohne(muster, ["zahlung-db-zugriff"], ["zahlung-db"]),
      verbindungen: [...ohne(muster, ["zahlung-db-zugriff"], ["zahlung-db"]).verbindungen, { id: "zahlung-ticketdb", von: "zahlung", nach: "ticket-db", art: "daten" }],
    }
    const v = validiere(m4, geteilt)
    assert.equal(v.anforderungen.find((a) => a.id === "a-daten")?.erfuellt, false)
  })

  test("CDN am Gateway vorbei: Anforderung CDN nicht erfüllt", () => {
    const vorbei: ArchModell = { ...muster, verbindungen: [...muster.verbindungen, { id: "app-gw-direkt", von: "fan-app", nach: "gw", art: "sync" }] }
    assert.equal(erfuellt(vorbei)["a-cdn"], false)
  })

  test("fehlende Verbindung: nicht lauffähig, Meldung nennt die Anfrage", () => {
    const v = validiere(m4, ohne(muster, ["zahlung-psp"]))
    assert.equal(v.gueltig, false)
    assert.ok(v.fehler.some((f) => /Ticket kaufen.*Zahlungsanbieter/.test(f)), v.fehler.join("; "))
    assert.throws(() => starte(m4, 1, ohne(muster, ["zahlung-psp"])), (e: unknown) => e instanceof ArchSimFehler && e.code === "MODELL" && e.details.length > 0)
  })

  test("Elemente nur aus der Palette, mit passendem Typ; vorgegebene Elemente bleiben", () => {
    const fremd: ArchModell = { ...muster, elemente: [...muster.elemente, { id: "blockchain", typ: "dienst", name: "Blockchain", x: 9, y: 9 }] }
    assert.ok(validiere(m4, fremd).fehler.some((f) => /nicht aus der Palette/.test(f)))
    const falscherTyp: ArchModell = { ...muster, elemente: muster.elemente.map((e) => (e.id === "cache" ? { ...e, typ: "nosql" as const } : e)) }
    assert.ok(validiere(m4, falscherTyp).fehler.some((f) => /muss vom Typ «cache»/.test(f)))
    const ohneApp = ohne(muster, [], ["fan"])
    assert.ok(validiere(m4, ohneApp).fehler.some((f) => /vorgegebene Element «Fan» fehlt/.test(f)))
  })

  test("Ablenker im Modell: Hinweis, dass er keine Last bekommt", () => {
    const mitEsb: ArchModell = {
      ...muster,
      elemente: [...muster.elemente, { id: "esb", typ: "bus", name: "Enterprise Service Bus", x: 3, y: 3 }],
      verbindungen: [...muster.verbindungen, { id: "zahlung-esb", von: "zahlung", nach: "esb", art: "async" }],
    }
    const v = validiere(m4, mitEsb)
    assert.ok(v.gueltig)
    assert.ok(v.hinweise.some((h) => /Enterprise Service Bus.*keine Anfragen/.test(h)), v.hinweise.join("; "))
  })

  test("nicht erfüllte Anforderungen kosten je 75 Punkte", () => {
    const naiv = spieleNach(m4, 1, [], naivesTicketModell(m4))
    const teil = naiv.score.teile.find((t) => t.id === "anforderungen")
    assert.equal(teil?.punkte, -225)
    const gut = spieleNach(m4, 1, [], muster)
    assert.equal(gut.score.teile.find((t) => t.id === "anforderungen")?.punkte, 0)
    assert.ok(gut.validierung?.gueltig)
  })

  test("vorgegebene Missionen nehmen kein eigenes Modell, Modellier-Missionen brauchen eines", () => {
    const m1 = mission("m1-velokurier")
    assert.throws(() => starte(m1, 1, m1.modell), ArchSimFehler)
    assert.throws(() => starte(m4, 1), (e: unknown) => e instanceof ArchSimFehler && e.code === "MODELL")
  })

  test("Palette und Vorgabe ergänzen Simulationswerte des Spielermodells", () => {
    const ohneSim: ArchModell = { ...muster, elemente: muster.elemente.map(({ sim: _sim, ...rest }) => rest) }
    assert.equal(ohneSim.elemente.find((e) => e.id === "psp")?.sim, undefined)
    const z = starte(m4, 1, ohneSim)
    const psp = z.modell.elemente.find((e) => e.id === "psp")
    assert.equal(psp?.sim?.kapazitaet, 400)
  })
})
