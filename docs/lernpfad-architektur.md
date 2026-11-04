# Lernpfad AVSW: Architektur-Engine

**Version:** Architektur-Engine 1.1.0 auf Baukasten 1.2.0. Gilt für Seiten des Fachs `avsw` (Verteilte Softwarearchitekturen) und den Architektur-Leitstand.

Verbindlich für Typen, Kategorien, Modell-JSON, Verbindungsarten, Spiel und Spielstand ist der Vertrag `docs/architektur-modell.md`. Dieses Dokument beschreibt, wie du die Engine auf einer Seite einsetzt.

| Datei | Zweck |
|-------|-------|
| `public/lernpfad/architektur.css` | Farbtokens der Kategorien und Zustände (hell, dunkel), AVSW-Akzent Petrol, farbigeres Erscheinungsbild der AVSW-Seiten, alle Klassen `ar-…` |
| `public/lernpfad/architektur.js` | `window.Architektur`: Diagramm in UML-Notation (SVG) mit Steckbrief, Abläufen und Ausfall; Atlas; Editor; Modellierspiel. Vanilla-JS, keine Bibliotheken |
| `content/lernseiten/avsw/_vorlage.html` | Muster mit Farbsystem, Diagramm (Webshop mit Broker, zwei Abläufe, Ausfall), Mini-Atlas (drei Stile), Editor, Spiel (drei Levels), UML-Komponentendiagramm in Modulnotation und Prüfungsspiel (`modus: "uml"`) |

**Schnellstart:** Kopiere aus `content/lernseiten/avsw/_vorlage.html` den Kopf (beide Stylesheets) und das Ende von `<body>` (beide Scripts), dann den Baustein, den du brauchst. Für alle anderen Bausteine gilt `docs/lernpfad-baukasten.md`.

## Inhalt

