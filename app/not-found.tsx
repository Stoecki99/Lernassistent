// app/not-found.tsx
// 404-Seite mit freundlicher Nachricht.

import Link from "next/link"

export const metadata = {
  title: "Seite nicht gefunden — Lernassistent",
}

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-surface px-4">
      <div className="text-center max-w-md">
        <span className="text-8xl block mb-4" aria-hidden="true">
          &#129300;
        </span>
        <h1 className="text-3xl font-extrabold text-text-dark mb-2">
          404
        </h1>
        <h2 className="text-xl font-bold text-text-dark mb-4">
          Seite nicht gefunden
        </h2>
        <p className="text-text-light mb-8 leading-relaxed">
          Ups! Diese Seite existiert nicht. Vielleicht hast du dich verlaufen?
          Kein Problem, wir bringen dich zurück!
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/dashboard"
            className="px-6 py-3 bg-primary text-white font-bold rounded-2xl shadow-button hover:bg-primary-dark active:translate-y-1 active:shadow-none transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            Zum Dashboard
          </Link>
          <Link
            href="/"
            className="px-6 py-3 bg-surface-card text-text font-bold rounded-2xl shadow-card hover:shadow-card-hover transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            Zur Startseite
          </Link>
        </div>
      </div>
    </div>
  )
}
