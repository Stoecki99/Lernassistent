# Architektur-Leitstand

**Stand:** 01.11.2026 · Fach AVSW, Station 11 «Architektur-Leitstand» · Vertrag Modell, Engine und Kern: `docs/architektur-modell.md` (Abschnitte 6 und 9)

## 1. Zweck

Missionen, in denen eine verteilte Architektur unter Last steht: Die Architektur ist vorgegeben (M1–M3) oder wird aus einem Auftrag selbst modelliert (M4). Die Zeit läuft (1 Minute je Sekunde bei 1×), Ereignisse wie Lastspitzen, langsame Abhängigkeiten, Ausfälle oder fehlerhafte Deployments treten ein, die Spielerin trifft Massnahmen (skalieren, Cache, CDN, Queue, Circuit Breaker, Timeout, Retry, Bulkhead, Rate Limit, Read-Replica, Rollback) und sieht Kennzahlen und Diagramm live reagieren. Am Ende: Punkte (0–1000), Sterne, Nachbesprechung mit Zeitachse Ursache → Wirkung und Lehren mit Links in den Lernpfad. Zugang wie der Leitstand: nur Pro und Admin.

## 2. Ablauf und Oberfläche

| Route | Inhalt |
|---|---|
| `/architektur-leitstand` | Missionswahl: Fortschritt über alle Missionen (Sterne), Karten mit Schwierigkeit, Art, SLO, Budget, Lernzielen, Bestwert, «Fortsetzen», «Neu beginnen», letzte Läufe mit «Gleicher Seed». Mission n+1 ist frei ab 1 Stern in Mission n (M1 geführt). |
| `/architektur-leitstand/[laufId]` | Spiel: Briefing → (Modellierphase) → Leitstand → Ergebnis |

- **Briefing:** Firma, Auftrag, SLO (p95, Verfügbarkeit), Budget, Dauer, Werkzeuge, Lernziele mit Stationslinks, Bewertungsregel.
- **Modellierphase** (nur `art: "modellieren"`): Auftrag mit markierbaren Bausteinen (`data-baustein`, ✓ sobald im Modell), Engine-Editor (`Architektur.editor`) mit der Palette der Mission (vorgegebene Elemente fest), Live-Prüfung mit `validiere` (Lauffähigkeit, Anforderungen als Checkliste ✓/✗). Entwurf im `localStorage`. «Lasttest starten» speichert das Modell (`POST …/model`); offene Anforderungen nach Rückfrage erlaubt (−75 je Anforderung).
- **Leitstand:** Pult (Minute, Fortschritt mit Ereignisbändern ab Beginn, Start/Pause, 1×/2×/4×, «+1 min», Speicherstand), Kennzahl-Kacheln mit SLO-Ampel (Farbe + Form + Wort, Kleinkurve, Erklärung), Live-Diagramm (`Architektur.diagramm`), Seitenpanel zum gewählten Element bzw. zur gewählten Verbindung (Messwerte, passende Massnahmen, Aufrufe von hier), Massnahmen-Leiste (Karten, Zielwahl im Dialog), Verlauf (Last/Fehler, p95 mit SLO, Kosten mit Budget und Prognose; Ereignisse als Bänder, eigene Massnahmen als Rauten, Tabelle zum Aufklappen), Protokoll, Meldungen (10–15 s, halten bei Maus/Fokus, bei Ereignissen «Anhalten» und «Betroffenes Element zeigen»), Coach-Hinweise (geführte Mission). Bei Ereignis/Hinweis hält die Zeit an (abschaltbar). Mobil (< 760 px): Tabs Diagramm / Kennzahlen / Massnahmen.
- **Diagramm-Overlay** (`LiveDiagramm.tsx`): neu gezeichnet nur bei neuer Struktur (Cache/CDN/Queue fügen Elemente ein), sonst je Minute: Klassen `al-z-<Messzustand>` (Farbe), Plakette «Instanzen · Auslastung» bzw. Last am Einstieg bzw. Rückstau, Füllbalken an Queues, wandernde Punkte auf genutzten Verbindungen (SVG `animateMotion`, Stärke nach Last, Farbe nach Lage; nicht bei `prefers-reduced-motion`), Plakette «CB zu/offen/halb» und «BH». `setzeZustand` der Engine nur für «ausfall» und «neu» (eingefügte Elemente 4 Minuten). Auswahl per Klick (Capture-Phase) oder Enter, zusätzlich Auswahlliste für Tastatur.
- **Ergebnis:** Punkte hochzählend, Sterne nacheinander, «Neuer Bestwert», Konto-Punkte, neue Abzeichen; Punkte je Teil (`score.teile`) mit Erklärung; Gesamtkennzahlen; Zeitreise: Zeitachse anklicken oder in die Kurve tippen → Zeiger im Verlauf und Diagramm im Zustand dieser Minute (Nachspielen bis zur Minute, `zustandBei`); Lehren (Hätte geholfen, Link), Lernziele, Musterstrategie; «Nochmals mit gleichem Seed», «Neuer Lauf».
- **Tastatur:** Leertaste Start/Pause, 1/2/4 Tempo, N eine Minute vor (nur mit Fokus im Leitstand, nicht in Feldern/Dialogen, abschaltbar). Dialoge mit Fokusfalle und inertem Hintergrund.
- **Missionstexte** (Briefing, Auftrag) sind festes HTML im Kern; sie werden ohne `dangerouslySetInnerHTML` über einen kleinen Leser (`html.ts`, nur p, strong, em, b, i, code, br, span[data-baustein]) ausgegeben.

