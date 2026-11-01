# Lernpfad Spieltheorie — Konzept und Spiel-Erweiterung

Stand: 2026-11-01. Fachordner `content/lernseiten/spieltheorie/`, Kurzlink `/spieltheorie`.
Dieses Dokument ist zugleich die Vorlage für die Vault-Notiz `02 Projekte/Lernpfad Spieltheorie.md`.

Format, Prüfung und Auslieferung: `docs/lernpfad-format.md`. Bausteine des Baukastens: `docs/lernpfad-baukasten.md`.
Neu für diesen Lernpfad ist die **Spiel-Erweiterung** `public/lernpfad/st-spiel.css` und `public/lernpfad/st-spiel.js` (Abschnitt 5).

---

## 1. Recherche in Kürze

Spieltheorie untersucht Situationen, in denen das Ergebnis jedes Beteiligten auch von den Entscheidungen der anderen abhängt. Wer klug entscheidet, versetzt sich deshalb zuerst in die Lage der Gegenseite («Was ist ihre beste Antwort auf meinen Zug?»). Die Kernbefunde: Individuell vernünftiges Handeln kann kollektiv schaden (Gefangenendilemma), stabile Lagen sind solche, aus denen niemand allein ausbrechen will (Nash-Gleichgewicht), in reinen Konflikten (Nullsummenspiel) schützt Unberechenbarkeit, und wer sich wiederholt begegnet, kann Kooperation durch freundliche, aber wehrhafte Regeln wie Tit-for-Tat stabilisieren. Sun Tzu und die 36 Strategeme sind in dieser Sprache vor allem Anleitungen zum **Verändern des Spiels** selbst: Information verschleiern oder vortäuschen (Signale, Bluff), Optionen glaubhaft abschneiden (Selbstbindung), den Gegner zu Zügen verleiten, deren Auszahlung du kennst, und Koalitionen schmieden oder spalten.

### 1.1 Grundkonzepte (Auswahl für den Pfad)

| Begriff | Intuition ohne Formel | Alltag |
|---------|----------------------|--------|
| Spieler, Strategie, Auszahlung | Wer entscheidet? Welche Pläne gibt es? Was steht für wen auf dem Spiel? | Jede Verhandlung zuerst so aufzeichnen |
| Dominante Strategie | Ein Zug, der immer besser ist, egal was die anderen tun | Werbung im Wettbewerb, Wettrüsten |
| Gefangenendilemma | Jeder hat einen Anreiz zu verraten, gemeinsam fahren beide schlechter | Preiskampf, Klimaschutz, Doping |
| Beste Antwort | Mein bester Zug, wenn ich den Zug der anderen kennte | «Was würde ich an ihrer Stelle tun?» |
| Nash-Gleichgewicht | Lage, in der keiner allein abweichen will | Konventionen, Standards, Patt |
| Koordinationsspiel, Feigling (Chicken), Hirschjagd | Mehrere Gleichgewichte: Wer gibt nach? Vertrauen wir uns? | Verhandlungsschluss, Eskalation |
| Nullsummenspiel, gemischte Strategie | Was du gewinnst, verliere ich. Berechenbarkeit wird ausgenutzt | Penalty, Kontrollen, Bluff |
| Sequenzielles Spiel, Rückwärtsinduktion | Vom Ende her denken | Preisverhandlung, Karriereplanung |
| Glaubwürdigkeit, Selbstbindung | Leere Drohungen zählen nicht, abgeschnittene Optionen schon | «Schiffe verbrennen», Vertragsstrafen |
| Wiederholtes Spiel, Schatten der Zukunft | Wer morgen wieder handelt, kooperiert heute eher | Stammkundschaft, Nachbarschaft |
| Tit-for-Tat, Grim, Vergebung, Rauschen | Freundlich, wehrhaft, nachsichtig, klar | Teamarbeit, Lieferanten |
| Asymmetrische Information, Signal, Screening | Wer mehr weiss, hat Macht. Teure Signale sind glaubhaft | Bewerbung, Garantie, Bluff |
| Verhandlung: BATNA, Reservationspreis, Zone der Einigung, Ultimatumspiel | Deine beste Alternative bestimmt deine Macht | Lohn, Autokauf, Allianzen |
| Abschreckung, Eskalationsleiter, Brinkmanship | Drohen mit einem Risiko, das man nicht ganz steuert | Geopolitik, Arbeitskampf |
| Koalitionen, Spalten und Verbünden | Wer mit wem? Wer ist Zünglein an der Waage? | Mehrheiten, Allianzen |

