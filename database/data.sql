-- UEH Invisible Pass - Seed/demo data
-- Run AFTER schema.sql:
--   mysql -u root ueh_invisible_pass < database/data.sql
--
-- Seeds the 4 physical gates only. User accounts are no longer seeded -
-- register real accounts through the app (or add them to server/src/seed.js
-- and run `npm run seed`).

USE ueh_invisible_pass;

INSERT INTO gates (id, name, location, type, status) VALUES
  (1, 'Cong A - Vao', 'Co so A', 'entry', 'online'),
  (2, 'Cong A - Ra', 'Co so A', 'exit', 'online'),
  (3, 'Cong B - Vao', 'Co so B', 'entry', 'online'),
  (4, 'Cong B - Ra', 'Co so B', 'exit', 'online');
