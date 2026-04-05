"use client"

// components/features/QuizErgebnis.tsx
// Ergebnis-Anzeige nach Quiz: Score, motivierende Nachricht, Details.

import Link from "next/link"

interface ResultDetail {
  questionId: string
  correct: boolean
  correctAnswer: string
  userAnswer: string
  question: string
  explanation?: string
}

interface QuizErgebnisProps {
  deckId: string
  totalQuestions: number
  correctAnswers: number
  score: number
  isPerfect: boolean
  details: ResultDetail[]
  quizType: string
  onRetry: () => void
}

function getMotivation(
  correct: number,
  total: number
): { message: string; emoji: string } {
  const percentage = total > 0 ? (correct / total) * 100 : 0

  if (percentage === 100) {
    return { message: "Perfekt! Du bist ein Genie!", emoji: "\u{1F929}" }
  }
  if (percentage >= 80) {
    return { message: "Super! Fast perfekt!", emoji: "\u{1F389}" }
  }
  if (percentage >= 60) {
    return { message: "Gut gemacht! Weiter so!", emoji: "\u{1F4AA}" }
  }
  return {
    message: "Nicht schlimm! Übung macht den Meister!",
    emoji: "\u{1F60A}",
  }
}

export default function QuizErgebnis({
  deckId,
  totalQuestions,
  correctAnswers,
  score,
  isPerfect,
  details,
  quizType,
  onRetry,
}: QuizErgebnisProps) {
  const { message, emoji } = getMotivation(correctAnswers, totalQuestions)
  const percentage =
    totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0

  return (
    <div className="w-full max-w-lg mx-auto space-y-6">
      {/* Ergebnis-Header */}
      <div className="text-center py-6">
        <span className="text-6xl block mb-4" aria-hidden="true">
          {emoji}
        </span>
        <h2 className="text-3xl font-extrabold text-text-dark mb-2">
          {correctAnswers} von {totalQuestions} richtig!
        </h2>
        <p className="text-lg text-text-light font-semibold">{message}</p>

        {/* Prozent-Ring */}
        <div className="relative inline-flex items-center justify-center mt-6">
          <svg className="w-32 h-32" viewBox="0 0 120 120">
            <circle
              cx="60"
              cy="60"
              r="50"
              fill="none"
              stroke="#E5E7EB"
              strokeWidth="10"
            />
            <circle
              cx="60"
              cy="60"
              r="50"
              fill="none"
              stroke={percentage >= 60 ? "#58CC02" : "#FF4B4B"}
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={`${percentage * 3.14} ${314 - percentage * 3.14}`}
              strokeDashoffset="78.5"
              className="transition-all duration-1000"
            />
          </svg>
          <span className="absolute text-2xl font-extrabold text-text-dark">
            {percentage}%
          </span>
        </div>
      </div>

      {/* Punkte */}
      <div className="bg-surface-card rounded-2xl shadow-card p-5 text-center">
        <p className="text-text-light text-sm font-semibold mb-1">
          Verdiente Punkte
        </p>
        <p className="text-3xl font-extrabold text-primary">+{score}</p>
        {isPerfect && (
          <p className="text-xs text-accent font-bold mt-1">
            inkl. 50 Bonus für 100%!
          </p>
        )}
      </div>

      {/* Details */}
      <div>
        <h3 className="font-bold text-text-dark mb-3">Details</h3>
        <div className="space-y-2">
          {details.map((detail, index) => (
            <div
              key={detail.questionId + "-" + String(index)}
              className={`p-4 rounded-xl border ${
                detail.correct
                  ? "bg-green-50 border-green-200"
                  : "bg-red-50 border-red-200"
              }`}
            >
              <div className="flex items-start gap-3">
                <span className="flex-shrink-0 mt-0.5">
                  {detail.correct ? (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      className="w-5 h-5 text-green-500"
                    >
                      <path
                        fillRule="evenodd"
                        d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z"
                        clipRule="evenodd"
                      />
                    </svg>
                  ) : (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      className="w-5 h-5 text-red-500"
                    >
                      <path
                        fillRule="evenodd"
                        d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zm-1.72 6.97a.75.75 0 10-1.06 1.06L10.94 12l-1.72 1.72a.75.75 0 101.06 1.06L12 13.06l1.72 1.72a.75.75 0 101.06-1.06L13.06 12l1.72-1.72a.75.75 0 10-1.06-1.06L12 10.94l-1.72-1.72z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-text-dark text-sm truncate">
                    {detail.question}
                  </p>
                  <p className="text-xs text-text-light mt-1">
                    Deine Antwort: {detail.userAnswer || "(keine)"}
                  </p>
                  {!detail.correct && (
                    <p className="text-xs text-green-700 mt-0.5">
                      Richtig: {detail.correctAnswer}
                    </p>
                  )}
                  {detail.explanation && (
                    <p className="text-xs text-text-light mt-0.5 italic">
                      {detail.explanation}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Aktionen */}
      <div className="flex flex-col gap-3 pt-2">
        <button
          onClick={onRetry}
          className="w-full py-3 bg-primary text-white font-bold rounded-xl shadow-button hover:bg-primary-dark btn-press transition-all"
        >
          Nochmal versuchen
        </button>
        <Link
          href="/quiz"
          className="block text-center w-full py-3 bg-surface-card text-text-dark font-bold rounded-xl shadow-card hover:shadow-card-hover transition-all"
        >
          Anderes Quiz starten
        </Link>
        <Link
          href={`/decks/${deckId}`}
          className="block text-center w-full py-3 text-text-light font-semibold hover:text-text-dark transition-colors"
        >
          Zurück zum Deck
        </Link>
      </div>
    </div>
  )
}