### 1.2 Strategeme und Sun Tzu mit spieltheoretischer Lesart

| Klassische Lehre | Spieltheoretische Lesart | Station |
|------------------|--------------------------|---------|
| Sun Tzu: «Der beste Sieg ist der, für den man nicht kämpfen muss» | Das Spiel so verändern, dass der Gegner seine beste Antwort im Nachgeben findet (Abschreckung, Auszahlungen ändern) | 05, 10 |
| Sun Tzu: «Kenne den Feind und dich selbst» | Vollständige Information über Strategien und Auszahlungen anstreben; Informationsvorsprung ist Macht | 01, 07 |
| Sun Tzu: «Alle Kriegsführung beruht auf Täuschung» | Signale und Bluff; gemischte Strategien gegen Ausrechenbarkeit | 04, 07 |
| Sun Tzu: «Lass dem umzingelten Feind einen Ausweg» | Wer nichts zu verlieren hat, kämpft bis zuletzt: Auszahlung des Nachgebens attraktiv halten (goldene Brücke) | 05, 09 |
| Strategem 7 «Aus dem Nichts etwas erzeugen», Strategem 32 «Die leere Festung» | Bluff mit Reputation; funktioniert nur, wenn der Gegner deinen Typ nicht kennt | 07 |
| Strategem 28 «Auf das Dach locken und die Leiter wegnehmen», «Die Kessel zerschlagen, die Boote versenken» | Selbstbindung: Rückzug unmöglich machen macht Drohungen glaubhaft | 05 |
| Strategem 3 «Mit dem Messer eines anderen töten», Strategem 23 «Sich mit dem Fernen verbünden, den Nahen angreifen» | Koalitionsbildung, Stellvertreter, Gleichgewicht der Kräfte | 08, 10 |
| Strategem 2 «Wei belagern, um Zhao zu retten» | Den Gegner dort treffen, wo seine Auszahlung empfindlich ist, statt dort, wo er stark ist | 08 |
| Strategem 17 «Einen Ziegel hinwerfen, um Jade zu erhalten» | Kleines Zugeständnis als Köder: Reziprozität und Anker in Verhandlungen | 09 |
| Strategem 36 «Weglaufen ist die beste Strategie» | Ausstiegsoption (BATNA) nutzen; nicht jedes Spiel muss gespielt werden | 09 |
| Strategem 6 «Im Osten lärmen, im Westen angreifen» | Ablenkung im Nullsummenspiel, Unberechenbarkeit | 04 |
| Strategem 20 «Im trüben Wasser fischen» | Gewinn aus Unsicherheit anderer: Informationsasymmetrie | 07 |

Quellen-Hinweis: Die Strategeme werden in eigenen Worten nach der verbreiteten deutschen Überlieferung (u. a. Harro von Senger) zitiert, Sun Tzu nach freien Übersetzungen. Keine wörtlichen Übernahmen urheberrechtlich geschützter Übersetzungen.

### 1.3 Geopolitik (Stand Oktober 2026, im Pfad als Modell, nicht als Nachricht)

Die Station «Krisenstab» nutzt reale Krisenregionen als **Struktur**: Akteure, Interessen, Optionen, Glaubwürdigkeit. Sie behauptet keine tagesaktuellen Fakten und trägt den Hinweis «Lage ändert sich; Modell, keine Prognose». Recherchierte Ausgangslage:

- **Russland–Ukraine:** Krieg dauert an; lokale Feuerpausen (z. B. Oleshky, Ende Oktober 2026), mögliche dreiseitige Gespräche (USA, Russland, Ukraine) im November. Lesart: Abnutzungskrieg, Verhandlungsmacht hängt an der erwarteten Lage am Boden (BATNA), Glaubwürdigkeit von Garantien.
- **Taiwanstrasse:** anhaltender militärischer Druck, Manöver, Waffenlieferungen der USA. Lesart: Abschreckung, strategische Ambiguität, Feiglingsspiel mit hohen Kosten beider Seiten.
- **Rotes Meer / Hormus:** Huthi-Drohungen gegen die Schifffahrt im Bab al-Mandab, Störungen in der Strasse von Hormus im Zusammenhang mit dem Iran-Konflikt. Lesart: kleine Akteure mit grosser Störmacht (asymmetrische Kosten), Engpässe als Druckmittel, Begleitschutz als Koordinationsproblem.

