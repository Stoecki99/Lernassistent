// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

"use client"

// components/features/architektur-leitstand/ArchitekturApp.tsx
// Lauf-Ansicht: lädt den Lauf, spielt das Protokoll im Browser mit dem Simulator-Kern nach (deterministisch:
// gleicher Seed + gleiche Aktionen = gleiches Ergebnis wie auf dem Server), hält den Zustand und führt durch
// Briefing → (Modellierphase) → Leitstand (Zeit, Kennzahlen, Diagramm, Massnahmen, Ereignisse) → Ergebnis.
// Jede Minute ist eine Aktion «weiter 1» im Protokoll; die Sende-Logik fasst sie zusammen (syncQueue.ts).

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import {
  ARCHSIM_VERSION,
  ArchSimFehler,
  MISSION_IDS,
  aktionText,
  auswerten,
  beende,
  ladeMission,
  starte,
  wendeAn,
  type Aktion,
  type ArchModell,
  type Mission,
  type Zustand,
} from "@/lib/archsim"
import { ergebnisFuerSpeicher, nachspielen, type GespeichertesErgebnis } from "@/lib/architektur-leitstand-regeln"
import { MAX_AKTIONEN_PRO_LAUF } from "@/lib/validations/architektur-leitstand"
import styles from "@/app/(architektur-leitstand)/architektur-leitstand.module.css"
import { ApiFehler, archApi, type AbschlussAntwort, type LaufDetail, type MissionsStand } from "./api"
import { sicherungLesen, useLaufSync } from "./useLaufSync"
import KopfLeiste, { TAKT_MS, type Tempo } from "./KopfLeiste"
import Kennzahlen from "./Kennzahlen"
import LiveDiagramm, { type Auswahl } from "./LiveDiagramm"
import Lastkurve from "./Lastkurve"
import { AuswahlPanel, MassnahmenLeiste } from "./Massnahmen"
import Protokoll from "./Protokoll"
import Briefing from "./Briefing"
import Modellierphase from "./Modellierphase"
import Ergebnis from "./Ergebnis"
import Dialog from "./Dialog"
import { MESS_ZUSTAND, neueEreignisse, neueHinweise, prozent, ms as msText } from "./logik"

type Laden =
  | { kind: "laden" }
  | { kind: "fehler"; meldung: string }
  | { kind: "veraltet" }
  | { kind: "bereit"; detail: LaufDetail; mission: Mission; zustand: Zustand | null; ausstehend: Aktion[] }

