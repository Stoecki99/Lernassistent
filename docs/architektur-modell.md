# Architektur-Modell · Vertrag für Engine, Spiele, Spielstand und Architektur-Leitstand

**Stand:** 01.11.2026 · gilt für AVSW (Verteilte Softwarearchitekturen)
**Leser:** alle Agenten und Menschen, die an Engine, Spielen, Spielstand-API, Simulator oder AVSW-Seiten arbeiten.

Dieses Dokument ist **verbindlich**. Wer ein Feld, einen Typ oder ein Ereignis ändern will, ändert zuerst dieses Dokument (mit Begründung im Commit) und dann alle Nutzer.

## 1. Teile und Zuständigkeiten

| Teil | Ort | Zweck |
|------|-----|-------|
| Engine | `public/lernpfad/architektur.js`, `public/lernpfad/architektur.css` | Zeichnet Architektur-Modelle in UML-Notation (SVG), interaktiv: Steckbriefe, Abläufe animieren, Ausfälle, Atlas, Editor, Modellierspiel. Vanilla-JS, globales Objekt `window.Architektur`. Lädt nach `lernpfad.js`. |
| Spielstand | Prisma-Modell `Spielstand`, API `/api/spielstand` | Bestwert (Sterne, XP) pro Konto, Fach, Spiel und Level; Punkte ins Konto bei Verbesserung. |
| Simulator-Kern | `lib/archsim/` | Deterministische Simulation von Last, Latenz, Fehlern und Kosten auf einem Architektur-Modell. Reines TypeScript, getestet. |
| Architektur-Leitstand | `app/(architektur-leitstand)/architektur-leitstand/`, `components/features/architektur-leitstand/`, API `/api/archsim/runs` | Missionen spielen: Architektur modellieren oder übernehmen, Massnahmen treffen, Lastverlauf mit Ereignissen erleben, Nachbesprechung. Zeichnet mit der Engine. |
| Inhalte | `content/lernseiten/avsw/*.html` | Stationen mit Atlas, Diagrammen, Abläufen und Spielen. |

## 2. Elementtypen (Vokabular)

Jedes Element hat genau einen `typ`. Der Typ legt **Kategorie (Farbe), UML-Form und Piktogramm** fest. Die Engine kennt alle Typen; der Simulator-Kern kennt für jeden Typ Standard-Kennzahlen (Abschnitt 9).

| `typ` | Kategorie | UML-Darstellung | Beispiel-Technologien |
|-------|-----------|-----------------|------------------------|
| `akteur` | `client` | Strichmännchen (UML-Actor) | Kundin, Sachbearbeiter |
| `web` | `client` | Komponente «web client» mit Browser-Symbol | React, Angular, Vue |
| `mobile` | `client` | Komponente «mobile app» | Swift, Kotlin, Flutter |
| `cdn` | `zugang` | Knoten «CDN» | Cloudflare, CloudFront |
| `gateway` | `zugang` | Komponente «API gateway» | Kong, Spring Cloud Gateway, NGINX |
| `lastverteiler` | `zugang` | Komponente «load balancer» | HAProxy, NGINX, AWS ALB |
| `ingress` | `zugang` | Komponente «ingress» | NGINX Ingress, Traefik |
| `auth` | `sicherheit` | Komponente «identity provider» | Keycloak, Auth0, Entra ID |
| `dienst` | `dienst` | Komponente (UML-Komponentensymbol) «service» | Spring Boot, Node.js, Go, .NET |
| `monolith` | `dienst` | grosse Komponente «application» | Java EE, Rails, Django |
| `funktion` | `dienst` | Komponente «function» (λ) | AWS Lambda, Azure Functions |
| `orchestrator` | `dienst` | Komponente «orchestrator» | Camunda, Temporal |
| `queue` | `messaging` | Komponente «queue» mit Fächern | RabbitMQ, ActiveMQ, Amazon SQS |
| `topic` | `messaging` | Komponente «topic» mit Fächer und Abzweig | Kafka, Pulsar, SNS |
| `broker` | `messaging` | Komponente «message broker» | RabbitMQ, Kafka, IBM MQ |
| `bus` | `messaging` | breiter Balken «enterprise service bus» | MuleSoft, IBM IIB, WSO2 |
| `mesh` | `infrastruktur` | Komponente «sidecar proxy» | Envoy, Istio, Linkerd |
| `datenbank` | `daten` | Zylinder «database» | PostgreSQL, MySQL, Oracle |
| `nosql` | `daten` | Zylinder «document store» | MongoDB, Cassandra, DynamoDB |
| `cache` | `daten` | Komponente «cache» | Redis, Memcached |
| `suche` | `daten` | Zylinder «search index» | Elasticsearch, OpenSearch |
| `speicher` | `daten` | Ordner «object storage» | S3, MinIO, Azure Blob |
| `extern` | `extern` | Komponente mit gestricheltem Rand «external system» | Zahlungsanbieter, SMS-Dienst |
| `knoten` | `infrastruktur` | UML-Node (3D-Quader), **Gruppe** | Server, VM |
| `cluster` | `infrastruktur` | UML-Node «cluster», **Gruppe** | Kubernetes-Cluster |
| `pod` | `infrastruktur` | UML-Node «pod», **Gruppe** | Kubernetes-Pod |
| `container` | `infrastruktur` | Artefakt «container» | Docker-Image |
| `artefakt` | `infrastruktur` | UML-Artefakt (Blatt mit Ecke) | `.jar`, `.war`, Image |
| `paket` | – | UML-Paket (Reiter), **Gruppe** | Bounded Context, Schicht |
| `grenze` | – | gestrichelter Rahmen, **Gruppe** | Systemgrenze, Zone, Rechenzentrum |
| `schnittstelle` | – | Lollipop (Kreis am Stiel) | REST-API, gRPC-Service |
| `filter` | `dienst` | Komponente «filter» | Pipes-and-Filters-Stufe |
| `peer` | `dienst` | Komponente «peer» | BitTorrent-Knoten |
| `plugin` | `dienst` | Komponente «plug-in» | Erweiterung im Microkernel |
| `monitor` | `infrastruktur` | Komponente «monitoring» | Prometheus, Grafana |