---

## 2. Didaktik und Leitidee

- **Keine schwere Mathematik.** Auszahlungen sind Goldmünzen, Ruf oder Ränge; keine Gleichungen, keine Beweise. Gemischte Strategien werden mit Schiebereglern und Häufigkeiten erlebt, nicht berechnet.
- **Erst spielen, dann benennen.** Jede Station beginnt mit einer kleinen Simulation, deren Ausgang überrascht. Erst danach kommt der Begriff.
- **Drei Welten pro Konzept:** Abenteuer (Archipel Aurelia, Piratenära), Geschichte (Feldherren, Sun Tzu, Strategeme), Gegenwart (Alltag, Verhandlung, Geopolitik).
- **Werkzeug zum Mitnehmen:** jede Station endet mit einer Frage-Checkliste für den Alltag («Spielbrett zeichnen», «Beste Antwort der anderen?», «Kann ich das Spiel ändern?»).
- **Durchgehende Figuren:** Kasimir, der Papagei-Mentor (erklärt), Kapitänin Mara Sturmvogel (Spielerin), Käpt'n Bors Eisenhaken (Rivale), Händlerin Ilse vom Kontor (Verhandlungspartnerin), Gouverneur Albrecht von Goldbucht (Ordnungsmacht), Spionin Nell (Informationen).

## 3. Architektur des Lernpfads

| Nr | Slug | Titel | Sektion | Kernkonzepte | Simulation |
|----|------|-------|---------|--------------|------------|
| 01 | `01-das-spielbrett` | Das Spielbrett: Spieler, Züge, Auszahlungen | Grundlagen | Spieler, Strategie, Auszahlung, Information, Spielbrett zeichnen, Nullsumme vs. Nichtnullsumme | Hafen von Goldbucht: Bimatrix lesen, Spielbrett selbst bauen |
| 02 | `02-gefangenendilemma` | Gefangenendilemma und dominante Strategien | Grundlagen | dominante und dominierte Strategien, Dilemma, Auswege | Zwei Schmuggler im Kerker, Preiskampf der Kontore |
| 03 | `03-nash-gleichgewicht` | Nash-Gleichgewicht und beste Antworten | Grundlagen | beste Antwort, Gleichgewicht, Koordination, Hirschjagd, Feigling | Hafenfest, Kollisionskurs zweier Schiffe |
| 04 | `04-nullsumme-bluff` | Nullsummenspiele und Unberechenbarkeit | Grundlagen | Nullsumme, Maximin, gemischte Strategie, Ausrechenbarkeit | Schatz verstecken, Küstenwache gegen Schmuggler, Penalty |
| 05 | `05-zuege-und-drohungen` | Zug um Zug: Drohungen und Selbstbindung | Dynamik | Spielbaum, Rückwärtsinduktion, glaubhafte und leere Drohung, Selbstbindung, Erstzugvorteil | Belagerung der Festung, «Schiffe verbrennen» |
| 06 | `06-tit-for-tat` | Wiederholte Spiele und Tit-for-Tat | Dynamik | Schatten der Zukunft, Tit-for-Tat, Grim, Vergebung, Rauschen, Turnier und Evolution | Handelsrouten-Turnier, Evolution der Strategien |
| 07 | `07-signale-und-taeuschung` | Information, Signale und Täuschung | Dynamik | asymmetrische Information, Signal, Screening, Bluff, Reputation | Leere Festung, Kaperbrief, Gebrauchtschiff-Markt |
| 08 | `08-strategeme` | Die 36 Strategeme und Sun Tzu | Strategeme | Strategeme als Spieländerungen, Kategorisierung, historische Fallstudien | Strategem-Werkstatt: welches Strategem verändert welchen Teil des Spiels? |
| 09 | `09-verhandeln` | Verhandeln: BATNA, Anker, Ultimatum | Anwendung | BATNA, Zone der Einigung, Anker, Ultimatumspiel, Fairness, Paketlösungen | **Die Piratenallianz** (grosse Verhandlungssimulation) |
| 10 | `10-krisenstab` | Krisenstab: Geopolitik spieltheoretisch lesen | Anwendung | Abschreckung, Eskalationsleiter, Brinkmanship, Koalitionen, Stellvertreter | Krisenstab Meerenge (fiktiv) und Akteursanalysen realer Regionen |
| 11 | `11-feldzug-abschluss` | Der grosse Feldzug: Abschluss | Abschluss | alles verbinden, Checkliste Alltag | Kampagne «Der Rat der sieben Inseln», Abschlussprüfung |

