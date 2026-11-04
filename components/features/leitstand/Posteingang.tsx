// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

"use client"

// components/features/leitstand/Posteingang.tsx
// Posteingang (4.8): Liste nach Eingang mit Kanal-Symbol und Text, Status (neu, aufgeschoben mit Frist, entschieden);
// darunter die Mitteilungen des Systems (Meilensteine, Risiken, Gremium) aus dem Zeitstrahl.

import { formatTick } from "@/lib/simulation/core"
import styles from "@/app/(leitstand)/leitstand.module.css"
import { roleOf, useLeitstand } from "./context"
import { CHANNEL_SYMBOL, CHANNEL_TEXT } from "./format"
import Avatar from "./Avatar"
import Icon from "./Icon"
import { deadlineText } from "./EntscheidDialog"
import { optionNumber } from "./logic"

const STATUS_LABEL: Record<string, string> = {
  neu: "neu",
  aufgeschoben: "aufgeschoben",
  entschieden: "entschieden",
  standard: "Standardentscheid",
  gelesen: "gelesen",
}

export default function Posteingang() {
  const { state, scenario, openEvent } = useLeitstand()
  const items = [...state.inbox].sort((a, b) => b.arrivedTick - a.arrivedTick)
  const notes = [...state.timeline]
    .filter((t) => t.kind === "meilenstein" || t.kind === "risiko" || t.kind === "gemeinderat" || t.kind === "standard" || t.ref.startsWith("S"))
    .sort((a, b) => b.tick - a.tick)
    .slice(0, 12)

  return (
    <div className={styles.ansicht}>
      <div className="card stack">
        <h3 className={styles.titelMitSymbol}>
          <Icon name="posteingang" size={18} /> Posteingang
        </h3>
        {items.length === 0 ? (
          <p className="hint">Noch keine Nachrichten.</p>
        ) : (
          <ul className={styles.postListe}>
            {items.map((i) => {
              const def = scenario.events.find((e) => e.id === i.eventId)
              if (!def) return null
              const open = i.status === "neu" || i.status === "aufgeschoben"
              return (
                <li key={`${i.eventId}-${i.arrivedTick}`}>
                  <button
                    type="button"
                    className={`${styles.postEintrag} ${i.status === "neu" ? styles.postEintragNeu : ""}`}
                    onClick={() => openEvent(i.eventId)}
                  >
                    <span className={styles.postBild}>
                      <Avatar name={def.sender.name} role={roleOf(scenario, def.sender.name)} size={44} decorative accessory={false} />
                      <span className={styles.postKanal}>
                        <Icon name={CHANNEL_SYMBOL[def.channel]} size={12} />
                      </span>
                    </span>
                    <span className={styles.postText}>
                      <strong>{def.title}</strong>
                      <span className="hint">
                        {CHANNEL_TEXT[def.channel]} · {def.sender.name} · {formatTick(i.arrivedTick)}
                      </span>
                      {i.status === "aufgeschoben" && <span className={styles.warnText}>▲ Frist {deadlineText(i.deadlineTick)}</span>}
                      {!open && i.optionId && <span className="hint">Option {optionNumber(state.seed, def.id, def.options, i.optionId)}</span>}
                    </span>
                    <span className={`status ${i.status === "neu" ? "begonnen" : open ? "offen" : "erledigt"}`}>{STATUS_LABEL[i.status]}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
      {notes.length > 0 && (
        <div className="card stack">
          <h3 className={styles.titelMitSymbol}>
            <Icon name="system" size={18} /> Mitteilungen
          </h3>
          <ul className={styles.liste}>
            {notes.map((n, k) => (
              <li key={k}>
                <span className="hint">{formatTick(n.tick)} · </span>
                {n.text}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
