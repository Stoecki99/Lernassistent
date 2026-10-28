// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

import Link from "next/link"
import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Impressum | Lernassistent",
  description: "Impressum des Lernassistenten.",
}

export default function ImpressumPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold text-primary">
            Lernassistent
          </Link>
          <Link
            href="/"
            className="text-gray-500 hover:text-gray-700 text-sm"
          >
            Zurück zur Startseite
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12">
        <div className="bg-white rounded-2xl shadow-md p-8 md:p-12">
          <h1 className="text-3xl font-bold text-gray-800 mb-8">Impressum</h1>

          <div className="space-y-6">
            <section>
              <h2 className="text-xl font-bold text-gray-800 mt-8 mb-3">
                Angaben gemäss Schweizer Recht
              </h2>
              <p className="text-gray-600 leading-relaxed">
                Jan Stocker
                <br />
                Private, nicht-kommerzielle Website
                <br />
                <br />
                Kontakt:{" "}
                <Link
                  href="/kontakt"
                  className="text-primary hover:underline"
                >
                  Kontaktformular
                </Link>
                <br />
                Website:{" "}
                <a
                  href="https://jan-stocker.cloud"
                  className="text-primary hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  jan-stocker.cloud
                </a>
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-800 mt-8 mb-3">
                Kontakt
              </h2>
              <p className="text-gray-600 leading-relaxed">
                Für Fragen, Anregungen oder Probleme nutze bitte das{" "}
                <Link
                  href="/kontakt"
                  className="text-primary hover:underline font-semibold"
                >
                  Kontaktformular
                </Link>
                .
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-800 mt-8 mb-3">
                Hosting
              </h2>
              <p className="text-gray-600 leading-relaxed">
                Diese Website wird gehostet bei:
                <br />
                Hostinger International Ltd.
                <br />
                61 Lordou Vironos Street, 6023 Larnaca, Zypern
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-800 mt-8 mb-3">
                Haftungsausschluss
              </h2>
              <p className="text-gray-600 leading-relaxed">
                Der Lernassistent ist ein kostenloses, privat betriebenes
                Hilfsmittel. Die Nutzung erfolgt vollständig auf eigene
                Gefahr. Da es sich um eine unentgeltliche Leistung handelt,
                übernehme ich (Jan Stocker) keinerlei Gewährleistung oder
                Haftung für die Richtigkeit, Vollständigkeit oder
                Verfügbarkeit der Inhalte und des Dienstes.
              </p>
              <p className="text-gray-600 leading-relaxed mt-2">
                Die durch die KI generierten Inhalte (Quiz-Fragen,
                Chat-Antworten) können Fehler enthalten und ersetzen nicht
                das eigenständige Lernen und Prüfen der Inhalte. Eine
                Haftung für Datenverlust, technische Fehler oder Ausfälle
                ist ausgeschlossen.
              </p>
              <p className="text-gray-600 leading-relaxed mt-2">
                Die vollständigen Bedingungen findest Du in den{" "}
                <Link
                  href="/nutzungsbedingungen"
                  className="text-primary hover:underline"
                >
                  Nutzungsbedingungen
                </Link>
                .
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-800 mt-8 mb-3">
                Urheberrecht
              </h2>
              <p className="text-gray-600 leading-relaxed">
                Der Quellcode, das Design und die Struktur des Lernassistenten
                sind urheberrechtlich geschütztes Eigentum von Jan Stocker.
                Jegliches Kopieren, Modifizieren oder Weiterverbreiten des
                Quellcodes oder wesentlicher Teile davon ist ohne
                ausdrückliche schriftliche Genehmigung untersagt.
              </p>
              <p className="text-gray-600 leading-relaxed mt-2">
                Die von Nutzern erstellten Inhalte (Karteikarten, Decks)
                verbleiben im Eigentum der jeweiligen Nutzer.
              </p>
              <p className="text-gray-500 text-sm mt-4">Stand: April 2026</p>
            </section>
          </div>
        </div>
      </main>

      <footer className="max-w-4xl mx-auto px-6 py-8 text-center text-sm text-gray-400">
        <div className="flex justify-center gap-6">
          <Link href="/datenschutz" className="hover:text-gray-600">
            Datenschutz
          </Link>
          <Link href="/impressum" className="hover:text-gray-600">
            Impressum
          </Link>
          <Link href="/nutzungsbedingungen" className="hover:text-gray-600">
            Nutzungsbedingungen
          </Link>
        </div>
      </footer>
    </div>
  )
}