export default function ArchitekturApp({ laufId }: { laufId: string }) {
  const [laden, setLaden] = useState<Laden>({ kind: "laden" })
  const [neuKey, setNeuKey] = useState(0)

  useEffect(() => {
    let abgebrochen = false
    ;(async () => {
      try {
        const detail = await archApi.lauf(laufId)
        const mission = ladeMission(detail.missionId)
        if (!mission) throw new Error("Unbekannte Mission")
        if (detail.veraltet || detail.status === "veraltet" || detail.missionVersion !== mission.version || detail.engineVersion !== ARCHSIM_VERSION) {
          if (!abgebrochen) setLaden({ kind: "veraltet" })
          return
        }
        const modell = detail.modell ?? undefined
        if (mission.art === "modellieren" && !modell) {
          if (!abgebrochen) setLaden({ kind: "bereit", detail, mission, zustand: null, ausstehend: [] })
          return
        }
        let ausstehend = detail.status === "aktiv" ? sicherungLesen(laufId, detail.aktionen.length) : []
        let zustand: Zustand
        try {
          zustand = nachspielen(mission, detail.seed, [...detail.aktionen, ...ausstehend], modell)
        } catch {
          // Sicherung passt nicht (mehr): nur das gespeicherte Protokoll nachspielen
          ausstehend = []
          zustand = nachspielen(mission, detail.seed, detail.aktionen, modell)
        }
        if (!abgebrochen) setLaden({ kind: "bereit", detail, mission, zustand, ausstehend })
      } catch (error) {
        console.error("[architektur-leitstand]", error)
        const meldung =
          error instanceof ApiFehler && error.status === 404
            ? "Diesen Lauf gibt es nicht."
            : error instanceof ApiFehler && error.status === 403
              ? "Der Architektur-Leitstand ist im Pro-Plan enthalten."
              : error instanceof ApiFehler && error.status === 401
                ? "Bitte melde dich neu an."
                : "Der Lauf konnte nicht geladen werden. Bitte später erneut versuchen."
        if (!abgebrochen) setLaden({ kind: "fehler", meldung })
      }
    })()
    return () => {
      abgebrochen = true
    }
  }, [laufId, neuKey])

  const neuLaden = useCallback(() => {
    setLaden({ kind: "laden" })
    setNeuKey((k) => k + 1)
  }, [])

  if (laden.kind === "laden") {
    return (
      <div className={`card ${styles.laden}`} role="status">
        <span className={styles.ladenPuls} aria-hidden="true" /> Lauf wird geladen und nachgespielt …
      </div>
    )
  }
  if (laden.kind === "fehler" || laden.kind === "veraltet") {
    return (
      <div className="card stack" role="alert">
        <h2>{laden.kind === "veraltet" ? "Lauf veraltet" : "Fehler"}</h2>
        <p>
          {laden.kind === "veraltet"
            ? "Dieser Lauf wurde mit einer älteren Fassung des Simulators gespielt und lässt sich nicht mehr fortsetzen. Starte einen neuen Lauf."
            : laden.meldung}
        </p>
        <p>
          <a className="btn primary" href="/architektur-leitstand">
            Zur Missionswahl
          </a>
        </p>
      </div>
    )
  }
  return <Spiel key={neuKey} detail={laden.detail} mission={laden.mission} start={laden.zustand} ausstehend={laden.ausstehend} onNeuLaden={neuLaden} />
}

// ---------- Spiel ----------

type Ansicht = "briefing" | "modellieren" | "leitstand" | "ergebnis"
type Tab = "diagramm" | "kennzahlen" | "massnahmen"

const KUERZEL_AUS = "archsim-kuerzel-aus"
const AUTOPAUSE_AUS = "archsim-autopause-aus"
const MELDUNG_MS = 10_000

function flagLesen(k: string): boolean {
  try {
    return window.localStorage.getItem(k) === "1"
  } catch {
    return false
  }
}
function flagSchreiben(k: string, an: boolean): void {
  try {
    window.localStorage.setItem(k, an ? "1" : "0")
  } catch {
    // ohne Speicher gilt die Wahl bis zum Neuladen
  }
}

interface Meldung {
  id: number
  titel: string
  text: string
  art: "ereignis" | "info" | "fehler"
  element?: string
}

