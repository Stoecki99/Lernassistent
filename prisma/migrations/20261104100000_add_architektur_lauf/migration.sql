-- Architektur-Leitstand (docs/architektur-leitstand.md): Läufe als Startwert + Aktionsprotokoll (+ Modell).

-- CreateTable
CREATE TABLE "ArchitekturLauf" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "missionId" TEXT NOT NULL,
    "missionVersion" INTEGER NOT NULL,
    "engineVersion" INTEGER NOT NULL,
    "seed" INTEGER NOT NULL,
    "seedReused" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL,
    "aktionen" JSONB NOT NULL,
    "aktionCount" INTEGER NOT NULL DEFAULT 0,
    "modell" JSONB,
    "tick" INTEGER NOT NULL DEFAULT 0,
    "summary" JSONB,
    "score" INTEGER,
    "stars" INTEGER,
    "scoreDetail" JSONB,
    "pointsAwarded" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "ArchitekturLauf_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ArchitekturLauf_userId_missionId_status_idx" ON "ArchitekturLauf"("userId", "missionId", "status");

-- CreateIndex
CREATE INDEX "ArchitekturLauf_userId_missionId_score_idx" ON "ArchitekturLauf"("userId", "missionId", "score");

-- CreateIndex
CREATE INDEX "ArchitekturLauf_userId_createdAt_idx" ON "ArchitekturLauf"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "ArchitekturLauf" ADD CONSTRAINT "ArchitekturLauf_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Höchstens ein aktiver Lauf je Konto und Mission, auch bei gleichzeitigen Starts.
-- Teil-Index: Prisma kennt keine Teil-Indizes im Schema; der Index lebt nur in dieser Migration.
-- Schlägt «prisma migrate dev» vor, ihn zu entfernen, diese Zeile im Vorschlag löschen.
CREATE UNIQUE INDEX "ArchitekturLauf_aktiv_eindeutig" ON "ArchitekturLauf"("userId", "missionId") WHERE "status" = 'aktiv';

-- Abzeichen des Architektur-Leitstands (gleich wie prisma/seed.ts und ARCHSIM_ABZEICHEN).
-- Die Pipeline führt nur «migrate deploy» aus, keinen Seed; ohne diese Zeilen fehlten die Abzeichen live.
INSERT INTO "Badge" ("id", "name", "description", "icon", "condition", "points") VALUES
  ('badge_archsim_erste_mission', 'Erster Lasttest', 'Architektur-Leitstand: erste Mission abgeschlossen', '🖥️', 'archsim_erste_mission', 25),
  ('badge_archsim_drei_sterne', 'Architektur hält', 'Architektur-Leitstand: eine Mission mit 3 Sternen', '🏗️', 'archsim_drei_sterne', 75),
  ('badge_archsim_alle_missionen', 'Leitstand-Architekt·in', 'Architektur-Leitstand: alle Missionen mit mindestens einem Stern', '🛰️', 'archsim_alle_missionen', 100)
ON CONFLICT DO NOTHING;
