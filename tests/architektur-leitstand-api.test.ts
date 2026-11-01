// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// tests/architektur-leitstand-api.test.ts
// API des Architektur-Leitstands ohne Datenbank: Zod-Schemas der Routen, Anhängen mit Nachspielen
// (409/422, Index, Höchstzahl, Modell fehlt), Modell setzen, Punkte (Bestwert ÷ 10), Freischalten,
// Abzeichen, Versionen, Rate-Limit, Zugang Admin, Stationslinks gegen fach.json.

import { describe, test } from "node:test"
import assert from "node:assert/strict"
import fach from "../content/lernseiten/avsw/fach.json"
import { ARCHSIM_VERSION, MISSION_IDS, MISSIONEN, ladeMission, spieleNach, type Aktion } from "@/lib/archsim"
import { LeitstandError, hasLeitstandAccess } from "@/lib/leitstand"
import {
  ARCHSIM_LIMITS,
  pruefeArchsimLimit,
  pruefeModellFuerLauf,
  pruefeUndHaengeAn,
  requireMission,
  type GespeicherterLauf,
} from "@/lib/architektur-leitstand"
import {
  ARCHSIM_ABZEICHEN_BEDINGUNGEN,
  ARCHSIM_STATION,
  MAX_PUNKTE_PRO_LAUF,
  archsimAbzeichenErfuellt,
  archsimAbzeichenStatistik,
  besteSterne,
  ergebnisFuerSpeicher,
  istVeraltet,
  missionFreigeschaltet,
  nachspielen,
  punkteFuerVerbesserung,
  statusNachVersion,
  zusammenfassen,
} from "@/lib/architektur-leitstand-regeln"
import {
  MAX_AKTIONEN_PRO_ANFRAGE,
  MAX_AKTIONEN_PRO_LAUF,
  aktionenAnhaengenSchema,
  laufIdSchema,
  laufStartenSchema,
  modellSetzenSchema,
} from "@/lib/validations/architektur-leitstand"
import { mission, muster } from "./helpers/archsim-strategien"

const SEED = 4242
const m1 = mission("m1-velokurier")
const m4 = mission("m4-ticketplattform")

function lauf(aktionen: Aktion[], o: Partial<GespeicherterLauf> = {}): GespeicherterLauf {
  return {
    status: "aktiv",
    seed: SEED,
    missionId: m1.id,
    missionVersion: m1.version,
    engineVersion: ARCHSIM_VERSION,
    aktionen: structuredClone(aktionen),
    aktionCount: aktionen.length,
    modell: null,
    ...o,
  }
}

function fehler(fn: () => unknown, status: number, code?: string): LeitstandError {
  try {
    fn()
  } catch (e) {
    assert.ok(e instanceof LeitstandError, `LeitstandError erwartet, erhalten: ${String(e)}`)
    assert.equal(e.status, status)
    if (code) assert.equal(e.code, code)
    return e
  }
  assert.fail(`Fehler ${status} erwartet`)
}

