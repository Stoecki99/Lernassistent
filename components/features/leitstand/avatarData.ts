// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// components/features/leitstand/avatarData.ts
// Merkmale der gezeichneten Porträts (frei erfundene Figuren, keine Fotos, keine Vorlagen realer Personen).
// Zuordnung über den angezeigten Namen, weil Absender von Ereignissen nicht immer eine ID tragen und dieselben
// Figuren in mehreren Szenarien vorkommen (Mia Baumann). Unbekannte Namen erhalten ein festes Porträt aus einer Prüfsumme
// des Namens (deterministisch, ohne Zufall des Rechenkerns). Ohne React, damit Tests die Zuordnung prüfen können.

export type HairStyle = "kurz" | "scheitel" | "lang" | "dutt" | "locken" | "glatze" | "zopf" | "bob" | "stoppel"
export type Clothing = "hemd" | "pullover" | "blazer" | "tshirt" | "bluse" | "anzug"
export type Beard = "voll" | "schnauz" | "stoppeln"
export type Accessory =
  | "laptop"
  | "plan"
  | "klemmbrett"
  | "megafon"
  | "rechner"
  | "schild"
  | "helm"
  | "tablet"
  | "ordner"
  | "headset"
  | "notiz"
  | "sprechblase"
  | "dokument"
export type Emblem = "gebaeude" | "leute" | "zeitung" | "schild" | "stempel" | "schalter" | "kreuz" | "pfote" | "zirkel"

/** Token-Reihe 1–5 (--s1 … --s5) für Kleidung und Hintergrund */
export type Tone = 1 | 2 | 3 | 4 | 5

export type AvatarSpec =
  | {
      kind: "person"
      /** Hautton 0 (hell) bis 5 (dunkel) */
      skin: 0 | 1 | 2 | 3 | 4 | 5
      hair: HairStyle
      /** 0 schwarz, 1 dunkelbraun, 2 braun, 3 blond, 4 rot, 5 grau, 6 weiss */
      hairColor: 0 | 1 | 2 | 3 | 4 | 5 | 6
      clothing: Clothing
      tone: Tone
      bg: Tone
      accessory?: Accessory
      glasses?: boolean
      beard?: Beard
      earrings?: boolean
    }
  | { kind: "gruppe"; emblem: Emblem; bg: Tone }

/** Illustrationsfarben (Haut, Haare) sind keine Oberflächenfarben und bleiben in hell und dunkel gleich. */
export const SKIN = ["#f5d6c1", "#ecbf9d", "#d7a079", "#b67a52", "#8a573a", "#5c3a27"] as const
export const HAIR = ["#231c1e", "#3d2a1f", "#6e4a2c", "#d4ad62", "#a5512b", "#9b9895", "#e7e3dd"] as const

