import type { Metadata } from "next"
import SessionProvider from "@/components/providers/SessionProvider"
import "./globals.css"

export const metadata: Metadata = {
  title: {
    default: "Lernassistent — Lerne smarter, nicht haerter",
    template: "%s | Lernassistent",
  },
  description:
    "Dein persoenlicher Lernassistent mit Karteikarten, Spaced Repetition, Quiz und KI-Chat. Fuer Studenten gemacht.",
  keywords: ["Lernen", "Karteikarten", "Spaced Repetition", "Quiz", "Studenten", "KI"],
  metadataBase: new URL("https://lernen.jan-stocker.cloud"),
  openGraph: {
    type: "website",
    locale: "de_DE",
    url: "https://lernen.jan-stocker.cloud",
    siteName: "Lernassistent",
    title: "Lernassistent — Lerne smarter, nicht haerter",
    description:
      "Dein persoenlicher Lernassistent mit Karteikarten, Spaced Repetition, Quiz und KI-Chat. Fuer Studenten gemacht.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Lernassistent — Lerne smarter, nicht haerter",
    description:
      "Karteikarten, Spaced Repetition, Quiz und KI-Chat. Fuer Studenten gemacht.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
  alternates: {
    canonical: "https://lernen.jan-stocker.cloud",
  },
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
