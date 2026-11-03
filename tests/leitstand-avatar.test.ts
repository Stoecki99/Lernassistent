// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// tests/leitstand-avatar.test.ts
// Porträts des Leitstands: Jede Person, jeder Stakeholder, der Coach und jeder Absender aller Szenarien
// hat ein eigenes, festes Porträt; Ersatz-Porträts für unbekannte Namen sind deterministisch.
// Hochmatt (2.11) wird geprüft, sobald content/simulation/hochmatt.json vorliegt.

import { describe, test } from "node:test"
import assert from "node:assert/strict"
import { loadScenario, type Scenario } from "@/lib/simulation"
import { AVATARS, avatarSpec, knownAvatar } from "@/components/features/leitstand/avatarData"

function scenario(id: string): Scenario {
  const s = loadScenario(id)
  if (!s) throw new Error(`Szenario ${id} fehlt`)
  return s
}

const SCENARIOS = ["einfuehrung", "wolkenried"].map(scenario)
// Nachgeliefertes Szenario: fehlt die Datei, prüft der Test nur die beiden ersten
const hochmatt = loadScenario("hochmatt")
if (hochmatt) SCENARIOS.push(hochmatt)

function allNames(s: Scenario): string[] {
  return [
    ...s.people.map((p) => p.name),
    ...s.stakeholders.map((x) => x.name),
    s.coach.name,
    s.defaultDecider.name,
    ...s.events.map((e) => e.sender.name),
  ]
}

describe("Porträts", () => {
  test("alle Namen aller Szenarien sind zugeordnet", () => {
    for (const s of SCENARIOS) {
      for (const name of allNames(s)) {
        assert.ok(knownAvatar(name), `${s.id}: kein Porträt für «${name}»`)
      }
    }
  })

  test("Teammitglieder sind Personen-Porträts und paarweise verschieden", () => {
    const seen = new Map<string, string>()
    for (const s of SCENARIOS) {
      for (const p of s.people) {
        const spec = knownAvatar(p.name)
        assert.ok(spec, p.name)
        assert.equal(spec.kind, "person", p.name)
        const key = JSON.stringify(spec)
        const other = seen.get(key)
        assert.ok(other === undefined || other === p.name, `${p.name} und ${other} sehen gleich aus`)
        seen.set(key, p.name)
      }
    }
  })

  test("alle Personen-Porträts sind paarweise verschieden (auch Hochmatt ohne Datei)", () => {
    const seen = new Map<string, string>()
    for (const [name, spec] of Object.entries(AVATARS)) {
      if (spec.kind !== "person") continue
      const key = JSON.stringify(spec)
      assert.equal(seen.get(key), undefined, `${name} und ${seen.get(key)} sehen gleich aus`)
      seen.set(key, name)
    }
  })

  test("Titel vor dem Namen ergibt dasselbe Porträt", () => {
    assert.deepEqual(avatarSpec("Dr. Nora Bächtold"), AVATARS["Nora Bächtold"])
    assert.deepEqual(avatarSpec("Dr. Helen Gasche"), AVATARS["Helen Gasche"])
  })

  test("Ersatz-Porträt ist deterministisch und gültig", () => {
    const a = avatarSpec("Neue Figur")
    assert.deepEqual(avatarSpec("Neue Figur"), a)
    assert.equal(a.kind, "person")
    if (a.kind === "person") {
      assert.ok(a.skin >= 0 && a.skin <= 5)
      assert.ok(a.hairColor >= 0 && a.hairColor <= 6)
      assert.ok(a.tone >= 1 && a.tone <= 5 && a.bg >= 1 && a.bg <= 5)
    }
  })
})
