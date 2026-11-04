// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

"use client"

// components/features/leitstand/EntscheidDialog.tsx
// Ereignis lesen und entscheiden (3.12): Optionen, «Ich entscheide», «Bis morgen überlegen» (Aufschub),
// Kenntnisnahme bei nur einer Option; danach sofort die Rückmeldung des Coachs mit Link auf die Station.

import { useEffect, useRef, useState } from "react"
import { formatTick, type InboxItem } from "@/lib/simulation/core"
import styles from "@/app/(leitstand)/leitstand.module.css"
import { roleOf, useLeitstand } from "./context"
import Dialog from "./Dialog"
import Rueckmeldung from "./Rueckmeldung"
import { CHANNEL_SYMBOL, CHANNEL_TEXT } from "./format"
import Avatar from "./Avatar"
import Icon from "./Icon"
import { optionNumber, shuffledOptions } from "./logic"

/** Text des Ereignisses (mit Variante, falls bei der Zustellung gewählt). */
export function eventBody(def: { body: string; bodyVariants?: Array<{ body: string }> }, item: InboxItem): string {
  if (item.bodyVariantIndex !== null && def.bodyVariants?.[item.bodyVariantIndex]) return def.bodyVariants[item.bodyVariantIndex].body
  return def.body
}

/** Frist als Text: Der Standardentscheid fällt bei der Ereignisprüfung von deadlineTick, also nach dem Halbtag davor. */
export function deadlineText(deadlineTick: number | null): string {
  if (deadlineTick === null) return "sofort entscheiden"
  const last = Math.max(0, deadlineTick - 1)
  return `bis ${formatTick(last)} (${last % 2 === 0 ? "12:00" : "17:00"})`
}

export default function EntscheidDialog({
  eventId,
  arrivedTick,
  onClose,
  onDecided,
}: {
  eventId: string
  arrivedTick: number
  onClose: () => void
  onDecided: () => void
}) {
  const { scenario, state, run } = useLeitstand()
  const def = scenario.events.find((e) => e.id === eventId)
  const item =
    state.inbox.find((i) => i.eventId === eventId && i.arrivedTick === arrivedTick) ??
    state.inbox.find((i) => i.eventId === eventId)
  const [choice, setChoice] = useState<string | null>(null)
  const [decidedOption, setDecidedOption] = useState<string | null>(null)
  const weiterRef = useRef<HTMLButtonElement>(null)

  // Nach dem Entscheid verschwinden die Optionen: Fokus auf «Weiter», damit er nicht ins Leere fällt
  useEffect(() => {
    if (decidedOption) weiterRef.current?.focus()
  }, [decidedOption])

  if (!def || !item) return null

  const isOpen = item.status === "neu" || item.status === "aufgeschoben"
  const canDefer = isOpen && item.status === "neu" && item.deadlineTick !== null
  const single = def.options.length === 1
  const shownOption = decidedOption ?? (!isOpen ? item.optionId : null)
  const option = shownOption ? def.options.find((o) => o.id === shownOption) : undefined

  function decide() {
    if (!def || !choice) return
    const next = run({ type: "decide", eventId: def.id, optionId: choice })
    if (next) {
      setDecidedOption(choice)
      onDecided()
    }
  }

  function acknowledge() {
    if (!def) return
    if (run({ type: "acknowledge", eventId: def.id })) onClose()
  }

  function defer() {
    if (!def) return
    if (run({ type: "defer", eventId: def.id })) onClose()
  }

  // Esc: neues Ereignis mit Frist → aufschieben; schon aufgeschoben, entschieden oder erledigt → schliessen;
  // neues Ereignis ohne Frist → Dialog bleibt offen (die Zeit steht, bis entschieden ist)
  const escapeAction = option || !isOpen || item.status === "aufgeschoben" ? onClose : canDefer ? defer : undefined

  const senderRole = roleOf(scenario, def.sender.name)
  const kicker = (
    <span className={styles.absender}>
      <Avatar name={def.sender.name} role={senderRole} size={56} decorative />
      <span className={styles.absenderText}>
        <strong>{def.sender.name}</strong>
        {senderRole && <span>{senderRole}</span>}
        <span className={styles.absenderKanal}>
          <Icon name={CHANNEL_SYMBOL[def.channel]} size={14} /> {CHANNEL_TEXT[def.channel]} · {formatTick(item.arrivedTick)}
        </span>
      </span>
    </span>
  )

  return (
    <Dialog title={def.title} kicker={kicker} onEscape={escapeAction}>
      <blockquote className={`${styles.ereignisText} ${styles[`kanal_${def.channel}`]}`}>
        {eventBody(def, item)
          .split(/\n+/)
          .map((p, i) => (
            <p key={i}>{p}</p>
          ))}
      </blockquote>

      {option ? (
        <>
          <Rueckmeldung
            event={def}
            option={option}
            coach={scenario.coach.name}
            defaulted={item.status === "standard"}
            decider={scenario.defaultDecider.name}
            number={optionNumber(state.seed, def.id, def.options, option.id)}
          />
          <div className={styles.dialogKnoepfe}>
            <button ref={weiterRef} type="button" className="btn primary" onClick={onClose}>
              Weiter
            </button>
          </div>
        </>
      ) : isOpen && single ? (
        <div className={styles.dialogKnoepfe}>
          <button type="button" className="btn primary" onClick={acknowledge}>
            {def.options[0].label || "Zur Kenntnis genommen"}
          </button>
          <button type="button" className="btn" onClick={onClose}>
            Zurück zum Leitstand
          </button>
        </div>
      ) : isOpen ? (
        <>
          <fieldset className={styles.optionen}>
            <legend className="sr-only">Wie entscheidest du?</legend>
            {shuffledOptions(state.seed, def.id, def.options).map((o, index) => (
              <label key={o.id} className={`${styles.option} ${choice === o.id ? styles.optionAktiv : ""}`}>
                <input type="radio" name={`entscheid-${def.id}`} value={o.id} checked={choice === o.id} onChange={() => setChoice(o.id)} />
                <span className={styles.optionId}>{index + 1}</span>
                <span>{o.label}</span>
              </label>
            ))}
          </fieldset>
          <div className={styles.dialogKnoepfe}>
            <button type="button" className="btn primary" disabled={!choice} onClick={decide}>
              Ich entscheide
            </button>
            {canDefer && (
              <button type="button" className="btn" onClick={defer} aria-keyshortcuts="Escape">
                Bis morgen überlegen
              </button>
            )}
            <button type="button" className="btn" onClick={onClose}>
              Zurück zum Leitstand
            </button>
          </div>
          <p className="hint">
            Frist: {deadlineText(item.deadlineTick)}.{" "}
            {item.status === "aufgeschoben" ? "Aufgeschoben: Die Zeit läuft weiter. " : "Solange das Ereignis neu ist, steht die Zeit still. "}
            Läuft die Frist ab, entscheidet {scenario.defaultDecider.name}.
          </p>
        </>
      ) : (
        <div className={styles.dialogKnoepfe}>
          <button type="button" className="btn primary" onClick={onClose}>
            Schliessen
          </button>
        </div>
      )}
    </Dialog>
  )
}