describe("Zod-Schemas der Routen", () => {
  test("Lauf starten: missionId Pflicht, wiederholungVon cuid, keine Zusatzfelder", () => {
    assert.ok(laufStartenSchema.safeParse({ missionId: "m1-velokurier" }).success)
    assert.ok(laufStartenSchema.safeParse({ missionId: "m1-velokurier", wiederholungVon: "ckx0000000000000000000000" }).success)
    assert.equal(laufStartenSchema.safeParse({ missionId: "M1!" }).success, false)
    assert.equal(laufStartenSchema.safeParse({ missionId: "m1-velokurier", seed: 1 }).success, false, "Seed kommt nie vom Browser")
    assert.equal(laufStartenSchema.safeParse({ missionId: "m1-velokurier", wiederholungVon: "../x" }).success, false)
  })

  test("Aktionen anhängen: 1–200 Aktionen, gültige Aktionen, abIndex ganzzahlig", () => {
    assert.ok(aktionenAnhaengenSchema.safeParse({ abIndex: 0, aktionen: [{ typ: "weiter", minuten: 3 }] }).success)
    assert.equal(aktionenAnhaengenSchema.safeParse({ abIndex: 0, aktionen: [] }).success, false)
    assert.equal(aktionenAnhaengenSchema.safeParse({ abIndex: -1, aktionen: [{ typ: "weiter", minuten: 1 }] }).success, false)
    assert.equal(aktionenAnhaengenSchema.safeParse({ abIndex: 0.5, aktionen: [{ typ: "weiter", minuten: 1 }] }).success, false)
    assert.equal(aktionenAnhaengenSchema.safeParse({ abIndex: 0, aktionen: [{ typ: "hacken" }] }).success, false)
    assert.equal(aktionenAnhaengenSchema.safeParse({ abIndex: 0, aktionen: [{ typ: "skalieren", element: "mono", instanzen: 9999 }] }).success, false)
    const zuViele = Array.from({ length: MAX_AKTIONEN_PRO_ANFRAGE + 1 }, () => ({ typ: "weiter", minuten: 1 }))
    assert.equal(aktionenAnhaengenSchema.safeParse({ abIndex: 0, aktionen: zuViele }).success, false)
  })

  test("Modell setzen: Modell-Schema des Kerns (strikt, Obergrenzen)", () => {
    assert.ok(modellSetzenSchema.safeParse({ modell: m4.musterloesung }).success)
    assert.equal(modellSetzenSchema.safeParse({ modell: { elemente: [], verbindungen: [], boese: 1 } }).success, false)
    const gross = { elemente: Array.from({ length: 61 }, (_, i) => ({ id: `e${i}`, typ: "dienst", name: "x" })), verbindungen: [] }
    assert.equal(modellSetzenSchema.safeParse({ modell: gross }).success, false)
    assert.equal(modellSetzenSchema.safeParse({ modell: { elemente: [{ id: "a", typ: "dienst", name: "<b>x</b>", info: null }], verbindungen: [] } }).success, false)
  })

  test("Lauf-ID: cuid", () => {
    assert.ok(laufIdSchema.safeParse("ckx0000000000000000000000").success)
    assert.equal(laufIdSchema.safeParse("1; DROP").success, false)
  })
})

