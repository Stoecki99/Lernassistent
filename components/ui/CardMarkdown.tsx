"use client"

// components/ui/CardMarkdown.tsx
// Rendert Markdown-Inhalte in Karteikarten und Quiz-Fragen.
// Unterstuetzt: Fett, Kursiv, Listen, Code, Bilder (URL), Links.

import ReactMarkdown from "react-markdown"

interface CardMarkdownProps {
  content: string
  className?: string
}

export default function CardMarkdown({ content, className = "" }: CardMarkdownProps) {
  return (
    <div className={`card-markdown ${className}`}>
      <ReactMarkdown
        components={{
          p: ({ children }) => (
            <p className="mb-2 last:mb-0">{children}</p>
          ),
          strong: ({ children }) => (
            <strong className="font-extrabold text-text-dark">{children}</strong>
          ),
          em: ({ children }) => (
            <em className="italic text-text">{children}</em>
          ),
          ul: ({ children }) => (
            <ul className="list-disc list-inside space-y-1 text-left">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-inside space-y-1 text-left">{children}</ol>
          ),
          li: ({ children }) => (
            <li className="text-base">{children}</li>
          ),
          code: ({ className: codeClassName, children, ...props }) => {
            const isBlock = codeClassName?.includes("language-")
            if (isBlock) {
              return (
                <pre className="bg-gray-100 rounded-lg p-3 my-2 overflow-x-auto text-sm">
                  <code className="font-mono">{children}</code>
                </pre>
              )
            }
            return (
              <code className="bg-gray-100 px-1.5 py-0.5 rounded text-sm font-mono" {...props}>
                {children}
              </code>
            )
          },
          pre: ({ children }) => <>{children}</>,
          img: ({ src, alt }) => (
            <img
              src={src}
              alt={alt ?? ""}
              className="max-w-full h-auto rounded-lg my-2 mx-auto"
              loading="lazy"
            />
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline hover:text-primary-dark"
            >
              {children}
            </a>
          ),
          h1: ({ children }) => (
            <p className="text-lg font-extrabold mb-1">{children}</p>
          ),
          h2: ({ children }) => (
            <p className="text-base font-extrabold mb-1">{children}</p>
          ),
          h3: ({ children }) => (
            <p className="text-sm font-extrabold mb-1">{children}</p>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-primary/30 pl-3 my-2 text-text-light italic">
              {children}
            </blockquote>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto my-2">
              <table className="min-w-full text-sm border-collapse">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border border-gray-200 bg-gray-50 px-2 py-1 font-bold text-left">{children}</th>
          ),
          td: ({ children }) => (
            <td className="border border-gray-200 px-2 py-1">{children}</td>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
