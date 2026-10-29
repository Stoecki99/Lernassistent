// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// lib/validations/lernfortschritt.ts
// Zod-Schemas und Schreibregeln fuer GET/POST /api/lernfortschritt.
// Vertrag: docs/lernpfad-format.md (Abschnitt Fortschritts-API)

import { z } from "zod"

export const LERN_STATUS = ["begonnen", "erledigt"] as const
export type LernStatus = (typeof LERN_STATUS)[number]

const fachFeld = z.string().max(40).regex(/^[a-z0-9]+$/, "Ungültiges Fach.")
const themaFeld = z.string().max(100).regex(/^\d{2}-[a-z0-9-]+$/, "Ungültiges Thema.")
// null zaehlt wie «nicht angegeben»
const quizZahl = z
  .number({ message: "Quiz-Werte müssen ganze Zahlen sein." })
  .int("Quiz-Werte müssen ganze Zahlen sein.")
  .min(0, "Quiz-Werte dürfen nicht negativ sein.")
  .max(1000, "Quiz-Werte sind zu gross.")
  .nullish()

/** Query von GET /api/lernfortschritt?fach=… */
export const fortschrittAbfrageSchema = z.object({
  fach: fachFeld,
})

/** Body von POST /api/lernfortschritt. Quiz-Werte werden zu `quiz` (beide oder null). */
export const fortschrittEingabeSchema = z
  .object({
    fach: fachFeld,
    thema: themaFeld,
    status: z.enum(LERN_STATUS, { message: "Status muss «begonnen» oder «erledigt» sein." }),
    quizRichtig: quizZahl,
    quizGesamt: quizZahl,
  })
  .superRefine((eingabe, ctx) => {
    const richtig = eingabe.quizRichtig ?? null
    const gesamt = eingabe.quizGesamt ?? null
    if ((richtig === null) !== (gesamt === null)) {
      ctx.addIssue({
        code: "custom",
        path: ["quizRichtig"],
        message: "quizRichtig und quizGesamt nur zusammen angeben.",
      })
    } else if (richtig !== null && gesamt !== null && richtig > gesamt) {
      ctx.addIssue({
        code: "custom",
        path: ["quizRichtig"],
        message: "quizRichtig darf nicht grösser als quizGesamt sein.",
      })
    }
  })
  .transform(({ fach, thema, status, quizRichtig, quizGesamt }) => ({
    fach,
    thema,
    status,
    quiz:
      quizRichtig != null && quizGesamt != null ? { richtig: quizRichtig, gesamt: quizGesamt } : null,
  }))

export type FortschrittEingabe = z.output<typeof fortschrittEingabeSchema>

/**
 * Felder fuer das Upsert:
 * - «erledigt» wird nie auf «begonnen» zurueckgestuft (update setzt status nur bei «erledigt»).
 * - Ein neues Quiz-Ergebnis ersetzt das alte; ohne Quiz bleibt das gespeicherte stehen.
 */
export function fortschrittSchreibdaten(eingabe: FortschrittEingabe) {
  const quiz = eingabe.quiz ? { quizRichtig: eingabe.quiz.richtig, quizGesamt: eingabe.quiz.gesamt } : {}
  return {
    create: { status: eingabe.status, ...quiz },
    update: { ...(eingabe.status === "erledigt" ? { status: eingabe.status } : {}), ...quiz },
  }
}
