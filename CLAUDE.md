# CLAUDE.md — Lernassistent Projektregeln

Dieses Dokument definiert verbindliche Regeln für die Entwicklung des Lernassistenten.
Claude hält sich in jeder Aufgabe an diese Regeln, ohne explizite Aufforderung.

---

## Session-Start Workflow

**Bei jeder neuen Session ZUERST diese Dateien lesen:**

1. **`STATUS.md`** — Aktueller Projektstatus, was funktioniert, was fehlt, offene Probleme
2. **`DEPLOYMENT.md`** — VPS-Architektur, Deployment-Schritte, Troubleshooting
3. **`CLAUDE.md`** (dieses Dokument) — Projektregeln und Konventionen

**Wichtige Regeln:**
- Vor jeder Aenderung pruefen: Was ist der aktuelle Status? (STATUS.md lesen)
- Nach abgeschlossener Arbeit: STATUS.md aktualisieren
- VPS-Befehle dem User geben, NICHT selbst ausfuehren (kein direkter SSH-Zugang)
- `~/stack/` auf dem VPS NIEMALS anfassen (Caddy + CV-Website)
- Befehle fuer den VPS EINZELN geben (nicht mit && verketten — User kopiert sie einzeln)

---

## Projektkontext

- **App:** Lernassistent für Studenten (Karteikarten, Quiz, SRS, Claude-Chat)
- **Domain:** `lernen.jan-stocker.cloud` (Hostinger VPS)
- **Stack:** Next.js 14 (App Router), PostgreSQL, Prisma v7, NextAuth.js, Claude API
- **Sprache der App:** Deutsch
- **Deployment:** Docker Compose + Caddy (Auto-SSL) auf Hostinger VPS
- **GitHub:** https://github.com/Stoecki99/Lernassistent (public)
- **VPS-User:** jan, App unter ~/lernassistent/, Repo unter ~/lernassistent/repo/

---

## 1. Sicherheit (Security)

### Umgebungsvariablen
- Secrets niemals im Code hardcoden — immer über `.env.local` / Docker-Env
- `.env.local` ist in `.gitignore`, wird nie committed
- Pflicht-Variablen: `ANTHROPIC_API_KEY`, `DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`

### Authentifizierung
- Passwörter werden ausschließlich mit **bcrypt** (min. 12 Rounds) gehasht
- Sessions via NextAuth.js — kein manuelles JWT-Handling
- Alle geschützten Routen prüfen die Session serverseitig (nicht nur clientseitig)

### API-Sicherheit
- Alle `/api/` Routen prüfen Authentifizierung, bevor Daten zurückgegeben werden
- Rate-Limiting auf Claude-API-Proxy-Route (max. Anfragen pro Nutzer/Minute)
- CORS nur für eigene Domain erlauben
- Nutzereingaben werden serverseitig validiert (mit **Zod**)
- Niemals rohe SQL-Queries — ausschließlich Prisma ORM verwenden

### OWASP Top 10
- **Injection:** Prisma verhindert SQL-Injection — kein `$queryRaw` ohne Parametervalidierung
- **XSS:** React escapet automatisch — kein `dangerouslySetInnerHTML` ohne Sanitization
- **CSRF:** NextAuth.js schützt standardmäßig dagegen
- **Sensitive Data:** Keine Passwörter oder API-Keys in Logs oder API-Responses

---

## 2. Clean Code

### Allgemein
- Funktionen haben eine einzige Verantwortung (Single Responsibility)
- Keine Funktion länger als ~50 Zeilen — bei Bedarf aufteilen
- Keine tief verschachtelten Bedingungen (max. 3 Ebenen) — früh returnen ("early return")
- Variablen- und Funktionsnamen auf **Englisch**, UI-Text auf **Deutsch**

### TypeScript
- Strikt: `strict: true` in `tsconfig.json`
- Kein `any` — immer explizite Typen oder `unknown` mit Type Guard
- Interfaces für Datenstrukturen, Types für Unions/Aliases
- API-Response-Typen immer mit Zod validieren und ableiten (`z.infer<>`)

### Next.js Konventionen
- Server Components als Standard — nur bei Bedarf `"use client"` hinzufügen
- Datenabruf in Server Components, nicht in Client Components
- Loading States mit `loading.tsx`, Error Handling mit `error.tsx`
- API-Routen in `app/api/` mit expliziten `NextResponse`-Rückgaben

