# Lernpfad — Format und Auslieferung

Ein Lernpfad führt durch ein Studienfach (bisher MSTW und AVSW), Station für Station bis zur Modulschlussprüfung. Jede Station ist **eine fertige HTML-Datei**. Die App liefert sie hinter dem Login aus und speichert den Fortschritt pro Konto.

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

- Fachordner: nur `a-z` und `0-9`. Er darf nicht wie eine App-Seite (`chat`, `decks`, `api` …) oder ein Eintrag auf oberster Ebene von `public/` (`lernpfad`) heissen, auch `_next` ist reserviert. Sonst verdeckt der Kurzlink `/<fach>/…` diese Adressen.
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
  <script>(function(){try{var w=window.localStorage.getItem("lernpfad-theme"),r=document.documentElement;if(w==="hell")r.setAttribute("data-theme","light");else if(w==="dunkel")r.setAttribute("data-theme","dark");}catch(e){}})();</script>
  <link rel="stylesheet" href="/lernpfad/lernpfad.css">
  <link rel="next" href="/lernseiten/mstw/09-kombinatorik" title="Kombinatorik">
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
- Theme-Startskript im `<head>` (Zeile unverändert aus `_vorlage.html` übernehmen): setzt das gespeicherte Farbschema (`localStorage` «lernpfad-theme», Werte `hell`/`dunkel`) als `html[data-theme]`, bevor die Seite gezeichnet wird. Ohne das Script flackert der Dunkelmodus beim Laden. Gesperrter Speicher bricht nichts (try/catch).
- `<link rel="next">`: nächste Station laut `pfad` in `fach.json`, `href="/lernseiten/<fach>/<slug>"`, `title` = deren Titel. Bei der letzten Station weglassen.
- `lernpfad.js` steht am Ende von `<body>`, danach das seiteneigene Script.
- Keine externen Ressourcen: kein CDN, keine Google Fonts, keine externen Bilder, Videos oder iframes. Alles kommt aus `/lernpfad/` oder steht in der Seite (Inline-SVG, `data:`-URI). Links (`<a href="https://…">`) auf Quellen sind erlaubt.
- Ausgangspunkt für neue Seiten: `content/lernseiten/mstw/_vorlage.html`.

## Prüfung

`npm run lernseiten:pruefen` prüft alle Fächer. Dieselbe Prüfung läuft im Docker-Build vor `next build`: ein Fehler stoppt die Auslieferung.

**Fehler** (Abbruch):

- `fach.json` fehlt, ist kein gültiges JSON oder verletzt das Schema (inkl. doppelte Slugs, unbekannte Sektion)
- Fachordner mit ungültigem Namen, Kürzel passt nicht zum Ordner, Ordner heisst wie eine App-Seite, ein Eintrag in `public/` oder `_next`
- HTML-Datei, deren Name nicht `NN-name.html` ist oder die nicht im Pfad steht
- Pflicht-Gerüst unvollständig: `<!doctype html>`, `lang="de-CH"`, `charset="utf-8"`, viewport, `<title>`, Theme-Startskript im `<head>` (Inline-Script mit «lernpfad-theme» und `data-theme`), `lernpfad.css`, `lernpfad.js` (am Ende von `<body>`), `data-fach` und `data-thema` passend zum Dateinamen
- `<link rel="next">` passt nicht zum Pfad: fehlt, steht mehrfach, `href` zeigt nicht auf die nächste Station oder `title` ist nicht deren Titel; bei der letzten Station steht einer (auch einer zum Lernpfad)
- externe Ressource in `src`, `href`, `srcset`, `poster` oder `data` von `script`, `link`, `img`, `iframe`, `source`, `video`, `audio`, `embed`, `object`, `track`, `base`, SVG-`image`/`use` sowie `url(…)` und `@import` in CSS
- externe Adresse (`https://…`, `wss://…`, `//host…`) in einem Inline-Script als Argument von `fetch`, `import`/`from`, `.src =`, `src:`, `setAttribute("src"|"srcset"|"poster"|"data"|"xlink:href", …)`, `new Worker`/`WebSocket`/`EventSource`/`Audio`, `XMLHttpRequest.open`, `sendBeacon`, `importScripts` oder in `url(…)`. Kommentare im Script zählen nicht. Nicht gemeldet werden Adressen in gewöhnlichem Text, Links (`href`) und Namensräume wie `createElementNS("http://www.w3.org/2000/svg", …)`.

