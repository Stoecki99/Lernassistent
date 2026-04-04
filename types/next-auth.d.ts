// types/next-auth.d.ts
// Erweitert die NextAuth-Typen um die User-ID in der Session.

import { DefaultSession } from "next-auth"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
    } & DefaultSession["user"]
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string
  }
}
