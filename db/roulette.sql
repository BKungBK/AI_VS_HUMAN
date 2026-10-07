-- Game 4: Death Cap Roulette (confidence-roulette) extension.
-- Built with the same audit trail, controller lease, roster freeze,
-- life state invariants, and server clock as the first three games.

CREATE TABLE IF NOT EXISTS game.roulette_content (
 version text NOT NULL,
 round_no int NOT NULL,
 title text NOT NULL,
 context_text text NOT NULL,
 claim_text text NOT NULL,
 confidence numeric NOT NULL,
 image_path text,
 is_correct boolean NOT NULL,
 explanation text NOT NULL,
 is_final_risk boolean NOT NULL DEFAULT false,
 PRIMARY KEY(version, round_no)
);

CREATE TABLE IF NOT EXISTS game.roulette_run_state (
 run_id uuid PRIMARY KEY REFERENCES game.runs,
 current_round int NOT NULL DEFAULT 1,
 round_phase text NOT NULL DEFAULT 'COUNTDOWN',
 phase_start timestamptz NOT NULL,
 deadline timestamptz
);

CREATE TABLE IF NOT EXISTS game.roulette_player_states (
 run_id uuid NOT NULL,
 member_id uuid NOT NULL,
 life_state text NOT NULL DEFAULT 'ALIVE' CHECK(life_state IN ('ALIVE','DEAD')),
 score int NOT NULL DEFAULT 0,
 eliminated_at_round int,
 eliminated_reason text,
 PRIMARY KEY(run_id, member_id),
 FOREIGN KEY(run_id, member_id) REFERENCES game.rosters
);

CREATE TABLE IF NOT EXISTS game.roulette_answers (
 run_id uuid NOT NULL,
 member_id uuid NOT NULL,
 round_no int NOT NULL,
 choice text NOT NULL CHECK(choice IN ('BELIEVE','DOUBT')),
 accepted_at timestamptz NOT NULL,
 PRIMARY KEY(run_id, member_id, round_no),
 FOREIGN KEY(run_id, member_id) REFERENCES game.rosters
);

ALTER TABLE game.roulette_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE game.roulette_run_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE game.roulette_player_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE game.roulette_answers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA game FROM PUBLIC;

-- Evaluate one round's answers atomically for all ALIVE members in the roster.
CREATE OR REPLACE FUNCTION game.roulette_evaluate_round(p_run uuid, curr_round int) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
 v_is_correct boolean;
 v_content_version text;
 p record;
BEGIN
 SELECT content_version INTO v_content_version FROM game.runs WHERE id=p_run;
 SELECT is_correct INTO v_is_correct FROM game.roulette_content WHERE version=v_content_version AND round_no=curr_round;
 IF v_is_correct IS NULL THEN RETURN; END IF;

 FOR p IN
   SELECT ps.member_id, ps.score, ans.choice
   FROM game.roulette_player_states ps
   LEFT JOIN game.roulette_answers ans ON ans.run_id=p_run AND ans.member_id=ps.member_id AND ans.round_no=curr_round
   WHERE ps.run_id=p_run AND ps.life_state='ALIVE'
 LOOP
   IF p.choice = 'BELIEVE' THEN
     IF v_is_correct THEN
       -- Believe on correct statement: +300 points, stays ALIVE
       UPDATE game.roulette_player_states SET score = score + 300 WHERE run_id=p_run AND member_id=p.member_id;
     ELSE
       -- Believe on incorrect/unverifiable statement: DEAD, score reset to 0, eliminated at round
       UPDATE game.roulette_player_states
       SET life_state='DEAD', score=0, eliminated_at_round=curr_round, eliminated_reason='เชื่อข้อความที่ผิดหรือยืนยันไม่ได้'
       WHERE run_id=p_run AND member_id=p.member_id;
     END IF;
   ELSIF p.choice = 'DOUBT' THEN
     IF NOT v_is_correct THEN
       -- Doubt on incorrect/unverifiable statement: +100 points, stays ALIVE
       UPDATE game.roulette_player_states SET score = score + 100 WHERE run_id=p_run AND member_id=p.member_id;
     ELSE
       -- Doubt on correct statement: +0 points, stays ALIVE
       NULL;
     END IF;
   ELSE
     -- No answer / timeout: +0 points, stays ALIVE
     NULL;
   END IF;
 END LOOP;
