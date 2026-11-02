// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// components/features/leitstand/Avatar.tsx
// Gezeichnetes Porträt (SVG) aus den Merkmalen in avatarData.ts: Kopf, Haare, Hautton, Kleidung, Brille, Bart
// und ein Gegenstand passend zur Rolle (Laptop, Plan, Klemmbrett …). Gruppen und Organisationen erhalten ein Sinnbild.
// Hintergrund und Kleidung kommen aus den Tokens --s1 … --s5; der Hintergrund ist stets hell aufgemischt,
// damit dunkle Haare auch im Dunkelmodus erkennbar bleiben. Rein darstellend, ohne Zustand.

import { useId } from "react"
import { HAIR, SKIN, avatarSpec, type Accessory, type AvatarSpec, type Emblem, type HairStyle, type Tone } from "./avatarData"

/** Strichfarbe der Zeichnung (auf hellem Hintergrund in beiden Modi lesbar) */
const INK = "#2b2430"

const bgFill = (tone: Tone) => `color-mix(in srgb, var(--s${tone}) 26%, #ffffff)`
const toneFill = (tone: Tone) => `var(--s${tone})`

export default function Avatar({
  name,
  role,
  size = 48,
  decorative = false,
  accessory,
  className,
}: {
  name: string
  /** Rolle für den Alternativtext («Name, Rolle») */
  role?: string
  size?: number
  /** Dekorativ, wenn Name und Rolle direkt daneben als Text stehen */
  decorative?: boolean
  /** Gegenstand der Rolle zeigen (Standard: ab 44 px) */
  accessory?: boolean
  className?: string
}) {
  // useId liefert Doppelpunkte; in url(#…) nur Buchstaben und Ziffern verwenden
  const clipId = `avatar${useId().replace(/[^a-zA-Z0-9]/g, "")}`
  const spec = avatarSpec(name)
  const label = role ? `${name}, ${role}` : name
  const showAccessory = accessory ?? size >= 44
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={className}
      style={{ flex: "none", display: "block" }}
      focusable="false"
      {...(decorative ? { "aria-hidden": true } : { role: "img", "aria-label": label })}
    >
      {decorative ? null : <title>{label}</title>}
      <defs>
        <clipPath id={clipId}>
          <circle cx="32" cy="32" r="31" />
        </clipPath>
      </defs>
      <circle cx="32" cy="32" r="31" style={{ fill: bgFill(spec.bg) }} />
      <g clipPath={`url(#${clipId})`}>{spec.kind === "person" ? <Person spec={spec} /> : <Sinnbild emblem={spec.emblem} />}</g>
      <circle cx="32" cy="32" r="31" fill="none" style={{ stroke: "var(--line)" }} strokeWidth="1.5" />
      {spec.kind === "person" && spec.accessory && showAccessory ? <Gegenstand kind={spec.accessory} /> : null}
    </svg>
  )
}

// ---------- Person ----------

type PersonSpec = Extract<AvatarSpec, { kind: "person" }>

