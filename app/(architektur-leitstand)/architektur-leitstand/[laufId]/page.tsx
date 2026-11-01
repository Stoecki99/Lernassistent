// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// app/(architektur-leitstand)/architektur-leitstand/[laufId]/page.tsx
// Spiel: prueft die Lauf-ID und rendert ArchitekturApp. Der Lauf wird im Browser geladen und nachgespielt.

import { notFound } from "next/navigation"
import { laufIdSchema } from "@/lib/validations/architektur-leitstand"
import ArchitekturApp from "@/components/features/architektur-leitstand/ArchitekturApp"

export const metadata = {
  title: "Architektur-Leitstand · Lauf",
}

export default async function ArchitekturLaufPage({ params }: { params: Promise<{ laufId: string }> | { laufId: string } }) {
  const { laufId } = await params
  const parsed = laufIdSchema.safeParse(laufId)
  if (!parsed.success) notFound()
  return <ArchitekturApp laufId={parsed.data} />
}
