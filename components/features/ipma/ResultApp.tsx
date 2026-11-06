// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

"use client"

// components/features/ipma/ResultApp.tsx
// Auswertung /ipma/[attemptId]/auswertung (Spezifikation 4.2, 4.4, 6.8):
// - Prüfung abgegeben: Pflichtschritt Selbstbewertung aller beantworteten offenen Fragen, optional Claude (einzeln
//   oder «Alle offenen Antworten bewerten», AiAssessAll), danach «Abschliessen»
//   (POST finish); das vorläufige Ergebnis rechnet der Server bei jedem Laden neu (Nachtrag 8.5 Nr. 6)
// - Ergebnis, Kompetenz-Landkarte des Versuchs, «Lücken schliessen» mit Vorher/Nachher, Stationen, Durchsicht
// - neue Abzeichen und Punkte aus dem Abschluss (FinishView); Werte aus dem sessionStorage mit Zod geprüft
// «Auswertung abschliessen» bleibt gesperrt, solange eine Bewertung durch Claude läuft (der Server lehnt dann
// ohnehin mit 409 AI_PENDING ab).

import type { AttemptView, FinishView, OverviewView, SolvedItem } from "@/lib/ipma/types"
import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { z } from "zod"
import { COMPETENCE_IDS } from "@/lib/ipma/competences"
import styles from "@/app/(ipma)/ipma.module.css"
import { ipmaApi, IpmaApiError, beforeStorageKey, errorMessage, finishStorageKey, readSession } from "./api"
import AiAssessAll from "./AiAssessAll"
import AiAssessment from "./AiAssessment"
import CompetenceMap, { type AttemptCompetence, type MasteryEntry, type StationTitles } from "./CompetenceMap"
import { LEVEL, MODE_LABEL, competenceNumber, dateTime, isSolved, needsSelfAssessment, score } from "./format"
import ItemReview from "./ItemReview"
import ResultSummary from "./ResultSummary"
import SelfAssessment from "./SelfAssessment"
import StationAdvice from "./StationAdvice"

/** Aus dem Abschluss angezeigt: neue Abzeichen und Punkte */
type FinishShown = Pick<FinishView, "newBadges" | "pointsAwarded">

// sessionStorage ist Eingabe von aussen: nur geprüfte Werte anzeigen
const finishSchema = z.object({
  newBadges: z
    .array(
      z.object({
        name: z.string().max(200),
        icon: z.string().max(20),
        description: z.string().max(500),
        points: z.number().int().min(0),
      }),
    )
    .max(50),
  pointsAwarded: z.number().int().min(0),
})

const masterySchema = z
  .array(
    z.object({
      competence: z.enum(COMPETENCE_IDS),
      value: z.number().min(0).max(1).nullable(),
      answers: z.number().int().min(0),
      level: z.enum(["secure", "close", "gap", "untrained"]),
    }),
  )
  .max(COMPETENCE_IDS.length)

function masteryWord(m: MasteryEntry | undefined): string {
  if (!m) return "–"
  const level = LEVEL[m.level]
  return m.value === null || m.level === "untrained" ? `${level.sign} ${level.word}` : `${level.sign} ${level.word} (${Math.round(m.value * 100)} %)`
}