Sektionen: `grundlagen` («Sektion 1 · Spielbrett und Gleichgewicht»), `dynamik` («Sektion 2 · Zeit, Wiederholung, Information»), `strategeme` («Sektion 3 · Die Kunst der List»), `anwendung` («Sektion 4 · Verhandeln und Krisen»), `abschluss` («Abschluss»).

**Aufbau jeder Station** (Baukasten-Reihenfolge, angepasst):

1. Kopf mit Szene (Panorama-SVG), Lernzielen und «Kasimir erklärt».
2. **0 · Spiel zuerst:** kleine Simulation ohne Vorwissen.
3. **1 · Wörterbuch:** Begriffe in Alltagssprache.
4. **2 · Konzept Schritt für Schritt:** Stepper oder Spielbrett-Analyse.
5. **3 · Simulation:** Kernspiel der Station (Erweiterung `Lernpfad.spiel`).
6. **4 · Strategem-Ecke:** historische Parallele (Sun Tzu, Strategem, Schlacht).
7. **5 · Alltag und Welt:** Übertragung auf Verhandlung, Beruf, Geopolitik.
8. **Übungen** (Baukasten: `auswahl`, `wahrFalsch`, `sortierer`, `reflexion`, `matrix`).
9. **▶ Lösungsfilm** (eine Situation komplett analysiert).
10. **✓ Selbsttest** (8–10 Fragen) und **Auf einen Blick** mit Alltags-Checkliste.

## 4. Interaktive Simulation: Konzept

### 4.1 Mechanik

Die Simulation ist ein Satz wiederverwendbarer Spielbausteine (`Lernpfad.spiel.*`), die jede Station zu einem «Kapitel» eines Strategiespiels macht:

| Baustein | Mechanik | Lernziel |
|----------|----------|----------|
| `spielbrett` | Bimatrix als Holzbrett mit Münzstapeln. Modi: *spielen* (gegen eine KI-Figur mit wählbarer Haltung), *beste Antworten* (Pfeile und Markierungen aufdecken), *Gleichgewicht finden* (Felder markieren, prüfen), *dominant?* (Zeilen und Spalten streichen) | Spiele lesen, dominante Strategien und Gleichgewichte erkennen |
| `turnier` | Wiederholtes Gefangenendilemma als Handelsfahrt. *Duell*: du gegen eine verdeckte Strategie, Rundenzahl bekannt oder unbekannt. *Turnier*: Strategien treten jeder gegen jeden an, mit Rausch-Regler (Missverständnisse). *Evolution*: Flotten wachsen mit ihrem Erfolg | Tit-for-Tat, Schatten der Zukunft, Vergebung |
| `baum` | Spielbaum als Seekarte mit Routen. Rückwärtsinduktion Knoten für Knoten: du wählst an jedem Entscheidungspunkt, Kasimir prüft; abgeschnittene Äste verblassen | Vom Ende her denken, leere Drohungen entlarven |
| `szenario` | Verzweigte Geschichte mit Figuren, Sprechblasen, Ressourcen-Anzeigen (Gold, Vertrauen, Ruf, Zeit, Eskalation) und Entscheidungskarten. Jede Karte trägt eine «Konzept-Lupe», die nach dem Zug erklärt, was spieltheoretisch passiert ist. Mehrere Enden mit Auswertung | Verhandeln und Krisenführung als Erlebnis |
| `akteure` | Krisenstab-Lagetisch: Akteurskarten mit Interessen, Optionen und Alternativen. Du sagst den wahrscheinlichsten Zug jedes Akteurs voraus und begründest mit einem Konzept; danach Auflösung | Geopolitik spieltheoretisch lesen |
| `mischer` | Schieberegler «Wie oft links?» gegen eine lernende Gegenspielerin, die Muster ausnutzt; Verlauf als Diagramm | Gemischte Strategien ohne Formel |
| `figur`, `szene` | Inline-SVG-Figuren und Panoramen im Siedler-Stil | Atmosphäre, Wiedererkennung |

