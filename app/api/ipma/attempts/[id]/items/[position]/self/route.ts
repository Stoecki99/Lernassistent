// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// PUT /api/ipma/attempts/[id]/items/[position]/self
// Auth: erforderlich. Rate-Limit 120/min.
// Body: { scores: number[] } je Kriterium 0 … Höchstwert des Rasters (Länge = Raster).
// Nur offene, gesperrte, nicht leere Antworten; Prüfung nach der Abgabe (änderbar bis zum Abschluss),
// Training nach «Prüfen» (einmal).
// Antwort: SolvedItem

import { handleSelfAssess, type ParamsInput } from "@/lib/ipma/handlers"
import { defaultDeps } from "@/lib/ipma/server"

export function PUT(request: Request, { params }: { params: ParamsInput }) {
  return handleSelfAssess(request, params, defaultDeps())
}
