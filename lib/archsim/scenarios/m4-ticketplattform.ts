// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// lib/archsim/scenarios/m4-ticketplattform.ts
// Mission 4: Auftragstext → Spieler modelliert die Ticketplattform selbst, validate.ts prüft die Anforderungen,
// danach Lasttest des eigenen Modells mit Vorverkaufsstart (×10) und stotterndem Zahlungsanbieter.

import type { ArchModell, Mission } from "../types"

/** Vorgegebener Teil: Fan, App und die beiden externen Dienste */
const vorgegeben: ArchModell = {
  titel: "Ticketplattform BühnenPass",
  ansicht: "komponenten",
  richtung: "rechts",
  elemente: [
    { id: "fan", typ: "akteur", name: "Fan", x: 0, y: 1 },
    { id: "fan-app", typ: "web", name: "BühnenPass-App", technologie: "Vue", x: 1, y: 1, info: { was: "Web-App für Suche und Kauf." } },
    { id: "psp", typ: "extern", name: "Zahlungsanbieter", technologie: "PayHelvetia", x: 6, y: 2, sim: { kapazitaet: 400, parallel: 600, latenz: 200 }, info: { was: "Externer Zahlungsdienst." } },
    { id: "mailer", typ: "extern", name: "E-Mail-Dienst", technologie: "Mailversand (extern)", x: 6, y: 3, sim: { kapazitaet: 1000, parallel: 2000, latenz: 300 }, info: { was: "Verschickt Bestätigungen mit dem Ticket." } },
  ],
  verbindungen: [{ id: "fan-nutzt-app", von: "fan", nach: "fan-app", art: "abhaengigkeit", label: "nutzt" }],
}

/** Musterlösung (für Tests und «Lösung zeigen») */
const muster: ArchModell = {
  ...vorgegeben,
  elemente: [
    ...vorgegeben.elemente,
    { id: "cdn", typ: "cdn", name: "CDN", technologie: "Cloudflare", x: 2, y: 1 },
    { id: "gw", typ: "gateway", name: "API-Gateway", technologie: "Kong", x: 3, y: 1 },
    { id: "ticket", typ: "dienst", name: "Ticketservice", technologie: "Spring Boot", x: 4, y: 1 },
    { id: "cache", typ: "cache", name: "Verfügbarkeits-Cache", technologie: "Redis", x: 4, y: 0 },
    { id: "ticket-db", typ: "datenbank", name: "Ticket-DB", technologie: "PostgreSQL", x: 5, y: 0 },
    { id: "queue", typ: "queue", name: "Zahlungs-Queue", technologie: "RabbitMQ", x: 4, y: 2 },
    { id: "zahlung", typ: "dienst", name: "Zahlungsservice", technologie: "Spring Boot", x: 5, y: 2 },
    { id: "zahlung-db", typ: "datenbank", name: "Zahlungs-DB", technologie: "PostgreSQL", x: 5, y: 3 },
  ],
  verbindungen: [
    ...vorgegeben.verbindungen,
    { id: "app-cdn", von: "fan-app", nach: "cdn", art: "sync", label: "HTTPS" },
    { id: "cdn-gw", von: "cdn", nach: "gw", art: "sync", label: "HTTPS" },
    { id: "gw-ticket", von: "gw", nach: "ticket", art: "sync", label: "REST" },
    { id: "ticket-cache", von: "ticket", nach: "cache", art: "daten", label: "get/set" },
    { id: "ticket-db-zugriff", von: "ticket", nach: "ticket-db", art: "daten", label: "SQL" },
    { id: "ticket-queue", von: "ticket", nach: "queue", art: "async", label: "ZahlungAngefordert" },
    { id: "queue-zahlung", von: "queue", nach: "zahlung", art: "async", label: "ZahlungAngefordert" },
    { id: "zahlung-db-zugriff", von: "zahlung", nach: "zahlung-db", art: "daten", label: "SQL" },
    { id: "zahlung-psp", von: "zahlung", nach: "psp", art: "sync", label: "HTTPS", sim: { timeoutMs: 2000, retries: 1 } },
    { id: "zahlung-mailer", von: "zahlung", nach: "mailer", art: "async", label: "Bestätigung" },
  ],
}