export const AVATARS: Record<string, AvatarSpec> = {
  // Team
  "Seraina Caflisch": { kind: "person", skin: 1, hair: "dutt", hairColor: 2, clothing: "blazer", tone: 3, bg: 3, accessory: "klemmbrett", earrings: true },
  "Luca Bernasconi": { kind: "person", skin: 2, hair: "kurz", hairColor: 0, clothing: "pullover", tone: 1, bg: 1, accessory: "tablet", beard: "stoppeln" },
  "Aylin Demir": { kind: "person", skin: 3, hair: "lang", hairColor: 0, clothing: "bluse", tone: 4, bg: 4, accessory: "notiz", earrings: true },
  "Martin Zgraggen": { kind: "person", skin: 0, hair: "glatze", hairColor: 5, clothing: "hemd", tone: 2, bg: 2, accessory: "ordner", glasses: true },
  "Thomas Ellinger": { kind: "person", skin: 1, hair: "kurz", hairColor: 5, clothing: "hemd", tone: 3, bg: 5, accessory: "helm", beard: "schnauz" },
  "Nadia Rossi": { kind: "person", skin: 2, hair: "bob", hairColor: 1, clothing: "blazer", tone: 5, bg: 5, accessory: "megafon", earrings: true },
  "Jasmin Huber": { kind: "person", skin: 0, hair: "zopf", hairColor: 3, clothing: "tshirt", tone: 3, bg: 1, accessory: "headset" },
  "Urs Ammann": { kind: "person", skin: 1, hair: "scheitel", hairColor: 2, clothing: "hemd", tone: 1, bg: 2, accessory: "rechner", glasses: true },
  "Dario Pfister": { kind: "person", skin: 1, hair: "kurz", hairColor: 1, clothing: "tshirt", tone: 4, bg: 4, accessory: "laptop", beard: "voll" },
  "Elena Kovačević": { kind: "person", skin: 1, hair: "lang", hairColor: 1, clothing: "pullover", tone: 2, bg: 3, accessory: "laptop", glasses: true },
  "Jonas Brunner": { kind: "person", skin: 0, hair: "locken", hairColor: 4, clothing: "tshirt", tone: 5, bg: 1, accessory: "tablet" },
  "Sabine Wäfler": { kind: "person", skin: 1, hair: "bob", hairColor: 5, clothing: "blazer", tone: 1, bg: 3, accessory: "schild", glasses: true, earrings: true },
  "Ramon Gisler": { kind: "person", skin: 4, hair: "stoppel", hairColor: 0, clothing: "pullover", tone: 3, bg: 4, accessory: "laptop" },
  // Personen unter den Stakeholdern
  "Franziska Bühlmann": { kind: "person", skin: 0, hair: "lang", hairColor: 3, clothing: "blazer", tone: 4, bg: 5, accessory: "dokument", earrings: true },
  "Walter Inauen": { kind: "person", skin: 0, hair: "kurz", hairColor: 6, clothing: "anzug", tone: 2, bg: 1, glasses: true },
  "Claudia Wyss": { kind: "person", skin: 1, hair: "dutt", hairColor: 5, clothing: "blazer", tone: 1, bg: 4, accessory: "ordner", glasses: true },
  "Beat Imhof": { kind: "person", skin: 2, hair: "kurz", hairColor: 2, clothing: "hemd", tone: 3, bg: 2, accessory: "plan", beard: "voll" },
  "Silvan Schuler": { kind: "person", skin: 5, hair: "glatze", hairColor: 0, clothing: "pullover", tone: 1, bg: 5, accessory: "tablet", beard: "stoppeln" },
  "Monika Steiner": { kind: "person", skin: 0, hair: "bob", hairColor: 4, clothing: "bluse", tone: 5, bg: 2, accessory: "rechner" },
  "Daniel Frei": { kind: "person", skin: 0, hair: "scheitel", hairColor: 3, clothing: "anzug", tone: 2, bg: 3, accessory: "laptop" },
  "Mia Baumann": { kind: "person", skin: 4, hair: "locken", hairColor: 1, clothing: "bluse", tone: 3, bg: 1, accessory: "sprechblase", earrings: true },
  // Hochmatt (2.11.6): Team
  "Regula Tschanz": { kind: "person", skin: 0, hair: "bob", hairColor: 5, clothing: "blazer", tone: 2, bg: 4, accessory: "ordner", glasses: true, earrings: true },
  "Mirko Vasić": { kind: "person", skin: 1, hair: "kurz", hairColor: 1, clothing: "hemd", tone: 4, bg: 2, accessory: "tablet", beard: "stoppeln" },
  "Leonie Hasler": { kind: "person", skin: 0, hair: "zopf", hairColor: 4, clothing: "pullover", tone: 5, bg: 3, accessory: "notiz" },
  "Bruno Zaugg": { kind: "person", skin: 1, hair: "glatze", hairColor: 6, clothing: "pullover", tone: 2, bg: 1, accessory: "rechner", glasses: true, beard: "schnauz" },
  "Priska Vonlanthen": { kind: "person", skin: 1, hair: "locken", hairColor: 2, clothing: "bluse", tone: 1, bg: 5, accessory: "headset", earrings: true },
  "Nora Bächtold": { kind: "person", skin: 0, hair: "dutt", hairColor: 0, clothing: "blazer", tone: 1, bg: 2, accessory: "dokument", glasses: true },
  "Sandro Lüthi": { kind: "person", skin: 1, hair: "stoppel", hairColor: 2, clothing: "tshirt", tone: 2, bg: 4, accessory: "laptop" },
  "Yasmin El-Amrani": { kind: "person", skin: 3, hair: "lang", hairColor: 0, clothing: "pullover", tone: 3, bg: 5, accessory: "tablet", earrings: true },
  "Florian Wüthrich": { kind: "person", skin: 0, hair: "scheitel", hairColor: 3, clothing: "hemd", tone: 5, bg: 4, accessory: "laptop", beard: "voll" },
  "Meilin Zürcher": { kind: "person", skin: 2, hair: "bob", hairColor: 0, clothing: "tshirt", tone: 4, bg: 1, accessory: "laptop", glasses: true },
  "Kevin Rohner": { kind: "person", skin: 0, hair: "locken", hairColor: 1, clothing: "tshirt", tone: 1, bg: 3, accessory: "plan" },
  "Ursina Planta": { kind: "person", skin: 0, hair: "kurz", hairColor: 5, clothing: "anzug", tone: 3, bg: 2, accessory: "schild", glasses: true, earrings: true },
  "Selina Brügger": { kind: "person", skin: 1, hair: "lang", hairColor: 3, clothing: "bluse", tone: 5, bg: 1, accessory: "sprechblase", earrings: true },
  "Dominik Steffen": { kind: "person", skin: 4, hair: "kurz", hairColor: 0, clothing: "pullover", tone: 4, bg: 3, accessory: "headset" },
  // Hochmatt (2.11.4): Personen unter den Stakeholdern
  "Helen Gasche": { kind: "person", skin: 0, hair: "bob", hairColor: 2, clothing: "blazer", tone: 3, bg: 1, accessory: "klemmbrett", earrings: true },
  "Erwin Sigrist": { kind: "person", skin: 1, hair: "scheitel", hairColor: 5, clothing: "anzug", tone: 1, bg: 4, glasses: true },
  "Claudine Rüegg": { kind: "person", skin: 1, hair: "dutt", hairColor: 3, clothing: "blazer", tone: 2, bg: 5, accessory: "ordner" },
  "Roland Etter": { kind: "person", skin: 0, hair: "kurz", hairColor: 5, clothing: "hemd", tone: 4, bg: 3, accessory: "klemmbrett", beard: "voll" },
  "Isabelle Graf": { kind: "person", skin: 2, hair: "lang", hairColor: 1, clothing: "blazer", tone: 4, bg: 2, accessory: "laptop" },
  "Matthias Zollinger": { kind: "person", skin: 0, hair: "glatze", hairColor: 1, clothing: "anzug", tone: 5, bg: 3, accessory: "dokument", glasses: true },
  "Simone Kradolfer": { kind: "person", skin: 1, hair: "zopf", hairColor: 2, clothing: "blazer", tone: 5, bg: 4, accessory: "tablet", earrings: true },
  // Gruppen und Organisationen
  Gemeinderat: { kind: "gruppe", emblem: "gebaeude", bg: 1 },
  "Gemeinde Seeweid": { kind: "gruppe", emblem: "gebaeude", bg: 3 },
  Bevölkerung: { kind: "gruppe", emblem: "leute", bg: 3 },
  Hundehaltende: { kind: "gruppe", emblem: "pfote", bg: 5 },
  Einwohnerdienste: { kind: "gruppe", emblem: "schalter", bg: 2 },
  "Architekturforum Wolkenried": { kind: "gruppe", emblem: "zirkel", bg: 4 },
  "Pilotbüro (Architekturforum)": { kind: "gruppe", emblem: "zirkel", bg: 2 },
  Fachstellen: { kind: "gruppe", emblem: "stempel", bg: 5 },
  "Kantonale Datenschutzstelle": { kind: "gruppe", emblem: "schild", bg: 1 },
  "Wolkenrieder Bote": { kind: "gruppe", emblem: "zeitung", bg: 2 },
  "Krankmeldung aus der Linie": { kind: "gruppe", emblem: "kreuz", bg: 4 },
  "Gemeinde Wolkenried": { kind: "gruppe", emblem: "gebaeude", bg: 2 },
  // Hochmatt (2.11.1, 2.11.4, 2.11.8): Gremien, Organisationen, Gruppen; mehrere Schreibweisen, damit das Szenario frei wählen kann
  "Kanton Hochmatt": { kind: "gruppe", emblem: "gebaeude", bg: 4 },
  Regierungsrat: { kind: "gruppe", emblem: "gebaeude", bg: 5 },
  "Regierungsrat Hochmatt": { kind: "gruppe", emblem: "gebaeude", bg: 5 },
  "Amt für Ausbildungsbeiträge": { kind: "gruppe", emblem: "schalter", bg: 3 },
  Gesuchstellende: { kind: "gruppe", emblem: "leute", bg: 2 },
  "Verband Studierender Hochmatt": { kind: "gruppe", emblem: "leute", bg: 1 },
  "Verband Studierender": { kind: "gruppe", emblem: "leute", bg: 1 },
  "Bevölkerung und Medien": { kind: "gruppe", emblem: "zeitung", bg: 4 },
  "Hochmatter Zeitung": { kind: "gruppe", emblem: "zeitung", bg: 3 },
  "Personalverband Hochmatt": { kind: "gruppe", emblem: "leute", bg: 4 },
  Personalverband: { kind: "gruppe", emblem: "leute", bg: 4 },
  "Kantonale Datenschutzbeauftragte": { kind: "gruppe", emblem: "schild", bg: 2 },
  Datenschutzbeauftragte: { kind: "gruppe", emblem: "schild", bg: 2 },
  "Staatsarchiv Hochmatt": { kind: "gruppe", emblem: "stempel", bg: 1 },
  Staatsarchiv: { kind: "gruppe", emblem: "stempel", bg: 1 },
  "Kanton Talwies": { kind: "gruppe", emblem: "gebaeude", bg: 3 },
  "Arvenhof Software AG": { kind: "gruppe", emblem: "zirkel", bg: 5 },
  "Talgrat Modelle AG": { kind: "gruppe", emblem: "zirkel", bg: 1 },
  "Kantonales Informatikamt": { kind: "gruppe", emblem: "schalter", bg: 5 },
}

