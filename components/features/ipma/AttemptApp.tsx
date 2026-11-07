// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

"use client"

// components/features/ipma/AttemptApp.tsx
// Versuchsansicht /ipma/[attemptId] (Spezifikation 3.2–3.5, 6.8 ExamApp): lädt die AttemptView, hält die
// Antworten, speichert automatisch (useItemSync), zeigt Uhr, Fragennavigation, Markieren, Übersicht und
// Abgabe mit Rückfrage. Im Training und in «Lücken schliessen» mit «Prüfen» und sofortiger Rückmeldung.
// Lösungen kommen nur vom Server (SolvedItem) und erst nach Abgabe bzw. «Prüfen» dieser einen Frage.
// Einzeltasten-Kürzel (W, Z, M, U) wie im Leitstand: nur ausserhalb von Eingabefeldern, abschaltbar (WCAG 2.1.4).

import type { AttemptView, ClientItem, SolvedItem } from "@/lib/ipma/types"
import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import styles from "@/app/(ipma)/ipma.module.css"
import Dialog from "@/components/features/leitstand/Dialog"
import { ipmaApi, IpmaApiError, errorMessage, finishStorageKey, storeSession } from "./api"
import AiAssessment from "./AiAssessment"
import ExamClock, { type ClockBase } from "./ExamClock"
import FeedbackPanel from "./FeedbackPanel"
import { EXAM_MINUTES, MODE_LABEL, PART_MINUTES, VARIANT_LABEL, isAnswered, isSolved } from "./format"
import QuestionOverview from "./QuestionOverview"
import QuestionView from "./QuestionView"
import SelfAssessment from "./SelfAssessment"
import { clearBackup, readBackup, useItemSync, type SyncState } from "./useItemSync"

type Item = ClientItem | SolvedItem
type DialogKind = "overview" | "submit" | "finish" | null

const SHORTCUTS_OFF_KEY = "ipma-kuerzel-aus"

const SYNC_TEXT: Record<SyncState, string> = {
  saved: "✓ gespeichert",
  pending: "… wird gleich gespeichert",
  saving: "… wird gespeichert",
  retry: "■ Speicherfehler, neuer Versuch folgt",
  offline: "■ offline, Antworten lokal gesichert",
  auth: "■ Anmeldung abgelaufen, Antworten lokal gesichert",
  error: "■ Speicherfehler",
}

function readFlag(key: string): boolean {
  try {
    return window.localStorage.getItem(key) === "1"
  } catch {
    return false
  }
}