### Dateistruktur
```
app/                    # Next.js App Router
  (auth)/               # Öffentliche Auth-Seiten (Login, Register)
  (dashboard)/          # Geschützte Seiten (nur eingeloggt)
  api/                  # API Routes
components/
  ui/                   # Generische UI-Komponenten (Button, Card, Input...)
  features/             # Feature-spezifische Komponenten (KartenListe, QuizCard...)
lib/
  fsrs.ts               # SRS-Algorithmus
  claude.ts             # Anthropic API Client
  auth.ts               # Auth-Helpers / Session-Utilities
  validations/          # Zod-Schemas
prisma/
  schema.prisma         # Datenbankschema
```

---

## 3. Dokumentation

### Code-Kommentare
- Kommentare nur, wenn die Logik nicht selbsterklärend ist
- Kein auskommentierter Code im Repository
- Komplexe Algorithmen (FSRS, CSV-Parser) erhalten einen kurzen Erklärungsblock oben

### Datei-Header (nur bei komplexen Utility-Dateien)
```ts
// lib/fsrs.ts
// Implementierung des FSRS-4.5 Algorithmus für Spaced Repetition.
// Basierend auf: https://github.com/open-spaced-repetition/fsrs4anki
```

### API-Routen
Jede API-Route hat einen kurzen Kommentar mit:
- Methode und Pfad
- Authentifizierung erforderlich: ja/nein
- Kurze Beschreibung

```ts
// POST /api/karten/import
// Auth: erforderlich
// Importiert Karteikarten aus CSV oder Anki-Format in ein Deck
```

---

## 4. Fehlerbehandlung (Error Handling)

- Fehler an Systemgrenzen abfangen (API-Aufrufe, DB-Queries, Datei-Parsing)
- Interne Fehler niemals direkt an den Client weitergeben — generische Fehlermeldung zurückgeben
- Claude-API-Fehler graceful behandeln (Timeout, Rate-Limit) mit Nutzer-freundlicher Meldung
- Logging mit `console.error` im Server, niemals sensitive Daten loggen

```ts
// Muster für API-Routes
try {
  // Logik
} catch (error) {
  console.error("[karten/import]", error)
  return NextResponse.json({ error: "Import fehlgeschlagen" }, { status: 500 })
}
```

---

## 5. Datenbank (Prisma / PostgreSQL)

- Schema-Änderungen nur über Prisma-Migrations (`prisma migrate dev`)
- Niemals direkt in die Produktionsdatenbank schreiben ohne Migration
- Alle Relations explizit mit `onDelete` definieren
- Sensible Felder (Passwort-Hash) niemals in `select` zurückgeben ohne explizites Ausschließen

```ts
// Passwort immer ausschließen:
const user = await prisma.user.findUnique({
  where: { email },
  select: { id: true, name: true, email: true } // kein password!
})
```

---

## 6. Claude API Integration

- Anthropic Client in `lib/claude.ts` zentralisiert — nicht in API-Routes direkt instanziieren
- Modell: `claude-sonnet-4-6` (Standard) — kein hardcoded Modellwechsel ohne Rücksprache
- System-Prompts in separaten Konstanten definieren, nicht inline
- Streaming für Chat-Antworten verwenden (bessere UX)
- API-Key nur serverseitig — niemals im Client-Bundle

```ts
// lib/claude.ts
import Anthropic from "@anthropic-ai/sdk"

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})
```

---

## 7. Git & Versionierung

- Commit-Messages auf Englisch, Konvention: `feat:`, `fix:`, `chore:`, `docs:`
- Keine Secrets, `.env`-Dateien oder `node_modules` im Repository
- `.gitignore` enthält: `.env*`, `node_modules/`, `.next/`, `*.log`

---

## 8. Deployment (Docker)

- `Dockerfile` mit Multi-Stage Build (builder + runner)
- Produktions-Image läuft als non-root User
- Datenbank-Passwörter nur über Docker-Secrets oder Env-Variablen
- Health-Checks im `docker-compose.yml` für App und DB definieren

---

## 9. Entwicklungsreihenfolge (MVP)

Claude arbeitet in dieser Reihenfolge — keine Phase überspringen:

1. Projekt-Setup (Next.js, Prisma, Docker Compose lokal)
2. Landing Page (öffentlich, Deutsch, Duolingo-Style)
3. Auth (NextAuth, Register, Login)
4. Datenbank-Schema + Migrations
5. Karteikarten-Import (CSV + Anki) + Deck-Verwaltung
6. SRS-Lernmodus (FSRS-Algorithmus)
7. Quiz-Modus (Multiple Choice, Wahr/Falsch, Freitext)
8. Dashboard / Statistiken (Streak, Fortschritt, Lernzeit)
9. Claude-Chat-Fenster (Karten erstellen + CSV-Export)
10. Deployment auf Hostinger VPS (Caddy, HTTPS, Let's Encrypt)
11. Polish & Gamification (Animationen, Abzeichen, Punkte)