Gruppen-Typen (`knoten`, `cluster`, `pod`, `paket`, `grenze`) umrahmen Elemente, die mit `in: "<gruppen-id>"` darauf zeigen. Verschachtelung bis Tiefe 3.

## 3. Kategorien und Farben

Farbe trägt **Bedeutung**, nie Dekoration. Jede Kategorie hat eine Farbe, die überall gleich ist (Atlas, Spiele, Simulator, Legenden). Gründe:

- **Konsistente Farbcodierung** hilft beim Gruppieren (Chunking) und Wiedererkennen. Wer «violett = Messaging» einmal gelernt hat, liest jede Architektur schneller.
- **Doppelte Codierung:** Farbe ist immer mit Form (UML) und Text («stereotyp») kombiniert. Das hilft dem Gedächtnis und bleibt bei Farbsehschwäche lesbar. Rot/Grün nie als einzige Unterscheidung.
- **Wenige Kategorien (8)**, gut unterscheidbare Farbtöne, gedämpfte Flächen mit kräftigem Rand. Kräftige Signalfarben (Rot, Gelb) bleiben Zuständen vorbehalten (Fehler, Ausfall, «neu»), damit sie Aufmerksamkeit lenken.
- **Warm für Aufmerksamkeit, kühl für Struktur:** Daten (Amber) und Fehler (Rot) fallen auf, Infrastruktur (Schiefer) tritt zurück.

| Kategorie | Token Rand / Fläche | Farbton |
|-----------|---------------------|---------|
| `client` | `--k-client` / `--k-client-bg` | Blau |
| `zugang` | `--k-zugang` / `--k-zugang-bg` | Cyan |
| `dienst` | `--k-dienst` / `--k-dienst-bg` | Grün |
| `messaging` | `--k-messaging` / `--k-messaging-bg` | Violett |
| `daten` | `--k-daten` / `--k-daten-bg` | Amber |
| `sicherheit` | `--k-sicherheit` / `--k-sicherheit-bg` | Rosa |
| `extern` | `--k-extern` / `--k-extern-bg` | Grau |
| `infrastruktur` | `--k-infra` / `--k-infra-bg` | Schiefer/Indigo |

Zustände: `--z-fehler` (Rot), `--z-langsam` (Orange), `--z-neu` (Gelb, wie `--lit`), `--z-ok` (Grün wie `--ok`). Alle Tokens in `architektur.css`, hell und dunkel, Kontrast Text ≥ 4.5:1, Rand ≥ 3:1. AVSW bekommt eine eigene Akzentfarbe über `body[data-fach="avsw"]` (wie PMGT).

## 4. Modell (JSON)

```js
{
  titel: "Webshop mit Message Broker",          // optional
  ansicht: "komponenten",                          // "komponenten" | "verteilung" | "kontext"
  richtung: "rechts",                              // Hauptflussrichtung für das Auto-Layout: "rechts" | "unten" (Standard "unten")
  elemente: [
    { id: "web", typ: "web", name: "Shop-Frontend", technologie: "React",
      x: 0, y: 1,                                  // optional: Rasterposition (Spalte, Zeile); sonst Auto-Layout
      in: "zone-dmz",                              // optional: Gruppe
      stereotyp: "web client",                     // optional: überschreibt den Standard des Typs
      info: {                                      // Steckbrief, alles HTML, alles optional
        was: "…", kann: "…", wofuer: "…", technologie: "…", warum: "…"
      },
      zustand: "ok"                                // "ok" | "langsam" | "ausfall" | "neu" (Start-Zustand)
    }
  ],
  verbindungen: [
    { id: "v1", von: "web", nach: "gw", art: "sync", label: "HTTPS/JSON", info: "…" }
  ],
  ablaeufe: [
    { id: "bestellen", name: "Bestellung aufgeben",
      schritte: [
        { von: "web", nach: "gw", art: "sync", text: "Die Kundin schickt die Bestellung (POST /orders)." },
        { von: "best", nach: "broker", art: "async", text: "…", parallel: true },  // gleichzeitig mit dem vorherigen
        { bei: "zahlung", text: "Zahlungsanbieter antwortet nicht.", fehler: true },  // Ereignis an einem Element
        { von: "gw", nach: "web", text: "Antwort 201.", phase: "Antwort" }          // optional: Phase für die Phasenleiste;
                                                                                      // von→nach darf eine Verbindung rückwärts laufen
      ] }
  ]
}
```

Regeln: IDs eindeutig, `a-z0-9-`. `von`/`nach` zeigen auf Elemente (nicht Gruppen, ausser `art: "deploy"`). Ohne `x`/`y` legt die Engine selbst aus (Schichten nach Kategorie: client → zugang/sicherheit → dienst → messaging → daten, extern rechts; Gruppen zusammenhalten). `x`/`y` gelten nur, wenn **alle** Elemente (ausser Gruppen) sie haben.

Verfeinerungen des Auto-Layouts (Engine 1.0, damit Diagramme ohne `x`/`y` sauber werden): Akteure stehen vor ihren Clients; Sidecars (`mesh`) zwischen Zugang und Dienst; ein Dienst, der nur von Messaging-Elementen aufgerufen wird (Konsument), steht hinter dem Broker; Datenhaltung steht hinter ihren Nutzern; eine Schnittstelle steht direkt hinter der Komponente ihrer Gruppe, die sie realisiert oder nutzt; Elemente ausserhalb einer Gruppe, die nur mit deren Mitgliedern verbunden sind (Adapter, verwaltete Datenbank), stehen hinter der Gruppe (vor ihr bei Stereotyp mit «driving»); Fremdsysteme bei `richtung: "rechts"` hinter ihrem letzten Nachbarn (reine Quellen davor). Ein Bus allein in seiner Zeile (Spalte bei «rechts») wird zum durchgehenden Balken. Ab drei `peer` ohne Gruppen: Ring statt Schichten.

## 5. Verbindungsarten (UML-Notation)