**Hinweise** (kein Abbruch, im Bericht aufgeführt):

- Station ohne HTML-Datei («folgt»)
- Dateien oder Ordner im Fachordner, die nicht ausgeliefert werden

Auskommentierte Teile (`<!-- … -->`) zählen bei der Prüfung nicht. Code: `lib/lernseiten-pruefung.ts`, Tests: `tests/lernseiten.test.ts`.

**Zusatz Lernpfad PS:** Weitere Dateien aus `/lernpfad/` sind erlaubt (sie sind keine externen Ressourcen), z. B. `<link rel="stylesheet" href="/lernpfad/ps-konsole.css">` nach `lernpfad.css` und `<script src="/lernpfad/ps-konsole.js"></script>` nach `lernpfad.js`. `lernpfad.css` und `lernpfad.js` bleiben Pflicht. Steht `ps-konsole.js` vor `lernpfad.js` oder `ps-konsole.css` vor `lernpfad.css`, ist das ein Fehler. Details: `docs/lernpfad-powershell.md`.

**Zusatz Lernpfad AVSW:** Ebenso `<link rel="stylesheet" href="/lernpfad/architektur.css">` nach `lernpfad.css` und `<script src="/lernpfad/architektur.js"></script>` nach `lernpfad.js` (Architektur-Engine). Die falsche Reihenfolge ist ein Fehler. Details: `docs/lernpfad-architektur.md`.

## Auslieferung

Route-Handler `app/(lernpfad)/lernseiten/[fach]/[thema]/route.ts`:

- Ohne Login: Weiterleitung (307) auf `/login`. Das Login führt danach aufs Dashboard (keine `callbackUrl`).
- Unbekanntes Fach, Station nicht im Pfad oder Datei fehlt: 404 mit einfacher HTML-Seite.
- Sonst die HTML-Datei unverändert, mit diesen Headern:

| Header | Wert |
|--------|------|
| `Content-Type` | `text/html; charset=utf-8` |
| `Cache-Control` | `private, no-store` |
| `Content-Security-Policy` | `default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'` |
| `X-Robots-Tag` | `noindex` |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |

- `no-store`: Lerninhalte hinter dem Login landen nicht im Browser-Cache, auch nicht nach dem Abmelden oder auf geteilten Geräten.
- CSP: Alles kommt von derselben Origin (Baukasten und KaTeX aus `/lernpfad/`, Schriften, Fortschritts-API). `'unsafe-inline'` ist nötig für das Theme-Startskript, die seiteneigenen Scripts und `<style>`-Blöcke sowie die Inline-Styles von KaTeX. `data:` für Bilder erlaubt Inline-Grafiken als `data:`-URI. Eine Seite, die etwas von einem fremden Server laden will, scheitert im Browser (Fehler in der Konsole), auch wenn die Prüfung es übersehen hätte.
- Die Header gelten auch für die 404- und 500-Seite des Handlers.

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

## Spielstand-API

Bestwerte der Modellierspiele (`Architektur.spiel`, Vertrag `docs/architektur-modell.md` Abschnitt 7 und 8). Die Engine ruft die API selbst auf. Login nötig, sonst `401`; Rate-Limit je Konto 60 Lese- und 60 Schreibanfragen pro Minute, sonst `429` mit `Retry-After: 60`.

**Lesen:** `GET /api/spielstand?fach=avsw`

