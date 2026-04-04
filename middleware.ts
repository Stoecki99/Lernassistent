// middleware.ts
// Schuetzt alle Routes unter /dashboard.
// Uneingeloggte Nutzer werden zu /login redirected.

export { default } from "next-auth/middleware"

export const config = {
  matcher: ["/dashboard/:path*"],
}
