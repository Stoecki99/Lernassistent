// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// lib/simulation/team.ts
// Motivation, Teamphasen, Gespräche, Anlässe, Weiterbildung, Kalender (Spezifikation 3.5, 3.7).

import { dayOf } from "./calendar"
import { clamp, safeDiv, type Ctx } from "./context"
import { isPresent, pensumAt } from "./work"
import type { AreaId, CalendarEntry, PersonId, SimState } from "./types"

/** Termine der Projektleitung, die zur Grenze «höchstens 4 je Tag» zählen (3.5) */
const PL_KINDS: ReadonlyArray<CalendarEntry["kind"]> = ["gespraech", "mittagessen", "teamabend", "zusatzbericht"]

export function addCalendarEntry(state: SimState, entry: Omit<CalendarEntry, "id">): CalendarEntry {
  const full: CalendarEntry = { id: `c${state.calendar.length + 1}`, ...entry }
  state.calendar.push(full)
  return full
}

/** Anzahl Termine der Projektleitung an einem Tag (3.5) */
export function plAppointmentsOnDay(state: SimState, day: number): number {
  return state.calendar.filter((c) => dayOf(c.tick) === day && PL_KINDS.includes(c.kind)).length
}

export function clampMotivation(m: number): number {
  return clamp(m, 0, 120)
}

/** Hat die Person eine offene Zuweisung (Vorgang nicht fertig)? */
function hasOpenAssignment(state: SimState, personId: PersonId): boolean {
  return state.people[personId].assignments.some((a) => state.tasks[a.taskId]?.status !== "fertig")
}

/**
 * Teammotivation (3.7): nach Pensum gewichtetes Mittel aller Personen, die in den letzten 5 Tagen
 * gearbeitet haben oder eine offene Zuweisung haben. Ohne solche Personen: Mittel aller verfügbaren.
 */
export function teamMotivation(state: SimState, ctx: Ctx): number {
  let num = 0
  let den = 0
  let numAll = 0
  let denAll = 0
  for (const pid of ctx.personIds) {
    const person = state.people[pid]
    if (!person.available) continue
    const w = ctx.people[pid].pensum
    numAll += w * person.motivation
    denAll += w
    const recent = person.lastWorkTick !== null && person.lastWorkTick >= state.tick - 10
    if (recent || hasOpenAssignment(state, pid)) {
      num += w * person.motivation
      den += w
    }
  }
  if (den > 0) return num / den
  return safeDiv(numAll, denAll, 100)
}

/**
 * Tagesende (3.7, Nachmittagstakt), je Person in dieser Reihenfolge:
 * Rückkehr zum Grundwert, Überstunden-Serie und -Abzug, Leerlauf. Dazu Ressourcenausgleich (3.10).
 */
export function dayEndPeople(state: SimState, ctx: Ctx, tick: number, hadWorkable: Record<string, boolean>): void {
  const p = ctx.params
  for (const pid of ctx.personIds) {
    const person = state.people[pid]
    const def = ctx.people[pid]
    if (!person.available) {
      person.dayPaidHours = 0
      continue
    }
    const present = isPresent(person, tick)
    let m = person.motivation
    // Rückkehr zum Grundwert: m += 0.03 × (85 − m)
    m += p.motDrift * (p.motBase - m)
    // Überstunden-Serie: Arbeitstage am Stück mit Stufe ≥ 1 (3.4)
    if (person.overtime >= 1 && present) {
      person.overtimeStreakDays++
      person.overtimeTotalDays++
      person.weekOvertimeDays++
    } else {
      person.overtimeStreakDays = 0
    }
    // Serie > Toleranz: Stufe 1 −1.5, Stufe 2 −3 je Tag; × 1.3 bei Bedürfnis Sicherheit
    if (person.overtimeStreakDays > p.otTolerance[def.overtimeTolerance] && person.overtime >= 1) {
      const base = person.overtime === 2 ? 3 : 1.5
      m -= base * (def.needs.includes("sicherheit") ? 1.3 : 1)
    }
    // Leerlauf: > 1 Tag ohne bearbeitbare Zuweisung → −1 je Tag (−2 Entwicklung); Linie ohne Wirkung
    const idle = present && !hadWorkable[pid]
    if (idle) {
      person.idleDays++
      person.weekIdleDays++
      if (def.origin === "kern") state.stats.idleCoreDays++
      if (person.idleDays > 1 && (def.origin === "kern" || def.origin === "lieferant")) {
        m -= def.needs.includes("entwicklung") ? 2 : 1
      }
    } else {
      person.idleDays = 0
    }
    person.motivation = clampMotivation(m)
    // Ressourcenausgleich (3.10): Personen mit ≥ 1 Zuweisung, u = bezahlte Projektstunden ÷ (8 × Pensum)
    if (person.assignments.length > 0) {
      const pensum = pensumAt(state, ctx, pid, tick)
      if (pensum > 0) {
        const u = person.dayPaidHours / (2 * p.hoursPerTick * pensum)
        state.stats.ressourcenausgleich.allDays++
        if (u >= 0.5 - 1e-9 && u <= 1.0 + 1e-9) state.stats.ressourcenausgleich.okDays++
      }
    }
    person.dayPaidHours = 0
  }
}

/** Offener Konflikt: aktive Trennung (E07 C) oder Flag `konfliktOffen` (3.7 Normierung → Leistung) */
function openConflict(state: SimState, tick: number): boolean {
  return state.flags.konfliktOffen === true || state.separations.some((s) => s.untilTick > tick)
}

