// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// tests/archsim-engine.test.ts
// Plausibilität des Simulator-Kerns (docs/architektur-modell.md 9): Warteschlangenformel, Skalierung, Cache,
// asynchrone Entkopplung, Retry-Sturm, Circuit Breaker, Bulkhead, Autoscaling, Aktionen und Kosten.

import { describe, test } from "node:test"
import assert from "node:assert/strict"
import {
  ArchSimFehler,
  K,
  latenzFaktor,
  retryFaktor,
  spieleNach,
  starte,
  wendeAn,
  type Aktion,
  type Ergebnis,
  type Mission,
  type Zustand,
} from "@/lib/archsim"
import { kaskadenMission, miniMission, mission } from "./helpers/archsim-strategien"

function lauf(m: Mission, aktionen: Aktion[] = [], seed = 1): Ergebnis {
  return spieleNach(m, seed, aktionen)
}

/** Zustand nach n Minuten mit Aktionen vorab */
function nach(m: Mission, minuten: number, aktionen: Aktion[] = []): Zustand {
  let z = starte(m, 1)
  for (const a of aktionen) z = wendeAn(m, z, a)
  return wendeAn(m, z, { typ: "weiter", minuten })
}

function mittel(z: Zustand, von: number, bis: number, f: (p: Zustand["verlauf"][number]) => number): number {
  const ps = z.verlauf.filter((p) => p.t >= von && p.t < bis)
  return ps.reduce((s, p) => s + f(p), 0) / ps.length
}

describe("Warteschlangenformel", () => {
  test("c = 1 entspricht 1 / (1 − ρ)", () => {
    for (const rho of [0.1, 0.5, 0.8, 0.9]) assert.ok(Math.abs(latenzFaktor(rho, 1) - 1 / (1 - rho)) < 1e-9, `ρ = ${rho}`)
  })
  test("monoton steigend in ρ und gekappt", () => {
    let vorher = 0
    for (let rho = 0; rho <= 2; rho += 0.05) {
      const f = latenzFaktor(rho, 3)
      assert.ok(f >= vorher - 1e-9, `nicht monoton bei ρ = ${rho}`)
      assert.ok(f <= K.LATENZ_KAPPUNG)
      vorher = f
    }
    assert.equal(latenzFaktor(5, 1), K.LATENZ_KAPPUNG)
  })
  test("mehr Server bei gleicher Auslastung warten weniger (Bündelungseffekt)", () => {
    assert.ok(latenzFaktor(0.8, 8) < latenzFaktor(0.8, 2))
    assert.ok(latenzFaktor(0.8, 2) < latenzFaktor(0.8, 1))
  })
  test("Retry-Faktor: 1 + q + … + q^r", () => {
    assert.equal(retryFaktor(0, 3), 1)
    assert.equal(retryFaktor(1, 3), 4)
    assert.ok(Math.abs(retryFaktor(0.5, 2) - 1.75) < 1e-12)
  })
})

