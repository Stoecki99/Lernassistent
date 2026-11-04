// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// POST /api/ipma/attempts/[id]/items/[position]/check
// Auth: erforderlich. Rate-Limit 60/min. Nur Training und «Lücken schliessen»; Prüfung → 409.
// Body: {} (oder leer). Sperrt die Position, bewertet MC, führt das Leitner-Fach nach.
// Antwort: SolvedItem nur für diese Position.

import { handleCheckItem, type ParamsInput } from "@/lib/ipma/handlers"
import { defaultDeps } from "@/lib/ipma/server"

export function POST(request: Request, { params }: { params: ParamsInput }) {
  return handleCheckItem(request, params, defaultDeps())
}
