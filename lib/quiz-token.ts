// lib/quiz-token.ts
// Signiert und verifiziert Quiz-Antwortdaten mit HMAC-SHA256.
// Verhindert, dass Clients korrekte Antworten manipulieren koennen.

import { createHmac } from "crypto"

interface QuizAnswerData {
  questionId: string
  correctAnswer: string
}

const SEPARATOR = "|"

function getSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET
  if (!secret) {
    throw new Error("NEXTAUTH_SECRET ist nicht gesetzt.")
  }
  return secret
}

/** Serialisiert die Antwortdaten deterministisch */
function serializeAnswers(answers: QuizAnswerData[]): string {
  return answers
    .map((a) => `${a.questionId}:${a.correctAnswer}`)
    .join(SEPARATOR)
}

/** Erzeugt ein signiertes Token aus den Quiz-Antwortdaten */
export function signQuizToken(answers: QuizAnswerData[]): string {
  const payload = serializeAnswers(answers)
  const encoded = Buffer.from(payload).toString("base64")
  const hmac = createHmac("sha256", getSecret())
    .update(encoded)
    .digest("hex")
  return `${encoded}.${hmac}`
}

/** Verifiziert ein Quiz-Token und gibt die Antwortdaten zurueck */
export function verifyQuizToken(
  token: string
): QuizAnswerData[] | null {
  const parts = token.split(".")
  if (parts.length !== 2) return null

  const [encoded, signature] = parts as [string, string]
  const expectedHmac = createHmac("sha256", getSecret())
    .update(encoded)
    .digest("hex")

  // Timing-safe Vergleich
  if (signature.length !== expectedHmac.length) return null
  const sigBuffer = Buffer.from(signature, "hex")
  const expectedBuffer = Buffer.from(expectedHmac, "hex")
  if (sigBuffer.length !== expectedBuffer.length) return null

  let match = true
  for (let i = 0; i < sigBuffer.length; i++) {
    if (sigBuffer[i] !== expectedBuffer[i]) {
      match = false
    }
  }
  if (!match) return null

  try {
    const payload = Buffer.from(encoded, "base64").toString("utf-8")
    return payload.split(SEPARATOR).map((entry) => {
      const colonIndex = entry.indexOf(":")
      if (colonIndex === -1) {
        throw new Error("Ungueltiges Token-Format.")
      }
      return {
        questionId: entry.slice(0, colonIndex),
        correctAnswer: entry.slice(colonIndex + 1),
      }
    })
  } catch {
    return null
  }
}
