// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// tests/leitstand-avatar.test.ts
// Porträts des Leitstands: Jede Person, jeder Stakeholder, der Coach und jeder Absender beider Szenarien
// hat ein eigenes, festes Porträt; Ersatz-Porträts für unbekannte Namen sind deterministisch.

import { describe, test } from "node:test"
import assert from "node:assert/strict"
import { loadScenario, type Scenario } from "@/lib/simulation"
import { AVATARS, avatarSpec } from "@/components/features/leitstand/avatarData"

function scenario(id: string): Scenario {
  const s = loadScenario(id)
  if (!s) throw new Error(`Szenario ${id} fehlt`)
  return s
}

const SCENARIOS = ["einfuehrung", "wolkenried"].map(scenario)

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
  test("alle Namen beider Szenarien sind zugeordnet", () => {
    for (const s of SCENARIOS) {
      for (const name of allNames(s)) {
        assert.ok(AVATARS[name], `${s.id}: kein Porträt für «${name}»`)
      }
    }
  })

  test("Teammitglieder sind Personen-Porträts und paarweise verschieden", () => {
    const seen = new Map<string, string>()
    for (const s of SCENARIOS) {
      for (const p of s.people) {
        const spec = AVATARS[p.name]
        assert.equal(spec.kind, "person", p.name)
        const key = JSON.stringify(spec)
        const other = seen.get(key)
        assert.ok(other === undefined || other === p.name, `${p.name} und ${other} sehen gleich aus`)
        seen.set(key, p.name)
      }
    }
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
