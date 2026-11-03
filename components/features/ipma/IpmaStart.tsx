// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

"use client"

// components/features/ipma/IpmaStart.tsx
// Startseite /ipma (Spezifikation 6.8 IpmaStart): Kennzahlen, Modus-Karten (Übungsprüfung mit Wahl
// Echtbedingungen/mit Pausen, Kurzprüfung, Training, Lücken schliessen), aktiver Versuch «fortsetzen»,
// Bestehensregel, Landkarte nach Beherrschung, Verlauf und Bestwerte.
// ?start=exam|short (Station 24) hebt die passende Karte hervor, startet aber nicht automatisch (6.9).

import type { AttemptMode, AttemptSummary, OverviewView } from "@/lib/ipma/types"
import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import styles from "@/app/(ipma)/ipma.module.css"
import Dialog from "@/components/features/leitstand/Dialog"
import { ipmaApi, IpmaApiError, beforeStorageKey, errorMessage, startErrorMessage, storeSession, type CreateAttemptBody } from "./api"
import CompetenceMap, { type StationTitles } from "./CompetenceMap"
import HistoryChart from "./HistoryChart"
import { MIN_COMPETENCES, MODE_LABEL, PASS_PERCENT, TOTAL_COMPETENCES, VARIANT_LABEL, clockWords, dateTime, percent } from "./format"

type StartTarget = "exam" | "short" | null