describe("Skalierung", () => {
  test("mehr Instanzen → weniger Latenz und Auslastung", () => {
    const m = miniMission()
    const eins = nach(m, 5)
    const vier = nach(m, 5, [{ typ: "skalieren", element: "svc", instanzen: 4 }])
    const p = (z: Zustand) => z.verlauf[z.verlauf.length - 1]
    assert.ok((p(vier).p95 as number) < (p(eins).p95 as number), `p95 ${p(vier).p95} < ${p(eins).p95}`)
    assert.ok(vier.elemente.svc.messung.auslastung < eins.elemente.svc.messung.auslastung)
  })
  test("Überlast: Anfragen über der Kapazität scheitern", () => {
    const m = miniMission((x) => (x.last.punkte = [{ t: 0, rps: 240 }]))
    const z = nach(m, 5)
    const p = z.verlauf[4]
    assert.ok(p.verfuegbarkeit < 0.6, `Verfügbarkeit ${p.verfuegbarkeit}`)
    assert.equal(p.engpass, "svc")
    assert.ok(p.ueberlastet.includes("svc"))
    assert.equal(z.elemente.svc.messung.zustand, "ueberlast")
  })
  test("neue Instanzen sind erst nach der Startzeit aktiv, vor dem Start sofort", () => {
    const m = miniMission()
    let z = starte(m, 1)
    z = wendeAn(m, z, { typ: "skalieren", element: "svc", instanzen: 3 })
    assert.equal(z.elemente.svc.instanzen, 3, "vor dem Start sofort")
    z = wendeAn(m, z, { typ: "weiter", minuten: 2 })
    z = wendeAn(m, z, { typ: "skalieren", element: "svc", instanzen: 5 })
    assert.equal(z.elemente.svc.instanzen, 3)
    z = wendeAn(m, z, { typ: "weiter", minuten: K.START_VERZOEGERUNG - 1 })
    assert.equal(z.elemente.svc.instanzen, 3)
    z = wendeAn(m, z, { typ: "weiter", minuten: 1 })
    assert.equal(z.elemente.svc.instanzen, 5)
    z = wendeAn(m, z, { typ: "skalieren", element: "svc", instanzen: 2 })
    assert.equal(z.elemente.svc.instanzen, 2, "Abbau sofort")
  })
  test("Autoscaling reagiert mit Verzögerung und baut bei tiefer Last wieder ab", () => {
    const m = miniMission((x) => {
      x.last.punkte = [{ t: 0, rps: 60 }, { t: 9, rps: 60 }, { t: 10, rps: 300 }, { t: 25, rps: 300 }, { t: 26, rps: 10 }]
      x.dauer = 45
    })
    let z = starte(m, 1)
    z = wendeAn(m, z, { typ: "autoscaling", element: "svc", an: true, min: 1, max: 6 })
    z = wendeAn(m, z, { typ: "weiter", minuten: 11 })
    assert.equal(z.elemente.svc.instanzen, 1, "noch nicht gestartet")
    assert.ok(z.elemente.svc.geplant.length > 0, "Start eingeplant")
    z = wendeAn(m, z, { typ: "weiter", minuten: 10 })
    assert.ok(z.elemente.svc.instanzen >= 3, `Instanzen ${z.elemente.svc.instanzen}`)
    assert.ok(z.verlauf[20].verfuegbarkeit > 0.99)
    z = wendeAn(m, z, { typ: "weiter", minuten: 24 })
    assert.equal(z.elemente.svc.instanzen, 1, "wieder auf Minimum")
  })
  test("Datenbank lässt sich nicht horizontal skalieren, Read-Replica schon", () => {
    const m = miniMission()
    const z = starte(m, 1)
    assert.throws(() => wendeAn(m, z, { typ: "skalieren", element: "db", instanzen: 2 }), (e: unknown) => e instanceof ArchSimFehler && /Read-Replica/.test(e.message))
    assert.doesNotThrow(() => wendeAn(m, z, { typ: "readReplica", element: "db", anzahl: 2 }))
  })
})

describe("Datenhaltung", () => {
  const schwer = () =>
    miniMission((x) => {
      x.last.punkte = [{ t: 0, rps: 450 }]
      x.modell.elemente[2].sim = { instanzen: 8 }
    })
  test("Cache senkt die Datenbank-Last (nach dem Aufwärmen)", () => {
    const m = schwer()
    const ohne = nach(m, 8)
    const mit = nach(m, 8, [{ typ: "cache", element: "db" }])
    assert.ok(ohne.elemente.db.messung.auslastung > 1, `ohne Cache ρ = ${ohne.elemente.db.messung.auslastung}`)
    assert.ok(mit.elemente.db.messung.last < 0.3 * ohne.elemente.db.messung.last, `DB-Last ${mit.elemente.db.messung.last} vs. ${ohne.elemente.db.messung.last}`)
    assert.ok(mit.verlauf[7].verfuegbarkeit > ohne.verlauf[7].verfuegbarkeit)
    assert.ok(mit.modell.elemente.some((e) => e.typ === "cache"), "Cache-Element im Modell")
  })
  test("ein neuer Cache ist zuerst kalt", () => {
    const m = schwer()
    const z = nach(m, 1, [{ typ: "cache", element: "db" }])
    assert.ok(z.elemente.db.messung.last > 400, "erste Minute: noch keine Treffer")
  })
  test("Schreibzugriffe umgehen den Cache", () => {
    const m = schwer()
    m.anfragen[0].schreibend = true
    const z = nach(m, 8, [{ typ: "cache", element: "db" }])
    assert.ok(z.elemente.db.messung.last > 400)
  })
  test("Read-Replicas verteilen Lesezugriffe", () => {
    const m = schwer()
    const ohne = nach(m, 5)
    const mit = nach(m, 5, [{ typ: "readReplica", element: "db", anzahl: 2 }])
    assert.ok(mit.elemente.db.messung.auslastung < 0.5 * ohne.elemente.db.messung.auslastung)
  })
})

