// lib/fsrs.ts
// Implementierung des FSRS-4.5 Algorithmus fuer Spaced Repetition.
// Basierend auf: https://github.com/open-spaced-repetition/fsrs4anki
//
// FSRS (Free Spaced Repetition Scheduler) modelliert das Gedaechtnis mit
// zwei Hauptvariablen: Stability (S) und Difficulty (D).
// Stability = Anzahl Tage bis Retrievability auf 90% faellt.
// Difficulty = Schwierigkeit der Karte (1-10 Skala).

// --- Typen ---

/** Karten-Zustand im FSRS-System */
export const State = {
  New: 0,
  Learning: 1,
  Review: 2,
  Relearning: 3,
} as const

export type StateType = (typeof State)[keyof typeof State]

/** Bewertung einer Karte */
export const Rating = {
  Again: 1,
  Hard: 2,
  Good: 3,
  Easy: 4,
} as const

export type RatingType = (typeof Rating)[keyof typeof Rating]

/** Kartenstruktur fuer FSRS-Berechnungen */
export interface FSRSCard {
  due: Date
  stability: number
  difficulty: number
  elapsedDays: number
  scheduledDays: number
  reps: number
  lapses: number
  state: StateType
  lastReview: Date | null
}

/** Ergebnis einer Scheduling-Berechnung */
export interface SchedulingResult {
  card: FSRSCard
  reviewLog: {
    rating: RatingType
    scheduledDays: number
    elapsedDays: number
    review: Date
    state: StateType
  }
}

// --- FSRS-4.5 Default-Parameter ---
// 19 optimierte Gewichte (w0..w18) aus dem FSRS-4.5 Paper.
// w0-w3: initiale Stabilitaet nach erster Bewertung (Again/Hard/Good/Easy)
// w4-w5: initiale Schwierigkeit
// w6: Schwierigkeits-Reversion zum Mittelwert
// w7-w10: Stabilitaets-Berechnung fuer erfolgreiche Reviews
// w11-w14: Stabilitaets-Berechnung fuer fehlgeschlagene Reviews (Again)
// w15-w16: Hard-Penalty und Easy-Bonus
// w17-w18: kurzfristige Stabilitaet

const DEFAULT_W: readonly number[] = [
  0.4072, // w0: initiale Stabilitaet bei Again
  1.1829, // w1: initiale Stabilitaet bei Hard
  3.1262, // w2: initiale Stabilitaet bei Good
  15.4722, // w3: initiale Stabilitaet bei Easy
  7.2102, // w4: initiale Schwierigkeit (Basis)
  0.5316, // w5: initiale Schwierigkeit (Rating-Faktor)
  1.0651, // w6: Schwierigkeits-Reversion zum Mittelwert
  0.0046, // w7: Stabilitaets-Faktor (Potenzgesetz)
  1.5071, // w8: Stabilitaets-Faktor (Schwierigkeits-Einfluss)
  0.1367, // w9: Stabilitaets-Faktor (Stabilitaets-Decay)
  1.0135, // w10: Stabilitaets-Faktor (Retrievability-Einfluss)
  2.1214, // w11: Forget-Stabilitaet (Basis)
  0.0679, // w12: Forget-Stabilitaet (Schwierigkeits-Einfluss)
  0.3606, // w13: Forget-Stabilitaet (vorherige Stabilitaet)
  1.1712, // w14: Forget-Stabilitaet (Retrievability-Einfluss)
  1.0, // w15: Hard-Penalty
  0.0, // w16: Easy-Bonus
  3.27, // w17: kurzfristige Stabilitaet (Short-Term)
  0.2563, // w18: kurzfristige Stabilitaet (Decay)
] as const

// --- Hilfsfunktionen ---

/** Begrenzt einen Wert auf [min, max] */
function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

/** Berechnet die Anzahl Tage zwischen zwei Daten */
function daysBetween(a: Date, b: Date): number {
  const msPerDay = 1000 * 60 * 60 * 24
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / msPerDay))
}

// --- FSRS Kernfunktionen ---

/**
 * Berechnet die Retrievability (Abrufwahrscheinlichkeit) einer Karte.
 * R(t) = (1 + t / (9 * S))^(-1)
 * Bei t=S ist R = 0.9 (90%), das ist die Definition von Stability.
 */
export function calculateRetrievability(
  elapsedDays: number,
  stability: number
): number {
  if (stability <= 0) return 0
  return Math.pow(1 + elapsedDays / (9 * stability), -1)
}

/**
 * Berechnet die initiale Schwierigkeit nach dem ersten Review.
 * D0(G) = w4 - exp(w5 * (G - 1)) + 1
 * G = Rating (1-4)
 */
function initialDifficulty(rating: RatingType): number {
  const w = DEFAULT_W
  return clamp(w[4] - Math.exp(w[5] * (rating - 1)) + 1, 1, 10)
}

