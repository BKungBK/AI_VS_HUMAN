-- ============================================================================
-- Game 7: Missing Piece (AI เริ่ม คนเติม)
-- Cue: 14.01 -> 15.01 ("สมการของความรับผิดชอบ")
-- Content version: piece-v1, Scoring: piece-1000-v1
-- ============================================================================

CREATE TABLE IF NOT EXISTS game.piece_content (
  version text PRIMARY KEY,
  prompt text NOT NULL,
  task text NOT NULL,
  base_asset_id text NOT NULL,
  base_svg text NOT NULL,
  base_metadata jsonb NOT NULL
);

CREATE TABLE IF NOT EXISTS game.piece_artworks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL,
  member_id uuid NOT NULL,
  strokes jsonb NOT NULL DEFAULT '[]'::jsonb,
  stroke_count int NOT NULL DEFAULT 0,
  point_count int NOT NULL DEFAULT 0,
  revision int NOT NULL DEFAULT 1 CHECK (revision > 0),
  locked_revision int,
  submitted boolean NOT NULL DEFAULT false,
  first_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  locked_at timestamptz,
  decision text NOT NULL DEFAULT 'PENDING' CHECK (decision IN ('PENDING', 'APPROVED', 'REJECTED', 'WITHHELD')),
  reviewed_revision int,
  review_version int NOT NULL DEFAULT 0,
  reviewer uuid REFERENCES game.actors(id),
  reason text,
  UNIQUE(run_id, member_id),
  FOREIGN KEY(run_id, member_id) REFERENCES game.rosters(run_id, member_id)
);

CREATE TABLE IF NOT EXISTS game.piece_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES game.runs(id),
  artwork_id uuid REFERENCES game.piece_artworks(id),
  group_id int CHECK (group_id BETWEEN 1 AND 8),
  position int NOT NULL,
  UNIQUE(run_id, position),
  UNIQUE(run_id, group_id)
);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='game.piece_candidates'::regclass AND conname='piece_candidates_group_id_check' AND pg_get_constraintdef(oid) LIKE '%<= 8%') THEN
    ALTER TABLE game.piece_candidates DROP CONSTRAINT IF EXISTS piece_candidates_group_id_check;
    ALTER TABLE game.piece_candidates ADD CONSTRAINT piece_candidates_group_id_check CHECK (group_id BETWEEN 1 AND 8);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS game.piece_votes (
  run_id uuid NOT NULL,
  member_id uuid NOT NULL,
  vote_type text NOT NULL CHECK (vote_type IN ('INTERNAL', 'FINAL')),
  candidate_id uuid NOT NULL,
  revision int NOT NULL CHECK (revision > 0),
  accepted_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (run_id, member_id, vote_type),
  FOREIGN KEY (run_id, member_id) REFERENCES game.rosters(run_id, member_id)
);

CREATE TABLE IF NOT EXISTS game.piece_run_state (
  run_id uuid PRIMARY KEY REFERENCES game.runs(id),
  current_phase text NOT NULL CHECK (current_phase IN ('COUNTDOWN', 'DRAWING', 'REVIEW_REQUIRED', 'INTERNAL_VOTE', 'FINAL_VOTE', 'RESULT')),
  phase_start timestamptz NOT NULL,
  drawing_start timestamptz,
  deadline timestamptz
);

ALTER TABLE game.piece_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE game.piece_artworks ENABLE ROW LEVEL SECURITY;
ALTER TABLE game.piece_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE game.piece_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE game.piece_run_state ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA game FROM PUBLIC;

-- ============================================================================
-- Support and Scoring Functions (1000 points normalized group support)
-- ============================================================================

CREATE OR REPLACE FUNCTION game.piece_support(rr uuid, owner_group int, target uuid)
RETURNS TABLE(numerator numeric, denominator numeric) LANGUAGE plpgsql STABLE AS $$
DECLARE
  counts record;
  common_den numeric := 1;
  eligible_count int := 0;
  total numeric := 0;
  vote_count numeric;
BEGIN
  FOR counts IN
    SELECT group_id, count(*)::numeric n
    FROM game.rosters
    WHERE run_id = rr AND (owner_group IS NULL OR group_id <> owner_group)
    GROUP BY group_id
  LOOP
    common_den := common_den * counts.n;
    eligible_count := eligible_count + 1;
  END LOOP;

  IF eligible_count = 0 THEN
    RETURN QUERY SELECT 0::numeric, 1::numeric;
    RETURN;
  END IF;

  FOR counts IN
    SELECT group_id, count(*)::numeric n
    FROM game.rosters
    WHERE run_id = rr AND (owner_group IS NULL OR group_id <> owner_group)
    GROUP BY group_id
  LOOP
    SELECT count(*)::numeric INTO vote_count
    FROM game.piece_votes vote
    JOIN game.rosters ro ON ro.run_id = vote.run_id AND ro.member_id = vote.member_id
    WHERE vote.run_id = rr AND vote.vote_type = 'FINAL' AND vote.candidate_id = target AND ro.group_id = counts.group_id;

    total := total + vote_count * (common_den / counts.n);
  END LOOP;

  RETURN QUERY SELECT total, common_den * eligible_count;
END $$;

