-- Game 5: Chat Whack-a-Mole (chat-whack-a-mole) extension.
-- Built with the same audit trail, controller lease, roster freeze,
-- pause-safe clock, privacy fence, and server authority as the other games.

CREATE TABLE IF NOT EXISTS game.whack_bubbles (
  version text NOT NULL,
  bubble_id text NOT NULL,
  slot int NOT NULL CHECK(slot >= 0 AND slot <= 5),
  text text NOT NULL,
  spawn_at_sec numeric NOT NULL,
  expires_at_sec numeric NOT NULL,
  classification text NOT NULL CHECK(classification IN ('STOP', 'PASS')),
  explanation text NOT NULL,
  PRIMARY KEY(version, bubble_id)
);

CREATE TABLE IF NOT EXISTS game.whack_run_state (
  run_id uuid PRIMARY KEY REFERENCES game.runs,
  current_phase text NOT NULL DEFAULT 'COUNTDOWN',
  phase_start timestamptz NOT NULL,
  arcade_start timestamptz,
  deadline timestamptz
);

CREATE TABLE IF NOT EXISTS game.whack_player_states (
  run_id uuid NOT NULL,
  member_id uuid NOT NULL,
  correct_hits int NOT NULL DEFAULT 0,
  wrong_hits int NOT NULL DEFAULT 0,
  raw_score int NOT NULL DEFAULT 0,
  score int NOT NULL DEFAULT 0,
  PRIMARY KEY(run_id, member_id),
  FOREIGN KEY(run_id, member_id) REFERENCES game.rosters
);

CREATE TABLE IF NOT EXISTS game.whack_hits (
  run_id uuid NOT NULL,
  member_id uuid NOT NULL,
  bubble_id text NOT NULL,
  hit_at timestamptz NOT NULL,
  client_time_ms bigint NOT NULL,
  classification text NOT NULL CHECK(classification IN ('STOP', 'PASS')),
  PRIMARY KEY(run_id, member_id, bubble_id),
  FOREIGN KEY(run_id, member_id) REFERENCES game.rosters
);

ALTER TABLE game.whack_bubbles ENABLE ROW LEVEL SECURITY;
ALTER TABLE game.whack_run_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE game.whack_player_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE game.whack_hits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA game FROM PUBLIC;

-- Cryptographic digest of all whack hits and final player outcomes.
CREATE OR REPLACE FUNCTION game.whack_digest(p_run uuid) RETURNS text LANGUAGE sql STABLE AS $$
  SELECT md5(
    coalesce((SELECT string_agg(member_id::text||':'||bubble_id||':'||classification||':'||to_char(hit_at,'YYYY-MM-DD"T"HH24:MI:SS.US'), ',' ORDER BY member_id, bubble_id) FROM game.whack_hits WHERE run_id=p_run),'')
    || '|' ||
    coalesce((SELECT string_agg(member_id::text||':'||correct_hits||':'||wrong_hits||':'||raw_score||':'||score, ',' ORDER BY member_id) FROM game.whack_player_states WHERE run_id=p_run),'')
  );
$$;

-- Aggregate group scores for Game 5.
-- Average = Sum(scores) / Total roster members in group (including members with 0).
CREATE OR REPLACE FUNCTION game.whack_scores(p_run uuid) RETURNS jsonb LANGUAGE plpgsql STABLE AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_agg(jsonb_build_object(
    'id', g.id,
    'name', g.name,
    'numerator', coalesce((SELECT sum(ps.score)::int FROM game.whack_player_states ps JOIN game.rosters rst ON rst.run_id=ps.run_id AND rst.member_id=ps.member_id WHERE ps.run_id=p_run AND rst.group_id=g.id), 0),
    'denominator', (SELECT count(*)::int FROM game.rosters WHERE run_id=p_run AND group_id=g.id)
  ) ORDER BY g.id) INTO result
  FROM game.groups g WHERE room_code=(SELECT room_code FROM game.runs WHERE id=p_run);
  RETURN coalesce(result, '[]'::jsonb);
END $$;

-- Advance Whack state machine deterministically based on server clock.
CREATE OR REPLACE FUNCTION game.whack_reconcile(p_run uuid) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  r game.runs;
  state game.whack_run_state;
  n timestamptz;
