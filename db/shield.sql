-- Game 6: Company Shield (company-shield) extension.
-- Built with the same audit trail, controller lease, roster freeze,
-- pause-safe clock, privacy fence, and server authority as the other games.

CREATE TABLE IF NOT EXISTS game.shield_packets (
  version text NOT NULL,
  packet_id text NOT NULL,
  packet_no int NOT NULL,
  aim_at_sec numeric NOT NULL,
  rail_at_sec numeric NOT NULL,
  customer_at_sec numeric NOT NULL,
  target_lane int NOT NULL CHECK(target_lane >= 0 AND target_lane <= 2),
  bot_claim text NOT NULL,
  company_task text NOT NULL,
  customer_name text NOT NULL,
  PRIMARY KEY(version, packet_id)
);

CREATE TABLE IF NOT EXISTS game.shield_run_state (
  run_id uuid PRIMARY KEY REFERENCES game.runs,
  current_phase text NOT NULL DEFAULT 'COUNTDOWN',
  phase_start timestamptz NOT NULL,
  arcade_start timestamptz,
  deadline timestamptz
);

CREATE TABLE IF NOT EXISTS game.shield_player_states (
  run_id uuid NOT NULL,
  member_id uuid NOT NULL,
  current_lane int NOT NULL DEFAULT 1 CHECK(current_lane >= 0 AND current_lane <= 2),
  normalized_x numeric NOT NULL DEFAULT 0.5 CHECK(normalized_x >= 0.0 AND normalized_x <= 1.0),
  blocked_count int NOT NULL DEFAULT 0,
  missed_count int NOT NULL DEFAULT 0,
  score int NOT NULL DEFAULT 0,
  PRIMARY KEY(run_id, member_id),
  FOREIGN KEY(run_id, member_id) REFERENCES game.rosters
);

CREATE TABLE IF NOT EXISTS game.shield_moves (
  run_id uuid NOT NULL,
  member_id uuid NOT NULL,
  move_at timestamptz NOT NULL,
  elapsed_sec numeric NOT NULL,
  lane int NOT NULL CHECK(lane >= 0 AND lane <= 2),
  normalized_x numeric NOT NULL CHECK(normalized_x >= 0.0 AND normalized_x <= 1.0),
  client_time_ms bigint NOT NULL,
  FOREIGN KEY(run_id, member_id) REFERENCES game.rosters
);

CREATE TABLE IF NOT EXISTS game.shield_intercepts (
  run_id uuid NOT NULL,
  member_id uuid NOT NULL,
  packet_id text NOT NULL,
  status text NOT NULL CHECK(status IN ('BLOCKED', 'MISSED')),
  lane int NOT NULL CHECK(lane >= 0 AND lane <= 2),
  evaluated_at timestamptz NOT NULL,
  points int NOT NULL DEFAULT 0,
  PRIMARY KEY(run_id, member_id, packet_id),
  FOREIGN KEY(run_id, member_id) REFERENCES game.rosters
);

ALTER TABLE game.shield_packets ENABLE ROW LEVEL SECURITY;
ALTER TABLE game.shield_run_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE game.shield_player_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE game.shield_moves ENABLE ROW LEVEL SECURITY;
ALTER TABLE game.shield_intercepts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA game FROM PUBLIC;

-- Cryptographic digest of all shield intercepts and player scores.
CREATE OR REPLACE FUNCTION game.shield_digest(p_run uuid) RETURNS text LANGUAGE sql STABLE AS $$
  SELECT md5(
    coalesce((SELECT string_agg(member_id::text||':'||packet_id||':'||status||':'||lane||':'||to_char(evaluated_at,'YYYY-MM-DD"T"HH24:MI:SS.US'), ',' ORDER BY member_id, packet_id) FROM game.shield_intercepts WHERE run_id=p_run),'')
    || '|' ||
    coalesce((SELECT string_agg(member_id::text||':'||blocked_count||':'||missed_count||':'||score, ',' ORDER BY member_id) FROM game.shield_player_states WHERE run_id=p_run),'')
  );
