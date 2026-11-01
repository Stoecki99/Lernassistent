// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// GET /api/ipma/attempts/[id]
// Auth: erforderlich. Rate-Limit 60/min. Fremder Versuch: 404.
// Ein abgelaufener Versuch mit Uhr (deadlineAt + 30 s) wird hier abgegeben.
// Antwort: AttemptView mit serverNow; Lösungen nur nach den Regeln aus Spezifikation 6.6.

// DELETE /api/ipma/attempts/[id]
// Auth: erforderlich. Rate-Limit 10/min. Aktiv → «aborted» (kein Löschen); abgegeben/abgeschlossen → 409.
// Antwort: { ok: true }

import { handleAbortAttempt, handleGetAttempt, type ParamsInput } from "@/lib/ipma/handlers"
import { defaultDeps } from "@/lib/ipma/server"

interface RouteContext {
  params: ParamsInput
}

export function GET(request: Request, { params }: RouteContext) {
  return handleGetAttempt(request, params, defaultDeps())
}

export function DELETE(request: Request, { params }: RouteContext) {
  return handleAbortAttempt(request, params, defaultDeps())
}