Die Engine wird im Layout mit `next/script` (`/lernpfad/architektur.js`) und `architektur.css` geladen; `lernpfad.js` wird nicht geladen (die Engine nutzt `window.Lernpfad` nur für Formeln). Die React-Hülle wartet darauf (`useEngine`, Fehlermeldung nach 15 s).

## 3. Speicherung und API

Gespeichert werden Startwert (vom Server, `crypto.randomInt`), Missions- und Kern-Version, Aktionsprotokoll und bei M4 das Modell. Der Browser spielt mit demselben Kern (`lib/archsim`) deterministisch; der Server rechnet bei jedem Anhang und beim Abschluss nach. Aufeinanderfolgende «weiter» fasst die Sende-Logik zusammen (`syncQueue.ts`).

| Methode, Pfad | Eingabe | Antwort |
|---|---|---|
| `GET /api/archsim/runs?missionId=` | – | `{ laeufe (ohne Protokoll, max. 30), missionen: [{ missionId, bestwert, sterne, aktiv, freigeschaltet }] }` |
| `POST /api/archsim/runs` | `{ missionId, wiederholungVon? }` | 201 `{ id, missionId, seed, seedReused, missionVersion, engineVersion }`; 409 `LOCKED`, wenn gesperrt; alter aktiver Lauf der Mission → «abgebrochen» |
| `GET /api/archsim/runs/[id]` | – | Lauf mit `aktionen`, `modell`, `ergebnis`, `veraltet` |
| `POST /api/archsim/runs/[id]/model` | `{ modell }` | nur M4 und nur vor der ersten Aktion (sonst 409), lauffähig (sonst 422 `INVALID_MODEL` mit `details`) |
| `POST /api/archsim/runs/[id]/actions` | `{ abIndex, aktionen (1–200) }` | `{ aktionCount, tick, phase, zusammenfassung }`; 409 mit `aktionCount` bei falschem `abIndex`/Gleichzeitigkeit; 422 `INVALID_ACTION` mit `index` |
| `POST /api/archsim/runs/[id]/finish` | `{}` | `{ ergebnis, neueAbzeichen, bestwertVerbessert, punkte }`; 422, solange die Mission nicht zu Ende ist; idempotent |
| `DELETE /api/archsim/runs/[id]` | – | aktiver Lauf → «abgebrochen» |

Muster wie Leitstand (`lib/leitstand.ts` wird für Körpergrenze 256 KB als Strom, Fehlerantwort, Prisma-Wiederholung und Zugang mitbenutzt): 401 ohne Login, 403 ohne Pro/Admin, Zod mit erster Meldung, Zugriff nur `where: { id, userId }` (404), `Cache-Control: private, no-store`, generische 500 mit `console.error("[archsim/…]")`. Rate-Limits je Konto und Minute: Aktionen 60, Starten 10, Abschliessen 10, Lesen 60, Abbrechen 10, Modell 30 (429 mit `Retry-After`). Höchstens 600 Aktionen je Lauf.

