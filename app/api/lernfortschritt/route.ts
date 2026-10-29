// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// GET /api/lernfortschritt?fach=mstw
// Auth: erforderlich
// Gibt den Lernpfad-Fortschritt des eingeloggten Kontos fuer ein Fach zurueck:
// [{ thema, status, quizRichtig, quizGesamt, aktualisiert }]

// POST /api/lernfortschritt
// Auth: erforderlich
// Body: { fach, thema, status: "begonnen" | "erledigt", quizRichtig?, quizGesamt? }
// Speichert den Stand einer Station. «erledigt» wird nie zurueckgestuft,
// ein neues Quiz-Ergebnis ersetzt das alte. Antwort: { ok: true }

import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { ladeFach } from "@/lib/lernseiten"
import {
  fortschrittAbfrageSchema,
  fortschrittEingabeSchema,
  fortschrittSchreibdaten,
} from "@/lib/validations/lernfortschritt"

const KEIN_CACHE = { "Cache-Control": "private, no-store" }

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser()
    if (!user?.id) {
      return NextResponse.json({ error: "Nicht autorisiert." }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const parsed = fortschrittAbfrageSchema.safeParse({ fach: searchParams.get("fach") })
    if (!parsed.success) {
      return NextResponse.json({ error: "Ungültiges Fach." }, { status: 400 })
    }

    const eintraege = await prisma.lernfortschritt.findMany({
      where: { userId: user.id, fach: parsed.data.fach },
      select: { thema: true, status: true, quizRichtig: true, quizGesamt: true, updatedAt: true },
      orderBy: { thema: "asc" },
    })

    return NextResponse.json(
      eintraege.map((eintrag) => ({
        thema: eintrag.thema,
        status: eintrag.status,
        quizRichtig: eintrag.quizRichtig,
        quizGesamt: eintrag.quizGesamt,
        aktualisiert: eintrag.updatedAt.toISOString(),
      })),
      { headers: KEIN_CACHE },
    )
  } catch (error) {
    console.error("[lernfortschritt/GET]", error)
    return NextResponse.json(
      { error: "Fortschritt konnte nicht geladen werden." },
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

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: "Ungültige Eingabe." }, { status: 400 })
    }

    const parsed = fortschrittEingabeSchema.safeParse(body)
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message ?? "Ungültige Eingabe."
      return NextResponse.json({ error: firstError }, { status: 400 })
    }

    const eingabe = parsed.data
    const fach = ladeFach(eingabe.fach)
    if (!fach || !fach.pfad.some((station) => station.slug === eingabe.thema)) {
      return NextResponse.json({ error: "Unbekanntes Thema." }, { status: 400 })
    }

    const daten = fortschrittSchreibdaten(eingabe)
    await prisma.lernfortschritt.upsert({
      where: {
        userId_fach_thema: { userId: user.id, fach: eingabe.fach, thema: eingabe.thema },
      },
      create: { userId: user.id, fach: eingabe.fach, thema: eingabe.thema, ...daten.create },
      // updatedAt explizit: auch ein erneutes «begonnen» ohne Aenderung zaehlt als Aktivitaet
      update: { ...daten.update, updatedAt: new Date() },
    })

    return NextResponse.json({ ok: true }, { headers: KEIN_CACHE })
  } catch (error) {
    console.error("[lernfortschritt/POST]", error)
    return NextResponse.json(
      { error: "Fortschritt konnte nicht gespeichert werden." },
      { status: 500 },
    )
  }
}
