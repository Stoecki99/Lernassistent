// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// components/features/architektur-leitstand/HtmlText.tsx
// Gibt das feste HTML der Missionen als React-Elemente aus (ohne dangerouslySetInnerHTML, siehe html.ts).
// Bausteine (span data-baustein) werden auf Wunsch zu Schaltflächen zum Markieren (Modellierphase).

import type { ReactNode } from "react"
import { htmlLesen, type HtmlKnoten } from "./html"

export interface BausteinOptionen {
  /** Klick auf einen Baustein */
  onBaustein?: (id: string) => void
  /** CSS-Klasse je Baustein (markiert, gesetzt …) */
  klasse?: (id: string) => string
  /** Zusatz für Screenreader, z. B. «markiert, im Modell» */
  zustand?: (id: string) => string
}

function knoten(k: HtmlKnoten[], o: BausteinOptionen, pfad: string): ReactNode[] {
  return k.map((n, i) => {
    const key = `${pfad}.${i}`
    if (n.art === "text") return n.text
    const kinder = knoten(n.kinder, o, key)
    if (n.tag === "br") return <br key={key} />
    if (n.tag === "span" && n.baustein) {
      const id = n.baustein
      if (o.onBaustein) {
        const zusatz = o.zustand?.(id)
        return (
          <button key={key} type="button" className={o.klasse?.(id)} onClick={() => o.onBaustein?.(id)}>
            {kinder}
            {zusatz ? <span className="sr-only"> ({zusatz})</span> : null}
          </button>
        )
      }
      return (
        <span key={key} className={o.klasse?.(id)}>
          {kinder}
        </span>
      )
    }
    const Tag = n.tag
    return <Tag key={key}>{kinder}</Tag>
  })
}

export default function HtmlText({ html, ...o }: { html: string } & BausteinOptionen) {
  return <>{knoten(htmlLesen(html), o, "h")}</>
}
