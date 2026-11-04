// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// lib/ipma/grader.ts
// Claude-Bewertung einer offenen Antwort (Spezifikation 4.3, AP5): Prompt bauen (Antwort in <antwort>, spitze
// Klammern ersetzt), Claude über den zentralen Client aus lib/claude.ts aufrufen (strukturierte Ausgabe,
// kein erzwungenes Werkzeug), stop_reason prüfen, Ausgabe mit Zod und gegen das Raster prüfen.
// Kennt weder Datenbank noch Konto: Claude sieht nur Frage, Musterlösung, Raster und Antwort (4.3 Nr. 5).
// Der Client ist ein Parameter, damit tests/ipma-grader.test.ts eine Attrappe übergibt. NUR SERVER.

import Anthropic from "@anthropic-ai/sdk"
import {
  IPMA_GRADER_EFFORT,
  IPMA_GRADER_MAX_RETRIES,
  IPMA_GRADER_MAX_TOKENS,
  IPMA_GRADER_MODEL,
  IPMA_GRADER_OUTPUT_SCHEMA,
  IPMA_GRADER_PROMPT,
  IPMA_GRADER_TIMEOUT_MS,
} from "@/lib/claude"
import { MAX_ANSWER_CHARS, gradeOutputSchema, matchRaster } from "@/lib/validations/ipma"

/** Was die Bewertung vom SDK braucht (der echte Client aus lib/claude.ts oder eine Attrappe) */
export interface GraderClient {
  messages: {
    create(
      body: Anthropic.MessageCreateParamsNonStreaming,
      options?: { timeout?: number; maxRetries?: number },
    ): PromiseLike<Anthropic.Message>
  }
}

/** Zu bewertende Frage (nur Inhalte aus dem Pool und die Antwort, keine Kontodaten) */
export interface GradeInput {
  frage: string
  musterloesung: string
  raster: readonly { kriterium: string; punkte: number }[]
  antwort: string
}

/** Verbrauch eines Aufrufs (für Kostendeckel und aiTokens) */
export interface GradeUsage {
  inputTokens: number
  outputTokens: number
  cacheWriteTokens: number
  cacheReadTokens: number
}

/** Gespeicherte Rückmeldung (IpmaAttemptItem.aiFeedback, aiFeedbackSchema) */
export interface AiFeedbackData {
  kriterien: { nummer: number; punkte: number; begruendung: string }[]
  gesamtkommentar: string
  verdacht: boolean
}

export type GradeFailure =
  | "refusal" // stop_reason «refusal»: Claude lehnt ab
  | "truncated" // stop_reason «max_tokens»: Ausgabe abgeschnitten
  | "invalid" // kein JSON, Schema verletzt oder passt nicht zum Raster
  | "busy" // Anthropic.RateLimitError (429 der API)
  | "unavailable" // übrige API-Fehler, Verbindung, Zeitüberschreitung

export type GradeResult =
  | { ok: true; scores: number[]; feedback: AiFeedbackData; usage: GradeUsage }
  | { ok: false; reason: GradeFailure; usage: GradeUsage }

const NO_USAGE: GradeUsage = { inputTokens: 0, outputTokens: 0, cacheWriteTokens: 0, cacheReadTokens: 0 }

/** Spitze Klammern ersetzen: die Antwort kann den Tag <antwort> nicht verlassen (4.3 Nr. 1) */
export function escapeAnswer(text: string): string {
  return text.slice(0, MAX_ANSWER_CHARS).replace(/</g, "‹").replace(/>/g, "›")
}

/** Variabler Teil der Anfrage (nach dem gecachten System-Prompt) */
export function buildUserContent(input: GradeInput): string {
  const raster = input.raster
    .map((r, i) => `${i + 1}. ${r.kriterium} (höchstens ${r.punkte} ${r.punkte === 1 ? "Punkt" : "Punkte"})`)
    .join("\n")
  return [
    `<frage>${input.frage}</frage>`,
    `<musterloesung>${input.musterloesung}</musterloesung>`,
    `<raster>\n${raster}\n</raster>`,
    `<antwort>${escapeAnswer(input.antwort)}</antwort>`,
  ].join("\n")
}

