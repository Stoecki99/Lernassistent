// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// tests/ipma-pool.test.ts
// Schema und Inhalt des Fragenpools (Spezifikation 7.1): echte Dateien in content/ipma/fragen,
// ungültige Beispiele am Mini-Pool, Qualitätsregeln 2.4/2.5 und Sperrwörter (1.3).

import { describe, test } from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { AREA_IDS, COMPETENCE_IDS, COMPETENCES, getCompetence } from "@/lib/ipma/competences"
import { POOL_MINIMUM, POOL_STAGE, type PoolStage } from "@/lib/ipma/config"
import { buildPool, loadPool, normalizeText, poolFileName, validatePool } from "@/lib/ipma/pool"
import { competenceFileSchema, isKnownStation, type CompetenceFile, type PoolQuestion } from "@/lib/validations/ipma-pool"
import { fileOf, miniSources, rawMc, rawOpen, type RawFile } from "./helpers/ipma-mini"

const POOL_DIR = path.join(process.cwd(), "content", "ipma", "fragen")
/** Abdeckung der Indikatoren: ab Teil 2 als Fehler, vorher als Warnung (7.1) */
const COVERAGE_IS_ERROR: Record<PoolStage, boolean> = { aufbau: false, teil1: false, teil2: true }
const EXAMPLE_IDS = ["1.02-mc-01", "1.03-of-01", "2.07-mc-01", "2.03-of-01", "3.04-mc-01", "3.11-of-01"]

function readRealFiles(): { name: string; raw: unknown }[] {
  return fs.readdirSync(POOL_DIR).filter((n) => n.endsWith(".json")).sort()
    .map((name) => ({ name, raw: JSON.parse(fs.readFileSync(path.join(POOL_DIR, name), "utf8")) as unknown }))
}

function realFiles(): CompetenceFile[] {
  return readRealFiles().map(({ raw }) => competenceFileSchema.parse(raw))
}

/** Erste Meldung einer abgelehnten Datei (für die Fehlermeldung im Test) */
function rejects(raw: unknown): boolean {
  return !competenceFileSchema.safeParse(raw).success
}

/** Mini-Datei 3.04 mit einer geänderten ersten Frage */
function file304(edit: (q: Record<string, unknown>) => void, which: "mc" | "offen" = "mc"): RawFile {
  const f = fileOf(miniSources(), "3.04")
  const q = f.fragen.find((x) => x.typ === which)
  if (!q) throw new Error("Testfrage fehlt")
  edit(q)
  return f
}

