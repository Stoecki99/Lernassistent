-- Höchstens ein aktiver Lauf je Konto und Szenario (Spezifikation 4.5), auch bei gleichzeitigen Starts.
-- Teil-Index: Prisma 7.6 kennt keine Teil-Indizes im Schema; der Index lebt nur in dieser Migration.
-- Schlägt «prisma migrate dev» vor, ihn zu entfernen, diese Zeile im Vorschlag löschen.
-- Bestehende Doppelungen vorher bereinigen: ältere aktive Läufe gelten als abgebrochen.
UPDATE "SimulationRun" AS r
SET "status" = 'abgebrochen'
WHERE r."status" = 'aktiv'
  AND EXISTS (
    SELECT 1 FROM "SimulationRun" AS n
    WHERE n."userId" = r."userId"
      AND n."scenarioId" = r."scenarioId"
      AND n."status" = 'aktiv'
      AND (n."createdAt" > r."createdAt" OR (n."createdAt" = r."createdAt" AND n."id" > r."id"))
  );

-- CreateIndex
CREATE UNIQUE INDEX "SimulationRun_aktiv_eindeutig" ON "SimulationRun"("userId", "scenarioId") WHERE "status" = 'aktiv';
