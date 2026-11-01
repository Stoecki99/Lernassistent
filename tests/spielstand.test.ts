// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// tests/spielstand.test.ts
// Tests fuer Validierung, Bestwert-Regel, Punkte, Rate-Limit, race-sicheres Speichern (ohne Datenbank,
// mit nachgebauter Transaktion) und Abzeichen-Bedingungen von /api/spielstand.
// Ausfuehren: npm test

import { test, describe } from "node:test"
import assert from "node:assert/strict"
import {
  MAX_XP,
  bewerteSpielstand,
  istBesser,
  spielstandAbfrageSchema,
  spielstandEingabeSchema,
  spielstandPunkte,
  type SpielstandEingabe,
} from "@/lib/validations/spielstand"
import {
  MAX_SPIELSTAENDE_PRO_FACH,
  SPIEL_ABZEICHEN_BEDINGUNGEN,
  SPIELSTAND_LIMITS,
  SpielstandVollFehler,
  pruefeSpielstandLimit,
  speichereSpielstand,
  spielAbzeichenErfuellt,
} from "@/lib/spielstand"

const gueltig = { fach: "avsw", spiel: "avsw-02-kommunikation", level: "l1", sterne: 2, xp: 140 }

function parse(eingabe: Record<string, unknown>) {
  return spielstandEingabeSchema.safeParse(eingabe)
}

function eingabe(daten: Record<string, unknown> = {}): SpielstandEingabe {
  const ergebnis = parse({ ...gueltig, ...daten })
  assert.ok(ergebnis.success, JSON.stringify(ergebnis.error?.issues))
  return ergebnis.data
}


const vp = (b: { verbessert: boolean; punkte: number }) => ({ verbessert: b.verbessert, punkte: b.punkte })

describe("Eingabe POST /api/spielstand", () => {
  test("gueltige Eingabe, unbekannte Felder werden verworfen", () => {
    assert.deepEqual(eingabe(), gueltig)
    assert.equal("extra" in eingabe({ extra: "x" }), false)
  })

  test("Fach nur a-z und 0-9", () => {
    for (const fach of ["AVSW", "av-sw", "../avsw", "", "avsw/", 5, null, "a".repeat(41)]) {
      assert.equal(parse({ ...gueltig, fach }).success, false, String(fach))
    }
  })

  test("Spiel: a-z, 0-9 und Bindestrich, 1–60 Zeichen", () => {
    for (const spiel of ["", "Avsw-02", "avsw_02", "avsw 02", "../x", "a/b", "a".repeat(61), 7, null]) {
      assert.equal(parse({ ...gueltig, spiel }).success, false, String(spiel))
    }
    assert.equal(parse({ ...gueltig, spiel: "a".repeat(60) }).success, true)
    assert.equal(parse({ ...gueltig, spiel: "-" }).success, true)
  })

  test("Level: a-z, 0-9 und Bindestrich, 1–40 Zeichen", () => {
    for (const level of ["", "L1", "l_1", "l.1", "a".repeat(41), 1, undefined]) {
      assert.equal(parse({ ...gueltig, level }).success, false, String(level))
    }
    assert.equal(parse({ ...gueltig, level: "a".repeat(40) }).success, true)
  })

  test("Sterne ganzzahlig 0–3, Grenzen inklusive", () => {
    for (const sterne of [0, 3]) assert.equal(parse({ ...gueltig, sterne }).success, true, String(sterne))
    for (const sterne of [-1, 4, 1.5, "2", null, undefined, Number.NaN]) {
      assert.equal(parse({ ...gueltig, sterne }).success, false, String(sterne))
    }
  })

  test("XP ganzzahlig 0–500, Grenzen inklusive", () => {
    for (const xp of [0, MAX_XP]) assert.equal(parse({ ...gueltig, xp }).success, true, String(xp))
    for (const xp of [-1, MAX_XP + 1, 10.5, "100", null, undefined, Number.POSITIVE_INFINITY]) {
      assert.equal(parse({ ...gueltig, xp }).success, false, String(xp))
    }
  })

  test("Fehlermeldungen auf Deutsch", () => {
    const ergebnis = parse({ ...gueltig, xp: 501 })
    assert.equal(ergebnis.success, false)
    assert.match(ergebnis.error?.issues[0]?.message ?? "", /XP/)
  })
})

describe("Abfrage GET /api/spielstand", () => {
  test("Fach erforderlich und im Format a-z0-9", () => {
    assert.equal(spielstandAbfrageSchema.safeParse({ fach: "avsw" }).success, true)
    for (const fach of [null, "", "AVSW", "../x"]) {
      assert.equal(spielstandAbfrageSchema.safeParse({ fach }).success, false, String(fach))
    }
  })
})