describe("Echte Dateien in content/ipma/fragen", () => {
  test("alle 28 Dateien vorhanden, Name passt zur Kompetenz", () => {
    const names = readRealFiles().map((f) => f.name)
    assert.deepEqual(names, COMPETENCE_IDS.map(poolFileName))
    for (const { name, raw } of readRealFiles()) {
      const parsed = competenceFileSchema.safeParse(raw)
      assert.ok(parsed.success, `${name}: ${parsed.success ? "" : parsed.error.issues.map((i) => i.message).join("; ")}`)
      assert.equal(poolFileName(parsed.data.kompetenz), name)
    }
  })

  test("bestehen validatePool und loadPool", () => {
    assert.deepEqual(validatePool(realFiles()), [])
    const pool = loadPool()
    assert.match(pool.version, /^[0-9a-f]{12}$/)
    assert.equal(pool.files.length, 28)
  })

  test("die 6 Beispiele aus 2.7 sind enthalten (entwurf oder nach Fachprüfung geprueft)", () => {
    const byId = new Map(realFiles().flatMap((f) => f.fragen).map((q) => [q.id, q]))
    for (const id of EXAMPLE_IDS) {
      assert.ok(byId.has(id), `${id} fehlt`)
      assert.ok(["entwurf", "geprueft"].includes(byId.get(id)?.status ?? ""), id)
    }
  })

  test("Mindestumfang je Kompetenz (je nach POOL_STAGE)", (t) => {
    if (!POOL_MINIMUM) {
      t.diagnostic(`Stufe «${POOL_STAGE}»: Mindestumfang noch nicht erzwungen.`)
      return
    }
    for (const f of realFiles()) {
      const ok = f.fragen.filter((q) => q.status === "geprueft")
      assert.ok(ok.filter((q) => q.typ === "mc").length >= POOL_MINIMUM.mc, `${f.kompetenz}: zu wenige MC`)
      assert.ok(ok.filter((q) => q.typ === "offen").length >= POOL_MINIMUM.offen, `${f.kompetenz}: zu wenige offene`)
    }
  })

  test("Abdeckung: MC-Fragen je Kompetenz decken ≥ 3 Indikatoren ab (bzw. alle bei 3)", (t) => {
    const missing: string[] = []
    for (const f of realFiles()) {
      const need = Math.min(3, getCompetence(f.kompetenz).kciCount)
      const covered = new Set(f.fragen.filter((q) => q.typ === "mc").flatMap((q) => q.fundstelle.icb.indikatoren))
      if (covered.size < need) missing.push(`${f.kompetenz} (${covered.size}/${need})`)
    }
    if (COVERAGE_IS_ERROR[POOL_STAGE]) assert.deepEqual(missing, [])
    else if (missing.length) t.diagnostic(`Warnung Abdeckung (Stufe «${POOL_STAGE}»): ${missing.length} Kompetenzen, z. B. ${missing.slice(0, 3).join(", ")}`)
  })

  test("Schwierigkeit 3 höchstens in einem Drittel je Kompetenz", () => {
    for (const f of realFiles()) {
      const hard = f.fragen.filter((q) => q.schwierigkeit === 3).length
      assert.ok(hard * 3 <= f.fragen.length, `${f.kompetenz}: ${hard} von ${f.fragen.length} mit Schwierigkeit 3`)
    }
  })

  test("die richtige Option ist in höchstens 40 % der MC-Fragen die (einzige) längste", () => {
    const mcs = realFiles().flatMap((f) => f.fragen).filter((q): q is Extract<PoolQuestion, { typ: "mc" }> => q.typ === "mc")
    const longest = mcs.filter((q) => {
      const len = q.optionen.map((o) => o.length)
      return len.every((l, i) => i === q.richtig || l < len[q.richtig])
    }).length
    assert.ok(longest * 100 <= mcs.length * 40, `${longest} von ${mcs.length} MC-Fragen mit längster richtiger Option`)
  })

  test("keine Dubletten: normalisierter Text eindeutig, Jaccard ≤ 0.8 innerhalb einer Kompetenz", () => {
    const words = (s: string) => new Set(normalizeText(s).split(" ").filter(Boolean))
    for (const f of realFiles()) {
      for (let i = 0; i < f.fragen.length; i++) {
        for (let j = i + 1; j < f.fragen.length; j++) {
          const a = words(f.fragen[i].frage)
          const b = words(f.fragen[j].frage)
          const inter = [...a].filter((w) => b.has(w)).length
          const jaccard = inter / (a.size + b.size - inter)
          assert.ok(jaccard <= 0.8, `${f.fragen[i].id} und ${f.fragen[j].id}: Jaccard ${jaccard.toFixed(2)}`)
        }
      }
    }
  })

  test("keine Positionsverweise («Option 2», «die letzte Option») bei gemischten Optionen", () => {
    // Optionen werden je Versuch gemischt (ausser optionenFest); eine Nummer zeigt dann auf die falsche Antwort.
    const position = /\bOption(en)?\s+\d|\b(erste|zweite|dritte|vierte|letzte)[nr]?\s+Option(en)?\b/i
    const hits: string[] = []
    for (const q of realFiles().flatMap((f) => f.fragen)) {
      if (q.typ === "mc" && q.optionenFest) continue
      const texts = q.typ === "mc" ? [q.erklaerung, ...(q.optionHinweise ?? [])] : [q.musterloesung, q.erklaerung ?? ""]
      if (texts.some((t) => position.test(t))) hits.push(q.id)
    }
    assert.deepEqual(hits, [], `Positionsverweise in: ${hits.join(", ")}`)
  })

  test("Sperrwörter (1.3)", () => {
    // Wasserzeichen der PDF-Dateien und Hinweise auf kopierte Prüfungsfragen; Namen des Lizenzinhabers nie hier eintragen.
    const anywhere = [/persönliches exemplar/i]
    const inQuestion = [/musterprüfung/i, /prüfungsfrage aus/i]
    for (const { name, raw } of readRealFiles()) {
      const all = JSON.stringify(raw)
      for (const p of anywhere) assert.ok(!p.test(all), `${name}: Sperrwort ${p}`)
    }
    for (const q of realFiles().flatMap((f) => f.fragen)) {
      for (const p of inQuestion) assert.ok(!p.test(q.frage), `${q.id}: Sperrwort ${p}`)
    }
  })
})

describe("Kompetenzen (Anhang 10.1)", () => {
  test("28 Kompetenzen in ID-Reihenfolge, Bereiche 5/10/13, Indikatoren 133", () => {
    assert.deepEqual(COMPETENCES.map((c) => c.id), [...COMPETENCE_IDS])
    assert.deepEqual(AREA_IDS.map((a) => COMPETENCES.filter((c) => c.area === a).length), [5, 10, 13])
    assert.equal(COMPETENCES.reduce((s, c) => s + c.kciCount, 0), 133)
  })

  test("jede Kompetenz hat mindestens eine bekannte Station, ohne 02, 23 und 24", () => {
    for (const c of COMPETENCES) {
      assert.ok(c.stations.length >= 1, c.id)
      for (const s of c.stations) {
        assert.ok(isKnownStation(s), `${c.id}: ${s}`)
        assert.ok(!/^(02|23|24)-/.test(s), `${c.id}: ${s} gehört nicht in die Empfehlung`)
      }
    }
  })
})

