// app/admin/[token]/layout.tsx
// Minimales Layout fuer den Admin-Bereich (kein Dashboard-Chrome).

export const metadata = {
  title: "Admin — Lernassistent",
  robots: "noindex, nofollow",
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-surface">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-8">
          <span className="text-3xl" aria-hidden="true">&#128272;</span>
          <h1 className="text-2xl font-extrabold text-text-dark">Admin Panel</h1>
        </div>
        {children}
      </div>
    </div>
  )
}
