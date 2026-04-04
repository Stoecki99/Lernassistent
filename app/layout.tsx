import type { Metadata } from "next"
import SessionProvider from "@/components/providers/SessionProvider"
import "./globals.css"

export const metadata: Metadata = {
  title: "Lernassistent — Lerne smarter, nicht haerter",
  description:
    "Dein persoenlicher Lernassistent mit Karteikarten, Spaced Repetition, Quiz und KI-Chat. Fuer Studenten gemacht.",
  keywords: ["Lernen", "Karteikarten", "Spaced Repetition", "Quiz", "Studenten", "KI"],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="de" className="scroll-smooth">
      <body className="min-h-screen bg-surface text-text antialiased">
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  )
}
