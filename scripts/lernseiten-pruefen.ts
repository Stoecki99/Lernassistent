// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// scripts/lernseiten-pruefen.ts
// Prueft alle Faecher unter content/lernseiten/ (fach.json und Themenseiten).
// Laeuft lokal (npm run lernseiten:pruefen) und im Docker-Build vor `next build`.
// Regeln: docs/lernpfad-format.md

import { ladeFaecher } from "@/lib/lernseiten"
import { pruefeAlleInhalte } from "@/lib/lernseiten-pruefung"

const { fehler, hinweise } = pruefeAlleInhalte()

function zeigeHinweise() {
  if (hinweise.length === 0) return
  console.log(`\nHinweise (${hinweise.length}):`)
  for (const meldung of hinweise) console.log(`  - ${meldung}`)
}

if (fehler.length > 0) {
  console.error(`Lernseiten: ${fehler.length} Fehler gefunden\n`)
  for (const meldung of fehler) console.error(`  - ${meldung}`)
  zeigeHinweise()
  process.exit(1)
}

const faecher = ladeFaecher()
const anzahl = (n: number, einzahl: string, mehrzahl: string) => `${n} ${n === 1 ? einzahl : mehrzahl}`
const vorhanden = faecher.reduce((summe, fach) => summe + fach.anzahlThemen, 0)
const stationen = faecher.reduce((summe, fach) => summe + fach.anzahlStationen, 0)

console.log(
  `Lernseiten: alles gültig (${anzahl(faecher.length, "Fach", "Fächer")}, ` +
    `${vorhanden} von ${anzahl(stationen, "Station", "Stationen")} mit Themenseite).`,
)
for (const fach of faecher) {
  console.log(`  ${fach.kuerzel}: ${fach.anzahlThemen} von ${fach.anzahlStationen} Stationen vorhanden`)
}
zeigeHinweise()
