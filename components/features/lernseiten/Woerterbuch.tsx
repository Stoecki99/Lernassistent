// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// components/features/lernseiten/Woerterbuch.tsx
// Begriffstabelle: Symbol und Bedeutung.

import LernInhalt from "@/components/features/lernseiten/LernInhalt"

interface WoerterbuchProps {
  eintraege: { symbol: string; bedeutung: string }[]
}

export default function Woerterbuch({ eintraege }: WoerterbuchProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <caption className="text-left text-xs font-bold uppercase tracking-wide text-text-light mb-1">
          Wörterbuch
        </caption>
        <thead className="sr-only">
          <tr>
            <th scope="col">Symbol</th>
            <th scope="col">Bedeutung</th>
          </tr>
        </thead>
        <tbody>
          {eintraege.map((eintrag, i) => (
            <tr key={i} className="border-b border-gray-100 last:border-0">
              <td className="py-1.5 pr-4 whitespace-nowrap align-top">
                <LernInhalt inhalt={eintrag.symbol} inline />
              </td>
              <td className="py-1.5 text-text">
                <LernInhalt inhalt={eintrag.bedeutung} inline />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
