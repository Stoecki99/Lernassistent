// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// app/(ipma)/stations.ts
// Titel und Veröffentlichung der PMGT-Stationen für die Landkarte (Spezifikation 4.4, 6.9).
// Nur in Server-Komponenten verwenden (Dateisystem). Gleiche Regel wie loadStationCatalog in lib/ipma/pool.ts:
// veröffentlicht = HTML-Datei in content/lernseiten/pmgt/ vorhanden.

import fs from "node:fs"
import path from "node:path"
import fach from "@/content/lernseiten/pmgt/fach.json"

export type StationTitles = Record<string, { title: string; available: boolean }>

export function stationTitles(): StationTitles {
  const basis = path.join(process.cwd(), "content", "lernseiten", "pmgt")
  const out: StationTitles = {}
  for (const s of fach.pfad as { slug: string; titel: string }[]) {
    out[s.slug] = { title: s.titel, available: fs.existsSync(path.join(basis, `${s.slug}.html`)) }
  }
  return out
}
