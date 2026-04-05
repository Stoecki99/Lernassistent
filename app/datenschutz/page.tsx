import Link from "next/link"
import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Datenschutzerklärung | Lernassistent",
  description:
    "Datenschutzerklärung des Lernassistenten nach Schweizer Datenschutzgesetz (DSG/nDSG).",
}

export default function DatenschutzPage() {
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
            Datenschutzerklärung
          </h1>

          <div className="space-y-6">
            <section>
              <h2 className="text-xl font-bold text-gray-800 mt-8 mb-3">
                1. Verantwortliche Stelle
              </h2>
              <p className="text-gray-600 leading-relaxed">
                Verantwortlich für die Datenbearbeitung auf dieser Website ist:
              </p>
              <p className="text-gray-600 leading-relaxed mt-2">
                Jan Stocker
                <br />
                Kontakt:{" "}
                <Link
                  href="/kontakt"
                  className="text-primary hover:underline"
                >
                  Kontaktformular
                </Link>
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-800 mt-8 mb-3">
                2. Geltungsbereich
              </h2>
              <p className="text-gray-600 leading-relaxed">
                Diese Datenschutzerklärung gilt für die Nutzung der
                Web-Applikation &quot;Lernassistent&quot; unter der Domain
                lernen.jan-stocker.cloud. Sie erläutert, welche Personendaten
                wir bearbeiten, zu welchem Zweck und auf welcher
                Rechtsgrundlage. Massgeblich ist das Schweizer Bundesgesetz
                über den Datenschutz (DSG/nDSG).
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-800 mt-8 mb-3">
                3. Welche Daten wir erheben
              </h2>
              <h3 className="text-lg font-semibold text-gray-700 mt-4 mb-2">
                3.1 Registrierungsdaten
              </h3>
              <p className="text-gray-600 leading-relaxed">
                Bei der Registrierung erheben wir: Name, E-Mail-Adresse und ein
                Passwort. Das Passwort wird ausschliesslich als
                kryptographischer Hash (bcrypt) gespeichert und ist für uns
                nicht einsehbar.
              </p>

              <h3 className="text-lg font-semibold text-gray-700 mt-4 mb-2">
                3.2 Nutzungsdaten
              </h3>
              <p className="text-gray-600 leading-relaxed">
                Während der Nutzung speichern wir: Karteikarten und Decks (von
                dir erstellt), Lernfortschritt und Statistiken (Streaks, Punkte,
                Lernzeit), Quiz-Ergebnisse sowie Chat-Nachrichten mit dem
                KI-Assistenten.
              </p>

              <h3 className="text-lg font-semibold text-gray-700 mt-4 mb-2">
                3.3 Technische Daten
              </h3>
              <p className="text-gray-600 leading-relaxed">
                Beim Zugriff auf unsere Website werden automatisch technische
                Daten erfasst: IP-Adresse (in Server-Logs), Browsertyp und
                -version, Betriebssystem sowie Zeitpunkt des Zugriffs. Diese
                Daten werden für den technischen Betrieb benötigt und nach 30
                Tagen automatisch gelöscht.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-800 mt-8 mb-3">
                4. Zweck der Datenbearbeitung
              </h2>
              <p className="text-gray-600 leading-relaxed">
                Wir bearbeiten deine Daten ausschliesslich für folgende Zwecke:
              </p>
              <ul className="list-disc list-inside text-gray-600 space-y-1 mt-2">
                <li>Bereitstellung und Betrieb der Lernplattform</li>
                <li>Authentifizierung und Kontoverwaltung</li>
                <li>
                  Berechnung des Lernfortschritts (Spaced Repetition /
                  FSRS-Algorithmus)
                </li>
                <li>Bereitstellung der KI-gestützten Chat-Funktion</li>
                <li>Technischer Betrieb und Sicherheit der Website</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-800 mt-8 mb-3">
                5. KI-Verarbeitung (Claude API)
              </h2>
              <p className="text-gray-600 leading-relaxed">
                Für die Chat-Funktion und Quiz-Generierung nutzen wir die
                Claude API von Anthropic (USA). Dabei werden deine
                Chat-Nachrichten und ggf. Karteikarten-Inhalte an Anthropic
                übermittelt. Anthropic verarbeitet diese Daten gemäss ihrer
                eigenen Datenschutzrichtlinie. Es werden keine
                personenbezogenen Daten (Name, E-Mail) an Anthropic
                übermittelt — nur die Inhalte deiner Lernmaterialien und
                Nachrichten.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-800 mt-8 mb-3">
                6. Datenweitergabe
              </h2>
              <p className="text-gray-600 leading-relaxed">
                Wir geben deine Daten nicht an Dritte weiter, ausser:
              </p>
              <ul className="list-disc list-inside text-gray-600 space-y-1 mt-2">
                <li>
                  An Anthropic (USA) für die KI-Chat-Funktion (siehe Abschnitt
                  5)
                </li>
                <li>
                  An unseren Hosting-Anbieter (Hostinger) für den technischen
                  Betrieb
                </li>
                <li>Wenn wir gesetzlich dazu verpflichtet sind</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-800 mt-8 mb-3">
                7. Datensicherheit
              </h2>
              <p className="text-gray-600 leading-relaxed">
                Wir treffen angemessene technische und organisatorische
                Massnahmen zum Schutz deiner Daten. Dazu gehören:
                Verschlüsselte Übertragung (HTTPS/TLS), gehashte Passwörter
                (bcrypt), Zugriffskontrolle auf die Datenbank sowie
                regelmässige Sicherheitsupdates.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-800 mt-8 mb-3">
                8. Deine Rechte
              </h2>
              <p className="text-gray-600 leading-relaxed">
                Gemäss dem Schweizer Datenschutzgesetz (nDSG) hast du folgende
                Rechte:
              </p>
              <ul className="list-disc list-inside text-gray-600 space-y-1 mt-2">
                <li>
                  <strong>Auskunftsrecht:</strong> Du kannst jederzeit Auskunft
                  über deine gespeicherten Daten verlangen.
                </li>
                <li>
                  <strong>Berichtigungsrecht:</strong> Du kannst die
                  Berichtigung unrichtiger Daten verlangen.
                </li>
                <li>
                  <strong>Löschungsrecht:</strong> Du kannst die Löschung
                  deiner Daten verlangen.
                </li>
                <li>
                  <strong>Datenherausgabe:</strong> Du kannst die Herausgabe
                  deiner Daten in einem gängigen Format verlangen.
                </li>
              </ul>
              <p className="text-gray-600 leading-relaxed mt-2">
                Zur Ausuebung deiner Rechte nutze bitte unser{" "}
                <Link
                  href="/kontakt"
                  className="text-primary hover:underline"
                >
                  Kontaktformular
                </Link>
                .
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-800 mt-8 mb-3">
                9. Cookies
              </h2>
              <p className="text-gray-600 leading-relaxed">
                Wir verwenden ausschliesslich technisch notwendige Cookies für
                die Session-Verwaltung (Login). Es werden keine Tracking- oder
                Werbe-Cookies eingesetzt. Analyse-Tools von Drittanbietern (z.B.
                Google Analytics) werden nicht verwendet.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-800 mt-8 mb-3">
                10. Änderungen
              </h2>
              <p className="text-gray-600 leading-relaxed">
                Wir behalten uns vor, diese Datenschutzerklärung jederzeit
                anzupassen. Die aktuelle Fassung ist stets auf dieser Seite
                abrufbar.
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
        </div>
      </footer>
    </div>
  )
}

