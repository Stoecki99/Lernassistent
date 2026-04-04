import Link from "next/link"

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-surface flex flex-col">
      {/* Header */}
      <header className="py-6 px-4">
        <div className="max-w-md mx-auto">
          <Link href="/" className="flex items-center gap-2 group w-fit">
            <span className="text-3xl">&#127891;</span>
            <span className="text-xl font-extrabold text-text-dark group-hover:text-primary transition-colors">
              Lernassistent
            </span>
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 flex items-start justify-center px-4 pt-4 pb-12">
        <div className="w-full max-w-md">
          {children}
        </div>
      </main>

      {/* Footer */}
      <footer className="py-4 text-center text-sm text-text-light">
        <Link href="/" className="hover:text-primary transition-colors">
          &larr; Zurueck zur Startseite
        </Link>
      </footer>
    </div>
  )
}
