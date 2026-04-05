"use client"

// app/(dashboard)/error.tsx
// Fehler-Handler fuer den Dashboard-Bereich.

import { useEffect } from "react"
import Link from "next/link"

interface ErrorPageProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function DashboardError({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    console.error("[DashboardError]", error)
  }, [error])

  return (
    <div className="flex items-center justify-center min-h-[60vh] px-4">
      <div className="text-center max-w-md">
        <span className="text-7xl block mb-6" aria-hidden="true">
          &#128533;
        </span>
        <h1 className="text-2xl font-extrabold text-text-dark mb-3">
          Etwas ist schiefgelaufen
        </h1>
        <p className="text-text-light mb-8 leading-relaxed">
          Keine Sorge, versuch es einfach nochmal! Falls das Problem bestehen
          bleibt, geh zurück zum Dashboard.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={reset}
            className="px-6 py-3 bg-primary text-white font-bold rounded-2xl shadow-button hover:bg-primary-dark active:translate-y-1 active:shadow-none transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            Erneut versuchen
          </button>
          <Link
            href="/dashboard"
            className="px-6 py-3 bg-surface-card text-text font-bold rounded-2xl shadow-card hover:shadow-card-hover transition-all text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            Zum Dashboard
          </Link>
        </div>
      </div>
    </div>
  )
}
