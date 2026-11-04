// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// components/features/ipma/ResultSummary.tsx
// Ergebnis eines Versuchs (Spezifikation 4.4, 6.8 ResultSummary): Punkte mit Balken und Marke bei 60 %,
// Kompetenzen mit Grenze 23 (nur Übungsprüfung), Ergebnis mit Grund, nicht bewertete Fragen, Quellen.
// Entschieden hat der Server (Viertelpunkte); hier wird nur angezeigt.

import type { AttemptResult, AttemptView } from "@/lib/ipma/types"
import styles from "@/app/(ipma)/ipma.module.css"
import { MIN_COMPETENCES, PASS_PERCENT, TOTAL_COMPETENCES, VARIANT_LABEL, passLimit, percent, points } from "./format"

function reason(r: AttemptResult): string | null {
  if (r.passed || r.passCompetences === null) return null
  const missing = TOTAL_COMPETENCES - r.shownCount
  if (r.passPoints && !r.passCompetences) {
    return `Die Punkte reichen, aber nur ${r.shownCount} Kompetenzen sind nachgewiesen; ${missing} ohne richtige Antwort (Grenze ${MIN_COMPETENCES}).`
  }
  if (!r.passPoints && r.passCompetences) return `Genug Kompetenzen nachgewiesen, aber die Punkte liegen unter ${PASS_PERCENT} %.`
  return `Die Punkte liegen unter ${PASS_PERCENT} %, und nur ${r.shownCount} Kompetenzen sind nachgewiesen (Grenze ${MIN_COMPETENCES}).`
}

export default function ResultSummary({ view, result, provisional }: { view: AttemptView; result: AttemptResult; provisional: boolean }) {
  const examLike = view.mode === "exam" || view.mode === "short"
  const exam = view.mode === "exam"
  const width = Math.max(0, Math.min(100, result.percent))
  const why = reason(result)
  const word = !examLike ? "Ergebnis" : result.passed ? "✓ Bestanden" : "✗ Nicht bestanden"
  const cls = !examLike ? "" : result.passed ? styles.ergebnisBestanden : styles.ergebnisNicht

  return (
    <section className={`card stack ${styles.ergebnis} ${cls}`} aria-labelledby="ergebnis-titel">
      <p className="eyebrow">
        {provisional ? "Vorläufiges Ergebnis" : "Ergebnis"}
        {exam ? ` · ${VARIANT_LABEL[view.variant]}` : ""}
      </p>
      <h2 id="ergebnis-titel" className={styles.ergebnisWort}>
        {word}
      </h2>
      {provisional && <p className="hint">Offene Antworten ohne Bewertung zählen vorerst 0 Punkte. Das Ergebnis gilt, sobald du abschliesst.</p>}
      <dl className={styles.regelZeilen}>
        <div className={styles.regelZeile}>
          <dt>Punkte</dt>
          <dd>
            {points(result.pointsQ)} von {points(result.maxPointsQ)} ({percent(result.percent)})
            <div className={styles.balken} aria-hidden="true">
              <span className={styles.balkenFuellung} style={{ width: `${width}%` }} />
              <span className={styles.balkenMarke} style={{ left: `${PASS_PERCENT}%` }} />
            </div>
          </dd>
          <dd>
            {examLike ? (
              <>
                Grenze {passLimit(result.maxPointsQ)}{" "}
                <span className={result.passPoints ? styles.okText : styles.fehlerText}>{result.passPoints ? "✓ erreicht" : "✗ nicht erreicht"}</span>
              </>
            ) : (
              <span className={styles.leise}>
                {result.passPoints ? "✓" : "✗"} {PASS_PERCENT} %
              </span>
            )}
          </dd>
        </div>
        <div className={styles.regelZeile}>
          <dt>Kompetenzen</dt>
          <dd>
            {result.shownCount} von {result.competenceCount} {exam ? "nachgewiesen" : "geprüften nachgewiesen"}
            {exam && (
              <div className={styles.balken} aria-hidden="true">
                <span className={styles.balkenFuellung} style={{ width: `${(result.shownCount / TOTAL_COMPETENCES) * 100}%` }} />
                <span className={styles.balkenMarke} style={{ left: `${(MIN_COMPETENCES / TOTAL_COMPETENCES) * 100}%` }} />
              </div>
            )}
          </dd>
          <dd>
            {exam ? (
              <>
                Grenze {MIN_COMPETENCES}{" "}
                <span className={result.passCompetences ? styles.okText : styles.fehlerText}>{result.passCompetences ? "✓ erreicht" : "✗ nicht erreicht"}</span>
              </>
            ) : (
              <span className={styles.leise}>Regel 23/28 gilt nur in der Übungsprüfung</span>
            )}
          </dd>
        </div>
      </dl>
      {why && (
        <p>
          <strong>Grund:</strong> {why}
        </p>
      )}
      {exam && result.passed && view.variant === "pausable" && <p className="hint">Vermerk: mit Pausen. Die Abzeichen «Bestanden» und «Souverän» gibt es nur unter Echtbedingungen.</p>}
      {result.unassessedOpen > 0 && (
        <p className={`${styles.meldung} ${styles.meldungWarn}`}>
          {result.unassessedOpen} offene {result.unassessedOpen === 1 ? "Antwort ist" : "Antworten sind"} noch nicht bewertet und {result.unassessedOpen === 1 ? "zählt" : "zählen"} 0 Punkte.
        </p>
      )}
      {result.sources.aiPointsQ !== null && (
        <p className="hint">
          Selbst: {points(result.sources.selfPointsQ)} · Claude: {points(result.sources.aiPointsQ)} Punkte (massgebend ist Claude, wo vorhanden)
        </p>
      )}
    </section>
  )
}
