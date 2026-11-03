// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

"use client"

// components/features/leitstand/Uebersicht.tsx
// Übersicht (4.8), von oben nach unten nach Dringlichkeit: «Was jetzt zu tun ist» (höchstens 3 Handlungen),
// Kennzahl-Kacheln, Team-Leiste (Bild, Motivation, Auslastung), kritischer Pfad als kompakte Leiste,
// danach Prognose mit Kurve PV/EV/AC, Posteingang mit Absenderbild und heutige Termine.

import { forecast, formatTick, dayOf } from "@/lib/simulation/core"
import styles from "@/app/(leitstand)/leitstand.module.css"
import { useLeitstand, personName, firstName, roleOf } from "./context"
import { CHANNEL_SYMBOL, CHANNEL_TEXT, DISPLAY_STATUS_ICON, DISPLAY_STATUS_TEXT, chf, tausender } from "./format"
import KurvenDiagramm from "./charts/KurvenDiagramm"
import { evCurves } from "./BudgetAnsicht"
import { absentNow, displayStatus, personLoad, planCheck } from "./logic"
import { deadlineText } from "./EntscheidDialog"
import Kennzahlen from "./Kennzahlen"
import Avatar from "./Avatar"
import Icon, { type IconName } from "./Icon"
import { MotivationBalken, LastBalken } from "./Team"

const KIND_TEXT: Record<string, string> = {
  gespraech: "Gespräch",
  mittagessen: "Mittagessen",
  teamabend: "Teamabend",
  weiterbildung: "Weiterbildung",
  workshop: "Massnahme",
  zusatzbericht: "Zusatzbericht",
}

export { KIND_TEXT }

interface Todo {
  key: string
  /** Bild: Symbol oder Porträt (Name) */
  icon: IconName
  avatar?: string
  title: string
  text?: string
  label: string
  primary?: boolean
  dringend?: boolean
  onClick: () => void
}

