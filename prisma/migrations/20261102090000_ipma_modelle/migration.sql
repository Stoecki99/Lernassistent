-- CreateTable
CREATE TABLE "IpmaAttempt" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "variant" TEXT NOT NULL DEFAULT 'strict',
    "status" TEXT NOT NULL,
    "seed" INTEGER NOT NULL,
    "poolVersion" TEXT NOT NULL,
    "configVersion" INTEGER NOT NULL,
    "config" JSONB NOT NULL,
    "competences" TEXT[],
    "itemCount" INTEGER NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deadlineAt" TIMESTAMP(3),
    "pausedAt" TIMESTAMP(3),
    "resumedAt" TIMESTAMP(3),
    "activeSeconds" INTEGER NOT NULL DEFAULT 0,
    "submittedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "pointsQ" INTEGER,
    "maxPointsQ" INTEGER,
    "shownCount" INTEGER,
    "passed" BOOLEAN,
    "result" JSONB,
    "pointsAwarded" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IpmaAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IpmaAttemptItem" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "questionId" TEXT NOT NULL,
    "questionVersion" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "competence" TEXT NOT NULL,
    "optionOrder" INTEGER[],
    "choice" INTEGER,
    "text" TEXT,
    "flagged" BOOLEAN NOT NULL DEFAULT false,
    "answeredAt" TIMESTAMP(3),
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "selfScores" INTEGER[],
    "selfAssessedAt" TIMESTAMP(3),
    "aiStatus" TEXT NOT NULL DEFAULT 'none',
    "aiScores" INTEGER[],
    "aiFeedback" JSONB,
    "aiTokens" INTEGER NOT NULL DEFAULT 0,
    "aiAssessedAt" TIMESTAMP(3),
    "scoreSource" TEXT,
    "rasterPoints" INTEGER,
    "correct" BOOLEAN,
    "pointsQ" INTEGER,

    CONSTRAINT "IpmaAttemptItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IpmaQuestionState" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "box" INTEGER NOT NULL DEFAULT 0,
    "dueAt" TIMESTAMP(3),
    "seenCount" INTEGER NOT NULL DEFAULT 0,
    "correctCount" INTEGER NOT NULL DEFAULT 0,
    "lastCorrect" BOOLEAN,
    "lastSeenAt" TIMESTAMP(3),

    CONSTRAINT "IpmaQuestionState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IpmaAttempt_userId_mode_status_idx" ON "IpmaAttempt"("userId", "mode", "status");

-- CreateIndex
CREATE INDEX "IpmaAttempt_userId_mode_finishedAt_idx" ON "IpmaAttempt"("userId", "mode", "finishedAt");

-- CreateIndex
CREATE INDEX "IpmaAttemptItem_attemptId_competence_idx" ON "IpmaAttemptItem"("attemptId", "competence");

-- CreateIndex
CREATE INDEX "IpmaAttemptItem_questionId_idx" ON "IpmaAttemptItem"("questionId");

-- CreateIndex
CREATE UNIQUE INDEX "IpmaAttemptItem_attemptId_position_key" ON "IpmaAttemptItem"("attemptId", "position");

-- CreateIndex
CREATE INDEX "IpmaQuestionState_userId_dueAt_idx" ON "IpmaQuestionState"("userId", "dueAt");

-- CreateIndex
CREATE UNIQUE INDEX "IpmaQuestionState_userId_questionId_key" ON "IpmaQuestionState"("userId", "questionId");

-- AddForeignKey
ALTER TABLE "IpmaAttempt" ADD CONSTRAINT "IpmaAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IpmaAttemptItem" ADD CONSTRAINT "IpmaAttemptItem_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "IpmaAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IpmaQuestionState" ADD CONSTRAINT "IpmaQuestionState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Abzeichen des IPMA-Prüfungssimulators (gleich wie prisma/seed.ts, Spezifikation 6.10). Die Pipeline führt
-- nur «migrate deploy» aus, keinen Seed; ohne diese Zeilen fehlten die Abzeichen live.
INSERT INTO "Badge" ("id", "name", "description", "icon", "condition", "points") VALUES
  ('badge_ipma_erste_pruefung', 'Prüfungsluft', 'IPMA-Prüfungssimulator: erste Übungsprüfung abgeschlossen', '📝', 'ipma_erste_pruefung', 20),
  ('badge_ipma_bestanden', 'Bestanden', 'IPMA-Prüfungssimulator: Übungsprüfung unter Echtbedingungen bestanden', '🎓', 'ipma_bestanden', 50),
  ('badge_ipma_souveraen', 'Souverän', 'IPMA-Prüfungssimulator: Übungsprüfung unter Echtbedingungen mit mindestens 80 % und 26 Kompetenzen', '🏅', 'ipma_souveraen', 50),
  ('badge_ipma_kompass', 'Kompass', 'IPMA-Prüfungssimulator: alle 28 Kompetenzen in einer Übungsprüfung nachgewiesen', '🧭', 'ipma_kompass', 50),
  ('badge_ipma_lueckenschliesser', 'Lückenschliesser', 'IPMA-Prüfungssimulator: 10 Runden «Lücken schliessen» abgeschlossen', '🔧', 'ipma_lueckenschliesser', 30),
  ('badge_ipma_landkarte', 'Landkarte komplett', 'IPMA-Prüfungssimulator: Beherrschung «sicher» in allen 28 Kompetenzen', '🗺️', 'ipma_landkarte', 50)
ON CONFLICT DO NOTHING;