BEGIN
  SELECT * INTO r FROM game.runs WHERE id=p_run FOR UPDATE;
  IF r.id IS NULL OR r.game_id<>'chat-whack-a-mole' THEN RETURN; END IF;
  IF r.status<>'RUNNING' OR r.paused THEN RETURN; END IF;

  SELECT * INTO state FROM game.whack_run_state WHERE run_id=p_run FOR UPDATE;
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

    UPDATE game.whack_run_state
    SET current_phase='PLAYING',
        phase_start=n,
        arcade_start=n,
        deadline=n + interval '25 seconds'
    WHERE run_id=p_run;
    RETURN;
  END IF;

  -- PLAYING -> RESULT (25 seconds arcade play elapsed)
  IF r.phase='PLAYING' AND n >= r.deadline THEN
    -- Final scoring: clamp raw_score to [0, 900]
    UPDATE game.whack_player_states
    SET score = greatest(0, least(900, raw_score))
    WHERE run_id=p_run;

    -- Update main player_states table
    UPDATE game.player_states ps
    SET accepted = wps.score
    FROM game.whack_player_states wps
    WHERE ps.run_id=p_run AND ps.member_id=wps.member_id;

    UPDATE game.runs
    SET status='RESULT',
        phase='RESULT',
        phase_start=n,
        deadline=NULL,
        phase_token=gen_random_uuid(),
        input_digest=game.whack_digest(p_run),
        version=version+1
    WHERE id=p_run;

    UPDATE game.whack_run_state
    SET current_phase='RESULT',
        phase_start=n,
        deadline=NULL
    WHERE run_id=p_run;
    RETURN;
  END IF;
END $$;

-- Handle Game 5 specific commands: 'start' on cue 10.02, and 'whack-hit'
CREATE OR REPLACE FUNCTION game.whack_apply_command(a uuid, c text, k text, p jsonb) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE
  room game.rooms;
  actor game.actors;
  r game.runs;
  ro game.rosters;
  state game.whack_run_state;
  b game.whack_bubbles;
  n timestamptz;
  unready int;
  rr uuid;
  elapsed_sec numeric;
  is_correct boolean;
