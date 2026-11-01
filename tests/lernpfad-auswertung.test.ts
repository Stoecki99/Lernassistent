// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// tests/lernpfad-auswertung.test.ts
// Tests fuer die reine Auswertung des Baukastens (public/lernpfad/lernpfad.js, Teil ohne DOM):
// Zahlen, Logik-Parser, Aequivalenz, Normalformen, Mustervergleich, Mengen, Hypothesen, Text.
// lernpfad.js liefert unter Node (ohne window) nur dieses Objekt aus.
// Ausfuehren: npm test

import { test, describe } from "node:test"
import assert from "node:assert/strict"
import path from "node:path"

/* eslint-disable @typescript-eslint/no-explicit-any */
// lernpfad.js ist ein Browser-Skript (kein TypeScript)
const A: any = require(path.join(process.cwd(), "public/lernpfad/lernpfad.js"))

const baum = (t: string) => {
  const r = A.formelLesen(t)
  assert.equal(r.ok, true, `${t}: ${r.fehler}`)
  return r.baum
}
const text = (t: string) => A.formelText(baum(t))
const fehler = (t: string) => {
  const r = A.formelLesen(t)
  assert.equal(r.ok, false, `${t} sollte nicht lesbar sein`)
  return r.fehler as string
}

describe("Zahlen", () => {
  test("zahlBewerten wie zahlAufgabe", () => {
    assert.equal(A.zahlBewerten("0,1667", [1 / 6], 0.0005).art, "ok")
    assert.equal(A.zahlBewerten("1/6", [1 / 6], 0.0005).art, "ok")
    assert.equal(A.zahlBewerten("16.67%", [1 / 6], 0.0005).art, "ok")
    assert.equal(A.zahlBewerten("16.67", [1 / 6], 0.0005).art, "faktor100")
    assert.equal(A.zahlBewerten("0.168", [1 / 6], 0.0005).art, "knapp")
    assert.equal(A.zahlBewerten("0.5", [1 / 6], 0.0005).art, "falsch")
    assert.equal(A.zahlBewerten("abc", [1], undefined).art, "leer")
    assert.equal(A.zahlBewerten("−3", [-3], undefined).art, "ok")
    assert.equal(A.zahlBewerten("1'234.5", [1234.5], undefined).art, "ok")
  })
})

describe("Logik-Parser", () => {
  test("ASCII-Ersatz und Unicode", () => {
    assert.equal(text("!A & B | C"), "(¬A ∧ B) ∨ C")
    assert.equal(text("~A && B || C"), "(¬A ∧ B) ∨ C")
    assert.equal(text("A /\\ B \\/ C"), "(A ∧ B) ∨ C")
    assert.equal(text("A <-> B"), "A ↔ B")
    assert.equal(text("A <=> B => C"), "A ↔ (B → C)")
    assert.equal(text("1 ∨ 0"), "⊤ ∨ ⊥")
  })

  test("Praezedenz ¬ > ∧ > ∨ > → > ↔", () => {
    assert.equal(text("A ∨ B ∧ C"), "A ∨ (B ∧ C)")
    assert.equal(text("A → B ∨ C"), "A → (B ∨ C)")
    assert.equal(text("A ↔ B → C"), "A ↔ (B → C)")
    assert.equal(text("¬A ∧ B"), "¬A ∧ B")
    assert.equal(text("¬(A ∧ B)"), "¬(A ∧ B)")
  })

  test("→ ist rechtsassoziativ", () => {
    const b = baum("A → B → C")
    assert.equal(b.t, "impl")
    assert.equal(b.a.t, "p")
    assert.equal(b.b.t, "impl")
    assert.equal(text("(A → B) → C"), "(A → B) → C")
  })

  test("ueberfluessige Klammern faellen weg", () => {
    assert.equal(text("((A)) ∧ ((B ∧ C))"), "A ∧ B ∧ C")
  })

  test("Praedikatenlogik: Quantoren, Praedikate, Funktionen, Konstanten, Gleichheit", () => {
    assert.equal(text("∀x (P(x) → Q(x))"), "∀x (P(x) → Q(x))")
    assert.equal(text("∀x(P(x)->Q(x))"), "∀x (P(x) → Q(x))")
    assert.equal(text("∃x. S(x) ∧ ¬L(x, a)"), "∃x S(x) ∧ ¬L(x, a)")
    assert.equal(text("∀x,y R(x,y)"), "∀x∀y R(x, y)")
    assert.equal(text("forall x exists y R(f(x), y)"), "∀x∃y R(f(x), y)")
    assert.equal(text("x != y"), "x ≠ y")
    assert.equal(text("f(x) = c"), "f(x) = c")
  })

  test("verstaendliche Fehlermeldungen", () => {
    assert.match(fehler(""), /leer/)
    assert.match(fehler("A ∧"), /Nach «∧» fehlt noch eine Teilformel/)
    assert.match(fehler("(A ∨ B"), /Klammer «\(» an Stelle 1 wird nicht geschlossen/)
    assert.match(fehler("A)"), /«\)» an Stelle 2 hat kein Gegenstück/)
    assert.match(fehler("A B"), /fehlt ein Junktor/)
    assert.match(fehler("A # B"), /Zeichen «#» an Stelle 3/)
    assert.match(fehler("P(x"), /fehlt «\)»/)
    assert.match(fehler("∀ P(x)"), /fehlt eine Variable/)
    assert.match(fehler("∀"), /fehlt eine Variable/)
    assert.match(fehler("∀x"), /fehlt noch die Formel/)
    assert.equal(A.formelLesen("A ∧ ").stelle, 4)
  })
})

