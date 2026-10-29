# Lernpfad — Format und Auslieferung

Ein Lernpfad führt durch ein Studienfach (zuerst MSTW), Station für Station bis zur Modulschlussprüfung. Jede Station ist **eine fertige HTML-Datei**. Die App liefert sie hinter dem Login aus und speichert den Fortschritt pro Konto.

Gestaltung und Bausteine der Seiten (CSS, JavaScript, Schriften, KaTeX, Vorlage) beschreibt `docs/lernpfad-baukasten.md`. Dieses Dokument regelt Daten, Dateien, Prüfung, Auslieferung und Fortschritt.

## Adressen

| Adresse | Inhalt |
|---------|--------|
| `/lernseiten` | Liste aller Fächer (Kacheln) |
| `/lernseiten/<fach>` | Lernpfad des Fachs: Stationen nach Sektion, mit Fortschritt |
| `/lernseiten/<fach>/<slug>` | Themenseite einer Station (HTML-Datei, nur eingeloggt) |
| `/<FACH>`, `/<fach>` | Kurzlink, leitet auf `/lernseiten/<fach>` weiter (`next.config.js`) |
| `/api/lernfortschritt` | Fortschritt lesen und schreiben (siehe unten) |

## Ordnerstruktur

```
content/lernseiten/
  mstw/                                         # Fachordner = Kürzel in Kleinbuchstaben
    fach.json                                   # Fach, Sektionen, Lernpfad
    01-aussagenlogik-grundlagen.html            # eine Datei pro Station
    08-laplace-bedingte-wahrscheinlichkeit.html
    _vorlage.html                               # «_» am Anfang: keine Station, wird ignoriert
```

- Fachordner: nur `a-z` und `0-9`. Er darf nicht wie eine App-Seite heissen (`chat`, `decks`, `api` …).
- Themenseite: `<slug>.html`, der Slug steht im Pfad von `fach.json`.
- Dateien und Ordner mit `_` oder `.` am Anfang ignoriert die App. Andere Dateien im Fachordner liefert sie nicht aus; die Prüfung erwähnt sie als Hinweis.

## fach.json

```json
{
  "kuerzel": "MSTW",
  "titel": "Mathematik und Statistik Wirtschaftsinformatik",
  "beschreibung": "Logik, Wahrscheinlichkeitstheorie und schliessende Statistik …",
  "icon": "∑",
  "farbe": "#1CB0F6",
  "semester": "HS26",
  "sektionen": [
    { "id": "s1", "titel": "Sektion 1 · Logik" },
    { "id": "abschluss", "titel": "Prüfungsvorbereitung" }
  ],
  "pfad": [
    {
      "slug": "01-aussagenlogik-grundlagen",
      "titel": "Aussagenlogik: Grundlagen",
      "sektion": "s1",
      "vorlesung": "S1-V1",
      "dauer_min": 30,
      "kurz": "Aussagen, Junktoren, Syntax und Semantik, Wahrheitstafeln"
    }
  ]
}
```

| Feld | Regel |
|------|-------|
| `kuerzel` | Buchstaben und Ziffern; in Kleinbuchstaben gleich wie der Ordnername |
| `farbe` | `#RRGGBB` |
| `icon` | 1–10 Zeichen |
| `sektionen[].id` | `a-z`, `0-9`, `-`; eindeutig |
| `pfad` | mindestens eine Station; Reihenfolge = Reihenfolge im Lernpfad |
| `pfad[].slug` | `NN-name` (zwei Ziffern, dann Teile aus `a-z0-9`, je mit einem Bindestrich), eindeutig |
| `pfad[].sektion` | muss eine `id` aus `sektionen` sein |
| `pfad[].dauer_min` | ganze Zahl 1–600 |
| `pfad[].vorlesung`, `kurz`, `titel` | nicht leer |

Unbekannte Felder sind ein Fehler (fängt Tippfehler wie `dauer` statt `dauer_min` ab). Schema: `lib/validations/lernseite.ts`.

## Pfad und Stationen

- Der Pfad in `fach.json` ist die einzige Quelle für Reihenfolge, Titel und Sektion. Die HTML-Datei liefert nur den Inhalt.
- Eine Station ohne HTML-Datei ist erlaubt: Sie erscheint im Lernpfad als «folgt» (`verfuegbar: false`) und ihre Adresse ergibt 404.
- `NN` im Slug ist die Nummer der Station. Halte sie gleich wie die Position im Pfad.

Loader (`lib/lernseiten.ts`, nur serverseitig):

| Funktion | Ergebnis |
|----------|----------|
| `ladeFaecher()` | alle Fächer, `anzahlThemen` = Stationen mit HTML-Datei, `anzahlStationen` = alle |
| `ladeFach(fach)` | `{ fach, pfad: [...Station, verfuegbar] }` oder `null` |
| `ladeThemaHtml(fach, slug)` | HTML als Text oder `null` |

`ladeThemaHtml` liest nur Slugs, die im Pfad stehen und die strenge Slug-Regel erfüllen. Andere Eingaben (`../`, Backslash, Endungen, Nullbyte) ergeben `null`, bevor ein Dateipfad entsteht.

## Themenseite: Pflicht-Gerüst

```html
<!doctype html>
<html lang="de-CH">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Laplace und bedingte Wahrscheinlichkeit · MSTW</title>
  <link rel="stylesheet" href="/lernpfad/lernpfad.css">
</head>
<body data-fach="mstw" data-thema="08-laplace-bedingte-wahrscheinlichkeit">
  …
  <script src="/lernpfad/lernpfad.js"></script>
  <script>
    // seiteneigenes Script
  </script>
</body>
</html>
```

