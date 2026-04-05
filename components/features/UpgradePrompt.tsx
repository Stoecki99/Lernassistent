"use client"

// components/features/UpgradePrompt.tsx
// Zeigt Upgrade-Info fuer Free-Nutzer an, wenn sie auf Pro-Features zugreifen.

// Telefonnummer wird zur Laufzeit zusammengesetzt, um Scraping durch Bots zu erschweren.
function useObfuscatedPhone(): string {
  const parts = ["+41", " 77", " 412", " 59", " 68"]
  return parts.join("")
}

export default function UpgradePrompt() {
  const phone = useObfuscatedPhone()

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
      <div className="bg-white rounded-2xl shadow-md p-8 max-w-lg w-full text-center space-y-6">
        {/* Icon */}
        <div className="text-6xl" aria-hidden="true">&#9889;</div>

        <div className="space-y-2">
          <h2 className="text-2xl font-extrabold text-text-dark">
            KI-Chat freischalten
          </h2>
          <p className="text-text-light">
            Mit dem Pro-Plan kannst du direkt mit dem KI-Lernassistenten chatten,
            Karteikarten erstellen lassen und Fragen zu deinem Lernstoff stellen.
          </p>
          <p className="text-xs text-text-light">
            Der Betrag deckt die Kosten fuer die Anbindung an die Claude-KI (Anthropic API),
            die fuer den Chat und die Kartenerstellung genutzt wird.
          </p>
        </div>

        {/* Preis */}
        <div className="bg-accent/5 rounded-xl p-4">
          <div className="text-3xl font-extrabold text-accent">
            CHF 18.—
          </div>
          <div className="text-sm text-text-light font-medium mt-1">
            für 6 Monate (CHF 3.— / Monat)
          </div>
        </div>

        {/* Pro-Vorteile */}
        <ul className="text-left space-y-2 text-sm">
          <li className="flex items-start gap-2">
            <span className="text-primary font-bold mt-0.5">&#10003;</span>
            <span>KI-Chat mit Claude — Fragen stellen, Erklärungen erhalten</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary font-bold mt-0.5">&#10003;</span>
            <span>KI-generierte Karteikarten aus deinen Unterlagen</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary font-bold mt-0.5">&#10003;</span>
            <span>6 GB Speicherplatz (statt 2 GB)</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary font-bold mt-0.5">&#10003;</span>
            <span>Alle anderen Features bleiben weiterhin kostenlos</span>
          </li>
        </ul>

        {/* Bezahl-Anleitung */}
        <div className="bg-surface rounded-xl p-4 space-y-3">
          <h3 className="font-bold text-text-dark text-sm">So gehts:</h3>
          <ol className="text-left text-sm text-text-light space-y-1.5 list-decimal list-inside">
            <li>Sende <strong>CHF 18.—</strong> via TWINT an <strong className="text-text-dark">{phone}</strong></li>
            <li>Schreibe deine <strong>E-Mail-Adresse</strong> in die TWINT-Nachricht</li>
            <li>Dein Pro-Plan wird innerhalb von 24 Stunden freigeschaltet</li>
          </ol>
        </div>

        {/* Kontakt */}
        <p className="text-xs text-text-light">
          Fragen? Nutze unser{" "}
          <a
            href="/kontakt"
            className="text-primary hover:underline font-semibold"
          >
            Kontaktformular
          </a>
        </p>
      </div>
    </div>
  )
}