describe("Aequivalenz per Wahrheitstafel", () => {
  test("gleichwertig trotz anderer Schreibweise", () => {
    assert.equal(A.aequivalent(baum("A → B"), baum("¬A ∨ B")).gleich, true)
    assert.equal(A.aequivalent(baum("¬(A ∧ B)"), baum("¬A ∨ ¬B")).gleich, true)
    assert.equal(A.aequivalent(baum("A ↔ B"), baum("(A → B) ∧ (B → A)")).gleich, true)
  })

  test("Vereinigung der Variablen: B ∨ ¬B ist ueberfluessig", () => {
    assert.equal(A.aequivalent(baum("A ∧ (B ∨ ¬B)"), baum("A")).gleich, true)
    assert.equal(A.aequivalent(baum("A ∧ B"), baum("A")).gleich, false)
  })

  test("Gegenbeispiel", () => {
    const v = A.aequivalent(baum("A → B"), baum("B → A"))
    assert.equal(v.gleich, false)
    assert.deepEqual(v.gegenbeispiel, { belegung: { A: false, B: true }, wertA: true, wertB: false })
  })
})

describe("Normalformen", () => {
  const form = (f: string, name: string) => A.formPruefen(baum(f), name)
  test("KNF", () => {
    assert.equal(form("(A ∨ B) ∧ (¬A ∨ C)", "knf").ok, true)
    assert.equal(form("A ∨ B", "knf").ok, true)
    assert.equal(form("A", "knf").ok, true)
    assert.equal(form("(A ∧ B) ∨ C", "knf").ok, false)
    assert.match(form("A → B", "knf").grund, /→/)
    assert.match(form("¬(A ∨ B)", "knf").grund, /De Morgan/)
  })
  test("DNF", () => {
    assert.equal(form("(A ∧ B) ∨ ¬C", "dnf").ok, true)
    assert.equal(form("(A ∨ B) ∧ C", "dnf").ok, false)
  })
  test("NNF", () => {
    assert.equal(form("¬A ∨ (B ∧ ¬C)", "nnf").ok, true)
    assert.equal(form("¬(A ∧ B)", "nnf").ok, false)
    assert.equal(form("¬¬A", "nnf").ok, false)
  })
  test("Hornform: Klauseln und Implikationsform", () => {
    assert.equal(form("(¬A ∨ ¬B ∨ C) ∧ A ∧ ¬D", "horn").ok, true)
    assert.equal(form("(A ∧ B → C) ∧ (⊤ → A) ∧ (C → ⊥)", "horn").ok, true)
    const nein = form("(A ∨ B) ∧ C", "horn")
    assert.equal(nein.ok, false)
    assert.match(nein.grund, /mehr als ein positives Literal/)
    assert.equal(form("A → B ∨ C", "horn").ok, false)
  })
})

describe("Mustervergleich (Praedikatenlogik)", () => {
  const gleich = (a: string, b: string) => A.kanonisch(baum(a)) === A.kanonisch(baum(b))
  test("Leerzeichen, Klammern, Kommutativitaet, gebundene Variablen", () => {
    assert.ok(gleich("∀x (P(x) → Q(x))", "∀y(P(y)->Q(y))"))
    assert.ok(gleich("∃x (A(x) ∧ B(x))", "∃z (B(z) & A(z))"))
    assert.ok(gleich("∀x∀y R(x,y)", "∀y∀x R(x,y)"))
    assert.ok(gleich("((A)) ∧ B", "B ∧ A"))
    assert.ok(gleich("x ≠ y", "¬(y = x)"))
    assert.ok(gleich("∀x (P(x) → ∃y L(x, y))", "∀u (P(u) → ∃v L(u, v))"))
  })
  test("echte Unterschiede bleiben", () => {
    assert.ok(!gleich("∀x∃y L(x, y)", "∃y∀x L(x, y)"))
    assert.ok(!gleich("∀x (P(x) → Q(x))", "∀x (Q(x) → P(x))"))
    assert.ok(!gleich("L(x, y)", "L(y, x)"))
    assert.ok(!gleich("P(a)", "P(b)"))
  })
  test("Hinweise auf typische Fehler", () => {
    const soll = [baum("∀x (S(x) → L(x))")]
    assert.equal(A.musterVergleichen(baum("∀z (S(z) → L(z))"), soll).gleich, true)
    assert.match(A.musterVergleichen(baum("∀x (S(x) ∧ L(x))"), soll).hinweis, /Nach ∀ folgt meist →/)
    assert.match(A.musterVergleichen(baum("S(x) → L(x)"), soll).hinweis, /«x» ist bei dir nicht durch einen Quantor gebunden/)
    assert.match(A.musterVergleichen(baum("∀x (S(x) → M(x))"), soll).hinweis, /Prädikat «M»/)
    assert.match(A.musterVergleichen(baum("∀x (S(x, x) → L(x))"), soll).hinweis, /1 Argument/)
    assert.match(A.musterVergleichen(baum("∃x (S(x) → L(x))"), [baum("∃x (S(x) ∧ L(x))")]).hinweis, /Nach ∃ folgt meist ∧/)
  })
})

