// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

"use client"

// components/features/architektur-leitstand/Massnahmen.tsx
// Massnahmen: Formular je Massnahme und Ziel (Kosten, Wirkung, aktueller Wert, Sperrgrund des Kerns),
// Auswahl-Panel für das gewählte Element bzw. die gewählte Verbindung (Messwerte + passende Massnahmen)
// und die Massnahmen-Leiste mit allen erlaubten Massnahmen der Mission (Ziel im Dialog wählen).

import { useEffect, useId, useState } from "react"
import { kategorie, type Aktion, type Mission, type Zustand } from "@/lib/archsim"
import styles from "@/app/(architektur-leitstand)/architektur-leitstand.module.css"
import Dialog from "./Dialog"
import type { Auswahl } from "./LiveDiagramm"
import {
  MASSNAHMEN,
  MESS_ZUSTAND,
  chf,
  erlaubteMassnahmen,
  hatKapazitaet,
  kostenProInstanz,
  massnahmenFuerElement,
  massnahmenFuerVerbindung,
  maxInstanzen,
  ms,
  prozent,
  rueckstauJeElement,
  sperrGrund,
  verbindungsName,
  zahl,
  zieleFuer,
  zielInstanzen,
  type MassnahmeInfo,
} from "./logik"

const TIMEOUTS = [300, 500, 1000, 1500, 2000, 3000, 5000, 10000, 30000]

function Stepper({ wert, min, max, onChange, label }: { wert: number; min: number; max: number; onChange: (n: number) => void; label: string }) {
  return (
    <span className={styles.stepper} role="group" aria-label={label}>
      <button type="button" className="btn" onClick={() => onChange(Math.max(min, wert - 1))} disabled={wert <= min} aria-label={`${label}: weniger`}>
        −
      </button>
      <output className={styles.stepperWert} aria-live="polite">
        {wert}
      </output>
      <button type="button" className="btn" onClick={() => onChange(Math.min(max, wert + 1))} disabled={wert >= max} aria-label={`${label}: mehr`}>
        +
      </button>
    </span>
  )
}

