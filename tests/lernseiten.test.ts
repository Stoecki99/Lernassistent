// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// tests/lernseiten.test.ts
// Tests fuer Film-Logik und Inhaltspruefung der Lernseiten.
// Ausfuehren: npm test

import { test, describe, beforeEach, afterEach } from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import {
  szenenAufloesen,
  szenenDauerMs,
  ersteInhaltsSzene,
  klartextLaenge,
} from "@/lib/lernseiten-film"
import { ladeFaecher, ladeFach, ladeThema, ladeSpickzettel, pruefeAlleInhalte } from "@/lib/lernseiten"

describe("szenenAufloesen", () => {
  test("setzt Startwerte und vererbt fehlende Felder", () => {
    const szenen = szenenAufloesen([
      { sage: "Intro" },
      { phase: 0, text: "alle", hl: ["a"], wb: 1, wbAktiv: [0], formel: "x", sage: "eins" },
      { sage: "zwei" },
      { text: null, formel: "y", sage: "drei" },
    ])
    assert.deepEqual(szenen[0], {
      phase: -1, text: null, hl: [], wb: 0, wbAktiv: [], formel: "", sage: "Intro",
    })
    assert.deepEqual(szenen[2], {
      phase: 0, text: "alle", hl: ["a"], wb: 1, wbAktiv: [0], formel: "x", sage: "zwei",
    })
    assert.equal(szenen[3].text, null)
    assert.equal(szenen[3].formel, "y")
    assert.equal(szenen[3].wb, 1)
  })

  test("Text-Index 0 wird nicht als fehlend behandelt", () => {
    const szenen = szenenAufloesen([
      { text: "alle", sage: "a" },
      { text: 0, sage: "b" },
    ])
    assert.equal(szenen[1].text, 0)
  })
})

describe("szenenDauerMs", () => {
  test("mindestens 3,5 s bei normalem Tempo", () => {
    assert.equal(szenenDauerMs("kurz", "normal"), 3500)
  })

  test("45 ms pro Zeichen bei langen Texten", () => {
    assert.equal(szenenDauerMs("a".repeat(100), "normal"), 4500)
  })

  test("Tempo teilt die Dauer", () => {
    assert.equal(szenenDauerMs("kurz", "schnell"), Math.round(3500 / 1.5))
    assert.equal(szenenDauerMs("kurz", "langsam"), Math.round(3500 / 0.75))
  })

  test("HTML-Tags zaehlen nicht als Zeichen", () => {
    assert.equal(klartextLaenge('<span class="v">x</span> und y'), 7)
  })
})

describe("ersteInhaltsSzene", () => {
  test("ueberspringt Intro-Szenen", () => {
    const szenen = szenenAufloesen([{ sage: "a" }, { sage: "b" }, { phase: 0, sage: "c" }])
    assert.equal(ersteInhaltsSzene(szenen), 2)
  })

  test("liefert 0, wenn es keine Intro gibt", () => {
    const szenen = szenenAufloesen([{ phase: 0, sage: "a" }])
    assert.equal(ersteInhaltsSzene(szenen), 0)
  })
})

// ---------------------------------------------------------------------------
// Inhaltspruefung mit Test-Ordnern
// ---------------------------------------------------------------------------

function fach(kuerzel = "TEST") {
  return {
    kuerzel,
    titel: "Testfach",
    beschreibung: "Beschreibung",
    icon: "T",
    farbe: "#123456",
    semester: "HS26",
    sektionen: [{ id: "s1", titel: "Sektion 1" }],
  }
}

