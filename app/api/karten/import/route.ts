// POST /api/karten/import
// Auth: erforderlich
// Importiert Karten aus CSV oder Anki-Format in ein Deck.
// CSV-Format: Vorderseite;Hinweis;Rueckseite oder Vorderseite;Rueckseite
// Anki-Format: Tab-getrennte .txt Dateien (optional 3 Spalten mit Hinweis)
// Max 500 Karten pro Import, max 5 MB Dateigroesse

import { NextResponse } from "next/server"
import { getAuthSession } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { importSchema } from "@/lib/validations/import"
import { checkStorageLimit, estimateCardBytes, incrementStorageUsed } from "@/lib/subscription"

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5 MB
const MAX_CARDS = 500
const MAX_FIELD_LENGTH = 2000
const MAX_HINT_LENGTH = 500

interface ParseError {
  line: number
  message: string
}

interface ParsedCard {
  front: string
  back: string
  hint: string | null
}

interface ParseResult {
  cards: ParsedCard[]
  errors: ParseError[]
}

function isCsvHeader(line: string): boolean {
  const lower = line.toLowerCase()
  return (
    (lower.includes("vorderseite") && lower.includes("rueckseite")) ||
    (lower.includes("front") && lower.includes("back")) ||
    (lower.includes("frage") && lower.includes("antwort")) ||
    (lower.includes("question") && lower.includes("answer"))
  )
}

function parseCsv(content: string): ParseResult {
  const lines = content.split(/\r?\n/).filter((line) => line.trim() !== "")
  const cards: ParsedCard[] = []
  const errors: ParseError[] = []

  const startIndex = lines.length > 0 && isCsvHeader(lines[0]) ? 1 : 0

  for (let i = startIndex; i < lines.length; i++) {
    const lineNumber = i + 1
    const line = lines[i]

    if (!line.includes(";")) {
      errors.push({ line: lineNumber, message: "Kein Semikolon gefunden. Format: Vorderseite;Rückseite" })
      continue
    }

    const parts = line.split(";")
    let front: string
    let hint: string | null
    let back: string

    if (parts.length >= 3) {
      // 3-Spalten-Format: Vorderseite;Hinweis;Rueckseite
      front = parts[0].trim()
      hint = parts[1].trim() || null
      back = parts.slice(2).join(";").trim()
    } else {
      // 2-Spalten-Format: Vorderseite;Rueckseite
      front = parts[0].trim()
      hint = null
      back = parts[1].trim()
    }

    if (!front) {
      errors.push({ line: lineNumber, message: "Vorderseite ist leer." })
      continue
    }

    if (!back) {
      errors.push({ line: lineNumber, message: "Rückseite ist leer." })
      continue
    }

    if (front.length > MAX_FIELD_LENGTH) {
      errors.push({ line: lineNumber, message: `Vorderseite ist zu lang (max. ${MAX_FIELD_LENGTH} Zeichen).` })
      continue
    }

    if (back.length > MAX_FIELD_LENGTH) {
      errors.push({ line: lineNumber, message: `Rueckseite ist zu lang (max. ${MAX_FIELD_LENGTH} Zeichen).` })
      continue
    }

    if (hint && hint.length > MAX_HINT_LENGTH) {
      errors.push({ line: lineNumber, message: `Hinweis ist zu lang (max. ${MAX_HINT_LENGTH} Zeichen).` })
      continue
    }

    cards.push({ front, back, hint })
  }

  return { cards, errors }
}

