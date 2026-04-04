# Interview: Lernassistent Web-App
**Datum:** 2026-04-04

---

## Zielgruppe & Lerninhalt

**F: Für wen ist der Lernassistent gedacht?**
> Studenten

**F: Welche Art von Lerninhalt soll der Assistent unterstützen?**
> Karteikarten / Flashcards + Quizze & Tests

**F: Welches KI-Modell soll im Hintergrund laufen?**
> Claude (Anthropic)

**F: Sollen Nutzer sich registrieren / einloggen können?**
> Beides möglich — öffentlicher Bereich + optionale Anmeldung für erweiterte Funktionen

---

## Technik & Karteikarten

**F: Welchen Tech Stack bevorzugst du für die Web-App?**
> Next.js (React)

**F: Welche Datenbank soll für Nutzer, Karten und Fortschritt genutzt werden?**
> Keine Präferenz (Empfehlung: PostgreSQL via Prisma ORM)

**F: Wie sollen Karteikarten erstellt werden?**
> Karteikarten werden mit Claude in einem separaten Chat-Fenster erstellt, dann exportiert und in der App importiert. Außerdem Import via CSV/Anki-Format.

**F: Soll ein Spaced-Repetition-Algorithmus (SRS) eingesetzt werden?**
> Ja, SRS (SM-2/FSRS) — adaptiv wie Anki

---

## Quiz & Deployment

**F: Welche Quiz-Formate soll die App unterstützen?**
> Multiple Choice + Freitext-Antwort (KI-Bewertung) + Wahr / Falsch

**F: In welcher Sprache soll die App-Oberfläche sein?**
> Deutsch

**F: Wie soll die App auf dem Hostinger-VPS deployed werden?**
> Docker / Docker Compose

**F: Hast du die Domain schon bei Hostinger registriert?**
> Ja, Domain vorhanden

---

## Design & Features

**F: Welches Design / Look & Feel soll die App haben?**
> Bunt & Gamifiziert — Duolingo-Style (Punkte, Streak, motivierendes UI)

**F: Welche Lernstatistiken sollen angezeigt werden?**
> Tages-Streak + Karten-Fortschritt + Quiz-Ergebnisse + Lernzeit

**F: Soll die App kostenlos oder kostenpflichtig sein?**
> Komplett kostenlos

**F: Was muss im ersten Release (MVP) unbedingt dabei sein?**
> Karteikarten-Import + Quiz-Modus + Nutzer-Accounts

---

## Weitere Entscheidungen

**F: Soll das Claude-Chat-Fenster bereits im MVP dabei sein?**
> Ja, im MVP dabei

**F: Soll es eine öffentliche Landing Page geben?**
> Ja, mit Infos zur App und Registrierungsbutton

---

## Zusammenfassung

| Eigenschaft | Entscheidung |
|---|---|
| Zielgruppe | Studenten |
| Sprache | Deutsch |
| KI | Claude (Anthropic, claude-sonnet-4-6) |
| Frontend | Next.js 14 (App Router) |
| Datenbank | PostgreSQL + Prisma ORM |
| Auth | NextAuth.js |
| Lernalgorithmus | FSRS (Spaced Repetition) |
| Quiz-Formate | Multiple Choice, Wahr/Falsch, Freitext |
| Karteikarten-Erstellung | Claude-Chat + Export → Import (CSV/Anki) |
| Design | Bunt & Gamifiziert (Duolingo-Style) |
| Deployment | Docker Compose + Nginx + HTTPS |
| Hosting | Hostinger VPS |
| Monetarisierung | Kostenlos |
| Landing Page | Ja, öffentlich |

## Offene Punkte
- VPS-Specs auf Hostinger (RAM/CPU)?
- Admin-Bereich für Nutzerverwaltung gewünscht?

## Zusätzliche Informationen
- Bestehende Domain: **jan-stocker.cloud**
- Dort läuft bereits eine verschlüsselte Subdomain (CV): `https://jan-stocker.cloud/cv-jstocker-2026-x8Lp`
- Der Lernassistent wird ebenfalls auf dieser Domain / einem Subdomain davon laufen
