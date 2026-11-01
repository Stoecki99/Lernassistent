// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

"use client"

// components/features/leitstand/Kalender.tsx
// Kalender (6.1: Liste der Termine + Knöpfe): Gespräche, Anlässe, Weiterbildungen, Abwesenheiten.
// Höchstens 4 Termine pro Tag im Kalender der Projektleitung (3.5).

import { useState } from "react"
import { dayOf, formatTick } from "@/lib/simulation/core"
import styles from "@/app/(leitstand)/leitstand.module.css"
import { personName, useLeitstand } from "./context"
import { chf } from "./format"
import { KIND_TEXT } from "./Uebersicht"

const COUNTED = new Set(["gespraech", "mittagessen", "teamabend", "zusatzbericht"])

export default function Kalender() {
  const { state, scenario, run, readOnly } = useLeitstand()
  const [talkWith, setTalkWith] = useState("")
  const [kind, setKind] = useState<"mittagessen" | "teamabend">("mittagessen")
  const [guests, setGuests] = useState<string[]>([])
  const today = dayOf(state.tick)
  const max = scenario.params?.calendarMaxPerDay ?? 4
  const usedToday = state.calendar.filter((c) => dayOf(c.tick) === today && COUNTED.has(c.kind)).length
  const team = scenario.people.filter((p) => state.people[p.id]?.available)
  const canAct = !readOnly && (state.phase === "planung" || state.phase === "lauf")
  const entries = [...state.calendar].sort((a, b) => b.tick - a.tick)
  const absences = scenario.people.flatMap((p) =>
    (state.people[p.id]?.absences ?? []).map((a) => ({ person: p.name, ...a }))
  )

  return (
    <div className={styles.ansicht}>
      <div className={styles.raster2}>
        <div className="card stack">
          <h3>Termin anlegen</h3>
          <p className={usedToday >= max ? styles.warnText : "hint"}>
            Heute {usedToday} von {max} Terminen belegt.
          </p>
          <div className="row">
            <label>
              <span className="sr-only">Gespräch mit</span>
              <select className="btn" value={talkWith} onChange={(e) => setTalkWith(e.target.value)} disabled={!canAct}>
                <option value="">Gespräch mit …</option>
                {team.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} (Motivation {Math.round(state.people[p.id].motivation)})
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="btn"
              disabled={!canAct || !talkWith}
              onClick={() => {
                if (run({ type: "talk", personId: talkWith })) setTalkWith("")
              }}
            >
              Gespräch führen (1 h)
            </button>
          </div>
          <fieldset className={styles.feldgruppe} disabled={!canAct}>
            <legend>Anlass</legend>
            <div className="row" role="radiogroup" aria-label="Art des Anlasses">
              <label className="row">
                <input type="radio" name="anlass" checked={kind === "mittagessen"} onChange={() => setKind("mittagessen")} /> Mittagessen (CHF 45 je
                Person)
              </label>
              <label className="row">
                <input type="radio" name="anlass" checked={kind === "teamabend"} onChange={() => setKind("teamabend")} /> Teamabend (CHF 120 je
                Person)
              </label>
            </div>
            <div className={styles.checkRaster}>
              {team.map((p) => (
                <label key={p.id} className="row">
                  <input
                    type="checkbox"
                    checked={guests.includes(p.id)}
                    onChange={(e) => setGuests((g) => (e.target.checked ? [...g, p.id] : g.filter((x) => x !== p.id)))}
                  />{" "}
                  {p.name}
                </label>
              ))}
            </div>
            <div className="row">
              <button type="button" className="btn" onClick={() => setGuests(team.map((p) => p.id))}>
                Alle
              </button>
              <button
                type="button"
                className="btn primary"
                disabled={guests.length === 0}
                onClick={() => {
                  if (run({ type: "teamEvent", kind, personIds: guests })) setGuests([])
                }}
              >
                Einladen ({chf(guests.length * (kind === "mittagessen" ? 45 : 120))})
              </button>
            </div>
          </fieldset>
        </div>
        <div className="card stack">
          <h3>Abwesenheiten</h3>
          {absences.length === 0 ? (
            <p className="hint">Keine bekannt.</p>
          ) : (
            <ul className={styles.liste}>
              {absences.map((a, i) => (
                <li key={i}>
                  {a.person}: Tag {dayOf(a.fromTick) + 1} bis {dayOf(Math.max(a.fromTick, a.toTick - 1)) + 1} · {a.reason}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <div className="card stack">
        <h3>Termine</h3>
        {entries.length === 0 ? (
          <p className="hint">Noch keine Termine.</p>
        ) : (
          <ul className={styles.liste}>
            {entries.map((c) => (
              <li key={c.id}>
                <strong>{KIND_TEXT[c.kind]}</strong>
                {c.personIds.length > 0 ? ` mit ${c.personIds.map((p) => personName(scenario, p)).join(", ")}` : ""}
                {c.hours ? ` · ${c.hours} h` : ""} <span className="hint">· {formatTick(c.tick)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