export function MassnahmeFormular({
  mission,
  zustand,
  info,
  ziel,
  onAnwenden,
  gesperrt,
  kompakt = false,
}: {
  mission: Mission
  zustand: Zustand
  info: MassnahmeInfo
  ziel: string
  onAnwenden: (a: Aktion) => void
  gesperrt: string | null
  kompakt?: boolean
}) {
  const rt = zustand.elemente[ziel]
  const vt = zustand.verbindungen[ziel]
  const ist = zielInstanzen(zustand, ziel)
  const max = maxInstanzen(zustand, ziel)
  // Vorschlag folgt dem aktuellen Stand, bis man selbst etwas wählt (null = Vorschlag)
  const [nWahl, setN] = useState<number | null>(null)
  const n = nWahl ?? Math.min(max, Math.max(1, ist + 1))
  const [asMin, setAsMin] = useState(() => Math.max(1, ist))
  const [asMax, setAsMax] = useState(() => Math.min(max, Math.max(2, ist * 4)))
  const [repWahl, setRep] = useState<number | null>(null)
  const rep = repWahl ?? Math.min(5, (rt?.replikate ?? 0) + 1)
  const [rate, setRate] = useState(() => (rt?.rateLimit ? rt.rateLimit : 500))
  const [to, setTo] = useState(() => (vt ? Math.min(vt.timeoutMs, 2000) : 2000))
  const [rv, setRv] = useState(() => vt?.retries ?? 0)
  const rateId = useId()
  const toId = useId()

  // Bei neuem Ziel oder neuem Stand die Vorschläge nachführen
  useEffect(() => {
    setN(null)
    setRep(null)
    setAsMin(Math.max(1, ist))
    setAsMax(Math.min(max, Math.max(2, ist * 4)))
    // nur beim Wechsel des Ziels
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ziel])

  const k = (a: Aktion) => {
    const grund = gesperrt ?? sperrGrund(mission, zustand, a)
    return { grund, knopf: (text: string, primaer = true) => (
      <button type="button" className={`btn ${primaer ? "primary" : ""}`} disabled={grund !== null} onClick={() => {
          onAnwenden(a)
          setN(null)
          setRep(null)
        }}>
        {text}
      </button>
    ) }
  }

  let inhalt: React.ReactNode = null
  let grund: string | null = null
  const kosten = info.einmalkosten > 0 ? `${chf(info.einmalkosten)} einmalig` : ""

  switch (info.typ) {
    case "skalieren": {
      const x = k({ typ: "skalieren", element: ziel, instanzen: n })
      grund = n === ist ? null : x.grund
      const delta = (n - ist) * kostenProInstanz(zustand, ziel)
      inhalt = (
        <div className={styles.formZeile}>
          <Stepper wert={n} min={1} max={max} onChange={setN} label="Instanzen" />
          <span className="hint">
            jetzt {ist}
            {delta !== 0 ? ` · ${delta > 0 ? "+" : "−"}${zahl(Math.abs(delta))} CHF/h` : ""}
          </span>
          {n === ist ? <span className="hint">(unverändert)</span> : x.knopf(`Auf ${n} setzen`)}
        </div>
      )
      break
    }
    case "autoscaling": {
      if (rt?.autoscaling) {
        const x = k({ typ: "autoscaling", element: ziel, an: false })
        grund = x.grund
        inhalt = (
          <div className={styles.formZeile}>
            <span>
              An: {rt.autoscaling.min} bis {rt.autoscaling.max} Instanzen
            </span>
            {x.knopf("Ausschalten", false)}
          </div>
        )
      } else {
        const x = k({ typ: "autoscaling", element: ziel, an: true, min: asMin, max: Math.max(asMin, asMax) })
        grund = x.grund
        inhalt = (
          <div className={styles.formZeile}>
            <span className={styles.formFeld}>
              min <Stepper wert={asMin} min={1} max={max} onChange={(v) => { setAsMin(v); if (asMax < v) setAsMax(v) }} label="Mindestens" />
            </span>
            <span className={styles.formFeld}>
              max <Stepper wert={Math.max(asMin, asMax)} min={asMin} max={max} onChange={setAsMax} label="Höchstens" />
            </span>
            {x.knopf("Einschalten")}
          </div>
        )
      }
      break
    }
    case "cache":
    case "cdn":
    case "queue":
    case "rollback": {
      const a: Aktion = info.typ === "queue" ? { typ: "queue", verbindung: ziel } : { typ: info.typ, element: ziel }
      const x = k(a)
      grund = x.grund
      inhalt = <div className={styles.formZeile}>{x.knopf(info.typ === "cache" ? "Cache setzen" : info.typ === "cdn" ? "CDN setzen" : info.typ === "queue" ? "Queue einfügen" : "Zurückrollen")}</div>
      break
    }
    case "readReplica": {
      const x = k({ typ: "readReplica", element: ziel, anzahl: rep })
      grund = rep === (rt?.replikate ?? 0) ? null : x.grund
      inhalt = (
        <div className={styles.formZeile}>
          <Stepper wert={rep} min={0} max={5} onChange={setRep} label="Read-Replicas" />
          <span className="hint">jetzt {rt?.replikate ?? 0}</span>
          {rep === (rt?.replikate ?? 0) ? null : x.knopf(`${rep} Replica${rep === 1 ? "" : "s"}`)}
        </div>
      )
      break
    }
    case "rateLimit": {
      const x = k({ typ: "rateLimit", element: ziel, proSekunde: Math.max(1, Math.round(rate)) })
      const aus = k({ typ: "rateLimit", element: ziel, proSekunde: 0 })
      grund = x.grund
      inhalt = (
        <div className={styles.formZeile}>
          <label htmlFor={rateId} className={styles.formFeld}>
            Höchstens
            <input
              id={rateId}
              type="number"
              inputMode="numeric"
              min={1}
              max={1000000}
              step={10}
              value={rate}
              onChange={(e) => setRate(Number(e.target.value) || 0)}
              className={styles.zahlFeld}
            />
            Anfr./s
          </label>
          {x.knopf(rt?.rateLimit ? "Ändern" : "Begrenzen")}
          {rt?.rateLimit ? aus.knopf("Aufheben", false) : null}
        </div>
      )
      break
    }
    case "circuitBreaker":
    case "bulkhead": {
      const an = info.typ === "circuitBreaker" ? (vt?.circuitBreaker ?? false) : (vt?.bulkhead ?? false)
      const x = k({ typ: info.typ, verbindung: ziel, an: !an })
      grund = x.grund
      inhalt = (
        <div className={styles.formZeile}>
          <span>
            {an ? "An" : "Aus"}
            {info.typ === "circuitBreaker" && vt?.circuitBreaker ? ` · Status: ${vt.cbStatus === "zu" ? "zu (Aufrufe gehen durch)" : vt.cbStatus === "offen" ? "offen (Aufrufe werden abgewiesen)" : "halboffen (Probeaufrufe)"}` : ""}
          </span>
          {x.knopf(an ? "Ausschalten" : "Einschalten", !an)}
        </div>
      )
      break
    }
    case "timeout": {
      const x = k({ typ: "timeout", verbindung: ziel, ms: to })
      grund = to === vt?.timeoutMs ? null : x.grund
      const werte = Array.from(new Set([...TIMEOUTS, vt?.timeoutMs ?? 30000])).sort((a, b) => a - b)
      inhalt = (
        <div className={styles.formZeile}>
          <label htmlFor={toId} className={styles.formFeld}>
            Timeout
            <select id={toId} value={to} onChange={(e) => setTo(Number(e.target.value))} className={styles.auswahlFeld}>
              {werte.map((w) => (
                <option key={w} value={w}>
                  {ms(w)}
                </option>
              ))}
            </select>
          </label>
          <span className="hint">jetzt {ms(vt?.timeoutMs ?? 30000)}</span>
          {to === vt?.timeoutMs ? null : x.knopf("Übernehmen")}
        </div>
      )
      break
    }
    case "retry": {
      const x = k({ typ: "retry", verbindung: ziel, versuche: rv })
      grund = rv === vt?.retries ? null : x.grund
      inhalt = (
        <div className={styles.formZeile}>
          <span className={styles.segment} role="group" aria-label="Wiederholungen">
            {[0, 1, 2, 3, 4, 5].map((w) => (
              <button key={w} type="button" className={`${styles.segKnopf} ${rv === w ? styles.segAn : ""}`} aria-pressed={rv === w} onClick={() => setRv(w)}>
                {w}
              </button>
            ))}
          </span>
          <span className="hint">jetzt {vt?.retries ?? 0}</span>
          {rv === vt?.retries ? null : x.knopf("Übernehmen")}
        </div>
      )
      break
    }
  }

  return (
    <div className={`${styles.massnahme} ${kompakt ? styles.massnahmeKompakt : ""}`}>
      <div className={styles.massnahmeKopf}>
        <span className={styles.massnahmeSymbol} aria-hidden="true">
          {info.symbol}
        </span>
        <strong>{info.titel}</strong>
        <span className={styles.massnahmeKosten}>
          {kosten}
          {info.typ === "skalieren" || info.typ === "readReplica" ? `${kosten ? " · " : ""}${zahl(kostenProInstanz(zustand, ziel))} CHF/h je Instanz` : ""}
        </span>
      </div>
      {!kompakt && <p className={styles.massnahmeText}>{info.wirkung}</p>}
      {inhalt}
      {grund && (
        <p className={styles.sperrGrund}>
          <span aria-hidden="true">■ </span>
          {grund}
        </p>
      )}
    </div>
  )
}