CREATE OR REPLACE FUNCTION game.piece_results(rr uuid) RETURNS jsonb LANGUAGE sql STABLE AS $$
  WITH weighted AS (
    SELECT
      cand.*,
      fraction.numerator support_num,
      fraction.denominator support_den,
      CASE WHEN fraction.denominator > 0 THEN fraction.numerator / fraction.denominator ELSE 0 END support,
      (SELECT count(*)::int FROM game.piece_votes WHERE run_id = rr AND vote_type = 'FINAL' AND candidate_id = cand.id) votes
    FROM game.piece_candidates cand
    CROSS JOIN LATERAL game.piece_support(rr, cand.group_id, cand.id) fraction
    WHERE cand.run_id = rr
  ),
  best AS (
    SELECT support_num best_num, support_den best_den
    FROM weighted
    ORDER BY support DESC
    LIMIT 1
  ),
  scored AS (
    SELECT * FROM weighted CROSS JOIN best
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', id,
    'position', position,
    'groupId', group_id,
    'artworkId', artwork_id,
    'author', (
      SELECT nickname FROM game.rosters ro
      JOIN game.piece_artworks art ON art.run_id = ro.run_id AND art.member_id = ro.member_id
      WHERE art.id = artwork_id
    ),
    'groupName', (
      SELECT name FROM game.groups
      WHERE room_code = (SELECT room_code FROM game.runs WHERE id = rr) AND id = group_id
    ),
    'votes', votes,
    'support', support,
    'supportExact', support_num::text || '/' || support_den::text,
    'supportNumerator', support_num,
    'supportDenominator', support_den,
    'score', CASE
      WHEN best_num > 0 THEN round(1000 * support_num * best_den / (support_den * best_num))::int
      ELSE 0
    END,
    'winner', (best_num > 0 AND support_num * best_den = best_num * support_den),
    'strokes', (SELECT strokes FROM game.piece_artworks WHERE id = artwork_id)
  ) ORDER BY position), '[]'::jsonb) FROM scored;
$$;

CREATE OR REPLACE FUNCTION game.piece_scores(p_run uuid) RETURNS jsonb LANGUAGE plpgsql STABLE AS $$
DECLARE
  result jsonb;
  v_results jsonb := game.piece_results(p_run);
BEGIN
  SELECT jsonb_agg(jsonb_build_object(
    'id', g.id,
    'name', g.name,
    'numerator', coalesce((
      SELECT (item->>'score')::int
      FROM jsonb_array_elements(v_results) item
      WHERE (item->>'groupId')::int = g.id
    ), 0) * (SELECT count(*) FROM game.rosters WHERE run_id = p_run AND group_id = g.id),
    'denominator', (SELECT count(*) FROM game.rosters WHERE run_id = p_run AND group_id = g.id)
  ) ORDER BY g.id) INTO result
  FROM game.groups g
  WHERE room_code = (SELECT room_code FROM game.runs WHERE id = p_run);

  RETURN coalesce(result, '[]'::jsonb);
END $$;

CREATE OR REPLACE FUNCTION game.piece_digest(p_run uuid) RETURNS text LANGUAGE sql STABLE AS $$
  SELECT md5(
    coalesce((SELECT string_agg(id::text || ':' || revision || ':' || stroke_count || ':' || decision || ':' || coalesce(locked_revision::text, ''), ',' ORDER BY id) FROM game.piece_artworks WHERE run_id = p_run), '') || '|' ||
    coalesce((SELECT string_agg(member_id::text || ':' || vote_type || ':' || candidate_id || ':' || revision, ',' ORDER BY member_id, vote_type) FROM game.piece_votes WHERE run_id = p_run), '') || '|' ||
    coalesce((SELECT string_agg(id::text || ':' || position || ':' || coalesce(group_id::text, ''), ',' ORDER BY position) FROM game.piece_candidates WHERE run_id = p_run), '')
  );
$$;

-- ============================================================================
-- Nominate Group Candidates based on internal group votes
-- ============================================================================