function Spiel({
  detail,
  mission,
  start,
  ausstehend,
  onNeuLaden,
}: {
  detail: LaufDetail
  mission: Mission
  start: Zustand | null
  ausstehend: Aktion[]
  onNeuLaden: () => void
}) {
  const router = useRouter()
  const nurAnsehen = detail.status !== "aktiv"
  const [modell, setModell] = useState<ArchModell | null>(detail.modell)
  const [zustand, setZustandRaw] = useState<Zustand | null>(start)
  const zRef = useRef<Zustand | null>(start)
  const aktionenRef = useRef<Aktion[]>([...detail.aktionen, ...ausstehend])
  const [ansicht, setAnsicht] = useState<Ansicht>(() => {
    if (start?.phase === "beendet" || detail.status === "abgeschlossen") return "ergebnis"
    if (!start) return "briefing"
    if (detail.aktionen.length + ausstehend.length === 0 && !nurAnsehen) return "briefing"
    return "leitstand"
  })
  const [tab, setTab] = useState<Tab>("diagramm")
  const [tempo, setTempoRaw] = useState<Tempo>(0)
  const [auswahl, setAuswahl] = useState<Auswahl>(null)
  const [meldungen, setMeldungen] = useState<Meldung[]>([])
  const [hinweis, setHinweis] = useState<string | null>(null)
  const [polite, setPolite] = useState("")
  const [assertive, setAssertive] = useState("")
  const [abgemeldet, setAbgemeldet] = useState(false)
  const [kuerzelAus, setKuerzelAus] = useState(() => flagLesen(KUERZEL_AUS))
  const [autopauseAus, setAutopauseAus] = useState(() => flagLesen(AUTOPAUSE_AUS))
  const [abschluss, setAbschluss] = useState<AbschlussAntwort | null>(null)
  const [speichern, setSpeichern] = useState<"laeuft" | "fertig" | "fehler" | "nur-ansehen">(detail.status === "abgeschlossen" ? "nur-ansehen" : "laeuft")
  const [stand, setStand] = useState<MissionsStand[] | null>(null)
  const [beschaeftigt, setBeschaeftigt] = useState(false)
  const [abbrechenFrage, setAbbrechenFrage] = useState(false)
  const abschlussGestartet = useRef(false)

  const melden = useCallback((m: Omit<Meldung, "id">) => {
    setMeldungen((alt) => [...alt.slice(-2), { ...m, id: Date.now() + Math.random() }])
    if (m.art === "ereignis") setAssertive(`${m.titel}. ${m.text}`)
    else setPolite(`${m.titel} ${m.text}`.trim())
  }, [])

  const sync = useLaufSync({
    api: archApi,
    laufId: detail.id,
    bestaetigt: detail.aktionen.length,
    ausstehend,
    aktiv: !nurAnsehen,
    onKonflikt: (m) => {
      melden({ art: "fehler", titel: "Konflikt.", text: `${m} Der Lauf wird neu geladen.` })
      window.setTimeout(onNeuLaden, 1800)
    },
    onAbgelehnt: (m) => {
      melden({ art: "fehler", titel: "Abgelehnt.", text: `Der Server hat eine Aktion abgelehnt: ${m} Der Lauf wird neu geladen.` })
      window.setTimeout(onNeuLaden, 2500)
    },
    onAbgemeldet: () => {
      setAbgemeldet(true)
      setTempoRaw(0)
      melden({ art: "fehler", titel: "Anmeldung abgelaufen.", text: "Melde dich neu an; deine letzten Aktionen bleiben in diesem Browser gesichert." })
    },
  })
  const { push, flush, gesamt } = sync

  const setZustand = useCallback((z: Zustand) => {
    zRef.current = z
    setZustandRaw(z)
  }, [])

  const gesperrt: string | null = nurAnsehen
    ? "Dieser Lauf lässt sich nur ansehen."
    : abgemeldet
      ? "Anmeldung abgelaufen: Melde dich neu an."
      : zustand?.phase === "beendet"
        ? "Die Mission ist beendet."
        : null

  /** Eine Aktion im Browser anwenden und ins Protokoll stellen */
  const ausfuehren = useCallback(
    (a: Aktion): boolean => {
      const z = zRef.current
      if (!z) return false
      if (nurAnsehen || abgemeldet) {
        melden({ art: "info", titel: "", text: nurAnsehen ? "Dieser Lauf lässt sich nicht mehr ändern." : "Anmeldung abgelaufen." })
        return false
      }
      if (gesamt() >= MAX_AKTIONEN_PRO_LAUF) {
        setTempoRaw(0)
        melden({ art: "fehler", titel: "Höchstzahl erreicht.", text: `Ein Lauf hat höchstens ${MAX_AKTIONEN_PRO_LAUF} Aktionen.` })
        return false
      }
      try {
        const neu = wendeAn(mission, z, a)
        setZustand(neu)
        aktionenRef.current = [...aktionenRef.current, a]
        push(a)
        if (a.typ !== "weiter") melden({ art: "info", titel: "", text: `${aktionText(a, z.modell)}.` })
        return true
      } catch (error) {
        if (error instanceof ArchSimFehler) {
          melden({ art: "fehler", titel: "Geht nicht:", text: error.message })
          return false
        }
        console.error("[architektur-leitstand]", error)
        melden({ art: "fehler", titel: "Fehler.", text: "Unerwarteter Fehler im Simulator." })
        return false
      }
    },
    [mission, nurAnsehen, abgemeldet, gesamt, push, melden, setZustand],
  )

  // ---------- Zeit ----------
  const laeuft = !gesperrt && ansicht === "leitstand" && tempo > 0 && zustand !== null
  const setTempo = useCallback(
    (t: Tempo) => {
      setTempoRaw(t)
      if (t === 0) void flush()
    },
    [flush],
  )
  useEffect(() => {
    if (!laeuft || tempo === 0) return
    const id = window.setTimeout(() => ausfuehren({ typ: "weiter", minuten: 1 }), TAKT_MS[tempo])
    return () => window.clearTimeout(id)
  }, [laeuft, tempo, zustand?.tick, ausfuehren])

  // ---------- Übergänge: Ereignisse, Hinweise, Ende ----------
  const vorher = useRef<Zustand | null>(start)
  useEffect(() => {
    const alt = vorher.current
    vorher.current = zustand
    if (!zustand || !alt || alt === zustand) return
    const ereignisse = neueEreignisse(alt, zustand)
    for (const id of ereignisse) {
      const e = mission.ereignisse.find((x) => x.id === id)
      if (!e) continue
      melden({ art: "ereignis", titel: e.titel, text: e.text, element: "element" in e.wirkung ? e.wirkung.element : undefined })
    }
    const hinweise = neueHinweise(alt, zustand)
    if (hinweise.length > 0) {
      const def = mission.hinweise?.find((h) => h.id === hinweise[hinweise.length - 1])
      if (def) setHinweis(def.text)
    }
    if ((ereignisse.length > 0 || hinweise.length > 0) && !autopauseAus && zustand.phase !== "beendet") setTempo(0)
    if (zustand.tick % 10 === 0 && zustand.verlauf.length > 0 && zustand.tick !== alt.tick) {
      const p = zustand.verlauf[zustand.verlauf.length - 1]
      setPolite(`Minute ${zustand.tick}: Verfügbarkeit ${prozent(p.verfuegbarkeit)}, p95 ${msText(p.p95)}.`)
    }
    if (zustand.phase === "beendet" && alt.phase !== "beendet") {
      setTempoRaw(0)
      setAnsicht("ergebnis")
    }
  }, [zustand, mission, melden, autopauseAus, setTempo])

  // ---------- Abschluss ----------
  const abschliessen = useCallback(async () => {
    if (abschlussGestartet.current) return
    abschlussGestartet.current = true
    setSpeichern("laeuft")
    const ok = await flush()
    if (!ok) {
      setSpeichern("fehler")
      abschlussGestartet.current = false
      return
    }
    try {
      setAbschluss(await archApi.abschliessen(detail.id))
      setSpeichern("fertig")
    } catch (error) {
      console.error("[architektur-leitstand]", error)
      setSpeichern("fehler")
      abschlussGestartet.current = false
    }
  }, [flush, detail.id])

  useEffect(() => {
    if (zustand?.phase === "beendet" && detail.status === "aktiv") void abschliessen()
  }, [zustand?.phase, detail.status, abschliessen])

  // Stand der Missionen (Bestwert, nächste Mission frei?)
  useEffect(() => {
    if (ansicht !== "ergebnis") return
    let ab = false
    archApi
      .laeufe()
      .then((r) => {
        if (!ab) setStand(r.missionen)
      })
      .catch(() => undefined)
    return () => {
      ab = true
    }
  }, [ansicht, abschluss])

  const lokalesErgebnis: GespeichertesErgebnis | null = useMemo(() => {
    if (!zustand || zustand.phase !== "beendet") return null
    return ergebnisFuerSpeicher(auswerten(mission, beende(mission, zustand)))
  }, [zustand, mission])

  const neuerLauf = useCallback(
    async (wiederholung: boolean) => {
      setBeschaeftigt(true)
      try {
        const r = await archApi.starten(mission.id, wiederholung ? detail.id : undefined)
        router.push(`/architektur-leitstand/${r.id}`)
      } catch (error) {
        console.error("[architektur-leitstand]", error)
        melden({ art: "fehler", titel: "", text: error instanceof ApiFehler ? error.message : "Der Lauf konnte nicht gestartet werden." })
        setBeschaeftigt(false)
      }
    },
    [mission.id, detail.id, router, melden],
  )

  const modellFertig = useCallback(
    async (m: ArchModell): Promise<string | null> => {
      try {
        await archApi.modellSetzen(detail.id, m)
        setModell(m)
        setZustand(starte(mission, detail.seed, m))
        aktionenRef.current = []
        setAnsicht("leitstand")
        setTab("diagramm")
        melden({ art: "info", titel: "Modell gespeichert.", text: "Bereite dich vor und starte den Lasttest." })
        return null
      } catch (error) {
        if (error instanceof ApiFehler) return [error.message, ...error.details.slice(0, 3)].join(" ")
        if (error instanceof ArchSimFehler) return [error.message, ...error.details.slice(0, 3)].join(" ")
        return "Das Modell konnte nicht gespeichert werden."
      }
    },
    [detail.id, detail.seed, mission, setZustand, melden],
  )

  // ---------- Tastatur ----------
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (kuerzelAus || ansicht !== "leitstand" || gesperrt || e.ctrlKey || e.metaKey || e.altKey || e.defaultPrevented) return
      const t = e.target as HTMLElement | null
      if (t?.closest("input, textarea, select, [contenteditable='true'], [role='dialog'], .ar-viewport")) return
      if (e.key === " " || e.code === "Space") {
        if (t?.closest("button, a, summary, [role='button']")) return
        e.preventDefault()
        setTempo(tempo === 0 ? 1 : 0)
      } else if (e.key === "1" || e.key === "2" || e.key === "4") {
        setTempo(Number(e.key) as Tempo)
      } else if ((e.key === "n" || e.key === "N") && tempo === 0) {
        ausfuehren({ typ: "weiter", minuten: 1 })
      }
    },
    [kuerzelAus, ansicht, gesperrt, tempo, setTempo, ausfuehren],
  )

  const idx = MISSION_IDS.indexOf(mission.id)
  const naechsteId = idx >= 0 && idx < MISSION_IDS.length - 1 ? MISSION_IDS[idx + 1] : null
  const naechste = naechsteId
    ? { id: naechsteId, titel: ladeMission(naechsteId)?.titel ?? naechsteId, frei: stand?.find((s) => s.missionId === naechsteId)?.freigeschaltet ?? false }
    : null

  // ---------- Darstellung ----------
  const kopfTitel = (
    <div className={styles.titelZeile}>
      <h1 className={styles.titel}>
        <span className={styles.titelMarke}>Architektur-Leitstand</span> {mission.titel}
      </h1>
      <div className={styles.titelKnoepfe}>
        {ansicht === "leitstand" && (
          <>
            <button
              type="button"
              className={`btn ${styles.klein}`}
              aria-pressed={!autopauseAus}
              onClick={() => {
                setAutopauseAus(!autopauseAus)
                flagSchreiben(AUTOPAUSE_AUS, !autopauseAus)
              }}
              title="Bei Ereignissen und Hinweisen die Zeit anhalten"
            >
              Bei Ereignis anhalten: {autopauseAus ? "aus" : "an"}
            </button>
            <button
              type="button"
              className={`btn ${styles.klein}`}
              aria-pressed={!kuerzelAus}
              title="Leertaste: Start/Pause · 1, 2, 4: Tempo · N: eine Minute vor"
              onClick={() => {
                setKuerzelAus(!kuerzelAus)
                flagSchreiben(KUERZEL_AUS, !kuerzelAus)
              }}
            >
              Tastenkürzel {kuerzelAus ? "aus" : "an"}
            </button>
          </>
        )}
        {!nurAnsehen && zustand?.phase !== "beendet" && (
          <button type="button" className={`btn ${styles.klein}`} onClick={() => setAbbrechenFrage(true)}>
            Lauf abbrechen
          </button>
        )}
      </div>
    </div>
  )

  return (
    <div className={styles.spiel} onKeyDown={onKeyDown} tabIndex={-1}>
      {kopfTitel}
      <div className="sr-only" aria-live="polite">
        {polite}
      </div>
      <div className="sr-only" aria-live="assertive">
        {assertive}
      </div>

      {abgemeldet && (
        <p className={`note ${styles.lage} ${styles.lageWarn}`}>
          Anmeldung abgelaufen: Deine letzten Aktionen sind nur in diesem Browser gesichert.{" "}
          <a href="/login" target="_blank" rel="noopener">
            Neu anmelden (neuer Tab)
          </a>{" "}
          und diese Seite danach neu laden: Der Lauf geht an derselben Minute weiter.
        </p>
      )}
      {nurAnsehen && detail.status !== "abgeschlossen" && <p className={`note ${styles.lage}`}>Dieser Lauf ist {detail.status} und lässt sich nur ansehen.</p>}

      {ansicht === "briefing" && (
        <Briefing
          mission={mission}
          wiederholung={detail.seedReused}
          weiterText={mission.art === "modellieren" && !modell ? "Zum Modellieren →" : "Zum Leitstand →"}
          onWeiter={() => setAnsicht(mission.art === "modellieren" && !modell ? "modellieren" : "leitstand")}
        />
      )}

      {ansicht === "modellieren" && (
        <>
          <p className={styles.zurueck}>
            <button type="button" className={`btn ${styles.klein}`} onClick={() => setAnsicht("briefing")}>
              ← Briefing
            </button>
          </p>
          <Modellierphase mission={mission} laufId={detail.id} startModell={modell} onFertig={modellFertig} gesperrt={gesperrt} />
        </>
      )}

      {ansicht === "leitstand" && zustand && (
        <>
          <KopfLeiste
            mission={mission}
            zustand={zustand}
            tempo={tempo}
            setTempo={setTempo}
            laeuft={laeuft}
            onSchritt={() => ausfuehren({ typ: "weiter", minuten: 1 })}
            syncStatus={sync.status}
            kuerzel={!kuerzelAus}
            gesperrt={gesperrt !== null}
          />

          {zustand.phase === "bereit" && (
            <div className={styles.lage}>
              <span>
                <strong>Vorbereitung:</strong> Massnahmen wirken jetzt sofort und ohne Startzeit. Schau dir das Diagramm an, dann «Lasttest starten».
              </span>
              <span className="row">
                <button type="button" className={`btn ${styles.klein}`} onClick={() => setAnsicht("briefing")}>
                  Briefing
                </button>
                {mission.art === "modellieren" && zustand.tick === 0 && aktionenRef.current.length === 0 && !nurAnsehen && (
                  <button type="button" className={`btn ${styles.klein}`} onClick={() => setAnsicht("modellieren")}>
                    Modell bearbeiten
                  </button>
                )}
              </span>
            </div>
          )}

          {hinweis && (
            <aside className={styles.coach} aria-label="Hinweis">
              <span className={styles.coachSymbol} aria-hidden="true">
                💡
              </span>
              <p>{hinweis}</p>
              <button type="button" className={`btn ${styles.klein}`} onClick={() => setHinweis(null)}>
                Verstanden
              </button>
            </aside>
          )}

          <nav className={styles.tabs} aria-label="Bereiche">
            {(
              [
                ["diagramm", "Diagramm"],
                ["kennzahlen", "Kennzahlen"],
                ["massnahmen", "Massnahmen"],
              ] as Array<[Tab, string]>
            ).map(([t, text]) => (
              <button key={t} type="button" className={`${styles.tab} ${tab === t ? styles.tabAn : ""}`} aria-pressed={tab === t} onClick={() => setTab(t)}>
                {text}
              </button>
            ))}
          </nav>

          <div className={`${styles.tabPanel} ${tab === "kennzahlen" ? styles.tabSichtbar : ""}`}>
            <Kennzahlen mission={mission} zustand={zustand} />
          </div>

          <div className={styles.buehne}>
            <section className={`card ${styles.diagrammKarte} ${styles.tabPanel} ${tab === "diagramm" ? styles.tabSichtbar : ""}`} aria-label="Architektur live">
              <div className={styles.diagrammKopf}>
                <h2 className={styles.h2klein}>{zustand.modell.titel ?? "Architektur live"}</h2>
                <ZustandsLegende />
              </div>
              <LiveDiagramm mission={mission} zustand={zustand} auswahl={auswahl} onAuswahl={setAuswahl} />
            </section>
            <aside className={`card ${styles.seitenPanel} ${styles.tabPanel} ${tab !== "kennzahlen" ? styles.tabSichtbar : ""}`} aria-label="Auswahl und Massnahmen">
              <AuswahlPanel mission={mission} zustand={zustand} auswahl={auswahl} setAuswahl={setAuswahl} onAnwenden={ausfuehren} gesperrt={gesperrt} />
            </aside>
          </div>

          <div className={`${styles.tabPanel} ${tab === "massnahmen" ? styles.tabSichtbar : ""}`}>
            <MassnahmenLeiste
              mission={mission}
              zustand={zustand}
              onAnwenden={ausfuehren}
              gesperrt={gesperrt}
              onZeigen={(a) => {
                setAuswahl(a)
                setTab("diagramm")
              }}
            />
          </div>

          <div className={`${styles.unten} ${styles.tabPanel} ${tab === "kennzahlen" ? styles.tabSichtbar : ""}`}>
            <section className="card">
              <Lastkurve mission={mission} zustand={zustand} />
            </section>
            <Protokoll mission={mission} zustand={zustand} />
          </div>
        </>
      )}

      {ansicht === "ergebnis" && zustand && (detail.ergebnis ?? abschluss?.ergebnis ?? lokalesErgebnis) && (
        <Ergebnis
          mission={mission}
          zustand={zustand}
          seed={detail.seed}
          aktionen={aktionenRef.current}
          modell={modell ?? undefined}
          ergebnis={(abschluss?.ergebnis ?? detail.ergebnis ?? lokalesErgebnis) as GespeichertesErgebnis}
          abschluss={abschluss}
          speichern={speichern}
          onErneutSpeichern={() => void abschliessen()}
          onWiederholen={() => void neuerLauf(true)}
          onNeu={() => void neuerLauf(false)}
          naechste={naechste}
          wiederholung={detail.seedReused}
          beschaeftigt={beschaeftigt || (speichern === "laeuft" && !nurAnsehen)}
        />
      )}

      <div className={styles.meldungen} aria-live="off">
        {meldungen.map((m) => (
          <MeldungAnzeige
            key={m.id}
            m={m}
            laeuft={laeuft}
            onPause={() => setTempo(0)}
            onZeigen={
              m.element
                ? () => {
                    setAuswahl({ art: "element", id: m.element as string })
                    setTab("diagramm")
                  }
                : undefined
            }
            onClose={() => setMeldungen((alt) => alt.filter((x) => x.id !== m.id))}
          />
        ))}
      </div>

      {abbrechenFrage && (
        <Dialog titel="Lauf abbrechen?" onEscape={() => setAbbrechenFrage(false)}>
          <p>Der Lauf lässt sich danach nicht mehr fortsetzen und zählt nicht für den Bestwert.</p>
          <div className={styles.dialogKnoepfe}>
            <button type="button" className="btn" onClick={() => setAbbrechenFrage(false)}>
              Weiterspielen
            </button>
            <button
              type="button"
              className="btn primary"
              onClick={async () => {
                setAbbrechenFrage(false)
                setTempoRaw(0)
                try {
                  await archApi.abbrechen(detail.id)
                  router.push("/architektur-leitstand")
                } catch (error) {
                  melden({ art: "fehler", titel: "", text: error instanceof ApiFehler ? error.message : "Abbrechen hat nicht geklappt." })
                }
              }}
            >
              Ja, abbrechen
            </button>
          </div>
        </Dialog>
      )}
    </div>
  )
}