describe("pruefeUndHaengeAn", () => {
  test("hängt an, spielt nach und fasst zusammen", () => {
    const r = pruefeUndHaengeAn(lauf([]), { abIndex: 0, aktionen: [{ typ: "cache", element: "db" }, { typ: "weiter", minuten: 5 }] }, m1)
    assert.equal(r.aktionCount, 2)
    assert.equal(r.tick, 5)
    assert.equal(r.phase, "laeuft")
    assert.equal(r.zusammenfassung.minute, 5)
    assert.ok(r.zusammenfassung.verfuegbarkeit > 0.9)
  })

  test("409 mit aktionCount bei falschem abIndex (verlorene Antwort erkennbar)", () => {
    const e = fehler(() => pruefeUndHaengeAn(lauf([{ typ: "weiter", minuten: 2 }]), { abIndex: 0, aktionen: [{ typ: "weiter", minuten: 1 }] }, m1), 409, "CONFLICT")
    assert.equal(e.extra.aktionCount, 1)
  })

  test("409 bei nicht aktivem oder veraltetem Lauf", () => {
    fehler(() => pruefeUndHaengeAn(lauf([], { status: "abgeschlossen" }), { abIndex: 0, aktionen: [{ typ: "weiter", minuten: 1 }] }, m1), 409, "NOT_ACTIVE")
    fehler(() => pruefeUndHaengeAn(lauf([], { missionVersion: m1.version + 1 }), { abIndex: 0, aktionen: [{ typ: "weiter", minuten: 1 }] }, m1), 409, "OUTDATED")
    fehler(() => pruefeUndHaengeAn(lauf([], { engineVersion: ARCHSIM_VERSION + 1 }), { abIndex: 0, aktionen: [{ typ: "weiter", minuten: 1 }] }, m1), 409, "OUTDATED")
  })

  test("Modellieren ohne gespeichertes Modell: 409", () => {
    fehler(() => pruefeUndHaengeAn(lauf([], { missionId: m4.id, missionVersion: m4.version }), { abIndex: 0, aktionen: [{ typ: "weiter", minuten: 1 }] }, m4), 409)
  })

  test("ungültige Aktion: 422 mit Index im Gesamtprotokoll, nicht erlaubte Massnahme ebenso", () => {
    const vorher: Aktion[] = [{ typ: "weiter", minuten: 2 }]
    const e = fehler(() => pruefeUndHaengeAn(lauf(vorher), { abIndex: 1, aktionen: [{ typ: "weiter", minuten: 1 }, { typ: "skalieren", element: "db", instanzen: 3 }] }, m1), 422, "INVALID_ACTION")
    assert.equal(e.extra.index, 2)
    fehler(() => pruefeUndHaengeAn(lauf([]), { abIndex: 0, aktionen: [{ typ: "queue", verbindung: "lb-mono" }] }, m1), 422, "INVALID_ACTION")
    fehler(() => pruefeUndHaengeAn(lauf([]), { abIndex: 0, aktionen: [{ typ: "skalieren", element: "gibtsnicht", instanzen: 2 }] }, m1), 422)
  })

  test("nach dem Missionsende keine Aktionen mehr (422)", () => {
    fehler(() => pruefeUndHaengeAn(lauf([{ typ: "weiter", minuten: m1.dauer }]), { abIndex: 1, aktionen: [{ typ: "weiter", minuten: 1 }] }, m1), 422)
  })

  test(`Höchstzahl ${MAX_AKTIONEN_PRO_LAUF} Aktionen je Lauf (422 LIMIT)`, () => {
    const viele: Aktion[] = Array.from({ length: MAX_AKTIONEN_PRO_LAUF }, () => ({ typ: "skalieren", element: "mono", instanzen: 2 }))
    fehler(() => pruefeUndHaengeAn(lauf(viele), { abIndex: viele.length, aktionen: [{ typ: "weiter", minuten: 1 }] }, m1), 422, "LIMIT")
  })

  test("gespeichertes Protokoll wird geprüft (manipulierte Datenbank wirft)", () => {
    assert.throws(() => pruefeUndHaengeAn({ ...lauf([]), aktionen: [{ typ: "boese" }], aktionCount: 1 }, { abIndex: 1, aktionen: [{ typ: "weiter", minuten: 1 }] }, m1))
  })
})

describe("pruefeModellFuerLauf", () => {
  const basis = { status: "aktiv", aktionCount: 0, missionVersion: m4.version, engineVersion: ARCHSIM_VERSION }
  test("Musterlösung ist erlaubt", () => {
    assert.doesNotThrow(() => pruefeModellFuerLauf(basis, m4.musterloesung!, m4))
  })
  test("vorgegebene Mission: 400; nach der ersten Aktion: 409; nicht aktiv: 409", () => {
    fehler(() => pruefeModellFuerLauf({ ...basis, missionVersion: m1.version }, m1.modell, m1), 400)
    fehler(() => pruefeModellFuerLauf({ ...basis, aktionCount: 1 }, m4.musterloesung!, m4), 409)
    fehler(() => pruefeModellFuerLauf({ ...basis, status: "abgebrochen" }, m4.musterloesung!, m4), 409)
  })
  test("nicht lauffähiges Modell: 422 mit Details", () => {
    const e = fehler(() => pruefeModellFuerLauf(basis, m4.modell, m4), 422, "INVALID_MODEL")
    assert.ok(Array.isArray(e.extra.details) && (e.extra.details as string[]).length > 0)
  })
  test("fremde Elemente (nicht aus der Palette): 422", () => {
    const fremd = { ...m4.musterloesung!, elemente: [...m4.musterloesung!.elemente, { id: "boese", typ: "dienst" as const, name: "Hintertür" }] }
    fehler(() => pruefeModellFuerLauf(basis, fremd, m4), 422)
  })
})

