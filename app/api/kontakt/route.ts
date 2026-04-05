// POST /api/kontakt
// Auth: nicht erforderlich
// Speichert Kontaktnachrichten und sendet E-Mail-Benachrichtigung.

import { NextResponse } from "next/server"
import { headers } from "next/headers"
import crypto from "crypto"
import { prisma } from "@/lib/prisma"
import { contactSchema, type ContactSubject } from "@/lib/validations/contact"
import { sendContactNotification } from "@/lib/emails/contact-notification"

// --- Rate-Limiting (In-Memory) ---
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000 // 15 Minuten
const RATE_LIMIT_MAX = 3
const RATE_LIMIT_MAP_MAX_SIZE = 10_000

// Cleanup-Interval: abgelaufene Eintraege entfernen
const cleanupInterval = setInterval(() => {
  const now = Date.now()
  for (const [key, value] of rateLimitMap) {
    if (value.resetAt <= now) {
      rateLimitMap.delete(key)
    }
  }
}, RATE_LIMIT_WINDOW_MS)

// Cleanup bei Prozessende
if (typeof cleanupInterval?.unref === "function") {
  cleanupInterval.unref()
}

function hashIp(ip: string): string {
  return crypto.createHash("sha256").update(ip).digest("hex")
}

function isRateLimited(ipHash: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(ipHash)

  if (!entry || entry.resetAt <= now) {
    // Schutz gegen Memory-Erschoepfung bei verteilten Angriffen
    if (rateLimitMap.size >= RATE_LIMIT_MAP_MAX_SIZE) {
      return true
    }
    rateLimitMap.set(ipHash, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return false
  }

  entry.count++
  return entry.count > RATE_LIMIT_MAX
}

interface RecaptchaResponse {
  success: boolean
  score?: number
  "error-codes"?: string[]
}

async function verifyRecaptcha(token: string): Promise<boolean> {
  const secret = process.env.RECAPTCHA_SECRET_KEY
  if (!secret) {
    console.error("[kontakt] RECAPTCHA_SECRET_KEY nicht gesetzt")
    return false
  }

  try {
    const res = await fetch("https://www.google.com/recaptcha/api/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret, response: token }),
    })

    const data: RecaptchaResponse = await res.json()
    return data.success && (data.score ?? 0) >= 0.5
  } catch (error) {
    console.error("[kontakt] reCAPTCHA-Verifikation fehlgeschlagen", error)
    return false
  }
}

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json()
    const parsed = contactSchema.safeParse(body)

    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message ?? "Ungültige Eingabe."
      return NextResponse.json({ error: firstError }, { status: 400 })
    }

    const { name, email, subject, message, recaptchaToken, website, formLoadedAt } = parsed.data

    // Honeypot: Wenn ausgefuellt, Erfolg vortaeuschen
    if (website) {
      return NextResponse.json({ success: true })
    }

    // Zeitstempel-Check: Formular muss mind. 3 Sekunden geladen sein
    const timeDiff = Date.now() - formLoadedAt
    if (timeDiff < 3000) {
      return NextResponse.json({ success: true })
    }

    // IP hashen
    const headersList = await headers()
    const forwarded = headersList.get("x-forwarded-for")
    const realIp = headersList.get("x-real-ip")
    const ip = forwarded?.split(",")[0]?.trim() ?? realIp ?? "unknown"
    const ipHash = hashIp(ip)

    // Rate-Limiting
    if (isRateLimited(ipHash)) {
      return NextResponse.json(
        { error: "Zu viele Anfragen. Bitte versuche es später erneut." },
        { status: 429 }
      )
    }

    // reCAPTCHA v3 Verifikation
    const captchaValid = await verifyRecaptcha(recaptchaToken)
    if (!captchaValid) {
      return NextResponse.json(
        { error: "Sicherheitsprüfung fehlgeschlagen. Bitte versuche es erneut." },
        { status: 400 }
      )
    }

    // Schritt 1: Nachricht in DB speichern (immer, auch wenn E-Mail fehlschlaegt)
    const contactMessage = await prisma.contactMessage.create({
      data: {
        name,
        email,
        subject,
        message,
        ipHash,
      },
    })

    // Schritt 2: E-Mail senden
    const emailResult = await sendContactNotification({
      name,
      email,
      subject: subject as ContactSubject,
      message,
    })

    // Schritt 3: DB-Eintrag updaten wenn E-Mail erfolgreich
    if (emailResult.success) {
      await prisma.contactMessage.update({
        where: { id: contactMessage.id },
        data: { emailSent: true },
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[kontakt]", error)
    return NextResponse.json(
      { error: "Nachricht konnte nicht gesendet werden. Bitte versuche es später erneut." },
      { status: 500 }
    )
  }
}
