// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// GET /lernseiten/<fach>/<thema>
// Auth: erforderlich (sonst Weiterleitung auf /login)
// Liefert die fertige HTML-Datei einer Station aus content/lernseiten/<fach>/<thema>.html.
// Nur Slugs aus dem Pfad von fach.json werden gelesen (siehe lib/lernseiten.ts).

import { getCurrentUser } from "@/lib/auth"
import { ladeThemaHtml } from "@/lib/lernseiten"

export const dynamic = "force-dynamic"

interface RouteParams {
  params: Promise<{ fach: string; thema: string }>
}

// Nur Quellen der eigenen Origin: Baukasten, KaTeX, Schriften und Fortschritts-API liegen unter
// derselben Adresse. 'unsafe-inline' fuer die seiteneigenen Scripts/Styles und die Inline-Styles von KaTeX.
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ")

const HTML_HEADER = {
  "Content-Type": "text/html; charset=utf-8",
  // no-store: Lerninhalte hinter dem Login landen nicht im Browser-Cache (auch nicht nach dem Abmelden)
  "Cache-Control": "private, no-store",
  "Content-Security-Policy": CSP,
  "X-Robots-Tag": "noindex",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
}

/** Einfache Fehlerseite ohne Benutzereingaben im Text. */
function fehlerSeite(status: number, titel: string, text: string): Response {
  const html = `<!doctype html>
<html lang="de-CH">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${titel}</title>
<style>
  body { margin: 0; font-family: system-ui, -apple-system, "Segoe UI", sans-serif; background: #F7F7F7; color: #3C3C3C; }
  main { max-width: 32rem; margin: 15vh auto 0; padding: 0 1rem; }
  h1 { color: #1A1A1A; font-size: 1.5rem; }
  a { color: #1899D6; font-weight: 700; }
</style>
</head>
<body>
<main>
<h1>${titel}</h1>
<p>${text}</p>
<p><a href="/lernseiten">Zu den Lernseiten</a></p>
</main>
</body>
</html>
`
  return new Response(html, { status, headers: HTML_HEADER })
}

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      // Relative Adresse: hinter dem Reverse-Proxy bleibt der Host korrekt.
      // Das Login kennt keine callbackUrl und fuehrt nach dem Anmelden aufs Dashboard.
      return new Response(null, {
        status: 307,
        headers: { Location: "/login", "Cache-Control": "no-store" },
      })
    }

    const { fach, thema } = await params
    const html = ladeThemaHtml(fach, thema)
    if (html === null) {
      return fehlerSeite(404, "Seite nicht gefunden", "Diese Lernseite gibt es nicht oder sie folgt noch.")
    }

    return new Response(html, { status: 200, headers: HTML_HEADER })
  } catch (error) {
    console.error("[lernseiten/thema]", error)
    return fehlerSeite(500, "Fehler", "Die Lernseite konnte nicht geladen werden. Versuch es später nochmal.")
  }
}
