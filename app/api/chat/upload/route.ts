// POST /api/chat/upload
// Auth: erforderlich
// Verarbeitet Datei-Uploads fuer Chat (PDF, Bilder, Text).
// Dateien werden nur im Memory verarbeitet, nicht dauerhaft gespeichert.

import { NextResponse } from "next/server"
import { getAuthSession } from "@/lib/auth"
import {
  ALLOWED_EXTENSIONS,
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE,
  MAX_FILES,
} from "@/lib/validations/chat"

interface ProcessedAttachment {
  type: "text" | "image"
  content: string
  filename: string
  mediaType?: string
}

/** Prueft ob die Dateiendung erlaubt ist */
function hasAllowedExtension(filename: string): boolean {
  const lower = filename.toLowerCase()
  return ALLOWED_EXTENSIONS.some((ext) => lower.endsWith(ext))
}

/** Prueft ob der MIME-Type erlaubt ist */
function hasAllowedMimeType(mimeType: string): boolean {
  return (ALLOWED_MIME_TYPES as readonly string[]).includes(mimeType)
}

/** Prueft ob die Magic Bytes zum erwarteten Dateityp passen */
function validateMagicBytes(buffer: Buffer, mimeType: string): boolean {
  if (mimeType === "application/pdf") {
    // PDF muss mit %PDF beginnen
    return buffer.length >= 4 && buffer.slice(0, 4).toString("ascii") === "%PDF"
  }
  if (mimeType === "image/png") {
    // PNG Magic Bytes: 89 50 4E 47
    return buffer.length >= 4 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47
  }
  if (mimeType === "image/jpeg") {
    // JPEG Magic Bytes: FF D8 FF
    return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff
  }
  // Text/Markdown: Keine Magic-Byte-Pruefung moeglich
  return true
}

/** Extrahiert Text aus einem PDF-Buffer (pdf-parse v2 API) */
async function extractPdfText(buffer: Buffer): Promise<string> {
  const { PDFParse } = await import("pdf-parse")
  const pdf = new PDFParse({ data: buffer })
  const result = await pdf.getText()
  return result.text
}

export async function POST(request: Request) {
  try {
    const session = await getAuthSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Nicht autorisiert." }, { status: 401 })
    }

    const formData = await request.formData()
    const files = formData.getAll("files")

    if (files.length === 0) {
      return NextResponse.json(
        { error: "Keine Dateien hochgeladen." },
        { status: 400 }
      )
    }

    if (files.length > MAX_FILES) {
      return NextResponse.json(
        { error: `Maximal ${MAX_FILES} Dateien erlaubt.` },
        { status: 400 }
      )
    }

    const processed: ProcessedAttachment[] = []

    for (const file of files) {
      if (!(file instanceof File)) {
        return NextResponse.json(
          { error: "Ungültiges Dateiformat." },
          { status: 400 }
        )
      }

      // Validierung: Dateiname + Extension
      if (!hasAllowedExtension(file.name)) {
        return NextResponse.json(
          { error: `Dateityp nicht erlaubt: ${file.name}. Erlaubt: PDF, PNG, JPG, TXT, MD.` },
          { status: 400 }
        )
      }

      // Validierung: MIME-Type
      if (!hasAllowedMimeType(file.type)) {
        return NextResponse.json(
          { error: `MIME-Type nicht erlaubt: ${file.type}` },
          { status: 400 }
        )
      }

      // Validierung: Dateigroesse
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          { error: `Datei zu gross: ${file.name}. Maximal 5 MB.` },
          { status: 400 }
        )
      }

      const arrayBuffer = await file.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)

      // Validierung: Magic Bytes pruefen (Schutz gegen Content-Type Spoofing)
      if (!validateMagicBytes(buffer, file.type)) {
        return NextResponse.json(
          { error: `Dateiinhalt stimmt nicht mit dem Dateityp ueberein: ${file.name}` },
          { status: 400 }
        )
      }

      // PDF verarbeiten
      if (file.type === "application/pdf") {
        try {
          const text = await extractPdfText(buffer)
          if (!text.trim()) {
            return NextResponse.json(
              { error: `PDF konnte nicht gelesen werden: ${file.name}. Moeglicherweise enthaelt es nur Bilder.` },
              { status: 400 }
            )
          }
          // Limit: Max 50.000 Zeichen pro PDF
          const truncated = text.length > 50_000
            ? text.slice(0, 50_000) + "\n\n[... Text gekürzt, Original hat " + text.length + " Zeichen]"
            : text
          processed.push({
            type: "text",
            content: truncated,
            filename: file.name,
          })
        } catch (error) {
          console.error("[chat/upload] PDF-Parse Fehler:", error)
          return NextResponse.json(
            { error: `PDF konnte nicht verarbeitet werden: ${file.name}` },
            { status: 400 }
          )
        }
        continue
      }

      // Bilder verarbeiten
      if (file.type.startsWith("image/")) {
        const base64 = buffer.toString("base64")
        // Base64 ist ~33% groesser — Groesse nach Kodierung pruefen
        const base64Size = base64.length * 0.75 // Approx. original size from base64
        if (base64Size > MAX_FILE_SIZE) {
          return NextResponse.json(
            { error: `Bild zu gross nach Verarbeitung: ${file.name}` },
            { status: 400 }
          )
        }
        processed.push({
          type: "image",
          content: base64,
          filename: file.name,
          mediaType: file.type,
        })
        continue
      }

      // Text/Markdown verarbeiten
      if (file.type === "text/plain" || file.type === "text/markdown") {
        const text = buffer.toString("utf-8")
        const truncated = text.length > 50_000
          ? text.slice(0, 50_000) + "\n\n[... Text gekürzt]"
          : text
        processed.push({
          type: "text",
          content: truncated,
          filename: file.name,
        })
        continue
      }

      return NextResponse.json(
        { error: `Nicht unterstuetzter Dateityp: ${file.name}` },
        { status: 400 }
      )
    }

    return NextResponse.json({ attachments: processed })
  } catch (error) {
    console.error("[chat/upload]", error)
    return NextResponse.json(
      { error: "Datei-Upload fehlgeschlagen." },
      { status: 500 }
    )
  }
}
