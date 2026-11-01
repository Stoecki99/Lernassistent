// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// lib/architektur-leitstand.ts
// Serverlogik des Architektur-Leitstands (docs/architektur-leitstand.md): Speicherung als Startwert +
// Aktionsprotokoll (+ Modell bei Missionen zum Modellieren), Nachspielen mit dem Simulator-Kern (lib/archsim),
// Punkte, Freischalten, Lernfortschritt Station 11, Zugang (nur Pro und Admin wie der Leitstand), Rate-Limit.
// Allgemeine Hilfen (Körpergrenze, Fehlerantwort, Prisma-Wiederholung, Zugang) kommen aus lib/leitstand.ts.
// Die reinen Regeln liegen in lib/architektur-leitstand-regeln.ts; pruefeUndHaengeAn und pruefeModellFuerLauf
// arbeiten ohne Datenbank und sind in tests/architektur-leitstand-api.test.ts geprüft.

import { NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/auth"
import { fortschrittSchreibdaten, type LernStatus } from "@/lib/validations/lernfortschritt"
import { MAX_AKTIONEN_PRO_LAUF } from "@/lib/validations/architektur-leitstand"
import {
  ARCHSIM_VERSION,
  ArchSimFehler,
  MISSION_IDS,
  auswerten,
  beende,
  ladeMission,
  modellSchema,
  parseAktionen,
  validiere,
  type Aktion,
  type ArchModell,
  type Mission,
  type Zustand,
} from "@/lib/archsim"
import {
  ARCHSIM_STATION,
  archsimAbzeichenErfuellt,
  archsimAbzeichenStatistik,
  besteSterne,
  ergebnisFuerSpeicher,
  istVeraltet,
  missionFreigeschaltet,
  nachspielen,
  punkteFuerVerbesserung,
  statusNachVersion,
  zusammenfassen,
  type GespeichertesErgebnis,
  type LaufZusammenfassung,
} from "@/lib/architektur-leitstand-regeln"
import {
  LeitstandError,
  NO_CACHE,
  hasLeitstandAccess,
  newSeed,
  prismaErrorCode,
  retryOnPrismaCodes,
  type LeitstandUser,
} from "@/lib/leitstand"

export { NO_CACHE, errorResponse, readJsonBody } from "@/lib/leitstand"

// ---------- Rate-Limit (im Speicher je Konto und Zweck, wie Chat und Leitstand) ----------

const limitMap = new Map<string, { anzahl: number; endetUm: number }>()
const LIMIT_FENSTER_MS = 60 * 1000

/** Anfragen je Minute und Konto */
export const ARCHSIM_LIMITS = { aktionen: 60, starten: 10, abschliessen: 10, lesen: 60, abbrechen: 10, modell: 30 } as const

export function pruefeArchsimLimit(userId: string, zweck: keyof typeof ARCHSIM_LIMITS): boolean {
  const jetzt = Date.now()
  if (limitMap.size > 5000) {
    for (const [schluessel, eintrag] of limitMap) if (jetzt > eintrag.endetUm) limitMap.delete(schluessel)
  }
  const schluessel = `${zweck}:${userId}`
  const eintrag = limitMap.get(schluessel)
  if (!eintrag || jetzt > eintrag.endetUm) {
    limitMap.set(schluessel, { anzahl: 1, endetUm: jetzt + LIMIT_FENSTER_MS })
    return true
  }
  if (eintrag.anzahl >= ARCHSIM_LIMITS[zweck]) return false
  eintrag.anzahl += 1
  return true
}

export function limitAntwort(): NextResponse {
  return NextResponse.json({ error: "Zu viele Anfragen. Bitte kurz warten." }, { status: 429, headers: { ...NO_CACHE, "Retry-After": "60" } })
}

// ---------- Zugang (wie Leitstand: nur Pro und Admin) ----------

/** Für Routen: eingeloggt (sonst 401) und Pro/Admin (sonst 403). */
export async function requireArchsimUser(): Promise<{ user: LeitstandUser; response?: undefined } | { user?: undefined; response: NextResponse }> {
  const sessionUser = await getCurrentUser()
  if (!sessionUser?.id) {
    return { response: NextResponse.json({ error: "Nicht autorisiert." }, { status: 401, headers: NO_CACHE }) }
  }
  const user: LeitstandUser = { id: sessionUser.id, email: sessionUser.email }
  if (!(await hasLeitstandAccess(user))) {
    return {
      response: NextResponse.json({ error: "Der Architektur-Leitstand ist im Pro-Abo enthalten.", code: "PRO_REQUIRED" }, { status: 403, headers: NO_CACHE }),
    }
  }
  return { user }
}

// ---------- Reine Prüfungen (ohne Datenbank) ----------

/** Mission laden; unbekannt → 400 */
export function requireMission(missionId: string): Mission {
  const mission = ladeMission(missionId)
  if (!mission) throw new LeitstandError(400, "BAD_REQUEST", "Unbekannte Mission.")
  return mission
}

/** Felder eines gespeicherten Laufs, die Nachspielen und Anhängen brauchen */
export interface GespeicherterLauf {
  status: string
  seed: number
  missionId: string
  missionVersion: number
  engineVersion: number
  aktionen: unknown
  aktionCount: number
  modell: unknown
}

/** Gespeichertes Protokoll als geprüfte Aktionsliste */
export function gespeicherteAktionen(json: unknown): Aktion[] {
  return parseAktionen(json)
}

/** Gespeichertes Modell (nur Missionen zum Modellieren) */
export function gespeichertesModell(json: unknown): ArchModell | undefined {
  if (json === null || json === undefined) return undefined
  return modellSchema.parse(json)
}

/** Nachspielen; ArchSimFehler → 422 mit Index und Meldung */
function nachspielenOderFehler(mission: Mission, lauf: GespeicherterLauf, aktionen: Aktion[]): Zustand {
  try {
    return nachspielen(mission, lauf.seed, aktionen, gespeichertesModell(lauf.modell))
  } catch (error) {
    if (error instanceof ArchSimFehler) {
      throw new LeitstandError(422, "INVALID_ACTION", error.message, {
        index: error.aktionIndex ?? null,
        simCode: error.code,
        details: error.details,
      })
    }
    throw error
  }
}

export interface AnhangErgebnis {
  aktionen: Aktion[]
  zustand: Zustand
  aktionCount: number
  tick: number
  phase: Zustand["phase"]
  zusammenfassung: LaufZusammenfassung
}

/**
 * Prüft einen Anhang ans Aktionsprotokoll und spielt das ganze Protokoll nach.
 * 409: veraltet, nicht aktiv, Modell fehlt, abIndex ≠ aktionCount (mit aktionCount);
 * 422: ungültige Aktion (mit Index im Gesamtprotokoll) oder mehr als MAX_AKTIONEN_PRO_LAUF.
 */
export function pruefeUndHaengeAn(lauf: GespeicherterLauf, eingabe: { abIndex: number; aktionen: Aktion[] }, mission: Mission): AnhangErgebnis {
  if (istVeraltet(lauf, mission)) {
    throw new LeitstandError(409, "OUTDATED", "Dieser Lauf stammt aus einer älteren Version und kann nicht weitergespielt werden.", { status: "veraltet" })
  }
  if (lauf.status !== "aktiv") {
    throw new LeitstandError(409, "NOT_ACTIVE", "Dieser Lauf ist nicht mehr aktiv.", { status: lauf.status })
  }
  if (mission.art === "modellieren" && (lauf.modell === null || lauf.modell === undefined)) {
    throw new LeitstandError(409, "CONFLICT", "Für diese Mission fehlt noch das Modell.", { aktionCount: lauf.aktionCount })
  }
  if (eingabe.abIndex !== lauf.aktionCount) {
    throw new LeitstandError(409, "CONFLICT", "Konflikt: Der Lauf wurde inzwischen an anderer Stelle weitergespielt.", { aktionCount: lauf.aktionCount })
  }
  const bisher = gespeicherteAktionen(lauf.aktionen)
  if (bisher.length !== lauf.aktionCount) {
    throw new Error(`Aktionsprotokoll (${bisher.length}) passt nicht zu aktionCount (${lauf.aktionCount}).`)
  }
  const alle = [...bisher, ...eingabe.aktionen]
  if (alle.length > MAX_AKTIONEN_PRO_LAUF) {
    throw new LeitstandError(422, "LIMIT", `Höchstens ${MAX_AKTIONEN_PRO_LAUF} Aktionen je Lauf.`)
  }
  const zustand = nachspielenOderFehler(mission, lauf, alle)
  return { aktionen: alle, zustand, aktionCount: alle.length, tick: zustand.tick, phase: zustand.phase, zusammenfassung: zusammenfassen(mission, zustand) }
}

/**
 * Prüft das Modell eines Laufs (Missionen zum Modellieren): nur solange noch keine Aktion gespeichert ist,
 * und nur ein lauffähiges Modell (validiere(...).gueltig). Nicht erfüllte Anforderungen sind erlaubt (Abzug).
 */
export function pruefeModellFuerLauf(lauf: Pick<GespeicherterLauf, "status" | "aktionCount" | "missionVersion" | "engineVersion">, modell: ArchModell, mission: Mission): void {
  if (mission.art !== "modellieren") throw new LeitstandError(400, "BAD_REQUEST", "Diese Mission hat ein vorgegebenes Modell.")
  if (istVeraltet(lauf, mission)) throw new LeitstandError(409, "OUTDATED", "Dieser Lauf stammt aus einer älteren Version.", { status: "veraltet" })
  if (lauf.status !== "aktiv") throw new LeitstandError(409, "NOT_ACTIVE", "Dieser Lauf ist nicht mehr aktiv.", { status: lauf.status })
  if (lauf.aktionCount > 0) {
    throw new LeitstandError(409, "CONFLICT", "Der Lasttest läuft schon; das Modell lässt sich nicht mehr ändern.", { aktionCount: lauf.aktionCount })
  }
  const v = validiere(mission, modell)
  if (!v.gueltig) throw new LeitstandError(422, "INVALID_MODEL", "Das Modell ist noch nicht lauffähig.", { details: v.fehler.slice(0, 20) })
}

// ---------- Datenbank ----------

type Db = Prisma.TransactionClient

/** Station 11 «begonnen» / «erledigt»; «erledigt» wird nie zurückgestuft (fortschrittSchreibdaten). */
async function meldeStation(db: Db, userId: string, status: LernStatus): Promise<void> {
  const daten = fortschrittSchreibdaten({ ...ARCHSIM_STATION, status, quiz: null })
  await db.lernfortschritt.upsert({
    where: { userId_fach_thema: { userId, ...ARCHSIM_STATION } },
    create: { userId, ...ARCHSIM_STATION, ...daten.create },
    update: { ...daten.update, updatedAt: new Date() },
  })
}

/** Bestwert einer Mission: nur abgeschlossene Läufe mit neuem Startwert */
export async function findeBestwert(
  db: Db,
  userId: string,
  missionId: string,
  ausser?: string,
): Promise<{ score: number; stars: number; laufId: string } | null> {
  const best = await db.architekturLauf.findFirst({
    where: {
      userId,
      missionId,
      status: "abgeschlossen",
      seedReused: false,
      score: { not: null },
      ...(ausser ? { id: { not: ausser } } : {}),
    },
    orderBy: [{ score: "desc" }, { finishedAt: "asc" }],
    select: { id: true, score: true, stars: true },
  })
  if (!best || best.score === null) return null
  return { score: best.score, stars: best.stars ?? 0, laufId: best.id }
}

export interface MissionsStand {
  missionId: string
  bestwert: { score: number; stars: number; laufId: string } | null
  /** beste Sterne aus allen abgeschlossenen Läufen (auch Wiederholungen) */
  sterne: number
  aktiv: { laufId: string; minute: number; modellGesetzt: boolean } | null
  freigeschaltet: boolean
}

/** Übersicht je Mission für die Missionswahl: Bestwert, Sterne, aktiver Lauf, freigeschaltet */
export async function missionsStand(userId: string): Promise<MissionsStand[]> {
  const laeufe = await prisma.architekturLauf.findMany({
    where: { userId, status: { in: ["aktiv", "abgeschlossen"] } },
    select: { id: true, missionId: true, status: true, seedReused: true, score: true, stars: true, tick: true, modell: true, finishedAt: true },
  })
  const sterne = besteSterne(laeufe)
  return MISSION_IDS.map((missionId) => {
    let best: MissionsStand["bestwert"] = null
    for (const l of laeufe) {
      if (l.missionId !== missionId || l.status !== "abgeschlossen" || l.seedReused || l.score === null) continue
      if (!best || l.score > best.score) best = { score: l.score, stars: l.stars ?? 0, laufId: l.id }
    }
    const aktiv = laeufe.find((l) => l.missionId === missionId && l.status === "aktiv")
    return {
      missionId,
      bestwert: best,
      sterne: sterne[missionId] ?? 0,
      aktiv: aktiv ? { laufId: aktiv.id, minute: aktiv.tick, modellGesetzt: aktiv.modell !== null } : null,
      freigeschaltet: missionFreigeschaltet(MISSION_IDS, missionId, sterne),
    }
  })
}

export interface GestarteterLauf {
  id: string
  missionId: string
  seed: number
  seedReused: boolean
  missionVersion: number
  engineVersion: number
}

/**
 * Neuer Lauf: Mission muss freigeschaltet sein (403 sonst); Startwert neu oder vom eigenen abgeschlossenen Lauf
 * übernommen (Wiederholung, bei Missionen zum Modellieren auch das Modell als Entwurf); alten aktiven Lauf
 * derselben Mission abbrechen; Station 11 «begonnen».
 * Der Teil-Index «ArchitekturLauf_aktiv_eindeutig» erlaubt nur einen aktiven Lauf je Mission: Legt eine
 * gleichzeitige Anfrage zuerst einen an, scheitert create mit P2002; dann neuer Versuch, nach drei Versuchen 409.
 */
export async function starteLauf(userId: string, missionId: string, wiederholungVon?: string): Promise<GestarteterLauf> {
  const mission = requireMission(missionId)

  const abgeschlossen = await prisma.architekturLauf.findMany({
    where: { userId, status: "abgeschlossen" },
    select: { missionId: true, status: true, stars: true },
  })
  if (!missionFreigeschaltet(MISSION_IDS, missionId, besteSterne(abgeschlossen))) {
    throw new LeitstandError(409, "LOCKED", "Diese Mission ist noch gesperrt: Hol zuerst mindestens einen Stern in der vorherigen Mission.")
  }

  let seed = newSeed()
  let seedReused = false
  let modell: Prisma.InputJsonValue | typeof Prisma.DbNull = Prisma.DbNull
  if (wiederholungVon) {
    const quelle = await prisma.architekturLauf.findFirst({
      where: { id: wiederholungVon, userId, missionId, status: "abgeschlossen" },
      select: { seed: true, modell: true },
    })
    if (!quelle) throw new LeitstandError(404, "NOT_FOUND", "Lauf zum Wiederholen nicht gefunden.")
    seed = quelle.seed
    seedReused = true
    if (mission.art === "modellieren" && quelle.modell !== null) modell = quelle.modell as Prisma.InputJsonValue
  }

  const anlegen = () =>
    prisma.$transaction(async (tx) => {
      await tx.architekturLauf.updateMany({ where: { userId, missionId, status: "aktiv" }, data: { status: "abgebrochen" } })
      const lauf = await tx.architekturLauf.create({
        data: {
          userId,
          missionId,
          missionVersion: mission.version,
          engineVersion: ARCHSIM_VERSION,
          seed,
          seedReused,
          status: "aktiv",
          aktionen: [],
          aktionCount: 0,
          modell,
          tick: 0,
        },
        select: { id: true },
      })
      await meldeStation(tx, userId, "begonnen")
      return { id: lauf.id, missionId, seed, seedReused, missionVersion: mission.version, engineVersion: ARCHSIM_VERSION }
    })
  try {
    return await retryOnPrismaCodes(["P2002"], 3, anlegen)
  } catch (error) {
    if (prismaErrorCode(error) === "P2002") {
      throw new LeitstandError(409, "CONFLICT", "Gleichzeitig wurde ein anderer Lauf gestartet. Bitte erneut versuchen.")
    }
    throw error
  }
}

const LAUF_FELDER = {
  id: true,
  status: true,
  seed: true,
  seedReused: true,
  missionId: true,
  missionVersion: true,
  engineVersion: true,
  aktionen: true,
  aktionCount: true,
  modell: true,
  scoreDetail: true,
  pointsAwarded: true,
} as const

/** Lauf eines Kontos laden; fremd oder nicht vorhanden → 404 */
async function eigenerLauf(userId: string, laufId: string) {
  const lauf = await prisma.architekturLauf.findFirst({ where: { id: laufId, userId }, select: LAUF_FELDER })
  if (!lauf) throw new LeitstandError(404, "NOT_FOUND", "Lauf nicht gefunden.")
  return lauf
}

async function alsVeraltetMarkieren(userId: string, laufId: string): Promise<void> {
  await prisma.architekturLauf.updateMany({ where: { id: laufId, userId, status: "aktiv" }, data: { status: "veraltet" } })
}

/** POST runs/[id]/actions: prüfen, nachspielen, mit optimistischer Sperre speichern */
export async function haengeAktionenAn(userId: string, laufId: string, eingabe: { abIndex: number; aktionen: Aktion[] }) {
  const lauf = await eigenerLauf(userId, laufId)
  const mission = requireMission(lauf.missionId)
  if (statusNachVersion(lauf, mission) === "veraltet") await alsVeraltetMarkieren(userId, laufId)

  const res = pruefeUndHaengeAn(lauf, eingabe, mission)
  const gespeichert = await prisma.architekturLauf.updateMany({
    where: { id: laufId, userId, status: "aktiv", aktionCount: eingabe.abIndex },
    data: {
      aktionen: res.aktionen as unknown as Prisma.InputJsonValue,
      aktionCount: res.aktionCount,
      tick: res.tick,
      summary: res.zusammenfassung as unknown as Prisma.InputJsonValue,
    },
  })
  if (gespeichert.count === 0) {
    // Gleichzeitiger Anhang: aktuellen Stand mitgeben, damit der Browser eine verlorene Antwort erkennt
    const jetzt = await prisma.architekturLauf.findFirst({ where: { id: laufId, userId }, select: { aktionCount: true, status: true } })
    throw new LeitstandError(409, "CONFLICT", "Konflikt: Der Lauf wurde inzwischen an anderer Stelle weitergespielt.", {
      ...(jetzt ? { aktionCount: jetzt.aktionCount, status: jetzt.status } : {}),
    })
  }
  return { aktionCount: res.aktionCount, tick: res.tick, phase: res.phase, zusammenfassung: res.zusammenfassung }
}

/** POST runs/[id]/model: Modell setzen oder ersetzen, solange noch keine Aktion gespeichert ist */
export async function setzeModell(userId: string, laufId: string, modell: ArchModell) {
  const lauf = await eigenerLauf(userId, laufId)
  const mission = requireMission(lauf.missionId)
  if (statusNachVersion(lauf, mission) === "veraltet") await alsVeraltetMarkieren(userId, laufId)
  pruefeModellFuerLauf(lauf, modell, mission)
  const v = validiere(mission, modell)
  const gespeichert = await prisma.architekturLauf.updateMany({
    where: { id: laufId, userId, status: "aktiv", aktionCount: 0 },
    data: { modell: modell as unknown as Prisma.InputJsonValue },
  })
  if (gespeichert.count === 0) {
    const jetzt = await prisma.architekturLauf.findFirst({ where: { id: laufId, userId }, select: { aktionCount: true, status: true } })
    throw new LeitstandError(409, "CONFLICT", "Konflikt: Der Lauf wurde inzwischen verändert.", { ...(jetzt ? { aktionCount: jetzt.aktionCount, status: jetzt.status } : {}) })
  }
  return { ok: true as const, anforderungen: v.anforderungen }
}

const ABSCHLUSS_VERSUCHE = 3

export interface AbschlussErgebnis {
  ergebnis: GespeichertesErgebnis
  bestwertVerbessert: boolean
  punkte: number
  /** false, wenn der Lauf schon abgeschlossen war (idempotenter zweiter Aufruf) */
  erstmals: boolean
}

/**
 * POST runs/[id]/finish: nachspielen, Mission bis zum Ende (Phase «beendet») verlangt, Punkte auf dem Server
 * berechnen, speichern, Punkte ins Konto und Station 11 in einer Transaktion («Serializable», damit zwei
 * gleichzeitige Abschlüsse denselben alten Bestwert nicht doppelt gutschreiben; P2034 → neuer Versuch).
 * Abzeichen vergibt die Route danach (checkAndAwardBadges). Idempotent.
 */
export async function schliesseLaufAb(userId: string, laufId: string): Promise<AbschlussErgebnis> {
  const lauf = await eigenerLauf(userId, laufId)
  if (lauf.status === "abgeschlossen") return gespeichertesErgebnis(userId, lauf)

  const mission = requireMission(lauf.missionId)
  if (statusNachVersion(lauf, mission) === "veraltet") {
    await alsVeraltetMarkieren(userId, laufId)
    throw new LeitstandError(409, "OUTDATED", "Dieser Lauf stammt aus einer älteren Version und kann nicht abgeschlossen werden.", { status: "veraltet" })
  }
  if (lauf.status !== "aktiv") throw new LeitstandError(409, "NOT_ACTIVE", "Dieser Lauf ist nicht mehr aktiv.", { status: lauf.status })

  const zustand = nachspielenOderFehler(mission, lauf, gespeicherteAktionen(lauf.aktionen))
  if (zustand.phase !== "beendet") {
    throw new LeitstandError(422, "NOT_FINISHED", "Die Mission ist noch nicht zu Ende.", { tick: zustand.tick })
  }
  const ergebnis = auswerten(mission, beende(mission, zustand))
  const gespeichert = ergebnisFuerSpeicher(ergebnis)
  const total = ergebnis.score.total

  const transaktion = () =>
    prisma.$transaction(
      async (tx) => {
        const alt = lauf.seedReused ? null : await findeBestwert(tx, userId, lauf.missionId, laufId)
        const punkte = punkteFuerVerbesserung(alt?.score ?? null, total, lauf.seedReused)
        const bestwertVerbessert = !lauf.seedReused && (alt === null || total > alt.score)

        const res = await tx.architekturLauf.updateMany({
          where: { id: laufId, userId, status: "aktiv", aktionCount: lauf.aktionCount },
          data: {
            status: "abgeschlossen",
            tick: zustand.tick,
            summary: zusammenfassen(mission, zustand) as unknown as Prisma.InputJsonValue,
            score: total,
            stars: ergebnis.score.sterne,
            scoreDetail: gespeichert as unknown as Prisma.InputJsonValue,
            pointsAwarded: punkte,
            finishedAt: new Date(),
          },
        })
        if (res.count === 0) return null // gleichzeitiger Abschluss oder Anhang: gespeicherten Stand liefern

        if (punkte > 0) await tx.user.update({ where: { id: userId }, data: { points: { increment: punkte } } })

        // Station 11 «erledigt», sobald jede Mission mindestens einen Stern hat (ohne Wiederholungen)
        const alle = await tx.architekturLauf.findMany({
          where: { userId, status: "abgeschlossen", seedReused: false },
          select: { missionId: true, status: true, seedReused: true, stars: true },
        })
        if (archsimAbzeichenErfuellt("archsim_alle_missionen", archsimAbzeichenStatistik(alle), MISSION_IDS)) {
          await meldeStation(tx, userId, "erledigt")
        }
        return { ergebnis: gespeichert, bestwertVerbessert, punkte, erstmals: true }
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    )
  const ausgang = await retryOnPrismaCodes(["P2034"], ABSCHLUSS_VERSUCHE, transaktion)
  if (ausgang) return ausgang

  const nochmals = await eigenerLauf(userId, laufId)
  if (nochmals.status === "abgeschlossen") return gespeichertesErgebnis(userId, nochmals)
  throw new LeitstandError(409, "CONFLICT", "Konflikt: Der Lauf wurde inzwischen verändert.", { aktionCount: nochmals.aktionCount })
}

async function gespeichertesErgebnis(
  userId: string,
  lauf: { id: string; missionId: string; seedReused: boolean; scoreDetail: unknown; pointsAwarded: number },
): Promise<AbschlussErgebnis> {
  const best = lauf.seedReused ? null : await findeBestwert(prisma, userId, lauf.missionId)
  return {
    ergebnis: lauf.scoreDetail as GespeichertesErgebnis,
    bestwertVerbessert: best?.laufId === lauf.id,
    punkte: lauf.pointsAwarded,
    erstmals: false,
  }
}

/** Abzeichen-Statistik eines Kontos (für lib/badges.ts) */
export async function ladeArchsimAbzeichenStatistik(userId: string) {
  const laeufe = await prisma.architekturLauf.findMany({
    where: { userId, status: "abgeschlossen", seedReused: false },
    select: { missionId: true, status: true, seedReused: true, stars: true },
  })
  return archsimAbzeichenStatistik(laeufe)
}
