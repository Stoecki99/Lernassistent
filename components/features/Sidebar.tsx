// components/features/Sidebar.tsx
// Desktop-Sidebar mit Logo, Navigation und Nutzer-Info.

import Link from "next/link"
import Navigation from "@/components/features/Navigation"
import LogoutButton from "@/components/features/LogoutButton"

interface SidebarProps {
  userName: string
}

export default function Sidebar({ userName }: SidebarProps) {
  const initials = userName
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)

  return (
    <aside className="hidden md:flex flex-col w-[250px] min-h-screen bg-surface-card shadow-md border-r border-gray-100">
      {/* Logo */}
      <div className="px-5 py-6">
        <Link href="/dashboard" className="flex items-center gap-2 group">
          <span className="text-3xl">&#127891;</span>
          <span className="text-xl font-extrabold text-text-dark group-hover:text-primary transition-colors">
            Lernassistent
          </span>
        </Link>
      </div>

      {/* Navigation */}
      <div className="flex-1 px-3 py-2">
        <Navigation variant="sidebar" />
      </div>

      {/* User Info + Logout */}
      <div className="border-t border-gray-100 px-3 py-4">
        <div className="flex items-center gap-3 px-4 py-2 mb-2">
          <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm">
            {initials}
          </div>
          <span className="text-sm font-semibold text-text truncate">
            {userName}
          </span>
        </div>
        <LogoutButton />
      </div>
    </aside>
  )
}