/** Panel zum gewählten Element bzw. zur gewählten Verbindung */
export function AuswahlPanel({
  mission,
  zustand,
  auswahl,
  setAuswahl,
  onAnwenden,
  gesperrt,
}: {
  mission: Mission
  zustand: Zustand
  auswahl: Auswahl
  setAuswahl: (a: Auswahl) => void
  onAnwenden: (a: Aktion) => void
  gesperrt: string | null
}) {
  const waehlenId = useId()
  const m = zustand.modell
  const auswahlListe = (
    <label htmlFor={waehlenId} className={styles.waehlen}>
      <span className="hint">Element oder Verbindung wählen</span>
      <select
        id={waehlenId}
        className={styles.auswahlFeld}
        value={auswahl ? `${auswahl.art}:${auswahl.id}` : ""}
        onChange={(e) => {
          const [art, id] = e.target.value.split(":")
          setAuswahl(art && id ? { art: art as "element" | "verbindung", id } : null)
        }}
      >
        <option value="">– keine Auswahl –</option>
        <optgroup label="Elemente">
          {m.elemente.filter((e) => kategorie(e) !== null).map((e) => (
            <option key={e.id} value={`element:${e.id}`}>
              {e.name}
            </option>
          ))}
        </optgroup>
        <optgroup label="Verbindungen">
          {m.verbindungen.map((v) => (
            <option key={v.id} value={`verbindung:${v.id}`}>
              {verbindungsName(m, v)}
            </option>
          ))}
        </optgroup>
      </select>
    </label>
  )

  if (!auswahl) {
    return (
      <div className={styles.panel}>
        <p className={styles.panelLeer}>
          Tippe ein Element oder eine Verbindung im Diagramm an: Hier siehst du Messwerte und passende Massnahmen wie «skalieren», «Cache davor» oder «Circuit Breaker an dieser Verbindung».
        </p>
        {auswahlListe}
      </div>
    )
  }

  if (auswahl.art === "element") {
    const e = m.elemente.find((x) => x.id === auswahl.id)
    const rt = zustand.elemente[auswahl.id]
    if (!e || !rt) return <div className={styles.panel}>{auswahlListe}</div>
    const kat = kategorie(e) ?? "infrastruktur"
    const { eigene, aufrufe } = massnahmenFuerElement(mission, zustand, e.id)
    const mz = zustand.verlauf.length ? rt.messung.zustand : "leer"
    const puffer = rueckstauJeElement(mission, zustand)[e.id]
    const startend = zielInstanzen(zustand, e.id) - rt.instanzen
    return (
      <div className={styles.panel} aria-live="polite">
        <div className={`${styles.panelKopf} ar-k-${kat === "infrastruktur" ? "infrastruktur" : kat}`}>
          <span className={styles.katPunkt} aria-hidden="true" />
          <div>
            <h3 className={styles.h3}>{e.name}</h3>
            <p className="hint">{[e.technologie, e.typ].filter(Boolean).join(" · ")}</p>
          </div>
          <button type="button" className={`btn ${styles.klein}`} onClick={() => setAuswahl(null)} aria-label="Auswahl aufheben">
            ✕
          </button>
        </div>
        <p className={`${styles.zustandZeile} ${styles[`zs_${mz}`]}`}>
          <span aria-hidden="true">{MESS_ZUSTAND[mz].symbol}</span> {MESS_ZUSTAND[mz].text}
        </p>
        <dl className={styles.messwerte}>
          <div>
            <dt>Last</dt>
            <dd>{zahl(rt.messung.last)} /s</dd>
          </div>
          {hatKapazitaet(e) && (
            <>
              <div>
                <dt>Auslastung</dt>
                <dd>{prozent(rt.messung.auslastung, 0)}</dd>
              </div>
              <div>
                <dt>Instanzen</dt>
                <dd>
                  {rt.instanzen}
                  {startend > 0 ? ` (+${startend} startend)` : ""}
                  {rt.replikate > 0 ? ` · ${rt.replikate} Replica` : ""}
                </dd>
              </div>
              <div>
                <dt>Antwortzeit</dt>
                <dd>{ms(rt.messung.latenzMs)}</dd>
              </div>
              <div>
                <dt>Fehler</dt>
                <dd>{prozent(rt.messung.fehlerquote, rt.messung.fehlerquote < 0.01 ? 2 : 1)}</dd>
              </div>
            </>
          )}
          {puffer && (
            <div>
              <dt>Rückstau</dt>
              <dd>
                {zahl(Math.round(puffer.nachrichten))} ({prozent(puffer.anteil, 0)} voll)
              </dd>
            </div>
          )}
          {rt.autoscaling && (
            <div>
              <dt>Autoscaling</dt>
              <dd>
                {rt.autoscaling.min}–{rt.autoscaling.max}
              </dd>
            </div>
          )}
          {rt.rateLimit > 0 && (
            <div>
              <dt>Rate Limit</dt>
              <dd>{zahl(rt.rateLimit)} /s</dd>
            </div>
          )}
        </dl>
        {e.info?.was && <p className="hint">{e.info.was}</p>}
        {eigene.length > 0 && (
          <div className={styles.panelMassnahmen}>
            <h4 className={styles.h4}>Massnahmen für dieses Element</h4>
            {eigene.map((info) => (
              <MassnahmeFormular key={`${info.typ}-${e.id}`} mission={mission} zustand={zustand} info={info} ziel={e.id} onAnwenden={onAnwenden} gesperrt={gesperrt} kompakt />
            ))}
          </div>
        )}
        {aufrufe.length > 0 && (
          <div className={styles.panelMassnahmen}>
            <h4 className={styles.h4}>Aufrufe von hier</h4>
            <ul className={styles.aufrufe}>
              {aufrufe.map((v) => {
                const vt = zustand.verbindungen[v.id]
                return (
                  <li key={v.id}>
                    <button type="button" className={`btn ${styles.aufrufKnopf}`} onClick={() => setAuswahl({ art: "verbindung", id: v.id })}>
                      <span>→ {m.elemente.find((x) => x.id === v.nach)?.name ?? v.nach}</span>
                      <span className="hint">
                        {v.art} · Timeout {ms(vt?.timeoutMs ?? 30000)} · {vt?.retries ?? 0} Wdh.{vt?.circuitBreaker ? ` · CB ${vt.cbStatus}` : ""}
                        {vt?.bulkhead ? " · Bulkhead" : ""}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        )}
        {eigene.length === 0 && aufrufe.length === 0 && <p className="hint">Für dieses Element gibt es in dieser Mission keine Massnahme.</p>}
        {auswahlListe}
      </div>
    )
  }

  const v = m.verbindungen.find((x) => x.id === auswahl.id)
  const vt = zustand.verbindungen[auswahl.id]
  if (!v || !vt) return <div className={styles.panel}>{auswahlListe}</div>
  const liste = massnahmenFuerVerbindung(mission, zustand, v.id)
  return (
    <div className={styles.panel} aria-live="polite">
      <div className={styles.panelKopf}>
        <span className={styles.kantePikto} aria-hidden="true">
          ⟶
        </span>
        <div>
          <h3 className={styles.h3}>{verbindungsName(m, v)}</h3>
          <p className="hint">
            {v.art}
            {v.label ? ` · ${v.label}` : ""}
          </p>
        </div>
        <button type="button" className={`btn ${styles.klein}`} onClick={() => setAuswahl(null)} aria-label="Auswahl aufheben">
          ✕
        </button>
      </div>
      <dl className={styles.messwerte}>
        <div>
          <dt>Timeout</dt>
          <dd>{ms(vt.timeoutMs)}</dd>
        </div>
        <div>
          <dt>Wiederholungen</dt>
          <dd>{vt.retries}</dd>
        </div>
        <div>
          <dt>Circuit Breaker</dt>
          <dd>{vt.circuitBreaker ? `an, ${vt.cbStatus}` : "aus"}</dd>
        </div>
        <div>
          <dt>Bulkhead</dt>
          <dd>{vt.bulkhead ? "an" : "aus"}</dd>
        </div>
      </dl>
      {liste.length > 0 ? (
        <div className={styles.panelMassnahmen}>
          <h4 className={styles.h4}>Massnahmen für diese Verbindung</h4>
          {liste.map((info) => (
            <MassnahmeFormular key={`${info.typ}-${v.id}`} mission={mission} zustand={zustand} info={info} ziel={v.id} onAnwenden={onAnwenden} gesperrt={gesperrt} kompakt />
          ))}
        </div>
      ) : (
        <p className="hint">Auf dieser Verbindung wartet niemand auf eine Antwort, oder die Mission sieht hier keine Massnahme vor.</p>
      )}
      <p>
        <button type="button" className={`btn ${styles.klein}`} onClick={() => setAuswahl({ art: "element", id: v.von })}>
          ← zu «{m.elemente.find((x) => x.id === v.von)?.name}»
        </button>
      </p>
      {auswahlListe}
    </div>
  )
}

/** Alle erlaubten Massnahmen der Mission als Karten; Klick öffnet die Zielwahl */
export function MassnahmenLeiste({
  mission,
  zustand,
  onAnwenden,
  gesperrt,
  onZeigen,
}: {
  mission: Mission
  zustand: Zustand
  onAnwenden: (a: Aktion) => void
  gesperrt: string | null
  onZeigen: (a: Auswahl) => void
}) {
  const [offen, setOffen] = useState<MassnahmeInfo["typ"] | null>(null)
  const [ziel, setZiel] = useState<string | null>(null)
  const liste = erlaubteMassnahmen(mission)
  const info = offen ? MASSNAHMEN[offen] : null
  const ziele = offen ? zieleFuer(mission, zustand, offen) : []

  return (
    <section className={styles.leiste} aria-labelledby="al-massnahmen-titel">
      <div className={styles.leisteKopf}>
        <h3 id="al-massnahmen-titel" className={styles.h3}>
          Massnahmen
        </h3>
        <p className="hint">Vor dem Start wirkt alles sofort; danach brauchen neue Instanzen 2 Minuten.</p>
      </div>
      <ul className={styles.karten}>
        {liste.map((m) => {
          const z = zieleFuer(mission, zustand, m.typ)
          const moeglich = z.filter((x) => x.grund === null).length
          return (
            <li key={m.typ}>
              <button
                type="button"
                className={`${styles.karte} ${moeglich === 0 ? styles.karteAus : ""}`}
                onClick={() => {
                  setOffen(m.typ)
                  setZiel(z.find((x) => x.grund === null)?.id ?? z[0]?.id ?? null)
                }}
              >
                <span className={styles.karteSymbol} aria-hidden="true">
                  {m.symbol}
                </span>
                <span className={styles.karteTitel}>{m.titel}</span>
                <span className={styles.karteText}>{m.wann}</span>
                <span className={styles.karteFuss}>
                  <span>{m.einmalkosten > 0 ? chf(m.einmalkosten) : "laufend"}</span>
                  <span>{moeglich > 0 ? `${moeglich} ${moeglich === 1 ? "Ziel" : "Ziele"}` : "jetzt nicht möglich"}</span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>

      {info && (
        <Dialog titel={info.titel} kicker={<span aria-hidden="true">{info.symbol} Massnahme</span>} onEscape={() => setOffen(null)} breit>
          <p>{info.wirkung}</p>
          <p className="hint">
            Wann sinnvoll: {info.wann}{" "}
            <a href={info.link} target="_blank" rel="noopener">
              Mehr dazu im Lernpfad (neuer Tab)
            </a>
          </p>
          {ziele.length === 0 ? (
            <p className={styles.sperrGrund}>In diesem Modell gibt es kein passendes Ziel.</p>
          ) : (
            <fieldset className={styles.zielWahl}>
              <legend>{info.ziel === "element" ? "Element wählen" : "Verbindung wählen"}</legend>
              {ziele.map((z) => (
                <label key={z.id} className={`${styles.zielOption} ${ziel === z.id ? styles.zielAn : ""}`}>
                  <input type="radio" name="al-ziel" value={z.id} checked={ziel === z.id} onChange={() => setZiel(z.id)} />
                  <span>{z.name}</span>
                  {z.grund && <span className={styles.zielGrund}>{z.grund}</span>}
                </label>
              ))}
            </fieldset>
          )}
          {ziel && ziele.some((z) => z.id === ziel) && (
            <MassnahmeFormular
              key={`${offen}-${ziel}`}
              mission={mission}
              zustand={zustand}
              info={info}
              ziel={ziel}
              gesperrt={gesperrt}
              onAnwenden={(a) => {
                onAnwenden(a)
                setOffen(null)
              }}
            />
          )}
          <div className={styles.dialogKnoepfe}>
            {ziel && (
              <button
                type="button"
                className="btn"
                onClick={() => {
                  onZeigen({ art: info.ziel, id: ziel })
                  setOffen(null)
                }}
              >
                Im Diagramm zeigen
              </button>
            )}
            <button type="button" className="btn" onClick={() => setOffen(null)}>
              Schliessen
            </button>
          </div>
        </Dialog>
      )}
    </section>
  )
}
