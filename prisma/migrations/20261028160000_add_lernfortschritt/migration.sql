-- CreateTable
CREATE TABLE "Lernfortschritt" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fach" TEXT NOT NULL,
    "thema" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "quizRichtig" INTEGER,
    "quizGesamt" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lernfortschritt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Lernfortschritt_userId_fach_idx" ON "Lernfortschritt"("userId", "fach");

-- CreateIndex
CREATE UNIQUE INDEX "Lernfortschritt_userId_fach_thema_key" ON "Lernfortschritt"("userId", "fach", "thema");

-- AddForeignKey
ALTER TABLE "Lernfortschritt" ADD CONSTRAINT "Lernfortschritt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
