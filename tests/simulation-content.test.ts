// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// tests/simulation-content.test.ts
// Rechtliche Leitplanke (Spezifikation 1.2, 5.6): Szenario-Texte frei von Namen und Begriffen des
// Vorbilds und von früheren Platzhalternamen; Kennzeichnung «frei erfunden» im Briefing.

import fs from "node:fs"
import path from "node:path"
import { describe, test } from "node:test"
import assert from "node:assert/strict"

const SCENARIO_FILES = ["wolkenried.json", "einfuehrung.json"]

/**
 * Sperrliste (ohne Gross-/Kleinschreibung, ganze Wörter): Figurennamen und Begriffe des Vorbilds
 * sowie «Sorbus» (frühere Bezeichnung des fiktiven Lieferanten, AP2 hat in «Lärchwerk» umbenannt).
 * Die Liste liegt bewusst im Test, nicht im Szenario.
 */
const SPERRLISTE = ["SimulTrain", "E-COM", "ecom", "Anna", "Fred", "Sue", "Tim", "Jeff", "Novax", "STS", "Sorbus",
  // weitere Figurennamen der RACI-Tabelle des Vorbilds (Ergänzung 31.10.2026)
  "Michael", "Reto", "Alex", "Bill", "Cindy", "Felix", "Hans", "John", "Livio", "Luc", "Marco", "Paul", "Peter", "Ted"]

const HINWEIS = "Alle Namen, Personen und Organisationen sind frei erfunden."

/** Alle Zeichenketten (Werte und Schlüssel) eines JSON-Werts mit Pfad */
function strings(value: unknown, at: string, out: Array<{ at: string; text: string }>): void {
  if (typeof value === "string") out.push({ at, text: value })
  else if (Array.isArray(value)) value.forEach((v, i) => strings(v, `${at}[${i}]`, out))
  else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) {
      out.push({ at: `${at}.${k} (Schlüssel)`, text: k })
      strings(v, `${at}.${k}`, out)
    }
  }
}

function wordPattern(term: string): RegExp {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  return new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, "iu")
}

function load(file: string): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(path.join(process.cwd(), "content", "simulation", file), "utf8")) as Record<string, unknown>
}

describe("Rechtliche Leitplanke (5.6)", () => {
  for (const file of SCENARIO_FILES) {
    test(`${file}: keine Begriffe der Sperrliste`, () => {
      const found: string[] = []
      const all: Array<{ at: string; text: string }> = []
      strings(load(file), "$", all)
      for (const term of SPERRLISTE) {
        const re = wordPattern(term)
        for (const s of all) if (re.test(s.text)) found.push(`«${term}» in ${s.at}`)
      }
      assert.deepEqual(found, [], `Gesperrte Begriffe gefunden:\n${found.join("\n")}`)
    })

    test(`${file}: Briefing kennzeichnet alles als frei erfunden`, () => {
      const briefing = load(file).briefing
      assert.equal(typeof briefing, "string")
      assert.ok((briefing as string).includes(HINWEIS), `Satz «${HINWEIS}» fehlt im Briefing`)
    })
  }

  test("Sperrliste greift auf ganze Wörter, unabhängig von Gross-/Kleinschreibung", () => {
    assert.ok(wordPattern("Tim").test("Gespräch mit tim am Montag"))
    assert.ok(wordPattern("E-COM").test("Projekt e-com"))
    assert.ok(!wordPattern("Tim").test("Timing und Optimierung"))
    assert.ok(!wordPattern("Sue").test("Suessigkeit"))
    assert.ok(wordPattern("Sorbus").test("Lieferant Sorbus (Daniel Frei)"))
  })
})