| `art` | Bedeutung | Linie | Pfeilspitze | Standard-Label |
|-------|-----------|-------|-------------|----------------|
| `sync` | synchroner Aufruf (Request/Response) | durchgezogen | gefüllt | Protokoll, z. B. «HTTPS» |
| `async` | asynchrone Nachricht/Event | gestrichelt | offen | «Event» bzw. Topic-Name |
| `daten` | liest/schreibt Daten | durchgezogen, dicker | offen, auf Datenseite | «SQL», «read/write» |
| `abhaengigkeit` | nutzt (UML-Dependency) | gestrichelt | offen | «use» |
| `realisiert` | stellt Schnittstelle bereit | durchgezogen | Lollipop am Ziel | Schnittstellenname |
| `deploy` | läuft auf / ist verteilt auf | gestrichelt | offen | «deploy» |
| `stream` | Datenstrom / Pipe | doppelt | gefüllt | «pipe» |

Linien werden **rechtwinklig** geführt (orthogonales Routing), weichen Elementen aus, haben Beschriftung mittig auf weissem Grund und sind im Fokus/Hover hervorgehoben. Verbindungsfarbe = Kategorie des Ziels, gedämpft; aktive Verbindung im Ablauf in voller Farbe.

## 6. Engine-API (`window.Architektur`)

Alle Funktionen: erstes Argument Element oder Selektor, Fehler als `[Architektur] …` in der Konsole, Rückgabe `null` bei Fehler. Bedienung immer auch ohne Maus (Tab, Enter, Pfeiltasten), Rückmeldungen in `aria-live`, `prefers-reduced-motion` beachten. Bei schmalen Bildschirmen: Diagramm skaliert, Zoom (+/−/Einpassen) und Verschieben (Ziehen, Pfeiltasten) möglich; darunter immer eine Textliste aller Elemente und Verbindungen.

| Funktion | Zweck |
|----------|-------|
| `diagramm(el, modell, opt)` | Interaktives Diagramm. Klick/Enter auf Element öffnet Steckbrief (was, kann, wofür, Technologie, warum); Hover hebt Nachbarn und Verbindungen hervor; Legende der Kategorien; Ablauf-Abspieler (Nachrichten wandern als Punkte über die Linien, Schritttext, Zurück/Abspielen/Vor/Tempo); Ausfall-Modus (Element antippen → «Ausfall», betroffene Abläufe und abhängige Elemente rot markiert). `opt`: `{ ablauf: true, ausfall: true, legende: true, steckbrief: true, hoehe }`. Rückgabe `{ ablaufStarten(id), setzeZustand(id, zustand), markiere(ids), modell() }`. |
| `atlas(el, katalog)` | Landkarte aller Architekturstile: Übersicht als Karte (Familien als Regionen, Stile als Orte, Verwandtschaften als Wege), Filter (Kopplung, Kommunikation, Einsatz), Detailansicht pro Stil: Diagramm mit Abläufen, Steckbrief, Stärken/Schwächen, Technologien mit Begründung, «passt wenn / passt nicht wenn», Vergleich zweier Stile nebeneinander. Katalog-Format siehe 6.1. |
| `editor(el, opt)` | Modell bearbeiten: Palette (Typen mit UML-Vorschau), Elemente auf Raster ziehen (Maus/Touch) oder per Tastatur setzen, Verbindungen vom Anschlusspunkt ziehen, Art wählen, Label setzen, verschieben, löschen. `opt`: `{ palette: [typ|{typ,name,…}], modell, raster, nurVerbinden, onChange(modell) }`. Rückgabe `{ modell(), setzeModell(m), markiere(ids, klasse) }`. |
| `spiel(el, cfg)` | Modellierspiel mit Levels (siehe 7). |

### 6.1 Atlas-Katalog

```js
{
  familien: [{ id: "monolithisch", name: "Monolithisch und geschichtet", farbe: "dienst" }],
  stile: [{
    id: "mom", name: "Message-oriented Middleware (MOM)", familie: "messaging-familie",
    kurz: "Dienste tauschen Nachrichten über einen Broker aus, statt sich direkt aufzurufen.",
    kann: ["…"], wofuer: ["…"], staerken: ["…"], schwaechen: ["…"],
    technologien: [{ name: "RabbitMQ", warum: "…" }, { name: "IBM MQ", warum: "…" }],
    passtWenn: ["…"], passtNichtWenn: ["…"],
    kopplung: "lose" , kommunikation: "asynchron", jahr: 1990,
    einsatz: ["Integration", "Web"],                  // optional: Werte für den Filter «Einsatz»
    kurzname: "MOM", symbol: "queue",                // optional: Name auf der Karte, Typ für das Ortssymbol
    verwandt: ["pubsub", "esb"],
    modell: { /* Modell nach 4, mit ablaeufe */ }
  }]
}
```

Kopplung, Kommunikation und Einsatz werden als Filter-Chips angeboten, sobald ein Stil den Wert hat. `verwandt` darf einseitig sein; Wege sind ungerichtet und dedupliziert. Diagramme zeichnet der Atlas erst beim Öffnen eines Stils.

### 6.2 Ergänzungen der Engine 1.0

| Funktion | zusätzliche Optionen | zusätzliche Rückgabe |
|----------|----------------------|----------------------|
| `diagramm` | `titel` (überschreibt `modell.titel`, `""` = kein Titel), `textliste` (Standard `true`), `breit` (Standard `true`: auf breiten Bildschirmen über die Lesespalte hinaus), `massstab` (Startzoom, 1 = Weltkoordinaten), `kMin` (lesbarer Mindestmassstab) | `waehle(id)`, `plakette(id, text, klasse)`, `entfernePlakette(id?)`, `fluss(verbindungId, { an, tempo })`; `modell()` liefert die Vertragsform ohne leere Felder und reicht Zusatzfelder (z. B. `sim`) durch |
| `atlas` | drittes Argument `opt`: `{ titel, breit }` | `{ zeigeStil(id), karte(), vergleiche(a, b), entdeckt() }` |
| `editor` | `arten` (erlaubte Verbindungsarten), `fest` (IDs, die nicht gelöscht oder verschoben werden), `labels` (Beschriftung im Art-Menü, Standard `true`), `breit` | `markiere([])` löscht; Klassen `ar-ok`/`ar-falsch` setzen zusätzlich ✓/✗; `geist({ von, nach, art })`, `palettePuls(id)`, `rueckgaengig()` |
| `spiel` | `titel`, `breit`, `speichern`; je Level `arten`, `raster` (`{ spalten, zeilen }`), `erklaerung`; je Lösungs-Verbindung `gerichtet: false`, `label` | `{ starten(levelId), levelkarte(), abgeben(), ergebnis(levelId), ergebnisse(), bestwerte() }` |

