# Lernpfad PS: PowerShell-Erweiterung des Baukastens

**Version:** PS-Erweiterung 1.0.0 auf Baukasten 1.1.0. Gilt nur für Seiten des Fachs `ps` («PowerShell-Grundlagen»).

Der Baukasten selbst (`lernpfad.css`, `lernpfad.js`, `docs/lernpfad-baukasten.md`) bleibt unverändert. Alles PowerShell-Spezifische steckt in zwei eigenen Dateien, die nur die PS-Seiten laden:

| Datei | Zweck |
|-------|-------|
| `public/lernpfad/ps-konsole.css` | Akzent PowerShell-Blau, Syntaxfärbung, Ausgabeblock, Kennzeichen «5.1»/«7», Layout des Simulators |
| `public/lernpfad/ps-konsole.js` | Simulator (Tokenizer, Parser, Interpreter, Formatierer, Cmdlets), Syntaxfärbung, Oberfläche. Ohne Abhängigkeiten, läuft auch unter Node |
| `content/lernseiten/ps/_vorlage.html` | Muster-Themenseite mit allen PS-Bausteinen |
| `tests/ps-konsole.test.ts` | Tests (Tokenizer, Parser, Pipeline, Formatierung, Cmdlets, Fehler) |
| `tests/fixtures/ps-konsole-pwsh76.json` | 378 Befehle mit der Ausgabe aus echtem pwsh 7.6 (356 werden verglichen) |

