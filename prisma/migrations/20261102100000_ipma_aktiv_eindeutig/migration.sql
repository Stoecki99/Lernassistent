-- Höchstens ein aktiver Versuch je Konto und Modus im IPMA-Prüfungssimulator (Spezifikation 3.2, 6.4),
-- auch bei gleichzeitigen Starts. Teil-Index: Prisma 7 kennt keine Teil-Indizes im Schema; der Index lebt
-- nur in dieser Migration. Schlägt «prisma migrate dev» vor, ihn zu entfernen, diese Zeile im Vorschlag löschen.
-- Bestehende Doppelungen vorher bereinigen: ältere aktive Versuche gelten als abgebrochen.
UPDATE "IpmaAttempt" AS a
SET "status" = 'aborted'
WHERE a."status" = 'active'
  AND EXISTS (
    SELECT 1 FROM "IpmaAttempt" AS n
    WHERE n."userId" = a."userId"
      AND n."mode" = a."mode"
      AND n."status" = 'active'
      AND (n."createdAt" > a."createdAt" OR (n."createdAt" = a."createdAt" AND n."id" > a."id"))
  );

-- CreateIndex
CREATE UNIQUE INDEX "IpmaAttempt_aktiv_eindeutig" ON "IpmaAttempt"("userId", "mode") WHERE "status" = 'active';
