-- Shared Postgres contract. PGlite runs this locally; no browser has DB access.
CREATE SCHEMA IF NOT EXISTS game;
REVOKE ALL ON SCHEMA game FROM PUBLIC;
CREATE TABLE IF NOT EXISTS game.actors (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), role text NOT NULL CHECK(role IN ('player','host','display')),
 token_hash text UNIQUE NOT NULL, created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE IF NOT EXISTS game.rooms (
 code text PRIMARY KEY, host_id uuid NOT NULL REFERENCES game.actors, capacity int NOT NULL CHECK(capacity BETWEEN 1 AND 64),
 cue text NOT NULL DEFAULT '01.02', version int NOT NULL DEFAULT 1, team_locked boolean NOT NULL DEFAULT false,
 preview_id uuid NOT NULL DEFAULT gen_random_uuid(), active_run uuid, latest_run uuid, confirmed_run uuid,
 controller_id text, controller_epoch int NOT NULL DEFAULT 0, lease_until timestamptz,
 practice_id uuid, practice_until timestamptz, created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE IF NOT EXISTS game.groups (
 room_code text NOT NULL REFERENCES game.rooms, id int NOT NULL CHECK(id BETWEEN 1 AND 6), name text NOT NULL,
 PRIMARY KEY(room_code,id)
);
CREATE TABLE IF NOT EXISTS game.members (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), room_code text NOT NULL REFERENCES game.rooms, actor_id uuid NOT NULL REFERENCES game.actors,
 nickname text NOT NULL, group_id int NOT NULL, active boolean NOT NULL DEFAULT true,
 side text NOT NULL DEFAULT 'UNSELECTED' CHECK(side IN ('HUMAN','AI','UNSELECTED')), side_revision int NOT NULL DEFAULT 0,
 ready_preview uuid, ready_version text, seen_at timestamptz NOT NULL DEFAULT clock_timestamp(), joined_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 FOREIGN KEY(room_code,group_id) REFERENCES game.groups(room_code,id)
);
CREATE UNIQUE INDEX IF NOT EXISTS one_active_membership ON game.members(room_code,actor_id) WHERE active;
CREATE INDEX IF NOT EXISTS members_room ON game.members(room_code);
CREATE TABLE IF NOT EXISTS game.runs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), room_code text NOT NULL REFERENCES game.rooms,
 game_id text NOT NULL DEFAULT 'trust-tug', content_version text NOT NULL DEFAULT 'trust-tug-v1', scoring_version text NOT NULL DEFAULT 'tap-10-unlimited-v2',
 schedule_version text NOT NULL DEFAULT 'trust-3-10-v1', timing_profile text NOT NULL DEFAULT 'normal',
 status text NOT NULL DEFAULT 'RUNNING' CHECK(status IN ('RUNNING','RESULT','COMPLETED','CANCELLED','SUPERSEDED')),
 phase text NOT NULL DEFAULT 'COUNTDOWN', phase_token uuid NOT NULL DEFAULT gen_random_uuid(), version int NOT NULL DEFAULT 1,
 phase_start timestamptz NOT NULL, deadline timestamptz, paused boolean NOT NULL DEFAULT false, remaining_ms numeric,
 pause_history jsonb NOT NULL DEFAULT '[]', input_digest text, confirmed_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE UNIQUE INDEX IF NOT EXISTS one_active_run ON game.runs(room_code) WHERE status IN ('RUNNING','RESULT');
