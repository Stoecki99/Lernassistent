// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// tests/architektur-leitstand-sync.test.ts
// Sende-Logik des Architektur-Leitstands (components/features/architektur-leitstand/syncQueue.ts) mit Fake-API:
// «weiter» zusammenfassen (nicht, solange unterwegs), keine Doppelsendung, 409 nach verlorener Antwort,
// 409 Konflikt, 401 (Sicherung bleibt), 422 (abgelehnt), offline mit neuem Versuch, Sicherung fortsetzen.

import { describe, test } from "node:test"
import assert from "node:assert/strict"
import type { Aktion } from "@/lib/archsim"
import { ApiFehler } from "@/components/features/architektur-leitstand/api"
import {
  MAX_MINUTEN,
  SyncWarteschlange,
  sicherungFortsetzen,
  wartezeit,
  type Sicherung,
  type SyncApi,
  type SyncStatus,
} from "@/components/features/architektur-leitstand/syncQueue"

const w = (minuten: number): Aktion => ({ typ: "weiter", minuten })
const cache: Aktion = { typ: "cache", element: "db" }

/** Fake-Server: speichert Aktionen, prüft abIndex, kann Fehler einspielen */
function fakeServer() {
  const gespeichert: Aktion[] = []
  const aufrufe: Array<{ abIndex: number; aktionen: Aktion[] }> = []
  let naechsterFehler: ((abIndex: number, a: Aktion[]) => never) | null = null
  let warten: Promise<void> | null = null
  const api: SyncApi = {
    async aktionenAnhaengen(_id, abIndex, aktionen) {
      aufrufe.push({ abIndex, aktionen: structuredClone(aktionen) })
      if (warten) await warten
      if (naechsterFehler) {
        const f = naechsterFehler
        naechsterFehler = null
        f(abIndex, aktionen)
      }
      if (abIndex !== gespeichert.length) throw new ApiFehler(409, "Konflikt", { aktionCount: gespeichert.length })
      gespeichert.push(...aktionen)
      return { aktionCount: gespeichert.length }
    },
  }
  return {
    api,
    gespeichert,
    aufrufe,
    fehler(f: (abIndex: number, a: Aktion[]) => never) {
      naechsterFehler = f
    },
    sperren() {
      let los = () => undefined as void
      warten = new Promise<void>((r) => (los = r))
      return () => {
        warten = null
        los()
      }
    },
  }
}

function queue(api: SyncApi, extra: Partial<ConstructorParameters<typeof SyncWarteschlange>[0]> = {}) {
  const status: SyncStatus[] = []
  const sicherungen: Array<Sicherung | null> = []
  const q = new SyncWarteschlange({
    api,
    laufId: "lauf",
    bestaetigt: 0,
    onStatus: (s) => status.push(s),
    sichern: (s) => sicherungen.push(s),
    planen: () => () => undefined,
    ...extra,
  })
  return { q, status, sicherungen }
}