export default function AttemptApp({ attemptId }: { attemptId: string }) {
  const router = useRouter()
  const [view, setView] = useState<AttemptView | null>(null)
  const [items, setItems] = useState<Item[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [index, setIndex] = useState(0)
  const [clockBase, setClockBase] = useState<ClockBase | null>(null)
  const [dialog, setDialog] = useState<DialogKind>(null)
  const [polite, setPolite] = useState("")
  const [assertive, setAssertive] = useState("")
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [timeUp, setTimeUp] = useState(false)
  const [shortcutsOff, setShortcutsOff] = useState(false)
  // Laufende Claude-Bewertungen: solange eine läuft, bleibt «Abschliessen» gesperrt
  const [aiRunning, setAiRunning] = useState(0)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const focusHeading = useRef(false)
  const feedbackRef = useRef<HTMLHeadingElement>(null)
  const focusFeedback = useRef(false)
  const pauseRef = useRef<HTMLButtonElement>(null)
  const focusPause = useRef(false)
  const viewRef = useRef<AttemptView | null>(null)
  viewRef.current = view

  const announce = useCallback((text: string) => {
    // Gleicher Text zweimal hintereinander: kurz leeren, damit er erneut angesagt wird
    setPolite("")
    setTimeout(() => setPolite(text), 50)
  }, [])

  const goToResult = useCallback(
    (suffix = "") => {
      router.replace(`/ipma/${attemptId}/auswertung${suffix}`)
    },
    [router, attemptId],
  )

  const apply = useCallback(
    (v: AttemptView, restore: (list: Item[]) => Item[]) => {
      const exam = v.mode === "exam" || v.mode === "short"
      if ((exam && (v.status === "submitted" || v.status === "finished")) || (!exam && v.status === "finished")) {
        clearBackup(attemptId)
        goToResult()
        return
      }
      setView(v)
      setItems(v.status === "active" ? restore(v.items) : v.items)
      const offset = Date.parse(v.serverNow) - Date.now()
      setClockBase({
        deadlineClientMs: v.deadlineAt ? Date.parse(v.deadlineAt) - offset : null,
        activeSeconds: v.activeSeconds,
        baseAtMs: Date.now(),
        paused: v.paused,
        limitSeconds: EXAM_MINUTES * 60,
      })
    },
    [attemptId, goToResult],
  )

  const reload = useCallback(async () => {
    try {
      const v = await ipmaApi.get(attemptId)
      apply(v, (list) => list)
    } catch (e) {
      setLoadError(errorMessage(e, "Der Versuch konnte nicht geladen werden. Bitte die Seite neu laden."))
    }
  }, [attemptId, apply])

  const onFatal = useCallback(
    (error: IpmaApiError) => {
      if (error.code === "TIME_UP") setAssertive("Die Zeit ist abgelaufen. Die Prüfung wird abgegeben.")
      void reload()
    },
    [reload],
  )
  const sync = useItemSync(attemptId, true, onFatal)
  const syncRef = useRef(sync)
  syncRef.current = sync

  // Erstes Laden: Sicherung aus dem localStorage über die Serverdaten legen und erneut senden
  useEffect(() => {
    setShortcutsOff(readFlag(SHORTCUTS_OFF_KEY))
    let cancelled = false
    ipmaApi
      .get(attemptId)
      .then((v) => {
        if (cancelled) return
        const backup = readBackup(attemptId)
        apply(v, (list) =>
          list.map((item) => {
            const patch = backup.get(item.position)
            if (!patch || item.locked) return item
            const next = { ...item }
            if (patch.choice !== undefined && item.type === "mc") next.choice = patch.choice
            if (patch.text !== undefined && item.type === "offen") next.text = patch.text
            if (patch.flagged !== undefined) next.flagged = patch.flagged
            syncRef.current.queue(item.position, patch)
            return next
          }),
        )
        // Erste unbeantwortete Frage zeigen
        const first = v.items.findIndex((i) => !isAnswered(i) && !isSolved(i))
        if (first > 0) setIndex(first)
      })
      .catch((e: unknown) => {
        if (cancelled) return
        if (!(e instanceof IpmaApiError) || e.status >= 500) console.error("[ipma]", e)
        setLoadError(
          e instanceof IpmaApiError && e.status === 404
            ? "Diesen Versuch gibt es nicht."
            : errorMessage(e, "Der Versuch konnte nicht geladen werden. Bitte die Seite neu laden."),
        )
      })
    return () => {
      cancelled = true
    }
  }, [attemptId, apply])

  // Nach einem Fragenwechsel Fokus auf die Überschrift der Frage (6.8 Tastatur)
  useEffect(() => {
    if (!focusHeading.current) return
    focusHeading.current = false
    headingRef.current?.focus()
  }, [index])

  // Nach «Prüfen»/«Lösung zeigen» verschwindet der Knopf: Fokus auf den Titel der Rückmeldung
  useEffect(() => {
    if (!focusFeedback.current) return
    focusFeedback.current = false
    feedbackRef.current?.focus()
  }, [items])

  const onAiRunning = useCallback((running: boolean) => {
    setAiRunning((n) => Math.max(0, n + (running ? 1 : -1)))
  }, [])

  const exam = view ? view.mode === "exam" || view.mode === "short" : false
  const training = !exam
  const item = items[index] as Item | undefined
  const paused = clockBase?.paused ?? false

  // Nach «Weiter» verschwindet die Decke mit ihrem Knopf: Fokus zurück auf den Pause-Knopf im Kopf
  useEffect(() => {
    if (!focusPause.current || paused) return
    focusPause.current = false
    pauseRef.current?.focus()
  }, [paused])

  const go = useCallback(
    (next: number) => {
      if (next < 0 || next >= items.length) return
      void syncRef.current.flush()
      focusHeading.current = true
      setIndex(next)
      setDialog(null)
    },
    [items.length],
  )

  const update = useCallback((position: number, change: Partial<Pick<ClientItem, "choice" | "text" | "flagged">>) => {
    setItems((list) => list.map((i) => (i.position === position ? { ...i, ...change } : i)))
  }, [])

  const replaceItem = useCallback((next: SolvedItem) => {
    setItems((list) => list.map((i) => (i.position === next.position ? next : i)))
  }, [])

  function toggleFlag() {
    if (!item || item.locked) return
    const flagged = !item.flagged
    update(item.position, { flagged })
    sync.queue(item.position, { flagged })
    announce(flagged ? `Frage ${item.position} markiert.` : `Markierung von Frage ${item.position} entfernt.`)
  }

  async function togglePause() {
    if (!view || busy) return
    setBusy(true)
    setActionError(null)
    try {
      if (!paused) await sync.flush()
      const res = await ipmaApi.pause(attemptId, !paused)
      if (!res.paused) focusPause.current = true
      setClockBase((b) => (b ? { ...b, activeSeconds: res.activeSeconds, baseAtMs: Date.now(), paused: res.paused } : b))
      announce(res.paused ? "Pause. Die Fragen sind verdeckt, die Zeit steht." : "Weiter. Die Zeit läuft.")
    } catch (e) {
      setActionError(errorMessage(e, "Die Pause konnte nicht gespeichert werden."))
    } finally {
      setBusy(false)
    }
  }

  async function submit(auto = false) {
    setBusy(true)
    setActionError(null)
    const saved = await sync.flush()
    // Nicht gespeicherte Antworten: von Hand nicht abgeben; nach Zeitablauf trotzdem, die Sicherung bleibt
    if (!saved && !auto) {
      setActionError("Deine Antworten sind noch nicht alle gespeichert (sie sind in diesem Browser gesichert). Bitte kurz warten und erneut abgeben.")
      setBusy(false)
      setDialog(null)
      return
    }
    try {
      await ipmaApi.submit(attemptId)
      if (saved) clearBackup(attemptId)
      goToResult(auto ? "?zeit=abgelaufen" : "")
    } catch (e) {
      if (e instanceof IpmaApiError && (e.status === 409 || e.status === 422)) {
        await reload()
      } else {
        setActionError(errorMessage(e, "Die Prüfung konnte nicht abgegeben werden. Deine Antworten sind gespeichert; bitte erneut versuchen."))
      }
      setBusy(false)
      setDialog(null)
    }
  }

  const submitRef = useRef(submit)
  submitRef.current = submit

  const onExpire = useCallback(() => {
    const v = viewRef.current
    if (!v) return
    if (v.deadlineAt) {
      setAssertive("Zeit abgelaufen, die Prüfung wird abgegeben.")
      void submitRef.current(true)
    } else {
      // Ansage über role="status" der Meldung «Zeit um.»
      setTimeUp(true)
    }
  }, [])

  async function check() {
    if (!item || busy) return
    setBusy(true)
    setActionError(null)
    const ok = await sync.flush()
    if (!ok) {
      setActionError("Deine Antwort ist noch nicht gespeichert. Bitte kurz warten und erneut prüfen.")
      setBusy(false)
      return
    }
    try {
      const solved = await ipmaApi.check(attemptId, item.position)
      // Der Titel der Rückmeldung bekommt den Fokus und wird dabei vorgelesen (keine zusätzliche Ansage)
      focusFeedback.current = true
      replaceItem(solved)
    } catch (e) {
      if (e instanceof IpmaApiError && e.status === 409) await reload()
      else setActionError(errorMessage(e, "Die Antwort konnte nicht geprüft werden."))
    } finally {
      setBusy(false)
    }
  }

  async function finishTraining() {
    if (aiRunning > 0) return
    setBusy(true)
    setActionError(null)
    const saved = await sync.flush()
    if (!saved) {
      setActionError("Deine Antworten sind noch nicht alle gespeichert (sie sind in diesem Browser gesichert). Bitte kurz warten und erneut abschliessen.")
      setBusy(false)
      setDialog(null)
      return
    }
    try {
      const res = await ipmaApi.finish(attemptId)
      storeSession(finishStorageKey(attemptId), res)
      clearBackup(attemptId)
      goToResult()
    } catch (e) {
      setActionError(errorMessage(e, "Der Versuch konnte nicht abgeschlossen werden."))
      setBusy(false)
      setDialog(null)
    }
  }

  // Einzeltasten-Kürzel am Container (nicht in Eingabefeldern, nicht bei offenem Dialog), abschaltbar
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (shortcutsOff || dialog || paused || e.ctrlKey || e.metaKey || e.altKey || e.defaultPrevented) return
      const target = e.target as HTMLElement | null
      if (target?.closest("input, textarea, select, [contenteditable='true'], [role='dialog']")) return
      const key = e.key.toLowerCase()
      if (key === "w") go(index + 1)
      else if (key === "z") go(index - 1)
      else if (key === "u") setDialog("overview")
      else if (key === "m") toggleFlag()
      else return
      e.preventDefault()
    },
    // toggleFlag ändert sich mit item; die Liste genügt
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [shortcutsOff, dialog, paused, go, index, item],
  )

  if (loadError) {
    return (
      <div className="card stack">
        <h1>Prüfungssimulator</h1>
        <p className={styles.fehlerText} role="alert">
          {loadError}
        </p>
        <p>
          <a className="btn" href="/ipma">
            Zur Startseite
          </a>
        </p>
      </div>
    )
  }

  if (!view) {
    return (
      <p className="hint" role="status">
        Versuch wird geladen …
      </p>
    )
  }

  if (view.status === "aborted") {
    return (
      <div className="card stack">
        <h1>{MODE_LABEL[view.mode]}</h1>
        <p>Dieser Versuch wurde abgebrochen und lässt sich nicht mehr fortsetzen.</p>
        <p>
          <a className="btn primary" href="/ipma">
            Zur Startseite
          </a>
        </p>
      </div>
    )
  }

  const total = items.length
  const unanswered = items.filter((i) => !isAnswered(i)).length
  const flaggedCount = items.filter((i) => i.flagged).length
  const unchecked = items.filter((i) => !isSolved(i)).length
  const correctCount = items.filter((i) => isSolved(i) && i.correct === true).length
  const showClock = exam && clockBase !== null && (view.deadlineAt !== null || view.variant === "pausable")
  const solved = item && isSolved(item) ? item : null
  const syncProblem = sync.state === "retry" || sync.state === "offline" || sync.state === "auth" || sync.state === "error"

  return (
    // tabIndex -1: ein Mausklick in die Ansicht setzt den Fokus hierher, sonst greifen die Kürzel nicht
    <div className={styles.pruefung} onKeyDown={onKeyDown} tabIndex={-1}>
      <div className="sr-only" aria-live="polite">
        {polite}
      </div>
      <div className="sr-only" aria-live="assertive">
        {assertive}
      </div>
      <div className="sr-only" aria-live="polite">
        {syncProblem ? SYNC_TEXT[sync.state] : ""}
      </div>

      <div className={styles.zeileZwischen}>
        <h1 className={styles.frageTitel}>
          {MODE_LABEL[view.mode]}
          {view.mode === "exam" ? ` · ${VARIANT_LABEL[view.variant]}` : ""}
        </h1>
        <button
          type="button"
          className={`btn ${styles.klein}`}
          aria-pressed={!shortcutsOff}
          title="W: weiter · Z: zurück · M: markieren · U: Übersicht"
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
          {/* Gleichbleibender Name, Zustand über aria-pressed; «an/aus» nur für die Augen */}
          Tastenkürzel<span aria-hidden="true"> {shortcutsOff ? "aus" : "an"}</span>
        </button>
      </div>

      <div className={styles.pruefKopf}>
        <div className={styles.kopfLinks}>
          <span className={styles.stelle}>
            Frage {item?.position ?? 0} von {total}
          </span>
          {view.mode === "exam" && item && (
            <span className="hint">
              {item.type === "mc" ? `Teil 1 · Multiple Choice · Richtzeit ${PART_MINUTES.mc} min` : `Teil 2 · Offene Fragen · Richtzeit ${PART_MINUTES.offen} min`}
            </span>
          )}
          {showClock && clockBase && <ExamClock base={clockBase} onExpire={onExpire} onAnnounce={announce} />}
          {training && (
            <span className="hint">
              {total - unchecked} geprüft · {correctCount} richtig
            </span>
          )}
        </div>
        <div className={styles.kopfRechts}>
          <span className={`${styles.speicher} ${syncProblem ? styles.speicherFehler : ""}`}>{SYNC_TEXT[sync.state]}</span>
          <span className="row">
            {exam && view.variant === "pausable" && (
              <button
                type="button"
                className="btn"
                ref={pauseRef}
                aria-disabled={busy || undefined}
                onClick={() => {
                  if (!busy) void togglePause()
                }}
              >
                <span aria-hidden="true">{paused ? "▶" : "⏸"}</span> <span className={styles.symbolText}>{paused ? "Weiter" : "Pause"}</span>
              </button>
            )}
            <button type="button" className="btn" onClick={() => setDialog("overview")} aria-keyshortcuts={shortcutsOff ? undefined : "U"} disabled={paused}>
              <span aria-hidden="true">☰</span> <span className={styles.symbolText}>Übersicht</span>
            </button>
            {exam ? (
              <button type="button" className="btn primary" onClick={() => setDialog("submit")} disabled={busy || paused}>
                <span aria-hidden="true">✓</span> <span className={styles.symbolText}>Abgeben</span>
              </button>
            ) : (
              <button type="button" className="btn primary" onClick={() => setDialog("finish")} disabled={busy || aiRunning > 0}>
                <span aria-hidden="true">✓</span> <span className={styles.symbolText}>Abschliessen</span>
              </button>
            )}
          </span>
        </div>
      </div>

      {actionError && (
        <p className={`${styles.meldung} ${styles.meldungFehler}`} role="alert">
          {actionError}
        </p>
      )}
      {sync.state === "auth" && (
        <p className={`${styles.meldung} ${styles.meldungFehler}`}>
          Deine Anmeldung ist abgelaufen. Deine Antworten sind in diesem Browser gesichert.{" "}
          <a href={`/login?callbackUrl=${encodeURIComponent(`/ipma/${attemptId}`)}`}>Neu anmelden</a>, danach werden sie gespeichert.
        </p>
      )}
      {timeUp && (
        <div className={`${styles.meldung} ${styles.meldungWarn}`} role="status">
          <p>
            <strong>Zeit um.</strong> Die 3 Stunden aktive Zeit sind vorbei. Du kannst weiterarbeiten; das Ergebnis trägt ohnehin den Vermerk «mit Pausen».
          </p>
          <button type="button" className="btn primary" onClick={() => setDialog("submit")}>
            Jetzt abgeben
          </button>
        </div>
      )}

      {paused ? (
        <div className={styles.decke}>
          <h2>Pause</h2>
          <p>Die Fragen sind verdeckt, die Zeit steht. Deine Antworten sind gespeichert.</p>
          <button
            type="button"
            className="btn primary"
            aria-disabled={busy || undefined}
            onClick={() => {
              if (!busy) void togglePause()
            }}
          >
            Weiter
          </button>
        </div>
      ) : (
        item && (
          <article className="card stack" aria-label={`Frage ${item.position}`}>
            <QuestionView
              item={item}
              total={total}
              headingRef={headingRef}
              readOnly={item.locked || isSolved(item)}
              onChoice={(choice) => {
                update(item.position, { choice })
                sync.queue(item.position, { choice })
              }}
              onText={(text) => {
                update(item.position, { text })
                sync.queue(item.position, { text })
              }}
            />

            {training && !solved && (
              <div className="row">
                <button
                  type="button"
                  className="btn primary"
                  aria-disabled={busy || undefined}
                  onClick={() => {
                    if (!busy) void check()
                  }}
                >
                  {busy ? "Wird geprüft …" : isAnswered(item) ? "Prüfen" : "Lösung zeigen"}
                </button>
                {!isAnswered(item) && <span className="hint">Ohne Antwort zählt die Frage als falsch.</span>}
              </div>
            )}

            {training && solved && (
              <section className="stack" aria-labelledby={`rueckmeldung-${solved.position}`}>
                <h3 id={`rueckmeldung-${solved.position}`} ref={feedbackRef} tabIndex={-1} className={styles.rueckTitel}>
                  {feedbackTitle(solved)}
                </h3>
                {solved.type === "offen" && (
                  <>
                    <SelfAssessment attemptId={attemptId} item={solved} editable={solved.selfScores.length === 0} onSaved={replaceItem} onAnnounce={announce} />
                    <AiAssessment
                      attemptId={attemptId}
                      item={solved}
                      canUseAi={view.canUseAi}
                      allowed={view.status === "active"}
                      onSaved={replaceItem}
                      onAnnounce={announce}
                      onRunningChange={onAiRunning}
                    />
                  </>
                )}
                <FeedbackPanel item={solved} />
              </section>
            )}

            <div className={styles.navigation}>
              <button type="button" className="btn" onClick={() => go(index - 1)} disabled={index === 0} aria-keyshortcuts={shortcutsOff ? undefined : "Z"}>
                ← Zurück
              </button>
              <div>
                <button
                  type="button"
                  className={`btn ${item.flagged ? styles.markiert : ""}`}
                  aria-pressed={item.flagged}
                  disabled={item.locked}
                  onClick={toggleFlag}
                  aria-keyshortcuts={shortcutsOff ? undefined : "M"}
                >
                  {/* Gleichbleibender Name, Zustand über aria-pressed und Hervorhebung */}
                  <span aria-hidden="true">⚑</span> Markieren
                </button>
              </div>
              <button type="button" className="btn" onClick={() => go(index + 1)} disabled={index >= total - 1} aria-keyshortcuts={shortcutsOff ? undefined : "W"}>
                Weiter →
              </button>
            </div>
          </article>
        )
      )}

      {training && unchecked === 0 && total > 0 && (
        <div className={`${styles.meldung} ${styles.meldungOk}`}>
          <p>Alle Fragen sind geprüft. Schliesse ab, um deine Auswertung und die empfohlenen Stationen zu sehen.</p>
          <button type="button" className="btn primary" disabled={busy || aiRunning > 0} onClick={() => void finishTraining()}>
            {view.mode === "gaps" ? "Runde abschliessen" : "Training abschliessen"}
          </button>
          {aiRunning > 0 && <p className="hint">Claude bewertet noch; danach kannst du abschliessen.</p>}
        </div>
      )}

      {dialog === "overview" && (
        <Dialog title="Übersicht" onEscape={() => setDialog(null)} wide>
          <QuestionOverview items={items} current={index} training={training} fullExam={view.mode === "exam"} onJump={go} />
          <div className={styles.dialogKnoepfe}>
            <button type="button" className="btn" onClick={() => setDialog(null)}>
              Schliessen
            </button>
          </div>
        </Dialog>
      )}

      {dialog === "submit" && (
        <Dialog title="Prüfung abgeben?" onEscape={busy ? undefined : () => setDialog(null)}>
          <p>
            {unanswered === 0 ? "Alle Fragen sind beantwortet" : `${unanswered} ${unanswered === 1 ? "Frage" : "Fragen"} unbeantwortet`}
            {flaggedCount > 0 ? `, ${flaggedCount} markiert` : ""}. Nach der Abgabe kannst du nichts mehr ändern; danach bewertest du deine offenen Antworten selbst.
          </p>
          <div className={styles.dialogKnoepfe}>
            <button type="button" className="btn primary" disabled={busy} onClick={() => void submit()}>
              {busy ? "Wird abgegeben …" : "Jetzt abgeben"}
            </button>
            <button type="button" className="btn" disabled={busy} onClick={() => setDialog(null)}>
              Weiterarbeiten
            </button>
          </div>
        </Dialog>
      )}

      {dialog === "finish" && (
        <Dialog title={view.mode === "gaps" ? "Runde abschliessen?" : "Training abschliessen?"} onEscape={busy ? undefined : () => setDialog(null)}>
          <p>
            {unchecked === 0
              ? "Alle Fragen sind geprüft."
              : `${unchecked} ${unchecked === 1 ? "Frage ist" : "Fragen sind"} noch nicht geprüft; sie zählen nicht für Landkarte und Wiederholung.`}
          </p>
          <div className={styles.dialogKnoepfe}>
            <button type="button" className="btn primary" disabled={busy || aiRunning > 0} onClick={() => void finishTraining()}>
              {busy ? "Wird abgeschlossen …" : "Abschliessen"}
            </button>
            <button type="button" className="btn" disabled={busy} onClick={() => setDialog(null)}>
              Weiterüben
            </button>
          </div>
        </Dialog>
      )}
    </div>
  )
}

/** Titel der Rückmeldung im Training (bekommt nach «Prüfen» den Fokus) */
function feedbackTitle(item: SolvedItem): string {
  if (item.type === "offen") {
    return (item.text ?? "").trim() === "" ? "Rückmeldung: keine Antwort, 0 Punkte" : "Rückmeldung: Musterlösung und Raster, bewerte dich selbst"
  }
  if (item.correct === true) return "Rückmeldung: richtig"
  return item.choice === null ? "Rückmeldung: nicht beantwortet" : "Rückmeldung: falsch"
}