describe("Bestwert-Regel", () => {
  test("ohne alten Stand ist jeder Wert besser, auch 0 Sterne und 0 XP", () => {
    assert.equal(istBesser({ sterne: 0, xp: 0 }, null), true)
  })

  test("mehr Sterne schlagen mehr XP", () => {
    assert.equal(istBesser({ sterne: 3, xp: 10 }, { sterne: 2, xp: 500 }), true)
    assert.equal(istBesser({ sterne: 2, xp: 500 }, { sterne: 3, xp: 10 }), false)
  })

  test("gleiche Sterne: nur mehr XP ist besser, Gleichstand nicht", () => {
    assert.equal(istBesser({ sterne: 2, xp: 141 }, { sterne: 2, xp: 140 }), true)
    assert.equal(istBesser({ sterne: 2, xp: 140 }, { sterne: 2, xp: 140 }), false)
    assert.equal(istBesser({ sterne: 2, xp: 139 }, { sterne: 2, xp: 140 }), false)
  })
})

describe("Punkte", () => {
  test("Verbesserung ÷ 10, abgerundet", () => {
    assert.equal(spielstandPunkte(null, 0), 0)
    assert.equal(spielstandPunkte(null, 9), 0)
    assert.equal(spielstandPunkte(null, 10), 1)
    assert.equal(spielstandPunkte(null, 499), 49)
    assert.equal(spielstandPunkte(null, MAX_XP), 50)
    assert.equal(spielstandPunkte(140, 159), 1)
    assert.equal(spielstandPunkte(140, 160), 2)
  })

  test("nie negativ", () => {
    assert.equal(spielstandPunkte(300, 100), 0)
  })

  test("bewerteSpielstand: schlechter oder gleich → nichts", () => {
    assert.deepEqual(vp(bewerteSpielstand({ sterne: 2, xp: 140 }, { sterne: 2, xp: 140 })), { verbessert: false, punkte: 0 })
    assert.deepEqual(vp(bewerteSpielstand({ sterne: 3, xp: 100 }, { sterne: 2, xp: 500 })), { verbessert: true, punkte: 40 })
    // XP sinkt nie: weniger Sterne, aber mehr XP hebt nur die XP
    assert.deepEqual(bewerteSpielstand({ sterne: 3, xp: 100 }, { sterne: 2, xp: 500 }).stand, { sterne: 3, xp: 500 })
    // mehr Sterne mit weniger XP: XP bleibt, zweite Verbesserung zahlt nicht doppelt
    assert.deepEqual(bewerteSpielstand({ sterne: 2, xp: 300 }, { sterne: 3, xp: 200 }).stand, { sterne: 3, xp: 300 })
  })

  test("bewerteSpielstand: erster Stand und Verbesserungen", () => {
    assert.deepEqual(vp(bewerteSpielstand(null, { sterne: 1, xp: 95 })), { verbessert: true, punkte: 9 })
    assert.deepEqual(vp(bewerteSpielstand({ sterne: 1, xp: 95 }, { sterne: 1, xp: 120 })), { verbessert: true, punkte: 2 })
  })

  test("mehr Sterne mit weniger XP: verbessert, aber 0 Punkte", () => {
    assert.deepEqual(vp(bewerteSpielstand({ sterne: 2, xp: 300 }, { sterne: 3, xp: 200 })), { verbessert: true, punkte: 0 })
  })

  test("ein Level bringt hoechstens 50 Punkte, solange die Sterne gleich bleiben", () => {
    let alt: { sterne: number; xp: number } | null = null
    let summe = 0
    for (const xp of [0, 37, 99, 250, 499, 500, 500, 120]) {
      const bewertung = bewerteSpielstand(alt, { sterne: 2, xp })
      summe += bewertung.punkte
      if (bewertung.verbessert) alt = { sterne: 2, xp }
    }
    assert.ok(summe <= MAX_XP / 10, `Summe ${summe}`)
  })
})

describe("Rate-Limit", () => {
  test("60 Schreibanfragen je Minute und Konto, Lesen getrennt", () => {
    const userId = `limit-test-${Date.now()}`
    for (let i = 0; i < SPIELSTAND_LIMITS.schreiben; i++) assert.equal(pruefeSpielstandLimit(userId, "schreiben"), true)
    assert.equal(pruefeSpielstandLimit(userId, "schreiben"), false)
    assert.equal(pruefeSpielstandLimit(userId, "lesen"), true)
    assert.equal(pruefeSpielstandLimit(`${userId}-anderes-konto`, "schreiben"), true)
  })
})

// ---------- Speichern mit nachgebauter Transaktion ----------

interface Zeile {
  id: string
  userId: string
  fach: string
  spiel: string
  level: string
  sterne: number
  xp: number
}