describe("Asynchrone Entkopplung", () => {
  const mitAusfall = () =>
    kaskadenMission((x) => {
      x.ereignisse = [{ id: "aus", tick: 5, dauer: 8, titel: "Ausfall", text: "Zahlung fällt aus.", wirkung: { art: "ausfall", element: "zahlung" } }]
    })
  test("Queue puffert bei Ausfall des Konsumenten statt Fehler; danach wird abgebaut", () => {
    const m = mitAusfall()
    const sync = lauf(m)
    const async = lauf(m, [{ typ: "queue", verbindung: "kauf-zahlung" }])
    const sv = mittel(sync.zustand, 5, 13, (p) => p.verfuegbarkeit)
    const av = mittel(async.zustand, 5, 13, (p) => p.verfuegbarkeit)
    assert.ok(sv < 0.75, `synchron während Ausfall ${sv}`)
    assert.ok(av > 0.99, `asynchron während Ausfall ${av}`)
    const maxRueck = Math.max(...async.zustand.verlauf.map((p) => p.rueckstau))
    assert.ok(maxRueck > 10000, `Rückstau ${maxRueck}`)
    assert.ok(async.kennzahlen.rueckstauEnde < 0.05 * maxRueck, `Rückstau am Ende ${async.kennzahlen.rueckstauEnde}`)
    assert.ok(async.kennzahlen.verlorenQuote < 0.005 && sync.kennzahlen.verlorenQuote > 0.05)
  })
  test("Puffer läuft über, wenn er zu klein ist: Nachrichten gehen verloren", () => {
    const m = mitAusfall()
    const z = nach(m, 14, [{ typ: "queue", verbindung: "kauf-zahlung" }])
    const q = z.modell.elemente.find((e) => e.typ === "queue")
    assert.ok(q)
    const klein = mitAusfall()
    const lauf2 = (() => {
      let s = starte(klein, 1)
      s = wendeAn(klein, s, { typ: "queue", verbindung: "kauf-zahlung" })
      const qe = s.modell.elemente.find((e) => e.typ === "queue")
      if (qe) qe.sim = { puffer: 5000 }
      return wendeAn(klein, s, { typ: "weiter", minuten: 14 })
    })()
    assert.ok(lauf2.summen.nachrichtenVerloren > 1000, `verloren ${lauf2.summen.nachrichtenVerloren}`)
    assert.equal(z.summen.nachrichtenVerloren < 1, true)
  })
  test("asynchron ohne Broker («fire and forget») verliert Nachrichten bei Ausfall", () => {
    const m = mitAusfall()
    const v = m.modell.verbindungen.find((x) => x.id === "kauf-zahlung")
    if (v) v.art = "async"
    const e = lauf(m)
    assert.ok(e.zustand.summen.nachrichtenVerloren > 1000)
    assert.ok(e.kennzahlen.verlorenQuote > 0.05)
  })
})

