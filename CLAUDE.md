# Lernassistent — Claude Code Konfiguration

## Projekt

KI-gestützte Lernplattform für Studierende. Karteikarten mit Spaced Repetition (FSRS), Quiz, Claude-Chat, PDF-Upload.

## Technische Eckdaten

| Eigenschaft | Wert |
|-------------|------|
| Stack | Next.js 14 / TypeScript / PostgreSQL 16 / Prisma 7 / NextAuth |
| Domain | lernen.jan-stocker.cloud |
| Port | 3000 (nur Docker-intern, kein Host-Mapping) |
| Container | lernassistent-app, lernassistent-db |
| Image | ghcr.io/stoecki99/lernassistent:latest |
| VPS-Pfad | ~/lernassistent/ |

## Session-Start-Workflow

**Bei jeder neuen Session ZUERST diese Dateien lesen:**

1. **`STATUS.md`** — Aktueller Projektstatus, was funktioniert, was fehlt, offene Probleme
2. **`DEPLOYMENT.md`** — VPS-Architektur, Deployment-Schritte, Troubleshooting
3. **`CLAUDE.md`** (dieses Dokument) und `~/.claude/CLAUDE.md` (global)

- Vor jeder Änderung: STATUS.md auf aktuellen Stand prüfen.
- Nach abgeschlossener Arbeit: STATUS.md aktualisieren.

## Projekt-spezifische Regeln

### TypeScript & Next.js
- Strict Mode, kein unnötiges `any`
- Server Components als Default, `use client` nur wenn erforderlich
- Zod-basierte Validierung bei API-Ein-/Ausgaben
- UI-Texte Deutsch (Schweizer Rechtschreibung, ss statt ß), Code-Namen Englisch
- Ausnahme Lernpfad (`lib/lernseiten*`, `lib/validations/lernseite.ts`, `lib/validations/lernfortschritt.ts`, `components/features/lernseiten/`, `app/(lernpfad)/`, `app/api/lernfortschritt/`, `app/api/spielstand/`, `lib/spielstand.ts`, `lib/validations/spielstand.ts`, `lib/archsim/`, Architektur-Leitstand): deutsche Namen passend zum Inhaltsformat (`docs/lernpfad-format.md`, Baukasten `docs/lernpfad-baukasten.md`)
- Keine Umlaute in Variablen, Funktionen, CSS-Klassen, Dateinamen

### Commit-Konvention
- Commit-Messages auf Deutsch nach Conventional-Commits-Standard.
- Erlaubte Typen: feat, fix, chore, docs, refactor, test, style.
- Diese Regel überschreibt die alte projekt-lokale Englisch-Konvention aus CLAUDE.md.backup.

### Datenbank
- Prisma für alle DB-Zugriffe, kein Raw-SQL
- `onDelete` bei neuen Relationen immer definieren
- Migrationen mit `npx prisma migrate dev` erstellen
- Passwort-Felder nie versehentlich selektieren

### Claude API
- Anthropic SDK für Chat-Funktion, zentralisiert in `lib/claude.ts`
- API-Key nur serverseitig, nie im Client
- Streaming-Responses für Chat

### Deployment
- Image wird in CI gebaut und auf GHCR gepusht — NICHT lokal auf VPS bauen
- `NEXT_PUBLIC_`-Variablen müssen als Build-Arg in der Pipeline gesetzt werden
- VPS-Befehle dem User geben, NICHT selbst ausführen (kein SSH-Zugang)
- VPS-Befehle EINZELN geben, niemals mit && verketten — ich kopiere sie einzeln.
- `~/stack/` auf dem VPS NIEMALS anfassen (Caddy + andere Projekte)

### Security
- NextAuth-konforme Session-Prüfung serverseitig
- bcrypt mit mindestens 12 Rounds
- Rate-Limiting an Chat-Endpoint (API-Kosten!)
- CORS nur für eigene Domain erlauben
- Kein `$queryRaw` ohne Parametervalidierung — Prisma-Standard-Methoden bevorzugen
- Kein `dangerouslySetInnerHTML` ohne explizite Sanitization
  - Ausnahme: `components/features/lernseiten/ThemaWahl.tsx` (`ThemaStart`) setzt eine feste Konstante (Theme-Startskript ohne Benutzereingaben) per `dangerouslySetInnerHTML`. Keine weiteren Ausnahmen ohne Rücksprache.
- Passwort-Hash in `select`-Statements immer explizit ausschliessen

### Pflicht-Env-Variablen

`ANTHROPIC_API_KEY`, `DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`

## Error-Handling-Pattern

```ts
try {
  // Logik
} catch (error) {
  console.error("[route-name]", error)
  return NextResponse.json({ error: "Generische Meldung" }, { status: 500 })
}
```

- Interne Fehlerdetails niemals an den Client weitergeben
- Logging mit `console.error`, niemals sensitive Daten loggen

## Dateistruktur

```
app/                    # Next.js App Router
  (auth)/               # Oeffentliche Auth-Seiten
  (dashboard)/          # Geschuetzte Seiten
  (lernpfad)/           # Lernpfad: Themenseiten (HTML aus content/lernseiten/) hinter Login
  api/                  # API Routes
components/
  ui/                   # Generische UI-Komponenten
  features/             # Feature-spezifische Komponenten
lib/
  fsrs.ts               # SRS-Algorithmus
  claude.ts             # Anthropic API Client
  auth.ts               # Auth-Helpers
  validations/          # Zod-Schemas
prisma/
  schema.prisma         # Datenbankschema
```

## MVP-Phase

Aktuelle MVP-Phase und Reihenfolge: siehe `STATUS.md`.

## Referenzen

- Globale Regeln: `~/.claude/CLAUDE.md` (wird automatisch geladen)
- Infrastruktur-Details: Vault `03 Bereiche/Persönliche Infrastruktur/Projekte/lernen.jan-stocker.cloud.md`
- Deployment-Details: `DEPLOYMENT.md`
- Projektstatus: `STATUS.md`
- Reviews: globaler Agent `review-orchestrator`
