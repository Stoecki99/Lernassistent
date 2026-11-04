/* ==========================================================================
   Lernpfad AVSW · architektur.js · Architektur-Engine
   Zeichnet Architektur-Modelle in UML-Notation als SVG, interaktiv:
   Steckbriefe, Abläufe, Ausfälle, Atlas, Editor und Modellierspiel.
   Vanilla-JS ohne Abhängigkeiten. Globales Objekt window.Architektur.
   Einbinden NACH lernpfad.js. Vertrag: docs/architektur-modell.md
   Doku: docs/lernpfad-architektur.md
   ========================================================================== */
(function () {
  "use strict";

  if (window.Architektur && window.Architektur.version) return; // doppelt eingebunden

  const NS = "http://www.w3.org/2000/svg";
  const LP = () => window.Lernpfad || null;

  /* ---------- 1. Grundlagen ---------- */

  let zaehler = 0;
  const neueId = (p) => "ar-" + p + "-" + ++zaehler;
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  function erzeugen(tag, klasse, html) {
    const e = document.createElement(tag);
    if (klasse) e.className = klasse;
    if (html !== undefined && html !== null) e.innerHTML = html;
    return e;
  }
  function knopf(html, klasse, attribute) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "btn" + (klasse ? " " + klasse : "");
    b.innerHTML = html;
    if (attribute) Object.keys(attribute).forEach((k) => b.setAttribute(k, attribute[k]));
    return b;
  }
  function svgEl(tag, attr, klasse) {
    const e = document.createElementNS(NS, tag);
    if (klasse) e.setAttribute("class", klasse);
    if (attr) Object.keys(attr).forEach((k) => e.setAttribute(k, attr[k]));
    return e;
  }
  function ansage() {
    const p = erzeugen("p", "sr-only");
    p.setAttribute("aria-live", "polite");
    return p;
  }
  const esc = (s) => String(s === undefined || s === null ? "" : s).replace(/[&<>"]/g, (z) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[z]);
  function ohneTags(html) {
    const d = document.createElement("div");
    d.innerHTML = html || "";
    return (d.textContent || "").replace(/\s+/g, " ").trim();
  }
  function fehler(baustein, text) {
    console.error("[Architektur] " + baustein + ": " + text);
    return null;
  }
  function elementHolen(el, baustein) {
    const e = typeof el === "string" ? document.querySelector(el) : el;
    if (!e) fehler(baustein, "Element nicht gefunden (" + el + ").");
    return e;
  }
  const wenigerBewegung = () => !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const kopie = (o) => JSON.parse(JSON.stringify(o));
  const klemmen = (v, a, b) => Math.max(a, Math.min(b, v));
  function formelnSetzen(el) {
    const L = LP();
    if (L && typeof L.formeln === "function") {
      try { L.formeln(el); } catch (e) { /* Seite läuft weiter */ }
    }
  }
  function kontext() {
    const b = document.body;
    return { fach: ((b && b.dataset.fach) || "").trim(), thema: ((b && b.dataset.thema) || "").trim() };
  }
  function zeitText(s) {
    s = Math.max(0, Math.round(s));
    return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
  }

  /* ---------- 2. Vokabular: Kategorien, Typen, Verbindungsarten ---------- */

  const KATEGORIEN = [
    { id: "client", name: "Client", kurz: "Wer das System nutzt: Menschen, Browser, Apps" },
    { id: "zugang", name: "Zugang", kurz: "Eingang ins System: Gateway, Load Balancer, CDN" },
    { id: "sicherheit", name: "Sicherheit", kurz: "Anmeldung und Berechtigung" },
    { id: "dienst", name: "Dienste", kurz: "Fachlogik: Services, Funktionen, Anwendungen" },
    { id: "messaging", name: "Messaging", kurz: "Nachrichten puffern und verteilen" },
    { id: "daten", name: "Daten", kurz: "Speichern, cachen, suchen" },
    { id: "extern", name: "Extern", kurz: "Fremdsysteme ausserhalb deiner Kontrolle" },
    { id: "infrastruktur", name: "Infrastruktur", kurz: "Server, Cluster, Container, Betrieb" },
  ];
  const KAT = {};
  KATEGORIEN.forEach((k) => (KAT[k.id] = k));

  // Typ → Kategorie, UML-Form, Stereotyp, Piktogramm, deutscher Name, Beispiele
  const TYPEN = {
    akteur: { kategorie: "client", form: "akteur", stereotyp: "actor", pikto: "user", name: "Akteur", beispiele: "Kundin, Sachbearbeiter" },
    web: { kategorie: "client", form: "komponente", stereotyp: "web client", pikto: "client", name: "Web-Client", beispiele: "React, Angular, Vue" },
    mobile: { kategorie: "client", form: "komponente", stereotyp: "mobile app", pikto: "mobile", name: "Mobile App", beispiele: "Swift, Kotlin, Flutter" },
    cdn: { kategorie: "zugang", form: "knoten", stereotyp: "CDN", pikto: "cdn", name: "CDN", beispiele: "Cloudflare, CloudFront" },
    gateway: { kategorie: "zugang", form: "komponente", stereotyp: "API gateway", pikto: "gateway", name: "API-Gateway", beispiele: "Kong, Spring Cloud Gateway, NGINX" },
    lastverteiler: { kategorie: "zugang", form: "komponente", stereotyp: "load balancer", pikto: "lb", name: "Load Balancer", beispiele: "HAProxy, NGINX, AWS ALB" },
    ingress: { kategorie: "zugang", form: "komponente", stereotyp: "ingress", pikto: "ingress", name: "Ingress", beispiele: "NGINX Ingress, Traefik" },
    auth: { kategorie: "sicherheit", form: "komponente", stereotyp: "identity provider", pikto: "auth", name: "Identity Provider", beispiele: "Keycloak, Auth0, Entra ID" },
    dienst: { kategorie: "dienst", form: "komponente", stereotyp: "service", pikto: "service", name: "Dienst", beispiele: "Spring Boot, Node.js, Go, .NET" },
    monolith: { kategorie: "dienst", form: "komponente", gross: true, stereotyp: "application", pikto: "monolith", name: "Monolith", beispiele: "Java EE, Rails, Django" },
    funktion: { kategorie: "dienst", form: "komponente", stereotyp: "function", pikto: "function", name: "Funktion", beispiele: "AWS Lambda, Azure Functions" },
    orchestrator: { kategorie: "dienst", form: "komponente", stereotyp: "orchestrator", pikto: "orchestrator", name: "Orchestrator", beispiele: "Camunda, Temporal" },
    queue: { kategorie: "messaging", form: "queue", stereotyp: "queue", pikto: "queue", name: "Queue", beispiele: "RabbitMQ, ActiveMQ, Amazon SQS" },
    topic: { kategorie: "messaging", form: "topic", stereotyp: "topic", pikto: "topic", name: "Topic", beispiele: "Kafka, Pulsar, SNS" },
    broker: { kategorie: "messaging", form: "komponente", stereotyp: "message broker", pikto: "broker", name: "Message Broker", beispiele: "RabbitMQ, Kafka, IBM MQ" },
    bus: { kategorie: "messaging", form: "bus", stereotyp: "enterprise service bus", pikto: "bus", name: "Service-Bus (ESB)", beispiele: "MuleSoft, IBM IIB, WSO2" },
    mesh: { kategorie: "infrastruktur", form: "komponente", stereotyp: "sidecar proxy", pikto: "mesh", name: "Sidecar-Proxy", beispiele: "Envoy, Istio, Linkerd" },
    datenbank: { kategorie: "daten", form: "zylinder", stereotyp: "database", pikto: "db", name: "Datenbank", beispiele: "PostgreSQL, MySQL, Oracle" },
    nosql: { kategorie: "daten", form: "zylinder", stereotyp: "document store", pikto: "nosql", name: "NoSQL-Datenbank", beispiele: "MongoDB, Cassandra, DynamoDB" },
    cache: { kategorie: "daten", form: "komponente", stereotyp: "cache", pikto: "cache", name: "Cache", beispiele: "Redis, Memcached" },
    suche: { kategorie: "daten", form: "zylinder", stereotyp: "search index", pikto: "suche", name: "Suchindex", beispiele: "Elasticsearch, OpenSearch" },
    speicher: { kategorie: "daten", form: "ordner", stereotyp: "object storage", pikto: "storage", name: "Objektspeicher", beispiele: "S3, MinIO, Azure Blob" },
    extern: { kategorie: "extern", form: "komponente", gestrichelt: true, stereotyp: "external system", pikto: "extern", name: "Fremdsystem", beispiele: "Zahlungsanbieter, SMS-Dienst" },
    knoten: { kategorie: "infrastruktur", form: "knoten", gruppe: true, stereotyp: "node", pikto: "node", name: "Knoten (Server)", beispiele: "Server, VM" },
    cluster: { kategorie: "infrastruktur", form: "knoten", gruppe: true, stereotyp: "cluster", pikto: "cluster", name: "Cluster", beispiele: "Kubernetes-Cluster" },
    pod: { kategorie: "infrastruktur", form: "knoten", gruppe: true, stereotyp: "pod", pikto: "pod", name: "Pod", beispiele: "Kubernetes-Pod" },
    container: { kategorie: "infrastruktur", form: "artefakt", stereotyp: "container", pikto: "container", name: "Container", beispiele: "Docker-Image" },
    artefakt: { kategorie: "infrastruktur", form: "artefakt", stereotyp: "artifact", pikto: "artefakt", name: "Artefakt", beispiele: ".jar, .war, Image" },
    paket: { kategorie: null, form: "paket", gruppe: true, stereotyp: "", pikto: "paket", name: "Paket", beispiele: "Bounded Context, Schicht" },
    grenze: { kategorie: null, form: "grenze", gruppe: true, stereotyp: "", pikto: "grenze", name: "Grenze", beispiele: "Systemgrenze, Zone, Rechenzentrum" },
    schnittstelle: { kategorie: null, form: "lolli", stereotyp: "interface", pikto: "schnittstelle", name: "Schnittstelle", beispiele: "REST-API, gRPC-Service" },
    filter: { kategorie: "dienst", form: "komponente", stereotyp: "filter", pikto: "filter", name: "Filter", beispiele: "Pipes-and-Filters-Stufe" },
    peer: { kategorie: "dienst", form: "komponente", stereotyp: "peer", pikto: "peer", name: "Peer", beispiele: "BitTorrent-Knoten" },
    plugin: { kategorie: "dienst", form: "komponente", stereotyp: "plug-in", pikto: "plugin", name: "Plug-in", beispiele: "Erweiterung im Microkernel" },
    monitor: { kategorie: "infrastruktur", form: "komponente", stereotyp: "monitoring", pikto: "monitor", name: "Monitoring", beispiele: "Prometheus, Grafana" },
    netz: { kategorie: "infrastruktur", form: "bus", netz: true, stereotyp: "network", pikto: "netz", name: "Netz", beispiele: "LoRaWAN, LTE-M, Glasfaser, VPN" },
  };

  const ARTEN = {
    sync: { name: "synchroner Aufruf", kurz: "synchron", erkl: "Request/Response: der Aufrufer wartet auf die Antwort" },
    async: { name: "asynchrone Nachricht", kurz: "asynchron", erkl: "Nachricht oder Event: der Sender wartet nicht" },
    daten: { name: "liest/schreibt Daten", kurz: "Datenzugriff", erkl: "Zugriff auf eine Datenhaltung" },
    abhaengigkeit: { name: "nutzt (Abhängigkeit)", kurz: "Abhängigkeit", erkl: "UML-Dependency «use»", standardLabel: "«use»" },
    realisiert: { name: "stellt Schnittstelle bereit", kurz: "realisiert", erkl: "Komponente bietet die Schnittstelle an (Lollipop)" },
    deploy: { name: "läuft auf", kurz: "Deployment", erkl: "Artefakt ist auf einem Knoten verteilt", standardLabel: "«deploy»" },
    stream: { name: "Datenstrom (Pipe)", kurz: "Pipe", erkl: "Daten fliessen ununterbrochen von Stufe zu Stufe" },
    assoziation: { name: "Assoziation", kurz: "Assoziation", erkl: "UML-Assoziation: die beiden kommunizieren (Protokoll und Format stehen an der Linie)" },
  };
  const ART_IDS = Object.keys(ARTEN);
  // Abhängig im Sinne des Ausfalls: der Aufrufer wartet auf das Ziel
  const SYNCHRON_ARTEN = { sync: 1, daten: 1, abhaengigkeit: 1, realisiert: 1, stream: 1, assoziation: 1 };
  // Protokolle, die über einen Puffer laufen (Assoziation zählt dann im Ausfall als asynchron)
  const ASYNC_PROTOKOLL = /\b(AMQP|JMS|MQTT|MQ|Kafka|async|STOMP|Jakarta Messaging)\b/i;

  // Rollenfarben der Modulnotation (Vertrag 10.1)
  const ROLLEN = [
    { id: "client", name: "Client / Präsentation", kurz: "Client-Apps und Präsentationskomponenten" },
    { id: "webapi", name: "Web API / Consumer", kurz: "Web API, Web Services, Service-Consumer-Apps" },
    { id: "business", name: "Business / Domäne", kurz: "Domänen- und Business-Komponenten, Facade, Microservices" },
    { id: "shared", name: "Shared Services", kurz: "gemeinsam genutzte Dienste" },
    { id: "async", name: "asynchron / MOM", kurz: "Receiver- und Sender-Adapter, Message Broker" },
    { id: "sync", name: "synchron / Provider", kurz: "Driven Adapter, Service-Provider-Apps" },
    { id: "daten", name: "Daten", kurz: "DACs, Datenbanken, Data Services" },
    { id: "infra", name: "Infrastruktur", kurz: "Docker-Host-MQ und Infrastruktur" },
    { id: "extern", name: "Umsystem", kurz: "Umsysteme ohne besondere Rolle" },
  ];
  const ROLLE = {};
  ROLLEN.forEach((r) => (ROLLE[r.id] = r));
  const ROLLE_VON_TYP = {
    akteur: "client", web: "client", mobile: "client", gateway: "webapi", auth: "shared", cdn: "infra", lastverteiler: "infra", ingress: "infra",
    dienst: "business", monolith: "business", funktion: "business", orchestrator: "business", filter: "business", peer: "business", plugin: "business",
    queue: "async", topic: "async", broker: "async", bus: "async", mesh: "infra", monitor: "infra", knoten: "infra", cluster: "infra", pod: "infra",
    container: "infra", artefakt: "infra", datenbank: "daten", nosql: "daten", cache: "daten", suche: "daten", speicher: "daten", extern: "extern", netz: "infra",
  };
  // Netz (IoT: Field/Access/Service Network): eigener Typ oder Bus mit Stereotyp «network»
  const istNetzEl = (e) => !!e && (e.typ === "netz" || (e.typ === "bus" && /network|netz/i.test(e.stereotyp || "")));
  // Puffer: Message Broker, Queue, Topic, Bus (aber kein Netz), auch Komponenten, die als MOM/Broker benannt sind
  const istPufferEl = (e) => !!e && !istNetzEl(e) && (kategorieVon(e.typ) === "messaging" ||
    (/\b(MOM|Message Broker|Broker|Queue|Topic)\b/i.test(ohneTags(e.name) + " " + (e.stereotyp || "")) && !/adapter|receiver|sender|empf/i.test(ohneTags(e.name))));

  const kategorieVon = (typ) => (TYPEN[typ] ? TYPEN[typ].kategorie : null);
  const istGruppenTyp = (typ) => !!(TYPEN[typ] && TYPEN[typ].gruppe);
  const katKlasse = (typ) => "ar-k-" + (kategorieVon(typ) || "neutral");
  // Farbklasse eines Elements: in der Modulnotation die Rolle, sonst die Kategorie
  const klasseVon = (e) => (e && e.rolle ? "ar-r-" + e.rolle : katKlasse(e ? e.typ : ""));

  /* ---------- 3. Piktogramme (24×24, currentColor, keine Markenlogos) ---------- */

  const PIKTO = {
    client: '<rect x="2.5" y="4" width="19" height="15" rx="2"/><path d="M2.5 8h19"/><circle cx="5.5" cy="6" r=".6" class="pk-f"/><circle cx="7.8" cy="6" r=".6" class="pk-f"/>',
    mobile: '<rect x="7" y="2.5" width="10" height="19" rx="2"/><path d="M10.5 18.5h3"/>',
    user: '<circle cx="12" cy="8" r="3.5"/><path d="M5 20.5c.8-4 3.6-6 7-6s6.2 2 7 6"/>',
    gateway: '<path d="M12 2.5l8 3v6c0 5-3.4 8.6-8 10-4.6-1.4-8-5-8-10v-6z"/><path d="M8.5 12h7M13 9.5l2.5 2.5-2.5 2.5"/>',
    lb: '<circle cx="5" cy="12" r="2.2"/><circle cx="19" cy="5" r="2.2"/><circle cx="19" cy="12" r="2.2"/><circle cx="19" cy="19" r="2.2"/><path d="M7.2 12h9.6M7 11l10-5M7 13l10 5"/>',
    ingress: '<path d="M3 4.5h18v15H3z"/><path d="M3 12h9M9 9l3 3-3 3M15 8h3M15 12h3M15 16h3"/>',
    service: '<path d="M12 2.8l8 4.6v9.2l-8 4.6-8-4.6V7.4z"/><path d="M9 12h6M12 9v6"/>',
    monolith: '<rect x="3.5" y="2.5" width="17" height="19" rx="2"/><path d="M3.5 8.5h17M3.5 14.5h17M12 8.5v13"/>',
    function: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M8.5 7.5c2 0 2.5 1 3 3l2 6.5M12.6 12.4L9 17"/>',
    orchestrator: '<circle cx="12" cy="5" r="2.4"/><circle cx="5" cy="18.5" r="2.4"/><circle cx="12" cy="18.5" r="2.4"/><circle cx="19" cy="18.5" r="2.4"/><path d="M12 7.4v8.7M10.6 6.9L6.2 16.4M13.4 6.9l4.4 9.5"/>',
    queue: '<rect x="2.5" y="7" width="19" height="10" rx="2"/><path d="M7 7v10M11.5 7v10M16 7v10"/><path d="M19 4.5h2.5M2.5 19.5H5"/>',
    topic: '<circle cx="5" cy="12" r="2.3"/><path d="M7.3 12H11M11 12l3-6h4.5M11 12h7.5M11 12l3 6h4.5"/><circle cx="20" cy="6" r="1.3"/><circle cx="20" cy="12" r="1.3"/><circle cx="20" cy="18" r="1.3"/>',
    broker: '<rect x="8" y="8" width="8" height="8" rx="1.5"/><path d="M2.5 12H8M16 12h5.5M12 2.5V8M12 16v5.5"/><path d="M4.5 10l-2 2 2 2M19.5 10l2 2-2 2"/>',
    bus: '<rect x="2.5" y="9" width="19" height="6" rx="3"/><path d="M6 9V4.5M12 9V4.5M18 9V4.5M6 15v4.5M12 15v4.5M18 15v4.5"/>',
    mesh: '<rect x="3" y="6" width="9" height="12" rx="1.5"/><rect x="14" y="8.5" width="6.5" height="7" rx="1.5"/><path d="M12 12h2"/>',
    db: '<ellipse cx="12" cy="5.5" rx="7.5" ry="2.8"/><path d="M4.5 5.5v13c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8v-13M4.5 12c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8"/>',
    nosql: '<ellipse cx="12" cy="5.5" rx="7.5" ry="2.8"/><path d="M4.5 5.5v13c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8v-13"/><path d="M9 11.5h6M9 15h4"/><path d="M8 10v6.5"/>',
    cache: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M13 7.5l-4 5h4l-2 4.5"/>',
    suche: '<circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5.5 5.5M8 10.5h5M10.5 8v5"/>',
    storage: '<path d="M4 7l8-4 8 4-8 4z"/><path d="M4 12l8 4 8-4M4 17l8 4 8-4"/>',
    extern: '<path d="M7 18.5h10.5a4 4 0 0 0 .5-8 6 6 0 0 0-11.4-1.6A4.8 4.8 0 0 0 7 18.5z"/>',
    node: '<rect x="3" y="4" width="18" height="7" rx="1.5"/><rect x="3" y="13" width="18" height="7" rx="1.5"/><circle cx="7" cy="7.5" r=".8" class="pk-f"/><circle cx="7" cy="16.5" r=".8" class="pk-f"/><path d="M11 7.5h6M11 16.5h6"/>',
    cluster: '<circle cx="12" cy="12" r="9.5"/><circle cx="12" cy="12" r="2.5"/><path d="M12 2.5v7M12 14.5v7M2.5 12h7M14.5 12h7M5.3 5.3l5 5M13.7 13.7l5 5M18.7 5.3l-5 5M10.3 13.7l-5 5"/>',
    pod: '<path d="M12 2.5l8.5 5v9l-8.5 5-8.5-5v-9z"/><rect x="8" y="8" width="3.4" height="3.4" rx=".5"/><rect x="12.6" y="8" width="3.4" height="3.4" rx=".5"/><rect x="8" y="12.6" width="3.4" height="3.4" rx=".5"/>',
    container: '<path d="M3 8l9-4.5L21 8v8l-9 4.5L3 16z"/><path d="M3 8l9 4.5L21 8M12 12.5v8"/>',
    artefakt: '<path d="M6 2.5h8.5L19 7v14.5H6z"/><path d="M14.5 2.5V7H19M9 12h7M9 15.5h7"/>',
    paket: '<path d="M3 7.5V5h7l1.5 2.5H21v12H3z"/><path d="M3 7.5h8.5"/>',
    grenze: '<rect x="3" y="3" width="18" height="18" rx="2" stroke-dasharray="3 2.5"/>',
    schnittstelle: '<circle cx="15.5" cy="12" r="5"/><path d="M2.5 12h8"/>',
    filter: '<path d="M3 5h18l-7 8v6l-4 2v-8z"/>',
    peer: '<circle cx="6" cy="6" r="2.6"/><circle cx="18" cy="6" r="2.6"/><circle cx="6" cy="18" r="2.6"/><circle cx="18" cy="18" r="2.6"/><path d="M8.6 6h6.8M8.6 18h6.8M6 8.6v6.8M18 8.6v6.8M7.9 7.9l8.2 8.2M16.1 7.9l-8.2 8.2"/>',
    plugin: '<path d="M4 9h3.5a2 2 0 1 1 4 0H15v3.5a2 2 0 1 1 0 4V20H4z"/>',
    monitor: '<rect x="2.5" y="4" width="19" height="14" rx="2"/><path d="M5.5 14l3.5-4 3 2.5 4.5-5.5 2 2"/><path d="M9 21h6"/>',
    netz: '<path d="M2.5 9c3-3 6-3 9.5 0s6.5 3 9.5 0M2.5 15c3-3 6-3 9.5 0s6.5 3 9.5 0"/><circle cx="12" cy="12" r="1.4" class="pk-f"/>',
  };
  function piktoSvg(name, klasse) {
    const inhalt = PIKTO[name] || PIKTO.service;
    return '<svg class="pikto' + (klasse ? " " + klasse : "") + '" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + inhalt + "</svg>";
  }
  // Piktogramm als Gruppe im Diagramm (x, y = linke obere Ecke, g = Grösse)
  const piktoG = (name, x, y, g) =>
    '<g class="ar-pikto" transform="translate(' + x + " " + y + ") scale(" + (g / 24).toFixed(3) + ')">' + (PIKTO[name] || PIKTO.service) + "</g>";

  /* ---------- 4. Modell prüfen und normalisieren ---------- */

  const ID_MUSTER = /^[a-z0-9-]+$/;
  const ELEMENT_FELDER = ["id", "typ", "name", "technologie", "stereotyp", "info", "zustand", "in", "x", "y", "rolle", "schnittstellen", "spalte", "zeile", "breite", "hoehe", "istPaket", "uml"];
  const VERBINDUNG_FELDER = ["id", "von", "nach", "art", "label", "info", "warum", "protokoll", "format", "semantik", "vonSch", "nachSch"];

  function modellPruefen(m, baustein) {
    const f = (t) => fehler(baustein, t);
    if (!m || typeof m !== "object" || !Array.isArray(m.elemente)) return f("Modell braucht «elemente» (Liste).");
    const n = {
      titel: m.titel || "",
      ansicht: m.ansicht || "komponenten",
      richtung: m.richtung === "rechts" ? "rechts" : "unten",
      notation: m.notation === "uml-komponenten" ? "uml-komponenten" : "",
      elemente: [],
      verbindungen: [],
      ablaeufe: [],
      notizen: [],
      einschraenkungen: [],
    };
    const uml = n.notation === "uml-komponenten";
    const nachId = {};
    const zahl = (v) => (Number.isFinite(v) ? v : undefined);
    // Modulnotation: Pakete als Gruppen vom Typ «paket»
    const allesElemente = (uml && Array.isArray(m.pakete) ? m.pakete.map((p) => Object.assign({}, p, { typ: "paket", istPaket: true })) : []).concat(m.elemente);
    for (const e of allesElemente) {
      if (!e || !e.id || !ID_MUSTER.test(e.id)) return f("Element-ID «" + (e && e.id) + "» fehlt oder ist ungültig (a-z, 0-9, -).");
      if (nachId[e.id]) return f("Element-ID «" + e.id + "» doppelt.");
      if (!TYPEN[e.typ]) return f("Typ «" + e.typ + "» bei «" + e.id + "» unbekannt. Bekannt: " + Object.keys(TYPEN).join(", ") + ".");
      const k = {
        id: e.id, typ: e.typ, name: e.name || TYPEN[e.typ].name,
        technologie: e.technologie || "", stereotyp: e.stereotyp !== undefined ? e.stereotyp : TYPEN[e.typ].stereotyp,
        info: e.info || null, zustand: ["ok", "langsam", "ausfall", "neu"].indexOf(e.zustand) >= 0 ? e.zustand : "ok",
      };
      if (e.in) k.in = e.in;
      if (Number.isFinite(e.x) && Number.isFinite(e.y)) { k.x = e.x; k.y = e.y; }
      // unbekannte Zusatzfelder (z. B. «sim» für den Simulator) unverändert durchreichen
      Object.keys(e).forEach((f2) => { if (!(f2 in k) && ELEMENT_FELDER.indexOf(f2) < 0) k[f2] = e[f2]; });
      if (uml) {
        k.uml = true;
        if (e.istPaket) k.istPaket = true;
        ["spalte", "zeile", "breite", "hoehe"].forEach((f2) => { if (zahl(e[f2]) !== undefined) k[f2] = e[f2]; });
        if (!e.istPaket && e.typ !== "paket" && e.typ !== "grenze") {
          if (e.rolle && !ROLLE[e.rolle]) f("Rolle «" + e.rolle + "» bei «" + e.id + "» unbekannt. Bekannt: " + Object.keys(ROLLE).join(", ") + ".");
          k.rolle = ROLLE[e.rolle] ? e.rolle : ROLLE_VON_TYP[e.typ] || "extern";
          if (e.stereotyp === undefined) k.stereotyp = "";
          k.schnittstellen = (Array.isArray(e.schnittstellen) ? e.schnittstellen : []).filter((x) => x && x.id && ID_MUSTER.test(x.id))
            .map((x) => ({ id: x.id, name: x.name || x.id, seite: ["oben", "unten", "links", "rechts"].indexOf(x.seite) >= 0 ? x.seite : "oben" }));
        }
        if (e.istPaket && e.stereotyp === undefined) k.stereotyp = "";
      }
      nachId[e.id] = k;
      n.elemente.push(k);
    }
    for (const e of n.elemente) {
      if (!e.in) continue;
      const g = nachId[e.in];
      if (!g) return f("«" + e.id + "» liegt in unbekannter Gruppe «" + e.in + "».");
      if (!istGruppenTyp(g.typ)) return f("«" + e.in + "» ist keine Gruppe (Gruppen: knoten, cluster, pod, paket, grenze).");
      let tiefe = 1, p = g;
      const gesehen = { [e.id]: 1 };
      while (p && p.in) {
        if (gesehen[p.id]) return f("Gruppen von «" + e.id + "» bilden einen Kreis.");
        gesehen[p.id] = 1;
        p = nachId[p.in];
        tiefe++;
        if (tiefe > (uml ? 7 : 3)) return f("«" + e.id + "»: Gruppen höchstens " + (uml ? 7 : 3) + " Ebenen tief.");
      }
    }
    const kinderZahl = {};
    n.elemente.forEach((e) => { if (e.in) kinderZahl[e.in] = (kinderZahl[e.in] || 0) + 1; });
    const istGruppe = (id) => istGruppenTyp(nachId[id].typ) && kinderZahl[id] > 0;
    const vIds = {};
    (m.verbindungen || []).forEach((v, i) => {
      if (!v) return;
      const id = v.id && ID_MUSTER.test(v.id) ? v.id : "v" + (i + 1);
      // «element#schnittstelle» (Modulnotation): Ziel ist eine bereitgestellte Schnittstelle
      const teil = (x) => { const t = String(x || "").split("#"); return { el: t[0], sch: t[1] || null }; };
      const a = teil(v.von), b = teil(v.nach);
      if (!nachId[a.el] || !nachId[b.el]) { f("Verbindung " + v.von + " → " + v.nach + " nennt unbekanntes Element (übersprungen)."); return; }
      if (a.el === b.el) { f("Verbindung " + v.von + " → " + v.nach + " zeigt auf sich selbst (übersprungen)."); return; }
      const hatSch = (el, sch) => !sch || (nachId[el].schnittstellen || []).some((x) => x.id === sch);
      if (!hatSch(a.el, a.sch) || !hatSch(b.el, b.sch)) { f("Verbindung " + v.von + " → " + v.nach + ": Schnittstelle unbekannt (übersprungen)."); return; }
      const art = ARTEN[v.art] ? v.art : uml ? "assoziation" : "sync";
      if (v.art && !ARTEN[v.art]) f("Verbindungsart «" + v.art + "» unbekannt, nehme «" + art + "». Bekannt: " + ART_IDS.join(", ") + ".");
      if (!uml && (istGruppe(a.el) || istGruppe(b.el)) && art !== "deploy") { f("Verbindung " + v.von + " → " + v.nach + ": Gruppen nur mit art «deploy» verbinden (übersprungen)."); return; }
      if (vIds[id]) { f("Verbindungs-ID «" + id + "» doppelt (übersprungen)."); return; }
      vIds[id] = 1;
      const fmt = v.format || v.semantik || "";
      const auto = [v.protokoll || "", fmt].filter(Boolean).join(" · ");
      n.verbindungen.push({ id: id, von: a.el, nach: b.el, vonSch: a.sch, nachSch: b.sch, art: art,
        label: v.label !== undefined ? v.label : auto || (uml ? "" : ARTEN[art].standardLabel || ""), info: v.info || v.warum || "",
        protokoll: v.protokoll || "", format: fmt });
      const neu = n.verbindungen[n.verbindungen.length - 1];
      Object.keys(v).forEach((f2) => { if (!(f2 in neu) && VERBINDUNG_FELDER.indexOf(f2) < 0) neu[f2] = v[f2]; });
    });
    (m.ablaeufe || []).forEach((a, i) => {
      if (!a || !Array.isArray(a.schritte) || !a.schritte.length) { f("Ablauf " + (i + 1) + " braucht «schritte» (übersprungen)."); return; }
      const schritte = [];
      for (const s0 of a.schritte) {
        const s = Object.assign({}, s0, { von: s0.von ? String(s0.von).split("#")[0] : s0.von, nach: s0.nach ? String(s0.nach).split("#")[0] : s0.nach });
        if (s.bei !== undefined) {
          if (!nachId[s.bei]) { f("Ablauf «" + (a.id || i) + "»: Schritt bei unbekanntem Element «" + s.bei + "»."); continue; }
        } else if (!nachId[s.von] || !nachId[s.nach]) { f("Ablauf «" + (a.id || i) + "»: Schritt " + s.von + " → " + s.nach + " nennt unbekanntes Element."); continue; }
        schritte.push({
          von: s.von, nach: s.nach, bei: s.bei, art: ARTEN[s.art] ? s.art : null, text: s.text || "",
          parallel: s.parallel === true, fehler: s.fehler === true, phase: s.phase || null,
        });
      }
      if (schritte.length) n.ablaeufe.push({ id: a.id || "ablauf-" + (i + 1), name: a.name || "Ablauf " + (i + 1), schritte: schritte, beschreibung: a.beschreibung || "" });
    });
    if (uml) {
      (m.notizen || []).forEach((no, i) => {
        if (!no || !no.text) return;
        const id = no.id && ID_MUSTER.test(no.id) ? no.id : "notiz-" + (i + 1);
        if (nachId[id]) { f("Notiz-ID «" + id + "» kollidiert mit einem Element (übersprungen)."); return; }
        const an = no.an && nachId[String(no.an).split("#")[0]] ? String(no.an).split("#")[0] : null;
        // Ziel darf auch eine Verbindung sein: Notiz an der Linienmitte
        const kante = !an && no.an ? n.verbindungen.find((v) => v.id === no.an) : null;
        if (no.an && !an && !kante) f("Notiz «" + id + "»: Ziel «" + no.an + "» ist weder Element noch Verbindung.");
        const heim = an ? nachId[an].in || null : kante ? nachId[kante.von].in || null : null;
        n.notizen.push({ id: id, text: no.text, an: an, anKante: kante ? kante.id : null, in: no.in && nachId[no.in] ? no.in : heim,
          spalte: zahl(no.spalte), zeile: zahl(no.zeile) });
      });
      (m.einschraenkungen || []).forEach((x) => {
        if (!x || !Array.isArray(x.zwischen) || x.zwischen.length !== 2) return;
        if (!x.zwischen.every((vid) => n.verbindungen.some((v) => v.id === vid))) { f("Einschränkung " + (x.text || "{xor}") + ": Verbindungen " + x.zwischen.join(", ") + " unbekannt (übersprungen)."); return; }
        n.einschraenkungen.push({ text: x.text || "{xor}", zwischen: x.zwischen.slice() });
      });
    }
    return n;
  }

  // Normalisiertes Modell zurück in die Vertragsform (Abschnitt 4/10): ohne leere Felder und Standardwerte
  function modellSauber(m) {
    const leer = (v) => v === null || v === undefined || v === "" || (Array.isArray(v) && !v.length);
    const raus = { titel: m.titel || undefined, ansicht: m.ansicht, richtung: m.richtung };
    if (m.notation) raus.notation = m.notation;
    const pakete = [], elemente = [];
    m.elemente.forEach((e) => {
      const k = {};
      Object.keys(e).forEach((f2) => { if (f2 !== "uml" && f2 !== "istPaket" && !leer(e[f2])) k[f2] = kopie(e[f2]); });
      if (k.zustand === "ok") delete k.zustand;
      if (TYPEN[e.typ] && k.stereotyp === TYPEN[e.typ].stereotyp) delete k.stereotyp;
      if (k.info && typeof k.info === "object" && !Object.keys(k.info).some((x) => !leer(k.info[x]))) delete k.info;
      if (e.istPaket) { delete k.typ; pakete.push(k); } else elemente.push(k);
    });
    if (pakete.length) raus.pakete = pakete;
    raus.elemente = elemente;
    raus.verbindungen = m.verbindungen.map((v) => {
      const k = {};
      Object.keys(v).forEach((f2) => { if (["vonSch", "nachSch"].indexOf(f2) < 0 && !leer(v[f2])) k[f2] = kopie(v[f2]); });
      if (v.vonSch) k.von = v.von + "#" + v.vonSch;
      if (v.nachSch) k.nach = v.nach + "#" + v.nachSch;
      if (ARTEN[v.art] && k.label === ARTEN[v.art].standardLabel) delete k.label;
      if (k.label && k.label === [v.protokoll, v.format].filter(Boolean).join(" · ")) delete k.label;
      return k;
    });
    if (m.ablaeufe && m.ablaeufe.length) raus.ablaeufe = m.ablaeufe.map((a) => ({ id: a.id, name: a.name, beschreibung: a.beschreibung || undefined,
      schritte: a.schritte.map((st) => { const k = {}; Object.keys(st).forEach((f2) => { if (!leer(st[f2]) && st[f2] !== false) k[f2] = st[f2]; }); return k; }) }));
    if (m.notizen && m.notizen.length) raus.notizen = kopie(m.notizen).map((no) => { Object.keys(no).forEach((f2) => { if (leer(no[f2])) delete no[f2]; }); return no; });
    if (m.einschraenkungen && m.einschraenkungen.length) raus.einschraenkungen = kopie(m.einschraenkungen);
    Object.keys(raus).forEach((f2) => { if (raus[f2] === undefined) delete raus[f2]; });
    return raus;
  }

  /* ---------- 5. Text messen ---------- */

  let messKontext = null;
  const SCHRIFT = '"Source Sans 3", "Segoe UI", system-ui, sans-serif';
  function textBreite(text, px, gewicht) {
    if (!messKontext) {
      try { messKontext = document.createElement("canvas").getContext("2d"); } catch (e) { messKontext = null; }
    }
    if (!messKontext) return String(text).length * px * 0.55;
    messKontext.font = (gewicht || 400) + " " + px + "px " + SCHRIFT;
    return messKontext.measureText(String(text)).width;
  }
  // Text in höchstens «zeilen» Zeilen umbrechen; zu lange Wörter werden verkleinert, notfalls gekürzt
  function umbrechen(text, px, gewicht, breite, zeilen) {
    text = String(text || "").trim();
    let groesse = px;
    for (let versuch = 0; versuch < 4; versuch++) {
      const woerter = text.split(/\s+/);
      const res = [];
      let akt = "";
      for (const w of woerter) {
        const probe = akt ? akt + " " + w : w;
        if (textBreite(probe, groesse, gewicht) <= breite || !akt) akt = probe;
        else { res.push(akt); akt = w; }
      }
      if (akt) res.push(akt);
      const zuBreit = res.some((z) => textBreite(z, groesse, gewicht) > breite);
      if (res.length <= zeilen && !zuBreit) return { zeilen: res, px: groesse };
      if (groesse > px - 2.5) { groesse -= 1; continue; }
      // kürzen
      const r = res.slice(0, zeilen);
      r[r.length - 1] = kuerzen(r[r.length - 1] + (res.length > zeilen ? " …" : ""), groesse, gewicht, breite);
      return { zeilen: r, px: groesse };
    }
    return { zeilen: [kuerzen(text, px, gewicht, breite)], px: px };
  }
  function kuerzen(text, px, gewicht, breite) {
    if (textBreite(text, px, gewicht) <= breite) return text;
    let t = text;
    while (t.length > 1 && textBreite(t + "…", px, gewicht) > breite) t = t.slice(0, -1);
    return t.replace(/\s+$/, "") + "…";
  }

  /* ---------- 6. Layout: Raster, Schichten nach Kategorie, Gruppen ---------- */

  // Schrift in Weltkoordinaten: Name 15, Stereotyp/Technologie/Label 12. Bei Massstab ≥ 0.92 ergibt das ≥ 13.8 px bzw. ≥ 11 px.
  const MASS = { CW: 188, CH: 98, GX: 84, GY: 72, PAD: 22, PADTOP: 42, RAND: 26 };
  const PX = MASS.CW + MASS.GX;
  const PY = MASS.CH + MASS.GY;

  function groesse(e) {
    const t = TYPEN[e.typ];
    switch (t.form) {
      case "akteur": return { w: 96, h: 96 };
      case "zylinder": return { w: 168, h: 96 };
      case "ordner": return { w: 180, h: 86 };
      case "lolli": return { w: 136, h: 64 };
      case "bus": return { w: 188, h: 62 };
      case "knoten": return { w: 188, h: 90 };
      case "artefakt": return { w: 180, h: 80 };
      case "queue": case "topic": return { w: 188, h: 90 };
      default: return { w: 188, h: t.gross ? 98 : 82 };
    }
  }

  function modellIndex(m) {
    const nachId = {}, kinder = {}, ein = {}, aus = {};
    m.elemente.forEach((e) => { nachId[e.id] = e; ein[e.id] = []; aus[e.id] = []; });
    m.elemente.forEach((e) => { if (e.in) (kinder[e.in] = kinder[e.in] || []).push(e.id); });
    m.verbindungen.forEach((v) => { aus[v.von].push(v); ein[v.nach].push(v); });
    const istGruppe = (id) => !!(nachId[id] && istGruppenTyp(nachId[id].typ) && kinder[id] && kinder[id].length);
    return { nachId: nachId, kinder: kinder, ein: ein, aus: aus, istGruppe: istGruppe };
  }

  function schichtVon(e, ix) {
    const k = kategorieVon(e.typ);
    if (e.typ === "schnittstelle") return 1.5;
    if (e.typ === "monitor") return 5;
    if (e.typ === "akteur") return -0.5; // Menschen vor ihren Geräten
    if (e.typ === "mesh") return 1.5; // Sidecar fängt den Verkehr vor dem Dienst ab
    if (e.typ === "container" || e.typ === "artefakt") return 2;
    switch (k) {
      case "client": return 0;
      case "zugang": case "sicherheit": return 1;
      case "dienst": {
        // Konsument hinter einem Broker: unter die Messaging-Schicht, dann fliesst die Nachricht von oben nach unten
        const ein = ix.ein[e.id].filter((v) => v.art !== "deploy");
        if (ein.length && ein.every((v) => kategorieVon(ix.nachId[v.von].typ) === "messaging")) return 3.5;
        return 2;
      }
      case "messaging": return 3;
      case "daten": {
        // Datenhaltung direkt unter ihren Nutzern (nur Dienste/Zugang davor): spart lange Linien
        const nutzer = ix.ein[e.id].map((v) => ix.nachId[v.von]).filter(Boolean);
        if (nutzer.length && nutzer.every((n) => { const k2 = kategorieVon(n.typ); return k2 === "dienst" || k2 === "zugang" || k2 === "client"; }) &&
          nutzer.every((n) => !(ix.ein[n.id].length && ix.ein[n.id].filter((v) => v.art !== "deploy").every((v) => kategorieVon(ix.nachId[v.von].typ) === "messaging")))) return 3;
        return 4;
      }
      default: return 2;
    }
  }

  function autoLayout(m, ix) {
    const elemente = m.elemente.filter((e) => !ix.istGruppe(e.id));
    const schicht = {};
    const rechts = m.richtung === "rechts";
    const nb = (id) => ix.ein[id].filter((v) => v.art !== "deploy").map((v) => v.von).concat(ix.aus[id].filter((v) => v.art !== "deploy").map((v) => v.nach));
    const oberste = (id) => { let e = ix.nachId[id], g = null; while (e && e.in) { g = e.in; e = ix.nachId[e.in]; } return g; };
    elemente.forEach((e) => { if (kategorieVon(e.typ) !== "extern") schicht[e.id] = schichtVon(e, ix); });
    // Schnittstelle (Lollipop): gleich hinter der Komponente ihrer Gruppe, die sie realisiert oder nutzt
    elemente.forEach((e) => {
      if (e.typ !== "schnittstelle") return;
      const n = nb(e.id).filter((id) => schicht[id] !== undefined && ix.nachId[id].typ !== "schnittstelle" && oberste(id) === oberste(e.id));
      if (n.length) schicht[e.id] = Math.max.apply(null, n.map((id) => schicht[id])) + 0.5;
    });
    // Fremdsysteme: Schicht ihrer Nachbarn (Median); bei «unten» rechts aussen, bei «rechts» dahinter
    const fremdSetzen = () => elemente.forEach((e) => {
      if (kategorieVon(e.typ) !== "extern") return;
      const n = nb(e.id).map((id) => schicht[id]).filter((x) => x !== undefined && isFinite(x)).sort((a, b) => a - b);
      const nurQuelle = !ix.ein[e.id].length && ix.aus[e.id].length;
      if (rechts) schicht[e.id] = n.length ? (nurQuelle ? n[0] - 0.5 : n[n.length - 1] + 0.5) : 4.5;
      else schicht[e.id] = n.length ? n[Math.floor((n.length - 1) / 2)] : 2;
    });
    fremdSetzen();
    // Elemente ausserhalb einer Gruppe, die (abgesehen von Clients, Daten und Fremdsystemen) nur mit deren
    // Mitgliedern verbunden sind, z. B. Adapter oder eine verwaltete Datenbank neben dem Cluster: vor oder hinter
    // die Gruppe legen, sonst landen sie quer unter ihr
    const gBereich = {};
    elemente.forEach((e) => {
      const g = oberste(e.id);
      if (!g) return;
      const b = (gBereich[g] = gBereich[g] || { lo: Infinity, hi: -Infinity });
      b.lo = Math.min(b.lo, schicht[e.id]); b.hi = Math.max(b.hi, schicht[e.id]);
    });
    elemente.forEach((e) => {
      if (oberste(e.id) || kategorieVon(e.typ) === "client" || kategorieVon(e.typ) === "extern") return;
      const n = nb(e.id).filter((id) => { const k = kategorieVon(ix.nachId[id].typ); return oberste(id) || (k !== "client" && k !== "daten" && k !== "extern"); });
      if (!n.length) return;
      const gs = Array.from(new Set(n.map(oberste)));
      if (gs.length !== 1 || !gs[0] || !gBereich[gs[0]]) return;
      const b = gBereich[gs[0]];
      if (schicht[e.id] < b.lo || schicht[e.id] > b.hi) return;
      schicht[e.id] = /driving|primär|primary|eingehend/i.test(e.stereotyp || "") ? b.lo - 0.5 : b.hi + 0.5;
    });
    // Datenhaltung immer hinter ihren Nutzern
    elemente.forEach((e) => {
      if (kategorieVon(e.typ) !== "daten") return;
      const nutzer = ix.ein[e.id].filter((v) => v.art !== "deploy").map((v) => schicht[v.von]).filter((x) => x !== undefined);
      if (nutzer.length && Math.max.apply(null, nutzer) >= schicht[e.id]) schicht[e.id] = Math.max.apply(null, nutzer) + 0.5;
    });
    fremdSetzen();
    const schichten = Array.from(new Set(elemente.map((e) => schicht[e.id]))).sort((a, b) => a - b);
    const sIndex = {};
    schichten.forEach((s, i) => (sIndex[s] = i));
    const lage = {}; // id → Index der Schicht
    elemente.forEach((e) => (lage[e.id] = sIndex[schicht[e.id]]));

    const nachbarn = {};
    elemente.forEach((e) => (nachbarn[e.id] = []));
    m.verbindungen.forEach((v) => {
      if (nachbarn[v.von] && nachbarn[v.nach]) { nachbarn[v.von].push(v.nach); nachbarn[v.nach].push(v.von); }
    });

    let pos = {}; // id → absolute Position innerhalb der Schicht (Durchgang 1: undefiniert)
    let ergebnis = null;
    for (let durchgang = 0; durchgang < 3; durchgang++) {
      const hinweis = (id, fallback) => {
        const n = nachbarn[id].filter((x) => pos[x] !== undefined);
        if (!n.length || durchgang === 0) return fallback;
        return n.reduce((s, x) => s + pos[x], 0) / n.length;
      };
      const block = (gid) => {
        // gid = null: Wurzel
        const direkte = m.elemente.filter((e) => (e.in || null) === gid);
        const baender = [], einzel = [], fremd = [];
        direkte.forEach((e, i) => {
          if (ix.istGruppe(e.id)) baender.push(block(e.id));
          else if (gid === null && kategorieVon(e.typ) === "extern" && m.richtung !== "rechts") fremd.push(e);
          else einzel.push({ e: e, h: hinweis(e.id, i), i: i });
        });
        const belegt = {}; // Schicht → Set von Positionen
        const frei = (s, p) => !(belegt[s] && belegt[s][p]);
        const setze = (s, p) => { (belegt[s] = belegt[s] || {})[p] = true; };
        const platz = []; // { id, s, p }
        const bandPlatz = [];
        baender.forEach((b) => {
          let p = 0;
          for (;; p++) {
            let ok = true;
            for (let s = b.lo; s <= b.hi && ok; s++) for (let q = p; q < p + b.breite; q++) if (!frei(s, q)) { ok = false; break; }
            if (ok) break;
          }
          for (let s = b.lo; s <= b.hi; s++) for (let q = p; q < p + b.breite; q++) setze(s, q);
          bandPlatz.push({ b: b, p: p });
        });
        einzel.sort((a, b) => a.h - b.h || a.i - b.i);
        // Hinweis relativ zum Block: am Ende zentriert, darum nur die Reihenfolge nutzen
        einzel.forEach((x) => {
          const s = lage[x.e.id];
          let p = 0;
          while (!frei(s, p)) p++;
          setze(s, p);
          platz.push({ id: x.e.id, s: s, p: p });
        });
        // Breite und Bereich
        let breite = 0, lo = Infinity, hi = -Infinity;
        Object.keys(belegt).forEach((s) => {
          const ps = Object.keys(belegt[s]).map(Number);
          breite = Math.max(breite, Math.max.apply(null, ps) + 1);
          lo = Math.min(lo, Number(s));
          hi = Math.max(hi, Number(s));
        });
        // Segmente: Schichten, die über Bänder verbunden sind, zusammen zentrieren
        const eltern = {};
        Object.keys(belegt).forEach((s) => (eltern[s] = s));
        const finde = (s) => { s = String(s); while (eltern[s] !== undefined && eltern[s] !== s) s = eltern[s]; return s; };
        bandPlatz.forEach(({ b }) => {
          for (let s = b.lo + 1; s <= b.hi; s++) { const ra = finde(s), rb = finde(b.lo); if (ra !== rb) eltern[ra] = rb; }
        });
        const segBreite = {};
        Object.keys(belegt).forEach((s) => {
          const r = finde(Number(s));
          const ps = Object.keys(belegt[s]).map(Number);
          segBreite[r] = Math.max(segBreite[r] || 0, Math.max.apply(null, ps) + 1);
        });
        const versatz = (s) => (breite - segBreite[finde(s)]) / 2;
        const alle = [];
        platz.forEach((x) => alle.push({ id: x.id, s: x.s, p: x.p + versatz(x.s) }));
        bandPlatz.forEach(({ b, p }) => { const o = p + versatz(b.lo); b.platz.forEach((x) => alle.push({ id: x.id, s: x.s, p: x.p + o })); });
        // Fremdsysteme rechts
        const fremdZahl = {};
        fremd.forEach((e) => {
          const s = lage[e.id];
          fremdZahl[s] = fremdZahl[s] || 0;
          alle.push({ id: e.id, s: s, p: breite + fremdZahl[s]++ });
        });
        if (fremd.length) {
          breite += Math.max.apply(null, Object.keys(fremdZahl).map((s) => fremdZahl[s]));
          fremd.forEach((e) => { lo = Math.min(lo, lage[e.id]); hi = Math.max(hi, lage[e.id]); });
        }
        if (!isFinite(lo)) { lo = 0; hi = 0; }
        return { id: gid, breite: Math.max(1, breite), lo: lo, hi: hi, platz: alle };
      };
      ergebnis = block(null);
      pos = {};
      ergebnis.platz.forEach((x) => (pos[x.id] = x.p));
    }
    const zellen = {};
    ergebnis.platz.forEach((x) => {
      zellen[x.id] = m.richtung === "rechts" ? { c: x.s, r: x.p } : { c: x.p, r: x.s };
    });
    return zellen;
  }

  // Peer-to-Peer: Ring statt Schichten (alle sind gleichberechtigt); Knoten mit den meisten Verbindungen in die Mitte
  function ringLayout(m, ix) {
    const els = m.elemente.filter((e) => !ix.istGruppe(e.id));
    if (els.some((e) => e.in) || els.filter((e) => e.typ === "peer").length < 3) return null;
    const grad = (id) => ix.ein[id].length + ix.aus[id].length;
    const nichtPeer = els.filter((e) => e.typ !== "peer").sort((a, b) => grad(b.id) - grad(a.id));
    const mitte = nichtPeer.length && grad(nichtPeer[0].id) >= 3 ? nichtPeer[0] : null;
    const ring = els.filter((e) => e !== mitte);
    const n = ring.length;
    const k = n <= 8 ? 3 : n <= 12 ? 4 : 5;
    const plaetze = [];
    for (let c = 0; c < k; c++) plaetze.push([c, 0]);
    for (let r = 1; r < k; r++) plaetze.push([k - 1, r]);
    for (let c = k - 2; c >= 0; c--) plaetze.push([c, k - 1]);
    for (let r = k - 2; r >= 1; r--) plaetze.push([0, r]);
    if (n > plaetze.length) return null;
    const zellen = {};
    ring.forEach((e, i) => {
      const p = plaetze[Math.floor((i * plaetze.length) / n)];
      zellen[e.id] = { c: p[0], r: p[1] };
    });
    if (mitte) zellen[mitte.id] = { c: (k - 1) / 2, r: (k - 1) / 2 };
    return zellen;
  }

  // Lage berechnen: Rasterzellen → Pixel, Gruppenrahmen, Gesamtfläche
  function layoutBerechnen(m, opt) {
    opt = opt || {};
    const ix = modellIndex(m);
    const blaetter = m.elemente.filter((e) => !ix.istGruppe(e.id));
    let zellen;
    const manuell = opt.manuell || (blaetter.length > 0 && blaetter.every((e) => Number.isFinite(e.x) && Number.isFinite(e.y)));
    if (manuell) {
      zellen = {};
      blaetter.forEach((e) => (zellen[e.id] = { c: Number(e.x) || 0, r: Number(e.y) || 0 }));
    } else {
      zellen = ringLayout(m, ix) || autoLayout(m, ix);
    }
    // Gruppenbereiche (Zellen) von innen nach aussen
    const gruppen = m.elemente.filter((e) => ix.istGruppe(e.id));
    const bereich = {};
    const bereichVon = (gid) => {
      if (bereich[gid]) return bereich[gid];
      let c0 = Infinity, c1 = -Infinity, r0 = Infinity, r1 = -Infinity;
      (ix.kinder[gid] || []).forEach((k) => {
        const b = ix.istGruppe(k) ? bereichVon(k) : zellen[k] ? { c0: zellen[k].c, c1: zellen[k].c, r0: zellen[k].r, r1: zellen[k].r } : null;
        if (!b) return;
        c0 = Math.min(c0, b.c0); c1 = Math.max(c1, b.c1); r0 = Math.min(r0, b.r0); r1 = Math.max(r1, b.r1);
      });
      bereich[gid] = { c0: c0, c1: c1, r0: r0, r1: r1 };
      return bereich[gid];
    };
    gruppen.forEach((g) => bereichVon(g.id));
    const gb = gruppen.map((g) => bereich[g.id]).filter((b) => isFinite(b.c0));
    const EPS = 1e-6;
    const spalteX = (c) => MASS.RAND + c * PX + MASS.PAD * gb.filter((b) => b.c0 <= c + EPS).length + MASS.PAD * gb.filter((b) => b.c1 < c - EPS).length;
    const zeileY = (r) => MASS.RAND + r * PY + MASS.PADTOP * gb.filter((b) => b.r0 <= r + EPS).length + MASS.PAD * gb.filter((b) => b.r1 < r - EPS).length;

    const el = {};
    blaetter.forEach((e) => {
      const z = zellen[e.id] || { c: 0, r: 0 };
      const g = groesse(e);
      const zx = spalteX(z.c), zy = zeileY(z.r);
      el[e.id] = { id: e.id, c: z.c, r: z.r, x: zx + (MASS.CW - g.w) / 2, y: zy + (MASS.CH - g.h) / 2, w: g.w, h: g.h, zelle: { x: zx, y: zy, w: MASS.CW, h: MASS.CH } };
    });
    // Bus allein in seiner Zeile (Spalte): über die ganze Breite (Höhe)
    blaetter.forEach((e) => {
      if (TYPEN[e.typ].form !== "bus" || manuell) return;
      if (m.richtung === "rechts") {
        const r = el[e.id];
        const andere = blaetter.filter((x) => x.id !== e.id && Math.abs(el[x.id].c - r.c) < EPS);
        if (andere.length) return;
        const ys = blaetter.filter((x) => x.id !== e.id && el[x.id].c > r.c).map((x) => el[x.id].zelle);
        if (!ys.length) return;
        const y0 = Math.min.apply(null, ys.map((z) => z.y)), y1 = Math.max.apply(null, ys.map((z) => z.y + z.h));
        r.w = 64; r.x = r.zelle.x + (MASS.CW - r.w) / 2;
        r.y = y0; r.h = Math.max(r.h, y1 - y0);
        r.zelle = { x: r.zelle.x, y: r.y, w: r.zelle.w, h: r.h };
        return;
      }
      const r = el[e.id];
      const andere = blaetter.filter((x) => x.id !== e.id && Math.abs(el[x.id].r - r.r) < EPS);
      if (andere.length) return;
      const xs = blaetter.filter((x) => x.id !== e.id && kategorieVon(x.typ) !== "extern").map((x) => el[x.id].zelle);
      if (!xs.length) return;
      const x0 = Math.min.apply(null, xs.map((z) => z.x)), x1 = Math.max.apply(null, xs.map((z) => z.x + z.w));
      r.x = x0; r.w = Math.max(r.w, x1 - x0);
      r.zelle = { x: r.x, y: r.zelle.y, w: r.w, h: r.zelle.h };
    });
    // Gruppenrahmen von innen nach aussen
    const gr = {};
    const tiefeVon = (id) => { let t = 0, p = ix.nachId[id]; while (p && p.in) { t++; p = ix.nachId[p.in]; } return t; };
    const rahmenVon = (gid) => {
      if (gr[gid]) return gr[gid];
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      (ix.kinder[gid] || []).forEach((k) => {
        const r = ix.istGruppe(k) ? rahmenVon(k) : el[k] ? el[k].zelle : null;
        if (!r) return;
        x0 = Math.min(x0, r.x); y0 = Math.min(y0, r.y); x1 = Math.max(x1, r.x + r.w); y1 = Math.max(y1, r.y + r.h);
      });
      gr[gid] = { id: gid, x: x0 - MASS.PAD, y: y0 - MASS.PADTOP, w: x1 - x0 + 2 * MASS.PAD, h: y1 - y0 + MASS.PADTOP + MASS.PAD, tiefe: tiefeVon(gid), gruppe: true };
      return gr[gid];
    };
    gruppen.forEach((g) => rahmenVon(g.id));
    // Gesamtfläche
    let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
    Object.keys(el).forEach((k) => { const r = el[k]; bx0 = Math.min(bx0, r.x); by0 = Math.min(by0, r.y); bx1 = Math.max(bx1, r.x + r.w); by1 = Math.max(by1, r.y + r.h); });
    Object.keys(gr).forEach((k) => { const r = gr[k]; bx0 = Math.min(bx0, r.x); by0 = Math.min(by0, r.y); bx1 = Math.max(bx1, r.x + r.w); by1 = Math.max(by1, r.y + r.h); });
    if (!isFinite(bx0)) { bx0 = 0; by0 = 0; bx1 = 200; by1 = 120; }
    const box = { x: bx0 - MASS.RAND, y: by0 - MASS.RAND, w: bx1 - bx0 + 2 * MASS.RAND, h: by1 - by0 + 2 * MASS.RAND };
    return { el: el, gr: gr, box: box, ix: ix, spalteX: spalteX, zeileY: zeileY, manuell: manuell };
  }

  /* ---------- 7. Orthogonales Routing ---------- */
  // Sichtbarkeitsgitter aus Kandidaten-Linien (Ränder der Hindernisse, Kanalmitten, Anschlüsse),
  // A* mit Kosten für Länge, Knicke, Kreuzungen und Überlappungen. Zwei Durchgänge:
  // 1. Seiten der Anschlüsse wählen, 2. Anschlüsse je Seite verteilen und endgültig routen.

  const R = { M: 14, KNICK: 34, KREUZ: 26, UEBER: 160, RANDFAKTOR: 0.45, LANE: 13 };
  const RICHT = [[0, -1], [1, 0], [0, 1], [-1, 0]]; // 0 oben, 1 rechts, 2 unten, 3 links

  function formVon(lay, id) {
    if (lay.el[id] && (lay.el[id].ball || lay.el[id].notiz)) return "komponente";
    const e = lay.ix.nachId[id];
    return e ? TYPEN[e.typ].form : "komponente";
  }
  function rechteckVon(lay, id) {
    return lay.el[id] || lay.gr[id] || null;
  }
  function portPunkt(r, form, seite, t) {
    const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
    if (form === "akteur") {
      if (seite === 1) return [cx + 20, r.y + 30 + t];
      if (seite === 3) return [cx - 20, r.y + 30 + t];
    }
    if (form === "lolli" && seite !== 2) {
      if (seite === 0) return [cx + t, r.y + 6];
      return [cx + (seite === 1 ? 11 : -11), r.y + 17 + t];
    }
    if (seite === 0) return [cx + t, r.y];
    if (seite === 2) return [cx + t, r.y + r.h];
    if (seite === 1) return [r.x + r.w, cy + t];
    return [r.x, cy + t];
  }

  // Binärer Heap für A*
  function Heap() { this.a = []; }
  Heap.prototype.push = function (k, v) {
    const a = this.a; a.push([k, v]);
    let i = a.length - 1;
    while (i > 0) { const p = (i - 1) >> 1; if (a[p][0] <= a[i][0]) break; const t = a[p]; a[p] = a[i]; a[i] = t; i = p; }
  };
  Heap.prototype.pop = function () {
    const a = this.a; const top = a[0]; const last = a.pop();
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1; let m = i;
        if (l < a.length && a[l][0] < a[m][0]) m = l;
        if (r < a.length && a[r][0] < a[m][0]) m = r;
        if (m === i) break;
        const t = a[m]; a[m] = a[i]; a[i] = t; i = m;
      }
    }
    return top;
  };

  function gitterBauen(hindernisse, gruppenRaender, extraX, extraY, box) {
    const M = R.M;
    const xs0 = [], ys0 = [], randX = {}, randY = {};
    const rx = [], ry = [];
    hindernisse.forEach((h) => {
      rx.push(h.x1, h.x2); ry.push(h.y1, h.y2);
      xs0.push(h.x1, h.x2); ys0.push(h.y1, h.y2);
      randX[Math.round(h.x1)] = randX[Math.round(h.x2)] = 1;
      randY[Math.round(h.y1)] = randY[Math.round(h.y2)] = 1;
    });
    // Kanäle zwischen Hindernissen: Mitte und zwei Spuren
    const kanaele = (werte, ziel) => {
      const s = Array.from(new Set(werte.map((v) => Math.round(v)))).sort((a, b) => a - b);
      for (let i = 0; i + 1 < s.length; i++) {
        const a = s[i], b = s[i + 1], d = b - a;
        if (d > 18) ziel.push((a + b) / 2);
        if (d > 54) { ziel.push((a + b) / 2 - R.LANE); ziel.push((a + b) / 2 + R.LANE); }
      }
    };
    kanaele(rx, xs0); kanaele(ry, ys0);
    xs0.push(box.x + 6, box.x + box.w - 6); ys0.push(box.y + 6, box.y + box.h - 6);
    extraX.forEach((v) => xs0.push(v)); extraY.forEach((v) => ys0.push(v));
    const nahGruppe = (v, liste) => liste.some((g) => Math.abs(g - v) < 9);
    const sauber = (werte, gr, extra) => {
      const s = werte.map((v) => Math.round(v * 2) / 2).sort((a, b) => a - b);
      const out = [];
      s.forEach((v) => {
        if (out.length && Math.abs(out[out.length - 1] - v) < 1.5) return;
        if (nahGruppe(v, gr) && extra.indexOf(v) < 0) return;
        out.push(v);
      });
      return out;
    };
    const xs = sauber(xs0, gruppenRaender.x, extraX.map((v) => Math.round(v * 2) / 2));
    const ys = sauber(ys0, gruppenRaender.y, extraY.map((v) => Math.round(v * 2) / 2));
    const nx = xs.length, ny = ys.length;
    const innen = (x, y) => hindernisse.some((h) => x > h.x1 + 0.5 && x < h.x2 - 0.5 && y > h.y1 + 0.5 && y < h.y2 - 0.5);
    const frei = new Uint8Array(nx * ny);
    for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) frei[i * ny + j] = innen(xs[i], ys[j]) ? 0 : 1;
    // Strecken: frei, wenn sie kein Hindernis-Inneres schneiden
    const segH = new Uint8Array(nx * ny); // (i,j) → (i+1,j)
    const segV = new Uint8Array(nx * ny); // (i,j) → (i,j+1)
    for (let j = 0; j < ny; j++) {
      const y = ys[j];
      for (let i = 0; i + 1 < nx; i++) {
        const a = xs[i], b = xs[i + 1];
        segH[i * ny + j] = hindernisse.some((h) => y > h.y1 + 0.5 && y < h.y2 - 0.5 && a < h.x2 - 0.5 && b > h.x1 + 0.5) ? 0 : 1;
      }
    }
    for (let i = 0; i < nx; i++) {
      const x = xs[i];
      for (let j = 0; j + 1 < ny; j++) {
        const a = ys[j], b = ys[j + 1];
        segV[i * ny + j] = hindernisse.some((h) => x > h.x1 + 0.5 && x < h.x2 - 0.5 && a < h.y2 - 0.5 && b > h.y1 + 0.5) ? 0 : 1;
      }
    }
    const randXi = new Uint8Array(nx), randYj = new Uint8Array(ny);
    xs.forEach((v, i) => (randXi[i] = randX[Math.round(v)] ? 1 : 0));
    ys.forEach((v, j) => (randYj[j] = randY[Math.round(v)] ? 1 : 0));
    const index = (werte, v) => {
      let best = -1, d = Infinity;
      for (let i = 0; i < werte.length; i++) { const e = Math.abs(werte[i] - v); if (e < d) { d = e; best = i; } }
      return d < 2 ? best : -1;
    };
    return {
      xs: xs, ys: ys, nx: nx, ny: ny, frei: frei, segH: segH, segV: segV, randXi: randXi, randYj: randYj,
      ix: (v) => index(xs, v), iy: (v) => index(ys, v), M: M,
      nutzH: new Uint16Array(nx * ny), nutzV: new Uint16Array(nx * ny), knotH: new Uint16Array(nx * ny), knotV: new Uint16Array(nx * ny),
    };
  }

  // A* von Knoten s (Richtung sd) nach Knoten z (Ankunftsrichtung zd)
  function aStern(G, si, sj, sd, zi, zj, zd, mitNutzung) {
    const ny = G.ny, N = G.nx * G.ny;
    const kosten = new Float64Array(N * 4).fill(Infinity);
    const vor = new Int32Array(N * 4).fill(-1);
    const heap = new Heap();
    const start = (si * ny + sj) * 4 + sd;
    kosten[start] = 0;
    const h = (i, j) => Math.abs(G.xs[i] - G.xs[zi]) + Math.abs(G.ys[j] - G.ys[zj]);
    heap.push(h(si, sj), start);
    const ziel = zi * ny + zj;
    let fund = -1, schritte = 0;
    while (heap.a.length) {
      const [, zust] = heap.pop();
      const knoten = zust >> 2, d = zust & 3;
      const i = Math.floor(knoten / ny), j = knoten % ny;
      const g = kosten[zust];
      if (knoten === ziel) { fund = zust; break; }
      if (++schritte > 400000) break;
      for (let nd = 0; nd < 4; nd++) {
        if (nd === (d + 2) % 4) continue; // nicht umkehren
        let ni = i, nj = j, segFrei, seg, laenge, randig;
        if (nd === 1) { if (i + 1 >= G.nx) continue; ni = i + 1; seg = i * ny + j; segFrei = G.segH[seg]; randig = G.randYj[j]; }
        else if (nd === 3) { if (i - 1 < 0) continue; ni = i - 1; seg = ni * ny + j; segFrei = G.segH[seg]; randig = G.randYj[j]; }
        else if (nd === 2) { if (j + 1 >= ny) continue; nj = j + 1; seg = i * ny + j; segFrei = G.segV[seg]; randig = G.randXi[i]; }
        else { if (j - 1 < 0) continue; nj = j - 1; seg = i * ny + nj; segFrei = G.segV[seg]; randig = G.randXi[i]; }
        if (!segFrei) continue;
        const nk = ni * ny + nj;
        if (!G.frei[nk] && nk !== ziel) continue;
        laenge = Math.abs(G.xs[ni] - G.xs[i]) + Math.abs(G.ys[nj] - G.ys[j]);
        let c = laenge * (randig ? 1 + R.RANDFAKTOR : 1);
        if (nd !== d) c += R.KNICK;
        // Ankunft: Knick vor dem Ziel kostet, Umkehr fast verboten
        if (nk === ziel && nd !== zd) c += nd === (zd + 2) % 4 ? 6 * R.KNICK : R.KNICK;
        if (mitNutzung) {
          const horiz = nd === 1 || nd === 3;
          const n = horiz ? G.nutzH[seg] : G.nutzV[seg];
          if (n) c += R.UEBER * n + laenge;
          if (nk !== ziel && (horiz ? G.knotV[nk] : G.knotH[nk])) c += R.KREUZ;
        }
        const nz = nk * 4 + nd;
        const ng = g + c;
        if (ng < kosten[nz]) {
          kosten[nz] = ng; vor[nz] = zust;
          heap.push(ng + h(ni, nj), nz);
        }
      }
    }
    if (fund < 0) return null;
    const pfad = [];
    let z = fund;
    while (z >= 0) { const k = z >> 2; pfad.push([Math.floor(k / ny), k % ny]); z = vor[z]; }
    pfad.reverse();
    return { pfad: pfad, kosten: kosten[fund] };
  }

  function nutzungEintragen(G, pfad) {
    const ny = G.ny;
    for (let k = 0; k + 1 < pfad.length; k++) {
      const [i, j] = pfad[k], [i2, j2] = pfad[k + 1];
      if (j === j2) { const a = Math.min(i, i2); G.nutzH[a * ny + j]++; G.knotH[i * ny + j]++; G.knotH[i2 * ny + j]++; }
      else { const b = Math.min(j, j2); G.nutzV[i * ny + b]++; G.knotV[i * ny + j]++; G.knotV[i * ny + j2]++; }
    }
  }

  function vereinfachen(p) {
    const out = [];
    p.forEach((q) => {
      if (out.length && Math.abs(out[out.length - 1][0] - q[0]) < 0.5 && Math.abs(out[out.length - 1][1] - q[1]) < 0.5) return;
      out.push(q);
      while (out.length >= 3) {
        const a = out[out.length - 3], b = out[out.length - 2], c = out[out.length - 1];
        const kollinear = (Math.abs(a[0] - b[0]) < 0.5 && Math.abs(b[0] - c[0]) < 0.5) || (Math.abs(a[1] - b[1]) < 0.5 && Math.abs(b[1] - c[1]) < 0.5);
        if (kollinear) out.splice(out.length - 2, 1); else break;
      }
    });
    return out;
  }

  function seitenKandidaten(a, b) {
    const dx = b.x + b.w / 2 - (a.x + a.w / 2), dy = b.y + b.h / 2 - (a.y + a.h / 2);
    const hLuecke = Math.abs(dx) - (a.w + b.w) / 2, vLuecke = Math.abs(dy) - (a.h + b.h) / 2;
    const H = dx >= 0 ? [1, 3] : [3, 1];
    const V = dy >= 0 ? [2, 0] : [0, 2];
    if (hLuecke > 0 && vLuecke > 0) return [V, H, [V[0], H[1]], [H[0], V[1]]];
    if (vLuecke >= hLuecke) return [V, H, [1, 1], [3, 3]];
    return [H, V, [2, 2], [0, 0]];
  }

  function kantenRouten(lay, kanten) {
    const ergebnis = {};
    if (!kanten.length) return ergebnis;
    const M = R.M;
    const hindernisse = [];
    Object.keys(lay.el).forEach((id) => {
      const r = lay.el[id];
      hindernisse.push({ id: id, x1: r.x - M, y1: r.y - M, x2: r.x + r.w + M, y2: r.y + r.h + M });
    });
    const grX = [], grY = [];
    Object.keys(lay.gr).forEach((id) => {
      const g = lay.gr[id];
      grX.push(g.x, g.x + g.w); grY.push(g.y, g.y + g.h);
      // Kopfzeile der Gruppe (Name) nicht überfahren
      const e = lay.ix.nachId[id];
      if (lay.kopf && lay.kopf[id]) { const k = lay.kopf[id]; hindernisse.push({ id: id + "#kopf", x1: k.x + 1, y1: k.y + 1, x2: k.x + k.w, y2: k.y + k.h - 1 }); return; }
      const tb = Math.min(g.w - 8, 50 + textBreite(ohneTags(e.name), 14, 650) + textBreite(e.stereotyp ? "«" + e.stereotyp + "» " : "", 12, 400));
      hindernisse.push({ id: id + "#kopf", x1: g.x + 2, y1: g.y + 2, x2: g.x + tb, y2: g.y + 32 });
    });
    (lay.hindernisse || []).forEach((h) => hindernisse.push(h));
    const rd = lay.uml ? 2 : 20; // Modulnotation: Umwege innerhalb des sichtbaren Rands
    const box = { x: lay.box.x - rd, y: lay.box.y - rd, w: lay.box.w + 2 * rd, h: lay.box.h + 2 * rd };
    const ende = (id, sch) => (sch ? id + "#" + sch : id);
    const ends = kanten.map((k) => {
      const va = ende(k.von, k.vonSch), vb = ende(k.nach, k.nachSch);
      return { k: k, a: rechteckVon(lay, va), b: rechteckVon(lay, vb), fa: formVon(lay, va), fb: formVon(lay, vb) };
    }).filter((x) => x.a && x.b);

    const route = (G, x, sa, sb, ta, tb, mitNutzung) => {
      const pa = portPunkt(x.a, x.fa, sa, ta), pb = portPunkt(x.b, x.fb, sb, tb);
      const sA = stummel(x.a, sa, pa), sB = stummel(x.b, sb, pb);
      const si = G.ix(sA[0]), sj = G.iy(sA[1]), zi = G.ix(sB[0]), zj = G.iy(sB[1]);
      if (si < 0 || sj < 0 || zi < 0 || zj < 0) return null;
      const r = aStern(G, si, sj, sa, zi, zj, (sb + 2) % 4, mitNutzung);
      if (!r) return null;
      const punkte = [pa].concat(r.pfad.map(([i, j]) => [G.xs[i], G.ys[j]])).concat([pb]);
      return { punkte: vereinfachen(punkte), pfad: r.pfad, kosten: r.kosten };
    };
    // Stummel: vom Anschluss senkrecht hinaus bis knapp ausserhalb des (vergrösserten) Hindernisses
    function stummel(r, seite, p) {
      const rr = r.gruppe ? 4 : M;
      if (seite === 0) return [p[0], r.y - rr];
      if (seite === 2) return [p[0], r.y + r.h + rr];
      if (seite === 1) return [r.x + r.w + rr, p[1]];
      return [r.x - rr, p[1]];
    }
    // Wunschlage eines Anschlusses: gegenüber der Mitte des Partners, innerhalb der Seite
    function wunsch(r, seite, partner) {
      const quer = seite === 0 || seite === 2;
      const laenge = quer ? r.w : r.h;
      const rand = laenge * (laenge > 200 ? 0.45 : 0.36);
      const d = (quer ? partner.x + partner.w / 2 - (r.x + r.w / 2) : partner.y + partner.h / 2 - (r.y + r.h / 2));
      return laenge > 200 ? klemmen(d, -rand, rand) : 0;
    }
    const portLinien = (liste) => {
      const ex = [], ey = [];
      liste.forEach((x) => {
        [[x.a, x.fa, x.sa, x.ta, x.b], [x.b, x.fb, x.sb, x.tb, x.a]].forEach(([r, f, s, t, partner]) => {
          [0, 1, 2, 3].forEach((seite) => {
            if (s !== undefined && seite !== s) return;
            const ts = s !== undefined ? [t] : [0, wunsch(r, seite, partner)];
            ts.forEach((tt) => {
              const p = portPunkt(r, f, seite, tt);
              const q = stummel(r, seite, p);
              ex.push(q[0]); ey.push(q[1]);
            });
          });
        });
      });
      return [ex, ey];
    };

    // Durchgang 1: Seiten wählen (Anschluss in der Seitenmitte)
    const [ex1, ey1] = portLinien(ends);
    const G1 = gitterBauen(hindernisse, { x: grX, y: grY }, ex1, ey1, box);
    ends.forEach((x) => {
      const kand = seitenKandidaten(x.a, x.b);
      let best = null;
      kand.forEach(([sa, sb], rang) => {
        if (best && best.gerade) return;
        const r = route(G1, x, sa, sb, wunsch(x.a, sa, x.b), wunsch(x.b, sb, x.a), false);
        if (!r) return;
        const k = r.kosten + rang * 18;
        if (!best || k < best.k) best = { k: k, sa: sa, sb: sb, gerade: r.punkte.length === 2 };
      });
      if (!best) best = { k: Infinity, sa: kand[0][0], sb: kand[0][1] };
      x.sa = best.sa; x.sb = best.sb; x.k1 = best.k;
    });

    // Anschlüsse je Seite verteilen, sortiert nach der Lage des Gegenübers
    const seitenListe = {};
    ends.forEach((x) => {
      (seitenListe[x.k.von + "|" + x.sa] = seitenListe[x.k.von + "|" + x.sa] || []).push({ x: x, ende: "a" });
      (seitenListe[x.k.nach + "|" + x.sb] = seitenListe[x.k.nach + "|" + x.sb] || []).push({ x: x, ende: "b" });
    });
    Object.keys(seitenListe).forEach((schl) => {
      const liste = seitenListe[schl];
      const seite = Number(schl.split("|")[1]);
      const r = liste[0].ende === "a" ? liste[0].x.a : liste[0].x.b;
      const quer = seite === 0 || seite === 2;
      liste.forEach((it) => {
        const g = it.ende === "a" ? it.x.b : it.x.a;
        it.wert = quer ? g.x + g.w / 2 : g.y + g.h / 2;
      });
      liste.sort((p, q) => p.wert - q.wert);
      const laenge = quer ? r.w : r.h;
      const n = liste.length;
      const mitte = quer ? r.x + r.w / 2 : r.y + r.h / 2;
      const rand = laenge * (laenge > 200 ? 0.45 : 0.36);
      const abstand = n > 1 ? Math.min(20, (2 * rand) / (n - 1)) : 0;
      // Grosse Elemente (Bus): Anschluss gegenüber dem Partner (gerade Linien); kleine: gleichmässig um die Mitte
      const t = laenge > 200 ? liste.map((it) => klemmen(it.wert - mitte, -rand, rand)) : liste.map((it, i) => (i - (n - 1) / 2) * abstand);
      for (let i = 1; i < n; i++) if (t[i] - t[i - 1] < abstand) t[i] = t[i - 1] + abstand;
      const ueber = t[n - 1] - rand;
      if (ueber > 0) for (let i = n - 1; i >= 0; i--) { t[i] -= ueber; if (i > 0 && t[i] - t[i - 1] >= abstand) break; }
      for (let i = n - 2; i >= 0; i--) if (t[i + 1] - t[i] < abstand) t[i] = t[i + 1] - abstand;
      liste.forEach((it, i) => { if (it.ende === "a") it.x.ta = t[i]; else it.x.tb = t[i]; });
    });

    // Einzelne Anschlüsse auf einer Seite: auf das Gegenüber ausrichten, wenn das eine gerade Linie ergibt
    Object.keys(seitenListe).forEach((schl) => {
      const liste = seitenListe[schl];
      if (liste.length !== 1) return;
      const it = liste[0], x = it.x;
      const seite = Number(schl.split("|")[1]);
      const quer = seite === 0 || seite === 2;
      const ich = it.ende === "a" ? x.a : x.b;
      const gp = it.ende === "a" ? portPunkt(x.b, x.fb, x.sb, x.tb || 0) : portPunkt(x.a, x.fa, x.sa, x.ta || 0);
      const mitte = quer ? ich.x + ich.w / 2 : ich.y + ich.h / 2;
      const d = (quer ? gp[0] : gp[1]) - mitte;
      if (Math.abs(d) > 0.5 && Math.abs(d) <= (quer ? ich.w : ich.h) * 0.36) { if (it.ende === "a") x.ta = d; else x.tb = d; }
    });

    // Durchgang 2: endgültig routen, kurze Verbindungen zuerst, mit Nutzung (Überlappung und Kreuzung kosten)
    const [ex2, ey2] = portLinien(ends);
    const G2 = gitterBauen(hindernisse, { x: grX, y: grY }, ex2, ey2, box);
    ends.slice().sort((p, q) => p.k1 - q.k1).forEach((x) => {
      let r = route(G2, x, x.sa, x.sb, x.ta || 0, x.tb || 0, true);
      if (!r) {
        // andere Seiten versuchen, bevor die Notlösung kommt
        for (const [sa, sb] of seitenKandidaten(x.a, x.b).concat([[0, 0], [2, 2], [1, 1], [3, 3], [0, 2], [2, 0], [1, 3], [3, 1]])) {
          const G3 = gitterBauen(hindernisse, { x: grX, y: grY }, ex2.concat([stummel(x.a, sa, portPunkt(x.a, x.fa, sa, 0))[0], stummel(x.b, sb, portPunkt(x.b, x.fb, sb, 0))[0], portPunkt(x.a, x.fa, sa, 0)[0], portPunkt(x.b, x.fb, sb, 0)[0]]),
            ey2.concat([stummel(x.a, sa, portPunkt(x.a, x.fa, sa, 0))[1], stummel(x.b, sb, portPunkt(x.b, x.fb, sb, 0))[1], portPunkt(x.a, x.fa, sa, 0)[1], portPunkt(x.b, x.fb, sb, 0)[1]]), box);
          r = route(G3, x, sa, sb, 0, 0, false);
          if (r) break;
        }
      }
      if (!r) {
        // Notlösung: gerade Linie mit einem Knick
        const pa = portPunkt(x.a, x.fa, x.sa, 0), pb = portPunkt(x.b, x.fb, x.sb, 0);
        r = { punkte: vereinfachen([pa, [pa[0], pb[1]], pb]), pfad: [] };
      } else nutzungEintragen(G2, r.pfad);
      ergebnis[x.k.id] = { punkte: r.punkte, seiteA: x.sa, seiteB: x.sb };
    });
    return ergebnis;
  }

  // Beschriftungen: auf dem längsten freien Stück der Linie, ohne Überlappung
  function labelsSetzen(lay, kanten, routen) {
    const belegt = Object.keys(lay.el).map((id) => { const r = lay.el[id]; return { x1: r.x - 4, y1: r.y - 4, x2: r.x + r.w + 4, y2: r.y + r.h + 4 }; });
    (lay.hindernisse || []).forEach((h) => belegt.push({ x1: h.x1, y1: h.y1, x2: h.x2, y2: h.y2 }));
    if (lay.kopf) Object.keys(lay.kopf).forEach((id) => { const k = lay.kopf[id]; belegt.push({ x1: k.x, y1: k.y, x2: k.x + k.w, y2: k.y + k.h }); });
    const ueber = (a, b) => a.x1 < b.x2 && a.x2 > b.x1 && a.y1 < b.y2 && a.y2 > b.y1;
    const out = {};
    kanten.forEach((k) => {
      const r = routen[k.id];
      const text = ohneTags(k.label || "");
      if (!r || !text) return;
      const w = textBreite(text, 12, 600) + 14, h = 19;
      const segs = [];
      for (let i = 0; i + 1 < r.punkte.length; i++) {
        const a = r.punkte[i], b = r.punkte[i + 1];
        segs.push({ a: a, b: b, l: Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]), horiz: Math.abs(a[1] - b[1]) < 0.5 });
      }
      segs.sort((p, q) => (q.l + (q.horiz ? 30 : 0)) - (p.l + (p.horiz ? 30 : 0)));
      let wahl = null;
      for (const s of segs) {
        for (const t of [0.5, 0.36, 0.64, 0.24, 0.76]) {
          const cx = s.a[0] + (s.b[0] - s.a[0]) * t, cy = s.a[1] + (s.b[1] - s.a[1]) * t;
          const box = { x1: cx - w / 2, y1: cy - h / 2, x2: cx + w / 2, y2: cy + h / 2 };
          if (!belegt.some((b) => ueber(box, b))) { wahl = box; break; }
        }
        if (wahl) break;
      }
      if (!wahl && segs.length) {
        const s = segs[0];
        const cx = (s.a[0] + s.b[0]) / 2, cy = (s.a[1] + s.b[1]) / 2;
        wahl = { x1: cx - w / 2, y1: cy - h / 2, x2: cx + w / 2, y2: cy + h / 2 };
      }
      if (wahl) {
        belegt.push({ x1: wahl.x1 - 3, y1: wahl.y1 - 3, x2: wahl.x2 + 3, y2: wahl.y2 + 3 });
        out[k.id] = { x: wahl.x1, y: wahl.y1, w: w, h: h, text: text };
      }
    });
    return out;
  }

  // Polylinie: Länge und Punkt an Strecke d
  function polyLaenge(p) {
    let l = 0;
    for (let i = 0; i + 1 < p.length; i++) l += Math.hypot(p[i + 1][0] - p[i][0], p[i + 1][1] - p[i][1]);
    return l;
  }
  function punktAuf(p, d) {
    for (let i = 0; i + 1 < p.length; i++) {
      const l = Math.hypot(p[i + 1][0] - p[i][0], p[i + 1][1] - p[i][1]);
      if (d <= l || i + 2 === p.length) {
        const t = l ? klemmen(d / l, 0, 1) : 1;
        return [p[i][0] + (p[i + 1][0] - p[i][0]) * t, p[i][1] + (p[i + 1][1] - p[i][1]) * t];
      }
      d -= l;
    }
    return p[p.length - 1];
  }
  // Pfad mit abgerundeten Ecken
  function pfadD(p, radius) {
    if (!p.length) return "";
    let d = "M" + p[0][0].toFixed(1) + " " + p[0][1].toFixed(1);
    for (let i = 1; i < p.length; i++) {
      const a = p[i - 1], b = p[i], c = p[i + 1];
      if (!c) { d += " L" + b[0].toFixed(1) + " " + b[1].toFixed(1); break; }
      const l1 = Math.hypot(b[0] - a[0], b[1] - a[1]), l2 = Math.hypot(c[0] - b[0], c[1] - b[1]);
      const r = Math.min(radius, l1 / 2, l2 / 2);
      const p1 = [b[0] - ((b[0] - a[0]) / (l1 || 1)) * r, b[1] - ((b[1] - a[1]) / (l1 || 1)) * r];
      const p2 = [b[0] + ((c[0] - b[0]) / (l2 || 1)) * r, b[1] + ((c[1] - b[1]) / (l2 || 1)) * r];
      d += " L" + p1[0].toFixed(1) + " " + p1[1].toFixed(1) + " Q" + b[0].toFixed(1) + " " + b[1].toFixed(1) + " " + p2[0].toFixed(1) + " " + p2[1].toFixed(1);
    }
    return d;
  }

  /* ---------- 8. Zeichnen in UML-Notation ---------- */

  const f1 = (v) => (Math.round(v * 10) / 10).toString();

  function textBlock(e, cx, oben, unten, breite, opt) {
    opt = opt || {};
    const zeilen = [];
    const stereo = opt.ohneStereo || !e.stereotyp ? "" : "«" + e.stereotyp + "»";
    if (stereo) zeilen.push({ t: kuerzen(stereo, 12, 400, breite - (opt.stereoRand || 0)), px: 12, k: "ar-stereo", h: 16 });
    const n = umbrechen(ohneTags(e.name), 15, 650, breite, 2);
    n.zeilen.forEach((z) => zeilen.push({ t: z, px: n.px, k: "ar-name", h: n.px + 3 }));
    if (e.technologie && !opt.ohneTech) zeilen.push({ t: kuerzen(ohneTags(e.technologie), 12, 400, breite), px: 12, k: "ar-tech", h: 16 });
    const gesamt = zeilen.reduce((s, z) => s + z.h, 0);
    let y = oben + Math.max(0, (unten - oben - gesamt) / 2);
    let out = "";
    zeilen.forEach((z) => {
      y += z.h;
      out += '<text class="' + z.k + '" x="' + f1(cx) + '" y="' + f1(y - (z.h - z.px) / 2 - 2) + '" text-anchor="middle" style="font-size:' + z.px + 'px">' + esc(z.t) + "</text>";
    });
    return out;
  }

  const UML_KOMPONENTE = (x, y) =>
    '<g class="ar-uml" transform="translate(' + f1(x) + " " + f1(y) + ')"><rect x="4.5" y=".5" width="14" height="12" rx="1.5"/><rect x=".5" y="3" width="8" height="2.8" rx=".6"/><rect x=".5" y="7.2" width="8" height="2.8" rx=".6"/></g>';

  function elementMarkup(e, r) {
    const t = TYPEN[e.typ];
    const w = r.w, h = r.h, cx = w / 2;
    let s = '<rect class="ar-ring" x="-6" y="-6" width="' + (w + 12) + '" height="' + (h + 12) + '" rx="12"/>';
    switch (t.form) {
      case "akteur": {
        const k = 11;
        s += '<rect class="ar-treffer" x="0" y="0" width="' + w + '" height="' + h + '"/>';
        s += '<g class="ar-figur"><circle class="ar-form" cx="' + cx + '" cy="' + k + '" r="8.5"/><path class="ar-form-linie" d="M' + cx + " " + (k + 8.5) + "V43M" + (cx - 16) + " 28H" + (cx + 16) + "M" + cx + " 43L" + (cx - 13) + " 58M" + cx + " 43L" + (cx + 13) + ' 58"/></g>';
        const n = umbrechen(ohneTags(e.name), 15, 650, 170, 2);
        n.zeilen.forEach((z, i) => (s += '<text class="ar-name" x="' + cx + '" y="' + (79 + i * 17) + '" text-anchor="middle" style="font-size:' + n.px + 'px">' + esc(z) + "</text>"));
        return s;
      }
      case "zylinder": {
        const ry = 9;
        s += '<path class="ar-form" d="M0 ' + ry + "A" + cx + " " + ry + " 0 0 0 " + w + " " + ry + "V" + (h - ry) + "A" + cx + " " + ry + " 0 0 1 0 " + (h - ry) + 'Z"/>';
        s += '<ellipse class="ar-form ar-deckel" cx="' + cx + '" cy="' + ry + '" rx="' + cx + '" ry="' + ry + '"/>';
        if (e.typ === "nosql") s += '<path class="ar-form-linie ar-fein" d="M0 ' + (ry + 7) + "A" + cx + " " + ry + " 0 0 0 " + w + " " + (ry + 7) + '"/>';
        s += piktoG(t.pikto, cx - 6.5, ry - 6.5, 13);
        s += textBlock(e, cx, 2 * ry + 2, h - ry / 2 - 2, w - 16);
        return s;
      }
      case "ordner": {
        s += '<path class="ar-form" d="M0 9Q0 3 6 3H46L53 10H' + (w - 6) + "Q" + w + " 10 " + w + " 16V" + (h - 6) + "Q" + w + " " + h + " " + (w - 6) + " " + h + "H6Q0 " + h + " 0 " + (h - 6) + 'Z"/>';
        s += '<path class="ar-form-linie ar-fein" d="M0 13H' + w + '"/>';
        s += piktoG(t.pikto, 8, 17, 15);
        s += textBlock(e, cx, 14, h - 3, w - 20, { stereoRand: 30 });
        return s;
      }
      case "lolli": {
        s += '<rect class="ar-treffer" x="0" y="0" width="' + w + '" height="' + h + '"/>';
        s += '<circle class="ar-form ar-ball" cx="' + cx + '" cy="17" r="11"/>';
        const n = umbrechen(ohneTags(e.name), 14, 650, w + 30, 2);
        n.zeilen.forEach((z, i) => (s += '<text class="ar-name" x="' + cx + '" y="' + (48 + i * 16) + '" text-anchor="middle" style="font-size:' + n.px + 'px">' + esc(z) + "</text>"));
        return s;
      }
      case "knoten": {
        const d = 10;
        s += '<path class="ar-form" d="M0 ' + d + "H" + (w - d) + "V" + h + "H0Z" + '"/>';
        s += '<path class="ar-form ar-seite-oben" d="M0 ' + d + "L" + d + " 0H" + w + "L" + (w - d) + " " + d + 'Z"/>';
        s += '<path class="ar-form ar-seite-rechts" d="M' + (w - d) + " " + d + "L" + w + " 0V" + (h - d) + "L" + (w - d) + " " + h + 'Z"/>';
        s += piktoG(t.pikto, 8, d + 7, 15);
        s += textBlock(e, (w - d) / 2, d + 2, h - 2, w - d - 16, { stereoRand: 30 });
        return s;
      }
      case "artefakt": {
        s += '<rect class="ar-form" x="0" y="0" width="' + w + '" height="' + h + '" rx="4"/>';
        s += '<g class="ar-uml" transform="translate(' + (w - 21) + ' 7)"><path d="M.5 .5H8.5L13 5V16.5H.5Z"/><path d="M8.5 .5V5H13"/></g>';
        s += piktoG(t.pikto, 8, 8, 15);
        s += textBlock(e, cx, 4, h - 3, w - 18, { stereoRand: 36 });
        return s;
      }
      case "bus": {
        if (h > w * 1.6) {
          // senkrechter Bus (Hauptrichtung «rechts»): Schrift gedreht
          s += '<rect class="ar-form" x="0" y="0" width="' + w + '" height="' + h + '" rx="' + w / 2 + '"/>';
          s += '<path class="ar-form-linie ar-fein" d="M9 ' + w / 2 + "V" + (h - w / 2) + "M" + (w - 9) + " " + w / 2 + "V" + (h - w / 2) + '"/>';
          s += piktoG(t.pikto, w / 2 - 8, 16, 16);
          s += '<g transform="translate(' + f1(w / 2) + " " + f1(h / 2) + ') rotate(-90)">' + textBlock(e, 0, -w / 2 + 6, w / 2 - 6, Math.min(h - 70, 420), { ohneTech: true }) + "</g>";
          return s;
        }
        s += '<rect class="ar-form" x="0" y="0" width="' + w + '" height="' + h + '" rx="' + h / 2 + '"/>';
        s += '<path class="ar-form-linie ar-fein" d="M' + h / 2 + " 9H" + (w - h / 2) + "M" + h / 2 + " " + (h - 9) + "H" + (w - h / 2) + '"/>';
        s += piktoG(t.pikto, 16, h / 2 - 8, 16);
        s += textBlock(e, cx, 9, h - 9, Math.min(w - 60, 420), { ohneTech: w < 300 });
        return s;
      }
      default: {
        // UML-Komponente (auch queue, topic, extern, monolith)
        s += '<rect class="ar-form' + (t.gestrichelt ? " ar-gestrichelt" : "") + '" x="0" y="0" width="' + w + '" height="' + h + '" rx="8"/>';
        if (t.gross) s += '<rect class="ar-form-linie ar-fein" x="4" y="4" width="' + (w - 8) + '" height="' + (h - 8) + '" rx="5"/>';
        s += piktoG(t.pikto, 9, 8, 15);
        s += UML_KOMPONENTE(w - 27, 9);
        let unten = h - 3;
        if (t.form === "queue" || t.form === "topic") {
          const sw = t.form === "topic" ? w - 52 : w - 28, sx = 14, sy = h - 17;
          s += '<g class="ar-faecher"><rect x="' + sx + '" y="' + sy + '" width="' + sw + '" height="9" rx="2"/>';
          for (let i = 1; i < 7; i++) s += '<path d="M' + f1(sx + (sw * i) / 7) + " " + sy + "v9" + '"/>';
          if (t.form === "topic") s += '<path d="M' + (sx + sw) + " " + (sy + 4.5) + "h7M" + (sx + sw + 7) + " " + (sy + 4.5) + "l9 -7M" + (sx + sw + 7) + " " + (sy + 4.5) + "h10M" + (sx + sw + 7) + " " + (sy + 4.5) + 'l9 7"/>';
          s += "</g>";
          unten = h - 18;
        }
        s += textBlock(e, cx, 4, unten, w - 16, { stereoRand: 40 });
        return s;
      }
    }
  }

  function gruppeMarkup(e, g) {
    const t = TYPEN[e.typ];
    const w = g.w, h = g.h;
    const stereo = e.stereotyp ? "«" + e.stereotyp + "» " : "";
    const name = ohneTags(e.name);
    let s = "";
    if (t.form === "knoten") {
      const d = 10;
      s += '<path class="ar-gform" d="M0 ' + d + "H" + (w - d) + "V" + h + "H0Z" + '"/>';
      s += '<path class="ar-gform ar-seite-oben" d="M0 ' + d + "L" + d + " 0H" + w + "L" + (w - d) + " " + d + 'Z"/>';
      s += '<path class="ar-gform ar-seite-rechts" d="M' + (w - d) + " " + d + "L" + w + " 0V" + (h - d) + "L" + (w - d) + " " + h + 'Z"/>';
      s += piktoG(t.pikto, 10, d + 8, 15);
      s += '<text class="ar-gkopf" x="32" y="' + (d + 21) + '"><tspan class="ar-stereo">' + esc(stereo) + '</tspan><tspan class="ar-gname">' + esc(name) + "</tspan></text>";
    } else if (t.form === "paket") {
      const tw = Math.min(w - 10, textBreite(stereo, 12, 400) + textBreite(name, 14, 650) + 28);
      s += '<path class="ar-gform ar-reiter" d="M0 4Q0 0 4 0H' + (tw - 4) + "Q" + tw + " 0 " + tw + " 4V25H0Z" + '"/>';
      s += '<rect class="ar-gform" x="0" y="25" width="' + w + '" height="' + (h - 25) + '" rx="3"/>';
      s += '<text class="ar-gkopf" x="12" y="18"><tspan class="ar-stereo">' + esc(stereo) + '</tspan><tspan class="ar-gname">' + esc(name) + "</tspan></text>";
    } else {
      s += '<rect class="ar-gform ar-grenze" x="0" y="0" width="' + w + '" height="' + h + '" rx="12"/>';
      s += '<text class="ar-gkopf" x="14" y="23"><tspan class="ar-stereo">' + esc(stereo) + '</tspan><tspan class="ar-gname">' + esc(name) + "</tspan></text>";
    }
    return s;
  }

  // Pfeilspitzen nach Verbindungsart (Abschnitt 5 des Vertrags)
  function spitzeMarkup(art, p, zielLolli) {
    const n = p.length;
    if (n < 2) return { linie: p, spitze: "" };
    const q = p[n - 1], v = p[n - 2];
    const l = Math.hypot(q[0] - v[0], q[1] - v[1]) || 1;
    const u = [(q[0] - v[0]) / l, (q[1] - v[1]) / l], no = [-u[1], u[0]];
    const L = art === "stream" ? 13 : 11, B = art === "stream" ? 7 : 5.5;
    const pt = (a, b) => f1(q[0] - u[0] * a + no[0] * b) + " " + f1(q[1] - u[1] * a + no[1] * b);
    const kuerzer = (d) => { const pp = p.slice(); pp[n - 1] = [q[0] - u[0] * d, q[1] - u[1] * d]; return pp; };
    if (art === "realisiert") {
      if (zielLolli) return { linie: p, spitze: "" };
      return { linie: kuerzer(13), spitze: '<circle class="ar-spitze ar-spitze-ball" cx="' + f1(q[0] - u[0] * 7) + '" cy="' + f1(q[1] - u[1] * 7) + '" r="6.5"/>' };
    }
    if (art === "sync" || art === "stream") {
      return { linie: kuerzer(L - 1), spitze: '<path class="ar-spitze ar-spitze-voll" d="M' + pt(0, 0) + "L" + pt(L, B) + "L" + pt(L, -B) + 'Z"/>' };
    }
    return { linie: kuerzer(art === "daten" ? 1.5 : 0.8), spitze: '<path class="ar-spitze ar-spitze-offen" d="M' + pt(L, B) + "L" + pt(0, 0) + "L" + pt(L, -B) + '"/>' };
  }

  function kanteMarkup(k, route, zielTyp, ball) {
    const zielLolli = zielTyp && TYPEN[zielTyp].form === "lolli";
    let sp = k.art === "assoziation" || k.art === "notiz" ? { linie: route.punkte, spitze: "" } : spitzeMarkup(k.art, route.punkte, zielLolli);
    if (ball && k.art === "assoziation") {
      // Linie endet am Socket, nicht am Ball
      const p = route.punkte.slice(), n = p.length, q = p[n - 1], v = p[n - 2];
      const l = Math.hypot(q[0] - v[0], q[1] - v[1]) || 1;
      p[n - 1] = [q[0] - ((q[0] - v[0]) / l) * 5, q[1] - ((q[1] - v[1]) / l) * 5];
      sp = { linie: p, spitze: socketMarkup({ punkte: p }, ball) };
    }
    const d = pfadD(sp.linie, 7);
    let s = '<path class="ar-kante-treffer" d="' + d + '"/>';
    s += '<path class="ar-linie" d="' + d + '"/>';
    if (k.art === "stream") s += '<path class="ar-linie-innen" d="' + d + '"/>';
    s += sp.spitze;
    return s;
  }

  function elementLabel(e, ix) {
    const t = TYPEN[e.typ];
    const kat = kategorieVon(e.typ);
    let s = ohneTags(e.name) + ", " + (e.stereotyp ? "«" + e.stereotyp + "»" : t.name) + (kat ? ", Kategorie " + KAT[kat].name : "");
    if (e.technologie) s += ", Technologie " + ohneTags(e.technologie);
    if (e.in && ix && ix.nachId[e.in]) s += ", in " + ohneTags(ix.nachId[e.in].name);
    return s;
  }

  // Ganze Szene zeichnen; gibt Zugriffe auf die SVG-Gruppen zurück
  function szeneZeichnen(svg, m, lay, routen, labels, opt) {
    opt = opt || {};
    const uid = opt.uid || neueId("svg");
    svg.innerHTML = "";
    const defs = svgEl("defs");
    defs.innerHTML =
      '<pattern id="' + uid + '-raster" width="24" height="24" patternUnits="userSpaceOnUse"><circle class="ar-raster-punkt" cx="1" cy="1" r="1"/></pattern>' +
      '<pattern id="' + uid + '-schraffur" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect class="ar-schraffur-grund" width="7" height="7"/><path class="ar-schraffur" d="M0 0V7"/></pattern>';
    svg.appendChild(defs);
    const welt = svgEl("g", null, "ar-welt");
    const b = lay.box;
    const grund = svgEl("rect", { x: b.x - 400, y: b.y - 400, width: b.w + 800, height: b.h + 800, fill: "url(#" + uid + "-raster)" }, "ar-grund");
    welt.appendChild(grund);
    const ebene = (k) => { const g = svgEl("g", null, k); welt.appendChild(g); return g; };
    const gGruppen = ebene("ar-gruppen"), gKanten = ebene("ar-kanten"), gElemente = ebene("ar-elemente"), gLabels = ebene("ar-labels"), gEffekte = ebene("ar-effekte");
    svg.appendChild(welt);
    const ix = lay.ix;
    const elG = {}, kantenG = {}, labelG = {}, gruppenG = {};
    Object.keys(lay.gr).sort((a, c) => lay.gr[a].tiefe - lay.gr[c].tiefe).forEach((id) => {
      const e = ix.nachId[id], g = lay.gr[id];
      const n = svgEl("g", { transform: "translate(" + f1(g.x) + " " + f1(g.y) + ")", "data-id": id }, "ar-gruppe " + katKlasse(e.typ) + " ar-typ-" + e.typ + (lay.uml ? " ar-uml-tiefe-" + (g.tiefe % 2) : ""));
      n.innerHTML = lay.uml ? umlPaketMarkup(e, g) : gruppeMarkup(e, g);
      if (opt.fokussierbar !== false) {
        n.setAttribute("tabindex", "0");
        n.setAttribute("role", "button");
        n.setAttribute("aria-label", elementLabel(e, ix) + ", Gruppe");
      }
      gGruppen.appendChild(n);
      gruppenG[id] = n;
      elG[id] = n;
    });
    m.verbindungen.forEach((k) => {
      const r = routen[k.id];
      if (!r) return;
      const ziel = ix.nachId[k.nach];
      const n = svgEl("g", { "data-id": k.id }, "ar-kante ar-art-" + k.art + " " + klasseVon(ziel));
      n.innerHTML = kanteMarkup(k, r, ziel.typ, k.nachSch && lay.ballInfo ? lay.ballInfo[k.nach + "#" + k.nachSch] : null);
      gKanten.appendChild(n);
      kantenG[k.id] = n;
      const lb = labels[k.id];
      if (lb) {
        const l = svgEl("g", { "data-id": k.id }, "ar-label " + klasseVon(ziel));
        l.innerHTML = '<rect x="' + f1(lb.x) + '" y="' + f1(lb.y) + '" width="' + f1(lb.w) + '" height="' + lb.h + '" rx="4"/><text x="' + f1(lb.x + lb.w / 2) + '" y="' + f1(lb.y + lb.h / 2 + 4.2) + '" text-anchor="middle">' + esc(lb.text) + "</text>";
        gLabels.appendChild(l);
        labelG[k.id] = l;
      }
    });
    // Notizen und Einschränkungen ({xor})
    if (lay.uml) {
      const gNotiz = svgEl("g", null, "ar-notizen");
      gKanten.parentNode.insertBefore(gNotiz, gElemente);
      (lay.notizKanten || []).forEach((k) => {
        const r = routen[k.id];
        if (r) gNotiz.appendChild(svgEl("path", { d: pfadD(r.punkte, 6) }, "ar-uml-anker"));
      });
      (m.notizen || []).filter((no) => no.anKante && routen[no.anKante] && lay.notizLage[no.id]).forEach((no) => {
        const rt = routen[no.anKante], r = lay.notizLage[no.id];
        const p = punktAuf(rt.punkte, polyLaenge(rt.punkte) * 0.5);
        const q = [klemmen(p[0], r.x, r.x + r.w), klemmen(p[1], r.y, r.y + r.h)];
        gNotiz.appendChild(svgEl("path", { d: "M" + f1(q[0]) + " " + f1(q[1]) + "L" + f1(p[0]) + " " + f1(p[1]) }, "ar-uml-anker"));
        gNotiz.appendChild(svgEl("circle", { cx: f1(p[0]), cy: f1(p[1]), r: 2.5 }, "ar-uml-anker-punkt"));
      });
      Object.keys(lay.notizLage || {}).forEach((id) => {
        const r = lay.notizLage[id];
        const n = svgEl("g", { transform: "translate(" + f1(r.x) + " " + f1(r.y) + ")" }, "ar-notiz");
        n.innerHTML = notizMarkup(null, r);
        gNotiz.appendChild(n);
      });
      (m.einschraenkungen || []).forEach((x) => {
        const ra = routen[x.zwischen[0]], rb = routen[x.zwischen[1]];
        if (!ra || !rb) return;
        const pa = punktAuf(ra.punkte, polyLaenge(ra.punkte) * 0.42), pb = punktAuf(rb.punkte, polyLaenge(rb.punkte) * 0.42);
        const mx = (pa[0] + pb[0]) / 2, my = (pa[1] + pb[1]) / 2;
        const tw = textBreite(x.text, 12, 700) + 10;
        const n = svgEl("g", null, "ar-xor");
        n.innerHTML = '<path class="ar-xor-linie" d="M' + f1(pa[0]) + " " + f1(pa[1]) + "L" + f1(pb[0]) + " " + f1(pb[1]) + '"/><rect x="' + f1(mx - tw / 2) + '" y="' + f1(my - 9) + '" width="' + f1(tw) + '" height="18" rx="4"/><text x="' + f1(mx) + '" y="' + f1(my + 4) + '" text-anchor="middle">' + esc(x.text) + "</text>";
        gLabels.appendChild(n);
      });
    }
    m.elemente.forEach((e) => {
      const r = lay.el[e.id];
      if (!r) return;
      const n = svgEl("g", { transform: "translate(" + f1(r.x) + " " + f1(r.y) + ")", "data-id": e.id }, "ar-el " + klasseVon(e) + " ar-typ-" + e.typ + " ar-form-" + (lay.uml ? "uml" : TYPEN[e.typ].form));
      n.innerHTML = (lay.uml ? umlElementMarkup(e, r, lay) : elementMarkup(e, r)) + '<g class="ar-marken"></g>';
      if (opt.fokussierbar !== false) {
        n.setAttribute("tabindex", "0");
        n.setAttribute("role", "button");
        n.setAttribute("aria-label", elementLabel(e, ix));
      }
      gElemente.appendChild(n);
      elG[e.id] = n;
    });
    if (lay.uml) svg.classList.add("ar-notation");
    return { uid: uid, welt: welt, elG: elG, kantenG: kantenG, labelG: labelG, gruppenG: gruppenG, effekte: gEffekte, gElemente: gElemente, gKanten: gKanten };
  }

  // Marke (✓, ✗, ⚡, ⚠ …) oben rechts an einem Element
  function marke(g, r, text, klasse, titel) {
    if (!g) return;
    const ziel = g.querySelector(".ar-marken") || g;
    const n = svgEl("g", { transform: "translate(" + f1(r.w - 2) + " -4)" }, "ar-marke " + (klasse || ""));
    n.innerHTML = '<g class="ar-marke-innen"><circle r="11"/><text y="4.5" text-anchor="middle">' + esc(text) + "</text>" + (titel ? "<title>" + esc(titel) + "</title>" : "") + "</g>";
    ziel.appendChild(n);
    return n;
  }
  function markenLeeren(g, klasse) {
    if (!g) return;
    $$(".ar-marke" + (klasse ? "." + klasse : ""), g).forEach((x) => x.remove());
  }

  /* ---------- 8b. Modulnotation: UML-Komponentendiagramm mit Paketen (Vertrag 10) ---------- */

  const U = { EW: 166, EH: 70, BALL: 8, BALLRAUM: 50, SEITRAUM: 76, GAP: 26, PAD: 16, TAB: 26, OBEN: 20, RAND: 36, NOTIZ: 180 };
  const istPaketEl = (e) => !!e && istGruppenTyp(e.typ);

  function umlStereo(e) { return e.stereotyp ? "«" + e.stereotyp + "»" : ""; }
  function umlGroesse(e) {
    const sch = e.schnittstellen || [];
    const zahl = (s) => sch.filter((x) => x.seite === s).length;
    const nameW = textBreite(ohneTags(e.name), 15, 650) + 44;
    const stereoW = textBreite(umlStereo(e), 12, 400) + 60;
    let w = klemmen(Math.max(nameW, stereoW), U.EW, 230);
    w = Math.max(w, zahl("oben") * 96, zahl("unten") * 96);
    const n = umbrechen(ohneTags(e.name), 15, 650, w - 28, 2);
    const h = U.EH + (n.zeilen.length > 1 ? 17 : 0) + (e.technologie ? 15 : 0);
    return { w: w, h: h, oben: zahl("oben") ? U.BALLRAUM : 0, unten: zahl("unten") ? U.BALLRAUM : 0, links: zahl("links") ? U.SEITRAUM : 0, rechts: zahl("rechts") ? U.SEITRAUM : 0 };
  }
  function notizGroesse(no) {
    const n = umbrechen(ohneTags(no.text), 12.5, 400, U.NOTIZ - 28, 4);
    return { w: U.NOTIZ, h: 18 + n.zeilen.length * 16, zeilen: n.zeilen };
  }
  function paketKopfBreite(e) {
    return textBreite(umlStereo(e) ? umlStereo(e) + " " : "", 12, 400) + textBreite(ohneTags(e.name), 13.5, 700) + 26;
  }

  function umlLayout(m, lopt) {
    lopt = lopt || {};
    const ix = modellIndex(m);
    const el = {}, gr = {}, kopf = {}, hindernisse = [], notizLage = {}, ballInfo = {};
    const kinder = (pid) => {
      const p = m.elemente.filter((e) => (e.in || null) === pid);
      const pk = p.filter(istPaketEl), bl = p.filter((e) => !istPaketEl(e));
      const no = m.notizen.filter((x) => (x.in || null) === pid).map((x) => Object.assign({ istNotiz: true }, x));
      return pk.concat(bl, no);
    };
    const plan = {};
    // Natürliche Grösse eines Behälters (Paket oder Wurzel) und Rasterplan seiner Kinder
    function messen(pid) {
      const items = kinder(pid).map((k) => {
        let nat;
        if (k.istNotiz) nat = notizGroesse(k);
        else if (istPaketEl(k)) nat = messen(k.id);
        else { const g = umlGroesse(k); nat = { w: g.w + g.links + g.rechts, h: g.h + g.oben + g.unten, g: g }; }
        return { k: k, nat: nat, c: k.spalte, r: k.zeile, bw: Math.max(1, Math.round(k.breite || 1)), bh: Math.max(1, Math.round(k.hoehe || 1)), paket: istPaketEl(k) && !k.istNotiz };
      });
      const mitLage = items.some((it) => Number.isFinite(it.c) || Number.isFinite(it.r));
      let C = 1;
      if (!mitLage) {
        // automatisch: Komponenten fliessen in Reihen (max. 4), Pakete je eine ganze Reihe
        let lauf = 0, maxLauf = 0;
        items.forEach((it) => { if (it.paket) lauf = 0; else { lauf++; maxLauf = Math.max(maxLauf, lauf); } });
        C = Math.max(1, Math.min(4, maxLauf));
        let c = 0, r = 0;
        items.forEach((it) => {
          if (it.paket) { if (c > 0) { r++; c = 0; } it.c = 0; it.r = r; it.bw = C; r++; }
          else { it.c = c; it.r = r; it.bw = 1; c++; if (c >= C) { c = 0; r++; } }
        });
      } else {
        items.forEach((it) => { if (Number.isFinite(it.c)) C = Math.max(C, it.c + it.bw); });
        const belegt = {};
        const frei = (c, r, bw, bh) => { for (let i = c; i < c + bw; i++) for (let j = r; j < r + bh; j++) if (belegt[i + "/" + j]) return false; return true; };
        const setze = (it) => { for (let i = it.c; i < it.c + it.bw; i++) for (let j = it.r; j < it.r + it.bh; j++) belegt[i + "/" + j] = 1; };
        items.forEach((it) => { if (Number.isFinite(it.c) && Number.isFinite(it.r)) setze(it); });
        items.forEach((it) => {
          if (Number.isFinite(it.c) && Number.isFinite(it.r)) return;
          if (Number.isFinite(it.c)) { let r = 0; while (!frei(it.c, r, it.bw, it.bh)) r++; it.r = r; setze(it); return; }
          let r = Number.isFinite(it.r) ? it.r : 0, c = 0;
          for (;;) { if (c + Math.min(it.bw, C) > C) { c = 0; r++; } if (frei(c, r, Math.min(it.bw, C), it.bh)) break; c++; }
          it.c = c; it.r = r; it.bw = Math.min(it.bw, C); setze(it);
        });
      }
      let R = 1;
      items.forEach((it) => { R = Math.max(R, it.r + it.bh); C = Math.max(C, it.c + it.bw); });
      const colW = new Array(C).fill(0), rowH = new Array(R).fill(0);
      const verteilen = (arr, a, n, mass) => {
        let summe = U.GAP * (n - 1);
        for (let i = a; i < a + n; i++) summe += arr[i];
        if (summe < mass) { const d = (mass - summe) / n; for (let i = a; i < a + n; i++) arr[i] += d; }
      };
      items.filter((it) => it.bw === 1).forEach((it) => (colW[it.c] = Math.max(colW[it.c], it.nat.w)));
      items.filter((it) => it.bh === 1).forEach((it) => (rowH[it.r] = Math.max(rowH[it.r], it.nat.h)));
      items.filter((it) => it.bw > 1).forEach((it) => verteilen(colW, it.c, it.bw, it.nat.w));
      items.filter((it) => it.bh > 1).forEach((it) => verteilen(rowH, it.r, it.bh, it.nat.h));
      const leer = lopt.leerMin || { w: 120, h: 40 };
      const iw = items.length ? colW.reduce((a, b) => a + b, 0) + U.GAP * (C - 1) : leer.w;
      const ih = items.length ? rowH.reduce((a, b) => a + b, 0) + U.GAP * (R - 1) : leer.h;
      plan[pid || "#wurzel"] = { items: items, colW: colW, rowH: rowH, iw: iw, ih: ih };
      if (pid === null) return { w: iw, h: ih };
      const e = ix.nachId[pid];
      return { w: Math.max(iw + 2 * U.PAD, paketKopfBreite(e) + 40), h: ih + U.TAB + U.OBEN + U.PAD };
    }
    function platzieren(pid, x, y, w, h, tiefe) {
      const pl = plan[pid || "#wurzel"];
      let cx, cy, cw, ch;
      if (pid === null) { cx = x; cy = y; cw = w; ch = h; }
      else {
        const e = ix.nachId[pid];
        gr[pid] = { id: pid, x: x, y: y, w: w, h: h, tiefe: tiefe, gruppe: true };
        kopf[pid] = { x: x, y: y, w: Math.min(w, paketKopfBreite(e)), h: U.TAB };
        cx = x + U.PAD; cy = y + U.TAB + U.OBEN; cw = w - 2 * U.PAD; ch = h - U.TAB - U.OBEN - U.PAD;
      }
      const colW = pl.colW.slice(), rowH = pl.rowH.slice();
      const extraW = Math.max(0, cw - pl.iw), extraH = Math.max(0, ch - pl.ih);
      colW.forEach((_, i) => (colW[i] += extraW / colW.length));
      rowH.forEach((_, i) => (rowH[i] += extraH / rowH.length));
      const xs = [cx], ys = [cy];
      colW.forEach((v, i) => xs.push(xs[i] + v + U.GAP));
      rowH.forEach((v, i) => ys.push(ys[i] + v + U.GAP));
      pl.items.forEach((it) => {
        const zx = xs[it.c], zy = ys[it.r];
        const zw = xs[it.c + it.bw] - U.GAP - zx, zh = ys[it.r + it.bh] - U.GAP - zy;
        if (it.k.istNotiz) {
          const n = it.nat;
          notizLage[it.k.id] = { x: zx + (zw - n.w) / 2, y: zy + (zh - n.h) / 2, w: n.w, h: n.h, zeilen: n.zeilen };
          el[it.k.id] = { id: it.k.id, x: notizLage[it.k.id].x, y: notizLage[it.k.id].y, w: n.w, h: n.h, notiz: true };
        } else if (it.paket) {
          // Höhe nur strecken, wenn ein Nachbar in derselben Reihe liegt (gleich hohe Schichten); sonst natürliche Höhe
          const nachbar = pl.items.some((o) => o !== it && o.bh === 1 && o.r >= it.r && o.r < it.r + it.bh);
          platzieren(it.k.id, zx, zy, zw, nachbar || it.bh > 1 ? zh : Math.min(zh, it.nat.h), tiefe + 1);
        }
        else {
          const g = it.nat.g;
          const tw = g.w + g.links + g.rechts, th = g.h + g.oben + g.unten;
          const ex = zx + (zw - tw) / 2 + g.links, ey = zy + Math.min((zh - th) / 2, 18) + g.oben;
          el[it.k.id] = { id: it.k.id, x: ex, y: ey, w: g.w, h: g.h, zelle: { x: zx, y: zy, w: zw, h: zh } };
          // Schnittstellen (Ball) mit Beschriftung
          const sch = it.k.schnittstellen || [];
          ["oben", "unten", "links", "rechts"].forEach((seite) => {
            const liste = sch.filter((x) => x.seite === seite);
            liste.forEach((x, i) => {
              let bx, by;
              const lw = textBreite(x.name, 12.5, 650);
              if (seite === "oben" || seite === "unten") {
                bx = ex + (g.w * (i + 0.5)) / liste.length - Math.min(lw, 60) / 2;
                by = seite === "oben" ? ey - 32 : ey + g.h + 32;
              } else {
                bx = seite === "rechts" ? ex + g.w + 40 : ex - 40;
                by = ey + (g.h * (i + 1)) / (liste.length + 1);
              }
              const id = it.k.id + "#" + x.id;
              el[id] = { id: id, x: bx - U.BALL, y: by - U.BALL, w: 2 * U.BALL, h: 2 * U.BALL, ball: true, besitzer: it.k.id, seite: seite };
              const lab = seite === "oben" || seite === "unten" ? { x: bx + 13, y: by - 9, w: lw + 4, h: 18 } : { x: bx - lw / 2, y: by - 30, w: lw + 4, h: 18 };
              ballInfo[id] = { cx: bx, cy: by, name: x.name, lab: lab, seite: seite };
              hindernisse.push({ x1: lab.x - 2, y1: lab.y, x2: lab.x + lab.w, y2: lab.y + lab.h });
            });
          });
        }
      });
    }
    const wurzel = messen(null);
    platzieren(null, U.RAND, U.RAND, wurzel.w, wurzel.h, -1);
    // Notizen werden gestrichelt an ihr Element gebunden
    const notizKanten = m.notizen.filter((no) => no.an && (el[no.an] || gr[no.an])).map((no) => ({ id: "notiz-" + no.id, von: no.id, nach: no.an, art: "notiz" }));
    const box = { x: 0, y: 0, w: wurzel.w + 2 * U.RAND, h: wurzel.h + 2 * U.RAND };
    return { el: el, gr: gr, box: box, ix: ix, kopf: kopf, hindernisse: hindernisse, notizLage: notizLage, notizKanten: notizKanten, ballInfo: ballInfo, uml: true, manuell: true };
  }

  function umlElementMarkup(e, r, lay) {
    const w = r.w, h = r.h, cx = w / 2;
    let s = '<rect class="ar-ring" x="-6" y="-6" width="' + (w + 12) + '" height="' + (h + 12) + '" rx="8"/>';
    // Schnittstellen: Stiel und Ball (bereitgestellt)
    (e.schnittstellen || []).forEach((x) => {
      const b = lay.ballInfo[e.id + "#" + x.id];
      if (!b) return;
      const bx = b.cx - r.x, by = b.cy - r.y;
      let stiel;
      if (b.seite === "oben") stiel = "M" + f1(bx) + " 0V" + f1(by + U.BALL);
      else if (b.seite === "unten") stiel = "M" + f1(bx) + " " + h + "V" + f1(by - U.BALL);
      else if (b.seite === "rechts") stiel = "M" + w + " " + f1(by) + "H" + f1(bx - U.BALL);
      else stiel = "M0 " + f1(by) + "H" + f1(bx + U.BALL);
      s += '<path class="ar-uml-stiel" d="' + stiel + '"/><circle class="ar-uml-ball" data-sch="' + esc(x.id) + '" cx="' + f1(bx) + '" cy="' + f1(by) + '" r="' + U.BALL + '"/>';
      const lx = b.lab.x - r.x, ly = b.lab.y - r.y;
      s += '<text class="ar-uml-sch" x="' + f1(lx) + '" y="' + f1(ly + 13.5) + '">' + esc(b.name) + "</text>";
    });
    if (istNetzEl(e)) {
      // Netz als Band (kein Softwarebaustein, darum ohne Komponentensymbol)
      s += '<rect class="ar-form ar-uml-netz" x="0" y="0" width="' + w + '" height="' + h + '" rx="' + f1(Math.min(h / 2, 28)) + '"/>';
      s += '<path class="ar-form-linie ar-fein" d="M16 ' + f1(h - 10) + "q" + f1((w - 32) / 8) + " -6 " + f1((w - 32) / 4) + " 0t" + f1((w - 32) / 4) + " 0t" + f1((w - 32) / 4) + " 0t" + f1((w - 32) / 4) + ' 0"/>';
      s += piktoG("netz", 12, 8, 16);
    } else {
      s += '<rect class="ar-form ar-uml-komp' + (e.rolle === "extern" ? " ar-gestrichelt" : "") + '" x="0" y="0" width="' + w + '" height="' + h + '" rx="4"/>';
      s += UML_KOMPONENTE(w - 25, 8);
    }
    const zeilen = [];
    if (e.stereotyp) zeilen.push({ t: kuerzen(umlStereo(e), 12, 400, w - 60), px: 12, k: "ar-stereo", h: 16 });
    const n = umbrechen(ohneTags(e.name), 15, 650, w - 28, 2);
    n.zeilen.forEach((z) => zeilen.push({ t: z, px: n.px, k: "ar-name", h: n.px + 3 }));
    if (e.technologie) zeilen.push({ t: kuerzen(ohneTags(e.technologie), 12, 400, w - 24), px: 12, k: "ar-tech", h: 15 });
    const gesamt = zeilen.reduce((a, z) => a + z.h, 0);
    let y = Math.max(6, (h - gesamt) / 2);
    zeilen.forEach((z) => { y += z.h; s += '<text class="' + z.k + '" x="' + f1(cx) + '" y="' + f1(y - (z.h - z.px) / 2 - 2) + '" text-anchor="middle" style="font-size:' + z.px + 'px">' + esc(z.t) + "</text>"; });
    return s;
  }

  function umlPaketMarkup(e, g) {
    const tw = Math.min(g.w, paketKopfBreite(e));
    let s = '<path class="ar-uml-reiter" d="M0 ' + U.TAB + "V3Q0 0 3 0H" + f1(tw - 3) + "Q" + f1(tw) + " 0 " + f1(tw) + " 3V" + U.TAB + 'Z"/>';
    s += '<rect class="ar-uml-paket" x="0" y="' + (U.TAB - 0.5) + '" width="' + f1(g.w) + '" height="' + f1(g.h - U.TAB + 0.5) + '" rx="2"/>';
    s += '<rect class="ar-ring" x="-4" y="-4" width="' + f1(g.w + 8) + '" height="' + f1(g.h + 8) + '" rx="6"/>';
    s += '<text class="ar-uml-ptitel" x="12" y="18">' + (e.stereotyp ? '<tspan class="ar-stereo">' + esc(umlStereo(e)) + " </tspan>" : "") + esc(ohneTags(e.name)) + "</text>";
    return s;
  }

  // Socket (benötigte Schnittstelle) als Halbkreis um den Ball, offen zum Ball hin
  function socketMarkup(route, ball) {
    const p = route.punkte;
    if (!ball || p.length < 2) return "";
    const a = p[p.length - 2];
    const ang = Math.atan2(a[1] - ball.cy, a[0] - ball.cx); // Richtung zum Aufrufer
    const R2 = U.BALL + 5;
    const p1 = [ball.cx + R2 * Math.cos(ang - Math.PI / 2), ball.cy + R2 * Math.sin(ang - Math.PI / 2)];
    const p2 = [ball.cx + R2 * Math.cos(ang + Math.PI / 2), ball.cy + R2 * Math.sin(ang + Math.PI / 2)];
    return '<path class="ar-uml-socket" d="M' + f1(p1[0]) + " " + f1(p1[1]) + "A" + R2 + " " + R2 + " 0 0 1 " + f1(p2[0]) + " " + f1(p2[1]) + '"/>';
  }
  function notizMarkup(no, r) {
    let s = '<path class="ar-uml-notiz" d="M0 0H' + (r.w - 12) + "L" + r.w + " 12V" + r.h + 'H0Z"/><path class="ar-uml-notiz-ecke" d="M' + (r.w - 12) + " 0V12H" + r.w + '"/>';
    (r.zeilen || []).forEach((z, i) => (s += '<text class="ar-uml-notiz-text" x="10" y="' + (21 + i * 16) + '">' + esc(z) + "</text>"));
    return s;
  }

  /* ---------- 9. Zoom und Verschieben ---------- */

  function zoomFlaeche(rahmen, svg, opt) {
    opt = opt || {};
    let inhalt = opt.inhalt;
    const vb = { x: 0, y: 0, w: 100, h: 100 };
    let hoehe = 0, fitK = 1, letzteBreite = 0;
    // Lesbarer Mindestmassstab: breit 0.92 (Name ≥ 13.8 px, Stereotyp/Label ≥ 11 px), schmal 0.74 (Name ≥ 11 px)
    const kMin = () => (opt.kMin !== undefined ? opt.kMin : breite() < 600 ? 0.74 : 0.92);
    let startK = 1;
    const breite = () => rahmen.clientWidth || 640;
    const k = () => breite() / vb.w;
    function anwenden() {
      svg.setAttribute("viewBox", f1(vb.x) + " " + f1(vb.y) + " " + f1(vb.w) + " " + f1(vb.h));
      // erst nach eigenem Zoomen fängt die Fläche alle Gesten ab; sonst scrollt die Seite senkrecht weiter
      rahmen.classList.toggle("ar-gezoomt", k() > Math.max(fitK, startK) * 1.04);
      if (opt.onZoom) opt.onZoom(k());
    }
    function start() {
      const cw = breite();
      letzteBreite = cw;
      // Breite füllen; ist das Diagramm dafür zu breit, lesbar starten und in sich verschieben
      // Höhe folgt dem Inhalt (die Seite scrollt daran vorbei); sehr hohe Diagramme verschieben sich in sich
      const maxH = opt.hoehe || opt.maxHoehe || Math.max(1100, (window.innerHeight || 800) * 1.2);
      const fit = Math.min(cw / inhalt.w, opt.kMax || 1.08);
      let kk;
      if (Number.isFinite(opt.massstab) && opt.massstab > 0) kk = klemmen(opt.massstab, 0.15, 3);
      else if (opt.einpassen) kk = Math.min(fit, maxH / inhalt.h);
      // breite Bildschirme (ab 1000 px Fenster): Inhalt bis etwa 1700 px (Massstab ≥ 0.7) einpassen statt abschneiden
      else if (fit < kMin() && opt.kMin === undefined && (window.innerWidth || cw) >= 1000 && fit >= 0.7) kk = fit;
      else kk = Math.max(fit, kMin());
      hoehe = klemmen(inhalt.h * kk, opt.minHoehe || 220, maxH);
      rahmen.style.height = Math.round(hoehe) + "px";
      vb.w = cw / kk; vb.h = hoehe / kk;
      vb.x = vb.w >= inhalt.w ? inhalt.x + (inhalt.w - vb.w) / 2 : inhalt.x;
      vb.y = vb.h >= inhalt.h ? inhalt.y + (inhalt.h - vb.h) / 2 : inhalt.y;
      fitK = Math.min(cw / inhalt.w, hoehe / inhalt.h);
      startK = kk;
      anwenden();
    }
    function einpassen() {
      const cw = breite();
      const kk = Math.min(cw / inhalt.w, hoehe / inhalt.h, opt.kMax || 1.08);
      vb.w = cw / kk; vb.h = hoehe / kk;
      vb.x = inhalt.x + (inhalt.w - vb.w) / 2; vb.y = inhalt.y + (inhalt.h - vb.h) / 2;
      anwenden();
    }
    function zoom(f, px, py) {
      const cw = breite();
      const alt = k();
      const neu = klemmen(alt * f, 0.15, 3);
      const rx = px === undefined ? 0.5 : px / cw, ry = py === undefined ? 0.5 : py / hoehe;
      const wx = vb.x + vb.w * rx, wy = vb.y + vb.h * ry;
      vb.w = cw / neu; vb.h = hoehe / neu;
      vb.x = wx - vb.w * rx; vb.y = wy - vb.h * ry;
      anwenden();
    }
    function verschieben(dx, dy) {
      const kk = k();
      vb.x -= dx / kk; vb.y -= dy / kk;
      // nicht ganz aus dem Bild schieben
      vb.x = klemmen(vb.x, inhalt.x - vb.w * 0.8, inhalt.x + inhalt.w - vb.w * 0.2);
      vb.y = klemmen(vb.y, inhalt.y - vb.h * 0.8, inhalt.y + inhalt.h - vb.h * 0.2);
      anwenden();
    }
    // Weltkoordinaten eines Bildschirmpunkts
    function welt(clientX, clientY) {
      const r = rahmen.getBoundingClientRect();
      const kk = k();
      return [vb.x + (clientX - r.left) / kk, vb.y + (clientY - r.top) / kk];
    }
    function bildschirm(x, y) {
      const kk = k();
      return [(x - vb.x) * kk, (y - vb.y) * kk];
    }
    // Ziehen zum Verschieben, zwei Finger zum Zoomen
    const zeiger = new Map();
    let zieh = null, pinch = null;
    rahmen.addEventListener("pointerdown", (ev) => {
      if (opt.darfZiehen && !opt.darfZiehen(ev)) return;
      if (ev.button !== undefined && ev.button > 0) return;
      zeiger.set(ev.pointerId, [ev.clientX, ev.clientY]);
      if (zeiger.size === 2) {
        const [a, b] = Array.from(zeiger.values());
        pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]) };
        zieh = null;
      } else zieh = { x: ev.clientX, y: ev.clientY, aktiv: false, id: ev.pointerId };
    });
    rahmen.addEventListener("pointermove", (ev) => {
      if (!zeiger.has(ev.pointerId)) return;
      zeiger.set(ev.pointerId, [ev.clientX, ev.clientY]);
      if (pinch && zeiger.size === 2) {
        const [a, b] = Array.from(zeiger.values());
        const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
        const r = rahmen.getBoundingClientRect();
        if (pinch.d > 0) zoom(d / pinch.d, (a[0] + b[0]) / 2 - r.left, (a[1] + b[1]) / 2 - r.top);
        pinch.d = d;
        ev.preventDefault();
        return;
      }
      if (!zieh || zieh.id !== ev.pointerId) return;
      const dx = ev.clientX - zieh.x, dy = ev.clientY - zieh.y;
      if (!zieh.aktiv && Math.hypot(dx, dy) > 5) {
        zieh.aktiv = true;
        rahmen.classList.add("ar-zieht");
        try { rahmen.setPointerCapture(ev.pointerId); } catch (e) { /* egal */ }
      }
      if (zieh.aktiv) {
        verschieben(dx, dy);
        zieh.x = ev.clientX; zieh.y = ev.clientY;
      }
    });
    const ende = (ev) => {
      zeiger.delete(ev.pointerId);
      if (zeiger.size < 2) pinch = null;
      if (zieh && zieh.id === ev.pointerId) {
        if (zieh.aktiv) {
          rahmen.classList.remove("ar-zieht");
          // Klick nach dem Ziehen unterdrücken
          const stopp = (e) => { e.stopPropagation(); e.preventDefault(); };
          rahmen.addEventListener("click", stopp, { capture: true, once: true });
          setTimeout(() => rahmen.removeEventListener("click", stopp, { capture: true }), 50);
        }
        zieh = null;
      }
    };
    rahmen.addEventListener("pointerup", ende);
    rahmen.addEventListener("pointercancel", ende);
    rahmen.addEventListener("wheel", (ev) => {
      if (!ev.ctrlKey && !ev.metaKey) return;
      ev.preventDefault();
      const r = rahmen.getBoundingClientRect();
      zoom(ev.deltaY < 0 ? 1.12 : 1 / 1.12, ev.clientX - r.left, ev.clientY - r.top);
    }, { passive: false });
    rahmen.addEventListener("keydown", (ev) => {
      if (ev.target !== rahmen) return;
      const s = 50;
      const tasten = {
        ArrowLeft: () => verschieben(s, 0), ArrowRight: () => verschieben(-s, 0),
        ArrowUp: () => verschieben(0, s), ArrowDown: () => verschieben(0, -s),
        "+": () => zoom(1.2), "=": () => zoom(1.2), "-": () => zoom(1 / 1.2), "0": einpassen,
      };
      if (tasten[ev.key]) { ev.preventDefault(); tasten[ev.key](); }
    });
    if (window.ResizeObserver) {
      new ResizeObserver(() => { if (Math.abs(breite() - letzteBreite) > 2) start(); }).observe(rahmen);
    }
    start();
    return {
      start: start, einpassen: einpassen, zoom: zoom, verschieben: verschieben, welt: welt, bildschirm: bildschirm,
      setzeInhalt: (b) => { inhalt = b; start(); },
      masstab: k, vb: vb,
      zeige: (r) => {
        // Rechteck r sichtbar machen (z. B. fokussiertes Element)
        if (r.x >= vb.x && r.y >= vb.y && r.x + r.w <= vb.x + vb.w && r.y + r.h <= vb.y + vb.h) return;
        vb.x = r.x + r.w / 2 - vb.w / 2; vb.y = r.y + r.h / 2 - vb.h / 2;
        anwenden();
      },
    };
  }

  function zoomLeiste(fl, beschriftung) {
    const leiste = erzeugen("div", "ar-zoom");
    leiste.setAttribute("role", "group");
    leiste.setAttribute("aria-label", beschriftung || "Ansicht");
    const minus = knopf("−", "ar-ikon", { "aria-label": "Verkleinern" });
    const plus = knopf("+", "ar-ikon", { "aria-label": "Vergrössern" });
    const fit = knopf('<svg class="pikto" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/></svg>', "ar-ikon", { "aria-label": "Einpassen", title: "Einpassen" });
    minus.addEventListener("click", () => fl().zoom(1 / 1.25));
    plus.addEventListener("click", () => fl().zoom(1.25));
    fit.addEventListener("click", () => fl().einpassen());
    leiste.append(minus, plus, fit);
    return leiste;
  }

  /* ---------- 10. Diagramm ---------- */

  const STECKBRIEF_FELDER = [
    ["was", "Was es ist"], ["kann", "Was es kann"], ["wofuer", "Wofür"], ["technologie", "Technologie"], ["warum", "Warum diese Technologie"],
  ];
  const ART_VERB = {
    sync: ["ruft synchron auf", "wird synchron aufgerufen von"],
    async: ["sendet Nachrichten an", "erhält Nachrichten von"],
    daten: ["liest/schreibt in", "speichert Daten für"],
    abhaengigkeit: ["nutzt", "wird genutzt von"],
    realisiert: ["stellt bereit", "wird bereitgestellt von"],
    deploy: ["läuft auf", "führt aus"],
    stream: ["leitet Daten weiter an", "erhält Daten von"],
    assoziation: ["kommuniziert mit", "wird genutzt von"],
    notiz: ["erläutert", "wird erläutert von"],
  };

  function artMuster(art, breite) {
    const w = breite || 46;
    const cls = "ar-kante ar-art-" + art + " ar-k-neutral";
    const p = [[3, 8], [w - 3, 8]];
    const sp = spitzeMarkup(art, p, false);
    const d = "M" + sp.linie[0][0] + " 8L" + f1(sp.linie[1][0]) + " 8";
    return '<svg class="ar-muster" viewBox="0 0 ' + w + ' 16" aria-hidden="true" focusable="false"><g class="' + cls + '"><path class="ar-linie" d="' + d + '"/>' +
      (art === "stream" ? '<path class="ar-linie-innen" d="' + d + '"/>' : "") + sp.spitze + "</g></svg>";
  }

  function diagramm(el, modell, opt) {
    el = elementHolen(el, "diagramm");
    if (!el) return null;
    opt = Object.assign({ ablauf: true, ausfall: true, legende: true, steckbrief: true, textliste: true, breit: true }, opt || {});
    const m = modellPruefen(modell, "diagramm");
    if (!m) return null;
    const uid = neueId("dg");
    const uml = m.notation === "uml-komponenten";
    const lay = uml ? umlLayout(m) : layoutBerechnen(m);
    const ix = lay.ix;
    const routen = kantenRouten(lay, m.verbindungen.concat(lay.notizKanten || []));
    const labels = labelsSetzen(lay, m.verbindungen, routen);
    const nachId = ix.nachId;
    const name = (id) => ohneTags(nachId[id].name);

    el.innerHTML = "";
    el.classList.add("ar-diagramm");
    if (opt.breit) el.classList.add("ar-weit");
    const live = ansage();

    // Kopf mit Titel und Werkzeugen
    const kopf = erzeugen("div", "ar-kopf");
    const titelText = opt.titel !== undefined ? opt.titel : m.titel;
    if (titelText) kopf.appendChild(erzeugen("h3", "ar-titel", titelText));
    const werkzeuge = erzeugen("div", "ar-werkzeuge");
    let fl = null;
    werkzeuge.appendChild(zoomLeiste(() => fl, "Zoom"));
    let ausfallKnopf = null;
    if (opt.ausfall) {
      ausfallKnopf = knopf('<span aria-hidden="true">⚡</span> Ausfall simulieren', "ar-ausfall-knopf", { "aria-pressed": "false" });
      werkzeuge.appendChild(ausfallKnopf);
    }
    kopf.appendChild(werkzeuge);

    // Bühne: Diagramm und Steckbrief
    const buehne = erzeugen("div", "ar-buehne" + (opt.steckbrief ? " ar-mit-steckbrief" : ""));
    const rahmen = erzeugen("div", "ar-viewport");
    rahmen.tabIndex = 0;
    rahmen.setAttribute("role", "group");
    rahmen.setAttribute("aria-label", "Diagramm" + (titelText ? " «" + ohneTags(titelText) + "»" : "") + ". Elemente mit Tab erreichen; auf der Fläche verschieben die Pfeiltasten, Plus und Minus zoomen, 0 passt ein.");
    const svg = svgEl("svg", { role: "group", "aria-label": ohneTags(titelText || "Architekturdiagramm"), preserveAspectRatio: "xMidYMid meet" }, "ar-svg");
    rahmen.appendChild(svg);
    const hinweisAusfall = erzeugen("p", "ar-modus-hinweis", "⚡ Ausfall-Modus: Element antippen");
    hinweisAusfall.hidden = true;
    rahmen.appendChild(hinweisAusfall);
    buehne.appendChild(rahmen);
    const sb = erzeugen("aside", "ar-steckbrief");
    sb.setAttribute("aria-live", "polite");
    sb.setAttribute("aria-label", "Steckbrief");
    if (opt.steckbrief) buehne.appendChild(sb);

    el.append(kopf, buehne);

    const szene = szeneZeichnen(svg, m, lay, routen, labels, { uid: uid });
    fl = zoomFlaeche(rahmen, svg, { inhalt: lay.box, hoehe: opt.hoehe, kMin: opt.kMin, massstab: opt.massstab, einpassen: opt.einpassen === true });

    // Nachbarschaft
    const nachbarn = {};
    Object.keys(nachId).forEach((id) => (nachbarn[id] = { el: new Set([id]), k: new Set() }));
    m.verbindungen.forEach((v) => {
      nachbarn[v.von].el.add(v.nach); nachbarn[v.von].k.add(v.id);
      nachbarn[v.nach].el.add(v.von); nachbarn[v.nach].k.add(v.id);
    });
    m.elemente.forEach((e) => {
      if (!ix.istGruppe(e.id)) return;
      (ix.kinder[e.id] || []).forEach((k) => nachbarn[e.id].el.add(k));
    });
    function hervorheben(ids, kanten) {
      svg.classList.toggle("ar-fokus", !!ids);
      Object.keys(szene.elG).forEach((id) => szene.elG[id].classList.toggle("ar-nah", !!ids && ids.has(id)));
      Object.keys(szene.kantenG).forEach((id) => {
        const an = !!kanten && kanten.has(id);
        szene.kantenG[id].classList.toggle("ar-nah", an);
        if (szene.labelG[id]) szene.labelG[id].classList.toggle("ar-nah", an);
      });
    }
    let gewaehlt = null;
    const nachbarschaftAn = (id) => hervorheben(nachbarn[id].el, nachbarn[id].k);
    const nachbarschaftAus = () => { if (gewaehlt && nachbarn[gewaehlt]) nachbarschaftAn(gewaehlt); else hervorheben(null, null); };

    // Steckbrief
    function steckbriefLeer() {
      sb.innerHTML = '<div class="ar-sb-leer"><p class="ar-sb-titel">Steckbrief</p><p>Tippe ein Element im Diagramm an (oder wähle es mit Tab und Enter). Hier erscheint, was es ist, was es kann, wofür man es braucht und welche Technologie warum passt.</p>' +
        '<p class="hint">' + m.elemente.length + " Elemente · " + m.verbindungen.length + " Verbindungen" + (m.ablaeufe.length ? " · " + m.ablaeufe.length + (m.ablaeufe.length > 1 ? " Abläufe" : " Ablauf") : "") + "</p></div>";
    }
    function steckbriefZeigen(id) {
      const e = nachId[id];
      if (!e) return;
      const t = TYPEN[e.typ];
      const kat = kategorieVon(e.typ);
      const gruppe = e.rolle ? ROLLE[e.rolle].name : kat ? KAT[kat].name : e.uml && istPaketEl(e) ? "Paket" : "";
      let h = '<div class="ar-sb-kopf ' + klasseVon(e) + '"><span class="ar-sb-ikon">' + piktoSvg(t.pikto) + "</span><div>" +
        '<p class="ar-sb-kat">' + (gruppe ? esc(gruppe) + " · " : "") + esc(e.stereotyp ? "«" + e.stereotyp + "»" : t.name) + "</p>" +
        '<h4 class="ar-sb-name">' + e.name + "</h4>" + (e.technologie ? '<p class="ar-sb-tech">' + e.technologie + "</p>" : "") + "</div></div>";
      const info = e.info || {};
      let felder = "";
      STECKBRIEF_FELDER.forEach(([f, titel]) => { if (info[f]) felder += "<dt>" + titel + "</dt><dd>" + info[f] + "</dd>"; });
      if (!felder && e.uml) felder = "<dt>Was es ist</dt><dd>" + (istPaketEl(e) ? "UML-Paket: fasst zusammen, was in dieser Schicht oder auf diesem Knoten liegt." : esc(e.rolle ? ROLLE[e.rolle].kurz : t.name) + ".") + "</dd>" +
        ((e.schnittstellen || []).length ? "<dt>Bietet an</dt><dd>" + e.schnittstellen.map((x) => esc(x.name)).join(", ") + "</dd>" : "");
      if (!felder) felder = "<dt>Was es ist</dt><dd>" + esc(t.name) + (kat ? " (" + esc(KAT[kat].kurz) + ")" : "") + ".</dd><dt>Typische Technologien</dt><dd>" + esc(t.beispiele) + "</dd>";
      h += '<dl class="ar-sb-felder">' + felder + "</dl>";
      const vl = [];
      m.verbindungen.forEach((v) => {
        if (v.von === id) vl.push("<li><span class=\"ar-sb-pfeil\" aria-hidden=\"true\">→</span> " + ART_VERB[v.art][0] + " <b>" + esc(name(v.nach)) + "</b>" + (v.label ? ' <span class="hint">(' + esc(ohneTags(v.label)) + ")</span>" : "") + "</li>");
        if (v.nach === id) vl.push("<li><span class=\"ar-sb-pfeil\" aria-hidden=\"true\">←</span> " + ART_VERB[v.art][1] + " <b>" + esc(name(v.von)) + "</b>" + (v.label ? ' <span class="hint">(' + esc(ohneTags(v.label)) + ")</span>" : "") + "</li>");
      });
      if (ix.istGruppe(id)) vl.push("<li>enthält " + (ix.kinder[id] || []).map((k) => "<b>" + esc(name(k)) + "</b>").join(", ") + "</li>");
      if (vl.length) h += '<div class="ar-sb-verb"><p class="ar-sb-titel">Verbindungen</p><ul>' + vl.join("") + "</ul></div>";
      sb.innerHTML = h;
      formelnSetzen(sb);
    }
    function kanteZeigen(kid) {
      const v = m.verbindungen.find((x) => x.id === kid);
      if (!v) return;
      sb.innerHTML = '<div class="ar-sb-kopf ' + klasseVon(nachId[v.nach]) + '"><span class="ar-sb-ikon ar-sb-ikon-linie">' + artMuster(v.art, 40) + "</span><div>" +
        '<p class="ar-sb-kat">Verbindung · ' + esc(ARTEN[v.art].name) + "</p><h4 class=\"ar-sb-name\">" + esc(name(v.von)) + " → " + esc(name(v.nach)) + (v.nachSch ? " (" + esc(schName(v.nach, v.nachSch)) + ")" : "") + "</h4>" +
        (v.label ? '<p class="ar-sb-tech">' + esc(ohneTags(v.label)) + "</p>" : "") + "</div></div>" +
        '<dl class="ar-sb-felder"><dt>Bedeutung</dt><dd>' + esc(ARTEN[v.art].erkl) + ".</dd>" + (v.info ? "<dt>Warum so</dt><dd>" + v.info + "</dd>" : "") + "</dl>";
      formelnSetzen(sb);
    }
    // Steckbrief: auf breiten Bildschirmen als Karte über dem Diagramm, nur wenn es etwas zu zeigen gibt
    const breitesPanel = () => !!(window.matchMedia && window.matchMedia("(min-width: 900px)").matches);
    function sbZustand() {
      const offen = !!sb.firstElementChild && !sb.querySelector(".ar-sb-leer");
      buehne.classList.toggle("ar-sb-offen", offen);
      if (offen && !sb.querySelector(".ar-sb-zu")) {
        const zu = knopf('<span aria-hidden="true">×</span>', "ar-ikon ar-sb-zu", { "aria-label": "Steckbrief schliessen" });
        zu.addEventListener("click", () => {
          const zurueck = gewaehlt;
          if (gewaehlt) waehlen(null); else steckbriefLeer();
          const g = zurueck && szene.elG[zurueck];
          (g || rahmen).focus();
        });
        sb.insertBefore(zu, sb.firstChild);
      }
    }
    if (window.MutationObserver) new MutationObserver(sbZustand).observe(sb, { childList: true });
    function sichtbarNebenPanel(id) {
      // Element nicht unter der Steckbrief-Karte verstecken
      const r = lay.el[id] || lay.gr[id];
      if (!r || !breitesPanel() || !buehne.classList.contains("ar-sb-offen")) return;
      const p = fl.bildschirm(r.x + r.w, r.y);
      const frei = rahmen.clientWidth - sb.offsetWidth - 28;
      if (p[0] > frei) fl.verschieben(-(p[0] - frei), 0);
      // Karte auf Höhe des Elements, damit sie bei hohen Diagrammen im Blick bleibt
      const y = fl.bildschirm(r.x, r.y)[1];
      sb.style.top = Math.round(klemmen(y - 20, 12, Math.max(12, rahmen.clientHeight - sb.offsetHeight - 12))) + "px";
    }
    function schName(el, sch) { const x = (nachId[el].schnittstellen || []).find((y) => y.id === sch); return x ? x.name : sch; }
    const plaketten = {};
    function plaketteWeg(id) { if (plaketten[id]) { plaketten[id].remove(); delete plaketten[id]; } }
    function waehlen(id) {
      if (gewaehlt && szene.elG[gewaehlt]) szene.elG[gewaehlt].classList.remove("ar-gewaehlt");
      gewaehlt = id;
      if (id && szene.elG[id]) szene.elG[id].classList.add("ar-gewaehlt");
      if (id) { steckbriefZeigen(id); nachbarschaftAn(id); sbZustand(); sichtbarNebenPanel(id); } else { steckbriefLeer(); hervorheben(null, null); }
      if (id && !opt.steckbrief) live.textContent = elementLabel(nachId[id], ix);
    }

    // Ausfall
    let ausfallModus = false;
    const ausfall = new Set();
    const manuellLangsam = new Set();
    let analyse = { aus: new Set(), betroffen: {}, stau: {}, verloren: [], puffert: {}, ohneNachricht: {} };
    function analysieren() {
      const aus = new Set();
      const add = (id) => {
        if (aus.has(id)) return;
        aus.add(id);
        (ix.kinder[id] || []).forEach(add);
        m.verbindungen.forEach((v) => { if (v.art === "deploy" && v.nach === id) add(v.von); });
      };
      ausfall.forEach(add);
      const betroffen = {}, stau = {}, verloren = [], puffert = {}, ohneNachricht = {};
      const liste = Array.from(aus);
      const schN = (el, sch) => { if (!sch || !nachId[el]) return ""; const x = (nachId[el].schnittstellen || []).find((y) => y.id === sch); return x ? x.name : sch; };
      const asyncKante = (v) => v.art === "async" || (v.art === "assoziation" && (
        ASYNC_PROTOKOLL.test((v.label || "") + " " + (v.protokoll || "") + " " + schN(v.nach, v.nachSch) + " " + schN(v.von, v.vonSch)) ||
        istPufferEl(nachId[v.von]) || istPufferEl(nachId[v.nach])));
      const istSender = (id) => /sender|publisher|produzent|producer/i.test(ohneTags(nachId[id].name) + " " + (nachId[id].stereotyp || ""));
      const istEmpfaenger = (id) => /receiv|empfäng|consumer|subscrib|konsum|abonn/i.test(ohneTags(nachId[id].name) + " " + (nachId[id].stereotyp || ""));
      const istGateway = (id) => nachId[id].typ === "gateway" || /gateway/i.test(ohneTags(nachId[id].name));
      while (liste.length) {
        const x = liste.shift();
        m.verbindungen.forEach((v) => {
          if (v.art === "deploy" || (v.von !== x && v.nach !== x)) return;
          const a = v.von === x ? v.nach : v.von; // die andere Seite
          if (aus.has(a)) return;
          if (istNetzEl(nachId[x])) {
            // Netz fällt aus: Verbindung unterbrochen; ein Gateway puffert (Store and Forward)
            if (istNetzEl(nachId[a])) return;
            if (istGateway(a)) (puffert[a] = puffert[a] || []).push(x);
            else if (!betroffen[a]) betroffen[a] = { wegen: x, art: "netz" };
            return;
          }
          if (asyncKante(v)) {
            if (istPufferEl(nachId[a]) && !istPufferEl(nachId[x])) {
              // Empfänger hinter dem Broker fällt aus: Nachrichten stauen sich, Sender laufen weiter (richtungsunabhängig)
              if (!istSender(x)) (stau[a] = stau[a] || []).push(x);
            } else if (istPufferEl(nachId[x])) {
              // Broker fällt aus: Sender können nicht mehr senden, Empfänger bekommen nichts
              const empf = istEmpfaenger(a) || (v.art === "async" && v.von === x);
              if (empf) (ohneNachricht[a] = ohneNachricht[a] || []).push(x);
              else if (!betroffen[a]) { betroffen[a] = { wegen: x, art: "publish" }; liste.push(a); }
            } else if (v.nach === x) verloren.push(v);
            return;
          }
          if (SYNCHRON_ARTEN[v.art] && v.nach === x && !betroffen[a]) { betroffen[a] = { wegen: x, art: v.art }; liste.push(a); }
        });
      }
      analyse = { aus: aus, betroffen: betroffen, stau: stau, verloren: verloren, puffert: puffert, ohneNachricht: ohneNachricht };
    }
    function zustaendeZeichnen() {
      Object.keys(szene.elG).forEach((id) => {
        const g = szene.elG[id];
        const r = lay.el[id] || lay.gr[id];
        markenLeeren(g, "ar-zm");
        const aus = analyse.aus.has(id), b = !!analyse.betroffen[id] || manuellLangsam.has(id), st = !!analyse.stau[id] || !!analyse.puffert[id];
        g.classList.toggle("ar-ausfall", aus);
        g.classList.toggle("ar-langsam", b && !aus);
        g.classList.toggle("ar-stau", st && !aus);
        g.classList.toggle("ar-neu", nachId[id].zustand === "neu" && !aus);
        if (aus) marke(g, r, "⚡", "ar-zm ar-marke-fehler", "Ausfall");
        else if (b) marke(g, r, "!", "ar-zm ar-marke-langsam", "beeinträchtigt");
        else if (st) marke(g, r, "▤", "ar-zm ar-marke-stau", "Nachrichten stauen sich");
        // Zustand im Namen für Screenreader
        if (g.hasAttribute("aria-label")) {
          const basis = elementLabel(nachId[id], ix) + (ix.istGruppe(id) ? ", Gruppe" : "");
          g.setAttribute("aria-label", basis + (aus ? ", Zustand: Ausfall" : b ? ", Zustand: beeinträchtigt" : st ? ", Zustand: Rückstau im Puffer" : ""));
        }
      });
      m.verbindungen.forEach((v) => {
        const g = szene.kantenG[v.id];
        if (!g) return;
        g.classList.toggle("ar-tot", analyse.aus.has(v.nach) || analyse.aus.has(v.von));
        g.classList.toggle("ar-stauend", (!!analyse.stau[v.von] && analyse.aus.has(v.nach)) || (!!analyse.stau[v.nach] && analyse.aus.has(v.von)));
      });
    }
    function ausfallBericht() {
      if (!analyse.aus.size && !manuellLangsam.size) { steckbriefLeer(); return ""; }
      const n = (ids) => ids.map((id) => "<b>" + esc(name(id)) + "</b>");
      let h = '<div class="ar-sb-ausfall"><p class="ar-sb-titel">Ausfall-Analyse</p>';
      h += '<p class="ar-af-zeile ar-af-aus"><span class="ar-af-ikon" aria-hidden="true">⚡</span><span>Ausgefallen: ' + n(Array.from(analyse.aus)).join(", ") + "</span></p>";
      const b = Object.keys(analyse.betroffen);
      if (b.length) {
        h += '<p class="ar-af-zeile ar-af-langsam"><span class="ar-af-ikon" aria-hidden="true">!</span><span>Beeinträchtigt: ' + b.map((id) => {
          const x = analyse.betroffen[id];
          return "<b>" + esc(name(id)) + "</b> " + (x.art === "publish" ? "(kann nicht an «" + esc(name(x.wegen)) + "» senden)" : x.art === "netz" ? "(Verbindung über «" + esc(name(x.wegen)) + "» unterbrochen)" : "(wartet " + (x.art === "daten" ? "auf Daten von" : "synchron auf") + " «" + esc(name(x.wegen)) + "»)");
        }).join(", ") + ". Synchrone Aufrufe reichen den Fehler weiter nach oben.</span></p>";
      }
      Object.keys(analyse.stau).forEach((id) => {
        h += '<p class="ar-af-zeile ar-af-stau"><span class="ar-af-ikon" aria-hidden="true">▤</span><span>Nachrichten stauen sich im Broker <b>' + esc(name(id)) + "</b>. Wer an ihn sendet, arbeitet weiter: Der Puffer entkoppelt. Sobald " +
          analyse.stau[id].map((x) => "«" + esc(name(x)) + "»").join(", ") + " wieder läuft, werden die Nachrichten nachgeliefert.</span></p>";
      });
      Object.keys(analyse.puffert).forEach((id) => {
        h += '<p class="ar-af-zeile ar-af-stau"><span class="ar-af-ikon" aria-hidden="true">▤</span><span><b>' + esc(name(id)) + "</b> puffert die Daten (Store and Forward), bis " +
          analyse.puffert[id].map((x) => "«" + esc(name(x)) + "»").join(", ") + " wieder läuft. Danach liefert es nach.</span></p>";
      });
      Object.keys(analyse.ohneNachricht).forEach((id) => {
        h += '<p class="ar-af-zeile"><span class="ar-af-ikon" aria-hidden="true">○</span><span><b>' + esc(name(id)) + "</b> läuft, bekommt aber keine Nachrichten mehr von «" + esc(name(analyse.ohneNachricht[id][0])) + "».</span></p>";
      });
      analyse.verloren.forEach((v) => {
        h += '<p class="ar-af-zeile ar-af-verloren"><span class="ar-af-ikon" aria-hidden="true">✗</span><span>Asynchron, aber ohne Puffer: Nachrichten von «' + esc(name(v.von)) + "» an «" + esc(name(v.nach)) + "» gehen verloren.</span></p>";
      });
      const ok = m.elemente.filter((e) => !ix.istGruppe(e.id) && !analyse.aus.has(e.id) && !analyse.betroffen[e.id]).map((e) => e.id);
      if (ok.length) h += '<p class="ar-af-zeile ar-af-ok"><span class="ar-af-ikon" aria-hidden="true">✓</span><span>Läuft weiter: ' + n(ok).join(", ") + "</span></p>";
      const betrA = m.ablaeufe.map((a) => {
        const i = a.schritte.findIndex((s) => analyse.aus.has(s.nach) || analyse.aus.has(s.von) || analyse.aus.has(s.bei));
        return i >= 0 ? "«" + esc(a.name) + "» ab Schritt " + (i + 1) : null;
      }).filter(Boolean);
      if (betrA.length) h += '<p class="ar-af-zeile"><span class="ar-af-ikon" aria-hidden="true">▶</span><span>Betroffene Abläufe: ' + betrA.join(", ") + ". Spiel sie ab, um zu sehen, wo es klemmt.</span></p>";
      h += "</div>";
      sb.innerHTML = h;
      const zurueck = knopf("Alles wieder in Betrieb", "ar-klein");
      zurueck.addEventListener("click", () => { ausfall.clear(); manuellLangsam.clear(); analysieren(); zustaendeZeichnen(); ausfallBericht(); live.textContent = "Alle Elemente laufen wieder."; if (ausfallKnopf) ausfallKnopf.focus(); });
      sb.firstChild.appendChild(zurueck);
      return "";
    }
    function ausfallUmschalten(id) {
      if (ausfall.has(id)) ausfall.delete(id); else ausfall.add(id);
      analysieren();
      zustaendeZeichnen();
      ausfallBericht();
      const b = Object.keys(analyse.betroffen).map(name);
      live.textContent = ausfall.has(id)
        ? "Ausfall: " + name(id) + "." + (b.length ? " Beeinträchtigt: " + b.join(", ") + "." : " Kein anderes Element ist synchron davon abhängig.") + (Object.keys(analyse.stau).length ? " Nachrichten stauen sich im Broker." : "")
        : name(id) + " läuft wieder.";
    }
    if (ausfallKnopf) {
      ausfallKnopf.addEventListener("click", () => {
        ausfallModus = !ausfallModus;
        ausfallKnopf.setAttribute("aria-pressed", String(ausfallModus));
        ausfallKnopf.classList.toggle("on", ausfallModus);
        el.classList.toggle("ar-im-ausfall", ausfallModus);
        hinweisAusfall.hidden = !ausfallModus;
        live.textContent = ausfallModus ? "Ausfall-Modus an: Wähle ein Element, um es ausfallen zu lassen." : "Ausfall-Modus aus.";
        if (ausfallModus) { if (!ausfall.size) sb.innerHTML = '<div class="ar-sb-leer"><p class="ar-sb-titel">Ausfall-Modus</p><p>Wähle ein Element. Es fällt aus, und du siehst, wer synchron davon abhängt (beeinträchtigt) und wo ein Broker puffert.</p></div>'; }
        else if (!ausfall.size) steckbriefLeer();
      });
    }

    // Bedienung der Elemente
    function aktivieren(id) {
      if (ausfallModus) ausfallUmschalten(id);
      else waehlen(gewaehlt === id ? null : id);
    }
    Object.keys(szene.elG).forEach((id) => {
      const g = szene.elG[id];
      g.addEventListener("click", (ev) => { ev.stopPropagation(); aktivieren(id); });
      g.addEventListener("keydown", (ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); aktivieren(id); } else if (ev.key === "Escape") { waehlen(null); } });
      g.addEventListener("pointerenter", () => nachbarschaftAn(id));
      g.addEventListener("pointerleave", nachbarschaftAus);
      g.addEventListener("focus", () => { nachbarschaftAn(id); fl.zeige(lay.el[id] || lay.gr[id]); });
      g.addEventListener("blur", nachbarschaftAus);
    });
    Object.keys(szene.kantenG).forEach((kid) => {
      const g = szene.kantenG[kid];
      const v = m.verbindungen.find((x) => x.id === kid);
      const an = () => hervorheben(new Set([v.von, v.nach]), new Set([kid]));
      g.addEventListener("pointerenter", an);
      g.addEventListener("pointerleave", nachbarschaftAus);
      g.addEventListener("click", (ev) => { ev.stopPropagation(); if (!ausfallModus) { waehlen(null); kanteZeigen(kid); an(); } });
    });
    svg.addEventListener("click", () => { if (!ausfallModus && gewaehlt) waehlen(null); });

    // Legende
    let legende = null;
    const katFokus = new Set();
    if (opt.legende) {
      legende = erzeugen("div", "ar-legende");
      // Modulnotation: Rollen statt Kategorien
      const gruppeVon = (e) => (uml ? e.rolle || null : kategorieVon(e.typ));
      const namen = uml ? ROLLE : KAT;
      const kats = (uml ? ROLLEN : KATEGORIEN).filter((k) => m.elemente.some((e) => gruppeVon(e) === k.id));
      const kReihe = erzeugen("div", "ar-legende-reihe");
      kReihe.setAttribute("role", "group");
      kReihe.setAttribute("aria-label", uml ? "Rollen hervorheben" : "Kategorien hervorheben");
      kReihe.appendChild(erzeugen("span", "ar-legende-titel", uml ? "Rollen" : "Kategorien"));
      kats.forEach((k) => {
        const b = knopf('<span class="ar-farbpunkt" aria-hidden="true"></span>' + esc(k.name), "ar-chip " + (uml ? "ar-r-" : "ar-k-") + k.id, { "aria-pressed": "false", title: k.kurz });
        b.addEventListener("click", () => {
          if (katFokus.has(k.id)) katFokus.delete(k.id); else katFokus.add(k.id);
          b.setAttribute("aria-pressed", String(katFokus.has(k.id)));
          svg.classList.toggle("ar-kat-fokus", katFokus.size > 0);
          Object.keys(szene.elG).forEach((id) => szene.elG[id].classList.toggle("ar-kat-an", katFokus.has(gruppeVon(nachId[id]))));
          Object.keys(szene.kantenG).forEach((kid) => {
            const v = m.verbindungen.find((x) => x.id === kid);
            const an = katFokus.has(gruppeVon(nachId[v.von])) || katFokus.has(gruppeVon(nachId[v.nach]));
            szene.kantenG[kid].classList.toggle("ar-kat-an", an);
            if (szene.labelG[kid]) szene.labelG[kid].classList.toggle("ar-kat-an", an);
          });
          live.textContent = katFokus.size ? "Hervorgehoben: " + Array.from(katFokus).map((x) => namen[x].name).join(", ") : "Nichts hervorgehoben.";
        });
        kReihe.appendChild(b);
      });
      legende.appendChild(kReihe);
      const arten = ART_IDS.filter((a) => m.verbindungen.some((v) => v.art === a));
      if (arten.length) {
        const aReihe = erzeugen("div", "ar-legende-reihe ar-legende-linien");
        aReihe.appendChild(erzeugen("span", "ar-legende-titel", "Verbindungen"));
        arten.forEach((a) => aReihe.appendChild(erzeugen("span", "ar-legende-linie", artMuster(a, 46) + esc(ARTEN[a].name))));
        legende.appendChild(aReihe);
      }
      el.appendChild(legende);
    }

    // Ablauf-Abspieler
    let spieler = null;
    if (opt.ablauf && m.ablaeufe.length) spieler = ablaufSpieler(el, { m: m, lay: lay, routen: routen, szene: szene, analyse: () => analyse, live: live, fl: () => fl });

    // Textliste
    if (opt.textliste) el.appendChild(textliste(m, ix, (id) => { waehlen(id); if (szene.elG[id]) szene.elG[id].focus(); }));
    el.appendChild(live);

    steckbriefLeer();
    m.elemente.forEach((e) => { if (e.zustand === "ausfall") ausfall.add(e.id); if (e.zustand === "langsam") manuellLangsam.add(e.id); });
    analysieren();
    zustaendeZeichnen();
    if (ausfall.size) ausfallBericht();
    formelnSetzen(el);

    return {
      ablaufStarten: (id) => (spieler ? spieler.starten(id) : false),
      setzeZustand: (id, z) => {
        if (!nachId[id]) return fehler("diagramm", "setzeZustand: Element «" + id + "» unbekannt.");
        ausfall.delete(id); manuellLangsam.delete(id);
        nachId[id].zustand = z === "neu" ? "neu" : nachId[id].zustand === "neu" ? "ok" : nachId[id].zustand;
        if (z === "ausfall") ausfall.add(id);
        if (z === "langsam") manuellLangsam.add(id);
        analysieren(); zustaendeZeichnen();
        if (ausfall.size || manuellLangsam.size) ausfallBericht(); else if (!gewaehlt) steckbriefLeer();
        return true;
      },
      markiere: (ids) => {
        const s = new Set(ids || []);
        Object.keys(szene.elG).forEach((id) => szene.elG[id].classList.toggle("ar-markiert", s.has(id)));
        Object.keys(szene.kantenG).forEach((id) => szene.kantenG[id].classList.toggle("ar-markiert", s.has(id)));
        svg.classList.toggle("ar-mit-markierung", s.size > 0);
      },
      waehle: (id) => waehlen(id || null),
      modell: () => modellSauber(m),
      // eigene Plakette (Text, z. B. «3 Instanzen», «p95 220 ms») an einem Element oder einer Verbindung
      plakette: (id, html, klasse) => {
        const ziel = szene.elG[id] ? (lay.el[id] || lay.gr[id]) : null;
        const rt = !ziel && routen[id];
        if (!ziel && !rt) return fehler("diagramm", "plakette: «" + id + "» ist weder Element noch Verbindung.");
        plaketteWeg(id);
        const text = ohneTags(html);
        const w = textBreite(text, 11.5, 700) + 14;
        let x, y;
        if (ziel) { x = ziel.x + 4; y = ziel.y - 11; }
        else { const p = punktAuf(rt.punkte, polyLaenge(rt.punkte) * 0.5); x = p[0] - w / 2; y = p[1] + 10; }
        const g = svgEl("g", { transform: "translate(" + f1(x) + " " + f1(y) + ")", "data-plakette": id }, "ar-plakette" + (klasse ? " " + klasse : ""));
        g.innerHTML = '<rect width="' + f1(w) + '" height="20" rx="10"/><text x="' + f1(w / 2) + '" y="14" text-anchor="middle">' + esc(text) + "</text>";
        szene.effekte.appendChild(g);
        plaketten[id] = g;
        return true;
      },
      entfernePlakette: (id) => { if (id === undefined) Object.keys(plaketten).forEach(plaketteWeg); else plaketteWeg(id); },
      // Fluss-Animation einer Verbindung ohne Ablauf: { an: true|false, tempo: 1 = normal, 2 = doppelt so schnell }
      fluss: (kid, o) => {
        const g = szene.kantenG[kid];
        if (!g) return fehler("diagramm", "fluss: Verbindung «" + kid + "» unbekannt.");
        o = o || {};
        const an = o.an !== false;
        g.classList.toggle("ar-fluss", an);
        g.style.setProperty("--ar-fluss-dauer", (0.9 / klemmen(Number(o.tempo) || 1, 0.1, 10)).toFixed(2) + "s");
        return true;
      },
    };
  }

  function textliste(m, ix, zeigen) {
    const d = erzeugen("details", "ar-textliste");
    d.appendChild(erzeugen("summary", null, "Alle Elemente und Verbindungen als Text"));
    const inhalt = erzeugen("div", "ar-textliste-inhalt");
    inhalt.appendChild(erzeugen("h4", null, "Elemente (" + m.elemente.length + ")"));
    const ul = erzeugen("ul");
    m.elemente.forEach((e) => {
      const li = erzeugen("li", klasseVon(e));
      li.innerHTML = '<span class="ar-farbpunkt" aria-hidden="true"></span><span><b>' + e.name + "</b> " + esc(e.stereotyp ? "«" + e.stereotyp + "»" : "") +
        (e.rolle ? ' <span class="hint">· ' + esc(ROLLE[e.rolle].name) + "</span>" : e.uml && istPaketEl(e) ? ' <span class="hint">· Paket</span>' : kategorieVon(e.typ) ? ' <span class="hint">· ' + esc(KAT[kategorieVon(e.typ)].name) + "</span>" : "") +
        ((e.schnittstellen || []).length ? ' <span class="hint">· bietet ' + e.schnittstellen.map((x) => esc(x.name)).join(", ") + "</span>" : "") +
        (e.technologie ? ' <span class="hint">· ' + e.technologie + "</span>" : "") +
        (e.in && ix.nachId[e.in] ? ' <span class="hint">· in ' + ix.nachId[e.in].name + "</span>" : "") + "</span>";
      if (zeigen) {
        const b = knopf("Steckbrief", "ar-klein", { "aria-label": "Steckbrief von " + ohneTags(e.name) + " zeigen" });
        b.addEventListener("click", () => zeigen(e.id));
        li.appendChild(b);
      }
      ul.appendChild(li);
    });
    inhalt.appendChild(ul);
    if (m.verbindungen.length) {
      inhalt.appendChild(erzeugen("h4", null, "Verbindungen (" + m.verbindungen.length + ")"));
      const ul2 = erzeugen("ul");
      m.verbindungen.forEach((v) => {
        const sch = v.nachSch ? (ix.nachId[v.nach].schnittstellen || []).find((x) => x.id === v.nachSch) : null;
        ul2.appendChild(erzeugen("li", null, "<span><b>" + ix.nachId[v.von].name + "</b> " + ART_VERB[v.art][0] + " <b>" + ix.nachId[v.nach].name + "</b>" + (sch ? " über die Schnittstelle «" + esc(sch.name) + "»" : "") +
          ' <span class="hint">· ' + esc(ARTEN[v.art].name) + (v.label ? " · " + esc(ohneTags(v.label)) : "") + "</span></span>"));
      });
      inhalt.appendChild(ul2);
    }
    (m.ablaeufe || []).forEach((a) => {
      inhalt.appendChild(erzeugen("h4", null, "Ablauf: " + esc(a.name)));
      const ol = erzeugen("ol");
      a.schritte.forEach((s) => {
        const wer = s.bei ? ix.nachId[s.bei].name : ix.nachId[s.von].name + " → " + ix.nachId[s.nach].name;
        ol.appendChild(erzeugen("li", s.fehler ? "ar-tl-fehler" : null, (s.fehler ? "⚡ " : "") + "<b>" + wer + "</b>: " + s.text));
      });
      inhalt.appendChild(ol);
    });
    d.appendChild(inhalt);
    return d;
  }

  /* ---------- 11. Ablauf-Abspieler ---------- */

  function ablaufSpieler(el, ctx) {
    const m = ctx.m, lay = ctx.lay, routen = ctx.routen, szene = ctx.szene, live = ctx.live;
    const nachId = lay.ix.nachId;
    const name = (id) => ohneTags(nachId[id].name);
    const svg = szene.welt.ownerSVGElement;

    const wrap = erzeugen("div", "ar-spieler");
    const kopf = erzeugen("div", "ar-spieler-kopf");
    kopf.appendChild(erzeugen("span", "ar-spieler-titel", '<span aria-hidden="true">▶</span> Abläufe'));
    const wahl = erzeugen("div", "ar-ablauf-wahl");
    wahl.setAttribute("role", "group");
    wahl.setAttribute("aria-label", "Ablauf wählen");
    kopf.appendChild(wahl);
    const phasen = erzeugen("div", "ar-phasen");
    phasen.setAttribute("aria-hidden", "true");
    const box = erzeugen("div", "ar-schritt");
    const boxKopf = erzeugen("div", "ar-schritt-kopf");
    const nr = erzeugen("span", "ar-schritt-nr");
    const artChip = erzeugen("span", "ar-schritt-art");
    boxKopf.append(nr, artChip);
    const text = erzeugen("div", "ar-schritt-text");
    text.setAttribute("aria-live", "polite");
    box.append(boxKopf, text);
    const leiste = erzeugen("div", "ar-schritt-leiste");
    leiste.setAttribute("aria-hidden", "true");
    const ctl = erzeugen("div", "ar-spieler-ctl");
    const bZurueck = knopf('<span aria-hidden="true">⏮</span>', "ar-ikon", { "aria-label": "Schritt zurück" });
    const bPlay = knopf('<span aria-hidden="true">▶</span> Abspielen', "primary ar-play");
    const bVor = knopf('<span aria-hidden="true">⏭</span>', "ar-ikon", { "aria-label": "Schritt vor" });
    const bNeu = knopf('<span aria-hidden="true">↺</span>', "ar-ikon", { "aria-label": "Von vorn" });
    const tempoId = neueId("tempo");
    const tempoWrap = erzeugen("label", "ar-tempo", "Tempo ");
    tempoWrap.setAttribute("for", tempoId);
    const tempo = erzeugen("select", "btn");
    tempo.id = tempoId;
    [["0.6", "langsam"], ["1", "normal"], ["1.7", "schnell"]].forEach(([v, t]) => { const o = erzeugen("option", null, t); o.value = v; if (v === "1") o.selected = true; tempo.appendChild(o); });
    tempoWrap.appendChild(tempo);
    ctl.append(bZurueck, bPlay, bVor, bNeu, tempoWrap);
    wrap.append(kopf, phasen, box, leiste, ctl);
    el.appendChild(wrap);

    let aktA = 0, takte = [], pos = 0, spielt = false, timer = null, rafs = [], generation = 0;
    const geister = {};
    const wahlKnoepfe = m.ablaeufe.map((a, i) => {
      const b = knopf(esc(a.name), "ar-chip", { "aria-pressed": String(i === 0) });
      b.addEventListener("click", () => { waehle(i); });
      wahl.appendChild(b);
      return b;
    });

    function taktBilden(a) {
      const t = [];
      a.schritte.forEach((s) => { if (s.parallel && t.length) t[t.length - 1].push(s); else t.push([s]); });
      return t;
    }
    function kanteFuer(s) {
      let k = m.verbindungen.find((v) => v.von === s.von && v.nach === s.nach);
      if (k) return { k: k, rueck: false };
      k = m.verbindungen.find((v) => v.von === s.nach && v.nach === s.von);
      return k ? { k: k, rueck: true } : null;
    }
    function geisterBerechnen() {
      const fehlend = [];
      m.ablaeufe.forEach((a) => a.schritte.forEach((s) => {
        if (s.bei || kanteFuer(s)) return;
        const id = "g-" + s.von + "-" + s.nach;
        if (!fehlend.some((x) => x.id === id)) fehlend.push({ id: id, von: s.von, nach: s.nach, art: s.art || "sync" });
      }));
      if (!fehlend.length) return;
      const r = kantenRouten(lay, fehlend);
      Object.keys(r).forEach((id) => (geister[id] = r[id].punkte));
    }
    geisterBerechnen();

    function aufraeumen() {
      generation++;
      clearTimeout(timer);
      rafs.forEach((x) => cancelAnimationFrame(x));
      rafs = [];
      szene.effekte.innerHTML = "";
      Object.keys(szene.elG).forEach((id) => {
        szene.elG[id].classList.remove("ar-aktiv", "ar-besucht", "ar-blink");
        markenLeeren(szene.elG[id], "ar-ev");
      });
      Object.keys(szene.kantenG).forEach((id) => {
        szene.kantenG[id].classList.remove("ar-aktiv", "ar-besucht", "ar-rueck");
        if (szene.labelG[id]) szene.labelG[id].classList.remove("ar-aktiv");
      });
    }
    function punktBewegen(punkte, kat, art, opt) {
      return new Promise((fertig) => {
        const meinGen = generation;
        const g = svgEl("g", null, "ar-punkt ar-k-" + (kat || "neutral") + " ar-punkt-" + art + (opt.klasse ? " " + opt.klasse : ""));
        g.innerHTML = '<circle class="ar-punkt-schweif" r="4"/><circle class="ar-punkt-schweif2" r="3"/><circle class="ar-punkt-hof" r="11"/><circle class="ar-punkt-kern" r="5.5"/>';
        szene.effekte.appendChild(g);
        const L = polyLaenge(punkte);
        const bis = opt.stopp === undefined ? 1 : opt.stopp;
        const setze = (d) => {
          const p = punktAuf(punkte, d);
          const s1 = punktAuf(punkte, Math.max(0, d - 10)), s2 = punktAuf(punkte, Math.max(0, d - 19));
          g.children[0].setAttribute("cx", f1(s1[0])); g.children[0].setAttribute("cy", f1(s1[1]));
          g.children[1].setAttribute("cx", f1(s2[0])); g.children[1].setAttribute("cy", f1(s2[1]));
          g.children[2].setAttribute("cx", f1(p[0])); g.children[2].setAttribute("cy", f1(p[1]));
          g.children[3].setAttribute("cx", f1(p[0])); g.children[3].setAttribute("cy", f1(p[1]));
        };
        if (wenigerBewegung() || opt.sofort) {
          setze(L * bis);
          g.classList.add("ar-angekommen");
          fertig();
          return;
        }
        const dauer = klemmen(L * 2.3, 650, 1800) / Number(tempo.value || 1);
        const t0 = performance.now();
        const schritt = (jetzt) => {
          if (meinGen !== generation) return fertig();
          let t = Math.min(1, (jetzt - t0) / dauer);
          const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
          setze(L * bis * e);
          if (t < 1) rafs.push(requestAnimationFrame(schritt));
          else { g.classList.add("ar-angekommen"); fertig(); }
        };
        setze(0);
        rafs.push(requestAnimationFrame(schritt));
      });
    }
    function zeigeTakt(n, animiert) {
      aufraeumen();
      pos = n;
      const a = m.ablaeufe[aktA];
      const N = takte.length;
      svg.classList.toggle("ar-ablauf-an", n > 0);
      // Leiste
      $$("i", leiste).forEach((x, i) => { x.classList.toggle("ar-fertig", i < n - 1); x.classList.toggle("ar-jetzt", i === n - 1); });
      bZurueck.disabled = n <= 0;
      bVor.disabled = n >= N;
      if (n === 0) {
        nr.textContent = "Bereit · " + N + (N === 1 ? " Schritt" : " Schritte");
        artChip.textContent = "";
        artChip.className = "ar-schritt-art";
        text.innerHTML = "<p>" + (a.beschreibung || "Drück auf <b>Abspielen</b>: Nachrichten wandern als leuchtende Punkte über die Verbindungen. Mit <b>Vor</b> und <b>Zurück</b> gehst du Schritt für Schritt.") + "</p>";
        phasenZeigen(null);
        formelnSetzen(text);
        return Promise.resolve();
      }
      // frühere Takte: besucht
      for (let i = 0; i < n - 1; i++) takte[i].forEach((s) => {
        const kf = s.bei ? null : kanteFuer(s);
        if (kf) szene.kantenG[kf.k.id] && szene.kantenG[kf.k.id].classList.add("ar-besucht");
        [s.von, s.nach, s.bei].forEach((id) => id && szene.elG[id] && szene.elG[id].classList.add("ar-besucht"));
      });
      const takt = takte[n - 1];
      const an = ctx.analyse();
      nr.textContent = "Schritt " + n + " von " + N + (takt.length > 1 ? " · " + takt.length + " gleichzeitig" : "");
      phasenZeigen(takt[0].phase || letztePhase(n));
      const teile = [];
      const versprechen = [];
      takt.forEach((s) => {
        let zusatz = "";
        if (s.bei) {
          const g = szene.elG[s.bei];
          if (g) {
            g.classList.add("ar-aktiv");
            if (s.fehler) {
              g.classList.remove("ar-blink"); void g.getBoundingClientRect(); g.classList.add("ar-blink");
              marke(g, lay.el[s.bei] || lay.gr[s.bei], "⚡", "ar-ev ar-marke-fehler", "Fehler");
            }
          }
          teile.push({ s: s, zusatz: "" });
          return;
        }
        const kf = kanteFuer(s);
        const art = s.art || (kf ? kf.k.art : "sync");
        let punkte = kf ? (kf.rueck ? routen[kf.k.id].punkte.slice().reverse() : routen[kf.k.id].punkte) : geister["g-" + s.von + "-" + s.nach];
        if (kf && szene.kantenG[kf.k.id]) {
          szene.kantenG[kf.k.id].classList.add("ar-aktiv");
          if (kf.rueck) szene.kantenG[kf.k.id].classList.add("ar-rueck");
          if (szene.labelG[kf.k.id]) szene.labelG[kf.k.id].classList.add("ar-aktiv");
        }
        if (!kf && punkte) {
          const gp = svgEl("path", { d: pfadD(punkte, 7) }, "ar-geist ar-art-" + art);
          szene.effekte.appendChild(gp);
        }
        [s.von, s.nach].forEach((id) => szene.elG[id] && szene.elG[id].classList.add("ar-aktiv"));
        const kat = kategorieVon(nachId[s.nach].typ);
        let stopp = 1, klasse = "";
        if (an.aus.has(s.von)) {
          zusatz = '<span class="ar-zusatz ar-zusatz-fehler">⚡ «' + esc(name(s.von)) + "» ist ausgefallen: Dieser Schritt findet nicht statt.</span>";
          punkte = null;
        } else if (an.aus.has(s.nach)) {
          const pufferSchritt = (art === "async" || art === "assoziation") && istPufferEl(nachId[s.von]);
          if (pufferSchritt) {
            stopp = 0.22; klasse = "ar-punkt-wartet";
            zusatz = '<span class="ar-zusatz ar-zusatz-stau">▤ «' + esc(name(s.nach)) + "» ist ausgefallen. Die Nachricht bleibt im Broker liegen und wird nachgeliefert, sobald der Empfänger wieder läuft.</span>";
          } else {
            stopp = 0.82; klasse = "ar-punkt-fehler";
            zusatz = '<span class="ar-zusatz ar-zusatz-fehler">⚡ «' + esc(name(s.nach)) + "» ist ausgefallen: " + (art === "async" ? "Die Nachricht geht ohne Puffer verloren." : "keine Antwort. Der Aufrufer wartet bis zum Timeout.") + "</span>";
            const g = szene.elG[s.nach];
            if (g) marke(g, lay.el[s.nach] || lay.gr[s.nach], "⚡", "ar-ev ar-marke-fehler", "keine Antwort");
          }
        } else if (s.fehler) {
          stopp = 0.82; klasse = "ar-punkt-fehler";
          const g = szene.elG[s.nach];
          if (g) {
            g.classList.remove("ar-blink"); void g.getBoundingClientRect(); g.classList.add("ar-blink");
            marke(g, lay.el[s.nach] || lay.gr[s.nach], "⚡", "ar-ev ar-marke-fehler", "Fehler");
          }
        }
        if (punkte) versprechen.push(punktBewegen(punkte, kat, art, { stopp: stopp, klasse: klasse, sofort: !animiert }));
        teile.push({ s: s, zusatz: zusatz, art: art });
      });
      const arten = Array.from(new Set(teile.map((t) => t.art).filter(Boolean)));
      artChip.textContent = arten.map((x) => ARTEN[x].kurz).join(" + ");
      artChip.className = "ar-schritt-art" + (arten.length ? " ar-art-chip-" + arten[0] : "");
      text.innerHTML = teile.map((t) => {
        const wer = t.s.bei ? esc(name(t.s.bei)) : esc(name(t.s.von)) + ' <span aria-hidden="true">→</span><span class="sr-only">an</span> ' + esc(name(t.s.nach));
        return '<p class="' + (t.s.fehler ? "ar-schritt-fehler" : "") + '"><span class="ar-wer">' + (t.s.fehler ? '<span aria-hidden="true">⚡ </span>' : "") + wer + "</span> " + t.s.text + (t.zusatz ? " " + t.zusatz : "") + "</p>";
      }).join("") + (n === N ? '<p class="ar-ende">Ende des Ablaufs. <span class="hint">↺ startet ihn von vorn.</span></p>' : "");
      formelnSetzen(text);
      return Promise.all(versprechen).then(() => teile.reduce((s, t) => s + ohneTags(t.s.text).length + ohneTags(t.zusatz).length, 0));
    }
    function letztePhase(n) {
      for (let i = n - 1; i >= 0; i--) { const p = takte[i].find((s) => s.phase); if (p) return p.phase; }
      return null;
    }
    function phasenZeigen(aktiv) {
      const liste = [];
      takte.forEach((t) => t.forEach((s) => { if (s.phase && liste.indexOf(s.phase) < 0) liste.push(s.phase); }));
      phasen.innerHTML = "";
      phasen.hidden = !liste.length;
      const ai = liste.indexOf(aktiv);
      liste.forEach((p, i) => phasen.appendChild(erzeugen("span", "ar-phase" + (i < ai ? " ar-vorbei" : i === ai ? " ar-jetzt" : ""), esc(p))));
    }
    function playText() {
      bPlay.innerHTML = spielt ? '<span aria-hidden="true">⏸</span> Pause' : pos >= takte.length && pos > 0 ? '<span aria-hidden="true">↺</span> Nochmals' : '<span aria-hidden="true">▶</span> Abspielen';
    }
    function weiter() {
      if (!spielt) return;
      if (pos >= takte.length) { spielt = false; playText(); live.textContent = "Ablauf zu Ende."; return; }
      const meinGen = generation + 1;
      zeigeTakt(pos + 1, true).then((zeichen) => {
        if (!spielt || generation !== meinGen) return;
        const warte = (wenigerBewegung() ? 2600 : Math.max(1500, zeichen * 42)) / Number(tempo.value || 1);
        timer = setTimeout(weiter, warte);
      });
      playText();
    }
    function abspielen() {
      if (pos >= takte.length) zeigeTakt(0, false);
      spielt = true;
      playText();
      weiter();
    }
    function pause() { spielt = false; clearTimeout(timer); playText(); }
    function waehle(i) {
      pause();
      aktA = i;
      takte = taktBilden(m.ablaeufe[i]);
      wahlKnoepfe.forEach((b, j) => { b.setAttribute("aria-pressed", String(i === j)); b.classList.toggle("on", i === j); });
      leiste.innerHTML = takte.map(() => "<i></i>").join("");
      zeigeTakt(0, false);
      playText();
    }
    bPlay.addEventListener("click", () => (spielt ? pause() : abspielen()));
    bVor.addEventListener("click", () => { pause(); if (pos < takte.length) zeigeTakt(pos + 1, true); playText(); if (bVor.disabled) bZurueck.focus(); });
    bZurueck.addEventListener("click", () => { pause(); if (pos > 0) zeigeTakt(pos - 1, false); playText(); if (bZurueck.disabled) bVor.focus(); });
    bNeu.addEventListener("click", () => { pause(); zeigeTakt(0, false); playText(); });
    waehle(0);
    return {
      starten: (id) => {
        const i = m.ablaeufe.findIndex((a) => a.id === id);
        if (i < 0) { fehler("diagramm", "Ablauf «" + id + "» unbekannt."); return false; }
        waehle(i);
        abspielen();
        return true;
      },
    };
  }

  /* ---------- 12. Atlas der Architekturstile ---------- */

  // deterministischer Zufall (gleiche Karte bei jedem Laden)
  function zufall(saat) {
    let h = 2166136261;
    for (let i = 0; i < saat.length; i++) { h ^= saat.charCodeAt(i); h = Math.imul(h, 16777619); }
    return () => { h += 0x6d2b79f5; let t = h; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  // geschlossene, weiche Form (Catmull-Rom → Bézier)
  function weicheForm(pkte) {
    const n = pkte.length;
    let d = "M" + f1(pkte[0][0]) + " " + f1(pkte[0][1]);
    for (let i = 0; i < n; i++) {
      const p0 = pkte[(i - 1 + n) % n], p1 = pkte[i], p2 = pkte[(i + 1) % n], p3 = pkte[(i + 2) % n];
      const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
      const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
      d += "C" + f1(c1[0]) + " " + f1(c1[1]) + " " + f1(c2[0]) + " " + f1(c2[1]) + " " + f1(p2[0]) + " " + f1(p2[1]);
    }
    return d + "Z";
  }
  function regionPfad(cx, cy, a, b, rnd) {
    const pkte = [];
    const N = 22;
    for (let i = 0; i < N; i++) {
      const w = (i / N) * Math.PI * 2;
      const c = Math.cos(w), s = Math.sin(w);
      // Superellipse (abgerundetes Rechteck) mit leichter Unruhe wie eine Küste
      const r = 1 + (rnd() - 0.5) * 0.09;
      const x = Math.sign(c) * Math.pow(Math.abs(c), 2 / 3.2) * a * r;
      const y = Math.sign(s) * Math.pow(Math.abs(s), 2 / 3.2) * b * r;
      pkte.push([cx + x, cy + y]);
    }
    return weicheForm(pkte);
  }

  const FILTER_GRUPPEN = [
    { feld: "kopplung", name: "Kopplung" },
    { feld: "kommunikation", name: "Kommunikation" },
    { feld: "einsatz", name: "Einsatz" },
  ];

  function atlas(el, katalog, opt) {
    el = elementHolen(el, "atlas");
    if (!el) return null;
    opt = opt || {};
    if (!katalog || !Array.isArray(katalog.familien) || !Array.isArray(katalog.stile) || !katalog.stile.length) return fehler("atlas", "Katalog braucht «familien» und «stile».");
    const fam = {};
    for (const f of katalog.familien) {
      if (!f.id || !f.name) return fehler("atlas", "Jede Familie braucht «id» und «name».");
      if (f.farbe && !KAT[f.farbe]) fehler("atlas", "Familie «" + f.id + "»: Farbe «" + f.farbe + "» ist keine Kategorie (" + Object.keys(KAT).join(", ") + ").");
      fam[f.id] = { f: f, stile: [] };
    }
    const stilNach = {};
    for (const s of katalog.stile) {
      if (!s.id || !s.name) return fehler("atlas", "Jeder Stil braucht «id» und «name».");
      if (stilNach[s.id]) return fehler("atlas", "Stil-ID «" + s.id + "» doppelt.");
      if (!fam[s.familie]) return fehler("atlas", "Stil «" + s.id + "»: Familie «" + s.familie + "» unbekannt.");
      stilNach[s.id] = s;
      fam[s.familie].stile.push(s);
    }
    katalog.stile.forEach((s) => (s.verwandt || []).forEach((v) => { if (!stilNach[v]) fehler("atlas", "Stil «" + s.id + "»: verwandter Stil «" + v + "» unbekannt."); }));
    const famListe = katalog.familien.filter((f) => fam[f.id].stile.length);
    const farbe = (s) => (fam[s.familie].f.farbe && KAT[fam[s.familie].f.farbe] ? fam[s.familie].f.farbe : "infrastruktur");
    const symbolVon = (s) => {
      if (s.symbol && TYPEN[s.symbol]) return TYPEN[s.symbol].pikto;
      const els = s.modell && Array.isArray(s.modell.elemente) ? s.modell.elemente : [];
      // das kennzeichnendste Element des Modells
      const rang = ["bus", "peer", "filter", "plugin", "mesh", "funktion", "topic", "broker", "queue", "orchestrator", "gateway", "schnittstelle", "monolith", "cache", "suche", "dienst", "web"];
      for (const t of rang) if (els.some((x) => x.typ === t)) return TYPEN[t].pikto;
      return "service";
    };

    el.innerHTML = "";
    el.classList.add("ar-atlas");
    if (opt.breit !== false) el.classList.add("ar-weit");
    const live = ansage();
    const besucht = new Set();

    // Kopf: Titel und «Entdeckt»
    const kopf = erzeugen("div", "ar-atlas-kopf");
    const kopfText = erzeugen("div", "ar-atlas-titelblock");
    kopfText.appendChild(erzeugen("p", "ar-atlas-ueber", "Interaktive Landkarte"));
    kopfText.appendChild(erzeugen("h3", "ar-atlas-titel", opt.titel || "Atlas der Architekturstile"));
    const entdeckt = erzeugen("div", "ar-entdeckt");
    entdeckt.innerHTML = '<svg class="ar-fring" viewBox="0 0 44 44" aria-hidden="true"><circle class="ar-ring-grund" cx="22" cy="22" r="18"/><circle class="ar-ring-wert" cx="22" cy="22" r="18" pathLength="100" stroke-dasharray="0 100" transform="rotate(-90 22 22)"/></svg><div><span class="ar-entdeckt-zahl">0 / ' + katalog.stile.length + '</span><span class="ar-entdeckt-text">Stile entdeckt</span></div>';
    kopf.append(kopfText, entdeckt);

    // Filter
    const filterWahl = { kopplung: new Set(), kommunikation: new Set(), einsatz: new Set() };
    const filter = erzeugen("div", "ar-filter");
    FILTER_GRUPPEN.forEach((fg) => {
      const werte = [];
      katalog.stile.forEach((s) => [].concat(s[fg.feld] || []).forEach((w) => { if (w && werte.indexOf(w) < 0) werte.push(w); }));
      if (!werte.length) return;
      const g = erzeugen("div", "ar-filter-gruppe");
      g.setAttribute("role", "group");
      g.setAttribute("aria-label", "Filter " + fg.name);
      g.appendChild(erzeugen("span", "ar-filter-name", fg.name));
      werte.forEach((w) => {
        const b = knopf(esc(w), "ar-chip ar-filter-chip", { "aria-pressed": "false" });
        b.addEventListener("click", () => {
          const set = filterWahl[fg.feld];
          if (set.has(w)) set.delete(w); else set.add(w);
          b.setAttribute("aria-pressed", String(set.has(w)));
          filtern();
        });
        g.appendChild(b);
      });
      filter.appendChild(g);
    });
    const filterStand = erzeugen("p", "ar-filter-stand");
    filterStand.setAttribute("aria-live", "polite");
    const filterReset = knopf("Filter zurücksetzen", "ar-klein");
    filterReset.hidden = true;
    const filterFuss = erzeugen("div", "ar-filter-fuss");
    filterFuss.append(filterStand, filterReset);
    filter.appendChild(filterFuss);

    // Karte berechnen
    const SX = 172, SY = 122;
    const nf = famListe.length;
    const spalten = nf <= 2 ? nf : nf <= 4 ? 2 : nf <= 6 ? 3 : 4;
    const regionen = famListe.map((f, i) => {
      const n = fam[f.id].stile.length;
      const sc = n <= 1 ? 1 : n <= 4 ? 2 : 3;
      const sr = Math.ceil(n / sc);
      return { f: f, n: n, sc: sc, sr: sr, w: sc * SX + 56, h: sr * SY + 84, col: i % spalten, row: Math.floor(i / spalten) };
    });
    const zeilen = Math.ceil(regionen.length / spalten);
    const colW = [], rowH = [];
    regionen.forEach((r) => { colW[r.col] = Math.max(colW[r.col] || 0, r.w); rowH[r.row] = Math.max(rowH[r.row] || 0, r.h); });
    const GAP = 40, RAND = 40;
    const colX = [], rowY = [];
    let acc = RAND; for (let c = 0; c < spalten; c++) { colX[c] = acc; acc += colW[c] + GAP; }
    const breiteKarte = acc - GAP + RAND;
    acc = RAND + 26; for (let r = 0; r < zeilen; r++) { rowY[r] = acc; acc += rowH[r] + GAP; }
    const hoeheKarte = acc - GAP + RAND + 30;
    const ort = {};
    regionen.forEach((r) => {
      const versatz = r.col % 2 === 1 ? 22 : 0;
      r.cx = colX[r.col] + colW[r.col] / 2;
      r.cy = rowY[r.row] + rowH[r.row] / 2 + versatz;
      const rnd = zufall(r.f.id);
      fam[r.f.id].stile.forEach((s, i) => {
        const c = i % r.sc, z = Math.floor(i / r.sc);
        const inZeile = Math.min(r.sc, r.n - z * r.sc);
        const x0 = r.cx - ((inZeile - 1) * SX) / 2;
        ort[s.id] = { x: x0 + c * SX + (rnd() - 0.5) * 18, y: r.cy - ((r.sr - 1) * SY) / 2 + z * SY + 8 + (rnd() - 0.5) * 12, s: s, r: r };
      });
    });

    const karteWrap = erzeugen("div", "ar-karte-wrap");
    const rahmen = erzeugen("div", "ar-viewport ar-karte");
    rahmen.tabIndex = 0;
    rahmen.setAttribute("role", "group");
    rahmen.setAttribute("aria-label", "Landkarte der Architekturstile. Orte mit Tab erreichen, Enter öffnet den Stil. Auf der Fläche verschieben die Pfeiltasten, Plus und Minus zoomen.");
    const svg = svgEl("svg", { role: "group", "aria-label": "Karte: Familien als Regionen, Stile als Orte, verwandte Stile durch Wege verbunden", preserveAspectRatio: "xMidYMid meet" }, "ar-svg ar-karte-svg");
    const uid = neueId("atlas");
    let s = "<defs>" +
      '<pattern id="' + uid + '-wellen" width="46" height="22" patternUnits="userSpaceOnUse"><path class="ar-welle" d="M2 12q5.5-5 11 0t11 0"/></pattern>' +
      '<pattern id="' + uid + '-gitter" width="120" height="120" patternUnits="userSpaceOnUse"><path class="ar-gradnetz" d="M120 0V120M0 120H120"/></pattern></defs>';
    s += '<rect class="ar-meer" x="-600" y="-600" width="' + (breiteKarte + 1200) + '" height="' + (hoeheKarte + 1200) + '"/>';
    s += '<rect x="-600" y="-600" width="' + (breiteKarte + 1200) + '" height="' + (hoeheKarte + 1200) + '" fill="url(#' + uid + '-gitter)"/>';
    s += '<rect x="-600" y="-600" width="' + (breiteKarte + 1200) + '" height="' + (hoeheKarte + 1200) + '" fill="url(#' + uid + '-wellen)" opacity=".7"/>';
    // Regionen
    let namen = "";
    regionen.forEach((r) => {
      const k = r.f.farbe && KAT[r.f.farbe] ? r.f.farbe : "infrastruktur";
      const rnd = zufall("r" + r.f.id);
      const d = regionPfad(r.cx, r.cy, r.w / 2, r.h / 2, rnd);
      s += '<g class="ar-region ar-k-' + k + '" data-familie="' + esc(r.f.id) + '"><path class="ar-kueste" d="' + d + '"/><path class="ar-land" d="' + d + '"/><path class="ar-land-innen" d="' + d + '" transform="translate(' + f1(r.cx) + " " + f1(r.cy) + ") scale(.93) translate(" + f1(-r.cx) + " " + f1(-r.cy) + ')"/></g>';
      namen += '<text class="ar-region-name ar-k-' + k + '" x="' + f1(r.cx) + '" y="' + f1(r.cy - r.h / 2 + 34) + '" text-anchor="middle">' + esc(String(r.f.name).toUpperCase()) + "</text>";
    });
    // Wege
    const wege = [];
    katalog.stile.forEach((st) => (st.verwandt || []).forEach((v) => {
      if (!stilNach[v] || wege.some((w) => (w.a === st.id && w.b === v) || (w.a === v && w.b === st.id))) return;
      wege.push({ a: st.id, b: v });
    }));
    s += '<g class="ar-wege">';
    wege.forEach((w) => {
      const a = ort[w.a], b = ort[w.b];
      const dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy) || 1;
      const rnd = zufall(w.a + w.b);
      const bog = (rnd() > 0.5 ? 1 : -1) * Math.min(90, l * 0.22);
      const c1 = [a.x + dx * 0.3 - (dy / l) * bog, a.y + dy * 0.3 + (dx / l) * bog];
      const c2 = [a.x + dx * 0.7 - (dy / l) * bog, a.y + dy * 0.7 + (dx / l) * bog];
      const d = "M" + f1(a.x) + " " + f1(a.y) + "C" + f1(c1[0]) + " " + f1(c1[1]) + " " + f1(c2[0]) + " " + f1(c2[1]) + " " + f1(b.x) + " " + f1(b.y);
      s += '<g class="ar-weg" data-a="' + w.a + '" data-b="' + w.b + '"><path class="ar-weg-rand" d="' + d + '"/><path class="ar-weg-linie" d="' + d + '"/></g>';
    });
    s += "</g>" + '<g class="ar-region-namen">' + namen + "</g>";
    // Kompass und Kartentitel
    s += '<g class="ar-kompass" transform="translate(' + (breiteKarte - 58) + ' 58)" aria-hidden="true"><circle r="30"/><path class="ar-kompass-nadel" d="M0 -24L6 0L0 24L-6 0Z"/><path class="ar-kompass-nord" d="M0 -24L6 0H-6Z"/><text y="-34" text-anchor="middle">N</text></g>';
    s += '<g class="ar-kartusche" transform="translate(' + RAND + ' 30)"><text class="ar-kartusche-text">ARCHITEKTUR-ATLAS</text></g>';
    s += '<g class="ar-orte"></g>';
    svg.innerHTML = s;
    rahmen.appendChild(svg);
    const orteG = svg.querySelector(".ar-orte");
    const ortG = {};
    katalog.stile.forEach((st) => {
      const o = ort[st.id];
      const k = farbe(st);
      const g = svgEl("g", { transform: "translate(" + f1(o.x) + " " + f1(o.y) + ")", tabindex: "0", role: "button", "data-id": st.id }, "ar-ort ar-k-" + k);
      const n = umbrechen(ohneTags(st.kurzname || st.name), 16, 650, 164, 2);
      let inner = '<g class="ar-ort-innen"><circle class="ar-ort-schatten" r="27" cy="3"/><circle class="ar-ort-ring" r="27"/><circle class="ar-ort-feld" r="21"/>' + piktoG(symbolVon(st), -11, -11, 22) +
        '<g class="ar-flagge" transform="translate(17 -30)"><path d="M0 0V20"/><path class="ar-flagge-tuch" d="M0 0H14L10 5L14 10H0Z"/></g></g>';
      n.zeilen.forEach((z, i) => (inner += '<text class="ar-ort-name" y="' + (49 + i * 18) + '" text-anchor="middle" style="font-size:' + n.px + 'px">' + esc(z) + "</text>"));
      g.innerHTML = inner;
      g.setAttribute("aria-label", ohneTags(st.name) + ", Familie " + ohneTags(fam[st.familie].f.name) + (st.kopplung ? ", Kopplung " + st.kopplung : "") + (st.kommunikation ? ", " + st.kommunikation : ""));
      g.addEventListener("click", (ev) => { ev.stopPropagation(); zeigeStil(st.id); });
      g.addEventListener("keydown", (ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); zeigeStil(st.id); } });
      const wegeAn = (an) => wegeZeigen(an ? st.id : letzterOrt);
      g.addEventListener("pointerenter", () => wegeAn(true));
      g.addEventListener("pointerleave", () => wegeAn(false));
      g.addEventListener("focus", () => { wegeAn(true); fk.zeige({ x: o.x - 80, y: o.y - 40, w: 160, h: 100 }); });
      g.addEventListener("blur", () => wegeAn(false));
      orteG.appendChild(g);
      ortG[st.id] = g;
    });
    // Wege: standardmässig ausgeblendet; Hover, Fokus oder zuletzt geöffneter Ort zeigt nur dessen Wege in Familienfarbe
    let letzterOrt = null;
    function wegeZeigen(id) {
      const k = id && stilNach[id] ? farbe(stilNach[id]) : null;
      $$(".ar-weg", svg).forEach((w) => {
        const an = !!id && (w.dataset.a === id || w.dataset.b === id);
        w.classList.toggle("ar-weg-an", an);
        KATEGORIEN.forEach((x) => w.classList.remove("ar-k-" + x.id));
        if (an) w.classList.add("ar-k-" + k);
      });
      svg.querySelector(".ar-wege").classList.toggle("ar-hat-fokus", !!id);
      Object.keys(ortG).forEach((oid) => ortG[oid].classList.toggle("ar-verwandt-an", !!id && oid !== id && (stilNach[id].verwandt || []).concat(katalog.stile.filter((x) => (x.verwandt || []).indexOf(id) >= 0).map((x) => x.id)).indexOf(oid) >= 0));
    }
    const karteKopf = erzeugen("div", "ar-karte-leiste");
    let fk = null;
    const alleWege = knopf('<svg class="ar-muster" viewBox="0 0 30 12" aria-hidden="true"><path d="M2 9C10 1 20 1 28 9" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="3 3"/></svg>Alle Verwandtschaften zeigen', "ar-chip ar-alle-wege", { "aria-pressed": "false" });
    alleWege.addEventListener("click", () => {
      const an = alleWege.getAttribute("aria-pressed") !== "true";
      alleWege.setAttribute("aria-pressed", String(an));
      svg.querySelector(".ar-wege").classList.toggle("ar-alle", an);
      live.textContent = an ? "Alle Verwandtschaften sind eingeblendet." : "Verwandtschaften nur beim gewählten Ort.";
    });
    const legende = erzeugen("div", "ar-karte-legende");
    legende.innerHTML = famListe.map((f) => '<span class="ar-k-' + (f.farbe && KAT[f.farbe] ? f.farbe : "infrastruktur") + '"><span class="ar-farbpunkt" aria-hidden="true"></span>' + esc(f.name) + "</span>").join("") +
      '<span class="ar-legende-weg"><svg viewBox="0 0 30 10" aria-hidden="true"><path d="M2 8C10 2 20 2 28 8"/></svg>verwandt (Ort antippen oder Schalter)</span><span class="ar-legende-flagge"><svg viewBox="0 0 14 14" aria-hidden="true"><path d="M3 1V13M3 1H12L9 4.5L12 8H3"/></svg>entdeckt</span>';
    const karteKnoepfe = erzeugen("div", "ar-karte-knoepfe");
    karteKnoepfe.append(alleWege, zoomLeiste(() => fk, "Karte zoomen"));
    karteKopf.append(legende, karteKnoepfe);
    karteWrap.append(rahmen, karteKopf);

    // Liste aller Orte (auch für Screenreader und schmale Bildschirme)
    const liste = erzeugen("div", "ar-orte-liste");
    famListe.forEach((f) => {
      const k = f.farbe && KAT[f.farbe] ? f.farbe : "infrastruktur";
      const gr = erzeugen("div", "ar-orte-gruppe ar-k-" + k);
      gr.appendChild(erzeugen("p", "ar-orte-familie", '<span class="ar-farbpunkt" aria-hidden="true"></span>' + esc(f.name)));
      const ul = erzeugen("ul");
      fam[f.id].stile.forEach((st) => {
        const li = erzeugen("li");
        const b = knopf(piktoSvg(symbolVon(st)) + '<span class="ar-ort-knopf-text"><span class="ar-ort-knopf-name">' + st.name + '</span><span class="ar-ort-knopf-kurz">' + (st.kurz || "") + '</span></span><span class="ar-ort-check" aria-hidden="true"></span>', "ar-ort-knopf");
        b.dataset.id = st.id;
        b.addEventListener("click", () => zeigeStil(st.id));
        li.appendChild(b);
        ul.appendChild(li);
      });
      gr.appendChild(ul);
      liste.appendChild(gr);
    });

    const uebersicht = erzeugen("div", "ar-uebersicht");
    uebersicht.append(filter, karteWrap, liste);
    const detail = erzeugen("div", "ar-detail");
    detail.hidden = true;
    el.append(kopf, uebersicht, detail, live);
    fk = zoomFlaeche(rahmen, svg, { inhalt: { x: 0, y: 0, w: breiteKarte, h: hoeheKarte }, kMin: 0.55, kMax: 1.2, maxHoehe: 760 });

    function filtern() {
      let n = 0;
      const aktiv = Object.keys(filterWahl).some((k) => filterWahl[k].size);
      katalog.stile.forEach((st) => {
        const passt = Object.keys(filterWahl).every((f) => {
          const set = filterWahl[f];
          if (!set.size) return true;
          return [].concat(st[f] || []).some((w) => set.has(w));
        });
        if (passt) n++;
        const g = ortG[st.id];
        g.classList.toggle("ar-ausgeblendet", !passt);
        g.setAttribute("tabindex", passt ? "0" : "-1");
        if (passt) g.removeAttribute("aria-hidden"); else g.setAttribute("aria-hidden", "true");
        const b = $('.ar-ort-knopf[data-id="' + st.id + '"]', liste);
        if (b) b.closest("li").hidden = !passt;
      });
      $$(".ar-weg", svg).forEach((w) => w.classList.toggle("ar-ausgeblendet", ortG[w.dataset.a].classList.contains("ar-ausgeblendet") || ortG[w.dataset.b].classList.contains("ar-ausgeblendet")));
      filterStand.textContent = aktiv ? n + " von " + katalog.stile.length + " Stilen passen zum Filter." : katalog.stile.length + " Stile in " + famListe.length + " Familien.";
      filterReset.hidden = !aktiv;
    }
    filterReset.addEventListener("click", () => {
      Object.keys(filterWahl).forEach((k) => filterWahl[k].clear());
      $$(".ar-filter-chip", filter).forEach((b) => b.setAttribute("aria-pressed", "false"));
      filtern();
      const erster = $(".ar-filter-chip", filter);
      if (erster) erster.focus();
    });

    function entdecktZeigen(neu) {
      const n = besucht.size, N = katalog.stile.length;
      $(".ar-entdeckt-zahl", entdeckt).textContent = n + " / " + N;
      $(".ar-ring-wert", entdeckt).setAttribute("stroke-dasharray", Math.round((n / N) * 100) + " 100");
      entdeckt.classList.toggle("ar-komplett", n === N);
      Object.keys(ortG).forEach((id) => ortG[id].classList.toggle("ar-besucht", besucht.has(id)));
      $$(".ar-ort-knopf", liste).forEach((b) => b.classList.toggle("ar-besucht", besucht.has(b.dataset.id)));
      if (neu) {
        entdeckt.classList.remove("ar-puls"); void entdeckt.offsetWidth; entdeckt.classList.add("ar-puls");
        const famFertig = famListe.filter((f) => fam[f.id].stile.every((st) => besucht.has(st.id)));
        let t = "Neu entdeckt: " + ohneTags(stilNach[neu].name) + ". " + n + " von " + N + " Stilen.";
        const f = fam[stilNach[neu].familie];
        if (f.stile.every((st) => besucht.has(st.id)) && f.stile.length > 1) t += " Region «" + ohneTags(f.f.name) + "» vollständig erkundet!";
        if (n === N) t += " Du hast den ganzen Atlas entdeckt!";
        else if (famFertig.length === famListe.length) t += " Alle Regionen besucht!";
        live.textContent = t;
      }
    }

    let aktStil = null;
    let vonOrt = null;
    function stilKopf(st) {
      const k = farbe(st);
      const chips = [];
      if (st.kopplung) chips.push("Kopplung: " + esc(st.kopplung));
      if (st.kommunikation) chips.push("Kommunikation: " + esc(st.kommunikation));
      if (st.jahr) chips.push("seit etwa " + esc(st.jahr));
      [].concat(st.einsatz || []).forEach((x) => chips.push(esc(x)));
      return '<div class="ar-detail-kopf ar-k-' + k + '"><span class="ar-detail-ikon">' + piktoSvg(symbolVon(st)) + '</span><div class="ar-detail-titel">' +
        '<p class="ar-detail-familie">' + esc(ohneTags(fam[st.familie].f.name)) + '</p><h3 tabindex="-1">' + st.name + "</h3>" + (st.kurz ? '<p class="ar-detail-kurz">' + st.kurz + "</p>" : "") +
        '<p class="ar-detail-chips">' + chips.map((c) => '<span class="ar-chip-info">' + c + "</span>").join("") + "</p></div></div>";
    }
    const liEl = (arr, kl) => (arr && arr.length ? '<ul class="ar-punkte ' + (kl || "") + '">' + arr.map((x) => "<li>" + x + "</li>").join("") + "</ul>" : '<p class="hint">Keine Angaben.</p>');
    const TABS = [
      { id: "kann", name: "Was es kann", html: (st) => liEl(st.kann) },
      { id: "wofuer", name: "Wofür", html: (st) => liEl(st.wofuer) },
      { id: "tech", name: "Technologien und warum", html: (st) => (st.technologien && st.technologien.length ? '<div class="ar-tech-liste">' + st.technologien.map((t) => '<div class="ar-tech"><p class="ar-tech-name">' + t.name + '</p><p class="ar-tech-warum">' + (t.warum || "") + "</p></div>").join("") + "</div>" : '<p class="hint">Keine Angaben.</p>') },
      { id: "sw", name: "Stärken und Schwächen", html: (st) => '<div class="ar-zwei"><div class="ar-plus"><p class="ar-zwei-titel"><span aria-hidden="true">+</span> Stärken</p>' + liEl(st.staerken) + '</div><div class="ar-minus"><p class="ar-zwei-titel"><span aria-hidden="true">−</span> Schwächen</p>' + liEl(st.schwaechen) + "</div></div>" },
      { id: "passt", name: "Passt wenn / nicht", html: (st) => '<div class="ar-zwei"><div class="ar-plus"><p class="ar-zwei-titel"><span aria-hidden="true">✓</span> Passt, wenn …</p>' + liEl(st.passtWenn) + '</div><div class="ar-minus"><p class="ar-zwei-titel"><span aria-hidden="true">✗</span> Passt nicht, wenn …</p>' + liEl(st.passtNichtWenn) + "</div></div>" },
    ];
    function navLeiste(zurueckText, zurueck) {
      const nav = erzeugen("div", "ar-detail-nav");
      const b = knopf('<span aria-hidden="true">←</span> ' + zurueckText, "ar-zurueck");
      b.addEventListener("click", zurueck);
      nav.appendChild(b);
      return { nav: nav, zurueck: b };
    }
    function zeigeStil(id, ohneFokus) {
      const st = stilNach[id];
      if (!st) return fehler("atlas", "Stil «" + id + "» unbekannt.");
      aktStil = id;
      letzterOrt = id;
      if (!vonOrt) vonOrt = id;
      const neu = !besucht.has(id);
      besucht.add(id);
      entdecktZeigen(neu ? id : null);
      uebersicht.hidden = true;
      detail.hidden = false;
      detail.innerHTML = "";
      const { nav } = navLeiste("Zur Karte", karteZeigen);
      const vgl = erzeugen("div", "ar-vergleich-wahl");
      const sid = neueId("vgl");
      vgl.innerHTML = '<label for="' + sid + '">Vergleichen mit</label>';
      const sel = erzeugen("select", "btn");
      sel.id = sid;
      sel.innerHTML = '<option value="">Stil wählen …</option>' + famListe.map((f) => '<optgroup label="' + esc(ohneTags(f.name)) + '">' + fam[f.id].stile.filter((x) => x.id !== id).map((x) => '<option value="' + x.id + '">' + esc(ohneTags(x.name)) + "</option>").join("") + "</optgroup>").join("");
      const bVgl = knopf("Vergleichen", "primary");
      bVgl.addEventListener("click", () => { if (sel.value) vergleiche(id, sel.value); else { live.textContent = "Wähle zuerst einen Stil zum Vergleichen."; sel.focus(); } });
      vgl.append(sel, bVgl);
      nav.appendChild(vgl);
      detail.appendChild(nav);
      detail.insertAdjacentHTML("beforeend", stilKopf(st) + (neu ? '<p class="ar-neu-entdeckt" role="status"><span aria-hidden="true">★</span> Neu entdeckt · ' + besucht.size + " von " + katalog.stile.length + "</p>" : ""));
      if (st.modell) {
        const d = erzeugen("div", "ar-detail-diagramm");
        detail.appendChild(d);
        diagramm(d, st.modell, { breit: false, titel: "" });
      }
      // Reiter
      const tabsWrap = erzeugen("div", "ar-tabs-wrap");
      const tl = erzeugen("div", "ar-tabs");
      tl.setAttribute("role", "tablist");
      tl.setAttribute("aria-label", "Steckbrief " + ohneTags(st.name));
      const panel = erzeugen("div", "ar-tabpanel");
      panel.setAttribute("role", "tabpanel");
      panel.tabIndex = 0;
      const tabs = TABS.map((t, i) => {
        const b = erzeugen("button", "ar-tab", t.name);
        b.type = "button";
        b.id = uid + "-tab-" + t.id;
        b.setAttribute("role", "tab");
        b.setAttribute("aria-selected", String(i === 0));
        b.tabIndex = i === 0 ? 0 : -1;
        b.addEventListener("click", () => tabWahl(i, false));
        b.addEventListener("keydown", (ev) => {
          const n = TABS.length;
          const z = { ArrowRight: (i + 1) % n, ArrowLeft: (i - 1 + n) % n, Home: 0, End: n - 1 }[ev.key];
          if (z !== undefined) { ev.preventDefault(); tabWahl(z, true); }
        });
        tl.appendChild(b);
        return b;
      });
      function tabWahl(i, fokus) {
        tabs.forEach((b, j) => { b.setAttribute("aria-selected", String(i === j)); b.tabIndex = i === j ? 0 : -1; });
        panel.setAttribute("aria-labelledby", tabs[i].id);
        panel.innerHTML = TABS[i].html(st);
        formelnSetzen(panel);
        if (fokus) tabs[i].focus();
      }
      tabsWrap.append(tl, panel);
      detail.appendChild(tabsWrap);
      tabWahl(0, false);
      const verwandt = (st.verwandt || []).filter((v) => stilNach[v]);
      if (verwandt.length) {
        const vw = erzeugen("div", "ar-verwandt");
        vw.appendChild(erzeugen("span", "ar-verwandt-titel", "Verwandte Stile auf der Karte:"));
        verwandt.forEach((v) => {
          const b = knopf(piktoSvg(symbolVon(stilNach[v])) + esc(ohneTags(stilNach[v].name)) + (besucht.has(v) ? "" : ' <span class="ar-neu-marke">neu</span>'), "ar-chip ar-k-" + farbe(stilNach[v]));
          b.addEventListener("click", () => zeigeStil(v));
          vw.appendChild(b);
        });
        detail.appendChild(vw);
      }
      formelnSetzen(detail);
      if (!ohneFokus) { const h = $("h3", detail); if (h) h.focus(); }
      el.scrollIntoView && detail.getBoundingClientRect().top < 0 && el.scrollIntoView({ block: "start", behavior: wenigerBewegung() ? "auto" : "smooth" });
      return true;
    }
    function karteZeigen() {
      detail.hidden = true;
      detail.innerHTML = "";
      uebersicht.hidden = false;
      fk.start();
      wegeZeigen(letzterOrt);
      const ziel = aktStil && ortG[aktStil] && !ortG[aktStil].classList.contains("ar-ausgeblendet") ? ortG[aktStil] : rahmen;
      aktStil = null;
      vonOrt = null;
      ziel.focus();
    }
    function vergleiche(a, b) {
      const A = stilNach[a], B = stilNach[b];
      if (!A || !B) return fehler("atlas", "Vergleich: Stil unbekannt.");
      besucht.add(a);
      const neuB = !besucht.has(b);
      besucht.add(b);
      entdecktZeigen(neuB ? b : null);
      uebersicht.hidden = true;
      detail.hidden = false;
      detail.innerHTML = "";
      const { nav } = navLeiste("Zurück zu " + esc(ohneTags(A.name)), () => zeigeStil(a));
      const zurKarte = knopf("Zur Karte", "ar-klein");
      zurKarte.addEventListener("click", karteZeigen);
      nav.appendChild(zurKarte);
      detail.appendChild(nav);
      const h = erzeugen("h3", "ar-vergleich-titel", A.name + ' <span class="ar-vs">im Vergleich mit</span> ' + B.name);
      h.tabIndex = -1;
      detail.appendChild(h);
      const spalten = erzeugen("div", "ar-vergleich");
      [A, B].forEach((st) => {
        const sp = erzeugen("div", "ar-vergleich-spalte ar-k-" + farbe(st));
        sp.innerHTML = '<p class="ar-vergleich-name"><span class="ar-farbpunkt" aria-hidden="true"></span>' + st.name + "</p>";
        if (st.modell) {
          const d = erzeugen("div");
          sp.appendChild(d);
          diagramm(d, st.modell, { breit: false, titel: "", ablauf: false, ausfall: false, steckbrief: false, legende: false, textliste: true, hoehe: 380, kMin: 0.62 });
        }
        spalten.appendChild(sp);
      });
      detail.appendChild(spalten);
      const zeilen = [
        ["Familie", (s) => esc(ohneTags(fam[s.familie].f.name))],
        ["Kurz", (s) => s.kurz || "–"],
        ["Kopplung", (s) => esc(s.kopplung || "–")],
        ["Kommunikation", (s) => esc(s.kommunikation || "–")],
        ["Seit etwa", (s) => esc(s.jahr || "–")],
        ["Stärken", (s) => liEl(s.staerken)],
        ["Schwächen", (s) => liEl(s.schwaechen)],
        ["Passt, wenn …", (s) => liEl(s.passtWenn)],
        ["Passt nicht, wenn …", (s) => liEl(s.passtNichtWenn)],
        ["Technologien", (s) => (s.technologien || []).map((t) => esc(ohneTags(t.name))).join(", ") || "–"],
      ];
      const tb = erzeugen("div", "tablebox");
      tb.innerHTML = '<table class="tabelle ar-vergleich-tabelle"><caption>Gegenüberstellung</caption><thead><tr><th scope="col">Merkmal</th><th scope="col">' + A.name + '</th><th scope="col">' + B.name + "</th></tr></thead><tbody>" +
        zeilen.map(([t, f]) => '<tr><th scope="row">' + t + "</th><td>" + f(A) + "</td><td>" + f(B) + "</td></tr>").join("") + "</tbody></table>";
      detail.appendChild(tb);
      formelnSetzen(detail);
      h.focus();
      live.textContent = "Vergleich: " + ohneTags(A.name) + " und " + ohneTags(B.name) + ".";
      return true;
    }

    filtern();
    entdecktZeigen(null);
    formelnSetzen(el);
    return {
      zeigeStil: (id) => zeigeStil(id),
      karte: karteZeigen,
      vergleiche: vergleiche,
      entdeckt: () => Array.from(besucht),
    };
  }

  /* ---------- 13. Editor ---------- */

  function vorschauSvg(item) {
    // kleine UML-Vorschau eines Typs für die Palette
    const typ = item.typ;
    const t = TYPEN[typ];
    const e = { id: "v", typ: typ, name: item.name || t.name, stereotyp: item.stereotyp !== undefined ? item.stereotyp : t.stereotyp, technologie: "" };
    let r = groesse(e);
    if (t.gruppe) r = { w: 164, h: 80 };
    let inhalt;
    if (t.gruppe) inhalt = elementMarkup(Object.assign({}, e, { typ: t.form === "knoten" ? "cdn" : "extern" }), r).replace(/«CDN»|«external system»/, "«" + esc(e.stereotyp) + "»");
    else inhalt = elementMarkup(e, r);
    if (typ === "grenze") inhalt = '<rect class="ar-gform ar-grenze" x="2" y="2" width="160" height="70" rx="10"/><text class="ar-name" x="82" y="44" text-anchor="middle">' + esc(ohneTags(e.name)) + "</text>";
    if (typ === "paket") inhalt = '<path class="ar-gform ar-reiter" d="M2 6Q2 2 6 2H60Q64 2 64 6V20H2Z"/><rect class="ar-gform" x="2" y="20" width="160" height="56" rx="3"/><text class="ar-name" x="82" y="54" text-anchor="middle">' + esc(ohneTags(e.name)) + "</text>";
    return '<svg class="ar-vorschau" viewBox="-8 -8 ' + (r.w + 16) + " " + (r.h + 16) + '" aria-hidden="true" focusable="false"><g class="ar-el ' + katKlasse(typ) + " ar-form-" + t.form + '">' + inhalt + "</g></svg>";
  }

  function editor(el, opt) {
    el = elementHolen(el, "editor");
    if (!el) return null;
    opt = opt || {};
    const arten = (opt.arten && opt.arten.length ? opt.arten : ART_IDS).filter((a) => ARTEN[a]);
    const nurVerbinden = opt.nurVerbinden === true;
    const fest = new Set(opt.fest || []);
    // Palette normalisieren
    const palette = [];
    for (const p of opt.palette || []) {
      const it = typeof p === "string" ? { typ: p } : Object.assign({}, p);
      if (!TYPEN[it.typ]) { fehler("editor", "Palette: Typ «" + it.typ + "» unbekannt."); continue; }
      if (it.id && !ID_MUSTER.test(it.id)) { fehler("editor", "Palette: ID «" + it.id + "» ungültig."); continue; }
      it.name = it.name || TYPEN[it.typ].name;
      palette.push(it);
    }
    let m = { titel: "", ansicht: "komponenten", richtung: "unten", elemente: [], verbindungen: [], ablaeufe: [] };
    if (opt.modell) {
      const n = modellPruefen(opt.modell, "editor");
      if (!n) return null;
      m = n;
    }
    const raster = { spalten: (opt.raster && opt.raster.spalten) || 4, zeilen: (opt.raster && opt.raster.zeilen) || 3 };
    const uid = neueId("ed");
    const live = ansage();
    let auswahl = null; // Element-ID
    let kanteWahl = null; // Verbindungs-ID
    let modus = null; // { art: "platzieren", item, c, r } | { art: "verbinden", von }
    let markierungen = []; // [{ ids, klasse }]
    let geister = [];
    const verlauf = [], zukunft = [];

    el.innerHTML = "";
    el.classList.add("ar-editor");
    if (opt.breit) el.classList.add("ar-weit");

    // Werkzeugleiste
    const leiste = erzeugen("div", "ar-ed-leiste");
    leiste.setAttribute("role", "toolbar");
    leiste.setAttribute("aria-label", "Werkzeuge");
    const bVerbinden = knopf('<svg class="pikto" viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="2.5"/><circle cx="19" cy="12" r="2.5"/><path d="M7.5 12h9"/></svg>Verbinden', "", { "aria-pressed": "false" });
    const bLoeschen = knopf('<svg class="pikto" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M10 7V4.5h4V7M7 7l1 13h8l1-13"/></svg>Löschen');
    const bUndo = knopf('<svg class="pikto" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 7L4.5 11.5 9 16"/><path d="M4.5 11.5H15a5 5 0 0 1 0 10h-3"/></svg>Rückgängig', "", { "aria-keyshortcuts": "Control+Z" });
    const bRedo = knopf('<svg class="pikto" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 7l4.5 4.5L15 16"/><path d="M19.5 11.5H9a5 5 0 0 0 0 10h3"/></svg>Wiederholen', "", { "aria-keyshortcuts": "Control+Y" });
    const nameId = neueId("name");
    const nameFeld = erzeugen("span", "ar-ed-name");
    nameFeld.innerHTML = '<label for="' + nameId + '">Name</label><input id="' + nameId + '" type="text" maxlength="40" autocomplete="off">';
    const nameInput = $("input", nameFeld);
    leiste.append(bVerbinden, bLoeschen, nameFeld, bUndo, bRedo);
    const status = erzeugen("p", "ar-ed-status");
    status.setAttribute("aria-live", "polite");

    // Arbeitsfläche
    const arbeit = erzeugen("div", "ar-ed-arbeit" + (nurVerbinden ? " ar-ohne-palette" : ""));
    const pal = erzeugen("div", "ar-ed-palette");
    pal.appendChild(erzeugen("p", "ar-ed-titel", "Bausteine"));
    const palListe = erzeugen("div", "ar-ed-pal-liste");
    palListe.setAttribute("role", "group");
    palListe.setAttribute("aria-label", "Bausteine: antippen und Feld wählen, oder auf die Fläche ziehen");
    pal.appendChild(palListe);
    pal.appendChild(erzeugen("p", "hint ar-ed-pal-hinweis", "Ziehen oder antippen, dann ein Feld wählen. Tastatur: Enter, Pfeiltasten, Enter."));
    if (nurVerbinden) pal.hidden = true;
    const buehne = erzeugen("div", "ar-ed-buehne");
    const rahmen = erzeugen("div", "ar-viewport ar-ed-flaeche");
    rahmen.tabIndex = 0;
    rahmen.setAttribute("role", "group");
    rahmen.setAttribute("aria-label", "Modellierfläche");
    const svg = svgEl("svg", { role: "group", "aria-label": "Modell", preserveAspectRatio: "xMidYMid meet" }, "ar-svg");
    rahmen.appendChild(svg);
    buehne.appendChild(rahmen);
    buehne.appendChild(zoomLeiste(() => fl, "Zoom"));
    const menue = erzeugen("div", "ar-artmenue");
    menue.hidden = true;
    menue.setAttribute("role", "group");
    buehne.appendChild(menue);
    arbeit.append(pal, buehne);
    const listeWrap = erzeugen("details", "ar-ed-liste");
    listeWrap.innerHTML = "<summary>Modell als Liste (Elemente und Verbindungen)</summary>";
    const listeInhalt = erzeugen("div", "ar-ed-liste-inhalt");
    listeWrap.appendChild(listeInhalt);
    el.append(leiste, status, arbeit, listeWrap, live);

    const palKnoepfe = [];
    palette.forEach((it, i) => {
      const b = knopf(vorschauSvg(it) + '<span class="ar-ed-pal-name">' + esc(ohneTags(it.name)) + "</span>", "ar-ed-pal", { "aria-pressed": "false" });
      b.dataset.index = String(i);
      if (it.info) b.title = ohneTags(it.info);
      palListe.appendChild(b);
      palKnoepfe.push(b);
      paletteZiehen(b, it);
      b.addEventListener("click", () => {
        if (b.dataset.gezogen) { delete b.dataset.gezogen; return; }
        if (it.id && m.elemente.some((e) => e.id === it.id)) { waehlen(it.id, true); melden("«" + ohneTags(it.name) + "» liegt schon auf der Fläche (ausgewählt)."); return; }
        platzierenStarten(it);
      });
    });

    let lay = null, szene = null, fl = null, routen = {};
    const zellenZahl = () => {
      let sp = raster.spalten, ze = raster.zeilen;
      m.elemente.forEach((e) => { if (Number.isFinite(e.x)) sp = Math.max(sp, e.x + 2); if (Number.isFinite(e.y)) ze = Math.max(ze, e.y + 2); });
      return { sp: Math.min(sp, 12), ze: Math.min(ze, 12) };
    };
    const belegt = (c, r, ausser) => m.elemente.some((e) => e.id !== ausser && e.x === c && e.y === r && !(lay && lay.ix.istGruppe(e.id)));
    function inhaltBox() {
      const z = zellenZahl();
      return { x: 0, y: 0, w: lay.spalteX(z.sp - 1) + MASS.CW + MASS.RAND, h: lay.zeileY(z.ze - 1) + MASS.CH + MASS.RAND };
    }
    function zelleBox(c, r) { return { x: lay.spalteX(c), y: lay.zeileY(r), w: MASS.CW, h: MASS.CH }; }
    function zelleBei(wx, wy) {
      const z = zellenZahl();
      let best = null, d = Infinity;
      for (let c = 0; c < z.sp; c++) for (let r = 0; r < z.ze; r++) {
        const b = zelleBox(c, r);
        const dd = Math.hypot(b.x + b.w / 2 - wx, b.y + b.h / 2 - wy);
        if (dd < d) { d = dd; best = { c: c, r: r }; }
      }
      return d < PX ? best : null;
    }
    function freieZelle() {
      const z = zellenZahl();
      for (let r = 0; r < z.ze; r++) for (let c = 0; c < z.sp; c++) if (!belegt(c, r)) return { c: c, r: r };
      return { c: 0, r: z.ze };
    }
    const nameVon = (id) => { const e = m.elemente.find((x) => x.id === id); return e ? ohneTags(e.name) : id; };
    function melden(t) { status.textContent = t; }

    function sichern() {
      verlauf.push(JSON.stringify({ e: m.elemente, v: m.verbindungen }));
      if (verlauf.length > 60) verlauf.shift();
      zukunft.length = 0;
    }
    function geaendert() {
      markierungen = [];
      geister = [];
      zeichnen();
      if (typeof opt.onChange === "function") { try { opt.onChange(modellSauber(m)); } catch (e) { console.error("[Architektur] editor: onChange", e); } }
    }
    function zustandLaden(s) {
      const d = JSON.parse(s);
      m.elemente = d.e; m.verbindungen = d.v;
      auswahl = null; kanteWahl = null; modus = null;
    }

    // Elemente setzen, verschieben, löschen
    function setzen(it, c, r) {
      if (belegt(c, r)) { melden("Das Feld ist schon belegt."); return false; }
      sichern();
      let id = it.id;
      if (!id) { let n = 1; while (m.elemente.some((e) => e.id === it.typ + "-" + n)) n++; id = it.typ + "-" + n; }
      const zahl = it.id ? "" : m.elemente.filter((e) => e.typ === it.typ).length ? " " + (m.elemente.filter((e) => e.typ === it.typ).length + 1) : "";
      m.elemente.push({ id: id, typ: it.typ, name: it.name + zahl, technologie: it.technologie || "", stereotyp: it.stereotyp !== undefined ? it.stereotyp : TYPEN[it.typ].stereotyp, info: it.info || null, zustand: "ok", x: c, y: r });
      auswahl = id;
      kanteWahl = null;
      modus = null;
      geaendert();
      melden("«" + ohneTags(it.name) + "» liegt in Spalte " + (c + 1) + ", Zeile " + (r + 1) + ".");
      fokusAuf(id);
      return true;
    }
    function verschieben(id, c, r) {
      const e = m.elemente.find((x) => x.id === id);
      if (!e || (e.x === c && e.y === r)) return false;
      if (c < 0 || r < 0) return false;
      if (belegt(c, r, id)) { melden("Das Feld ist belegt."); return false; }
      sichern();
      e.x = c; e.y = r;
      geaendert();
      melden("«" + ohneTags(e.name) + "» verschoben nach Spalte " + (c + 1) + ", Zeile " + (r + 1) + ".");
      fokusAuf(id);
      return true;
    }
    function loeschen() {
      if (kanteWahl) {
        sichern();
        m.verbindungen = m.verbindungen.filter((v) => v.id !== kanteWahl);
        kanteWahl = null;
        menue.hidden = true;
        geaendert();
        melden("Verbindung gelöscht.");
        rahmen.focus();
        return;
      }
      if (!auswahl) { melden("Wähle zuerst ein Element oder eine Verbindung."); return; }
      if (fest.has(auswahl) || nurVerbinden) { melden("Dieses Element ist vorgegeben und bleibt."); return; }
      const n = nameVon(auswahl);
      sichern();
      const weg = auswahl;
      m.elemente = m.elemente.filter((e) => e.id !== weg);
      m.verbindungen = m.verbindungen.filter((v) => v.von !== weg && v.nach !== weg);
      auswahl = null;
      geaendert();
      melden("«" + n + "» und seine Verbindungen sind gelöscht.");
      const p = palette.findIndex((it) => it.id === weg);
      if (p >= 0) palKnoepfe[p].focus(); else rahmen.focus();
    }
    function verbinden(von, nach) {
      if (von === nach) { melden("Eine Verbindung braucht zwei verschiedene Elemente."); return; }
      let v = m.verbindungen.find((x) => x.von === von && x.nach === nach);
      sichern();
      if (!v) {
        let n = 1; while (m.verbindungen.some((x) => x.id === "v" + n)) n++;
        const art = letzteArt && arten.indexOf(letzteArt) >= 0 ? letzteArt : arten[0];
        v = { id: "v" + n, von: von, nach: nach, art: art, label: ARTEN[art].standardLabel || "", info: "" };
        m.verbindungen.push(v);
      }
      modus = null;
      auswahl = null;
      kanteWahl = v.id;
      geaendert();
      melden("Verbindung «" + nameVon(von) + " → " + nameVon(nach) + "» gezogen. Wähle die Art.");
      menueOeffnen(v.id, true);
    }
    let letzteArt = null;

    // Platzieren mit Tastatur und Antippen
    function platzierenStarten(it) {
      const f = freieZelle();
      modus = { art: "platzieren", item: it, c: f.c, r: f.r };
      el.classList.add("ar-platzieren");
      palKnoepfe.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.index === String(palette.indexOf(it)))));
      zeichnen();
      rahmen.focus();
      melden("«" + ohneTags(it.name) + "»: Wähle ein Feld (antippen, oder Pfeiltasten und Enter; Escape bricht ab). Feld Spalte " + (f.c + 1) + ", Zeile " + (f.r + 1) + ".");
    }
    function modusEnde(text) {
      const war = modus;
      modus = null;
      el.classList.remove("ar-platzieren", "ar-verbinden");
      bVerbinden.setAttribute("aria-pressed", "false");
      bVerbinden.classList.remove("on");
      palKnoepfe.forEach((b) => b.setAttribute("aria-pressed", "false"));
      zeichnen();
      if (text) melden(text);
      if (war && war.art === "platzieren") { const i = palette.indexOf(war.item); if (i >= 0) palKnoepfe[i].focus(); }
    }
    rahmen.addEventListener("keydown", (ev) => {
      if (!modus || modus.art !== "platzieren" || ev.target !== rahmen) return;
      const z = zellenZahl();
      const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[ev.key];
      if (d) {
        ev.preventDefault(); ev.stopImmediatePropagation();
        modus.c = klemmen(modus.c + d[0], 0, z.sp - 1); modus.r = klemmen(modus.r + d[1], 0, z.ze - 1);
        zeichnen();
        melden("Spalte " + (modus.c + 1) + ", Zeile " + (modus.r + 1) + (belegt(modus.c, modus.r) ? ", belegt" : ", frei") + ".");
      } else if (ev.key === "Enter" || ev.key === " ") {
        ev.preventDefault(); ev.stopImmediatePropagation();
        setzen(modus.item, modus.c, modus.r);
      } else if (ev.key === "Escape") {
        ev.preventDefault();
        modusEnde("Abgebrochen.");
      }
    }, true);

    // Ziehen aus der Palette (Maus, Touch, Stift)
    function paletteZiehen(b, it) {
      let start = null, geist = null;
      b.addEventListener("pointerdown", (ev) => {
        if (ev.button > 0) return;
        if (it.id && m.elemente.some((e) => e.id === it.id)) return;
        start = { x: ev.clientX, y: ev.clientY, id: ev.pointerId };
        try { b.setPointerCapture(ev.pointerId); } catch (e) { /* egal */ }
      });
      b.addEventListener("pointermove", (ev) => {
        if (!start || start.id !== ev.pointerId) return;
        if (!geist && Math.hypot(ev.clientX - start.x, ev.clientY - start.y) > 6) {
          try { b.setPointerCapture(ev.pointerId); } catch (e) { /* egal */ }
          geist = erzeugen("div", "ar-zieh-geist", vorschauSvg(it));
          document.body.appendChild(geist);
          el.classList.add("ar-platzieren");
          modus = { art: "ziehen", item: it, c: -1, r: -1 };
        }
        if (geist) {
          ev.preventDefault();
          geist.style.left = ev.clientX + "px";
          geist.style.top = ev.clientY + "px";
          const z = ueberFlaeche(ev) ? zelleBei.apply(null, fl.welt(ev.clientX, ev.clientY)) : null;
          const alt = modus.c + "/" + modus.r;
          modus.c = z ? z.c : -1; modus.r = z ? z.r : -1;
          if (alt !== modus.c + "/" + modus.r) zielZeichnen();
        }
      });
      const ende = (ev, abbruch) => {
        if (!start || start.id !== ev.pointerId) return;
        start = null;
        if (!geist) return;
        geist.remove(); geist = null;
        b.dataset.gezogen = "1";
        setTimeout(() => delete b.dataset.gezogen, 60);
        const c = modus.c, r = modus.r;
        modus = null;
        el.classList.remove("ar-platzieren");
        if (!abbruch && c >= 0 && !belegt(c, r)) setzen(it, c, r);
        else { zeichnen(); melden(c >= 0 && !abbruch ? "Das Feld ist belegt." : "Nicht abgelegt."); }
      };
      b.addEventListener("pointerup", (ev) => ende(ev, false));
      b.addEventListener("pointercancel", (ev) => ende(ev, true));
    }
    const ueberFlaeche = (ev) => { const r = rahmen.getBoundingClientRect(); return ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom; };

    // Zeichnen
    let zielG = null;
    function zielZeichnen() {
      if (!zielG) return;
      zielG.innerHTML = "";
      const z = zellenZahl();
      if (nurVerbinden) return;
      for (let c = 0; c < z.sp; c++) for (let r = 0; r < z.ze; r++) {
        const b = zelleBox(c, r);
        const ziel = !!modus && modus.c === c && modus.r === r && modus.art !== "verbinden";
        const ausser = modus && modus.art === "verschieben" ? modus.id : null;
        const n = svgEl("rect", { x: b.x + 4, y: b.y + 4, width: b.w - 8, height: b.h - 8, rx: 10, "data-c": c, "data-r": r },
          "ar-slot" + (belegt(c, r, ausser) ? " ar-slot-belegt" : "") + (ziel ? " ar-slot-ziel" : ""));
        zielG.appendChild(n);
      }
    }
    function zeichnen() {
      m.elemente.forEach((e) => { if (!lay || !lay.ix.istGruppe(e.id)) { if (!Number.isFinite(e.x) || !Number.isFinite(e.y)) { const f = freieZelleOhne(e.id); e.x = f.c; e.y = f.r; } } });
      lay = layoutBerechnen(m, { manuell: true });
      routen = kantenRouten(lay, m.verbindungen);
      const labels = labelsSetzen(lay, m.verbindungen, routen);
      szene = szeneZeichnen(svg, m, lay, routen, labels, { uid: uid });
      zielG = svgEl("g", null, "ar-slots");
      szene.welt.insertBefore(zielG, szene.welt.children[1]);
      const box = inhaltBox();
      if (!fl) fl = zoomFlaeche(rahmen, svg, { inhalt: box, kMin: 0.48, kMax: 1, minHoehe: 260, darfZiehen: (ev) => !ev.target.closest(".ar-el, .ar-griff, .ar-kante") });
      else if (Math.abs(fl.vb.w - 0) >= 0 && (box.w !== letzteBox.w || box.h !== letzteBox.h)) fl.setzeInhalt(box);
      letzteBox = box;
      zielZeichnen();
      // Auswahl, Griffe, Markierungen
      Object.keys(szene.elG).forEach((id) => {
        const g = szene.elG[id];
        g.classList.toggle("ar-gewaehlt", id === auswahl);
        if (modus && modus.art === "verbinden" && modus.von === id) g.classList.add("ar-quelle");
        if (fest.has(id)) g.classList.add("ar-fest");
        elementBedienung(id, g);
      });
      Object.keys(szene.kantenG).forEach((kid) => {
        const g = szene.kantenG[kid];
        g.classList.toggle("ar-gewaehlt", kid === kanteWahl);
        g.addEventListener("click", (ev) => { ev.stopPropagation(); if (nurVerbindenGesperrt()) return; auswahl = null; kanteWahl = kid; zeichnen(); menueOeffnen(kid, true); });
      });
      if (auswahl && szene.elG[auswahl] && !nurVerbinden) griffeZeichnen(auswahl);
      else if (auswahl && szene.elG[auswahl]) griffeZeichnen(auswahl);
      markierungen.forEach((mk) => markierungAnwenden(mk.ids, mk.klasse));
      geister.forEach((g) => geistZeichnen(g));
      if (modus && modus.art === "platzieren") {
        const b = zelleBox(modus.c, modus.r);
        fl.zeige(b);
      }
      // Leiste
      bLoeschen.disabled = !(kanteWahl || (auswahl && !fest.has(auswahl) && !nurVerbinden));
      bUndo.disabled = !verlauf.length;
      bRedo.disabled = !zukunft.length;
      const e = auswahl && m.elemente.find((x) => x.id === auswahl);
      const umbenennbar = !!e && !fest.has(e.id) && !palette.some((it) => it.id === e.id) && !nurVerbinden;
      nameFeld.hidden = !umbenennbar;
      if (umbenennbar && document.activeElement !== nameInput) nameInput.value = ohneTags(e.name);
      palette.forEach((it, i) => {
        const liegt = !!it.id && m.elemente.some((x) => x.id === it.id);
        palKnoepfe[i].classList.toggle("ar-liegt", liegt);
        if (!modus) palKnoepfe[i].setAttribute("aria-pressed", "false");
        palKnoepfe[i].setAttribute("aria-label", ohneTags(it.name) + (liegt ? ", liegt auf der Fläche" : ""));
      });
      listeZeichnen();
    }
    let letzteBox = { w: 0, h: 0 };
    function freieZelleOhne(id) {
      const z = { sp: raster.spalten, ze: raster.zeilen + 4 };
      for (let r = 0; r < z.ze; r++) for (let c = 0; c < z.sp; c++) if (!m.elemente.some((e) => e.id !== id && e.x === c && e.y === r)) return { c: c, r: r };
      return { c: 0, r: 0 };
    }
    const nurVerbindenGesperrt = () => false;

    function griffeZeichnen(id) {
      const r = lay.el[id];
      if (!r) return;
      [[r.x + r.w / 2, r.y, 0], [r.x + r.w, r.y + r.h / 2, 1], [r.x + r.w / 2, r.y + r.h, 2], [r.x, r.y + r.h / 2, 3]].forEach(([x, y, s]) => {
        const g = svgEl("g", { transform: "translate(" + f1(x) + " " + f1(y) + ")", "data-seite": s }, "ar-griff");
        g.innerHTML = '<circle class="ar-griff-hof" r="14"/><circle class="ar-griff-punkt" r="6"/><title>Ziehen zum Verbinden</title>';
        szene.effekte.appendChild(g);
        griffZiehen(g, id, [x, y]);
      });
    }
    function griffZiehen(g, von, p0) {
      g.addEventListener("pointerdown", (ev) => {
        ev.stopPropagation();
        ev.preventDefault();
        try { g.setPointerCapture(ev.pointerId); } catch (e) { /* egal */ }
        const linie = svgEl("path", { d: "" }, "ar-zieh-linie");
        szene.effekte.appendChild(linie);
        let ziel = null;
        const bewegen = (e2) => {
          const w = fl.welt(e2.clientX, e2.clientY);
          linie.setAttribute("d", "M" + f1(p0[0]) + " " + f1(p0[1]) + "L" + f1(w[0]) + " " + f1(w[1]));
          const unter = document.elementFromPoint(e2.clientX, e2.clientY);
          const z = unter && unter.closest ? unter.closest(".ar-el") : null;
          const zid = z && szene.welt.contains(z) ? z.getAttribute("data-id") : null;
          if (ziel !== zid) {
            if (ziel && szene.elG[ziel]) szene.elG[ziel].classList.remove("ar-zielhover");
            ziel = zid && zid !== von ? zid : null;
            if (ziel) szene.elG[ziel].classList.add("ar-zielhover");
          }
        };
        const fertig = () => {
          g.removeEventListener("pointermove", bewegen);
          linie.remove();
          if (ziel) verbinden(von, ziel);
          else melden("Zum Verbinden auf ein anderes Element ziehen.");
        };
        g.addEventListener("pointermove", bewegen);
        g.addEventListener("pointerup", fertig, { once: true });
        g.addEventListener("pointercancel", () => { g.removeEventListener("pointermove", bewegen); linie.remove(); }, { once: true });
      });
    }

    function elementBedienung(id, g) {
      const istFest = fest.has(id) || nurVerbinden;
      g.addEventListener("click", (ev) => {
        ev.stopPropagation();
        if (g.dataset.verschoben) { delete g.dataset.verschoben; return; }
        aktivieren(id);
      });
      g.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); aktivieren(id); return; }
        if ((ev.key === "Delete" || ev.key === "Backspace") && auswahl === id) { ev.preventDefault(); loeschen(); return; }
        if (ev.key === "Escape") { ev.preventDefault(); if (modus) modusEnde("Abgebrochen."); else { auswahl = null; zeichnen(); fokusAuf(id); } return; }
        if ((ev.key === "v" || ev.key === "V") && !ev.ctrlKey && !ev.metaKey) { ev.preventDefault(); verbindenStarten(id); return; }
        const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[ev.key];
        if (d && auswahl === id && !istFest) {
          ev.preventDefault();
          const e = m.elemente.find((x) => x.id === id);
          verschieben(id, e.x + d[0], e.y + d[1]);
        }
      });
      if (istFest && !fest.has(id)) return;
      if (istFest) return;
      // Verschieben mit Zeiger
      let start = null;
      g.addEventListener("pointerdown", (ev) => {
        if (ev.button > 0 || ev.target.closest(".ar-griff")) return;
        start = { x: ev.clientX, y: ev.clientY, id: ev.pointerId, aktiv: false };
      });
      g.addEventListener("pointermove", (ev) => {
        if (!start || start.id !== ev.pointerId) return;
        if (!start.aktiv && Math.hypot(ev.clientX - start.x, ev.clientY - start.y) > 6) {
          start.aktiv = true;
          try { g.setPointerCapture(ev.pointerId); } catch (e) { /* egal */ }
          modus = { art: "verschieben", id: id, c: -1, r: -1 };
          el.classList.add("ar-platzieren");
          g.classList.add("ar-wird-gezogen");
        }
        if (start.aktiv) {
          ev.preventDefault();
          const w = fl.welt(ev.clientX, ev.clientY);
          const r = lay.el[id];
          g.setAttribute("transform", "translate(" + f1(w[0] - r.w / 2) + " " + f1(w[1] - r.h / 2) + ")");
          const z = zelleBei(w[0], w[1]);
          const alt = modus.c + "/" + modus.r;
          modus.c = z ? z.c : -1; modus.r = z ? z.r : -1;
          if (alt !== modus.c + "/" + modus.r) zielZeichnen();
        }
      });
      const ende = (ev) => {
        if (!start || start.id !== ev.pointerId) return;
        const war = start;
        start = null;
        if (!war.aktiv) return;
        g.dataset.verschoben = "1";
        const c = modus.c, r = modus.r;
        modus = null;
        el.classList.remove("ar-platzieren");
        if (c < 0 || !verschieben(id, c, r)) zeichnen();
        setTimeout(() => { if (szene.elG[id]) delete szene.elG[id].dataset.verschoben; }, 60);
      };
      g.addEventListener("pointerup", ende);
      g.addEventListener("pointercancel", ende);
    }
    function aktivieren(id) {
      if (modus && modus.art === "verbinden") {
        if (modus.von === id) { modusEnde("Verbinden abgebrochen."); fokusAuf(id); return; }
        const von = modus.von;
        modus = null;
        el.classList.remove("ar-verbinden");
        bVerbinden.setAttribute("aria-pressed", "false");
        bVerbinden.classList.remove("on");
        verbinden(von, id);
        return;
      }
      kanteWahl = null;
      menue.hidden = true;
      auswahl = auswahl === id ? null : id;
      zeichnen();
      fokusAuf(id);
      if (auswahl) melden("«" + nameVon(id) + "» gewählt." + (nurVerbinden || fest.has(id) ? "" : " Pfeiltasten verschieben, Entf löscht,") + " «Verbinden» oder Taste V zieht eine Verbindung.");
    }
    function verbindenStarten(von) {
      if (!von) { melden("Wähle zuerst das Start-Element, dann «Verbinden»."); return; }
      modus = { art: "verbinden", von: von };
      el.classList.add("ar-verbinden");
      bVerbinden.setAttribute("aria-pressed", "true");
      bVerbinden.classList.add("on");
      zeichnen();
      melden("Verbinden ab «" + nameVon(von) + "»: Wähle jetzt das Ziel (Tab und Enter, oder antippen). Escape bricht ab.");
      const anderes = m.elemente.find((e) => e.id !== von && szene.elG[e.id]);
      fokusAuf(anderes ? anderes.id : von);
    }
    function fokusAuf(id) {
      const g = szene && szene.elG[id];
      if (g) { try { g.focus({ preventScroll: true }); } catch (e) { g.focus(); } }
    }

    // Menü für die Art der Verbindung
    function menueOeffnen(kid, fokus) {
      const v = m.verbindungen.find((x) => x.id === kid);
      if (!v) return;
      menue.innerHTML = "";
      menue.setAttribute("aria-label", "Verbindung " + nameVon(v.von) + " nach " + nameVon(v.nach));
      menue.appendChild(erzeugen("p", "ar-artmenue-titel", esc(nameVon(v.von)) + ' <span aria-hidden="true">→</span><span class="sr-only">nach</span> ' + esc(nameVon(v.nach))));
      const reihe = erzeugen("div", "ar-artmenue-arten");
      reihe.setAttribute("role", "group");
      reihe.setAttribute("aria-label", "Art der Verbindung");
      let erster = null;
      arten.forEach((a) => {
        const b = knopf(artMuster(a, 40) + "<span>" + esc(ARTEN[a].name) + "</span>", "ar-art-wahl", { "aria-pressed": String(v.art === a) });
        b.addEventListener("click", () => {
          if (v.art !== a) {
            sichern();
            const altLabel = ARTEN[v.art].standardLabel || "";
            v.art = a;
            if (!v.label || v.label === altLabel) v.label = ARTEN[a].standardLabel || "";
            letzteArt = a;
            geaendert();
            menueOeffnen(kid, false);
            const nb = $$(".ar-art-wahl", menue)[arten.indexOf(a)];
            if (nb) nb.focus();
          }
          melden("Art: " + ARTEN[a].name + ".");
        });
        if (v.art === a || !erster) erster = v.art === a ? b : erster || b;
        reihe.appendChild(b);
      });
      menue.appendChild(reihe);
      if (opt.labels !== false) {
        const lid = neueId("label");
        const lw = erzeugen("div", "ar-artmenue-label");
        lw.innerHTML = '<label for="' + lid + '">Beschriftung (optional)</label>';
        const inp = erzeugen("input");
        inp.id = lid; inp.type = "text"; inp.maxLength = 30; inp.value = ohneTags(v.label || ""); inp.placeholder = "z. B. HTTPS, SQL, Event";
        inp.addEventListener("change", () => { sichern(); v.label = inp.value.trim(); geaendert(); menueOeffnen(kid, false); melden("Beschriftung gesetzt."); });
        lw.appendChild(inp);
        menue.appendChild(lw);
      }
      const fuss = erzeugen("div", "row");
      const bUm = knopf("Richtung umkehren", "ar-klein");
      bUm.addEventListener("click", () => { sichern(); const t = v.von; v.von = v.nach; v.nach = t; geaendert(); menueOeffnen(kid, false); bUm.focus(); melden("Richtung umgekehrt: " + nameVon(v.von) + " → " + nameVon(v.nach) + "."); });
      const bWeg = knopf("Löschen", "ar-klein");
      bWeg.addEventListener("click", () => { kanteWahl = kid; loeschen(); });
      const bOk = knopf("Fertig", "ar-klein primary");
      bOk.addEventListener("click", () => menueSchliessen(true));
      fuss.append(bUm, bWeg, bOk);
      menue.appendChild(fuss);
      menue.hidden = false;
      menuePlatzieren(v);
      if (fokus && erster) erster.focus();
    }
    function menuePlatzieren(v) {
      const r = routen[v.id];
      if (!r) return;
      const mitte = punktAuf(r.punkte, polyLaenge(r.punkte) / 2);
      const p = fl.bildschirm(mitte[0], mitte[1]);
      const bw = buehne.clientWidth, mw = menue.offsetWidth || 260, mh = menue.offsetHeight || 200;
      const rb = rahmen.getBoundingClientRect(), bb = buehne.getBoundingClientRect();
      const x = klemmen(p[0] + rb.left - bb.left - mw / 2, 4, Math.max(4, bw - mw - 4));
      const y = klemmen(p[1] + rb.top - bb.top + 18, 4, Math.max(4, rahmen.clientHeight + (rb.top - bb.top) - mh - 4));
      menue.style.left = x + "px";
      menue.style.top = y + "px";
    }
    function menueSchliessen(fokus) {
      const kid = kanteWahl;
      menue.hidden = true;
      kanteWahl = null;
      zeichnen();
      if (fokus) {
        const v = m.verbindungen.find((x) => x.id === kid);
        if (v) fokusAuf(v.von); else rahmen.focus();
      }
    }
    menue.addEventListener("keydown", (ev) => { if (ev.key === "Escape") { ev.preventDefault(); menueSchliessen(true); } });

    // Liste als Text (Screenreader, Kontrolle)
    function listeZeichnen() {
      let h = "<h4>Elemente (" + m.elemente.length + ")</h4>";
      h += m.elemente.length ? "<ul>" + m.elemente.map((e) => '<li class="' + katKlasse(e.typ) + '"><span class="ar-farbpunkt" aria-hidden="true"></span>' + esc(ohneTags(e.name)) + ' <span class="hint">«' + esc(e.stereotyp || TYPEN[e.typ].name) + "» · Spalte " + (e.x + 1) + ", Zeile " + (e.y + 1) + "</span></li>").join("") + "</ul>" : '<p class="hint">Noch leer.</p>';
      h += "<h4>Verbindungen (" + m.verbindungen.length + ")</h4>";
      listeInhalt.innerHTML = h;
      const ul = erzeugen("ul");
      if (!m.verbindungen.length) listeInhalt.appendChild(erzeugen("p", "hint", "Noch keine Verbindung."));
      m.verbindungen.forEach((v) => {
        const li = erzeugen("li", null, "<span>" + esc(nameVon(v.von)) + " → " + esc(nameVon(v.nach)) + ' <span class="hint">· ' + esc(ARTEN[v.art].name) + (v.label ? " · " + esc(ohneTags(v.label)) : "") + "</span></span>");
        const b1 = knopf("Bearbeiten", "ar-klein", { "aria-label": "Verbindung " + nameVon(v.von) + " nach " + nameVon(v.nach) + " bearbeiten" });
        b1.addEventListener("click", () => { auswahl = null; kanteWahl = v.id; zeichnen(); menueOeffnen(v.id, true); });
        li.appendChild(b1);
        ul.appendChild(li);
      });
      if (m.verbindungen.length) listeInhalt.appendChild(ul);
    }

    // Markierungen (Spiel: Treffer ✓ / Fehler ✗)
    function markierungAnwenden(ids, klasse) {
      (ids || []).forEach((id) => {
        let g = szene.elG[id], r = lay.el[id] || lay.gr[id];
        if (g) {
          g.classList.add(klasse);
          if (klasse === "ar-ok") marke(g, r, "✓", "ar-marke-ok");
          if (klasse === "ar-falsch") marke(g, r, "✗", "ar-marke-falsch");
          return;
        }
        // Verbindung: ID oder «von>nach»
        let v = m.verbindungen.find((x) => x.id === id);
        if (!v && id.indexOf(">") > 0) { const [a, b] = id.split(">"); v = m.verbindungen.find((x) => x.von === a && x.nach === b); }
        if (!v || !szene.kantenG[v.id]) return;
        szene.kantenG[v.id].classList.add(klasse);
        if (szene.labelG[v.id]) szene.labelG[v.id].classList.add(klasse);
        const rt = routen[v.id];
        if (rt && (klasse === "ar-ok" || klasse === "ar-falsch")) {
          const p = punktAuf(rt.punkte, polyLaenge(rt.punkte) * 0.5);
          const n = svgEl("g", { transform: "translate(" + f1(p[0]) + " " + f1(p[1]) + ")" }, "ar-marke ar-marke-kante " + (klasse === "ar-ok" ? "ar-marke-ok" : "ar-marke-falsch"));
          n.innerHTML = '<g class="ar-marke-innen"><circle r="10"/><text y="4.2" text-anchor="middle">' + (klasse === "ar-ok" ? "✓" : "✗") + "</text></g>";
          szene.effekte.appendChild(n);
        }
      });
    }
    function geistZeichnen(gv) {
      if (!lay.el[gv.von] || !lay.el[gv.nach]) return;
      const r = kantenRouten(lay, [{ id: "geist", von: gv.von, nach: gv.nach, art: gv.art }]);
      if (!r.geist) return;
      const p = svgEl("path", { d: pfadD(r.geist.punkte, 7) }, "ar-geist ar-tipp-geist ar-art-" + gv.art);
      szene.effekte.appendChild(p);
    }

    // Leiste bedienen
    bVerbinden.addEventListener("click", () => {
      if (modus && modus.art === "verbinden") { modusEnde("Verbinden abgebrochen."); return; }
      verbindenStarten(auswahl);
    });
    bLoeschen.addEventListener("click", loeschen);
    function rueckgaengig() {
      if (!verlauf.length) return;
      zukunft.push(JSON.stringify({ e: m.elemente, v: m.verbindungen }));
      zustandLaden(verlauf.pop());
      menue.hidden = true;
      geaendert();
      melden("Rückgängig gemacht.");
    }
    function wiederholen() {
      if (!zukunft.length) return;
      verlauf.push(JSON.stringify({ e: m.elemente, v: m.verbindungen }));
      zustandLaden(zukunft.pop());
      menue.hidden = true;
      geaendert();
      melden("Wiederholt.");
    }
    bUndo.addEventListener("click", () => { rueckgaengig(); if (bUndo.disabled) bRedo.focus(); });
    bRedo.addEventListener("click", () => { wiederholen(); if (bRedo.disabled) bUndo.focus(); });
    nameInput.addEventListener("change", () => {
      const e = m.elemente.find((x) => x.id === auswahl);
      const t = nameInput.value.trim();
      if (!e || !t) return;
      sichern();
      e.name = t;
      geaendert();
      melden("Umbenannt in «" + t + "».");
    });
    el.addEventListener("keydown", (ev) => {
      if (!(ev.ctrlKey || ev.metaKey) || ev.target.tagName === "INPUT") return;
      if (ev.key === "z" || ev.key === "Z") { ev.preventDefault(); if (ev.shiftKey) wiederholen(); else rueckgaengig(); }
      else if (ev.key === "y" || ev.key === "Y") { ev.preventDefault(); wiederholen(); }
    });
    // Antippen auf der Fläche: Feld wählen (Platzieren) oder Auswahl aufheben
    svg.addEventListener("click", (ev) => {
      if (modus && modus.art === "platzieren") {
        const z = zelleBei.apply(null, fl.welt(ev.clientX, ev.clientY));
        if (z) setzen(modus.item, z.c, z.r);
        return;
      }
      if (!menue.hidden) { menueSchliessen(false); return; }
      if (auswahl || kanteWahl) { auswahl = null; kanteWahl = null; zeichnen(); }
    });

    zeichnen();
    melden(nurVerbinden ? "Wähle ein Element, dann «Verbinden» und das Ziel. Oder zieh vom Griff am Element." : "Zieh Bausteine aus der Palette auf die Fläche oder tippe sie an und wähle ein Feld.");

    return {
      modell: () => modellSauber(m),
      setzeModell: (neu) => {
        const n = modellPruefen(neu, "editor");
        if (!n) return false;
        sichern();
        m = n;
        auswahl = null; kanteWahl = null; modus = null; menue.hidden = true;
        geaendert();
        return true;
      },
      markiere: (ids, klasse) => {
        if (!ids || !ids.length) { markierungen = []; geister = []; zeichnen(); return; }
        markierungen.push({ ids: ids.slice(), klasse: klasse || "ar-markiert" });
        markierungAnwenden(ids, klasse || "ar-markiert");
      },
      geist: (v) => { geister.push(v); geistZeichnen(v); },
      palettePuls: (id) => {
        const i = palette.findIndex((it) => it.id === id);
        if (i < 0) return;
        palKnoepfe[i].classList.remove("ar-puls"); void palKnoepfe[i].offsetWidth; palKnoepfe[i].classList.add("ar-puls");
        palKnoepfe[i].scrollIntoView && palKnoepfe[i].scrollIntoView({ block: "nearest" });
      },
      rueckgaengig: rueckgaengig,
    };
  }

  /* ---------- 13b. Prüfungsspiel in Modulnotation (Vertrag 10.3) ---------- */

  const UML_PROTOKOLLE = ["REST", "SOAP", "GraphQL", "OData", "gRPC", "AMQP", "JMS", "MQTT", "RMI", "HTTP", "SMTP", "AD LDS"];
  const UML_GEWICHTE = { komponenten: 2, pakete: 1, stereotypen: 1, verbindungen: 2, beschriftungen: 1, beschreibungen: 1 };
  const KRITERIEN = [
    ["komponenten", "Komponenten"], ["pakete", "Pakete (Lage)"], ["stereotypen", "Stereotypen"],
    ["verbindungen", "Verbindungen"], ["beschriftungen", "Beschriftungen (Protokoll)"], ["beschreibungen", "Beschreibungen"],
  ];
  const ohneGuillemets = (t) => String(t || "").replace(/[«»<>]/g, "").trim().toLowerCase();

  function umlLevelPruefen(l, f) {
    const pakete = Array.isArray(l.pakete) ? l.pakete.filter((p) => p && p.id && ID_MUSTER.test(p.id)) : [];
    if (!pakete.length) return f("Level «" + l.id + "» (uml): «pakete» fehlt.");
    const pIds = new Set(pakete.map((p) => p.id));
    const palette = (l.palette || []).filter((p) => {
      if (!p || !p.id || !ID_MUSTER.test(p.id) || !TYPEN[p.typ]) { f("Level «" + l.id + "»: Palette-Eintrag braucht gültige «id» und bekannten «typ»."); return false; }
      if (pIds.has(p.id)) { f("Level «" + l.id + "»: ID «" + p.id + "» ist schon ein Paket."); return false; }
      return true;
    });
    const nachId = {};
    palette.forEach((p) => (nachId[p.id] = p));
    // vorgegeben: fest platzierte Elemente (Paket über «in» oder «paket») und Verbindungen
    const vorgEl = (l.vorgegeben && Array.isArray(l.vorgegeben.elemente) ? l.vorgegeben.elemente : []).filter((e) => {
      if (!e || !e.id || !ID_MUSTER.test(e.id) || !TYPEN[e.typ]) { f("Level «" + l.id + "»: vorgegebenes Element braucht gültige «id» und bekannten «typ»."); return false; }
      if (nachId[e.id] || pIds.has(e.id)) { f("Level «" + l.id + "»: vorgegebenes Element «" + e.id + "» doppelt."); return false; }
      return true;
    }).map((e) => Object.assign({}, e, { in: e.in !== undefined ? e.in : e.paket !== undefined ? e.paket : null }));
    vorgEl.forEach((e) => (nachId[e.id] = e));
    const vorgV = l.vorgegeben && Array.isArray(l.vorgegeben.verbindungen) ? l.vorgegeben.verbindungen.filter(Boolean) : [];
    const loe = l.loesung || {};
    if (!Array.isArray(loe.elemente) || !Array.isArray(loe.verbindungen)) return f("Level «" + l.id + "»: «loesung» braucht «elemente» und «verbindungen».");
    const elemente = loe.elemente.map((x) => (typeof x === "string" ? { id: x } : x));
    for (const x of elemente) {
      if (!nachId[x.id]) return f("Level «" + l.id + "»: Lösung nennt unbekannte Komponente «" + x.id + "».");
      if (x.paket && !pIds.has(x.paket)) return f("Level «" + l.id + "»: Paket «" + x.paket + "» unbekannt.");
    }
    const kennt = (ref) => { const t = String(ref || "").split("#"); return (nachId[t[0]] || pIds.has(t[0])) && (!t[1] || (nachId[t[0]] && (nachId[t[0]].schnittstellen || []).some((s) => s.id === t[1]))); };
    for (const v of loe.verbindungen) {
      if (!kennt(v.von) || !kennt(v.nach)) return f("Level «" + l.id + "»: Lösungs-Verbindung " + v.von + " → " + v.nach + " nennt Unbekanntes.");
      for (const a of v.alternativen || []) if (!kennt(a.von) || !kennt(a.nach)) return f("Level «" + l.id + "»: Alternative " + a.von + " → " + a.nach + " nennt Unbekanntes.");
    }
    vorgV.forEach((v) => { if (!kennt(v.von) || !kennt(v.nach)) f("Level «" + l.id + "»: vorgegebene Verbindung " + v.von + " → " + v.nach + " nennt Unbekanntes."); });
    (loe.beschreibungen || []).forEach((b) => { if (!nachId[b.id] && !pIds.has(b.id)) f("Level «" + l.id + "»: Beschreibung für unbekanntes «" + b.id + "»."); });
    return {
      id: l.id, uml: true, titel: l.titel || "Level", schwierigkeit: klemmen(Math.round(l.schwierigkeit || 2), 1, 3),
      auftrag: l.auftrag || "", pakete: pakete, palette: palette, referenz: l.referenz || null,
      protokolle: Array.isArray(l.protokolle) && l.protokolle.length ? l.protokolle : UML_PROTOKOLLE,
      loesung: { elemente: elemente, verbindungen: loe.verbindungen.map((v) => Object.assign({ art: "assoziation" }, v)), beschreibungen: loe.beschreibungen || [] },
      gewichte: Object.assign({}, UML_GEWICHTE, l.gewichte || {}), zielzeit: Number(l.zielzeit) > 0 ? Number(l.zielzeit) : 600,
      erklaerung: l.erklaerung || "", ablenker: palette.filter((p) => p.ablenker || p.falle).map((p) => p.id),
      vorgegeben: { elemente: vorgEl, verbindungen: vorgV.filter((v) => kennt(v.von) && kennt(v.nach)) },
      freieFlaeche: l.freieFlaeche === true || elemente.some((x) => x.paket === null),
    };
  }

  // Musterlösung als Modell (für Anzeige und Referenz)
  function umlMusterModell(L, mitAblauf) {
    const sch = {};
    L.loesung.verbindungen.forEach((v) => {
      const t = String(v.nach).split("#");
      if (t[1]) (sch[t[0]] = sch[t[0]] || new Set()).add(t[1]);
    });
    const vorg = (L.vorgegeben && L.vorgegeben.elemente) || [];
    const elemente = vorg.filter((e) => !L.loesung.elemente.some((x) => x.id === e.id)).map((e) => ({ id: e.id, typ: e.typ, rolle: e.rolle, name: e.name, in: e.in || undefined, stereotyp: e.stereotyp || "", schnittstellen: e.schnittstellen || [] }))
      .concat(L.loesung.elemente.map((x) => {
      const p = L.palette.find((q) => q.id === x.id) || vorg.find((q) => q.id === x.id);
      return { id: p.id, typ: p.typ, rolle: p.rolle, name: p.name, in: x.paket || (x.paket === null ? undefined : p.in || undefined), stereotyp: x.stereotyp || p.stereotyp || "", technologie: p.technologie || "",
        info: p.info ? { was: p.info } : undefined,
        schnittstellen: (p.schnittstellen || []).filter((s) => (sch[p.id] && sch[p.id].has(s.id)) || s.immer || vorg.some((q) => q.id === p.id)) };
    }));
    const verbindungen = ((L.vorgegeben && L.vorgegeben.verbindungen) || []).filter((v) => !L.loesung.verbindungen.some((w) => w.von === v.von && w.nach === v.nach))
      .map((v, k) => ({ id: "f" + (k + 1), von: v.von, nach: v.nach, art: v.art || "assoziation", protokoll: v.protokoll || "", format: v.format || "", label: v.label })).concat(L.loesung.verbindungen.map((v, k) => ({ id: "l" + (k + 1), von: v.von, nach: v.nach, art: v.art, protokoll: v.protokoll || "", format: v.format || "", label: v.label, info: v.warum || "" })));
    const m = { notation: "uml-komponenten", titel: "", pakete: L.pakete, elemente: elemente, verbindungen: verbindungen };
    if (mitAblauf) m.ablaeufe = [{ id: "loesung", name: "Musterlösung Schritt für Schritt", schritte: L.loesung.verbindungen.filter((v) => v.warum).map((v) => ({ von: v.von, nach: v.nach, text: v.warum })) }];
    return m;
  }

  function umlFeld(el, L, opt) {
    opt = opt || {};
    const uid = neueId("uf");
    const live = ansage();
    const FREI = ""; // Ablage ausserhalb der Pakete (Lösungs-Paket null)
    const frei = L.freieFlaeche === true;
    const vorg = L.vorgegeben || { elemente: [], verbindungen: [] };
    const fest = new Set(vorg.elemente.map((e) => e.id));
    const anfang = () => ({
      elemente: vorg.elemente.map((e) => ({ id: e.id, typ: e.typ, rolle: e.rolle || ROLLE_VON_TYP[e.typ] || "extern", name: e.name, in: e.in || FREI, stereotyp: e.stereotyp || "", schnittstellen: kopie(e.schnittstellen || []), fest: true })),
      verbindungen: vorg.verbindungen.map((v, i) => {
        const t = String(v.nach).split("#");
        return { id: "f" + (i + 1), von: String(v.von).split("#")[0], nach: t[0], nachSch: t[1] || null, art: v.art || "assoziation", protokoll: v.protokoll || "", format: v.format || "", fest: true };
      }),
    });
    let m = anfang();
    let auswahl = null, kanteWahl = null, modus = null, markierung = null, geister = [];
    const verlauf = [];
    const beschreibungWahl = {};
    const palNach = {};
    L.palette.forEach((p) => (palNach[p.id] = p));
    vorg.elemente.forEach((e) => (palNach[e.id] = e));
    const paketNach = {};
    L.pakete.forEach((p) => (paketNach[p.id] = p));
    const istPaket = (id) => !!paketNach[id];
    const istFest = (id) => fest.has(id);
    const name = (id) => (id === FREI ? "freie Fläche" : ohneTags((palNach[id] || paketNach[id] || { name: id }).name));

    el.innerHTML = "";
    el.classList.add("ar-uml-feld");
    const leiste = erzeugen("div", "ar-ed-leiste");
    leiste.setAttribute("role", "toolbar");
    leiste.setAttribute("aria-label", "Werkzeuge");
    const bVerb = knopf('<svg class="pikto" viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="2.5"/><circle cx="19" cy="12" r="2.5"/><path d="M7.5 12h9"/></svg>Verbinden', "", { "aria-pressed": "false", "aria-keyshortcuts": "V" });
    const bWeg = knopf('<svg class="pikto" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M10 7V4.5h4V7M7 7l1 13h8l1-13"/></svg>Entfernen');
    const bUndo = knopf('<svg class="pikto" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 7L4.5 11.5 9 16"/><path d="M4.5 11.5H15a5 5 0 0 1 0 10h-3"/></svg>Rückgängig');
    leiste.append(bVerb, bWeg, bUndo);
    const status = erzeugen("p", "ar-ed-status");
    status.setAttribute("aria-live", "polite");
    const arbeit = erzeugen("div", "ar-uf-arbeit");
    const pal = erzeugen("div", "ar-ed-palette ar-uf-palette");
    pal.appendChild(erzeugen("p", "ar-ed-titel", "Komponenten"));
    const palListe = erzeugen("div", "ar-uf-pal-liste");
    palListe.setAttribute("role", "group");
    palListe.setAttribute("aria-label", "Komponenten: antippen und Paket wählen, oder in ein Paket ziehen");
    pal.appendChild(palListe);
    pal.appendChild(erzeugen("p", "hint ar-ed-pal-hinweis", "In ein Paket ziehen, oder antippen und dann das Paket wählen. Tastatur: Enter, Pfeiltasten, Enter."));
    const buehne = erzeugen("div", "ar-ed-buehne");
    const rahmen = erzeugen("div", "ar-viewport ar-uf-flaeche");
    rahmen.tabIndex = 0;
    rahmen.setAttribute("role", "group");
    rahmen.setAttribute("aria-label", "Modellierfläche mit Paketen");
    const svg = svgEl("svg", { role: "group", "aria-label": "UML-Komponentendiagramm", preserveAspectRatio: "xMidYMid meet" }, "ar-svg");
    rahmen.appendChild(svg);
    let fl = null;
    buehne.append(rahmen, zoomLeiste(() => fl, "Zoom"));
    const panel = erzeugen("div", "ar-uf-panel");
    panel.setAttribute("aria-label", "Eigenschaften");
    arbeit.append(pal, buehne, panel);
    const liste = erzeugen("details", "ar-ed-liste");
    liste.innerHTML = "<summary>Modell als Liste</summary>";
    const listeInhalt = erzeugen("div", "ar-ed-liste-inhalt");
    liste.appendChild(listeInhalt);
    el.append(leiste, status, arbeit, liste, live);
    const melden = (t) => { status.textContent = t; };

    // Palette
    const palKnoepfe = {};
    L.palette.forEach((p) => {
      const b = knopf('<span class="ar-uf-chip ' + "ar-r-" + (p.rolle || ROLLE_VON_TYP[p.typ] || "extern") + '"><span class="ar-uf-chip-ikon" aria-hidden="true">' +
        '<svg viewBox="0 0 16 13"><rect x="4.5" y=".5" width="11" height="12" rx="1.5"/><rect x=".5" y="3" width="7" height="2.6" rx=".6"/><rect x=".5" y="7.2" width="7" height="2.6" rx=".6"/></svg></span>' +
        esc(ohneTags(p.name)) + "</span>", "ar-uf-pal", { "aria-pressed": "false" });
      if (p.info) b.title = ohneTags(p.info);
      palKnoepfe[p.id] = b;
      palListe.appendChild(b);
      ziehenAusPalette(b, p);
      b.addEventListener("click", () => {
        if (b.dataset.gezogen) { delete b.dataset.gezogen; return; }
        if (m.elemente.some((e) => e.id === p.id)) { waehlen(p.id); fokus(p.id); return; }
        modus = { art: "platzieren", item: p };
        el.classList.add("ar-platzieren");
        Object.keys(palKnoepfe).forEach((k) => palKnoepfe[k].setAttribute("aria-pressed", String(k === p.id)));
        zeichnen();
        const erstes = Object.keys(szene.gruppenG)[0];
        fokus(paketZiel(erstes));
        melden("«" + ohneTags(p.name) + "»: Wähle das Paket (antippen, oder Pfeiltasten und Enter). Escape bricht ab.");
      });
    });

    function sichern() { verlauf.push(JSON.stringify({ m: m, b: beschreibungWahl })); if (verlauf.length > 60) verlauf.shift(); }
    function geaendert() {
      markierung = null;
      geister = [];
      zeichnen();
      panelZeigen();
      if (opt.onChange) opt.onChange();
    }
    function modellVoll() {
      return {
        notation: "uml-komponenten", pakete: L.pakete,
        elemente: m.elemente.map((e) => { const k = Object.assign({}, e); if (!k.in) delete k.in; delete k.fest; return k; }),
        verbindungen: m.verbindungen.map((v) => ({ id: v.id, von: v.von, nach: v.nachSch ? v.nach + "#" + v.nachSch : v.nach, art: v.art, protokoll: v.protokoll, format: v.format, label: [v.protokoll, v.format].filter(Boolean).join(" · ") })),
      };
    }
    function setzen(item, paket) {
      if (!istPaket(paket) && !(frei && paket === FREI)) { if (paket === FREI) melden("Hier gibt es keine freie Fläche: Leg die Komponente in ein Paket."); return; }
      if (istFest(item.id)) { melden("«" + ohneTags(item.name) + "» ist vorgegeben und bleibt, wo es ist."); return; }
      sichern();
      const da = m.elemente.find((e) => e.id === item.id);
      if (da) { da.in = paket; melden("«" + ohneTags(item.name) + "» liegt jetzt in «" + name(paket) + "»."); }
      else {
        m.elemente.push({ id: item.id, typ: item.typ, rolle: item.rolle || ROLLE_VON_TYP[item.typ] || "extern", name: item.name, in: paket, stereotyp: "", schnittstellen: [] });
        melden("«" + ohneTags(item.name) + "» liegt in «" + name(paket) + "». Wähle jetzt den Stereotyp.");
      }
      modus = null;
      el.classList.remove("ar-platzieren");
      Object.keys(palKnoepfe).forEach((k) => palKnoepfe[k].setAttribute("aria-pressed", "false"));
      auswahl = item.id; kanteWahl = null;
      geaendert();
      fokus(item.id);
    }
    function entfernen() {
      if (kanteWahl) {
        const kv = m.verbindungen.find((v) => v.id === kanteWahl);
        if (kv && kv.fest) { melden("Diese Verbindung ist vorgegeben und bleibt."); return; }
        sichern();
        m.verbindungen = m.verbindungen.filter((v) => v.id !== kanteWahl);
        kanteWahl = null;
        geaendert();
        melden("Verbindung entfernt.");
        rahmen.focus();
        return;
      }
      if (!auswahl || istPaket(auswahl)) { melden("Wähle zuerst eine Komponente oder Verbindung."); return; }
      if (istFest(auswahl)) { melden("«" + name(auswahl) + "» ist vorgegeben und bleibt."); return; }
      sichern();
      const weg = auswahl;
      m.elemente = m.elemente.filter((e) => e.id !== weg);
      m.verbindungen = m.verbindungen.filter((v) => v.von !== weg && v.nach !== weg);
      delete beschreibungWahl[weg];
      auswahl = null;
      geaendert();
      melden("«" + name(weg) + "» entfernt.");
      if (palKnoepfe[weg]) palKnoepfe[weg].focus();
    }
    function verbinden(von, nach, sch) {
      if (von === nach) { melden("Eine Verbindung braucht zwei verschiedene Teile."); return; }
      sichern();
      let n = 1;
      while (m.verbindungen.some((v) => v.id === "u" + n)) n++;
      const art = istPaket(von) || istPaket(nach) ? "abhaengigkeit" : "assoziation";
      const v = { id: "u" + n, von: von, nach: nach, nachSch: sch || null, art: art, protokoll: "", format: "" };
      m.verbindungen.push(v);
      modus = null;
      el.classList.remove("ar-verbinden");
      bVerb.setAttribute("aria-pressed", "false");
      auswahl = null; kanteWahl = v.id;
      geaendert();
      melden("Verbindung «" + name(von) + " → " + name(nach) + (sch ? " (" + schName(nach, sch) + ")" : "") + "». Beschrifte sie mit Protokoll und Format.");
      const p = $("select", panel);
      if (p) p.focus();
    }
    function schName(id, sch) { const e = m.elemente.find((x) => x.id === id); const s2 = e && e.schnittstellen.find((x) => x.id === sch); return s2 ? s2.name : sch; }
    function verbindenStart(von) {
      if (!von) { melden("Wähle zuerst Start-Komponente oder -Paket, dann «Verbinden»."); return; }
      modus = { art: "verbinden", von: von };
      el.classList.add("ar-verbinden");
      bVerb.setAttribute("aria-pressed", "true");
      zeichnen();
      melden("Verbinden ab «" + name(von) + "»: Wähle das Ziel (Komponente, Ball oder Paket). Escape bricht ab.");
    }

    // Zeichnen
    let szene = null, lay = null, routen = {}, letzteBox = null;
    function zeichnen() {
      const n = modellPruefen(modellVoll(), "spiel");
      if (!n) return;
      lay = umlLayout(n, { leerMin: { w: 200, h: 64 } });
      routen = kantenRouten(lay, n.verbindungen);
      const labels = labelsSetzen(lay, n.verbindungen, routen);
      szene = szeneZeichnen(svg, n, lay, routen, labels, { uid: uid });
      if (!fl) fl = zoomFlaeche(rahmen, svg, { inhalt: lay.box, kMin: 0.5, kMax: 1, minHoehe: 300, darfZiehen: (ev) => !ev.target.closest(".ar-el, .ar-gruppe .ar-uml-reiter") });
      else if (!letzteBox || Math.abs(letzteBox.w - lay.box.w) > 4 || Math.abs(letzteBox.h - lay.box.h) > 4) fl.setzeInhalt(lay.box);
      letzteBox = lay.box;
      // leere Pakete als Ablagefelder
      Object.keys(szene.gruppenG).forEach((pid) => {
        const g = szene.gruppenG[pid], r = lay.gr[pid];
        const leer = !m.elemente.some((e) => e.in === pid) && !L.pakete.some((p) => p.in === pid);
        g.classList.add("ar-ablage");
        if (leer) {
          const t = svgEl("text", { x: f1(r.w / 2), y: f1(U.TAB + (r.h - U.TAB) / 2 + 4), "text-anchor": "middle" }, "ar-ablage-text");
          t.textContent = "Komponente hierher ziehen";
          g.appendChild(t);
        }
        g.setAttribute("aria-label", "Paket " + name(pid) + (leer ? ", leer" : ", enthält " + m.elemente.filter((e) => e.in === pid).map((e) => name(e.id)).join(", ")) + (modus && modus.art === "platzieren" ? ". Enter legt «" + ohneTags(modus.item.name) + "» hier ab." : ""));
        paketBedienung(pid, g);
      });
      Object.keys(szene.elG).forEach((id) => { if (!istPaket(id)) elementBedienung(id, szene.elG[id]); });
      Object.keys(szene.kantenG).forEach((kid) => {
        szene.kantenG[kid].classList.toggle("ar-gewaehlt", kid === kanteWahl);
        szene.kantenG[kid].addEventListener("click", (ev) => { ev.stopPropagation(); auswahl = null; kanteWahl = kid; zeichnen(); panelZeigen(); });
      });
      if (auswahl && szene.elG[auswahl]) szene.elG[auswahl].classList.add("ar-gewaehlt");
      if (modus && modus.art === "verbinden" && szene.elG[modus.von]) szene.elG[modus.von].classList.add("ar-quelle");
      if (markierung) markierungAnwenden();
      geister.forEach((gv) => {
        const r = kantenRouten(lay, [{ id: "geist", von: gv.von, nach: gv.nach, nachSch: gv.nachSch || null, art: "assoziation" }]);
        if (r.geist) szene.effekte.appendChild(svgEl("path", { d: pfadD(r.geist.punkte, 7) }, "ar-geist ar-tipp-geist"));
      });
      Object.keys(palKnoepfe).forEach((k) => palKnoepfe[k].classList.toggle("ar-liegt", m.elemente.some((e) => e.id === k)));
      bWeg.disabled = !((kanteWahl && !(m.verbindungen.find((v) => v.id === kanteWahl) || {}).fest) || (auswahl && !istPaket(auswahl) && !istFest(auswahl)));
      Object.keys(szene.elG).forEach((id) => { if (istFest(id)) szene.elG[id].classList.add("ar-fest-uml"); });
      bUndo.disabled = !verlauf.length;
      listeZeichnen();
    }
    const paketZiel = (pid) => pid;
    function fokus(id) {
      const g = szene && szene.elG[id];
      if (g) { try { g.focus({ preventScroll: true }); } catch (e) { g.focus(); } if (fl) fl.zeige(lay.el[id] || lay.gr[id]); }
    }
    function paketBedienung(pid, g) {
      const aktion = () => {
        if (modus && modus.art === "platzieren") { setzen(modus.item, pid); return; }
        if (modus && modus.art === "verbinden") { verbinden(modus.von, pid, null); return; }
        auswahl = auswahl === pid ? null : pid; kanteWahl = null;
        zeichnen(); panelZeigen(); fokus(pid);
      };
      g.addEventListener("click", (ev) => { if (ev.target.closest(".ar-el")) return; ev.stopPropagation(); aktion(); });
      g.addEventListener("keydown", (ev) => {
        if (ev.target !== g) return;
        if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); aktion(); }
        else if (ev.key === "Escape") { ev.preventDefault(); abbrechen(); }
        else if (modus && /^Arrow/.test(ev.key)) {
          ev.preventDefault();
          const ids = Object.keys(szene.gruppenG).concat(frei ? [FREI] : []);
          const i = ids.indexOf(pid) + (ev.key === "ArrowDown" || ev.key === "ArrowRight" ? 1 : -1);
          const ziel = ids[(i + ids.length) % ids.length];
          if (ziel === FREI) { rahmen.focus(); melden("Freie Fläche ausserhalb der Pakete. Enter legt hier ab."); }
          else { fokus(ziel); melden("Paket «" + name(ziel) + "»."); }
        }
      });
    }
    function elementBedienung(id, g) {
      const aktion = (sch) => {
        if (modus && modus.art === "verbinden") { verbinden(modus.von, id, sch || null); return; }
        if (modus && modus.art === "platzieren") { const e = m.elemente.find((x) => x.id === id); if (e) setzen(modus.item, e.in); return; }
        auswahl = auswahl === id ? null : id; kanteWahl = null;
        zeichnen(); panelZeigen(); fokus(id);
      };
      g.addEventListener("click", (ev) => {
        ev.stopPropagation();
        if (g.dataset.gezogen) { delete g.dataset.gezogen; return; }
        const ball = ev.target.closest(".ar-uml-ball");
        aktion(ball ? ball.getAttribute("data-sch") : null);
      });
      g.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); aktion(null); }
        else if (ev.key === "Escape") { ev.preventDefault(); abbrechen(); }
        else if ((ev.key === "v" || ev.key === "V") && !ev.ctrlKey && !ev.metaKey) { ev.preventDefault(); verbindenStart(id); }
        else if ((ev.key === "Delete" || ev.key === "Backspace") && auswahl === id) { ev.preventDefault(); entfernen(); }
      });
      // in ein anderes Paket ziehen
      let start = null, geist = null;
      g.addEventListener("pointerdown", (ev) => { if (ev.button > 0 || modus || istFest(id)) return; start = { x: ev.clientX, y: ev.clientY, id: ev.pointerId }; });
      g.addEventListener("pointermove", (ev) => {
        if (!start || start.id !== ev.pointerId) return;
        if (!geist && Math.hypot(ev.clientX - start.x, ev.clientY - start.y) > 7) {
          try { g.setPointerCapture(ev.pointerId); } catch (e) { /* egal */ }
          geist = erzeugen("div", "ar-zieh-geist ar-uf-geist", '<span class="ar-uf-chip ' + klasseVon(m.elemente.find((x) => x.id === id)) + '">' + esc(name(id)) + "</span>");
          document.body.appendChild(geist);
          el.classList.add("ar-platzieren");
        }
        if (geist) { ev.preventDefault(); geist.style.left = ev.clientX + "px"; geist.style.top = ev.clientY + "px"; zielHervorheben(paketUnter(ev)); }
      });
      const ende = (ev) => {
        if (!start || start.id !== ev.pointerId) return;
        start = null;
        if (!geist) return;
        geist.remove(); geist = null;
        el.classList.remove("ar-platzieren");
        g.dataset.gezogen = "1";
        const pid = paketUnter(ev);
        zielHervorheben(null);
        if (pid !== null) setzen(palNach[id], pid); else zeichnen();
      };
      g.addEventListener("pointerup", ende);
      g.addEventListener("pointercancel", ende);
    }
    function paketUnter(ev) {
      const unter = document.elementFromPoint(ev.clientX, ev.clientY);
      const g = unter && unter.closest ? unter.closest(".ar-gruppe") : null;
      if (g && svg.contains(g)) return g.getAttribute("data-id");
      const e = unter && unter.closest ? unter.closest(".ar-el") : null;
      if (e && svg.contains(e)) { const x = m.elemente.find((y) => y.id === e.getAttribute("data-id")); return x ? x.in : null; }
      if (frei && unter && rahmen.contains(unter)) return FREI;
      return null;
    }
    function zielHervorheben(pid) { if (!szene) return; Object.keys(szene.gruppenG).forEach((k) => szene.gruppenG[k].classList.toggle("ar-ablage-ziel", k === pid)); }
    function ziehenAusPalette(b, p) {
      let start = null, geist = null;
      b.addEventListener("pointerdown", (ev) => {
        if (ev.button > 0 || m.elemente.some((e) => e.id === p.id)) return;
        start = { x: ev.clientX, y: ev.clientY, id: ev.pointerId };
        try { b.setPointerCapture(ev.pointerId); } catch (e) { /* egal */ }
      });
      b.addEventListener("pointermove", (ev) => {
        if (!start || start.id !== ev.pointerId) return;
        if (!geist && Math.hypot(ev.clientX - start.x, ev.clientY - start.y) > 6) {
          try { b.setPointerCapture(ev.pointerId); } catch (e) { /* egal */ }
          geist = erzeugen("div", "ar-zieh-geist ar-uf-geist", b.innerHTML);
          document.body.appendChild(geist);
          el.classList.add("ar-platzieren");
        }
        if (geist) { ev.preventDefault(); geist.style.left = ev.clientX + "px"; geist.style.top = ev.clientY + "px"; zielHervorheben(paketUnter(ev)); }
      });
      const ende = (ev, abbruch) => {
        if (!start || start.id !== ev.pointerId) return;
        start = null;
        if (!geist) return;
        geist.remove(); geist = null;
        el.classList.remove("ar-platzieren");
        b.dataset.gezogen = "1";
        setTimeout(() => delete b.dataset.gezogen, 60);
        const pid = abbruch ? null : paketUnter(ev);
        zielHervorheben(null);
        if (pid !== null) setzen(p, pid); else melden("Nicht abgelegt: Zieh die Komponente auf ein Paket.");
      };
      b.addEventListener("pointerup", (ev) => ende(ev, false));
      b.addEventListener("pointercancel", (ev) => ende(ev, true));
    }
    function abbrechen() {
      const war = modus;
      modus = null;
      el.classList.remove("ar-platzieren", "ar-verbinden");
      bVerb.setAttribute("aria-pressed", "false");
      Object.keys(palKnoepfe).forEach((k) => palKnoepfe[k].setAttribute("aria-pressed", "false"));
      zeichnen();
      melden("Abgebrochen.");
      if (war && war.art === "platzieren") palKnoepfe[war.item.id].focus();
    }
    svg.addEventListener("click", () => {
      if (modus && modus.art === "platzieren" && frei) { setzen(modus.item, FREI); return; }
      if (modus) return;
      if (auswahl || kanteWahl) { auswahl = null; kanteWahl = null; zeichnen(); panelZeigen(); }
    });
    rahmen.addEventListener("keydown", (ev) => {
      if (ev.target !== rahmen || !modus || modus.art !== "platzieren") return;
      if (ev.key === "Enter" && frei) { ev.preventDefault(); setzen(modus.item, FREI); }
      else if (ev.key === "Escape") { ev.preventDefault(); abbrechen(); }
      else if (/^Arrow/.test(ev.key)) { ev.preventDefault(); ev.stopImmediatePropagation(); fokus(Object.keys(szene.gruppenG)[0]); }
    }, true);

    // Eigenschaften
    function feld(lab, inhalt) {
      const id = neueId("f");
      const d = erzeugen("div", "ar-uf-feld");
      d.innerHTML = '<label for="' + id + '">' + lab + "</label>";
      inhalt.id = id;
      d.appendChild(inhalt);
      return d;
    }
    function auswahlFeld(werte, wert) {
      const s2 = erzeugen("select", "btn");
      werte.forEach(([v, t]) => { const o = erzeugen("option", null, esc(t)); o.value = v; if (v === wert) o.selected = true; s2.appendChild(o); });
      return s2;
    }
    function panelZeigen() {
      panel.innerHTML = "";
      if (kanteWahl) {
        const v = m.verbindungen.find((x) => x.id === kanteWahl);
        if (!v) return;
        if (v.fest) {
          panel.appendChild(erzeugen("p", "ar-uf-titel", "Verbindung · vorgegeben"));
          panel.appendChild(erzeugen("h4", null, esc(name(v.von)) + " → " + esc(name(v.nach))));
          panel.appendChild(erzeugen("p", "hint", esc([v.protokoll, v.format].filter(Boolean).join(" · ") || "ohne Beschriftung") + ". Vorgegebene Verbindungen bleiben."));
          return;
        }
        panel.appendChild(erzeugen("p", "ar-uf-titel", "Verbindung"));
        panel.appendChild(erzeugen("h4", null, esc(name(v.von)) + ' <span aria-hidden="true">→</span><span class="sr-only">nach</span> ' + esc(name(v.nach))));
        const art = auswahlFeld([["assoziation", "Assoziation (Linie)"], ["abhaengigkeit", "Abhängigkeit (gestrichelt, Pfeil)"]], v.art);
        art.addEventListener("change", () => { sichern(); v.art = art.value; geaendert(); });
        panel.appendChild(feld("Art", art));
        const ziel = m.elemente.find((x) => x.id === v.nach);
        if (ziel && ziel.schnittstellen.length) {
          const sch = auswahlFeld([["", "ohne Schnittstelle"]].concat(ziel.schnittstellen.map((x) => [x.id, "Ball «" + x.name + "»"])), v.nachSch || "");
          sch.addEventListener("change", () => { sichern(); v.nachSch = sch.value || null; geaendert(); });
          panel.appendChild(feld("Ziel-Schnittstelle", sch));
        }
        const prot = auswahlFeld([["", "– Protokoll wählen –"]].concat(L.protokolle.map((x) => [x, x])), v.protokoll);
        prot.addEventListener("change", () => { sichern(); v.protokoll = prot.value; geaendert(); melden("Protokoll: " + (prot.value || "keins") + "."); });
        panel.appendChild(feld("Protokoll", prot));
        const fmt = erzeugen("input");
        fmt.type = "text"; fmt.maxLength = 30; fmt.value = v.format || ""; fmt.placeholder = "z. B. JSON, XML, UBL";
        fmt.setAttribute("list", uid + "-formate");
        fmt.addEventListener("change", () => { sichern(); v.format = fmt.value.trim(); geaendert(); melden("Format: " + (v.format || "keins") + "."); });
        panel.appendChild(feld("Format / Semantik (frei)", fmt));
        if (!$("#" + uid + "-formate")) {
          const dl = erzeugen("datalist");
          dl.id = uid + "-formate";
          ["JSON", "XML", "AppDef/JSON", "UBL", "IDoc", "ebXML", "CSV", "HTML"].forEach((x) => { const o = erzeugen("option"); o.value = x; dl.appendChild(o); });
          el.appendChild(dl);
        }
        const r = erzeugen("div", "row");
        const um = knopf("Richtung umkehren", "ar-klein");
        um.addEventListener("click", () => { if (v.nachSch) { melden("Mit Schnittstelle lässt sich die Richtung nicht umkehren."); return; } sichern(); const t = v.von; v.von = v.nach; v.nach = t; geaendert(); });
        const weg = knopf("Verbindung entfernen", "ar-klein");
        weg.addEventListener("click", entfernen);
        r.append(um, weg);
        panel.appendChild(r);
        return;
      }
      if (auswahl && istPaket(auswahl)) {
        panel.appendChild(erzeugen("p", "ar-uf-titel", "Paket"));
        panel.appendChild(erzeugen("h4", null, esc(name(auswahl))));
        panel.appendChild(erzeugen("p", "hint", "Pakete sind vorgegeben. Eine Abhängigkeit zwischen Paketen (gestrichelt) ziehst du mit «Verbinden»."));
        const b = knopf("Abhängigkeit ziehen …", "ar-klein");
        b.addEventListener("click", () => verbindenStart(auswahl));
        panel.appendChild(b);
        return;
      }
      const e = auswahl && m.elemente.find((x) => x.id === auswahl);
      if (!e) {
        panel.innerHTML = '<p class="ar-uf-titel">Eigenschaften</p><p class="hint">Wähle eine Komponente: Hier setzt du Stereotyp, Schnittstellen und Beschreibung. Eine gewählte Verbindung beschriftest du hier mit Protokoll und Format.</p>';
        return;
      }
      const p = palNach[e.id];
      panel.appendChild(erzeugen("p", "ar-uf-titel", "Komponente · " + esc(ROLLE[e.rolle].name) + (istFest(e.id) ? " · vorgegeben" : "")));
      panel.appendChild(erzeugen("h4", null, esc(ohneTags(e.name))));
      if (istFest(e.id)) {
        panel.appendChild(erzeugen("p", "hint", "Vorgegeben: liegt fest in «" + esc(name(e.in)) + "»" + (e.stereotyp ? ", «" + esc(e.stereotyp) + "»" : "") + (e.schnittstellen.length ? ", bietet " + e.schnittstellen.map((x) => esc(x.name)).join(", ") : "") + ". Du kannst es verbinden."));
        const vb0 = knopf("Verbinden …", "ar-klein");
        vb0.addEventListener("click", () => verbindenStart(e.id));
        panel.appendChild(vb0);
        return;
      }
      const st = auswahlFeld([["", "(kein Stereotyp)"]].concat((p.stereotypen || []).map((x) => [x, "«" + x + "»"])), e.stereotyp);
      st.addEventListener("change", () => { sichern(); e.stereotyp = st.value; geaendert(); melden("Stereotyp: " + (st.value ? "«" + st.value + "»" : "keiner") + "."); });
      panel.appendChild(feld("Stereotyp", st));
      const pk = auswahlFeld((frei ? [[FREI, "(freie Fläche, ausserhalb der Pakete)"]] : []).concat(L.pakete.map((x) => [x.id, ohneTags(x.name)])), e.in || FREI);
      pk.addEventListener("change", () => setzen(p, pk.value));
      panel.appendChild(feld("Paket", pk));
      // Schnittstellen
      const sw = erzeugen("div", "ar-uf-sch");
      sw.appendChild(erzeugen("p", "ar-uf-label", "Bereitgestellte Schnittstellen (Ball)"));
      const ul = erzeugen("ul");
      e.schnittstellen.forEach((x) => {
        const li = erzeugen("li", null, "<span>○ " + esc(x.name) + "</span>");
        const w = knopf("Entfernen", "ar-klein", { "aria-label": "Schnittstelle " + x.name + " entfernen" });
        w.addEventListener("click", () => { sichern(); e.schnittstellen = e.schnittstellen.filter((y) => y !== x); m.verbindungen.forEach((v) => { if (v.nach === e.id && v.nachSch === x.id) v.nachSch = null; }); geaendert(); });
        li.appendChild(w);
        ul.appendChild(li);
      });
      if (!e.schnittstellen.length) ul.appendChild(erzeugen("li", "hint", "keine"));
      sw.appendChild(ul);
      const vorschlaege = (p.schnittstellen || []).filter((x) => !e.schnittstellen.some((y) => y.id === x.id));
      const neu = erzeugen("div", "ar-uf-neu");
      const inp = erzeugen("input");
      inp.type = "text"; inp.maxLength = 24; inp.placeholder = vorschlaege.length ? vorschlaege[0].name : "z. B. REST";
      inp.setAttribute("list", uid + "-sch-" + e.id);
      const dl = erzeugen("datalist");
      dl.id = uid + "-sch-" + e.id;
      vorschlaege.concat(L.protokolle.map((x) => ({ name: x }))).forEach((x) => { const o = erzeugen("option"); o.value = x.name; dl.appendChild(o); });
      const add = knopf("Ball hinzufügen", "ar-klein");
      const hinzu = () => {
        const t = inp.value.trim() || (vorschlaege[0] && vorschlaege[0].name) || "";
        if (!t) { inp.focus(); return; }
        const bekannt = (p.schnittstellen || []).find((x) => ohneGuillemets(x.name) === ohneGuillemets(t));
        let id = bekannt ? bekannt.id : t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "api";
        while (e.schnittstellen.some((x) => x.id === id)) id += "-2";
        sichern();
        e.schnittstellen.push({ id: id, name: t });
        geaendert();
        melden("Schnittstelle «" + t + "» an «" + ohneTags(e.name) + "».");
      };
      add.addEventListener("click", hinzu);
      inp.addEventListener("keydown", (ev) => { if (ev.key === "Enter") { ev.preventDefault(); hinzu(); } });
      const sid = neueId("f");
      inp.id = sid;
      neu.innerHTML = '<label for="' + sid + '" class="sr-only">Name der neuen Schnittstelle</label>';
      neu.append(inp, dl, add);
      sw.appendChild(neu);
      panel.appendChild(sw);
      // Beschreibung
      const be = L.loesung.beschreibungen.find((x) => x.id === e.id);
      if (be) {
        const fs = erzeugen("fieldset", "ar-uf-beschr");
        fs.appendChild(erzeugen("legend", null, "Beschreibung wählen"));
        be.optionen.forEach((o, i) => {
          const id = neueId("b");
          const d = erzeugen("div", "ar-uf-radio");
          d.innerHTML = '<input type="radio" name="' + uid + "-b-" + e.id + '" id="' + id + '"' + (beschreibungWahl[e.id] === i ? " checked" : "") + '><label for="' + id + '">' + o + "</label>";
          $("input", d).addEventListener("change", () => { sichern(); beschreibungWahl[e.id] = i; if (opt.onChange) opt.onChange(); melden("Beschreibung gewählt."); });
          fs.appendChild(d);
        });
        panel.appendChild(fs);
      }
      const r = erzeugen("div", "row");
      const vb = knopf("Verbinden …", "ar-klein");
      vb.addEventListener("click", () => verbindenStart(e.id));
      const wg = knopf("Entfernen", "ar-klein");
      wg.addEventListener("click", entfernen);
      r.append(vb, wg);
      panel.appendChild(r);
      formelnSetzen(panel);
    }
    function listeZeichnen() {
      let h = "<h4>Komponenten (" + m.elemente.length + ")</h4><ul>" + (m.elemente.map((e) => '<li class="' + klasseVon(e) + '"><span class="ar-farbpunkt" aria-hidden="true"></span>' +
        esc(ohneTags(e.name)) + ' <span class="hint">' + (e.stereotyp ? "«" + esc(e.stereotyp) + "» · " : "") + "in " + esc(name(e.in)) +
        (e.schnittstellen.length ? " · bietet " + e.schnittstellen.map((x) => esc(x.name)).join(", ") : "") + "</span></li>").join("") || '<li class="hint">noch keine</li>') + "</ul>";
      h += "<h4>Verbindungen (" + m.verbindungen.length + ")</h4><ul>" + (m.verbindungen.map((v) => "<li>" + esc(name(v.von)) + " → " + esc(name(v.nach)) + (v.nachSch ? " (" + esc(schName(v.nach, v.nachSch)) + ")" : "") +
        ' <span class="hint">· ' + esc(ARTEN[v.art].name) + (v.protokoll || v.format ? " · " + esc([v.protokoll, v.format].filter(Boolean).join(" · ")) : " · ohne Beschriftung") + "</span></li>").join("") || '<li class="hint">noch keine</li>') + "</ul>";
      listeInhalt.innerHTML = h;
    }

    bVerb.addEventListener("click", () => { if (modus && modus.art === "verbinden") { abbrechen(); return; } verbindenStart(auswahl); });
    bWeg.addEventListener("click", entfernen);
    bUndo.addEventListener("click", () => {
      if (!verlauf.length) return;
      const d = JSON.parse(verlauf.pop());
      m = d.m;
      Object.keys(beschreibungWahl).forEach((k) => delete beschreibungWahl[k]);
      Object.assign(beschreibungWahl, d.b);
      auswahl = null; kanteWahl = null; modus = null;
      geaendert();
      melden("Rückgängig gemacht.");
      if (bUndo.disabled) rahmen.focus();
    });
    el.addEventListener("keydown", (ev) => {
      if ((ev.ctrlKey || ev.metaKey) && (ev.key === "z" || ev.key === "Z") && ev.target.tagName !== "INPUT") { ev.preventDefault(); bUndo.click(); }
    });

    // Bewertung nach Kriterien (Raster mit Teilpunkten, Fallen mit Abzug)
    function bewerten() {
      const sol0 = L.loesung;
      const g = L.gewichte;
      const krit = {};
      const marken = { el: {}, pk: {}, v: {} };
      const hinweise = { komponenten: [], pakete: [], stereotypen: [], verbindungen: [], beschriftungen: [], beschreibungen: [] };
      // Vorgegebenes ist geschenkt: zählt weder als Punkt noch als Fehler
      const teil = (ref) => { const t = String(ref).split("#"); return { el: t[0], sch: t[1] || null }; };
      const festeV = m.verbindungen.filter((u) => u.fest);
      const geschenkt = (v) => festeV.some((u) => [v].concat(v.alternativen || []).some((w) => { const a = teil(w.von), b2 = teil(w.nach); return u.von === a.el && u.nach === b2.el && (!b2.sch || u.nachSch === b2.sch); }));
      const sol = { elemente: sol0.elemente.filter((x) => !istFest(x.id)), verbindungen: sol0.verbindungen.filter((v) => !geschenkt(v)), beschreibungen: sol0.beschreibungen || [] };
      const eigene = m.elemente.filter((e) => !istFest(e.id));
      const da = new Set(eigene.map((e) => e.id));
      const sollIds = new Set(sol0.elemente.map((x) => x.id));
      // Komponenten
      const fehlt = sol.elemente.filter((x) => !da.has(x.id));
      const extra = eigene.filter((e) => !sollIds.has(e.id));
      const fallen = extra.filter((e) => palNach[e.id] && palNach[e.id].falle);
      const okK = sol.elemente.length - fehlt.length;
      krit.komponenten = { ok: okK, n: sol.elemente.length, s: sol.elemente.length ? Math.max(0, (okK - 0.5 * (extra.length - fallen.length)) / sol.elemente.length) : 1, leer: !sol.elemente.length && !extra.length };
      if (fehlt.length) hinweise.komponenten.push((fehlt.length > 1 ? "Es fehlen " + fehlt.length + " Komponenten" : "Es fehlt 1 Komponente") + ". Was verlangt die Referenzarchitektur noch?");
      extra.filter((e) => !(palNach[e.id] && palNach[e.id].falle)).forEach((e) => { hinweise.komponenten.push("«" + esc(name(e.id)) + "» gehört nicht in dieses Modell."); marken.el[e.id] = { ok: false, t: "überflüssig" }; });
      // Pakete und Stereotypen (Lösungs-Paket null = ausserhalb der Pakete)
      let okP = 0, okS = 0;
      const nS = sol.elemente.filter((x) => x.stereotyp !== undefined && x.stereotyp !== "").length;
      sol.elemente.forEach((x) => {
        const e = eigene.find((y) => y.id === x.id);
        if (!e) return;
        const pOk = x.paket === null ? !e.in : !x.paket || e.in === x.paket;
        if (pOk) okP++;
        else hinweise.pakete.push("«" + esc(name(x.id)) + "» gehört " + (x.paket === null ? "ausserhalb der Pakete" : "in «" + esc(name(x.paket)) + "»") + ", nicht " + (e.in ? "in «" + esc(name(e.in)) + "»" : "auf die freie Fläche") + ".");
        let sOk = true;
        if (x.stereotyp !== undefined && x.stereotyp !== "") {
          sOk = ohneGuillemets(e.stereotyp) === ohneGuillemets(x.stereotyp);
          if (sOk) okS++; else hinweise.stereotypen.push("«" + esc(name(x.id)) + "»: " + (e.stereotyp ? "Stereotyp «" + esc(e.stereotyp) + "» passt nicht." : "Stereotyp fehlt (technologiespezifisch ist Pflicht)."));
        }
        marken.el[x.id] = { ok: pOk && sOk, t: !pOk ? "falsches Paket" : !sOk ? "Stereotyp" : "richtig" };
      });
      krit.pakete = { ok: okP, n: sol.elemente.length, s: sol.elemente.length ? okP / sol.elemente.length : 1, leer: !sol.elemente.length };
      krit.stereotypen = { ok: okS, n: nS, s: nS ? okS / nS : 1, leer: !nS };
      // Verbindungen: Varianten (alternativen) und gleiche Paare über Schnittstelle/Protokoll zuordnen
      const soll = sol.verbindungen.map((v) => ({ v: v, varianten: [v].concat(v.alternativen || []).map((w) => ({ w: Object.assign({ art: v.art || "assoziation" }, w), a: teil(w.von), b: teil(w.nach) })), gefunden: null, variante: null }));
      const passt = (u, x) => (x.a.el === u.von && x.b.el === u.nach) || (x.w.art !== "abhaengigkeit" && x.a.el === u.nach && x.b.el === u.von);
      const guete = (u, x) => (x.b.sch ? (u.nachSch === x.b.sch ? 4 : 0) : 2) + (x.w.protokoll ? (ohneGuillemets(u.protokoll) === ohneGuillemets(x.w.protokoll) ? 2 : 0) : 1) + (x.w.art === u.art ? 1 : 0) + (x.a.el === u.von ? 0.5 : 0);
      const nutzer = m.verbindungen.filter((u) => !u.fest);
      const paare = [];
      nutzer.forEach((u) => soll.forEach((t) => t.varianten.forEach((x) => { if (passt(u, x)) paare.push({ u: u, t: t, x: x, q: guete(u, x) }); })));
      paare.sort((p1, p2) => p2.q - p1.q);
      const vergeben = new Set();
      paare.forEach((pp) => { if (vergeben.has(pp.u.id) || pp.t.gefunden) return; pp.t.gefunden = pp.u; pp.t.variante = pp.x; vergeben.add(pp.u.id); });
      let punkte = 0, extraV = 0;
      nutzer.forEach((u) => {
        const t = soll.find((s2) => s2.gefunden === u);
        if (!t) {
          extraV++;
          marken.v[u.id] = { ok: false, t: "gibt es so nicht" };
          hinweise.verbindungen.push("«" + esc(name(u.von)) + " – " + esc(name(u.nach)) + "» gehört nicht ins Modell.");
          return;
        }
        const x = t.variante;
        let p = 1;
        if (x.w.art !== u.art) { p -= 0.5; hinweise.verbindungen.push("«" + esc(name(u.von)) + " – " + esc(name(u.nach)) + "»: falsche Art (" + ARTEN[x.w.art].name + " erwartet)."); }
        if (x.b.sch && u.nachSch !== x.b.sch) { p -= 0.25; hinweise.verbindungen.push("«" + esc(name(u.von)) + " – " + esc(name(u.nach)) + "»: Verbinde mit dem Ball «" + esc(schNameSoll(x.b.el, x.b.sch)) + "» (Socket am Aufrufer)."); }
        punkte += p;
        marken.v[u.id] = { ok: p === 1, t: p === 1 ? "richtig" : "teilweise" };
      });
      const nV = soll.length;
      const fehltV = soll.filter((s2) => !s2.gefunden);
      if (fehltV.length) hinweise.verbindungen.push((fehltV.length > 1 ? "Es fehlen " + fehltV.length + " Verbindungen" : "Es fehlt 1 Verbindung") + ".");
      krit.verbindungen = { ok: Math.round(punkte * 10) / 10, n: nV, s: nV ? Math.max(0, (punkte - 0.5 * extraV) / nV) : extraV ? 0 : 1, leer: !nV && !extraV };
      const mitProt = soll.filter((s2) => (s2.variante ? s2.variante.w : s2.v).protokoll);
      let okB = 0;
      mitProt.forEach((s2) => {
        if (!s2.gefunden) return;
        const u = s2.gefunden, w = s2.variante.w;
        const erl = [w.protokoll].concat(w.protokollAlternativen || []).map(ohneGuillemets);
        if (erl.indexOf(ohneGuillemets(u.protokoll)) >= 0) okB++;
        else {
          hinweise.beschriftungen.push("«" + esc(name(u.von)) + " – " + esc(name(u.nach)) + "»: " + (u.protokoll ? "Protokoll «" + esc(u.protokoll) + "» passt nicht." : "Protokoll fehlt. Jede Verbindung wird beschriftet."));
          if (marken.v[u.id]) marken.v[u.id] = { ok: false, t: "Beschriftung" };
        }
      });
      krit.beschriftungen = { ok: okB, n: mitProt.length, s: mitProt.length ? okB / mitProt.length : 1, leer: !mitProt.length };
      const be = sol.beschreibungen || [];
      const okBe = be.filter((b) => beschreibungWahl[b.id] === b.richtig).length;
      be.forEach((b) => { if (beschreibungWahl[b.id] !== b.richtig) hinweise.beschreibungen.push("«" + esc(name(b.id)) + "»: " + (beschreibungWahl[b.id] === undefined ? "noch keine Beschreibung gewählt." : "die gewählte Beschreibung trifft nicht zu.")); });
      krit.beschreibungen = { ok: okBe, n: be.length, s: be.length ? okBe / be.length : 1, leer: !be.length };
      // Pakete: ✓, wenn alle erwarteten Komponenten darin richtig liegen
      L.pakete.forEach((p) => {
        const erwartet = sol.elemente.filter((x) => x.paket === p.id);
        const drin = eigene.filter((e) => e.in === p.id);
        if (!erwartet.length && !drin.length) return;
        marken.pk[p.id] = { ok: erwartet.every((x) => drin.some((e) => e.id === x.id)) && drin.every((e) => erwartet.some((x) => x.id === e.id)) };
      });
      // Gesamt
      let summe = 0, gew = 0;
      const liste = KRITERIEN.filter(([k]) => !(krit[k].leer) && (g[k] || 0) > 0).map(([k, t]) => {
        summe += krit[k].s * g[k]; gew += g[k];
        return { id: k, name: t, ok: krit[k].ok, n: krit[k].n, erreicht: krit[k].ok, max: krit[k].n, s: krit[k].s, gewicht: g[k], punkte: Math.round(krit[k].s * g[k] * 10) / 10, hinweise: hinweise[k] };
      });
      const abzug = fallen.map((e) => ({ id: e.id, text: palNach[e.id].falle }));
      fallen.forEach((e) => (marken.el[e.id] = { ok: false, t: "Falle" }));
      const roh = gew ? summe / gew : 1;
      const anteil = Math.max(0, roh - 0.08 * fallen.length);
      const fehler = liste.reduce((a, k) => a + (k.s < 1 ? 1 : 0), 0) + fallen.length;
      return {
        uml: true, kriterien: liste, fallen: abzug, marken: marken, anteil: anteil === 1 && fehler ? 0.999 : anteil,
        richtig: Math.round(anteil * gew * 10), gesamt: Math.round(gew * 10), fehler: fehler,
        fehlendeKomponenten: fehlt.map((x) => x.id), falschesPaket: sol.elemente.filter((x) => { const e = eigene.find((y) => y.id === x.id); return e && (x.paket === null ? !!e.in : x.paket && e.in !== x.paket); }),
        fehlendeVerbindungen: fehltV.map((s) => s.v),
      };
    }
    function schNameSoll(el2, sch) { const p = palNach[el2]; const s2 = p && (p.schnittstellen || []).find((x) => x.id === sch); return s2 ? s2.name : sch; }
    function markierungAnwenden() {
      const mk = markierung;
      Object.keys(mk.el).forEach((id) => {
        const g = szene.elG[id], r = lay.el[id];
        if (!g || !r) return;
        g.classList.add(mk.el[id].ok ? "ar-ok" : "ar-falsch");
        marke(g, r, mk.el[id].ok ? "✓" : "✗", mk.el[id].ok ? "ar-marke-ok" : "ar-marke-falsch", mk.el[id].t);
      });
      Object.keys(mk.pk).forEach((id) => {
        const g = szene.gruppenG[id], r = lay.gr[id];
        if (!g || !r) return;
        g.classList.add(mk.pk[id].ok ? "ar-pk-ok" : "ar-pk-falsch");
        const n = marke(g, r, mk.pk[id].ok ? "✓" : "✗", mk.pk[id].ok ? "ar-marke-ok" : "ar-marke-falsch");
        if (n) n.setAttribute("transform", "translate(" + f1(r.w - 14) + " " + (U.TAB + 12) + ")");
      });
      Object.keys(mk.v).forEach((id) => {
        const kg = szene.kantenG[id], rt = routen[id];
        if (!kg || !rt) return;
        kg.classList.add(mk.v[id].ok ? "ar-ok" : "ar-falsch");
        const p = punktAuf(rt.punkte, polyLaenge(rt.punkte) * 0.5);
        const n = svgEl("g", { transform: "translate(" + f1(p[0]) + " " + f1(p[1]) + ")" }, "ar-marke ar-marke-kante " + (mk.v[id].ok ? "ar-marke-ok" : "ar-marke-falsch"));
        n.innerHTML = '<g class="ar-marke-innen"><circle r="10"/><text y="4.2" text-anchor="middle">' + (mk.v[id].ok ? "✓" : "✗") + "</text><title>" + esc(mk.v[id].t) + "</title></g>";
        szene.effekte.appendChild(n);
      });
    }

    zeichnen();
    panelZeigen();
    melden("Zieh die Komponenten in die passenden Pakete, setz Stereotypen und Schnittstellen, verbinde und beschrifte.");
    return {
      modell: () => kopie(modellVoll()),
      bewerten: bewerten,
      markieren: (e) => { markierung = e ? e.marken : null; zeichnen(); },
      geist: (v) => { const t = String(v.nach).split("#"); geister.push({ von: String(v.von).split("#")[0], nach: t[0], nachSch: t[1] || null }); zeichnen(); },
      palettePuls: (id) => { const b = palKnoepfe[id]; if (!b) return; b.classList.remove("ar-puls"); void b.offsetWidth; b.classList.add("ar-puls"); },
      zuruecksetzen: () => { sichern(); m = anfang(); Object.keys(beschreibungWahl).forEach((k) => delete beschreibungWahl[k]); auswahl = null; kanteWahl = null; geaendert(); },
      name: name,
    };
  }

  /* ---------- 14. Modellierspiel ---------- */

  const IKON = {
    zeit: '<svg class="pikto" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5M9.5 2.5h5"/></svg>',
    xp: '<svg class="pikto" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5l3 6.5 6.5 3-6.5 3-3 6.5-3-6.5-6.5-3 6.5-3z"/></svg>',
    serie: '<svg class="pikto" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21.5c-4 0-7-2.8-7-6.6 0-3.5 2.6-5.6 4-8.4.5 2 1.6 3 2.6 3.4C12 7 13 4.5 12.5 2.5c3.6 2.3 6.5 6.4 6.5 11 0 4.4-3 8-7 8z"/></svg>',
    tipp: '<svg class="pikto" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.6 10.8c.7.6 1.1 1.4 1.1 2.2h5c0-.8.4-1.6 1.1-2.2A6 6 0 0 0 12 3z"/></svg>',
    schloss: '<svg class="pikto" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/></svg>',
    stern: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.8l2.8 5.8 6.3.9-4.6 4.4 1.1 6.3L12 17.2l-5.6 3 1.1-6.3L2.9 9.5l6.3-.9z"/></svg>',
  };
  const STUFE = ["", "leicht", "mittel", "schwer"];
  const TIPP_KOSTEN = [5, 10, 15];

  function sterneHtml(n, gross) {
    let h = '<span class="ar-sterne' + (gross ? " ar-sterne-gross" : "") + '" aria-hidden="true">';
    for (let i = 0; i < 3; i++) h += '<span class="ar-stern' + (i < n ? " ar-stern-an" : "") + '">' + IKON.stern + "</span>";
    return h + "</span>";
  }

  function spiel(el, cfg) {
    el = elementHolen(el, "spiel");
    if (!el) return null;
    cfg = cfg || {};
    const f = (t) => fehler("spiel", t);
    if (!cfg.spielId || !/^[a-z0-9-]{1,60}$/.test(cfg.spielId)) return f("«spielId» fehlt oder ist ungültig (a-z, 0-9, -, höchstens 60 Zeichen).");
    if (!Array.isArray(cfg.levels) || !cfg.levels.length) return f("«levels» fehlt.");
    const levels = [];
    for (const l of cfg.levels) {
      if (!l || !l.id || !/^[a-z0-9-]{1,40}$/.test(l.id)) return f("Level-ID «" + (l && l.id) + "» ungültig.");
      if (levels.some((x) => x.id === l.id)) return f("Level-ID «" + l.id + "» doppelt.");
      if ((l.modus || cfg.modus) === "uml") {
        const ul = umlLevelPruefen(l, f);
        if (!ul) return null;
        levels.push(ul);
        continue;
      }
      const pal = (l.palette || []).filter((p) => {
        if (!p || !p.id || !TYPEN[p.typ]) { f("Level «" + l.id + "»: Palette-Eintrag braucht «id» und bekannten «typ»."); return false; }
        return true;
      });
      const vorg = l.vorgegeben ? modellPruefen({ elemente: l.vorgegeben.elemente || [], verbindungen: l.vorgegeben.verbindungen || [] }, "spiel") : null;
      const bekannt = {};
      pal.forEach((p) => (bekannt[p.id] = p));
      (vorg ? vorg.elemente : []).forEach((e) => (bekannt[e.id] = e));
      const loe = l.loesung || {};
      if (!Array.isArray(loe.elemente) || !Array.isArray(loe.verbindungen)) return f("Level «" + l.id + "»: «loesung» braucht «elemente» und «verbindungen».");
      for (const id of loe.elemente) if (!bekannt[id]) return f("Level «" + l.id + "»: Lösung nennt unbekanntes Element «" + id + "».");
      for (const v of loe.verbindungen) {
        if (!bekannt[v.von] || !bekannt[v.nach]) return f("Level «" + l.id + "»: Lösungs-Verbindung " + v.von + " → " + v.nach + " nennt unbekanntes Element.");
        if (!ARTEN[v.art]) return f("Level «" + l.id + "»: Verbindungsart «" + v.art + "» unbekannt.");
      }
      levels.push({
        id: l.id, titel: l.titel || "Level " + (levels.length + 1), schwierigkeit: klemmen(Math.round(l.schwierigkeit || 1), 1, 3),
        auftrag: l.auftrag || "", ansicht: l.ansicht || "komponenten", palette: pal, vorgegeben: vorg, loesung: loe,
        zielzeit: Number(l.zielzeit) > 0 ? Number(l.zielzeit) : 180, arten: l.arten || null, raster: l.raster || null, erklaerung: l.erklaerung || "",
      });
    }
    const fach = cfg.fach || kontext().fach || "avsw";
    const pruefung = cfg.pruefung === true;
    const speichern = cfg.speichern !== false;
    const live = ansage();
    const best = {}; // levelId → { sterne, xp }
    const ergebnisse = {}; // levelId → letztes Ergebnis
    let serie = 0;
    let speicherStatus = "";

    el.innerHTML = "";
    el.classList.add("ar-spiel");
    if (cfg.breit !== false) el.classList.add("ar-weit");
    if (pruefung) el.classList.add("ar-pruefung");

    // Kopf mit Gesamtstand
    const kopf = erzeugen("div", "ar-spiel-kopf");
    kopf.innerHTML = '<div class="ar-spiel-titelblock"><p class="ar-spiel-ueber">' + (pruefung ? "Prüfungsmodus" : "Modellierspiel") + '</p><h3 class="ar-spiel-titel">' + (cfg.titel || "Architektur modellieren") + "</h3></div>";
    const gesamt = erzeugen("div", "ar-spiel-gesamt");
    kopf.appendChild(gesamt);
    const ansichtKarte = erzeugen("div", "ar-levelkarte");
    const ansichtFeld = erzeugen("div", "ar-spielfeld");
    ansichtFeld.hidden = true;
    const ansichtErgebnis = erzeugen("div", "ar-ergebnis");
    ansichtErgebnis.hidden = true;
    el.append(kopf, ansichtKarte, ansichtFeld, ansichtErgebnis, live);

    function gesamtZeigen() {
      const sterne = levels.reduce((s, l) => s + (best[l.id] ? best[l.id].sterne : 0), 0);
      const xp = levels.reduce((s, l) => s + (best[l.id] ? best[l.id].xp : 0), 0);
      gesamt.innerHTML = '<span class="ar-hud-wert" title="Sterne"><span class="ar-stern ar-stern-an" aria-hidden="true">' + IKON.stern + "</span><b>" + sterne + "</b>/" + levels.length * 3 + '<span class="sr-only"> Sterne</span></span>' +
        '<span class="ar-hud-wert ar-xp" title="Erfahrungspunkte">' + IKON.xp + "<b>" + xp + '</b> XP</span>' +
        (serie > 1 ? '<span class="ar-hud-wert ar-serie">' + IKON.serie + "Serie ×" + serie + "</span>" : "") +
        (speicherStatus ? '<span class="ar-speicher ' + (speicherStatus === "gespeichert" ? "ar-ok-text" : "ar-warn-text") + '">' + (speicherStatus === "gespeichert" ? "✓ gespeichert" : "nicht gespeichert") + "</span>" : "");
    }
    // Prüfungsmodus: alle Levels offen (die Seite steuert die Reihenfolge)
    const frei = (i) => pruefung || i === 0 || (best[levels[i - 1].id] && best[levels[i - 1].id].sterne >= 1);

    // Levelkarte: Pfad mit Stationen, Schlössern und Sternen
    let karteBreite = 0;
    function karteZeichnen(fokusId) {
      ansichtKarte.innerHTML = "";
      const w = ansichtKarte.clientWidth || el.clientWidth || 640;
      karteBreite = w;
      const proZeile = w < 520 ? 2 : w < 820 ? 3 : 4;
      const zeilenH = 150;
      const n = levels.length;
      const pos = levels.map((l, i) => {
        const z = Math.floor(i / proZeile), s = i % proZeile;
        const sp = z % 2 === 0 ? s : proZeile - 1 - s;
        return [((sp + 0.5) / proZeile) * 100, z * zeilenH + 62];
      });
      const hoehe = Math.ceil(n / proZeile) * zeilenH + 30;
      const flaeche = erzeugen("div", "ar-lk-flaeche");
      flaeche.style.height = hoehe + "px";
      let d = "";
      pos.forEach((p, i) => {
        const x = (p[0] / 100) * w, y = p[1];
        if (i === 0) { d += "M" + f1(x) + " " + y; return; }
        const q = pos[i - 1], qx = (q[0] / 100) * w, qy = q[1];
        if (Math.abs(qy - y) < 1) d += "C" + f1((qx + x) / 2) + " " + (y - 34) + " " + f1((qx + x) / 2) + " " + (y + 34) + " " + f1(x) + " " + y;
        else { const r = x > w / 2 ? 1 : -1; d += "C" + f1(qx + r * 90) + " " + qy + " " + f1(x + r * 90) + " " + y + " " + f1(x) + " " + y; }
      });
      let geschafft = 0;
      levels.forEach((l, i) => { if (best[l.id] && best[l.id].sterne > 0 && i === geschafft) geschafft++; });
      flaeche.innerHTML = '<svg class="ar-lk-pfad" viewBox="0 0 ' + w + " " + hoehe + '" aria-hidden="true"><path class="ar-lk-weg" d="' + d + '"/><path class="ar-lk-weg-fertig" d="' + d + '" pathLength="100" stroke-dasharray="' +
        (n > 1 ? Math.round((Math.max(0, geschafft - (geschafft === n ? 1 : 0)) / (n - 1)) * 100) : 0) + ' 100"/></svg>';
      const ol = erzeugen("ol", "ar-lk-stationen");
      let naechster = null;
      levels.forEach((l, i) => {
        const b = best[l.id];
        const offen = frei(i);
        if (offen && (!b || b.sterne === 0) && !naechster) naechster = l.id;
        const li = erzeugen("li", "ar-lk-station");
        li.style.left = pos[i][0] + "%";
        li.style.top = pos[i][1] + "px";
        const st = b ? b.sterne : 0;
        const k = knopf('<span class="ar-lk-nummer">' + (offen ? i + 1 : IKON.schloss) + "</span>", "ar-lk-knopf" + (offen ? "" : " ar-gesperrt") + (b && b.sterne ? " ar-geschafft" : "") + (naechster === l.id ? " ar-naechster" : ""),
          { "aria-label": "Level " + (i + 1) + ": " + ohneTags(l.titel) + ", " + STUFE[l.schwierigkeit] + (offen ? (b ? ", beste Wertung " + b.sterne + " von 3 Sternen, " + b.xp + " XP" : ", noch nicht gespielt") : ", gesperrt: zuerst Level " + i + " mit mindestens einem Stern abschliessen") });
        if (!offen) k.setAttribute("aria-disabled", "true");
        k.dataset.level = l.id;
        k.addEventListener("click", () => {
          if (!offen) { live.textContent = "Gesperrt: Schliess zuerst Level " + i + " mit mindestens einem Stern ab."; k.classList.remove("ar-wackeln"); void k.offsetWidth; k.classList.add("ar-wackeln"); return; }
          levelStarten(l.id);
        });
        li.appendChild(k);
        li.insertAdjacentHTML("beforeend", sterneHtml(st) + '<span class="ar-lk-titel">' + l.titel + '</span><span class="ar-lk-stufe ar-stufe-' + l.schwierigkeit + '">' + STUFE[l.schwierigkeit] + "</span>");
        ol.appendChild(li);
      });
      flaeche.appendChild(ol);
      ansichtKarte.appendChild(flaeche);
      const hinweis = erzeugen("p", "hint ar-lk-hinweis", pruefung ? "Prüfungsmodus: keine Tipps, keine Zwischenprüfung. Die Musterlösung siehst du nach der Abgabe." : "Ein Stern schaltet das nächste Level frei. Drei Sterne gibt es für 100 % ohne Fehlversuch.");
      ansichtKarte.appendChild(hinweis);
      formelnSetzen(ansichtKarte);
      const fk = fokusId && $('[data-level="' + fokusId + '"]', ansichtKarte);
      if (fk) fk.focus();
    }
    if (window.ResizeObserver) new ResizeObserver(() => { if (!ansichtKarte.hidden && Math.abs((ansichtKarte.clientWidth || 0) - karteBreite) > 30) karteZeichnen(); }).observe(ansichtKarte);

    // Spielstand laden
    function laden() {
      if (!speichern || typeof fetch !== "function") return Promise.resolve();
      return fetch("/api/spielstand?fach=" + encodeURIComponent(fach), { credentials: "same-origin", cache: "no-store", headers: { Accept: "application/json" } })
        .then((r) => r.json().catch(() => null).then((d) => (r.ok && Array.isArray(d) ? d : [])))
        .catch(() => [])
        .then((liste) => {
          liste.forEach((x) => {
            if (!x || x.spiel !== cfg.spielId) return;
            // Bestwert je Feld (Vertrag 8): höchste Sterne und höchste XP
            const alt = best[x.level] || { sterne: 0, xp: 0 };
            best[x.level] = { sterne: Math.max(alt.sterne, klemmen(Number(x.sterne) || 0, 0, 3)), xp: Math.max(alt.xp, Math.max(0, Number(x.xp) || 0)) };
          });
        });
    }
    function sichernApi(levelId, sterne, xp) {
      if (!speichern || typeof fetch !== "function") return Promise.resolve({ ok: false, punkte: 0, abzeichen: [] });
      return fetch("/api/spielstand", {
        method: "POST", credentials: "same-origin",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ fach: fach, spiel: cfg.spielId, level: levelId, sterne: sterne, xp: xp }),
      }).then((r) => r.json().catch(() => null).then((d) => ({ ok: r.ok, punkte: d && Number(d.punkte) > 0 ? Number(d.punkte) : 0, abzeichen: d && Array.isArray(d.abzeichen) ? d.abzeichen : [] })))
        .catch(() => ({ ok: false, punkte: 0, abzeichen: [] }));
    }

    // Ein Level spielen
    let lv = null; // Zustand des laufenden Levels
    function levelStarten(id) {
      const i = levels.findIndex((l) => l.id === id);
      if (i < 0) { f("Level «" + id + "» unbekannt."); return false; }
      if (!frei(i)) { live.textContent = "Dieses Level ist noch gesperrt."; return false; }
      const L = levels[i];
      if (lv && lv.uhr) clearInterval(lv.uhr);
      lv = { L: L, i: i, start: Date.now(), zeit: 0, tipps: 0, fehlversuche: 0, uhr: null, ed: null, letztes: null, fertig: false };
      ansichtKarte.hidden = true;
      ansichtErgebnis.hidden = true;
      ansichtFeld.hidden = false;
      ansichtFeld.innerHTML = "";
      const nav = erzeugen("div", "ar-sf-nav");
      const zur = knopf('<span aria-hidden="true">←</span> Levelkarte', "ar-zurueck");
      zur.addEventListener("click", zurKarte);
      nav.append(zur, erzeugen("h4", "ar-sf-titel", '<span class="ar-sf-nr">Level ' + (i + 1) + "</span> " + L.titel), erzeugen("span", "ar-lk-stufe ar-stufe-" + L.schwierigkeit, STUFE[L.schwierigkeit]));
      ansichtFeld.appendChild(nav);
      // HUD
      const hud = erzeugen("div", "ar-hud");
      hud.innerHTML =
        '<span class="ar-hud-wert ar-hud-zeit">' + IKON.zeit + '<span class="sr-only">Zeit </span><b class="ar-zeit">0:00</b><span class="ar-ziel">/ ' + zeitText(L.zielzeit) + "</span></span>" +
        '<span class="ar-hud-wert ar-xp">' + IKON.xp + "<span>bis <b>" + maxXp(L) + "</b> XP</span></span>" +
        '<span class="ar-hud-wert ar-serie' + (serie > 0 ? "" : " ar-leise") + '">' + IKON.serie + "<span>Serie ×<b>" + serie + "</b></span></span>";
      const tippKnopf = knopf(IKON.tipp + '<span class="ar-tipp-text">Tipp</span>', "ar-tipp-knopf");
      if (!pruefung) hud.appendChild(tippKnopf);
      const hudStatus = erzeugen("span", "ar-speicher ar-hud-speicher");
      hud.appendChild(hudStatus);
      ansichtFeld.appendChild(hud);
      // Auftrag mit markierbaren Textstellen
      const auftrag = erzeugen("div", "ar-auftrag");
      auftrag.innerHTML = '<p class="ar-auftrag-titel">Auftrag <span class="hint">· Markiere wichtige Stellen durch Antippen</span></p><div class="ar-auftrag-text prose">' + L.auftrag + "</div>";
      $$("[data-baustein]", auftrag).forEach((s) => {
        s.classList.add("ar-stelle");
        s.setAttribute("role", "button");
        s.setAttribute("tabindex", "0");
        s.setAttribute("aria-pressed", "false");
        const um = () => { const an = s.getAttribute("aria-pressed") !== "true"; s.setAttribute("aria-pressed", String(an)); };
        s.addEventListener("click", um);
        s.addEventListener("keydown", (ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); um(); } });
      });
      ansichtFeld.appendChild(auftrag);
      const tippBox = erzeugen("div", "ar-tipps");
      tippBox.setAttribute("aria-live", "polite");
      ansichtFeld.appendChild(tippBox);
      // Spielfeld = Editor
      const edEl = erzeugen("div", "ar-sf-editor");
      ansichtFeld.appendChild(edEl);
      const vorgModell = L.vorgegeben ? kopie(L.vorgegeben) : { elemente: [], verbindungen: [] };
      lv.vorgIds = new Set(vorgModell.elemente.map((e) => e.id));
      const textAktualisieren = (mm) => {
        const da = new Set(mm.elemente.map((e) => e.id));
        $$(".ar-stelle", auftrag).forEach((s) => s.classList.toggle("ar-stelle-gelegt", da.has(s.getAttribute("data-baustein"))));
      };
      const arten = L.uml ? [] : L.arten || Array.from(new Set(["sync", "async", "daten"].concat(L.loesung.verbindungen.map((v) => v.art))));
      if (L.uml) {
        lv.uf = umlFeld(edEl, L, { onChange: () => { textAktualisieren(lv.uf.modell()); if (lv && lv.geprueft) { lv.geprueft = false; lv.uf.markieren(null); fb.innerHTML = ""; fb.className = "ar-sf-fb"; } } });
        lv.ed = { modell: lv.uf.modell, setzeModell: lv.uf.zuruecksetzen };
      } else lv.ed = editor(edEl, {
        palette: L.palette, modell: vorgModell, arten: arten, fest: Array.from(lv.vorgIds), raster: L.raster || { spalten: 4, zeilen: 3 }, labels: false,
        onChange: (mm) => { textAktualisieren(mm); if (lv && lv.geprueft) { lv.geprueft = false; fb.innerHTML = ""; fb.className = "ar-sf-fb"; } },
      });
      textAktualisieren(lv.ed.modell());
      // Aktionen
      const aktionen = erzeugen("div", "ar-sf-aktionen");
      const bPruefen = knopf(pruefung ? "Abgeben" : "Prüfen", "primary ar-gross");
      const bReset = knopf("Neu beginnen");
      const bAufgeben = knopf("Lösung zeigen", "ar-leise-knopf");
      aktionen.append(bPruefen, bReset);
      // einzelabgabe: false → die Seite gibt über abgeben() ab
      if (cfg.einzelabgabe === false) { bPruefen.hidden = true; bAufgeben.hidden = true; }
      if (!pruefung) aktionen.appendChild(bAufgeben);
      ansichtFeld.appendChild(aktionen);
      const fb = erzeugen("div", "ar-sf-fb");
      fb.setAttribute("aria-live", "polite");
      ansichtFeld.appendChild(fb);
      lv.hudStatus = hudStatus;
      lv.uhr = setInterval(() => {
        if (!lv || lv.fertig || lv.pause) return;
        lv.zeit = (Date.now() - lv.start) / 1000;
        const z = $(".ar-zeit", hud);
        if (z) { z.textContent = zeitText(lv.zeit); z.parentNode.parentNode.classList.toggle("ar-ueberzeit", lv.zeit > L.zielzeit); }
      }, 1000);

      tippKnopf.addEventListener("click", () => tippGeben(tippBox, tippKnopf, auftrag));
      bReset.addEventListener("click", () => { if (L.uml) lv.uf.zuruecksetzen(); else lv.ed.setzeModell(vorgModell); fb.innerHTML = ""; fb.className = "ar-sf-fb"; live.textContent = "Spielfeld zurückgesetzt. Die Zeit läuft weiter."; });
      bAufgeben.addEventListener("click", () => {
        if (!bAufgeben.dataset.sicher) { bAufgeben.dataset.sicher = "1"; bAufgeben.textContent = "Wirklich? 0 Sterne"; live.textContent = "Nochmals tippen zeigt die Lösung. Das Level zählt dann mit 0 Sternen."; return; }
        abschliessen(bewerten(), true);
      });
      bPruefen.addEventListener("click", () => {
        const e = bewerten();
        if (pruefung) { abschliessen(e, false); return; }
        if (e.anteil === 1 && e.fehler === 0) { abschliessen(e, false); return; }
        lv.fehlversuche++;
        lv.geprueft = true;
        rueckmeldung(e, fb);
      });
      const h = $("h4", nav);
      if (h) { h.tabIndex = -1; h.focus(); }
      live.textContent = "Level " + (i + 1) + " gestartet: " + ohneTags(L.titel) + ". Zielzeit " + zeitText(L.zielzeit) + ".";
      return true;
    }
    function maxXp(L) { return 40 * L.schwierigkeit + 40; }

    function bewerten() {
      if (lv.L.uml) return lv.uf.bewerten();
      const L = lv.L;
      const mm = lv.ed.modell();
      const vorg = lv.vorgIds;
      const sollE = L.loesung.elemente.filter((id) => !vorg.has(id));
      const da = mm.elemente.map((e) => e.id).filter((id) => !vorg.has(id));
      const eOk = da.filter((id) => sollE.indexOf(id) >= 0);
      const eExtra = da.filter((id) => L.loesung.elemente.indexOf(id) < 0);
      const eFehlt = sollE.filter((id) => da.indexOf(id) < 0);
      const soll = L.loesung.verbindungen;
      const gefunden = new Array(soll.length).fill(false);
      const vStatus = mm.verbindungen.map((v) => {
        const j = soll.findIndex((s, k) => !gefunden[k] && ((s.von === v.von && s.nach === v.nach) || (s.gerichtet === false && s.von === v.nach && s.nach === v.von)));
        if (j < 0) {
          const k2 = soll.findIndex((s, k) => !gefunden[k] && s.von === v.nach && s.nach === v.von);
          if (k2 >= 0) { gefunden[k2] = true; return { v: v, status: "richtung", soll: soll[k2] }; }
          return { v: v, status: "falsch" };
        }
        gefunden[j] = true;
        return { v: v, status: soll[j].art === v.art ? "ok" : "art", soll: soll[j] };
      });
      const vOk = vStatus.filter((s) => s.status === "ok").length;
      const vFalsch = vStatus.filter((s) => s.status === "falsch").length;
      const vFehlt = soll.filter((_, k) => !gefunden[k]);
      const gesamt = sollE.length + soll.length;
      const richtig = eOk.length + vOk;
      const anteil = gesamt ? Math.max(0, richtig - eExtra.length - vFalsch) / gesamt : 1;
      return { mm: mm, eOk: eOk, eExtra: eExtra, eFehlt: eFehlt, vStatus: vStatus, vFehlt: vFehlt, richtig: richtig, gesamt: gesamt, anteil: anteil, fehler: eExtra.length + vStatus.filter((s) => s.status !== "ok").length };
    }
    function trefferMarkieren(e) {
      lv.ed.markiere([]);
      lv.ed.markiere(e.eOk, "ar-ok");
      lv.ed.markiere(e.eExtra, "ar-falsch");
      lv.ed.markiere(e.vStatus.filter((s) => s.status === "ok").map((s) => s.v.id), "ar-ok");
      lv.ed.markiere(e.vStatus.filter((s) => s.status !== "ok").map((s) => s.v.id), "ar-falsch");
    }
    function kriterienHtml(e) {
      return '<table class="ar-kriterien"><caption>Bewertungsraster</caption><thead><tr><th scope="col">Kriterium</th><th scope="col">erfüllt</th><th scope="col">Punkte</th></tr></thead><tbody>' +
        e.kriterien.map((k) => '<tr class="' + (k.s >= 1 ? "ar-k-ok" : "ar-k-teil") + '"><th scope="row"><span aria-hidden="true">' + (k.s >= 1 ? "✓" : "✗") + "</span> " + esc(k.name) + "</th><td>" + k.ok + "/" + k.n + "</td><td>" + k.punkte + " / " + k.gewicht + "</td></tr>").join("") +
        (e.fallen.length ? '<tr class="ar-k-falle"><th scope="row"><span aria-hidden="true">!</span> Fallen</th><td>' + e.fallen.length + "</td><td>−" + Math.round(e.fallen.length * 8) + " %</td></tr>" : "") + "</tbody></table>";
    }
    function umlRueckmeldung(e, fb) {
      lv.uf.markieren(e);
      const pz = Math.round(e.anteil * 100);
      let h = '<div class="ar-fb-kopf"><span class="ar-fb-prozent">' + pz + ' %</span><p><b>Noch nicht ganz.</b> Fehlversuch ' + lv.fehlversuche + ": drei Sterne sind jetzt nicht mehr möglich.</p></div>" + kriterienHtml(e);
      const punkte = [];
      e.kriterien.forEach((k) => k.hinweise.slice(0, 4).forEach((t) => punkte.push("<b>" + esc(k.name) + ":</b> " + t)));
      e.fallen.forEach((x) => punkte.push('<b>Falle «' + esc(lv.uf.name(x.id)) + "»:</b> " + x.text));
      if (punkte.length) h += "<ul>" + punkte.map((t) => "<li>" + t + "</li>").join("") + "</ul>";
      fb.className = "ar-sf-fb ar-fb-bad";
      fb.innerHTML = h;
      const reihe = erzeugen("div", "row");
      const weiter = knopf("Weiter verbessern", "primary");
      weiter.addEventListener("click", () => { const g = $(".ar-uf-pal, .ar-uf-flaeche", ansichtFeld); if (g) g.focus(); });
      const ab = knopf("Mit " + pz + " % abgeben");
      ab.addEventListener("click", () => abschliessen(bewerten(), false));
      reihe.append(weiter, ab);
      fb.appendChild(reihe);
      live.textContent = pz + " Prozent. " + e.kriterien.map((k) => k.name + " " + k.ok + " von " + k.n).join(", ") + ".";
    }
    function rueckmeldung(e, fb) {
      if (e.uml) return umlRueckmeldung(e, fb);
      trefferMarkieren(e);
      const name = (id) => {
        const p = lv.L.palette.find((x) => x.id === id) || (lv.L.vorgegeben && lv.L.vorgegeben.elemente.find((x) => x.id === id));
        return p ? ohneTags(p.name) : id;
      };
      const teile = [];
      if (e.eFehlt.length) teile.push((e.eFehlt.length > 1 ? "Es fehlen " + e.eFehlt.length + " Bausteine" : "Es fehlt 1 Baustein") + ". Welche Teile nennt der Auftrag noch?");
      if (e.eExtra.length) teile.push("Überflüssig (kostet Punkte): " + e.eExtra.map((id) => "«" + esc(name(id)) + "»").join(", ") + ".");
      const n = (st) => e.vStatus.filter((s) => s.status === st).length;
      if (n("falsch")) teile.push(n("falsch") + " Verbindung" + (n("falsch") > 1 ? "en gibt" : " gibt") + " es so nicht (✗ im Diagramm).");
      if (n("richtung")) teile.push(n("richtung") + " Verbindung" + (n("richtung") > 1 ? "en zeigen" : " zeigt") + " in die falsche Richtung. Wer ruft wen auf?");
      if (n("art")) teile.push(n("art") + " Verbindung" + (n("art") > 1 ? "en haben" : " hat") + " die falsche Art. Achte auf die Verben: «fragt» = synchron, «veröffentlicht» = asynchron, «speichert» = Daten.");
      if (e.vFehlt.length) teile.push((e.vFehlt.length > 1 ? "Es fehlen " + e.vFehlt.length + " Verbindungen" : "Es fehlt 1 Verbindung") + ".");
      const pz = Math.round(e.anteil * 100);
      fb.className = "ar-sf-fb ar-fb-bad";
      fb.innerHTML = '<div class="ar-fb-kopf"><span class="ar-fb-prozent">' + pz + ' %</span><p><b>Noch nicht ganz.</b> ' + e.richtig + " von " + e.gesamt + " Punkten" + (e.fehler ? ", " + e.fehler + " Fehler" : "") + ". Fehlversuch " + lv.fehlversuche + ": drei Sterne sind jetzt nicht mehr möglich, zwei schon.</p></div><ul>" + teile.map((t) => "<li>" + t + "</li>").join("") + "</ul>";
      const reihe = erzeugen("div", "row");
      const weiter = knopf("Weiter verbessern", "primary");
      weiter.addEventListener("click", () => { const g = $(".ar-ed-palette .btn, .ar-ed-flaeche", ansichtFeld); if (g) g.focus(); });
      const ab = knopf("Mit " + pz + " % abgeben");
      ab.addEventListener("click", () => abschliessen(bewerten(), false));
      reihe.append(weiter, ab);
      fb.appendChild(reihe);
      live.textContent = pz + " Prozent. " + ohneTags(teile.join(" "));
    }

    function umlTipp(stufe, box) {
      const L = lv.L;
      const e = bewerten();
      const ref = L.referenz && Architektur.referenzen && Architektur.referenzen[L.referenz];
      if (stufe === 0 && ref) {
        const d = erzeugen("details", "ar-referenz");
        d.open = true;
        d.innerHTML = "<summary>Referenzarchitektur: " + esc(ref.titel || L.referenz) + "</summary>";
        const inner = erzeugen("div");
        d.appendChild(inner);
        box.appendChild(d);
        diagramm(inner, ref, { breit: false, titel: "", ablauf: false, ausfall: false, steckbrief: true, textliste: true, kMin: 0.55 });
        return "Die Referenzarchitektur ist eingeblendet. Übertrage ihre Pakete und Rollen auf den Auftrag.";
      }
      if (stufe <= 1 && e.fehlendeKomponenten.length) { lv.uf.palettePuls(e.fehlendeKomponenten[0]); return "Dir fehlt «" + esc(lv.uf.name(e.fehlendeKomponenten[0])) + "». Die Komponente blinkt in der Palette."; }
      if (stufe <= 1 && e.falschesPaket.length) { const x = e.falschesPaket[0]; return "«" + esc(lv.uf.name(x.id)) + "» liegt im falschen Paket. Richtig: " + (x.paket === null ? "ausserhalb der Pakete" : "«" + esc(lv.uf.name(x.paket)) + "»") + "."; }
      if (e.fehlendeVerbindungen.length) {
        const v = e.fehlendeVerbindungen[0];
        lv.uf.geist(v);
        return "Verbinde «" + esc(lv.uf.name(String(v.von).split("#")[0])) + "» mit «" + esc(lv.uf.name(String(v.nach).split("#")[0])) + "»" + (v.protokoll ? " (" + esc(v.protokoll) + ")" : "") + " – gestrichelt eingezeichnet.";
      }
      const k = e.kriterien.find((x) => x.s < 1 && x.hinweise.length);
      return k ? "<b>" + esc(k.name) + ":</b> " + k.hinweise[0] : "Alles sieht gut aus. Prüf dein Modell!";
    }
    function tippGeben(box, knopfT, auftrag) {
      const L = lv.L;
      if (lv.tipps >= 3) { live.textContent = "Keine Tipps mehr in diesem Level."; return; }
      if (L.uml) {
        const stufe0 = lv.tipps;
        const t0 = umlTipp(stufe0, box);
        lv.tipps++;
        box.insertAdjacentHTML("beforeend", '<p class="ar-tipp"><span class="ar-tipp-stufe">Tipp ' + lv.tipps + " · −" + TIPP_KOSTEN[stufe0] + " XP</span> " + t0 + "</p>");
        knopfT.querySelector(".ar-tipp-text").textContent = lv.tipps >= 3 ? "Keine Tipps mehr" : "Tipp " + (lv.tipps + 1) + " (−" + TIPP_KOSTEN[lv.tipps] + " XP)";
        if (lv.tipps >= 3) knopfT.disabled = true;
        return;
      }
      const e = bewerten();
      const stufe = lv.tipps;
      const name = (id) => { const p = L.palette.find((x) => x.id === id) || (L.vorgegeben && L.vorgegeben.elemente.find((x) => x.id === id)); return p ? ohneTags(p.name) : id; };
      let t = "";
      if (stufe === 0) {
        const ziel = e.eFehlt[0];
        const s = ziel && $('.ar-stelle[data-baustein="' + ziel + '"]', auftrag);
        if (s) { s.classList.add("ar-stelle-tipp"); t = "Lies die gelb markierte Stelle im Auftrag: Dazu fehlt noch ein Baustein."; }
        else if (ziel) t = "Dir fehlt noch ein Baustein. Geh den Auftrag Satz für Satz durch.";
        else t = e.eExtra.length ? "Alle nötigen Bausteine liegen. Einer ist aber zu viel." : "Alle Bausteine liegen. Jetzt geht es um die Verbindungen.";
      } else if (stufe === 1) {
        const ziel = e.eFehlt[0];
        if (ziel) { lv.ed.palettePuls(ziel); t = "Dir fehlt «" + esc(name(ziel)) + "». Er blinkt in der Palette."; }
        else if (e.eExtra.length) { lv.ed.markiere([e.eExtra[0]], "ar-falsch"); t = "«" + esc(name(e.eExtra[0])) + "» gehört nicht ins Modell (Ablenker)."; }
        else { const v = e.vFehlt[0] || (e.vStatus.find((s) => s.status !== "ok") || {}).soll; t = v ? "Schau dir «" + esc(name(v.von)) + "» an: Dort fehlt etwas oder stimmt etwas nicht." : "Alles liegt richtig. Prüf dein Modell!"; }
      } else {
        const v = e.vFehlt[0] || (e.vStatus.find((s) => s.status !== "ok" && s.soll) || {}).soll;
        if (v) { lv.ed.geist({ von: v.von, nach: v.nach, art: v.art }); t = "Verbinde «" + esc(name(v.von)) + "» → «" + esc(name(v.nach)) + "» als <b>" + esc(ARTEN[v.art].name) + "</b>" + (lv.ed.modell().elemente.some((x) => x.id === v.von) && lv.ed.modell().elemente.some((x) => x.id === v.nach) ? " (gestrichelt eingezeichnet)." : ".") ; }
        else t = "Es fehlt keine Verbindung mehr. Prüf dein Modell!";
      }
      lv.tipps++;
      box.insertAdjacentHTML("beforeend", '<p class="ar-tipp"><span class="ar-tipp-stufe">Tipp ' + lv.tipps + ' · −' + TIPP_KOSTEN[stufe] + " XP</span> " + t + "</p>");
      knopfT.querySelector(".ar-tipp-text").textContent = lv.tipps >= 3 ? "Keine Tipps mehr" : "Tipp " + (lv.tipps + 1) + " (−" + TIPP_KOSTEN[lv.tipps] + " XP)";
      if (lv.tipps >= 3) knopfT.disabled = true;
    }

    function abschliessen(e, aufgegeben) {
      const L = lv.L;
      lv.fertig = true;
      clearInterval(lv.uhr);
      const zeit = ((lv.pause || Date.now()) - lv.start) / 1000;
      const perfekt = e.anteil === 1 && e.fehler === 0;
      let sterne = aufgegeben ? 0 : perfekt && lv.fehlversuche === 0 ? 3 : e.anteil >= 0.8 ? 2 : e.anteil >= 0.5 ? 1 : 0;
      const grundRoh = Math.round(40 * e.anteil);
      const grund = grundRoh * L.schwierigkeit;
      const zeitBonus = aufgegeben || e.anteil < 0.5 ? 0 : zeit <= L.zielzeit ? Math.round(30 * (1 - zeit / L.zielzeit) * e.anteil) + (perfekt ? 10 : 0) : 0;
      const neueSerie = !aufgegeben && perfekt && lv.fehlversuche === 0 && lv.tipps === 0 ? serie + 1 : 0;
      const serieBonus = neueSerie > 1 ? Math.min(25, 5 * (neueSerie - 1)) : 0;
      const tippKosten = TIPP_KOSTEN.slice(0, lv.tipps).reduce((s, x) => s + x, 0);
      let xp = aufgegeben ? 0 : klemmen(grund + zeitBonus + serieBonus - tippKosten, 0, 500);
      serie = neueSerie;
      const alt = best[L.id];
      const verbessert = !alt || sterne > alt.sterne || xp > alt.xp;
      if (verbessert) best[L.id] = { sterne: Math.max(sterne, alt ? alt.sterne : 0), xp: Math.max(xp, alt ? alt.xp : 0) };
      const kriterien = e.uml ? e.kriterien.map((k) => ({ id: k.id, name: k.name, erreicht: k.ok, max: k.n, punkte: k.punkte, gewicht: k.gewicht }))
        : [{ id: "modell", name: "Modell", erreicht: e.richtig, max: e.gesamt, punkte: e.richtig, gewicht: 1 }];
      const fallenListe = e.uml ? e.fallen.map((x) => ({ id: x.id, text: x.text })) : [];
      const erg = { levelId: L.id, sterne: sterne, xp: xp, richtig: e.richtig, gesamt: e.gesamt, anteil: e.anteil, loesungGezeigt: !!aufgegeben, zeit: Math.round(zeit), tipps: lv.tipps, fehlversuche: lv.fehlversuche, gespeichert: false, kriterien: kriterien, fallen: fallenListe };
      ergebnisse[L.id] = erg;
      ergebnisZeigen(L, e, erg, { grundRoh: grundRoh, grund: grund, zeitBonus: zeitBonus, serieBonus: serieBonus, tippKosten: tippKosten, zeit: zeit, aufgegeben: aufgegeben, verbessert: verbessert });
      const melden = (antwort) => {
        const gesp = !!(antwort && antwort.ok);
        erg.gespeichert = gesp;
        if (speichern && verbessert) speicherStatus = gesp ? "gespeichert" : "nicht gespeichert";
        const st = $(".ar-erg-speicher", ansichtErgebnis);
        if (st) {
          st.className = "ar-erg-speicher ar-speicher " + (gesp ? "ar-ok-text" : "ar-warn-text");
          st.textContent = gesp ? "✓ Bestwert gespeichert" + (antwort.punkte ? " · +" + antwort.punkte + " Punkte im Konto" : "") : !speichern ? "" : verbessert ? "Nicht gespeichert (nicht angemeldet, offline oder Vorschau). Dein Ergebnis gilt für diese Sitzung." : "Kein neuer Bestwert, nichts zu speichern.";
          if (gesp && antwort.abzeichen.length) {
            st.insertAdjacentHTML("afterend", '<p class="ar-erg-neu">Neues Abzeichen: ' + antwort.abzeichen.map((a) => esc((a && (a.icon ? a.icon + " " : "") + (a.name || "")) || "")).join(", ") + "</p>");
          }
        }
        if (!verbessert && speichern) { gesamtZeigen(); el.dispatchEvent(new CustomEvent("architektur:spiel", { bubbles: true, detail: { spielId: cfg.spielId, levelId: L.id, sterne: sterne, xp: xp, richtig: e.richtig, gesamt: e.gesamt, loesungGezeigt: !!aufgegeben, gespeichert: false, kriterien: kopie(kriterien), fallen: kopie(fallenListe) } })); return; }
        gesamtZeigen();
        el.dispatchEvent(new CustomEvent("architektur:spiel", { bubbles: true, detail: { spielId: cfg.spielId, levelId: L.id, sterne: sterne, xp: xp, richtig: e.richtig, gesamt: e.gesamt, loesungGezeigt: !!aufgegeben, gespeichert: gesp, kriterien: kopie(kriterien), fallen: kopie(fallenListe) } }));
      };
      if (verbessert && speichern) sichernApi(L.id, sterne, xp).then(melden);
      else melden({ ok: false, punkte: 0, abzeichen: [] });
    }

    function ergebnisZeigen(L, e, erg, x) {
      ansichtFeld.hidden = true;
      ansichtErgebnis.hidden = false;
      ansichtErgebnis.innerHTML = "";
      const i = levels.indexOf(L);
      const pz = Math.round(e.anteil * 100);
      const titel = x.aufgegeben ? "Lösung angesehen" : erg.sterne === 3 ? "Perfekt modelliert!" : erg.sterne === 2 ? "Stark!" : erg.sterne === 1 ? "Geschafft!" : "Noch nicht geschafft";
      const karte = erzeugen("div", "ar-erg-karte" + (erg.sterne === 3 ? " ar-erg-perfekt" : ""));
      karte.innerHTML =
        '<p class="ar-erg-level">Level ' + (i + 1) + " · " + L.titel + "</p>" +
        '<h4 class="ar-erg-titel" tabindex="-1">' + titel + "</h4>" +
        sterneHtml(erg.sterne, true) + '<p class="sr-only">' + erg.sterne + " von 3 Sternen.</p>" +
        '<div class="ar-erg-zahlen"><span><b>' + pz + ' %</b> richtig</span><span><b>' + e.richtig + "/" + e.gesamt + "</b> Punkte</span><span><b>" + zeitText(x.zeit) + "</b> Zeit</span>" + (lv.fehlversuche ? "<span><b>" + lv.fehlversuche + "</b> Fehlversuch" + (lv.fehlversuche > 1 ? "e" : "") + "</span>" : "") + "</div>";
      const tab = erzeugen("table", "ar-xp-tabelle");
      const zeile = (t, w, k) => '<tr class="' + (k || "") + '"><th scope="row">' + t + '</th><td>' + w + "</td></tr>";
      tab.innerHTML = "<caption>XP-Aufschlüsselung</caption><tbody>" +
        (x.aufgegeben ? zeile("Lösung vor dem Abschluss angesehen", "0") :
          zeile("Grundpunkte (40 × " + pz + " %) × Schwierigkeit " + L.schwierigkeit, "+" + x.grund) +
          zeile("Zeitbonus (" + zeitText(x.zeit) + " von " + zeitText(L.zielzeit) + ")", "+" + x.zeitBonus) +
          (x.serieBonus ? zeile("Serie ×" + serie, "+" + x.serieBonus) : "") +
          (x.tippKosten ? zeile("Tipps (" + lv.tipps + ")", "−" + x.tippKosten, "ar-minus-zeile") : "")) +
        '</tbody><tfoot><tr><th scope="row">Total</th><td><b>' + erg.xp + " XP</b></td></tr></tfoot>";
      karte.appendChild(tab);
      if (e.uml) karte.insertAdjacentHTML("beforeend", kriterienHtml(e) + (e.fallen.length ? '<ul class="ar-fallen">' + e.fallen.map((x) => '<li><b>Falle «' + esc(lv.uf.name(x.id)) + "»:</b> " + x.text + "</li>").join("") + "</ul>" : ""));
      karte.insertAdjacentHTML("beforeend", (x.verbessert && !x.aufgegeben && erg.sterne > 0 ? '<p class="ar-erg-neu">★ Neuer Bestwert</p>' : best[L.id] && !x.verbessert ? '<p class="hint">Bestwert bleibt: ' + best[L.id].sterne + " Sterne, " + best[L.id].xp + " XP.</p>" : "") +
        '<p class="ar-erg-speicher ar-speicher" aria-live="polite">' + (speichern ? "Speichere …" : "") + "</p>" +
        (serie > 1 ? '<p class="ar-erg-serie">' + IKON.serie + " Serie ×" + serie + ": " + serie + " Level hintereinander perfekt!</p>" : ""));
      const knoepfe = erzeugen("div", "ar-erg-knoepfe");
      const bLoesung = knopf("▶ Musterlösung ansehen", "primary");
      const bNochmal = knopf("↺ Nochmals spielen");
      const naechstes = levels[i + 1];
      const bWeiter = naechstes && frei(i + 1) ? knopf("Nächstes Level →", erg.sterne > 0 ? "primary" : "") : null;
      const bKarte = knopf("Zur Levelkarte");
      knoepfe.append(bLoesung, bNochmal);
      if (bWeiter) knoepfe.appendChild(bWeiter);
      knoepfe.appendChild(bKarte);
      if (bWeiter && erg.sterne > 0) bLoesung.classList.remove("primary");
      karte.appendChild(knoepfe);
      ansichtErgebnis.appendChild(karte);
      const loesungBox = erzeugen("div", "ar-erg-loesung");
      loesungBox.hidden = true;
      ansichtErgebnis.appendChild(loesungBox);
      bLoesung.addEventListener("click", () => {
        loesungBox.hidden = false;
        loesungZeigen(L, loesungBox, e);
        bLoesung.disabled = true;
        const h = $("h4", loesungBox);
        if (h) h.focus();
      });
      bNochmal.addEventListener("click", () => levelStarten(L.id));
      if (bWeiter) bWeiter.addEventListener("click", () => levelStarten(naechstes.id));
      bKarte.addEventListener("click", zurKarte);
      if (erg.sterne >= 2 && !wenigerBewegung()) konfetti(karte);
      const h = $(".ar-erg-titel", karte);
      if (h) h.focus();
      live.textContent = titel + " " + erg.sterne + " von 3 Sternen, " + erg.xp + " XP.";
    }

    function loesungZeigen(L, box, e) {
      box.innerHTML = '<h4 tabindex="-1">Musterlösung mit Begründung</h4><p class="hint">Der Ablauf zeichnet jede Verbindung nach und sagt, warum sie so ist.</p>';
      if (L.uml) {
        const d = erzeugen("div");
        box.appendChild(d);
        const dg = diagramm(d, umlMusterModell(L, true), { breit: false, ausfall: false, titel: "" });
        if (dg && L.loesung.verbindungen.some((v) => v.warum)) dg.ablaufStarten("loesung");
        const be = L.loesung.beschreibungen || [];
        if (be.length) box.insertAdjacentHTML("beforeend", '<div class="card stack"><h5>Beschreibungen</h5><dl class="ar-sb-felder">' + be.map((b) => "<dt>" + esc(lv.uf.name(b.id)) + "</dt><dd>" + b.optionen[b.richtig] + "</dd>").join("") + "</dl></div>");
        if (L.erklaerung) box.insertAdjacentHTML("beforeend", '<div class="note tipp">' + L.erklaerung + "</div>");
        formelnSetzen(box);
        return;
      }
      const elemente = L.loesung.elemente.map((id) => {
        const p = L.palette.find((x) => x.id === id) || (L.vorgegeben && L.vorgegeben.elemente.find((x) => x.id === id));
        return { id: id, typ: p.typ, name: p.name, technologie: p.technologie || "", stereotyp: p.stereotyp, info: p.info ? { was: p.info } : undefined };
      });
      const verbindungen = L.loesung.verbindungen.map((v, k) => ({ id: "l" + (k + 1), von: v.von, nach: v.nach, art: v.art, label: v.label || "", info: v.warum || "" }));
      const schritte = L.loesung.verbindungen.map((v) => ({ von: v.von, nach: v.nach, art: v.art, text: "<b>" + esc(ARTEN[v.art].name) + ".</b> " + (v.warum || "") }));
      const d = erzeugen("div");
      box.appendChild(d);
      const dg = diagramm(d, { titel: "", richtung: L.richtung || "unten", elemente: elemente, verbindungen: verbindungen, ablaeufe: [{ id: "loesung", name: "Musterlösung Schritt für Schritt", schritte: schritte }] }, { breit: false, ausfall: false, titel: "" });
      if (dg) dg.ablaufStarten("loesung");
      if (L.erklaerung) box.insertAdjacentHTML("beforeend", '<div class="note tipp">' + L.erklaerung + "</div>");
      formelnSetzen(box);
    }

    function konfetti(ziel) {
      const k = erzeugen("div", "ar-konfetti");
      k.setAttribute("aria-hidden", "true");
      const farben = ["client", "zugang", "dienst", "messaging", "daten", "sicherheit"];
      for (let i = 0; i < 46; i++) {
        const s = erzeugen("i", "ar-k-" + farben[i % farben.length]);
        s.style.left = (Math.random() * 100).toFixed(1) + "%";
        s.style.animationDelay = (Math.random() * 0.5).toFixed(2) + "s";
        s.style.animationDuration = (1.6 + Math.random() * 1.2).toFixed(2) + "s";
        s.style.setProperty("--dreh", Math.round(Math.random() * 720 - 360) + "deg");
        s.style.setProperty("--dx", Math.round(Math.random() * 120 - 60) + "px");
        k.appendChild(s);
      }
      ziel.appendChild(k);
      setTimeout(() => k.remove(), 3400);
    }

    function zurKarte() {
      const id = lv && lv.L.id;
      if (lv && lv.uhr) clearInterval(lv.uhr);
      ansichtFeld.hidden = true;
      ansichtErgebnis.hidden = true;
      ansichtKarte.hidden = false;
      karteZeichnen(id);
      gesamtZeigen();
    }

    gesamtZeigen();
    karteZeichnen();
    laden().then(() => { gesamtZeigen(); if (!ansichtKarte.hidden) karteZeichnen(); });
    formelnSetzen(el);

    return {
      starten: (id) => levelStarten(id),
      levelkarte: zurKarte,
      abgeben: () => { if (!lv || lv.fertig) return null; abschliessen(bewerten(), false); return ergebnisse[lv.L.id]; },
      ergebnis: (id) => (ergebnisse[id] ? kopie(ergebnisse[id]) : null),
      ergebnisse: () => kopie(ergebnisse),
      // Spieluhr anhalten und weiterlaufen lassen (z. B. Übungsprüfung mit eigener Gesamtzeit)
      pausiere: () => { if (lv && !lv.fertig && !lv.pause) lv.pause = Date.now(); return !!(lv && lv.pause); },
      fortsetzen: () => { if (lv && lv.pause) { lv.start += Date.now() - lv.pause; lv.pause = null; } return !!lv && !lv.pause; },
      bestwerte: () => kopie(best),
    };
  }

  /* ---------- 15. Öffentliche Schnittstelle ---------- */

  window.Architektur = {
    version: "1.1.0",
    referenzen: {}, // Referenzarchitekturen (Modelle in Modulnotation), von Seiten befüllt: Architektur.referenzen.jakarta = { … }
    diagramm: diagramm,
    atlas: atlas,
    editor: editor,
    spiel: spiel,
    kategorieVon: kategorieVon,
    typen: (function () {
      const t = {};
      Object.keys(TYPEN).forEach((k) => (t[k] = Object.freeze(Object.assign({}, TYPEN[k]))));
      return Object.freeze(t);
    })(),
    kategorien: KATEGORIEN.map((k) => Object.assign({}, k)),
    arten: (function () { const a = {}; ART_IDS.forEach((k) => (a[k] = { name: ARTEN[k].name, erkl: ARTEN[k].erkl })); return a; })(),
    linie: (art) => (ARTEN[art] ? artMuster(art, 46) : (fehler("linie", "Art «" + art + "» unbekannt."), "")),
    piktogramm: (typ, titel) => {
      const t = TYPEN[typ];
      if (!t) { fehler("piktogramm", "Typ «" + typ + "» unbekannt."); return ""; }
      const s = piktoSvg(t.pikto);
      return titel ? s.replace('aria-hidden="true"', 'role="img"').replace(">", "><title>" + esc(titel) + "</title>") : s;
    },
  };
})();
