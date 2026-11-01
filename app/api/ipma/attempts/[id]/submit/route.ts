// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// POST /api/ipma/attempts/[id]/submit
// Auth: erforderlich. Rate-Limit 10/min. Nur Übungs- und Kurzprüfung; idempotent.
// Body: {} (oder leer). Sperrt alle Positionen, bewertet MC, unbeantwortete offene Fragen 0.
// Antwort: AttemptView mit Lösungen und vorläufigem Ergebnis

import { handleSubmit, type ParamsInput } from "@/lib/ipma/handlers"
import { defaultDeps } from "@/lib/ipma/server"

export function POST(request: Request, { params }: { params: ParamsInput }) {
  return handleSubmit(request, params, defaultDeps())
}
