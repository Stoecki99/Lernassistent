# Lernpfad-Baukasten

Der Baukasten liefert Design und Bausteine für alle Themenseiten des Lernpfads. Jede Themenseite ist **eine fertige HTML-Datei**, die CSS und JavaScript aus `/lernpfad/` lädt. Vorbild für Aussehen und Bedienung ist die Lernseite «Psycho-Logisches» (schmale Lesespalte, Tafeln, Farbcode der Symbole, Lösungsfilm, Selbsttest).

Daten, Dateinamen, Prüfung, Auslieferung und Fortschritts-API regelt `docs/lernpfad-format.md`. Dieses Dokument ist der Vertrag für das Schreiben einer Themenseite.

**Schnellstart:** Kopiere die Vorlage deines Fachs (`content/lernseiten/mstw/_vorlage.html` oder `content/lernseiten/pmgt/_vorlage.html`) nach `content/lernseiten/<fach>/<slug>.html`, passe Kopf und Inhalte an, prüfe in der Vorschau, arbeite die [Prüfliste](#13-prüfliste-vor-der-abgabe) ab.

## Inhalt

1. [Dateien](#1-dateien)
2. [Pflicht-Gerüst](#2-pflicht-gerüst)
3. [Vorschau ohne App](#3-vorschau-ohne-app)
4. [Seitenaufbau](#4-seitenaufbau)
5. [Formeln (KaTeX)](#5-formeln-katex)
6. [Farbcode der Symbole](#6-farbcode-der-symbole)
7. [Design-Tokens](#7-design-tokens)
8. [CSS-Klassen](#8-css-klassen)
9. [JavaScript: window.Lernpfad](#9-javascript-windowlernpfad) (inkl. `modellieren`, `piktogramm`)
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
| `content/lernseiten/mstw/_vorlage.html` | Muster-Themenseite MSTW mit allen Bausteinen (keine Station) |
| `content/lernseiten/pmgt/_vorlage.html` | Muster-Themenseite PMGT: alle Bausteine plus ICB-Kennzeichen, Matrix, Reflexion, Netzplan und Gantt (keine Station) |
| `scripts/lernpfad-vorschau.mjs` | Lokaler Vorschau-Server ohne App und Login |
| `public/lernpfad/ps-konsole.css`, `ps-konsole.js` | Erweiterung Lernpfad PS: Konsolen-Simulator, Syntaxfärbung, Ausgabeblöcke. Nur für PS-Seiten, Doku in `docs/lernpfad-powershell.md` |
| `content/lernseiten/ps/_vorlage.html` | Muster-Themenseite PS mit Simulator, Code- und Ausgabeblöcken (keine Station) |
| `public/lernpfad/st-spiel.css`, `st-spiel.js` | Spiel-Erweiterung Lernpfad Spieltheorie: Pergament-Grundton, Figuren, Szenen, Spielbrett, Turnier, Spielbaum, Szenario, Lagetisch, Mischer. Nur für Spieltheorie-Seiten, Doku in `docs/lernpfad-spieltheorie.md` |
| `content/lernseiten/spieltheorie/_vorlage.html` | Muster-Themenseite Spieltheorie mit allen Spielbausteinen (keine Station) |

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

- `data-fach` = Fachordner (`mstw`, `pmgt`), `data-thema` = Dateiname ohne `.html` (der Slug aus `fach.json`). `data-fach` bestimmt auch Kopfleiste, Fortschritt und Akzentfarbe ([Abschnitt 7](#7-design-tokens)).
- `<title>`: Titel der Station aus `fach.json`, dann ` · ` und das Kürzel in Grossbuchstaben (` · MSTW`, ` · PMGT`).
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
| `/lernseiten/<fach>/<slug>` | deine Themenseite (auch `_vorlage`), für jedes Fach unter `content/lernseiten/<fach>/` |
| `/lernseiten/<fach>` | einfache Stationenliste (Ersatz für die Lernpfad-Seite der App) |
| `/lernpfad/*` | Baukasten-Dateien |
| `/api/lernfortschritt` | Attrappe: GET → `[]`, POST → `{ "ok": true }`. Meldungen erscheinen im Terminal. |

Der Server hört nur auf `127.0.0.1`, braucht nur eingebaute Node-Module und prüft Slugs streng (kein Pfad-Traversal). Wähle bei parallelen Agenten je einen eigenen Port. Beende den Server am Schluss (Ctrl+C).

## 4. Seitenaufbau

Bewährte Reihenfolge (wie Vorbild und Vorlage). Lass weg, was zum Thema nicht passt, aber behalte Selbsttest und «Auf einen Blick».

| Abschnitt | Inhalt | Bausteine |
|-----------|--------|-----------|
| Kopf | `.eyebrow` (MSTW · Vorlesung · Thema), `h1`, `.lead` (2–4 Sätze: worum geht es, was kann ich danach); bei PMGT zusätzlich ICB-Kennzeichen und Lernziele | `.icb-liste` + `.icb` |
| Navigation | `nav.steps` mit einem Link pro `section` (`<a href="#id"><b>1</b>Name</a>`) | lernpfad.js markiert den aktiven Eintrag |
| 0 · Ohne Vorwissen | Grundbegriffe in Konzeptkarten, kurze Übung | `.grid4` + `.concept`, `sortierer` |
| 1 · Wörterbuch | Symbole und Begriffe festlegen | `.symtab` mit `.kind`-Badges, `.note` |
| 2 · Schritt für Schritt | Beispiel von der Aufgabe zur Lösung | `stepper` mit Zuordnung |
| 3 · Formel / Verfahren | Formel auf der Tafel, Fallen, Lösungen | `.board`, `.note.falle`, `details.sol` |
| Ausprobieren | themeneigene Interaktion (Baum, Tafel, Rechner, Diagramm) | Hilfsklassen aus [8.11](#811-hilfsklassen-für-themeneigene-interaktionen) |
| Übungen | selbst rechnen, einordnen, formulieren | `zahlAufgabe`, `wahrFalsch`, `schrittAufgabe`, `auswahl`, `matrix`, `reflexion` (offene Frage) |
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

**Akzent pro Fach.** `lernpfad.css` setzt `--accent` und `--accent-soft` je Fach über `body[data-fach="…"]`, hell und dunkel. Alles, was den Akzent nutzt (Links, Überzeilen, primäre Knöpfe, Navigation, Fokusringe, `--s5`), wechselt mit. Ohne eigenen Eintrag gilt der Standard (Weinrot, MSTW).

| Fach | Schema | `--accent` | `--accent-soft` | Kontrast Akzent auf `--bg` / `--surface` / `--accent-soft` |
|------|--------|-----------|-----------------|------------------------------------------|
| MSTW (Standard) | hell | `#7a1f5c` | `#f3e3ee` | 8.96 / 9.64 / 7.82 |
| MSTW (Standard) | dunkel | `#e683c0` | `#3a2033` | 7.52 / 6.97 / 5.84 |
| PMGT (Kachel `#FF9600`) | hell | `#a64b00` | `#fdebd6` | 5.38 / 5.79 / 4.97 |
| PMGT | dunkel | `#ff9f40` | `#3d2610` | 9.24 / 8.56 / 6.93 |

Neues Fach: drei Regeln in `lernpfad.css` ergänzen (hell, `prefers-color-scheme: dark` mit `:root:not([data-theme="light"])`, `:root[data-theme="dark"]`), `--s5:var(--accent)` in der hellen Regel mitsetzen und den Kontrast nachrechnen (WCAG, mindestens 4.5:1 auf `--bg` und `--surface`; `.btn.primary` nutzt `--surface` als Schrift auf dem Akzent, also dasselbe Verhältnis).

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

**Netzplan-Knoten** (Vorgangsknoten): oben FA, Vorgang, FE; unten SA, Dauer, SE; darunter optional der Puffer. Die kleinen Beschriftungen kommen aus `data-kurz`. Die Zahlen rechnet die Station selbst; Knoten von Hand oder mit [`Lernpfad.netzplanKnoten`](#914-lernpfadnetzplanknotendaten).

```html
<div class="tablebox">
  <div class="netzplan" style="--np-spalten:3">
    <div class="np-knoten kritisch" style="grid-column:1; grid-row:1" role="group"
         aria-label="Vorgang A Analyse: Dauer 5, FA 0, FE 5, SA 0, SE 5, Gesamtpuffer 0, kritisch">
      <span class="np-fa" data-kurz="FA">0</span><span class="np-vorgang" data-kurz="Vorgang">A Analyse</span><span class="np-fe" data-kurz="FE">5</span>
      <span class="np-sa" data-kurz="SA">0</span><span class="np-dauer" data-kurz="Dauer">5</span><span class="np-se" data-kurz="SE">5</span>
      <span class="np-puffer">GP 0 · FP 0</span>
    </div>
    <span class="np-pfeil" style="grid-column:2; grid-row:1" aria-hidden="true">→</span>
    …
  </div>
</div>
```

| Klasse | Zweck |
|--------|-------|
| `.netzplan` | Raster für Knoten, Spaltenzahl `--np-spalten` (Standard 4), Lage je Knoten per `style="grid-column:…; grid-row:…"`. Ist so breit wie nötig: immer in `.tablebox` legen, dann scrollt er seitlich. |
| `.np-knoten` | Kästchen mit sechs Feldern `.np-fa`, `.np-vorgang`, `.np-fe`, `.np-sa`, `.np-dauer`, `.np-se` (in dieser Reihenfolge) und optional `.np-puffer` |
| `.np-knoten.kritisch` | dicker Rahmen in `--bad` und Marke «kritisch» (nicht nur Farbe) |
| `.np-knoten.an` | hervorgehoben (gelber Schein), z. B. aktueller Rechenschritt |
| `.np-pfeil` | einfacher Pfeil zwischen Knoten (`aria-hidden="true"`; Abhängigkeiten im Text nennen) |

**Gantt-Balken:** eine Zeile pro Vorgang, Balken per CSS-Variablen `--start` (ab 0) und `--dauer` in Zeiteinheiten, Anzahl Einheiten in `--gantt-einheiten`.

```html
<div class="tablebox">
  <div class="gantt" style="--gantt-einheiten:16" role="img" aria-label="Gantt: A Tag 0 bis 5 kritisch, B Tag 5 bis 8 …">
    <div class="gantt-kopf"><span class="gantt-name">Vorgang</span><div class="gantt-skala"><span>0</span>…<span>15</span></div></div>
    <div class="gantt-zeile"><span class="gantt-name">A Analyse</span>
      <div class="gantt-spur"><span class="gantt-balken kritisch" style="--start:0; --dauer:5">5 T</span></div></div>
    <div class="gantt-zeile"><span class="gantt-name">B Konzept</span>
      <div class="gantt-spur"><span class="gantt-balken" style="--start:5; --dauer:3">3 T</span><span class="gantt-puffer" style="--start:8; --dauer:1"></span></div></div>
    <div class="gantt-zeile"><span class="gantt-name">◆ Abnahme</span>
      <div class="gantt-spur"><span class="gantt-meilenstein" style="--start:15"></span></div></div>
  </div>
</div>
```

| Klasse | Zweck |
|--------|-------|
| `.gantt` | Behälter; `--gantt-einheiten` (Standard 10), `--gantt-einheit` (Breite einer Einheit, Standard 2rem), `--gantt-name` (Namensspalte, 7.8rem). Eigene Werte nur in `rem` oder `px` setzen: Eine `em`-Angabe würde je Element mit dessen Schriftgrösse aufgelöst, Skala, Balken und Rauten liefen auseinander. In `.tablebox` legen. |
| `.gantt-kopf`, `.gantt-skala` | Kopfzeile mit Zeitskala (ein `span` je Einheit) |
| `.gantt-zeile`, `.gantt-name`, `.gantt-spur` | Zeile, Name, Spur mit Gitter |
| `.gantt-balken` | Balken (`--start`, `--dauer`); Text darin kurz halten |
| `.gantt-balken.kritisch` | dicker Rahmen in `--bad` und Schraffur (nicht nur Farbe) |
| `.gantt-puffer` | gestrichelter Puffer hinter dem Balken (`--start`, `--dauer`) |
| `.gantt-meilenstein` (`.kritisch`) | Raute an `--start` |
| `.gantt-legende` | Legende; die Klassen oben darin als kleine Muster nutzbar |

Das Diagramm ist eine Grafik: Gib dem `.gantt` `role="img"` und ein `aria-label` mit den Zeiten, oder zeig die Werte zusätzlich in einer Tabelle.

### 8.12 ICB-Kennzeichen

`<span class="icb">ICB 3.04</span>`: kleines Badge in Akzentfarbe für die ICB4-Kompetenz. Im Kopf einer Station mehrere in `.icb-liste` (umbrechend), in Fragen direkt im HTML der Frage (`q`, `frage`). `reflexion` und `matrix` setzen es selbst über das Feld `icb`.

```html
<p class="icb-liste"><span class="sr-only">ICB-Kompetenzen dieser Station:</span>
  <span class="icb">ICB 3.04</span><span class="icb">ICB 3.11</span></p>
```

Schreibweise wie im Konzept: «ICB» plus Bereich und zweistellige Nummer (`ICB 3.04` = Practice, Zeit; `ICB 3.12` = Stakeholder).

### 8.13 Klassen von Reflexion und Matrix

Erzeugt von `reflexion` und `matrix`, nicht von Hand schreiben: `.rf-frage`, `.rf-eingabe`, `.rf-feld`, `.rf-rueckfrage`, `.rf-loesung`, `.rf-muster`, `.rf-raster`, `.rf-kriterien`, `.rf-punkte`, `.rf-summe`, `.rf-ohne`; `.mx-rahmen`, `.mx-achse-x`, `.mx-achse-y`, `.mx-raster`, `.mx-kopf`, `.mx-feld` (`.mx-tief`, `.mx-mittel`, `.mx-hoch`, `.belegt`), `.mx-name`, `.mx-marke` (`.right`, `.wrong`), `.mx-karten`, `.mx-karte`, `.mx-nr`, `.mx-ort`, `.mx-erkl`, `.mx-waehlt`.

### 8.14 Code-Beispiele

`<pre class="code" data-sprache="Dockerfile"><code>…</code></pre>`: Codeblock mit Überschrift aus `data-sprache`, scrollt seitlich in sich. Hervorhebung von Hand, nur mit diesen Klassen: `.k` Schlüsselwort, `.s` Zeichenkette, `.n` Zahl, `.c` Kommentar, `<mark>` für die Stelle, um die es gerade geht. Achtung: Innerhalb von `pre.code` sind `.k`, `.s`, `.n`, `.c` Code-Farben (`.c` hier nicht «Konstante»). `<` und `&` im Code als `&lt;` und `&amp;` schreiben. Inline-Code mit `<code>` (gestaltet nur in AVSW-Seiten, `body[data-fach="avsw"]`, damit bestehende Fächer unverändert bleiben). Formeln werden in `pre` und `code` nicht gesetzt (`$` in Shell-Code ist sicher).

## 9. JavaScript: window.Lernpfad

Alle Bausteine nehmen als erstes Argument ein Element oder einen CSS-Selektor (`"#id"`), leeren es und füllen es neu. Sie funktionieren mehrfach pro Seite. Texte in Konfigurationen sind HTML und dürfen Formeln enthalten. Fehlerhafte Konfiguration meldet `[Lernpfad] …` in der Konsole und gibt `null` zurück, die Seite läuft weiter.

### 9.1 Automatisch beim Laden

Ohne Aufruf, sobald das DOM bereit ist:

- Kopfleiste oben einfügen: «← Lernpfad <FACH>» (Kürzel aus `data-fach` in Grossbuchstaben, z. B. «← Lernpfad PMGT») nach `/lernseiten/<fach>`, Umschalter Hell / Dunkel / Auto (gespeichert in `localStorage`, funktioniert auch bei gesperrtem Speicher). Das gespeicherte Schema setzt schon das Theme-Startskript im `<head>`, `lernpfad.js` übernimmt es.
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

### 9.12 `Lernpfad.reflexion(el, cfg)`

Offene Frage im IPMA-Stil: Antwort selbst schreiben, dann Musterlösung ansehen und sich nach einem Raster selbst bewerten. Die Antwort bleibt auf der Seite: kein `localStorage`, keine Übermittlung an den Server, keine Meldung an den Fortschritt.

| Feld | Typ | Pflicht | Bedeutung |
|------|-----|---------|-----------|
| `titel` | HTML | nein | Titel |
| `icb` | Text oder Text[] | nein | ICB-Kennzeichen im Kopf, z. B. `"ICB 3.04"` |
| `frage` | HTML | ja | Fragestellung |
| `musterloesung` | HTML | ja | Musterlösung (mehrere `<p>` möglich) |
| `kriterien` | Objekt[] | nein | Bewertungsraster `{ text, punkte }`; `punkte` ganze Zahl ≥ 0, Standard 1. Ohne: kein Raster |
| `hinweis` | HTML | nein | ersetzt den Standard-Hinweis über dem Textfeld |

Ablauf: Textfeld mit `label`. «Musterlösung zeigen» zeigt die Lösung, wenn etwas geschrieben ist; sonst fragt eine Rückfrage «Ohne Antwort ansehen» oder «Zuerst schreiben» (Fokus zurück ins Textfeld). Danach Musterlösung (Fokus springt darauf), Raster mit Kästchen je Kriterium und «x von y Punkten» (`aria-live`), «Zurücksetzen» leert alles und setzt den Fokus ins Textfeld. Rückgabe: `{ zeigen(), zuruecksetzen() }`.

```js
Lernpfad.reflexion("#reflexion-1", {
  titel: "Früherer Go-live",
  icb: ["ICB 3.04", "ICB 3.13"],
  frage: "<p>Der Auftraggeber will zwei Wochen früher live gehen. Wie gehst du vor?</p>",
  musterloesung: "<p>Auswirkungen analysieren, Optionen aufzeigen, Entscheid über einen Änderungsantrag beim Auftraggeber, Plan nachführen.</p>",
  kriterien: [
    { text: "Auswirkungen auf Termin, Kosten, Qualität analysiert", punkte: 2 },
    { text: "Entscheid beim Auftraggeber", punkte: 1 }
  ]
});
```

### 9.13 `Lernpfad.matrix(el, cfg)`

Raster von 2×2 bis 5×5 mit Achsen; Karten werden Feldern zugeordnet (Stakeholder-Karte, Risikomatrix, Portfolio). Bedienung: Karte antippen (`aria-pressed`), dann Feld antippen. Mit der Tastatur: Karte mit Enter wählen, der Fokus springt ins Raster, Pfeiltasten (auch Home/End) bewegen, Enter legt ab, Escape hebt die Wahl auf. Nach dem Ablegen geht der Fokus zur nächsten offenen Karte. Das Raster skaliert mit der Breite, die Karten stehen darunter; im Feld erscheint nur die Nummer der Karte.

| Feld | Typ | Pflicht | Bedeutung |
|------|-----|---------|-----------|
| `titel` | HTML | nein | Titel |
| `icb` | Text oder Text[] | nein | ICB-Kennzeichen im Kopf |
| `frage` | HTML | nein | Aufgabenstellung |
| `zeilen` | Text[] | ja | 2–5 Zeilenbeschriftungen **von oben nach unten** (z. B. `["hoch", "tief"]`) |
| `spalten` | Text[] | ja | 2–5 Spaltenbeschriftungen von links nach rechts |
| `achseY`, `achseX` | Text | nein | Achsennamen (z. B. `"Interesse"`, `"Einfluss"`); erscheinen am Rand und im Namen jedes Felds |
| `feldnamen` | HTML[][] | nein | kurzer Text pro Feld `[zeile][spalte]`, z. B. Strategie oder Risikowert |
| `stufen` | Text[][] | nein | Hintergrund pro Feld `"tief"`, `"mittel"`, `"hoch"` (grün, orange, rot); die Stufe steht auch im Feldnamen für Screenreader. Farbe nie allein: Werte zusätzlich in `feldnamen` |
| `elemente` | Objekt[] | ja | Karten `{ html, ziel, erklaerung }`. `html` ohne Knöpfe oder Links (steht in einem Knopf). `ziel` optional `[zeile, spalte]`: Zahl = Index ab 0, Text = Beschriftung |

Hat mindestens ein Element ein `ziel`, gibt es «Prüfen»: je Karte ✓/✗ mit Erklärung, in den Feldern ✓/✗ vor der Nummer, Stand «x von n richtig» (`aria-live`). Rückgabe: `{ pruefen(), zuruecksetzen(), stand() }`; `stand()` liefert je Karte `[zeile, spalte]` oder `null`.

```js
Lernpfad.matrix("#stakeholder", {
  titel: "Stakeholder-Karte", icb: "ICB 3.12",
  zeilen: ["hoch", "tief"], spalten: ["tief", "hoch"],
  achseY: "Interesse", achseX: "Einfluss",
  feldnamen: [["Informieren", "Eng einbinden"], ["Beobachten", "Zufriedenstellen"]],
  elemente: [
    { html: "Gemeinderat (Auftraggeber)", ziel: ["hoch", "hoch"], erklaerung: "Entscheidet und will das Ergebnis." },
    { html: "Lokalzeitung", ziel: [1, 0], erklaerung: "Wenig Einfluss, wenig Interesse." }
  ]
});
```

Risikomatrix 5×5: `zeilen: ["5","4","3","2","1"]` (Wahrscheinlichkeit), `spalten: ["1","2","3","4","5"]` (Auswirkung), Risikowert als `feldnamen`, Stufen nach Risikowert. Beispiel in `content/lernseiten/pmgt/_vorlage.html`.

### 9.14 `Lernpfad.netzplanKnoten(daten)`

Baut einen Netzplan-Knoten ([8.11](#811-hilfsklassen-für-themeneigene-interaktionen)) als Element und gibt ihn zurück; einfügen und platzieren macht die Seite. Felder: `vorgang` (HTML), `dauer`, `fa`, `fe`, `sa`, `se`, optional `gp`, `fp` (Puffer-Zeile erscheint, sobald eines gesetzt ist), `kritisch` (`true`). Fehlende Werte erscheinen als «–». Der Knoten bekommt `role="group"` und ein `aria-label` mit allen Werten.

```js
const k = Lernpfad.netzplanKnoten({ vorgang: "C Beschaffung", dauer: 4, fa: 5, fe: 9, sa: 5, se: 9, gp: 0, fp: 0, kritisch: true });
k.style.gridColumn = "3";
document.getElementById("t10-netzplan").appendChild(k);
```

### 9.15 `Lernpfad.modellieren(el, cfg)`

Modellierungsübung: Anforderungstext lesen, passende Bausteine auf die Fläche legen, Verbindungen mit Art ziehen, prüfen. Ohne Ziehen mit der Maus: alles per Antippen und Tastatur (Palette-Knopf legt hin oder entfernt, Startbaustein antippen, Zielbaustein antippen). Eine Verbindungsliste unter der Fläche zeigt dasselbe als Text (Screenreader, sich kreuzende Linien) und hat je einen Knopf «Entfernen». Muster: `content/lernseiten/avsw/_vorlage.html`.

| Feld | Typ | Pflicht | Bedeutung |
|------|-----|---------|-----------|
| `titel` | HTML | nein | Titel |
| `aufgabe` | HTML | nein | Anforderungstext. `<span data-baustein="id">` markiert die Textstelle zu einem Baustein: Sie wird unterstrichen, sobald der Baustein liegt, und leuchtet mit ihm zusammen auf. |
| `schichten` | Objekt[] | nein | `{ id, name }`: Bänder auf der Fläche (z. B. Client, Zugang, Dienste, Daten). Ohne: ein Band. |
| `bausteine` | Objekt[] | ja | `{ id, name, art, schicht, info }`. `art` = Piktogramm (siehe 9.16), `schicht` = `id` aus `schichten`. Ablenker (nicht in der Lösung) sind erwünscht. |
| `verbindungsarten` | Objekt[] | nein | `{ id, name }`, höchstens vier. Standard: `sync` «synchron (Request/Response)», `async` «asynchron (Nachricht/Event)», `daten` «liest/schreibt Daten». Linienstil je Position: voll, gestrichelt, gepunktet, Strich-Punkt. |
| `loesung` | Objekt | ja | `{ bausteine: [id], verbindungen: [{ von, nach, art, warum, gerichtet }] }`. `warum` erscheint nach dem Lösen. `gerichtet: false` akzeptiert beide Richtungen. |
| `richtungEgal` | Bool | nein | `true`: Richtung zählt nirgends, Linien ohne Pfeil (z. B. Deployment-Sicht «läuft auf»). |
| `vorgegeben` | Bool | nein | `true`: Lösungs-Bausteine liegen schon, Palette ausgeblendet. Nur verbinden («die nötigen Teile miteinander verbinden»). |
| `erklaerung` | HTML | nein | Merksatz nach dem Lösen (z. B. «Verben verraten die Verbindungsart»). |

Bewertung: je ein Punkt pro richtig gelegtem Lösungs-Baustein und pro Lösungs-Verbindung mit richtiger Richtung und Art. Die Rückmeldung nennt überflüssige Bausteine beim Namen, zählt fehlende Bausteine und Verbindungen, falsche Richtungen und falsche Arten, und gibt einen Tipp («Schau dir «Bestellservice» nochmals an»), ohne die Lösung zu verraten. «Lösung zeigen» zeichnet die Musterlösung mit allen `warum` ein.

Ereignis `lernpfad:modell` (bubbelt) nach jedem Prüfen: `detail: { richtig, gesamt, vollstaendig, loesungGezeigt }`. Rückgabe: `{ zuruecksetzen(), loesungZeigen(), pruefen() }`.

Regeln für gute Aufgaben: Jede Verbindung der Lösung muss aus dem Text folgen (Signalwörter wie «fragt synchron», «veröffentlicht», «abonniert», «speichert»). Mindestens ein Ablenker in der Palette. Schichten so wählen, dass die Fläche bei 320 px lesbar bleibt (höchstens etwa vier Bausteine pro Schicht).

### 9.16 `Lernpfad.piktogramm(art, titel)`

Gibt ein eigenes Inline-SVG (24 × 24, `currentColor`, Klasse `.pikto`) als HTML-Text zurück, für Konzeptkarten, Tabellen, Bilder von Architekturen und den Baustein `modellieren`. Mit `titel` bekommt es `role="img"` und `<title>`, sonst `aria-hidden`. **Keine Markenlogos** (Kubernetes, Docker, Kafka …): Werkzeuge werden mit diesen Piktogrammen und echten Code-Beispielen gezeigt.

Arten: `client`, `mobile`, `user`, `gateway`, `lb`, `service`, `function`, `db`, `cache`, `queue`, `topic`, `storage`, `extern`, `container`, `pod`, `node`, `cluster`, `auth`, `cdn`, `monitor`, `config`, `code`. Galerie in `content/lernseiten/avsw/_vorlage.html`.

### 9.17 Hilfsfunktionen

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
5. **Zuerst Hilfsklassen nutzen** ([8.11](#811-hilfsklassen-für-themeneigene-interaktionen)): `.baum`, `.vierfelder`, `.wahrheitstabelle`, `.tabelle`, `.rechner`/`.regler`, `.diagramm`, `.netzplan`/`.np-knoten`, `.gantt`.
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

- [ ] Datei heisst `content/lernseiten/<fach>/<slug>.html`, Slug wie in `fach.json`.
- [ ] Pflicht-Gerüst vollständig: doctype, `lang="de-CH"`, charset, viewport, `<title>` mit ` · <KÜRZEL>`, Theme-Startskript im `<head>`, `lernpfad.css`, `data-fach="<fach>"`, `data-thema="<slug>"`, `lernpfad.js` am Ende von `<body>`, danach das eigene Script.
- [ ] `<link rel="next">` zeigt auf die nächste Station aus `fach.json`, `title` = deren Titel (bei der letzten Station weggelassen).
- [ ] Keine externen Ressourcen, keine Folien-Screenshots, keine wörtlichen Folientexte.
- [ ] `npm run lernseiten:pruefen` meldet für die Seite keine Fehler.
- [ ] Vorschau (`node scripts/lernpfad-vorschau.mjs --port <port>`): keine Fehler in der Konsole, keine `[Lernpfad]`-Meldungen.
- [ ] Alle Formeln gesetzt (kein roher `$…$`-Text, keine roten KaTeX-Fehler).
- [ ] Alle Bausteine durchgeklickt: Sortierer, Stepper (Zuordnung leuchtet), Übungen (richtige und falsche Eingabe), Film läuft bis zum Ende, Selbsttest vollständig beantwortet (Ergebnis in der Abschluss-Box).
- [ ] Reflexion: leer «Musterlösung zeigen» (Rückfrage erscheint), mit Text zeigen, Kriterien ankreuzen (Summe stimmt), Zurücksetzen.
- [ ] Matrix: Karten per Tipp und per Tastatur ablegen (Enter, Pfeiltasten, Escape), «Prüfen» mit richtiger und falscher Zuordnung; Ziele stimmen fachlich.
- [ ] Netzplan und Gantt: Zahlen nachgerechnet, kritische Knoten und Balken markiert, scrollen bei 320 px in `.tablebox` statt die Seite zu verbreitern.
- [ ] PMGT: ICB-Kennzeichen im Kopf und bei den IPMA-Fragen, Akzentfarbe Orange (kommt von selbst über `data-fach="pmgt"`).
- [ ] Hell und dunkel geprüft (Umschalter oben rechts); eigene Elemente gut lesbar.
- [ ] Bei 360 px und 320 px kein seitliches Scrollen, auch mit aufgedeckten Lösungen.
- [ ] Mit der Tastatur bedienbar (Tab, Enter, Leertaste), Fokus immer sichtbar.
- [ ] Eigene Klassen und IDs mit Präfix `t<NN>-`, nur Farben aus `:root`.
- [ ] Fachlich geprüft: jede Zahl nachgerechnet, Lösungen und Quiz-Antworten stimmen, `toleranz` passt zur verlangten Rundung.
- [ ] Texte: Schweizer Hochdeutsch (ss), Du-Form, kurze aktive Sätze.
