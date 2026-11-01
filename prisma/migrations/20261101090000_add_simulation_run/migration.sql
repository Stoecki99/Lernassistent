-- CreateTable
CREATE TABLE "SimulationRun" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "scenarioId" TEXT NOT NULL,
    "scenarioVersion" TEXT NOT NULL,
    "engineVersion" INTEGER NOT NULL,
    "seed" INTEGER NOT NULL,
    "seedReused" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL,
    "actions" JSONB NOT NULL,
    "actionCount" INTEGER NOT NULL DEFAULT 0,
    "tick" INTEGER NOT NULL DEFAULT 0,
    "summary" JSONB,
    "score" INTEGER,
    "stars" INTEGER,
    "scoreDetail" JSONB,
    "pointsAwarded" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "SimulationRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SimulationRun_userId_scenarioId_status_idx" ON "SimulationRun"("userId", "scenarioId", "status");

-- CreateIndex
CREATE INDEX "SimulationRun_userId_scenarioId_score_idx" ON "SimulationRun"("userId", "scenarioId", "score");

-- AddForeignKey
ALTER TABLE "SimulationRun" ADD CONSTRAINT "SimulationRun_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Abzeichen des Leitstands (gleich wie prisma/seed.ts). Die Pipeline führt nur
-- «migrate deploy» aus, keinen Seed; ohne diese Zeilen fehlten die Abzeichen live.
INSERT INTO "Badge" ("id", "name", "description", "icon", "condition", "points") VALUES
  ('badge_leitstand_einfuehrung', 'Erster Schichtwechsel', 'Leitstand: Einführungslauf abgeschlossen', '🎛️', 'leitstand_einfuehrung', 25),
  ('badge_leitstand_ernstfall', 'Onlineschalter eröffnet', 'Leitstand: Ernstfall abgeschlossen', '🏛️', 'leitstand_ernstfall', 75),
  ('badge_leitstand_drei_sterne', 'Leitstand-Profi', 'Leitstand: Ernstfall mit mindestens 820 Punkten', '⭐', 'leitstand_drei_sterne', 150),
  ('badge_leitstand_punktlandung', 'Punktlandung', 'Leitstand: Abnahme bis Tag 40 und Kosten im Budget ohne Nachträge', '🎯', 'leitstand_punktlandung', 100),
  ('badge_leitstand_klartext', 'Klartext', 'Leitstand: alle Statusberichte mit Ehrlichkeit von mindestens 85', '📣', 'leitstand_klartext', 75),
  ('badge_leitstand_teamgeist', 'Teamgeist', 'Leitstand: Teammotivation nie unter 80, kein Ausfall durch Überlastung', '🤝', 'leitstand_teamgeist', 75),
  ('badge_leitstand_risikoprofi', 'Risikoprofi', 'Leitstand: Risikomanagement-Index im Mittel mindestens 100 und drei Risiken früh behandelt', '🛡️', 'leitstand_risikoprofi', 75),
  ('badge_leitstand_null_fehler', 'Null-Fehler-Abnahme', 'Leitstand: höchstens 3 Restmängel bei der Abnahme', '✅', 'leitstand_null_fehler', 100)
ON CONFLICT DO NOTHING;
