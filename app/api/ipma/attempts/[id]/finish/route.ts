// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// POST /api/ipma/attempts/[id]/finish
// Auth: erforderlich. Rate-Limit 10/min. Prüfung: nach der Abgabe; Training/Lücken: aktiv. Idempotent.
// Body: {} (oder leer). Ergebnis festschreiben, Leitner, Punkte (Übungsprüfung: nur Bestwert-Verbesserung),
// Station 24 «erledigt» (Übungsprüfung), Abzeichen ipma_*.
// Antwort: { result, newBadges, pointsAwarded }

import { handleFinish, type ParamsInput } from "@/lib/ipma/handlers"
import { defaultDeps } from "@/lib/ipma/server"

export function POST(request: Request, { params }: { params: ParamsInput }) {
  return handleFinish(request, params, defaultDeps())
}