describe("Resilienz", () => {
  const langsam = (anpassen?: (m: Mission) => void) =>
    kaskadenMission((x) => {
      x.ereignisse = [{ id: "lahm", tick: 5, dauer: 15, titel: "Anbieter langsam", text: "Antworten dauern 4 s.", wirkung: { art: "langsam", element: "psp", faktor: 20 } }]
      anpassen?.(x)
    })

  test("Retry-Sturm verschlimmert Überlast", () => {
    const ueberlast = (retries: number) =>
      miniMission((x) => {
        x.last.punkte = [{ t: 0, rps: 150 }]
        x.modell.verbindungen[1].sim = { retries, timeoutMs: 2000 }
        x.modell.elemente[2].sim = { instanzen: 1 }
      })
    const ohne = nach(ueberlast(0), 10)
    const mit = nach(ueberlast(3), 10)
    assert.ok(mit.elemente.svc.messung.last > 1.5 * ohne.elemente.svc.messung.last, `Last ${mit.elemente.svc.messung.last} vs. ${ohne.elemente.svc.messung.last}`)
    assert.ok(mit.elemente.svc.messung.auslastung > ohne.elemente.svc.messung.auslastung)
    assert.ok(mit.verlauf[9].retrySturm === "gw-svc", "Retry-Sturm erkannt")
    assert.ok(mittel(mit, 3, 10, (p) => p.verfuegbarkeit) <= mittel(ohne, 3, 10, (p) => p.verfuegbarkeit) + 1e-9)
  })

  test("langsame Abhängigkeit ohne Timeout reisst auch unbeteiligte Anfragen mit (Kaskade)", () => {
    const e = lauf(langsam())
    const v = mittel(e.zustand, 8, 20, (p) => p.verfuegbarkeit)
    assert.ok(v < 0.85, `Verfügbarkeit während Störung ${v} (nur 30 % kaufen; Rest muss mitgerissen werden)`)
    assert.ok(e.zustand.verlauf.slice(8, 20).some((p) => p.threadsErschoepft.includes("gw")), "Gateway-Threads erschöpft")
  })

  test("Circuit Breaker mit kurzem Timeout begrenzt die Fehlerkaskade", () => {
    const ohne = lauf(langsam())
    const mit = lauf(langsam(), [
      { typ: "timeout", verbindung: "zahlung-psp", ms: 1500 },
      { typ: "retry", verbindung: "zahlung-psp", versuche: 0 },
      { typ: "circuitBreaker", verbindung: "zahlung-psp", an: true },
    ])
    // Lesen (70 %) bleibt gesund: Verfügbarkeit ≈ 70 % + nichts von «kaufen»; ohne Schutz fällt auch Lesen aus
    const vo = mittel(ohne.zustand, 8, 20, (p) => p.verfuegbarkeit)
    const vm = mittel(mit.zustand, 8, 20, (p) => p.verfuegbarkeit)
    assert.ok(vm > 0.69, `mit Schutz ${vm}`)
    assert.ok(vm > vo, `mit ${vm} > ohne ${vo}`)
    assert.ok(mit.zustand.verlauf.some((p) => p.cbOffen.includes("zahlung-psp")), "Circuit Breaker hat geöffnet")
    assert.ok(!mit.zustand.verlauf.slice(8, 20).some((p) => p.threadsErschoepft.includes("gw")), "Gateway bleibt frei")
    // nach der Störung schliesst er wieder
    const ende = mit.zustand.verbindungen["zahlung-psp"].cbStatus
    assert.equal(ende, "zu")
    assert.ok(mit.zustand.verlauf[29].verfuegbarkeit > 0.99)
  })

  test("Circuit Breaker mit Fallback liefert degradierte Antworten statt Fehler", () => {
    const m = langsam((x) => {
      const v = x.modell.verbindungen.find((y) => y.id === "zahlung-psp")
      if (v) v.sim = { ...v.sim, fallback: true }
    })
    const e = lauf(m, [{ typ: "timeout", verbindung: "zahlung-psp", ms: 1500 }, { typ: "circuitBreaker", verbindung: "zahlung-psp", an: true }])
    assert.ok(mittel(e.zustand, 8, 20, (p) => p.verfuegbarkeit) > 0.98)
    assert.ok(e.zustand.verlauf.slice(8, 20).some((p) => p.degradiert > 0.1))
  })

  test("Bulkhead schützt andere Anfragen vor der langsamen Abhängigkeit", () => {
    const ohne = lauf(langsam())
    const mit = lauf(langsam(), [{ typ: "bulkhead", verbindung: "gw-kauf", an: true }])
    const vo = mittel(ohne.zustand, 8, 20, (p) => p.verfuegbarkeit)
    const vm = mittel(mit.zustand, 8, 20, (p) => p.verfuegbarkeit)
    assert.ok(vm > 0.69 && vm > vo + 0.05, `Bulkhead ${vm} vs. ohne ${vo}`)
  })

  test("Rate Limiting weist Überlast am Gateway ab und schützt den Dienst", () => {
    const m = miniMission((x) => (x.last.punkte = [{ t: 0, rps: 300 }]))
    const z = nach(m, 5, [
      { typ: "skalieren", element: "svc", instanzen: 2 },
      { typ: "rateLimit", element: "gw", proSekunde: 180 },
    ])
    assert.ok(z.summen.abgewiesen > 0)
    assert.ok(z.elemente.svc.messung.auslastung < 1, `Dienst ρ = ${z.elemente.svc.messung.auslastung}`)
    assert.ok(Math.abs(z.verlauf[4].verfuegbarkeit - 0.6) < 0.02, `Verfügbarkeit ≈ 180/300: ${z.verlauf[4].verfuegbarkeit}`)
  })

  test("Rollback beendet ein fehlerhaftes Deployment", () => {
    const m = miniMission((x) => {
      x.ereignisse = [{ id: "dep", tick: 3, dauer: 15, titel: "Deployment", text: "Neue Version wirft Fehler.", wirkung: { art: "deployment", element: "svc", fehlerquote: 0.3 } }]
      x.modell.elemente[2].sim = { instanzen: 2 }
    })
    let z = starte(m, 1)
    assert.throws(() => wendeAn(m, z, { typ: "rollback", element: "svc" }), ArchSimFehler)
    z = wendeAn(m, z, { typ: "weiter", minuten: 5 })
    assert.ok(z.verlauf[4].fehlerquote > 0.25)
    assert.equal(z.elemente.svc.messung.zustand, "fehlerhaft")
    z = wendeAn(m, z, { typ: "rollback", element: "svc" })
    z = wendeAn(m, z, { typ: "weiter", minuten: 2 })
    assert.ok(z.verlauf[6].fehlerquote < 0.01)
    assert.equal(z.ereignisse.dep.status, "behoben")
  })
})

