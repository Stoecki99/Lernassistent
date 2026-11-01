// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

"use client"

// components/features/leitstand/LeitstandApp.tsx
// Lauf-Ansicht (4.8): lädt den Lauf, spielt das Protokoll im Browser nach, hält den Zustand,
// Zeitraffer (Pause · 1× = 8 s je Halbtag · 2× · 4×), Tastaturkürzel, Hinweise, Synchronisation (useRunSync).
// Der Rechenkern kennt keine Echtzeit: Jeder Takt ist eine Aktion «advance 1» im Protokoll.

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  ENGINE_VERSION,
  SimError,
  applyAction,
  computeKpis,
  evaluateCondition,
  halfOf,
  dayOf,
  type Action,
  type HintDef,
  type Scenario,
  type SimState,
} from "@/lib/simulation/core"
import { MAX_ACTIONS_PER_RUN } from "@/lib/validations/simulation"
import styles from "@/app/(leitstand)/leitstand.module.css"
import { ApiError, leitstandApi, type FinishResponse, type RunDetail } from "./api"
import { loadClientScenario } from "./scenarioLoader"
import { readPendingBackup, useRunSync } from "./useRunSync"
import { LeitstandContext, useLeitstand, type LeitstandCtx, type ViewKey } from "./context"
import { baselineRows, recordTrace, replayTraced, type Trace } from "./logic"
import { CHANNEL_TEXT } from "./format"
import KopfLeiste, { TICK_MS, type Speed } from "./KopfLeiste"
import Kennzahlen from "./Kennzahlen"
import Hinweis from "./Hinweis"
import Dialog from "./Dialog"
import EntscheidDialog from "./EntscheidDialog"
import Auftrag from "./Auftrag"
import Uebersicht from "./Uebersicht"
import Vorgaenge from "./Vorgaenge"
import Team from "./Team"
import PlanAnsicht from "./PlanAnsicht"
import Auslastung from "./Auslastung"
import Kalender from "./Kalender"
import Posteingang from "./Posteingang"
import Risikoregister from "./Risikoregister"
import BudgetAnsicht from "./BudgetAnsicht"
import Statusbericht, { GemeinderatAntwort } from "./Statusbericht"
import Nachbesprechung from "./Nachbesprechung"

type Load =
  | { kind: "laden" }
  | { kind: "fehler"; message: string }
  | { kind: "veraltet" }
  | { kind: "bereit"; detail: RunDetail; scenario: Scenario; state: SimState; trace: Trace; pending: Action[] }

export default function LeitstandApp({ runId }: { runId: string }) {
  const [load, setLoad] = useState<Load>({ kind: "laden" })
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const detail = await leitstandApi.getRun(runId)
        const scenario = await loadClientScenario(detail.scenarioId)
        if (!scenario) throw new Error("Unbekanntes Szenario")
        if (detail.status === "veraltet" || detail.scenarioVersion !== scenario.version || detail.engineVersion !== ENGINE_VERSION) {
          if (!cancelled) setLoad({ kind: "veraltet" })
          return
        }
        let pending = detail.status === "aktiv" ? readPendingBackup(runId, detail.actions.length) : []
        let replayed: { state: SimState; trace: Trace }
        try {
          replayed = replayTraced(scenario, detail.seed, [...detail.actions, ...pending])
        } catch {
          // Sicherung passt nicht (mehr): nur das gespeicherte Protokoll nachspielen
          pending = []
          replayed = replayTraced(scenario, detail.seed, detail.actions)
        }
        if (!cancelled) setLoad({ kind: "bereit", detail, scenario, state: replayed.state, trace: replayed.trace, pending })
      } catch (error) {
        console.error("[leitstand]", error)
        const message =
          error instanceof ApiError && error.status === 404
            ? "Diesen Lauf gibt es nicht."
            : error instanceof ApiError && error.status === 403
              ? "Der Leitstand ist im Pro-Plan enthalten."
              : "Der Lauf konnte nicht geladen werden. Bitte später erneut versuchen."
        if (!cancelled) setLoad({ kind: "fehler", message })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [runId, reloadKey])

  const reload = useCallback(() => {
    setLoad({ kind: "laden" })
    setReloadKey((k) => k + 1)
  }, [])

  if (load.kind === "laden") {
    return (
      <div className={`card ${styles.laden}`} role="status">
        Lauf wird geladen und nachgespielt …
      </div>
    )
  }
  if (load.kind === "fehler" || load.kind === "veraltet") {
    return (
      <div className="card stack" role="alert">
        <h2>{load.kind === "veraltet" ? "Lauf veraltet" : "Fehler"}</h2>
        <p>
          {load.kind === "veraltet"
            ? "Dieser Lauf wurde mit einer älteren Fassung des Leitstands gespielt und lässt sich nicht mehr fortsetzen. Starte einen neuen Lauf."
            : load.message}
        </p>
        <p>
          <a className="btn primary" href="/leitstand">
            Zur Startseite des Leitstands
          </a>
        </p>
      </div>
    )
  }
  return (
    <Spiel
      key={reloadKey}
      detail={load.detail}
      scenario={load.scenario}
      initial={load.state}
      initialTrace={load.trace}
      pending={load.pending}
      onReload={reload}
    />
  )
}

