# STATUS.md — Aktueller Projektstatus

**Zuletzt aktualisiert:** 2026-04-05

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
- Nginx-Headers: Security-Headers in Sub-Locations wiederholt
- Statistiken: Parallel Queries mit Promise.all

## Deployment-Status

| Komponente | Status | Details |
|-----------|--------|---------|
| GitHub Repo | Laeuft | https://github.com/Stoecki99/Lernassistent (public) |
| GitHub Actions CI/CD | Fehlerhaft | SSH-Key Passphrase/IP Problem — wird manuell deployed |
| VPS Docker | Laeuft | App-Image gebaut, Container laufen |
| PostgreSQL | Laeuft | Container healthy |
| Caddy Reverse Proxy | Laeuft | In ~/stack/, lernen.jan-stocker.cloud konfiguriert |
| CV-Website | Laeuft | jan-stocker.cloud, NICHT ANFASSEN |
| **DB-Migration** | **FEHLT** | Prisma v7 + prisma.config.ts Problem im Docker |
| **Badge-Seed** | **FEHLT** | Abhaengig von Migration |
| **App erreichbar** | **NEIN** | Migration muss zuerst laufen |

## Aenderungen 2026-04-05

- **Fix: Lernen-Seite 404** — `/lernen` page.tsx erstellt (Deck-Uebersicht mit faelligen/neuen Karten)
- **Fix: API countOnly** — `/api/lernen/naechste?countOnly=true` fuer Karten-Zaehlung
- **Neu: Datenschutzerklaerung** — `/datenschutz` nach Schweizer DSG/nDSG
- **Neu: Impressum** — `/impressum` mit Kontaktinfo und Haftungsausschluss
- **Neu: Legal-Links** — Datenschutz + Impressum in Dashboard-Sidebar
- **Kontaktformular** — Verweis auf jan-stocker.ch/#contact (kein eigenes noetig)

## Offenes Problem: Prisma Migration

**Problem:** `prisma migrate deploy` braucht in Prisma v7 die `datasource.url` aus `prisma.config.ts`. Das standalone Next.js Docker Image kopiert `prisma.config.ts` nicht mit.

**Loesungsansaetze:**
1. `prisma.config.ts` im Dockerfile in den Runner-Stage kopieren
2. Migration ueber einen separaten Container ausfuehren der das volle Repo hat
3. `DATABASE_URL` direkt als CLI-Flag uebergeben

**Empfohlene Loesung:** Option 2 — Migration via `docker compose run` mit dem Build-Context (repo-Ordner):
```bash
cd ~/lernassistent
docker run --rm \
  --network lernassistent_internal \
  -e DATABASE_URL="postgresql://postgres:PASSWORT@lernassistent-db:5432/lernassistent" \
  -v $(pwd)/repo:/app \
  -w /app \
  node:20-alpine sh -c "npm ci && npx prisma migrate deploy"
```

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
