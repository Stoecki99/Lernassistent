// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// components/features/lernseiten/Merke.tsx
// «Auf einen Blick»: Merksaetze zum Thema.

import LernInhalt from "@/components/features/lernseiten/LernInhalt"

export default function Merke({ saetze }: { saetze: string[] }) {
  return (
    <ul className="bg-primary/5 border-2 border-primary/20 rounded-2xl p-5 sm:p-6 space-y-3">
      {saetze.map((satz, i) => (
        <li key={i} className="flex gap-3 text-text-dark">
          <span className="font-extrabold text-primary-dark" aria-hidden="true">
            {i + 1}.
          </span>
          <LernInhalt inhalt={satz} className="flex-1" />
        </li>
      ))}
    </ul>
  )
}
