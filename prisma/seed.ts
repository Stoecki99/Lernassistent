// prisma/seed.ts
// Seed-Script: Erstellt vordefinierte Badges in der Datenbank.
// Ausfuehren mit: npx ts-node prisma/seed.ts

import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"

// Consistent with lib/prisma.ts: uses PrismaPg driver adapter
const adapter = new PrismaPg(process.env.DATABASE_URL!)
const prisma = new PrismaClient({ adapter })

const BADGES = [
  {
    name: "Erste Schritte",
    description: "Erste Karte gelernt",
    icon: "\uD83C\uDFAF",
    condition: "first_card",
    points: 10,
  },
  {
    name: "Fruehaufsteher",
    description: "3-Tage-Streak erreicht",
    icon: "\uD83C\uDF05",
    condition: "streak_3",
    points: 25,
  },
  {
    name: "Fleissig",
    description: "7-Tage-Streak erreicht",
    icon: "\uD83D\uDD25",
    condition: "streak_7",
    points: 50,
  },
  {
    name: "Quizmaster",
    description: "10 Quizze absolviert",
    icon: "\uD83E\uDDE0",
    condition: "quiz_10",
    points: 75,
  },
  {
    name: "Kartenkoenig",
    description: "100 Karten erstellt",
    icon: "\uD83D\uDC51",
    condition: "cards_100",
    points: 100,
  },
  {
    name: "Perfektionist",
    description: "Quiz mit 100% abgeschlossen",
    icon: "\uD83D\uDCAF",
    condition: "quiz_perfect",
    points: 150,
  },
  {
    name: "Marathonlaeufer",
    description: "30-Tage-Streak erreicht",
    icon: "\uD83C\uDFC3",
    condition: "streak_30",
    points: 200,
  },
  {
    name: "Buecherwurm",
    description: "500 Karten gelernt",
    icon: "\uD83D\uDCDA",
    condition: "cards_studied_500",
    points: 200,
  },
  // Leitstand (Projektsimulator), Spezifikation 3.13 / 4.7
  {
    name: "Erster Schichtwechsel",
    description: "Leitstand: Einführungslauf abgeschlossen",
    icon: "🎛️",
    condition: "leitstand_einfuehrung",
    points: 25,
  },
  {
    name: "Onlineschalter eröffnet",
    description: "Leitstand: Ernstfall abgeschlossen",
    icon: "🏛️",
    condition: "leitstand_ernstfall",
    points: 75,
  },
  {
    name: "Leitstand-Profi",
    description: "Leitstand: Ernstfall mit mindestens 820 Punkten",
    icon: "⭐",
    condition: "leitstand_drei_sterne",
    points: 150,
  },
  {
    name: "Punktlandung",
    description: "Leitstand: Abnahme bis Tag 40 und Kosten im Budget ohne Nachträge",
    icon: "🎯",
    condition: "leitstand_punktlandung",
    points: 100,
  },
  {
    name: "Klartext",
    description: "Leitstand: alle Statusberichte mit Ehrlichkeit von mindestens 85",
    icon: "📣",
    condition: "leitstand_klartext",
    points: 75,
  },
  {
    name: "Teamgeist",
    description: "Leitstand: Teammotivation nie unter 80, kein Ausfall durch Überlastung",
    icon: "🤝",
    condition: "leitstand_teamgeist",
    points: 75,
  },
  {
    name: "Risikoprofi",
    description: "Leitstand: Risikomanagement-Index im Mittel mindestens 100 und drei Risiken früh behandelt",
    icon: "🛡️",
    condition: "leitstand_risikoprofi",
    points: 75,
  },
  {
    name: "Null-Fehler-Abnahme",
    description: "Leitstand: höchstens 3 Restmängel bei der Abnahme",
    icon: "✅",
    condition: "leitstand_null_fehler",
    points: 100,
  },
  // Architektur-Leitstand (docs/architektur-leitstand.md, ARCHSIM_ABZEICHEN in lib/architektur-leitstand-regeln.ts)
  {
    name: "Erster Lasttest",
    description: "Architektur-Leitstand: erste Mission abgeschlossen",
    icon: "🖥️",
    condition: "archsim_erste_mission",
    points: 25,
  },
  {
    name: "Architektur hält",
    description: "Architektur-Leitstand: eine Mission mit 3 Sternen",
    icon: "🏗️",
    condition: "archsim_drei_sterne",
    points: 75,
  },
  {
    name: "Leitstand-Architekt·in",
    description: "Architektur-Leitstand: alle Missionen mit mindestens einem Stern",
    icon: "🛰️",
    condition: "archsim_alle_missionen",
    points: 100,
  },
  // AVSW-Modellierspiele (Spielstand, docs/architektur-modell.md Abschnitt 8)
  {
    name: "Fehlerfrei",
    description: "AVSW-Modellierspiel: ein Level mit 3 Sternen gelöst",
    icon: "💎",
    condition: "avsw_spiel_fehlerfrei",
    points: 25,
  },
  {
    name: "Architekt·in Bronze",
    description: "AVSW-Modellierspiele: 10 Sterne gesammelt",
    icon: "🥉",
    condition: "avsw_spiel_sterne_10",
    points: 25,
  },
  {
    name: "Architekt·in Silber",
    description: "AVSW-Modellierspiele: 25 Sterne gesammelt",
    icon: "🥈",
    condition: "avsw_spiel_sterne_25",
    points: 50,
  },
  {
    name: "Architekt·in Gold",
    description: "AVSW-Modellierspiele: 45 Sterne gesammelt",
    icon: "🥇",
    condition: "avsw_spiel_sterne_45",
    points: 100,
  },
  // IPMA-Prüfungssimulator, Spezifikation 6.10 (gleich wie Migration 20261102090000_ipma_modelle)
  {
    name: "Prüfungsluft",
    description: "IPMA-Prüfungssimulator: erste Übungsprüfung abgeschlossen",
    icon: "📝",
    condition: "ipma_erste_pruefung",
    points: 20,
  },
  {
    name: "Bestanden",
    description: "IPMA-Prüfungssimulator: Übungsprüfung unter Echtbedingungen bestanden",
    icon: "🎓",
    condition: "ipma_bestanden",
    points: 50,
  },
  {
    name: "Souverän",
    description: "IPMA-Prüfungssimulator: Übungsprüfung unter Echtbedingungen mit mindestens 80 % und 26 Kompetenzen",
    icon: "🏅",
    condition: "ipma_souveraen",
    points: 50,
  },
  {
    name: "Kompass",
    description: "IPMA-Prüfungssimulator: alle 28 Kompetenzen in einer Übungsprüfung nachgewiesen",
    icon: "🧭",
    condition: "ipma_kompass",
    points: 50,
  },
  {
    name: "Lückenschliesser",
    description: "IPMA-Prüfungssimulator: 10 Runden «Lücken schliessen» abgeschlossen",
    icon: "🔧",
    condition: "ipma_lueckenschliesser",
    points: 30,
  },
  {
    name: "Landkarte komplett",
    description: "IPMA-Prüfungssimulator: Beherrschung «sicher» in allen 28 Kompetenzen",
    icon: "🗺️",
    condition: "ipma_landkarte",
    points: 50,
  },
]

async function seed() {
  console.log("Seeding Badges...")

  for (const badge of BADGES) {
    await prisma.badge.upsert({
      where: { condition: badge.condition },
      update: {
        name: badge.name,
        description: badge.description,
        icon: badge.icon,
        points: badge.points,
      },
      create: badge,
    })
    console.log(`  Badge "${badge.name}" (${badge.icon}) erstellt/aktualisiert.`)
  }

  console.log(`\nFertig: ${BADGES.length} Badges geseeded.`)
}

seed()
  .catch((error) => {
    console.error("Seed-Fehler:", error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
