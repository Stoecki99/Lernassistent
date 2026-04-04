import Link from "next/link"

export default function LandingNavbar() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2 group">
            <span className="text-3xl">&#127891;</span>
            <span className="text-xl font-extrabold text-text-dark group-hover:text-primary transition-colors">
              Lernassistent
            </span>
          </Link>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="px-5 py-2 text-sm font-bold text-secondary hover:text-secondary-dark transition-colors"
            >
              Anmelden
            </Link>
            <Link
              href="/register"
              className="btn-press px-5 py-2 text-sm font-bold text-white bg-primary rounded-xl shadow-button hover:bg-primary-dark transition-all"
            >
              Kostenlos starten
            </Link>
          </div>
        </div>
      </div>
    </nav>
  )
}
