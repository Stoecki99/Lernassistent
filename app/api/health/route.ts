// GET /api/health
// Auth: nicht erforderlich
// Health-Check Endpoint fuer Docker und Monitoring — prueft App + DB

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET() {
  try {
    await prisma.$queryRawUnsafe("SELECT 1")
    return NextResponse.json({ status: "ok", timestamp: new Date().toISOString() })
  } catch (error) {
    console.error("[health] DB-Check fehlgeschlagen:", error)
    return NextResponse.json(
      { status: "error", message: "Datenbankverbindung fehlgeschlagen." },
      { status: 503 }
    )
  }
}