CREATE INDEX IF NOT EXISTS runs_room ON game.runs(room_code);
CREATE TABLE IF NOT EXISTS game.rosters (
 run_id uuid NOT NULL REFERENCES game.runs, member_id uuid NOT NULL REFERENCES game.members,
 actor_id uuid NOT NULL REFERENCES game.actors, group_id int NOT NULL, nickname text NOT NULL, side text NOT NULL,
 PRIMARY KEY(run_id,member_id), UNIQUE(run_id,actor_id)
);
CREATE TABLE IF NOT EXISTS game.player_states (
 run_id uuid NOT NULL, member_id uuid NOT NULL, accepted bigint NOT NULL DEFAULT 0 CHECK(accepted >= 0),
 last_sequence int NOT NULL DEFAULT 0, input_epoch int NOT NULL DEFAULT 0, writer_id text,
 PRIMARY KEY(run_id,member_id), FOREIGN KEY(run_id,member_id) REFERENCES game.rosters
);
CREATE TABLE IF NOT EXISTS game.tap_events (
 run_id uuid NOT NULL, member_id uuid NOT NULL, event_id uuid NOT NULL, sequence int NOT NULL, accepted_at timestamptz NOT NULL,
 PRIMARY KEY(run_id,member_id,event_id), UNIQUE(run_id,member_id,sequence), FOREIGN KEY(run_id,member_id) REFERENCES game.rosters
);
CREATE INDEX IF NOT EXISTS taps_window ON game.tap_events(run_id,member_id,accepted_at);
CREATE TABLE IF NOT EXISTS game.swipe_assets (
 content_version text NOT NULL, image_id text NOT NULL, image_path text NOT NULL,
 width int NOT NULL CHECK(width>0), height int NOT NULL CHECK(height>0),
 classification text NOT NULL CHECK(classification IN ('HUMAN','AI')),
 creator text NOT NULL, provenance text NOT NULL, source_url text NOT NULL,
 license text NOT NULL, reveal_text text NOT NULL, generation_prompt text,
 PRIMARY KEY(content_version,image_id), UNIQUE(content_version,image_path)
);
CREATE TABLE IF NOT EXISTS game.swipe_run_state (
 run_id uuid PRIMARY KEY REFERENCES game.runs, current_round int NOT NULL DEFAULT 0 CHECK(current_round BETWEEN 0 AND 8)
);
CREATE TABLE IF NOT EXISTS game.swipe_rounds (
 run_id uuid NOT NULL REFERENCES game.runs, round_no int NOT NULL CHECK(round_no BETWEEN 1 AND 8), image_id text NOT NULL,
 PRIMARY KEY(run_id,round_no), UNIQUE(run_id,image_id)
);
CREATE TABLE IF NOT EXISTS game.swipe_answers (
 run_id uuid NOT NULL, member_id uuid NOT NULL, image_id text NOT NULL,
 choice text NOT NULL CHECK(choice IN ('HUMAN','AI')), is_correct boolean NOT NULL, accepted_at timestamptz NOT NULL,
 PRIMARY KEY(run_id,member_id,image_id),
 FOREIGN KEY(run_id,member_id) REFERENCES game.rosters
);
CREATE INDEX IF NOT EXISTS swipe_answer_stats ON game.swipe_answers(run_id,image_id,choice);
CREATE TABLE IF NOT EXISTS game.receipts (
 actor_id uuid NOT NULL REFERENCES game.actors, room_code text NOT NULL REFERENCES game.rooms, kind text NOT NULL, key text NOT NULL,
 payload_hash text NOT NULL, result jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(actor_id,room_code,kind,key)
);
CREATE TABLE IF NOT EXISTS game.confirmations (
 run_id uuid PRIMARY KEY REFERENCES game.runs, digest text NOT NULL, actor_id uuid NOT NULL REFERENCES game.actors,
 scores jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE IF NOT EXISTS game.audit (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, room_code text NOT NULL REFERENCES game.rooms,
 actor_id uuid NOT NULL REFERENCES game.actors, kind text NOT NULL, payload jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE IF NOT EXISTS game.outbox (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, room_code text NOT NULL REFERENCES game.rooms,
 room_version int NOT NULL, created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS outbox_room_id ON game.outbox(room_code,id);
-- Upgrade databases created by the capped prototype without deleting rehearsal data.
ALTER TABLE game.player_states DROP CONSTRAINT IF EXISTS player_states_accepted_check;
ALTER TABLE game.player_states ALTER COLUMN accepted TYPE bigint USING accepted::bigint;
ALTER TABLE game.runs ALTER COLUMN scoring_version SET DEFAULT 'tap-10-unlimited-v2';
DO $$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='player_states_accepted_nonnegative') THEN
  ALTER TABLE game.player_states ADD CONSTRAINT player_states_accepted_nonnegative CHECK (accepted >= 0);
 END IF;
END $$;
-- Defense in depth. Only the backend DB owner is used by the local runtime.
ALTER TABLE game.actors ENABLE ROW LEVEL SECURITY;
ALTER TABLE game.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE game.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE game.members ENABLE ROW LEVEL SECURITY;
ALTER TABLE game.runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE game.rosters ENABLE ROW LEVEL SECURITY;
ALTER TABLE game.player_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE game.tap_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE game.swipe_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE game.swipe_run_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE game.swipe_rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE game.swipe_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE game.receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE game.confirmations ENABLE ROW LEVEL SECURITY;
ALTER TABLE game.audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE game.outbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA game FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA game REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

CREATE OR REPLACE FUNCTION game.digest_base(p_run uuid) RETURNS text LANGUAGE sql STABLE AS $$
 SELECT CASE WHEN (SELECT game_id FROM game.runs WHERE id=p_run)='ai-or-human' THEN
  md5(coalesce((SELECT string_agg(a.member_id::text||':'||a.image_id||':'||a.choice||':'||a.is_correct::text,',' ORDER BY a.member_id,a.image_id) FROM game.swipe_answers a WHERE a.run_id=p_run),''))
 ELSE md5(coalesce((SELECT string_agg(s.member_id::text || ':' || s.accepted::text, ',' ORDER BY s.member_id) FROM game.player_states s WHERE s.run_id=p_run),'')) END
$$;
CREATE OR REPLACE FUNCTION game.scores_base(p_run uuid) RETURNS jsonb LANGUAGE sql STABLE AS $$
 SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.id),'[]') FROM (
 SELECT g.id,g.name,
  CASE WHEN run.game_id='ai-or-human' THEN coalesce(sum(CASE WHEN a.is_correct THEN 100 ELSE 0 END),0)::bigint
  ELSE coalesce(sum(s.accepted)::bigint*10,0)::bigint END AS numerator,
  count(DISTINCT r.member_id)::int AS denominator
 FROM game.groups g JOIN game.runs run ON run.room_code=g.room_code AND run.id=p_run
 LEFT JOIN game.rosters r ON r.run_id=p_run AND r.group_id=g.id
 LEFT JOIN game.player_states s ON s.run_id=r.run_id AND s.member_id=r.member_id
 LEFT JOIN game.swipe_answers a ON a.run_id=r.run_id AND a.member_id=r.member_id
 GROUP BY g.id,g.name,run.game_id) x
$$;
CREATE OR REPLACE FUNCTION game.reconcile_base(p_run uuid) RETURNS void LANGUAGE plpgsql AS $$
DECLARE r game.runs; n timestamptz; state_round int;
BEGIN
 IF p_run IS NULL THEN RETURN; END IF;
 SELECT * INTO r FROM game.runs WHERE id=p_run;
 IF r.status <> 'RUNNING' OR r.paused OR clock_timestamp() < r.deadline THEN RETURN; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('run:'||p_run,0));
 SELECT * INTO r FROM game.runs WHERE id=p_run FOR UPDATE;
 n:=clock_timestamp();
 IF r.status <> 'RUNNING' OR r.paused OR n < r.deadline THEN RETURN; END IF;
 IF r.game_id='ai-or-human' THEN
  IF r.phase='COUNTDOWN' THEN
   UPDATE game.runs SET phase='ANSWERING',phase_start=r.deadline,deadline=r.deadline+interval '4 seconds',phase_token=gen_random_uuid(),version=version+1 WHERE id=p_run;
   UPDATE game.swipe_run_state SET current_round=1 WHERE run_id=p_run;
   SELECT * INTO r FROM game.runs WHERE id=p_run;
  END IF;
  WHILE r.phase='ANSWERING' AND n>=r.deadline LOOP
   SELECT current_round INTO state_round FROM game.swipe_run_state WHERE run_id=p_run;
   IF state_round>=8 THEN
    UPDATE game.runs SET status='RESULT',phase='REVEAL_ALL',phase_start=r.deadline,deadline=r.deadline+interval '30 seconds',phase_token=gen_random_uuid(),input_digest=game.digest(p_run),version=version+1 WHERE id=p_run;
   ELSE
    UPDATE game.swipe_run_state SET current_round=state_round+1 WHERE run_id=p_run;
    UPDATE game.runs SET phase_start=r.deadline,deadline=r.deadline+interval '4 seconds',phase_token=gen_random_uuid(),version=version+1 WHERE id=p_run;
   END IF;
   SELECT * INTO r FROM game.runs WHERE id=p_run;
  END LOOP;
 ELSE
  IF r.phase='COUNTDOWN' THEN
   UPDATE game.runs SET phase='PULLING',phase_start=r.deadline,deadline=r.deadline+interval '10 seconds',phase_token=gen_random_uuid(),version=version+1 WHERE id=p_run;
   SELECT * INTO r FROM game.runs WHERE id=p_run;
  END IF;
  IF r.phase='PULLING' AND n>=r.deadline THEN
   UPDATE game.runs SET status='RESULT',phase='RESULT',deadline=NULL,phase_token=gen_random_uuid(),input_digest=game.digest(p_run),version=version+1 WHERE id=p_run;
  END IF;
 END IF;
 INSERT INTO game.outbox(room_code,room_version) SELECT code,version FROM game.rooms WHERE code=r.room_code;