describe("SyncWarteschlange", () => {
  test("fasst aufeinanderfolgende «weiter» zusammen, Massnahmen trennen", async () => {
    const s = fakeServer()
    const { q } = queue(s.api)
    q.push(w(1))
    q.push(w(1))
    q.push(cache)
    q.push(w(1))
    q.push(w(2))
    assert.deepEqual(q.offene, [w(2), cache, w(3)])
    assert.equal(await q.flush(), true)
    assert.deepEqual(s.gespeichert, [w(2), cache, w(3)])
    assert.equal(q.status, "gespeichert")
  })

  test("Höchstwert beim Zusammenfassen", () => {
    const { q } = queue(fakeServer().api)
    q.push(w(MAX_MINUTEN - 1))
    q.push(w(5))
    assert.equal(q.anzahlAusstehend, 2)
  })

  test("während einer Sendung wird das unterwegs befindliche Paket nicht verändert, keine Doppelsendung", async () => {
    const s = fakeServer()
    const { q } = queue(s.api)
    q.push(w(1))
    const freigeben = s.sperren()
    const p1 = q.flush()
    q.push(w(1)) // darf nicht in das unterwegs befindliche Paket
    q.push(w(1))
    const p2 = q.flush()
    freigeben()
    assert.equal(await p1, true)
    assert.equal(await p2, true)
    assert.deepEqual(s.gespeichert, [w(1), w(2)])
    assert.deepEqual(s.aufrufe.map((a) => a.abIndex), [0, 1])
  })

  test("409 nach verlorener Antwort: Anfang gilt als bestätigt, Rest wird gesendet", async () => {
    const s = fakeServer()
    const { q } = queue(s.api)
    q.push(cache)
    q.push(w(4))
    s.fehler((_ab, a) => {
      s.gespeichert.push(a[0]) // Server hat die erste Aktion gespeichert, Antwort ging verloren
      throw new ApiFehler(409, "Konflikt", { aktionCount: 1 })
    })
    assert.equal(await q.flush(), true)
    assert.deepEqual(s.gespeichert, [cache, w(4)])
    assert.equal(q.bestaetigt, 2)
  })

  test("409 ohne passenden Stand: Konflikt, Senden endet, Sicherung gelöscht", async () => {
    const s = fakeServer()
    let konflikt = ""
    const { q, sicherungen } = queue(s.api, { onKonflikt: (m) => (konflikt = m) })
    s.gespeichert.push(w(9), cache) // Server ist weiter, als ein verlorenes Paket erklären könnte
    q.push(w(1))
    assert.equal(await q.flush(), false)
    assert.equal(konflikt, "Konflikt")
    assert.equal(q.istGestoppt, true)
    assert.equal(sicherungen[sicherungen.length - 1], null)
  })

  test("401: abgemeldet, Sicherung bleibt", async () => {
    const s = fakeServer()
    let abgemeldet = false
    const { q, sicherungen } = queue(s.api, { onAbgemeldet: () => (abgemeldet = true) })
    q.push(w(3))
    s.fehler(() => {
      throw new ApiFehler(401, "Nicht autorisiert.")
    })
    assert.equal(await q.flush(), false)
    assert.equal(abgemeldet, true)
    assert.equal(q.status, "abgemeldet")
    assert.deepEqual(sicherungen[sicherungen.length - 1], { abIndex: 0, aktionen: [w(3)] })
    q.push(w(1))
    assert.equal(q.anzahlAusstehend, 1, "nach dem Stopp keine neuen Aktionen")
  })

  test("422: abgelehnt, Senden endet", async () => {
    const s = fakeServer()
    let abgelehnt = ""
    const { q } = queue(s.api, { onAbgelehnt: (m) => (abgelehnt = m) })
    q.push(cache)
    s.fehler(() => {
      throw new ApiFehler(422, "Massnahme geht nicht.")
    })
    assert.equal(await q.flush(), false)
    assert.equal(abgelehnt, "Massnahme geht nicht.")
    assert.equal(q.status, "fehler")
  })

  test("offline: neuer Versuch nach Wartezeit (Retry-After hat Vorrang)", async () => {
    const s = fakeServer()
    const geplant: number[] = []
    let nochmal: (() => void) | null = null
    const { q } = queue(s.api, {
      planen: (fn, ms) => {
        geplant.push(ms)
        nochmal = fn
        return () => undefined
      },
    })
    q.push(w(2))
    s.fehler(() => {
      throw new ApiFehler(503, "weg", { retryAfterMs: 7000 })
    })
    assert.equal(await q.flush(), false)
    assert.equal(q.status, "offline")
    assert.deepEqual(geplant, [7000])
    ;(nochmal as unknown as () => void)()
    await new Promise((r) => setTimeout(r, 10))
    assert.deepEqual(s.gespeichert, [w(2)])
    assert.equal(wartezeit(1), 2000)
    assert.equal(wartezeit(10), 60000)
  })
})

describe("sicherungFortsetzen", () => {
  test("passt: alles ausstehend; Anfang gespeichert: Rest; Lücke oder Unsinn: verwerfen", () => {
    assert.deepEqual(sicherungFortsetzen({ abIndex: 3, aktionen: [w(1), cache] }, 3), [w(1), cache])
    assert.deepEqual(sicherungFortsetzen({ abIndex: 3, aktionen: [w(1), cache] }, 4), [cache])
    assert.equal(sicherungFortsetzen({ abIndex: 5, aktionen: [w(1)] }, 3), null)
    assert.equal(sicherungFortsetzen({ abIndex: 0, aktionen: [w(1)] }, 3), null)
    assert.equal(sicherungFortsetzen({ abIndex: 0, aktionen: [{ typ: "boese" }] }, 0), null)
    assert.equal(sicherungFortsetzen("kaputt", 0), null)
  })
})
