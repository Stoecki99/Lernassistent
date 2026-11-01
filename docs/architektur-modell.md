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
  richtung: "rechts",                              // Hauptflussrichtung für das Auto-Layout: "rechts" | "unten"
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
        { bei: "zahlung", text: "Zahlungsanbieter antwortet nicht.", fehler: true }   // Ereignis an einem Element
      ] }
  ]
}
```

Regeln: IDs eindeutig, `a-z0-9-`. `von`/`nach` zeigen auf Elemente (nicht Gruppen, ausser `art: "deploy"`). Ohne `x`/`y` legt die Engine selbst aus (Schichten nach Kategorie: client → zugang/sicherheit → dienst → messaging → daten, extern rechts; Gruppen zusammenhalten).

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
    verwandt: ["pubsub", "esb"],
    modell: { /* Modell nach 4, mit ablaeufe */ }
  }]
}
```

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

Spielmechanik: Levelkarte mit Schlössern (nächstes Level frei ab 1 Stern), pro Level 0–3 Sterne (★ ≥ 50 %, ★★ ≥ 80 %, ★★★ = 100 % ohne Fehlversuch), XP = Grundpunkte × Schwierigkeit + Zeitbonus − Tipps; Tipps kosten XP und zeigen gestuft (Textstelle → Element → Verbindung); «Prüfen» zeigt Treffer direkt im Diagramm (grün/rot mit ✓/✗) und am Schluss die Musterlösung als animierter Ablauf. Serie (Combo) für Level hintereinander ohne Fehler. `prefers-reduced-motion` ohne Konfetti.

Ereignis nach jedem abgeschlossenen Level: `architektur:spiel` (bubbelt) mit `detail: { spielId, levelId, sterne, xp, richtig, gesamt, loesungGezeigt, gespeichert }`. Die Engine speichert selbst über `/api/spielstand` (siehe 8), ausser `opt.speichern === false` oder in der Vorschau ohne API (Fehler abfangen, Seite läuft weiter).

## 8. Spielstand-API

`GET /api/spielstand?fach=avsw` → `[{ spiel, level, sterne, xp, aktualisiert }]` des eingeloggten Kontos.

`POST /api/spielstand` mit `{ fach, spiel, level, sterne, xp }`:

- Login nötig (401), Zod: `fach` `^[a-z0-9]+$`, `spiel` `^[a-z0-9-]{1,60}$`, `level` `^[a-z0-9-]{1,40}$`, `sterne` 0–3, `xp` 0–500 ganzzahlig.
- Speichert den **Bestwert** (höhere Sterne, bei Gleichstand höhere XP); schlechtere Werte ändern nichts.
- Punkte ins Konto (`User.points`) = Verbesserung der besten XP dieses Levels ÷ 10, abgerundet. Antwort `{ ok: true, verbessert, punkte }`.
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
