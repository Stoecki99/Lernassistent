// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// PUT /api/ipma/attempts/[id]/items/[position]
// Auth: erforderlich. Rate-Limit 120/min (Autospeichern).
// Body: { choice?: 0–3 | null (Anzeigeposition), text?: ≤ 3'000 Zeichen | null, flagged?: boolean }
// Nur aktive, nicht gesperrte Positionen (sonst 409); bei Echtbedingungen bis deadlineAt + 30 s (sonst 422 TIME_UP).
// Antwort: { saved: true, answeredCount }

import { handleSaveItem, type ParamsInput } from "@/lib/ipma/handlers"
import { defaultDeps } from "@/lib/ipma/server"

export function PUT(request: Request, { params }: { params: ParamsInput }) {
  return handleSaveItem(request, params, defaultDeps())
}