function Person({ spec }: { spec: PersonSpec }) {
  const skin = SKIN[spec.skin]
  const hair = HAIR[spec.hairColor]
  return (
    <>
      <HaarHinten style={spec.hair} color={hair} />
      <Kleidung kind={spec.clothing} tone={spec.tone} />
      {/* Hals mit Schatten */}
      <path d="M27 36h10v9.5c-1.6 1.6-3.3 2.4-5 2.4s-3.4-.8-5-2.4z" fill={skin} />
      <path d="M27 39.5c3 2 7 2 10 0V37H27z" fill="#000" opacity="0.12" />
      <Kragen kind={spec.clothing} />
      {/* Ohren und Kopf */}
      <ellipse cx="20.8" cy="29.5" rx="2.4" ry="3.3" fill={skin} />
      <ellipse cx="43.2" cy="29.5" rx="2.4" ry="3.3" fill={skin} />
      <ellipse cx="32" cy="27.5" rx="11.2" ry="13" fill={skin} />
      {spec.earrings ? (
        <>
          <circle cx="20.6" cy="33.6" r="1.3" fill="#d6a21e" />
          <circle cx="43.4" cy="33.6" r="1.3" fill="#d6a21e" />
        </>
      ) : null}
      {/* Wangen */}
      <circle cx="25.5" cy="33" r="2.2" fill="#e8786a" opacity="0.18" />
      <circle cx="38.5" cy="33" r="2.2" fill="#e8786a" opacity="0.18" />
      {spec.beard ? <Bart kind={spec.beard} color={hair} /> : null}
      {/* Augen, Brauen, Mund */}
      <circle cx="27.6" cy="28.6" r="1.45" fill={INK} />
      <circle cx="36.4" cy="28.6" r="1.45" fill={INK} />
      <path d="M25.2 25.3q2.4-1.3 4.8 0M33.9 25.3q2.4-1.3 4.8 0" fill="none" stroke={spec.hair === "glatze" ? INK : hair} strokeWidth="1.3" strokeLinecap="round" opacity="0.85" />
      <path d="M31.6 30.5q-.8 2.2.6 2.6" fill="none" stroke="#000" strokeOpacity="0.18" strokeWidth="1" strokeLinecap="round" />
      <path d="M28.4 35q3.6 3 7.2 0" fill="none" stroke="#8a3a2e" strokeWidth="1.5" strokeLinecap="round" />
      <HaarVorne style={spec.hair} color={hair} />
      {spec.glasses ? (
        <g fill="none" stroke={INK} strokeWidth="1.2">
          <circle cx="27.6" cy="28.8" r="3.5" fill="#ffffff" fillOpacity="0.18" />
          <circle cx="36.4" cy="28.8" r="3.5" fill="#ffffff" fillOpacity="0.18" />
          <path d="M31.1 28.6h1.8M24.1 28.3l-3 -.8M39.9 28.3l3 -.8" />
        </g>
      ) : null}
    </>
  )
}

function HaarHinten({ style, color }: { style: HairStyle; color: string }) {
  switch (style) {
    case "lang":
      return <path d="M18.3 30C17 14 25 10.5 32 10.5S47 14 45.7 30l1.8 20H16.5z" fill={color} />
    case "bob":
      return <path d="M18.6 35C17 15 25 11.5 32 11.5S47 15 45.4 35l-.4 3.5H19z" fill={color} />
    case "dutt":
      return <circle cx="32" cy="12" r="5.8" fill={color} />
    case "zopf":
      return <path d="M40.5 17c9 1.5 10 15 5.8 26.5-1.6-6.6-2.4-14-6.6-19.5z" fill={color} />
    case "locken":
      return (
        <g fill={color}>
          <circle cx="20.5" cy="31" r="4.6" />
          <circle cx="43.5" cy="31" r="4.6" />
          <circle cx="21" cy="37" r="3.6" />
          <circle cx="43" cy="37" r="3.6" />
        </g>
      )
    default:
      return null
  }
}

function HaarVorne({ style, color }: { style: HairStyle; color: string }) {
  switch (style) {
    case "kurz":
      return <path d="M20.8 27.5C19.6 15.5 26 13 32 13s12.4 2.5 11.2 14.5c-1.7-5.6-5.6-8.3-11.2-8.3s-9.5 2.7-11.2 8.3z" fill={color} />
    case "scheitel":
      return <path d="M20.8 28C19 16 26 12.3 33 12.8c7.2.4 11.6 5 10.2 15.2-1.2-5.3-4.4-8.6-13.3-7.6-4.5.5-7.7 3.4-9.1 7.6z" fill={color} />
    case "stoppel":
      return <path d="M21.3 25.5C21.6 16.4 26.6 14.6 32 14.6s10.4 1.8 10.7 10.9c-2.4-4.6-6-6.6-10.7-6.6s-8.3 2-10.7 6.6z" fill={color} opacity="0.8" />
    case "glatze":
      return (
        <g fill={color}>
          <path d="M20.6 31c-.7-5.4.4-8.4 2.4-9.6l.6 9z" />
          <path d="M43.4 31c.7-5.4-.4-8.4-2.4-9.6l-.6 9z" />
        </g>
      )
    case "lang":
    case "dutt":
    case "zopf":
      return <path d="M20.9 26.5C20.9 16.4 26.6 14 32 14s11.1 2.4 11.1 12.5c-2.8-5.4-7-7.9-11.6-7.6-4.4.3-8 2.6-10.6 7.6z" fill={color} />
    case "bob":
      return <path d="M20.5 28C19.8 16.5 26 13.5 32 13.5s12.2 3 11.5 14.5c-.6-4-3.3-6.6-11.5-6.6s-10.9 2.6-11.5 6.6z" fill={color} />
    case "locken":
      return (
        <g fill={color}>
          <circle cx="22" cy="22.5" r="4.8" />
          <circle cx="26" cy="16.8" r="5.2" />
          <circle cx="32" cy="14.6" r="5.6" />
          <circle cx="38" cy="16.8" r="5.2" />
          <circle cx="42" cy="22.5" r="4.8" />
          <circle cx="29" cy="20" r="3.4" />
          <circle cx="35" cy="20" r="3.4" />
        </g>
      )
  }
}

