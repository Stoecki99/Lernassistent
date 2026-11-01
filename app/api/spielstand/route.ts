// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// GET /api/spielstand?fach=avsw
// Auth: erforderlich, Rate-Limit 60/min
// Gibt die Bestwerte der Modellierspiele des eingeloggten Kontos fuer ein Fach zurueck:
// [{ spiel, level, sterne, xp, aktualisiert }]

// POST /api/spielstand
// Auth: erforderlich, Rate-Limit 60/min
// Body: { fach, spiel, level, sterne (0–3), xp (0–500) }
// Speichert den Bestwert (mehr Sterne, bei Gleichstand mehr XP); schlechtere Werte aendern nichts.
// Punkte ins Konto = Verbesserung der besten XP ÷ 10 (abgerundet). Prueft danach die Spiel-Abzeichen.
// Antwort: { ok: true, verbessert, punkte, abzeichen }
// Vertrag: docs/architektur-modell.md (Abschnitt 8)

import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { ladeFach } from "@/lib/lernseiten"
import { checkAndAwardSpielBadges } from "@/lib/badges"
import {
  KEIN_CACHE,
  SpielstandVollFehler,
  limitAntwort,
  pruefeSpielstandLimit,
  speichereSpielstand,
} from "@/lib/spielstand"
import { spielstandAbfrageSchema, spielstandEingabeSchema } from "@/lib/validations/spielstand"

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser()
    if (!user?.id) {
      return NextResponse.json({ error: "Nicht autorisiert." }, { status: 401 })
    }
    if (!pruefeSpielstandLimit(user.id, "lesen")) return limitAntwort()

    const { searchParams } = new URL(request.url)
    const parsed = spielstandAbfrageSchema.safeParse({ fach: searchParams.get("fach") })
    if (!parsed.success) {
      return NextResponse.json({ error: "Ungültiges Fach." }, { status: 400 })
    }

    const eintraege = await prisma.spielstand.findMany({
      where: { userId: user.id, fach: parsed.data.fach },
      select: { spiel: true, level: true, sterne: true, xp: true, updatedAt: true },
      orderBy: [{ spiel: "asc" }, { level: "asc" }],
    })

    return NextResponse.json(
      eintraege.map((eintrag) => ({
        spiel: eintrag.spiel,
        level: eintrag.level,
        sterne: eintrag.sterne,
        xp: eintrag.xp,
        aktualisiert: eintrag.updatedAt.toISOString(),
      })),
      { headers: KEIN_CACHE },
    )
  } catch (error) {
    console.error("[spielstand/GET]", error)
    return NextResponse.json(
      { error: "Spielstand konnte nicht geladen werden." },
      { status: 500 },
    )
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser()
    if (!user?.id) {
      return NextResponse.json({ error: "Nicht autorisiert." }, { status: 401 })
    }
    if (!pruefeSpielstandLimit(user.id, "schreiben")) return limitAntwort()

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: "Ungültige Eingabe." }, { status: 400 })
    }

    const parsed = spielstandEingabeSchema.safeParse(body)
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message ?? "Ungültige Eingabe."
      return NextResponse.json({ error: firstError }, { status: 400 })
    }

    const eingabe = parsed.data
    if (!ladeFach(eingabe.fach)) {
      return NextResponse.json({ error: "Unbekanntes Fach." }, { status: 400 })
    }

    let ergebnis
    try {
      ergebnis = await speichereSpielstand(user.id, eingabe)
    } catch (error) {
      if (error instanceof SpielstandVollFehler) {
        return NextResponse.json({ error: "Zu viele Spielstände in diesem Fach." }, { status: 409 })
      }
      throw error
    }

    // Abzeichen nur nach einer Verbesserung; ein Fehler dabei macht das Speichern nicht rückgängig
    let abzeichen: Awaited<ReturnType<typeof checkAndAwardSpielBadges>> = []
    if (ergebnis.verbessert) {
      try {
        abzeichen = await checkAndAwardSpielBadges(user.id)
      } catch (error) {
        console.error("[spielstand/POST] Abzeichen", error)
      }
    }

    return NextResponse.json(
      { ok: true, verbessert: ergebnis.verbessert, punkte: ergebnis.punkte, abzeichen },
      { headers: KEIN_CACHE },
    )
  } catch (error) {
    console.error("[spielstand/POST]", error)
    return NextResponse.json(
      { error: "Spielstand konnte nicht gespeichert werden." },
      { status: 500 },
    )
  }
}