END $$;

CREATE OR REPLACE FUNCTION game.swipe_snapshot(a uuid,c text,actor_role text,p_member uuid,p_run uuid,p_now timestamptz) RETURNS jsonb LANGUAGE plpgsql STABLE AS $$
DECLARE r game.runs; state_round int:=0; v_image_id text; answer_count int:=0; roster_count int:=0; my_choice text; revealed boolean:=false; reveal_rows jsonb:='[]'; my_answers jsonb:='[]'; asset_rows jsonb;
BEGIN
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',image_id,'path',image_path,'width',width,'height',height) ORDER BY image_id),'[]') INTO asset_rows
  FROM game.swipe_assets WHERE content_version='swipe-court-v1';
 IF p_run IS NOT NULL THEN SELECT * INTO r FROM game.runs WHERE id=p_run; END IF;
 IF r.id IS NOT NULL AND r.game_id='ai-or-human' THEN
  SELECT current_round INTO state_round FROM game.swipe_run_state WHERE run_id=p_run;
  SELECT sr.image_id INTO v_image_id FROM game.swipe_rounds sr WHERE sr.run_id=p_run AND sr.round_no=state_round;
  SELECT count(*)::int INTO roster_count FROM game.rosters WHERE run_id=p_run;
  IF v_image_id IS NOT NULL THEN
   SELECT count(*)::int INTO answer_count FROM game.swipe_answers WHERE run_id=p_run AND image_id=v_image_id;
   IF actor_role='player' AND p_member IS NOT NULL THEN
    SELECT choice INTO my_choice FROM game.swipe_answers WHERE run_id=p_run AND member_id=p_member AND image_id=v_image_id;
   END IF;
  END IF;
  revealed:=r.phase='REVEAL_ALL' OR (r.status='COMPLETED' AND r.game_id='ai-or-human');
  IF revealed THEN
   SELECT coalesce(jsonb_agg(jsonb_build_object('round',sr.round_no,'imageId',asset.image_id,'path',asset.image_path,'width',asset.width,'height',asset.height,
    'classification',asset.classification,'creator',asset.creator,'provenance',asset.provenance,'sourceUrl',asset.source_url,'license',asset.license,'revealText',asset.reveal_text,'generationPrompt',asset.generation_prompt,
    'answered',stats.answered,'humanVotes',stats.human_votes,'aiVotes',stats.ai_votes,'correctVotes',stats.correct_votes,
    'groupVotes',(SELECT coalesce(jsonb_agg(jsonb_build_object('groupId',g.id,'groupName',g.name,'human',coalesce(gs.human_votes,0),'ai',coalesce(gs.ai_votes,0),'correct',coalesce(gs.correct_votes,0)) ORDER BY g.id),'[]')
      FROM game.groups g LEFT JOIN LATERAL (SELECT count(*) FILTER(WHERE ans.choice='HUMAN')::int human_votes,count(*) FILTER(WHERE ans.choice='AI')::int ai_votes,count(*) FILTER(WHERE ans.is_correct)::int correct_votes
       FROM game.swipe_answers ans JOIN game.rosters ro ON ro.run_id=ans.run_id AND ro.member_id=ans.member_id WHERE ans.run_id=p_run AND ans.image_id=asset.image_id AND ro.group_id=g.id) gs ON true WHERE g.room_code=c)) ORDER BY sr.round_no),'[]') INTO reveal_rows
    FROM game.swipe_rounds sr JOIN game.swipe_assets asset ON asset.content_version=r.content_version AND asset.image_id=sr.image_id
    LEFT JOIN LATERAL (SELECT count(*)::int answered,count(*) FILTER(WHERE choice='HUMAN')::int human_votes,count(*) FILTER(WHERE choice='AI')::int ai_votes,count(*) FILTER(WHERE is_correct)::int correct_votes
     FROM game.swipe_answers WHERE run_id=p_run AND image_id=sr.image_id) stats ON true WHERE sr.run_id=p_run;
   IF actor_role='player' AND p_member IS NOT NULL THEN
    SELECT coalesce(jsonb_agg(jsonb_build_object('imageId',image_id,'choice',choice,'correct',is_correct) ORDER BY sr.round_no),'[]') INTO my_answers
     FROM game.swipe_answers ans JOIN game.swipe_rounds sr USING(run_id,image_id) WHERE ans.run_id=p_run AND ans.member_id=p_member;
   END IF;
  END IF;
  RETURN jsonb_build_object('contentVersion',r.content_version,'assets',asset_rows,'round',state_round,'rounds',8,'currentImageId',v_image_id,'answered',answer_count,'rosterCount',roster_count,
    'myChoice',my_choice,'revealed',revealed,'revealStartedAt',CASE WHEN revealed THEN extract(epoch from r.phase_start)*1000 ELSE NULL END,
    'revealDeadline',CASE WHEN revealed THEN extract(epoch from r.deadline)*1000 ELSE NULL END,
    'reveals',reveal_rows,'myAnswers',my_answers);
 END IF;
 RETURN jsonb_build_object('contentVersion','swipe-court-v1','assets',asset_rows,'round',0,'rounds',8,'currentImageId',NULL,'answered',0,'rosterCount',0,'myChoice',NULL,'revealed',false,'reveals',reveal_rows,'myAnswers',my_answers);
