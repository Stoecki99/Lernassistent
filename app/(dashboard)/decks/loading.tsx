// app/(dashboard)/decks/loading.tsx
// Skeleton-Loader fuer die Deck-Uebersicht.

import Skeleton from "@/components/ui/Skeleton"

export default function DecksLoading() {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <Skeleton variant="text" width="50%" height="2rem" />
        <div className="mt-2">
          <Skeleton variant="text" width="30%" />
        </div>
      </div>

      {/* Deck-Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} variant="card" height="10rem" />
        ))}
      </div>
    </div>
  )
}