interface FakeOptionen {
  zeilen?: Zeile[]
  /** vor dem bedingten Update einmal «gleichzeitig» ändern (simuliert eine parallele Anfrage) */
  dazwischen?: (zeilen: Zeile[]) => void
  /** create scheitert einmal mit P2002 (gleichzeitige erste Speicherung), die andere Zeile ist danach da */
  createKonflikt?: Zeile
}

/** Nachbau von prisma.$transaction mit Rollback: Änderungen gelten nur, wenn fn ohne Fehler endet. */
function fakeDb(optionen: FakeOptionen = {}) {
  let zeilen: Zeile[] = [...(optionen.zeilen ?? [])]
  let punkte = 0
  let transaktionen = 0
  let dazwischen = optionen.dazwischen
  let createKonflikt = optionen.createKonflikt

  const db = {
    async $transaction<T>(fn: (tx: unknown) => Promise<T>): Promise<T> {
      transaktionen += 1
      let entwurf = zeilen.map((zeile) => ({ ...zeile }))
      let entwurfPunkte = punkte
      const tx = {
        spielstand: {
          async findUnique({ where }: { where: { userId_fach_spiel_level: Omit<Zeile, "id" | "sterne" | "xp"> } }) {
            const k = where.userId_fach_spiel_level
            const z = entwurf.find((e) => e.userId === k.userId && e.fach === k.fach && e.spiel === k.spiel && e.level === k.level)
            return z ? { id: z.id, sterne: z.sterne, xp: z.xp } : null
          },
          async updateMany({ where, data }: { where: { id: string; sterne: number; xp: number }; data: { sterne: number; xp: number } }) {
            if (dazwischen) {
              // parallele Anfrage hat schon committet: in beiden Ständen sichtbar
              dazwischen(zeilen)
              entwurf = zeilen.map((zeile) => ({ ...zeile }))
              dazwischen = undefined
            }
            const z = entwurf.find((e) => e.id === where.id && e.sterne === where.sterne && e.xp === where.xp)
            if (!z) return { count: 0 }
            Object.assign(z, data)
            return { count: 1 }
          },
          async count({ where }: { where: { userId: string; fach: string } }) {
            return entwurf.filter((e) => e.userId === where.userId && e.fach === where.fach).length
          },
          async create({ data }: { data: Omit<Zeile, "id"> }) {
            if (createKonflikt) {
              zeilen.push(createKonflikt)
              createKonflikt = undefined
              throw Object.assign(new Error("Unique constraint"), { code: "P2002" })
            }
            entwurf.push({ id: `z${entwurf.length + 1}`, ...data })
          },
        },
        user: {
          async update({ data }: { data: { points: { increment: number } } }) {
            entwurfPunkte += data.points.increment
          },
        },
      }
      const ergebnis = await fn(tx)
      zeilen = entwurf
      punkte = entwurfPunkte
      return ergebnis
    },
  }
  return {
    db: db as unknown as Parameters<typeof speichereSpielstand>[2],
    zeilen: () => zeilen,
    punkte: () => punkte,
    transaktionen: () => transaktionen,
  }
}

const zeile = (daten: Partial<Zeile>): Zeile => ({ id: "z1", userId: "u1", fach: "avsw", spiel: gueltig.spiel, level: "l1", sterne: 1, xp: 50, ...daten })