/** Titel vor dem Namen («Dr. Nora Bächtold» → «Nora Bächtold»), damit beide Schreibweisen dasselbe Porträt zeigen */
const TITLE_PREFIX = /^(?:(?:Dr|Prof)\.\s+)+/

/** Zugeordnetes Porträt (auch mit Titel vor dem Namen) oder undefined */
export function knownAvatar(name: string): AvatarSpec | undefined {
  return AVATARS[name] ?? AVATARS[name.replace(TITLE_PREFIX, "")]
}

/** FNV-1a (32 Bit) für die Ersatz-Porträts; verbraucht keinen Zufall des Rechenkerns. */
function hash32(text: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h >>> 0
}

const HAIR_STYLES: HairStyle[] = ["kurz", "scheitel", "lang", "dutt", "locken", "glatze", "zopf", "bob", "stoppel"]
const CLOTHES: Clothing[] = ["hemd", "pullover", "blazer", "tshirt", "bluse", "anzug"]

/** Festes Porträt je Name: zuerst die Zuordnung, sonst aus der Prüfsumme des Namens abgeleitet. */
export function avatarSpec(name: string): AvatarSpec {
  const known = knownAvatar(name)
  if (known) return known
  const h = hash32(name)
  const pick = (n: number, shift: number) => (h >>> shift) % n
  return {
    kind: "person",
    skin: pick(6, 0) as 0 | 1 | 2 | 3 | 4 | 5,
    hair: HAIR_STYLES[pick(HAIR_STYLES.length, 3)],
    hairColor: pick(7, 7) as 0 | 1 | 2 | 3 | 4 | 5 | 6,
    clothing: CLOTHES[pick(CLOTHES.length, 11)],
    tone: (pick(5, 15) + 1) as Tone,
    bg: (pick(5, 19) + 1) as Tone,
    glasses: pick(4, 23) === 0,
  }
}
