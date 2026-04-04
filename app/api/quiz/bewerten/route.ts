// POST /api/quiz/bewerten
// Auth: erforderlich
// Wertet Quiz aus, speichert Ergebnis in DB, vergibt Punkte.

import { NextResponse } from "next/server"
import { getAuthSession } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { evaluateQuizSchema } from "@/lib/validations/quiz"
import { anthropic, QUIZ_EVALUATOR_PROMPT } from "@/lib/claude"
import { checkAndAwardBadges } from "@/lib/badges"
import { verifyQuizToken } from "@/lib/quiz-token"

/** Punkte pro richtige Antwort */
const POINTS_PER_CORRECT = 5
/** Bonus bei 100% */
const PERFECT_BONUS = 50

interface EvaluationResult {
  questionId: string
  correct: boolean
  correctAnswer: string
  userAnswer: string
  explanation?: string
}

/** Bewertet eine Freitext-Antwort mit Claude */
async function evaluateFreeText(
  question: string,
  expectedAnswer: string,
  userAnswer: string
): Promise<{ correct: boolean; explanation: string }> {
  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 200,
      system: QUIZ_EVALUATOR_PROMPT,
      messages: [
        {
          role: "user",
          content: `Frage: ${question}\nErwartete Antwort: ${expectedAnswer}\nAntwort des Studenten: ${userAnswer}`,
        },
      ],
    })

    const text =
      response.content[0]?.type === "text" ? response.content[0].text : ""
    const parsed: { correct: boolean; explanation: string } = JSON.parse(text)
    return {
      correct: parsed.correct === true,
      explanation: parsed.explanation ?? "",
    }
  } catch (error) {
    console.error("[quiz/bewerten] Claude-Fehler:", error)
    // Fallback: exakter Vergleich (case-insensitive, trimmed)
    const correct =
      userAnswer.trim().toLowerCase() === expectedAnswer.trim().toLowerCase()
    return {
      correct,
      explanation: correct
        ? "Richtig!"
        : `Die erwartete Antwort war: ${expectedAnswer}`,
    }
  }
}

export async function POST(request: Request) {
  try {
    const session = await getAuthSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Nicht autorisiert." }, { status: 401 })
    }

    const body: unknown = await request.json()
    const parsed = evaluateQuizSchema.safeParse(body)

    if (!parsed.success) {
      const firstError =
        parsed.error.issues[0]?.message ?? "Ungueltige Eingabe."
      return NextResponse.json({ error: firstError }, { status: 400 })
    }

    const { deckId, quizType, quizToken, answers } = parsed.data

    // Quiz-Token verifizieren und korrekte Antworten serverseitig laden
    const tokenAnswers = verifyQuizToken(quizToken)
    if (!tokenAnswers) {
      return NextResponse.json(
        { error: "Ungueltiges oder manipuliertes Quiz-Token." },
        { status: 400 }
      )
    }

    // Korrekte Antworten als Map fuer schnellen Zugriff
    const correctAnswerMap = new Map(
      tokenAnswers.map((a) => [a.questionId, a.correctAnswer])
    )

    // Deck-Ownership pruefen
    const deck = await prisma.deck.findFirst({
      where: { id: deckId, userId: session.user.id },
      select: { id: true },
    })

    if (!deck) {
      return NextResponse.json(
        { error: "Deck nicht gefunden." },
        { status: 404 }
      )
    }

    const results: EvaluationResult[] = []

    for (const answer of answers) {
      const correctAnswer = correctAnswerMap.get(answer.questionId)
      if (!correctAnswer) {
        return NextResponse.json(
          { error: "Frage-ID stimmt nicht mit dem Quiz ueberein." },
          { status: 400 }
        )
      }

      if (quizType === "free_text") {
        // Freitext: Claude bewertet semantisch
        const evaluation = await evaluateFreeText(
          answer.question,
          correctAnswer,
          answer.userAnswer
        )
        results.push({
          questionId: answer.questionId,
          correct: evaluation.correct,
          correctAnswer,
          userAnswer: answer.userAnswer,
          explanation: evaluation.explanation,
        })
      } else {
        // MC und Wahr/Falsch: exakter Vergleich der Antwort
        const correct =
          answer.userAnswer.trim().toLowerCase() ===
          correctAnswer.trim().toLowerCase()
        results.push({
          questionId: answer.questionId,
          correct,
          correctAnswer,
          userAnswer: answer.userAnswer,
        })
      }
    }

    const correctCount = results.filter((r) => r.correct).length
    const totalQuestions = results.length
    const isPerfect = correctCount === totalQuestions

    let score = correctCount * POINTS_PER_CORRECT
    if (isPerfect && totalQuestions > 0) {
      score += PERFECT_BONUS
    }

    // QuizResult in DB speichern + Punkte gutschreiben
    await prisma.$transaction([
      prisma.quizResult.create({
        data: {
          userId: session.user.id,
          deckId,
          quizType,
          totalQuestions,
          correctAnswers: correctCount,
          score,
        },
      }),
      prisma.user.update({
        where: { id: session.user.id },
        data: { points: { increment: score } },
      }),
    ])

    // Badge-Pruefung
    const newBadges = await checkAndAwardBadges(session.user.id)

    return NextResponse.json({
      results,
      summary: {
        totalQuestions,
        correctAnswers: correctCount,
        score,
        isPerfect,
      },
      newBadges,
    })
  } catch (error) {
    console.error("[quiz/bewerten]", error)
    return NextResponse.json(
      { error: "Quiz konnte nicht ausgewertet werden." },
      { status: 500 }
    )
  }
}
