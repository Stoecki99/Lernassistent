// app/(dashboard)/quiz/loading.tsx
// Skeleton-Loader fuer die Quiz-Auswahl.

import Skeleton from "@/components/ui/Skeleton"

export default function QuizLoading() {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <Skeleton variant="text" width="30%" height="2rem" />
        <div className="mt-2">
          <Skeleton variant="text" width="55%" />
        </div>
      </div>

      {/* Deck-Auswahl */}
      <Skeleton variant="card" height="8rem" />

      {/* Quiz-Typ-Auswahl */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Skeleton variant="card" height="7rem" />
        <Skeleton variant="card" height="7rem" />
        <Skeleton variant="card" height="7rem" />
      </div>

      {/* Start-Button */}
      <Skeleton variant="rect" width="12rem" height="3rem" className="mx-auto rounded-2xl" />
    </div>
  )
}