function seite(weight = 10, sektion = "s1") {
  return {
    titel: `Thema ${weight}`,
    sektion,
    vorlesung: "V1",
    beispiele: ["1.1"],
    weight,
    dauer_min: 20,
    lernziele: ["Ziel"],
    musterloesung: true,
    bausteine: {
      begriffe: [1, 2, 3].map((i) => ({ name: `B${i}`, analogie: "A", beispiel: "B" })),
      uebung: {
        frage: "Ding oder Aussage?",
        kategorien: ["Ding", "Aussage"],
        elemente: [0, 1, 0].map((k) => ({ text: "x", kategorie: k, begruendung: "weil" })),
      },
    },
    schritte: {
      muster: "So geht es",
      methode: ["1) Symbole"],
      aufgaben: [{ id: "satz1", titel: "Bsp", aufgabe: "Text", stepper: [{ methode: 0, formel: "F", warum: "W" }] }],
    },
    merke: ["a", "b", "c", "d"],
  }
}

function film() {
  return {
    phasen: ["1 · Symbole"],
    texte: ['Manche <span data-ph="stud">Studenten</span>'],
    woerterbuch: ["x"],
    szenen: [
      { phase: -1, text: null, sage: "Intro" },
      { phase: 0, text: "alle", hl: ["stud"], wb: 1, wbAktiv: [0], formel: "F", sage: "Szene" },
      ...Array.from({ length: 13 }, (_, i) => ({ sage: `Szene ${i}` })),
    ],
  }
}

function quiz(prefix = "test-10") {
  return Array.from({ length: 6 }, (_, i) => ({
    id: `${prefix}-q${i + 1}`,
    frage: "Frage",
    optionen: ["a", "b"],
    richtig: 0,
    erklaerung: "weil",
    tags: [],
    niveau: 1,
  }))
}

function spick() {
  return [{ begriff: "Begriff", kurz: "kurz", quelle: "Def. 1" }]
}

let basis: string

function schreibe(datei: string, inhalt: unknown) {
  const ziel = path.join(basis, datei)
  fs.mkdirSync(path.dirname(ziel), { recursive: true })
  fs.writeFileSync(ziel, JSON.stringify(inhalt))
}

function thema(ordner: string, teile: { seite?: unknown; film?: unknown; quiz?: unknown; spick?: unknown } = {}) {
  schreibe(`${ordner}/seite.json`, teile.seite ?? seite())
  schreibe(`${ordner}/film.json`, teile.film ?? film())
  schreibe(`${ordner}/quiz.json`, teile.quiz ?? quiz())
  schreibe(`${ordner}/spick.json`, teile.spick ?? spick())
}

