"use client"

// components/features/QuizCard.tsx
// Einzelne Quiz-Frage: MC-Buttons, Wahr/Falsch oder Freitext-Eingabe.
// Korrekte Antworten sind dem Client nicht bekannt — Feedback erfolgt nach
// serverseitiger Auswertung am Ende des Quiz.

import { useState } from "react"
import CardMarkdown from "@/components/ui/CardMarkdown"

interface QuizQuestion {
  id: string
  question: string
  options?: string[]
  type: "multiple_choice" | "true_false" | "free_text"
}

interface QuizCardProps {
  question: QuizQuestion
  questionIndex: number
  totalQuestions: number
  onAnswer: (questionId: string, userAnswer: string) => void
}

const OPTION_LABELS = ["A", "B", "C", "D"]

export default function QuizCard({
  question,
  questionIndex,
  totalQuestions,
  onAnswer,
}: QuizCardProps) {
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null)
  const [freeTextInput, setFreeTextInput] = useState("")
  const [answered, setAnswered] = useState(false)

  const handleSelectOption = (option: string) => {
    if (answered) return
    setSelectedAnswer(option)
    setAnswered(true)
  }

  const handleFreeTextSubmit = () => {
    if (answered || freeTextInput.trim().length === 0) return
    setSelectedAnswer(freeTextInput.trim())
    setAnswered(true)
  }

  const handleNext = () => {
    if (!selectedAnswer) return
    onAnswer(question.id, selectedAnswer)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && question.type === "free_text" && !answered) {
      e.preventDefault()
      handleFreeTextSubmit()
    }
    if (e.key === "Enter" && answered) {
      e.preventDefault()
      handleNext()
    }
  }

  return (
    <div className="w-full max-w-lg mx-auto" onKeyDown={handleKeyDown}>
      {/* Frage-Header */}
      <div className="text-center mb-6">
        <span className="text-xs font-bold text-text-light uppercase tracking-wide">
          Frage {questionIndex + 1} von {totalQuestions}
        </span>
      </div>

      {/* Frage */}
      <div className="bg-surface-card rounded-2xl shadow-card p-6 sm:p-8 mb-6">
        <div className="text-xl sm:text-2xl font-bold text-text-dark text-center leading-relaxed">
          <CardMarkdown content={question.question} />
        </div>
      </div>

      {/* Antwort-Optionen */}
      {question.type === "free_text" ? (
        <div className="space-y-3">
          <input
            type="text"
            value={freeTextInput}
            onChange={(e) => setFreeTextInput(e.target.value)}
            disabled={answered}
            placeholder="Deine Antwort eingeben..."
            className="w-full px-5 py-4 rounded-xl border-2 border-gray-200 bg-surface-card text-text-dark font-semibold text-lg focus:outline-none focus:border-primary transition-colors disabled:opacity-60"
            autoFocus
          />
          {!answered && (
            <button
              onClick={handleFreeTextSubmit}
              disabled={freeTextInput.trim().length === 0}
              className="w-full py-3 bg-primary text-white font-bold rounded-xl shadow-button hover:bg-primary-dark btn-press disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              Antwort prüfen
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {question.options?.map((option, index) => {
            let buttonStyle =
              "bg-surface-card border-2 border-gray-200 text-text-dark hover:border-primary hover:bg-primary/5"

            if (answered) {
              if (option === selectedAnswer) {
                buttonStyle =
                  "bg-secondary/10 border-2 border-secondary text-secondary"
              } else {
                buttonStyle =
                  "bg-gray-50 border-2 border-gray-200 text-text-light opacity-60"
              }
            }

            return (
              <button
                key={index}
                onClick={() => handleSelectOption(option)}
                disabled={answered}
                className={`w-full flex items-center gap-4 px-5 py-4 rounded-xl font-semibold text-left transition-all duration-200 ${buttonStyle}`}
              >
                <span className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-sm font-bold flex-shrink-0">
                  {OPTION_LABELS[index]}
                </span>
                <span className="flex-1">{option}</span>
              </button>
            )
          })}
        </div>
      )}

      {/* Feedback + Naechste Frage */}
      {answered && (
        <div className="mt-6 space-y-4">
          {/* Feedback-Banner */}
          <div className="p-4 rounded-xl text-center font-bold bg-secondary/10 text-secondary border border-secondary/20">
            Antwort gespeichert!
            <p className="text-sm font-normal mt-1">
              Das Ergebnis siehst du am Ende des Quiz.
            </p>
          </div>

          {/* Naechste-Frage-Button */}
          <button
            onClick={handleNext}
            className="w-full py-3 bg-primary text-white font-bold rounded-xl shadow-button hover:bg-primary-dark btn-press transition-all"
          >
            {questionIndex + 1 < totalQuestions
              ? "Nächste Frage"
              : "Ergebnis anzeigen"}
          </button>
        </div>
      )}
    </div>
  )
}
