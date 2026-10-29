// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

import type { Metadata } from "next"
import localFont from "next/font/local"
import SessionProvider from "@/components/providers/SessionProvider"
import "./globals.css"

// Nunito vom eigenen Server: keine Anfrage an Google (DSG). Variable Schrift, eine Datei pro
// Teilmenge deckt alle Gewichte ab. unicode-range wie bei Google Fonts: der Browser laedt
// latin-ext nur, wenn ein Zeichen daraus vorkommt. Lizenz: app/fonts/OFL.txt
const nunito = localFont({
  src: "./fonts/nunito-latin.woff2",
  weight: "200 1000",
  style: "normal",
  display: "swap",
  variable: "--font-nunito",
  declarations: [
    {
      prop: "unicode-range",
      value:
        "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD",
    },
  ],
})

// Ohne Ersatzschrift-Anpassung: die Ersatzschrift (Arial) wuerde sonst vor der latin-Datei
// greifen, weil diese Familie in --font-sans vorne steht (siehe app/globals.css).
const nunitoLatinExt = localFont({
  src: "./fonts/nunito-latin-ext.woff2",
  weight: "200 1000",
  style: "normal",
  display: "swap",
  variable: "--font-nunito-ext",
  preload: false,
  adjustFontFallback: false,
  declarations: [
    {
      prop: "unicode-range",
      value:
        "U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C4, U+2113, U+2C60-2C7F, U+A720-A7FF",
    },
  ],
})

export const metadata: Metadata = {
  title: {
    default: "Lernassistent — Lerne smarter, nicht härter",
    template: "%s | Lernassistent",
  },
  description:
    "Dein persönlicher Lernassistent mit Karteikarten, Spaced Repetition, Quiz und KI-Chat. Für Studenten gemacht.",
  keywords: ["Lernen", "Karteikarten", "Spaced Repetition", "Quiz", "Studenten", "KI"],
  metadataBase: new URL("https://lernen.jan-stocker.cloud"),
  openGraph: {
    type: "website",
    locale: "de_DE",
    url: "https://lernen.jan-stocker.cloud",
    siteName: "Lernassistent",
    title: "Lernassistent — Lerne smarter, nicht härter",
    description:
      "Dein persönlicher Lernassistent mit Karteikarten, Spaced Repetition, Quiz und KI-Chat. Für Studenten gemacht.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Lernassistent — Lerne smarter, nicht härter",
    description:
      "Karteikarten, Spaced Repetition, Quiz und KI-Chat. Für Studenten gemacht.",
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
    // suppressHydrationWarning: Auf der Lernpfad-Seite setzt das Startskript von ThemaWahl
    // data-theme am <html>, bevor React uebernimmt (nur dieses Element, nicht die Kinder).
    <html
      lang="de"
      className={`${nunito.variable} ${nunitoLatinExt.variable} scroll-smooth`}
      suppressHydrationWarning
    >
      <body className="min-h-screen bg-surface text-text antialiased">
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  )
}
