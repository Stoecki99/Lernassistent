# STATUS.md — Aktueller Projektstatus

**Zuletzt aktualisiert:** 2026-04-05 (Update 3)

---

## Projekt-Fortschritt

| Phase | Status | Beschreibung |
|-------|--------|-------------|
| 1. Projekt-Setup | Fertig | Next.js 14, Prisma, Tailwind, Docker |
| 2. Landing Page | Fertig | Duolingo-Style, responsive, deutsche UI |
| 3. Authentifizierung | Fertig | NextAuth, bcrypt 12 Rounds, Middleware |
| 4. Dashboard & Navigation | Fertig | Sidebar/BottomNav, Streak, Stats |
| 5. Deck-Verwaltung | Fertig | CRUD API, DeckCards, Modal |
| 6. Karteikarten & Import | Fertig | CSV/Anki Import, Flip-Animation |
| 7. SRS-Lernmodus | Fertig | FSRS-4.5 Algorithmus, Bewertung |
| 8. Quiz-Modus | Fertig | MC/Wahr-Falsch/Freitext, Claude-Bewertung |
| 9. Claude-Chat | Fertig | Streaming, CSV-Export, Rate-Limiting |
| 10. Statistiken & Gamification | Fertig | Badges, Punkte, Streak, WochenChart |
| 11. Deployment | Fertig | Dockerfile, Docker Compose, Caddy |
| 12. Polish | Fertig | Skeletons, Error States, A11y, SEO |

## Security-Fixes (alle angewendet)

- FSRS: w[5] -> w[7] in calculateDifficulty, easyBonus-Formel korrigiert
- Quiz: correctAnswer nicht an Client (HMAC-Token stattdessen)
- Quiz: dangerouslySetInnerHTML entfernt
- Auth: Timing-Attack-Schutz mit Dummy-bcrypt
- Streak: Atomare Transaction + increment statt read-modify-write
- Lernen-Routes: CUID-Validierung hinzugefuegt
- Chat: Neueste Nachrichten laden (desc + reverse)
- Chat: Rate-Limit Memory Leak Cleanup
- Badges: Race Condition mit upsert behoben
- Health-Check: DB-Connectivity pruefen
- Caddy-Headers: Security-Headers im Site-Block aktiv
- Statistiken: Parallel Queries mit Promise.all

## Deployment-Status

| Komponente | Status | Details |
|-----------|--------|---------|
| GitHub Repo | Laeuft | https://github.com/Stoecki99/Lernassistent (public) |
| GitHub Actions CI/CD | Deaktiviert | Workflow vorhanden, aktuell manuelles Deployment |
| VPS Docker | Laeuft | App-Image gebaut, Container laufen |
| PostgreSQL | Laeuft | Container healthy, Migration angewendet |
| Caddy Reverse Proxy | Laeuft | In ~/stack/, lernen.jan-stocker.cloud konfiguriert |
| CV-Website | Laeuft | jan-stocker.cloud, NICHT ANFASSEN |
| DB-Migration | Erledigt | Initial-Migration 20260404_init angewendet |
| Badge-Seed | Erledigt | Alle Badges geseeded |
| App erreichbar | Ja | https://lernen.jan-stocker.cloud |

## Aenderungen 2026-04-05 (Update 3)

- **Neu: Kontaktformular** — Oeffentliches Formular unter `/kontakt` mit dreifachem Anti-Spam-Schutz (Honeypot + reCAPTCHA v3 + Rate-Limiting)
- **Neu: E-Mail-Benachrichtigung** — Kontaktnachrichten werden via Resend an Betreiber gesendet UND in DB gespeichert
- **Neu: Admin-Nachrichten** — Admin-Panel zeigt alle Kontaktnachrichten mit Gelesen-Markierung
- **Neu: API-Route** — `POST /api/kontakt` (keine Auth), `GET/PATCH /api/admin/nachrichten` (Admin-Auth)
- **E-Mail-Adressen entfernt** — Impressum, Datenschutz und UpgradePrompt verlinken jetzt auf `/kontakt` statt E-Mail
- **DB-Migration noetig** — `npx prisma migrate deploy` (ContactMessage-Tabelle)
- **Neue Env-Variablen** — `RESEND_API_KEY`, `RECAPTCHA_SECRET_KEY`, `NEXT_PUBLIC_RECAPTCHA_SITE_KEY`
- **Neue Pakete** — `resend`, `react-google-recaptcha-v3`

