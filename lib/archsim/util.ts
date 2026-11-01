// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// lib/archsim/util.ts
// Kleine reine Hilfsfunktionen.

export function clamp(x: number, lo: number, hi: number): number {
  if (!Number.isFinite(x)) return x > 0 ? hi : lo
  return x < lo ? lo : x > hi ? hi : x
}

/** Tiefe Kopie über JSON: garantiert JSON-reine Werte (undefined fällt weg). */
export function klone<T>(x: T): T {
  return JSON.parse(JSON.stringify(x)) as T
}

export function median(werte: number[]): number | null {
  if (werte.length === 0) return null
  const s = [...werte].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 === 1 ? s[m] : (s[m - 1] + s[m]) / 2
}
