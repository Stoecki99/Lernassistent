// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// app/(ipma)/ipma/[attemptId]/page.tsx
// Versuch (Prüfung, Kurzprüfung, Training, Lücken schliessen; Spezifikation 6.8): prüft die ID und rendert
// AttemptApp. Der Versuch selbst wird im Browser über GET /api/ipma/attempts/[id] geladen.

import { notFound } from "next/navigation"
import { attemptIdSchema } from "@/lib/validations/ipma"
import AttemptApp from "@/components/features/ipma/AttemptApp"

export const metadata = {
  title: "Versuch · IPMA-Prüfungssimulator",
}

export default async function AttemptPage({ params }: { params: Promise<{ attemptId: string }> | { attemptId: string } }) {
  const { attemptId } = await params
  const parsed = attemptIdSchema.safeParse(attemptId)
  if (!parsed.success) notFound()
  return <AttemptApp attemptId={parsed.data} />
}