describe("speichereSpielstand", () => {
  test("erster Stand wird angelegt, Punkte gutgeschrieben", async () => {
    const f = fakeDb()
    const ergebnis = await speichereSpielstand("u1", eingabe({ sterne: 2, xp: 140 }), f.db)
    assert.deepEqual(ergebnis, { verbessert: true, punkte: 14 })
    assert.equal(f.zeilen().length, 1)
    assert.equal(f.zeilen()[0].xp, 140)
    assert.equal(f.punkte(), 14)
  })

  test("schlechterer Wert ändert nichts und gibt keine Punkte", async () => {
    const f = fakeDb({ zeilen: [zeile({ sterne: 3, xp: 200 })] })
    const ergebnis = await speichereSpielstand("u1", eingabe({ sterne: 2, xp: 150 }), f.db)
    assert.deepEqual(ergebnis, { verbessert: false, punkte: 0 })
    assert.deepEqual(f.zeilen()[0], zeile({ sterne: 3, xp: 200 }))
    assert.equal(f.punkte(), 0)
  })

  test("Verbesserung: bedingtes Update, Punkte nur für die Differenz", async () => {
    const f = fakeDb({ zeilen: [zeile({ sterne: 2, xp: 100 })] })
    const ergebnis = await speichereSpielstand("u1", eingabe({ sterne: 2, xp: 175 }), f.db)
    assert.deepEqual(ergebnis, { verbessert: true, punkte: 7 })
    assert.equal(f.zeilen()[0].xp, 175)
    assert.equal(f.punkte(), 7)
  })

  test("gleichzeitige Änderung: neuer Versuch rechnet mit dem neuen Stand, keine doppelten Punkte", async () => {
    const f = fakeDb({
      zeilen: [zeile({ sterne: 2, xp: 100 })],
      dazwischen: (zeilen) => Object.assign(zeilen[0], { xp: 180 }),
    })
    const ergebnis = await speichereSpielstand("u1", eingabe({ sterne: 2, xp: 200 }), f.db)
    assert.deepEqual(ergebnis, { verbessert: true, punkte: 2 })
    assert.equal(f.transaktionen(), 2)
    assert.equal(f.zeilen()[0].xp, 200)
    assert.equal(f.punkte(), 2)
  })

  test("gleichzeitige Änderung mit besserem Wert: zweiter Versuch ändert nichts", async () => {
    const f = fakeDb({
      zeilen: [zeile({ sterne: 2, xp: 100 })],
      dazwischen: (zeilen) => Object.assign(zeilen[0], { sterne: 3, xp: 300 }),
    })
    const ergebnis = await speichereSpielstand("u1", eingabe({ sterne: 2, xp: 200 }), f.db)
    assert.deepEqual(ergebnis, { verbessert: false, punkte: 0 })
    assert.equal(f.zeilen()[0].sterne, 3)
    assert.equal(f.punkte(), 0)
  })

  test("gleichzeitige erste Speicherung (P2002): neuer Versuch als Update", async () => {
    const f = fakeDb({ createKonflikt: zeile({ id: "parallel", sterne: 1, xp: 60 }) })
    const ergebnis = await speichereSpielstand("u1", eingabe({ sterne: 2, xp: 140 }), f.db)
    assert.deepEqual(ergebnis, { verbessert: true, punkte: 8 })
    assert.equal(f.zeilen().length, 1)
    assert.equal(f.zeilen()[0].sterne, 2)
    assert.equal(f.punkte(), 8)
  })

  test("zu viele Levels im Fach: SpielstandVollFehler, bestehende Levels bleiben speicherbar", async () => {
    const volle = Array.from({ length: MAX_SPIELSTAENDE_PRO_FACH }, (_, i) => zeile({ id: `v${i}`, level: `l${i}` }))
    const f = fakeDb({ zeilen: volle })
    await assert.rejects(speichereSpielstand("u1", eingabe({ level: "neu" }), f.db), SpielstandVollFehler)
    assert.equal(f.punkte(), 0)
    const ergebnis = await speichereSpielstand("u1", eingabe({ level: "l0", sterne: 3, xp: 90 }), f.db)
    assert.equal(ergebnis.verbessert, true)
  })
})

describe("Abzeichen der Modellierspiele", () => {
  test("vier Bedingungen, gleich wie Migration und Seed", () => {
    assert.deepEqual([...SPIEL_ABZEICHEN_BEDINGUNGEN].sort(), [
      "avsw_spiel_fehlerfrei",
      "avsw_spiel_sterne_10",
      "avsw_spiel_sterne_25",
      "avsw_spiel_sterne_45",
    ])
  })

  test("Schwellen inklusive", () => {
    const leer = { sterneSumme: 0, dreiSterneLevels: 0 }
    assert.equal(spielAbzeichenErfuellt("avsw_spiel_fehlerfrei", leer), false)
    assert.equal(spielAbzeichenErfuellt("avsw_spiel_fehlerfrei", { sterneSumme: 3, dreiSterneLevels: 1 }), true)
    assert.equal(spielAbzeichenErfuellt("avsw_spiel_sterne_10", { sterneSumme: 9, dreiSterneLevels: 0 }), false)
    assert.equal(spielAbzeichenErfuellt("avsw_spiel_sterne_10", { sterneSumme: 10, dreiSterneLevels: 0 }), true)
    assert.equal(spielAbzeichenErfuellt("avsw_spiel_sterne_25", { sterneSumme: 25, dreiSterneLevels: 0 }), true)
    assert.equal(spielAbzeichenErfuellt("avsw_spiel_sterne_45", { sterneSumme: 44, dreiSterneLevels: 9 }), false)
  })

  test("fremde Bedingungen und Prototyp-Namen sind keine Spiel-Abzeichen", () => {
    const stats = { sterneSumme: 100, dreiSterneLevels: 10 }
    for (const bedingung of ["streak_7", "leitstand_ernstfall", "toString", "__proto__", "constructor"]) {
      assert.equal(spielAbzeichenErfuellt(bedingung, stats), null, bedingung)
    }
  })
})