**Schnellstart:** Kopiere `content/lernseiten/ps/_vorlage.html` nach `content/lernseiten/ps/<slug>.html`, passe Kopf und Inhalte an und arbeite die [Prüfliste](#9-prüfliste) ab. Für alles andere gilt `docs/lernpfad-baukasten.md`.

## Inhalt

1. [Einbinden](#1-einbinden)
2. [Akzentfarbe und Kontraste](#2-akzentfarbe-und-kontraste)
3. [Codeblöcke, Ausgabeblöcke, Kennzeichen](#3-codeblöcke-ausgabeblöcke-kennzeichen)
4. [Konsolen-Simulator: Lernpfad.konsole](#4-konsolen-simulator-lernpfadkonsole)
5. [Ohne Oberfläche: ausfuehren und sitzung](#5-ohne-oberfläche-ausfuehren-und-sitzung)
6. [Der Spiel-Rechner «Lea»](#6-der-spiel-rechner-lea)
7. [Was der Simulator kann](#7-was-der-simulator-kann)
8. [Abweichungen von echter PowerShell](#8-abweichungen-von-echter-powershell)
9. [Prüfliste](#9-prüfliste)
10. [Aufbau des Codes und Tests](#10-aufbau-des-codes-und-tests)

## 1. Einbinden

```html
<head>
  …
  <link rel="stylesheet" href="/lernpfad/lernpfad.css">
  <link rel="stylesheet" href="/lernpfad/ps-konsole.css">
</head>
<body data-fach="ps" data-thema="07-pipeline-filtern-sortieren">
  …
  <script src="/lernpfad/lernpfad.js"></script>
  <script src="/lernpfad/ps-konsole.js"></script>
  <script>
    (function () { "use strict"; const L = window.Lernpfad; /* … */ })();
  </script>
</body>
```

- `ps-konsole.js` steht **nach** `lernpfad.js` (es hängt `Lernpfad.konsole` und `Lernpfad.psFaerben` an `window.Lernpfad` an). Die Prüfung meldet die falsche Reihenfolge als Fehler (`docs/lernpfad-format.md`).
- `ps-konsole.css` steht nach `lernpfad.css`.
- Beim Laden färbt `ps-konsole.js` alle Codeblöcke und füllt Ausgabeblöcke mit `data-ps-befehl`. Später eingefügte Codeblöcke (Film, Stepper, Selbsttest) färbt es ebenfalls selbst (MutationObserver).
- `$` im Fliesstext würde KaTeX auslösen. Schreib PowerShell-Variablen immer in `<code class="ps">` oder `<code>`; Inhalte von `pre`, `code` und der Konsole (`.keine-formel`) setzt `lernpfad.js` nie als Formel.

## 2. Akzentfarbe und Kontraste

`body[data-fach="ps"]` setzt `--accent` und `--accent-soft` (hell und beide Dunkel-Regeln wie bei PMGT). Kachelfarbe in `fach.json`: `#2671BE`. Auf `--bg` erreicht die Kachelfarbe nur 4.66:1 und auf einem hellblauen `--accent-soft` weniger als 4.5:1, darum ist der Akzent etwas dunkler.

| Fach | Schema | `--accent` | `--accent-soft` | Kontrast Akzent auf `--bg` / `--surface` / `--accent-soft` |
|------|--------|-----------|-----------------|------------------------------------------|
| PS (Kachel `#2671BE`) | hell | `#1f62a6` | `#e3edf8` | 5.81 / 6.26 / 5.28 |
| PS | dunkel | `#7db5f0` | `#162a40` | 8.75 / 8.11 / 6.77 |

`.btn.primary` (Schrift `--surface` auf dem Akzent): hell 6.26, dunkel 8.11. Nachtrag für die Tabelle in Abschnitt 7 von `docs/lernpfad-baukasten.md`, sobald der Baukasten wieder zusammengeführt wird.

Weitere Tokens (alle WCAG ≥ 4.5:1, gerechnet mit der relativen Leuchtdichte nach WCAG 2.1):

| Bereich | Hintergrund | kleinster Kontrast |
|---------|-------------|--------------------|
| Syntaxfärbung hell (`--ps-befehl` … `--ps-typ`) | `--board` `#f1eef4`, `--surface` `#ffffff` | 5.29 (`--ps-typ` auf `--board`) |
| Syntaxfärbung dunkel | `--board` `#231e28`, `--surface` `#1c1820` | 7.53 (`--ps-parameter`) |
| Konsole, immer dunkel (`--psk-bg` `#0f1c2e`, Leiste `#16263c`) | Text, Kopf, Fehler, Warnung, Hinweis, Token | 7.40 (Nebentext auf der Leiste) |
| Write-Host-Farben (`-ForegroundColor`) | `--psk-bg` | 4.59 (`Black`) |
| Ordnername (weiss auf `#2a5fae`) | | 6.28 |
| Kennzeichen `.ps-version` | eigener Hintergrund hell / dunkel | 9.09 / 8.69 |

## 3. Codeblöcke, Ausgabeblöcke, Kennzeichen

| Schreibweise | Ergebnis |
|--------------|----------|
| `<pre class="ps-code"><code>Get-ChildItem -Path Logs</code></pre>` | Codeblock mit Färbung (scrollt seitlich) |
| `<code class="ps">Get-Date</code>` | Befehl im Text mit Färbung |
| `<pre class="ps-ausgabe">…</pre>` | Ausgabe im Terminal-Look (immer dunkel), Inhalt von Hand |
| `<pre class="ps-ausgabe" data-ps-befehl="Get-ChildItem Logs"></pre>` | Prompt, gefärbter Befehl und **echte Ausgabe des Simulators**, beim Laden erzeugt |
| `data-ps-sitzung="name"` | mehrere Ausgabeblöcke teilen einen Rechner (in Dokumentreihenfolge) |
| `data-ps-prompt="nein"` | nur die Ausgabe, ohne Prompt und Befehl |
| `<span class="ps-version">5.1</span>` | Kennzeichen, erscheint als «PS 5.1» (auch `7`) |

Färbung: Teile mit den Klassen `ps-t-befehl`, `ps-t-parameter`, `ps-t-variable`, `ps-t-string`, `ps-t-zahl`, `ps-t-operator`, `ps-t-kommentar`, `ps-t-schluesselwort`, `ps-t-typ`. Die Färbung liest nur `textContent` und baut Spans per DOM; HTML im Code wird nie als Markup gelesen. Schreib `<` im Code als `&lt;`.

In Ausgabeblöcken von Hand stehen fremdsprachige Meldungen in `lang="en"`. Die Klassen der Konsole sind auch hier nutzbar: `psk-fehler`, `psk-warnung`, `psk-kopf`, `psk-hinweis`, `psk-prompt`, `psk-ordner`.

Ausgabeblöcke, die sehr breit sind, scrollen in sich. Gib ihnen `tabindex="0"` und ein `aria-label`, damit man sie mit der Tastatur scrollen kann.

`Lernpfad.psFaerben(root)` färbt Codeblöcke in `root` (Standard: ganze Seite) und gibt die Anzahl zurück. Nur nötig, wenn du Code ausserhalb des DOM-Baums vorbereitest.

## 4. Konsolen-Simulator: Lernpfad.konsole

```js
L.konsole("#konsole-1", {
  aufgaben: [
    { titel: "Leas Logdateien", text: "<p>Liste den Ordner <code>Logs</code> auf.</p>",
      hinweis: "<p>Get-ChildItem mit dem Ordnernamen.</p>",
      loesung: "Get-ChildItem Logs",
      pruefe: (ctx) => ctx.befehle.includes("Get-ChildItem") && /Directory: C:\\Users\\lea\\Logs/.test(ctx.ausgabe) }
  ]
});
```

| Feld | Typ | Standard | Bedeutung |
|------|-----|----------|-----------|
| `modus` | Text | `"konsole"` | `"konsole"` (Eingabezeile) oder `"skript"` (Editor, Parameterfeld, «▶ Ausführen») |
| `titel` | Text | «PowerShell 7» | Titel der Leiste |
| `umgebung` | Objekt | Lea | Rechner ergänzen oder ersetzen, siehe [Abschnitt 6](#6-der-spiel-rechner-lea) |
| `admin` | Bool | `false` | Konsole «als Administrator» |
| `adminKnopf` | Bool | `false` | Knopf «Als Administrator neu starten» (neue Sitzung, gleicher Rechner) |
| `befehle` | Text[] | `[]` | Befehle, die beim Start sichtbar ausgeführt werden |
| `begruessung` | Bool | `true` | Kopfzeilen «PowerShell 7.6.1 / Simulator …» |
| `aufgaben` | Objekt[] | `[]` | Aufgaben unter der Konsole (siehe unten) |
| `aufgabenTitel` | HTML | «Aufgaben» | Überschrift der Aufgabenliste |
| `skript` | Text | `""` | Skript-Modus: Anfangsinhalt des Editors |
| `skriptName` | Text | `"skript.ps1"` | Dateiname im Benutzerordner |
| `argumente` | Text | `""` | Skript-Modus: Anfangswert des Parameterfelds, z. B. `"-Tage 30"` |
| `argumenteBeispiel` | Text | «z. B. -Tage 30» | Platzhalter des Parameterfelds |

**Aufgaben:** `{ titel, text, hinweis, loesung, pruefe(ctx) }`. `titel`, `text`, `hinweis` sind HTML (wie alle Baustein-Texte), `loesung` ist PowerShell-Code (erscheint gefärbt, mit Knopf «In die Eingabe übernehmen»). Nach jeder ausgeführten Eingabe ruft der Simulator `pruefe` für alle offenen Aufgaben auf. Eine Aufgabe bleibt gelöst. Gelöst: ✓ statt ○, «(gelöst)» für Screenreader, Meldung in `aria-live`, Stand «x von n gelöst».

| `ctx.` | Inhalt |
|--------|--------|
| `eingabe` | die Eingabe (im Skript-Modus der Aufruf `.\skript.ps1 …`) |
| `skript`, `argumente` | nur Skript-Modus: Text des Editors und des Parameterfelds |
| `befehle` | aufgerufene Befehle mit vollem Namen, Aliase aufgelöst (`ls` → `Get-ChildItem`) |
| `objekte` | Ausgabeobjekte (Werte des Simulators; `ctx.text(o)` liefert den Text wie `ToString()`) |
| `ausgabe` | angezeigter Text (ohne Farben) |
| `fehler`, `hatFehler` | Fehlermeldungen (englisch), ob es Fehler gab |
| `ort`, `admin`, `verlauf` | aktueller Ort (`C:\Users\lea`), Adminrechte, alle bisherigen Eingaben |
| `existiert(p)`, `datei(p)`, `inhalt(p)`, `kinder(p)` | Zustand des Dateisystems (Pfade relativ zum aktuellen Ort oder absolut); `datei` → `{ name, ordner, groesse, inhalt, zeit, versteckt }` |
| `prozess(nameOderId)`, `dienst(name)` | `{ name, id, ws, cpu … }` bzw. `{ name, anzeige, status, start }` oder `null` |
| `variable(name)`, `umgebungsvariable(name)` | Wert einer PowerShell-Variable (als JS-Wert) bzw. von `$env:name` |

**Ereignis** `lernpfad:aufgabe` (bubbelt) auf dem Element, `detail: { index, titel, geloest, anzahlGeloest, gesamt, alleGeloest }`.

**Rückgabe:** `{ ausfuehren(code), zuruecksetzen(), sitzung, eingabe, aufgabenStand() }`. `ausfuehren` tippt einen Befehl so, als hätte man ihn eingegeben.

**Bedienung:** Enter führt aus, ↑/↓ blättern im Verlauf, Tab und Shift+Tab vervollständigen Cmdlets, Parameter, Pfade, Variablen, Dienst- und Prozessnamen (bei leerer Zeile verlässt Tab die Eingabe), Esc leert die Zeile. Unvollständige Eingaben (`if (…) {`) zeigen die Fortsetzungszeile `>>`; eine leere Zeile schliesst ab. `-Confirm` und Ordner mit Inhalt ohne `-Recurse` fragen wie pwsh nach `[Y] Yes [A] Yes to All [N] No [L] No to All [S] Suspend [?] Help`. «↺ Zurücksetzen» stellt den Rechner wieder her (gelöste Aufgaben bleiben gelöst). Die Ausgabe ist `role="log"`, das Fenster ist fokussierbar und scrollt intern in beide Richtungen; die Seite wird nie breiter (geprüft bei 360 und 320 px).

**Skript-Modus:** «▶ Ausführen» (oder Ctrl+Enter im Editor) speichert den Editor als `C:\Users\lea\<skriptName>` und führt `.\<skriptName> <Parameter>` aus. `param(…)` am Anfang des Skripts wird gebunden, Fehler erscheinen mit Datei und Zeile (`Line |`) wie in pwsh 7.

**Minimalbeispiel Skript-Modus:**

```js
L.konsole("#skript-1", {
  modus: "skript", skriptName: "aufraeumen.ps1",
  skript: "param([int]$Tage = 30)\n$alt = Get-ChildItem Logs | Where-Object LastWriteTime -lt (Get-Date).AddDays(-$Tage)\n\"Gefunden: $($alt.Count)\"",
  aufgaben: [{ titel: "60 Tage", text: "<p>Starte das Skript mit -Tage 60.</p>", loesung: "-Tage 60",
    pruefe: (ctx) => /-Tage\s+60/.test(ctx.argumente) && /Gefunden: 3/.test(ctx.ausgabe) }]
});
```

## 5. Ohne Oberfläche: ausfuehren und sitzung

| Funktion | Ergebnis |
|----------|----------|
| `Lernpfad.konsole.ausfuehren(code, umgebung)` | Ausgabe als Text (ohne Farben, ohne Leerzeilen am Ende) auf einem frischen Rechner. Rückfragen werden mit «N» beantwortet, ausser `umgebung.antworten` gibt Antworten vor. |
| `Lernpfad.konsole.sitzung(umgebung)` | `{ ausfuehren(code, antworten), html(code, antworten), prompt() }` auf **einem** Rechner, der Zustand bleibt zwischen den Aufrufen erhalten |

`sitzung().html(code)` liefert ein fertiges `<pre class="ps-ausgabe">` mit Prompt, gefärbtem Befehl und Ausgabe, HTML-sicher maskiert. Ideal für Filmszenen und Stepper:

```js
const film = L.konsole.sitzung();
L.film("#film-1", { texte: [], woerterbuch: [], beschriftung: { formel: "Konsole" }, szenen: [
  { say: "Lea schaut in den Ordner Logs." },
  { f: film.html("Get-ChildItem Logs"), say: "Get-ChildItem zeigt jede Datei mit Datum und Grösse." },
  { f: film.html("Get-ChildItem Logs | Measure-Object -Property Length -Sum"), say: "…", end: true }
]});
```

Im Filmtext (`say`) kein `$` ausserhalb von `<code>` schreiben (KaTeX).

Unter Node: `require("public/lernpfad/ps-konsole.js")` liefert `{ Sitzung, ausfuehren, sitzung, faerbeTokens, parsen, Lexer, formatieren, LEA, CMDLETS, ALIASE }`.

## 6. Der Spiel-Rechner «Lea»

Lea arbeitet in der Informatik der Gemeinde Wolkenried. Computer `WR-LEA-01`, Benutzer `lea` (Domäne `WOLKENRIED`), Zeit fest **Montag, 2. November 2026, 09:00:00**, keine Adminrechte, Ausführungsrichtlinie `RemoteSigned`, Kultur de-CH.

```
C:\Users\lea
├── AppData (versteckt) ─ Local\Temp, Roaming
├── Berichte    mitarbeitende.csv (8 Personen, Komma), quartalsbericht-q3.xlsx, budget-2027.xlsx
├── Bilder      ferien-01.jpg (3 MB), ferien-02.jpg, gemeindehaus.png, logo-wolkenried.png
├── Dokumente   notizen.txt, einkaufsliste.txt, bewerbung-alt.docx, protokoll-teamsitzung.docx
│   └── Archiv  vertrag-2020.pdf, schatz.txt (versteckt)
├── Downloads   setup-alt.exe (50 MB, 2025), WolkenriedSync-setup.exe, rechnung-2026-09.pdf, rechnung-2026-10.pdf, foto-apero.jpg, handbuch-drucker.pdf
└── Logs        app.log (5 Zeilen), app-2026-07…10.log (8.5 / 6 / 4.5 / 3.25 MB), backup-2026-06.log, sync-fehler.log
```

Älter als 30 Tage (vor 3.10.2026): `app-2026-07.log`, `app-2026-08.log`, `app-2026-09.log`, `backup-2026-06.log`. Dazu `C:\Program Files\PowerShell\7`, `C:\Windows` (geschützt), `C:\Users\Public`.

- **Prozesse:** u. a. `berichtgenerator` (Id 6612, 1.9 GB WS, der Speicherfresser), `chrome` (3×), `Code`, `explorer`, `ms-teams`, `notepad` (8840), `OUTLOOK`, `pwsh` (9120, die Konsole selbst), Systemprozesse `Idle`, `System`, `lsass`, `svchost` (3×), `WolkenriedBackup` (nur mit Adminrechten beendbar, kritische nie).
- **Dienste:** `AudioSrv`, `BITS` (gestoppt), `Dnscache`, `EventLog`, `Fax` (gestoppt), `Spooler`, `W32Time` (gestoppt), `WinDefend`, `WolkenriedBackup`, **`WolkenriedSync` (gestoppt, Starttyp Automatic)**, `WSearch`, `wuauserv`. Start/Stop braucht Adminrechte.
- **Umgebungsvariablen:** `USERNAME`, `USERPROFILE`, `COMPUTERNAME`, `TEMP`, `Path`, `OS` … (`Get-ChildItem Env:`).
- **Registry HKCU:** `Console`, `Control Panel\Desktop`, `Environment`, `Software\Microsoft`, `Software\Wolkenried\Sync` (Server, Intervall).
- **Netz** (`Test-Connection`): `localhost`, `server` (10.0.0.10), `www.wolkenried.ch`, `learn.microsoft.com` antworten; `sync.wolkenried.ch` antwortet nicht (TimedOut); andere Namen: «No such host is known».

**`cfg.umgebung`** (auch für `ausfuehren` und `sitzung`):

| Feld | Bedeutung |
|------|-----------|
| `ersetzen: true` | leerer Rechner (nur `C:\Users\lea`, Prozess pwsh) statt Lea |
| `dateien: [{ pfad, inhalt, groesse, zeit, versteckt }]` | Dateien anlegen oder überschreiben (`inhalt` mit `\n`, Grösse wird daraus berechnet) |
| `ordner: [{ pfad, zeit, versteckt }]` | Ordner anlegen |
| `entfernen: [pfad]` | Dateien oder Ordner entfernen |
| `prozesse: [{ name, id, ws, cpu, system }]`, `dienste: [{ name, anzeige, status, start }]` | ergänzen (gleiche Id bzw. gleicher Name ersetzt) |
| `env: { NAME: wert }` | Umgebungsvariablen setzen |
| `ort`, `admin`, `zeit`, `richtlinie` | Startort, Adminrechte, Uhrzeit (`"2026-11-02T09:00:00"`), Ausführungsrichtlinie |
| `variablen: { name: wert }` | PowerShell-Variablen vorbelegen (Text, Zahl, Bool, Array, Objekt → Hashtable) |
| `antworten: ["Y", …]` | nur `ausfuehren`: Antworten auf Rückfragen |

## 7. Was der Simulator kann

### 7.1 Cmdlets und Funktionen (68)

| Bereich | Befehle |
|---------|---------|
| Hilfe, Entdecken | `Get-Command` (`-Name` mit Platzhaltern, `-Verb`, `-Noun`, `-CommandType`, `-Syntax`), `Get-Help` (deutsche Kurztexte, echte Syntax, `-Examples`, `-Parameter`, `-Detailed`, `-Full`, `-Online` als Hinweis, `about_*`), `help`, `Get-Member` (`-MemberType`, `-Name`), `Get-Alias` (`-Definition`), `Get-Verb`, `Get-History` |
| Ort und Pfade | `Get-Location`, `Set-Location` (`..`, `~`, `\`, `-`, `+`, Laufwerke `C:`, `Env:`, `HKCU:`), `cd..`, `cd\`, `cd~`, `Test-Path` (`-PathType`, `-OlderThan`, `-NewerThan`), `Join-Path`, `Split-Path`, `Resolve-Path`, `Get-PSDrive` |
| Dateien | `Get-ChildItem` (`-Path`, `-Filter`, `-Recurse`, `-Depth`, `-File`, `-Directory`, `-Force`, `-Hidden`, `-Include`, `-Exclude`, `-Name`), `Get-Item`, `New-Item` (`-ItemType File/Directory`, `-Value`, `-Force`), `mkdir`, `Copy-Item` (`-Recurse`, `-PassThru`), `Move-Item`, `Rename-Item`, `Remove-Item` (`-Recurse`, `-Force`, `-WhatIf`, `-Confirm`), `Get-Content` (`-TotalCount`/`-First`/`-Head`, `-Tail`/`-Last`, `-Raw`), `Set-Content`, `Add-Content`, `Clear-Content`, `Out-File` (`-Append`, `-NoClobber`), Umleitung `>`, `>>`, `2>$null`, `2>&1` |
| Pipeline | `Where-Object` (Skriptblock und vereinfachte Syntax mit allen Operatoren), `ForEach-Object` (Skriptblock, `-Begin`/`-End`, mehrere Blöcke, `-MemberName`), `Sort-Object` (mehrere Eigenschaften, Skriptblöcke, `@{ Expression; Descending }`, `-Unique`, `-Top`, `-Bottom`), `Select-Object` (`-Property` mit Platzhaltern und berechneten Eigenschaften, `-First`, `-Last`, `-Skip`, `-SkipLast`, `-Index`, `-Unique`, `-ExpandProperty`, `-ExcludeProperty`), `Measure-Object` (`-Sum`, `-Average`, `-Maximum`, `-Minimum`, `-StandardDeviation`, `-AllStats`, `-Line`, `-Word`, `-Character`), `Group-Object` (`-NoElement`, `-AsHashTable`) |
| Ausgabe, Export | `Format-Table` (`-Property`, berechnete Spalten mit `Label`/`Width`/`Alignment`/`FormatString`, `-AutoSize`, `-HideTableHeaders`), `Format-List` (`*`), `Format-Wide` (`-Column`, `-AutoSize`), `Export-Csv`, `Import-Csv`, `ConvertTo-Csv`, `ConvertFrom-Csv` (`-Delimiter`, `-UseCulture`, `-UseQuotes`, `-NoHeader`, `-IncludeTypeInformation`), `ConvertTo-Json` (`-Depth`, `-Compress`, `-AsArray`, `-EnumsAsStrings`), `ConvertFrom-Json` (`-AsHashtable`), `ConvertTo-Html` (`-Fragment`, `-Title`, `-PreContent`, `-PostContent`), `Out-String`, `Out-Null`, `Out-Host`, `Write-Host` (`-ForegroundColor`, `-NoNewline`, `-Separator`), `Write-Output` (`-NoEnumerate`), `Write-Error`, `Write-Warning`, `Write-Verbose`, `Clear-Host` |
| System | `Get-Process` (`-Name`, `-Id`), `Stop-Process` (`-Name`, `-Id`, Pipeline, `-WhatIf`, `-PassThru`), `Get-Service` (`-Name`, `-DisplayName`, `-Include`, `-Exclude`), `Start-Service`, `Stop-Service`, `Restart-Service`, `Get-Date` (`-Date` in de-CH, `-Format`, `-UFormat`, `-Year` … `-DisplayHint`), `New-TimeSpan`, `Test-Connection` (`-Count`, `-Quiet`), `Get-ExecutionPolicy` (`-List`, `-Scope`), `Set-ExecutionPolicy` (`-Scope CurrentUser/Process`; LocalMachine nur als Admin), `Get-Culture`, `Start-Sleep` (ohne Wartezeit) |
| Klassische Programme | `hostname`, `whoami` |

Gemeinsame Parameter: `-ErrorAction` (`Stop`, `SilentlyContinue`, `Ignore`, `Continue`), `-WhatIf`, `-Confirm`, `-Verbose`, Abkürzungen (`-Rec`) und Mehrdeutigkeit (`-F` → Fehler wie pwsh). Alle **Aliase von pwsh 7 unter Windows** sind hinterlegt (`ls`, `dir`, `gci`, `cd`, `cls`, `cat`, `cp`, `mv`, `rm`, `?`, `%`, `select`, `sort`, `ft`, `fl` …). Aliase und echte Cmdlets, die der Simulator nicht nachbaut (rund 300, z. B. `Get-CimInstance`, `Install-Module`, `Test-NetConnection`, `ping`), geben den Hinweis «gibt es in PowerShell, im Simulator nicht nachgebaut» statt «not recognized».

### 7.2 Sprache

- Variablen, Zuweisung `=`, `+=`, `-=`, `*=`, `/=`, `%=`, `??=`, `$i++`, `--$i`, typisierte Variablen (`[int]$z = '5'`), Bereiche `$global:`, `$script:`, `$env:`.
- Automatische Variablen: `$_`, `$PSItem`, `$true`, `$false`, `$null`, `$HOME`, `$PWD`, `$PID`, `$PSVersionTable`, `$Error`, `$?`, `$Matches`, `$args`, `$input`, `$PSScriptRoot`, `$PSCommandPath`, `$ErrorActionPreference`, `$PSCulture`, `$IsWindows`.
- Strings `'…'` und `"…"` mit `$x`, `${x}`, `$(…)`, Backtick-Escapes (`` `n `t `" `$ `u{…} ``), Here-Strings `@"…"@`, `@'…'@`, typografische Anführungszeichen und Gedankenstriche wie in PowerShell.
- Zahlen mit `KB`/`MB`/`GB`/`TB`/`PB`, Hex `0x1F`, Exponent; Arrays (`@()`, `,`, unäres `,`, Index auch negativ, Indexlisten, `..` auch für Buchstaben), Hashtables (`@{}`, `[ordered]`), `[pscustomobject]@{}`.
- Typumwandlung `[int]` (Banker's Rounding), `[long]`, `[double]`, `[string]`, `[bool]`, `[char]`, `[datetime]` (invariant: `'02.11.2026'` ist der 11. Februar!), `[int[]]`, `[string[]]`, `[array]`, `-is`, `-isnot`, `-as`.
- Operatoren: `+ - * / %` (der linke Typ entscheidet: `'5' + 5` = `55`), Vergleiche `-eq -ne -gt -ge -lt -le -like -notlike -match -notmatch -contains -notcontains -in -notin` mit `c`- und `i`-Varianten (Arrays links filtern), `-replace`, `-split`, `-join`, `-f`, `-and -or -xor -not !`, `-band -bor -bxor -shl -shr`, `??`, `? :`, `&&`, `||`.
- Eigenschaften und Methoden: String (`ToUpper`, `ToLower`, `Replace`, `Split`, `Trim`, `TrimStart`, `TrimEnd`, `StartsWith`, `EndsWith`, `Contains`, `Substring`, `IndexOf`, `PadLeft`, `PadRight`, `Insert`, `Remove`, `ToCharArray`), DateTime (`AddDays` … `AddYears`, `ToString(format)`, `ToShortDateString`, `ToLongDateString`, Rechnen `datum - datum`), TimeSpan, Array (`Count`, `Contains`, `.Where({})`, `.ForEach({})`, Member-Aufzählung `$dateien.Name`), Hashtable (`ContainsKey`, `Add`, `Remove`, `Keys`, `Values`, `GetEnumerator`), `GetType()`, Datei- und Ordnerobjekte (`Length`, `LastWriteTime`, `Directory`, `Delete()` …), Dienste (`Start()`, `Stop()`), Prozesse (`Kill()`).
- Statisch: `[math]::Round/Floor/Ceiling/Truncate/Abs/Max/Min/Pow/Sqrt/Log/Log10/PI`, `[datetime]::Now/Today/Parse/DaysInMonth/IsLeapYear`, `[string]::IsNullOrEmpty/IsNullOrWhiteSpace/Join/Format`, `[int]::MaxValue/Parse`, `[array]::IndexOf`, `[System.IO.Path]::GetExtension/GetFileName/…`, `[Environment]::UserName/MachineName`.
- Ablauf: `if`/`elseif`/`else`, `switch` (`-Wildcard`, `-Regex`, `-CaseSensitive`, Skriptblock-Bedingungen, `default`, `break`/`continue`), `foreach`, `for`, `while`, `do…while`, `do…until`, `break`, `continue`, `return`, `exit`, `function` mit `param()` (Typ, Standardwert, `[switch]`, `[Parameter(Mandatory)]`), `begin`/`process`/`end`, Skriptblöcke mit `&` und `.`, `try`/`catch [Typ]`/`finally`, `throw`, `$_.Exception.Message`, Kommentare `#` und `<# #>`, Zeilenfortsetzung mit Backtick, Pipe am Zeilenende und am Zeilenanfang.
- Skripte: `.\skript.ps1 -Parameter Wert` (Datei im Spiel-Rechner), Ausführungsrichtlinie wird beachtet.

### 7.3 Ausgabe

Wie pwsh 7.6 in einem 120 Zeichen breiten Fenster, Kultur de-CH: Standardansichten für Dateien (Mode, LastWriteTime, Length, Name mit «Directory:»), Prozesse, Dienste, Hashtables, Gruppen, Messwerte, Befehle, Laufwerke, Verlauf, Ping, Registry, Member; eigene Objekte bis 4 Eigenschaften als Tabelle, sonst als Liste; Zahlen in Tabellen mit zwei Nachkommastellen, Tausendertrenner `’` in `N`-Formaten; Datum `Montag, 2. November 2026 09:00:00`, in Tabellen `02.11.2026 08:59:13`, im String `11/02/2026 09:00:00`. Fehler im ConciseView von pwsh 7 (englisch): an der Eingabe einzeilig, in Skripten mit `Line |`, Zeile und Unterstreichung; Parserfehler immer mit `Line |`.

## 8. Abweichungen von echter PowerShell

Bewusste Vereinfachungen (für den Lernpfad ohne Bedeutung, aber gut zu wissen):

- **Zeit steht still:** Jeder Befehl läuft am 2.11.2026 um 09:00:00. Neue und geänderte Dateien bekommen diese Zeit; `LastAccessTime` ist gleich `LastWriteTime`.
- **Pipeline stufenweise:** Jede Stufe verarbeitet erst alle Objekte, dann kommt die nächste. Ein `Write-Host` in `ForEach-Object` erscheint darum vor der Ausgabe späterer Stufen (in pwsh abwechselnd). Fehler eines einzelnen Befehls erscheinen in der richtigen Reihenfolge.
- **Gemischte Objekttypen** in einer Ausgabe: Objekte eines anderen Typs als die laufende Tabelle erscheinen als Liste (wie meistens in pwsh, aber nicht in jedem Sonderfall).
- **Hashtables** zeigen die Einfügereihenfolge (in pwsh zufällig, weil die Reihenfolge vom Hash abhängt).
- **Zahlentypen:** Ganze Ergebnisse von Gleitkomma-Rechnungen gelten als `Double`, sonst Ganzzahlen als `Int32`/`Int64`. `Length` von Dateien ist im Simulator `Int32` (in .NET `Int64`), sichtbar nur in `Get-Member`.
- **Get-Member** zeigt alle Eigenschaften, bei Methoden nur eine Auswahl (alle bei String). Prozesse und Dienste haben nur die gängigen Eigenschaften. `VersionInfo` von Dateien fehlt (auch in `Format-List`).
- **Get-Command** listet nur die nachgebauten Befehle, **Get-Help** zeigt eigene, kurze deutsche Texte (Überschriften englisch wie im Original, Syntax echt aus pwsh 7.6).
- **Rückfragen:** Pflichtparameter ohne Wert fragen nicht nach (Fehler «missing mandatory parameters» wie mit `-NonInteractive`). `-Confirm` fragt nach; im Hintergrund (`ausfuehren`) lautet die Antwort «N».
- **Meldungen des Betriebssystems** sind englisch («Cannot create a file when that file already exists.»), auf einem deutschen Windows erscheinen sie deutsch. Fehlertexte von `ConvertFrom-Json` bei kaputtem JSON weichen im Detail ab.
- **Vorschlag bei Skripten ohne `.\`:** Statt des Vorschlags von pwsh erscheint ein deutscher Hinweis des Simulators.
- **Spaltenbreiten** eigener Tabellen richten sich nach allen Objekten (pwsh misst nur die ersten in 300 ms); bei kleinen Datenmengen identisch.
- **Dateien ohne Inhalt:** Bilder, PDF, Office-Dateien und grosse Logdateien haben nur Name, Grösse und Datum; `Get-Content` meldet das als Hinweis.
- **Nicht nachgebaut:** Klassen, `enum`, `trap`, Splatting `@args`, `Invoke-Expression`, `Read-Host`, Module, CIM/WMI, Netzwerk ausser `Test-Connection`, Registry-Werte lesen und schreiben (nur Schlüssel auflisten), Jobs, `-Parallel` (läuft nacheinander mit Hinweis).
- **Schutz:** Endlosschleifen brechen nach 200 000 Schritten ab, Rekursion nach Tiefe 100, Bereiche `..` über 100 000 Zahlen sind gesperrt.

## 9. Prüfliste

- [ ] Kopf wie in der Vorlage: `lernpfad.css`, dann `ps-konsole.css`; am Ende von `<body>` `lernpfad.js`, dann `ps-konsole.js`, dann das eigene Script.
- [ ] `data-fach="ps"`, Titel mit ` · PS`, `<link rel="next">` laut `fach.json`.
- [ ] Code nur in `pre.ps-code` / `code.ps` (gefärbt), kein `$` im Fliesstext ausserhalb von `<code>`.
- [ ] Ausgaben in `pre.ps-ausgabe`; wo möglich mit `data-ps-befehl` (echte Simulator-Ausgabe) oder per `L.konsole.sitzung().html()`. Von Hand geschriebene Ausgaben in echtem `pwsh -NoProfile` (7.6) nachgeprüft.
- [ ] Englische Meldungen mit `lang="en"`, Erklärung auf Deutsch daneben.
- [ ] Unterschiede zu Windows PowerShell 5.1 mit `<span class="ps-version">5.1</span>` markiert.
- [ ] Simulator-Aufgaben (4–8): jede `pruefe` mit richtiger **und** falscher Eingabe getestet, Lösung lösbar, `loesung` ist genau ein Befehl, der die Aufgabe löst.
- [ ] Jede gezeigte Ausgabe stimmt mit dem Simulator überein (bis auf die Daten des Spiel-Rechners auch mit echtem pwsh).
- [ ] Vorschau: keine Konsolenfehler, hell und dunkel, 360 und 320 px ohne seitliches Scrollen, Konsole und Ausgabeblöcke scrollen in sich.
- [ ] Tastatur: Eingabe, Tab-Vervollständigung, ↑/↓, Esc, Knöpfe «Hinweis», «Lösung», «Zurücksetzen» erreichbar, Fokus sichtbar.
- [ ] Prüfliste von `docs/lernpfad-baukasten.md` (Abschnitt 13) ebenfalls abgearbeitet.

## 10. Aufbau des Codes und Tests

`ps-konsole.js` ist in zwölf Teile gegliedert (Kopfkommentar): Hilfen (Zahlen und Datum de-CH) → Objektmodell (`PSObjekt`, `PSHashtable`, `PSDatum`, `PSEnum`, `FehlerDatensatz`) → Spiel-Rechner (`LEA`, `Welt`) → Tokenizer (`Lexer`, zwei Modi: Ausdruck und Befehl) → Parser (Syntaxbaum) → Auswertung (`Interpreter`: Variablen, Pipeline, Parameterbindung aus den echten Syntaxzeilen, Fehler) → Formatierer (Ansichten wie pwsh) → Cmdlet-Tabelle (`CMDLETS`, je `run(ctx)`) → Hilfe-Texte → `Sitzung` (API ohne Oberfläche) → Syntaxfärbung → Oberfläche. Eingaben werden nur interpretiert (kein `eval`, kein `new Function`); Ausgaben gelangen per `textContent` ins DOM, `innerHTML` nur für die HTML-Texte der Konfiguration (wie bei allen Bausteinen).

Ein neues Cmdlet: Eintrag `cmdlet("Verb-Nomen", "M"|"U"|"C", { syntax: [...], pipeline: [...], run(ctx) { … } })` in Teil 8, Hilfetext in `HILFE` (Teil 9), Test in `tests/ps-konsole.test.ts`.

**Tests:** `npm test` (Node-Testrunner wie die übrigen Tests; Vitest ist im Projekt nicht installiert). `tests/ps-konsole.test.ts` vergleicht 356 Befehlsblöcke mit der Ausgabe von echtem PowerShell 7.6.1 (`tests/fixtures/ps-konsole-pwsh76.json`) und prüft Tokenizer, Parser, Operatoren, Prozesse, Dienste, Netz, Hilfe, Rückfragen, Aufgaben-Kontext, Vervollständigung, Färbung und Sicherheit. Messaufbau der Fixture: Leas Ordner wurde im Temp-Verzeichnis nachgebaut (gleiche Namen, Grössen, Zeiten, Inhalte, versteckte Elemente), jeder Block lief in `pwsh -NoProfile` mit `$PSStyle.OutputRendering = 'PlainText'` und `Out-String -Width 120`, Fehlerblöcke in einem eigenen pwsh-Prozess; der Pfad des Messordners wurde durch `C:\Users\lea` ersetzt. Blöcke mit Messartefakten (langer Messpfad, Zeitstempel, englische statt deutsche OS-Meldungen) laufen nur mit (`erwartet: null`). Prozesse, Dienste, Netz, Laufwerke und Umgebungsvariablen gibt es nur im Spiel-Rechner; ihre Ansichten folgen den Formatdefinitionen von pwsh 7.6 (`Get-FormatData`) und wurden mit nachgebildeten Objekten in echtem pwsh geprüft.
