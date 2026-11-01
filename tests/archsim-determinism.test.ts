// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// tests/archsim-determinism.test.ts
// Determinismus und JSON-Reinheit des Simulator-Kerns: gleicher Seed + gleiche Aktionen = gleiches Ergebnis,
// schrittweises Spielen = Nachspielen auf dem Server, Eingaben werden nie verändert.

import { describe, test } from "node:test"
import assert from "node:assert/strict"
import { ArchSimFehler, MISSIONEN, schritt, spieleNach, starte, wendeAn, type Aktion, type Zustand } from "@/lib/archsim"
import { mission, muster } from "./helpers/archsim-strategien"

/** Prüft rekursiv, dass nur JSON-Werte vorkommen (keine NaN/Infinity, undefined, Map, Set, Date) */
function assertJsonPure(value: unknown, path = "zustand"): void {
  if (value === null || typeof value === "string" || typeof value === "boolean") return
  if (typeof value === "number") {
    assert.ok(Number.isFinite(value), `${path} ist keine endliche Zahl`)
    return
  }
  if (Array.isArray(value)) {
    value.forEach((v, i) => assertJsonPure(v, `${path}[${i}]`))
    return
  }
  assert.equal(typeof value, "object", `${path} hat Typ ${typeof value}`)
  assert.equal(Object.getPrototypeOf(value), Object.prototype, `${path} ist kein einfaches Objekt`)
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    assert.notEqual(v, undefined, `${path}.${k} ist undefined`)
    assertJsonPure(v, `${path}.${k}`)
  }
}

describe("Determinismus", () => {
  for (const m of MISSIONEN) {
    test(`${m.id}: gleicher Seed und gleiche Aktionen ergeben dasselbe Ergebnis`, () => {
      const s = muster(m)
      const a = spieleNach(m, 4242, s.aktionen, s.modell)
      const b = spieleNach(m, 4242, s.aktionen, s.modell)
      assert.deepEqual(a, b)
      assert.equal(JSON.stringify(a.zustand), JSON.stringify(b.zustand))
    })
  }

  test("anderer Seed ergibt anderen Verlauf (Rauschen der Last)", () => {
    const m = mission("m2-black-friday")
    const a = spieleNach(m, 1, [])
    const b = spieleNach(m, 2, [])
    assert.notDeepEqual(
      a.zustand.verlauf.map((p) => p.last),
      b.zustand.verlauf.map((p) => p.last),
    )
  })

  test("schrittweise gespielt = am Stück nachgespielt", () => {
    const m = mission("m3-zahlungsanbieter")
    const s = muster(m)
    // Oberfläche: Aktionen einzeln, «weiter» minutenweise mit schritt()
    let z: Zustand = starte(m, 99)
    const offen: Aktion[] = []
    for (const a of s.aktionen) {
      if (a.typ === "weiter") {
        for (let i = 0; i < a.minuten; i++) {
          z = schritt(m, z, offen.splice(0))
        }
      } else {
        offen.push(a)
      }
    }
    for (const a of offen) z = wendeAn(m, z, a)
    while (z.phase !== "beendet") z = schritt(m, z)
    const server = spieleNach(m, 99, s.aktionen)
    assert.deepEqual(z, server.zustand)
  })

  test("Zustand bleibt JSON-rein, auch über JSON-Rundreise weiterspielbar", () => {
    for (const m of MISSIONEN) {
      const s = muster(m)
      const e = spieleNach(m, 7, s.aktionen, s.modell)
      assertJsonPure(e.zustand)
      assertJsonPure(e.kennzahlen, "kennzahlen")
      assertJsonPure(e.score, "score")
      assertJsonPure(e.nachbesprechung, "nachbesprechung")
    }
    const m = mission("m1-velokurier")
    let z = wendeAn(m, starte(m, 3), { typ: "weiter", minuten: 10 })
    z = JSON.parse(JSON.stringify(z)) as Zustand
    const weiter = wendeAn(m, z, { typ: "weiter", minuten: 5 })
    const direkt = wendeAn(m, wendeAn(m, starte(m, 3), { typ: "weiter", minuten: 10 }), { typ: "weiter", minuten: 5 })
    assert.deepEqual(weiter, direkt)
  })

  test("Eingaben werden nicht verändert", () => {
    const m = mission("m2-black-friday")
    const vorher = JSON.stringify(m)
    const z0 = starte(m, 5)
    const kopie = JSON.stringify(z0)
    wendeAn(m, z0, { typ: "cdn", element: "shop" })
    wendeAn(m, z0, { typ: "weiter", minuten: 3 })
    assert.equal(JSON.stringify(z0), kopie)
    spieleNach(m, 5, muster(m).aktionen)
    assert.equal(JSON.stringify(m), vorher)
  })

  test("Fehler beim Nachspielen tragen den Index der Aktion", () => {
    const m = mission("m1-velokurier")
    try {
      spieleNach(m, 1, [{ typ: "weiter", minuten: 2 }, { typ: "skalieren", element: "db", instanzen: 2 }])
      assert.fail("hätte werfen sollen")
    } catch (e) {
      assert.ok(e instanceof ArchSimFehler)
      assert.equal(e.aktionIndex, 1)
    }
    assert.throws(() => spieleNach(m, 1, [{ typ: "weiter", minuten: 80 }, { typ: "cache", element: "db" }]), (e: unknown) => e instanceof ArchSimFehler && e.code === "BEENDET" && e.aktionIndex === 1)
    assert.throws(() => starte(m, 1.5), ArchSimFehler)
  })

  test("Lauf über die ganze Mission ist schnell genug für den Server (< 200 ms)", () => {
    for (const m of MISSIONEN) {
      const s = muster(m)
      const t0 = performance.now()
      spieleNach(m, 11, s.aktionen, s.modell)
      const dt = performance.now() - t0
      assert.ok(dt < 200, `${m.id}: ${dt.toFixed(0)} ms`)
    }
  })
})
