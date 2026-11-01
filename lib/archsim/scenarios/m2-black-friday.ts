// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// lib/archsim/scenarios/m2-black-friday.ts
// Mission 2: Microservices hinter einem API-Gateway, Lastspitze ×8 am Black Friday, fehlerhaftes Deployment.

import type { Mission } from "../types"

export const m2BlackFriday: Mission = {
  id: "m2-black-friday",
  version: 1,
  titel: "Black Friday im Webshop",
  untertitel: "Lastspitze ×8 mit Microservices",
  schwierigkeit: 2,
  art: "vorgegeben",
  gefuehrt: false,
  firma: "Gipfelstürmer Outdoor AG",
  briefing:
    "<p>Die <strong>Gipfelstürmer Outdoor AG</strong> verkauft Wanderschuhe, Zelte und Jacken online. Um Mitternacht startet der <strong>Black Friday</strong>: Für 25 Minuten kommt achtmal so viel Last wie sonst.</p>" +
    "<p>Der Shop besteht aus Microservices hinter einem API-Gateway: Katalog, Bestellung, Lager und Zahlung, dazu ein Message Broker, über den der Versand Aufträge bekommt. Drei Viertel der Besucherinnen stöbern nur, ein Viertel bestellt.</p>" +
    "<p>Ziel (SLO): <strong>p95 unter 400 ms</strong> und <strong>Verfügbarkeit mindestens 99.5 %</strong> über die ganzen 90 Minuten, Budget 750 CHF. Halte die Augen offen: Heute Nacht wird auch noch eine neue Version des Lagerservice ausgerollt.</p>",
  lernziele: [
    { text: "Eine planbare Lastspitze mit Autoscaling und rechtzeitiger Reserve abfangen.", station: "03-container-kubernetes", abschnitt: "objekte" },
    { text: "Lese-Last mit CDN und Cache vom Katalog und seiner Datenbank fernhalten.", station: "05-architektur-modellieren", abschnitt: "verfahren" },
    { text: "Erkennen, dass ein asynchron angebundener Dienst (Versand) einen Rückstau aufbaut statt Fehler zu werfen.", station: "02-kommunikation", abschnitt: "messaging" },
    { text: "Ein fehlerhaftes Deployment an der Fehlerquote erkennen und zurückrollen.", station: "03-container-kubernetes", abschnitt: "objekte" },
  ],
  modell: {
    titel: "Gipfelstürmer-Shop: Microservices mit Broker",
    ansicht: "komponenten",
    richtung: "rechts",
    elemente: [
      { id: "kundin", typ: "akteur", name: "Kundin", x: 0, y: 2 },
      { id: "shop", typ: "web", name: "Shop-Frontend", technologie: "React", x: 1, y: 2, info: { was: "Single-Page-App im Browser." } },
      { id: "gw", typ: "gateway", name: "API-Gateway", technologie: "Kong", x: 2, y: 2, sim: { instanzen: 2 }, info: { was: "Einziger Eingang für alle API-Aufrufe.", kann: "Routing, Authentisierung, Rate Limiting." } },
      { id: "katalog", typ: "dienst", name: "Katalogservice", technologie: "Node.js", x: 3, y: 0, sim: { instanzen: 2 }, info: { was: "Produkte, Preise, Bilder.", kann: "Nur lesend, zustandslos." } },
      { id: "katalog-db", typ: "datenbank", name: "Katalog-DB", technologie: "PostgreSQL", x: 4, y: 0, info: { was: "Produktdaten.", kann: "Rund 400 Abfragen pro Sekunde." } },
      { id: "best", typ: "dienst", name: "Bestellservice", technologie: "Spring Boot", x: 3, y: 2, sim: { instanzen: 2 }, info: { was: "Nimmt Bestellungen an und koordiniert Lager, Zahlung und Versand." } },
      { id: "best-db", typ: "datenbank", name: "Bestell-DB", technologie: "PostgreSQL", x: 3, y: 3 },
      { id: "lager", typ: "dienst", name: "Lagerservice", technologie: "Go", x: 4, y: 1, sim: { instanzen: 2 }, info: { was: "Reserviert Ware im Lager." } },
      { id: "lager-db", typ: "datenbank", name: "Lager-DB", technologie: "PostgreSQL", x: 5, y: 1 },
      { id: "zahlung", typ: "dienst", name: "Zahlungsservice", technologie: "Spring Boot", x: 4, y: 2, sim: { instanzen: 2 }, info: { was: "Wickelt Zahlungen über den Zahlungsanbieter ab." } },
      { id: "psp", typ: "extern", name: "Zahlungsanbieter", technologie: "PayHelvetia", x: 5, y: 2, sim: { kapazitaet: 5000, parallel: 5000, latenz: 120 }, info: { was: "Externer Zahlungsdienst (Karte, TWINT)." } },
      { id: "broker", typ: "broker", name: "Message Broker", technologie: "RabbitMQ", x: 4, y: 3, info: { was: "Leitet Bestell-Ereignisse an den Versand weiter." } },
      { id: "versand", typ: "dienst", name: "Versandservice", technologie: "Python", x: 5, y: 3, info: { was: "Erstellt Lieferscheine und Paketetiketten." } },
    ],
    verbindungen: [
      { id: "kundin-shop", von: "kundin", nach: "shop", art: "abhaengigkeit", label: "nutzt" },
      { id: "shop-gw", von: "shop", nach: "gw", art: "sync", label: "HTTPS" },
      { id: "gw-katalog", von: "gw", nach: "katalog", art: "sync", label: "REST" },
      { id: "gw-best", von: "gw", nach: "best", art: "sync", label: "REST" },
      { id: "katalog-db-zugriff", von: "katalog", nach: "katalog-db", art: "daten", label: "SQL" },
      { id: "best-db-zugriff", von: "best", nach: "best-db", art: "daten", label: "SQL" },
      { id: "best-lager", von: "best", nach: "lager", art: "sync", label: "REST" },
      { id: "lager-db-zugriff", von: "lager", nach: "lager-db", art: "daten", label: "SQL" },
      { id: "best-zahlung", von: "best", nach: "zahlung", art: "sync", label: "REST" },
      { id: "zahlung-psp", von: "zahlung", nach: "psp", art: "sync", label: "HTTPS", sim: { timeoutMs: 3000, retries: 1 } },
      { id: "best-broker", von: "best", nach: "broker", art: "async", label: "BestellungAufgegeben" },
      { id: "broker-versand", von: "broker", nach: "versand", art: "async", label: "BestellungAufgegeben" },
    ],
    ablaeufe: [
      {
        id: "bestellen",
        name: "Bestellung aufgeben",
        schritte: [
          { von: "shop", nach: "gw", art: "sync", text: "Die Kundin schickt die Bestellung (POST /orders)." },
          { von: "gw", nach: "best", art: "sync", text: "Das Gateway leitet an den Bestellservice weiter." },
          { von: "best", nach: "lager", art: "sync", text: "Ware reservieren." },
          { von: "best", nach: "zahlung", art: "sync", text: "Zahlung auslösen." },
          { von: "zahlung", nach: "psp", art: "sync", text: "Der Zahlungsanbieter belastet die Karte." },
          { von: "best", nach: "broker", art: "async", text: "Ereignis «BestellungAufgegeben» veröffentlichen." },
          { von: "broker", nach: "versand", art: "async", text: "Der Versand erstellt den Lieferschein, sobald er dazukommt." },
        ],
      },
    ],
  },
  anfragen: [
    { id: "stoebern", name: "Produkte ansehen", anteil: 0.75, einstieg: "shop", ziele: ["katalog"], statischAnteil: 0.5 },
    { id: "bestellen", name: "Bestellen", anteil: 0.25, einstieg: "shop", ziele: ["best", "lager", "zahlung", "psp", "versand"], schreibend: true, kritisch: true },
  ],
  last: {
    punkte: [
      { t: 0, rps: 90 },
      { t: 28, rps: 120 },
      { t: 60, rps: 130 },
      { t: 75, rps: 110 },
      { t: 90, rps: 90 },
    ],
    rauschen: 0.05,
  },
  dauer: 90,
  ereignisse: [
    {
      id: "black-friday",
      tick: 30,
      dauer: 25,
      titel: "Black Friday startet",
      text: "Punkt Mitternacht: Newsletter und Werbung locken achtmal so viele Besucherinnen in den Shop.",
      wirkung: { art: "lastspitze", faktor: 8 },
    },
    {
      id: "lager-deployment",
      tick: 62,
      dauer: 28,
      titel: "Neue Version des Lagerservice",
      text: "Das Lager-Team rollt Version 4.2 aus. Seither scheitert jede fünfte Reservierung mit einem Fehler 500.",
      wirkung: { art: "deployment", element: "lager", fehlerquote: 0.2 },
    },
  ],
  erlaubteAktionen: ["skalieren", "autoscaling", "cache", "cdn", "readReplica", "rateLimit", "rollback", "timeout", "retry", "circuitBreaker"],
  budget: 750,
  slo: { p95Ms: 400, verfuegbarkeit: 0.995 },
  musterstrategie:
    "Vor dem Start CDN hinter das Shop-Frontend und Cache vor die Katalog-DB; Autoscaling für Katalog-, Bestell-, Lager-, Zahlungs- und Versandservice (je bis 10 Instanzen). Bei Minute 25 Katalog und Bestellservice vorsorglich hochfahren. Beim Deployment des Lagerservice sofort zurückrollen.",
}
