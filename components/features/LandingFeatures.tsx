interface FeatureCardProps {
  icon: string
  title: string
  description: string
  color: "primary" | "secondary" | "accent" | "purple"
}

const FEATURES: FeatureCardProps[] = [
  {
    icon: "\uD83C\uDCCF",
    title: "Smarte Karteikarten",
    description:
      "Erstelle Decks, importiere aus CSV oder Anki — oder lass die KI deine Karten generieren.",
    color: "primary",
  },
  {
    icon: "\uD83D\uDCC8",
    title: "Spaced Repetition (FSRS)",
    description:
      "Der wissenschaftliche FSRS-Algorithmus zeigt dir Karten genau dann, wenn du sie zu vergessen drohst.",
    color: "secondary",
  },
  {
    icon: "\uD83C\uDFC6",
    title: "Quiz-Modus",
    description:
      "Multiple Choice, Wahr/Falsch und Freitext — teste dein Wissen und sammle Punkte.",
    color: "accent",
  },
  {
    icon: "\uD83E\uDD16",
    title: "KI-Lerntutor",
    description:
      "Stelle Fragen, lass dir Themen erklaeren oder generiere neue Karten per Chat mit Claude.",
    color: "purple",
  },
]

const COLOR_MAP = {
  primary: {
    bg: "bg-primary/10",
    text: "text-primary-dark",
    border: "border-primary/20",
  },
  secondary: {
    bg: "bg-secondary/10",
    text: "text-secondary-dark",
    border: "border-secondary/20",
  },
  accent: {
    bg: "bg-accent/10",
    text: "text-accent-dark",
    border: "border-accent/20",
  },
  purple: {
    bg: "bg-purple-100",
    text: "text-purple-700",
    border: "border-purple-200",
  },
} as const

export default function LandingFeatures() {
  return (
    <section id="features" className="py-16 sm:py-24">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        {/* Section header */}
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-text-dark mb-4">
            Alles, was du zum Lernen brauchst
          </h2>
          <p className="text-lg text-text-light max-w-2xl mx-auto">
            Vier maechtige Werkzeuge in einer App — entwickelt von Studenten, fuer Studenten.
          </p>
        </div>

        {/* Feature cards grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {FEATURES.map((feature) => (
            <FeatureCard key={feature.title} {...feature} />
          ))}
        </div>
      </div>
    </section>
  )
}

function FeatureCard({ icon, title, description, color }: FeatureCardProps) {
  const colors = COLOR_MAP[color]

  return (
    <div
      className={
        "group bg-white rounded-2xl p-6 sm:p-8 shadow-card border " +
        colors.border +
        " hover:shadow-card-hover hover:-translate-y-1 transition-all duration-300"
      }
    >
      <div
        className={
          "inline-flex items-center justify-center w-14 h-14 rounded-2xl text-2xl mb-5 " +
          colors.bg
        }
      >
        <span aria-hidden="true">{icon}</span>
      </div>
      <h3 className={"text-xl font-extrabold mb-2 " + colors.text}>{title}</h3>
      <p className="text-text-light leading-relaxed">{description}</p>
    </div>
  )
}
