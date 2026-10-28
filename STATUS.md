# STATUS.md — Aktueller Projektstatus

**Zuletzt aktualisiert:** 2026-10-28 (Lernseiten)

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
| 13. Lernseiten | Fertig (lokal, Branch `feat/lernseiten`) | Reiter Lernseiten, interaktive Themenseiten pro Fach, erstes Fach MSTW |

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
| GitHub Actions CI/CD | Aktiv | Automatisch bei git push: Build, Migration, Deploy |
| VPS Docker | Laeuft | App-Image gebaut, Container laufen |
| PostgreSQL | Laeuft | Container healthy, Migration angewendet |
| Caddy Reverse Proxy | Laeuft | In ~/stack/, lernen.jan-stocker.cloud konfiguriert |
| CV-Website | Laeuft | jan-stocker.cloud, NICHT ANFASSEN |
| DB-Migration | Erledigt | Initial-Migration 20260404_init angewendet |
| Badge-Seed | Erledigt | Alle Badges geseeded |
| App erreichbar | Ja | https://lernen.jan-stocker.cloud |

## Changelog

### 2026-10-28

- **chore: Git wiederhergestellt** — Lokale Kopie nach Umzug (OneDrive → `C:\Dev\Lernassistent`) war ohne `.git`; seit April ungepushte Änderungen (Copyright-Köpfe, LICENSE, Nutzungsbedingungen) als eigener Commit erfasst
- **feat: Lernseiten** — Neuer Reiter unter Decks, `/lernseiten` (Fächer), `/lernseiten/[fach]` (Themen nach Sektion + Spickzettel), `/lernseiten/[fach]/[thema]` (Bausteine, Lösungsschritte mit Stepper und Zuordnung, Analyse, Lösungsfilm, Selbsttest, Merksätze); Kurzlinks `/MSTW`, `/mstw`
- **feat: Inhaltsformat** — JSON unter `content/lernseiten/`, Zod-Prüfung, `npm run lernseiten:pruefen` (läuft auch im Docker-Build), Format in `docs/lernseiten-format.md`
- **feat: MSTW 04** — Erstes Thema «Prädikatenlogik: Sätze modellieren» (S1-V4&5, Bsp. 4.3, 4.6)
- **chore: Pakete** — `remark-math`, `rehype-katex`, `katex`, `rehype-raw`, `rehype-sanitize`; dev: `tsx` (Tests: `npm test`)
- **Review (review-orchestrator):** keine kritischen/hohen Befunde; eingearbeitet: Absturzgefahr `CSS.escape` beim Server-Rendering, `LernInhalt` ohne `"use client"` (Fachseite 267 → 96 kB JS), abschliessende Tag-Liste im HTML-Filter, Fokus-Führung und Live-Regionen (Übung, Stepper, Film, Selbsttest), Prüfmodul getrennt (kein `app/` im Image), Metadaten erst nach Login
- **Fachprüfung MSTW 04:** Endformeln bestätigt; 13 Befunde (1 fachlicher Fehler in Quizfrage 8) eingearbeitet
- **Bekannt:** KaTeX-Advisory GHSA-238p-pmpm-9mq7 (low, nur mit vorhandener Prototype-Pollution ausnutzbar; Fix erst in KaTeX 0.19, `rehype-katex` verlangt ^0.16). Mobile-Leiste hat 7 Einträge mit 10-px-Beschriftung (bei 320 px knapp, kein Überlauf)
- **Bekannt:** `prisma migrate deploy` scheitert auf einer frischen Datenbank (`20260405_add_contact_email` sortiert vor `20260405_add_contact_messages`); Produktion nicht betroffen

### 2026-04-06

- **feat: OpenDecks** — Community Deck Sharing Feature
- **feat: Quiz-Fragenzahl** — Anzahl Quizfragen konfigurierbar, Freitext fuer Nicht-Admins gesperrt
- **feat: Admin Nachrichten loeschen** — Delete-Button fuer Kontaktnachrichten im Admin-Panel
- **feat: Upgrade-Prompt** — TWINT-Nummer und API-Kosten-Erklaerung anzeigen
- **fix: Karten-Hint** — Null-Wert fuer Hint beim Karten-Update erlaubt

### 2026-04-05 (Update 3)

- **feat: Kontaktformular** — `/kontakt` mit Honeypot + reCAPTCHA v3 + Rate-Limiting
- **feat: E-Mail-Benachrichtigung** — Kontaktnachrichten via Resend + DB-Speicherung
- **feat: Admin-Nachrichten** — Alle Kontaktnachrichten mit Gelesen-Markierung
- **feat: API-Route** — `POST /api/kontakt` (public), `GET/PATCH /api/admin/nachrichten` (Admin)
- **refactor: E-Mail entfernt** — Impressum/Datenschutz verlinken auf `/kontakt`
- **chore: Migration** — ContactMessage-Tabelle
- **chore: Env-Vars** — `RESEND_API_KEY`, `RECAPTCHA_SECRET_KEY`, `NEXT_PUBLIC_RECAPTCHA_SITE_KEY`
- **chore: Pakete** — `resend`, `react-google-recaptcha-v3`

### 2026-04-05 (Update 2)

- **feat: Abo-Modell (Free/Pro)** — plan, planExpiresAt, storageUsedBytes, apiTokensUsedThisMonth
- **feat: Admin-Panel** — `/admin/[ADMIN_SECRET]`, Nutzertabelle mit Plan-Verwaltung
- **feat: Chat-Gating** — Free = Upgrade-Prompt, Pro = Chat
- **feat: Speicher-Tracking** — 2GB Free, 6GB Pro
- **feat: API-Usage-Tracking** — Claude Token pro Nutzer/Monat (2 CHF Cap)
- **feat: KI-Prompt-Tipps** — 4 kopierbare Prompts auf Import-Seite
- **feat: Upgrade-Prompt** — TWINT-Bezahlinfo (18 CHF / 6 Monate)
- **chore: Migration** — `add-subscription-fields`
- **chore: Env-Var** — `ADMIN_SECRET`

### 2026-04-05

- **fix: Lernen-Seite 404** — `/lernen` page.tsx erstellt
- **fix: API countOnly** — `/api/lernen/naechste?countOnly=true`
- **feat: Datenschutzerklaerung** — `/datenschutz` nach Schweizer DSG/nDSG
- **feat: Impressum** — `/impressum` mit Kontaktinfo
- **feat: Legal-Links** — Datenschutz + Impressum in Sidebar

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