CREATE OR REPLACE FUNCTION game.piece_nominate(rr uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM game.piece_candidates WHERE run_id = rr;

  INSERT INTO game.piece_candidates(run_id, artwork_id, group_id, position)
  SELECT
    rr,
    nominee.id,
    nominee.group_id,
    row_number() OVER(ORDER BY random())::int
  FROM (
    SELECT DISTINCT ON (ro.group_id)
      art.id,
      ro.group_id
    FROM game.piece_artworks art
    JOIN game.rosters ro ON ro.run_id = art.run_id AND ro.member_id = art.member_id
    WHERE art.run_id = rr AND art.decision = 'APPROVED' AND art.stroke_count > 0
    ORDER BY
      ro.group_id,
      (SELECT count(*) FROM game.piece_votes WHERE run_id = rr AND vote_type = 'INTERNAL' AND candidate_id = art.id) DESC,
      art.first_at,
      art.id
  ) nominee;
END $$;

-- ============================================================================
-- Deterministic State Machine Reconciliation
-- ============================================================================

CREATE OR REPLACE FUNCTION game.piece_reconcile(p_run uuid) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  r game.runs;
  state game.piece_run_state;
  n timestamptz;
BEGIN
  SELECT * INTO r FROM game.runs WHERE id = p_run FOR UPDATE;
  IF r.id IS NULL OR r.game_id <> 'missing-piece' THEN RETURN; END IF;
  IF r.status <> 'RUNNING' OR r.paused THEN RETURN; END IF;

  SELECT * INTO state FROM game.piece_run_state WHERE run_id = p_run FOR UPDATE;
  n := clock_timestamp();

  -- COUNTDOWN (3s) -> DRAWING (20s)
  IF r.phase = 'COUNTDOWN' AND n >= r.deadline THEN
    UPDATE game.runs
    SET phase = 'DRAWING',
        phase_start = n,
        deadline = n + interval '20 seconds',
        phase_token = gen_random_uuid(),
        version = version + 1
    WHERE id = p_run;

    UPDATE game.piece_run_state
    SET current_phase = 'DRAWING',
        phase_start = n,
        drawing_start = n,
        deadline = n + interval '20 seconds'
    WHERE run_id = p_run;
    RETURN;
  END IF;

  -- DRAWING (20s) -> REVIEW_REQUIRED (Lock strokes & wait for host moderation)
  IF r.phase = 'DRAWING' AND n >= r.deadline THEN
    -- Lock all artworks with their current revision
    UPDATE game.piece_artworks
    SET locked_revision = revision,
        locked_at = n,
        submitted = true
    WHERE run_id = p_run AND locked_revision IS NULL;

    UPDATE game.runs
    SET phase = 'REVIEW_REQUIRED',
        phase_start = n,
        deadline = NULL,
        phase_token = gen_random_uuid(),
        version = version + 1
    WHERE id = p_run;

    UPDATE game.piece_run_state
    SET current_phase = 'REVIEW_REQUIRED',
        phase_start = n,
        deadline = NULL
    WHERE run_id = p_run;
    RETURN;
  END IF;
END $$;

-- ============================================================================
-- Command Handler for Missing Piece
-- ============================================================================

CREATE OR REPLACE FUNCTION game.piece_apply_command(a uuid, c text, k text, p jsonb) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE
  room game.rooms;
  actor game.actors;
  r game.runs;
  ro game.rosters;
  state game.piece_run_state;
  v_my_art game.piece_artworks;
  cand game.piece_candidates;
  n timestamptz;
  unready int;
  rr uuid;
  v_strokes jsonb;
  v_scount int;
  v_pcount int;
  v_rev int;
  v_target_art uuid;
  v_dec text;
  v_cand_id uuid;
  v_cand_group int;
  v_reviewed_ids uuid[];
BEGIN
  SELECT * INTO actor FROM game.actors WHERE id = a;
  IF actor.id IS NULL THEN RAISE EXCEPTION 'UNAUTHORIZED'; END IF;

  SELECT * INTO room FROM game.rooms WHERE code = c;
  IF room.code IS NULL THEN RAISE EXCEPTION 'ROOM_NOT_FOUND'; END IF;

  n := clock_timestamp();

  -- Host start command on cue 14.01
  IF k = 'start' THEN
    IF actor.role <> 'host' OR room.host_id <> a THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
    IF room.active_run IS NOT NULL THEN RAISE EXCEPTION 'RUN_ACTIVE'; END IF;
    IF room.cue = '14.01' THEN
      IF room.controller_id IS DISTINCT FROM (p->>'controllerId') THEN RAISE EXCEPTION 'CONTROLLER_MISMATCH'; END IF;
      IF room.lease_until IS NULL OR n > room.lease_until THEN RAISE EXCEPTION 'LEASE_EXPIRED'; END IF;
      IF room.controller_epoch IS DISTINCT FROM (p->>'controllerEpoch')::int THEN RAISE EXCEPTION 'EPOCH_MISMATCH'; END IF;
      IF room.version IS DISTINCT FROM (p->>'expectedVersion')::int THEN RAISE EXCEPTION 'VERSION_MISMATCH'; END IF;
      IF room.practice_until > n THEN RAISE EXCEPTION 'PRACTICE_ACTIVE'; END IF;

      IF NOT EXISTS (SELECT 1 FROM game.piece_content WHERE version = 'piece-v1') THEN
        RAISE EXCEPTION 'CONTENT_INVALID';
      END IF;

      INSERT INTO game.runs(room_code, game_id, content_version, scoring_version, schedule_version, timing_profile, phase_start, deadline)
      VALUES(c, 'missing-piece', 'piece-v1', 'piece-1000-v1', 'piece-180-v1', coalesce(p->>'timingProfile', 'normal'), n, n + interval '3 seconds')
      RETURNING * INTO r;

      INSERT INTO game.rosters SELECT r.id, id, actor_id, group_id, nickname, side FROM game.members WHERE room_code = c AND active;
      INSERT INTO game.player_states(run_id, member_id) SELECT r.id, member_id FROM game.rosters WHERE run_id = r.id;

      INSERT INTO game.piece_run_state(run_id, current_phase, phase_start, drawing_start, deadline)
      VALUES(r.id, 'COUNTDOWN', n, NULL, n + interval '3 seconds');

      SELECT count(*)::int INTO unready FROM game.members
      WHERE room_code = c AND active AND (ready_preview IS DISTINCT FROM room.preview_id OR ready_version IS DISTINCT FROM r.content_version);

      UPDATE game.rooms SET active_run = r.id, latest_run = r.id, team_locked = true, version = version + 1, practice_until = NULL WHERE code = c;
      RETURN jsonb_build_object('runId', r.id, 'unready', unready);
    END IF;
    RETURN game.apply_base_command(a, c, k, p);
  END IF;

  -- Player drawing submission (incremental stroke updates during DRAWING)
  IF k = 'piece-stroke' THEN
    IF actor.role <> 'player' THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
    rr := (p->>'runId')::uuid;
    PERFORM game.piece_reconcile(rr);
    PERFORM pg_advisory_xact_lock(hashtextextended('run:'||rr, 0));

    SELECT * INTO r FROM game.runs WHERE id = rr AND room_code = c FOR UPDATE;
    IF r.id IS NULL OR r.game_id <> 'missing-piece' OR room.active_run IS DISTINCT FROM rr THEN
      RAISE EXCEPTION 'RUN_NOT_FOUND';
    END IF;
    IF r.status <> 'RUNNING' OR r.paused OR r.phase <> 'DRAWING' THEN RAISE EXCEPTION 'INPUT_CLOSED'; END IF;
    IF (p->>'phaseToken')::uuid IS DISTINCT FROM r.phase_token THEN RAISE EXCEPTION 'STALE_PHASE'; END IF;
    IF r.deadline IS NULL OR n < r.phase_start OR n >= r.deadline THEN RAISE EXCEPTION 'INPUT_CLOSED'; END IF;

    SELECT * INTO ro FROM game.rosters WHERE run_id = rr AND actor_id = a;
    IF ro.member_id IS NULL THEN RAISE EXCEPTION 'NOT_IN_ROSTER'; END IF;

    v_strokes := p->'strokes';
    IF jsonb_typeof(v_strokes) <> 'array' THEN RAISE EXCEPTION 'INVALID_STROKES'; END IF;
    v_scount := jsonb_array_length(v_strokes);
    IF v_scount > 100 THEN RAISE EXCEPTION 'STROKE_LIMIT_EXCEEDED'; END IF;

    v_rev := (p->>'revision')::int;
    IF v_rev <= 0 THEN RAISE EXCEPTION 'INVALID_REVISION'; END IF;

    SELECT * INTO v_my_art FROM game.piece_artworks WHERE run_id = rr AND member_id = ro.member_id;
    IF v_my_art.id IS NOT NULL AND v_my_art.locked_revision IS NOT NULL THEN
      RAISE EXCEPTION 'ARTWORK_LOCKED';
    END IF;
    IF v_my_art.id IS NOT NULL AND v_rev <= v_my_art.revision THEN
      RETURN jsonb_build_object('accepted', true, 'duplicate', true, 'revision', v_my_art.revision);
    END IF;

    INSERT INTO game.piece_artworks(run_id, member_id, strokes, stroke_count, point_count, revision, first_at, updated_at)
    VALUES(rr, ro.member_id, v_strokes, v_scount, 0, v_rev, n, n)
    ON CONFLICT (run_id, member_id) DO UPDATE SET
      strokes = EXCLUDED.strokes,
      stroke_count = EXCLUDED.stroke_count,
      revision = EXCLUDED.revision,
      updated_at = n;

    UPDATE game.runs SET version = version + 1 WHERE id = rr;
    RETURN jsonb_build_object('accepted', true, 'revision', v_rev, 'strokeCount', v_scount);
  END IF;

  -- Player finish early command
  IF k = 'piece-finish-early' THEN
    IF actor.role <> 'player' THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
    rr := (p->>'runId')::uuid;
    SELECT * INTO r FROM game.runs WHERE id = rr AND room_code = c;
    IF r.id IS NULL OR r.game_id <> 'missing-piece' THEN RAISE EXCEPTION 'RUN_NOT_FOUND'; END IF;
    SELECT * INTO ro FROM game.rosters WHERE run_id = rr AND actor_id = a;
    IF ro.member_id IS NULL THEN RAISE EXCEPTION 'NOT_IN_ROSTER'; END IF;

    UPDATE game.piece_artworks
    SET locked_revision = revision,
        locked_at = n,
        submitted = true
    WHERE run_id = rr AND member_id = ro.member_id AND locked_revision IS NULL;

    RETURN jsonb_build_object('accepted', true, 'finished', true);
  END IF;

  -- Host moderation command: approve or reject an artwork
  IF k = 'piece-moderation' THEN
    IF actor.role <> 'host' OR room.host_id <> a THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
    rr := (p->>'runId')::uuid;
    SELECT * INTO r FROM game.runs WHERE id = rr AND room_code = c FOR UPDATE;
    IF r.id IS NULL OR r.game_id <> 'missing-piece' THEN RAISE EXCEPTION 'RUN_NOT_FOUND'; END IF;

    v_target_art := (p->>'artworkId')::uuid;
    v_dec := p->>'decision';
    IF v_dec NOT IN ('APPROVED', 'REJECTED', 'WITHHELD') THEN RAISE EXCEPTION 'INVALID_DECISION'; END IF;

    UPDATE game.piece_artworks
    SET decision = v_dec,
        reason = p->>'reason',
        reviewer = a,
        reviewed_revision = coalesce(locked_revision, revision),
        review_version = review_version + 1
    WHERE run_id = rr AND id = v_target_art;

    UPDATE game.runs SET version = version + 1 WHERE id = rr;
    RETURN jsonb_build_object('accepted', true, 'artworkId', v_target_art, 'decision', v_dec);
  END IF;

  -- Host approve all valid artworks
  IF k = 'piece-approve-all' THEN
    IF actor.role <> 'host' OR room.host_id <> a THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
    rr := (p->>'runId')::uuid;
    SELECT * INTO r FROM game.runs WHERE id = rr AND room_code = c FOR UPDATE;
    IF r.id IS NULL OR r.game_id <> 'missing-piece' THEN RAISE EXCEPTION 'RUN_NOT_FOUND'; END IF;

    SELECT coalesce(array_agg(value::uuid), '{}'::uuid[])
    INTO v_reviewed_ids
    FROM jsonb_array_elements_text(coalesce(p->'reviewedArtworkIds', '[]'::jsonb)) AS ids(value);

    IF EXISTS (
      SELECT 1 FROM game.piece_artworks art
      WHERE art.run_id = rr AND art.decision = 'PENDING' AND art.stroke_count > 0
        AND NOT (art.id = ANY(v_reviewed_ids))
    ) OR EXISTS (
      SELECT 1 FROM unnest(v_reviewed_ids) reviewed(id)
      WHERE NOT EXISTS (
        SELECT 1 FROM game.piece_artworks art
        WHERE art.id = reviewed.id AND art.run_id = rr AND art.decision = 'PENDING' AND art.stroke_count > 0
      )
    ) THEN
      RAISE EXCEPTION 'UNREVIEWED_ARTWORKS';
    END IF;

    UPDATE game.piece_artworks
    SET decision = 'APPROVED',
        reviewer = a,
        reviewed_revision = coalesce(locked_revision, revision),
        review_version = review_version + 1
    WHERE run_id = rr AND decision = 'PENDING' AND stroke_count > 0 AND id = ANY(v_reviewed_ids);

    UPDATE game.runs SET version = version + 1 WHERE id = rr;
    RETURN jsonb_build_object('accepted', true, 'approvedAll', true);
  END IF;

  -- Host opens internal group voting (15s)
  IF k = 'piece-open-internal-vote' THEN
    IF actor.role <> 'host' OR room.host_id <> a THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
    rr := (p->>'runId')::uuid;
    SELECT * INTO r FROM game.runs WHERE id = rr AND room_code = c FOR UPDATE;
    IF r.id IS NULL OR r.game_id <> 'missing-piece' THEN RAISE EXCEPTION 'RUN_NOT_FOUND'; END IF;

    IF EXISTS (
      SELECT 1 FROM game.piece_artworks
      WHERE run_id = rr AND decision = 'PENDING' AND stroke_count > 0
    ) THEN
      RAISE EXCEPTION 'PENDING_REVIEW';
    END IF;

    UPDATE game.runs
    SET phase = 'INTERNAL_VOTE',
        phase_start = n,
        deadline = n + interval '15 seconds',
        phase_token = gen_random_uuid(),
        version = version + 1
    WHERE id = rr;

    UPDATE game.piece_run_state
    SET current_phase = 'INTERNAL_VOTE',
        phase_start = n,
        deadline = n + interval '15 seconds'
    WHERE run_id = rr;

    RETURN jsonb_build_object('accepted', true, 'phase', 'INTERNAL_VOTE');
  END IF;

  -- Player votes for group artwork during INTERNAL_VOTE
  IF k = 'piece-internal-vote' THEN
    IF actor.role <> 'player' THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
    rr := (p->>'runId')::uuid;
    SELECT * INTO r FROM game.runs WHERE id = rr AND room_code = c;
    IF r.id IS NULL OR r.game_id <> 'missing-piece' THEN RAISE EXCEPTION 'RUN_NOT_FOUND'; END IF;
    IF r.status <> 'RUNNING' OR r.phase <> 'INTERNAL_VOTE' THEN RAISE EXCEPTION 'INPUT_CLOSED'; END IF;

    SELECT * INTO ro FROM game.rosters WHERE run_id = rr AND actor_id = a;
    IF ro.member_id IS NULL THEN RAISE EXCEPTION 'NOT_IN_ROSTER'; END IF;

    v_target_art := (p->>'candidateId')::uuid;
    -- Verify target artwork is approved and belongs to the voter's own group
    IF NOT EXISTS (
      SELECT 1 FROM game.piece_artworks target_art
      JOIN game.rosters cand_ro ON cand_ro.run_id = target_art.run_id AND cand_ro.member_id = target_art.member_id
      WHERE target_art.id = v_target_art AND target_art.run_id = rr AND target_art.decision = 'APPROVED' AND cand_ro.group_id = ro.group_id
    ) THEN
      RAISE EXCEPTION 'CANDIDATE_INVALID';
    END IF;

    INSERT INTO game.piece_votes(run_id, member_id, vote_type, candidate_id, revision, accepted_at)
    VALUES(rr, ro.member_id, 'INTERNAL', v_target_art, (p->>'revision')::int, n)
    ON CONFLICT (run_id, member_id, vote_type) DO UPDATE SET
      candidate_id = EXCLUDED.candidate_id,
      revision = EXCLUDED.revision,
      accepted_at = n;

    UPDATE game.runs SET version = version + 1 WHERE id = rr;
    RETURN jsonb_build_object('accepted', true, 'candidateId', v_target_art);
  END IF;

  -- Host advances from internal vote to FINAL_VOTE (20s)
  IF k = 'piece-open-final-vote' THEN
    IF actor.role <> 'host' OR room.host_id <> a THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
    rr := (p->>'runId')::uuid;
    SELECT * INTO r FROM game.runs WHERE id = rr AND room_code = c FOR UPDATE;
    IF r.id IS NULL OR r.game_id <> 'missing-piece' THEN RAISE EXCEPTION 'RUN_NOT_FOUND'; END IF;

    -- Nominate top candidate for each group
    PERFORM game.piece_nominate(rr);

    UPDATE game.runs
    SET phase = 'FINAL_VOTE',
        phase_start = n,
        deadline = n + interval '20 seconds',
        phase_token = gen_random_uuid(),
        version = version + 1
    WHERE id = rr;

    UPDATE game.piece_run_state
    SET current_phase = 'FINAL_VOTE',
        phase_start = n,
        deadline = n + interval '20 seconds'
    WHERE run_id = rr;

    RETURN jsonb_build_object('accepted', true, 'phase', 'FINAL_VOTE');
  END IF;

  -- Player votes for final candidate (strictly from ANOTHER group)
  IF k = 'piece-final-vote' THEN
    IF actor.role <> 'player' THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
    rr := (p->>'runId')::uuid;
    SELECT * INTO r FROM game.runs WHERE id = rr AND room_code = c;
    IF r.id IS NULL OR r.game_id <> 'missing-piece' THEN RAISE EXCEPTION 'RUN_NOT_FOUND'; END IF;
    IF r.status <> 'RUNNING' OR r.phase <> 'FINAL_VOTE' THEN RAISE EXCEPTION 'INPUT_CLOSED'; END IF;

    SELECT * INTO ro FROM game.rosters WHERE run_id = rr AND actor_id = a;
    IF ro.member_id IS NULL THEN RAISE EXCEPTION 'NOT_IN_ROSTER'; END IF;

    v_cand_id := (p->>'candidateId')::uuid;
    SELECT * INTO cand FROM game.piece_candidates WHERE run_id = rr AND id = v_cand_id;
    IF cand.id IS NULL THEN RAISE EXCEPTION 'CANDIDATE_INVALID'; END IF;

    -- STRICT RULE: Players CANNOT vote for their own group candidate!
    IF cand.group_id IS NOT NULL AND cand.group_id = ro.group_id THEN
      RAISE EXCEPTION 'OWN_GROUP';
    END IF;

    INSERT INTO game.piece_votes(run_id, member_id, vote_type, candidate_id, revision, accepted_at)
    VALUES(rr, ro.member_id, 'FINAL', v_cand_id, (p->>'revision')::int, n)
    ON CONFLICT (run_id, member_id, vote_type) DO UPDATE SET
      candidate_id = EXCLUDED.candidate_id,
      revision = EXCLUDED.revision,
      accepted_at = n;

    UPDATE game.runs SET version = version + 1 WHERE id = rr;
    RETURN jsonb_build_object('accepted', true, 'candidateId', v_cand_id);
  END IF;

  -- Host reveals results
  IF k = 'piece-reveal' THEN
    IF actor.role <> 'host' OR room.host_id <> a THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
    rr := (p->>'runId')::uuid;
    SELECT * INTO r FROM game.runs WHERE id = rr AND room_code = c FOR UPDATE;
    IF r.id IS NULL OR r.game_id <> 'missing-piece' THEN RAISE EXCEPTION 'RUN_NOT_FOUND'; END IF;

    UPDATE game.runs
    SET status = 'RESULT',
        phase = 'RESULT',
        phase_start = n,
        deadline = NULL,
        phase_token = gen_random_uuid(),
        input_digest = game.piece_digest(rr),
        version = version + 1
    WHERE id = rr;

    UPDATE game.piece_run_state
    SET current_phase = 'RESULT',
        phase_start = n,
        deadline = NULL
    WHERE run_id = rr;

    RETURN jsonb_build_object('accepted', true, 'revealed', true);
  END IF;

  RETURN game.apply_base_command(a, c, k, p);
END $$;

-- ============================================================================
-- Snapshot Generator for Game 7
-- ============================================================================

CREATE OR REPLACE FUNCTION game.piece_snapshot(a uuid, c text, actor_role text, p_run uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE AS $$
DECLARE
  v_run game.runs;
  v_content game.piece_content;
  v_roster game.rosters;
  v_art game.piece_artworks;
  v_internal_artworks jsonb := '[]'::jsonb;
  v_candidates jsonb := '[]'::jsonb;
  v_results jsonb := '[]'::jsonb;
  v_my_artwork jsonb := NULL;
  v_my_internal_vote uuid := NULL;
  v_my_final_vote uuid := NULL;
  v_moderation_queue jsonb := '[]'::jsonb;
  v_phase text := 'PREVIEW';
  v_pending_count int := 0;
  v_approved_count int := 0;
  v_total_submitted int := 0;
BEGIN
  SELECT * INTO v_content FROM game.piece_content WHERE version = 'piece-v1';

  IF p_run IS NOT NULL THEN
    SELECT * INTO v_run FROM game.runs WHERE id = p_run AND game_id = 'missing-piece';
    IF v_run.id IS NOT NULL THEN
      v_phase := v_run.phase;
    END IF;
  END IF;

  -- Load user-specific artwork and votes if player
  IF actor_role = 'player' AND p_run IS NOT NULL THEN
    SELECT * INTO v_roster FROM game.rosters WHERE run_id = p_run AND actor_id = a;
    IF v_roster.member_id IS NOT NULL THEN
      SELECT * INTO v_art FROM game.piece_artworks WHERE run_id = p_run AND member_id = v_roster.member_id;
      IF v_art.id IS NOT NULL THEN
        v_my_artwork := jsonb_build_object(
          'id', v_art.id,
          'strokes', v_art.strokes,
          'strokeCount', v_art.stroke_count,
          'revision', v_art.revision,
          'lockedRevision', v_art.locked_revision,
          'decision', v_art.decision
        );
      END IF;

      SELECT candidate_id INTO v_my_internal_vote
      FROM game.piece_votes
      WHERE run_id = p_run AND member_id = v_roster.member_id AND vote_type = 'INTERNAL';

      SELECT candidate_id INTO v_my_final_vote
      FROM game.piece_votes
      WHERE run_id = p_run AND member_id = v_roster.member_id AND vote_type = 'FINAL';

      -- Internal group artworks for voting
      IF v_phase IN ('INTERNAL_VOTE', 'FINAL_VOTE', 'RESULT') THEN
        SELECT coalesce(jsonb_agg(jsonb_build_object(
          'id', art.id,
          'strokes', art.strokes,
          'strokeCount', art.stroke_count,
          'author', ro.nickname,
          'isMe', (art.member_id = v_roster.member_id)
        ) ORDER BY art.first_at), '[]'::jsonb) INTO v_internal_artworks
        FROM game.piece_artworks art
        JOIN game.rosters ro ON ro.run_id = art.run_id AND ro.member_id = art.member_id
        WHERE art.run_id = p_run AND ro.group_id = v_roster.group_id AND art.decision = 'APPROVED' AND art.stroke_count > 0;
      END IF;
    END IF;
  END IF;

  -- Host moderation queue
  IF actor_role = 'host' AND p_run IS NOT NULL THEN
    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'id', art.id,
      'memberId', art.member_id,
      'author', ro.nickname,
      'groupId', ro.group_id,
      'strokes', art.strokes,
      'strokeCount', art.stroke_count,
      'revision', art.revision,
      'lockedRevision', art.locked_revision,
      'decision', art.decision,
      'reason', art.reason
    ) ORDER BY ro.group_id, art.first_at), '[]'::jsonb) INTO v_moderation_queue
    FROM game.piece_artworks art
    JOIN game.rosters ro ON ro.run_id = art.run_id AND ro.member_id = art.member_id
    WHERE art.run_id = p_run;
  END IF;

  -- Moderation statistics (available to host and display for tracking progress)
  IF p_run IS NOT NULL THEN
    SELECT count(*) FILTER (WHERE decision = 'PENDING')::int,
           count(*) FILTER (WHERE decision = 'APPROVED')::int,
           count(*)::int
    INTO v_pending_count, v_approved_count, v_total_submitted
    FROM game.piece_artworks
    WHERE run_id = p_run;
  END IF;

  -- Final voting candidates (Anonymous A..F)
  IF v_phase IN ('FINAL_VOTE', 'RESULT') AND p_run IS NOT NULL THEN
    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'id', cand.id,
      'position', cand.position,
      'groupId', cand.group_id,
      'strokes', art.strokes,
      'artworkId', cand.artwork_id
    ) ORDER BY cand.position), '[]'::jsonb) INTO v_candidates
    FROM game.piece_candidates cand
    JOIN game.piece_artworks art ON art.id = cand.artwork_id
    WHERE cand.run_id = p_run;
  END IF;

  -- Results breakdown
  IF v_phase = 'RESULT' AND p_run IS NOT NULL THEN
    v_results := game.piece_results(p_run);
  END IF;

  RETURN jsonb_build_object(
    'version', coalesce(v_content.version, 'piece-v1'),
    'prompt', coalesce(v_content.prompt, 'เติมปีกให้สิ่งประดิษฐ์นี้พร้อมออกเดินทางในแบบของคุณ'),
    'task', coalesce(v_content.task, ''),
    'baseAssetId', coalesce(v_content.base_asset_id, 'piece-asset-01'),
    'baseSvg', coalesce(v_content.base_svg, ''),
    'metadata', coalesce(v_content.base_metadata, '{}'::jsonb),
    'phase', v_phase,
    'myArtwork', v_my_artwork,
    'myInternalVote', v_my_internal_vote,
    'myFinalVote', v_my_final_vote,
    'internalArtworks', v_internal_artworks,
    'candidates', v_candidates,
    'results', v_results,
    'moderation', v_moderation_queue,
    'moderationStats', jsonb_build_object(
      'pending', v_pending_count,
      'approved', v_approved_count,
      'submitted', v_total_submitted
    )
  );
