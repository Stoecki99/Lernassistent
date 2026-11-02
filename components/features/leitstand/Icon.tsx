// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// components/features/leitstand/Icon.tsx
// Eigene Strich-Symbole des Leitstands (inline SVG, keine Pakete, keine fremden Vorlagen).
// Farbe über currentColor, also immer aus den Tokens der Umgebung. Symbole ergänzen Text, ersetzen ihn nie:
// ohne `label` sind sie dekorativ (aria-hidden), mit `label` ein Bild mit Namen.

import type { ReactNode } from "react"

export type IconName =
  | "termin"
  | "kosten"
  | "qualitaet"
  | "motivation"
  | "stakeholder"
  | "risiko"
  | "auftrag"
  | "uebersicht"
  | "vorgaenge"
  | "team"
  | "plan"
  | "auslastung"
  | "kalender"
  | "posteingang"
  | "budget"
  | "bericht"
  | "nachbesprechung"
  | "mail"
  | "anruf"
  | "besuch"
  | "system"
  | "offen"
  | "bereit"
  | "laufend"
  | "fertig"
  | "blockiert"
  | "meilenstein"
  | "phase"
  | "kritisch"
  | "pfeilRechts"
  | "uhr"
  | "hinweis"

const PFADE: Record<IconName, ReactNode> = {
  // Kennzahlen
  termin: (
    <>
      <circle cx="12" cy="13" r="8" />
      <path d="M12 9v4l3 2M9 2h6M12 2v3" />
    </>
  ),
  kosten: (
    <>
      <ellipse cx="12" cy="6" rx="7" ry="3" />
      <path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6" />
    </>
  ),
  qualitaet: (
    <>
      <path d="M12 2l2.4 2 3.1-.3.8 3 2.6 1.8-1.2 2.9 1.2 2.9-2.6 1.8-.8 3-3.1-.3L12 22l-2.4-2-3.1.3-.8-3L3.1 15.5l1.2-2.9-1.2-2.9 2.6-1.8.8-3 3.1.3z" />
      <path d="M8.5 12l2.5 2.5 4.5-5" />
    </>
  ),
  motivation: <path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.3 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z" />,
  stakeholder: (
    <>
      <circle cx="8" cy="8" r="3" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M2.5 19c0-3.3 2.5-6 5.5-6s5.5 2.7 5.5 6M14 14.2c.9-.7 1.9-1 3-1 2.5 0 4.5 2.2 4.5 5" />
    </>
  ),
  risiko: (
    <>
      <path d="M12 2.5l8 3v6c0 5-3.4 8.6-8 10-4.6-1.4-8-5-8-10v-6z" />
      <path d="M12 8v5M12 16.5v.01" />
    </>
  ),
  // Ansichten
  auftrag: (
    <>
      <path d="M6 2.5h8l4 4V21H6z" />
      <path d="M14 2.5V7h4M9 12h6M9 15.5h6" />
    </>
  ),
  uebersicht: (
    <>
      <rect x="3" y="3" width="7.5" height="9" rx="1.5" />
      <rect x="13.5" y="3" width="7.5" height="5.5" rx="1.5" />
      <rect x="3" y="15" width="7.5" height="6" rx="1.5" />
      <rect x="13.5" y="11.5" width="7.5" height="9.5" rx="1.5" />
    </>
  ),
  vorgaenge: (
    <>
      <path d="M9 6h11M9 12h11M9 18h11" />
      <path d="M3.5 6l1.2 1.2L7 5M3.5 12l1.2 1.2L7 11" />
      <circle cx="5" cy="18" r="1.4" />
    </>
  ),
  team: (
    <>
      <circle cx="12" cy="7.5" r="3.2" />
      <circle cx="5" cy="10" r="2.3" />
      <circle cx="19" cy="10" r="2.3" />
      <path d="M6.5 20c0-3.3 2.5-6 5.5-6s5.5 2.7 5.5 6M1.5 18.5c0-2.2 1.5-4 3.5-4 .8 0 1.5.2 2 .6M22.5 18.5c0-2.2-1.5-4-3.5-4-.8 0-1.5.2-2 .6" />
    </>
  ),
  plan: (
    <>
      <path d="M3 3v18h18" />
      <rect x="6" y="6" width="7" height="3" rx="1" />
      <rect x="10" y="11" width="8" height="3" rx="1" />
      <rect x="14" y="16" width="5" height="2.5" rx="1" />
    </>
  ),
  auslastung: (
    <>
      <path d="M3 21h18" />
      <rect x="5" y="11" width="3" height="10" rx="0.5" />
      <rect x="10.5" y="6" width="3" height="15" rx="0.5" />
      <rect x="16" y="13" width="3" height="8" rx="0.5" />
      <path d="M3 8.5h18" strokeDasharray="2 2" />
    </>
  ),
  kalender: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4M7.5 14h2M11 14h2M14.5 14h2M7.5 17.5h2" />
    </>
  ),
  posteingang: (
    <>
      <path d="M3 13l2.5-8h13L21 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <path d="M3 13h5l1.5 3h5L16 13h5" />
    </>
  ),
  budget: (
    <>
      <rect x="2.5" y="6" width="19" height="13" rx="2" />
      <path d="M2.5 10h19M16 14.5h2.5" />
    </>
  ),
  bericht: (
    <>
      <path d="M6 2.5h8l4 4V21H6z" />
      <path d="M9 17v-3M12 17v-6M15 17v-4" />
    </>
  ),
  nachbesprechung: (
    <>
      <path d="M7 3h10v5a5 5 0 0 1-10 0z" />
      <path d="M7 5H4v1.5A3.5 3.5 0 0 0 7.5 10M17 5h3v1.5A3.5 3.5 0 0 1 16.5 10M12 13v4M8 21h8M9.5 17h5v4h-5z" />
    </>
  ),
  // Ereignis-Kanäle
  mail: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3.5 6.5l8.5 6.5 8.5-6.5" />
    </>
  ),
  anruf: (
    <path d="M5 3.5h3.5l1.5 4.5-2.2 1.4a11 11 0 0 0 4.8 4.8l1.4-2.2 4.5 1.5v3.5a2 2 0 0 1-2 2A16.5 16.5 0 0 1 3 5.5a2 2 0 0 1 2-2z" />
  ),
  besuch: (
    <>
      <path d="M5 21V4a1 1 0 0 1 1-1h9v18M3 21h18" />
      <path d="M15 3l4 1.5V21" />
      <circle cx="12" cy="12.5" r="0.9" fill="currentColor" />
    </>
  ),
  system: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1" />
    </>
  ),
  // Status der Vorgänge
  offen: <circle cx="12" cy="12" r="8" strokeDasharray="3 2.5" />,
  bereit: (
    <>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="2.5" fill="currentColor" />
    </>
  ),
  laufend: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor" />
    </>
  ),
  fertig: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M8 12.2l2.8 2.8L16.2 9.5" />
    </>
  ),
  blockiert: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M6 6l12 12" />
    </>
  ),
  // Plan
  meilenstein: <path d="M12 3l8 9-8 9-8-9z" />,
  phase: (
    <>
      <path d="M5 21V3" />
      <path d="M5 4h12l-2.5 4L17 12H5" />
    </>
  ),
  kritisch: <path d="M13 2L4 14h7l-1 8 9-12h-7z" />,
  pfeilRechts: <path d="M5 12h14M13 6l6 6-6 6" />,
  uhr: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </>
  ),
  hinweis: (
    <>
      <path d="M9 18h6M10 21h4" />
      <path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z" />
    </>
  ),
}

export default function Icon({
  name,
  size = 20,
  label,
  className,
}: {
  name: IconName
  size?: number
  /** Mit Namen: Bild für Bildschirmleser; ohne: dekorativ (der Text daneben trägt die Aussage) */
  label?: string
  className?: string
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={{ flex: "none" }}
      focusable="false"
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}
    >
      {label ? <title>{label}</title> : null}
      {PFADE[name]}
    </svg>
  )
}
