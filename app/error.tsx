"use client"

// app/error.tsx
// Globaler Fehler-Handler fuer die gesamte App.

import { useEffect } from "react"

interface ErrorPageProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function GlobalError({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    console.error("[GlobalError]", error)
  }, [error])

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface px-4">
      <div className="text-center max-w-md">
        <span className="text-7xl block mb-6" aria-hidden="true">
          &#128560;
        </span>
        <h1 className="text-2xl font-extrabold text-text-dark mb-3">
          Etwas ist schiefgelaufen
        </h1>
        <p className="text-text-light mb-8 leading-relaxed">
          Keine Sorge, das passiert den Besten! Versuch es einfach nochmal
          oder geh zurueck zur Startseite.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={reset}
            className="px-6 py-3 bg-primary text-white font-bold rounded-2xl shadow-button hover:bg-primary-dark active:translate-y-1 active:shadow-none transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            Erneut versuchen
          </button>
          <a
            href="/"
            className="px-6 py-3 bg-surface-card text-text font-bold rounded-2xl shadow-card hover:shadow-card-hover transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            Zur Startseite
          </a>
        </div>
      </div>
    </div>
  )
}