END $$;

-- ============================================================================
-- Master Router Overrides
-- ============================================================================

CREATE OR REPLACE FUNCTION game.apply_command(a uuid, c text, k text, p jsonb) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE room game.rooms;
BEGIN
  SELECT * INTO room FROM game.rooms WHERE code=c;
  IF k IN ('piece-stroke','piece-finish-early','piece-moderation','piece-approve-all','piece-open-internal-vote','piece-open-final-vote','piece-internal-vote','piece-final-vote','piece-reveal') OR (k='start' AND room.cue='14.01') THEN
    RETURN game.piece_apply_command(a, c, k, p);
  ELSIF k IN ('shield-move') OR (k='start' AND room.cue='11.02') THEN
    RETURN game.shield_apply_command(a, c, k, p);
  ELSIF k IN ('whack-hit') OR (k='start' AND room.cue='10.02') THEN
    RETURN game.whack_apply_command(a, c, k, p);
  ELSIF k IN ('roulette-decision') OR (k='start' AND room.cue='07.01') THEN
    RETURN game.roulette_apply_command(a, c, k, p);
  ELSIF k IN ('caption','moderation','internal-vote','final-vote','caption-content-approve','caption-open-vote') OR (k='start' AND room.cue='04.01') THEN
    RETURN game.caption_apply_command(a, c, k, p);
  ELSE
    RETURN game.apply_base_command(a, c, k, p);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION game.reconcile(p_run uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF (SELECT game_id FROM game.runs WHERE id = p_run) = 'missing-piece' THEN
    PERFORM game.piece_reconcile(p_run);
    RETURN;
  END IF;
  IF (SELECT game_id FROM game.runs WHERE id = p_run) = 'company-shield' THEN
    PERFORM game.shield_reconcile(p_run);
    RETURN;
  END IF;
  IF (SELECT game_id FROM game.runs WHERE id = p_run) = 'chat-whack-a-mole' THEN
    PERFORM game.whack_reconcile(p_run);
    RETURN;
  END IF;
  IF (SELECT game_id FROM game.runs WHERE id = p_run) = 'confidence-roulette' THEN
    PERFORM game.roulette_reconcile(p_run);
    RETURN;
  END IF;
  IF (SELECT game_id FROM game.runs WHERE id = p_run) = 'caption-battle' THEN
    PERFORM game.caption_reconcile(p_run);
    RETURN;
  END IF;
  PERFORM game.reconcile_base(p_run);
END $$;

CREATE OR REPLACE FUNCTION game.digest(p_run uuid) RETURNS text LANGUAGE sql STABLE AS $$
  SELECT CASE
    WHEN (SELECT game_id FROM game.runs WHERE id = p_run) = 'missing-piece' THEN game.piece_digest(p_run)
    WHEN (SELECT game_id FROM game.runs WHERE id = p_run) = 'company-shield' THEN game.shield_digest(p_run)
    WHEN (SELECT game_id FROM game.runs WHERE id = p_run) = 'chat-whack-a-mole' THEN game.whack_digest(p_run)
    WHEN (SELECT game_id FROM game.runs WHERE id = p_run) = 'confidence-roulette' THEN game.roulette_digest(p_run)
    WHEN (SELECT game_id FROM game.runs WHERE id = p_run) = 'caption-battle' THEN game.caption_digest(p_run)
    ELSE game.digest_base(p_run)
  END;
$$;

CREATE OR REPLACE FUNCTION game.scores(p_run uuid) RETURNS jsonb LANGUAGE plpgsql STABLE AS $$
BEGIN
  IF (SELECT game_id FROM game.runs WHERE id = p_run) = 'missing-piece' THEN
    RETURN game.piece_scores(p_run);
  END IF;
  IF (SELECT game_id FROM game.runs WHERE id = p_run) = 'company-shield' THEN
    RETURN game.shield_scores(p_run);
  END IF;
  IF (SELECT game_id FROM game.runs WHERE id = p_run) = 'chat-whack-a-mole' THEN
    RETURN game.whack_scores(p_run);
  END IF;
  IF (SELECT game_id FROM game.runs WHERE id = p_run) = 'confidence-roulette' THEN
    RETURN game.roulette_scores(p_run);
  END IF;
  IF (SELECT game_id FROM game.runs WHERE id = p_run) = 'caption-battle' THEN
    RETURN game.caption_scores(p_run);
  END IF;
  RETURN game.scores_base(p_run);
END $$;

CREATE OR REPLACE FUNCTION game.snapshot(a uuid, c text) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE
  result jsonb;
  data jsonb;
BEGIN
  result := game.snapshot_base(a, c);
  IF result->>'ok'<>'true' THEN RETURN result; END IF;
  data := result->'data';

  IF data->'room'->>'cue' = '04.01' OR data->'run'->>'gameId' = 'caption-battle' THEN
    data := data || jsonb_build_object('caption', game.caption_snapshot(a, c, data->>'role', (data->'run'->>'id')::uuid));
  END IF;

  IF data->'room'->>'cue' = '07.01' OR data->'run'->>'gameId' = 'confidence-roulette' THEN
    data := data || jsonb_build_object('roulette', game.roulette_snapshot(a, c, data->>'role', (data->'run'->>'id')::uuid));
  END IF;

  IF data->'room'->>'cue' = '10.02' OR data->'run'->>'gameId' = 'chat-whack-a-mole' THEN
    data := data || jsonb_build_object('whack', game.whack_snapshot(a, c, data->>'role', (data->'run'->>'id')::uuid));
  END IF;

  IF data->'room'->>'cue' = '11.02' OR data->'run'->>'gameId' = 'company-shield' THEN
    data := data || jsonb_build_object('shield', game.shield_snapshot(a, c, data->>'role', (data->'run'->>'id')::uuid));
  END IF;

  IF data->'room'->>'cue' = '14.01' OR data->'run'->>'gameId' = 'missing-piece' THEN
    data := data || jsonb_build_object('piece', game.piece_snapshot(a, c, data->>'role', (data->'run'->>'id')::uuid));
  END IF;

  RETURN jsonb_build_object('ok', true, 'data', data);
END $$;