/**
 * Teamphasen nach Tuckman (3.7), am Tagesende geprüft. Liefert true bei einem Wechsel.
 * Orientierung → Sturm: Tag 6 erreicht (Tag 4 ohne Kick-off E01 A = Flag kickoff "gut").
 * Sturm → Normierung: automatisch nach 8 Tagen (+ Flag sturmExtraDays), dann alle Mot −5.
 * Normierung → Leistung: ab Tag 15, Teammotivation ≥ 90, kein offener Konflikt.
 * Leistung → Normierung: Teammotivation < 80.
 */
export function updateTeamPhase(state: SimState, ctx: Ctx, tick: number): boolean {
  const nextDay1 = dayOf(tick) + 2
  const motivation = teamMotivation(state, ctx)
  const set = (phase: SimState["teamPhase"]) => {
    state.teamPhase = phase
    state.teamPhaseSinceTick = tick + 1
  }
  switch (state.teamPhase) {
    case "orientierung": {
      const threshold = state.flags.kickoff === "gut" ? 6 : 4
      if (nextDay1 >= threshold) {
        set("sturm")
        return true
      }
      return false
    }
    case "sturm": {
      const extra = typeof state.flags.sturmExtraDays === "number" ? state.flags.sturmExtraDays : 0
      const days = (tick + 1 - state.teamPhaseSinceTick) / 2
      if (days >= 8 + extra) {
        set("normierung")
        for (const pid of ctx.personIds) {
          const person = state.people[pid]
          if (person.available) person.motivation = clampMotivation(person.motivation - 5)
        }
        return true
      }
      return false
    }
    case "normierung":
      if (nextDay1 >= 15 && motivation >= 90 && !openConflict(state, tick)) {
        set("leistung")
        return true
      }
      return false
    case "leistung":
      if (motivation < 80) {
        set("normierung")
        return true
      }
      return false
  }
}

/**
 * Gespräch (Aktion talk, 3.7): 1 h Termin (fuehrung); +8, × 1.5 bei Anerkennung oder Klarheit;
 * nur +2, wenn das letzte Gespräch weniger als 5 Tage her ist.
 */
export function talk(state: SimState, ctx: Ctx, personId: PersonId, tick: number): number {
  const p = ctx.params
  const person = state.people[personId]
  const def = ctx.people[personId]
  let boost = p.talkBoost
  if (def.needs.includes("anerkennung") || def.needs.includes("klarheit")) boost *= 1.5
  if (person.lastTalkTick !== null && tick - person.lastTalkTick < p.talkCooldownDays * 2) boost = 2
  person.motivation = clampMotivation(person.motivation + boost)
  person.lastTalkTick = tick
  person.appointmentHours += 1
  addCalendarEntry(state, { tick, kind: "gespraech", personIds: [personId], hours: 1 })
  return boost
}

/**
 * Anlässe (3.5): Mittagessen CHF 45 je Person, Mot +4 (× 1.5 Zugehörigkeit), Abklingzeit 5 Tage (innerhalb +1);
 * Teamabend CHF 120 je Person, Mot +10 (× 1.5), Abklingzeit 10 Tage (innerhalb +3). Beide 0 h.
 * Liefert die Kosten.
 */
export function teamEvent(
  state: SimState,
  ctx: Ctx,
  kind: "mittagessen" | "teamabend",
  personIds: PersonId[],
  tick: number,
): number {
  const lunch = kind === "mittagessen"
  const price = lunch ? 45 : 120
  const boost = lunch ? 4 : 10
  const cooldownTicks = (lunch ? 5 : 10) * 2
  const reduced = lunch ? 1 : 3
  for (const pid of [...personIds].sort()) {
    const person = state.people[pid]
    const def = ctx.people[pid]
    const last = lunch ? person.lastLunchTick : person.lastTeamEveningTick
    let delta = last !== null && tick - last < cooldownTicks ? reduced : boost
    if (delta === boost && def.needs.includes("zugehoerigkeit")) delta *= 1.5
    person.motivation = clampMotivation(person.motivation + delta)
    if (lunch) person.lastLunchTick = tick
    else person.lastTeamEveningTick = tick
  }
  addCalendarEntry(state, { tick, kind, personIds: [...personIds].sort() })
  return price * personIds.length
}

/**
 * Weiterbildung (3.4, 3.5): 2 Tage abwesend (Stunden nicht bezahlt), Profil +1 (höchstens 6)
 * ab Kursende + 10 Takte; Mot +10 bei Bedürfnis Entwicklung, sonst +4. Je Person einmal.
 */
export function startTraining(state: SimState, ctx: Ctx, personId: PersonId, area: AreaId, tick: number): void {
  const person = state.people[personId]
  const def = ctx.people[personId]
  const end = tick + 4
  person.absences.push({ fromTick: tick, toTick: end, reason: "weiterbildung" })
  person.pendingQualifications.push({ area, delta: 1, readyTick: end + 10 })
  person.motivation = clampMotivation(person.motivation + (def.needs.includes("entwicklung") ? 10 : 4))
  person.trainingDone = true
  state.hours.weiterbildung += 2 * 2 * ctx.params.hoursPerTick * def.pensum
  addCalendarEntry(state, { tick, kind: "weiterbildung", personIds: [personId], area })
}
