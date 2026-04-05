"use client"

// components/features/KontaktFormular.tsx
// Oeffentliches Kontaktformular mit reCAPTCHA v3, Honeypot und Cooldown.

import { useState, useEffect, useCallback } from "react"
import { GoogleReCaptchaProvider, useGoogleReCaptcha } from "react-google-recaptcha-v3"
import { contactSubjects, contactSubjectLabels, type ContactSubject } from "@/lib/validations/contact"

function KontaktFormularInner() {
  const { executeRecaptcha } = useGoogleReCaptcha()

  const [name, setName] = useState("")
  const [subject, setSubject] = useState<ContactSubject | "">("")
  const [message, setMessage] = useState("")
  const [website, setWebsite] = useState("") // Honeypot
  const [formLoadedAt] = useState(() => Date.now())

  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cooldown, setCooldown] = useState(0)

  // Cooldown-Timer
  useEffect(() => {
    if (cooldown <= 0) return
    const timer = setInterval(() => {
      setCooldown((prev) => prev - 1)
    }, 1000)
    return () => clearInterval(timer)
  }, [cooldown])

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!executeRecaptcha) {
      setError("reCAPTCHA wird geladen. Bitte versuche es gleich nochmal.")
      return
    }

    if (!subject) {
      setError("Bitte wähle einen Betreff aus.")
      return
    }

    setLoading(true)

    try {
      const recaptchaToken = await executeRecaptcha("contact")

      const res = await fetch("/api/kontakt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          subject,
          message,
          recaptchaToken,
          website,
          formLoadedAt,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? "Etwas ist schiefgelaufen. Bitte versuche es später erneut.")
        return
      }

      setSuccess(true)
      setName("")
      setSubject("")
      setMessage("")
      setCooldown(60)
    } catch {
      setError("Netzwerkfehler. Bitte prüfe deine Internetverbindung.")
    } finally {
      setLoading(false)
    }
  }, [executeRecaptcha, name, subject, message, website, formLoadedAt])

  if (success) {
    return (
      <div className="bg-white rounded-2xl shadow-md p-8 text-center space-y-4" role="status" aria-live="polite">
        <div className="text-5xl" aria-hidden="true">&#9989;</div>
        <h2 className="text-xl font-bold text-primary">
          Danke für deine Nachricht!
        </h2>
        <p className="text-text-light">
          Wir melden uns so schnell wie möglich.
        </p>
        {cooldown > 0 && (
          <p className="text-sm text-text-light">
            Du kannst in {cooldown} Sekunden eine weitere Nachricht senden.
          </p>
        )}
        {cooldown <= 0 && (
          <button
            type="button"
            onClick={() => setSuccess(false)}
            className="px-6 py-3 bg-primary text-white font-bold rounded-xl hover:bg-primary-dark transition-colors min-h-[44px] min-w-[44px]"
          >
            Weitere Nachricht senden
          </button>
        )}
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-md p-8 space-y-6">
      {/* Honeypot — versteckt fuer Bots */}
      <div
        aria-hidden="true"
        style={{ position: "absolute", opacity: 0, pointerEvents: "none", height: 0, overflow: "hidden" }}
      >
        <label htmlFor="website">Website</label>
        <input
          type="text"
          id="website"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
        />
      </div>

      {/* Name */}
      <div className="space-y-2">
        <label htmlFor="contact-name" className="block text-sm font-bold text-text-dark">
          Name
        </label>
        <input
          type="text"
          id="contact-name"
          name="name"
          required
          minLength={2}
          maxLength={100}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Dein Name"
          className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-primary focus:outline-none transition-colors text-text-dark min-h-[44px]"
        />
      </div>

      {/* Betreff */}
      <div className="space-y-2">
        <label htmlFor="contact-subject" className="block text-sm font-bold text-text-dark">
          Betreff
        </label>
        <select
          id="contact-subject"
          name="subject"
          required
          value={subject}
          onChange={(e) => setSubject(e.target.value as ContactSubject)}
          className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-primary focus:outline-none transition-colors text-text-dark min-h-[44px] bg-white"
        >
          <option value="" disabled>
            Bitte wählen...
          </option>
          {contactSubjects.map((key) => (
            <option key={key} value={key}>
              {contactSubjectLabels[key]}
            </option>
          ))}
        </select>
      </div>

      {/* Nachricht */}
      <div className="space-y-2">
        <label htmlFor="contact-message" className="block text-sm font-bold text-text-dark">
          Nachricht
        </label>
        <textarea
          id="contact-message"
          name="message"
          required
          minLength={10}
          maxLength={2000}
          rows={6}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Beschreibe dein Anliegen..."
          className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-primary focus:outline-none transition-colors text-text-dark resize-y"
        />
        <p className="text-xs text-text-light text-right">
          {message.length}/2000
        </p>
      </div>

      {/* Fehler */}
      {error && (
        <div className="px-4 py-3 rounded-xl bg-red-50 text-red-600 text-sm font-semibold" role="alert">
          {error}
        </div>
      )}

      {/* Absende-Button */}
      <button
        type="submit"
        disabled={loading || cooldown > 0}
        className="w-full py-3 px-6 bg-primary text-white font-bold rounded-xl hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
      >
        {loading
          ? "Wird gesendet..."
          : cooldown > 0
            ? `Bitte warte (${cooldown}s)`
            : "Nachricht senden"}
      </button>

      <p className="text-xs text-text-light text-center">
        Diese Website wird durch reCAPTCHA geschuetzt. Es gelten die{" "}
        <a
          href="https://policies.google.com/privacy"
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline"
        >
          Datenschutzbestimmungen
        </a>{" "}
        und{" "}
        <a
          href="https://policies.google.com/terms"
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline"
        >
          Nutzungsbedingungen
        </a>{" "}
        von Google.
      </p>
    </form>
  )
}

export default function KontaktFormular() {
  const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY

  if (!siteKey) {
    return (
      <div className="bg-white rounded-2xl shadow-md p-8 text-center">
        <p className="text-red-600 font-semibold">
          Kontaktformular ist aktuell nicht verfügbar.
        </p>
      </div>
    )
  }

  return (
    <GoogleReCaptchaProvider reCaptchaKey={siteKey}>
      <KontaktFormularInner />
    </GoogleReCaptchaProvider>
  )
}

