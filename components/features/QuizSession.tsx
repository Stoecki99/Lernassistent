"use client"

// components/features/QuizSession.tsx
// Orchestriert den Quiz-Flow: Laden -> Fragen beantworten -> Ergebnis anzeigen.

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import QuizCard from "@/components/features/QuizCard"
import QuizErgebnis from "@/components/features/QuizErgebnis"
import ProgressBar from "@/components/ui/ProgressBar"

interface DeckInfo {
  id: string
  name: string
  color: string
  icon: string
  cardCount: number
}

interface QuizQuestion {
  id: string
  question: string
  options?: string[]
  type: "multiple_choice" | "true_false" | "free_text"
}

interface Answer {
  questionId: string
  userAnswer: string
  question: string
}

interface EvaluationResult {
  questionId: string
  correct: boolean
  correctAnswer: string
  userAnswer: string
  explanation?: string
}

interface EvaluationSummary {
  totalQuestions: number
  correctAnswers: number
  score: number
  isPerfect: boolean
}

type QuizState = "loading" | "quiz" | "evaluating" | "result"

interface QuizSessionProps {
  deck: DeckInfo
  quizType: "multiple_choice" | "true_false" | "free_text"
  questionCount: 5 | 10 | 15 | 20
}

export default function QuizSession({
  deck,
  quizType,
  questionCount,
}: QuizSessionProps) {
  const [state, setState] = useState<QuizState>("loading")
  const [questions, setQuestions] = useState<QuizQuestion[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState<Answer[]>([])
  const [results, setResults] = useState<EvaluationResult[]>([])
  const [summary, setSummary] = useState<EvaluationSummary | null>(null)
  const [quizToken, setQuizToken] = useState<string>("")
  const [error, setError] = useState<string | null>(null)

  const loadQuiz = useCallback(async () => {
    setState("loading")
    setError(null)
    setCurrentIndex(0)
    setAnswers([])
    setResults([])
    setSummary(null)

    try {
      const res = await fetch("/api/quiz/generieren", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deckId: deck.id,
          quizType,
          questionCount,
        }),
      })

      if (!res.ok) {
        const data: { error?: string } = await res.json()
        throw new Error(data.error ?? "Quiz konnte nicht geladen werden.")
      }

      const data: { questions: QuizQuestion[]; quizToken: string } =
        await res.json()
      setQuestions(data.questions)
      setQuizToken(data.quizToken)
      setState("quiz")
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unbekannter Fehler"
      setError(message)
      setState("loading")
    }
  }, [deck.id, quizType, questionCount])

  useEffect(() => {
    void loadQuiz()
  }, [loadQuiz])

  const handleAnswer = (questionId: string, userAnswer: string) => {
    const currentQuestion = questions[currentIndex]
    if (!currentQuestion) return

    const newAnswer: Answer = {
      questionId,
      userAnswer,
      question: currentQuestion.question,
    }
    const updatedAnswers = [...answers, newAnswer]
    setAnswers(updatedAnswers)

    if (currentIndex + 1 < questions.length) {
      setCurrentIndex(currentIndex + 1)
    } else {
      void evaluateQuiz(updatedAnswers)
    }
  }

  const evaluateQuiz = async (allAnswers: Answer[]) => {
    setState("evaluating")

    try {
      const res = await fetch("/api/quiz/bewerten", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deckId: deck.id,
          quizType,
          quizToken,
          answers: allAnswers.map((a) => ({
            questionId: a.questionId,
            userAnswer: a.userAnswer,
            question: a.question,
          })),
        }),
      })

      if (!res.ok) {
        const data: { error?: string } = await res.json()
        throw new Error(data.error ?? "Bewertung fehlgeschlagen.")
      }

      const data: {
        results: EvaluationResult[]
        summary: EvaluationSummary
      } = await res.json()

      setResults(data.results)
      setSummary(data.summary)
      setState("result")
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Bewertung fehlgeschlagen"
      setError(message)
      setState("quiz")
    }
  }

  const handleRetry = () => {
    void loadQuiz()
  }

  // Loading
  if (state === "loading") {
    if (error) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
          <p className="text-red-500 font-semibold mb-4">{error}</p>
          <button
            onClick={() => void loadQuiz()}
            className="px-6 py-3 bg-primary text-white font-bold rounded-xl shadow-button hover:bg-primary-dark btn-press"
          >
            Erneut versuchen
          </button>
          <Link
            href="/quiz"
            className="mt-3 text-text-light hover:text-text-dark font-semibold transition-colors"
          >
            Zurueck zur Quiz-Auswahl
          </Link>
        </div>
      )
    }

    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="mt-4 text-text-light">Quiz wird geladen...</p>
      </div>
    )
  }

  // Evaluating
  if (state === "evaluating") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="w-10 h-10 border-4 border-secondary border-t-transparent rounded-full animate-spin" />
        <p className="mt-4 text-text-light">
          {quizType === "free_text"
            ? "KI bewertet deine Antworten..."
            : "Ergebnis wird berechnet..."}
        </p>
      </div>
    )
  }

  // Result
  if (state === "result" && summary) {
    const detailsWithQuestions = results.map((r, idx) => ({
      ...r,
      question: answers[idx]?.question ?? "Frage",
    }))

    return (
      <QuizErgebnis
        deckId={deck.id}
        totalQuestions={summary.totalQuestions}
        correctAnswers={summary.correctAnswers}
        score={summary.score}
        isPerfect={summary.isPerfect}
        details={detailsWithQuestions}
        quizType={quizType}
        onRetry={handleRetry}
      />
    )
  }

  // Quiz
  const currentQuestion = questions[currentIndex]
  if (!currentQuestion) return null

  return (
    <div className="flex flex-col min-h-[60vh]">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <Link
          href="/quiz"
          className="text-text-light hover:text-text-dark transition-colors"
          aria-label="Zurueck zur Quiz-Auswahl"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </Link>
        <h1 className="text-lg font-bold text-text-dark truncate mx-4">
          {deck.icon} {deck.name}
        </h1>
        <span className="text-sm text-text-light whitespace-nowrap">
          {currentIndex + 1}/{questions.length}
        </span>
      </div>

      {/* Fortschrittsbalken */}
      <div className="mb-6">
        <ProgressBar
          value={currentIndex}
          max={questions.length}
          color="primary"
          size="sm"
        />
      </div>

      {/* Fehler */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm text-center">
          {error}
        </div>
      )}

      {/* Aktuelle Frage */}
      <QuizCard
        key={currentQuestion.id + "-" + String(currentIndex)}
        question={currentQuestion}
        questionIndex={currentIndex}
        totalQuestions={questions.length}
        onAnswer={handleAnswer}
      />
    </div>
  )
}
