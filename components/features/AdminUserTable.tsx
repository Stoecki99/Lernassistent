"use client"

// components/features/AdminUserTable.tsx
// Admin-Tabelle: Zeigt alle Nutzer, erlaubt Plan-Verwaltung (Free/Pro).

import { useState } from "react"

interface AdminUser {
  id: string
  name: string
  email: string
  createdAt: string
  plan: "free" | "pro"
  planExpiresAt: string | null
  storageUsedMB: number
  apiTokensUsedThisMonth: number
  deckCount: number
  cardCount: number
  chatMessageCount: number
}

interface AdminUserTableProps {
  users: AdminUser[]
}

export default function AdminUserTable({ users: initialUsers }: AdminUserTableProps) {
  const [users, setUsers] = useState(initialUsers)
  const [loading, setLoading] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  async function togglePlan(userId: string, currentPlan: "free" | "pro") {
    setLoading(userId)
    setMessage(null)

    const newPlan = currentPlan === "free" ? "pro" : "free"
    const planExpiresAt = newPlan === "pro"
      ? new Date(Date.now() + 6 * 30 * 24 * 60 * 60 * 1000).toISOString()
      : null

    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, plan: newPlan, planExpiresAt }),
      })

      if (!res.ok) {
        const data = await res.json()
        setMessage(data.error ?? "Fehler beim Aktualisieren.")
        return
      }

      setUsers((prev) =>
        prev.map((u) =>
          u.id === userId ? { ...u, plan: newPlan, planExpiresAt } : u
        )
      )
      setMessage(`${newPlan === "pro" ? "Pro" : "Free"}-Plan fuer Nutzer gesetzt.`)
    } catch {
      setMessage("Netzwerkfehler.")
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryCard label="Nutzer gesamt" value={users.length} />
        <SummaryCard label="Pro-Nutzer" value={users.filter((u) => u.plan === "pro").length} />
        <SummaryCard label="Free-Nutzer" value={users.filter((u) => u.plan === "free").length} />
        <SummaryCard
          label="Karten gesamt"
          value={users.reduce((sum, u) => sum + u.cardCount, 0)}
        />
      </div>

      {/* Status Message */}
      {message && (
        <div className="px-4 py-3 rounded-xl bg-primary/10 text-primary font-semibold text-sm">
          {message}
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-2xl bg-white shadow-md">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-left text-text-light">
              <th className="px-4 py-3 font-semibold">Name</th>
              <th className="px-4 py-3 font-semibold">E-Mail</th>
              <th className="px-4 py-3 font-semibold">Registriert</th>
              <th className="px-4 py-3 font-semibold">Plan</th>
              <th className="px-4 py-3 font-semibold">Läuft ab</th>
              <th className="px-4 py-3 font-semibold">Speicher</th>
              <th className="px-4 py-3 font-semibold">Karten</th>
              <th className="px-4 py-3 font-semibold">API-Tokens</th>
              <th className="px-4 py-3 font-semibold">Aktion</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                <td className="px-4 py-3 font-medium text-text-dark">{user.name}</td>
                <td className="px-4 py-3 text-text-light">{user.email}</td>
                <td className="px-4 py-3 text-text-light">
                  {new Date(user.createdAt).toLocaleDateString("de-CH")}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                      user.plan === "pro"
                        ? "bg-accent/10 text-accent"
                        : "bg-gray-100 text-text-light"
                    }`}
                  >
                    {user.plan === "pro" ? "Pro" : "Free"}
                  </span>
                </td>
                <td className="px-4 py-3 text-text-light">
                  {user.planExpiresAt
                    ? new Date(user.planExpiresAt).toLocaleDateString("de-CH")
                    : "—"}
                </td>
                <td className="px-4 py-3 text-text-light">
                  {user.storageUsedMB.toFixed(1)} MB
                </td>
                <td className="px-4 py-3 text-text-light">
                  {user.cardCount} ({user.deckCount} Decks)
                </td>
                <td className="px-4 py-3 text-text-light">
                  {user.apiTokensUsedThisMonth.toLocaleString("de-CH")}
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => togglePlan(user.id, user.plan)}
                    disabled={loading === user.id}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors disabled:opacity-50 ${
                      user.plan === "pro"
                        ? "bg-gray-100 text-text-light hover:bg-gray-200"
                        : "bg-primary text-white hover:bg-primary-dark"
                    }`}
                  >
                    {loading === user.id
                      ? "..."
                      : user.plan === "pro"
                        ? "Auf Free setzen"
                        : "Pro aktivieren"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white rounded-2xl shadow-md p-4">
      <div className="text-2xl font-extrabold text-text-dark">{value}</div>
      <div className="text-sm text-text-light font-medium">{label}</div>
    </div>
  )
}
