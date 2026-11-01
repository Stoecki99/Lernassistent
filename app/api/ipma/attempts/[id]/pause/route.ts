// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// POST /api/ipma/attempts/[id]/pause
// Auth: erforderlich. Rate-Limit 30/min. Nur Variante «mit Pausen» und aktiv (sonst 409).
// Body: { paused: boolean }
// Antwort: { activeSeconds, paused }

import { handlePause, type ParamsInput } from "@/lib/ipma/handlers"
import { defaultDeps } from "@/lib/ipma/server"

export function POST(request: Request, { params }: { params: ParamsInput }) {
  return handlePause(request, params, defaultDeps())
}
