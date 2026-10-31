// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// lib/simulation/rng.ts
// Zufallsgenerator mulberry32 (Spezifikation 3.15). Zustand als 32-Bit-Ganzzahl, JSON-sicher.

/** Liefert [Zufallszahl in [0,1), neuer Zustand]. Rein, ohne Seiteneffekt. */
export function nextRandom(s: number): [number, number] {
  const a = (s + 0x6d2b79f5) | 0
  let t = Math.imul(a ^ (a >>> 15), 1 | a)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, a]
}

/** Zieht eine Zahl aus `state.rng` und schreibt den neuen Zustand zurück (nur auf Arbeitskopien verwenden). */
export function draw(holder: { rng: number }): number {
  const [value, next] = nextRandom(holder.rng)
  holder.rng = next
  return value
}