describe("Aktionen, Modelländerungen und Kosten", () => {
  test("CDN wird hinter dem Client eingefügt und beantwortet den statischen Anteil", () => {
    const m = miniMission((x) => (x.anfragen[0].statischAnteil = 0.6))
    const z = nach(m, 3, [{ typ: "cdn", element: "web" }])
    const cdn = z.modell.elemente.find((e) => e.typ === "cdn")
    assert.ok(cdn)
    assert.ok(z.modell.verbindungen.some((v) => v.von === "web" && v.nach === cdn.id))
    assert.ok(z.modell.verbindungen.some((v) => v.von === cdn.id && v.nach === "gw"))
    assert.ok(Math.abs(z.elemente.svc.messung.last - 80 * 0.4) < 1, `Dienst-Last ${z.elemente.svc.messung.last}`)
  })
  test("Queue-Aktion ersetzt den synchronen Aufruf durch Queue + Konsum", () => {
    const m = kaskadenMission()
    const z = wendeAn(m, starte(m, 1), { typ: "queue", verbindung: "kauf-zahlung" })
    const q = z.modell.elemente.find((e) => e.typ === "queue")
    assert.ok(q)
    const v = z.modell.verbindungen.find((x) => x.id === "kauf-zahlung")
    assert.equal(v?.nach, q.id)
    assert.equal(v?.art, "async")
    assert.ok(z.modell.verbindungen.some((x) => x.von === q.id && x.nach === "zahlung"))
    assert.ok(Number.isFinite(q.x) && Number.isFinite(q.y), "Position gesetzt")
  })
  test("ungültige und nicht erlaubte Aktionen werfen ArchSimFehler mit Code", () => {
    const m = mission("m1-velokurier")
    const z = starte(m, 1)
    const code = (a: Aktion) => {
      try {
        wendeAn(m, z, a)
      } catch (e) {
        return e instanceof ArchSimFehler ? e.code : "anders"
      }
      return "ok"
    }
    assert.equal(code({ typ: "circuitBreaker", verbindung: "mono-db", an: true }), "NICHT_ERLAUBT")
    assert.equal(code({ typ: "skalieren", element: "gibtsnicht", instanzen: 2 }), "UNBEKANNT")
    assert.equal(code({ typ: "skalieren", element: "mono", instanzen: 0 }), "UNGUELTIG")
    assert.equal(code({ typ: "skalieren", element: "mono", instanzen: 99 }), "UNGUELTIG")
    assert.equal(code({ typ: "cache", element: "mono" }), "UNGUELTIG")
    assert.equal(code({ typ: "weiter", minuten: 0 }), "UNGUELTIG")
    assert.equal(code({ typ: "cache", element: "db" }), "ok")
    const m3 = mission("m3-zahlungsanbieter")
    assert.throws(() => wendeAn(m3, starte(m3, 1), { typ: "queue", verbindung: "gw-kauf" }), (e: unknown) => e instanceof ArchSimFehler && e.code === "NICHT_ERLAUBT")
  })
  test("nach dem Ende sind keine Aktionen mehr möglich", () => {
    const m = miniMission()
    const z = nach(m, m.dauer)
    assert.equal(z.phase, "beendet")
    assert.throws(() => wendeAn(m, z, { typ: "weiter", minuten: 1 }), (e: unknown) => e instanceof ArchSimFehler && e.code === "BEENDET")
  })
  test("Kosten: Instanzen laufend, Massnahmen einmalig", () => {
    const m = miniMission()
    const basis = lauf(m)
    const mehr = lauf(m, [{ typ: "skalieren", element: "svc", instanzen: 3 }, { typ: "cache", element: "db" }])
    assert.ok(Math.abs(mehr.kennzahlen.kostenBetrieb - basis.kennzahlen.kostenBetrieb - ((2 * 10 + 8) * m.dauer) / 60) < 1e-6)
    assert.equal(mehr.kennzahlen.kostenMassnahmen, 40)
  })
  test("Hinweise der geführten Mission erscheinen", () => {
    const m = mission("m1-velokurier")
    const z = nach(m, m.dauer)
    const ids = z.hinweise.map((h) => h.id)
    assert.ok(ids.includes("start") && ids.includes("mono-heiss") && ids.includes("regen"), ids.join(","))
  })
})
