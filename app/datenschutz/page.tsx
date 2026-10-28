// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

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
                1. Verantwortliche Person
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
              <p className="text-gray-600 leading-relaxed mt-2">
                Der Lernassistent ist ein privates, nicht-kommerzielles Projekt.
                Ich verfolge den Grundsatz der Datensparsamkeit: Es werden nur
                Daten erhoben, die für den Betrieb der Applikation zwingend
                notwendig sind.
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
                ich bearbeite, zu welchem Zweck und auf welcher
                Rechtsgrundlage. Massgeblich ist das Schweizer Bundesgesetz
                über den Datenschutz (DSG/nDSG).
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-800 mt-8 mb-3">
                3. Welche Daten ich erhebe
              </h2>
              <h3 className="text-lg font-semibold text-gray-700 mt-4 mb-2">
                3.1 Registrierungsdaten
              </h3>
              <p className="text-gray-600 leading-relaxed">
                Bei der Registrierung erhebe ich: Name, E-Mail-Adresse und ein
                Passwort. Das Passwort wird ausschliesslich als
                kryptographischer Hash (bcrypt) gespeichert und ist für mich
                nicht einsehbar.
              </p>

              <h3 className="text-lg font-semibold text-gray-700 mt-4 mb-2">
                3.2 Nutzungsdaten
              </h3>
              <p className="text-gray-600 leading-relaxed">
                Während der Nutzung speichere ich: Karteikarten und Decks (von
                Dir erstellt), Lernfortschritt und Statistiken (Streaks, Punkte,
                Lernzeit), Quiz-Ergebnisse sowie Chat-Nachrichten mit dem
                KI-Assistenten.
              </p>

              <h3 className="text-lg font-semibold text-gray-700 mt-4 mb-2">
                3.3 Technische Daten
              </h3>
              <p className="text-gray-600 leading-relaxed">
                Beim Zugriff auf die Website werden automatisch technische
                Daten erfasst: IP-Adresse (in Server-Logs), Browsertyp und
                -version, Betriebssystem sowie Zeitpunkt des Zugriffs. Diese
                Daten werden für den technischen Betrieb benötigt und nach 30
                Tagen automatisch gelöscht.
              </p>

              <h3 className="text-lg font-semibold text-gray-700 mt-4 mb-2">
                3.4 Kontaktformular
              </h3>
              <p className="text-gray-600 leading-relaxed">
                Wenn Du das Kontaktformular nutzt, werden Dein Name, Deine
                E-Mail-Adresse und Deine Nachricht gespeichert, um Deine
                Anfrage bearbeiten zu können.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-800 mt-8 mb-3">
                4. Keine Tracking- oder Marketingdienste
              </h2>
              <p className="text-gray-600 leading-relaxed">
                Ich setze <strong>keine</strong> Analyse-, Tracking- oder
                Marketing-Tools ein. Es gibt kein Google Analytics, keine
                Werbe-Cookies und kein Nutzertracking. Es werden nur technisch
                notwendige Cookies für die Session-Verwaltung (Login)
                verwendet.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-800 mt-8 mb-3">
                5. Zweck der Datenbearbeitung
              </h2>
              <p className="text-gray-600 leading-relaxed">
                Ich bearbeite Deine Daten ausschliesslich für folgende Zwecke:
              </p>
              <ul className="list-disc list-inside text-gray-600 space-y-1 mt-2">
                <li>Bereitstellung und Betrieb der Lernplattform</li>
                <li>Authentifizierung und Kontoverwaltung</li>
                <li>
                  Berechnung des Lernfortschritts (Spaced Repetition /
                  FSRS-Algorithmus)
                </li>
                <li>Bereitstellung der KI-gestützten Chat-Funktion</li>
                <li>Spam-Schutz im Kontaktformular (reCAPTCHA)</li>
                <li>Technischer Betrieb und Sicherheit der Website</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-800 mt-8 mb-3">
                6. Drittanbieter-Dienste
              </h2>

              <h3 className="text-lg font-semibold text-gray-700 mt-4 mb-2">
                6.1 Claude API (Anthropic)
              </h3>
              <p className="text-gray-600 leading-relaxed">
                Für die Chat-Funktion und Quiz-Generierung nutze ich die
                Claude API von Anthropic (USA). Dabei werden Deine
                Chat-Nachrichten und ggf. Karteikarten-Inhalte an Anthropic
                übermittelt. Es werden keine personenbezogenen Daten (Name,
                E-Mail) an Anthropic übermittelt — nur die Inhalte Deiner
                Lernmaterialien und Nachrichten. Anthropic verarbeitet diese
                Daten gemäss ihrer eigenen{" "}
                <a
                  href="https://www.anthropic.com/privacy"
                  className="text-primary hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Datenschutzrichtlinie
                </a>
                .
              </p>

              <h3 className="text-lg font-semibold text-gray-700 mt-4 mb-2">
                6.2 Google reCAPTCHA v3
              </h3>
              <p className="text-gray-600 leading-relaxed">
                Zum Schutz des Kontaktformulars vor Spam verwende ich Google
                reCAPTCHA v3. Dabei wird Deine IP-Adresse sowie Dein
                Nutzungsverhalten auf der Seite an Google LLC (USA) übermittelt.
                Es gelten die{" "}
                <a
                  href="https://policies.google.com/privacy"
                  className="text-primary hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Datenschutzbestimmungen
                </a>
                {" "}und{" "}
                <a
                  href="https://policies.google.com/terms"
                  className="text-primary hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Nutzungsbedingungen
                </a>
                {" "}von Google.
              </p>

              <h3 className="text-lg font-semibold text-gray-700 mt-4 mb-2">
                6.3 Resend (E-Mail-Versand)
              </h3>
              <p className="text-gray-600 leading-relaxed">
                Für den Versand von E-Mail-Benachrichtigungen (z.B.
                Kontaktformular-Bestätigungen) nutze ich den Dienst Resend
                (USA). Dabei wird die E-Mail-Adresse des Empfängers an Resend
                übermittelt. Resend verarbeitet diese Daten gemäss ihrer
                eigenen Datenschutzrichtlinie.
              </p>

              <h3 className="text-lg font-semibold text-gray-700 mt-4 mb-2">
                6.4 Hosting (Hostinger)
              </h3>
              <p className="text-gray-600 leading-relaxed">
                Die Website wird bei Hostinger International Ltd. (Zypern)
                gehostet. Server-Logs mit IP-Adressen werden für den
                technischen Betrieb gespeichert.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-800 mt-8 mb-3">
                7. Datenweitergabe
              </h2>
              <p className="text-gray-600 leading-relaxed">
                Ich gebe Deine Daten nicht an weitere Dritte weiter, ausser:
              </p>
              <ul className="list-disc list-inside text-gray-600 space-y-1 mt-2">
                <li>
                  An die unter Abschnitt 6 genannten Drittanbieter im
                  beschriebenen Umfang
                </li>
                <li>Wenn ich gesetzlich dazu verpflichtet bin</li>
              </ul>
              <p className="text-gray-600 leading-relaxed mt-2">
                Ein Verkauf oder eine kommerzielle Weitergabe Deiner Daten
                findet nicht statt und ist nicht geplant.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-800 mt-8 mb-3">
                8. Datensicherheit
              </h2>
              <p className="text-gray-600 leading-relaxed">
                Ich treffe angemessene technische und organisatorische
                Massnahmen zum Schutz Deiner Daten. Dazu gehören:
                verschlüsselte Übertragung (HTTPS/TLS), gehashte Passwörter
                (bcrypt), Zugriffskontrolle auf die Datenbank sowie
                regelmässige Sicherheitsupdates. Da es sich um ein privates
                Projekt handelt, kann ich jedoch keine lückenlose Sicherheit
                garantieren.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-800 mt-8 mb-3">
                9. Deine Rechte
              </h2>
              <p className="text-gray-600 leading-relaxed">
                Gemäss dem Schweizer Datenschutzgesetz (nDSG) hast Du folgende
                Rechte:
              </p>
              <ul className="list-disc list-inside text-gray-600 space-y-1 mt-2">
                <li>
                  <strong>Auskunftsrecht:</strong> Du kannst jederzeit Auskunft
                  über Deine gespeicherten Daten verlangen.
                </li>
                <li>
                  <strong>Berichtigungsrecht:</strong> Du kannst die
                  Berichtigung unrichtiger Daten verlangen.
                </li>
                <li>
                  <strong>Löschungsrecht:</strong> Du kannst die Löschung
                  Deiner Daten verlangen.
                </li>
                <li>
                  <strong>Datenherausgabe:</strong> Du kannst die Herausgabe
                  Deiner Daten in einem gängigen Format verlangen.
                </li>
              </ul>
              <p className="text-gray-600 leading-relaxed mt-2">
                Zur Ausübung Deiner Rechte nutze bitte das{" "}
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
                10. Änderungen
              </h2>
              <p className="text-gray-600 leading-relaxed">
                Ich behalte mir vor, diese Datenschutzerklärung jederzeit
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
          <Link href="/nutzungsbedingungen" className="hover:text-gray-600">
            Nutzungsbedingungen
          </Link>
        </div>
      </footer>
    </div>
  )
}
