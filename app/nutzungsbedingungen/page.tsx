// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

import Link from "next/link"
import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Nutzungsbedingungen | Lernassistent",
  description: "Nutzungsbedingungen des Lernassistenten.",
}

export default function NutzungsbedingungenPage() {
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
          <h1 className="text-3xl font-bold text-gray-800 mb-8">
            Nutzungsbedingungen
          </h1>

          <div className="space-y-6">
            <section>
              <h2 className="text-xl font-bold text-gray-800 mt-8 mb-3">
                1. Geltungsbereich
              </h2>
              <p className="text-gray-600 leading-relaxed">
                Diese Nutzungsbedingungen gelten für die Nutzung der
                Web-Applikation &quot;Lernassistent&quot; unter der Domain
                lernen.jan-stocker.cloud. Mit der Registrierung und Nutzung
                des Lernassistenten erklärst Du Dich mit diesen Bedingungen
                einverstanden.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-800 mt-8 mb-3">
                2. Leistungsbeschreibung
              </h2>
              <p className="text-gray-600 leading-relaxed">
                Der Lernassistent ist ein kostenloses, privat betriebenes
                Lernwerkzeug für Studenten. Die Applikation bietet
                Karteikarten, Quiz-Funktionen, Spaced Repetition und einen
                KI-gestützten Chat-Assistenten. Es handelt sich um eine
                unentgeltliche Leistung ohne kommerzielle Absicht.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-800 mt-8 mb-3">
                3. Haftungsausschluss
              </h2>
              <p className="text-gray-600 leading-relaxed font-semibold">
                Die Nutzung des Lernassistenten erfolgt vollständig auf eigene
                Gefahr.
              </p>
              <p className="text-gray-600 leading-relaxed mt-2">
                Da es sich um eine unentgeltliche Leistung handelt, übernehme
                ich (Jan Stocker) keinerlei Gewährleistung oder Haftung für:
              </p>
              <ul className="list-disc list-inside text-gray-600 space-y-1 mt-2">
                <li>
                  Die Verfügbarkeit, Zuverlässigkeit oder
                  Unterbrechungsfreiheit des Dienstes
                </li>
                <li>
                  Datenverlust, insbesondere den Verlust von Karteikarten,
                  Decks, Lernfortschritt oder sonstigen Nutzerdaten
                </li>
                <li>
                  Die Richtigkeit, Vollständigkeit oder Aktualität von
                  Inhalten — insbesondere der KI-generierten Inhalte
                </li>
                <li>
                  Schäden, die durch die Nutzung oder Nichtnutzung der
                  bereitgestellten Informationen entstehen
                </li>
                <li>
                  Technische Fehler, Sicherheitslücken oder Ausfälle
                </li>
              </ul>
              <p className="text-gray-600 leading-relaxed mt-3">
                Es besteht kein Anspruch auf Betrieb, Wartung, Support oder
                Weiterentwicklung der Applikation. Ich behalte mir vor, den
                Dienst jederzeit ohne Vorankündigung einzuschränken,
                zu ändern oder einzustellen.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-800 mt-8 mb-3">
                4. KI-generierte Inhalte
              </h2>
              <p className="text-gray-600 leading-relaxed">
                Der Lernassistent verwendet die Claude API von Anthropic zur
                Generierung von Quiz-Fragen, Chat-Antworten und weiteren
                Inhalten. Diese KI-generierten Inhalte können fehlerhaft,
                ungenau oder veraltet sein. Sie ersetzen in keinem Fall das
                eigenständige Lernen, Prüfen und Verifizieren von
                Lerninhalten. Du bist selbst dafür verantwortlich, die
                Richtigkeit der Inhalte zu überprüfen.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-800 mt-8 mb-3">
                5. Nutzerinhalte
              </h2>
              <p className="text-gray-600 leading-relaxed">
                Die von Dir erstellten Inhalte (Karteikarten, Decks,
                Nachrichten) verbleiben in Deinem Eigentum. Ich erhebe keinen
                Anspruch auf Deine Lerninhalte. Allerdings kann ich keine
                Garantie für die dauerhafte Speicherung Deiner Daten
                übernehmen. Es wird empfohlen, regelmässig eigene Backups
                Deiner Karteikarten zu erstellen.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-800 mt-8 mb-3">
                6. Verbotene Nutzung
              </h2>
              <p className="text-gray-600 leading-relaxed">
                Es ist untersagt:
              </p>
              <ul className="list-disc list-inside text-gray-600 space-y-1 mt-2">
                <li>
                  Die Applikation für rechtswidrige Zwecke zu nutzen
                </li>
                <li>
                  Die Sicherheit der Applikation zu beeinträchtigen oder zu
                  umgehen
                </li>
                <li>
                  Automatisierte Zugriffe (Bots, Scraping) durchzuführen
                </li>
                <li>
                  Die KI-Funktion für die Erzeugung rechtswidriger oder
                  schädlicher Inhalte zu missbrauchen
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-800 mt-8 mb-3">
                7. Urheberrecht
              </h2>
              <p className="text-gray-600 leading-relaxed">
                Der Quellcode, das Design und die Struktur des Lernassistenten
                sind urheberrechtlich geschütztes Eigentum von Jan Stocker.
                Jegliches Kopieren, Modifizieren oder Weiterverbreiten des
                Quellcodes oder wesentlicher Teile davon ist ohne
                ausdrückliche schriftliche Genehmigung untersagt.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-800 mt-8 mb-3">
                8. Kontosperrung
              </h2>
              <p className="text-gray-600 leading-relaxed">
                Ich behalte mir vor, Nutzerkonten bei Verstoss gegen diese
                Nutzungsbedingungen ohne Vorankündigung zu sperren oder zu
                löschen.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-800 mt-8 mb-3">
                9. Änderungen
              </h2>
              <p className="text-gray-600 leading-relaxed">
                Ich behalte mir vor, diese Nutzungsbedingungen jederzeit
                anzupassen. Die aktuelle Fassung ist stets auf dieser Seite
                abrufbar. Bei wesentlichen Änderungen wirst Du beim nächsten
                Login darauf hingewiesen.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-800 mt-8 mb-3">
                10. Anwendbares Recht
              </h2>
              <p className="text-gray-600 leading-relaxed">
                Es gilt ausschliesslich Schweizer Recht. Gerichtsstand ist
                der Wohnsitz des Betreibers.
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