END $$;

CREATE OR REPLACE FUNCTION game.apply_base_command(a uuid,c text,k text,p jsonb) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE room game.rooms; actor game.actors; m game.members; r game.runs; s game.player_states; n timestamptz;
 rr uuid; e jsonb; result_events jsonb:='[]'; why text; count_accepted int:=0; reason text; new_game text; v_image_id text; class_name text; correct_answer boolean; original_choice text;
BEGIN
 SELECT * INTO actor FROM game.actors WHERE id=a;
 SELECT * INTO room FROM game.rooms WHERE code=c;
 IF room.code IS NULL THEN RAISE EXCEPTION 'ROOM_NOT_FOUND'; END IF;
 IF k IN ('join','side','ready','leave','group','start','practice','acquire','heartbeat','pause','resume','finish','cancel','replay','cue','rename','move') THEN
  SELECT * INTO room FROM game.rooms WHERE code=c FOR UPDATE;
 END IF;
 SELECT * INTO m FROM game.members WHERE room_code=c AND actor_id=a AND active;
 IF actor.role='player' THEN
  IF k='join' THEN
   IF m.id IS NOT NULL THEN RETURN jsonb_build_object('memberId',m.id); END IF;
   IF (SELECT count(*) FROM game.members WHERE room_code=c AND active)>=room.capacity THEN RAISE EXCEPTION 'ROOM_FULL'; END IF;
   IF length(btrim(p->>'nickname')) NOT BETWEEN 1 AND 24 OR (p->>'groupId')::int NOT BETWEEN 1 AND 6 THEN RAISE EXCEPTION 'INVALID_PLAYER'; END IF;
   INSERT INTO game.members(room_code,actor_id,nickname,group_id) VALUES(c,a,btrim(p->>'nickname'),(p->>'groupId')::int) RETURNING * INTO m;
   RETURN jsonb_build_object('memberId',m.id);
  END IF;
  IF m.id IS NULL THEN RAISE EXCEPTION 'NOT_A_MEMBER'; END IF;
  IF k='leave' THEN
   IF room.active_run IS NOT NULL THEN PERFORM pg_advisory_xact_lock(hashtextextended('run:'||room.active_run,0)); END IF;
   UPDATE game.members SET active=false WHERE id=m.id; RETURN '{"left":true}';
  END IF;
  IF k='group' THEN
   IF room.team_locked THEN RAISE EXCEPTION 'TEAMS_LOCKED'; END IF;
   UPDATE game.members SET group_id=(p->>'groupId')::int WHERE id=m.id; RETURN '{"updated":true}';
  END IF;
  IF k IN ('side','ready') THEN
   IF room.active_run IS NOT NULL OR room.cue NOT IN ('02.01','03.05','04.01','07.01','10.02','11.02','14.01') OR (p->>'previewId')::uuid<>room.preview_id OR (k='side' AND room.cue<>'02.01') THEN RAISE EXCEPTION 'PREVIEW_CLOSED'; END IF;
   IF k='side' THEN
    IF (p->>'expectedRevision')::int<>m.side_revision THEN RAISE EXCEPTION 'STALE_REVISION'; END IF;
    IF p->>'side' NOT IN ('HUMAN','AI') THEN RAISE EXCEPTION 'INVALID_SIDE'; END IF;
    UPDATE game.members SET side=p->>'side',side_revision=side_revision+1 WHERE id=m.id;
    RETURN jsonb_build_object('side',p->>'side','revision',m.side_revision+1);
   END IF;
   IF (room.cue='02.01' AND p->>'contentVersion'<>'trust-tug-v1') OR (room.cue='03.05' AND p->>'contentVersion'<>'swipe-court-v1') OR (room.cue='04.01' AND p->>'contentVersion'<>'caption-battle-v1') OR (room.cue='07.01' AND p->>'contentVersion'<>'roulette-v1') OR (room.cue='10.02' AND p->>'contentVersion'<>'whack-a-mole-v1') OR (room.cue='11.02' AND p->>'contentVersion'<>'shield-v1') OR (room.cue='14.01' AND p->>'contentVersion'<>'piece-v1') THEN RAISE EXCEPTION 'CONTENT_VERSION'; END IF;
   UPDATE game.members SET ready_preview=room.preview_id,ready_version=p->>'contentVersion',seen_at=clock_timestamp() WHERE id=m.id;
   RETURN '{"ready":true}';
  END IF;
  IF k NOT IN ('writer','tap','answer') THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  rr:=(p->>'runId')::uuid;
  SELECT * INTO r FROM game.runs WHERE id=rr AND room_code=c;
  IF r.id IS NULL THEN RAISE EXCEPTION 'RUN_NOT_FOUND'; END IF;
  PERFORM game.reconcile(rr);
  PERFORM pg_advisory_xact_lock_shared(hashtextextended('run:'||rr,0));
  IF NOT EXISTS(SELECT 1 FROM game.members WHERE id=m.id AND active) THEN RAISE EXCEPTION 'NOT_A_MEMBER'; END IF;
  SELECT * INTO r FROM game.runs WHERE id=rr;
  SELECT ps.* INTO s FROM game.player_states ps JOIN game.rosters ro USING(run_id,member_id) WHERE ps.run_id=rr AND ro.member_id=m.id AND ro.actor_id=a FOR UPDATE OF ps;
  IF s.member_id IS NULL THEN RAISE EXCEPTION 'NOT_IN_ROSTER'; END IF;
  n:=clock_timestamp();
  IF k='answer' THEN
   IF r.game_id<>'ai-or-human' OR r.status<>'RUNNING' OR r.phase<>'ANSWERING' OR r.paused OR n<r.phase_start OR n>=r.deadline THEN RAISE EXCEPTION 'INPUT_CLOSED'; END IF;
   IF (p->>'phaseToken')::uuid<>r.phase_token THEN RAISE EXCEPTION 'STALE_PHASE'; END IF;
   SELECT sr.image_id INTO v_image_id FROM game.swipe_run_state state JOIN game.swipe_rounds sr ON sr.run_id=state.run_id AND sr.round_no=state.current_round WHERE state.run_id=rr;
   IF v_image_id IS NULL OR p->>'imageId' IS DISTINCT FROM v_image_id THEN RAISE EXCEPTION 'STALE_IMAGE'; END IF;
   SELECT ans.choice INTO original_choice FROM game.swipe_answers ans WHERE ans.run_id=rr AND ans.member_id=m.id AND ans.image_id=v_image_id;
   IF original_choice IS NOT NULL THEN RETURN jsonb_build_object('accepted',true,'duplicate',true,'imageId',v_image_id,'choice',original_choice); END IF;
   SELECT asset.classification INTO class_name FROM game.swipe_assets asset WHERE asset.content_version=r.content_version AND asset.image_id=v_image_id;
   IF class_name IS NULL THEN RAISE EXCEPTION 'CONTENT_MISSING'; END IF;
   correct_answer:=class_name=(p->>'choice');
   INSERT INTO game.swipe_answers(run_id,member_id,image_id,choice,is_correct,accepted_at) VALUES(rr,m.id,v_image_id,p->>'choice',correct_answer,n) ON CONFLICT(run_id,member_id,image_id) DO NOTHING;
   GET DIAGNOSTICS count_accepted=ROW_COUNT;
   IF count_accepted=0 THEN SELECT ans.choice INTO original_choice FROM game.swipe_answers ans WHERE ans.run_id=rr AND ans.member_id=m.id AND ans.image_id=v_image_id; RETURN jsonb_build_object('accepted',true,'duplicate',true,'imageId',v_image_id,'choice',original_choice); END IF;
   RETURN jsonb_build_object('accepted',true,'duplicate',false,'imageId',v_image_id,'choice',p->>'choice','acceptedAt',extract(epoch from n)*1000);
  END IF;
  IF k='writer' THEN
   IF r.status<>'RUNNING' OR r.paused THEN RAISE EXCEPTION 'INPUT_CLOSED'; END IF;
   UPDATE game.player_states SET writer_id=p->>'writerId',input_epoch=input_epoch+1 WHERE run_id=rr AND member_id=m.id;
   RETURN jsonb_build_object('inputEpoch',s.input_epoch+1,'accepted',s.accepted);
  END IF;
  IF r.status<>'RUNNING' OR r.phase<>'PULLING' OR r.paused OR n<r.phase_start OR n>=r.deadline THEN RAISE EXCEPTION 'INPUT_CLOSED'; END IF;
  IF (p->>'phaseToken')::uuid<>r.phase_token THEN RAISE EXCEPTION 'STALE_PHASE'; END IF;
  IF p->>'writerId' IS DISTINCT FROM s.writer_id OR (p->>'inputEpoch')::int<>s.input_epoch THEN RAISE EXCEPTION 'STALE_WRITER'; END IF;
  IF (SELECT side FROM game.rosters WHERE run_id=rr AND member_id=m.id)='UNSELECTED' THEN RAISE EXCEPTION 'SIDE_UNSELECTED'; END IF;
  FOR e IN SELECT value FROM jsonb_array_elements(p->'events') LOOP
   why:=NULL;
   IF EXISTS(SELECT 1 FROM game.tap_events WHERE run_id=rr AND member_id=m.id AND event_id=(e->>'id')::uuid AND sequence=(e->>'sequence')::int) THEN
    result_events:=result_events||jsonb_build_object('id',e->>'id','accepted',true,'duplicate',true); CONTINUE;
   END IF;
   IF EXISTS(SELECT 1 FROM game.tap_events WHERE run_id=rr AND member_id=m.id AND event_id=(e->>'id')::uuid) THEN RAISE EXCEPTION 'EVENT_CONFLICT'; END IF;
   IF (e->>'sequence')::int<=s.last_sequence THEN why:='STALE_SEQUENCE';
   END IF;
   s.last_sequence:=greatest(s.last_sequence,(e->>'sequence')::int);
   IF why IS NULL THEN
    INSERT INTO game.tap_events VALUES(rr,m.id,(e->>'id')::uuid,(e->>'sequence')::int,n);
    s.accepted:=s.accepted+1; count_accepted:=count_accepted+1;
   END IF;
   result_events:=result_events||jsonb_build_object('id',e->>'id','accepted',why IS NULL,'reason',why);
  END LOOP;
  UPDATE game.player_states SET accepted=s.accepted,last_sequence=s.last_sequence WHERE run_id=rr AND member_id=m.id;
  RETURN jsonb_build_object('accepted',s.accepted,'added',count_accepted,'events',result_events,'acceptedAt',extract(epoch from n)*1000);
 END IF;
 IF actor.role<>'host' OR room.host_id<>a THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 n:=clock_timestamp();
 IF k='acquire' THEN
  IF room.controller_id IS DISTINCT FROM p->>'controllerId' AND room.lease_until>n AND coalesce(p->>'reason','')='' THEN RAISE EXCEPTION 'CONTROL_BUSY'; END IF;
  IF room.controller_id IS DISTINCT FROM p->>'controllerId' THEN
   UPDATE game.rooms SET controller_id=p->>'controllerId',controller_epoch=controller_epoch+1,lease_until=n+interval '20 seconds' WHERE code=c RETURNING * INTO room;
  ELSE UPDATE game.rooms SET lease_until=n+interval '20 seconds' WHERE code=c; END IF;
  RETURN jsonb_build_object('controllerEpoch',room.controller_epoch);
 END IF;
 IF room.controller_id IS DISTINCT FROM p->>'controllerId' OR room.controller_epoch<>(p->>'controllerEpoch')::int OR room.lease_until<=n THEN RAISE EXCEPTION 'STALE_CONTROLLER'; END IF;
 IF k='heartbeat' THEN UPDATE game.rooms SET lease_until=n+interval '20 seconds' WHERE code=c; RETURN '{"alive":true}'; END IF;
 IF room.version<>(p->>'expectedVersion')::int THEN RAISE EXCEPTION 'STALE_VERSION'; END IF;
 IF k='start' THEN
  IF room.active_run IS NOT NULL THEN RAISE EXCEPTION 'RUN_ACTIVE'; END IF;
  new_game:=CASE room.cue WHEN '02.01' THEN 'trust-tug' WHEN '03.05' THEN 'ai-or-human' ELSE NULL END;
  IF new_game IS NULL THEN RAISE EXCEPTION 'WRONG_CUE'; END IF;
  IF room.latest_run IS NOT NULL AND (SELECT status FROM game.runs WHERE id=room.latest_run)='COMPLETED' AND (SELECT game_id FROM game.runs WHERE id=room.latest_run)=new_game THEN RAISE EXCEPTION 'REPLAY_REQUIRED'; END IF;
  IF room.practice_until>n THEN RAISE EXCEPTION 'PRACTICE_ACTIVE'; END IF;
  IF new_game='ai-or-human' AND ((SELECT count(*) FROM game.swipe_assets WHERE content_version='swipe-court-v1')<>8 OR
    (SELECT count(*) FROM game.swipe_assets WHERE content_version='swipe-court-v1' AND classification='HUMAN')<>4 OR
    (SELECT count(*) FROM game.swipe_assets WHERE content_version='swipe-court-v1' AND classification='AI')<>4) THEN RAISE EXCEPTION 'CONTENT_INVALID'; END IF;
  INSERT INTO game.runs(room_code,game_id,content_version,scoring_version,schedule_version,timing_profile,phase_start,deadline)
   VALUES(c,new_game,CASE new_game WHEN 'ai-or-human' THEN 'swipe-court-v1' ELSE 'trust-tug-v1' END,
    CASE new_game WHEN 'ai-or-human' THEN 'swipe-100-no-speed-v1' ELSE 'tap-10-unlimited-v2' END,
    CASE new_game WHEN 'ai-or-human' THEN 'swipe-3-8x4-8x3-v1' ELSE 'trust-3-10-v1' END,
    CASE new_game WHEN 'ai-or-human' THEN 'normal' ELSE coalesce(p->>'timingProfile','normal') END,n,n+interval '3 seconds') RETURNING * INTO r;
  INSERT INTO game.rosters SELECT r.id,id,actor_id,group_id,nickname,side FROM game.members WHERE room_code=c AND active;
  INSERT INTO game.player_states(run_id,member_id) SELECT r.id,member_id FROM game.rosters WHERE run_id=r.id;
  IF new_game='ai-or-human' THEN
   INSERT INTO game.swipe_run_state(run_id,current_round) VALUES(r.id,0);
   INSERT INTO game.swipe_rounds(run_id,round_no,image_id)
    SELECT r.id,row_number() OVER(ORDER BY random())::int,image_id FROM game.swipe_assets WHERE content_version=r.content_version;
  END IF;
  UPDATE game.rooms SET active_run=r.id,latest_run=r.id,team_locked=true,version=version+1,practice_until=NULL WHERE code=c;
  RETURN jsonb_build_object('runId',r.id,'unready',(SELECT count(*) FROM game.members WHERE room_code=c AND active AND (ready_preview IS DISTINCT FROM room.preview_id OR ready_version IS DISTINCT FROM CASE new_game WHEN 'ai-or-human' THEN 'swipe-court-v1' ELSE 'trust-tug-v1' END)));
 END IF;
 IF k='practice' THEN
  IF room.active_run IS NOT NULL OR room.cue<>'02.01' THEN RAISE EXCEPTION 'RUN_ACTIVE'; END IF;
  UPDATE game.rooms SET practice_id=gen_random_uuid(),practice_until=n+interval '15 seconds',version=version+1 WHERE code=c;
  RETURN '{"practice":true}';
 END IF;
 IF k='cue' THEN
  IF room.active_run IS NOT NULL THEN RAISE EXCEPTION 'NAVIGATION_LOCKED'; END IF;
  UPDATE game.rooms SET cue=p->>'cue',version=version+1 WHERE code=c; RETURN '{"navigated":true}';
 END IF;
 IF k='rename' THEN
  IF length(btrim(p->>'name')) NOT BETWEEN 1 AND 32 THEN RAISE EXCEPTION 'INVALID_NAME'; END IF;
  UPDATE game.groups SET name=btrim(p->>'name') WHERE room_code=c AND id=(p->>'groupId')::int;
  UPDATE game.rooms SET version=version+1 WHERE code=c; RETURN '{"renamed":true}';
 END IF;
 IF k='move' THEN
  IF length(btrim(p->>'reason'))<1 THEN RAISE EXCEPTION 'REASON_REQUIRED'; END IF;
  UPDATE game.members SET group_id=(p->>'groupId')::int WHERE room_code=c AND id=(p->>'memberId')::uuid AND active;
  UPDATE game.rooms SET version=version+1 WHERE code=c; RETURN '{"moved":true}';
 END IF;
 rr:=room.active_run;
 IF k='replay' THEN rr:=room.latest_run; END IF;
 IF rr IS NULL THEN RAISE EXCEPTION 'NO_ACTIVE_RUN'; END IF;
 PERFORM game.reconcile(rr);
 PERFORM pg_advisory_xact_lock(hashtextextended('run:'||rr,0));
 SELECT * INTO r FROM game.runs WHERE id=rr FOR UPDATE;
 n:=clock_timestamp();
 IF k='pause' THEN
  IF r.status<>'RUNNING' OR r.paused THEN RAISE EXCEPTION 'CANNOT_PAUSE'; END IF;
  UPDATE game.runs SET paused=true,remaining_ms=greatest(0,extract(epoch from(deadline-n))*1000),phase_token=gen_random_uuid(),version=version+1,pause_history=pause_history||jsonb_build_object('pauseAt',n,'phase',phase) WHERE id=rr;
 ELSIF k='resume' THEN
  IF NOT r.paused THEN RAISE EXCEPTION 'NOT_PAUSED'; END IF;
  UPDATE game.runs SET paused=false,deadline=n+(remaining_ms::text||' milliseconds')::interval,phase_token=gen_random_uuid(),version=version+1,pause_history=pause_history||jsonb_build_object('resumeAt',n) WHERE id=rr;
 ELSIF k='finish' THEN
  IF r.status<>'RESULT' THEN RAISE EXCEPTION 'GAME_NOT_FINISHABLE'; END IF;
  IF r.game_id='ai-or-human' AND (r.phase<>'REVEAL_ALL' OR r.deadline IS NULL OR n<r.deadline) THEN RAISE EXCEPTION 'GAME_NOT_FINISHABLE'; END IF;
  IF p->>'inputDigest' IS DISTINCT FROM r.input_digest OR r.input_digest<>game.digest(rr) THEN RAISE EXCEPTION 'DIGEST_CHANGED'; END IF;
  INSERT INTO game.confirmations(run_id,digest,actor_id,scores) VALUES(rr,r.input_digest,a,game.scores(rr));
  UPDATE game.runs SET status='COMPLETED',confirmed_at=n,version=version+1 WHERE id=rr;
  UPDATE game.rooms SET active_run=NULL,confirmed_run=rr,cue=CASE r.game_id WHEN 'ai-or-human' THEN '03.03' WHEN 'caption-battle' THEN '04.02' WHEN 'confidence-roulette' THEN '07.02' WHEN 'chat-whack-a-mole' THEN '10.03' WHEN 'company-shield' THEN '11.03' WHEN 'missing-piece' THEN '15.01' ELSE '03.01' END WHERE code=c;
 ELSIF k IN ('cancel','replay') THEN
  reason:=btrim(p->>'reason'); IF reason IS NULL OR length(reason)<1 THEN RAISE EXCEPTION 'REASON_REQUIRED'; END IF;
  IF k='cancel' AND r.status NOT IN ('RUNNING','RESULT') THEN RAISE EXCEPTION 'CANNOT_CANCEL'; END IF;
  UPDATE game.runs SET status=CASE WHEN k='cancel' THEN 'CANCELLED' ELSE 'SUPERSEDED' END,deadline=NULL,paused=false,phase_token=gen_random_uuid(),version=version+1 WHERE id=rr;
  UPDATE game.rooms SET active_run=NULL,confirmed_run=CASE WHEN confirmed_run=rr THEN NULL ELSE confirmed_run END,
   preview_id=gen_random_uuid(),cue=CASE WHEN k='replay' THEN CASE r.game_id WHEN 'ai-or-human' THEN '03.05' WHEN 'caption-battle' THEN '04.01' WHEN 'confidence-roulette' THEN '07.01' WHEN 'chat-whack-a-mole' THEN '10.02' WHEN 'company-shield' THEN '11.02' WHEN 'missing-piece' THEN '14.01' ELSE '02.01' END ELSE cue END WHERE code=c;
  IF k='replay' AND r.game_id='trust-tug' THEN UPDATE game.members SET side='UNSELECTED',side_revision=side_revision+1,ready_preview=NULL,ready_version=NULL WHERE room_code=c AND active; END IF;
  IF k='replay' AND r.game_id IN ('ai-or-human','caption-battle','confidence-roulette','chat-whack-a-mole','company-shield','missing-piece') THEN UPDATE game.members SET ready_preview=NULL,ready_version=NULL WHERE room_code=c AND active; END IF;
 ELSE RAISE EXCEPTION 'UNKNOWN_COMMAND'; END IF;
 UPDATE game.rooms SET version=version+1 WHERE code=c;
 RETURN jsonb_build_object('runId',rr,'command',k);
