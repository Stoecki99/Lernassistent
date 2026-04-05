"use client"

// components/features/AdminMessages.tsx
// Admin-Bereich: Zeigt Kontaktnachrichten, erlaubt Markierung als gelesen.

import { useState } from "react"
import { contactSubjectLabels, type ContactSubject } from "@/lib/validations/contact"

interface ContactMessageItem {
  id: string
  name: string
  email: string
  subject: string
  message: string
  emailSent: boolean
  read: boolean
  createdAt: string
}

interface AdminMessagesProps {
  messages: ContactMessageItem[]
}

export default function AdminMessages({ messages: initialMessages }: AdminMessagesProps) {
  const [messages, setMessages] = useState(initialMessages)
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const unreadCount = messages.filter((m) => !m.read).length

  async function deleteMessage(messageId: string) {
    if (!confirm("Nachricht wirklich loeschen?")) return

    setLoading(messageId)
    setError(null)

    try {
      const res = await fetch("/api/admin/nachrichten", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? "Fehler beim Loeschen.")
        return
      }

      setMessages((prev) => prev.filter((m) => m.id !== messageId))
    } catch {
      setError("Netzwerkfehler.")
    } finally {
      setLoading(null)
    }
  }

  async function toggleRead(messageId: string, currentRead: boolean) {
    setLoading(messageId)
    setError(null)

    try {
      const res = await fetch("/api/admin/nachrichten", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId, read: !currentRead }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? "Fehler beim Aktualisieren.")
        return
      }

      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId ? { ...m, read: !currentRead } : m
        )
      )
    } catch {
      setError("Netzwerkfehler.")
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-text-dark">
          Nachrichten
          {unreadCount > 0 && (
            <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-600">
              {unreadCount} ungelesen
            </span>
          )}
        </h2>
      </div>

      {error && (
        <div className="px-4 py-3 rounded-xl bg-red-50 text-red-600 font-semibold text-sm">
          {error}
        </div>
      )}

      {messages.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-md p-8 text-center text-text-light">
          Keine Nachrichten vorhanden.
        </div>
      ) : (
        <div className="space-y-3">
          {messages.map((msg) => {
            const subjectLabel = contactSubjectLabels[msg.subject as ContactSubject] ?? msg.subject
            return (
              <div
                key={msg.id}
                className={`bg-white rounded-2xl shadow-md p-5 transition-colors ${
                  !msg.read ? "border-l-4 border-primary" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-text-dark">{msg.name}</span>
                      <a href={`mailto:${msg.email}`} className="text-sm text-primary hover:underline">{msg.email}</a>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-text-light font-medium">
                        {subjectLabel}
                      </span>
                      {!msg.emailSent && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 font-medium">
                          E-Mail nicht gesendet
                        </span>
                      )}
                      {!msg.read && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-bold">
                          Neu
                        </span>
                      )}
                    </div>
                    <p className="text-text-light text-sm mt-2 whitespace-pre-wrap break-words">
                      {msg.message}
                    </p>
                    <p className="text-xs text-text-light mt-2">
                      {new Date(msg.createdAt).toLocaleString("de-CH")}
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 shrink-0">
                    <button
                      onClick={() => toggleRead(msg.id, msg.read)}
                      disabled={loading === msg.id}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors disabled:opacity-50 min-h-[44px] min-w-[44px] ${
                        msg.read
                          ? "bg-gray-100 text-text-light hover:bg-gray-200"
                          : "bg-primary text-white hover:bg-primary-dark"
                      }`}
                    >
                      {loading === msg.id
                        ? "..."
                        : msg.read
                          ? "Ungelesen"
                          : "Gelesen"}
                    </button>
                    <button
                      onClick={() => deleteMessage(msg.id)}
                      disabled={loading === msg.id}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold bg-red-50 text-red-500 hover:bg-red-100 transition-colors disabled:opacity-50 min-h-[44px] min-w-[44px]"
                    >
                      {loading === msg.id ? "..." : "Loeschen"}
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
