import Link from "next/link"
import { Metadata } from "next"
import KontaktFormular from "@/components/features/KontaktFormular"

export const metadata: Metadata = {
  title: "Kontakt — Lernassistent",
  description: "Hast du Fragen, Feedback oder ein Problem? Schreib uns über das Kontaktformular.",
}

export default function KontaktPage() {
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

      <main className="max-w-lg mx-auto px-6 py-12">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800">Kontakt</h1>
          <p className="text-text-light mt-2">
            Hast du Fragen, Feedback oder ein Problem? Schreib uns!
          </p>
        </div>

        <KontaktFormular />
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
