// POST /api/chat
// Auth: erforderlich
// Sendet Nachricht an Claude, streamt Antwort zurueck.
// Speichert User-Nachricht und Assistant-Antwort in DB.
// Rate-Limiting: Max 20 Anfragen pro Nutzer pro Minute.

import { NextResponse } from "next/server"
import { getAuthSession } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { anthropic, CHAT_SYSTEM_PROMPT } from "@/lib/claude"
import { chatMessageSchema } from "@/lib/validations/chat"

/** Einfaches In-Memory Rate-Limiting */
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT = 20
const RATE_WINDOW = 60 * 1000

function checkRateLimit(userId: string): boolean {
  const now = Date.now()

  // Cleanup expired entries to prevent memory leak
  for (const [key, value] of rateLimitMap) {
    if (now > value.resetAt) rateLimitMap.delete(key)
  }

  const entry = rateLimitMap.get(userId)

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + RATE_WINDOW })
    return true
  }

  if (entry.count >= RATE_LIMIT) {
    return false
  }

  entry.count += 1
  return true
}

/** Max Anzahl vorheriger Nachrichten als Kontext */
const MAX_CONTEXT_MESSAGES = 20

export async function POST(request: Request) {
  try {
    const session = await getAuthSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Nicht autorisiert." }, { status: 401 })
    }

    const userId = session.user.id

    // Rate-Limiting pruefen
    if (!checkRateLimit(userId)) {
      return NextResponse.json(
        { error: "Zu viele Anfragen. Bitte warte eine Minute." },
        { status: 429 }
      )
    }

    const body: unknown = await request.json()
    const parsed = chatMessageSchema.safeParse(body)

    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message ?? "Ungueltige Eingabe."
      return NextResponse.json({ error: firstError }, { status: 400 })
    }

    const { message } = parsed.data

    // User-Nachricht in DB speichern
    await prisma.chatMessage.create({
      data: {
        userId,
        role: "user",
        content: message,
      },
    })

    // Letzte Nachrichten als Kontext laden
    const previousMessages = await prisma.chatMessage.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: MAX_CONTEXT_MESSAGES,
      select: {
        role: true,
        content: true,
      },
    })

    // Nachrichten chronologisch ordnen (aelteste zuerst)
    const contextMessages = previousMessages.reverse().map((msg) => ({
      role: msg.role as "user" | "assistant",
      content: msg.content,
    }))

    // Streaming-Response von Claude
    const stream = await anthropic.messages.stream({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      system: CHAT_SYSTEM_PROMPT,
      messages: contextMessages,
    })

    // Gesamte Antwort sammeln fuer DB-Speicherung
    let fullResponse = ""

    const readableStream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder()

        try {
          for await (const event of stream) {
            if (
              event.type === "content_block_delta" &&
              event.delta.type === "text_delta"
            ) {
              const text = event.delta.text
              fullResponse += text
              controller.enqueue(encoder.encode(text))
            }
          }

          // Assistant-Antwort in DB speichern nach Streaming
          if (fullResponse.trim()) {
            await prisma.chatMessage.create({
              data: {
                userId,
                role: "assistant",
                content: fullResponse,
              },
            })
          }

          controller.close()
        } catch (error) {
          console.error("[chat/stream]", error)
          controller.error(error)
        }
      },
    })

    return new Response(readableStream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
        "Transfer-Encoding": "chunked",
      },
    })
  } catch (error) {
    console.error("[chat/POST]", error)
    return NextResponse.json(
      { error: "Chat-Anfrage fehlgeschlagen." },
      { status: 500 }
    )
  }
}
