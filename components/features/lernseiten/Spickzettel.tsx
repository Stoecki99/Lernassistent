// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// components/features/lernseiten/Spickzettel.tsx
// Gesammelte Spickzettel-Eintraege aller Themen eines Fachs.

import Link from "next/link"
import type { SpickzettelEintrag } from "@/lib/lernseiten"
import LernInhalt from "@/components/features/lernseiten/LernInhalt"

export default function Spickzettel({ eintraege, fachSlug }: { eintraege: SpickzettelEintrag[]; fachSlug: string }) {
  return (
    <div className="bg-surface-card rounded-2xl shadow-card overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wide text-text-light">
            <th scope="col" className="px-4 py-3">Begriff</th>
            <th scope="col" className="px-4 py-3">Kurz</th>
            <th scope="col" className="px-4 py-3">Formel</th>
            <th scope="col" className="px-4 py-3">Quelle</th>
          </tr>
        </thead>
        <tbody>
          {eintraege.map((eintrag, i) => (
            <tr key={i} className="border-t border-gray-100 align-top">
              <td className="px-4 py-2 font-bold text-text-dark">{eintrag.begriff}</td>
              <td className="px-4 py-2 text-text">
                <LernInhalt inhalt={eintrag.kurz} inline />
              </td>
              <td className="px-4 py-2 whitespace-nowrap">
                {eintrag.formel ? <LernInhalt inhalt={eintrag.formel} inline /> : "—"}
              </td>
              <td className="px-4 py-2 text-text-light whitespace-nowrap">
                <Link
                  href={`/lernseiten/${fachSlug}/${eintrag.themaSlug}`}
                  className="hover:text-secondary-dark underline-offset-2 hover:underline"
                >
                  {eintrag.quelle}
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
