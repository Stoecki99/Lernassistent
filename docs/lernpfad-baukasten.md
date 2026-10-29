# Lernpfad-Baukasten

Der Baukasten liefert Design und Bausteine für alle Themenseiten des Lernpfads. Jede Themenseite ist **eine fertige HTML-Datei**, die CSS und JavaScript aus `/lernpfad/` lädt. Vorbild für Aussehen und Bedienung ist die Lernseite «Psycho-Logisches» (schmale Lesespalte, Tafeln, Farbcode der Symbole, Lösungsfilm, Selbsttest).

Daten, Dateinamen, Prüfung, Auslieferung und Fortschritts-API regelt `docs/lernpfad-format.md`. Dieses Dokument ist der Vertrag für das Schreiben einer Themenseite.

**Schnellstart:** Kopiere `content/lernseiten/mstw/_vorlage.html` nach `content/lernseiten/mstw/<slug>.html`, passe Kopf und Inhalte an, prüfe in der Vorschau, arbeite die [Prüfliste](#13-prüfliste-vor-der-abgabe) ab.

## Inhalt

1. [Dateien](#1-dateien)
2. [Pflicht-Gerüst](#2-pflicht-gerüst)
3. [Vorschau ohne App](#3-vorschau-ohne-app)
4. [Seitenaufbau](#4-seitenaufbau)
5. [Formeln (KaTeX)](#5-formeln-katex)
6. [Farbcode der Symbole](#6-farbcode-der-symbole)
7. [Design-Tokens](#7-design-tokens)
8. [CSS-Klassen](#8-css-klassen)
9. [JavaScript: window.Lernpfad](#9-javascript-windowlernpfad)
10. [Fortschritt und Abschluss-Box](#10-fortschritt-und-abschluss-box)
11. [Themeneigene Interaktionen](#11-themeneigene-interaktionen)
12. [Barrierefreiheit](#12-barrierefreiheit)
13. [Prüfliste vor der Abgabe](#13-prüfliste-vor-der-abgabe)

## 1. Dateien

| Datei | Zweck |
|-------|-------|
| `public/lernpfad/lernpfad.css` | Design: Tokens hell/dunkel, Layout, alle Klassen. Bindet `fonts.css` ein. |
| `public/lernpfad/lernpfad.js` | Vanilla-JS ohne Abhängigkeiten, globales Objekt `window.Lernpfad` |
| `public/lernpfad/fonts.css`, `fonts/` | Bricolage Grotesque (Titel), Source Sans 3 (Text), STIX Two Text (Formeln), selbst gehostet, SIL Open Font License 1.1 (`fonts/OFL.txt`) |
| `public/lernpfad/katex/` | KaTeX 0.16 (CSS, JS, auto-render, woff2-Schriften), lädt `lernpfad.js` nur bei Bedarf |
| `content/lernseiten/mstw/_vorlage.html` | Muster-Themenseite mit allen Bausteinen (keine Station) |
| `scripts/lernpfad-vorschau.mjs` | Lokaler Vorschau-Server ohne App und Login |

Ändere diese Dateien nicht für eine einzelne Themenseite. Was nur deine Seite braucht, gehört in die Seite (siehe [Abschnitt 11](#11-themeneigene-interaktionen)).

## 2. Pflicht-Gerüst

```html
<!doctype html>
<html lang="de-CH">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Laplace, Ereignisbäume und bedingte Wahrscheinlichkeit · MSTW</title>
  <script>(function(){try{var w=window.localStorage.getItem("lernpfad-theme"),r=document.documentElement;if(w==="hell")r.setAttribute("data-theme","light");else if(w==="dunkel")r.setAttribute("data-theme","dark");}catch(e){}})();</script>
  <link rel="stylesheet" href="/lernpfad/lernpfad.css">
  <link rel="next" href="/lernseiten/mstw/09-kombinatorik" title="Kombinatorik">
  <style>/* optional: nur Klassen mit Themen-Präfix, z. B. .t08-… */</style>
</head>
<body data-fach="mstw" data-thema="08-laplace-bedingte-wahrscheinlichkeit">
<main class="wrap">
  <header class="stack">…</header>
  <nav class="steps" aria-label="Abschnitte">…</nav>
  <section id="…">…</section>
  …
</main>
<script src="/lernpfad/lernpfad.js"></script>
<script>
(function () {
  "use strict";
  const L = window.Lernpfad;
  // Bausteine füllen …
})();
</script>
</body>
</html>
```

Regeln:

- `data-fach` = Fachordner (`mstw`), `data-thema` = Dateiname ohne `.html` (der Slug aus `fach.json`).
- `<title>`: Titel der Station aus `fach.json`, dann ` · MSTW`.
- Theme-Startskript: die `<script>`-Zeile im `<head>` unverändert aus `_vorlage.html` übernehmen. Sie setzt das gespeicherte Farbschema (`html[data-theme]`), bevor die Seite gezeichnet wird; ohne sie flackert der Dunkelmodus beim Laden. Gesperrter Speicher bricht nichts. Die Prüfung verlangt sie.
- `<link rel="next">`: nächste Station laut `pfad` in `fach.json`, `title` = deren Titel. Daraus baut die Abschluss-Box den Knopf «Nächste Station». Bei der letzten Station weglassen. Die Prüfung vergleicht `href` und `title` mit `fach.json`.
- `lernpfad.js` steht am Ende von `<body>`, **danach** das seiteneigene Script. Vorher gibt es `window.Lernpfad` noch nicht.
- Inhalt in `<main class="wrap">`. Kopfleiste (oben) und Abschluss-Box (unten) fügt `lernpfad.js` selbst ein. Schreib sie nicht selbst.
- **Keine externen Ressourcen:** kein CDN, keine Google Fonts, keine externen Bilder, Videos, iframes oder `@import`. Grafiken als Inline-SVG. Links (`<a href="https://…">`) auf Quellen sind erlaubt. `npm run lernseiten:pruefen` bricht sonst ab.
- Keine Folien-Screenshots, keine wörtlichen Folientexte (Urheberrecht, siehe `docs/lernpfad-format.md`).

## 3. Vorschau ohne App

```
node scripts/lernpfad-vorschau.mjs --port 3301
```

| Adresse | Inhalt |
|---------|--------|
| `http://127.0.0.1:3301/` | Liste aller Fächer und Seiten |
| `/lernseiten/mstw/<slug>` | deine Themenseite (auch `_vorlage`) |
| `/lernseiten/mstw` | einfache Stationenliste (Ersatz für die Lernpfad-Seite der App) |
| `/lernpfad/*` | Baukasten-Dateien |
| `/api/lernfortschritt` | Attrappe: GET → `[]`, POST → `{ "ok": true }`. Meldungen erscheinen im Terminal. |

Der Server hört nur auf `127.0.0.1`, braucht nur eingebaute Node-Module und prüft Slugs streng (kein Pfad-Traversal). Wähle bei parallelen Agenten je einen eigenen Port. Beende den Server am Schluss (Ctrl+C).

## 4. Seitenaufbau

Bewährte Reihenfolge (wie Vorbild und Vorlage). Lass weg, was zum Thema nicht passt, aber behalte Selbsttest und «Auf einen Blick».

| Abschnitt | Inhalt | Bausteine |
|-----------|--------|-----------|
| Kopf | `.eyebrow` (MSTW · Vorlesung · Thema), `h1`, `.lead` (2–4 Sätze: worum geht es, was kann ich danach) | – |
| Navigation | `nav.steps` mit einem Link pro `section` (`<a href="#id"><b>1</b>Name</a>`) | lernpfad.js markiert den aktiven Eintrag |
| 0 · Ohne Vorwissen | Grundbegriffe in Konzeptkarten, kurze Übung | `.grid4` + `.concept`, `sortierer` |
| 1 · Wörterbuch | Symbole und Begriffe festlegen | `.symtab` mit `.kind`-Badges, `.note` |
| 2 · Schritt für Schritt | Beispiel von der Aufgabe zur Lösung | `stepper` mit Zuordnung |
| 3 · Formel / Verfahren | Formel auf der Tafel, Fallen, Lösungen | `.board`, `.note.falle`, `details.sol` |
| Ausprobieren | themeneigene Interaktion (Baum, Tafel, Rechner, Diagramm) | Hilfsklassen aus [8.11](#811-hilfsklassen-für-themeneigene-interaktionen) |
| Übungen | selbst rechnen | `zahlAufgabe`, `wahrFalsch`, `schrittAufgabe`, `auswahl` |
| ▶ Lösungsfilm | ganze Prüfungsaufgabe am Stück | `film` (endet mit Link `#test`) |
| ✓ Selbsttest | 6–10 Fragen | `selbsttest` in `<section id="test">` |
| Auf einen Blick | 4–6 Merksätze | `ul.summary.prose`, `footer` |

Jede `section` hat eine `id` (für Navigation und Film-Ende) und beginnt mit `.eyebrow` und `h2`. Fliesstext in `p.prose` (Zeilenlänge max. 66 Zeichen).

Sprache: Schweizer Hochdeutsch (ss statt ß), Du-Form, kurze aktive Sätze, keine Floskeln. Zahlen mit Dezimalpunkt wie auf dem Taschenrechner (`0.25`), Prozent mit Leerschlag (`25 %`).

## 5. Formeln (KaTeX)

`lernpfad.js` setzt Formeln automatisch, sobald die Seite Formeltext enthält, und lädt KaTeX dafür selbst nach.

| Schreibweise | Ergebnis |
|--------------|----------|
| `$P(A)$` oder `\(P(A)\)` | Formel im Text |
| `$$P(A) = \frac{|A|}{|\Omega|}$$` oder `\[ … \]` | abgesetzte Formel (scrollt bei Bedarf in sich) |

**Im HTML** schreibst du LaTeX direkt: `<p>Es gilt \(P(\bar A) = 1 - P(A)\).</p>`

**In JavaScript-Strings** muss jeder Backslash verdoppelt werden (`"$\\frac{1}{2}$"`). Einfacher mit `String.raw`:

```js
const T = String.raw;
T`$\frac{1}{2}$`            // ergibt $\frac{1}{2}$
T`$\{2, 4, 6\}$`            // Mengenklammern
```

Achtung bei `String.raw`: nie `${` schreiben, das ist Interpolation. Mengenklammern immer als `\{ … \}`.

**Nach dynamischem Inhalt** (eigenes Script ändert `innerHTML`): `Lernpfad.formeln(element)` aufrufen. Die Bausteine machen das selbst.

**Farbcode und Verknüpfungen in Formeln:**

| Befehl | Wirkung |
|--------|---------|
| `\htmlClass{v}{x}` | Symbol im Farbcode (Klassen aus [Abschnitt 6](#6-farbcode-der-symbole)) |
| `\htmlData{link=s1-x}{x}` | Formelteil mit `data-link="s1-x"`, leuchtet zusammen mit dem Satzteil auf |

**Makros:** `\N`, `\Z`, `\Q`, `\R` (Zahlenmengen), `\E`, `\Var`, `\Cov` (Operatoren). Eigene Makros: `Lernpfad.makros["\\Bin"] = "\\operatorname{Bin}"` vor der ersten Formel im seiteneigenen Script.

**Regeln:**

- Lange Formeln als abgesetzte Formel (`$$…$$`) oder auf eine `.board`-Tafel setzen. Zu breite Inline-Formeln markiert `lernpfad.js` mit `.katex-breit`; sie scrollen dann in sich, statt die Seite zu verbreitern. Das ist ein Notbehelf, kein Stil.
- Dollarzeichen als Text: Element mit Klasse `keine-formel` versehen (oder «CHF» schreiben).
- Formeln in `script`, `style`, `textarea`, `pre`, `code`, `option`, `select` werden nicht gesetzt.
- Statt KaTeX darfst du für Logik-Formeln auch HTML mit Farbcode schreiben wie im Vorbild: `<span class="m"><span class="p">Q</span>(<span class="v">x</span>)</span>`.

## 6. Farbcode der Symbole

| Klasse | Art | Token | Beispiel |
|--------|-----|-------|----------|
| `.v` | Variable | `--var` (blau, kursiv) | `<span class="v">x</span>` |
| `.c` | Konstante | `--const` (orange, kursiv) | `<span class="c">a</span>` |
| `.fn` | Funktion | `--fn` (grün, kursiv) | `<span class="fn">f</span>(<span class="v">x</span>)` |
| `.p` | Prädikat | `--pred` (violett, kursiv) | `<span class="p">P</span>(<span class="v">x</span>, <span class="v">y</span>)` |
| `.q` | Quantor | Textfarbe, halbfett | `<span class="q">∀</span>` |
| `.op` | Operator, Junktor | Textfarbe, mit Abstand | `<span class="op">∧</span>` |

`.m` setzt Formeln in STIX Two Text (1.3rem). Art-Badges in der Symboltabelle: `<span class="kind kind-v">Variable</span>`, analog `kind-c`, `kind-fn`, `kind-p`, `kind-q`, `kind-op`.

Für Statistik-Seiten gilt der Farbcode sinngemäss: Zufallsvariable oder Unbekannte = Variable, feste Zahl oder Parameter = Konstante, $P$, $E$, $F$, $\varphi$ = Funktion, Aussage oder Hypothese = Prädikat. Nutze ihn sparsam und immer gleich.

Die Klassen `.v`, `.c`, `.fn`, `.p`, `.q`, `.op` sind für den Farbcode reserviert. Verwende sie für nichts anderes.

## 7. Design-Tokens

Alle Farben kommen aus Tokens auf `:root`. Hell und dunkel setzt `lernpfad.css` selbst (Systemeinstellung oder Umschalter in der Kopfleiste, `html[data-theme="light|dark"]`). **Verwende in eigenem CSS und SVG nur diese Tokens, nie feste Farben**, sonst bricht der Dunkelmodus.

| Token | Zweck |
|-------|-------|
| `--bg` | Seitenhintergrund |
| `--surface` | Karten, Knöpfe |
| `--board` | Tafeln, Film-Kopf |
| `--ink` | Text |
| `--muted` | Nebentext, Achsen |
| `--line` | Rahmen, Trennlinien, Gitter |
| `--accent`, `--accent-soft` | Akzent (Links, primäre Knöpfe), heller Akzent-Hintergrund |
| `--var`, `--const`, `--fn`, `--pred` | Farbcode der Symbole |
| `--lit` | Hervorhebung (gelb) |
| `--free`, `--free-bg` | «frei» (Logik), Warnton |
| `--ok`, `--ok-bg` | richtig |
| `--bad`, `--bad-bg` | falsch, Fallen |
| `--s1` … `--s5` | Reihenfarben für Diagramme (blau, orange, grün, violett, Akzent) |
| `--f-display`, `--f-body`, `--f-math` | Schriften: Titel, Text, Formeln |

## 8. CSS-Klassen

### 8.1 Layout und Text

| Klasse | Zweck |
|--------|-------|
| `.wrap` | Lesespalte (max. 860 px), auf `<main>` |
| `.stack` | Spalte mit 14 px Abstand |
| `.row` | Zeile mit Umbruch (Knöpfe nebeneinander) |
| `.grid2`, `.grid4` | Raster mit 2 bzw. bis zu 4 Spalten, bricht auf schmalen Schirmen um |
| `.eyebrow` | kleine Überzeile in Grossbuchstaben, Akzentfarbe |
| `.lead` | Einleitung unter `h1` |
| `.prose` | Fliesstext mit begrenzter Zeilenlänge |
| `.hint` | kleiner grauer Hinweistext |
| `.tablebox` | Behälter, der breite Tabellen seitlich scrollt |
| `.sr-only` | nur für Screenreader sichtbar |
| `.summary` | Liste «Auf einen Blick» |
| `nav.steps` | Abschnitts-Navigation, klebt oben; `a.aktiv` setzt lernpfad.js |

### 8.2 Flächen

| Klasse | Zweck |
|--------|-------|
| `.board` | Tafel für Formeln (scrollt seitlich) |
| `.card` | Karte mit Rahmen |
| `.note` | Hinweisbox (Merke). `<b>` am Anfang in Akzentfarbe |
| `.note.tipp` | Tipp (grün) |
| `.note.falle` | Falle, typischer Fehler (rot) |
| `details.sol` | Lösungs-Aufklapper: `<details class="sol"><summary>Frage</summary><div class="stack">…</div></details>` |

### 8.3 Knöpfe

| Klasse | Zweck |
|--------|-------|
| `.btn` | Knopf (auch für `<a>` und `<select>`) |
| `.btn.primary` | Hauptaktion |
| `.btn.on` | gewählter Zustand (z. B. Ansicht). Setze zusätzlich `aria-pressed="true"` |

### 8.4 Konzeptkarten

`.grid4 > .concept` mit `.tag` (Überschrift), `.ex` (Beispiel in Formelschrift) und `p` (Erklärung).

### 8.5 Symboltabelle

`table.symtab` (erste Spalte in Formelschrift), Art-Badges `.kind .kind-v|c|fn|p|q|op`. In `.card.tablebox` legen.

### 8.6 Satzkarten, Formeln zusammensetzen, Ansichten

| Klasse | Zweck |
|--------|-------|
| `.sentence` | Satz in der Satzkarte; `[data-link]` darin wird gepunktet unterstrichen |
| `.ph` | Satzteil manuell unterstreichen |
| `.stepbar`, `.stepcount` | Kopfzeile mit «Schritt 2 von 5» |
| `.explain` | Erklärung mit Akzentstrich links |
| `.formula` | Formelzeile im Stepper |
| `[data-link]`, `.lit` | verknüpfte Teile, aktuell hervorgehoben |
| `.piece`, `.piece.hidden` | Formelteil, der eingeblendet wird |
| `.brk`, `.nobrk` | Klammern, die sich ein- und ausblenden lassen |
| `.modes` | Gruppe von Ansichts-Knöpfen (`.btn` + `.on`) |
| `.legend` | Legende; `<span style="--sw:var(--fn)">…</span>` zeigt ein Farbfeld |
| `.info` | Infofeld mit Mindesthöhe (mit `aria-live="polite"`) |
| `.sel` | markierter Formelteil |
| `.sublist`, `.subbtn`, `.fv` | Auswahlliste von Teilformeln mit Zusatzinfo rechts |
| `.hl-term`, `.hl-free`, `.dimv`, `.strike` | Hervorhebungen im Film und in Analysen: Term, frei, blass, gestrichen |

### 8.7 Selbsttest und Einzelfrage

`.qcard`, `.qopts`, `.qopt` (`.right`, `.wrong`), `.qex` (Erklärung), `.score`. Erzeugt von `selbsttest` und `auswahl`.

### 8.8 Lösungsfilm

`.film`, `.film-top`, `.phase` (`.past`, `.cur`), `.stage`, `.slabel`, `.sents` (`.ph-on`), `.dict`, `.chip` (`.new`, `.use`), `.fstage`, `.say`, `.tbar`, `.film-ctl`, `.prog`. Erzeugt von `film`. In Szenen-Formeln selbst nutzbar: `.nw` (neu, leuchtet kurz gelb), `.hl-term`, `.hl-free`, `.dimv`, `.strike`.

### 8.9 Übungsbausteine

| Klasse | Zweck |
|--------|-------|
| `.uebung-kopf` | Kopf mit Überzeile und Titel |
| `.rueckmeldung` (`.ok`, `.bad`, `.leer`) | Rückmeldung nach «Prüfen» |
| `.zahl-feld`, `.einheit` | Zahleneingabe, Einheit dahinter |
| `.tipps`, `.loesungsweg` | aufgedeckte Tipps und Lösungsschritte |
| `.wf`, `.wf-zeile`, `.wf-wahl`, `.kreuz`, `.wf-erkl` | Wahr/Falsch mit Kreuzen |
| `.sa-schritte`, `.sa-inhalt` | aufgedeckte Schritte der Schritt-Aufgabe |
| `.marke` | ✓ / ✗ vor einer Rückmeldung |

### 8.10 Abschluss-Box

`section.abschluss`, `.abschluss-stand`, `.status.offen|begonnen|erledigt`, `.abschluss-fb`. Erzeugt von `lernpfad.js`.

### 8.11 Hilfsklassen für themeneigene Interaktionen

**Baumdiagramm** als verschachtelte Liste (passt auf 320 px):

```html
<ul class="baum">
  <li><span class="baum-knoten">Start</span>
    <ul>
      <li class="an"><span class="baum-knoten">A <span class="baum-p">0.3</span></span>
        <ul><li><span class="baum-knoten">B <span class="baum-p">0.8</span> <span class="baum-ende">0.24</span></span></li></ul>
      </li>
      <li><span class="baum-knoten">Ā <span class="baum-p">0.7</span></span></li>
    </ul>
  </li>
</ul>
```

`.an` auf einem `li` hebt Knoten und Ast hervor (Pfad nachfahren).

**Vierfeldertafel / Kontingenztafel:** `table.vierfelder` in `.tablebox`, Kopf in `th`, Randsummen mit `.summe`, Feld hervorheben mit `.an`, leeres Feld `.leer`. Eingabefelder `input.vf-feld` (`.richtig`, `.falsch`).

**Wahrheitstabelle:** `table.wahrheitstabelle`, Ergebnisspalte `.erg`, Werte `.w` (wahr) und `.f` (falsch), Zeile hervorheben `tr.an`. Knöpfe in Zellen sind vorgestylt (zum Umschalten von w/f).

**Zahlentabelle:** `table.tabelle` (Wertetabellen, Verteilungen, Testschema), Zahlen rechtsbündig mit `.zahl`, Zeile hervorheben `tr.an`, `caption` als Beschriftung.

**Rechner mit Schieberegler:**

```html
<div class="card rechner">
  <div class="regler">
    <label for="t12-mu">Mittelwert μ</label>
    <input type="range" id="t12-mu" min="-3" max="3" step="0.1" value="0">
    <output for="t12-mu" id="t12-mu-wert">0</output>
  </div>
  <div class="rechner-ergebnis" id="t12-ergebnis" aria-live="polite"></div>
</div>
```

**SVG-Diagramm:** `<figure class="diagramm"><svg viewBox="…" role="img" aria-labelledby="…"><title id="…">…</title>…</svg><figcaption>…</figcaption></figure>`. Farben nur über Klassen:

| Klasse | Element |
|--------|---------|
| `.achse` | Achsenlinien |
| `.gitter` | Hilfslinien |
| `.kurve` | Linie in Reihenfarbe (`stroke: currentColor`) |
| `.flaeche` | gefüllte Fläche, halbtransparent (z. B. Wahrscheinlichkeit unter der Dichte) |
| `.balken` | Balken |
| `.punkt` | Datenpunkt |
| `.markierung` | gestrichelte Markierung (Grenze, Quantil, kritischer Wert) |
| `text`, `.beschriftung` | Beschriftung (grau, 12 px) |
| `.s1` … `.s5` | Reihenfarbe auf einem Element oder einer Gruppe `<g class="s2">` |
| `.an` | hervorgehoben (Akzentfarbe) |

Keine `fill="#…"`- oder `stroke="#…"`-Attribute. Wähle einen `viewBox` um 320 Einheiten Breite, dann bleibt die Schrift auf dem Handy lesbar.

## 9. JavaScript: window.Lernpfad

Alle Bausteine nehmen als erstes Argument ein Element oder einen CSS-Selektor (`"#id"`), leeren es und füllen es neu. Sie funktionieren mehrfach pro Seite. Texte in Konfigurationen sind HTML und dürfen Formeln enthalten. Fehlerhafte Konfiguration meldet `[Lernpfad] …` in der Konsole und gibt `null` zurück, die Seite läuft weiter.

### 9.1 Automatisch beim Laden

Ohne Aufruf, sobald das DOM bereit ist:

- Kopfleiste oben einfügen: «← Lernpfad MSTW» nach `/lernseiten/<fach>`, Umschalter Hell / Dunkel / Auto (gespeichert in `localStorage`, funktioniert auch bei gesperrtem Speicher). Das gespeicherte Schema setzt schon das Theme-Startskript im `<head>`, `lernpfad.js` übernimmt es.
- Aktiven Abschnitt in `nav.steps` markieren (`.aktiv`, `aria-current`).
- Formeln setzen, alle `[data-link]` verknüpfen.
- Fortschritt «begonnen» melden (ausser schon erledigt).
- Abschluss-Box am Ende von `.wrap` einfügen. Ausschalten mit `<body data-abschluss="aus">` (nur für Sonderseiten).

### 9.2 `Lernpfad.formeln(root)`

Setzt alle Formeln in `root` (Standard: ganze Seite), verknüpft `[data-link]` und prüft die Breite. Gibt ein Promise zurück (`true`, wenn KaTeX lief). Aufrufen, nachdem eigenes Script Inhalt mit Formeln eingefügt hat.

```js
el.innerHTML = String.raw`$\bar x = ` + mittel + "$";
Lernpfad.formeln(el);
```

### 9.3 `Lernpfad.verknuepfen(root)`

Aktiviert Verknüpfungen: Alle Elemente mit gleichem `data-link` im selben Bereich leuchten zusammen auf (Hover, Fokus, Antippen). Bereich = nächstes Element mit `data-link-bereich`, sonst die `section`. `tabindex="0"` bekommen nur Elemente, die ein Gegenstück haben und nicht in `aria-hidden="true"` liegen. Formelteile aus `\htmlData{link=…}` setzt KaTeX in den versteckten Teil (`.katex-html`): Sie bekommen keinen Tabstopp, leuchten aber bei Hover und Antippen und wenn ihr Gegenstück im Text den Fokus hat. Verknüpfe darum jedes Formelteil mit einem Gegenstück im Text. `formeln()` ruft das selbst auf.

```html
<div data-link-bereich>
  <p>Der <span data-link="mu">Erwartungswert</span> ist …</p>
  <div class="board">\(\htmlData{link=mu}{\mu} = 3.5\)</div>
</div>
```

### 9.4 `Lernpfad.sortierer(el, cfg)`

Elemente einer von mehreren Kategorien zuordnen, mit Sofort-Rückmeldung und Stand.

| Feld | Typ | Pflicht | Bedeutung |
|------|-----|---------|-----------|
| `frage` | HTML | nein | Überschrift (`h3`) |
| `kategorien` | Text[] | ja | Knopfbeschriftungen, z. B. `["Ding", "Aussage"]` |
| `elemente` | Objekt[] | ja | `{ html, kategorie, erklaerung }`; `kategorie` = Name aus `kategorien` oder Index ab 0 |

Rückgabe: `{ zuruecksetzen() }`.

```js
Lernpfad.sortierer("#sortierer", {
  kategorien: ["Ding", "Aussage"],
  elemente: [
    { html: '<span class="m"><span class="v">x</span></span>', kategorie: "Ding", erklaerung: "x ist eine Variable." },
    { html: '<span class="m"><span class="p">Q</span>(<span class="v">x</span>)</span>', kategorie: "Aussage", erklaerung: "Q(x) ist wahr oder falsch." }
  ]
});
```

### 9.5 `Lernpfad.stepper(el, cfg)`

Satzkarte: Text oben, Formel Schritt für Schritt, Erklärung «warum», Knöpfe Zurück / Weiter / Ganze Lösung. Zuordnung Text ↔ Formel über gleiche `data-link`-Werte im `text` und in `html` (HTML-Span oder `\htmlData{link=…}{…}`).

| Feld | Typ | Pflicht | Bedeutung |
|------|-----|---------|-----------|
| `titel` | HTML | nein | z. B. «Satz 1» |
| `text` | HTML | nein | Satz oder Aufgabe mit `<span data-link="…">` |
| `schritte` | Objekt[] | ja | `{ html, warum }`: Formelstand nach dem Schritt, Begründung |

Rückgabe: `{ gehe(n) }` (Schritt ab 0).

```js
const T = String.raw;
Lernpfad.stepper("#satz-1", {
  titel: "Satz 1",
  text: 'Manche <span data-link="x">Studenten</span> <span data-link="Q">verstehen die Aufgaben</span>.',
  schritte: [
    { html: '<span class="v" data-link="x">x</span>', warum: "Platzhalter für einen Studenten." },
    { html: T`$\htmlData{link=Q}{Q}(\htmlData{link=x}{x})$`, warum: "Die Eigenschaft wird zum Prädikat Q." }
  ]
});
```

### 9.6 `Lernpfad.film(el, cfg)`

Lösungsfilm mit genau der Semantik des Vorbilds.

| Feld | Typ | Pflicht | Bedeutung |
|------|-----|---------|-----------|
| `phasen` | Text[] | nein | Phasen-Leiste oben (leer: ausgeblendet) |
| `texte` | HTML[] | nein | Sätze oder Aufgabentext; Teile mit `<span data-ph="name">` (leer: Bereich ausgeblendet) |
| `woerterbuch` | HTML[] | nein | Wörterbuch-Chips in Reihenfolge (leer: Bereich ausgeblendet) |
| `szenen` | Objekt[] | ja | siehe unten |
| `beschriftung` | Objekt | nein | `{ texte: "Die Sätze", text: "Satz", woerterbuch: "Wörterbuch", formel: "Formel", ende: "Weiter zum Selbsttest" }` überschreiben |
| `selbsttest` | Text | nein | Ziel des Ende-Links, Standard `"#test"`; `""` = kein Link |

Felder einer Szene:

| Feld | Bedeutung | erbt? |
|------|-----------|-------|
| `ph` | Index der aktuellen Phase (`-1` = keine) | ja |
| `sent` | `"all"` = alle Texte, Zahl = nur dieser Text, `null` = Textbereich ausblenden | ja |
| `hl` | Liste von `data-ph`-Namen, die gelb leuchten | nein |
| `dict` | Anzahl sichtbarer Wörterbuch-Einträge (neue erscheinen animiert) | ja |
| `dh` | Indizes der Wörterbuch-Einträge, die hervorgehoben werden | nein |
| `f` | Formel-HTML (Neues in `<span class="nw">…</span>`) | ja |
| `say` | Erzähltext (HTML, `aria-live`) | nein |
| `end` | `true`: Ende-Link zum Selbsttest zeigen (sonst bei der letzten Szene) | nein |

Verhalten: Fehlende `ph`, `sent`, `dict`, `f` erben vom Vorgänger (Startwerte `-1`, `"all"`, `0`, `""`). «Abspielen» startet sofort beim ersten Inhaltsschritt (Szene 0 ist die Einleitung). Der Balken zeigt die Restzeit. Dauer pro Szene = max(3.5 s; Zeichen von `say` × 45 ms) / Tempo. Steuerung: Zurück, Abspielen/Pause, Vor, Schieber, Tempo (langsam 0.7, normal 1, schnell 1.5). Am Ende «↺ Nochmals». Rückgabe: `{ abspielen(), pause(), gehe(n) }`.

```js
const T = String.raw, NW = (s) => '<span class="nw">' + s + "</span>";
Lernpfad.film("#film-1", {
  phasen: ["1 · Hypothesen", "2 · Prüfgrösse", "3 · Entscheid"],
  texte: [], woerterbuch: [],               // Statistik-Film ohne Satzvorlage
  beschriftung: { formel: "Rechnung" },
  szenen: [
    { say: "So gehst du bei jedem Test vor …" },
    { ph: 0, f: NW(T`$H_0: \mu = 500$`), say: "Zuerst die Nullhypothese …" },
    { ph: 1, f: T`$H_0: \mu = 500$` + " &nbsp; " + NW(T`$z = \frac{\bar x - \mu_0}{\sigma / \sqrt n}$`), say: "…" },
    { ph: 2, say: "H0 wird verworfen. Jetzt kannst du dich im Selbsttest prüfen.", end: true }
  ]
});
```

Etwa 15–30 Szenen für eine Prüfungsaufgabe; `say` in ganzen, kurzen Sätzen.

### 9.7 `Lernpfad.selbsttest(el, cfg)`

Alle Fragen sichtbar wie im Vorbild, je eine Antwort, sofort ✓/✗ mit Erklärung, Punktestand und «Neu starten». Sobald alle beantwortet sind, meldet der Baustein das Ergebnis an die Fortschritts-API und die Abschluss-Box zeigt es an.

| Feld | Typ | Pflicht | Bedeutung |
|------|-----|---------|-----------|
| `fragen` | Objekt[] | ja | `{ q, o, a, e }`: Frage (HTML), Optionen (HTML[]), Index der richtigen Option ab 0, Erklärung |

Rückgabe: `{ neuStarten() }`. Pro Seite genau ein Selbsttest in `<section id="test">`.

Ereignis `lernpfad:selbsttest` (bubbelt) mit `detail: { richtig, gesamt, gespeichert, httpStatus }`. Es kommt, sobald die Fortschritts-API geantwortet hat: `gespeichert` ist `true`, wenn das Ergebnis gespeichert ist; `httpStatus` ist der Status der Antwort (`401` = Anmeldung abgelaufen, `0` = keine Antwort, z. B. offline). Die Abschluss-Box reagiert selbst darauf (siehe [Abschnitt 10](#10-fortschritt-und-abschluss-box)).

```js
Lernpfad.selbsttest("#selbsttest", {
  fragen: [
    { q: "Was ist f(x)?", o: ["Ein Term", "Eine Formel", "Ein Quantor"], a: 0, e: "f(x) liefert ein Ding, also einen Term." }
  ]
});
```

### 9.8 `Lernpfad.zahlAufgabe(el, cfg)`

Rechenaufgabe mit Zahleneingabe, Prüfen, Tipps und schrittweisem Lösungsweg.

| Feld | Typ | Pflicht | Bedeutung |
|------|-----|---------|-----------|
| `titel` | HTML | nein | Titel |
| `frage` | HTML | nein | Aufgabenstellung (sag, wie genau gerundet werden soll) |
| `antwort` | Zahl oder Zahl[] | ja | richtiger Wert; Liste = mehrere richtige Werte |
| `toleranz` | Zahl oder `{ relativ }` | nein | absolute Abweichung (z. B. `0.0005`) oder relativ (`{ relativ: 0.01 }` = 1 %). Ohne: exakt |
| `einheit` | Text | nein | z. B. `"CHF"`, `"%"` |
| `anzeige` | Text | nein | Anzeige des genauen Werts in der Rückmeldung, z. B. `"1/6 ≈ 0.1667"` |
| `hinweise` | HTML[] | nein | Tipps, einzeln aufdeckbar |
| `loesungsweg` | HTML[] | nein | Lösungsschritte, einzeln oder ganz aufdeckbar |

Eingabe: Komma oder Punkt, Hochkomma als Tausendertrenner (`1'234.5`), Brüche (`1/6`), Prozent (`16.67%` passt zu 0.1667 und zu 16.67), Minus auch als «−». Rückmeldungen: richtig, knapp daneben, Faktor 100 falsch, falsch. Rückgabe: `{ zuruecksetzen() }`.

```js
Lernpfad.zahlAufgabe("#aufgabe-1", {
  titel: "Augensumme 7",
  frage: "Zwei faire Würfel. Wie gross ist P(Summe = 7)? Auf vier Stellen.",
  antwort: 1 / 6, toleranz: 0.0005, anzeige: "1/6 ≈ 0.1667",
  hinweise: ["Rechne mit geordneten Paaren (i, j)."],
  loesungsweg: [String.raw`$|\Omega| = 36$, $|A| = 6$`, String.raw`$P(A) = \tfrac{6}{36} = \tfrac{1}{6}$`]
});
```

### 9.9 `Lernpfad.wahrFalsch(el, cfg)`

Aussagen mit Kreuzen «wahr» / «falsch» wie in der Prüfung, Knopf «Auswerten», danach pro Zeile ✓/✗ und Erklärung.

| Feld | Typ | Pflicht | Bedeutung |
|------|-----|---------|-----------|
| `titel` | HTML | nein | Titel |
| `aussagen` | Objekt[] | ja | `{ html, wahr, erklaerung }`; `wahr` = `true` oder `false` |

Rückgabe: `{ auswerten(), zuruecksetzen() }`.

```js
Lernpfad.wahrFalsch("#wf-1", {
  titel: "Normalverteilung",
  aussagen: [
    { html: String.raw`$P(Z \le 0) = 0.5$`, wahr: true, erklaerung: "Die Standardnormalverteilung ist symmetrisch um 0." }
  ]
});
```

### 9.10 `Lernpfad.schrittAufgabe(el, cfg)`

Aufgabe zuerst selbst lösen, dann Schritt für Schritt aufdecken (je Schritt eine Tafel und eine Begründung).

| Feld | Typ | Pflicht | Bedeutung |
|------|-----|---------|-----------|
| `titel` | HTML | nein | Titel |
| `aufgabe` | HTML | nein | Aufgabenstellung |
| `schritte` | Objekt[] | ja | `{ html, warum }` |

Rückgabe: `{ alleZeigen(), zuruecksetzen() }`.

```js
Lernpfad.schrittAufgabe("#sa-1", {
  titel: "Mindestens eine 6",
  aufgabe: "<p>Zwei Würfel. Wie gross ist P(mindestens eine 6)?</p>",
  schritte: [
    { html: String.raw`$P(\bar B) = \tfrac{25}{36}$`, warum: "Über das Gegenereignis «keine 6»." },
    { html: String.raw`$P(B) = 1 - \tfrac{25}{36} = \tfrac{11}{36}$`, warum: "Gegenwahrscheinlichkeit." }
  ]
});
```

### 9.11 `Lernpfad.auswahl(el, cfg)`

Einzelne Frage mit Sofort-Rückmeldung und «Nochmals». Gut zwischen Erklärungen.

| Feld | Typ | Pflicht | Bedeutung |
|------|-----|---------|-----------|
| `frage` | HTML | ja | Frage |
| `optionen` | HTML[] | ja | Antworten |
| `richtig` | Zahl | ja | Index der richtigen Antwort ab 0 |
| `erklaerung` | HTML | nein | Erklärung nach der Antwort |

Rückgabe: `{ zuruecksetzen() }`.

```js
Lernpfad.auswahl("#frage-1", {
  frage: "Welcher Test passt zu zwei kategorialen Merkmalen?",
  optionen: ["z-Test", "t-Test", "Chi-Quadrat-Unabhängigkeitstest"],
  richtig: 2,
  erklaerung: "Kontingenztafel → Chi-Quadrat."
});
```

### 9.12 Hilfsfunktionen

| Funktion | Zweck |
|----------|-------|
| `Lernpfad.zahlLesen(text)` | liest «0,25», «1'234.5», «1/4», «−3» als Zahl, sonst `NaN` |
| `Lernpfad.zahlText(wert, stellen)` | Zahl als Text mit Dezimalpunkt, höchstens `stellen` Nachkommastellen (Standard 4), ab 10 000 mit Hochkomma |
| `Lernpfad.makros` | KaTeX-Makros (erweiterbar, siehe [Abschnitt 5](#5-formeln-katex)) |
| `Lernpfad.version` | Version des Baukastens |

## 10. Fortschritt und Abschluss-Box

`fach` und `thema` kommen aus `<body data-fach data-thema>`.

| Funktion | Zweck |
|----------|-------|
| `Lernpfad.fortschritt.laden()` | Promise mit dem Array `[{ thema, status, quizRichtig, quizGesamt, aktualisiert }]` des Fachs; bei Fehlern `[]` |
| `Lernpfad.fortschritt.melden({ status, quizRichtig, quizGesamt })` | Promise `true`/`false`. `status`: `"begonnen"` oder `"erledigt"`. Quiz-Werte nur zusammen. «erledigt» wird nie zurückgestuft. |

Fehler (401, offline, Vorschau) fängt der Baukasten ab, die Seite bricht nie. Du musst in der Regel nichts selbst melden: Laden meldet «begonnen», der Selbsttest meldet sein Ergebnis, die Abschluss-Box meldet «erledigt».

Die Abschluss-Box zeigt den Stand (offen, begonnen, erledigt, Selbsttest-Ergebnis), den Knopf «Thema als erledigt markieren», «← Zurück zum Lernpfad» und, falls `<link rel="next">` gesetzt ist, «Nächste Station: … →».

Scheitert das Speichern, sagt die Box es sichtbar (Meldung in einer Live-Region):

| Fall | Anzeige |
|------|---------|
| Selbsttest-Ergebnis nicht gespeichert | «Selbsttest: x / y richtig · nicht gespeichert» und Knopf «↻ Erneut speichern» (sendet das Ergebnis nochmals) |
| Antwort 401 (Anmeldung abgelaufen) | zusätzlich Link «Neu anmelden (neuer Tab)» auf `/login`. Im neuen Tab bleibt das Ergebnis auf der Seite stehen; nach dem Anmelden «Erneut speichern» klicken. |
| «Erledigt» nicht gespeichert | Fehlermeldung, der Knopf bleibt aktiv; bei 401 ebenfalls «Neu anmelden». Gelingt «erledigt», ist ein offenes Selbsttest-Ergebnis mitgespeichert. |

## 11. Themeneigene Interaktionen

Für Dinge, die der Baukasten nicht hat (Baum zum Durchklicken, Vierfeldertafel zum Ausfüllen, Dichte mit Schieberegler, Testschema), schreibst du eigenes HTML, CSS und JavaScript in die Seite. Regeln:

1. **Script nach `lernpfad.js`**, in einer Funktion gekapselt (`(function () { "use strict"; … })();`), keine globalen Variablen.
2. **Eigene Klassen und IDs mit Themen-Präfix** `t<NN>-` (Stationsnummer), z. B. `.t08-ast`, `#t08-rechner`. Nie Baukasten-Klassen umdefinieren.
3. **Eigenes CSS** in einem `<style>` im `<head>`, nur für Präfix-Klassen.
4. **Nur Farben aus `:root`** (`var(--accent)`, `var(--ok)`, `var(--s2)` …), keine festen Farben, kein `fill="#…"`. Dann funktionieren hell und dunkel ohne Zusatzarbeit.
5. **Zuerst Hilfsklassen nutzen** ([8.11](#811-hilfsklassen-für-themeneigene-interaktionen)): `.baum`, `.vierfelder`, `.wahrheitstabelle`, `.tabelle`, `.rechner`/`.regler`, `.diagramm`.
6. **Nach dynamischem Inhalt** `Lernpfad.formeln(element)` aufrufen (setzt Formeln und Verknüpfungen).
7. **Keine Bibliotheken, keine externen Ressourcen**, kein `fetch` ausser über `Lernpfad.fortschritt`. Kein `localStorage` für Lerninhalte. Die Prüfung meldet externe Adressen in Inline-Scripts (`fetch`, `import`, `.src` …), und die Content-Security-Policy der Themenseiten blockiert fremde Server im Browser.
8. **Breite:** alles muss bei 320 px ohne seitliches Scrollen funktionieren. Breite Tabellen in `.tablebox`, breite Formeln auf `.board`, SVG mit `viewBox` (skaliert mit).
9. **Bewegung:** Animationen nur mit `transition`/`animation` in CSS. `lernpfad.css` schaltet sie bei «Bewegung reduzieren» ab; eigene JS-Animationen prüfen `matchMedia("(prefers-reduced-motion: reduce)")`.
10. **Bedienung:** echte `<button type="button">`, `<input>`, `<label for>`; Zustände mit `aria-pressed` oder `aria-expanded`; Rückmeldungen in einem Element mit `aria-live="polite"`.

Beispiel (aus der Vorlage, gekürzt):

```js
const regler = document.getElementById("t00-n");
const ergebnis = document.getElementById("t00-ergebnis");
function rechnen() {
  const n = Number(regler.value);
  ergebnis.innerHTML = String.raw`$1 - (5/6)^{` + n + String.raw`} \approx ` + Lernpfad.zahlText(1 - Math.pow(5 / 6, n), 4) + "$";
  Lernpfad.formeln(ergebnis);
}
regler.addEventListener("input", rechnen);
rechnen();
```

## 12. Barrierefreiheit

Die Bausteine erfüllen das bereits. Für eigenen Inhalt gilt dasselbe:

- **Echte Knöpfe** (`<button type="button">`), keine klickbaren `div`. Links nur für Navigation.
- **Farbe nie allein:** richtig/falsch immer zusätzlich mit ✓/✗ oder Text, Hervorhebungen zusätzlich mit Rahmen, Unterstreichung oder Beschriftung.
- **Rückmeldungen** in `aria-live="polite"`.
- **Fokus behalten:** Wird ein Knopf deaktiviert oder ausgeblendet, setz den Fokus auf ein sinnvolles Nachbarelement. Ersetze nicht den Knopf, der gerade den Fokus hat.
- **Fokusringe** nicht entfernen (`outline: none` ist verboten).
- **Beschriftungen:** jedes Eingabefeld mit `<label for>`, Symbolknöpfe (◀, ▶) mit `aria-label`, SVG mit `role="img"` und `<title>`.
- **Überschriften** in Reihenfolge: ein `h1`, `h2` pro Abschnitt, `h3` darunter.
- **Sprache:** Fremdsprachige Begriffe sind selten; falls nötig `<span lang="en">p-value</span>`.

## 13. Prüfliste vor der Abgabe

- [ ] Datei heisst `content/lernseiten/mstw/<slug>.html`, Slug wie in `fach.json`.
- [ ] Pflicht-Gerüst vollständig: doctype, `lang="de-CH"`, charset, viewport, `<title>`, Theme-Startskript im `<head>`, `lernpfad.css`, `data-fach="mstw"`, `data-thema="<slug>"`, `lernpfad.js` am Ende von `<body>`, danach das eigene Script.
- [ ] `<link rel="next">` zeigt auf die nächste Station aus `fach.json`, `title` = deren Titel (bei der letzten Station weggelassen).
- [ ] Keine externen Ressourcen, keine Folien-Screenshots, keine wörtlichen Folientexte.
- [ ] `npm run lernseiten:pruefen` meldet für die Seite keine Fehler.
- [ ] Vorschau (`node scripts/lernpfad-vorschau.mjs --port <port>`): keine Fehler in der Konsole, keine `[Lernpfad]`-Meldungen.
- [ ] Alle Formeln gesetzt (kein roher `$…$`-Text, keine roten KaTeX-Fehler).
- [ ] Alle Bausteine durchgeklickt: Sortierer, Stepper (Zuordnung leuchtet), Übungen (richtige und falsche Eingabe), Film läuft bis zum Ende, Selbsttest vollständig beantwortet (Ergebnis in der Abschluss-Box).
- [ ] Hell und dunkel geprüft (Umschalter oben rechts); eigene Elemente gut lesbar.
- [ ] Bei 360 px und 320 px kein seitliches Scrollen, auch mit aufgedeckten Lösungen.
- [ ] Mit der Tastatur bedienbar (Tab, Enter, Leertaste), Fokus immer sichtbar.
- [ ] Eigene Klassen und IDs mit Präfix `t<NN>-`, nur Farben aus `:root`.
- [ ] Fachlich geprüft: jede Zahl nachgerechnet, Lösungen und Quiz-Antworten stimmen, `toleranz` passt zur verlangten Rundung.
- [ ] Texte: Schweizer Hochdeutsch (ss), Du-Form, kurze aktive Sätze.
