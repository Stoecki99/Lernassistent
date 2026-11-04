-- CreateTable
CREATE TABLE "Spielstand" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fach" TEXT NOT NULL,
    "spiel" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "sterne" INTEGER NOT NULL,
    "xp" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Spielstand_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Spielstand_userId_fach_spiel_level_key" ON "Spielstand"("userId", "fach", "spiel", "level");

-- AddForeignKey
ALTER TABLE "Spielstand" ADD CONSTRAINT "Spielstand_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Abzeichen der AVSW-Modellierspiele (gleich wie prisma/seed.ts und SPIEL_ABZEICHEN in lib/spielstand.ts).
-- Die Pipeline führt nur «migrate deploy» aus, keinen Seed; ohne diese Zeilen fehlten die Abzeichen live.
INSERT INTO "Badge" ("id", "name", "description", "icon", "condition", "points") VALUES
  ('badge_avsw_spiel_fehlerfrei', 'Fehlerfrei', 'AVSW-Modellierspiel: ein Level mit 3 Sternen gelöst', '💎', 'avsw_spiel_fehlerfrei', 25),
  ('badge_avsw_spiel_bronze', 'Architekt·in Bronze', 'AVSW-Modellierspiele: 10 Sterne gesammelt', '🥉', 'avsw_spiel_sterne_10', 25),
  ('badge_avsw_spiel_silber', 'Architekt·in Silber', 'AVSW-Modellierspiele: 25 Sterne gesammelt', '🥈', 'avsw_spiel_sterne_25', 50),
  ('badge_avsw_spiel_gold', 'Architekt·in Gold', 'AVSW-Modellierspiele: 45 Sterne gesammelt', '🥇', 'avsw_spiel_sterne_45', 100)
ON CONFLICT DO NOTHING;