$$;

-- Aggregate group scores for Game 6.
-- Average = Sum(scores) / Total roster members in group (including members with 0).
CREATE OR REPLACE FUNCTION game.shield_scores(p_run uuid) RETURNS jsonb LANGUAGE plpgsql STABLE AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_agg(jsonb_build_object(
    'id', g.id,
    'name', g.name,
    'numerator', coalesce((SELECT sum(ps.score)::int FROM game.shield_player_states ps JOIN game.rosters rst ON rst.run_id=ps.run_id AND rst.member_id=ps.member_id WHERE ps.run_id=p_run AND rst.group_id=g.id), 0),
    'denominator', (SELECT count(*)::int FROM game.rosters WHERE run_id=p_run AND group_id=g.id)
  ) ORDER BY g.id) INTO result
  FROM game.groups g WHERE room_code=(SELECT room_code FROM game.runs WHERE id=p_run);
  RETURN coalesce(result, '[]'::jsonb);
END $$;

-- Evaluate packets that have reached or passed rail_at_sec for all players in roster.
CREATE OR REPLACE FUNCTION game.shield_evaluate_packets(p_run uuid) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  r game.runs;
  p record;
  ro record;
  v_lane int;
  n timestamptz;
  v_elapsed numeric;
  v_status text;
  v_points int;
BEGIN
  SELECT * INTO r FROM game.runs WHERE id=p_run;
  IF r.id IS NULL OR r.game_id<>'company-shield' THEN RETURN; END IF;

  n := clock_timestamp();
  IF r.deadline IS NULL THEN
    v_elapsed := 25.0;
  ELSE
    v_elapsed := 25.0 - (extract(epoch from (r.deadline - n)));
  END IF;

  -- Process all non-practice packets whose rail_at_sec has passed
  FOR p IN
    SELECT * FROM game.shield_packets
    WHERE version=r.content_version AND packet_no > 0 AND rail_at_sec <= v_elapsed
    ORDER BY rail_at_sec ASC
  LOOP
    FOR ro IN SELECT * FROM game.rosters WHERE run_id=p_run LOOP
      -- If not already evaluated
      IF NOT EXISTS(SELECT 1 FROM game.shield_intercepts WHERE run_id=p_run AND member_id=ro.member_id AND packet_id=p.packet_id) THEN
        -- Find player's position at rail_at_sec (+ 0.35s grace window)
        SELECT lane INTO v_lane
        FROM game.shield_moves
        WHERE run_id=p_run AND member_id=ro.member_id AND elapsed_sec <= (p.rail_at_sec + 0.35)
        ORDER BY elapsed_sec DESC, move_at DESC
        LIMIT 1;

        -- If no move was recorded before or at that point, default starting lane is Center (1)
        IF v_lane IS NULL THEN
          v_lane := 1;
        END IF;

        IF v_lane = p.target_lane THEN
          v_status := 'BLOCKED';
          v_points := 50;
        ELSE
          v_status := 'MISSED';
          v_points := 0;
        END IF;

        INSERT INTO game.shield_intercepts(run_id, member_id, packet_id, status, lane, evaluated_at, points)
        VALUES(p_run, ro.member_id, p.packet_id, v_status, v_lane, n, v_points)
        ON CONFLICT (run_id, member_id, packet_id) DO NOTHING;
      END IF;
    END LOOP;
  END LOOP;

  -- Recalculate player totals
  UPDATE game.shield_player_states sps
  SET blocked_count = (SELECT count(*)::int FROM game.shield_intercepts si WHERE si.run_id=p_run AND si.member_id=sps.member_id AND si.status='BLOCKED'),
      missed_count = (SELECT count(*)::int FROM game.shield_intercepts si WHERE si.run_id=p_run AND si.member_id=sps.member_id AND si.status='MISSED'),
      score = least(500, (SELECT coalesce(sum(points), 0)::int FROM game.shield_intercepts si WHERE si.run_id=p_run AND si.member_id=sps.member_id))
  WHERE sps.run_id=p_run;

  -- Update main player_states table
  UPDATE game.player_states ps
  SET accepted = sps.score
  FROM game.shield_player_states sps
  WHERE ps.run_id=p_run AND ps.member_id=sps.member_id;
