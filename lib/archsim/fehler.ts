// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// lib/archsim/fehler.ts
// Fehler des Simulator-Kerns mit deutscher Meldung für die Oberfläche.

export type ArchSimFehlerCode =
  | "UNBEKANNT" // ID existiert nicht
  | "UNGUELTIG" // Wert ausserhalb des Bereichs, falsches Ziel
  | "NICHT_ERLAUBT" // Aktion in dieser Mission nicht erlaubt
  | "BEENDET" // Mission ist vorbei
  | "MODELL" // Modell ungültig (selbst modellierte Missionen)

export class ArchSimFehler extends Error {
  readonly code: ArchSimFehlerCode
  readonly details: string[]
  /** Index der fehlerhaften Aktion beim Nachspielen */
  aktionIndex?: number

  constructor(code: ArchSimFehlerCode, message: string, details: string[] = []) {
    super(message)
    this.name = "ArchSimFehler"
    this.code = code
    this.details = details
  }
}
