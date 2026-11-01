// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// tests/archsim-schema.test.ts
// Missionen gegen Zod-Schema und Querbezüge prüfen: Elemente, Verbindungen, Ereignisse, Hinweise,
// Aktionsziele, Lernstationen, Layout, Schweizer Schreibweise. Dazu die Aktions- und Protokoll-Schemas.

import { describe, test } from "node:test"
import assert from "node:assert/strict"
import avswFach from "@/content/lernseiten/avsw/fach.json"
import {
  aktionSchema,
  GRUPPEN_TYPEN,
  ladeMission,
  listeMissionen,
  MISSION_IDS,
  MISSIONEN,
  missionSchema,
  protokollSchema,
  validiere,
  type ArchModell,
  type Mission,
} from "@/lib/archsim"

const STATIONEN = new Set(avswFach.pfad.map((p) => p.slug))

function texte(x: unknown, out: string[] = []): string[] {
  if (typeof x === "string") out.push(x)
  else if (Array.isArray(x)) x.forEach((v) => texte(v, out))
  else if (x && typeof x === "object") Object.values(x).forEach((v) => texte(v, out))
  return out
}

function pruefeLayout(m: ArchModell, wo: string): void {
  const belegt = new Map<string, string>()
  for (const e of m.elemente) {
    if ((GRUPPEN_TYPEN as readonly string[]).includes(e.typ)) continue
    assert.ok(e.x !== undefined && e.y !== undefined, `${wo}: «${e.id}» ohne x/y`)
    const k = `${e.x},${e.y}`
    assert.ok(!belegt.has(k), `${wo}: «${e.id}» und «${belegt.get(k)}» auf derselben Zelle ${k}`)
    belegt.set(k, e.id)
  }
}

describe("Missionen", () => {
  test("mindestens vier Missionen, IDs eindeutig, ladeMission/listeMissionen", () => {
    assert.ok(MISSIONEN.length >= 4)
    assert.equal(new Set(MISSION_IDS).size, MISSION_IDS.length)
    assert.equal(listeMissionen().length, MISSIONEN.length)
    assert.equal(ladeMission("gibt-es-nicht"), null)
    for (const id of MISSION_IDS) assert.ok(ladeMission(id))
    assert.ok(MISSIONEN.some((m) => m.art === "modellieren"))
    assert.ok(MISSIONEN.some((m) => m.gefuehrt))
  })

  for (const m of MISSIONEN) {
    describe(m.id, () => {
      test("Zod-Schema gültig", () => {
        const r = missionSchema.safeParse(m)
        assert.ok(r.success, r.success ? "" : JSON.stringify(r.error.issues.slice(0, 5), null, 1))
      })

      test("Modell lauffähig, Layout gesetzt", () => {
        const modell = m.art === "modellieren" ? (m.musterloesung as ArchModell) : m.modell
        const v = validiere(m, modell)
        assert.ok(v.gueltig, v.fehler.join("; "))
        assert.deepEqual(v.hinweise, [], `Hinweise: ${v.hinweise.join("; ")}`)
        pruefeLayout(modell, m.id)
        if (m.art === "modellieren") pruefeLayout(m.modell, `${m.id} (vorgegeben)`)
      })

      test("Querbezüge: Ereignisse, Hinweise, Aktionsziele, Anfragen", () => {
        const modell = m.art === "modellieren" ? (m.musterloesung as ArchModell) : m.modell
        const els = new Set(modell.elemente.map((e) => e.id))
        const vbs = new Set(modell.verbindungen.map((v) => v.id))
        for (const e of m.ereignisse) {
          assert.ok(e.tick + e.dauer <= m.dauer + 30, `${e.id} liegt nach dem Ende`)
          assert.ok(e.tick < m.dauer, `${e.id} beginnt nach dem Ende`)
          if ("element" in e.wirkung) assert.ok(els.has(e.wirkung.element), `${e.id}: Element ${e.wirkung.element}`)
        }
        for (const h of m.hinweise ?? []) {
          if ("auslastung" in h.wenn) assert.ok(els.has(h.wenn.auslastung), `Hinweis ${h.id}`)
          if ("ereignis" in h.wenn) {
            const id = h.wenn.ereignis
            assert.ok(m.ereignisse.some((e) => e.id === id), `Hinweis ${h.id}`)
          }
        }
        for (const [typ, ziele] of Object.entries(m.aktionsZiele ?? {})) {
          assert.ok(m.erlaubteAktionen.includes(typ as Mission["erlaubteAktionen"][number]), `Aktionsziel für nicht erlaubte Aktion ${typ}`)
          for (const z of ziele ?? []) assert.ok(els.has(z) || vbs.has(z), `Aktionsziel ${typ}: ${z}`)
        }
        assert.ok(m.anfragen.some((k) => k.kritisch), "mindestens eine kritische Anfrageklasse")
        assert.ok(m.ereignisse.length >= 1)
      })

      test("Lernziele verweisen auf AVSW-Stationen", () => {
        for (const l of m.lernziele) assert.ok(STATIONEN.has(l.station), `Station ${l.station}`)
        for (const a of m.anforderungen ?? []) if (a.station) assert.ok(STATIONEN.has(a.station), `Station ${a.station}`)
      })

      test("Schweizer Schreibweise (kein ß), keine Platzhalter", () => {
        for (const t of texte(m)) {
          assert.ok(!t.includes("ß"), `ß in «${t.slice(0, 60)}»`)
          assert.ok(!/TODO|lorem/i.test(t), `Platzhalter in «${t.slice(0, 60)}»`)
        }
      })
    })
  }
})

describe("Aktions- und Protokoll-Schema", () => {
  test("gültige Aktionen", () => {
    for (const a of [
      { typ: "weiter", minuten: 5 },
      { typ: "skalieren", element: "mono", instanzen: 3 },
      { typ: "autoscaling", element: "mono", an: true, min: 2, max: 8 },
      { typ: "timeout", verbindung: "zahlung-psp", ms: 1500 },
      { typ: "rateLimit", element: "gw", proSekunde: 0 },
    ]) {
      assert.ok(aktionSchema.safeParse(a).success, JSON.stringify(a))
    }
  })
  test("ungültige Aktionen", () => {
    for (const a of [
      { typ: "weiter", minuten: 0 },
      { typ: "skalieren", element: "Mono!", instanzen: 3 },
      { typ: "timeout", verbindung: "x", ms: 10 },
      { typ: "retry", verbindung: "x", versuche: 9 },
      { typ: "loeschen", element: "x" },
      { typ: "cache", element: "db", extra: 1 },
    ]) {
      assert.ok(!aktionSchema.safeParse(a).success, JSON.stringify(a))
    }
  })
  test("Protokoll mit Modell", () => {
    const m = MISSIONEN.find((x) => x.art === "modellieren") as Mission
    assert.ok(protokollSchema.safeParse({ missionId: m.id, seed: 1, aktionen: [], modell: m.musterloesung }).success)
    assert.ok(!protokollSchema.safeParse({ missionId: m.id, seed: -1, aktionen: [] }).success)
  })
})
