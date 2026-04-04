// lib/validations/quiz.ts
// Zod-Schemas fuer Quiz-Generierung und -Bewertung.

import { z } from "zod"

export const quizTypeSchema = z.enum([
  "multiple_choice",
  "true_false",
  "free_text",
])

export const questionCountSchema = z.union([
  z.literal(5),
  z.literal(10),
  z.literal(15),
  z.literal(20),
])

export const generateQuizSchema = z.object({
  deckId: z
    .string()
    .min(1, "Deck-ID ist erforderlich."),
  quizType: quizTypeSchema,
  questionCount: questionCountSchema,
})

export const answerSchema = z.object({
  questionId: z
    .string()
    .min(1, "Frage-ID ist erforderlich."),
  userAnswer: z
    .string()
    .min(0)
    .max(1000, "Antwort darf maximal 1000 Zeichen lang sein."),
})

export const evaluateQuizSchema = z.object({
  deckId: z
    .string()
    .min(1, "Deck-ID ist erforderlich."),
  quizType: quizTypeSchema,
  answers: z
    .array(answerSchema)
    .min(1, "Mindestens eine Antwort ist erforderlich.")
    .max(20, "Maximal 20 Antworten erlaubt."),
})

export type QuizType = z.infer<typeof quizTypeSchema>
export type QuestionCount = z.infer<typeof questionCountSchema>
export type GenerateQuizInput = z.infer<typeof generateQuizSchema>
export type AnswerInput = z.infer<typeof answerSchema>
export type EvaluateQuizInput = z.infer<typeof evaluateQuizSchema>