function parseAnki(content: string): ParseResult {
  const lines = content.split(/\r?\n/).filter((line) => line.trim() !== "")
  const cards: ParsedCard[] = []
  const errors: ParseError[] = []

  for (let i = 0; i < lines.length; i++) {
    const lineNumber = i + 1
    const line = lines[i]

    // Anki-Kommentarzeilen ueberspringen
    if (line.startsWith("#") || line.startsWith("tags:")) {
      continue
    }

    if (!line.includes("\t")) {
      errors.push({ line: lineNumber, message: "Kein Tab-Trennzeichen gefunden. Anki-Format: Vorderseite[TAB]Rückseite" })
      continue
    }

    const parts = line.split("\t")
    const front = parts[0].trim()
    let hint: string | null = null
    let back: string

    if (parts.length >= 3) {
      hint = parts[1].trim() || null
      back = parts[2]?.trim() ?? ""
    } else {
      back = parts[1]?.trim() ?? ""
    }

    if (!front) {
      errors.push({ line: lineNumber, message: "Vorderseite ist leer." })
      continue
    }

    if (!back) {
      errors.push({ line: lineNumber, message: "Rückseite ist leer." })
      continue
    }

    if (front.length > MAX_FIELD_LENGTH) {
      errors.push({ line: lineNumber, message: `Vorderseite ist zu lang (max. ${MAX_FIELD_LENGTH} Zeichen).` })
      continue
    }

    if (back.length > MAX_FIELD_LENGTH) {
      errors.push({ line: lineNumber, message: `Rueckseite ist zu lang (max. ${MAX_FIELD_LENGTH} Zeichen).` })
      continue
    }

    if (hint && hint.length > MAX_HINT_LENGTH) {
      errors.push({ line: lineNumber, message: `Hinweis ist zu lang (max. ${MAX_HINT_LENGTH} Zeichen).` })
      continue
    }

    cards.push({ front, back, hint })
  }

  return { cards, errors }
}

export async function POST(request: Request) {
  try {
    const session = await getAuthSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Nicht autorisiert." }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get("file")
    const deckId = formData.get("deckId")
    const format = formData.get("format")

    const parsed = importSchema.safeParse({ deckId, format })
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message ?? "Ungültige Eingabe."
      return NextResponse.json({ error: firstError }, { status: 400 })
    }

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Bitte lade eine Datei hoch." }, { status: 400 })
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "Die Datei ist zu gross. Maximale Grösse: 5 MB." },
        { status: 400 }
      )
    }

    // Ownership pruefen
    const deck = await prisma.deck.findUnique({
      where: { id: parsed.data.deckId, userId: session.user.id },
      select: { id: true },
    })

    if (!deck) {
      return NextResponse.json({ error: "Deck nicht gefunden." }, { status: 404 })
    }

    const content = await file.text()

    const result = parsed.data.format === "csv"
      ? parseCsv(content)
      : parseAnki(content)

    if (result.cards.length === 0) {
      return NextResponse.json(
        {
          error: "Keine gültigen Karten gefunden.",
          errors: result.errors,
          imported: 0,
        },
        { status: 400 }
      )
    }

    if (result.cards.length > MAX_CARDS) {
      return NextResponse.json(
        { error: `Maximal ${MAX_CARDS} Karten pro Import. Datei enthaelt ${result.cards.length} Karten.` },
        { status: 400 }
      )
    }

    // Speicherlimit pruefen
    const totalBytes = result.cards.reduce(
      (sum, card) => sum + estimateCardBytes(card.front, card.back, card.hint),
      0
    )
    const { allowed } = await checkStorageLimit(session.user.id, totalBytes)
    if (!allowed) {
      return NextResponse.json(
        { error: "Speicherlimit erreicht. Lösche Karten oder upgrade auf Pro." },
        { status: 403 }
      )
    }

    // Bulk-Insert
    const created = await prisma.card.createMany({
      data: result.cards.map((card) => ({
        front: card.front,
        back: card.back,
        hint: card.hint,
        deckId: parsed.data.deckId,
      })),
    })

    // Speicherverbrauch aktualisieren
    await incrementStorageUsed(session.user.id, totalBytes)

    return NextResponse.json({
      message: `${created.count} ${created.count === 1 ? "Karte" : "Karten"} erfolgreich importiert!`,
      imported: created.count,
      errors: result.errors,
    })
  } catch (error) {
    console.error("[karten/import]", error)
    return NextResponse.json(
      { error: "Import fehlgeschlagen." },
      { status: 500 }
    )
  }
}
