// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// lib/archsim/scenarios/m1-velokurier.ts
// Mission 1 (Einführung, geführt): Monolith mit Datenbank, Last steigt über Mittag. Skalieren und Cache lernen.

import type { Mission } from "../types"

export const m1Velokurier: Mission = {
  id: "m1-velokurier",
  version: 1,
  titel: "Velokurier über Mittag",
  untertitel: "Einführung: skalieren und cachen",
  schwierigkeit: 1,
  art: "vorgegeben",
  gefuehrt: true,
  firma: "Velokurier Aarebogen GmbH",
  briefing:
    "<p>Die <strong>Velokurier Aarebogen GmbH</strong> liefert Pakete per Velo durch die Stadt. Kundinnen erfassen Aufträge in der App und verfolgen ihre Lieferung live.</p>" +
    "<p>Die ganze Logik steckt in einem <strong>Monolithen</strong> hinter einem Lastverteiler, die Daten in einer PostgreSQL-Datenbank. Am Morgen ist wenig los, über Mittag vervierfacht sich die Last. Heute ist zudem Regen angesagt.</p>" +
    "<p>Deine Aufgabe: Halte die App 80 Minuten lang schnell und verfügbar, ohne das Budget zu sprengen. Die Hinweise unterwegs helfen dir.</p>",
  lernziele: [
    { text: "Auslastung ρ lesen und erklären, warum die Antwortzeit ab etwa 80 % stark steigt.", station: "06-architektur-leitstand" },
    { text: "Einen zustandslosen Monolithen hinter einem Lastverteiler horizontal skalieren.", station: "03-container-kubernetes", abschnitt: "objekte" },
    { text: "Mit einem Cache (Cache-Aside) Lesezugriffe von der Datenbank fernhalten.", station: "05-architektur-modellieren", abschnitt: "verfahren" },
  ],
  modell: {
    titel: "Velokurier: Monolith mit Datenbank",
    ansicht: "komponenten",
    richtung: "rechts",
    elemente: [
      { id: "kundin", typ: "akteur", name: "Kundin", x: 0, y: 1, info: { was: "Gibt Aufträge auf und verfolgt Lieferungen." } },
      { id: "app", typ: "web", name: "Velokurier-App", technologie: "React", x: 1, y: 1, info: { was: "Web-App im Browser.", wofuer: "Aufträge erfassen, Lieferung verfolgen." } },
      { id: "lb", typ: "lastverteiler", name: "Lastverteiler", technologie: "HAProxy", x: 2, y: 1, info: { was: "Verteilt Anfragen auf alle Instanzen des Monolithen.", warum: "Ohne Lastverteiler bringt eine zweite Instanz nichts." } },
      {
        id: "mono", typ: "monolith", name: "Kurier-App", technologie: "Spring Boot", x: 3, y: 1, sim: { instanzen: 2 },
        info: { was: "Monolith mit Auftragserfassung, Tourenplanung und Tracking.", kann: "Zustandslos, darum horizontal skalierbar.", technologie: "Java 21, Spring Boot" },
      },
      {
        id: "db", typ: "datenbank", name: "Auftrags-DB", technologie: "PostgreSQL", x: 4, y: 1, sim: { kapazitaet: 120 },
        info: { was: "Relationale Datenbank mit allen Aufträgen und Positionen.", kann: "Rund 120 Abfragen pro Sekunde, skaliert nicht horizontal." },
      },
    ],
    verbindungen: [
      { id: "kundin-app", von: "kundin", nach: "app", art: "abhaengigkeit", label: "nutzt" },
      { id: "app-lb", von: "app", nach: "lb", art: "sync", label: "HTTPS" },
      { id: "lb-mono", von: "lb", nach: "mono", art: "sync", label: "HTTP" },
      { id: "mono-db", von: "mono", nach: "db", art: "daten", label: "SQL" },
    ],
    ablaeufe: [
      {
        id: "verfolgen",
        name: "Lieferung verfolgen",
        schritte: [
          { von: "app", nach: "lb", art: "sync", text: "Die App fragt alle paar Sekunden die Position des Kuriers ab." },
          { von: "lb", nach: "mono", art: "sync", text: "Der Lastverteiler wählt eine Instanz." },
          { von: "mono", nach: "db", art: "daten", text: "Der Monolith liest Auftrag und Position aus der Datenbank." },
        ],
      },
    ],
  },
  anfragen: [
    { id: "verfolgen", name: "Lieferung verfolgen", anteil: 0.7, einstieg: "app", ziele: ["mono"] },
    { id: "erfassen", name: "Auftrag erfassen", anteil: 0.3, einstieg: "app", ziele: ["mono"], schreibend: true, kritisch: true },
  ],
  last: {
    punkte: [
      { t: 0, rps: 25 },
      { t: 20, rps: 55 },
      { t: 40, rps: 100 },
      { t: 55, rps: 115 },
      { t: 68, rps: 70 },
      { t: 80, rps: 45 },
    ],
    rauschen: 0.04,
  },
  dauer: 80,
  ereignisse: [
    {
      id: "regen",
      tick: 38,
      dauer: 12,
      titel: "Platzregen über der Stadt",
      text: "Alle wollen ihre Lieferung jetzt und schauen nach, wo der Kurier ist. Die Last steigt für 12 Minuten um 40 %.",
      wirkung: { art: "lastspitze", faktor: 1.4 },
    },
  ],
  erlaubteAktionen: ["skalieren", "autoscaling", "cache", "readReplica"],
  budget: 220,
  slo: { p95Ms: 300, verfuegbarkeit: 0.99 },
  hinweise: [
    { id: "start", wenn: { tick: 0 }, text: "Beobachte die Auslastung der Kurier-App. Unter 70 % ist alles ruhig, darüber wird es eng." },
    { id: "mono-heiss", wenn: { auslastung: "mono", ueber: 0.75 }, text: "Die Kurier-App ist über 75 % ausgelastet. Skaliere sie auf mehr Instanzen (der Lastverteiler verteilt automatisch). Neue Instanzen brauchen 2 Minuten zum Starten." },
    { id: "db-heiss", wenn: { auslastung: "db", ueber: 0.7 }, text: "Jetzt wird die Datenbank zum Engpass. Sie lässt sich nicht einfach vervielfachen. 70 % der Anfragen lesen nur: Ein Cache vor der Datenbank fängt sie ab." },
    { id: "regen", wenn: { ereignis: "regen" }, text: "Platzregen: 40 % mehr Last. Reicht deine Reserve? Autoscaling reagiert von selbst, braucht aber auch Startzeit." },
  ],
  musterstrategie: "Vor dem Start Cache vor die Auftrags-DB setzen, Kurier-App mit Autoscaling (2 bis 8 Instanzen) betreiben. Alternativ bei Minute 20 auf 4 und bei Minute 35 auf 6 Instanzen skalieren.",
}