describe("Schema: ungültige Beispiele werden abgelehnt", () => {
  test("Mini-Pool (3 MC + 2 offen je Kompetenz) ist gültig", () => {
    const pool = buildPool(miniSources(), { mc: 3, offen: 2 })
    assert.equal(pool.questions.length, 28 * 5)
  })

  const cases: [string, () => RawFile][] = [
    ["ID-Präfix falsch", () => file304((q) => { q.id = "3.05-mc-01" })],
    ["-mc- mit typ offen", () => file304((q) => { q.id = "3.04-mc-09" }, "offen")],
    ["3 Optionen", () => file304((q) => { q.optionen = ["eins", "zwei", "drei"] })],
    ["5 Optionen", () => file304((q) => { q.optionen = ["eins", "zwei", "drei", "vier", "fünf"] })],
    ["richtig: 4", () => file304((q) => { q.richtig = 4 })],
    ["doppelte Optionen", () => file304((q) => { q.optionen = ["Gleich", "gleich", "drei", "vier"] })],
    ["«alle obigen»", () => file304((q) => { q.optionen = ["eins", "zwei", "drei", "Alle obigen"] })],
    ["Raster-Summe 3", () => file304((q) => { q.bewertungsraster = [{ kriterium: "Erstes Kriterium", punkte: 1 }, { kriterium: "Zweites Kriterium", punkte: 2 }] }, "offen")],
    ["Raster-Summe 5", () => file304((q) => { q.bewertungsraster = [{ kriterium: "Erstes Kriterium", punkte: 2 }, { kriterium: "Zweites Kriterium", punkte: 3 }] }, "offen")],
    ["Indikator 3.04.06 (es gibt nur 5)", () => file304((q) => { q.fundstelle = { icb: { seite: 100, indikatoren: ["3.04.06"] } } })],
    ["Indikator 3.05.01 in 3.04", () => file304((q) => { q.fundstelle = { icb: { seite: 100, indikatoren: ["3.05.01"] } } })],
    ["Station unbekannt", () => file304((q) => { q.fundstelle = { icb: { seite: 100, indikatoren: ["3.04.01"] }, station: "99-gibt-es-nicht" } })],
    ["ICB-Seite 12", () => file304((q) => { q.fundstelle = { icb: { seite: 12, indikatoren: ["3.04.01"] } } })],
    ["unbekanntes Feld (strict)", () => file304((q) => { q.loesung = "B" })],
    ["Hinweis der richtigen Option nicht leer", () => file304((q) => { q.optionHinweise = ["a", "b", "c", "d"] })],
    ["herkunft fehlt", () => {
      const f = fileOf(miniSources(), "3.04") as Partial<RawFile>
      delete f.herkunft
      return f as RawFile
    }],
  ]
  for (const [name, make] of cases) {
    test(name, () => assert.ok(rejects(make()), `${name} wurde angenommen`))
  }

  test("doppelte ID über zwei Dateien → validatePool meldet sie", () => {
    const sources = miniSources()
    fileOf(sources, "3.05").fragen.push({ ...rawMc("3.05", 9), id: "3.05-mc-01", frage: "Eine andere Frage mit derselben ID, aber neuem Text." })
    assert.throws(() => buildPool(sources, null), /3\.05-mc-01: ID doppelt/)
  })

  test("gleicher normalisierter Fragetext → Fehler", () => {
    const sources = miniSources()
    const copy = rawOpen("2.01", 7)
    copy.frage = String(fileOf(sources, "1.01").fragen[0].frage).toUpperCase()
    fileOf(sources, "2.01").fragen.push(copy)
    assert.throws(() => buildPool(sources, null), /gleicher Fragetext/)
  })

  test("fehlende Datei und Mindestumfang → validatePool meldet sie", () => {
    const files = miniSources().slice(1).map((f) => competenceFileSchema.parse(f))
    const errors = validatePool(files, { mc: 4, offen: 2 })
    assert.ok(errors.some((e) => e.startsWith("1-01.json: Datei fehlt")))
    assert.ok(errors.some((e) => e.startsWith("3.13: 3 MC")))
  })

  test("leere Fragenliste ist erlaubt (Aufbau), Status entwurf zählt nicht zum Minimum", () => {
    assert.ok(!rejects({ kompetenz: "1.01", herkunft: "eigen", fragen: [] }))
    const sources = miniSources(4, 2)
    for (const f of sources) for (const q of f.fragen) q.status = "entwurf"
    assert.throws(() => buildPool(sources, { mc: 4, offen: 2 }), /verlangt 4 und 2/)
  })
})