**Punkte und Bestwert:** Bestwert je Mission nur aus abgeschlossenen Läufen mit neuem Startwert. Punkte ins Konto = Verbesserung des Bestwerts ÷ 10 (gerundet, höchstens 100); Wiederholungen mit gleichem Seed geben nichts. Abschluss in einer Transaktion `Serializable` mit bis zu drei Versuchen (P2034). Station `avsw/11-architektur-leitstand`: «begonnen» beim Start, «erledigt», sobald jede Mission mindestens einen Stern hat. Abzeichen: `archsim_erste_mission` (Erster Lasttest), `archsim_drei_sterne` (Architektur hält), `archsim_alle_missionen` (Leitstand-Architekt·in), in `lib/badges.ts`, `prisma/seed.ts` und der Migration.

**Client:** `api.ts` (http; Attrappe `mockApi.ts` nur mit `ARCHSIM_API = "attrappe"` und nur ausserhalb der Produktion, dynamisch geladen), `useLaufSync.ts` + `syncQueue.ts` (eine Anfrage gleichzeitig; 409 nach verlorener Antwort = Teil bestätigt; 401 «Anmeldung abgelaufen», Sicherung bleibt; 400/403/404/413/422 → neu laden; 429/5xx/offline → neuer Versuch 2 s … 60 s bzw. `Retry-After`; Sicherung im `localStorage`, mit Zod geprüft).

## 4. Datenmodell

`ArchitekturLauf { id, userId, missionId, missionVersion, engineVersion, seed, seedReused, status ("aktiv" | "abgeschlossen" | "abgebrochen" | "veraltet"), aktionen Json, aktionCount, modell Json?, tick, summary Json?, score?, stars?, scoreDetail Json? ({ score, kennzahlen, nachbesprechung, validierung }, ohne Zustand), pointsAwarded, createdAt, updatedAt, finishedAt? }`, `onDelete: Cascade`, Indizes `(userId, missionId, status)`, `(userId, missionId, score)`, `(userId, createdAt)`. Migration `20261101120000_add_architektur_lauf` mit Teil-Index `ArchitekturLauf_aktiv_eindeutig` auf `(userId, missionId) WHERE status = 'aktiv'` (von Prisma nicht abbildbar; schlägt `migrate dev` vor, ihn zu löschen, die Zeile entfernen) und den drei Abzeichen.

## 5. Sicherheit

- Seed nur vom Server; Punkte nur aus dem Nachrechnen auf dem Server, Aktionen und Modell mit Zod und dem Kern geprüft (fremde Elemente, unbekannte Typen, nicht erlaubte Massnahmen → 422).
- Restrisiko wie Leitstand (akzeptiert): Seed und Mission liegen im Browser; wer den Kern lokal laufen lässt, kann Massnahmen vorausrechnen. Begrenzt durch 100 Punkte je Lauf und Bestwert-Logik; keine Rangliste.
- Keine Benutzereingaben als HTML: Namen aus dem Editor werden von Tags befreit und als Text ausgegeben; Missionstexte über den Whitelist-Leser.

## 6. Tests

- `tests/architektur-leitstand-api.test.ts`: Schemas, `pruefeUndHaengeAn` (409/422, Index, Höchstzahl, Modell fehlt, veraltet), `pruefeModellFuerLauf`, Nachspielen = Server (zusammengefasste «weiter»), Punkte, Freischalten, Abzeichen, Versionen, Rate-Limit, Admin-Zugang, Stationslinks gegen `content/lernseiten/avsw/fach.json`.
- `tests/architektur-leitstand-sync.test.ts`: Sende-Logik mit Fake-API.
- `tests/architektur-leitstand-ui.test.ts`: HTML-Leser, Editor-Modell bereinigen, Kacheln, Massnahmen-Ziele, Rückstau, Fluss, Zeitreise, Chronik.
- Browser (Playwright, Wegwerf-Postgres): M1 bis Ende (950 Punkte, Punkte/Abzeichen gespeichert), M4 modelliert (Cache per Palette und Verbinden gesetzt) und Lasttest, Ergebnis mit Zeitreise; 1280 und 375 px, hell und dunkel, ohne Konsolenfehler und ohne waagrechten Seitenscroll.