```json
[{ "spiel": "avsw-02-kommunikation", "level": "l1", "sterne": 2, "xp": 140, "aktualisiert": "2026-11-01T10:04:05.000Z" }]
```

Nur Einträge des eingeloggten Kontos, sortiert nach Spiel und Level. Levels ohne Eintrag fehlen.

**Schreiben:** `POST /api/spielstand`

```json
{ "fach": "avsw", "spiel": "avsw-02-kommunikation", "level": "l1", "sterne": 2, "xp": 140 }
```

Antwort `200 {"ok": true, "verbessert": true, "punkte": 14, "abzeichen": []}`. Regeln:

- `fach`: `^[a-z0-9]+$` und ein bestehender Fachordner unter `content/lernseiten/`, sonst `400`. `spiel`: `^[a-z0-9-]{1,60}$`, `level`: `^[a-z0-9-]{1,40}$`, `sterne`: ganze Zahl 0–3, `xp`: ganze Zahl 0–500.
- Gespeichert wird der **Bestwert**: mehr Sterne, bei gleich vielen Sternen mehr XP. Gleiche oder schlechtere Werte ändern nichts (`verbessert: false`, `aktualisiert` bleibt).
- `punkte` ins Konto (`User.points`) = (neue XP − bisher gespeicherte XP) ÷ 10, abgerundet, nie negativ; ohne bisherigen Stand zählt 0. Mehr Sterne mit weniger XP ergibt 0 Punkte.
- Höchstens 300 verschiedene Levels je Konto und Fach (`409`), damit erfundene Spiel-Namen keine unbegrenzten Punkte bringen.
- `abzeichen`: neu vergebene Abzeichen `{ name, icon, description, points }` (nur nach einer Verbesserung geprüft). Für das Fach `avsw`: «Fehlerfrei» (ein Level mit 3 Sternen), «Architekt·in Bronze/Silber/Gold» (10/25/45 Sterne als Summe der Bestwerte).
- Die Werte kommen vom Browser und sind nicht fälschungssicher (wie Quiz-Ergebnisse); die Obergrenzen begrenzen den Schaden.

Speichern in einer Transaktion: alten Stand lesen, bedingtes Update (nur wenn Sterne und XP noch dem gelesenen Stand entsprechen) bzw. Anlegen, Punkte per `increment`. Bei gleichzeitigen Anfragen läuft die Transaktion neu, jede Verbesserung wird genau einmal vergütet.

Validierung und Bestwert-Regel: `lib/validations/spielstand.ts`, Speichern, Rate-Limit und Abzeichen-Bedingungen: `lib/spielstand.ts`, Tests: `tests/spielstand.test.ts`.

**Datenbank:** Modell `Spielstand` (eine Zeile pro Konto, Fach, Spiel und Level; `@@unique([userId, fach, spiel, level])`, Löschen des Kontos löscht die Spielstände). Migration `prisma/migrations/20261101110000_add_spielstand/` (inkl. der vier Abzeichen).

## Vorschau ohne App

```
node scripts/lernpfad-vorschau.mjs --port 4400
```

Liefert `/lernpfad/*` und `/lernseiten/<fach>/<slug>` (jedes Fach unter `content/lernseiten/`) ohne Login aus, die Fortschritts-API als Attrappe und die Spielstand-API als Attrappe im Speicher (Bestwert wie die App, keine Punkte). Details in `docs/lernpfad-baukasten.md`.

## Urheberrecht

Die Fächer sind für alle eingeloggten Konten sichtbar und das Repo ist öffentlich. Deshalb: keine Folien-Screenshots, keine Logos, keine wörtlichen Folientexte ausser kurzer Aufgabenstellungen und Formeln. Definitionen in eigenen Worten mit Verweis auf die Nummer («Def. 4.5c»). Prüfungsaufgaben im Prüfungstraining sind eigene Aufgaben im Stil der Modulschlussprüfung, keine Kopien alter Prüfungen.