`editor().modell()` liefert ebenfalls die saubere Vertragsform. `Architektur.referenzen` ist eine Registry für Referenzmodelle in Modulnotation (Tipp im Prüfungsspiel, Abschnitt 10.3).

Weitere Felder von `window.Architektur`: `kategorien` (Liste mit `id`, `name`, `kurz`), `arten` (je Art `name`, `erkl`), `linie(art)` (SVG-Muster der Linie als HTML) und `piktogramm(typ, titel)` (Piktogramm eines Typs als HTML).

## 7. Modellierspiel (`Architektur.spiel`)

```js
Architektur.spiel("#spiel", {
  spielId: "avsw-02-kommunikation",               // eindeutig je Seite
  fach: "avsw",
  pruefung: false,                                 // true: keine Tipps/Lösung bis Abgabe, Ergebnis per Ereignis
  levels: [{
    id: "l1", titel: "Pizza-Bestellung", schwierigkeit: 1,   // 1–3
    auftrag: "<p>… <span data-baustein=\"best\">Bestellservice</span> …</p>",
    ansicht: "komponenten",
    palette: [{ id: "best", typ: "dienst", name: "Bestellservice" }, { id: "cache", typ: "cache", name: "Cache", ablenker: true }],
    vorgegeben: { elemente: [...], verbindungen: [...] },   // optional: Startzustand (Elemente mit x/y)
    loesung: { elemente: ["best", "…"], verbindungen: [{ von, nach, art, warum }] },
    zielzeit: 180                                   // Sekunden für Zeitbonus
  }]
})
```

Spielmechanik: Levelkarte mit Schlössern (nächstes Level frei ab 1 Stern), pro Level 0–3 Sterne (★ ≥ 50 %, ★★ ≥ 80 %, ★★★ = 100 % ohne Fehlversuch), XP = Grundpunkte × Schwierigkeit + Zeitbonus − Tipps (Engine 1.0: Anteil = max(0, Treffer − überflüssige Elemente − erfundene Verbindungen) ÷ (Lösungs-Elemente ohne vorgegebene + Lösungs-Verbindungen); Grundpunkte = round(40 × Anteil); Zeitbonus bis 30 anteilig zur Zielzeit, +10 bei perfekter Lösung; Serie +5 je Level ab dem zweiten, höchstens +25; Tipps kosten 5, 10, 15; «Lösung zeigen» vor dem Abschluss = 0 Sterne, 0 XP; Ergebnis 0–500); Tipps kosten XP und zeigen gestuft (Textstelle → Element → Verbindung); «Prüfen» zeigt Treffer direkt im Diagramm (grün/rot mit ✓/✗) und am Schluss die Musterlösung als animierter Ablauf. Serie (Combo) für Level hintereinander ohne Fehler. `prefers-reduced-motion` ohne Konfetti.

Ereignis nach jedem abgeschlossenen Level: `architektur:spiel` (bubbelt) mit `detail: { spielId, levelId, sterne, xp, richtig, gesamt, loesungGezeigt, gespeichert }`. Die Engine speichert selbst über `/api/spielstand` (siehe 8), ausser `opt.speichern === false` oder in der Vorschau ohne API (Fehler abfangen, Seite läuft weiter).

## 8. Spielstand-API

`GET /api/spielstand?fach=avsw` → `[{ spiel, level, sterne, xp, aktualisiert }]` des eingeloggten Kontos.

`POST /api/spielstand` mit `{ fach, spiel, level, sterne, xp }`:

- Login nötig (401), Zod: `fach` `^[a-z0-9]+$`, `spiel` `^[a-z0-9-]{1,60}$`, `level` `^[a-z0-9-]{1,40}$`, `sterne` 0–3, `xp` 0–500 ganzzahlig.
- Speichert den **Bestwert** je Feld: höchste Sterne und höchste XP (beide sinken nie); schlechtere Werte ändern nichts.
- Punkte ins Konto (`User.points`) = Zuwachs der besten XP dieses Levels ÷ 10, abgerundet. Antwort `{ ok: true, verbessert, punkte, abzeichen }` (`abzeichen`: neu vergebene Abzeichen).
- Höchstens 300 Levels pro Konto und Fach (409), damit erfundene Level-IDs keine unbegrenzten Punkte bringen.
- Rate-Limit pro Konto (z. B. 60/min). Hinweis: Werte kommen vom Browser und sind nicht fälschungssicher (wie Quiz-Ergebnisse); Obergrenzen begrenzen den Schaden.

Prisma-Modell `Spielstand { id, userId, fach, spiel, level, sterne, xp, createdAt, updatedAt; @@unique([userId, fach, spiel, level]); onDelete: Cascade }`.

## 9. Simulator-Kern (`lib/archsim/`)

Arbeitet auf demselben Modell (4). Pro Typ Standardwerte (überschreibbar je Element in `sim`):

| Feld | Bedeutung |
|------|-----------|
| `kapazitaet` | Anfragen pro Sekunde je Instanz |
| `latenz` | Grundlatenz in ms |
| `instanzen` | Anzahl Repliken (Skalierung) |
| `fehlerquote` | Grundfehlerquote 0–1 |
| `kostenProInstanz` | CHF pro Stunde |
| `puffer` | nur Messaging: Nachrichten, die gepuffert werden |

Ein Tick = 1 simulierte Minute. Last fliesst entlang der Verbindungen eines Ablaufs (`sync` addiert Latenz und gibt Fehler weiter, `async` entkoppelt über Puffer, `daten` belastet die Datenhaltung, Cache senkt Last mit Trefferquote). Überlast → Warteschlange → Latenz steigt (Warteschlangenmodell, z. B. M/M/c-Näherung) → Timeouts → Fehler. Kennzahlen je Tick: Verfügbarkeit, p95-Latenz, Fehlerquote, Durchsatz, Kosten, Rückstau. Ereignisse (Lastspitze, Ausfall, langsame Abhängigkeit, fehlerhaftes Deployment) und Massnahmen (skalieren, Cache, Queue, Circuit Breaker, Timeout/Retry, Read-Replica, Autoscaling, CDN, Rate Limiting) verändern Parameter. Seed-basiert deterministisch: gleicher Seed + gleiche Aktionen = gleiches Ergebnis (Server rechnet zur Bewertung nach).

