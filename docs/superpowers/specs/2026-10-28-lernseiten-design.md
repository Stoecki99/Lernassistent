# Lernseiten — Design

> **Abgelöst durch den Lernpfad** (`docs/lernpfad-format.md`, `docs/lernpfad-baukasten.md`), Stand 2026-10-29. Dieses Dokument beschreibt das frühere JSON/React-System und gilt nicht mehr.

**Datum:** 2026-10-28 · **Status:** freigegeben (Jan, 28.10.2026)

## Ziel

Interaktive Lernseiten pro Studienfach im Lernassistenten, erstes Fach MSTW (Mathematik und Statistik Wirtschaftsinformatik, HS26). Erreichbar unter `lernen.jan-stocker.cloud/MSTW`.

## Entscheide

| Frage | Entscheid |
|-------|-----------|
| Zugang | Bestehendes Login. Alle eingeloggten Konten sehen alle Lernseiten. |
| Navigation | Neuer Reiter «Lernseiten» direkt unter «Decks» (Seitenleiste und Mobile-Leiste). |
| Liste | `/lernseiten`: Kacheln pro Fach im Stil der Deck-Liste, ohne «Neu»-Kachel. |
| Adressen | `/lernseiten/<fach>` (Fachübersicht), `/lernseiten/<fach>/<thema>` (Lernseite). `/MSTW` und `/mstw` leiten dauerhaft weiter. Kein Platzhalter auf oberster Ebene, damit unbekannte Adressen weiter «Nicht gefunden» zeigen und Fachkürzel nicht mit App-Seiten kollidieren. |
| Technik | Weg A: Lernkomponenten als React-Komponenten in der App, Inhalte als JSON-Dateien im Repo. Keine eingebetteten HTML-Seiten. |
| Inhaltsformat | Didaktisches Gerüst des Skills `lernthema-interaktiv`, als JSON statt Hugo-Bundle. Siehe `docs/lernseiten-format.md`. |
| Darstellung | `react-markdown` (bereits vorhanden) mit `remark-math` + `rehype-katex` (Formeln, selbst gehostet) und `rehype-raw` + `rehype-sanitize` (nur erlaubte Spans und Attribute, kein `dangerouslySetInnerHTML`). |
| Prüfung | Zod-Schemas plus Querprüfungen (Sektion existiert, Quiz-IDs eindeutig, Film-Verweise gültig). `npm run lernseiten:pruefen` lokal und im Docker-Build. |
| Fortschritt | Kein Speichern von Selbsttest-Ergebnissen in der Datenbank (später möglich, Quiz-IDs sind dafür eindeutig). |
| Infrastruktur | Keine Änderung an Caddy, DNS, Ports oder Containern. Dockerfile kopiert `content/` ins Image. |

## Bausteine

- `lib/validations/lernseite.ts` — Zod-Schemas für `fach.json`, `seite.json`, `film.json`, `quiz.json`, `spick.json`.
- `lib/lernseiten.ts` — liest und prüft Inhalte (nur Server): Fächer, Themen eines Fachs, ein Thema, Spickzettel, Gesamtprüfung.
- `lib/lernseiten-film.ts` — reine Funktionen: Szenen auflösen (fehlende Felder erben), Szenendauer.
- `components/features/lernseiten/` — `LernInhalt`, `Zuordnung`, `Bausteine`, `SortierUebung`, `Woerterbuch`, `LoesungsStepper`, `Brille`, `LoesungsFilm`, `Selbsttest`, `Merke`, `Spickzettel`, `LernseiteKarte`.
- `app/(dashboard)/lernseiten/…` — drei Seiten, Login-Prüfung über das bestehende Layout und zusätzlich in jeder Seite.
- `scripts/lernseiten-pruefen.ts`, `tests/lernseiten.test.ts` (node:test über `tsx`).

## Fehlerverhalten

- Unbekanntes Fach oder Thema → `notFound()`.
- Ungültige Inhaltsdatei → Build bricht ab (Prüfskript); zur Laufzeit wirft der Loader und die bestehende `error.tsx` greift.
- Ordnernamen werden gegen `^[a-z0-9-]+$` geprüft, bevor sie in Dateipfade gelangen.

## Umsetzungsschritte

1. Git im lokalen Repo wiederherstellen (erledigt, Commit `0c4bacd`).
2. Schemas, Loader, Film-Funktionen, Tests, Prüfskript.
3. Lernkomponenten.
4. Seiten, Reiter, Weiterleitung, Dockerfile.
5. Erstes Thema: MSTW 04 «Prädikatenlogik: Sätze modellieren» (S1-V4&5, Bsp. 4.3 und 4.6).
6. Build, Lint, Tests, Browser-Test (Desktop und 360 px).
7. Doku: STATUS.md, Vault, Skill `lernthema-interaktiv` auf das neue Format umstellen.
