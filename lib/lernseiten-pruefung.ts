// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// lib/lernseiten-pruefung.ts
// Gesamtpruefung aller Lernseiten-Inhalte. Nur fuer scripts/lernseiten-pruefen.ts
// und Tests — bewusst getrennt von lib/lernseiten.ts, damit das Output-Tracing
// der Seiten den Quellordner app/ nicht ins Image kopiert.

import fs from "node:fs"
import path from "node:path"
import { fachSchema, seiteSchema, filmSchema, quizSchema, spickSchema, type Film } from "@/lib/validations/lernseite"
import { szenenAufloesen } from "@/lib/lernseiten-film"
import { STANDARD_BASIS, FACH_ORDNER, THEMA_ORDNER, unterordner, lese } from "@/lib/lernseiten"

/** Namen der Seiten auf oberster Ebene der App (inkl. Routen-Gruppen wie (dashboard)). */
export function appSeiten(appPfad = path.join(process.cwd(), "app")): string[] {
  const namen: string[] = []
  for (const name of unterordner(appPfad)) {
    if (name.startsWith("(") && name.endsWith(")")) {
      namen.push(...unterordner(path.join(appPfad, name)))
    } else {
      namen.push(name)
    }
  }
  return namen
    .filter((name) => !name.startsWith("[") && !name.startsWith("_"))
    .map((name) => name.toLowerCase())
}

function pruefeFilm(film: Film, name: string): string[] {
  const fehler: string[] = []
  const phIds = new Set(
    film.texte.flatMap((t) => [...t.matchAll(/data-ph="([^"]+)"/g)].map((m) => m[1])),
  )

  szenenAufloesen(film.szenen).forEach((szene, i) => {
    const nr = `${name}: Szene ${i + 1}`
    if (szene.phase >= film.phasen.length) {
      fehler.push(`${nr}: phase ${szene.phase} gibt es nicht.`)
    }
    if (typeof szene.text === "number" && szene.text >= film.texte.length) {
      fehler.push(`${nr}: texte[${szene.text}] gibt es nicht.`)
    }
    for (const id of szene.hl) {
      if (!phIds.has(id)) fehler.push(`${nr}: data-ph «${id}» kommt in texte nicht vor.`)
    }
    if (szene.wb > film.woerterbuch.length) {
      fehler.push(`${nr}: wb ${szene.wb} ist grösser als das Wörterbuch.`)
    }
    for (const index of szene.wbAktiv) {
      if (index >= szene.wb) {
        fehler.push(`${nr}: wbAktiv ${index} ist nicht sichtbar (wb ${szene.wb}).`)
      }
    }
  })
  return fehler
}

/**
 * Prueft alle Inhalte und gibt eine Liste von Fehlermeldungen zurueck (leer = alles gut).
 * `reserviert`: Namen von App-Seiten, die nicht als Fachordner verwendet werden duerfen.
 */
export function pruefeAlleInhalte(basis = STANDARD_BASIS, reserviert: string[] = appSeiten()): string[] {
  const fehler: string[] = []
  const quizIds = new Map<string, string>()

  const versuche = <T>(fn: () => T): T | null => {
    try {
      return fn()
    } catch (error) {
      fehler.push((error as Error).message)
      return null
    }
  }

  for (const ordner of unterordner(basis)) {
    if (!FACH_ORDNER.test(ordner)) {
      fehler.push(`${ordner}: Fachordner nur mit a-z und 0-9.`)
      continue
    }
    if (reserviert.includes(ordner)) {
      fehler.push(`${ordner}: Fachordner heisst wie eine App-Seite (/${ordner}).`)
    }

    const pfad = path.join(basis, ordner)
    const fach = versuche(() => lese(path.join(pfad, "fach.json"), fachSchema, basis))
    if (!fach) continue
    if (fach.kuerzel.toLowerCase() !== ordner) {
      fehler.push(`${ordner}: Kürzel «${fach.kuerzel}» passt nicht zum Ordnernamen.`)
    }
    const sektionen = new Set(fach.sektionen.map((s) => s.id))

    for (const thema of unterordner(pfad)) {
      if (!THEMA_ORDNER.test(thema)) {
        fehler.push(`${ordner}/${thema}: Themenordner muss «NN-slug» heissen.`)
        continue
      }
      const name = `${ordner}/${thema}`
      const themaPfad = path.join(pfad, thema)

      const seite = versuche(() => lese(path.join(themaPfad, "seite.json"), seiteSchema, basis))
      if (seite && !sektionen.has(seite.sektion)) {
        fehler.push(`${name}/seite.json: Sektion «${seite.sektion}» gibt es in fach.json nicht.`)
      }

      const film = versuche(() => lese(path.join(themaPfad, "film.json"), filmSchema, basis))
      if (film) fehler.push(...pruefeFilm(film, `${name}/film.json`))

      const quiz = versuche(() => lese(path.join(themaPfad, "quiz.json"), quizSchema, basis))
      const praefix = `${ordner}-${thema.slice(0, 2)}-`
      for (const frage of quiz ?? []) {
        if (!frage.id.startsWith(praefix)) {
          fehler.push(`${name}/quiz.json: Quiz-ID «${frage.id}» muss mit «${praefix}» beginnen.`)
        }
        const frueher = quizIds.get(frage.id)
        if (frueher) {
          fehler.push(`${name}/quiz.json: Quiz-ID «${frage.id}» ist doppelt (auch in ${frueher}).`)
        }
        quizIds.set(frage.id, name)
      }

      versuche(() => lese(path.join(themaPfad, "spick.json"), spickSchema, basis))
    }
  }
  return fehler
}