BEGIN
  SELECT * INTO actor FROM game.actors WHERE id=a;
  IF actor.id IS NULL THEN RAISE EXCEPTION 'UNAUTHORIZED'; END IF;

  SELECT * INTO room FROM game.rooms WHERE code=c;
  IF room.code IS NULL THEN RAISE EXCEPTION 'ROOM_NOT_FOUND'; END IF;

  n := clock_timestamp();

  -- Host start command for Chat Whack-a-Mole
  IF k = 'start' THEN
    IF actor.role<>'host' OR room.host_id<>a THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
    IF room.active_run IS NOT NULL THEN RAISE EXCEPTION 'RUN_ACTIVE'; END IF;
    IF room.cue = '10.02' THEN
      IF room.controller_id IS DISTINCT FROM (p->>'controllerId') THEN RAISE EXCEPTION 'CONTROLLER_MISMATCH'; END IF;
      IF room.lease_until IS NULL OR n > room.lease_until THEN RAISE EXCEPTION 'LEASE_EXPIRED'; END IF;
      IF room.controller_epoch IS DISTINCT FROM (p->>'controllerEpoch')::int THEN RAISE EXCEPTION 'EPOCH_MISMATCH'; END IF;
      IF room.version IS DISTINCT FROM (p->>'expectedVersion')::int THEN RAISE EXCEPTION 'VERSION_MISMATCH'; END IF;
      IF room.practice_until > n THEN RAISE EXCEPTION 'PRACTICE_ACTIVE'; END IF;

      IF (SELECT count(*) FROM game.whack_bubbles WHERE version='whack-a-mole-v1') < 18 THEN
        RAISE EXCEPTION 'CONTENT_INVALID';
      END IF;

      INSERT INTO game.runs(room_code, game_id, content_version, scoring_version, schedule_version, timing_profile, phase_start, deadline)
      VALUES(c, 'chat-whack-a-mole', 'whack-a-mole-v1', 'whack-clamp-900-v1', 'whack-3-25-v1', coalesce(p->>'timingProfile', 'normal'), n, n + interval '3 seconds')
      RETURNING * INTO r;

      INSERT INTO game.rosters SELECT r.id, id, actor_id, group_id, nickname, side FROM game.members WHERE room_code=c AND active;
      INSERT INTO game.player_states(run_id, member_id) SELECT r.id, member_id FROM game.rosters WHERE run_id=r.id;
      INSERT INTO game.whack_player_states(run_id, member_id, correct_hits, wrong_hits, raw_score, score)
        SELECT r.id, member_id, 0, 0, 0, 0 FROM game.rosters WHERE run_id=r.id;
      INSERT INTO game.whack_run_state(run_id, current_phase, phase_start, arcade_start, deadline)
        VALUES(r.id, 'COUNTDOWN', n, NULL, n + interval '3 seconds');

      SELECT count(*)::int INTO unready FROM game.members
      WHERE room_code=c AND active AND (ready_preview IS DISTINCT FROM room.preview_id OR ready_version IS DISTINCT FROM r.content_version);

      UPDATE game.rooms SET active_run=r.id, latest_run=r.id, team_locked=true, version=version+1, practice_until=NULL WHERE code=c;
      RETURN jsonb_build_object('runId', r.id, 'unready', unready);
    END IF;
    RETURN game.apply_base_command(a, c, k, p);
  END IF;

  -- Player whack-hit command
  IF k = 'whack-hit' THEN
    IF actor.role <> 'player' THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;

    rr := (p->>'runId')::uuid;
    PERFORM game.reconcile(rr);
    PERFORM pg_advisory_xact_lock(hashtextextended('run:'||rr, 0));

    SELECT * INTO r FROM game.runs WHERE id=rr AND room_code=c FOR UPDATE;
    n := clock_timestamp();

    IF r.id IS NULL OR r.game_id<>'chat-whack-a-mole' OR room.active_run IS DISTINCT FROM rr THEN
      RAISE EXCEPTION 'RUN_NOT_FOUND';
    END IF;
    IF r.status<>'RUNNING' OR r.paused THEN RAISE EXCEPTION 'INPUT_CLOSED'; END IF;
    IF (p->>'phaseToken')::uuid IS DISTINCT FROM r.phase_token THEN RAISE EXCEPTION 'STALE_PHASE'; END IF;
    IF r.deadline IS NULL OR n < r.phase_start OR n >= r.deadline THEN RAISE EXCEPTION 'INPUT_CLOSED'; END IF;

    SELECT * INTO ro FROM game.rosters WHERE run_id=rr AND actor_id=a;
    IF ro.member_id IS NULL THEN RAISE EXCEPTION 'NOT_IN_ROSTER'; END IF;

    SELECT * INTO state FROM game.whack_run_state WHERE run_id=rr;
    IF r.phase<>'PLAYING' OR state.current_phase<>'PLAYING' THEN RAISE EXCEPTION 'INPUT_CLOSED'; END IF;

    SELECT * INTO b FROM game.whack_bubbles WHERE version=r.content_version AND bubble_id=(p->>'bubbleId');
    IF b.bubble_id IS NULL THEN RAISE EXCEPTION 'BUBBLE_NOT_FOUND'; END IF;

    -- Calculate elapsed arcade time: 25s total arcade duration minus remaining time to deadline.
    -- This calculation seamlessly handles any pause and resume duration.
    elapsed_sec := 25.0 - (extract(epoch from (r.deadline - n)));

    -- Bubble active window validation (with 350ms grace window for network transmission)
    IF elapsed_sec < b.spawn_at_sec OR elapsed_sec > (b.expires_at_sec + 0.35) THEN
      RAISE EXCEPTION 'BUBBLE_EXPIRED';
    END IF;

    -- Idempotency check: unique(run_id, member_id, bubble_id)
    IF EXISTS(SELECT 1 FROM game.whack_hits WHERE run_id=rr AND member_id=ro.member_id AND bubble_id=b.bubble_id) THEN
      RETURN jsonb_build_object('accepted', true, 'duplicate', true, 'bubbleId', b.bubble_id);
    END IF;

    is_correct := (b.classification = 'STOP');

    INSERT INTO game.whack_hits(run_id, member_id, bubble_id, hit_at, client_time_ms, classification)
    VALUES(rr, ro.member_id, b.bubble_id, n, (p->>'clientTimeMs')::bigint, b.classification);

    IF is_correct THEN
      UPDATE game.whack_player_states
      SET correct_hits = correct_hits + 1,
          raw_score = raw_score + 100
      WHERE run_id=rr AND member_id=ro.member_id;
    ELSE
      UPDATE game.whack_player_states
      SET wrong_hits = wrong_hits + 1,
          raw_score = raw_score - 100
      WHERE run_id=rr AND member_id=ro.member_id;
    END IF;

    UPDATE game.runs SET version=version+1 WHERE id=rr;
    RETURN jsonb_build_object('accepted', true, 'bubbleId', b.bubble_id, 'isCorrect', is_correct);
  END IF;

  RETURN game.apply_base_command(a, c, k, p);
