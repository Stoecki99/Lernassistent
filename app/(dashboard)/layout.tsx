// app/(dashboard)/layout.tsx
// Dashboard-Layout mit Sidebar (Desktop) und Bottom-Navigation (Mobile).
// Prueft Session serverseitig — leitet bei fehlender Session zum Login weiter.

import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/auth"
import Sidebar from "@/components/features/Sidebar"
import BottomNav from "@/components/features/BottomNav"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getCurrentUser()

  if (!user) {
    redirect("/login")
  }

  const userName = user.name ?? "Student"

  return (
    <div className="flex min-h-screen bg-surface">
      {/* Desktop Sidebar */}
      <Sidebar userName={userName} />

      {/* Main Content */}
      <main className="flex-1 min-h-screen pb-20 md:pb-0">
        <div className="max-w-4xl mx-auto px-4 py-6 md:px-8 md:py-8">
          {children}
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <BottomNav />
    </div>
  )
}