1. [Einbinden](#1-einbinden)
2. [Farbsystem und AVSW-Erscheinungsbild](#2-farbsystem-und-avsw-erscheinungsbild)
3. [Diagramm](#3-diagramm) (mit [3.1 Modulnotation UML](#31-modulnotation-uml-komponentendiagramm-mit-paketen) und [3.2 Plaketten, Fluss, Startzoom](#32-plaketten-fluss-startzoom))
4. [Atlas](#4-atlas)
5. [Editor](#5-editor)
6. [Modellierspiel](#6-modellierspiel) (mit [6.1 Prüfungsspiel in Modulnotation](#61-prüfungsspiel-in-modulnotation-modus-uml))
7. [Barrierefreiheit und Bedienung](#7-barrierefreiheit-und-bedienung)
8. [Grenzen](#8-grenzen)
9. [Prüfliste](#9-prüfliste)

## 1. Einbinden

```html
<head>
  …
  <link rel="stylesheet" href="/lernpfad/lernpfad.css">
  <link rel="stylesheet" href="/lernpfad/architektur.css">
</head>
<body data-fach="avsw" data-thema="02-kommunikation">
  …
  <script src="/lernpfad/lernpfad.js"></script>
  <script src="/lernpfad/architektur.js"></script>
  <script>
    (function () { "use strict"; const A = window.Architektur; /* … */ })();
  </script>
</body>
```

- `architektur.js` steht **nach** `lernpfad.js` (es nutzt `Lernpfad.formeln` für Formeln in Steckbriefen und Texten), `architektur.css` nach `lernpfad.css`. Die falsche Reihenfolge meldet `npm run lernseiten:pruefen` als Fehler.
- Ohne `lernpfad.js` läuft die Engine auch (Leitstand), dann ohne Formelsatz.
- Alle Funktionen nehmen als erstes Argument ein Element oder einen Selektor, leeren es und füllen es neu. Fehler erscheinen als `[Architektur] …` in der Konsole, die Funktion gibt `null` zurück, die Seite läuft weiter.
- Texte in Modellen (`info`, `text`, `auftrag`, Katalog-Listen) sind HTML; Namen, Labels und Technologien erscheinen im SVG als reiner Text.
- Diagramme, Atlas und Spiel sind auf Bildschirmen ab 1000 px breiter als die Lesespalte (bis 1240 px, Klasse `ar-weit`). Mit `breit: false` bleiben sie in der Spalte.

## 2. Farbsystem und AVSW-Erscheinungsbild

Jede Kategorie hat ein Token für Rand und Text (`--k-…`) und eines für die gedämpfte Fläche (`--k-…-bg`); die Klassen `ar-k-<kategorie>` setzen daraus `--ar-c` und `--ar-bg`. Zustände: `--z-fehler`, `--z-langsam` (beeinträchtigt), `--z-neu` (= `--lit`), `--z-ok` (= `--ok`).

| Kategorie | Klasse | Hell Rand / Fläche | Dunkel Rand / Fläche |
|-----------|--------|--------------------|----------------------|
| Client | `ar-k-client` | `#1d5fd0` / `#e5eefc` | `#7cb0ff` / `#152540` |
| Zugang | `ar-k-zugang` | `#07708d` / `#ddf1f6` | `#45c4e0` / `#0f2c35` |
| Sicherheit | `ar-k-sicherheit` | `#c0246a` / `#fce6f0` | `#ff85ba` / `#3d162a` |
| Dienste | `ar-k-dienst` | `#127434` / `#e2f3e7` | `#62d68e` / `#11301c` |
| Messaging | `ar-k-messaging` | `#7438dc` / `#efe7fd` | `#b896ff` / `#261a42` |
| Daten | `ar-k-daten` | `#a84b00` / `#fdeedb` | `#f3aa55` / `#37260f` |
| Extern | `ar-k-extern` | `#5f6670` / `#eceef1` | `#adb2bb` / `#25272c` |
| Infrastruktur | `ar-k-infrastruktur` | `#3d4c7a` / `#e6e9f3` | `#9eaee0` / `#1c2238` |
| Fehler (Zustand) | – | `#bd2a1b` / `#fde4e1` | `#ff7b70` / `#45191a` |
| beeinträchtigt | – | `#b54708` / `#fff0e0` | `#ffa857` / `#3f2610` |

Kontraste (WCAG 2.1): jede Rand-/Textfarbe hell mindestens 4.85:1 auf `--bg`, `--surface`, `--board` und der eigenen Fläche, dunkel mindestens 5.91:1. Text (`--ink`) auf allen Flächen ≥ 14:1 hell, ≥ 11:1 dunkel; `--muted` ≥ 5.4:1.

**AVSW-Akzent:** `body[data-fach="avsw"]` setzt `--accent` Petrol: hell `#0b6f7c` (5.45:1 auf `--bg`, 5.87:1 auf `--surface`, 4.97:1 auf `--accent-soft` `#dcf0f2`), dunkel `#4fd0da` (10.21 / 9.47; `--accent-soft` `#10343a`).

**Farbigeres Erscheinungsbild** (nur `body[data-fach="avsw"]`, andere Fächer bleiben unverändert):

| Was | Wie |
|-----|-----|
| Farbleiste über dem Seitenkopf | automatisch (acht Kategorien) |
| Abschnitts-Überzeilen | `.eyebrow` als farbige Pille mit Nummer; Farbe wechselt je Abschnitt, mit `<section data-kategorie="messaging">` bestimmst du sie selbst |
| Konzeptkarten | `.concept` mit Farbbalken oben; `<div class="concept" data-kategorie="daten">` |
| Hinweise | `.note` mit Farbstrich links; `<p class="ar-callout" data-kategorie="messaging"><b>Merke:</b> …</p>` in Kategoriefarbe |
| Farbsystem als Legende | `.ar-farbsystem` mit `.ar-farbe.ar-k-…` (Beispiel in der Vorlage) |

## 3. Diagramm

```js
const d = Architektur.diagramm("#webshop", modell, { ablauf: true, ausfall: true, legende: true, steckbrief: true });
d.ablaufStarten("bestellen");       // Ablauf wählen und abspielen
d.setzeZustand("lager", "ausfall"); // "ok" | "langsam" | "ausfall" | "neu"
d.markiere(["best", "v4"]);        // Elemente/Verbindungen hervorheben, [] hebt auf
d.waehle("best");                   // Steckbrief zeigen
d.modell();                         // Kopie des normalisierten Modells
```

Modell nach Vertrag Abschnitt 4. Ohne `x`/`y` legt die Engine das Diagramm selbst aus (Schichten nach Kategorie, Gruppen zusammen, Verfeinerungen im Vertrag). Für besondere Formen (z. B. Hexagon) kannst du alle Elemente mit `x` (Spalte) und `y` (Zeile) setzen.

Was die Seite zeigt:

- **UML-Formen:** Komponente mit Komponentensymbol und «Stereotyp», Datenbank als Zylinder, Queue/Topic mit Fächern, Akteur, Artefakt, Ordner (Objektspeicher), Node als 3D-Quader, Paket mit Reiter, gestrichelte Grenze, Lollipop-Schnittstelle, Bus als Balken. Kategoriefarbe als Rand, gedämpfte Fläche, kleines Piktogramm.
- **Linien** rechtwinklig um Elemente herum, Beschriftung mittig auf eigenem Grund, Pfeilspitzen je Art (gefüllt, offen, Lollipop, doppelte Linie).
- **Steckbrief** rechts (unter dem Diagramm auf schmalen Bildschirmen): was, kann, wofür, Technologie, warum; dazu die Verbindungen des Elements in Worten. Ohne `info` zeigt er Typ und typische Technologien.
- **Hover/Fokus** hebt Nachbarn und Verbindungen hervor. **Legende:** Kategorie antippen hebt sie hervor.
- **Abläufe:** Punkte wandern entlang der Linien (auch rückwärts entlang einer Verbindung, z. B. Antworten), parallele Schritte gleichzeitig, Fehler-Schritte lassen das Element rot blinken (⚡). Phasenleiste aus `phase`. Steuerung Zurück, Abspielen/Pause, Vor, Von vorn, Tempo. Schritte ohne passende Verbindung laufen über eine gestrichelte Hilfslinie.
- **Ausfall-Modus:** Element antippen → Ausfall (rot, ⚡). Wer synchron (`sync`, `daten`, `abhaengigkeit`, `realisiert`, `stream`) davon abhängt, ist beeinträchtigt (orange, !), und zwar über die ganze Aufrufkette. Asynchron über einen Broker: Der Broker staut (▤), der Sender läuft weiter; die Analyse sagt «Nachrichten stauen sich im Broker». Asynchron ohne Puffer: Nachrichten gehen verloren. Abläufe zeigen den Ausfall im betroffenen Schritt. Ein ausgefallener Knoten/Pod nimmt alles mit, was darin liegt.
- **Zoom:** −, +, Einpassen; Ziehen verschiebt, Ctrl+Mausrad und zwei Finger zoomen. Auf schmalen Bildschirmen startet das Diagramm mit Mindestgrösse und lässt sich verschieben.
- **Textliste** «Alle Elemente und Verbindungen als Text» (aufklappbar) mit Abläufen.

### 3.1 Modulnotation: UML-Komponentendiagramm mit Paketen

Mit `notation: "uml-komponenten"` zeichnet die Engine Diagramme so, wie sie in der Modulschlussprüfung verlangt sind (Vertrag Abschnitt 10): verschachtelte UML-Pakete mit Reiter, Komponenten mit Komponentensymbol, «Stereotyp» und Name, bereitgestellte Schnittstellen als Ball mit Namen, benötigte als Socket am Aufrufer, Assoziationen (Linie ohne Pfeil) mit Beschriftung «Protokoll · Format», gestrichelte Abhängigkeiten (auch Paket → Paket), Notizen mit Eselsohr und `{xor}` zwischen zwei Verbindungen. Farbe = **Rolle** wie im Referenzkatalog.

```js
Architektur.diagramm("#mehrschicht", {
  notation: "uml-komponenten",
  pakete: [
    { id: "app", name: "Velo-Verleih", spalte: 0, zeile: 0, hoehe: 2 },   // Wurzelraster: links die Anwendung …
    { id: "client", name: "Client Tier", in: "app" },                   // ohne Lage: untereinander
    { id: "server", name: ".NET-Server (Middle Tier)", in: "app" },
    { id: "bl", name: "Business Logic Layer", in: "server", spalte: 0, zeile: 0 },
    { id: "asy", name: "Async Comm. Layer", in: "server", spalte: 1, zeile: 0 },
    { id: "mom", name: "MOM", spalte: 1, zeile: 0 }                     // … rechts die Umsysteme
  ],
  elemente: [
    { id: "app1", typ: "mobile", name: "MAUI App", in: "client" },                          // Rolle aus dem Typ: client
    { id: "aus", typ: "dienst", rolle: "business", name: "Ausleihe", stereotyp: "C#", in: "bl" },
    { id: "send", typ: "dienst", rolle: "async", name: "Sender Adapter", stereotyp: "C#", in: "asy" },
    { id: "broker", typ: "broker", name: "Message Broker", in: "mom",
      schnittstellen: [{ id: "amqp", name: "AMQP", seite: "links" }] }                      // Ball: oben (Standard), unten, links, rechts
  ],
  verbindungen: [
    { von: "aus", nach: "send" },                                        // Standard: Assoziation
    { von: "send", nach: "broker#amqp", protokoll: "AMQP", format: "JSON" }, // Ziel = Ball → Socket am Aufrufer, Label «AMQP · JSON»
    { von: "client", nach: "server", art: "abhaengigkeit" }               // Paket → Paket, gestrichelt mit offener Spitze
  ],
  notizen: [{ id: "n1", text: "MDB = Message-Driven Bean", an: "send" }],
  einschraenkungen: [{ text: "{xor}", zwischen: ["v1", "v2"] }]
});
```

| `rolle` | Farbe | für |
|---------|-------|-----|
| `client` | Apricot | Client-Apps, Präsentationskomponenten |
| `webapi` | Grün | Web API, Web Services, Service-Consumer-Apps |
| `business` | Türkis | Domänen-/Business-Komponenten, Facade, Microservices |
| `shared` | Blau | Shared Services |
| `async` | Pink | Receiver-/Sender-Adapter, Message Broker |
| `sync` | Gelb | Driven Adapter, Service-Provider-Apps |
| `daten` | Grau | DACs, Datenbanken, Data Services |
| `infra` | Lavendel | Docker-Host-MQ, Infrastruktur |
| `extern` | Weiss, gestrichelt | Umsysteme ohne besondere Rolle |

Tokens `--r-<rolle>` (Rand) und `--r-<rolle>-bg` (Fläche) hell und dunkel; Text bleibt `--ink` (Kontrast ≥ 12.9:1 hell, ≥ 10.4:1 dunkel auf allen Rollenflächen; Stereotyp in `--muted` ≥ 4.85:1; Rand zur Fläche ≥ 3.95:1). Pakete: `--r-paket`, `--r-paket-bg`, `--r-paket-bg2` (verschachtelte Pakete im Wechsel).

**Layout:** Jedes Paket ist ein Raster: Kinder (Pakete, Komponenten, Notizen) mit `spalte`, `zeile`, `breite`, `hoehe` (Zellen) liegen dort; Kinder ohne Lage füllen die nächste freie Zelle. Hat kein Kind eine Lage, fliessen Komponenten in Reihen (höchstens vier) und Pakete stehen untereinander. Pakete in derselben Reihe werden gleich hoch, alle Pakete füllen die Breite ihrer Zelle. Linien laufen rechtwinklig um Komponenten, Bälle, Ball-Beschriftungen und Paketreiter herum; Linien zu demselben Ball treffen sich am Ball (wie im Original).

**Ausfall in der Modulnotation:** Assoziationen zählen als synchron, ausser das Protokoll (auch der Name der Ziel-Schnittstelle) ist asynchron (AMQP, JMS, MQTT, Kafka …) oder eine Seite ist ein Puffer (Typ `broker`, `queue`, `topic`, `bus` oder eine Komponente mit «MOM»/«Broker» im Namen oder Stereotyp). Die Richtung der Linie spielt dabei keine Rolle:

- Fällt ein Empfänger hinter dem Broker aus (z. B. Receiver Adapter → Broker), stauen sich die Nachrichten im Broker; Sender laufen weiter.
- Fällt der Broker aus, sind die Sender beeinträchtigt; Empfänger (Name mit «Receiver», «Empfänger», «Consumer» …) laufen, bekommen aber keine Nachrichten.

**Netze (IoT):** Typ `netz` oder `bus` mit Stereotyp «network» erscheint in der Modulnotation als Band (kein Komponentensymbol) und zählt nicht als Broker. Fällt ein Netz aus, ist die Verbindung der Nachbarn unterbrochen; ein Gateway (Typ `gateway` oder Name mit «Gateway») puffert die Daten (Store and Forward).

**Notizen** hängen an einem Element oder an einer Verbindung (`an: "<verbindungs-id>"`, gestrichelt zur Linienmitte).

Eine IDs-Regel: Pakete und Komponenten teilen sich die IDs (`web` darf nicht Paket und Komponente zugleich sein).

### 3.2 Plaketten, Fluss, Startzoom

Für eigene Anzeigen (z. B. Architektur-Leitstand) gibt `diagramm` zusätzlich zurück:

```js
const d = Architektur.diagramm("#lage", modell, { massstab: 0.8 });  // Startzoom (Massstab 1 = Weltkoordinaten in px)
Architektur.diagramm("#gross", modell, { einpassen: true });         // Start eingepasst: ganzes Diagramm sichtbar
d.plakette("best", "3 Instanzen", "ar-plakette-warn");  // Plakette am Element oder an einer Verbindung (Text, Klassen: ar-plakette-warn | -fehler | -ok)
d.entfernePlakette("best");                              // ohne ID: alle
d.fluss("v3", { an: true, tempo: 2 });                    // Linie animiert «fliessen» lassen, ohne Ablauf; { an: false } stoppt
d.modell();                                               // sauberes Modell nach Vertrag
```

Startzoom ohne Angabe: Das Diagramm füllt die Breite (höchstens Massstab 1.08). Ist es dafür zu breit, startet es lesbar (Massstab 0.92, unter 600 px 0.74) und verschiebt sich in sich. Ausnahme: Auf Fenstern ab 1000 px Breite wird bis zu einem Massstab von 0.7 eingepasst (Diagramme bis etwa 1700 px Breite erscheinen ganz). Mit `massstab`, `einpassen` oder `kMin` bestimmt die Seite das selbst.

`modell()` von `diagramm` und `editor` liefert das Modell in Vertragsform: keine leeren Felder, kein `info: null`, kein `zustand: "ok"`, Namen unverändert, unbekannte Zusatzfelder der Eingabe (z. B. `sim`) unverändert durchgereicht. Bei «Bewegung reduzieren» bleibt die Fluss-Linie stehen (gestrichelt, ohne Bewegung).

## 4. Atlas

```js
const atlas = Architektur.atlas("#atlas", window.ATLAS_KATALOG, { titel: "Atlas der Architekturstile" });
atlas.zeigeStil("mom");                 // Detail öffnen
atlas.vergleiche("mom", "microservices");
atlas.karte();                          // zurück zur Karte
atlas.entdeckt();                       // ["mom", …]
```

Katalog nach Vertrag Abschnitt 6.1. Die Karte zeigt Familien als Regionen in ihrer Kategoriefarbe (`familie.farbe`), Stile als Orte mit Symbol (`symbol` oder das kennzeichnendste Element des Modells), verwandte Stile als Wege. Filter-Chips für Kopplung, Kommunikation und Einsatz blenden Orte aus. Unter der Karte stehen alle Stile als Liste (Knöpfe), auch für Screenreader und schmale Bildschirme.

Ein Ort öffnet die Detailansicht: Kopf mit Familie, Kurzbeschreibung und Merkmalen, das Diagramm des Stils (mit Abläufen und Ausfall), Reiter «Was es kann · Wofür · Technologien und warum · Stärken und Schwächen · Passt wenn / nicht», verwandte Stile und «Vergleichen mit …» (zwei Diagramme nebeneinander und eine Vergleichstabelle). «Entdeckt» zählt die geöffneten Stile dieser Sitzung (nicht gespeichert).

## 5. Editor

```js
const ed = Architektur.editor("#editor", {
  palette: ["web", "gateway", { typ: "dienst", name: "Bestellservice" }, "datenbank"],
  modell: { elemente: [{ id: "web", typ: "web", name: "Web", x: 0, y: 0 }], verbindungen: [] },
  raster: { spalten: 4, zeilen: 3 },
  arten: ["sync", "async", "daten"],
  onChange: (m) => console.log(m.elemente.length),
});
ed.modell(); ed.setzeModell(m); ed.markiere(["web"], "ar-ok");
```

- **Platzieren:** Baustein aus der Palette auf ein Feld ziehen (Maus, Touch, Stift), oder antippen und dann ein Feld antippen. Tastatur: Baustein mit Enter wählen, Pfeiltasten wählen das Feld, Enter legt ab, Escape bricht ab. Palette-Einträge mit `id` lassen sich einmal legen (Spiel).
- **Verbinden:** Element wählen, vom Griff (Punkt am Rand) auf das Ziel ziehen. Oder: Element wählen, «Verbinden» (Taste V), Ziel wählen. Danach öffnet sich das Art-Menü mit UML-Vorschau der Linien, optionaler Beschriftung, «Richtung umkehren», «Löschen».
- **Bearbeiten:** gewähltes Element mit Pfeiltasten oder Ziehen verschieben, Entf löscht, Name im Feld «Name» (nur freie Elemente). Rückgängig/Wiederholen (Ctrl+Z / Ctrl+Y, 60 Schritte).
- Unter der Fläche: «Modell als Liste» mit Knopf «Bearbeiten» je Verbindung.

## 6. Modellierspiel

```js
Architektur.spiel("#spiel", {
  spielId: "avsw-02-kommunikation", fach: "avsw", titel: "Vom Text zur Architektur",
  levels: [{
    id: "l1", titel: "Pizza online", schwierigkeit: 1, zielzeit: 120,
    auftrag: '<p>Die <span data-baustein="web">Webseite</span> ruft synchron den <span data-baustein="best">Bestellservice</span> auf …</p>',
    palette: [{ id: "web", typ: "web", name: "Webseite" }, { id: "best", typ: "dienst", name: "Bestellservice" },
              { id: "cache", typ: "cache", name: "Cache", ablenker: true }],
    loesung: { elemente: ["web", "best"], verbindungen: [{ von: "web", nach: "best", art: "sync", warum: "«ruft synchron auf»" }] },
    erklaerung: "<b>Merke:</b> …"
  }]
});
document.addEventListener("architektur:spiel", (e) => console.log(e.detail));
```

- **Levelkarte** mit Pfad, Schlössern (frei ab einem Stern im Level davor) und Sternen. Ein gesperrtes Level wackelt und sagt, was fehlt.
- **Spielfeld:** Auftrag mit Textstellen (`data-baustein`), die man antippen und markieren kann; sie bekommen ✓, sobald der Baustein liegt. HUD mit Zeit/Zielzeit, möglichen XP, Serie, Tipps (gestuft: Textstelle → Baustein → Verbindung, kosten 5/10/15 XP). Spielfeld ist der Editor.
- **Prüfen:** 100 % → Level geschafft. Sonst Treffer ✓/✗ direkt im Diagramm, Rückmeldung ohne die Lösung zu verraten, Fehlversuch zählt (drei Sterne nur ohne Fehlversuch); «Weiter verbessern» oder «Mit x % abgeben».
- **Ergebnis:** Sterne mit Animation (Konfetti ab zwei Sternen, nicht bei «Bewegung reduzieren»), XP-Aufschlüsselung, Bestwert, Speicherstatus, «Musterlösung ansehen» (animierter Ablauf: jede Verbindung mit `warum`), «Nochmals», «Nächstes Level», «Zur Levelkarte».
- **Prüfungsmodus** `pruefung: true`: keine Tipps, kein Zwischen-Prüfen, Knopf «Abgeben»; Lösung erst danach. Rückgabe `{ starten, levelkarte, abgeben, ergebnis, ergebnisse, bestwerte }`.
- **Speichern:** nach jedem Level mit neuem Bestwert `POST /api/spielstand` (Vertrag Abschnitt 8), beim Start `GET /api/spielstand?fach=…` für Bestwerte und Freischaltungen. Fehler (nicht angemeldet, offline) fängt das Spiel ab: «nicht gespeichert», das Ergebnis gilt für die Sitzung. `speichern: false` schaltet das aus. Die Vorschau (`scripts/lernpfad-vorschau.mjs`) hat eine Attrappe der API im Speicher.

Gute Level: Jede Lösungs-Verbindung folgt aus einem Signalwort im Auftrag («ruft auf», «fragt» = synchron; «veröffentlicht», «abonniert» = asynchron; «speichert», «liest» = Daten). Mindestens ein Ablenker. Höchstens vier Spalten (Handy).

### 6.1 Prüfungsspiel in Modulnotation (`modus: "uml"`)

Ein Level mit `modus: "uml"` (oder `cfg.modus: "uml"` für alle) übt die Prüfungsaufgabe: vorgegebene, leere Pakete sind Ablagefelder. Felder nach Vertrag Abschnitt 10.3.

```js
Architektur.referenzen["dotnet"] = { notation: "uml-komponenten", pakete: [ … ], elemente: [ … ], verbindungen: [ … ] };  // Tipp «Referenz»
Architektur.spiel("#pruefung", {
  spielId: "avsw-05-mehrschicht", fach: "avsw",
  levels: [{
    id: "kino", modus: "uml", titel: "Kino-Reservation", schwierigkeit: 3, zielzeit: 900, referenz: "dotnet",
    auftrag: "<p>… <span data-baustein=\"facade\">Facade</span> …</p>",
    pakete: [{ id: "app", name: "Kino", spalte: 0, zeile: 0 }, { id: "fac", name: "Business Facade", in: "app" }, …],
    palette: [
      { id: "facade", typ: "dienst", rolle: "business", name: "Business API", stereotypen: ["C#", "EJB"], schnittstellen: [{ id: "rest", name: "REST" }] },
      { id: "iis", typ: "dienst", rolle: "infra", name: "IIS Web Server", falle: "Ein Web-Server ist Infrastruktur, keine Komponente." }
    ],
    protokolle: ["REST", "SOAP", "AMQP", "HTTP"],          // Auswahl an der Verbindung (Standard: Liste aus dem Vertrag)
    loesung: {
      elemente: [{ id: "facade", paket: "fac", stereotyp: "C#" }],
      verbindungen: [{ von: "razor", nach: "facade#rest", protokoll: "REST", warum: "…" }],
      beschreibungen: [{ id: "facade", optionen: ["…", "…", "…"], richtig: 1 }]
    },
    gewichte: { komponenten: 2, pakete: 1, stereotypen: 1, verbindungen: 2, beschriftungen: 1, beschreibungen: 1 }
  }]
});
```

Weitere Level-Felder:

- `vorgegeben: { elemente: [{ id, typ, rolle, name, paket, stereotyp, schnittstellen }], verbindungen: [{ von, nach, protokoll }] }`: fest platziert, nicht verschieb- oder löschbar, verbindbar. Vorgegebenes ist geschenkt (zählt weder als Punkt noch als Fehler).
- `loesung.elemente[].paket: null`: die Komponente gehört ausserhalb der Pakete. Dann gibt es eine freie Fläche (neben den Paketen ablegen; Tastatur: Pfeiltasten bis «freie Fläche», Enter; im Panel «(freie Fläche …)»). Mit `freieFlaeche: true` gibt es sie auch ohne solche Lösung.
- Mehrere Verbindungen zwischen demselben Paar (z. B. AMQP und JMS zum selben Broker) ordnet die Bewertung über Ziel-Schnittstelle und Protokoll zu, nicht über die Reihenfolge.
- `loesung.verbindungen[].alternativen: [{ von, nach, art, protokoll }]`: gleichwertige Varianten (z. B. bei `{xor}`); eine davon genügt. Die Musterlösung zeigt die Hauptvariante.

Bedienung: Komponente aus der Palette in ein Paket ziehen (Maus, Touch, Stift) oder antippen und dann das Paket wählen (Tastatur: Enter, Pfeiltasten wechseln das Paket, Enter legt ab, Escape bricht ab). Im Eigenschaften-Panel: Stereotyp (Auswahl aus `stereotypen`), Paket ändern, Schnittstellen (Ball) hinzufügen und benennen, Beschreibung wählen. Verbinden: Element wählen, «Verbinden» oder Taste V, Ziel wählen (Komponente, Ball oder Paket); danach im Panel Art, Ziel-Schnittstelle, Protokoll (Auswahl) und Format (frei) setzen. Rückgängig (Ctrl+Z).

Bewertung je Kriterium mit Teilpunkten (Raster): Komponenten (überflüssige kosten halb), Pakete (Lage), Stereotypen, Verbindungen (Paar; Art und Ball geben Teilpunkte), Beschriftungen (Protokoll), Beschreibungen; Gewichte aus `gewichte`. Jede Falle (`falle`) zieht 8 % ab und erklärt warum. «Prüfen» zeigt das Raster, ✓/✗ an Komponenten, Paketen und Linien und konkrete Hinweise («Sender Adapter gehört in Async Comm. Layer»). Tipps: 1 = Referenzarchitektur aus `Architektur.referenzen[referenz]` einblenden, 2 = fehlende Komponente oder falsches Paket, 3 = fehlende Verbindung gestrichelt. Musterlösung als Diagramm in Modulnotation mit Ablauf und Begründungen; Prüfungsmodus und Speichern wie beim normalen Spiel.

`ergebnis(levelId)`, `ergebnisse()` und das Ereignis `architektur:spiel` enthalten zusätzlich `kriterien: [{ id, name, erreicht, max, punkte, gewicht }]` und `fallen: [{ id, text }]` (beim normalen Spiel ein Kriterium «Modell»).

**Prüfungsmodus und Steuerung durch die Seite:** Mit `pruefung: true` sind alle Levels offen (keine Schlösser). `einzelabgabe: false` blendet «Prüfen/Abgeben» und «Lösung zeigen» aus; die Seite gibt mit `abgeben()` ab. `pausiere()` hält die Spieluhr an, `fortsetzen()` lässt sie weiterlaufen (die pausierte Zeit zählt nicht).

## 7. Barrierefreiheit und Bedienung

- Elemente im SVG sind mit Tab erreichbar (`role="button"`, `aria-label` mit Name, Stereotyp, Kategorie, Technologie, Gruppe und Zustand); Enter/Leertaste öffnet den Steckbrief bzw. lässt im Ausfall-Modus ausfallen. Fokus ist als Ring sichtbar, das Diagramm schiebt fokussierte Elemente ins Bild.
- Diagrammfläche: Pfeiltasten verschieben, Plus/Minus zoomen, 0 passt ein.
- Rückmeldungen (Steckbrief, Ablauf-Schritte, Ausfall-Analyse, Editor-Status, Spiel-Rückmeldungen) stehen in `aria-live`-Bereichen.
- Farbe nie allein: Form und «Stereotyp» je Element, Linienstil je Art, Zustände mit ⚡ / ! / ▤ / ✓ / ✗ und Text.
- Atlas: Orte als Knöpfe in einer Liste unter der Karte, Reiter nach ARIA-Muster (Pfeiltasten, Pos1, Ende).
- `prefers-reduced-motion`: Punkte springen statt zu wandern, kein Blinken, kein Konfetti, keine Hüpfanimation.
- Breite: 320 px ohne seitliches Scrollen der Seite; Diagramme zoomen und verschieben in sich.

## 8. Grenzen

- Auto-Layout ist ein Raster mit Schichten, kein freies Grafik-Layout. Sehr dichte Modelle (mehr als etwa 15 Elemente, viele Querverbindungen) werden eng; dann `x`/`y` setzen oder aufteilen.
- `x`/`y` gelten nur, wenn alle Elemente sie haben. Gruppen ergeben sich aus ihren Mitgliedern; ein Nicht-Mitglied im Rechteck einer Gruppe (nur bei Hand-Layout möglich) wird nicht verhindert.
- Linien weichen Elementen und Gruppenköpfen aus, können aber Gruppenränder kreuzen und sich bei vielen Verbindungen kreuzen (Kreuzungen kosten, sind aber erlaubt).
- Beschriftungen sind einzeilig; lange Namen werden auf zwei Zeilen umbrochen und notfalls gekürzt (Steckbrief und Textliste zeigen den ganzen Namen).
- Der Ausfall-Modus ist qualitativ (wer hängt wovon ab); Last, Latenz und Kosten rechnet der Simulator-Kern (`lib/archsim/`).
- Spielstände sind vom Browser gemeldet und nicht fälschungssicher (Vertrag Abschnitt 8).

## 9. Prüfliste

- [ ] `architektur.css` nach `lernpfad.css`, `architektur.js` nach `lernpfad.js`; `npm run lernseiten:pruefen` ohne Fehler.
- [ ] Vorschau: keine Fehler und keine `[Architektur]`-/`[Lernpfad]`-Meldungen in der Konsole.
- [ ] Jedes Diagramm angesehen (hell, dunkel, 320 px): keine Überlappungen, Labels lesbar, Steckbriefe vollständig (was, kann, wofür, Technologie, warum).
- [ ] Jeden Ablauf bis zum Ende abgespielt, Ausfall an einem synchronen und einem asynchronen Ziel ausprobiert.
- [ ] Spiel: jedes Level einmal richtig (3 Sterne) und einmal mit Fehlern gelöst; Lösungen fachlich geprüft, Ablenker vorhanden.
- [ ] Mit der Tastatur bedient (Tab, Enter, Pfeiltasten, Escape), Fokus immer sichtbar.
