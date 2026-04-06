// GET /api/admin/open-decks
// Auth: Eingeloggt + ADMIN_EMAIL
// Laedt alle Decks mit shareStatus "pending" und "approved".

// PATCH /api/admin/open-decks
// Auth: Eingeloggt + ADMIN_EMAIL
// Genehmigt oder lehnt eine Freigabe-Anfrage ab.

// DELETE /api/admin/open-decks
// Auth: Eingeloggt + ADMIN_EMAIL
// Widerruft die Freigabe eines genehmigten OpenDecks.

// PUT /api/admin/open-decks
// Auth: Eingeloggt + ADMIN_EMAIL
// Setzt oder entfernt den Favorit-Status eines OpenDecks.

import { NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { getAuthSession } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import {
  reviewShareSchema,
  adminDeleteOpenDeckSchema,
  adminToggleFeaturedSchema,
} from "@/lib/validations/openDeck"

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

    const [pendingDecks, approvedDecks] = await Promise.all([
      prisma.deck.findMany({
        where: { shareStatus: "pending" },
        include: {
          user: { select: { name: true, email: true } },
          _count: { select: { cards: true } },
        },
        orderBy: { shareRequestedAt: "desc" },
      }),
      prisma.deck.findMany({
        where: { shareStatus: "approved" },
        include: {
          user: { select: { name: true, email: true } },
          _count: { select: { cards: true } },
        },
        orderBy: { shareReviewedAt: "desc" },
      }),
    ])

    const serializePending = pendingDecks.map((d) => ({
      id: d.id,
      name: d.name,
      description: d.description,
      icon: d.icon,
      cardCount: d._count.cards,
      userName: d.user.name ?? "Anonym",
      userEmail: d.user.email,
      requestedAt: d.shareRequestedAt?.toISOString() ?? d.createdAt.toISOString(),
    }))

    const serializeApproved = approvedDecks.map((d) => ({
      id: d.id,
      name: d.name,
      description: d.description,
      icon: d.icon,
      color: d.color,
      cardCount: d._count.cards,
      userName: d.user.name ?? "Anonym",
      userEmail: d.user.email,
      isFeatured: d.isFeatured,
      approvedAt: d.shareReviewedAt?.toISOString() ?? d.createdAt.toISOString(),
    }))

    return NextResponse.json({
      pending: serializePending,
      approved: serializeApproved,
    })
  } catch (error) {
    console.error("[admin/open-decks/GET]", error)
    return NextResponse.json(
      { error: "Anfragen konnten nicht geladen werden." },
      { status: 500 }
    )
  }
}

export async function PATCH(request: Request) {
  try {
    if (!(await verifyAdmin())) {
      return NextResponse.json({ error: "Nicht autorisiert." }, { status: 403 })
    }

    const body: unknown = await request.json()
    const parsed = reviewShareSchema.safeParse(body)

    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message ?? "Ungueltige Eingabe."
      return NextResponse.json({ error: firstError }, { status: 400 })
    }

    const { deckId, action, rejectionReason } = parsed.data

    const deck = await prisma.deck.findUnique({
      where: { id: deckId },
      select: { id: true, shareStatus: true },
    })

    if (!deck) {
      return NextResponse.json({ error: "Deck nicht gefunden." }, { status: 404 })
    }

    if (deck.shareStatus !== "pending") {
      return NextResponse.json({ error: "Deck hat keine ausstehende Anfrage." }, { status: 400 })
    }

    await prisma.deck.update({
      where: { id: deckId },
      data: {
        shareStatus: action === "approve" ? "approved" : "rejected",
        shareReviewedAt: new Date(),
        shareRejectionReason: action === "reject" ? (rejectionReason ?? null) : null,
      },
    })

    revalidatePath("/open-decks")
    revalidatePath("/admin")

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[admin/open-decks/PATCH]", error)
    return NextResponse.json(
      { error: "Review fehlgeschlagen." },
      { status: 500 }
    )
  }
}

export async function DELETE(request: Request) {
  try {
    if (!(await verifyAdmin())) {
      return NextResponse.json({ error: "Nicht autorisiert." }, { status: 403 })
    }

    const body: unknown = await request.json()
    const parsed = adminDeleteOpenDeckSchema.safeParse(body)

    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message ?? "Ungueltige Eingabe."
      return NextResponse.json({ error: firstError }, { status: 400 })
    }

    const deck = await prisma.deck.findUnique({
      where: { id: parsed.data.deckId },
      select: { id: true, shareStatus: true },
    })

    if (!deck) {
      return NextResponse.json({ error: "Deck nicht gefunden." }, { status: 404 })
    }

    if (deck.shareStatus !== "approved") {
      return NextResponse.json({ error: "Deck ist nicht freigegeben." }, { status: 400 })
    }

    await prisma.deck.update({
      where: { id: parsed.data.deckId },
      data: {
        shareStatus: "none",
        shareReviewedAt: null,
        shareRequestedAt: null,
        shareRejectionReason: null,
        isFeatured: false,
      },
    })

    revalidatePath("/open-decks")
    revalidatePath("/admin")

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[admin/open-decks/DELETE]", error)
    return NextResponse.json(
      { error: "Freigabe konnte nicht widerrufen werden." },
      { status: 500 }
    )
  }
}

export async function PUT(request: Request) {
  try {
    if (!(await verifyAdmin())) {
      return NextResponse.json({ error: "Nicht autorisiert." }, { status: 403 })
    }

    const body: unknown = await request.json()
    const parsed = adminToggleFeaturedSchema.safeParse(body)

    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message ?? "Ungueltige Eingabe."
      return NextResponse.json({ error: firstError }, { status: 400 })
    }

    const deck = await prisma.deck.findUnique({
      where: { id: parsed.data.deckId },
      select: { id: true, shareStatus: true, isFeatured: true },
    })

    if (!deck) {
      return NextResponse.json({ error: "Deck nicht gefunden." }, { status: 404 })
    }

    if (deck.shareStatus !== "approved") {
      return NextResponse.json({ error: "Nur genehmigte Decks koennen favorisiert werden." }, { status: 400 })
    }

    await prisma.deck.update({
      where: { id: parsed.data.deckId },
      data: { isFeatured: !deck.isFeatured },
    })

    revalidatePath("/open-decks")
    revalidatePath("/admin")

    return NextResponse.json({ success: true, isFeatured: !deck.isFeatured })
  } catch (error) {
    console.error("[admin/open-decks/PUT]", error)
    return NextResponse.json(
      { error: "Favorit-Status konnte nicht geaendert werden." },
      { status: 500 }
    )
  }
}