### 9.1 Umsetzung und Schnittstelle (Ergänzung 01.11.2026)

Code in `lib/archsim/`, nur über `lib/archsim/index.ts` importieren (reines TypeScript, keine Node-Importe, läuft im Browser und auf dem Server). Typen in `types.ts`, Zod-Schemas in `schema.ts`.

| Funktion | Zweck |
|----------|-------|
| `listeMissionen()`, `ladeMission(id)`, `MISSION_IDS` | Missionsübersicht; geprüfte Mission (Zod) oder `null` |
| `starte(mission, seed, modell?)` | neuer `Zustand` (Phase `bereit`, Minute 0). `modell` nur bei `art: "modellieren"` (Pflicht, muss `validiere(...).gueltig` sein, sonst `ArchSimFehler` `MODELL` mit `details`) |
| `wendeAn(mission, zustand, aktion)` | eine Aktion (inkl. `{ typ: "weiter", minuten }`) → neuer Zustand; Eingabe bleibt unverändert |
| `schritt(mission, zustand, aktionen?)` | Aktionen anwenden, dann genau eine Minute simulieren (Takt der Oberfläche) |
| `beende(mission, zustand)`, `auswerten(mission, zustand)` | bis zum Ende laufen lassen; `Ergebnis` = `{ zustand, kennzahlen, score, nachbesprechung, validierung }` |
| `spieleNach(mission, seed, aktionen, modell?)` | Server: nachrechnen, läuft nach der letzten Aktion bis zum Ende; Fehler tragen `aktionIndex` |
| `validiere(mission, modell)` | Struktur, Palette, Lauffähigkeit, Anforderungen (9.8) |
| `pruefeAktion(mission, zustand, aktion)` | nur prüfen (z. B. Knöpfe sperren) |
| `protokollSchema`, `aktionSchema`, `modellSchema`, `missionSchema` | Zod für API-Eingaben (`{ missionId, seed, aktionen, modell? }`) |

Aktionen (`Aktion`, Feld `typ`): `weiter {minuten}`, `skalieren {element, instanzen}`, `autoscaling {element, an, min?, max?}`, `cache {element}` (Datenhaltung), `cdn {element}` (Client), `queue {verbindung}`, `circuitBreaker {verbindung, an}`, `timeout {verbindung, ms}`, `retry {verbindung, versuche}`, `readReplica {element, anzahl}`, `rateLimit {element, proSekunde}` (0 = aus), `bulkhead {verbindung, an}`, `rollback {element}`. Die Mission legt `erlaubteAktionen` und optional `aktionsZiele` fest. `cache`, `cdn` und `queue` ändern das Modell im Zustand (`zustand.modell`, neue Elemente mit `zustand: "neu"` und freier Rasterzelle); die Oberfläche zeichnet immer `zustand.modell`.

Bei Missionen `modellieren` gelten Simulationswerte nie aus dem Spielermodell: `starte` und `validiere` setzen Element-`sim` aus Palette bzw. vorgegebenem Modell (sonst Standardwerte des Typs) und entfernen `sim` an Verbindungen ausser an unveränderten vorgegebenen Verbindungen. Ein Editor-Modell (nur Elemente, Typen, Verbindungen, Arten) rechnet damit identisch zur Musterlösung; Timeout, Wiederholungen, Circuit Breaker usw. stellt der Spieler als Aktionen ein. Ergänzte Felder im Modell (alle optional): Element-`sim` zusätzlich `parallel` (gleichzeitige Anfragen je Instanz), `trefferquote` (Cache), `maxInstanzen`; Verbindungs-`sim` mit `timeoutMs`, `retries`, `circuitBreaker`, `bulkhead`, `fallback`.

Standardwerte (`params.ts`, `TYP_WERTE`; Auszug): `dienst` 120 Anfr./s, 25 ms, 100 parallel, 10 CHF/h · `monolith` 50/s, 60 ms, 16 CHF/h · `gateway` 1500/s, 3 ms, 1000 parallel · `datenbank` 400/s, 6 ms, 25 CHF/h, nicht horizontal skalierbar (Read-Replica) · `nosql` 1500/s · `cache` 8000/s, 1 ms, Trefferquote 0.85 · `queue`/`topic`/`broker` 3000/s, Puffer 200 000 · `extern` 200/s, 250 ms, nicht skalierbar · `cdn` 50 000/s, 15 ms · Clients unbegrenzt, 30 ms Internet. Gruppen, Artefakte, Container, Schnittstellen, Monitoring tragen keine Last. Grundfehlerquote 0.02 %, extern 0.1 %. Einmalkosten der Massnahmen (`MASSNAHMEN_KOSTEN`): Cache 40, CDN 30, Queue 60, Circuit Breaker 20, Bulkhead 20, Autoscaling 15, Rate Limit 10, Read-Replica 10 (plus laufend wie eine Instanz), Timeout/Retry/Rollback je 5 CHF.

### 9.2 Rechnung einer Minute

Ein Tick ist eine Minute im eingeschwungenen Zustand. Reihenfolge: Instanzen starten → Ereignisse → Last λ = Lastkurve(t) × Π Lastspitzen × (1 + Rauschen·(2u − 1)), u aus mulberry32 (`lib/simulation/rng.ts`, Zustand `rng`) → Last von oben nach unten → Antwortzeiten und Erfolg von unten nach oben → Puffer → Kennzahlen → Circuit Breaker → Autoscaling → Hinweise.