describe("Mengen", () => {
  const wert = (t: string, o?: object) => {
    const r = A.mengeLesen(t, o)
    assert.equal(r.ok, true, `${t}: ${r.fehler}`)
    return r.wert
  }
  test("Reihenfolge und Doppelte egal", () => {
    assert.equal(wert("{1, 3, 5}"), wert("{5,3,1,1}"))
    assert.equal(wert("{0.5}"), wert("{1/2}"))
    assert.notEqual(wert("{1, 3}"), wert("{1, 3, 5}"))
  })
  test("verschachtelt, ¬ als ! oder ~, Gross/Klein", () => {
    assert.equal(wert("{{A, ¬B}, {C}}"), wert("{{C},{~B,A}}"))
    assert.equal(wert("{{A, ¬B}}"), wert("{{A, !B}}"))
    assert.equal(wert("{{A, ¬ B}}"), wert("{{a,¬b}}"))
    assert.notEqual(wert("{A}", { grossKlein: true }), wert("{a}", { grossKlein: true }))
  })
  test("leere Menge und leere Klausel", () => {
    assert.equal(wert("{}"), wert("∅"))
    assert.equal(wert("□"), wert("{ }"))
    assert.equal(wert("{□}"), wert("{{}}"))
    assert.notEqual(wert("{□}"), wert("{}"))
  })
  test("Tupel behalten die Reihenfolge", () => {
    assert.equal(wert("{(1,2),(2,1)}"), wert("{(2,1),(1,2)}"))
    assert.notEqual(wert("{(1,2)}"), wert("{(2,1)}"))
  })
  test("Fehlermeldungen", () => {
    assert.match(A.mengeLesen("1, 3").fehler, /geschweiften Klammern/)
    assert.match(A.mengeLesen("{1, 3").fehler, /nicht geschlossen/)
    assert.match(A.mengeLesen("{1 3}").fehler, /fehlt ein Komma/)
    assert.match(A.mengeLesen("{1,,3}").fehler, /fehlt ein Element/)
  })
})

describe("Hypothesen", () => {
  const liste = (t: string) => {
    const r = A.hypotheseLesen(t)
    assert.equal(r.ok, true, `${t}: ${r.fehler}`)
    return r.liste
  }
  const gleich = (a: string, b: string) => A.hypothesenVergleichen(liste(a), liste(b)).gleich
  test("Schreibweisen von Zeichen, μ und σ", () => {
    assert.ok(gleich("H0: μ ≤ 50", "h0:mu<=50"))
    assert.ok(gleich("H₀ : µ =< 50", "H0: μ ≤ 50"))
    assert.ok(gleich("H0: p = 0,5; H1: p != 0,5", "H1: p ≠ 0.5, H0: p = 0.5"))
    assert.ok(gleich("Ha: sigma^2 > 4", "H1: σ² > 4"))
    assert.ok(gleich("H0: 50 >= μ", "H0: μ ≤ 50"))
  })
  test("Unterschiede mit Hinweis", () => {
    assert.ok(!gleich("H0: μ ≥ 50", "H0: μ ≤ 50"))
    assert.match(A.hypothesenVergleichen(liste("H1: μ ≤ 50"), liste("H0: μ ≤ 50")).hinweis, /vertauscht/)
    assert.match(A.hypothesenVergleichen(liste("H0: μ < 50"), liste("H0: μ ≤ 50")).hinweis, /Vergleichszeichen/)
    assert.match(A.hypothesenVergleichen(liste("μ ≤ 50"), liste("H0: μ ≤ 50")).hinweis, /H0 oder H1/)
    assert.match(A.hypotheseLesen("mu kleiner 50").fehler, /kann ich nicht lesen/)
  })
})

describe("Text", () => {
  test("ohne Gross/Klein, Leerzeichen und Anfuehrungszeichen", () => {
    assert.equal(A.textNormal(" «Modus Ponens». "), A.textNormal("modusponens"))
    assert.equal(A.textNormal('"Erfüllbar"'), A.textNormal("erfüllbar"))
    assert.notEqual(A.textNormal("Tautologie"), A.textNormal("Kontradiktion"))
  })
})
