// lib/emails/contact-notification.ts
// Sendet E-Mail-Benachrichtigung bei neuer Kontaktnachricht.

import { getResend } from "@/lib/resend"
import { contactSubjectLabels, type ContactSubject } from "@/lib/validations/contact"

interface ContactNotificationParams {
  name: string
  email: string
  subject: ContactSubject
  message: string
}

export async function sendContactNotification({
  name,
  email,
  subject,
  message,
}: ContactNotificationParams): Promise<{ success: boolean; error?: string }> {
  const subjectLabel = contactSubjectLabels[subject]
  const timestamp = new Date().toLocaleString("de-CH", { timeZone: "Europe/Zurich" })

  try {
    const resend = getResend()
    await resend.emails.send({
      from: "Lernassistent <noreply@jan-stocker.cloud>",
      to: "jan.stocker@outlook.com",
      subject: `[Lernassistent] ${subjectLabel} — ${name}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #58CC02;">Neu Kontaktnachricht</h2>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; font-weight: bold; color: #555;">Name:</td>
              <td style="padding: 8px 0;">${escapeHtml(name)}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold; color: #555;">E-Mail:</td>
              <td style="padding: 8px 0;"><a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold; color: #555;">Betreff:</td>
              <td style="padding: 8px 0;">${subjectLabel}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold; color: #555;">Zeitpunkt:</td>
              <td style="padding: 8px 0;">${timestamp}</td>
            </tr>
          </table>
          <hr style="border: none; border-top: 1px solid #eee; margin: 16px 0;" />
          <div style="white-space: pre-wrap; color: #333; line-height: 1.6;">
            ${escapeHtml(message)}
          </div>
          <hr style="border: none; border-top: 1px solid #eee; margin: 16px 0;" />
          <p style="font-size: 12px; color: #999;">
            Diese E-Mail wurde automatisch vom Lernassistenten gesendet.
          </p>
        </div>
      `,
    })

    return { success: true }
  } catch (error) {
    console.error("[contact-notification]", error)
    const errorMessage = error instanceof Error ? error.message : "E-Mail konnte nicht gesendet werden."
    return { success: false, error: errorMessage }
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}