function Bart({ kind, color }: { kind: "voll" | "schnauz" | "stoppeln"; color: string }) {
  if (kind === "schnauz") return <path d="M27.6 33.6q4.4-2.6 8.8 0-1.6 1.2-4.4.6-2.8.6-4.4-.6z" fill={color} />
  if (kind === "stoppeln") return <path d="M21.3 30.5c.6 7.4 5 10 10.7 10s10.1-2.6 10.7-10c-1.8 3.6-3.4 5.4-5 5.6-1.6-1.6-3.6-2-5.7-2s-4.1.4-5.7 2c-1.6-.2-3.2-2-5-5.6z" fill={color} opacity="0.35" />
  return (
    <path
      d="M21.2 29.5c.3 8.6 5.2 11.5 10.8 11.5s10.5-2.9 10.8-11.5c-1.6 3.4-3.2 4.9-4.8 5.1-1.8-1.7-3.8-2.2-6-2.2s-4.2.5-6 2.2c-1.6-.2-3.2-1.7-4.8-5.1zM28.6 35.3q3.4 1.9 6.8 0-3.4 3.3-6.8 0z"
      fill={color}
      fillRule="evenodd"
    />
  )
}

function Kleidung({ kind, tone }: { kind: PersonSpec["clothing"]; tone: Tone }) {
  const body = "M6 66c0-12.5 9-20.5 26-20.5S58 53.5 58 66z"
  return (
    <>
      <path d={body} style={{ fill: toneFill(tone) }} />
      {kind === "pullover" ? <path d="M6 66c0-12.5 9-20.5 26-20.5S58 53.5 58 66" fill="none" stroke="#000" strokeOpacity="0.12" strokeWidth="2" /> : null}
      {kind === "blazer" || kind === "anzug" ? (
        <path d="M32 47l-7.5-1.4L19 66h13zM32 47l7.5-1.4L45 66H32z" fill="#000" opacity="0.2" />
      ) : null}
    </>
  )
}

function Kragen({ kind }: { kind: PersonSpec["clothing"] }) {
  switch (kind) {
    case "hemd":
      return (
        <g fill="#ffffff" stroke="#000" strokeOpacity="0.15" strokeWidth="0.6">
          <path d="M26.5 43.8l5.5 5-2.8 3.4-4.6-6.4zM37.5 43.8l-5.5 5 2.8 3.4 4.6-6.4z" />
        </g>
      )
    case "blazer":
      return <path d="M27 44.5l5 6.5 5-6.5c-1.6 1.4-3.3 2-5 2s-3.4-.6-5-2z" fill="#ffffff" />
    case "anzug":
      return (
        <>
          <path d="M26.8 44.2l5.2 4.6 5.2-4.6 1 2.6L32 55l-6.2-8.2z" fill="#ffffff" />
          <path d="M30.6 48.6h2.8l.9 2-1.2 9.5-1.1 1.4-1.1-1.4-1.2-9.5z" fill="#7a1f3d" />
        </>
      )
    case "bluse":
      return <path d="M27 44.6l5 5.4 5-5.4" fill="none" stroke="#ffffff" strokeOpacity="0.85" strokeWidth="1.6" strokeLinejoin="round" />
    case "tshirt":
      return <path d="M26.6 45q5.4 3.6 10.8 0" fill="none" stroke="#000" strokeOpacity="0.2" strokeWidth="1.4" />
    case "pullover":
      return <path d="M26.2 44.6q5.8 4.6 11.6 0" fill="none" stroke="#000" strokeOpacity="0.22" strokeWidth="2.2" />
  }
}