END $$;

-- Cryptographic digest of all roulette inputs and outcomes.
CREATE OR REPLACE FUNCTION game.roulette_digest(p_run uuid) RETURNS text LANGUAGE sql STABLE AS $$
 SELECT md5(
   coalesce((SELECT string_agg(member_id::text||':'||round_no||':'||choice||':'||to_char(accepted_at,'YYYY-MM-DD"T"HH24:MI:SS.US'), ',' ORDER BY member_id, round_no) FROM game.roulette_answers WHERE run_id=p_run),'')
   || '|' ||
   coalesce((SELECT string_agg(member_id::text||':'||life_state||':'||score||':'||coalesce(eliminated_at_round::text,''), ',' ORDER BY member_id) FROM game.roulette_player_states WHERE run_id=p_run),'')
 );
$$;

-- Group scoring: sum of surviving scores / total roster count in group at Start.
CREATE OR REPLACE FUNCTION game.roulette_scores(p_run uuid) RETURNS jsonb LANGUAGE plpgsql STABLE AS $$
DECLARE result jsonb;
BEGIN
 SELECT jsonb_agg(jsonb_build_object(
   'id', g.id,
   'name', g.name,
   'numerator', coalesce((SELECT sum(ps.score) FROM game.roulette_player_states ps JOIN game.rosters rst ON rst.run_id=ps.run_id AND rst.member_id=ps.member_id WHERE ps.run_id=p_run AND rst.group_id=g.id), 0),
   'denominator', (SELECT count(*) FROM game.rosters WHERE run_id=p_run AND group_id=g.id)
 ) ORDER BY g.id) INTO result
 FROM game.groups g WHERE room_code=(SELECT room_code FROM game.runs WHERE id=p_run);
 RETURN coalesce(result, '[]');
END $$;

-- State reconciliation and automatic phase advancement.
CREATE OR REPLACE FUNCTION game.roulette_reconcile(p_run uuid) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
 r game.runs;
 n timestamptz;
 curr_round int;
BEGIN
 SELECT * INTO r FROM game.runs WHERE id=p_run;
 IF r.status<>'RUNNING' OR r.paused OR r.deadline IS NULL OR clock_timestamp()<r.deadline THEN RETURN; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('run:'||p_run,0));
 SELECT * INTO r FROM game.runs WHERE id=p_run FOR UPDATE;
 n:=clock_timestamp();

 WHILE r.status='RUNNING' AND NOT r.paused AND r.deadline IS NOT NULL AND n>=r.deadline LOOP
   SELECT current_round INTO curr_round FROM game.roulette_run_state WHERE run_id=p_run;

   IF r.phase='COUNTDOWN' THEN
     UPDATE game.roulette_run_state SET current_round=1, round_phase='ANSWERING', phase_start=r.deadline, deadline=r.deadline+interval '4 seconds' WHERE run_id=p_run;
     UPDATE game.runs SET phase='ANSWERING', phase_start=r.deadline, deadline=r.deadline+interval '4 seconds', phase_token=gen_random_uuid(), version=version+1 WHERE id=p_run;
   ELSIF r.phase='ANSWERING' THEN
     PERFORM game.roulette_evaluate_round(p_run, curr_round);
     UPDATE game.roulette_run_state SET round_phase='REVEAL', phase_start=r.deadline, deadline=r.deadline+interval '5 seconds' WHERE run_id=p_run;
     UPDATE game.runs SET phase='REVEAL', phase_start=r.deadline, deadline=r.deadline+interval '5 seconds', phase_token=gen_random_uuid(), version=version+1 WHERE id=p_run;
   ELSIF r.phase='REVEAL' THEN
     IF curr_round >= 6 THEN
       UPDATE game.roulette_run_state SET round_phase='RESULT', phase_start=r.deadline, deadline=NULL WHERE run_id=p_run;
       UPDATE game.runs SET status='RESULT', phase='RESULT', phase_start=r.deadline, deadline=NULL, input_digest=game.digest(p_run), phase_token=gen_random_uuid(), version=version+1 WHERE id=p_run;
       EXIT;
     ELSE
       UPDATE game.roulette_run_state SET round_phase='TRANSITION', phase_start=r.deadline, deadline=r.deadline+interval '3 seconds' WHERE run_id=p_run;
       UPDATE game.runs SET phase='TRANSITION', phase_start=r.deadline, deadline=r.deadline+interval '3 seconds', phase_token=gen_random_uuid(), version=version+1 WHERE id=p_run;
     END IF;
   ELSIF r.phase='TRANSITION' THEN
     curr_round := curr_round + 1;
     UPDATE game.roulette_run_state SET current_round=curr_round, round_phase='ANSWERING', phase_start=r.deadline, deadline=r.deadline+interval '4 seconds' WHERE run_id=p_run;
     UPDATE game.runs SET phase='ANSWERING', phase_start=r.deadline, deadline=r.deadline+interval '4 seconds', phase_token=gen_random_uuid(), version=version+1 WHERE id=p_run;
   ELSE
     EXIT;
   END IF;
   SELECT * INTO r FROM game.runs WHERE id=p_run;
 END LOOP;
 INSERT INTO game.outbox(room_code,room_version) SELECT code,version FROM game.rooms WHERE code=r.room_code;