// ---------- Hinweise (nur Einführungslauf) ----------

const HINTS_OFF_KEY = "leitstand-hinweise-aus"
const SHORTCUTS_OFF_KEY = "leitstand-kuerzel-aus"
/** Anzeigedauer einer Meldung; pausiert, solange Maus oder Fokus darauf liegen */
const TOAST_MS = 10_000

function readList(key: string): string[] {
  try {
    const raw = window.localStorage.getItem(key)
    const parsed: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : []
  } catch {
    return []
  }
}

function writeList(key: string, list: string[]): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(list))
  } catch {
    // ohne Speicher gilt die Wahl bis zum Neuladen
  }
}

function readFlag(key: string): boolean {
  try {
    return window.localStorage.getItem(key) === "1"
  } catch {
    return false
  }
}

function initialView(state: SimState, actionCount: number): ViewKey {
  if (state.phase === "abgeschlossen") return "nachbesprechung"
  if (state.phase === "periodenende" || state.phase === "abschlussbericht") return "bericht"
  if (actionCount === 0) return "auftrag"
  if (state.phase === "planung") return "vorgaenge"
  return "uebersicht"
}

const VIEWS: Array<[ViewKey, string]> = [
  ["auftrag", "Auftrag"],
  ["uebersicht", "Übersicht"],
  ["vorgaenge", "Vorgänge"],
  ["team", "Team"],
  ["plan", "Plan"],
  ["auslastung", "Auslastung"],
  ["kalender", "Kalender"],
  ["posteingang", "Posteingang"],
  ["risiken", "Risiken"],
  ["budget", "Budget"],
  ["bericht", "Bericht"],
  ["nachbesprechung", "Nachbesprechung"],
]

const itemKey = (i: { eventId: string; arrivedTick: number }) => `${i.eventId}@${i.arrivedTick}`

