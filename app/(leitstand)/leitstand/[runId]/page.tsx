// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// app/(leitstand)/leitstand/[runId]/page.tsx
// Spiel (4.8): prueft die Lauf-ID und rendert LeitstandApp. Der Lauf selbst wird im Browser geladen und nachgespielt.

import { notFound } from "next/navigation"
import { runIdSchema } from "@/lib/validations/simulation"
import LeitstandApp from "@/components/features/leitstand/LeitstandApp"

export const metadata = {
  title: "Leitstand · Lauf",
}

export default async function LeitstandRunPage({
  params,
}: {
  params: Promise<{ runId: string }> | { runId: string }
}) {
  const { runId } = await params
  const parsed = runIdSchema.safeParse(runId)
  if (!parsed.success) notFound()
  return <LeitstandApp runId={parsed.data} />
}