END $$;

-- Advance Company Shield state machine deterministically based on server clock.
CREATE OR REPLACE FUNCTION game.shield_reconcile(p_run uuid) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  r game.runs;
  state game.shield_run_state;
  n timestamptz;
BEGIN
  SELECT * INTO r FROM game.runs WHERE id=p_run FOR UPDATE;
  IF r.id IS NULL OR r.game_id<>'company-shield' THEN RETURN; END IF;
  IF r.status<>'RUNNING' OR r.paused THEN RETURN; END IF;

  SELECT * INTO state FROM game.shield_run_state WHERE run_id=p_run FOR UPDATE;
  n := clock_timestamp();

  -- COUNTDOWN -> PLAYING (3 seconds countdown elapsed)
  IF r.phase='COUNTDOWN' AND n >= r.deadline THEN
    UPDATE game.runs
    SET phase='PLAYING',
        phase_start=n,
        deadline=n + interval '25 seconds',
        phase_token=gen_random_uuid(),
        version=version+1
    WHERE id=p_run;

    UPDATE game.shield_run_state
    SET current_phase='PLAYING',
        phase_start=n,
        arcade_start=n,
        deadline=n + interval '25 seconds'
    WHERE run_id=p_run;
    RETURN;
  END IF;

  -- PLAYING active progress: evaluate any reached packets
  IF r.phase='PLAYING' THEN
    PERFORM game.shield_evaluate_packets(p_run);

    -- PLAYING -> RESULT (25 seconds arcade play elapsed)
    IF n >= r.deadline THEN
      -- Final evaluation of all packets
      PERFORM game.shield_evaluate_packets(p_run);

      UPDATE game.runs
      SET status='RESULT',
          phase='RESULT',
          phase_start=n,
          deadline=NULL,
          phase_token=gen_random_uuid(),
          input_digest=game.shield_digest(p_run),
          version=version+1
      WHERE id=p_run;

      UPDATE game.shield_run_state
      SET current_phase='RESULT',
          phase_start=n,
          deadline=NULL
      WHERE run_id=p_run;
      RETURN;
    END IF;
  END IF;
END $$;

-- Handle Game 6 specific commands: 'start' on cue 11.02, and 'shield-move'
CREATE OR REPLACE FUNCTION game.shield_apply_command(a uuid, c text, k text, p jsonb) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE
  room game.rooms;
  actor game.actors;
  r game.runs;
  ro game.rosters;
  state game.shield_run_state;
  n timestamptz;
  unready int;
  rr uuid;
  elapsed_sec numeric;
  v_lane int;
  v_norm_x numeric;