END $$;

CREATE OR REPLACE FUNCTION game.command(a uuid,c text,k text,p jsonb,receipt_key text) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE old game.receipts; result jsonb; ph text:=md5(p::text); err text;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM game.actors WHERE id=a) THEN RETURN '{"ok":false,"error":"UNAUTHORIZED"}'; END IF;
 IF NOT EXISTS(SELECT 1 FROM game.rooms WHERE code=c) THEN RETURN '{"ok":false,"error":"ROOM_NOT_FOUND"}'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(a::text||c||k||receipt_key,0));
 SELECT * INTO old FROM game.receipts WHERE actor_id=a AND room_code=c AND kind=k AND key=receipt_key;
 IF old.key IS NOT NULL THEN
  IF old.payload_hash<>ph THEN RETURN '{"ok":false,"error":"IDEMPOTENCY_CONFLICT"}'; END IF;
  RETURN old.result;
 END IF;
 BEGIN
  result:=jsonb_build_object('ok',true,'data',game.apply_command(a,c,k,p));
 EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS err=MESSAGE_TEXT; result:=jsonb_build_object('ok',false,'error',err);
 END;
 INSERT INTO game.receipts VALUES(a,c,k,receipt_key,ph,result,clock_timestamp());
 IF result->>'ok'='true' AND k NOT IN ('tap','ready','heartbeat','writer','answer') THEN
  INSERT INTO game.audit(room_code,actor_id,kind,payload) VALUES(c,a,k,p);
  INSERT INTO game.outbox(room_code,room_version) SELECT code,version FROM game.rooms WHERE code=c;
 END IF;
 RETURN result;
