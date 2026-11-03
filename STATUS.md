# STATUS.md — Aktueller Projektstatus

**Zuletzt aktualisiert:** 2026-11-01 (Lernpfad Spieltheorie mit Spiel-Erweiterung, 11 Stationen; Lernpfad AVSW Verteilte Softwarearchitekturen mit Baustein «modellieren»; Lernpfad PMGT Welle 1, Leitstand und Lernpfad PS live)

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
| 13. Lernpfad | Live seit 29.10.2026 | Reiter Lernseiten, Lernpfad MSTW mit 18 Stationen (fertige HTML-Seiten aus dem Baukasten `public/lernpfad/`), Fortschritt im Konto |
| 14. Lernpfad PMGT | Welle 1 live seit 01.11.2026 | 7 von 25 Stationen (10, 11, 13, 18, 19, 22, 23), Baukasten 1.1.0; Konzept im Vault «02 Projekte/Lernpfad PMGT» |
| 15. Leitstand | Live seit 01.11.2026 | Projektsimulator `/leitstand` (nur Pro und Admin), Rechenkern `lib/simulation/`, Szenarien Onlineschalter Wolkenried und Einführungslauf, Speicherung `SimulationRun`, Spezifikation `docs/leitstand-spezifikation.md` |
| 16. Lernpfad PS | Live seit 01.11.2026 | 13 Stationen mit Konsolen-Simulator (`public/lernpfad/ps-konsole.*`), Kurzlink `/PS`; Konzept im Vault «02 Projekte/Lernpfad PS» |
| 17. Lernpfad AVSW | Fertig, wartet auf Deploy | Verteilte Softwarearchitekturen, 6 Stationen mit 35 Modellierungsübungen, Kurzlink `/avsw`, Baukasten 1.2.0 (`modellieren`, `piktogramm`, `pre.code`) |
| 18. Lernpfad Spieltheorie | Fertig, wartet auf Deploy | 11 Stationen (Spielbrett bis Krisenstab und Abschluss), Spiel-Erweiterung `public/lernpfad/st-spiel.*` (Figuren, Szenen, Spielbrett, Turnier, Spielbaum, Szenario, Lagetisch, Mischer), Kurzlink `/spieltheorie`; Konzept `docs/lernpfad-spieltheorie.md` (Vorlage für Vault «02 Projekte/Lernpfad Spieltheorie») |

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
| GitHub Actions CI/CD | Aktiv | Automatisch bei git push: Image bauen und nach GHCR pushen, auf dem VPS pullen, Migration, Deploy |
| VPS Docker | Laeuft | Seit 2026-10-28 zieht der VPS das Image `ghcr.io/stoecki99/lernassistent:latest` (kein Build mehr auf dem VPS, GHCR-Login nötig), Container laufen |
| PostgreSQL | Laeuft | Container healthy, Migration angewendet |
| Caddy Reverse Proxy | Laeuft | In ~/stack/, lernen.jan-stocker.cloud konfiguriert |
| CV-Website | Laeuft | jan-stocker.cloud, NICHT ANFASSEN |
| DB-Migration | Erledigt | Initial-Migration 20260404_init angewendet |
| Badge-Seed | Erledigt | Alle Badges geseeded |
| App erreichbar | Ja | https://lernen.jan-stocker.cloud |

## Offene Punkte (Stand 2026-11-01)

- **Lernpfad Spieltheorie, Vault:** Konzept liegt in `docs/lernpfad-spieltheorie.md`; Jan überträgt es in den Vault («02 Projekte/Lernpfad Spieltheorie»), Zugriff auf den Vault besteht aus der Cloud-Session nicht.
- **Lernpfad Spieltheorie, Station 10:** Akteursanalysen zu Russland–Ukraine, Taiwanstrasse und Rotes Meer/Hormus mit Stand Oktober 2026. Inhalte veralten: bei grösseren Lageänderungen nachführen (Hinweis «Modell, keine Prognose» steht auf der Seite).
- **Spiel-Erweiterung, Rest:** Spielbäume mit 6+ Blättern scrollen bei 360 px in sich (Breite passt sich jetzt der Textlänge an). Station 02 nutzt noch ihre eigene Streich-Interaktion statt des neuen Modus «streichen» (funktioniert, könnte umgestellt werden).

