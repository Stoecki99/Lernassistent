# Lernseiten — Datenformat

Lernseiten sind interaktive Themenseiten pro Studienfach (z. B. MSTW). Sie liegen als JSON-Dateien im Repo unter `content/lernseiten/` und werden von der App hinter dem Login angezeigt:

| Adresse | Inhalt |
|---------|--------|
| `/lernseiten` | Liste aller Fächer (Kacheln) |
| `/lernseiten/<fach>` | Themen eines Fachs, gruppiert nach Sektion, plus Spickzettel |
| `/lernseiten/<fach>/<thema>` | Die Lernseite selbst |
| `/<FACH>`, `/<fach>` | Kurzlink, leitet auf `/lernseiten/<fach>` weiter |

Neue Fächer und Themen brauchen **nur Inhaltsdateien**, keinen Code. `npm run lernseiten:pruefen` prüft alle Dateien; dieselbe Prüfung läuft im Docker-Build, fehlerhafte Inhalte stoppen also die Auslieferung.

## Ordnerstruktur

```
content/lernseiten/
  mstw/                                  # Fachordner = Kürzel in Kleinbuchstaben
    fach.json
    04-praedikatenlogik-modellierung/    # NN-slug, NN = Reihenfolge im Semester
      seite.json                         # Text und Lösungsschritte
      film.json                          # Lösungsfilm
      quiz.json                          # Selbsttest
      spick.json                         # Einträge für den Spickzettel des Fachs
```

Fachordner: nur `a-z` und `0-9`, darf nicht wie eine bestehende App-Seite heissen (`chat`, `decks` …). Themenordner: `NN-` plus Kleinbuchstaben, Ziffern und Bindestriche.

## Textfelder: Markdown, Formeln, Symbol-Markup

Alle Felder, die unten mit *(md)* markiert sind, sind Markdown mit zwei Erweiterungen:

- **KaTeX:** `$…# Lernseiten — Datenformat

Lernseiten sind interaktive Themenseiten pro Studienfach (z. B. MSTW). Sie liegen als JSON-Dateien im Repo unter `content/lernseiten/` und werden von der App hinter dem Login angezeigt:

| Adresse | Inhalt |
|---------|--------|
| `/lernseiten` | Liste aller Fächer (Kacheln) |
| `/lernseiten/<fach>` | Themen eines Fachs, gruppiert nach Sektion, plus Spickzettel |
| `/lernseiten/<fach>/<thema>` | Die Lernseite selbst |
| `/<FACH>`, `/<fach>` | Kurzlink, leitet auf `/lernseiten/<fach>` weiter |

Neue Fächer und Themen brauchen **nur Inhaltsdateien**, keinen Code. `npm run lernseiten:pruefen` prüft alle Dateien; dieselbe Prüfung läuft im Docker-Build, fehlerhafte Inhalte stoppen also die Auslieferung.

## Ordnerstruktur

```
content/lernseiten/
  mstw/                                  # Fachordner = Kürzel in Kleinbuchstaben
    fach.json
    04-praedikatenlogik-modellierung/    # NN-slug, NN = Reihenfolge im Semester
      seite.json                         # Text und Lösungsschritte
      film.json                          # Lösungsfilm
      quiz.json                          # Selbsttest
      spick.json                         # Einträge für den Spickzettel des Fachs
