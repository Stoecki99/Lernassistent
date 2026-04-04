"use client"

import { useState } from "react"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { loginSchema } from "@/lib/validations/auth"

interface FormErrors {
  email?: string
  password?: string
  general?: string
}

export default function LoginPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [errors, setErrors] = useState<FormErrors>({})

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrors({})

    const formData = new FormData(event.currentTarget)
    const data = {
      email: formData.get("email") as string,
      password: formData.get("password") as string,
    }

    // Client-seitige Validierung
    const parsed = loginSchema.safeParse(data)
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
      const result = await signIn("credentials", {
        email: data.email,
        password: data.password,
        redirect: false,
      })

      if (result?.error) {
        setErrors({ general: "E-Mail oder Passwort ist falsch. Versuch es nochmal!" })
        return
      }

      router.push("/dashboard")
      router.refresh()
    } catch {
      setErrors({ general: "Netzwerkfehler. Bitte pruefe deine Verbindung." })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="bg-surface-card rounded-2xl shadow-card p-8">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-extrabold text-text-dark">
          Willkommen zurueck! &#128075;
        </h1>
        <p className="text-text-light mt-2">
          Melde dich an und lerne weiter.
        </p>
      </div>

      {errors.general && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 font-semibold text-center">
          {errors.general}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
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
            autoComplete="current-password"
            required
            className={`w-full px-4 py-3 rounded-xl border-2 bg-white text-text-dark font-semibold
              placeholder:text-text-light/50 placeholder:font-normal
              focus:outline-none focus:border-secondary focus:ring-2 focus:ring-secondary/20
              transition-all ${errors.password ? "border-red-400" : "border-gray-200"}`}
            placeholder="Dein Passwort"
          />
          {errors.password && (
            <p className="mt-1.5 text-sm text-red-600 font-semibold">{errors.password}</p>
          )}
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={isLoading}
          className="btn-press w-full py-3.5 bg-secondary text-white font-extrabold rounded-xl
            shadow-button-secondary hover:bg-secondary-dark transition-all
            disabled:opacity-60 disabled:cursor-not-allowed disabled:shadow-none"
        >
          {isLoading ? "Wird angemeldet..." : "Anmelden"}
        </button>
      </form>

      <p className="text-center text-sm text-text-light mt-6">
        Noch kein Konto?{" "}
        <Link href="/register" className="font-bold text-primary hover:text-primary-dark transition-colors">
          Jetzt registrieren
        </Link>
      </p>
    </div>
  )
}