- **AVSW-Inhalte nicht mit Folien abgeglichen:** Die Folien lagen beim Erstellen nicht vor. Alle Stationen tragen den Hinweis «Eigene Beispiele und Lösungen, nicht vom Dozenten bestätigt». Begriffe, Notation (C4/UML), Themenreihenfolge, Feld `vorlesung` (vorläufig «Thema 1–5») und Prüfungsrahmen mit den Modulunterlagen abgleichen.
- **Tests der Handler fehlen:** Route-Handler der Themenseiten und `/api/lernfortschritt` haben keine eigenen Tests (getestet sind Validierung und Inhaltsprüfung).
- **KaTeX-Advisory GHSA-238p-pmpm-9mq7** (low, nur mit vorhandener Prototype-Pollution ausnutzbar): Update auf KaTeX 0.19 offen. `public/lernpfad/katex/` ist eine Kopie aus `node_modules/katex` und muss beim Update neu kopiert werden.
- **Doppelte Statistik-Funktionen:** mehrere Themenseiten bringen eigene Fassungen von `erfc`, `invPhi`, `lnGamma`, `tCdf` u. a. mit. Kandidat für den Baukasten.
- **Kein langes Caching für Schriften und KaTeX:** `/lernpfad/*` kommt mit `max-age=0` (Revalidierung per ETag). Pauschal `immutable` geht nicht, weil die Dateien keine Hash-Namen haben.
- **Redundanter Index im Modell `Lernfortschritt`:** `@@index([userId, fach])` ist durch `@@unique([userId, fach, thema])` abgedeckt.
- **npm audit:** offene Meldungen u. a. für `next` 14.2 und `next-auth` (Update auf neue Hauptversionen nötig), dazu weitere Pakete.
- **Alte Migrationen auf frischer Datenbank:** `prisma migrate deploy` scheitert (`20260405_add_contact_email` sortiert vor `20260405_add_contact_messages`). Produktion nicht betroffen, lokal `prisma db push` verwenden.
- **Lernpfad PS, Simulator:** bekannte Lücken gegenüber pwsh (z. B. `Get-History`, `Remove-Item -Recurse` ohne `-Force`, `break` in `ForEach-Object`, Comment-based Help), Liste in `docs/lernpfad-powershell.md` Abschnitt 8. Keine Aufgabe baut darauf auf.
- **Lernpfad PS, 360 px:** Inline-Code wie `-Confirm` bricht nach dem Bindestrich um (z. B. Lernziele Station 05). Kosmetisch.
- **`.claude/settings.local.json` ist versioniert** und enthält neu sehr breite Freigaben (`Bash(bash:*)`, `git restore:*`) sowie Pfade zur alten OneDrive-Kopie. Nicht in den Lernpfad-Commit aufnehmen; Bereinigung und `.gitignore` entscheidet Jan.

## Changelog

### 2026-11-03

- **feat: Lernpfad PMGT Welle 2 und IPMA-Prüfungssimulator live** — Stationen 01–03, 05–09, 12, 14–17 und 24 (21 von 25); Prüfungssimulator `/ipma` für alle eingeloggten Konten (Übungsprüfung 60 MC + 30 offen, Kurzprüfung, Training, Lücken schliessen; Auswertung 60 % und 23/28 Kompetenzen), Fragenpool Teil 1 mit 175 fachgeprüften Fragen (`content/ipma/fragen/`), Bewertung offener Antworten durch Claude (`claude-opus-5-5`, strukturierte Ausgabe, nur Pro/Admin, Tages- und Monatsdeckel); Migrationen `20261102090000_ipma_modelle` (inkl. 6 Abzeichen) und `20261102100000_ipma_aktiv_eindeutig` (Teil-Index). Leitstand mit gezeichneten Porträts, Symbolen und neuer Übersicht. Review und Integrationstest im Browser bestanden. Spezifikation `docs/ipma-pruefungssimulator-spezifikation.md`.

### 2026-11-01

