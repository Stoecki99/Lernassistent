// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// POST /api/ipma/attempts
// Auth: erforderlich (alle Konten). Rate-Limit 10/min.
// Body: { mode: "exam", variant?: "strict" | "pausable", replaceActive? } | { mode: "short", replaceActive? }
//     | { mode: "training", competences: ["3.04", …], type?: "mc" | "offen" | "beide", count?: 5–30, replaceActive? }
//     | { mode: "gaps", replaceActive? }
// Läuft im Modus schon ein Versuch: 409 ACTIVE_EXISTS mit activeAttemptId (mit replaceActive: alter → «aborted»).
// Pool zu klein: 422 POOL_TOO_SMALL. Station 24 «begonnen».
// Antwort 201: { id }

import { handleCreateAttempt } from "@/lib/ipma/handlers"
import { defaultDeps } from "@/lib/ipma/server"

export function POST(request: Request) {
  return handleCreateAttempt(request, defaultDeps())
}