END $$;

CREATE OR REPLACE FUNCTION game.snapshot_base(a uuid,c text) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE room game.rooms; actor game.actors; m game.members; r game.runs; private_state jsonb; host_data jsonb; group_data jsonb; sides jsonb; n timestamptz;
BEGIN
 SELECT * INTO actor FROM game.actors WHERE id=a;
 IF actor.id IS NULL THEN RETURN '{"ok":false,"error":"UNAUTHORIZED"}'; END IF;
 SELECT * INTO room FROM game.rooms WHERE code=c;
 IF room.code IS NULL THEN RETURN '{"ok":false,"error":"ROOM_NOT_FOUND"}'; END IF;
 IF actor.role='host' AND room.host_id<>a THEN RETURN '{"ok":false,"error":"FORBIDDEN"}'; END IF;
 IF actor.role='player' THEN
  SELECT * INTO m FROM game.members WHERE room_code=c AND actor_id=a AND active;
  IF m.id IS NULL THEN RETURN '{"ok":false,"error":"NOT_A_MEMBER"}'; END IF;
  UPDATE game.members SET seen_at=clock_timestamp() WHERE id=m.id;
 END IF;
 PERFORM game.reconcile(room.active_run);
 SELECT * INTO r FROM game.runs WHERE id=coalesce(room.active_run,room.latest_run);
 n:=clock_timestamp();
 SELECT jsonb_agg(jsonb_build_object('id',g.id,'name',g.name,'members',(SELECT count(*) FROM game.members WHERE room_code=c AND group_id=g.id AND active))) INTO group_data FROM game.groups g WHERE room_code=c;
 IF actor.role='player' THEN
  private_state:=jsonb_build_object('memberId',m.id,'nickname',m.nickname,'groupId',m.group_id,'side',m.side,'sideRevision',m.side_revision,'ready',m.ready_preview=room.preview_id AND m.ready_version=CASE room.cue WHEN '03.05' THEN 'swipe-court-v1' WHEN '04.01' THEN 'caption-battle-v1' WHEN '07.01' THEN 'roulette-v1' WHEN '10.02' THEN 'whack-a-mole-v1' WHEN '11.02' THEN 'shield-v1' WHEN '14.01' THEN 'piece-v1' WHEN '02.01' THEN 'trust-tug-v1' ELSE NULL END,
   'inRoster',EXISTS(SELECT 1 FROM game.rosters WHERE run_id=r.id AND member_id=m.id),'state',(SELECT to_jsonb(s)-'member_id'-'run_id' FROM game.player_states s WHERE run_id=r.id AND member_id=m.id),
   'lockedSide',(SELECT side FROM game.rosters WHERE run_id=r.id AND member_id=m.id),
   'roster',(SELECT coalesce(jsonb_agg(jsonb_build_object('nickname',ro.nickname)), '[]') FROM game.rosters ro WHERE ro.run_id=r.id AND ro.group_id=(SELECT group_id FROM game.rosters WHERE run_id=r.id AND member_id=m.id)));
 END IF;
 IF actor.role='host' THEN
  host_data:=jsonb_build_object('controllerId',room.controller_id,'controllerEpoch',room.controller_epoch,'leaseUntil',extract(epoch from room.lease_until)*1000,
   'unready',CASE WHEN room.cue IN ('02.01','03.05','04.01','07.01','10.02','11.02','14.01') THEN (SELECT count(*) FROM game.members WHERE room_code=c AND active AND (ready_preview IS DISTINCT FROM room.preview_id OR ready_version IS DISTINCT FROM CASE room.cue WHEN '03.05' THEN 'swipe-court-v1' WHEN '04.01' THEN 'caption-battle-v1' WHEN '07.01' THEN 'roulette-v1' WHEN '10.02' THEN 'whack-a-mole-v1' WHEN '11.02' THEN 'shield-v1' WHEN '14.01' THEN 'piece-v1' ELSE 'trust-tug-v1' END)) ELSE 0 END,
   'members',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'nickname',nickname,'groupId',group_id,'side',side,
    'ready',ready_preview=room.preview_id AND ready_version=CASE room.cue WHEN '03.05' THEN 'swipe-court-v1' WHEN '04.01' THEN 'caption-battle-v1' WHEN '07.01' THEN 'roulette-v1' WHEN '10.02' THEN 'whack-a-mole-v1' WHEN '11.02' THEN 'shield-v1' WHEN '14.01' THEN 'piece-v1' WHEN '02.01' THEN 'trust-tug-v1' ELSE NULL END,'online',seen_at>n-interval '10 seconds')), '[]') FROM game.members WHERE room_code=c AND active),'inputDigest',r.input_digest);
 END IF;
 IF room.active_run IS NOT NULL OR r.status IN ('RESULT','COMPLETED') THEN
  SELECT jsonb_object_agg(x.side,jsonb_build_object('taps',x.taps,'members',x.members)) INTO sides FROM (
   SELECT ro.side,count(*)::int members,sum(s.accepted)::bigint taps FROM game.rosters ro JOIN game.player_states s USING(run_id,member_id) WHERE ro.run_id=r.id GROUP BY ro.side) x;
 ELSE
  SELECT jsonb_object_agg(x.side,jsonb_build_object('taps',0,'members',x.members)) INTO sides FROM (SELECT side,count(*)::int members FROM game.members WHERE room_code=c AND active GROUP BY side) x;
 END IF;
 RETURN jsonb_build_object('ok',true,'data',jsonb_build_object('serverNow',extract(epoch from n)*1000,'role',actor.role,
  'room',jsonb_build_object('code',c,'cue',room.cue,'version',room.version,'capacity',room.capacity,'teamLocked',room.team_locked,'previewId',room.preview_id,'practiceId',room.practice_id,'practiceUntil',extract(epoch from room.practice_until)*1000,'activeRunId',room.active_run,'confirmedRunId',room.confirmed_run),
  'run',CASE WHEN r.id IS NULL THEN NULL ELSE jsonb_build_object('id',r.id,'gameId',r.game_id,'status',r.status,'phase',r.phase,'phaseToken',r.phase_token,'version',r.version,'paused',r.paused,'remainingMs',r.remaining_ms,'deadline',extract(epoch from r.deadline)*1000,'phaseStart',extract(epoch from r.phase_start)*1000,'contentVersion',r.content_version,'scoringVersion',r.scoring_version) END,
  'groups',group_data,'sides',coalesce(sides,'{}'),'scores',CASE WHEN r.status IN ('RESULT','COMPLETED') THEN game.scores(r.id) ELSE NULL END,
  'confirmedScores',(SELECT scores FROM game.confirmations WHERE run_id=room.confirmed_run),'me',private_state,'host',host_data,
  'swipe',CASE WHEN room.cue='03.05' OR r.game_id='ai-or-human' THEN game.swipe_snapshot(a,c,actor.role,m.id,r.id,n) ELSE NULL END));
END $$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA game FROM PUBLIC;