BEGIN
  SELECT * INTO actor FROM game.actors WHERE id=a;
  IF actor.id IS NULL THEN RAISE EXCEPTION 'UNAUTHORIZED'; END IF;

  SELECT * INTO room FROM game.rooms WHERE code=c;
  IF room.code IS NULL THEN RAISE EXCEPTION 'ROOM_NOT_FOUND'; END IF;

  n := clock_timestamp();

  -- Host start command for Company Shield
  IF k = 'start' THEN
    IF actor.role<>'host' OR room.host_id<>a THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
    IF room.active_run IS NOT NULL THEN RAISE EXCEPTION 'RUN_ACTIVE'; END IF;
    IF room.cue = '11.02' THEN
      IF room.controller_id IS DISTINCT FROM (p->>'controllerId') THEN RAISE EXCEPTION 'CONTROLLER_MISMATCH'; END IF;
      IF room.lease_until IS NULL OR n > room.lease_until THEN RAISE EXCEPTION 'LEASE_EXPIRED'; END IF;
      IF room.controller_epoch IS DISTINCT FROM (p->>'controllerEpoch')::int THEN RAISE EXCEPTION 'EPOCH_MISMATCH'; END IF;
      IF room.version IS DISTINCT FROM (p->>'expectedVersion')::int THEN RAISE EXCEPTION 'VERSION_MISMATCH'; END IF;
      IF room.practice_until > n THEN RAISE EXCEPTION 'PRACTICE_ACTIVE'; END IF;

      IF (SELECT count(*) FROM game.shield_packets WHERE version='shield-v1' AND packet_no > 0) < 10 THEN
        RAISE EXCEPTION 'CONTENT_INVALID';
      END IF;

      INSERT INTO game.runs(room_code, game_id, content_version, scoring_version, schedule_version, timing_profile, phase_start, deadline)
      VALUES(c, 'company-shield', 'shield-v1', 'shield-500-v1', 'shield-10-25-v1', coalesce(p->>'timingProfile', 'normal'), n, n + interval '3 seconds')
      RETURNING * INTO r;

      INSERT INTO game.rosters SELECT r.id, id, actor_id, group_id, nickname, side FROM game.members WHERE room_code=c AND active;
      INSERT INTO game.player_states(run_id, member_id) SELECT r.id, member_id FROM game.rosters WHERE run_id=r.id;
      INSERT INTO game.shield_player_states(run_id, member_id, current_lane, normalized_x, blocked_count, missed_count, score)
        SELECT r.id, member_id, 1, 0.5, 0, 0, 0 FROM game.rosters WHERE run_id=r.id;
      INSERT INTO game.shield_run_state(run_id, current_phase, phase_start, arcade_start, deadline)
        VALUES(r.id, 'COUNTDOWN', n, NULL, n + interval '3 seconds');

      SELECT count(*)::int INTO unready FROM game.members
      WHERE room_code=c AND active AND (ready_preview IS DISTINCT FROM room.preview_id OR ready_version IS DISTINCT FROM r.content_version);

      UPDATE game.rooms SET active_run=r.id, latest_run=r.id, team_locked=true, version=version+1, practice_until=NULL WHERE code=c;
      RETURN jsonb_build_object('runId', r.id, 'unready', unready);
    END IF;
    RETURN game.apply_base_command(a, c, k, p);
  END IF;

  -- Player shield-move command
  IF k = 'shield-move' THEN
    IF actor.role <> 'player' THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;

    rr := (p->>'runId')::uuid;
    PERFORM game.reconcile(rr);
    PERFORM pg_advisory_xact_lock(hashtextextended('run:'||rr, 0));

    SELECT * INTO r FROM game.runs WHERE id=rr AND room_code=c FOR UPDATE;
    n := clock_timestamp();

    IF r.id IS NULL OR r.game_id<>'company-shield' OR room.active_run IS DISTINCT FROM rr THEN
      RAISE EXCEPTION 'RUN_NOT_FOUND';
    END IF;
    IF r.status<>'RUNNING' OR r.paused THEN RAISE EXCEPTION 'INPUT_CLOSED'; END IF;
    IF (p->>'phaseToken')::uuid IS DISTINCT FROM r.phase_token THEN RAISE EXCEPTION 'STALE_PHASE'; END IF;
    IF r.deadline IS NULL OR n < r.phase_start OR n >= r.deadline THEN RAISE EXCEPTION 'INPUT_CLOSED'; END IF;

    SELECT * INTO ro FROM game.rosters WHERE run_id=rr AND actor_id=a;
    IF ro.member_id IS NULL THEN RAISE EXCEPTION 'NOT_IN_ROSTER'; END IF;

    SELECT * INTO state FROM game.shield_run_state WHERE run_id=rr;
    IF r.phase<>'PLAYING' OR state.current_phase<>'PLAYING' THEN RAISE EXCEPTION 'INPUT_CLOSED'; END IF;

    v_lane := (p->>'lane')::int;
    v_norm_x := (p->>'normalizedX')::numeric;
    IF v_lane < 0 OR v_lane > 2 THEN RAISE EXCEPTION 'INVALID_LANE'; END IF;
    IF v_norm_x < 0.0 OR v_norm_x > 1.0 THEN RAISE EXCEPTION 'INVALID_COORDINATE'; END IF;

    -- Calculate elapsed arcade time (seconds)
    elapsed_sec := 25.0 - (extract(epoch from (r.deadline - n)));

    -- Insert movement record
    INSERT INTO game.shield_moves(run_id, member_id, move_at, elapsed_sec, lane, normalized_x, client_time_ms)
    VALUES(rr, ro.member_id, n, elapsed_sec, v_lane, v_norm_x, (p->>'clientTimeMs')::bigint);

    -- Update player current position
    UPDATE game.shield_player_states
    SET current_lane = v_lane,
        normalized_x = v_norm_x
    WHERE run_id=rr AND member_id=ro.member_id;

    -- Trigger packet collision evaluation
    PERFORM game.shield_evaluate_packets(rr);

    UPDATE game.runs SET version=version+1 WHERE id=rr;
    RETURN jsonb_build_object('accepted', true, 'lane', v_lane, 'normalizedX', v_norm_x);
  END IF;

  RETURN game.apply_base_command(a, c, k, p);
