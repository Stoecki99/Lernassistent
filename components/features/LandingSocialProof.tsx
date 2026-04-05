import Link from "next/link"

export default function LandingSocialProof() {
  return (
    <section className="py-16 sm:py-24 bg-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        {/* Section header */}
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-text-dark mb-4">
            Für Studenten gemacht
          </h2>
          <p className="text-lg text-text-light max-w-2xl mx-auto">
            Egal ob Medizin, Jura, Informatik oder Sprachen — der Lernassistent passt sich deinem Fach an.
          </p>
        </div>

        {/* Benefits */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
          <BenefitItem
            icon={"\u23F1"}
            title="Spart dir Zeit"
            description="Lerne nur das, was du wirklich wiederholen musst. Kein sinnloses Durchblättern."
          />
          <BenefitItem
            icon={"\uD83D\uDCAA"}
            title="Bewiesen effektiv"
            description="Spaced Repetition ist die wissenschaftlich effektivste Lernmethode. Punkt."
          />
          <BenefitItem
            icon={"\uD83C\uDF1F"}
            title="Macht Spass"
            description="Punkte, Streaks und Quiz-Challenges machen Lernen zum täglichen Highlight."
          />
        </div>

        {/* CTA banner */}
        <div className="mt-16 bg-gradient-to-r from-primary to-primary-dark rounded-2xl p-8 sm:p-12 text-center text-white">
          <h3 className="text-2xl sm:text-3xl font-extrabold mb-4">
            Bereit, smarter zu lernen?
          </h3>
          <p className="text-white/80 text-lg mb-8 max-w-xl mx-auto">
            Erstelle dein kostenloses Konto in 30 Sekunden und starte sofort.
          </p>
          <Link
            href="/register"
            className="btn-press inline-block px-8 py-4 text-lg font-extrabold text-primary bg-white rounded-xl shadow-lg hover:shadow-xl hover:scale-105 transition-all"
          >
            Jetzt kostenlos starten
          </Link>
        </div>
      </div>
    </section>
  )
}

interface BenefitItemProps {
  icon: string
  title: string
  description: string
}

function BenefitItem({ icon, title, description }: BenefitItemProps) {
  return (
    <div className="text-center px-4">
      <div className="inline-flex items-center justify-center w-16 h-16 bg-surface rounded-full text-3xl mb-4">
        <span aria-hidden="true">{icon}</span>
      </div>
      <h3 className="text-lg font-extrabold text-text-dark mb-2">{title}</h3>
      <p className="text-text-light leading-relaxed">{description}</p>
    </div>
  )
}
