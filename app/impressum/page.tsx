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
            Zurueck zur Startseite
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12">
        <div className="bg-white rounded-2xl shadow-md p-8 md:p-12">
          <h1 className="text-3xl font-bold text-gray-800 mb-8">Impressum</h1>

          <div className="space-y-6">
            <section>
              <h2 className="text-xl font-bold text-gray-800 mt-8 mb-3">
                Angaben gemaess Schweizer Recht
              </h2>
              <p className="text-gray-600 leading-relaxed">
                Jan Stocker
                <br />
                E-Mail:{" "}
                <a
                  href="mailto:kontakt@jan-stocker.cloud"
                  className="text-primary hover:underline"
                >
                  kontakt@jan-stocker.cloud
                </a>
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
                Fuer Fragen, Anregungen oder Probleme kannst du dich per E-Mail
                an uns wenden:
              </p>
              <p className="text-gray-600 leading-relaxed mt-2">
                <a
                  href="mailto:kontakt@jan-stocker.cloud"
                  className="text-primary hover:underline"
                >
                  kontakt@jan-stocker.cloud
                </a>
              </p>
              <p className="text-gray-600 leading-relaxed mt-2">
                Alternativ kannst du auch das Kontaktformular auf{" "}
                <a
                  href="https://jan-stocker.ch/#contact"
                  className="text-primary hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  jan-stocker.ch
                </a>{" "}
                verwenden.
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
                Die Inhalte dieser Website werden mit groesster Sorgfalt
                erstellt. Fuer die Richtigkeit, Vollstaendigkeit und
                Aktualitaet der Inhalte koennen wir jedoch keine Gewaehr
                uebernehmen. Die Nutzung der Inhalte erfolgt auf eigene Gefahr.
              </p>
              <p className="text-gray-600 leading-relaxed mt-2">
                Der Lernassistent ist ein kostenloses Hilfsmittel. Die durch die
                KI generierten Inhalte (Quiz-Fragen, Chat-Antworten) koennen
                Fehler enthalten und ersetzen nicht das eigenstaendige Lernen
                und Pruefen der Inhalte.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-800 mt-8 mb-3">
                Urheberrecht
              </h2>
              <p className="text-gray-600 leading-relaxed">
                Die von Nutzern erstellten Inhalte (Karteikarten, Decks)
                verbleiben im Eigentum der jeweiligen Nutzer. Die Software und
                das Design des Lernassistenten sind urheberrechtlich geschuetzt.
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
