// GET & POST /api/auth/[...nextauth]
// Auth: nein (NextAuth handhabt Authentifizierung intern)
// NextAuth.js Catch-All Route fuer Login, Logout, Session, CSRF etc.

import NextAuth from "next-auth"
import { authOptions } from "@/lib/auth"

const handler = NextAuth(authOptions)

export { handler as GET, handler as POST }
