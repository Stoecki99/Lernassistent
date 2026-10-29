// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// tests/lernfortschritt.test.ts
// Tests fuer Validierung und Schreibregeln von /api/lernfortschritt.
// Ausfuehren: npm test

import { test, describe } from "node:test"
import assert from "node:assert/strict"
import {
  fortschrittAbfrageSchema,
  fortschrittEingabeSchema,
  fortschrittSchreibdaten,
  type FortschrittEingabe,
} from "@/lib/validations/lernfortschritt"

const gueltig = { fach: "mstw", thema: "08-laplace-bedingte-wahrscheinlichkeit", status: "begonnen" }

function parse(eingabe: Record<string, unknown>) {
  return fortschrittEingabeSchema.safeParse(eingabe)
}

function eingabe(daten: Record<string, unknown>): FortschrittEingabe {
  const ergebnis = parse({ ...gueltig, ...daten })
  assert.ok(ergebnis.success, JSON.stringify(ergebnis.error?.issues))
  return ergebnis.data
}

describe("Eingabe POST /api/lernfortschritt", () => {
  test("gueltige Eingabe ohne Quiz", () => {
    assert.deepEqual(eingabe({}), { ...gueltig, quiz: null })
  })

  test("gueltige Eingabe mit Quiz, auch 0 von 0", () => {
    assert.deepEqual(eingabe({ status: "erledigt", quizRichtig: 7, quizGesamt: 8 }).quiz, { richtig: 7, gesamt: 8 })
    assert.deepEqual(eingabe({ quizRichtig: 0, quizGesamt: 0 }).quiz, { richtig: 0, gesamt: 0 })
  })

  test("null bei beiden Quiz-Werten zaehlt wie weggelassen", () => {
    assert.equal(eingabe({ quizRichtig: null, quizGesamt: null }).quiz, null)
  })

  test("unbekannte Felder werden verworfen", () => {
    assert.equal("extra" in eingabe({ extra: "x" }), false)
  })

  test("Fach nur a-z und 0-9", () => {
    for (const fach of ["MSTW", "ms-tw", "../mstw", "", "mstw/", 5, null]) {
      assert.equal(parse({ ...gueltig, fach }).success, false, String(fach))
    }
  })

  test("Thema im Format NN-name", () => {
    for (const thema of ["8-kombinatorik", "08-Kombinatorik", "../08-x", "08-x/..", "08_x", "08-x.html", "", "a".repeat(101)]) {
      assert.equal(parse({ ...gueltig, thema }).success, false, thema)
    }
    assert.equal(parse({ ...gueltig, thema: "18-pruefungstraining" }).success, true)
  })

  test("Status nur begonnen oder erledigt", () => {
    for (const status of ["fertig", "Erledigt", "", undefined, 1]) {
      assert.equal(parse({ ...gueltig, status }).success, false, String(status))
    }
  })

  test("Quiz-Werte: ganze Zahlen ab 0", () => {
    const faelle = [
      { quizRichtig: -1, quizGesamt: 5 },
      { quizRichtig: 1.5, quizGesamt: 5 },
      { quizRichtig: "3", quizGesamt: 5 },
      { quizRichtig: 3, quizGesamt: Number.NaN },
      { quizRichtig: 3, quizGesamt: 100000 },
    ]
    for (const fall of faelle) {
      assert.equal(parse({ ...gueltig, ...fall }).success, false, JSON.stringify(fall))
    }
  })

  test("Quiz-Werte nur zusammen", () => {
    const ergebnis = parse({ ...gueltig, quizRichtig: 3 })
    assert.equal(ergebnis.success, false)
    assert.match(ergebnis.error?.issues[0].message ?? "", /zusammen/)
    assert.equal(parse({ ...gueltig, quizGesamt: 3 }).success, false)
    assert.equal(parse({ ...gueltig, quizRichtig: 3, quizGesamt: null }).success, false)
  })

  test("quizRichtig nicht groesser als quizGesamt", () => {
    const ergebnis = parse({ ...gueltig, quizRichtig: 9, quizGesamt: 8 })
    assert.equal(ergebnis.success, false)
    assert.match(ergebnis.error?.issues[0].message ?? "", /grösser/)
  })

  test("Eingabe muss ein Objekt sein", () => {
    for (const roh of [null, "text", [], 42]) {
      assert.equal(fortschrittEingabeSchema.safeParse(roh).success, false)
    }
  })
})

describe("Abfrage GET /api/lernfortschritt", () => {
  test("Fach ist Pflicht und nur a-z, 0-9", () => {
    assert.equal(fortschrittAbfrageSchema.safeParse({ fach: "mstw" }).success, true)
    for (const fach of [null, "", "MSTW", "mstw;drop"]) {
      assert.equal(fortschrittAbfrageSchema.safeParse({ fach }).success, false, String(fach))
    }
  })
})

describe("Schreibregeln", () => {
  /** Wendet die Upsert-Daten wie die Datenbank auf einen gespeicherten Stand an. */
  function speichere(alt: Record<string, unknown> | null, neu: FortschrittEingabe) {
    const daten = fortschrittSchreibdaten(neu)
    return alt ? { ...alt, ...daten.update } : { quizRichtig: null, quizGesamt: null, ...daten.create }
  }

  test("neuer Eintrag uebernimmt Status und Quiz", () => {
    assert.deepEqual(speichere(null, eingabe({})), { status: "begonnen", quizRichtig: null, quizGesamt: null })
    assert.deepEqual(speichere(null, eingabe({ status: "erledigt", quizRichtig: 5, quizGesamt: 6 })), {
      status: "erledigt",
      quizRichtig: 5,
      quizGesamt: 6,
    })
  })

  test("«erledigt» wird nie auf «begonnen» zurueckgestuft", () => {
    const alt = { status: "erledigt", quizRichtig: 5, quizGesamt: 6 }
    assert.equal(speichere(alt, eingabe({ status: "begonnen" })).status, "erledigt")
    assert.equal("status" in fortschrittSchreibdaten(eingabe({ status: "begonnen" })).update, false)
  })

  test("«begonnen» wird zu «erledigt» hochgestuft", () => {
    assert.equal(speichere({ status: "begonnen" }, eingabe({ status: "erledigt" })).status, "erledigt")
  })

  test("neues Quiz-Ergebnis ersetzt das alte, ohne Quiz bleibt es stehen", () => {
    const alt = { status: "erledigt", quizRichtig: 6, quizGesamt: 6 }
    assert.deepEqual(speichere(alt, eingabe({ status: "erledigt", quizRichtig: 2, quizGesamt: 6 })), {
      status: "erledigt",
      quizRichtig: 2,
      quizGesamt: 6,
    })
    assert.deepEqual(speichere(alt, eingabe({ status: "begonnen" })), alt)
  })
})