function ZustandsLegende() {
  const zeigen = ["ok", "ausgelastet", "ueberlast", "langsam", "ausfall", "fehlerhaft"] as const
  return (
    <ul className={styles.zustandsLegende} aria-label="Legende der Zustände">
      {zeigen.map((z) => (
        <li key={z} className={styles[`zs_${z}`]}>
          <span aria-hidden="true">{MESS_ZUSTAND[z].symbol}</span> {MESS_ZUSTAND[z].text}
        </li>
      ))}
      <li className={styles.zsCb}>CB zu · offen · halb</li>
    </ul>
  )
}

/** Meldung unten rechts; blendet nach 10 s aus, Maus oder Fokus darauf hält den Zeitgeber an (WCAG 2.2.1) */
function MeldungAnzeige({
  m,
  laeuft,
  onPause,
  onZeigen,
  onClose,
}: {
  m: Meldung
  laeuft: boolean
  onPause: () => void
  onZeigen?: () => void
  onClose: () => void
}) {
  const [pause, setPause] = useState({ hover: false, fokus: false })
  const rest = useRef(m.art === "ereignis" ? MELDUNG_MS * 1.5 : MELDUNG_MS)
  const zu = useRef(onClose)
  zu.current = onClose
  const angehalten = pause.hover || pause.fokus
  useEffect(() => {
    if (angehalten) return
    const t0 = Date.now()
    const id = window.setTimeout(() => zu.current(), rest.current)
    return () => {
      window.clearTimeout(id)
      rest.current = Math.max(1000, rest.current - (Date.now() - t0))
    }
  }, [angehalten])
  return (
    <div
      className={`${styles.meldung} ${styles[`meldung_${m.art}`]}`}
      onMouseEnter={() => setPause((p) => ({ ...p, hover: true }))}
      onMouseLeave={() => setPause((p) => ({ ...p, hover: false }))}
      onFocus={() => setPause((p) => ({ ...p, fokus: true }))}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setPause((p) => ({ ...p, fokus: false }))
      }}
    >
      <span className={styles.meldungSymbol} aria-hidden="true">
        {m.art === "ereignis" ? "⚡" : m.art === "fehler" ? "■" : "✓"}
      </span>
      <div className={styles.meldungText}>
        {m.titel && <strong>{m.titel} </strong>}
        <span>{m.text}</span>
        {(m.art === "ereignis" && laeuft) || onZeigen ? (
          <span className={styles.meldungKnoepfe}>
            {m.art === "ereignis" && laeuft && (
              <button type="button" className={`btn primary ${styles.klein}`} onClick={onPause}>
                ❚❚ Anhalten
              </button>
            )}
            {onZeigen && (
              <button type="button" className={`btn ${styles.klein}`} onClick={onZeigen}>
                Betroffenes Element zeigen
              </button>
            )}
          </span>
        ) : null}
      </div>
      <button type="button" className={`btn ${styles.klein}`} onClick={onClose} aria-label="Meldung schliessen">
        ✕
      </button>
    </div>
  )
}
