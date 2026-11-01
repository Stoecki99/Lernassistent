// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// GET /api/ipma/overview
// Auth: erforderlich (alle Konten). Rate-Limit 60/min (Lesen).
// Antwort: OverviewView (lib/ipma/types.ts): Beherrschung je Kompetenz, fällige Fragen, geprüfte Fragen je
// Kompetenz, aktive Versuche, letzte 10 Versuche je Modus (ohne Positionen), Bestwert Übungsprüfung, canUseAi.

import { handleOverview } from "@/lib/ipma/handlers"
import { defaultDeps } from "@/lib/ipma/server"

export function GET(request: Request) {
  return handleOverview(request, defaultDeps())
}
