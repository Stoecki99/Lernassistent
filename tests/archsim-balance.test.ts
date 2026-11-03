// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// tests/archsim-balance.test.ts
// Abstimmung (wie simulation-balance.test.ts): je Mission 20 feste Startwerte (1–20).
// Musterstrategie → immer 3 Sterne; ohne Massnahmen (M4: naives Modell) → höchstens 1 Stern.
// Dazu: Teilstrategien liegen dazwischen; M3: Queue allein ≤ 2 Sterne, Resilienz ohne Queue ≤ 1 Stern,
// Queue + zwei Resilienzmuster 3 Sterne.

import { describe, test } from "node:test"
import assert from "node:assert/strict"
import { MISSIONEN, spieleNach, validiere, type Aktion, type ArchModell, type Ergebnis, type Mission } from "@/lib/archsim"
import { editorModellBereinigen } from "@/components/features/architektur-leitstand/logik"
import { editorRohModell, m4Massnahmen, mission, muster, ohneMassnahmen, type Strategie } from "./helpers/archsim-strategien"

const SEEDS = Array.from({ length: 20 }, (_, i) => i + 1)

function spiele(m: Mission, s: Strategie, seed: number): Ergebnis {
  return spieleNach(m, seed, s.aktionen, s.modell)
}

function tabelle(m: Mission, name: string, rows: Ergebnis[]): string {
  const kopf = `${m.id} · ${name}\nSeed  Total ★  ${rows[0].score.teile.map((t) => t.id.slice(0, 6).padStart(7)).join("")}`
  const zeilen = rows.map((r, i) => `${String(SEEDS[i]).padStart(4)}  ${String(r.score.total).padStart(5)} ${r.score.sterne}  ${r.score.teile.map((t) => String(t.punkte).padStart(7)).join("")}`)
  return [kopf, ...zeilen].join("\n")
}