/** Anfrage an die Messages-API (ohne thinking: auf Opus 5.5 immer adaptiv; Aufwand über effort) */
export function buildRequest(input: GradeInput): Anthropic.MessageCreateParamsNonStreaming {
  return {
    model: IPMA_GRADER_MODEL,
    max_tokens: IPMA_GRADER_MAX_TOKENS,
    system: [{ type: "text", text: IPMA_GRADER_PROMPT, cache_control: { type: "ephemeral" } }],
    output_config: {
      effort: IPMA_GRADER_EFFORT,
      format: { type: "json_schema", schema: IPMA_GRADER_OUTPUT_SCHEMA },
    },
    messages: [{ role: "user", content: buildUserContent(input) }],
  }
}

function usageOf(message: Anthropic.Message): GradeUsage {
  const u = message.usage
  return {
    inputTokens: u?.input_tokens ?? 0,
    outputTokens: u?.output_tokens ?? 0,
    cacheWriteTokens: u?.cache_creation_input_tokens ?? 0,
    cacheReadTokens: u?.cache_read_input_tokens ?? 0,
  }
}

/** Text der Antwort (Denkblöcke werden übergangen) */
function textOf(message: Anthropic.Message): string {
  return message.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
}

/** Ausgabe lesen und prüfen; die Summe rechnet der Aufrufer selbst aus den Punkten */
export function parseGradeOutput(
  text: string,
  raster: readonly { punkte: number }[],
): { scores: number[]; feedback: AiFeedbackData } | null {
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    return null
  }
  const parsed = gradeOutputSchema.safeParse(json)
  if (!parsed.success) return null
  const scores = matchRaster(parsed.data, raster)
  if (!scores) return null
  const kriterien = scores.map((punkte, i) => {
    const k = parsed.data.kriterien.find((x) => x.nummer === i + 1)
    return { nummer: i + 1, punkte, begruendung: k?.begruendung ?? "" }
  })
  return {
    scores,
    feedback: { kriterien, gesamtkommentar: parsed.data.gesamtkommentar, verdacht: parsed.data.verdacht_manipulation },
  }
}

/**
 * Eine offene Antwort bewerten (4.3 Schritte 10–13 ohne Datenbank). Fehler der API werden als Ergebnis
 * gemeldet (typisierte SDK-Fehlerklassen); alles andere wird weitergeworfen.
 */
export async function gradeOpenAnswer(client: GraderClient, input: GradeInput): Promise<GradeResult> {
  let message: Anthropic.Message
  try {
    message = await client.messages.create(buildRequest(input), {
      timeout: IPMA_GRADER_TIMEOUT_MS,
      maxRetries: IPMA_GRADER_MAX_RETRIES,
    })
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) return { ok: false, reason: "busy", usage: NO_USAGE }
    if (error instanceof Anthropic.APIError) {
      console.error("[ipma/grader] API-Fehler", error.status ?? "ohne Status", error.name)
      return { ok: false, reason: "unavailable", usage: NO_USAGE }
    }
    // Übrige SDK-Fehler vor der Anfrage, z. B. fehlende Authentifizierung
    if (error instanceof Anthropic.AnthropicError) {
      console.error("[ipma/grader] SDK-Fehler", error.name)
      return { ok: false, reason: "unavailable", usage: NO_USAGE }
    }
    throw error
  }

  const usage = usageOf(message)
  if (message.stop_reason === "refusal") return { ok: false, reason: "refusal", usage }
  if (message.stop_reason === "max_tokens") return { ok: false, reason: "truncated", usage }
  const result = parseGradeOutput(textOf(message), input.raster)
  if (!result) return { ok: false, reason: "invalid", usage }
  return { ok: true, ...result, usage }
}

/** Tokens für den Monatsdeckel in Sonnet-Preisen (lib/subscription.ts): Cache-Schreiben 1.25×, Lesen 0.1× */
export function billableTokens(usage: GradeUsage, costFactor: number): { input: number; output: number } {
  const input = usage.inputTokens + usage.cacheWriteTokens * 1.25 + usage.cacheReadTokens * 0.1
  return { input: Math.ceil(input * costFactor), output: Math.ceil(usage.outputTokens * costFactor) }
}

/** Summe aller Tokens eines Aufrufs (IpmaAttemptItem.aiTokens) */
export function totalTokens(usage: GradeUsage): number {
  return usage.inputTokens + usage.outputTokens + usage.cacheWriteTokens + usage.cacheReadTokens
}