```

Fachordner: nur `a-z` und `0-9`, darf nicht wie eine bestehende App-Seite heissen (`chat`, `decks` …). Themenordner: `NN-` plus Kleinbuchstaben, Ziffern und Bindestriche.

## Textfelder: Markdown, Formeln, Symbol-Markup

Alle Felder, die unten mit *(md)* markiert sind, sind Markdown mit zwei Erweiterungen:

 inline. Abgesetzt nur mit `$` auf eigenen Zeilen (`$`, Zeilenumbruch, Formel, Zeilenumbruch, `$`); `$…$` auf einer Zeile wird inline gesetzt. In JSON den Backslash verdoppeln: `"$\frac{1}{2}$"`.
- **HTML-Spans** für Logik-Formeln und Verknüpfungen. Gedacht sind `span`, `strong`, `em`, `br`, `sub`, `sup`. Ein Filter (`rehype-sanitize`) lässt nur harmlose Tags durch; bei `span` bleiben nur die Klassen aus der Tabelle unten sowie `data-link` und `data-ph`. Skripte, `style`, Event-Handler und unbekannte Attribute werden entfernt.

| Klasse | Bedeutung |
|--------|-----------|
| `m` | Formel-Container (Mathe-Schrift) |
| `v` | Variable |
| `c` | Konstante |
| `fn` | Funktion |
| `p` | Prädikat |
| `q` | Quantor |
| `nw` | Neu hinzugekommener Teil (kurz gelb hinterlegt) |

**Zuordnung:** Elemente mit gleichem `data-link="<id>"` leuchten gemeinsam auf (Hover, Tastaturfokus, Antippen). Damit verbindet man ein Satzstück in der Aufgabe mit dem passenden Formelteil.

**Film-Hervorhebung:** `data-ph="<id>"` markiert Stellen im Aufgabentext des Films, die eine Szene über `hl` gelb hervorhebt.

## fach.json

```json
{
  "kuerzel": "MSTW",
  "titel": "Mathematik und Statistik Wirtschaftsinformatik",
  "beschreibung": "Logik sowie Wahrscheinlichkeitstheorie und schliessende Statistik.",
  "icon": "∑",
  "farbe": "#1CB0F6",
  "semester": "HS26",
  "sektionen": [
    { "id": "s1", "titel": "Sektion 1 · Logik" },
    { "id": "s2", "titel": "Sektion 2 · Wahrscheinlichkeit und schliessende Statistik" }
  ]
}
```

`kuerzel` in Kleinbuchstaben muss dem Ordnernamen entsprechen. `farbe` als `#RRGGBB`.

## seite.json

Die Reihenfolge der Abschnitte ist fest (didaktisches Gerüst): Bausteine → Lösungsschritte → Analyse (optional) → Lösungsfilm → Selbsttest → Auf einen Blick.

```json
{
  "titel": "Prädikatenlogik: Sätze modellieren",
  "sektion": "s1",
  "vorlesung": "S1-V4&5",
  "beispiele": ["4.3", "4.6"],
  "weight": 40,
  "dauer_min": 25,
  "lernziele": ["Sätze in prädikatenlogische Formeln übersetzen"],
  "musterloesung": true,
  "einleitung": "(md, optional)",

  "bausteine": {
    "begriffe": [
      { "name": "Prädikat", "analogie": "(md)", "beispiel": "(md)" }
    ],
    "uebung": {
      "frage": "Ding oder Aussage?",
      "kategorien": ["Ding", "Aussage"],
      "elemente": [
        { "text": "(md)", "kategorie": 0, "begruendung": "(md)" }
      ]
    }
  },

  "schritte": {
    "muster": "(md) So löst du jede solche Aufgabe: …",
    "methode": ["1) Definition der Symbole", "2) Übersetzung", "3) Zusammenstellen"],
    "aufgaben": [
      {
        "id": "satz1",
        "titel": "Bsp. 4.3 a",
        "aufgabe": "(md) Manche <span data-link=\"stud\">Studenten</span> …",
        "woerterbuch": [
          { "symbol": "(md) <span class=\"m\"><span class=\"p\">S</span>(<span class=\"v\">x</span>)</span>", "bedeutung": "(md)" }
        ],
        "stepper": [
          { "methode": 0, "formel": "(md)", "warum": "(md)" }
        ]
      }
    ]
  },

  "analyse": {
    "titel": "Bsp. 4.6: Freie und gebundene Variablen",
    "text": "(md)",
    "brillen": [
      { "name": "Freie Variablen", "formel": "(md)", "erklaerung": "(md)" }
    ],
    "fragen": [
      { "frage": "(md)", "antwort": "(md)" }
    ]
  },

  "merke": ["(md)"]
}
```

