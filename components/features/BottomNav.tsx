// components/features/BottomNav.tsx
// Mobile Bottom-Navigation mit 5 Haupt-Icons.

import Navigation from "@/components/features/Navigation"

export default function BottomNav() {
  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-surface-card border-t border-gray-100 shadow-[0_-2px_10px_rgba(0,0,0,0.06)] px-2 py-1 safe-area-bottom">
      <Navigation variant="bottom" />
    </div>
  )
}
