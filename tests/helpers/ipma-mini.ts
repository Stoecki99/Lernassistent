// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// tests/helpers/ipma-mini.ts
// Mini-Pool für die Tests des Prüfungssimulators (Spezifikation 7): synthetische Kurztexte, erzeugt im Code
// statt als Fixture-Dateien (bleibt klein und passt sich an COMPETENCES an). Nur für Tests.

import { COMPETENCE_IDS, getCompetence, type CompetenceId } from "@/lib/ipma/competences"
import { buildPool } from "@/lib/ipma/pool"
import type { PoolQuestion } from "@/lib/validations/ipma-pool"

export type RawQuestion = Record<string, unknown>
export interface RawFile { kompetenz: string; herkunft: string; fragen: RawQuestion[] }

const pad = (n: number) => String(n).padStart(2, "0")

/** Gültige MC-Frage (Rohdaten) */
export function rawMc(competence: CompetenceId, n: number, status = "geprueft"): RawQuestion {
  const c = getCompetence(competence)
  const tag = `${competence}/${n}`
  return {
    id: `${competence}-mc-${pad(n)}`,
    kompetenz: competence,
    typ: "mc",
    schwierigkeit: 1,
    frage: `Testfrage ${tag}: Welche Aussage trifft für den Testfall ${tag} zu?`,
    optionen: [`Aussage eins zu ${tag}`, `Aussage zwei zu ${tag}`, `Aussage drei zu ${tag}`, `Aussage vier zu ${tag}`],
    richtig: n % 4,
    erklaerung: `Erklärung zu ${tag}: Diese Aussage stimmt, die anderen drei stimmen im Testfall nicht.`,
    fundstelle: { icb: { seite: c.icbPage, indikatoren: [`${competence}.${pad(((n - 1) % c.kciCount) + 1)}`] } },
    status,
    version: 1,
  }
}

/** Gültige offene Frage (Rohdaten) */
export function rawOpen(competence: CompetenceId, n: number, status = "geprueft"): RawQuestion {
  const c = getCompetence(competence)
  const tag = `${competence}/${n}`
  return {
    id: `${competence}-of-${pad(n)}`,
    kompetenz: competence,
    typ: "offen",
    schwierigkeit: 2,
    frage: `Offene Testfrage ${tag}: Nenne zwei Punkte zum Testfall ${tag} und begründe sie.`,
    musterloesung: `Musterlösung zu ${tag}: Erster Punkt mit Begründung, zweiter Punkt mit Begründung, weitere richtige Varianten sind möglich.`,
    bewertungsraster: [
      { kriterium: `Erster Punkt zu ${tag} genannt`, punkte: 2 },
      { kriterium: `Zweiter Punkt zu ${tag} genannt`, punkte: 2 },
    ],
    fundstelle: { icb: { seite: c.icbPage, indikatoren: [`${competence}.01`] } },
    status,
    version: 1,
  }
}

/** Rohdaten aller 28 Dateien mit je `mc` MC- und `offen` offenen Fragen */
export function miniSources(mc = 3, offen = 2): RawFile[] {
  return COMPETENCE_IDS.map((id) => ({
    kompetenz: id,
    herkunft: "eigen",
    fragen: [
      ...Array.from({ length: mc }, (_, i) => rawMc(id, i + 1)),
      ...Array.from({ length: offen }, (_, i) => rawOpen(id, i + 1)),
    ],
  }))
}

/** Geprüfter Mini-Pool als Fragenliste */
export function miniPool(mc = 3, offen = 2, edit?: (files: RawFile[]) => void): PoolQuestion[] {
  const sources = miniSources(mc, offen)
  edit?.(sources)
  return buildPool(sources, null).questions
}

/** Datei einer Kompetenz in den Rohdaten */
export function fileOf(files: RawFile[], competence: CompetenceId): RawFile {
  const f = files.find((x) => x.kompetenz === competence)
  if (!f) throw new Error(`Datei ${competence} fehlt im Mini-Pool`)
  return f
}