describe("Inhalte laden und pruefen", () => {
  beforeEach(() => {
    basis = fs.mkdtempSync(path.join(os.tmpdir(), "lernseiten-"))
  })

  afterEach(() => {
    fs.rmSync(basis, { recursive: true, force: true })
  })

  test("gueltige Inhalte ergeben keine Fehler", () => {
    schreibe("test/fach.json", fach())
    thema("test/10-erstes")
    assert.deepEqual(pruefeAlleInhalte(basis), [])
  })

  test("Faecher mit Anzahl Themen", () => {
    schreibe("test/fach.json", fach())
    thema("test/10-erstes")
    thema("test/20-zweites", { seite: seite(20), quiz: quiz("test-20") })
    const faecher = ladeFaecher(basis)
    assert.equal(faecher.length, 1)
    assert.equal(faecher[0].slug, "test")
    assert.equal(faecher[0].anzahlThemen, 2)
  })

  test("Themen sind nach weight sortiert", () => {
    schreibe("test/fach.json", fach())
    thema("test/20-zweites", { seite: seite(5), quiz: quiz("test-20") })
    thema("test/10-erstes", { seite: seite(30) })
    const ergebnis = ladeFach("test", basis)
    assert.deepEqual(ergebnis?.themen.map((t) => t.slug), ["20-zweites", "10-erstes"])
  })

  test("Gross-/Kleinschreibung des Fachs spielt keine Rolle", () => {
    schreibe("test/fach.json", fach())
    thema("test/10-erstes")
    assert.ok(ladeFach("TEST", basis))
    assert.ok(ladeThema("Test", "10-erstes", basis))
  })

  test("unbekanntes Fach oder Thema ergibt null", () => {
    schreibe("test/fach.json", fach())
    thema("test/10-erstes")
    assert.equal(ladeFach("gibtsnicht", basis), null)
    assert.equal(ladeThema("test", "99-nichts", basis), null)
  })

  test("Pfade mit ../ werden abgewiesen", () => {
    schreibe("test/fach.json", fach())
    thema("test/10-erstes")
    assert.equal(ladeFach("../test", basis), null)
    assert.equal(ladeThema("test", "../10-erstes", basis), null)
  })

  test("Spickzettel sammelt Eintraege aller Themen", () => {
    schreibe("test/fach.json", fach())
    thema("test/10-erstes")
    thema("test/20-zweites", { seite: seite(20), quiz: quiz("test-20") })
    const zettel = ladeSpickzettel("test", basis)
    assert.equal(zettel.length, 2)
    assert.equal(zettel[0].thema, "Thema 10")
  })

  test("meldet unbekannte Sektion", () => {
    schreibe("test/fach.json", fach())
    thema("test/10-erstes", { seite: seite(10, "s9") })
    assert.match(pruefeAlleInhalte(basis).join("\n"), /Sektion «s9»/)
  })

  test("meldet doppelte Quiz-IDs ueber Themen hinweg", () => {
    schreibe("test/fach.json", fach())
    thema("test/10-erstes")
    thema("test/20-zweites", { seite: seite(20), quiz: quiz("test-10") })
    assert.match(pruefeAlleInhalte(basis).join("\n"), /doppelt/)
  })

  test("meldet Quiz-ID mit falschem Praefix", () => {
    schreibe("test/fach.json", fach())
    thema("test/10-erstes", { quiz: quiz("test-99") })
    assert.match(pruefeAlleInhalte(basis).join("\n"), /test-10-/)
  })

  test("meldet ungueltige Film-Verweise", () => {
    schreibe("test/fach.json", fach())
    const f = film()
    f.szenen.push({ phase: 5, sage: "Phase fehlt" } as never)
    f.szenen.push({ hl: ["fehlt"], sage: "hl fehlt" } as never)
    f.szenen.push({ text: 3, sage: "Text fehlt" } as never)
    f.szenen.push({ wb: 1, wbAktiv: [4], sage: "wbAktiv unsichtbar" } as never)
    thema("test/10-erstes", { film: f })
    const fehler = pruefeAlleInhalte(basis).join("\n")
    assert.match(fehler, /phase 5/)
    assert.match(fehler, /data-ph «fehlt»/)
    assert.match(fehler, /texte\[3\]/)
    assert.match(fehler, /wbAktiv 4/)
  })

  test("meldet Fachordner, der nicht zum Kuerzel passt", () => {
    schreibe("anders/fach.json", fach("TEST"))
    thema("anders/10-erstes", { quiz: quiz("anders-10") })
    assert.match(pruefeAlleInhalte(basis).join("\n"), /Kürzel/)
  })

  test("meldet Fachordner mit Namen einer App-Seite", () => {
    schreibe("chat/fach.json", fach("CHAT"))
    thema("chat/10-erstes", { quiz: quiz("chat-10") })
    assert.match(pruefeAlleInhalte(basis, ["chat", "decks"]).join("\n"), /App-Seite/)
  })

  test("meldet fehlende Datei und ungueltiges JSON", () => {
    schreibe("test/fach.json", fach())
    thema("test/10-erstes")
    fs.rmSync(path.join(basis, "test/10-erstes/spick.json"))
    fs.writeFileSync(path.join(basis, "test/10-erstes/quiz.json"), "{kaputt")
    const fehler = pruefeAlleInhalte(basis).join("\n")
    assert.match(fehler, /spick\.json/)
    assert.match(fehler, /quiz\.json/)
  })
})