- **feat: Spiel-Erweiterung 1.1** — Spielbrett-Modus «streichen» (schrittweise dominierte Strategien streichen), Zufall auf Szenario-Karten (`zufall` mit Gewichten), Spielbaum-Blätter passen sich der Textlänge an, festes Ende einer Karte geht vor `pruefe`.
- **feat: Lernpfad Spieltheorie** — `content/lernseiten/spieltheorie/` mit 11 Stationen in 5 Sektionen: Spielbrett, Gefangenendilemma, Nash-Gleichgewicht, Nullsumme und Bluff, Drohungen und Selbstbindung, Tit-for-Tat, Signale und Täuschung, 36 Strategeme und Sun Tzu, Verhandeln (Simulation «Die Piratenallianz»), Krisenstab Geopolitik, Abschluss mit Kampagne und Prüfung. Keine Formeln, Archipel-Aurelia-Geschichten, historische Fallstudien, Alltagschecklisten.
- **feat: Spiel-Erweiterung 1.0.0** — `public/lernpfad/st-spiel.css` und `st-spiel.js` (`Lernpfad.spiel`): Pergament-Grundton und Akzent Ziegelbraun (Kontrast hell und dunkel geprüft), 10 eigene SVG-Figuren, 7 Szenen, Bausteine `spielbrett`, `turnier` (Duell, Turnier, Evolution), `baum`, `szenario`, `akteure`, `mischer`. Vorlage `content/lernseiten/spieltheorie/_vorlage.html`, Doku `docs/lernpfad-spieltheorie.md`. Inhaltsprüfung erzwingt die Reihenfolge der Erweiterungsdateien (mit Tests), Test für `fach.json`.
- **test:** Alle Stationen bei 360 px hell und dunkel im Browser durchgeklickt (keine Konsolenfehler, kein seitlicher Scroll), Spielbretter und Spielbäume gegen die Engine nachgerechnet, alle Szenario-Enden erreicht.

