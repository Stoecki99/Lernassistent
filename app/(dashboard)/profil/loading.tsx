// app/(dashboard)/profil/loading.tsx
// Skeleton-Loader fuer die Profil-Seite.

import Skeleton from "@/components/ui/Skeleton"

export default function ProfilLoading() {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <Skeleton variant="text" width="30%" height="2rem" />

      {/* User-Info Card */}
      <div className="bg-surface-card rounded-2xl shadow-card p-6 flex items-center gap-4">
        <Skeleton variant="circle" width="4rem" />
        <div className="flex-1 space-y-2">
          <Skeleton variant="text" width="50%" height="1.25rem" />
          <Skeleton variant="text" width="35%" height="0.875rem" />
          <Skeleton variant="text" width="25%" height="0.75rem" />
        </div>
      </div>

      {/* Statistik-Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Skeleton variant="card" height="5rem" />
        <Skeleton variant="card" height="5rem" />
        <Skeleton variant="card" height="5rem" />
        <Skeleton variant="card" height="5rem" />
      </div>

      {/* Badges */}
      <div>
        <Skeleton variant="text" width="40%" height="1.25rem" className="mb-3" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Skeleton variant="card" height="6rem" />
          <Skeleton variant="card" height="6rem" />
          <Skeleton variant="card" height="6rem" />
          <Skeleton variant="card" height="6rem" />
        </div>
      </div>

      {/* Logout */}
      <Skeleton variant="rect" height="3.5rem" className="rounded-2xl" />
    </div>
  )
}