export default function IpmaStart({ stations, start }: { stations: StationTitles; start: StartTarget }) {
  const router = useRouter()
  const [overview, setOverview] = useState<OverviewView | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [startError, setStartError] = useState<{ mode: AttemptMode; text: string } | null>(null)
  const [busy, setBusy] = useState<AttemptMode | null>(null)
  const [variant, setVariant] = useState<"strict" | "pausable">("strict")
  const [confirm, setConfirm] = useState<{ body: CreateAttemptBody; activeId: string } | null>(null)
  const [target, setTarget] = useState<StartTarget>(start)
  const examRef = useRef<HTMLHeadingElement>(null)
  const shortRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    let cancelled = false
    ipmaApi
      .overview()
      .then((o) => {
        if (!cancelled) setOverview(o)
      })
      .catch((e: unknown) => {
        console.error("[ipma]", e)
        if (!cancelled) setLoadError(errorMessage(e, "Die Übersicht konnte nicht geladen werden. Bitte die Seite neu laden."))
      })
    return () => {
      cancelled = true
    }
  }, [])

  // ?start= aus Station 24: Karte hervorheben und Fokus setzen, Parameter entfernen
  useEffect(() => {
    if (!start || !overview) return
    router.replace("/ipma", { scroll: false })
    const el = start === "exam" ? examRef.current : shortRef.current
    el?.scrollIntoView({ block: "center" })
    el?.focus()
  }, [start, overview, router])

  const create = useCallback(
    async (body: CreateAttemptBody) => {
      setBusy(body.mode)
      setStartError(null)
      try {
        const res = await ipmaApi.create(body)
        if (body.mode === "gaps" && overview) storeSession(beforeStorageKey(res.id), overview.mastery)
        router.push(`/ipma/${res.id}`)
      } catch (e) {
        setBusy(null)
        if (e instanceof IpmaApiError && e.code === "ACTIVE_EXISTS" && e.activeAttemptId) {
          setConfirm({ body, activeId: e.activeAttemptId })
          return
        }
        if (!(e instanceof IpmaApiError) || e.status >= 500) console.error("[ipma]", e)
        setStartError({ mode: body.mode, text: startErrorMessage(e) })
      }
    },
    [router, overview],
  )

  const active = (mode: AttemptMode): AttemptSummary | undefined => overview?.active.find((a) => a.mode === mode)
  const secure = overview?.mastery.filter((m) => m.level === "secure").length ?? 0
  const poolTotal = overview ? Object.values(overview.pool).reduce((s, p) => s + p.mc + p.offen, 0) : 0
  const bestShort = overview?.recent.short
    .filter((a) => a.status === "finished" && a.percent !== null)
    .reduce<AttemptSummary | null>((b, a) => (b === null || (a.percent ?? 0) > (b.percent ?? 0) ? a : b), null)

  function remaining(a: AttemptSummary): string | null {
    if (!a.deadlineAt || !overview) return null
    const sec = (Date.parse(a.deadlineAt) - Date.parse(overview.serverNow)) / 1000
    return sec > 0 ? `noch ${clockWords(sec)}` : "Zeit abgelaufen"
  }

  function errorFor(mode: AttemptMode) {
    return startError?.mode === mode ? (
      <p className={`${styles.meldung} ${styles.meldungFehler}`} role="alert">
        {startError.text}
      </p>
    ) : null
  }

  function continueRow(mode: AttemptMode, label: string) {
    const a = active(mode)
    if (!a) return null
    const rest = remaining(a)
    return (
      <p className={`${styles.meldung} ${styles.meldungWarn}`}>
        Laufender Versuch seit {dateTime(a.startedAt)}
        {rest ? ` · ${rest}` : ""}.{" "}
        <a className="btn primary" href={`/ipma/${a.id}`}>
          {label} fortsetzen
        </a>
      </p>
    )
  }

  return (
    <>
      {loadError && (
        <p className={`${styles.meldung} ${styles.meldungFehler}`} role="alert">
          {loadError}
        </p>
      )}

      <ul className={styles.kacheln} aria-label="Kennzahlen">
        <li className={styles.kachel}>
          <span className={styles.kachelLabel}>Bestwert Übungsprüfung</span>
          <span className={styles.kachelWert}>{overview?.bestExam ? percent(overview.bestExam.percent) : "–"}</span>
          <span className={styles.kachelFuss}>Grenze {PASS_PERCENT} %</span>
        </li>
        <li className={styles.kachel}>
          <span className={styles.kachelLabel}>Kompetenzen sicher</span>
          <span className={styles.kachelWert}>
            {overview ? secure : "–"} <small>/ {TOTAL_COMPETENCES}</small>
          </span>
          <span className={styles.kachelFuss}>über alle Versuche</span>
        </li>
        <li className={styles.kachel}>
          <span className={styles.kachelLabel}>Fällige Fragen</span>
          <span className={styles.kachelWert}>{overview ? overview.dueCount : "–"}</span>
          <span className={styles.kachelFuss}>zum Wiederholen</span>
        </li>
        <li className={styles.kachel}>
          <span className={styles.kachelLabel}>Fragen im Pool</span>
          <span className={styles.kachelWert}>{overview ? poolTotal : "–"}</span>
          <span className={styles.kachelFuss}>fachlich geprüft</span>
        </li>
      </ul>

      {!overview && !loadError && (
        <p className="hint" role="status">
          Übersicht wird geladen …
        </p>
      )}

      <section aria-labelledby="modi-titel" className={styles.start}>
        <h2 id="modi-titel">Modus wählen</h2>
        <div className={styles.modusRaster}>
          <article className={`card stack ${styles.modusKarte} ${styles.modusHaupt} ${target === "exam" ? styles.modusZiel : ""}`} aria-labelledby="modus-exam">
            <p className="eyebrow">Wie am Prüfungstag</p>
            <h3 id="modus-exam" ref={examRef} tabIndex={-1} onBlur={() => setTarget(null)}>
              Übungsprüfung
            </h3>
            <ul className={styles.fakten}>
              <li>
                <strong>90</strong> Fragen
              </li>
              <li>
                <strong>3 h</strong> Zeit
              </li>
              <li>
                <strong>120</strong> Punkte
              </li>
            </ul>
            <p className="hint">60 Multiple-Choice- und 30 offene Fragen, jede der 28 Kompetenzen mindestens dreimal. Rückmeldung erst nach der Abgabe. Open Book: Halte deinen Ordner mit Register nach ICB-Nummer bereit (Stationen 02 und 24).</p>
            {continueRow("exam", "Übungsprüfung")}
            <fieldset className={styles.wahl}>
              <legend>Zeit</legend>
              <label className={styles.wahlOption}>
                <input type="radio" name="variante" value="strict" checked={variant === "strict"} onChange={() => setVariant("strict")} />
                <span>
                  {VARIANT_LABEL.strict} (empfohlen)
                  <small>Die Uhr läuft 3 Stunden durch, auch wenn die Seite zu ist. Nach Ablauf wird automatisch abgegeben.</small>
                </span>
              </label>
              <label className={styles.wahlOption}>
                <input type="radio" name="variante" value="pausable" checked={variant === "pausable"} onChange={() => setVariant("pausable")} />
                <span>
                  {VARIANT_LABEL.pausable}
                  <small>Pausen erlaubt, gezählt wird die aktive Zeit. Ergebnis mit Vermerk; die Abzeichen «Bestanden» und «Souverän» gibt es nur unter Echtbedingungen.</small>
                </span>
              </label>
            </fieldset>
            {errorFor("exam")}
            <div className="row">
              <button type="button" className={`btn ${active("exam") ? "" : "primary"}`} disabled={!overview} aria-disabled={busy !== null || undefined} onClick={() => {
                if (busy === null) void create({ mode: "exam", variant })
              }}>
                {busy === "exam" ? "Wird gestartet …" : active("exam") ? "Neu beginnen" : "Übungsprüfung starten"}
              </button>
            </div>
          </article>

          <article className={`card stack ${styles.modusKarte} ${target === "short" ? styles.modusZiel : ""}`} aria-labelledby="modus-short">
            <p className="eyebrow">Für zwischendurch</p>
            <h3 id="modus-short" ref={shortRef} tabIndex={-1} onBlur={() => setTarget(null)}>
              Kurzprüfung
            </h3>
            <ul className={styles.fakten}>
              <li>
                <strong>20</strong> Fragen
              </li>
              <li>
                <strong>40 min</strong> Zeit
              </li>
            </ul>
            <p className="hint">14 Multiple-Choice- und 6 offene Fragen aus 20 verschiedenen Kompetenzen, bevorzugt aus deinen schwächeren. Immer unter Echtbedingungen. Die Regel 23/28 gilt hier nicht.</p>
            {continueRow("short", "Kurzprüfung")}
            {errorFor("short")}
            <div className="row">
              <button type="button" className={`btn ${active("short") ? "" : "primary"}`} disabled={!overview} aria-disabled={busy !== null || undefined} onClick={() => {
                if (busy === null) void create({ mode: "short" })
              }}>
                {busy === "short" ? "Wird gestartet …" : active("short") ? "Neu beginnen" : "Kurzprüfung starten"}
              </button>
            </div>
          </article>

          <article className={`card stack ${styles.modusKarte}`} aria-labelledby="modus-training">
            <p className="eyebrow">Gezielt üben</p>
            <h3 id="modus-training">Training</h3>
            <p className="hint">Du wählst Kompetenzen, Fragetyp und Anzahl (5 bis 30). Nach jeder Frage prüfst du sofort: Lösung, Erklärung und Fundstelle mit Link zur Station.</p>
            {continueRow("training", "Training")}
            <div className="row">
              <a className={`btn ${active("training") ? "" : "primary"}`} href="/ipma/training">
                Training zusammenstellen
              </a>
            </div>
          </article>

          <article className={`card stack ${styles.modusKarte}`} aria-labelledby="modus-gaps">
            <p className="eyebrow">Wiederholen</p>
            <h3 id="modus-gaps">Lücken schliessen</h3>
            <p className="hint">
              12 Fragen aus deinen drei schwächsten Kompetenzen, fällige Fragen zuerst (Leitner-System mit 5 Fächern). Sofortige Rückmeldung wie im Training.
              {overview ? ` Fällig: ${overview.dueCount} ${overview.dueCount === 1 ? "Frage" : "Fragen"}.` : ""}
            </p>
            {continueRow("gaps", "Runde")}
            {errorFor("gaps")}
            <div className="row">
              <button type="button" className={`btn ${active("gaps") ? "" : "primary"}`} disabled={!overview} aria-disabled={busy !== null || undefined} onClick={() => {
                if (busy === null) void create({ mode: "gaps" })
              }}>
                {busy === "gaps" ? "Wird gestartet …" : active("gaps") ? "Neue Runde" : "Runde starten"}
              </button>
            </div>
          </article>
        </div>
      </section>

      <section aria-labelledby="regel-titel" className="card stack">
        <h2 id="regel-titel">So bestehst du</h2>
        <ol className={styles.regel}>
          <li>
            Du brauchst mindestens <strong>{PASS_PERCENT} % der Punkte</strong>: Multiple Choice zählt 1 Punkt, eine offene Frage 2 Punkte (bewertet nach Raster).
          </li>
          <li>
            Zusätzlich musst du <strong>
              {MIN_COMPETENCES} der {TOTAL_COMPETENCES} Kompetenzen
            </strong>{" "}
            nachweisen, das heisst je Kompetenz mindestens eine Frage richtig beantworten.
          </li>
          <li>Bestanden ist die Übungsprüfung nur, wenn beide Regeln erfüllt sind. Die offenen Antworten bewertest du nach der Abgabe selbst nach dem Raster.</li>
        </ol>
        <p className="hint">Die Regeln entsprechen dem Stand der Kursunterlagen; massgebend sind die Vorgaben der Zertifizierungsstelle.</p>
      </section>

      <section aria-labelledby="landkarte-titel" className="card stack">
        <h2 id="landkarte-titel">Kompetenz-Landkarte</h2>
        <p className="hint">
          Stand je Kompetenz aus deinen letzten 8 bewerteten Antworten: ab 75 % «sicher», ab 50 % «knapp», darunter «Lücke»; mit weniger als 3 Antworten «noch nicht geübt». Ein Feld öffnet Details und das Training.
        </p>
        {overview ? <CompetenceMap kind="mastery" mastery={overview.mastery} stations={stations} /> : <p className="hint">Wird geladen …</p>}
      </section>

      <section aria-labelledby="verlauf-titel" className="card stack">
        <h2 id="verlauf-titel">Verlauf und Bestwerte</h2>
        {overview && (
          <>
            <ul className={styles.fakten}>
              <li>
                <strong>{overview.bestExam ? percent(overview.bestExam.percent) : "–"}</strong> Bestwert Übungsprüfung
              </li>
              <li>
                <strong>{bestShort?.percent != null ? percent(bestShort.percent) : "–"}</strong> Bestwert Kurzprüfung
              </li>
              <li>
                <strong>{overview.recent.exam.filter((a) => a.status === "finished").length}</strong> Übungsprüfungen
              </li>
            </ul>
            <HistoryChart exams={overview.recent.exam} shorts={overview.recent.short} />
            <RecentList overview={overview} />
          </>
        )}
      </section>

      {confirm && (
        <Dialog title="Laufenden Versuch ersetzen?" onEscape={() => setConfirm(null)}>
          <p>
            In «{MODE_LABEL[confirm.body.mode]}» läuft bereits ein Versuch. Du kannst ihn fortsetzen oder neu beginnen; ein neuer Start bricht den alten ab, er lässt sich danach nicht mehr fortsetzen.
          </p>
          <div className={styles.dialogKnoepfe}>
            <a className="btn primary" href={`/ipma/${confirm.activeId}`}>
              Fortsetzen
            </a>
            <button
              type="button"
              className="btn"
              onClick={() => {
                // Der Dialog gibt den Fokus beim Schliessen an den Startknopf zurück; dieser ist während des
                // Starts nur aria-disabled, damit der Fokus nicht verloren geht
                const body = confirm.body
                setConfirm(null)
                void create({ ...body, replaceActive: true })
              }}
            >
              Neu beginnen
            </button>
            <button type="button" className="btn" onClick={() => setConfirm(null)}>
              Abbrechen
            </button>
          </div>
        </Dialog>
      )}
    </>
  )
}

