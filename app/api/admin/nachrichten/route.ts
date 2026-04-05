// GET /api/admin/nachrichten
// Auth: Eingeloggt + ADMIN_EMAIL
// Laedt alle Kontaktnachrichten.

// PATCH /api/admin/nachrichten
// Auth: Eingeloggt + ADMIN_EMAIL
// Markiert eine Nachricht als gelesen.

import { NextResponse } from "next/server"
import { getAuthSession } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

async function verifyAdmin(): Promise<boolean> {
  const session = await getAuthSession()
  if (!session?.user?.email) return false

  const adminEmail = process.env.ADMIN_EMAIL
  return !!adminEmail && session.user.email === adminEmail
}

export async function GET() {
  try {
    if (!(await verifyAdmin())) {
      return NextResponse.json({ error: "Nicht autorisiert." }, { status: 403 })
    }

    const messages = await prisma.contactMessage.findMany({
      orderBy: { createdAt: "desc" },
    })

    const serialized = messages.map((m) => ({
      id: m.id,
      name: m.name,
      email: m.email,
      subject: m.subject,
      message: m.message,
      emailSent: m.emailSent,
      read: m.read,
      createdAt: m.createdAt.toISOString(),
    }))

    return NextResponse.json({ messages: serialized })
  } catch (error) {
    console.error("[admin/nachrichten/GET]", error)
    return NextResponse.json(
      { error: "Nachrichten konnten nicht geladen werden." },
      { status: 500 }
    )
  }
}

const deleteSchema = z.object({
  messageId: z.string().cuid("Ungueltige Nachrichten-ID."),
})

export async function DELETE(request: Request) {
  try {
    if (!(await verifyAdmin())) {
      return NextResponse.json({ error: "Nicht autorisiert." }, { status: 403 })
    }

    const body: unknown = await request.json()
    const parsed = deleteSchema.safeParse(body)

    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message ?? "Ungueltige Eingabe."
      return NextResponse.json({ error: firstError }, { status: 400 })
    }

    const existing = await prisma.contactMessage.findUnique({
      where: { id: parsed.data.messageId },
      select: { id: true },
    })

    if (!existing) {
      return NextResponse.json({ error: "Nachricht nicht gefunden." }, { status: 404 })
    }

    await prisma.contactMessage.delete({
      where: { id: parsed.data.messageId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[admin/nachrichten/DELETE]", error)
    return NextResponse.json(
      { error: "Nachricht konnte nicht geloescht werden." },
      { status: 500 }
    )
  }
}

const markReadSchema = z.object({
  messageId: z.string().cuid("Ungültige Nachrichten-ID."),
  read: z.boolean(),
})

export async function PATCH(request: Request) {
  try {
    if (!(await verifyAdmin())) {
      return NextResponse.json({ error: "Nicht autorisiert." }, { status: 403 })
    }

    const body: unknown = await request.json()
    const parsed = markReadSchema.safeParse(body)

    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message ?? "Ungültige Eingabe."
      return NextResponse.json({ error: firstError }, { status: 400 })
    }

    const { messageId, read } = parsed.data

    const existing = await prisma.contactMessage.findUnique({
      where: { id: messageId },
      select: { id: true },
    })

    if (!existing) {
      return NextResponse.json({ error: "Nachricht nicht gefunden." }, { status: 404 })
    }

    await prisma.contactMessage.update({
      where: { id: messageId },
      data: { read },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[admin/nachrichten/PATCH]", error)
    return NextResponse.json(
      { error: "Nachricht konnte nicht aktualisiert werden." },
      { status: 500 }
    )
  }
}