/**
 * Berechnet die neue Schwierigkeit nach einem Review.
 * Verwendet Mean-Reversion: D' = w6 * D0(3) + (1 - w6) * (D - w7 * (G - 3))
 * Dies zieht die Schwierigkeit langsam zum Mittelwert zurueck.
 */
export function calculateDifficulty(
  d: number,
  rating: RatingType
): number {
  const w = DEFAULT_W
  const d0Mean = initialDifficulty(Rating.Good) // D0(3) = Mittelwert-Schwierigkeit
  const newD = w[6] * d0Mean + (1 - w[6]) * (d - w[7] * (rating - 3))
  return clamp(newD, 1, 10)
}

/**
 * Berechnet die initiale Stabilitaet nach dem ersten Review.
 * S0(G) = w[G-1] (direkt aus den Parametern)
 */
function initialStability(rating: RatingType): number {
  return Math.max(DEFAULT_W[rating - 1], 0.1)
}

/**
 * Berechnet die neue Stabilitaet nach einem erfolgreichen Review (Rating >= 2).
 * S'_r(D, S, R, G) = S * (e^w7 * (11 - D) * S^(-w8) * (e^(w9*(1-R)) - 1) * hardPenalty * easyBonus + 1)
 */
export function calculateStability(
  d: number,
  s: number,
  r: number,
  rating: RatingType
): number {
  const w = DEFAULT_W
  const hardPenalty = rating === Rating.Hard ? w[15] : 1
  const easyBonus = rating === Rating.Easy ? (1 + w[16]) : 1

  // S'_r = S * (e^w7 * (11-D) * S^(-w8) * (e^(w9*(1-R)) - 1) * hardPenalty * easyBonus + 1)
  const newS =
    s *
    (1 +
      Math.exp(w[7]) *
        (11 - d) *
        Math.pow(s, -w[8]) *
        (Math.exp(w[9] * (1 - r)) - 1) *
        hardPenalty *
        easyBonus)

  return clamp(newS, 0.1, 36500) // Max ~100 Jahre
}

/**
 * Berechnet die neue Stabilitaet nach einem fehlgeschlagenen Review (Again).
 * S'_f(D, S, R) = w11 * D^(-w12) * ((S+1)^w13 - 1) * e^(w14*(1-R))
 */
function calculateForgetStability(
  d: number,
  s: number,
  r: number
): number {
  const w = DEFAULT_W
  const newS =
    w[11] *
    Math.pow(d, -w[12]) *
    (Math.pow(s + 1, w[13]) - 1) *
    Math.exp(w[14] * (1 - r))

  return clamp(Math.min(newS, s), 0.1, 36500)
}

/**
 * Berechnet die kurzfristige Stabilitaet (fuer Learning/Relearning).
 * S'_s(S, G) = S * e^(w17 * (G - 3 + w18))
 */
function shortTermStability(s: number, rating: RatingType): number {
  const w = DEFAULT_W
  const newS = s * Math.exp(w[17] * (rating - 3 + w[18]))
  return clamp(newS, 0.1, 36500)
}

/**
 * Berechnet das naechste Review-Datum basierend auf scheduledDays.
 */
export function getNextReviewDate(scheduledDays: number): Date {
  const now = new Date()
  const next = new Date(now.getTime() + scheduledDays * 24 * 60 * 60 * 1000)
  return next
}

/**
 * Hauptfunktion: Plant die naechste Wiederholung einer Karte.
 * Berechnet neue FSRS-Werte basierend auf dem aktuellen Zustand und der Bewertung.
 */