Fortschritt: Die Bausteine melden nichts an den Server (kein neues Datenmodell). Abschluss läuft wie gewohnt über Selbsttest und Abschluss-Box.

### 4.2 Visuelles Design (Siedler-7-Anmutung, eigene Gestaltung)

Orientierung am *Charme* der Aufbaustrategie (warm, detailreich, leicht cartoonhaft), ohne Elemente, Logos oder Figuren eines bestehenden Spiels zu kopieren:

- **Materialien:** Pergament (Papier-Textur über Verläufe), Holzrahmen mit Nieten, Messingknöpfe, Wachssiegel als Abzeichen, Wimpel und Banner für Fraktionen.
- **Farbwelt:** warmes Ocker, Moosgrün, Meerestürkis, Ziegelrot, Königsblau; Fraktionsfarben Rot (Mara), Blau (Bors), Grün (Ilse), Gold (Gouverneur). Alle Farben als Tokens mit Dunkel-Variante («Nachtwache»: Laternenlicht auf dunklem Holz).
- **Figuren:** runde Köpfe, rosige Wangen, grosse Hüte, klare Silhouetten, je ein Erkennungszeichen (Dreispitz mit Feder, Augenklappe, Kontorbrille, Perücke, Papagei). Als Inline-SVG, skalierbar, ohne externe Bilder.
- **Spielfelder:** Inseln mit Palmen und Häuschen, Wellen in Schichten, Schiffe mit Fraktionssegeln, Festungen; Spielbrett als Holztisch mit Münzstapeln (Höhe = Auszahlung).
- **UI:** Entscheidungskarten wie Spielkarten (Rahmen, Symbol, Titel, Folgen-Vorschau), Ressourcenleiste oben wie in Aufbauspielen, Sprechblasen aus Pergament, Abzeichen-Siegel bei Erfolg.
- **Bewegung:** sanftes Wogen, Münzen fallen, Segel blähen; alles mit CSS, abgeschaltet bei «Bewegung reduzieren».
- **Barrierefreiheit:** alles mit Knöpfen bedienbar, Zustände nie nur über Farbe (Symbole und Text), Live-Regionen für Ereignisse, 320 px ohne seitliches Scrollen.

### 4.3 Beispielszenario «Die Piratenallianz» (Station 09)

**Lage:** Die Flotte von Gouverneur Albrecht blockiert die Durchfahrt bei den Nebelklippen. Kapitänin Mara (du) braucht die Schiffe von Käpt'n Bors, um durchzubrechen. Bors und du seid Rivalen. Die Händlerin Ilse finanziert, wer gewinnt, will aber sichere Handelsrouten.

**Ressourcen:** Gold 100, Vertrauen Bors 30, Ruf 50, Zeit 6 Gezeiten.

**Ablauf (Auszug):**

1. *Vorbereitung:* Du legst deine BATNA fest: allein durchbrechen (riskant), Ilses Handelsvertrag annehmen (sicher, wenig Beute) oder warten. Kasimir: «Wer seine Alternative nicht kennt, nimmt jedes Angebot an.»
2. *Erstes Treffen:* Bors fordert 70 % der Beute. Karten: annehmen (Anker frisst dich), Gegenanker 40 %, Frage nach seiner Alternative, Ziegel hinwerfen (Strategem 17: Karten der Nebelklippen als Geschenk).
3. *Information:* Spionin Nell bietet an, Bors' wahre Lage auszukundschaften (Kosten: Gold, Zeit). Ergebnis: Bors' Mannschaft meutert, seine BATNA ist schwach.
4. *Glaubwürdigkeit:* Bors droht, zum Gouverneur überzulaufen. Ist die Drohung glaubhaft? Spielbaum zeigt: Der Gouverneur würde ihn hängen. Leere Drohung.
5. *Selbstbindung:* Du kannst dein Flaggschiff als Pfand an Ilse geben, um dein Versprechen glaubhaft zu machen.
6. *Abschluss:* Paketlösung (Beute, Hafenrechte, Ruf) statt reiner Prozentzahl, oder Abbruch.

**Enden:** «Bund der Klippen» (fairer Vertrag, hohes Vertrauen, wiederholtes Spiel möglich), «Pyrrhus-Deal» (viel Gold, Bors wird zum Feind), «Allein gegen die Flotte» (BATNA gezogen), «Verraten» (zu viel Vertrauen ohne Absicherung). Jede Auswertung nennt die Konzepte, die den Ausgang bestimmt haben.