const STATUS_TEXT: Record<AttemptSummary["status"], string> = {
  active: "läuft",
  submitted: "abgegeben, Selbstbewertung offen",
  finished: "abgeschlossen",
  aborted: "abgebrochen",
}

/** Letzte Versuche aller Modi mit Link zur Auswertung */
function RecentList({ overview }: { overview: OverviewView }) {
  const all = (Object.keys(overview.recent) as AttemptMode[])
    .flatMap((m) => overview.recent[m])
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
    .slice(0, 12)
  if (all.length === 0) return null
  return (
    <details>
      <summary>Letzte Versuche ({all.length})</summary>
      <ul className={styles.liste}>
        {all.map((a) => (
          <li key={a.id}>
            {dateTime(a.startedAt)} · {MODE_LABEL[a.mode]}
            {a.mode === "exam" ? ` (${VARIANT_LABEL[a.variant]})` : ""} · {STATUS_TEXT[a.status]}
            {a.percent !== null && a.status === "finished" ? ` · ${percent(a.percent)}` : ""}
            {(a.status === "finished" || a.status === "submitted") && (
              <>
                {" "}
                · <a href={`/ipma/${a.id}/auswertung`}>{a.status === "submitted" ? "Selbstbewertung fortsetzen" : "Auswertung"}</a>
              </>
            )}
          </li>
        ))}
      </ul>
    </details>
  )
}
