// types/next-auth.d.ts
// Erweitert die NextAuth-Typen um User-ID und Plan in der Session.

import { DefaultSession, DefaultUser } from "next-auth"

declare module "next-auth" {
  interface User extends DefaultUser {
    plan?: "free" | "pro"
    planExpiresAt?: string | null
  }

  interface Session {
    user: {
      id: string
      plan: "free" | "pro"
    } & DefaultSession["user"]
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string
    plan: "free" | "pro"
    planExpiresAt: string | null
  }
}