END $$;

-- Command handling for Game 4.
CREATE OR REPLACE FUNCTION game.roulette_apply_command(a uuid, c text, k text, p jsonb) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE
 room game.rooms;
 actor game.actors;
 r game.runs;
 ro game.rosters;
 ps game.roulette_player_states;
 state game.roulette_run_state;
 rr uuid;
 n timestamptz;
 unready int;
BEGIN
 SELECT * INTO room FROM game.rooms WHERE code=c;
 SELECT * INTO actor FROM game.actors WHERE id=a;

 IF actor.role='host' THEN
   SELECT * INTO room FROM game.rooms WHERE code=c FOR UPDATE;
   n:=clock_timestamp();
   IF room.host_id<>a THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
   IF room.controller_id IS DISTINCT FROM p->>'controllerId' OR room.controller_epoch<>(p->>'controllerEpoch')::int OR room.lease_until<=n THEN RAISE EXCEPTION 'STALE_CONTROLLER'; END IF;
   IF room.version<>(p->>'expectedVersion')::int THEN RAISE EXCEPTION 'STALE_VERSION'; END IF;

   IF k='start' THEN
     IF room.active_run IS NOT NULL THEN RAISE EXCEPTION 'RUN_ACTIVE'; END IF;
     IF room.cue<>'07.01' THEN RAISE EXCEPTION 'WRONG_CUE'; END IF;
     IF EXISTS(SELECT 1 FROM game.runs WHERE id=room.latest_run AND game_id='confidence-roulette' AND status='COMPLETED') THEN RAISE EXCEPTION 'REPLAY_REQUIRED'; END IF;
     IF (SELECT count(*) FROM game.roulette_content WHERE version='roulette-v1') < 6 THEN RAISE EXCEPTION 'CONTENT_INVALID'; END IF;

     INSERT INTO game.runs(room_code,game_id,content_version,scoring_version,schedule_version,timing_profile,phase_start,deadline)
     VALUES(c,'confidence-roulette','roulette-v1','roulette-life-risk-v1','roulette-3-6x12-16-v1',coalesce(p->>'timingProfile','normal'),n,n+interval '3 seconds') RETURNING * INTO r;

     INSERT INTO game.rosters SELECT r.id,id,actor_id,group_id,nickname,side FROM game.members WHERE room_code=c AND active;
     INSERT INTO game.player_states(run_id,member_id) SELECT r.id,member_id FROM game.rosters WHERE run_id=r.id;
     INSERT INTO game.roulette_player_states(run_id,member_id,life_state,score) SELECT r.id,member_id,'ALIVE',0 FROM game.rosters WHERE run_id=r.id;
     INSERT INTO game.roulette_run_state(run_id,current_round,round_phase,phase_start,deadline) VALUES(r.id,1,'COUNTDOWN',n,n+interval '3 seconds');

     SELECT count(*)::int INTO unready FROM game.members WHERE room_code=c AND active AND (ready_preview IS DISTINCT FROM room.preview_id OR ready_version IS DISTINCT FROM r.content_version);
     UPDATE game.rooms SET active_run=r.id,latest_run=r.id,team_locked=true,version=version+1,practice_until=NULL WHERE code=c;
     RETURN jsonb_build_object('runId',r.id,'unready',unready);
   END IF;
   RETURN game.apply_base_command(a,c,k,p);
 END IF;

 IF actor.role<>'player' THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;

 rr:=(p->>'runId')::uuid;
 PERFORM game.reconcile(rr);
 PERFORM pg_advisory_xact_lock(hashtextextended('run:'||rr,0));
 SELECT * INTO r FROM game.runs WHERE id=rr AND room_code=c FOR UPDATE;
 n:=clock_timestamp();

 IF r.id IS NULL OR r.game_id<>'confidence-roulette' OR room.active_run IS DISTINCT FROM rr THEN RAISE EXCEPTION 'RUN_NOT_FOUND'; END IF;
 IF r.status<>'RUNNING' OR r.paused THEN RAISE EXCEPTION 'INPUT_CLOSED'; END IF;
 IF (p->>'phaseToken')::uuid IS DISTINCT FROM r.phase_token THEN RAISE EXCEPTION 'STALE_PHASE'; END IF;
 IF r.deadline IS NULL OR n<r.phase_start OR n>=r.deadline THEN RAISE EXCEPTION 'INPUT_CLOSED'; END IF;

 SELECT * INTO ro FROM game.rosters WHERE run_id=rr AND actor_id=a;
 IF ro.member_id IS NULL THEN RAISE EXCEPTION 'NOT_IN_ROSTER'; END IF;

 SELECT * INTO ps FROM game.roulette_player_states WHERE run_id=rr AND member_id=ro.member_id;
 IF ps.life_state='DEAD' THEN RAISE EXCEPTION 'PLAYER_DEAD'; END IF;

 SELECT * INTO state FROM game.roulette_run_state WHERE run_id=rr;
 IF r.phase<>'ANSWERING' OR state.round_phase<>'ANSWERING' THEN RAISE EXCEPTION 'INPUT_CLOSED'; END IF;
 IF (p->>'round')::int<>state.current_round THEN RAISE EXCEPTION 'STALE_ROUND'; END IF;

 IF EXISTS(SELECT 1 FROM game.roulette_answers WHERE run_id=rr AND member_id=ro.member_id AND round_no=state.current_round) THEN
   RAISE EXCEPTION 'ANSWER_LOCKED';
 END IF;

 IF p->>'choice' NOT IN ('BELIEVE','DOUBT') THEN RAISE EXCEPTION 'INVALID_CHOICE'; END IF;

 INSERT INTO game.roulette_answers(run_id,member_id,round_no,choice,accepted_at)
 VALUES(rr,ro.member_id,state.current_round,p->>'choice',n);

 UPDATE game.runs SET version=version+1 WHERE id=rr;
 RETURN jsonb_build_object('accepted',true,'round',state.current_round,'choice',p->>'choice');
