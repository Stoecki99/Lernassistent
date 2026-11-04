-- Abschluss-Abzeichen für den Ernstfall «Stipendien-Assistent, Kanton Hochmatt» (gleich wie
-- prisma/seed.ts). «Onlineschalter eröffnet» (leitstand_ernstfall) gilt ab jetzt nur noch für
-- Wolkenried; bereits vergebene Abzeichen bleiben gültig, die bestehende Zeile bleibt unverändert.
-- Die Pipeline führt nur «migrate deploy» aus, keinen Seed.
INSERT INTO "Badge" ("id", "name", "description", "icon", "condition", "points") VALUES
  ('badge_leitstand_hochmatt', 'Stipendien-Assistent eingeführt', 'Leitstand: Ernstfall Hochmatt abgeschlossen', '🎓', 'leitstand_hochmatt', 75)
ON CONFLICT DO NOTHING;
