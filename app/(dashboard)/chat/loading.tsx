// app/(dashboard)/chat/loading.tsx
// Skeleton-Loader fuer die Chat-Seite.

import Skeleton from "@/components/ui/Skeleton"

export default function ChatLoading() {
  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] md:h-[calc(100vh-4rem)] animate-fade-in">
      {/* Chat-Header */}
      <div className="flex items-center gap-3 p-4 border-b border-gray-100">
        <Skeleton variant="circle" width="2.5rem" />
        <div className="flex-1">
          <Skeleton variant="text" width="40%" height="1.25rem" />
          <div className="mt-1">
            <Skeleton variant="text" width="25%" height="0.75rem" />
          </div>
        </div>
      </div>

      {/* Nachrichtenbereich */}
      <div className="flex-1 px-4 py-4 md:px-6 space-y-4">
        {/* Assistant-Nachricht */}
        <div className="flex gap-3 max-w-[80%]">
          <Skeleton variant="circle" width="2rem" />
          <Skeleton variant="rect" width="16rem" height="4rem" className="rounded-2xl" />
        </div>

        {/* User-Nachricht */}
        <div className="flex gap-3 max-w-[80%] ml-auto flex-row-reverse">
          <Skeleton variant="circle" width="2rem" />
          <Skeleton variant="rect" width="12rem" height="3rem" className="rounded-2xl" />
        </div>

        {/* Assistant-Nachricht */}
        <div className="flex gap-3 max-w-[80%]">
          <Skeleton variant="circle" width="2rem" />
          <Skeleton variant="rect" width="20rem" height="5rem" className="rounded-2xl" />
        </div>
      </div>

      {/* Eingabefeld */}
      <div className="p-4 border-t border-gray-100">
        <Skeleton variant="rect" height="3rem" className="rounded-2xl" />
      </div>
    </div>
  )
}
