// lib/validations/contact.ts
// Zod-Schema fuer das oeffentliche Kontaktformular.

import { z } from "zod"

export const contactSubjects = ["feedback", "bug", "anfrage", "sonstiges"] as const

export type ContactSubject = (typeof contactSubjects)[number]

export const contactSubjectLabels: Record<ContactSubject, string> = {
  feedback: "Feedback",
  bug: "Fehlermeldung",
  anfrage: "Anfrage",
  sonstiges: "Sonstiges",
}

export const contactSchema = z.object({
  name: z
    .string()
    .min(2, "Name muss mindestens 2 Zeichen haben.")
    .max(100, "Name darf maximal 100 Zeichen haben."),
  subject: z.enum(contactSubjects, {
    error: "Bitte wähle einen Betreff aus.",
  }),
  message: z
    .string()
    .min(10, "Nachricht muss mindestens 10 Zeichen haben.")
    .max(2000, "Nachricht darf maximal 2000 Zeichen haben."),
  recaptchaToken: z.string().min(1, "reCAPTCHA-Token fehlt."),
  website: z.string().optional(),
  formLoadedAt: z.number(),
})

export type ContactFormData = z.infer<typeof contactSchema>