export const m4Ticketplattform: Mission = {
  id: "m4-ticketplattform",
  version: 1,
  titel: "Modelliere die Ticketplattform",
  untertitel: "Vom Auftrag zur Architektur, dann der Lasttest",
  schwierigkeit: 3,
  art: "modellieren",
  gefuehrt: false,
  firma: "BühnenPass AG",
  briefing:
    "<p>Die <strong>BühnenPass AG</strong> verkauft die Tickets für das <strong>Openair Seeland</strong>. Letztes Jahr ist die alte Plattform beim Vorverkaufsstart zusammengebrochen. Du entwirfst die neue Architektur und beweist im Lasttest, dass sie hält.</p>" +
    "<p>Lies den Auftrag, setze die Bausteine aus der Palette und verbinde sie. Nicht jeder Baustein gehört in die Lösung. Wenn das Modell lauffähig ist, startet der Lasttest; während des Tests kannst du skalieren und Resilienz-Einstellungen anpassen.</p>",
  auftrag:
    "<p>Fans nutzen die <span data-baustein=\"fan-app\">BühnenPass-App</span>. Alle Aufrufe der App laufen über ein <span data-baustein=\"gw\">API-Gateway</span>; Bilder, Saalpläne und Bandinfos kommen aus einem <span data-baustein=\"cdn\">CDN</span>, das vor dem Gateway liegt.</p>" +
    "<p>Der <span data-baustein=\"ticket\">Ticketservice</span> zeigt Konzerte und freie Plätze und nimmt Käufe an. Die Verfügbarkeit wird rund 50-mal häufiger gelesen als gekauft wird, darum liest der Ticketservice über einen <span data-baustein=\"cache\">Cache</span>. Seine Daten liegen in der <span data-baustein=\"ticket-db\">Ticket-DB</span>.</p>" +
    "<p><strong>Zahlungen dürfen nicht verloren gehen</strong>, auch wenn der <span data-baustein=\"psp\">Zahlungsanbieter</span> hängt. Der Ticketservice übergibt Zahlungsaufträge darum über eine <span data-baustein=\"queue\">Queue</span> an den <span data-baustein=\"zahlung\">Zahlungsservice</span>, der mit dem Zahlungsanbieter spricht und seine eigene <span data-baustein=\"zahlung-db\">Zahlungs-DB</span> hat. Nach erfolgreicher Zahlung verschickt er die Bestätigung über den <span data-baustein=\"mailer\">E-Mail-Dienst</span>.</p>" +
    "<p>Jeder Dienst besitzt seine Daten. Beim Vorverkaufsstart kommt zehnmal so viel Last wie sonst.</p>",
  lernziele: [
    { text: "Aus einem Anforderungstext Bausteine und Verbindungsarten (sync, async, Daten) ableiten.", station: "10-fallstudie", abschnitt: "verfahren" },
    { text: "Begründen, wo Cache, CDN und API-Gateway hingehören.", station: "10-fallstudie", abschnitt: "verfahren" },
    { text: "Kritische Vorgänge mit einer Queue entkoppeln und die Wirkung im Lasttest nachweisen.", station: "03-eda-message-broker", abschnitt: "messaging" },
    { text: "Database per Service: Jeder Dienst besitzt seine Daten.", station: "05-microservices", abschnitt: "prinzipien" },
  ],
  modell: vorgegeben,
  palette: [
    { id: "cdn", typ: "cdn", name: "CDN", technologie: "Cloudflare" },
    { id: "gw", typ: "gateway", name: "API-Gateway", technologie: "Kong" },
    { id: "ticket", typ: "dienst", name: "Ticketservice", technologie: "Spring Boot" },
    { id: "zahlung", typ: "dienst", name: "Zahlungsservice", technologie: "Spring Boot" },
    { id: "ticket-db", typ: "datenbank", name: "Ticket-DB", technologie: "PostgreSQL" },
    { id: "zahlung-db", typ: "datenbank", name: "Zahlungs-DB", technologie: "PostgreSQL" },
    { id: "cache", typ: "cache", name: "Verfügbarkeits-Cache", technologie: "Redis" },
    { id: "queue", typ: "queue", name: "Zahlungs-Queue", technologie: "RabbitMQ" },
    { id: "esb", typ: "bus", name: "Enterprise Service Bus", technologie: "MuleSoft", ablenker: true },
    { id: "server", typ: "monolith", name: "Alles-in-einem-Server", technologie: "PHP", ablenker: true },
    { id: "lb", typ: "lastverteiler", name: "Lastverteiler", technologie: "HAProxy", ablenker: true },
  ],
  anforderungen: [
    {
      id: "a-gateway", art: "vorgeschaltet", einstieg: "fan-app", bis: "ticket", typ: "gateway",
      text: "Alle Aufrufe der App laufen über ein API-Gateway.",
      warum: "Das Gateway ist der einzige Eingang: Authentisierung, Rate Limiting und Routing an einer Stelle.", station: "02-soa-apis",
    },
    {
      id: "a-cdn", art: "vorgeschaltet", einstieg: "fan-app", bis: "gw", typ: "cdn",
      text: "Statische Inhalte kommen aus einem CDN vor dem Gateway.",
      warum: "Bilder und Saalpläne machen einen grossen Teil der Anfragen aus und müssen die Dienste nie erreichen.", station: "10-fallstudie",
    },
    {
      id: "a-cache", art: "cache", element: "ticket",
      text: "Der Ticketservice liest die Verfügbarkeit über einen Cache.",
      warum: "Bei 50 Lesezugriffen pro Kauf wäre sonst die Ticket-DB der Engpass.", station: "10-fallstudie",
    },
    {
      id: "a-zahlung", art: "entkoppelt", von: "ticket", nach: "zahlung",
      text: "Zahlungen dürfen nicht verloren gehen.",
      warum: "Ein synchroner Aufruf scheitert, sobald der Zahlungsweg klemmt; eine Queue puffert die Aufträge, bis sie verarbeitet sind.", station: "03-eda-message-broker",
    },
    {
      id: "a-mail", art: "pfad", von: "zahlung", nach: "mailer",
      text: "Nach der Zahlung wird eine Bestätigung verschickt.",
      warum: "Der Zahlungsservice braucht eine Verbindung zum E-Mail-Dienst.", station: "03-eda-message-broker",
    },
    {
      id: "a-daten", art: "eigeneDaten", elemente: ["ticket", "zahlung"],
      text: "Jeder Dienst besitzt seine Daten.",
      warum: "Gemeinsame Datenbanken koppeln Dienste eng (Database per Service).", station: "05-microservices",
    },
  ],
  musterloesung: muster,
  anfragen: [
    { id: "suchen", name: "Konzerte und freie Plätze ansehen", anteil: 0.85, einstieg: "fan-app", ziele: ["ticket"], statischAnteil: 0.5 },
    { id: "kaufen", name: "Ticket kaufen", anteil: 0.15, einstieg: "fan-app", ziele: ["ticket", "zahlung", "psp", "mailer"], schreibend: true, kritisch: true },
  ],
  last: {
    punkte: [
      { t: 0, rps: 70 },
      { t: 18, rps: 90 },
      { t: 70, rps: 90 },
    ],
    rauschen: 0.05,
  },
  dauer: 70,
  ereignisse: [
    {
      id: "vorverkauf",
      tick: 20,
      dauer: 12,
      titel: "Vorverkaufsstart",
      text: "Punkt 10 Uhr öffnet der Vorverkauf. Zehnmal so viele Fans wie sonst wollen gleichzeitig Plätze sehen und kaufen.",
      wirkung: { art: "lastspitze", faktor: 10 },
    },
    {
      id: "psp-langsam",
      tick: 45,
      dauer: 10,
      titel: "Zahlungsanbieter wird langsam",
      text: "Beim Zahlungsanbieter dauern Zahlungen plötzlich rund 3 Sekunden.",
      wirkung: { art: "langsam", element: "psp", faktor: 15 },
    },
  ],
  erlaubteAktionen: ["skalieren", "autoscaling", "readReplica", "rateLimit", "timeout", "retry", "circuitBreaker", "bulkhead"],
  budget: 450,
  slo: { p95Ms: 400, verfuegbarkeit: 0.995 },
  musterstrategie:
    "Modell wie im Auftrag (CDN → Gateway → Ticketservice mit Cache und Ticket-DB, Queue zum Zahlungsservice mit eigener DB, Zahlungsanbieter mit 2 s Timeout und 1 Wiederholung, Bestätigung asynchron an den E-Mail-Dienst). Im Lasttest Autoscaling für Ticketservice (2 bis 12) und Zahlungsservice (1 bis 6), Ticketservice bei Minute 17 auf 8 Instanzen vorheizen, Circuit Breaker auf Zahlungsservice → Zahlungsanbieter.",
}
