"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { registerSchema } from "@/lib/validations/auth"

interface FormErrors {
  name?: string
  email?: string
  password?: string
  confirmPassword?: string
  general?: string
}

export default function RegisterPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [errors, setErrors] = useState<FormErrors>({})
  const [success, setSuccess] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrors({})
    setSuccess(false)

    const formData = new FormData(event.currentTarget)
    const data = {
      name: formData.get("name") as string,
      email: formData.get("email") as string,
      password: formData.get("password") as string,
      confirmPassword: formData.get("confirmPassword") as string,
    }

    // Client-seitige Validierung
    const parsed = registerSchema.safeParse(data)
    if (!parsed.success) {
      const fieldErrors: FormErrors = {}
      for (const err of parsed.error.issues) {
        const field = err.path[0] as keyof FormErrors
        if (!fieldErrors[field]) {
          fieldErrors[field] = err.message
        }
      }
      setErrors(fieldErrors)
      return
    }

    setIsLoading(true)

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })

      const result: { message?: string; error?: string } = await response.json()

      if (!response.ok) {
        setErrors({ general: result.error ?? "Registrierung fehlgeschlagen." })
        return
      }

      setSuccess(true)
      setTimeout(() => router.push("/login"), 1500)
    } catch {
      setErrors({ general: "Netzwerkfehler. Bitte prüfe deine Verbindung." })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="bg-surface-card rounded-2xl shadow-card p-8">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-extrabold text-text-dark">
          Erstelle dein Konto &#127881;
        </h1>
        <p className="text-text-light mt-2">
          Starte jetzt mit smartem Lernen!
        </p>
      </div>

      {success && (
        <div className="mb-6 p-4 bg-primary/10 border border-primary/20 rounded-xl text-sm text-primary-dark font-semibold text-center">
          Konto erstellt! Du wirst gleich weitergeleitet...
        </div>
      )}

      {errors.general && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 font-semibold text-center">
          {errors.general}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        {/* Name */}
        <div>
          <label htmlFor="name" className="block text-sm font-bold text-text-dark mb-1.5">
            Name
          </label>
          <input
            id="name"
            name="name"
            type="text"
            autoComplete="name"
            required
            className={`w-full px-4 py-3 rounded-xl border-2 bg-white text-text-dark font-semibold
              placeholder:text-text-light/50 placeholder:font-normal
              focus:outline-none focus:border-secondary focus:ring-2 focus:ring-secondary/20
              transition-all ${errors.name ? "border-red-400" : "border-gray-200"}`}
            placeholder="Dein Name"
          />
          {errors.name && (
            <p className="mt-1.5 text-sm text-red-600 font-semibold">{errors.name}</p>
          )}
        </div>

        {/* E-Mail */}
        <div>
          <label htmlFor="email" className="block text-sm font-bold text-text-dark mb-1.5">
            E-Mail
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            className={`w-full px-4 py-3 rounded-xl border-2 bg-white text-text-dark font-semibold
              placeholder:text-text-light/50 placeholder:font-normal
              focus:outline-none focus:border-secondary focus:ring-2 focus:ring-secondary/20
              transition-all ${errors.email ? "border-red-400" : "border-gray-200"}`}
            placeholder="deine@email.de"
          />
          {errors.email && (
            <p className="mt-1.5 text-sm text-red-600 font-semibold">{errors.email}</p>
          )}
        </div>

        {/* Passwort */}
        <div>
          <label htmlFor="password" className="block text-sm font-bold text-text-dark mb-1.5">
            Passwort
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            className={`w-full px-4 py-3 rounded-xl border-2 bg-white text-text-dark font-semibold
              placeholder:text-text-light/50 placeholder:font-normal
              focus:outline-none focus:border-secondary focus:ring-2 focus:ring-secondary/20
              transition-all ${errors.password ? "border-red-400" : "border-gray-200"}`}
            placeholder="Min. 8 Zeichen, 1 Grossbuchstabe, 1 Zahl"
          />
          {errors.password && (
            <p className="mt-1.5 text-sm text-red-600 font-semibold">{errors.password}</p>
          )}
        </div>

        {/* Passwort bestaetigen */}
        <div>
          <label htmlFor="confirmPassword" className="block text-sm font-bold text-text-dark mb-1.5">
            Passwort bestätigen
          </label>
          <input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            required
            className={`w-full px-4 py-3 rounded-xl border-2 bg-white text-text-dark font-semibold
              placeholder:text-text-light/50 placeholder:font-normal
              focus:outline-none focus:border-secondary focus:ring-2 focus:ring-secondary/20
              transition-all ${errors.confirmPassword ? "border-red-400" : "border-gray-200"}`}
            placeholder="Passwort wiederholen"
          />
          {errors.confirmPassword && (
            <p className="mt-1.5 text-sm text-red-600 font-semibold">{errors.confirmPassword}</p>
          )}
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={isLoading}
          className="btn-press w-full py-3.5 bg-primary text-white font-extrabold rounded-xl
            shadow-button hover:bg-primary-dark transition-all
            disabled:opacity-60 disabled:cursor-not-allowed disabled:shadow-none"
        >
          {isLoading ? "Wird erstellt..." : "Konto erstellen"}
        </button>
      </form>

      <p className="text-center text-sm text-text-light mt-6">
        Bereits ein Konto?{" "}
        <Link href="/login" className="font-bold text-secondary hover:text-secondary-dark transition-colors">
          Jetzt anmelden
        </Link>
      </p>
    </div>
  )
}