describe("Abstimmung der Missionen", () => {
  for (const m of MISSIONEN) {
    test(`${m.id}: Musterstrategie erreicht immer 3 Sterne`, () => {
      const rows = SEEDS.map((s) => spiele(m, muster(m), s))
      assert.ok(rows.every((r) => r.score.sterne === 3), tabelle(m, "Muster", rows))
    })
    test(`${m.id}: ohne Massnahmen höchstens 1 Stern`, () => {
      const rows = SEEDS.map((s) => spiele(m, ohneMassnahmen(m), s))
      assert.ok(rows.every((r) => r.score.sterne <= 1), tabelle(m, "ohne Massnahmen", rows))
      // und deutlich unter dem Muster
      const muster1 = spiele(m, muster(m), 1).score.total
      assert.ok(rows[0].score.total < muster1 - 300, `${rows[0].score.total} vs. ${muster1}`)
    })
  }

  test("M1: nur skalieren ohne Cache reicht nicht für 3 Sterne (Datenbank wird Engpass)", () => {
    const m = mission("m1-velokurier")
    const e = spiele(m, { aktionen: [{ typ: "autoscaling", element: "mono", an: true, min: 2, max: 8 }] }, 1)
    assert.ok(e.score.sterne < 3, `${e.score.total}`)
    assert.ok(e.nachbesprechung.lehren.some((l) => l.id === "daten-engpass"), e.nachbesprechung.lehren.map((l) => l.id).join(","))
  })

  test("M2: Autoscaling allein reicht nicht (Katalog-DB), mit CDN und Cache wird es gut", () => {
    const m = mission("m2-black-friday")
    const as = (el: string) => ({ typ: "autoscaling" as const, element: el, an: true, min: 2, max: 10 })
    const nurAs = spiele(m, { aktionen: ["katalog", "best", "lager", "zahlung", "versand"].map(as) }, 1)
    const mitDaten = spiele(m, { aktionen: [{ typ: "cdn", element: "shop" }, { typ: "cache", element: "katalog-db" }, ...["katalog", "best", "lager", "zahlung", "versand"].map(as)] }, 1)
    assert.ok(nurAs.score.sterne <= 1, `nur Autoscaling ${nurAs.score.total}`)
    assert.ok(mitDaten.score.total > nurAs.score.total + 200, `${mitDaten.score.total} vs. ${nurAs.score.total}`)
  })

  test("M2: ohne Rollback kostet das fehlerhafte Deployment Punkte", () => {
    const m = mission("m2-black-friday")
    const s = muster(m)
    const ohneRollback = { aktionen: s.aktionen.filter((a) => a.typ !== "rollback") }
    const a = spiele(m, s, 1).score.total
    const b = spiele(m, ohneRollback, 1).score.total
    assert.ok(b < a - 100, `${b} vs. ${a}`)
  })

  describe("M3: Queue und Resilienzmuster zählen beide (Entscheid Koordination)", () => {
    const m = mission("m3-zahlungsanbieter")
    const Q: Aktion = { typ: "queue", verbindung: "kauf-zahlung" }
    const massnahmen: Record<string, Aktion> = {
      timeout: { typ: "timeout", verbindung: "zahlung-psp", ms: 1500 },
      retry: { typ: "retry", verbindung: "zahlung-psp", versuche: 1 },
      circuitBreaker: { typ: "circuitBreaker", verbindung: "zahlung-psp", an: true },
      bulkhead: { typ: "bulkhead", verbindung: "zahlung-psp", an: true },
    }
    const namen = Object.keys(massnahmen)
    const ueberSeeds = (aktionen: Aktion[]) => SEEDS.map((s) => spiele(m, { aktionen }, s))

    test("(a) nur Queue: höchstens 2 Sterne, Nachbesprechung erklärt die blockierten Worker", () => {
      const rows = ueberSeeds([Q])
      assert.ok(rows.every((r) => r.score.sterne <= 2), tabelle(m, "nur Queue", rows))
      assert.ok(rows.every((r) => r.score.sterne >= 1), tabelle(m, "nur Queue", rows))
      const lehren = rows[0].nachbesprechung.lehren
      assert.equal(lehren[0].id, "konsument-blockiert-zahlung", lehren.map((l) => l.id).join(","))
      assert.match(lehren[0].haetteGeholfen, /Timeout/)
    })

    test("(b) Resilienz ohne Queue: Käufe gehen verloren, höchstens 1 Stern", () => {
      for (const kombi of [namen, ["timeout", "circuitBreaker"], ["timeout", "retry", "bulkhead"]]) {
        const rows = ueberSeeds(kombi.map((n) => massnahmen[n]))
        assert.ok(rows.every((r) => r.score.sterne <= 1 && r.kennzahlen.verlorenQuote > 0.02), tabelle(m, `ohne Queue: ${kombi.join("+")}`, rows))
        assert.ok(rows[0].nachbesprechung.lehren.some((l) => l.id === "verlust"))
      }
    })

    test("(c) Queue + mindestens zwei Resilienzmuster: 3 Sterne", () => {
      for (let i = 0; i < namen.length; i++) {
        for (let j = i + 1; j < namen.length; j++) {
          const rows = ueberSeeds([Q, massnahmen[namen[i]], massnahmen[namen[j]]])
          assert.ok(rows.every((r) => r.score.sterne === 3), tabelle(m, `Queue + ${namen[i]} + ${namen[j]}`, rows))
        }
      }
    })

    test("ohne Schutz reisst der hängende Anbieter das Gateway mit (Kaskade)", () => {
      const naiv = spiele(m, ohneMassnahmen(m), 1)
      assert.ok(naiv.nachbesprechung.lehren.some((l) => l.id.startsWith("kaskade-")), naiv.nachbesprechung.lehren.map((l) => l.id).join(","))
      const resil = spiele(m, { aktionen: namen.map((n) => massnahmen[n]) }, 1)
      assert.ok(resil.score.total > naiv.score.total, `${resil.score.total} vs. ${naiv.score.total}`)
    })
  })

  describe("M4: Weg durch die Oberfläche (Editor → editorModellBereinigen → starte)", () => {
    const m = mission("m4-ticketplattform")
    const editor = editorModellBereinigen(editorRohModell(m, m.musterloesung as ArchModell))

    test("Editor-Modell ohne Simulationswerte ist gültig und erfüllt alle Anforderungen", () => {
      assert.ok(editor.elemente.every((e) => e.sim === undefined) && editor.verbindungen.every((v) => v.sim === undefined))
      assert.ok(editor.verbindungen.some((v) => /^v\d+$/.test(v.id)), "Editor-IDs v1…vn")
      const v = validiere(m, editor)
      assert.ok(v.gueltig, v.fehler.join("; "))
      assert.ok(v.anforderungen.every((a) => a.erfuellt))
    })

    test("Editor-Modell + Massnahmen im Lauf: immer 3 Sterne", () => {
      const rows = SEEDS.map((s) => spiele(m, { modell: editor, aktionen: m4Massnahmen(editor) }, s))
      assert.ok(rows.every((r) => r.score.sterne === 3), tabelle(m, "Editor-Modell + Massnahmen", rows))
    })

    test("Editor-Modell ohne Massnahmen: höchstens 1 Stern", () => {
      const rows = SEEDS.map((s) => spiele(m, { modell: editor, aktionen: [] }, s))
      assert.ok(rows.every((r) => r.score.sterne <= 1), tabelle(m, "Editor-Modell ohne Massnahmen", rows))
    })

    test("Editor-Modell und Musterlösung rechnen identisch (gleiche Simulationswerte)", () => {
      const a = spiele(m, { modell: editor, aktionen: m4Massnahmen(editor) }, 3)
      const b = spiele(m, muster(m), 3)
      // Verbindungs-IDs unterscheiden sich (v1…vn), die Zahlen nicht
      const zahlen = (r: Ergebnis) => r.zustand.verlauf.map((p) => [p.last, p.verfuegbarkeit, p.p95, p.kosten, p.rueckstau, p.verloren, p.engpass, p.cbOffen.length])
      assert.deepEqual(zahlen(a), zahlen(b))
      assert.equal(a.score.total, b.score.total)
    })
  })

  test("M4: Musterlösung ohne Massnahmen im Lasttest reicht nicht für 3 Sterne", () => {
    const m = mission("m4-ticketplattform")
    const e = spiele(m, { aktionen: [], modell: m.musterloesung }, 1)
    assert.ok(e.score.sterne < 3, `${e.score.total}`)
  })
})