function Spiel({
  detail,
  scenario,
  initial,
  initialTrace,
  pending,
  onReload,
}: {
  detail: RunDetail
  scenario: Scenario
  initial: SimState
  initialTrace: Trace
  pending: Action[]
  onReload: () => void
}) {
  const readOnly = detail.status !== "aktiv"
  const [state, setState] = useState<SimState>(initial)
  const stateRef = useRef<SimState>(initial)
  const traceRef = useRef<Trace>(initialTrace)
  const [view, setViewRaw] = useState<ViewKey>(() => initialView(initial, detail.actions.length + pending.length))
  const [speed, setSpeedRaw] = useState<Speed>(0)
  const [dialog, setDialog] = useState<{ eventId: string; arrivedTick: number } | null>(null)
  const [toast, setToast] = useState<{ text: string; id: number } | null>(null)
  const [polite, setPolite] = useState("")
  const [assertive, setAssertive] = useState("")
  const [gemeinderat, setGemeinderat] = useState(false)
  const [finish, setFinish] = useState<FinishResponse | null>(null)
  const [finishError, setFinishError] = useState<string | null>(null)
  const [best, setBest] = useState<number | null>(null)
  const [hintsOff, setHintsOff] = useState<boolean>(() => readFlag(HINTS_OFF_KEY))
  const [shortcutsOff, setShortcutsOff] = useState<boolean>(() => readFlag(SHORTCUTS_OFF_KEY))
  /** Anmeldung abgelaufen: keine weiteren Aktionen, bis neu angemeldet (die Sicherung im Browser bleibt) */
  const [authExpired, setAuthExpired] = useState(false)
  const dismissKey = `leitstand-hinweise-${detail.id}`
  const [dismissed, setDismissed] = useState<string[]>(() => readList(dismissKey))
  const [fired, setFired] = useState<string[]>([])
  const navRef = useRef<HTMLElement>(null)
  const finishStarted = useRef(false)

  // Meldungen sichtbar unten und zugleich über die bestehende polite-Region angesagt
  const notify = useCallback((text: string) => {
    setToast({ text, id: Date.now() })
    setPolite(text)
  }, [])

  const sync = useRunSync({
    api: leitstandApi,
    runId: detail.id,
    initialCount: detail.actions.length,
    initialPending: pending,
    enabled: !readOnly,
    onConflict: (message) => {
      notify(`${message} Der Lauf wird neu geladen.`)
      window.setTimeout(onReload, 1800)
    },
    onRejected: (message) => {
      notify(`Der Server hat eine Aktion abgelehnt: ${message} Der Lauf wird neu geladen.`)
      window.setTimeout(onReload, 2500)
    },
    onAuthExpired: () => {
      setAuthExpired(true)
      setSpeedRaw(0)
      notify("Anmeldung abgelaufen. Melde dich neu an; deine letzten Aktionen bleiben in diesem Browser gesichert.")
    },
  })
  const { push, flush, total } = sync

  const kpis = useMemo(() => computeKpis(state, scenario), [state, scenario])
  const base = useMemo(() => baselineRows(scenario), [scenario])

  const run = useCallback(
    (action: Action): SimState | null => {
      if (readOnly) {
        notify("Dieser Lauf lässt sich nicht mehr ändern.")
        return null
      }
      if (authExpired) {
        notify("Anmeldung abgelaufen. Melde dich neu an, um weiterzuspielen.")
        return null
      }
      // Der Server nimmt höchstens MAX_ACTIONS_PER_RUN an; ohne diese Sperre folgte 422 und Neuladen in Schlaufe
      if (total() >= MAX_ACTIONS_PER_RUN) {
        notify(`Höchstzahl von ${MAX_ACTIONS_PER_RUN} Aktionen erreicht. Dieser Lauf lässt sich nicht weiter ändern.`)
        setSpeedRaw(0)
        return null
      }
      try {
        const next = applyAction(stateRef.current, action, scenario)
        stateRef.current = next
        recordTrace(traceRef.current, next)
        setState(next)
        push(action)
        return next
      } catch (error) {
        if (error instanceof SimError) {
          notify(error.message)
          return null
        }
        console.error("[leitstand]", error)
        notify("Unerwarteter Fehler im Rechenkern.")
        return null
      }
    },
    [readOnly, authExpired, scenario, push, notify, total]
  )

  // ---------- Hinweise ----------
  const hints: HintDef[] = useMemo(() => scenario.hints ?? [], [scenario])
  const fire = useCallback(
    (match: (h: HintDef) => boolean) => {
      const ids = hints.filter(match).map((h) => h.id)
      if (ids.length === 0) return
      setFired((f) => (ids.every((id) => f.includes(id)) ? f : [...f, ...ids.filter((id) => !f.includes(id))]))
    },
    [hints]
  )
  const fireUi = useCallback((ui: string) => fire((h) => "ui" in h.when && h.when.ui === ui), [fire])

  const setView = useCallback(
    (v: ViewKey) => {
      setViewRaw(v)
      fire((h) => "ui" in h.when && h.when.ui === "viewOpened" && h.when.view === v)
    },
    [fire]
  )

  useEffect(() => {
    fire((h) => "ui" in h.when && h.when.ui === "viewOpened" && h.when.view === view)
    // nur beim ersten Anzeigen
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Hinweise mit Zustandsbedingung
  useEffect(() => {
    if (state.phase !== "lauf") return
    fire((h) => "state" in h.when && evaluateCondition(state, scenario, h.when.state))
  }, [state, scenario, fire])

  const activeHint = hintsOff || state.phase === "abgeschlossen" ? undefined : hints.find((h) => fired.includes(h.id) && !dismissed.includes(h.id))

  // ---------- Zeitraffer ----------
  const hasNew = state.inbox.some((i) => i.status === "neu")
  const running = !readOnly && !authExpired && state.phase === "lauf" && speed > 0 && !hasNew && dialog === null && !gemeinderat

  const setSpeed = useCallback(
    (s: Speed) => {
      setSpeedRaw(s)
      if (s === 0) void flush()
    },
    [flush]
  )

  useEffect(() => {
    if (!running || speed === 0) return
    const id = window.setTimeout(() => {
      run({ type: "advance", ticks: 1 })
    }, TICK_MS[speed])
    return () => window.clearTimeout(id)
  }, [running, speed, state.tick, run])

  // ---------- Übergänge ----------
  const prevRef = useRef<SimState>(initial)
  useEffect(() => {
    const prev = prevRef.current
    prevRef.current = state
    if (prev === state) return

    if (state.pause && state.pause !== prev.pause) void flush()

    if (state.phase !== prev.phase) {
      void flush()
      if (state.phase !== "lauf") setSpeedRaw(0)
      if (prev.phase === "planung" && state.phase === "lauf") {
        fireUi("planningDone")
        setViewRaw("uebersicht")
        notify("Planung abgeschlossen. Starte die Zeit mit der Leertaste oder ▶.")
      }
      if (state.phase === "periodenende") {
        setView("bericht")
        notify("Periodenende: Der Statusbericht an den Gemeinderat ist fällig.")
      }
      if (state.phase === "abschlussbericht") {
        setView("bericht")
        fireUi("finalReport")
        notify(state.pause === "abbruch" ? `Tag ${scenario.calendar.hardStopTick / 2}: Die Zeit ist um, der Lauf wird abgebrochen. Schreibe den Abschlussbericht.` : "Projektende! Schreibe den Abschlussbericht.")
      }
      if (prev.phase === "periodenende" && state.phase === "planung") setGemeinderat(true)
      if (state.phase === "abgeschlossen") setView("nachbesprechung")
    }

    const before = new Set(prev.inbox.map(itemKey))
    const fresh = state.inbox.filter((i) => i.status === "neu" && !before.has(itemKey(i)))
    if (fresh.length > 0) {
      fireUi("firstEvent")
      const first = fresh[0]
      setDialog({ eventId: first.eventId, arrivedTick: first.arrivedTick })
      const def = scenario.events.find((e) => e.id === first.eventId)
      if (def && (def.channel === "anruf" || def.channel === "besuch")) {
        setAssertive(`${CHANNEL_TEXT[def.channel]} von ${def.sender.name}: ${def.title}`)
      }
    }

    if (dayOf(state.tick) !== dayOf(prev.tick) && state.history.length > 0) {
      const last = state.history[state.history.length - 1]
      setPolite(`Tag ${dayOf(state.tick) + 1}, ${halfOf(state.tick) === 0 ? "Vormittag" : "Nachmittag"}. SPI ${last.spi.toFixed(2)}.`)
    }

    const assigned = (s: SimState) => Object.values(s.people).some((p) => p.assignments.length > 0)
    if (!assigned(prev) && assigned(state)) fireUi("firstAssignment")
    if (state.decisions.length > prev.decisions.length) fireUi("firstFeedback")
  }, [state, scenario, flush, fireUi, setView, notify])

  // Neue Ereignisse beim Laden gleich anzeigen
  useEffect(() => {
    const first = initial.inbox.find((i) => i.status === "neu")
    if (first && !readOnly) setDialog({ eventId: first.eventId, arrivedTick: first.arrivedTick })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ---------- Abschluss ----------
  const doFinish = useCallback(async () => {
    if (finishStarted.current) return
    finishStarted.current = true
    const ok = await flush()
    if (!ok) {
      setFinishError("Der Lauf ist noch nicht vollständig gespeichert. Lade die Seite neu, um das Ergebnis zu sichern.")
      finishStarted.current = false
      return
    }
    try {
      setFinish(await leitstandApi.finishRun(detail.id))
    } catch (error) {
      console.error("[leitstand]", error)
      setFinishError(error instanceof ApiError ? error.message : "Das Ergebnis konnte nicht gespeichert werden.")
      finishStarted.current = false
    }
  }, [flush, detail.id])

  useEffect(() => {
    if (state.phase === "abgeschlossen" && detail.status !== "abgebrochen") void doFinish()
  }, [state.phase, detail.status, doFinish])

  useEffect(() => {
    let cancelled = false
    leitstandApi
      .listRuns(scenario.id)
      .then((res) => {
        if (!cancelled) setBest(res.best && res.best.runId !== detail.id ? res.best.score : null)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [scenario.id, detail.id])

  // ---------- Tastatur ----------
  // Einzeltasten-Kürzel nur, wenn der Fokus im Leitstand liegt (Handler am Container), nicht in Eingabefeldern
  // und nicht bei offenem Dialog; abschaltbar mit «Tastenkürzel aus» (WCAG 2.1.4).
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (shortcutsOff || dialog || gemeinderat || e.ctrlKey || e.metaKey || e.altKey || e.defaultPrevented) return
      const target = e.target as HTMLElement | null
      if (target?.closest("input, textarea, select, [contenteditable='true'], [role='dialog']")) return
      if (e.key === " " || e.code === "Space") {
        // Auf Knöpfen und Links bleibt die Leertaste deren eigene Bedienung
        if (target?.closest("button, a, summary, [role='button']")) return
        if (stateRef.current.phase !== "lauf") return
        e.preventDefault()
        setSpeed(speed === 0 ? 1 : 0)
      } else if (e.key === "1" || e.key === "2" || e.key === "4") {
        if (stateRef.current.phase !== "lauf") return
        setSpeed(Number(e.key) as Speed)
      } else if (e.key === "p" || e.key === "P") {
        setView("posteingang")
      }
    },
    [shortcutsOff, dialog, gemeinderat, speed, setSpeed, setView]
  )

  // Aktive Ansicht in der Chip-Leiste sichtbar halten
  useEffect(() => {
    navRef.current?.querySelector<HTMLElement>("[aria-current='page']")?.scrollIntoView({ block: "nearest", inline: "nearest" })
  }, [view])

  const openEvent = useCallback(
    (eventId: string) => {
      const item =
        stateRef.current.inbox.find((i) => i.eventId === eventId && (i.status === "neu" || i.status === "aufgeschoben")) ??
        [...stateRef.current.inbox].reverse().find((i) => i.eventId === eventId)
      if (item) setDialog({ eventId, arrivedTick: item.arrivedTick })
    },
    []
  )

  // traceRef wird in run() vor setState fortgeschrieben; state als Abhängigkeit deckt das ab
  const ctx = useMemo<LeitstandCtx>(
    () => ({
      scenario,
      state,
      kpis,
      trace: traceRef.current,
      base,
      run,
      view,
      setView,
      openEvent,
      notify,
      readOnly,
    }),
    [scenario, state, kpis, base, run, view, setView, openEvent, notify, readOnly]
  )

  const openCount = state.inbox.filter((i) => i.status === "neu" || i.status === "aufgeschoben").length
  const firstNew = state.inbox.find((i) => i.status === "neu")
  const lastBoard = [...state.reports].reverse().find((r) => r.board)

  return (
    <LeitstandContext.Provider value={ctx}>
      <div className={styles.spiel} onKeyDown={onKeyDown}>
        <div className={styles.titelZeile}>
          <h1 className={styles.titel}>
            <span className={styles.titelMarke}>Leitstand</span> {scenario.title}
          </h1>
          {scenario.kind === "intro" && hints.length > 0 && (
            <button
              type="button"
              className={`btn ${styles.klein}`}
              aria-pressed={!hintsOff}
              onClick={() => {
                const next = !hintsOff
                setHintsOff(next)
                try {
                  window.localStorage.setItem(HINTS_OFF_KEY, next ? "1" : "0")
                } catch {
                  // ohne Speicher gilt die Wahl bis zum Neuladen
                }
              }}
            >
              Hinweise {hintsOff ? "aus" : "an"}
            </button>
          )}
          <button
            type="button"
            className={`btn ${styles.klein}`}
            aria-pressed={!shortcutsOff}
            title="Leertaste: Zeit starten/anhalten · 1, 2, 4: Tempo · P: Posteingang"
            onClick={() => {
              const next = !shortcutsOff
              setShortcutsOff(next)
              try {
                window.localStorage.setItem(SHORTCUTS_OFF_KEY, next ? "1" : "0")
              } catch {
                // ohne Speicher gilt die Wahl bis zum Neuladen
              }
            }}
          >
            Tastenkürzel {shortcutsOff ? "aus" : "an"}
          </button>
        </div>
        <div className="sr-only" aria-live="polite">
          {polite}
        </div>
        <div className="sr-only" aria-live="assertive">
          {assertive}
        </div>

        <KopfLeiste
          speed={speed}
          setSpeed={setSpeed}
          running={running}
          blockedByEvent={hasNew}
          syncStatus={sync.status}
          shortcuts={!shortcutsOff}
        />

        {authExpired && (
          <p className={`note ${styles.lage} ${styles.lageWarn}`}>
            Anmeldung abgelaufen: Deine letzten Aktionen sind nur in diesem Browser gesichert.{" "}
            <a href="/login" target="_blank" rel="noopener">
              Neu anmelden (neuer Tab)
            </a>{" "}
            und diese Seite danach neu laden: Der Lauf geht am gleichen Takt weiter.
          </p>
        )}

        {readOnly && state.phase !== "abgeschlossen" && (
          <p className={`note ${styles.lage}`}>Dieser Lauf ist {detail.status} und lässt sich nur ansehen.</p>
        )}

        <Lage hasNew={Boolean(firstNew)} onOpenNew={() => firstNew && setDialog({ eventId: firstNew.eventId, arrivedTick: firstNew.arrivedTick })} />

        <Kennzahlen />

        <Hinweis
          hint={activeHint ?? null}
          coach={scenario.coach.name}
          onClose={() => {
            if (!activeHint) return
            const next = [...dismissed, activeHint.id]
            setDismissed(next)
            writeList(dismissKey, next)
          }}
            onAllOff={() => {
              setHintsOff(true)
              try {
                window.localStorage.setItem(HINTS_OFF_KEY, "1")
              } catch {
                // ohne Speicher gilt die Wahl bis zum Neuladen
              }
            }}
          />

        <nav ref={navRef} className={styles.ansichten} aria-label="Ansichten">
          {VIEWS.filter(([key]) => key !== "nachbesprechung" || state.phase === "abgeschlossen").map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={`${styles.chip} ${view === key ? styles.chipAktiv : ""}`}
              aria-current={view === key ? "page" : undefined}
              onClick={() => setView(key)}
            >
              {label}
              {key === "posteingang" && openCount > 0 ? <b className={styles.chipZahl}> {openCount}</b> : null}
            </button>
          ))}
        </nav>

        <div className={styles.inhalt} aria-label={VIEWS.find(([k]) => k === view)?.[1]} role="region">
          {view === "auftrag" && <Auftrag />}
          {view === "uebersicht" && <Uebersicht />}
          {view === "vorgaenge" && <Vorgaenge />}
          {view === "team" && <Team />}
          {view === "plan" && <PlanAnsicht />}
          {view === "auslastung" && <Auslastung />}
          {view === "kalender" && <Kalender />}
          {view === "posteingang" && <Posteingang />}
          {view === "risiken" && <Risikoregister />}
          {view === "budget" && <BudgetAnsicht />}
          {view === "bericht" && <Statusbericht />}
          {view === "nachbesprechung" && <Nachbesprechung finish={finish} finishError={finishError} best={best} />}
        </div>

        {dialog && (
          <EntscheidDialog
            key={`${dialog.eventId}@${dialog.arrivedTick}`}
            eventId={dialog.eventId}
            arrivedTick={dialog.arrivedTick}
            onClose={() => setDialog(null)}
            onDecided={() => undefined}
          />
        )}

        {gemeinderat && lastBoard?.board && (
          <Dialog title="Der Gemeinderat hat entschieden" kicker="Sitzung nach dem Statusbericht" onEscape={() => setGemeinderat(false)}>
            <p>Ehrlichkeit deines Berichts: {Math.round(lastBoard.honesty)} von 100.</p>
            <GemeinderatAntwort board={lastBoard.board} />
            {lastBoard.findings.length > 0 && (
              <ul className={styles.liste}>
                {lastBoard.findings.map((f, i) => (
                  <li key={i}>{f}</li>
                ))}
              </ul>
            )}
            <div className={styles.dialogKnoepfe}>
              <button
                type="button"
                className="btn primary"
                onClick={() => {
                  setGemeinderat(false)
                  setView("vorgaenge")
                }}
              >
                Periode 2 planen
              </button>
            </div>
          </Dialog>
        )}

        {toast && <Meldung key={toast.id} text={toast.text} onClose={() => setToast(null)} />}
      </div>
    </LeitstandContext.Provider>
  )
}

/**
 * Sichtbare Meldung unten (die Ansage läuft über die polite-Region der Lauf-Ansicht).
 * Blendet nach TOAST_MS aus; Maus darüber oder Fokus darin hält den Zeitgeber an (WCAG 2.2.1).
 */
function Meldung({ text, onClose }: { text: string; onClose: () => void }) {
  const [paused, setPaused] = useState({ hover: false, focus: false })
  const remainingRef = useRef(TOAST_MS)
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  const isPaused = paused.hover || paused.focus

  useEffect(() => {
    if (isPaused) return
    const started = Date.now()
    const id = window.setTimeout(() => closeRef.current(), remainingRef.current)
    return () => {
      window.clearTimeout(id)
      remainingRef.current = Math.max(1000, remainingRef.current - (Date.now() - started))
    }
  }, [isPaused])

  return (
    <div
      className={styles.meldung}
      onMouseEnter={() => setPaused((p) => ({ ...p, hover: true }))}
      onMouseLeave={() => setPaused((p) => ({ ...p, hover: false }))}
      onFocus={() => setPaused((p) => ({ ...p, focus: true }))}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setPaused((p) => ({ ...p, focus: false }))
      }}
    >
      <span>{text}</span>
      <button type="button" className={`btn ${styles.klein}`} onClick={onClose} aria-label="Meldung schliessen">
        ✕
      </button>
    </div>
  )
}

/** Lagebalken: was jetzt zu tun ist (Phase, angehaltene Zeit). */
function Lage({ hasNew, onOpenNew }: { hasNew: boolean; onOpenNew: () => void }) {
  const { state, scenario, setView, readOnly } = useLeitstand()
  if (readOnly && state.phase !== "abgeschlossen") return null
  if (state.phase === "lauf" && hasNew) {
    return (
      <div className={`${styles.lage} ${styles.lageWarn}`}>
        <span>▲ Die Zeit steht still: Ein neues Ereignis wartet auf deinen Entscheid.</span>
        <button type="button" className="btn primary" onClick={onOpenNew}>
          Ereignis öffnen
        </button>
      </div>
    )
  }
  if (state.phase === "planung") {
    return (
      <div className={styles.lage}>
        <span>
          Planung {scenario.calendar.periods[state.period]?.label}: Besetze jeden Vorgang, setze Reviews und Risikomassnahmen, dann «Planung
          abschliessen».
        </span>
        <button type="button" className="btn" onClick={() => setView("vorgaenge")}>
          Zu den Vorgängen
        </button>
      </div>
    )
  }
  if (state.phase === "periodenende" || state.phase === "abschlussbericht") {
    return (
      <div className={`${styles.lage} ${styles.lageWarn}`}>
        <span>{state.phase === "periodenende" ? "Periodenende: Der Statusbericht ist fällig." : "Projektende: Der Abschlussbericht ist fällig."}</span>
        <button type="button" className="btn primary" onClick={() => setView("bericht")}>
          Bericht schreiben
        </button>
      </div>
    )
  }
  if (state.phase === "abgeschlossen") {
    return (
      <div className={styles.lage}>
        <span>● Lauf abgeschlossen.</span>
        <button type="button" className="btn primary" onClick={() => setView("nachbesprechung")}>
          Zur Nachbesprechung
        </button>
      </div>
    )
  }
  return null
}