| Feld | Regel |
|------|-------|
| `sektion` | muss eine `id` aus `fach.json` sein |
| `weight` | Sortierung in der Fachübersicht (aufsteigend) |
| `musterloesung` | `false` zeigt den Hinweis «Eigene Lösung, nicht vom Dozenten bestätigt» |
| `bausteine.begriffe` | 3–5 Einträge |
| `uebung.kategorien` | 2–4; `elemente[].kategorie` ist der Index der richtigen Kategorie; mindestens 3 Elemente |
| `stepper[]` | jeder Schritt zeigt den **ganzen bisherigen Formelstand**, Neues mit `class="nw"`; `methode` ist der Index in `schritte.methode` |
| `analyse` | optional; `brillen` mindestens 2 (umschaltbare Ansichten), `fragen` aufklappbar |
| `merke` | 4–6 Merksätze |

## film.json

```json
{
  "phasen": ["1 · Wörterbuch", "2 · Übersetzen", "3 · Zusammensetzen"],
  "texte": ["Manche <span data-ph=\"stud\">Studenten</span> …"],
  "woerterbuch": ["<span class=\"m\"><span class=\"v\">x</span></span> Studenten"],
  "szenen": [
    { "phase": -1, "text": null, "sage": "So löst du jede solche Aufgabe: …" },
    { "phase": 0, "text": "alle", "hl": ["stud"], "wb": 1, "wbAktiv": [0],
      "formel": "<span class=\"nw\">…</span>", "sage": "Warum dieser Schritt …" }
  ]
}
```

| Feld | Regel |
|------|-------|
| `szenen` | 15–35 Szenen, jede ändert genau eine Sache |
| `phase` | `-1` = Intro, sonst Index in `phasen` |
| `text` | `"alle"` = alle Aufgabentexte, Zahl = nur `texte[n]`, `null` = ausblenden |
| `hl` | `data-ph`-IDs, die gelb markiert werden (müssen in `texte` vorkommen; nur `a-z`, `0-9`, `-`) |
| `wb` | Anzahl sichtbarer Wörterbuch-Einträge (von vorne gezählt) |
| `wbAktiv` | Indizes der hervorgehobenen Einträge (müssen sichtbar sein) |
| `formel` | aktueller Formelstand (md), Neues mit `class="nw"` |
| `sage` | Pflicht: ein Erklärsatz, *warum* dieser Schritt |

Fehlende Felder (ausser `sage`) übernehmen den Wert der vorherigen Szene. Startwerte: `phase -1`, `text null`, `hl []`, `wb 0`, `wbAktiv []`, `formel ""`.

Abspielen: Play springt sofort zur ersten Szene mit `phase ≥ 0`. Dauer pro Szene = max(3,5 s, Zeichen von `sage` × 45 ms) / Tempo (langsam 0,75 · normal 1 · schnell 1,5).

## quiz.json

```json
[
  {
    "id": "mstw-04-q1",
    "frage": "(md)",
    "optionen": ["(md)", "(md)", "(md)"],
    "richtig": 0,
    "erklaerung": "(md)",
    "tags": ["freie-variablen"],
    "niveau": 1
  }
]
```

6–10 Fragen, 2–6 Optionen, `richtig` = Index der einzigen richtigen Option, `niveau` 1–3. Die `id` beginnt mit `<fach>-<NN>-` und ist über alle Fächer eindeutig (Grundlage für späteren Prüfungsmodus und Lernfortschritt). Mindestens eine Frage zur typischen Stolperfalle.

## spick.json

```json
[
  { "begriff": "Matrixformel", "kurz": "Formel ohne alle Quantoren", "formel": "(md, optional)", "quelle": "Def. 4.5e" }
]
```

Die Einträge aller Themen eines Fachs erscheinen gesammelt als Spickzettel auf der Fachseite.

## Urheberrecht

Die Fächer sind für alle eingeloggten Konten sichtbar und das Repo ist öffentlich. Deshalb: keine Folien-Screenshots, keine Logos, keine wörtlichen Folientexte ausser der kurzen Aufgabenstellung und Formeln. Definitionen in eigenen Worten mit Verweis auf die Nummer («Def. 4.5c»).
