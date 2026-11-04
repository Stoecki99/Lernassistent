// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// POST /api/ipma/attempts/[id]/items/[position]/assess
// Auth: erforderlich, nur Pro und Admin (Free → 403 PRO_REQUIRED). Rate-Limit 10/min.
// Body: {} (oder leer). Claude-Bewertung (Spezifikation 4.3, AP5): Tageszähler 60, Monatsdeckel, Sperre «pending».
// Fehler von Claude → 502 AI_UNAVAILABLE / AI_INVALID / AI_REFUSED («Deine Selbstbewertung gilt»).
// Antwort: SolvedItem

import { handleAssess, type ParamsInput } from "@/lib/ipma/handlers"
import { defaultDeps } from "@/lib/ipma/server"

export function POST(request: Request, { params }: { params: ParamsInput }) {
  return handleAssess(request, params, defaultDeps())
}
