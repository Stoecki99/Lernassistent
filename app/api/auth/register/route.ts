// POST /api/auth/register
// Auth: nein
// Registriert einen neuen Benutzer mit Name, E-Mail und Passwort.

import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { registerSchema } from "@/lib/validations/auth"

const BCRYPT_ROUNDS = 12

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json()

    const parsed = registerSchema.safeParse(body)
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message ?? "Ungültige Eingabe."
      return NextResponse.json({ error: firstError }, { status: 400 })
    }

    const { name, email, password } = parsed.data

    const existingUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    })

    if (existingUser) {
      return NextResponse.json(
        { error: "Es existiert bereits ein Konto mit dieser E-Mail-Adresse." },
        { status: 409 }
      )
    }

    const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS)

    await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
      },
    })

    return NextResponse.json(
      { message: "Konto erfolgreich erstellt! Du kannst dich jetzt anmelden." },
      { status: 201 }
    )
  } catch (error) {
    console.error("[auth/register]", error)
    return NextResponse.json(
      { error: "Registrierung fehlgeschlagen. Bitte versuche es später erneut." },
      { status: 500 }
    )
  }
}