- **Auslastung:** ρ = λ_angenommen ÷ (Instanzen × Kapazität). Datenbank mit R Read-Replicas: λ_eff = λ_schreibend + λ_lesend ÷ (1 + R).
- **Antwortzeit je Element:** R = S × f(ρ, c) mit S = Bedienzeit (× Faktor bei «langsam»), c = Instanzen und Sakasegawa-Näherung für M/M/c: f = 1 + ρ^(√(2(c+1)) − 1) ÷ (c(1 − ρ)); für c = 1 genau 1 ÷ (1 − ρ). Ab ρ = 0.97 linear bis zur Kappung 40 × S.
- **Überlast:** Anteil, der Platz findet, a_CPU = 1/ρ × (1 − 0.3 × min(1, ρ − 1)) für ρ > 1 (Goodput sinkt, weil Arbeit an schon aufgegebene Anfragen verloren geht).
- **Threads:** Bedarf = Σ λ × Haltezeit (eigene Antwortzeit + Wartezeit auf alle synchronen Aufrufe aus der Vorminute, ohne abgeschottete Verbindungen); a_Thread = min(1, Instanzen × parallel ÷ Bedarf). Wer nicht angenommen wird, scheitert «langsam» (Wartezeit 5 s bzw. bis zum Timeout des Aufrufers), Ausfall, Rate Limit, Bulkhead und offener Circuit Breaker scheitern «schnell» (1 ms).
- **Latenzverteilung:** je Aufrufbaum verschobene Exponentialverteilung X = a + Exp(m) mit a = 0.8 × Grundlatenz B (ohne Warteschlangen) und m = mittlere Latenz L − a. p50/p95 der Minute = Quantil der Mischung aller Anfrageklassen (gewichtet mit erfolgreichen Anfragen), per Bisektion.

### 9.3 Last entlang der Abläufe (Aufrufbäume)

Jede Mission definiert Anfrageklassen `{ id, name, anteil, einstieg, ziele[], schreibend?, kritisch?, statischAnteil? }`. Der Weg wird aus dem Modell abgeleitet (`routing.ts`): vom Einstieg aus jedes Ziel per Breitensuche über Lastverbindungen (`sync`, `async`, `daten`, `abhaengigkeit`, `stream`), zuerst ab dem vorigen Ziel (dort ist die Anfrage gerade), erst wenn das nicht geht ab einem beliebigen schon besuchten Element; durch Clients, Datenhaltung und externe Systeme führt kein Weg hindurch. Danach hängt jeder Dienst (Kategorie `dienst`, `sicherheit`) automatisch seine Datenhaltungen an. Rolle je Kante:

| Rolle | Erkennung | Wirkung |
|-------|-----------|---------|
| `sync` | sonst | Aufrufer wartet: Latenz und Fehler addieren sich, Timeout/Retry/Circuit Breaker/Bulkhead wirken |
| `daten` | Ziel ist Datenhaltung | wie `sync`; mit Cache als Geschwister (Cache-Aside) oder davor (Read-Through) bekommt die Datenbank bei lesenden Klassen nur (1 − h) der Zugriffe; h = Trefferquote, nach dem Einfügen in 3 Minuten linear aufgewärmt |
| `publish` | Ziel ist Messaging | Aufrufer wartet nur auf die Bestätigung des Brokers |
| `konsum` | Quelle ist Messaging | entkoppelt: Konsument zieht aus dem Puffer bis 80 % seiner CPU-Kapazität (Prefetch, ohne Rücksicht auf Threads). Hängt er an einer langsamen Abhängigkeit, belegen seine Worker die Threads des Dienstes und blockieren auch dessen synchrone Anfragen (Lehre «Konsument blockiert»). Fehlgeschlagene Nachrichten bleiben im Puffer (erneute Zustellung); Puffer über `puffer × Instanzen` läuft über (verloren) |
| `asyncDirekt` | `async`/`stream` ohne Messaging-Element | «fire and forget»: niemand wartet, scheitert der Empfänger, ist die Nachricht verloren |

CDN: Hinter einem CDN-Knoten geht nur (1 − `statischAnteil`) der Klasse weiter.

### 9.4 Resilienz-Formeln je Aufruf

Kind liefert Erfolg s, Latenz (a, m) und mittlere Fehlerzeit F. Mit Timeout T (Standard 30 000 ms, Kundinnen brechen nach 10 000 ms ab):

- Timeout-Wahrscheinlichkeit p_T = exp(−(T − a) ÷ m) (1, wenn T ≤ a); Fehlversuch q = 1 − s × (1 − p_T).
- Retries r: Lastfaktor auf das Kind 1 + q + … + q^r (mit q **der Vorminute**, geglättet 50 %: daraus entsteht der Retry-Sturm), Erfolg 1 − q^(r+1), Zeit je Aufruf = E[min(X, T)] × Versuche.
- Circuit Breaker: öffnet, wenn q ≥ 50 % (lastgewichtet über die Minute); offen 2 Minuten (Aufrufe scheitern sofort oder liefern mit `fallback` eine degradierte, aber erfolgreiche Antwort), dann halboffen (10 % Probe-Aufrufe), danach zu oder wieder offen.
- Bulkhead: die Verbindung bekommt 25 % der Threads des Aufrufers; Bedarf darüber wird sofort abgewiesen, die übrigen Anfragen des Aufrufers warten nicht mehr auf diese Abhängigkeit.
- Rate Limit am Zugang: Anteil über der Höchstrate wird sofort abgewiesen (zählt als Fehler, `summen.abgewiesen`).

### 9.5 Ereignisse, Skalierung, Kosten

Ereignisse `{ id, tick, dauer, titel, text, wirkung }` mit `wirkung.art` `lastspitze {faktor}`, `ausfall {element}` (Kapazität 0, Aufrufe scheitern schnell), `langsam {element, faktor}` (Bedienzeit × Faktor), `deployment {element, fehlerquote}` (bis `rollback`). Skalieren vor dem Start wirkt sofort, sonst nach 2 Minuten Startzeit; Abbau sofort. Autoscaling misst die CPU-Auslastung (wie ein Horizontal Pod Autoscaler, Thread-Erschöpfung zählt nicht): über 75 % → Ziel ⌈Instanzen × ρ ÷ 0.6⌉ (bis max), aktiv nach 1 + 2 Minuten; 3 Minuten unter 30 % → eine Instanz weniger (bis min). Kosten je Minute = Σ (aktive + startende Instanzen + Replicas) × CHF/h ÷ 60, dazu Einmalkosten der Massnahmen.

### 9.6 Kennzahlen (`KennzahlPunkt` je Minute, `Gesamtkennzahlen`)