END $$;

-- Snapshot function for Game 4.
CREATE OR REPLACE FUNCTION game.roulette_snapshot(a uuid, c text, actor_role text, p_run uuid) RETURNS jsonb LANGUAGE plpgsql STABLE AS $$
DECLARE
 v_run game.runs;
 v_player_roster game.rosters;
 v_pstate game.roulette_player_states;
 v_state game.roulette_run_state;
 v_content game.roulette_content;
 my_ans record;
 curr_round_info jsonb;
 past_rounds_info jsonb:='[]';
 my_state_info jsonb;
 group_surv jsonb:='[]';
 is_revealed boolean:=false;
 show_answer_key boolean:=false;
 v_version text;
BEGIN
 IF p_run IS NOT NULL THEN
   SELECT * INTO v_run FROM game.runs WHERE id=p_run AND game_id='confidence-roulette';
 END IF;

 v_version := coalesce(v_run.content_version, 'roulette-v1');

 IF v_run.id IS NOT NULL THEN
   SELECT * INTO v_state FROM game.roulette_run_state WHERE run_id=v_run.id;
   is_revealed := v_run.status IN ('RESULT','COMPLETED');
   show_answer_key := is_revealed OR v_state.round_phase IN ('REVEAL','TRANSITION','RESULT');

   -- Current round details
   SELECT * INTO v_content FROM game.roulette_content WHERE version=v_version AND round_no=v_state.current_round;
   IF v_content.round_no IS NOT NULL THEN
     curr_round_info := jsonb_build_object(
       'roundNo', v_content.round_no,
       'title', v_content.title,
       'contextText', v_content.context_text,
       'claimText', v_content.claim_text,
       'confidence', v_content.confidence,
       'imagePath', v_content.image_path,
       'isFinalRisk', v_content.is_final_risk,
       -- Only reveal isCorrect and explanation after answering period!
       'isCorrect', CASE WHEN show_answer_key THEN v_content.is_correct ELSE NULL END,
       'explanation', CASE WHEN show_answer_key THEN v_content.explanation ELSE NULL END
     );
   END IF;

   -- Player private state
   IF actor_role='player' THEN
     SELECT * INTO v_player_roster FROM game.rosters WHERE run_id=v_run.id AND actor_id=a;
     IF v_player_roster.member_id IS NOT NULL THEN
       SELECT * INTO v_pstate FROM game.roulette_player_states WHERE run_id=v_run.id AND member_id=v_player_roster.member_id;
       SELECT choice INTO my_ans FROM game.roulette_answers WHERE run_id=v_run.id AND member_id=v_player_roster.member_id AND round_no=v_state.current_round;

       my_state_info := jsonb_build_object(
         'lifeState', v_pstate.life_state,
         'score', v_pstate.score,
         'eliminatedAtRound', v_pstate.eliminated_at_round,
         'eliminatedReason', v_pstate.eliminated_reason,
         'currentChoice', my_ans.choice,
         'myAnswers', (
           SELECT coalesce(jsonb_agg(jsonb_build_object(
             'roundNo', ans.round_no,
             'choice', ans.choice,
             'acceptedAt', ans.accepted_at
           ) ORDER BY ans.round_no), '[]')
           FROM game.roulette_answers ans WHERE ans.run_id=v_run.id AND ans.member_id=v_player_roster.member_id
         )
       );
     END IF;
   END IF;

   -- Past rounds history
   SELECT coalesce(jsonb_agg(jsonb_build_object(
     'roundNo', rc.round_no,
     'title', rc.title,
     'claimText', rc.claim_text,
     'confidence', rc.confidence,
     'isCorrect', rc.is_correct,
     'explanation', rc.explanation,
     'isFinalRisk', rc.is_final_risk,
     'totalAlive', (SELECT count(*) FROM game.roulette_player_states st WHERE st.run_id=v_run.id AND (st.life_state='ALIVE' OR st.eliminated_at_round>rc.round_no)),
     'totalDeaths', (SELECT count(*) FROM game.roulette_player_states st WHERE st.run_id=v_run.id AND st.eliminated_at_round=rc.round_no)
   ) ORDER BY rc.round_no), '[]') INTO past_rounds_info
   FROM game.roulette_content rc
   WHERE rc.version=v_version AND rc.round_no > 0 AND (rc.round_no < v_state.current_round OR (is_revealed AND rc.round_no <= 6));

   -- Group survival breakdown
   SELECT coalesce(jsonb_agg(jsonb_build_object(
     'groupId', g.id,
     'groupName', g.name,
     'alive', (SELECT count(*) FROM game.roulette_player_states rps JOIN game.rosters rst ON rst.run_id=rps.run_id AND rst.member_id=rps.member_id WHERE rps.run_id=v_run.id AND rst.group_id=g.id AND rps.life_state='ALIVE'),
     'total', (SELECT count(*) FROM game.rosters rst WHERE rst.run_id=v_run.id AND rst.group_id=g.id),
     'totalScore', coalesce((SELECT sum(rps.score) FROM game.roulette_player_states rps JOIN game.rosters rst ON rst.run_id=rps.run_id AND rst.member_id=rps.member_id WHERE rps.run_id=v_run.id AND rst.group_id=g.id), 0)
   ) ORDER BY g.id), '[]') INTO group_surv
   FROM game.groups g WHERE room_code=c;

   RETURN jsonb_build_object(
     'contentVersion', v_version,
     'round', v_state.current_round,
     'totalRounds', 6,
     'roundPhase', v_state.round_phase,
     'currentRound', curr_round_info,
     'myState', my_state_info,
     'pastRounds', past_rounds_info,
     'groupSurvival', group_surv,
     'revealed', is_revealed,
     'stats', jsonb_build_object(
       'rosterCount', (SELECT count(*) FROM game.rosters WHERE run_id=v_run.id),
       'aliveCount', (SELECT count(*) FROM game.roulette_player_states WHERE run_id=v_run.id AND life_state='ALIVE'),
       'deadCount', (SELECT count(*) FROM game.roulette_player_states WHERE run_id=v_run.id AND life_state='DEAD'),
       'answeredCount', (SELECT count(*) FROM game.roulette_answers WHERE run_id=v_run.id AND round_no=v_state.current_round)
     )
   );
 ELSE
   -- Preview mode before start
   RETURN jsonb_build_object(
     'contentVersion', v_version,
     'round', 0,
     'totalRounds', 6,
     'roundPhase', 'PREVIEW',
     'currentRound', (SELECT jsonb_build_object('roundNo', round_no, 'title', title, 'contextText', context_text, 'claimText', claim_text, 'confidence', confidence, 'imagePath', image_path, 'isFinalRisk', is_final_risk, 'isCorrect', NULL, 'explanation', NULL) FROM game.roulette_content WHERE version=v_version AND round_no=0),
     'myState', NULL,
     'pastRounds', '[]'::jsonb,
     'groupSurvival', '[]'::jsonb,
     'revealed', false,
     'stats', jsonb_build_object(
       'rosterCount', (SELECT count(*) FROM game.members WHERE room_code=c AND active),
       'aliveCount', (SELECT count(*) FROM game.members WHERE room_code=c AND active),
       'deadCount', 0,
       'answeredCount', 0
     )
   );
 END IF;