- `data-fach` = Fachordner, `data-thema` = Dateiname ohne `.html`.
- `lernpfad.js` steht am Ende von `<body>`, danach das seiteneigene Script.
- Keine externen Ressourcen: kein CDN, keine Google Fonts, keine externen Bilder, Videos oder iframes. Alles kommt aus `/lernpfad/` oder steht in der Seite (Inline-SVG, `data:`-URI). Links (`<a href="https://…">`) auf Quellen sind erlaubt.
- Ausgangspunkt für neue Seiten: `content/lernseiten/mstw/_vorlage.html`.

## Prüfung

`npm run lernseiten:pruefen` prüft alle Fächer. Dieselbe Prüfung läuft im Docker-Build vor `next build`: ein Fehler stoppt die Auslieferung.

**Fehler** (Abbruch):

- `fach.json` fehlt, ist kein gültiges JSON oder verletzt das Schema (inkl. doppelte Slugs, unbekannte Sektion)
- Fachordner mit ungültigem Namen, Kürzel passt nicht zum Ordner, Ordner heisst wie eine App-Seite
- HTML-Datei, deren Name nicht `NN-name.html` ist oder die nicht im Pfad steht
- Pflicht-Gerüst unvollständig: `<!doctype html>`, `lang="de-CH"`, `charset="utf-8"`, viewport, `<title>`, `lernpfad.css`, `lernpfad.js` (am Ende von `<body>`), `data-fach` und `data-thema` passend zum Dateinamen
- externe Ressource in `src`, `href`, `srcset`, `poster` oder `data` von `script`, `link`, `img`, `iframe`, `source`, `video`, `audio`, `embed`, `object`, `track`, `base`, SVG-`image`/`use` sowie `url(…)` und `@import` in CSS

**Hinweise** (kein Abbruch, im Bericht aufgeführt):

- Station ohne HTML-Datei («folgt»)
- Dateien oder Ordner im Fachordner, die nicht ausgeliefert werden

Auskommentierte Teile (`<!-- … -->`) zählen bei der Prüfung nicht. Code: `lib/lernseiten-pruefung.ts`, Tests: `tests/lernseiten.test.ts`.

## Auslieferung

Route-Handler `app/(lernpfad)/lernseiten/[fach]/[thema]/route.ts`:

- Ohne Login: Weiterleitung (307) auf `/login`. Das Login führt danach aufs Dashboard (keine `callbackUrl`).
- Unbekanntes Fach, Station nicht im Pfad oder Datei fehlt: 404 mit einfacher HTML-Seite.
- Sonst die HTML-Datei unverändert, mit diesen Headern:

| Header | Wert |
|--------|------|
| `Content-Type` | `text/html; charset=utf-8` |
| `Cache-Control` | `private, no-cache` |
| `X-Robots-Tag` | `noindex` |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |

Die Dateien `public/lernpfad/*` liefert Next als statische Dateien aus. `content/` kopiert das Dockerfile ins Image.

## Fortschritts-API

Alle Aufrufe brauchen ein Login, sonst `401 {"error": "Nicht autorisiert."}`.

**Lesen:** `GET /api/lernfortschritt?fach=mstw`

```json
[
  {
    "thema": "08-laplace-bedingte-wahrscheinlichkeit",
    "status": "erledigt",
    "quizRichtig": 7,
    "quizGesamt": 8,
    "aktualisiert": "2026-10-28T15:04:05.000Z"
  }
]
```

Nur Einträge des eingeloggten Kontos, sortiert nach Thema. Stationen ohne Eintrag fehlen in der Liste.

**Schreiben:** `POST /api/lernfortschritt`

```json
{ "fach": "mstw", "thema": "08-laplace-bedingte-wahrscheinlichkeit", "status": "erledigt", "quizRichtig": 7, "quizGesamt": 8 }
```

Antwort `200 {"ok": true}`. Regeln:

- `fach`: `^[a-z0-9]+$`; `thema`: `^\d{2}-[a-z0-9-]+$` und muss im Pfad des Fachs stehen, sonst `400`.
- `status`: `"begonnen"` oder `"erledigt"`.
- `quizRichtig`, `quizGesamt`: ganze Zahlen 0–1000, nur zusammen, `quizRichtig ≤ quizGesamt`. Weglassen (oder beide `null`) heisst: kein Quiz-Ergebnis.
- «erledigt» wird nie auf «begonnen» zurückgestuft.
- Ein neues Quiz-Ergebnis ersetzt das alte. Ohne Quiz-Werte bleibt das gespeicherte stehen.
- Jeder Aufruf setzt `aktualisiert` neu.

Validierung: `lib/validations/lernfortschritt.ts`, Tests: `tests/lernfortschritt.test.ts`.

**Datenbank:** Modell `Lernfortschritt` (eine Zeile pro Konto, Fach und Thema; `@@unique([userId, fach, thema])`, Löschen des Kontos löscht den Fortschritt). Migration `prisma/migrations/20261028160000_add_lernfortschritt/`.

## Vorschau ohne App

```
node scripts/lernpfad-vorschau.mjs --port 4400
```

Liefert `/lernpfad/*` und `/lernseiten/mstw/<slug>` ohne Login aus, die Fortschritts-API als Attrappe. Details in `docs/lernpfad-baukasten.md`.

## Urheberrecht

Die Fächer sind für alle eingeloggten Konten sichtbar und das Repo ist öffentlich. Deshalb: keine Folien-Screenshots, keine Logos, keine wörtlichen Folientexte ausser kurzer Aufgabenstellungen und Formeln. Definitionen in eigenen Worten mit Verweis auf die Nummer («Def. 4.5c»). Prüfungsaufgaben im Prüfungstraining sind eigene Aufgaben im Stil der Modulschlussprüfung, keine Kopien alter Prüfungen.