Je Minute: `last`, `durchsatz` (erfolgreich/s inkl. degradiert), `fehlerquote`, `verfuegbarkeit`, `p50`, `p95` (null ohne Erfolg), `kostenRate` (CHF/h), `kosten` (kumuliert), `rueckstau` (gepufferte Nachrichten), `verloren` (kritische Vorgänge kumuliert), `degradiert`, `sloOk` (p95 ≤ SLO und Verfügbarkeit ≥ SLO), `engpass` (höchste CPU-Auslastung ≥ 0.85, sonst höchste Thread-Auslastung), `ueberlastet` (CPU > 1), `threadsErschoepft`, `auslastungMax`, `retrySturm` (Verbindung mit Lastfaktor ≥ 1.5), `cbOffen`, `ereignisse`. Je Element in `zustand.elemente[id].messung`: `last`, `auslastung`, `latenzMs`, `fehlerquote`, `zustand` (`ok`, `ausgelastet` ≥ 0.85, `ueberlast`, `langsam`, `ausfall`, `fehlerhaft`, `leer`) für die Einfärbung (Engine: `setzeZustand`). Gesamt: Verfügbarkeit = Σ erfolgreich ÷ Σ angefragt, Median und Maximum der p95, SLO-Quote, Kosten, Rückstau am Ende und maximal, verlorene kritische Vorgänge und Quote.

### 9.7 Determinismus

Zufall nur für das Lastrauschen, ein Zug je Minute in fester Reihenfolge; keine `Math.random`, kein `Date`. Zustand nur JSON-Werte (kein `undefined`, `NaN`, `Map`). `ARCHSIM_VERSION` erhöhen, sobald alte Protokolle anders verlaufen würden.

### 9.8 Modellprüfung (`validate.ts`)

`pruefeModell`: IDs eindeutig `^[a-z0-9][a-z0-9-]{0,59}$`, bekannte Typen und Arten, Enden vorhanden, Gruppen nur mit `deploy`, `in` zeigt auf Gruppe, Tiefe ≤ 3, höchstens 60 Elemente und 150 Verbindungen. `validiere(mission, modell)` zusätzlich bei `modellieren`: nur Elemente aus Palette oder Vorgabe mit passendem Typ, Vorgabe vollständig; alle Anfrageklassen erreichen ihre Ziele (`gueltig` = startbar). Anforderungen (`mission.anforderungen`, je `{ id, text, warum, station? }`): `element`, `pfad {von, nach}`, `entkoppelt {von, nach}` (jeder Weg führt durch ein Messaging-Element; `async` ohne Broker zählt nicht), `cache {element}`, `vorgeschaltet {einstieg, bis, typ}` (kein Weg am Typ vorbei), `keineVerbindung {von, nach}`, `eigeneDaten {elemente}` (jeder Dienst hat eine Datenhaltung, die kein anderer Dienst nutzt). Nicht erfüllte Anforderungen verhindern den Lasttest nicht, kosten aber je 75 Punkte.

### 9.9 Bewertung (`score.ts`)

| Teil | Max | Formel |
|------|-----|--------|
| Verfügbarkeit | 300 | 300 × clamp((A − (Ziel − 0.1)) ÷ 0.1) |
| Antwortzeit | 200 | Mittel je Minute: 1 bei p95 ≤ SLO, sonst clamp(1 − (p95 − SLO) ÷ (1.5 SLO)); Minute ohne Erfolg 0 |
| SLO-Einhaltung | 150 | 150 × clamp((Quote − 0.5) ÷ 0.45) |
| Kosten | 200 | ≤ 75 % Budget 200, bis Budget linear auf 140, darüber 140 × clamp(1 − (K − B) ÷ 0.4B) |
| Datensicherheit | 150 | 120 × clamp(1 − Verlustquote ÷ 0.02) + 30, wenn der Rückstau am Ende ≤ 5 Minuten Nachrichten ist (sonst linear weniger) |
| Anforderungen | 0 | −75 je nicht erfüllte Anforderung (nur `modellieren`) |

Ganze Punkte je Teil, Summe 0–1000. Sterne: ★ ab 400, ★★ ab 650, ★★★ ab 820. Abstimmung (`tests/archsim-balance.test.ts`, Seeds 1–20): Musterstrategie immer ★★★, ohne Massnahmen höchstens ★.

### 9.10 Nachbesprechung (`debrief.ts`)

`zeitachse`: Ereignisse und eigene Aktionen mit Vorher/Nachher (Verfügbarkeit, p95), Störungsphasen (≥ 2 Minuten ausserhalb SLO) mit Ursache (Engpass, Ereignis, Retry-Sturm, Thread-Erschöpfung, Auslastung) und Erholung, erster Retry-Sturm, Öffnen jedes Circuit Breakers, Beginn grösserer Verluste. `lehren` (höchstens 6, zuerst die gewichtigsten): Daten-Engpass ohne Cache/Replica, nie skalierter Engpass, Retry-Sturm, Fehlerkaskade bei langsamer/ausgefallener Abhängigkeit (mit Timeout-Hinweis), zu spät zurückgerolltes Deployment, ungebremste Lastspitze, Verlust kritischer Vorgänge (Queue/Outbox bzw. Kapazität), Pufferüberlauf, Rückstau am Ende, Budget überschritten; positiv: SLO gehalten, Queue hat abgefedert, Circuit Breaker hat gewirkt. Jede Lehre mit `haetteGeholfen` und `link` auf `/lernseiten/avsw/<slug>#<abschnitt>`.

### 9.11 Missionen

| ID | Titel | Art | Kern |
|----|-------|-----|------|
| `m1-velokurier` | Velokurier über Mittag | vorgegeben, geführt | Monolith + DB, Last ×4,5, Regen ×1.4; skalieren und Cache |
| `m2-black-friday` | Black Friday im Webshop | vorgegeben | Gateway, Katalog, Bestellung, Lager, Zahlung, Broker → Versand; Spitze ×8, fehlerhaftes Deployment; SLO p95 < 400 ms, ≥ 99.5 %, 750 CHF |
| `m3-zahlungsanbieter` | Der Zahlungsanbieter stottert | vorgegeben | PayAlpin hängt (×50, 20 Minuten), dann 10 Minuten Ausfall; 10 s Timeout und 3 Retries als Startkonfiguration; Kaufstatus-Abfrage (15 %) läuft auf denselben Threads wie der Queue-Konsument. Abstimmung: nur Queue ≤ ★★, Resilienz ohne Queue ≤ ★ (Käufe verloren), Queue + zwei von Timeout/Retry-Begrenzung/Circuit Breaker/Bulkhead ★★★ |
| `m4-ticketplattform` | Modelliere die Ticketplattform | modellieren | Auftrag mit Bausteinen (`data-baustein`), Palette mit Ablenkern, 6 Anforderungen, Musterlösung; Vorverkauf ×10, langsamer Zahlungsanbieter |