### 4.4 Beispiel Krisenstab (Station 10)

Fiktive Meerenge «Sund von Kerros»: Küstenstaat droht, die Durchfahrt zu sperren; Handelsmächte, Grossmacht als Schutzmacht, Rebellengruppe als Störenfried. Ressourcen: Eskalationsstufe, Handelsvolumen, Glaubwürdigkeit, Bündnisgeschlossenheit. Danach Lagetisch mit drei realen Regionen (Russland–Ukraine, Taiwanstrasse, Rotes Meer / Hormus) als **Akteursanalyse**: Interessen, Alternativen, Kosten der Eskalation, wahrscheinlicher Zug mit Begründung.

## 5. Spiel-Erweiterung `st-spiel` (Technik)

Dateien: `public/lernpfad/st-spiel.css` (nach `lernpfad.css`) und `public/lernpfad/st-spiel.js` (nach `lernpfad.js`). Die Inhaltsprüfung erzwingt die Reihenfolge (`lib/lernseiten-pruefung.ts`). Vorlage: `content/lernseiten/spieltheorie/_vorlage.html`.

```html
<link rel="stylesheet" href="/lernpfad/lernpfad.css">
<link rel="stylesheet" href="/lernpfad/st-spiel.css">
…
<script src="/lernpfad/lernpfad.js"></script>
<script src="/lernpfad/st-spiel.js"></script>
<script>(function(){ "use strict"; const S = window.Lernpfad.spiel; … })();</script>
```

Regeln: Wie Baukasten Abschnitt 11. Seiteneigene Klassen mit Präfix `t<NN>-`. Farben nur aus Tokens (`--st-…` aus `st-spiel.css` oder Baukasten-Tokens). Kein `localStorage` für Inhalte, keine Server-Aufrufe.

### 5.1 `S.figur(art, opts)` → HTML-Text (SVG)

`art`: `papagei`, `kapitaenin`, `pirat`, `haendlerin`, `gouverneur`, `spionin`, `feldherr`, `diplomatin`, `matrose`, `buerger`.
`opts`: `{ titel, groesse (px, Standard 72), stimmung: "neutral"|"froh"|"boese"|"sorge" }`. Mit `titel` `role="img"`, sonst `aria-hidden`.

### 5.2 `S.szene(art, opts)` → HTML-Text (SVG-Panorama)

`art`: `hafen`, `see`, `festung`, `kerker`, `lagetisch`, `markt`, `klippen`. `opts`: `{ titel, figuren: [art, …] }` (Figuren stehen im Vordergrund). Breite 100 %, Höhe automatisch.

### 5.3 `S.spielbrett(el, cfg)`

| Feld | Bedeutung |
|------|-----------|
| `titel`, `frage` | HTML |
| `zeile` | `{ name, figur, strategien: [Text, …] }` (Zeilenspieler, 2–3 Strategien) |
| `spalte` | `{ name, figur, strategien: [Text, …] }` |
| `werte` | `[[ [z, s], … ], …]` Auszahlungen je Feld (Zeile, Spalte) |
| `einheit` | z. B. «Gold», «Jahre Kerker» (Standard «Gold») |
| `weniger_ist_besser` | `true` bei Strafen (Jahre); Münzen werden zu Ketten |
| `modi` | Liste aus `"lesen"`, `"spielen"`, `"antworten"`, `"gleichgewicht"`, `"dominanz"` (Standard alle ausser `spielen`) |
| `gegner` | für `spielen`: `"zufall"`, `"vorsichtig"` (Maximin), `"gierig"` (beste Antwort auf deinen letzten Zug), `"dominant"` |
| `gleichgewichte` | optional Liste `[[i, j], …]`, sonst automatisch berechnet (reine Gleichgewichte) |
| `erklaerung` | HTML nach dem Lösen |

Weitere Felder: `feldtexte` (`[[HTML]]`, Zusatztext je Feld im Modus «lesen»), `einheit_eins` (Einzahl der Einheit, z. B. «Jahr»; für «Jahre», «Punkte», «Monate», «Tage», «Schiffe», «Stimmen» automatisch). Der Modus «dominanz» prüft strikte Dominanz in einem Schritt; schrittweises Streichen (iterierte Elimination) baut eine Station seitenlokal (Muster: Station 02).

