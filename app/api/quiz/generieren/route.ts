// POST /api/quiz/generieren
// Auth: erforderlich
// Generiert Quiz-Fragen aus einem Deck basierend auf Quiz-Typ und Fragenanzahl.
// correctAnswer wird NICHT an den Client gesendet — stattdessen wird ein signiertes
// quizToken mitgeschickt, das die korrekten Antworten serverseitig verifizierbar haelt.

import { NextResponse } from "next/server"
import { getAuthSession } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { generateQuizSchema } from "@/lib/validations/quiz"
import { signQuizToken } from "@/lib/quiz-token"

interface QuizQuestionInternal {
  id: string
  question: string
  correctAnswer: string
  options?: string[]
  type: "multiple_choice" | "true_false" | "free_text"
}

interface QuizQuestionClient {
  id: string
  question: string
  options?: string[]
  type: "multiple_choice" | "true_false" | "free_text"
}

/** Mischt ein Array zufaellig (Fisher-Yates) */
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!]
  }
  return shuffled
}

/** Generiert Multiple-Choice-Fragen */
function generateMultipleChoice(
  cards: { id: string; front: string; back: string }[],
  count: number
): QuizQuestionInternal[] {
  const selected = shuffleArray(cards).slice(0, count)

  return selected.map((card) => {
    const otherCards = cards.filter((c) => c.id !== card.id)
    const distractors = shuffleArray(otherCards)
      .slice(0, 3)
      .map((c) => c.back)

    // Falls nicht genug Distraktoren: einfache Variationen
    while (distractors.length < 3) {
      distractors.push(`Nicht ${card.back}`)
    }

    const options = shuffleArray([card.back, ...distractors])

    return {
      id: card.id,
      question: card.front,
      correctAnswer: card.back,
      options,
      type: "multiple_choice" as const,
    }
  })
}

/** Generiert Wahr/Falsch-Fragen */
function generateTrueFalse(
  cards: { id: string; front: string; back: string }[],
  count: number
): QuizQuestionInternal[] {
  const selected = shuffleArray(cards).slice(0, count)

  return selected.map((card) => {
    const isCorrectPairing = Math.random() > 0.5
    const otherCards = cards.filter((c) => c.id !== card.id)

    let displayedAnswer: string
    if (isCorrectPairing) {
      displayedAnswer = card.back
    } else if (otherCards.length > 0) {
      const randomOther = otherCards[Math.floor(Math.random() * otherCards.length)]!
      displayedAnswer = randomOther.back
    } else {
      displayedAnswer = `Nicht ${card.back}`
    }

    return {
      id: card.id,
      question: `${card.front} = ${displayedAnswer}`,
      correctAnswer: isCorrectPairing ? "Wahr" : "Falsch",
      options: ["Wahr", "Falsch"],
      type: "true_false" as const,
    }
  })
}

/** Generiert Freitext-Fragen */
function generateFreeText(
  cards: { id: string; front: string; back: string }[],
  count: number
): QuizQuestionInternal[] {
  const selected = shuffleArray(cards).slice(0, count)

  return selected.map((card) => ({
    id: card.id,
    question: card.front,
    correctAnswer: card.back,
    type: "free_text" as const,
  }))
}

export async function POST(request: Request) {
  try {
    const session = await getAuthSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Nicht autorisiert." }, { status: 401 })
    }

    const body: unknown = await request.json()
    const parsed = generateQuizSchema.safeParse(body)

    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message ?? "Ungültige Eingabe."
      return NextResponse.json({ error: firstError }, { status: 400 })
    }

    const { deckId, quizType, questionCount } = parsed.data

    // Deck-Ownership pruefen
    const deck = await prisma.deck.findFirst({
      where: { id: deckId, userId: session.user.id },
      select: {
        id: true,
        name: true,
        cards: {
          select: { id: true, front: true, back: true },
        },
      },
    })

    if (!deck) {
      return NextResponse.json({ error: "Deck nicht gefunden." }, { status: 404 })
    }

    // Mindestanzahl Karten pruefen
    const minCards = quizType === "multiple_choice" ? 4 : 2
    if (deck.cards.length < minCards) {
      return NextResponse.json(
        {
          error: `Mindestens ${minCards} Karten im Deck noetig fuer diesen Quiz-Typ.`,
        },
        { status: 400 }
      )
    }

    const actualCount = Math.min(questionCount, deck.cards.length)

    let questionsInternal: QuizQuestionInternal[]
    switch (quizType) {
      case "multiple_choice":
        questionsInternal = generateMultipleChoice(deck.cards, actualCount)
        break
      case "true_false":
        questionsInternal = generateTrueFalse(deck.cards, actualCount)
        break
      case "free_text":
        questionsInternal = generateFreeText(deck.cards, actualCount)
        break
    }

    // Signiertes Token mit den korrekten Antworten erzeugen
    const quizToken = signQuizToken(
      questionsInternal.map((q) => ({
        questionId: q.id,
        correctAnswer: q.correctAnswer,
      }))
    )

    // correctAnswer aus der Client-Response entfernen
    const questions: QuizQuestionClient[] = questionsInternal.map(
      ({ correctAnswer: _removed, ...rest }) => rest
    )

    return NextResponse.json({
      deckName: deck.name,
      quizType,
      questions,
      quizToken,
    })
  } catch (error) {
    console.error("[quiz/generieren]", error)
    return NextResponse.json(
      { error: "Quiz konnte nicht generiert werden." },
      { status: 500 }
    )
  }
}