END $$;

-- Master dispatchers hooking all four games cleanly together.
CREATE OR REPLACE FUNCTION game.reconcile(p_run uuid) RETURNS void LANGUAGE plpgsql AS $$
DECLARE r game.runs;
BEGIN
 SELECT * INTO r FROM game.runs WHERE id=p_run;
 IF r.game_id = 'confidence-roulette' THEN
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
 IF k IN ('roulette-decision') OR (k='start' AND room.cue='07.01') THEN
   RETURN game.roulette_apply_command(a, c, k, p);
 ELSIF k IN ('caption','moderation','internal-vote','final-vote','caption-content-approve','caption-open-vote') OR (k='start' AND room.cue='04.01') THEN
   RETURN game.caption_apply_command(a, c, k, p);
 ELSE
   RETURN game.apply_base_command(a, c, k, p);
 END IF;
END $$;

CREATE OR REPLACE FUNCTION game.scores(p_run uuid) RETURNS jsonb LANGUAGE plpgsql STABLE AS $$
BEGIN
 IF (SELECT game_id FROM game.runs WHERE id=p_run) = 'confidence-roulette' THEN
   RETURN game.roulette_scores(p_run);
 ELSIF (SELECT game_id FROM game.runs WHERE id=p_run) = 'caption-battle' THEN
   RETURN game.caption_scores(p_run);
 ELSE
   RETURN game.scores_base(p_run);
 END IF;
END $$;

CREATE OR REPLACE FUNCTION game.digest(p_run uuid) RETURNS text LANGUAGE sql STABLE AS $$
 SELECT CASE 
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
 RETURN jsonb_build_object('ok', true, 'data', data);
END $$;

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA game FROM PUBLIC;
