// lib/validations/chat.ts
// Zod-Schemas fuer Chat-Nachrichten und Datei-Uploads.

import { z } from "zod"

// ---------------------------------------------------------------------------
// Chat-Nachricht
// ---------------------------------------------------------------------------

const attachmentSchema = z.object({
  type: z.enum(["text", "image"]),
  content: z.string(),
  filename: z.string(),
  mediaType: z.string().optional(),
})

export const chatMessageSchema = z.object({
  message: z
    .string()
    .min(1, "Nachricht darf nicht leer sein.")
    .max(4000, "Nachricht darf maximal 4000 Zeichen lang sein."),
  attachments: z.array(attachmentSchema).max(3).optional(),
})

export type ChatMessageInput = z.infer<typeof chatMessageSchema>
export type ChatAttachment = z.infer<typeof attachmentSchema>

// ---------------------------------------------------------------------------
// Datei-Upload
// ---------------------------------------------------------------------------

const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "text/plain",
  "text/markdown",
] as const

const ALLOWED_EXTENSIONS = [".pdf", ".png", ".jpg", ".jpeg", ".txt", ".md"] as const

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5 MB
const MAX_FILES = 3

export const uploadFileSchema = z.object({
  name: z.string().min(1),
  size: z.number().max(MAX_FILE_SIZE, "Datei darf maximal 5 MB gross sein."),
  type: z.string(),
})

export const uploadRequestSchema = z.object({
  files: z
    .array(uploadFileSchema)
    .min(1, "Mindestens eine Datei erforderlich.")
    .max(MAX_FILES, `Maximal ${MAX_FILES} Dateien erlaubt.`),
})

export { ALLOWED_MIME_TYPES, ALLOWED_EXTENSIONS, MAX_FILE_SIZE, MAX_FILES }
