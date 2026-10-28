// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// components/features/lernseiten/Bausteine.tsx
// Schritt 0: Grundbegriffe mit Alltagsanalogie und Mini-Beispiel, danach die Mini-Uebung.

import type { Seite } from "@/lib/validations/lernseite"
import LernInhalt from "@/components/features/lernseiten/LernInhalt"
import SortierUebung from "@/components/features/lernseiten/SortierUebung"

export default function Bausteine({ bausteine }: { bausteine: Seite["bausteine"] }) {
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        {bausteine.begriffe.map((begriff) => (
          <div key={begriff.name} className="bg-surface-card rounded-2xl shadow-card p-5">
            <h3 className="font-extrabold text-text-dark text-lg mb-2">{begriff.name}</h3>
            <div className="text-sm text-text space-y-2">
              <div>
                <span className="font-bold text-text-light">Wie im Alltag: </span>
                <LernInhalt inhalt={begriff.analogie} inline />
              </div>
              <div>
                <span className="font-bold text-text-light">Beispiel: </span>
                <LernInhalt inhalt={begriff.beispiel} inline />
              </div>
            </div>
          </div>
        ))}
      </div>
      <SortierUebung uebung={bausteine.uebung} />
    </div>
  )
}