## 10. Modulnotation AVSW: UML-Komponentendiagramm mit Paketen (Erweiterung, verbindlich)

Die Modulschlussprüfung verlangt **UML-Komponentendiagramme nach Referenzarchitekturen**: verschachtelte Pakete (Tiers/Layers), Komponenten mit technologiespezifischem Stereotyp, bereitgestellte und benötigte Schnittstellen (Ball and Socket) mit Namen, beschriftete Assoziationen (Protokoll, Format/Semantik), Abhängigkeiten zwischen Paketen, Notizen und `{xor}`-Einschränkungen. Die Engine bildet das zusätzlich zur bisherigen Darstellung ab (`notation: "uml-komponenten"`).

### 10.1 Rollenfarben (wie in den Referenzarchitekturen des Moduls, für den Lerntransfer)

| `rolle` | Bedeutung | Farbton |
|---------|-----------|---------|
| `client` | Client-Apps, Präsentationskomponenten | Apricot |
| `webapi` | Web API / Web Services, Service-Consumer-Apps | Grün |
| `business` | Domänen-/Business-Komponenten, Facade, Microservices | Hellblau/Türkis |
| `shared` | Shared Services | Blau |
| `async` | asynchrone Adapter (Receiver/Sender), MOM/Broker | Pink |
| `sync` | synchrone (Driven) Adapter, Service-Provider-Apps | Gelb |
| `daten` | DACs, Datenbanken, Data Services | Grau |
| `infra` | Docker-Host-MQ, Infrastruktur-Hinweise | Lavendel |
| `extern` | Umsysteme ohne besondere Rolle | Weiss/Grau gestrichelt |

`rolle` ist optional; ohne Angabe leitet die Engine sie aus `typ` ab. Tokens `--r-<rolle>` / `--r-<rolle>-bg` in `architektur.css` (hell/dunkel). Die bisherigen Kategorien (Abschnitt 3) bleiben für die anderen Ansichten bestehen.

### 10.2 Modell-Erweiterungen

```js
{
  notation: "uml-komponenten",
  pakete: [                                   // verschachtelte UML-Pakete, Reihenfolge = Darstellung
    { id: "server", name: "Server – Docker Host", in: null, spalte: 0, zeile: 1, breite: 3 },
    { id: "client", name: "Client Tier", spalte: 0, zeile: 0, breite: 3 }
  ],
  elemente: [
    { id: "ws", typ: "dienst", rolle: "webapi", name: "Web API", stereotyp: "Microservice", in: "server",
      schnittstellen: [{ id: "gql", name: "GraphQL" }, { id: "odata", name: "OData" }] }   // bereitgestellt (Ball)
  ],
  verbindungen: [
    { von: "spa", nach: "ws#gql", art: "assoziation", label: "AJAX" },          // Ziel = Schnittstelle → Socket am Aufrufer
    { von: "zeit", nach: "broker#amqp", art: "assoziation", protokoll: "AMQP", format: "JSON" },
    { von: "client", nach: "server", art: "abhaengigkeit" }                       // Paket → Paket, gestrichelt
  ],
  notizen: [{ id: "n1", text: "MDB = Message-Driven Bean", an: "recv" }],
  einschraenkungen: [{ text: "{xor}", zwischen: ["v3", "v4"] }]
}
```

- Pakete: Rasterlayout je Elternpaket (`spalte`, `zeile`, `breite`, `hoehe` in Zellen); Elemente fliessen im Paket in Reihen. Ohne Angaben ordnet die Engine Pakete untereinander an.
- `art: "assoziation"` = UML-Assoziation (durchgezogene Linie ohne Pfeil), die im Modul übliche Verbindung; `abhaengigkeit` = gestrichelt mit offener Spitze. Ziel `element#schnittstelle` zeichnet Ball (Anbieter) und Socket (Nutzer).
- `label` frei; `protokoll`, `format`, `semantik` werden als Label `Protokoll · Format` gesetzt, wenn `label` fehlt.

### 10.3 Prüfungsspiel (`Architektur.spiel` mit `modus: "uml"`)

Level-Erweiterungen:

```js
{
  modus: "uml", auftrag: "<p>…</p>", referenz: "jakarta",          // Referenzarchitektur als Tipp (kostet XP)
  pakete: [...],                                                   // vorgegebene leere Pakete (Ablagefelder) oder aus der Palette zu setzen
  palette: [{ id, typ, rolle, name, stereotypen: ["EJB", "EJB MDB", "C#"], schnittstellen: [...], falle: "Ein Web-Server ist Infrastruktur, keine Komponente." }],
  protokolle: ["REST", "SOAP", "GraphQL", "OData", "gRPC", "AMQP", "JMS", "MQTT", "RMI", "HTTP", "SMTP", "AD LDS"],
  loesung: {
    elemente: [{ id, paket, stereotyp }],
    verbindungen: [{ von, nach, art, protokoll, warum }],
    beschreibungen: [{ id, optionen: ["…", "…", "…"], richtig: 0 }]   // optional: passende 2–3-Satz-Beschreibung wählen
  },
  gewichte: { komponenten: 2, pakete: 1, stereotypen: 1, verbindungen: 2, beschriftungen: 1, beschreibungen: 1 },
  zielzeit: 600
}
```

Bewertung je Kriterium mit Teilpunkten wie ein Bewertungsraster; Fallen (`falle`) geben Abzug mit Erklärung; Rückmeldung je Kriterium («Pakete 4/5: «Sender Adapter» gehört in den Async Communication Layer»). Prüfungsmodus wie Abschnitt 7.
