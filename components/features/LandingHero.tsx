// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

import Link from "next/link"

export default function LandingHero() {
  return (
    <section className="relative pt-28 pb-16 sm:pt-36 sm:pb-24 overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-20 left-10 w-72 h-72 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute top-40 right-10 w-96 h-96 bg-secondary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-80 h-80 bg-accent/10 rounded-full blur-3xl" />
      </div>

      <div className="max-w-4xl mx-auto px-6 sm:px-6 text-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-full mb-8">
          <span className="text-sm" aria-hidden="true">{"\u26A1"}</span>
          <span className="text-sm font-bold text-primary-dark">
            Kostenlos für Studenten
          </span>
        </div>

        {/* Headline */}
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-text-dark leading-tight mb-6">
          Lerne smarter,{" "}
          <span className="text-primary">nicht härter</span>
        </h1>

        {/* Subtitle */}
        <p className="text-lg sm:text-xl text-text-light max-w-2xl mx-auto mb-10 leading-relaxed">
          Karteikarten, Spaced Repetition, Quiz und ein generativer KI-Tutor — alles in
          einer App. Dein Lernassistent merkt sich, was du vergisst.
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/register"
            className="btn-press w-full sm:w-auto px-6 sm:px-8 py-4 text-base sm:text-lg font-extrabold text-white bg-primary-button rounded-xl shadow-button hover:bg-primary-dark transition-all text-center"
          >
            Jetzt kostenlos starten
          </Link>
          <Link
            href="#features"
            className="btn-press w-full sm:w-auto px-6 sm:px-8 py-4 text-base sm:text-lg font-extrabold text-secondary border-2 border-secondary/30 bg-white rounded-xl hover:bg-secondary/5 transition-all text-center"
          >
            Mehr erfahren
          </Link>
        </div>

        {/* Stats row */}
        <div className="mt-14 flex flex-wrap items-center justify-center gap-8 sm:gap-12 text-text-light">
          <StatItem icon={"\uD83D\uDCDA"} value="Bis zu 2 Mio." label="Karteikarten" />
          <StatItem icon={"\uD83E\uDDE0"} value="SRS" label="wissenschaftlich" />
          <StatItem icon={"\uD83D\uDE80"} value="KI-Tutor" label="integriert" />
        </div>
      </div>
    </section>
  )
}

interface StatItemProps {
  icon: string
  value: string
  label: string
}

function StatItem({ icon, value, label }: StatItemProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-2xl" aria-hidden="true">{icon}</span>
      <div className="text-left">
        <p className="text-sm font-extrabold text-text-dark">{value}</p>
        <p className="text-xs text-text-light">{label}</p>
      </div>
    </div>
  )
}
