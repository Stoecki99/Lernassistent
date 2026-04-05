// lib/resend.ts
// Zentraler Resend-Client fuer E-Mail-Versand.
// Alle E-Mail-Aufrufe gehen ueber diesen Client.
// Lazy Initialisierung: Resend wirft Fehler wenn kein API-Key zur Build-Zeit gesetzt ist.

import { Resend } from "resend"

let resendInstance: Resend | null = null

export function getResend(): Resend {
  if (!resendInstance) {
    resendInstance = new Resend(process.env.RESEND_API_KEY)
  }
  return resendInstance
}
