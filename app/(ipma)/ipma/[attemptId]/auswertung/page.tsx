// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// app/(ipma)/ipma/[attemptId]/auswertung/page.tsx
// Auswertung eines Versuchs (Spezifikation 4.4, 6.8). ?zeit=abgelaufen zeigt die Ansage nach der
// automatischen Abgabe bei Zeitablauf.

import { notFound } from "next/navigation"
import { attemptIdSchema } from "@/lib/validations/ipma"
import ResultApp from "@/components/features/ipma/ResultApp"
import { stationTitles } from "../../../stations"

export const metadata = {
  title: "Auswertung · IPMA-Prüfungssimulator",
}

type Params = { attemptId: string }
type Search = { zeit?: string }

export default async function ResultPage({
  params,
  searchParams,
}: {
  params: Promise<Params> | Params
  searchParams: Promise<Search> | Search
}) {
  const { attemptId } = await params
  const search = await searchParams
  const parsed = attemptIdSchema.safeParse(attemptId)
  if (!parsed.success) notFound()
  return <ResultApp attemptId={parsed.data} stations={stationTitles()} timeUp={search?.zeit === "abgelaufen"} />
}
