// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// scripts/lernseiten-pruefen.ts
// Prueft alle Inhaltsdateien unter content/lernseiten/.
// Laeuft lokal (npm run lernseiten:pruefen) und im Docker-Build vor `next build`.

import { ladeFaecher } from "@/lib/lernseiten"
import { pruefeAlleInhalte } from "@/lib/lernseiten-pruefung"

const fehler = pruefeAlleInhalte()

if (fehler.length > 0) {
  console.error(`Lernseiten: ${fehler.length} Fehler gefunden\n`)
  for (const meldung of fehler) console.error(`  - ${meldung}`)
  process.exit(1)
}

const faecher = ladeFaecher()
const themen = faecher.reduce((summe, fach) => summe + fach.anzahlThemen, 0)
const anzahl = (n: number, einzahl: string, mehrzahl: string) => `${n} ${n === 1 ? einzahl : mehrzahl}`
console.log(
  `Lernseiten: alles gültig (${anzahl(faecher.length, "Fach", "Fächer")}, ${anzahl(themen, "Thema", "Themen")}).`,
)
