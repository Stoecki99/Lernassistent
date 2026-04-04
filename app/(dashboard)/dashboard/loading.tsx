// app/(dashboard)/dashboard/loading.tsx
// Skeleton-Loader fuer die Dashboard-Seite.

import Skeleton from "@/components/ui/Skeleton"

export default function DashboardLoading() {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Begruessung */}
      <div>
        <Skeleton variant="text" width="60%" height="2rem" />
        <div className="mt-2">
          <Skeleton variant="text" width="40%" />
        </div>
      </div>

      {/* Streak + Statistik-Widgets */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Skeleton variant="card" height="10rem" />
        <div className="grid grid-cols-2 gap-3">
          <Skeleton variant="card" height="4.5rem" />
          <Skeleton variant="card" height="4.5rem" />
          <Skeleton variant="card" height="4.5rem" />
          <Skeleton variant="card" height="4.5rem" />
        </div>
      </div>

      {/* Tagesfortschritt */}
      <Skeleton variant="card" height="6rem" />

      {/* Wochen-Chart */}
      <Skeleton variant="card" height="12rem" />

      {/* Schnellzugriff */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Skeleton variant="card" height="5rem" />
        <Skeleton variant="card" height="5rem" />
        <Skeleton variant="card" height="5rem" />
      </div>
    </div>
  )
}