describe("Nachspielen = Server-Bewertung", () => {
  test("zusammengefasste «weiter» ergeben denselben Verlauf wie Minute für Minute", () => {
    const einzeln: Aktion[] = [{ typ: "cache", element: "db" }, ...Array.from({ length: 30 }, () => ({ typ: "weiter", minuten: 1 }) as Aktion)]
    const gefasst: Aktion[] = [{ typ: "cache", element: "db" }, { typ: "weiter", minuten: 30 }]
    assert.deepEqual(nachspielen(m1, SEED, einzeln).verlauf, nachspielen(m1, SEED, gefasst).verlauf)
  })

  test("Ergebnis nach Ende entspricht spieleNach; gespeichertes Ergebnis ohne Zustand", () => {
    const s = muster(m1)
    const z = nachspielen(m1, SEED, [...s.aktionen, { typ: "weiter", minuten: m1.dauer }])
    assert.equal(z.phase, "beendet")
    const e = spieleNach(m1, SEED, s.aktionen)
    const g = ergebnisFuerSpeicher(e)
    assert.equal(g.score.total, e.score.total)
    assert.equal("zustand" in g, false)
    assert.ok(JSON.stringify(g).length < 30_000, "klein genug für die Datenbank")
    assert.equal(zusammenfassen(m1, z).phase, "beendet")
  })

  test("Modellieren: Lauf mit Musterlösung", () => {
    const z = nachspielen(m4, SEED, [{ typ: "weiter", minuten: 3 }], m4.musterloesung)
    assert.equal(z.tick, 3)
  })
})

describe("Punkte, Freischalten, Abzeichen, Versionen", () => {
  test("Punkte = Verbesserung ÷ 10, gerundet, höchstens 100, Wiederholung 0", () => {
    assert.equal(punkteFuerVerbesserung(null, 950, false), 95)
    assert.equal(punkteFuerVerbesserung(700, 765, false), 7)
    assert.equal(punkteFuerVerbesserung(800, 600, false), 0)
    assert.equal(punkteFuerVerbesserung(null, 2000, false), MAX_PUNKTE_PRO_LAUF)
    assert.equal(punkteFuerVerbesserung(null, 900, true), 0)
  })

  test("Freischalten: erste Mission immer, nächste ab 1 Stern der vorherigen", () => {
    const ids = MISSION_IDS
    assert.equal(missionFreigeschaltet(ids, ids[0], {}), true)
    assert.equal(missionFreigeschaltet(ids, ids[1], {}), false)
    assert.equal(missionFreigeschaltet(ids, ids[1], { [ids[0]]: 1 }), true)
    assert.equal(missionFreigeschaltet(ids, ids[2], { [ids[0]]: 3 }), false)
    assert.equal(missionFreigeschaltet(ids, "unbekannt", {}), false)
    const sterne = besteSterne([
      { missionId: ids[0], status: "abgeschlossen", stars: 1 },
      { missionId: ids[0], status: "abgeschlossen", stars: 3 },
      { missionId: ids[1], status: "abgebrochen", stars: 3 },
      { missionId: ids[1], status: "aktiv", stars: null },
    ])
    assert.deepEqual(sterne, { [ids[0]]: 3 })
  })

  test("Abzeichen nur aus Läufen mit neuem Startwert", () => {
    const s = archsimAbzeichenStatistik([
      { missionId: MISSION_IDS[0], status: "abgeschlossen", seedReused: false, stars: 1 },
      { missionId: MISSION_IDS[1], status: "abgeschlossen", seedReused: true, stars: 3 },
    ])
    assert.equal(archsimAbzeichenErfuellt("archsim_erste_mission", s, MISSION_IDS), true)
    assert.equal(archsimAbzeichenErfuellt("archsim_drei_sterne", s, MISSION_IDS), false)
    assert.equal(archsimAbzeichenErfuellt("archsim_alle_missionen", s, MISSION_IDS), false)
    const alle = archsimAbzeichenStatistik(MISSION_IDS.map((id) => ({ missionId: id, status: "abgeschlossen", seedReused: false, stars: 3 })))
    for (const b of ARCHSIM_ABZEICHEN_BEDINGUNGEN) assert.equal(archsimAbzeichenErfuellt(b, alle, MISSION_IDS), true)
    assert.equal(archsimAbzeichenErfuellt("leitstand_ernstfall", alle, MISSION_IDS), null)
  })

  test("Versionen: aktiver Lauf mit anderer Version wird «veraltet», abgeschlossener bleibt", () => {
    assert.equal(istVeraltet({ missionVersion: m1.version, engineVersion: ARCHSIM_VERSION }, m1), false)
    assert.equal(statusNachVersion({ status: "aktiv", missionVersion: 99, engineVersion: ARCHSIM_VERSION }, m1), "veraltet")
    assert.equal(statusNachVersion({ status: "abgeschlossen", missionVersion: 99, engineVersion: ARCHSIM_VERSION }, m1), "abgeschlossen")
  })

  test("unbekannte Mission: 400", () => {
    fehler(() => requireMission("gibts-nicht"), 400)
    assert.equal(requireMission(m1.id).id, m1.id)
  })
})

