-- AlterTable
ALTER TABLE "Deck" ADD COLUMN "shareStatus" TEXT NOT NULL DEFAULT 'none';
ALTER TABLE "Deck" ADD COLUMN "shareRequestedAt" TIMESTAMP(3);
ALTER TABLE "Deck" ADD COLUMN "shareReviewedAt" TIMESTAMP(3);
ALTER TABLE "Deck" ADD COLUMN "shareRejectionReason" TEXT;

-- CreateIndex
CREATE INDEX "Deck_shareStatus_idx" ON "Deck"("shareStatus");