- **feat: Lernpfad AVSW (Verteilte Softwarearchitekturen, FS26)** — `content/lernseiten/avsw/` mit sechs Stationen: Architekturstile, Kommunikation (REST, gRPC, Messaging), Container und Kubernetes, Resilienz und Konsistenz, Architektur modellieren, Prüfungstraining mit Prüfungsmodus. Navigation automatisch über den Fachordner (Kachel unter `/lernseiten`, Kurzlink `/avsw`). Test für `fach.json`. (Eine erste Fassung mit falschem Fach «Verlässliche IT-Infrastruktur» wurde ersetzt.)
- **feat: Baukasten 1.2.0** — Baustein `Lernpfad.modellieren` (Architektur aus Anforderungstext modellieren: Bausteine legen, Verbindungen mit Art ziehen, prüfen mit Rückmeldung, Musterlösung mit Begründungen, ohne Ziehen per Maus bedienbar), `Lernpfad.piktogramm` (22 eigene SVG-Symbole statt Markenlogos), Codeblöcke `pre.code`. Doku in `docs/lernpfad-baukasten.md` (8.14, 9.15, 9.16), Muster in `content/lernseiten/avsw/_vorlage.html`
- **feat: Lernpfad PS · Tipp-Training** — jede der 13 Stationen hat einen neuen Abschnitt «Tipp-Training» mit 11–12 Simulator-Aufgaben in drei Stufen (Nachtippen, Abwandeln, Selber lösen mit Wiederholung früherer Stationen); je 2–3 Klick-Übungen pro Station sind Tipp-Aufgaben geworden. Prüfungen akzeptieren gleichwertige Lösungen (Aliase, Abkürzungen, andere Wege), lehnen zu breite Befehle ab; je Station unabhängig geprüft, Integrationstest löst alle 150 Aufgaben automatisch
- **feat: Lernpfad PS live** (Commits 28cd6c5, 3478fb0, live am 01.11.2026) — 13 Stationen von «Konsole, erste Schritte» bis «Praxisprojekt und Abschluss» in `content/lernseiten/ps/`, Lernpfad `/lernseiten/ps`, Kurzlink `/PS`, Kachel im Reiter Lernseiten. Jede Station mit Konsolen-Simulator, Aufgaben, Lösungsfilm und Selbsttest; Fortschritt im Konto wie bei MSTW. Konzept: Vault `02 Projekte/Lernpfad PS.md`
- **test: Integrationstest bestanden** — Tests, `tsc`, Lint, Inhaltsprüfung (PS 13 von 13), Produktions-Build und Docker-Build; Ende-zu-Ende mit Wegwerf-Datenbank: ohne Login 307 auf `/login`, eingeloggt alle 13 Stationen 200 mit CSP, keine Konsolenfehler, kein waagrechter Scroll bei 360 px hell und dunkel
- **fix: Befunde aus dem Code-Review**:
  - Simulator: Arrays aus `*` und `+` höchstens 100 000 Elemente, Strings höchstens 10 Mio. Zeichen; Vervielfachen von Arrays in einem Schritt statt quadratisch mit `concat`
  - Konsole: Ausgabe pro Befehl auf 200 000 Zeichen und 3000 Zeilen begrenzt (Hinweis «Ausgabe gekürzt (Simulator)»), alte Ausgabe wird auch nach Zeichenzahl gekürzt
  - Simulator: `cd\` wechselt ins Stammverzeichnis (wurde als Pfad gelesen)
  - Inhaltsprüfung: `ps-konsole.css` vor `lernpfad.css` ist ein Fehler (mit Test)
  - Station 01: Knöpfe der Prompt-Anatomie heissen wie ihr sichtbarer Text (WCAG 2.5.3), der Titel kommt nur im Modus «Erkunden» als Beschreibung; kein leerer Tabstopp mehr
  - Aufgeräumt: toter Code in `ps-konsole.js`, Doku-Verweise (`docs/lernpfad-baukasten.md` Abschnitt 1, `docs/lernpfad-format.md`), bekannte Lücken des Simulators in `docs/lernpfad-powershell.md` Abschnitt 8, `.playwright-cli/` in `.gitignore`
- **feat: Lernpfad PMGT Welle 1 und Leitstand live** — Stationen 10, 11, 13, 18, 19, 22, 23; Projektsimulator `/leitstand` mit API `/api/simulation/runs`, Migrationen `20261101090000_add_simulation_run` (inkl. 8 Abzeichen) und `20261101100000_simulation_run_aktiv_eindeutig` (Teil-Index, von Prisma nicht abbildbar: bei `migrate dev` den Vorschlag zum Löschen entfernen). Integrationstest im Browser bestanden (Punkte Browser = Server, Free 403, Station 23 «erledigt»). Projekt-Agenten in `.claude/agents/` repariert (Werkzeugnamen).
- **feat: Leitstand mit Porträts und Symbolen** (Branch `feat/lernpfad-pmgt`, 02.11.2026, noch nicht live) — gezeichnete SVG-Porträts für alle Personen, Stakeholder, Coach und Absender (`Avatar.tsx`, Zuordnung nach Name in `avatarData.ts`, Ersatz-Porträt aus Prüfsumme; Szenario-Daten und -Version unverändert); eigene Strich-Symbole `Icon.tsx` (keine Pakete) für Kennzahlen, Navigation, Kanäle, Vorgangsstatus inkl. «blockiert» (im Lauf bereit/laufend ohne Besetzung), Meilensteine; Übersicht neu: «Was jetzt zu tun ist» (max. 3 Handlungen), Kennzahlen, Team-Leiste mit Motivation und Auslastung, kritischer Pfad als Leiste; übrige Ansichten mit schmaler Kennzahl-Leiste; Team-Karten mit Porträt, Stufenbalken je Gebiet, Motivations- und Auslastungsbalken; Plan-Prüfung zeigt 3 Befunde, Rest aufklappbar. Test `tests/leitstand-avatar.test.ts`.
- **fix: Review-Befunde Leitstand** (Branch `feat/lernpfad-pmgt`, live am 01.11.2026) — Client lädt nur `lib/simulation/core.ts`, Szenarien und Attrappe nur dynamisch; Sende-Logik `syncQueue.ts` (409 nach verlorener Antwort, 401 «Anmeldung abgelaufen», neue Versuche mit wachsendem Abstand / Retry-After, Sicherung mit Zod, Rest weiterverwenden); Fokusfalle mit inertem Hintergrund; Tastenkürzel nur im Leitstand und abschaltbar; Meldungen 10 s mit Pause; Rate-Limits auch für finish/GET/DELETE; Körpergrenze als Strom; `MAX_ACTIONS_PER_RUN` 900; Migration `20261101100000_simulation_run_aktiv_eindeutig` (Teil-Index, vor Deploy nötig); finish «Serializable» mit Wiederholung; Abzeichen per create. Neue Tests `tests/leitstand-sync.test.ts`, `tests/leitstand-server.test.ts`. Doku: `docs/leitstand-spezifikation.md` (Nachträge 4.5–4.8, 5.7, Restrisiko).

### 2026-10-31

- **feat: PS-Erweiterung 1.0.0 für den Lernpfad PS** (Branch `feat/lernpfad-powershell`) — eigene Dateien `public/lernpfad/ps-konsole.css` (Akzent PowerShell-Blau, Syntaxfärbung, `.ps-ausgabe`, `.ps-version`) und `public/lernpfad/ps-konsole.js` (PowerShell-Simulator mit Spiel-Rechner «Lea», 68 Befehle, Aufgaben-API, Skript-Modus, `Lernpfad.konsole.ausfuehren`), Vorlage `content/lernseiten/ps/_vorlage.html`, Prüfregel für `ps-konsole.js` nach `lernpfad.js`, Tests `tests/ps-konsole.test.ts` (356 Vergleiche mit echtem pwsh 7.6). Baukasten 1.1.0 unverändert. Doku: `docs/lernpfad-powershell.md`
- **feat: Baukasten 1.1.0 für den Lernpfad PMGT** (Branch `feat/lernpfad-pmgt`, live am 01.11.2026) — neue Bausteine `Lernpfad.reflexion` (offene Frage mit Musterlösung und Selbstbewertung nach Raster), `Lernpfad.matrix` (2×2 bis 5×5, Karten per Tipp und Tastatur ablegen, Prüfen), Hilfsfunktion `Lernpfad.netzplanKnoten`; CSS für ICB-Kennzeichen (`.icb`), Netzplan-Knoten (`.np-knoten`), Gantt-Balken (`.gantt`) und Akzentfarbe pro Fach (`body[data-fach="pmgt"]`, Orange, Kontrast ≥ 4.5:1 hell und dunkel). Vorlage `content/lernseiten/pmgt/_vorlage.html`. Bestehende Bausteine und MSTW-Seiten unverändert (im Browser geprüft). Doku: `docs/lernpfad-baukasten.md` (Abschnitte 7, 8.11–8.13, 9.12–9.14, Prüfliste)

### 2026-10-29

- **feat: Lernpfad MSTW live** (Commit b3baed9) — Baukasten `public/lernpfad/` (CSS, JavaScript, selbst gehostete Schriften, KaTeX), 18 Stationen von Aussagenlogik bis Prüfungstraining als fertige HTML-Dateien in `content/lernseiten/mstw/`, Lernpfad-Seite `/lernseiten/mstw` mit Fortschritt im Konto (Tabelle `Lernfortschritt`, Migration `20261028160000_add_lernfortschritt`, API `GET/POST /api/lernfortschritt`), Themenseiten nur eingeloggt (Route-Handler). Format: `docs/lernpfad-format.md`, Baukasten: `docs/lernpfad-baukasten.md`
- **refactor: altes Lernseiten-System abgebaut** — JSON-Inhalte (`seite.json`, `film.json`, `quiz.json`, `spick.json`), React-Komponenten (Bausteine, Lösungsfilm, Stepper, Selbsttest, Spickzettel …), `lib/lernseiten-film.ts`, `docs/lernseiten-format.md` und die Pakete `remark-math`, `rehype-katex`, `rehype-raw`, `rehype-sanitize` entfernt
- **test: Integrationstest im Browser bestanden**
- **fix: Review-Korrekturen** (Code-Review des Lernpfads):
  - DSG: Nunito kommt nicht mehr von Google Fonts, sondern vom eigenen Server (`next/font/local`, Dateien und OFL in `app/fonts/`). Dabei die Tailwind-Variable auf `--font-sans` korrigiert: mit dem alten Namen `--font-family-sans` wurde Nunito geladen, aber nie angewendet, die App lief in der Systemschrift. Datenschutzerklärung um einen Satz zu den Schriften ergänzt
  - Barrierefreiheit: keine Tabstopps mehr in `aria-hidden` (Formelteile aus `\htmlData`)
  - Selbsttest: Speichererfolg im Ereignis (`detail.gespeichert`, `detail.httpStatus`); die Abschluss-Box zeigt «nicht gespeichert» mit «Erneut speichern», bei 401 zusätzlich «Neu anmelden»
  - Themenseiten: `Cache-Control: private, no-store` und Content-Security-Policy (nur eigene Origin)
  - Theme-Startskript im `<head>` der Vorlage und aller 18 Themenseiten (kein Flackern im Dunkelmodus), `suppressHydrationWarning` am `<html>`
  - Inhaltsprüfung: `<link rel="next">` gegen `fach.json`, externe Adressen in Inline-Scripts, Fachordner zusätzlich gegen `public/` und `_next`, Theme-Startskript als Pflicht
  - Kleinigkeiten: Absicherung `user?.id` im Lernpfad, «Abspielen» statt «Play», überflüssige Typumwandlungen entfernt, Ausnahme für `dangerouslySetInnerHTML` (ThemaWahl) in CLAUDE.md
- **docs:** DEPLOYMENT.md auf GHCR-Pull umgestellt (gilt seit 2026-10-28), alte Lernseiten-Spezifikation als abgelöst markiert

### 2026-10-28

- **chore: Git wiederhergestellt** — Lokale Kopie nach Umzug (OneDrive → `C:\Dev\Lernassistent`) war ohne `.git`; seit April ungepushte Änderungen (Copyright-Köpfe, LICENSE, Nutzungsbedingungen) als eigener Commit erfasst
- **feat: Lernseiten** — Neuer Reiter unter Decks, `/lernseiten` (Fächer), `/lernseiten/[fach]` (Themen nach Sektion + Spickzettel), `/lernseiten/[fach]/[thema]` (Bausteine, Lösungsschritte mit Stepper und Zuordnung, Analyse, Lösungsfilm, Selbsttest, Merksätze); Kurzlinks `/MSTW`, `/mstw`. *Am 29.10. durch den Lernpfad ersetzt (Adressen und Kurzlinks bleiben).*
- **feat: Inhaltsformat** — ~~JSON unter `content/lernseiten/`, Format in `docs/lernseiten-format.md`~~ *Abgelöst am 29.10.: Themenseiten sind fertige HTML-Dateien, `fach.json` hält den Pfad, Format in `docs/lernpfad-format.md`.* `npm run lernseiten:pruefen` (läuft auch im Docker-Build) gibt es weiterhin.
- **feat: MSTW 04** — Erstes Thema «Prädikatenlogik: Sätze modellieren» (S1-V4&5, Bsp. 4.3, 4.6), heute Station 06
- **chore: Pakete** — `katex`; dev: `tsx` (Tests: `npm test`). *`remark-math`, `rehype-katex`, `rehype-raw` und `rehype-sanitize` am 29.10. wieder entfernt.*
- **Review (review-orchestrator):** keine kritischen/hohen Befunde; eingearbeitet: Absturzgefahr `CSS.escape` beim Server-Rendering, `LernInhalt` ohne `"use client"` (Fachseite 267 → 96 kB JS), abschliessende Tag-Liste im HTML-Filter, Fokus-Führung und Live-Regionen (Übung, Stepper, Film, Selbsttest), Prüfmodul getrennt (kein `app/` im Image), Metadaten erst nach Login
- **Fachprüfung MSTW 04:** Endformeln bestätigt; 13 Befunde (1 fachlicher Fehler in Quizfrage 8) eingearbeitet
- **Bekannt:** KaTeX-Advisory GHSA-238p-pmpm-9mq7 (low, nur mit vorhandener Prototype-Pollution ausnutzbar; Fix erst in KaTeX 0.19; seit 29.10. ohne `rehype-katex`, Stand siehe «Offene Punkte»). Mobile-Leiste hat 7 Einträge mit 10-px-Beschriftung (bei 320 px knapp, kein Überlauf)
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