export default function Uebersicht() {
  const { state, scenario, kpis, base, setView, openEvent } = useLeitstand()
  const fc = forecast(state, scenario)
  const fcRows = Object.fromEntries(fc.rows.map((r) => [r.taskId, r]))
  const criticalNow = scenario.tasks.filter((t) => fcRows[t.id]?.critical && state.tasks[t.id].status !== "fertig")
  const today = dayOf(state.tick)
  const appointments = state.calendar.filter((c) => dayOf(c.tick) === today)
  const openItems = state.inbox.filter((i) => i.status === "neu" || i.status === "aufgeschoben")
  const curves = evCurves(state, scenario, base, kpis)

  return (
    <div className={styles.ansicht}>
      <WasJetzt />
      <Kennzahlen />
      <TeamLeiste />

      <section className={`card ${styles.pfadKarte}`} aria-labelledby="pfad-titel">
        <div className={styles.zeileZwischen}>
          <h3 id="pfad-titel" className={styles.titelMitSymbol}>
            <Icon name="kritisch" size={18} /> Kritischer Pfad
          </h3>
          <button type="button" className={`btn ${styles.klein}`} onClick={() => setView("plan")}>
            Plan ansehen
          </button>
        </div>
        {criticalNow.length === 0 ? (
          <p className="hint">Alle kritischen Vorgänge sind fertig.</p>
        ) : (
          <ol className={styles.pfadLeiste}>
            {criticalNow.slice(0, 7).map((t, i) => {
              const ts = state.tasks[t.id]
              const st = displayStatus(state, scenario, t.id)
              const progress = ts.done + ts.remaining > 0 ? ts.done / (ts.done + ts.remaining) : 0
              return (
                <li key={t.id} className={`${styles.pfadSchritt} ${styles[`pfad_${st}`]}`} title={t.name}>
                  {i > 0 && (
                    <span className={styles.pfadPfeil} aria-hidden="true">
                      <Icon name="pfeilRechts" size={14} />
                    </span>
                  )}
                  <span className={styles.pfadChip}>
                    <Icon name={DISPLAY_STATUS_ICON[st]} size={15} />
                    <strong>{t.id}</strong>
                    <span className={styles.pfadStatus}>
                      {st === "laufend" ? `${Math.round(progress * 100)} %` : DISPLAY_STATUS_TEXT[st]}
                    </span>
                    <span className="sr-only">{t.name}</span>
                    {t.milestone && (
                      <span className={styles.pfadMeilenstein} aria-label={`Meilenstein ${t.milestone}`}>
                        <Icon name="meilenstein" size={12} />
                      </span>
                    )}
                  </span>
                </li>
              )
            })}
            {criticalNow.length > 7 && <li className="hint">+{criticalNow.length - 7}</li>}
          </ol>
        )}
      </section>

      <div className={styles.raster2}>
        <section className="card stack" aria-labelledby="prognose-titel">
          <h3 id="prognose-titel" className={styles.titelMitSymbol}>
            <Icon name="termin" size={18} /> Prognose
          </h3>
          <dl className={styles.prognose}>
            <div>
              <dt>Ende</dt>
              <dd>
                Tag {kpis.forecastEndDay.toFixed(1)}
                <small>
                  Plan {scenario.calendar.planEndDay} · Ziel {scenario.calendar.targetDay}
                </small>
              </dd>
            </div>
            <div>
              <dt>Kosten (EAC)</dt>
              <dd>
                {chf(kpis.eac)}
                <small>Budget {tausender(kpis.budget)}</small>
              </dd>
            </div>
          </dl>
          <KurvenDiagramm
            title="Kurven PV, EV und AC"
            desc={`Geplanter Wert, Fertigstellungswert und Ist-Kosten bis heute. PV ${chf(kpis.pv)}, EV ${chf(kpis.ev)}, AC ${chf(kpis.ac)}.`}
            reihen={curves.reihen}
            xMax={curves.xMax}
            xLabel={(x) => `T${x}`}
            yLabel={(y) => `${Math.round(y / 1000)}k`}
            marken={curves.marken}
            height={180}
          />
        </section>

        <div className="stack">
          <section className="card stack" aria-labelledby="post-titel">
            <div className={styles.zeileZwischen}>
              <h3 id="post-titel" className={styles.titelMitSymbol}>
                <Icon name="posteingang" size={18} /> Posteingang
              </h3>
              <button type="button" className={`btn ${styles.klein}`} onClick={() => setView("posteingang")}>
                Alle anzeigen
              </button>
            </div>
            {openItems.length === 0 ? (
              <p className="hint">Nichts Offenes.</p>
            ) : (
              <ul className={styles.postListe}>
                {openItems.slice(0, 3).map((i) => {
                  const def = scenario.events.find((e) => e.id === i.eventId)
                  if (!def) return null
                  return (
                    <li key={`${i.eventId}-${i.arrivedTick}`}>
                      <button type="button" className={styles.postEintrag} onClick={() => openEvent(i.eventId)}>
                        <span className={styles.postBild}>
                          <Avatar name={def.sender.name} role={roleOf(scenario, def.sender.name)} size={40} decorative accessory={false} />
                          <span className={styles.postKanal}>
                            <Icon name={CHANNEL_SYMBOL[def.channel]} size={12} />
                          </span>
                        </span>
                        <span className={styles.postText}>
                          <strong>{def.title}</strong>
                          <span className="hint">
                            {CHANNEL_TEXT[def.channel]} · {def.sender.name}
                          </span>
                        </span>
                        <span className={`status ${i.status === "neu" ? "begonnen" : "offen"}`}>{i.status}</span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>

          <section className="card stack" aria-labelledby="heute-titel">
            <h3 id="heute-titel" className={styles.titelMitSymbol}>
              <Icon name="kalender" size={18} /> Heute
            </h3>
            {appointments.length === 0 ? (
              <p className="hint">Keine Termine heute.</p>
            ) : (
              <ul className={styles.terminListe}>
                {appointments.map((c) => (
                  <li key={c.id}>
                    <span className={styles.avatarStapel}>
                      {c.personIds.slice(0, 4).map((p) => (
                        <Avatar key={p} name={personName(scenario, p)} size={28} decorative />
                      ))}
                    </span>
                    <span>
                      <strong>{KIND_TEXT[c.kind]}</strong>
                      {c.personIds.length > 0 ? ` mit ${c.personIds.map((p) => firstName(scenario, p)).join(", ")}` : ""}{" "}
                      <span className="hint">{formatTick(c.tick)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}

/** Höchstens drei nächste Handlungen, nach Dringlichkeit; jede mit Bild, kurzem Satz und einem Knopf. */
function WasJetzt() {
  const { state, scenario, trace, setView, openEvent, run, readOnly } = useLeitstand()
  const todos: Todo[] = []

  const fresh = state.inbox.filter((i) => i.status === "neu")
  for (const item of fresh.slice(0, 1)) {
    const def = scenario.events.find((e) => e.id === item.eventId)
    if (!def) continue
    todos.push({
      key: `neu-${def.id}`,
      icon: CHANNEL_SYMBOL[def.channel],
      avatar: def.sender.name,
      title: def.title,
      text: `${CHANNEL_TEXT[def.channel]} von ${def.sender.name}. Die Zeit steht, bis du entscheidest.`,
      label: "Entscheiden",
      primary: true,
      dringend: true,
      onClick: () => openEvent(def.id),
    })
  }

  if (state.phase === "periodenende" || state.phase === "abschlussbericht") {
    todos.push({
      key: "bericht",
      icon: "bericht",
      title: state.phase === "periodenende" ? "Statusbericht schreiben" : "Abschlussbericht schreiben",
      text: "Melde ehrlich, was die Kennzahlen zeigen.",
      label: "Bericht",
      primary: true,
      dringend: true,
      onClick: () => setView("bericht"),
    })
  }

  if (state.phase === "abgeschlossen") {
    todos.push({ key: "nach", icon: "nachbesprechung", title: "Nachbesprechung ansehen", label: "Ansehen", primary: true, onClick: () => setView("nachbesprechung") })
  }

  if (state.phase === "planung") {
    const findings = planCheck(state, scenario)
    const missing = findings.filter((f) => f.kind === "fehlt")
    const warnings = findings.filter((f) => f.kind === "warnung")
    if (missing.length > 0) {
      todos.push({
        key: "besetzen",
        icon: "vorgaenge",
        title: "Vorgänge besetzen",
        text: missing[0].text,
        label: "Zu den Vorgängen",
        primary: true,
        dringend: true,
        onClick: () => setView("vorgaenge"),
      })
    } else if (!readOnly) {
      todos.push({
        key: "start",
        icon: "phase",
        title: "Planung abschliessen",
        text: warnings.length > 0 ? `${warnings.length} Empfehlungen offen; du kannst trotzdem starten.` : "Der Plan sieht gut aus.",
        label: "Planung abschliessen",
        primary: true,
        onClick: () => run({ type: "startPeriod" }),
      })
    }
    const review = warnings.filter((f) => f.text.endsWith("hat kein Review."))
    const other = warnings.filter((f) => !review.includes(f))
    if (other[0]) {
      todos.push({
        key: "warn",
        icon: other[0].view === "risiken" ? "risiko" : other[0].view === "team" ? "team" : "plan",
        title: "Plan prüfen",
        text: other[0].text,
        label: other[0].view === "risiken" ? "Risiken" : other[0].view === "team" ? "Team" : "Vorgänge",
        onClick: () => setView(other[0].view),
      })
    }
    if (review.length > 0) {
      todos.push({
        key: "review",
        icon: "qualitaet",
        title: "Reviews setzen",
        text: `${review.length} Vorgänge ohne Review.`,
        label: "Vorgänge",
        onClick: () => setView("vorgaenge"),
      })
    }
  }

  if (state.phase === "lauf") {
    const deferred = state.inbox.filter((i) => i.status === "aufgeschoben").sort((a, b) => (a.deadlineTick ?? 1e9) - (b.deadlineTick ?? 1e9))
    for (const item of deferred.slice(0, 1)) {
      const def = scenario.events.find((e) => e.id === item.eventId)
      if (!def) continue
      todos.push({
        key: `frist-${def.id}`,
        icon: "uhr",
        avatar: def.sender.name,
        title: def.title,
        text: `Von ${def.sender.name}, aufgeschoben, Frist ${deadlineText(item.deadlineTick)}.`,
        label: "Entscheiden",
        onClick: () => openEvent(def.id),
      })
    }
    const blocked = scenario.tasks.filter((t) => displayStatus(state, scenario, t.id) === "blockiert")
    if (blocked.length > 0) {
      todos.push({
        key: "blockiert",
        icon: "blockiert",
        title: `${blocked[0].id} ist blockiert`,
        text: `${blocked[0].name}: bereit, aber niemand arbeitet daran.`,
        label: "Besetzen",
        dringend: true,
        onClick: () => setView("vorgaenge"),
      })
    }
    const low = scenario.people
      .filter((p) => state.people[p.id]?.available && state.people[p.id].motivation < 85)
      .sort((a, b) => state.people[a.id].motivation - state.people[b.id].motivation)
    if (low[0] && !readOnly) {
      const p = low[0]
      todos.push({
        key: `gespraech-${p.id}`,
        icon: "motivation",
        avatar: p.name,
        title: `Gespräch mit ${p.name.split(" ")[0]}`,
        text: `Motivation ${Math.round(state.people[p.id].motivation)} %. Ein Gespräch kostet 1 Stunde.`,
        label: "Gespräch führen",
        onClick: () => run({ type: "talk", personId: p.id }),
      })
    }
    const idle = scenario.people.filter((p) => {
      const ps = state.people[p.id]
      if (!ps?.available || absentNow(state, p.id)) return false
      const load = personLoad(state, trace, scenario, p.id)
      return ps.assignments.every((a) => state.tasks[a.taskId].status === "fertig") || (load !== null && !load.planned && load.percent < 1)
    })
    if (idle[0]) {
      todos.push({
        key: `frei-${idle[0].id}`,
        icon: "auslastung",
        avatar: idle[0].name,
        title: `${idle[0].name.split(" ")[0]} hat nichts zu tun`,
        text: "Weise einen bearbeitbaren Vorgang zu oder ändere die Prioritäten.",
        label: "Team",
        onClick: () => setView("team"),
      })
    }
  }

  const shown = todos.slice(0, 3)
  return (
    <section className={`card ${styles.wasJetzt}`} aria-labelledby="was-jetzt">
      <h2 id="was-jetzt" className={styles.wasJetztTitel}>
        Was jetzt zu tun ist
      </h2>
      {shown.length === 0 ? (
        <p className={styles.allesGut}>
          <Icon name="fertig" size={20} /> Alles im Griff. Lass die Zeit laufen (▶ oder Leertaste) und behalte die Kennzahlen im Blick.
        </p>
      ) : (
        <ol className={styles.todoListe}>
          {shown.map((t) => (
            <li key={t.key} className={`${styles.todo} ${t.dringend ? styles.todoDringend : ""}`}>
              <span className={styles.todoBild}>
                {t.avatar ? (
                  <>
                    <Avatar name={t.avatar} role={roleOf(scenario, t.avatar)} size={44} decorative accessory={false} />
                    <span className={styles.todoSymbolKlein}>
                      <Icon name={t.icon} size={13} />
                    </span>
                  </>
                ) : (
                  <span className={styles.todoSymbol}>
                    <Icon name={t.icon} size={22} />
                  </span>
                )}
              </span>
              <span className={styles.todoText}>
                <strong>{t.title}</strong>
                {t.text && <span>{t.text}</span>}
              </span>
              <button type="button" className={`btn ${t.primary ? "primary" : ""}`} onClick={t.onClick}>
                {t.label}
              </button>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}

/** Waagrechte Leiste mit Bild, Motivation und Auslastung je Person; ein Klick öffnet das Team. */
function TeamLeiste() {
  const { scenario, state, trace, setView } = useLeitstand()
  // wie die Team-Ansicht: alle sichtbaren Personen, auch abwesende (mit Vermerk)
  const people = scenario.people.filter((p) => state.people[p.id] && (state.people[p.id].available || !p.hidden))
  return (
    <section className={`card ${styles.teamLeisteKarte}`} aria-labelledby="team-leiste">
      <div className={styles.zeileZwischen}>
        <h3 id="team-leiste" className={styles.titelMitSymbol}>
          <Icon name="team" size={18} /> Team
        </h3>
        <button type="button" className={`btn ${styles.klein}`} onClick={() => setView("team")}>
          Alle Karten
        </button>
      </div>
      <ul className={styles.teamLeiste}>
        {people.map((p) => {
          const ps = state.people[p.id]
          const load = personLoad(state, trace, scenario, p.id)
          const absent = absentNow(state, p.id)
          return (
            <li key={p.id}>
              <button
                type="button"
                className={`${styles.teamKopf} ${absent ? styles.abwesend : ""}`}
                onClick={() => setView("team")}
                aria-label={`${p.name}, ${p.role}. Motivation ${Math.round(ps.motivation)} Prozent${
                  load ? `, ${load.planned ? "verplant" : "Auslastung"} ${Math.round(load.percent)} Prozent` : ""
                }${absent ? `, abwesend: ${absent}` : ""}`}
              >
                <Avatar name={p.name} size={48} decorative accessory={false} />
                <span className={styles.teamName}>{p.name.split(" ")[0]}</span>
                <MotivationBalken value={ps.motivation} klein />
                {load && <LastBalken percent={load.percent} planned={load.planned} klein />}
                {absent && <span className={styles.abwesendText}>abwesend</span>}
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
