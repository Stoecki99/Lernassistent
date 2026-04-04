import Link from "next/link"

export default function LandingFooter() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="bg-text-dark text-white/70 py-12">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 mb-8">
          {/* Brand */}
          <div>
            <Link href="/" className="flex items-center gap-2 mb-4">
              <span className="text-2xl">&#127891;</span>
              <span className="text-lg font-extrabold text-white">
                Lernassistent
              </span>
            </Link>
            <p className="text-sm leading-relaxed">
              Dein persoenlicher Lernassistent mit KI-Power. Fuer Studenten, die smarter lernen wollen.
            </p>
          </div>

          {/* Links */}
          <div>
            <h4 className="text-sm font-bold text-white mb-4 uppercase tracking-wider">
              Produkt
            </h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="#features" className="hover:text-white transition-colors">
                  Features
                </Link>
              </li>
              <li>
                <Link href="/register" className="hover:text-white transition-colors">
                  Registrieren
                </Link>
              </li>
              <li>
                <Link href="/login" className="hover:text-white transition-colors">
                  Anmelden
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="text-sm font-bold text-white mb-4 uppercase tracking-wider">
              Rechtliches
            </h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/datenschutz" className="hover:text-white transition-colors">
                  Datenschutz
                </Link>
              </li>
              <li>
                <Link href="/impressum" className="hover:text-white transition-colors">
                  Impressum
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Divider + Copyright */}
        <div className="border-t border-white/10 pt-8 text-center text-sm">
          <p>&copy; {currentYear} Lernassistent. Alle Rechte vorbehalten.</p>
        </div>
      </div>
    </footer>
  )
}