Rückgabe `{ modus(name), zuruecksetzen() }`. Ereignis `lernpfad:spielbrett` mit `detail: { modus, richtig }`.

### 5.4 `S.turnier(el, cfg)`

| Feld | Bedeutung |
|------|-----------|
| `modus` | `"duell"`, `"turnier"`, `"evolution"` |
| `strategien` | Liste von Kennungen: `tft` (Tit-for-Tat), `immer_k` (immer kooperieren), `immer_v` (immer verraten), `grim` (Groll), `tf2t` (Tit-for-Two-Tats), `zufall`, `pavlov` (Gewinn-bleib/Verlust-wechsle), `nachsichtig` (TFT mit 10 % Vergebung), `misstrauisch` (TFT, beginnt mit Verrat) |
| `gegner` | für Duell: Kennung oder `"geheim"` (zufällig aus `strategien`) |
| `runden` | Zahl (Standard 10); `rundenUnbekannt: true` = Spiel endet zufällig |
| `rauschen` | Startwert 0–0.2 (Regler sichtbar mit `rauschenRegler: true`) |
| `werte` | `{ T, R, P, S }` Standard `{ T: 5, R: 3, P: 1, S: 0 }` |
| `titel`, `frage` | HTML |

### 5.5 `S.baum(el, cfg)`

Spielbaum mit Rückwärtsinduktion. `knoten`: `{ id, spieler, text, aeste: [{ text, ziel }] }`, Blätter `{ id, ende: true, text, werte: [a, b] }`. `spieler`: Index in `spieler: [{ name, figur }]`. Der Baustein fragt Knoten von unten nach oben ab; `S.baum(...).loesen()` zeigt alles. Felder `titel`, `frage`, `erklaerung`.

### 5.6 `S.szenario(el, cfg)`

| Feld | Bedeutung |
|------|-----------|
| `titel` | HTML |
| `ressourcen` | `[{ id, name, symbol, start, min, max, gut: "hoch"|"tief" }]` |
| `start` | Knoten-Id |
| `knoten` | `{ id: { szene, sprecher, figur, stimmung, text, karten: [{ titel, symbol, text, effekte: { id: Zahl }, ziel, lupe, bedingung }] } }`. `ziel` = nächster Knoten; `bedingung(stand)` optional (Funktion, Karte nur sichtbar, wenn wahr) |
| `enden` | `{ id: { titel, siegel, text, konzepte: [Text] } }`; Knoten mit `ende: "id"` beenden das Szenario. Statt fester Enden darf ein Knoten `weiche(stand)` haben (Funktion → Knoten-Id) |

Weitere Felder: `einleitung` (HTML über der Leiste), `zustand` (zusätzliche Startwerte im Stand, z. B. Merker), `pruefe(stand, verlauf)` (nach jeder Karte: Ende-Id oder `null`). Auf Karten: `ende` (Ende-Id statt `ziel`), `setze` (Objekt, wird in den Stand übernommen, z. B. `{ pfand: true }`), `folge`, `folgeFigur`, `folgeSprecher`, `folgeStimmung` (Antwort einer Figur nach der Wahl), `ziel` darf eine Funktion `(stand, verlauf) → Id` sein. Auf Knoten: `ort`, `figuren`, `effekte` (beim Betreten). Texte (`text`, `lupe`, Ende-`text`) dürfen Funktionen `(stand, verlauf) → HTML` sein.

Rückgabe `{ neuStarten() }`. Ereignis `lernpfad:szenario` mit `detail: { ende, stand }`.

### 5.7 `S.akteure(el, cfg)`

`akteure: [{ name, figur, interessen, alternative, optionen: [Text], richtig: Index, begruendung }]`, dazu `titel`, `lage`, `hinweis`. Prüfen zeigt je Akteur ✓/✗ und Begründung.

### 5.8 `S.mischer(el, cfg)`

`links`, `rechts` (Beschriftungen der zwei Optionen), `runden` (Standard 30), `titel`, `frage`, `rolle` (Text). Die Gegnerin lernt die Häufigkeit deiner letzten Züge und nutzt Muster. Ergebnis mit Verlauf und Merksatz.

## 6. Stand der Umsetzung

Siehe `STATUS.md` (Phase 18). Offene Punkte stehen dort.
