// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// components/features/architektur-leitstand/html.ts
// Kleiner Leser für das feste HTML der Missionen (Briefing, Auftrag in lib/archsim/scenarios) ohne
// dangerouslySetInnerHTML: erlaubt sind nur p, strong, em, b, i, code, br und span mit data-baustein.
// Alles andere wird als Text ausgegeben (React maskiert es). Geprüft in tests/architektur-leitstand-ui.test.ts.

export type HtmlKnoten =
  | { art: "text"; text: string }
  | { art: "tag"; tag: ErlaubterTag; baustein?: string; kinder: HtmlKnoten[] }

export const ERLAUBTE_TAGS = ["p", "strong", "em", "b", "i", "code", "br", "span"] as const
export type ErlaubterTag = (typeof ERLAUBTE_TAGS)[number]

const ENTITAETEN: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'", nbsp: " " }

function entschluesseln(s: string): string {
  return s.replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (_, n: string) => ENTITAETEN[n] ?? _)
}

const TAG = /<(\/?)([a-z]+)((?:\s+[a-z-]+="[^"<>]*")*)\s*(\/?)>/g
const BAUSTEIN = /data-baustein="([a-z0-9][a-z0-9-]{0,59})"/

/** HTML in Knoten zerlegen. Unbekannte oder falsch verschachtelte Tags werden zu Text. */
export function htmlLesen(html: string): HtmlKnoten[] {
  const wurzel: HtmlKnoten[] = []
  const stapel: Array<{ tag: ErlaubterTag; kinder: HtmlKnoten[] }> = []
  const ziel = () => (stapel.length ? stapel[stapel.length - 1].kinder : wurzel)
  const text = (t: string) => {
    if (!t) return
    const k = ziel()
    const letzter = k[k.length - 1]
    if (letzter?.art === "text") letzter.text += entschluesseln(t)
    else k.push({ art: "text", text: entschluesseln(t) })
  }
  let pos = 0
  TAG.lastIndex = 0
  for (let m = TAG.exec(html); m; m = TAG.exec(html)) {
    text(html.slice(pos, m.index))
    pos = m.index + m[0].length
    const [roh, zu, name, attr] = m
    const tag = (ERLAUBTE_TAGS as readonly string[]).includes(name) ? (name as ErlaubterTag) : null
    if (!tag) {
      text(roh)
      continue
    }
    if (tag === "br") {
      ziel().push({ art: "tag", tag: "br", kinder: [] })
      continue
    }
    if (zu) {
      if (stapel.length && stapel[stapel.length - 1].tag === tag) stapel.pop()
      else text(roh)
      continue
    }
    const knoten: HtmlKnoten = { art: "tag", tag, kinder: [] }
    const b = tag === "span" ? BAUSTEIN.exec(attr ?? "") : null
    if (b) knoten.baustein = b[1]
    ziel().push(knoten)
    stapel.push({ tag, kinder: knoten.kinder })
  }
  text(html.slice(pos))
  return wurzel
}

/** Reiner Text (z. B. für aria-label oder Kurzfassung) */
export function htmlText(html: string): string {
  const aus: string[] = []
  const lauf = (k: HtmlKnoten[]) => {
    for (const n of k) {
      if (n.art === "text") aus.push(n.text)
      else if (n.tag === "br") aus.push(" ")
      else {
        lauf(n.kinder)
        if (n.tag === "p") aus.push(" ")
      }
    }
  }
  lauf(htmlLesen(html))
  return aus.join("").replace(/\s+/g, " ").trim()
}

/** Alle Bausteine (data-baustein) in Reihenfolge, ohne Doppelte */
export function bausteineIm(html: string): string[] {
  const out: string[] = []
  const lauf = (k: HtmlKnoten[]) => {
    for (const n of k) {
      if (n.art !== "tag") continue
      if (n.baustein && !out.includes(n.baustein)) out.push(n.baustein)
      lauf(n.kinder)
    }
  }
  lauf(htmlLesen(html))
  return out
}
