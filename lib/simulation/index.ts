// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// lib/simulation/index.ts
// Öffentliche Schnittstelle des Rechenkerns für Server und Tests (Spezifikation 4.3):
// Kern (core.ts) plus loadScenario mit statischem JSON-Import und Zod-Prüfung (scenarios.ts).
// Client-Komponenten importieren stattdessen "@/lib/simulation/core"; Szenarien lädt der Browser
// nur dynamisch über components/features/leitstand/scenarioLoader.ts.

export * from "./core"
export { loadScenario, SCENARIO_IDS } from "./scenarios"
