// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// lib/archsim/scenarios/index.ts
// Missionen des Architektur-Leitstands (TypeScript-Daten, client- und servertauglich).

import type { Mission } from "../types"
import { m1Velokurier } from "./m1-velokurier"
import { m2BlackFriday } from "./m2-black-friday"
import { m3Zahlungsanbieter } from "./m3-zahlungsanbieter"
import { m4Ticketplattform } from "./m4-ticketplattform"

/** Missionen in Spielreihenfolge */
export const MISSIONEN: readonly Mission[] = [m1Velokurier, m2BlackFriday, m3Zahlungsanbieter, m4Ticketplattform]

export { m1Velokurier, m2BlackFriday, m3Zahlungsanbieter, m4Ticketplattform }