export default function ResultApp({ attemptId, stations, timeUp }: { attemptId: string; stations: StationTitles; timeUp: boolean }) {
  const router = useRouter()
  const [view, setView] = useState<AttemptView | null>(null)
  const [overview, setOverview] = useState<OverviewView | null>(null)
  const [finish, setFinish] = useState<FinishShown | null>(null)
  const [before, setBefore] = useState<MasteryEntry[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [polite, setPolite] = useState("")
  // Laufende Claude-Bewertungen (einzeln oder «Alle bewerten»)
  const [aiRunning, setAiRunning] = useState(0)
  const onAiRunning = useCallback((running: boolean) => {
    setAiRunning((n) => Math.max(0, n + (running ? 1 : -1)))
  }, [])
  // Auf/zu je offener Frage: bleibt nach dem Speichern offen (sonst verschwände der Claude-Knopf)
  const [expanded, setExpanded] = useState<Record<number, boolean>>({})

  const announce = useCallback((text: string) => {
    setPolite("")
    setTimeout(() => setPolite(text), 50)
  }, [])

  const load = useCallback(async () => {
    try {
      const v = await ipmaApi.get(attemptId)
      if (v.status === "active") {
        router.replace(`/ipma/${attemptId}`)
        return
      }
      setView(v)
      if (v.status === "finished") {
        ipmaApi
          .overview()
          .then(setOverview)
          .catch(() => undefined)
      }
    } catch (e) {
      if (!(e instanceof IpmaApiError) || e.status >= 500) console.error("[ipma]", e)
      setLoadError(
        e instanceof IpmaApiError && e.status === 404 ? "Diesen Versuch gibt es nicht." : errorMessage(e, "Die Auswertung konnte nicht geladen werden. Bitte die Seite neu laden."),
      )
    }
  }, [attemptId, router])

  useEffect(() => {
    void load()
    const stored = finishSchema.safeParse(readSession(finishStorageKey(attemptId)))
    if (stored.success) setFinish(stored.data)
    const prior = masterySchema.safeParse(readSession(beforeStorageKey(attemptId)))
    if (prior.success) setBefore(prior.data)
  }, [attemptId, load])

  const replaceItem = useCallback((next: SolvedItem) => {
    setView((v) => (v ? { ...v, items: v.items.map((i) => (i.position === next.position ? next : i)) } : v))
  }, [])

  // Vorläufiges Ergebnis neu laden (der Server rechnet es bei GET)
  const refresh = useCallback(() => {
    ipmaApi
      .get(attemptId)
      .then((v) => setView(v))
      .catch(() => undefined)
  }, [attemptId])

  // Nach einer Selbst- oder Claude-Bewertung
  const onSelfSaved = useCallback(
    (next: SolvedItem) => {
      replaceItem(next)
      refresh()
    },
    [replaceItem, refresh],
  )

  async function doFinish() {
    if (aiBlocked) return
    setBusy(true)
    setActionError(null)
    try {
      const res = await ipmaApi.finish(attemptId)
      setFinish(res)
      announce("Auswertung abgeschlossen.")
      await load()
    } catch (e) {
      setActionError(errorMessage(e, "Die Auswertung konnte nicht abgeschlossen werden."))
    } finally {
      setBusy(false)
    }
  }

  if (loadError) {
    return (
      <div className="card stack">
        <h1>Auswertung</h1>
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
      <>
        {timeUp && (
          <p className={`${styles.meldung} ${styles.meldungWarn}`} role="alert">
            Zeit abgelaufen, die Prüfung wurde abgegeben.
          </p>
        )}
        <p className="hint" role="status">
          Auswertung wird geladen …
        </p>
      </>
    )
  }

  if (view.status === "aborted") {
    return (
      <div className="card stack">
        <h1>{MODE_LABEL[view.mode]}</h1>
        <p>Dieser Versuch wurde abgebrochen; es gibt keine Auswertung.</p>
        <p>
          <a className="btn primary" href="/ipma">
            Zur Startseite
          </a>
        </p>
      </div>
    )
  }

  const items = view.items.filter(isSolved)
  const submitted = view.status === "submitted"
  const openItems = items.filter((i) => i.type === "offen" && (i.text ?? "").trim() !== "")
  const pendingSelf = items.filter(needsSelfAssessment).length
  // Nur lokale Läufe sperren; eine verwaiste Sperre «pending» gibt der Server nach 2 Minuten frei
  const aiBlocked = aiRunning > 0
  const result = view.result

  const competences: Record<string, AttemptCompetence> = {}
  if (result) {
    for (const [id, c] of Object.entries(result.competences)) {
      competences[id] = { ...c, positions: items.filter((i) => i.competence === id).map((i) => ({ position: i.position, correct: i.correct })) }
    }
  }

  return (
    <div className={styles.start}>
      <div className="sr-only" aria-live="polite">
        {polite}
      </div>
      {timeUp && (
        <p className={`${styles.meldung} ${styles.meldungWarn}`} role="alert">
          Zeit abgelaufen, die Prüfung wurde abgegeben.
        </p>
      )}
      <header className={styles.startKopf}>
        <p className="eyebrow">Auswertung · {dateTime(view.startedAt)}</p>
        <h1>{MODE_LABEL[view.mode]}</h1>
      </header>

      {submitted && (
        <section className="card stack" aria-labelledby="selbst-titel">
          <p className="eyebrow">Pflichtschritt vor dem Abschluss</p>
          <h2 id="selbst-titel">Offene Antworten selbst bewerten</h2>
          <p>
            Vergleiche jede Antwort mit der Musterlösung und vergib je Kriterium die Punkte, die du dir ehrlich gibst.{" "}
            {openItems.length === 0
              ? "Du hast keine offene Frage beantwortet; unbeantwortete zählen 0 Punkte."
              : `${openItems.length - pendingSelf} von ${openItems.length} bewertet.`}
          </p>
          <AiAssessAll
            attemptId={attemptId}
            items={openItems}
            canUseAi={view.canUseAi}
            onItem={replaceItem}
            onDone={refresh}
            onAnnounce={announce}
            onRunningChange={onAiRunning}
          />
          <ul className={styles.durchsicht}>
            {openItems.map((item) => (
              <li key={item.position}>
                <details open={expanded[item.position] ?? needsSelfAssessment(item)} onToggle={(e) => {
                  const isOpen = e.currentTarget.open
                  setExpanded((x) => (x[item.position] === isOpen ? x : { ...x, [item.position]: isOpen }))
                }}>
                  <summary>
                    <strong>Frage {item.position}</strong>
                    <span>{needsSelfAssessment(item) ? "○ noch nicht bewertet" : `✓ bewertet (${score(item.rasterPoints ?? 0)} von ${score(item.points)} Punkten${item.scoreSource === "ai" ? ", Claude" : ""})`}</span>
                    <span className="hint">Kompetenz {competenceNumber(item.competence)}</span>
                  </summary>
                  <div className={styles.durchsichtInhalt}>
                    <p className={styles.frageText}>{item.question}</p>
                    <SelfAssessment attemptId={attemptId} item={item} editable onSaved={onSelfSaved} onAnnounce={announce} />
                    <AiAssessment
                      attemptId={attemptId}
                      item={item}
                      canUseAi={view.canUseAi}
                      allowed
                      onSaved={onSelfSaved}
                      onAnnounce={announce}
                      onRunningChange={onAiRunning}
                    />
                  </div>
                </details>
              </li>
            ))}
          </ul>
          {actionError && (
            <p className={styles.fehlerText} role="alert">
              {actionError}
            </p>
          )}
          <div className="row">
            <button type="button" className="btn primary" disabled={busy || pendingSelf > 0 || aiBlocked} onClick={() => void doFinish()}>
              {busy ? "Wird abgeschlossen …" : "Auswertung abschliessen"}
            </button>
            {pendingSelf > 0 && (
              <span className="hint">
                Noch {pendingSelf} {pendingSelf === 1 ? "Antwort" : "Antworten"} zu bewerten.
              </span>
            )}
            {pendingSelf === 0 && aiBlocked && <span className="hint">Claude bewertet noch; danach kannst du abschliessen.</span>}
          </div>
        </section>
      )}

      {finish && (finish.newBadges.length > 0 || finish.pointsAwarded > 0) && (
        <section className={`card stack ${styles.meldungOk}`} aria-labelledby="abschluss-titel">
          <h2 id="abschluss-titel">Gut gemacht</h2>
          {finish.pointsAwarded > 0 && <p>+{finish.pointsAwarded} Punkte in deinem Konto.</p>}
          {finish.newBadges.length > 0 && (
            <ul className={styles.abzeichen}>
              {finish.newBadges.map((b) => (
                <li key={b.name}>
                  <span aria-hidden="true">{b.icon}</span> <strong>{b.name}</strong>: {b.description} (+{b.points})
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {result && <ResultSummary view={view} result={result} provisional={submitted} />}

      {result && (
        <section className="card stack" aria-labelledby="karte-titel">
          <h2 id="karte-titel">Kompetenz-Landkarte dieses Versuchs</h2>
          <CompetenceMap kind="attempt" competences={competences} mastery={overview?.mastery} stations={stations} />
        </section>
      )}

      {view.mode === "gaps" && result && overview && (
        <section className="card stack" aria-labelledby="vorher-titel">
          <h2 id="vorher-titel">Vorher und nachher</h2>
          <div className="tablebox">
            <table className="tabelle">
              <thead>
                <tr>
                  <th scope="col">Kompetenz</th>
                  <th scope="col">Vorher</th>
                  <th scope="col">Nachher</th>
                </tr>
              </thead>
              <tbody>
                {Object.keys(result.competences).map((id) => (
                  <tr key={id}>
                    <th scope="row">{id}</th>
                    <td>{before ? masteryWord(before.find((m) => m.competence === id)) : "–"}</td>
                    <td>{masteryWord(overview.mastery.find((m) => m.competence === id))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!before && <p className="hint">Den Stand vorher kennt nur der Browser, in dem du die Runde gestartet hast.</p>}
        </section>
      )}

      {result && <StationAdvice stations={result.stations} weaknesses={result.weaknesses} />}

      {items.length > 0 && <ItemReview attemptId={attemptId} items={items} canUseAi={view.canUseAi} />}

      <div className="row">
        <a className="btn primary" href="/ipma">
          Zur Startseite des Simulators
        </a>
      </div>
    </div>
  )
}
