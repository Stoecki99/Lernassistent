// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

"use client"

// components/features/leitstand/context.tsx
// Gemeinsamer Zustand der Lauf-Ansicht für alle Ansichten (statt langer Prop-Ketten).

import { createContext, useContext } from "react"
import type { Action, KpiSnapshot, Scenario, ScheduleRow, SimState, TaskId } from "@/lib/simulation/core"
import type { Trace } from "./logic"

export type ViewKey =
  | "auftrag"
  | "uebersicht"
  | "vorgaenge"
  | "team"
  | "plan"
  | "auslastung"
  | "kalender"
  | "posteingang"
  | "risiken"
  | "budget"
  | "bericht"
  | "nachbesprechung"

export interface LeitstandCtx {
  scenario: Scenario
  state: SimState
  kpis: KpiSnapshot
  trace: Trace
  base: Record<TaskId, ScheduleRow>
  /** Aktion anwenden; liefert den neuen Zustand oder null (Meldung wird angezeigt). */
  run: (action: Action) => SimState | null
  view: ViewKey
  setView: (view: ViewKey) => void
  openEvent: (eventId: string) => void
  /** Kurze Meldung unten einblenden */
  notify: (text: string) => void
  readOnly: boolean
}

export const LeitstandContext = createContext<LeitstandCtx | null>(null)

export function useLeitstand(): LeitstandCtx {
  const ctx = useContext(LeitstandContext)
  if (!ctx) throw new Error("useLeitstand ausserhalb von LeitstandApp")
  return ctx
}

export function personName(scenario: Scenario, id: string): string {
  return scenario.people.find((p) => p.id === id)?.name ?? id
}

export function firstName(scenario: Scenario, id: string): string {
  return personName(scenario, id).split(" ")[0]
}

export function taskName(scenario: Scenario, id: string): string {
  return scenario.tasks.find((t) => t.id === id)?.name ?? id
}

/** Rolle zu einem angezeigten Namen (Person oder Stakeholder), für Bild-Beschriftungen; nur der erste Satz. */
export function roleOf(scenario: Scenario, name: string): string | undefined {
  const person = scenario.people.find((p) => p.name === name)
  if (person) return person.role
  if (scenario.coach.name === name) return "Coach"
  const stakeholder = scenario.stakeholders.find((s) => s.name === name)
  return stakeholder ? stakeholder.role.split(". ")[0].replace(/\.$/, "") : undefined
}
