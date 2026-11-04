// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

"use client"

// components/features/ipma/TrainingSetup.tsx
// Auswahl des Trainings (Spezifikation 3.4, 6.8 TrainingSetup): Kompetenzen als nach Bereich gruppierte
// Kontrollkästchen mit «ganzen Bereich wählen», Typ (MC, offen, beide), Anzahl 5–30 (Vorgabe 10).
// Je Kompetenz die Zahl der geprüften Fragen aus der Übersicht (pool, Nachtrag 8.5 Nr. 10).

import type { OverviewView } from "@/lib/ipma/types"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import styles from "@/app/(ipma)/ipma.module.css"
import Dialog from "@/components/features/leitstand/Dialog"
import { AREAS, COMPETENCES, type CompetenceId } from "@/lib/ipma/competences"
import { ipmaApi, IpmaApiError, errorMessage, startErrorMessage, type CreateAttemptBody } from "./api"
import { LEVEL } from "./format"

type QType = "mc" | "offen" | "beide"
const MIN = 5
const MAX = 30

export default function TrainingSetup({ preselect }: { preselect: CompetenceId[] }) {
  const router = useRouter()
  const [selected, setSelected] = useState<Set<CompetenceId>>(() => new Set(preselect))
  const [type, setType] = useState<QType>("beide")
  const [count, setCount] = useState(10)
  const [overview, setOverview] = useState<OverviewView | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState<{ body: CreateAttemptBody; activeId: string } | null>(null)

  useEffect(() => {
    ipmaApi
      .overview()
      .then(setOverview)
      .catch((e: unknown) => setError(errorMessage(e, "Die Übersicht konnte nicht geladen werden. Die Auswahl funktioniert trotzdem.")))
  }, [])

  const available = (id: CompetenceId) => {
    const p = overview?.pool[id]
    if (!p) return null
    return type === "mc" ? p.mc : type === "offen" ? p.offen : p.mc + p.offen
  }
  const selectedAvailable = overview ? Array.from(selected).reduce((s, id) => s + (available(id) ?? 0), 0) : null

  function toggle(id: CompetenceId) {
    setSelected((old) => {
      const next = new Set(old)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleArea(areaId: string, on: boolean) {
    setSelected((old) => {
      const next = new Set(old)
      for (const c of COMPETENCES.filter((x) => x.area === areaId)) {
        if (on) next.add(c.id)
        else next.delete(c.id)
      }
      return next
    })
  }

  async function create(body: CreateAttemptBody) {
    setBusy(true)
    setError(null)
    try {
      const res = await ipmaApi.create(body)
      router.push(`/ipma/${res.id}`)
    } catch (e) {
      setBusy(false)
      if (e instanceof IpmaApiError && e.code === "ACTIVE_EXISTS" && e.activeAttemptId) {
        setConfirm({ body, activeId: e.activeAttemptId })
        return
      }
      setError(startErrorMessage(e))
    }
  }

  function start(e: React.FormEvent) {
    e.preventDefault()
    if (selected.size === 0) {
      setError("Wähle mindestens eine Kompetenz.")
      return
    }
    const n = Math.min(MAX, Math.max(MIN, Math.round(count) || 10))
    void create({ mode: "training", competences: COMPETENCES.map((c) => c.id).filter((id) => selected.has(id)), type, count: n })
  }

  return (
    <form className="stack" onSubmit={start} noValidate>
      <div className={`card stack ${styles.kompetenzWahl}`}>
        <h2>Kompetenzen</h2>
        <p className="hint">Mehrfachauswahl. Die Zahl hinter jeder Kompetenz nennt die geprüften Fragen im Pool für den gewählten Typ.</p>
        {AREAS.map((area) => {
          const list = COMPETENCES.filter((c) => c.area === area.id)
          const all = list.every((c) => selected.has(c.id))
          return (
            <fieldset key={area.id} className={styles.kompetenzGruppe}>
              <legend>
                {area.title} · {area.label}
              </legend>
              <button type="button" className={`btn ${styles.klein}`} aria-pressed={all} onClick={() => toggleArea(area.id, !all)}>
                {all ? "Bereich abwählen" : "Ganzen Bereich wählen"}
              </button>
              <ul className={styles.kompetenzListe}>
                {list.map((c) => {
                  const n = available(c.id)
                  const m = overview?.mastery.find((x) => x.competence === c.id)
                  return (
                    <li key={c.id}>
                      <label>
                        <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggle(c.id)} />
                        <span>
                          <strong>{c.id}</strong> {c.title}
                          <small>
                            {n === null ? "" : `${n} ${n === 1 ? "Frage" : "Fragen"}`}
                            {m ? ` · ${LEVEL[m.level].word}` : ""}
                          </small>
                        </span>
                      </label>
                    </li>
                  )
                })}
              </ul>
            </fieldset>
          )
        })}
      </div>

      <div className="card stack">
        <fieldset className={styles.wahl}>
          <legend>Fragetyp</legend>
          {(
            [
              ["beide", "Beide", "Multiple Choice und offene Fragen"],
              ["mc", "Multiple Choice", "je 1 Punkt, sofort bewertet"],
              ["offen", "Offen", "je 2 Punkte, Selbstbewertung nach Raster"],
            ] as const
          ).map(([value, label, help]) => (
            <label key={value} className={styles.wahlOption}>
              <input type="radio" name="typ" value={value} checked={type === value} onChange={() => setType(value)} />
              <span>
                {label}
                <small>{help}</small>
              </span>
            </label>
          ))}
        </fieldset>
        <div className="stack">
          <label htmlFor="anzahl">
            <strong>Anzahl Fragen</strong> (5 bis 30)
          </label>
          <input
            id="anzahl"
            className={styles.zahlFeld}
            type="number"
            inputMode="numeric"
            min={MIN}
            max={MAX}
            value={count}
            aria-describedby="anzahl-hinweis"
            onChange={(e) => setCount(Number(e.target.value))}
          />
          <p id="anzahl-hinweis" className="hint" aria-live="polite">
            {selected.size} {selected.size === 1 ? "Kompetenz" : "Kompetenzen"} gewählt
            {selectedAvailable !== null ? ` · ${selectedAvailable} passende Fragen` : ""}. Gibt es weniger, kommen alle vorhandenen.
          </p>
        </div>
        {error && (
          <p className={`${styles.meldung} ${styles.meldungFehler}`} role="alert">
            {error}
          </p>
        )}
        <div className="row">
          <button type="submit" className="btn primary" disabled={busy}>
            {busy ? "Wird gestartet …" : "Training starten"}
          </button>
          <a className="btn" href="/ipma">
            Zurück
          </a>
        </div>
      </div>

      {confirm && (
        <Dialog title="Laufendes Training ersetzen?" onEscape={() => setConfirm(null)}>
          <p>Es läuft bereits ein Training. Du kannst es fortsetzen oder mit der neuen Auswahl beginnen; das alte wird dann abgebrochen.</p>
          <div className={styles.dialogKnoepfe}>
            <a className="btn primary" href={`/ipma/${confirm.activeId}`}>
              Fortsetzen
            </a>
            <button
              type="button"
              className="btn"
              onClick={() => {
                const body = confirm.body
                setConfirm(null)
                void create({ ...body, replaceActive: true })
              }}
            >
              Neu beginnen
            </button>
            <button type="button" className="btn" onClick={() => setConfirm(null)}>
              Abbrechen
            </button>
          </div>
        </Dialog>
      )}
    </form>
  )
}
