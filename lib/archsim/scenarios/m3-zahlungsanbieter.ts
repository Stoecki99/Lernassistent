// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// lib/archsim/scenarios/m3-zahlungsanbieter.ts
// Mission 3: Externer Zahlungsanbieter wird langsam und fällt aus. Retry-Sturm und Fehlerkaskade verhindern.

import type { Mission } from "../types"

export const m3Zahlungsanbieter: Mission = {
  id: "m3-zahlungsanbieter",
  version: 2,
  titel: "Der Zahlungsanbieter stottert",
  untertitel: "Timeout, Retry, Circuit Breaker, Bulkhead und Queue",
  schwierigkeit: 3,
  art: "vorgegeben",
  gefuehrt: false,
  firma: "Pistenpass AG",
  briefing:
    "<p>Die <strong>Pistenpass AG</strong> verkauft Skitageskarten für zwölf Bergbahnen. Am ersten Powder-Samstag der Saison stöbern viele im Angebot, knapp ein Drittel kauft.</p>" +
    "<p>Bezahlt wird über den externen Anbieter <strong>PayAlpin</strong>. Das Team hat den Aufruf «sicherheitshalber» mit 10 Sekunden Timeout und 3 Wiederholungen eingestellt. Das API-Gateway hat 200 Worker-Threads.</p>" +
    "<p>Nach dem Kauf fragt die App beim Zahlungsservice nach, ob die Zahlung durch ist (<strong>Kaufstatus</strong>). Dieselben Instanzen des Zahlungsservice beantworten diese Abfragen und arbeiten im Hintergrund Zahlungsaufträge ab.</p>" +
    "<p>Gerüchte sagen, dass PayAlpin heute Probleme hat. Drei Anforderungen: <strong>keine Käufe verlieren</strong>; das <strong>Angebot</strong> und die <strong>Kaufstatus-Abfrage</strong> bleiben schnell, auch während PayAlpin hängt. SLO: p95 unter 500 ms, Verfügbarkeit mindestens 99 %.</p>",
  lernziele: [
    { text: "Erklären, warum lange Timeouts und viele Wiederholungen eine Störung verschlimmern (Retry-Sturm, Thread-Erschöpfung).", station: "03-eda-message-broker", abschnitt: "resilienz" },
    { text: "Circuit Breaker und Bulkhead einsetzen, damit eine gestörte Abhängigkeit nicht das ganze System mitreisst.", station: "03-eda-message-broker", abschnitt: "resilienz" },
    { text: "Kritische Vorgänge über eine Queue entkoppeln, damit sie bei einem Ausfall gepuffert statt verloren werden.", station: "03-eda-message-broker", abschnitt: "transaktionen" },
    { text: "Erkennen, dass auch Queue-Konsumenten Timeout und Circuit Breaker brauchen: Hängende Worker blockieren den ganzen Dienst.", station: "03-eda-message-broker", abschnitt: "messaging" },
  ],
  modell: {
    titel: "Pistenpass: Kauf mit externem Zahlungsanbieter",
    ansicht: "komponenten",
    richtung: "rechts",
    elemente: [
      { id: "gast", typ: "akteur", name: "Wintersportlerin", x: 0, y: 1 },
      { id: "app", typ: "mobile", name: "Pistenpass-App", technologie: "Flutter", x: 1, y: 1 },
      { id: "gw", typ: "gateway", name: "API-Gateway", technologie: "Spring Cloud Gateway", x: 2, y: 1, sim: { parallel: 200 }, info: { was: "Eingang für alle Aufrufe der App.", kann: "200 Worker-Threads; jeder wartet, bis der Dienst dahinter antwortet." } },
      { id: "angebot", typ: "dienst", name: "Angebotsservice", technologie: "Node.js", x: 3, y: 0, sim: { instanzen: 3 }, info: { was: "Bergbahnen, Preise, Schneebericht." } },
      { id: "angebot-db", typ: "nosql", name: "Angebots-DB", technologie: "MongoDB", x: 4, y: 0 },
      { id: "kauf", typ: "dienst", name: "Kaufservice", technologie: "Spring Boot", x: 3, y: 1, sim: { instanzen: 2 }, info: { was: "Legt Tickets an und löst die Zahlung aus." } },
      { id: "kauf-db", typ: "datenbank", name: "Ticket-DB", technologie: "PostgreSQL", x: 3, y: 2 },
      { id: "zahlung", typ: "dienst", name: "Zahlungsservice", technologie: "Spring Boot", x: 4, y: 1, sim: { instanzen: 2, parallel: 200 }, info: { was: "Spricht mit PayAlpin und beantwortet Kaufstatus-Abfragen.", kann: "200 Threads je Instanz, gemeinsam für Abfragen und Hintergrundarbeit." } },
      { id: "zahlung-db", typ: "nosql", name: "Zahlungs-DB", technologie: "MongoDB", x: 5, y: 0 },
      {
        id: "psp", typ: "extern", name: "PayAlpin", technologie: "Zahlungsanbieter (extern)", x: 5, y: 1, sim: { kapazitaet: 400, parallel: 300, latenz: 200 },
        info: { was: "Externer Zahlungsanbieter.", kann: "Vertraglich 400 Zahlungen pro Sekunde, höchstens 300 gleichzeitig offene Anfragen." },
      },
    ],
    verbindungen: [
      { id: "gast-app", von: "gast", nach: "app", art: "abhaengigkeit", label: "nutzt" },
      { id: "app-gw", von: "app", nach: "gw", art: "sync", label: "HTTPS" },
      { id: "gw-angebot", von: "gw", nach: "angebot", art: "sync", label: "REST" },
      { id: "gw-kauf", von: "gw", nach: "kauf", art: "sync", label: "REST" },
      { id: "angebot-db-zugriff", von: "angebot", nach: "angebot-db", art: "daten", label: "find" },
      { id: "kauf-db-zugriff", von: "kauf", nach: "kauf-db", art: "daten", label: "SQL" },
      { id: "kauf-zahlung", von: "kauf", nach: "zahlung", art: "sync", label: "REST" },
      { id: "gw-zahlung", von: "gw", nach: "zahlung", art: "sync", label: "GET /status" },
      { id: "zahlung-db-zugriff", von: "zahlung", nach: "zahlung-db", art: "daten", label: "find" },
      { id: "zahlung-psp", von: "zahlung", nach: "psp", art: "sync", label: "HTTPS", sim: { timeoutMs: 10000, retries: 3 } },
    ],
    ablaeufe: [
      {
        id: "kaufen",
        name: "Tageskarte kaufen",
        schritte: [
          { von: "app", nach: "gw", art: "sync", text: "Die App schickt den Kauf." },
          { von: "gw", nach: "kauf", art: "sync", text: "Das Gateway wartet auf den Kaufservice." },
          { von: "kauf", nach: "zahlung", art: "sync", text: "Der Kaufservice wartet auf die Zahlung." },
          { von: "zahlung", nach: "psp", art: "sync", text: "Der Zahlungsservice wartet bis zu 10 s auf PayAlpin und versucht es bis zu dreimal neu." },
          { bei: "psp", text: "Wenn PayAlpin hängt, warten alle Glieder der Kette und halten ihre Threads fest.", fehler: true },
        ],
      },
    ],
  },
  anfragen: [
    { id: "stoebern", name: "Angebot ansehen", anteil: 0.55, einstieg: "app", ziele: ["angebot"] },
    { id: "status", name: "Kaufstatus abfragen", anteil: 0.15, einstieg: "app", ziele: ["zahlung"] },
    { id: "kaufen", name: "Tageskarte kaufen", anteil: 0.3, einstieg: "app", ziele: ["kauf", "zahlung", "psp"], schreibend: true, kritisch: true },
  ],
  last: {
    punkte: [
      { t: 0, rps: 160 },
      { t: 20, rps: 220 },
      { t: 45, rps: 240 },
      { t: 70, rps: 180 },
    ],
    rauschen: 0.04,
  },
  dauer: 70,
  ereignisse: [
    {
      id: "psp-langsam",
      tick: 12,
      dauer: 20,
      titel: "PayAlpin hängt",
      text: "Bei PayAlpin klemmt eine Datenbank. Zahlungen dauern statt 0.2 Sekunden rund 10 Sekunden, viele kommen gar nicht zurück.",
      wirkung: { art: "langsam", element: "psp", faktor: 50 },
    },
    {
      id: "psp-ausfall",
      tick: 40,
      dauer: 10,
      titel: "PayAlpin fällt aus",
      text: "PayAlpin ist für 10 Minuten nicht erreichbar.",
      wirkung: { art: "ausfall", element: "psp" },
    },
  ],
  erlaubteAktionen: ["skalieren", "autoscaling", "timeout", "retry", "circuitBreaker", "bulkhead", "queue"],
  aktionsZiele: {
    timeout: ["zahlung-psp", "kauf-zahlung", "gw-kauf", "gw-angebot", "gw-zahlung"],
    retry: ["zahlung-psp", "kauf-zahlung", "gw-kauf", "gw-angebot", "gw-zahlung"],
    circuitBreaker: ["zahlung-psp", "kauf-zahlung", "gw-kauf", "gw-zahlung"],
    bulkhead: ["zahlung-psp", "gw-kauf", "kauf-zahlung", "gw-angebot", "gw-zahlung"],
    queue: ["kauf-zahlung"],
  },
  budget: 330,
  slo: { p95Ms: 500, verfuegbarkeit: 0.99 },
  musterstrategie:
    "Vor dem Start: Aufruf Kaufservice → Zahlungsservice über eine Queue entkoppeln (Käufe werden bestätigt, die Zahlung läuft im Hintergrund). Die Queue allein reicht nicht: Ohne Schutz hängen die Worker des Zahlungsservice am Anbieter und blockieren auch die Kaufstatus-Abfragen. Darum zusätzlich mindestens zwei von: Timeout zu PayAlpin auf 1500 ms, höchstens 1 Wiederholung, Circuit Breaker auf Zahlungsservice → PayAlpin, Bulkhead auf Zahlungsservice → PayAlpin. Nach dem Ausfall den Zahlungsservice massvoll auf 3 Instanzen skalieren: Der Rückstau wird abgebaut, ohne PayAlpin gleich wieder zu überlasten.",
}