## Aenderungen 2026-04-05 (Update 2)

- **Neu: Abo-Modell (Free/Pro)** — User-Model um plan, planExpiresAt, storageUsedBytes, apiTokensUsedThisMonth erweitert
- **Neu: Admin-Panel** — Geheimer Zugang via /admin/[ADMIN_SECRET], Nutzertabelle mit Plan-Verwaltung
- **Neu: Chat-Gating** — Free-Nutzer sehen Upgrade-Prompt, Pro-Nutzer koennen chatten
- **Neu: Speicher-Tracking** — storageUsedBytes wird bei Karten-CRUD aktualisiert (2GB Free, 6GB Pro)
- **Neu: API-Usage-Tracking** — Claude Token-Verbrauch wird pro Nutzer/Monat getrackt (2 CHF Cap)
- **Neu: KI-Prompt-Tipps** — Import-Seite zeigt 4 kopierbare Prompts fuer Claude/ChatGPT
- **Neu: Upgrade-Prompt** — TWINT-Bezahlinfo fuer Free-Nutzer (18 CHF / 6 Monate)
- **DB-Migration noetig** — `npx prisma migrate dev --name add-subscription-fields`
- **Neue Env-Variable** — `ADMIN_SECRET` muss gesetzt werden

## Aenderungen 2026-04-05

- **Fix: Lernen-Seite 404** — `/lernen` page.tsx erstellt (Deck-Uebersicht mit faelligen/neuen Karten)
- **Fix: API countOnly** — `/api/lernen/naechste?countOnly=true` fuer Karten-Zaehlung
- **Neu: Datenschutzerklaerung** — `/datenschutz` nach Schweizer DSG/nDSG
- **Neu: Impressum** — `/impressum` mit Kontaktinfo und Haftungsausschluss
- **Neu: Legal-Links** — Datenschutz + Impressum in Dashboard-Sidebar
- **Kontaktformular** — Verweis auf jan-stocker.ch/#contact (kein eigenes noetig)

## Geloeste Probleme

### Prisma v7 Migration (geloest 2026-04-05)
**Problem:** Standalone Docker Image enthielt `prisma.config.ts` nicht.
**Loesung:** Migration via separaten node:20-alpine Container mit gemountem Repo. Wird automatisch im GitHub Actions Workflow ausgefuehrt.

### bcrypt Alpine Kompatibilitaet (geloest 2026-04-05)
**Problem:** Native `bcrypt` Binary nicht verfuegbar auf Alpine Linux (musl).
**Loesung:** Ersetzt durch `bcryptjs` (pure JS, gleiche API).

### DNS-Eintrag (geloest 2026-04-05)
**Problem:** A-Record fuer `lernen.jan-stocker.cloud` fehlte.
**Loesung:** A-Record `lernen` -> VPS-IP im Hostinger DNS-Manager erstellt.

### Caddy Netzwerk (geloest 2026-04-05)
**Problem:** Caddy war nicht im `caddy-lernassistent` Docker-Netzwerk.
**Loesung:** `docker network connect caddy-lernassistent stack-caddy-1`

## VPS-Zugangsdaten

- **Provider:** Hostinger
- **User:** jan
- **Hostname:** srv1389794
- **App-Pfad:** ~/lernassistent/
- **Repo-Pfad:** ~/lernassistent/repo/
- **Stack-Pfad:** ~/stack/ (Caddy + CV — NICHT ANFASSEN)
- **Domain:** lernen.jan-stocker.cloud

## Datei-Statistik

- 99+ Quellcode-Dateien
- 16 Seiten (Pages)
- 13 API-Routes
- 28 Komponenten
- 9 Library-Dateien
- 8 Loading/Error States