END $$;

-- Snapshot generator for Game 5.
CREATE OR REPLACE FUNCTION game.whack_snapshot(a uuid, c text, actor_role text, p_run uuid) RETURNS jsonb LANGUAGE plpgsql STABLE AS $$
DECLARE
  v_run game.runs;
  v_player_roster game.rosters;
  v_pstate game.whack_player_states;
  v_state game.whack_run_state;
  is_revealed boolean := false;
  v_version text;
  bubbles_data jsonb;
  my_state_data jsonb := NULL;
  key_pairs_data jsonb := NULL;
  b_hits_agg jsonb;
BEGIN
  IF p_run IS NOT NULL THEN
    SELECT * INTO v_run FROM game.runs WHERE id=p_run AND game_id='chat-whack-a-mole';
  END IF;

  v_version := coalesce(v_run.content_version, 'whack-a-mole-v1');

  IF v_run.id IS NOT NULL THEN
    SELECT * INTO v_state FROM game.whack_run_state WHERE run_id=v_run.id;
    is_revealed := v_run.status IN ('RESULT', 'COMPLETED');

    -- Bubble manifest with strict privacy fence:
    -- classification and explanation are NEVER disclosed during PREVIEW, COUNTDOWN, or PLAYING!
    SELECT coalesce(jsonb_agg(
      jsonb_build_object(
        'bubbleId', b.bubble_id,
        'slot', b.slot,
        'text', b.text,
        'spawnAtSec', b.spawn_at_sec,
        'expiresAtSec', b.expires_at_sec,
        'classification', CASE WHEN is_revealed THEN b.classification ELSE NULL END,
        'explanation', CASE WHEN is_revealed THEN b.explanation ELSE NULL END
      ) ORDER BY b.spawn_at_sec
    ), '[]'::jsonb) INTO bubbles_data
    FROM game.whack_bubbles b
    WHERE b.version=v_version;

    -- Player private state
    IF actor_role = 'player' THEN
      SELECT * INTO v_player_roster FROM game.rosters WHERE run_id=v_run.id AND actor_id=a;
      IF v_player_roster.member_id IS NOT NULL THEN
        SELECT * INTO v_pstate FROM game.whack_player_states WHERE run_id=v_run.id AND member_id=v_player_roster.member_id;

        my_state_data := jsonb_build_object(
          'correctHits', v_pstate.correct_hits,
          'wrongHits', v_pstate.wrong_hits,
          'rawScore', v_pstate.raw_score,
          'score', CASE WHEN is_revealed THEN v_pstate.score ELSE greatest(0, least(900, v_pstate.raw_score)) END,
          'hits', (
            SELECT coalesce(jsonb_agg(
              jsonb_build_object(
                'bubbleId', h.bubble_id,
                'hitAt', to_char(h.hit_at, 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
                'isCorrect', CASE WHEN is_revealed THEN (h.classification = 'STOP') ELSE NULL END
              ) ORDER BY h.hit_at
            ), '[]'::jsonb)
            FROM game.whack_hits h
            WHERE h.run_id=v_run.id AND h.member_id=v_player_roster.member_id
          )
        );
      END IF;
    END IF;

    -- Aggregate bubble hit stats for display
    SELECT coalesce(jsonb_agg(
      jsonb_build_object('bubbleId', x.bubble_id, 'totalHits', x.total_hits)
    ), '[]'::jsonb) INTO b_hits_agg
    FROM (
      SELECT bubble_id, count(*)::int AS total_hits
      FROM game.whack_hits
      WHERE run_id=v_run.id
      GROUP BY bubble_id
    ) x;

    -- Key comparison pairs revealed on result
    IF is_revealed THEN
      key_pairs_data := jsonb_build_array(
        jsonb_build_object(
          'teachingPoint', 'AI ต้องเปิดทางให้มนุษย์เข้าแทรกแซงเสมอ ไม่ปิดกั้นช่องทางขอความช่วยเหลือ',
          'stopBubble', (SELECT jsonb_build_object('bubbleId', bubble_id, 'text', text, 'classification', classification, 'explanation', explanation) FROM game.whack_bubbles WHERE version=v_version AND bubble_id='whack-b01'),
          'passBubble', (SELECT jsonb_build_object('bubbleId', bubble_id, 'text', text, 'classification', classification, 'explanation', explanation) FROM game.whack_bubbles WHERE version=v_version AND bubble_id='whack-b02')
        ),
        jsonb_build_object(
          'teachingPoint', 'ห้ามรับประกันความปลอดภัยโดยพลการ ความโปร่งใสในข้อจำกัดสำคัญกว่าการตอบให้ดูมั่นใจ',
          'stopBubble', (SELECT jsonb_build_object('bubbleId', bubble_id, 'text', text, 'classification', classification, 'explanation', explanation) FROM game.whack_bubbles WHERE version=v_version AND bubble_id='whack-b07'),
          'passBubble', (SELECT jsonb_build_object('bubbleId', bubble_id, 'text', text, 'classification', classification, 'explanation', explanation) FROM game.whack_bubbles WHERE version=v_version AND bubble_id='whack-b08')
        )
      );
    END IF;

    RETURN jsonb_build_object(
      'contentVersion', v_version,
      'phase', CASE WHEN is_revealed THEN 'RESULT' ELSE v_state.current_phase END,
      'contextBanner', 'ผู้ใช้ขอคุยกับเจ้าหน้าที่ และบอกว่าคำแนะนำเดิมทำให้ไม่สบายใจ',
      'bubbles', bubbles_data,
      'myState', my_state_data,
      'revealed', is_revealed,
      'keyPairs', key_pairs_data,
      'stats', jsonb_build_object(
        'rosterCount', (SELECT count(*)::int FROM game.rosters WHERE run_id=v_run.id),
        'totalHits', (SELECT count(*)::int FROM game.whack_hits WHERE run_id=v_run.id),
        'totalCorrectHits', (SELECT count(*)::int FROM game.whack_hits WHERE run_id=v_run.id AND classification='STOP'),
        'totalWrongHits', (SELECT count(*)::int FROM game.whack_hits WHERE run_id=v_run.id AND classification='PASS'),
        'missedRiskCount', CASE WHEN is_revealed THEN (
          (SELECT count(*)::int FROM game.whack_bubbles WHERE version=v_version AND classification='STOP') * (SELECT count(*)::int FROM game.rosters WHERE run_id=v_run.id)
          - (SELECT count(*)::int FROM game.whack_hits WHERE run_id=v_run.id AND classification='STOP')
        ) ELSE 0 END,
        'bubbleHits', b_hits_agg
      )
    );
  ELSE
    -- Preview mode before start
    RETURN jsonb_build_object(
      'contentVersion', v_version,
      'phase', 'PREVIEW',
      'contextBanner', 'ผู้ใช้ขอคุยกับเจ้าหน้าที่ และบอกว่าคำแนะนำเดิมทำให้ไม่สบายใจ',
      'bubbles', '[]'::jsonb,
      'myState', NULL,
      'revealed', false,
      'keyPairs', NULL,
      'stats', jsonb_build_object(
        'rosterCount', (SELECT count(*)::int FROM game.members WHERE room_code=c AND active),
        'totalHits', 0,
        'totalCorrectHits', 0,
        'totalWrongHits', 0,
        'missedRiskCount', 0,
        'bubbleHits', '[]'::jsonb
      )
    );
  END IF;
END $$;

-- Master dispatchers hooking all five games cleanly together.
CREATE OR REPLACE FUNCTION game.reconcile(p_run uuid) RETURNS void LANGUAGE plpgsql AS $$
DECLARE r game.runs;
BEGIN
  SELECT * INTO r FROM game.runs WHERE id=p_run;
  IF r.game_id = 'chat-whack-a-mole' THEN
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
  IF k IN ('whack-hit') OR (k='start' AND room.cue='10.02') THEN
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
  IF (SELECT game_id FROM game.runs WHERE id=p_run) = 'chat-whack-a-mole' THEN
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
  RETURN jsonb_build_object('ok', true, 'data', data);
END $$;

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA game FROM PUBLIC;