// ---------- Gegenstand der Rolle (Abzeichen unten rechts) ----------

function Gegenstand({ kind }: { kind: Accessory }) {
  return (
    <g>
      <circle cx="51.5" cy="51.5" r="11" fill="#ffffff" stroke={INK} strokeOpacity="0.25" strokeWidth="1" />
      <g fill="none" stroke={INK} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <GegenstandPfad kind={kind} />
      </g>
    </g>
  )
}

function GegenstandPfad({ kind }: { kind: Accessory }) {
  switch (kind) {
    case "laptop":
      return (
        <>
          <rect x="45.5" y="45.5" width="12" height="8" rx="1" fill="#cfe0f5" />
          <path d="M43.5 56h16" />
        </>
      )
    case "plan":
      return (
        <>
          <rect x="44.5" y="46" width="14" height="10" rx="1" fill="#cfe0f5" />
          <path d="M44.5 51h14M49 46v10M53.5 51v5" strokeWidth="1" />
        </>
      )
    case "klemmbrett":
      return (
        <>
          <rect x="46" y="45" width="11" height="13" rx="1.2" fill="#f2e3c6" />
          <rect x="49" y="43.8" width="5" height="2.6" rx="0.8" fill="#ffffff" />
          <path d="M48.5 50h6M48.5 53h6M48.5 56h3.5" strokeWidth="1.1" />
        </>
      )
    case "megafon":
      return (
        <>
          <path d="M45 49.5l9-4v12l-9-4z" fill="#ffd9a8" />
          <path d="M47 53.5l1 3.5M56.5 49.5v4" />
        </>
      )
    case "rechner":
      return (
        <>
          <rect x="46" y="44.5" width="11" height="14" rx="1.5" fill="#e3e3ea" />
          <rect x="47.8" y="46.4" width="7.4" height="3" fill="#cfe9d8" strokeWidth="1" />
          <path d="M48.5 52.5h.01M51.5 52.5h.01M54.5 52.5h.01M48.5 55.5h.01M51.5 55.5h.01M54.5 55.5h.01" strokeWidth="1.8" />
        </>
      )
    case "schild":
      return (
        <>
          <path d="M51.5 44l6 2.2v4.4c0 3.7-2.6 6.4-6 7.4-3.4-1-6-3.7-6-7.4v-4.4z" fill="#d7e8d0" />
          <path d="M48.8 51l1.9 1.9 3.6-3.6" />
        </>
      )
    case "helm":
      return (
        <>
          <path d="M44.5 54c0-5.4 3-8.5 7-8.5s7 3.1 7 8.5z" fill="#f2c230" />
          <path d="M42.5 54.5h18M51.5 45.5v8.5" />
        </>
      )
    case "tablet":
      return (
        <>
          <rect x="45.5" y="44.5" width="12" height="14" rx="1.8" fill="#dcd8ef" />
          <path d="M51.5 56.3h.01" strokeWidth="2" />
        </>
      )
    case "ordner":
      return (
        <>
          <rect x="46.5" y="44" width="10" height="15" rx="1" fill="#c9d9f2" />
          <circle cx="51.5" cy="53.5" r="1.6" />
          <path d="M48.5 47.5h6" />
        </>
      )
    case "headset":
      return (
        <>
          <path d="M45.5 52.5v-1.5a6 6 0 0 1 12 0v1.5" />
          <rect x="44.2" y="51.5" width="3" height="4.6" rx="1.2" fill="#dcd8ef" />
          <rect x="55.8" y="51.5" width="3" height="4.6" rx="1.2" fill="#dcd8ef" />
          <path d="M57.3 56.2c0 2-2 2.8-4.5 2.8" />
        </>
      )
    case "notiz":
      return (
        <>
          <path d="M45.5 45h12v8.5l-3.5 3.5h-8.5z" fill="#ffe58a" />
          <path d="M57.5 53.5H54V57M48 48.5h7M48 51.5h4.5" strokeWidth="1.1" />
        </>
      )
    case "sprechblase":
      return (
        <>
          <path d="M44.5 46.5h14v8h-8l-3.5 3v-3h-2.5z" fill="#d7e8d0" />
          <path d="M48 50.5h.01M51.5 50.5h.01M55 50.5h.01" strokeWidth="2" />
        </>
      )
    case "dokument":
      return (
        <>
          <path d="M46.5 44h7.5l3 3v12h-10.5z" fill="#ffffff" />
          <path d="M48.8 49h5.5M48.8 52h5.5" strokeWidth="1.1" />
          <circle cx="54.6" cy="56" r="1.8" fill="#d6a21e" strokeWidth="1" />
        </>
      )
  }
}