describe("Rate-Limit und Zugang", () => {
  test("Starten: 10 je Minute, die elfte abgelehnt; Zwecke getrennt", () => {
    const user = `rl-${Math.random()}`
    for (let i = 0; i < ARCHSIM_LIMITS.starten; i++) assert.equal(pruefeArchsimLimit(user, "starten"), true)
    assert.equal(pruefeArchsimLimit(user, "starten"), false)
    assert.equal(pruefeArchsimLimit(user, "lesen"), true)
    assert.ok(ARCHSIM_LIMITS.abschliessen > 0 && ARCHSIM_LIMITS.abbrechen > 0 && ARCHSIM_LIMITS.modell > 0)
  })

  test("Admin (ADMIN_EMAIL) hat Zugang ohne Datenbank", async () => {
    const alt = process.env.ADMIN_EMAIL
    process.env.ADMIN_EMAIL = "admin@test.ch"
    try {
      assert.equal(await hasLeitstandAccess({ id: "x", email: "admin@test.ch" }), true)
    } finally {
      if (alt === undefined) delete process.env.ADMIN_EMAIL
      else process.env.ADMIN_EMAIL = alt
    }
  })
})

describe("Stationslinks", () => {
  const slugs = new Set(fach.pfad.map((p) => p.slug))
  test("Station des Leitstands und alle Lernziele/Anforderungen zeigen auf bestehende AVSW-Stationen", () => {
    assert.ok(slugs.has(ARCHSIM_STATION.thema))
    for (const roh of MISSIONEN) {
      const mi = ladeMission(roh.id)!
      for (const l of mi.lernziele) assert.ok(slugs.has(l.station), `${mi.id}: ${l.station}`)
      for (const a of mi.anforderungen ?? []) if (a.station) assert.ok(slugs.has(a.station), `${mi.id}/${a.id}: ${a.station}`)
    }
  })

  test("Lehren der Nachbesprechung verlinken bestehende Stationen", () => {
    for (const roh of MISSIONEN) {
      const mi = ladeMission(roh.id)!
      const e = spieleNach(mi, 7, [], mi.art === "modellieren" ? mi.musterloesung : undefined)
      for (const l of [...e.nachbesprechung.lehren, ...e.nachbesprechung.lernziele]) {
        const slug = l.link.replace(/^\/lernseiten\/avsw\//, "").split("#")[0]
        assert.ok(slugs.has(slug), `${mi.id}: ${l.link}`)
      }
    }
  })
})
