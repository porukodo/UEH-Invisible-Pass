-- UEH Invisible Pass - Seed/demo data
-- Run AFTER schema.sql:
--   mysql -u root ueh_invisible_pass < database/data.sql
--
-- Seeds the 4 physical gates only. User accounts are no longer seeded -
-- register real accounts through the app (or add them to server/src/seed.js
-- and run `npm run seed`).

USE ueh_invisible_pass;

INSERT INTO gates (id, name, location, type, status) VALUES
  (1, 'Cổng A', 'Cơ sở A', 'entry', 'online'),
  (2, 'Cổng A', 'Cơ sở A', 'exit', 'online'),
  (3, 'Cổng B', 'Cơ sở B', 'entry', 'online'),
  (4, 'Cổng B', 'Cơ sở B', 'exit', 'online');