// ---------- Gruppen und Organisationen ----------

function Sinnbild({ emblem }: { emblem: Emblem }) {
  return (
    <g fill="none" stroke={INK} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
      <SinnbildPfad emblem={emblem} />
    </g>
  )
}

function SinnbildPfad({ emblem }: { emblem: Emblem }) {
  switch (emblem) {
    case "gebaeude":
      return (
        <>
          <path d="M15 25.5L32 15l17 10.5z" fill="#ffffff" />
          <path d="M20 29v13M27 29v13M37 29v13M44 29v13M14 46h36M17 42.5h30" />
        </>
      )
    case "leute":
      return (
        <>
          <circle cx="32" cy="24" r="5.5" fill="#ffffff" />
          <circle cx="19.5" cy="28" r="4.3" fill="#ffffff" />
          <circle cx="44.5" cy="28" r="4.3" fill="#ffffff" />
          <path d="M22.5 46c0-6.6 4.3-11.5 9.5-11.5s9.5 4.9 9.5 11.5M11.5 44c0-5 3.5-8.6 8-8.6 1.5 0 2.8.4 4 1.1M52.5 44c0-5-3.5-8.6-8-8.6-1.5 0-2.8.4-4 1.1" />
        </>
      )
    case "zeitung":
      return (
        <>
          <rect x="15" y="17" width="34" height="30" rx="2" fill="#ffffff" />
          <path d="M20 23.5h24M20 29h10M20 34h10M20 39h10M35 29h9v10h-9z" />
        </>
      )
    case "schild":
      return (
        <>
          <path d="M32 14l14 5v10c0 9-6 15.5-14 18-8-2.5-14-9-14-18V19z" fill="#ffffff" />
          <path d="M26 31l4.2 4.2L38.5 27" />
        </>
      )
    case "stempel":
      return (
        <>
          <circle cx="32" cy="19" r="5" fill="#ffffff" />
          <path d="M29.5 24v6h5v-6M20 30h24v7H20zM17 42h30" />
        </>
      )
    case "schalter":
      return (
        <>
          <rect x="15" y="16" width="34" height="30" rx="2" fill="#ffffff" />
          <circle cx="32" cy="25.5" r="4" />
          <path d="M25 35c0-3 3-5 7-5s7 2 7 5M12 36h40" />
        </>
      )
    case "kreuz":
      return <path d="M27 16h10v11h11v10H37v11H27V37H16V27h11z" fill="#ffffff" />
    case "pfote":
      return (
        <g fill={INK} stroke="none">
          <ellipse cx="32" cy="37" rx="8.5" ry="7" />
          <ellipse cx="21.5" cy="27" rx="3.6" ry="4.6" />
          <ellipse cx="28" cy="21" rx="3.6" ry="4.6" />
          <ellipse cx="36" cy="21" rx="3.6" ry="4.6" />
          <ellipse cx="42.5" cy="27" rx="3.6" ry="4.6" />
        </g>
      )
    case "zirkel":
      return (
        <>
          <circle cx="32" cy="17.5" r="3" fill="#ffffff" />
          <path d="M30.6 20.3L22 46M33.4 20.3L42 46M24.5 38.5q7.5 4 15 0" />
        </>
      )
  }
}
