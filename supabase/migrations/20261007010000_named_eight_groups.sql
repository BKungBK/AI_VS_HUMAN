BEGIN;

ALTER TABLE game.groups DROP CONSTRAINT IF EXISTS groups_id_check;
ALTER TABLE game.groups ADD CONSTRAINT groups_id_check CHECK (id BETWEEN 1 AND 8);

ALTER TABLE game.caption_candidates DROP CONSTRAINT IF EXISTS caption_candidates_group_id_check;
ALTER TABLE game.caption_candidates ADD CONSTRAINT caption_candidates_group_id_check CHECK (group_id BETWEEN 1 AND 8);

ALTER TABLE game.piece_candidates DROP CONSTRAINT IF EXISTS piece_candidates_group_id_check;
ALTER TABLE game.piece_candidates ADD CONSTRAINT piece_candidates_group_id_check CHECK (group_id BETWEEN 1 AND 8);

DO $migration$
DECLARE
  definition text;
BEGIN
  SELECT pg_get_functiondef('game.apply_base_command(uuid,text,text,jsonb)'::regprocedure)
  INTO definition;

  IF definition IS NULL OR strpos(definition, 'NOT BETWEEN 1 AND 6') = 0 THEN
    RAISE EXCEPTION 'Could not locate the player group limit in game.apply_base_command';
  END IF;

  EXECUTE replace(definition, 'NOT BETWEEN 1 AND 6', 'NOT BETWEEN 1 AND 8');
END;
$migration$;

INSERT INTO game.groups (room_code, id, name)
SELECT rooms.code, names.id, names.name
FROM game.rooms AS rooms
CROSS JOIN (VALUES
  (1, '1234'),
  (2, 'สีกุมาร'),
  (3, 'Humanเนต'),
  (4, 'ท้ายกลีกร'),
  (5, 'เทเลทับบี้'),
  (6, 'Cry4'),
  (7, 'cybertud67'),
  (8, 'ท้ายไทยพาณิชย์')
) AS names(id, name)
ON CONFLICT (room_code, id) DO UPDATE SET name = EXCLUDED.name;

COMMIT;
