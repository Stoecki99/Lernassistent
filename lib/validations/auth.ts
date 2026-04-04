// lib/validations/auth.ts
// Zod-Schemas fuer Login- und Registrierungs-Formulare.

import { z } from "zod"

export const loginSchema = z.object({
  email: z
    .string()
    .min(1, "Bitte gib deine E-Mail-Adresse ein.")
    .email("Bitte gib eine gueltige E-Mail-Adresse ein."),
  password: z
    .string()
    .min(8, "Das Passwort muss mindestens 8 Zeichen lang sein."),
})

export const registerSchema = z
  .object({
    name: z
      .string()
      .min(2, "Dein Name muss mindestens 2 Zeichen lang sein."),
    email: z
      .string()
      .min(1, "Bitte gib deine E-Mail-Adresse ein.")
      .email("Bitte gib eine gueltige E-Mail-Adresse ein."),
    password: z
      .string()
      .min(8, "Das Passwort muss mindestens 8 Zeichen lang sein.")
      .regex(/[A-Z]/, "Das Passwort muss mindestens einen Grossbuchstaben enthalten.")
      .regex(/[0-9]/, "Das Passwort muss mindestens eine Zahl enthalten."),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Die Passwoerter stimmen nicht ueberein.",
    path: ["confirmPassword"],
  })

export type LoginInput = z.infer<typeof loginSchema>
export type RegisterInput = z.infer<typeof registerSchema>
