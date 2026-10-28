// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// components/features/lernseiten/LernInhalt.tsx
// Rendert Textfelder der Lernseiten: Markdown, KaTeX-Formeln ($…$, $$…$$)
// und Formel-Spans (class m/v/c/fn/p/q/nw, data-link, data-ph).
// HTML wird mit rehype-sanitize gefiltert — kein dangerouslySetInnerHTML.
// Ohne "use client": in Server-Komponenten wird auf dem Server gerendert,
// ins Client-Bundle kommt sie nur dort, wo Client-Komponenten sie einbinden.

import ReactMarkdown from "react-markdown"
import remarkMath from "remark-math"
import rehypeRaw from "rehype-raw"
import rehypeSanitize, { defaultSchema } from "rehype-sanitize"
import rehypeKatex from "rehype-katex"
import "katex/dist/katex.min.css"

const FORMEL_KLASSEN = ["m", "v", "c", "fn", "p", "q", "nw"]

// Abschliessende Liste erlaubter Tags (keine Bilder, Formulare, Medien).
const ERLAUBTE_TAGS = [
  "p", "br", "strong", "em", "del", "sub", "sup", "span", "code", "pre", "a", "blockquote",
  "ul", "ol", "li", "table", "thead", "tbody", "tr", "th", "td",
]

// Zusaetzlich zum Standard: <span> mit Formel-Klassen und Verknuepfungs-Attributen,
// sowie die Klassen, die remark-math fuer rehype-katex setzt.
const sanitizeSchema = {
  ...defaultSchema,
  tagNames: ERLAUBTE_TAGS,
  attributes: {
    ...defaultSchema.attributes,
    span: [["className", ...FORMEL_KLASSEN], "dataLink", "dataPh"],
    code: [["className", /^language-./, "math-inline", "math-display"]],
  },
}

interface LernInhaltProps {
  inhalt: string
  /** Ohne Absatz-Umbruch rendern (fuer Text in Buttons, Tabellenzellen usw.) */
  inline?: boolean
  className?: string
}

export default function LernInhalt({ inhalt, inline = false, className = "" }: LernInhaltProps) {
  const Wrapper = inline ? "span" : "div"
  return (
    <Wrapper className={`lerninhalt ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[rehypeRaw, [rehypeSanitize, sanitizeSchema], rehypeKatex]}
        components={{
          p: ({ children }) =>
            inline ? <>{children}</> : <p className="mb-3 last:mb-0 leading-relaxed">{children}</p>,
          ul: ({ children }) => <ul className="list-disc pl-5 space-y-1 mb-3 last:mb-0">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal pl-5 space-y-1 mb-3 last:mb-0">{children}</ol>,
          strong: ({ children }) => <strong className="font-extrabold text-text-dark">{children}</strong>,
          a: ({ href, children }) => (
            <a href={href} className="text-secondary-dark underline hover:text-secondary">
              {children}
            </a>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto my-2">
              <table className="min-w-full text-sm border-collapse">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border border-gray-200 bg-gray-50 px-2 py-1 font-bold text-left">{children}</th>
          ),
          td: ({ children }) => <td className="border border-gray-200 px-2 py-1">{children}</td>,
        }}
      >
        {inhalt}
      </ReactMarkdown>
    </Wrapper>
  )
}