export function scheduleCard(
  card: FSRSCard,
  rating: RatingType
): SchedulingResult {
  const now = new Date()
  const elapsed = card.lastReview
    ? daysBetween(card.lastReview, now)
    : 0

  let newCard: FSRSCard

  if (card.state === State.New) {
    // --- Neue Karte: Erstes Review ---
    const s = initialStability(rating)
    const d = initialDifficulty(rating)

    if (rating === Rating.Again) {
      // Bleibt in Learning, wiederholen in 1 Minute (0 Tage)
      newCard = {
        ...card,
        stability: s,
        difficulty: d,
        state: State.Learning,
        reps: card.reps + 1,
        lapses: 0,
        elapsedDays: 0,
        scheduledDays: 0,
        due: new Date(now.getTime() + 60 * 1000), // 1 Minute
        lastReview: now,
      }
    } else if (rating === Rating.Hard) {
      // Learning, wiederholen in 5 Minuten (0 Tage)
      newCard = {
        ...card,
        stability: s,
        difficulty: d,
        state: State.Learning,
        reps: card.reps + 1,
        lapses: 0,
        elapsedDays: 0,
        scheduledDays: 0,
        due: new Date(now.getTime() + 5 * 60 * 1000), // 5 Minuten
        lastReview: now,
      }
    } else {
      // Good/Easy: Ab in Review mit berechnetem Intervall
      const scheduledDays = Math.max(1, Math.round(s))
      newCard = {
        ...card,
        stability: s,
        difficulty: d,
        state: State.Review,
        reps: card.reps + 1,
        lapses: 0,
        elapsedDays: 0,
        scheduledDays,
        due: getNextReviewDate(scheduledDays),
        lastReview: now,
      }
    }
  } else if (card.state === State.Learning || card.state === State.Relearning) {
    // --- Learning/Relearning: kurzfristige Wiederholung ---
    const s = shortTermStability(card.stability, rating)
    const d = calculateDifficulty(card.difficulty, rating)

    if (rating === Rating.Again) {
      newCard = {
        ...card,
        stability: s,
        difficulty: d,
        state: card.state === State.Learning ? State.Learning : State.Relearning,
        reps: card.reps + 1,
        lapses: card.lapses + (card.state === State.Relearning ? 0 : 1),
        elapsedDays: elapsed,
        scheduledDays: 0,
        due: new Date(now.getTime() + 60 * 1000), // 1 Minute
        lastReview: now,
      }
    } else if (rating === Rating.Hard) {
      newCard = {
        ...card,
        stability: s,
        difficulty: d,
        state: card.state,
        reps: card.reps + 1,
        elapsedDays: elapsed,
        scheduledDays: 0,
        due: new Date(now.getTime() + 5 * 60 * 1000), // 5 Minuten
        lastReview: now,
      }
    } else {
      // Good/Easy: Graduierung zu Review
      const scheduledDays = Math.max(1, Math.round(s))
      newCard = {
        ...card,
        stability: s,
        difficulty: d,
        state: State.Review,
        reps: card.reps + 1,
        elapsedDays: elapsed,
        scheduledDays,
        due: getNextReviewDate(scheduledDays),
        lastReview: now,
      }
    }
  } else {
    // --- Review: Langzeitwiederholung ---
    const r = calculateRetrievability(elapsed, card.stability)
    const d = calculateDifficulty(card.difficulty, rating)

    if (rating === Rating.Again) {
      // Vergessen: Zurueck in Relearning
      const s = calculateForgetStability(d, card.stability, r)
      newCard = {
        ...card,
        stability: s,
        difficulty: d,
        state: State.Relearning,
        reps: card.reps + 1,
        lapses: card.lapses + 1,
        elapsedDays: elapsed,
        scheduledDays: 0,
        due: new Date(now.getTime() + 60 * 1000), // 1 Minute
        lastReview: now,
      }
    } else {
      // Hard/Good/Easy: Erfolgreiches Review
      const s = calculateStability(d, card.stability, r, rating)
      const scheduledDays = Math.max(1, Math.round(s))
      newCard = {
        ...card,
        stability: s,
        difficulty: d,
        state: State.Review,
        reps: card.reps + 1,
        elapsedDays: elapsed,
        scheduledDays,
        due: getNextReviewDate(scheduledDays),
        lastReview: now,
      }
    }
  }

  return {
    card: newCard,
    reviewLog: {
      rating,
      scheduledDays: newCard.scheduledDays,
      elapsedDays: newCard.elapsedDays,
      review: now,
      state: card.state,
    },
  }
}

/**
 * Berechnet voraussichtliche Intervalle fuer alle 4 Bewertungen.
 * Wird in der UI angezeigt, damit der Nutzer sieht, wann die Karte
 * bei welcher Bewertung als naechstes dran waere.
 */
export function previewSchedule(
  card: FSRSCard
): Record<RatingType, { scheduledDays: number; due: Date }> {
  const results = {} as Record<RatingType, { scheduledDays: number; due: Date }>

  for (const rating of [Rating.Again, Rating.Hard, Rating.Good, Rating.Easy]) {
    const result = scheduleCard(card, rating)
    results[rating] = {
      scheduledDays: result.card.scheduledDays,
      due: result.card.due,
    }
  }

  return results
}

/**
 * Formatiert ein Intervall in lesbaren Text.
 * z.B. 0 -> "< 1 Min.", 1 -> "1 Tag", 7 -> "1 Woche"
 */
export function formatInterval(scheduledDays: number, due: Date): string {
  if (scheduledDays === 0) {
    // Kurzfristige Wiederholung: Minuten berechnen
    const now = new Date()
    const diffMs = due.getTime() - now.getTime()
    const diffMins = Math.max(1, Math.round(diffMs / (1000 * 60)))

    if (diffMins < 60) return `${diffMins} Min.`
    return `${Math.round(diffMins / 60)} Std.`
  }

  if (scheduledDays === 1) return "1 Tag"
  if (scheduledDays < 7) return `${scheduledDays} Tage`
  if (scheduledDays < 30) {
    const weeks = Math.round(scheduledDays / 7)
    return weeks === 1 ? "1 Woche" : `${weeks} Wochen`
  }
  if (scheduledDays < 365) {
    const months = Math.round(scheduledDays / 30)
    return months === 1 ? "1 Monat" : `${months} Monate`
  }
  const years = Math.round(scheduledDays / 365)
  return years === 1 ? "1 Jahr" : `${years} Jahre`
}