END $$;

-- Snapshot generator for Game 6.
CREATE OR REPLACE FUNCTION game.shield_snapshot(a uuid, c text, actor_role text, p_run uuid) RETURNS jsonb LANGUAGE plpgsql STABLE AS $$
DECLARE
  v_run game.runs;
  v_player_roster game.rosters;
  v_pstate game.shield_player_states;
  v_state game.shield_run_state;
  is_revealed boolean := false;
  v_version text;
  packets_data jsonb;
  my_state_data jsonb := NULL;
  p_stats_agg jsonb;
  v_total_blocked int := 0;
  v_total_missed int := 0;
  v_roster_count int := 0;
  v_trust_slots int := 10;
BEGIN
  IF p_run IS NOT NULL THEN
    SELECT * INTO v_run FROM game.runs WHERE id=p_run AND game_id='company-shield';
  END IF;

  v_version := coalesce(v_run.content_version, 'shield-v1');

  IF v_run.id IS NOT NULL THEN
    SELECT * INTO v_state FROM game.shield_run_state WHERE run_id=v_run.id;
    is_revealed := v_run.status IN ('RESULT', 'COMPLETED');

    -- Packet definitions (all 10 real packets)
    SELECT coalesce(jsonb_agg(
      jsonb_build_object(
        'packetId', p.packet_id,
        'packetNo', p.packet_no,
        'aimAtSec', p.aim_at_sec,
        'railAtSec', p.rail_at_sec,
        'customerAtSec', p.customer_at_sec,
        'targetLane', p.target_lane,
        'botClaim', p.bot_claim,
        'companyTask', p.company_task,
        'customerName', p.customer_name
      ) ORDER BY p.packet_no
    ), '[]'::jsonb) INTO packets_data
    FROM game.shield_packets p
    WHERE p.version=v_version AND p.packet_no > 0;

    -- Player private state
    IF actor_role = 'player' THEN
      SELECT * INTO v_player_roster FROM game.rosters WHERE run_id=v_run.id AND actor_id=a;
      IF v_player_roster.member_id IS NOT NULL THEN
        SELECT * INTO v_pstate FROM game.shield_player_states WHERE run_id=v_run.id AND member_id=v_player_roster.member_id;

        my_state_data := jsonb_build_object(
          'currentLane', v_pstate.current_lane,
          'normalizedX', v_pstate.normalized_x,
          'blockedCount', v_pstate.blocked_count,
          'missedCount', v_pstate.missed_count,
          'score', v_pstate.score,
          'intercepts', (
            SELECT coalesce(jsonb_agg(
              jsonb_build_object(
                'packetId', si.packet_id,
                'status', si.status,
                'lane', si.lane,
                'evaluatedAt', to_char(si.evaluated_at, 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
                'points', si.points
              ) ORDER BY si.evaluated_at
            ), '[]'::jsonb)
            FROM game.shield_intercepts si
            WHERE si.run_id=v_run.id AND si.member_id=v_player_roster.member_id
          )
        );
      END IF;
    END IF;

    -- Aggregate packet stats
    SELECT count(*)::int INTO v_roster_count FROM game.rosters WHERE run_id=v_run.id;
    SELECT count(*)::int INTO v_total_blocked FROM game.shield_intercepts WHERE run_id=v_run.id AND status='BLOCKED';
    SELECT count(*)::int INTO v_total_missed FROM game.shield_intercepts WHERE run_id=v_run.id AND status='MISSED';

    -- Customer trust meter: starts at 10, drops based on missed packets
    IF v_roster_count > 0 AND (v_total_blocked + v_total_missed) > 0 THEN
      v_trust_slots := greatest(0, 10 - round((v_total_missed::numeric / (v_roster_count * 10)) * 10)::int);
    ELSE
      v_trust_slots := 10;
    END IF;

    SELECT coalesce(jsonb_agg(
      jsonb_build_object(
        'packetId', x.packet_id,
        'blockedCount', x.blocked,
        'missedCount', x.missed
      )
    ), '[]'::jsonb) INTO p_stats_agg
    FROM (
      SELECT packet_id,
             count(*) FILTER (WHERE status='BLOCKED')::int AS blocked,
             count(*) FILTER (WHERE status='MISSED')::int AS missed
      FROM game.shield_intercepts
      WHERE run_id=v_run.id
      GROUP BY packet_id
    ) x;

    RETURN jsonb_build_object(
      'contentVersion', v_version,
      'phase', CASE WHEN is_revealed THEN 'RESULT' ELSE v_state.current_phase END,
      'contextBanner', 'คดี Moffatt v. Air Canada (2024): คณะพิจารณาข้อพิพาทแพ่ง BC ให้สายการบินรับผิดจากข้อมูลค่าโดยสารกรณีสูญเสียสมาชิกครอบครัวที่แชตบอตให้ไม่ตรงนโยบาย',
      'packets', packets_data,
      'myState', my_state_data,
      'revealed', is_revealed,
      'stats', jsonb_build_object(
        'rosterCount', v_roster_count,
        'totalPacketsBlocked', v_total_blocked,
        'totalPacketsMissed', v_total_missed,
        'customerTrustSlots', v_trust_slots,
        'packetStats', p_stats_agg
      )
    );
  ELSE
    -- Preview mode before start
    RETURN jsonb_build_object(
      'contentVersion', v_version,
      'phase', 'PREVIEW',
      'contextBanner', 'คดี Moffatt v. Air Canada (2024): คณะพิจารณาข้อพิพาทแพ่ง BC ให้สายการบินรับผิดจากข้อมูลค่าโดยสารกรณีสูญเสียสมาชิกครอบครัวที่แชตบอตให้ไม่ตรงนโยบาย',
      'packets', '[]'::jsonb,
      'myState', NULL,
      'revealed', false,
      'stats', jsonb_build_object(
        'rosterCount', (SELECT count(*)::int FROM game.members WHERE room_code=c AND active),
        'totalPacketsBlocked', 0,
        'totalPacketsMissed', 0,
        'customerTrustSlots', 10,
        'packetStats', '[]'::jsonb
      )
    );
  END IF;
END $$;

-- Master dispatchers hooking all six games cleanly together.
CREATE OR REPLACE FUNCTION game.reconcile(p_run uuid) RETURNS void LANGUAGE plpgsql AS $$
DECLARE r game.runs;
BEGIN
  SELECT * INTO r FROM game.runs WHERE id=p_run;
  IF r.game_id = 'company-shield' THEN
    PERFORM game.shield_reconcile(p_run);
  ELSIF r.game_id = 'chat-whack-a-mole' THEN
    PERFORM game.whack_reconcile(p_run);
  ELSIF r.game_id = 'confidence-roulette' THEN
    PERFORM game.roulette_reconcile(p_run);
  ELSIF r.game_id = 'caption-battle' THEN
    PERFORM game.caption_reconcile(p_run);
  ELSE
    PERFORM game.reconcile_base(p_run);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION game.apply_command(a uuid, c text, k text, p jsonb) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE room game.rooms;
BEGIN
  SELECT * INTO room FROM game.rooms WHERE code=c;
  IF k IN ('shield-move') OR (k='start' AND room.cue='11.02') THEN
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

CREATE OR REPLACE FUNCTION game.scores(p_run uuid) RETURNS jsonb LANGUAGE plpgsql STABLE AS $$
BEGIN
  IF (SELECT game_id FROM game.runs WHERE id=p_run) = 'company-shield' THEN
    RETURN game.shield_scores(p_run);
  ELSIF (SELECT game_id FROM game.runs WHERE id=p_run) = 'chat-whack-a-mole' THEN
    RETURN game.whack_scores(p_run);
  ELSIF (SELECT game_id FROM game.runs WHERE id=p_run) = 'confidence-roulette' THEN
    RETURN game.roulette_scores(p_run);
  ELSIF (SELECT game_id FROM game.runs WHERE id=p_run) = 'caption-battle' THEN
    RETURN game.caption_scores(p_run);
  ELSE
    RETURN game.scores_base(p_run);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION game.digest(p_run uuid) RETURNS text LANGUAGE sql STABLE AS $$
  SELECT CASE 
    WHEN (SELECT game_id FROM game.runs WHERE id=p_run) = 'company-shield' THEN game.shield_digest(p_run)
    WHEN (SELECT game_id FROM game.runs WHERE id=p_run) = 'chat-whack-a-mole' THEN game.whack_digest(p_run)
    WHEN (SELECT game_id FROM game.runs WHERE id=p_run) = 'confidence-roulette' THEN game.roulette_digest(p_run)
    WHEN (SELECT game_id FROM game.runs WHERE id=p_run) = 'caption-battle' THEN game.caption_digest(p_run)
    ELSE game.digest_base(p_run)
  END;
$$;

CREATE OR REPLACE FUNCTION game.snapshot(a uuid, c text) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE result jsonb; data jsonb;
BEGIN
  result := game.snapshot_base(a, c);
  IF result->>'ok'<>'true' THEN RETURN result; END IF;
  data := result->'data';
  IF data->'room'->>'cue'='04.01' OR data->'run'->>'gameId'='caption-battle' THEN
    data := data || jsonb_build_object('caption', game.caption_snapshot(a, c, data->>'role', (data->'run'->>'id')::uuid));
  END IF;
  IF data->'room'->>'cue'='07.01' OR data->'run'->>'gameId'='confidence-roulette' THEN
    data := data || jsonb_build_object('roulette', game.roulette_snapshot(a, c, data->>'role', (data->'run'->>'id')::uuid));
  END IF;
  IF data->'room'->>'cue'='10.02' OR data->'run'->>'gameId'='chat-whack-a-mole' THEN
    data := data || jsonb_build_object('whack', game.whack_snapshot(a, c, data->>'role', (data->'run'->>'id')::uuid));
  END IF;
  IF data->'room'->>'cue'='11.02' OR data->'run'->>'gameId'='company-shield' THEN
    data := data || jsonb_build_object('shield', game.shield_snapshot(a, c, data->>'role', (data->'run'->>'id')::uuid));
  END IF;
  RETURN jsonb_build_object('ok', true, 'data', data);
END $$;

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA game FROM PUBLIC;
