// lib/auth.ts
// Auth-Helpers: NextAuth-Konfiguration, Session-Utilities.

import { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { loginSchema } from "@/lib/validations/auth"
import { getServerSession } from "next-auth/next"

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
    newUser: "/register",
  },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "E-Mail", type: "email" },
        password: { label: "Passwort", type: "password" },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials)
        if (!parsed.success) {
          return null
        }

        const { email, password } = parsed.data

        const user = await prisma.user.findUnique({
          where: { email },
          select: {
            id: true,
            email: true,
            name: true,
            password: true,
            plan: true,
            planExpiresAt: true,
          },
        })

        if (!user) {
          // Dummy-Vergleich gegen Timing-Attacks: Antwortzeit ist
          // unabhaengig davon, ob die E-Mail existiert.
          await bcrypt.compare(password, "$2b$12$0000000000000000000000000000000000000000000000000000")
          return null
        }

        const passwordMatch = await bcrypt.compare(password, user.password)
        if (!passwordMatch) {
          return null
        }

        // Plan-Ablauf pruefen: abgelaufener Pro wird als free behandelt
        const isExpired = user.planExpiresAt ? user.planExpiresAt < new Date() : false
        const effectivePlan = (user.plan === "pro" && !isExpired) ? "pro" : "free"

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          plan: effectivePlan,
          planExpiresAt: user.planExpiresAt?.toISOString() ?? null,
        }
      },
    }),
  ],
  callbacks: {
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string
        session.user.plan = (token.plan as "free" | "pro") ?? "free"
      }
      return session
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.plan = user.plan ?? "free"
        token.planExpiresAt = user.planExpiresAt ?? null
      }

      // Plan-Ablauf bei jedem Token-Refresh pruefen
      if (token.planExpiresAt) {
        const expiresAt = new Date(token.planExpiresAt)
        if (expiresAt < new Date()) {
          token.plan = "free"
        }
      }

      return token
    },
  },
}

/**
 * Gibt die aktuelle Server-Session zurueck.
 * Wrapper um getServerSession mit authOptions.
 */
export function getAuthSession() {
  return getServerSession(authOptions)
}

/**
 * Gibt den aktuellen User zurueck oder null.
 * Nuetzlich fuer Server Components und API-Routes.
 */
export async function getCurrentUser() {
  const session = await getAuthSession()
  return session?.user ?? null
}
