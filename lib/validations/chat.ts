// lib/validations/chat.ts
// Zod-Schema fuer Chat-Nachrichten.

import { z } from "zod"

export const chatMessageSchema = z.object({
  message: z
    .string()
    .min(1, "Nachricht darf nicht leer sein.")
    .max(4000, "Nachricht darf maximal 4000 Zeichen lang sein."),
})

export type ChatMessageInput = z.infer<typeof chatMessageSchema>
