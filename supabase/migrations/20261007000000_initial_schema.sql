-- Source: db\schema.sql
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


-- Source: db\caption.sql
-- Creative-game extension. All writes use the same receipts, controller lease,
-- roster freeze, publication barrier and server clock as the first two games.
CREATE TABLE IF NOT EXISTS game.caption_content (
 version text PRIMARY KEY,image_path text NOT NULL,image_alt text NOT NULL,task text NOT NULL,
 ai_caption text NOT NULL,ai_metadata jsonb NOT NULL
);
CREATE TABLE IF NOT EXISTS game.caption_approvals (
 room_code text PRIMARY KEY REFERENCES game.rooms,preview_id uuid NOT NULL,content_version text NOT NULL REFERENCES game.caption_content,
 actor_id uuid NOT NULL REFERENCES game.actors,approved_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS game.caption_submissions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),run_id uuid NOT NULL,member_id uuid NOT NULL,text text NOT NULL,
 revision int NOT NULL CHECK(revision>0),graphemes int NOT NULL CHECK(graphemes BETWEEN 0 AND 80),
 first_at timestamptz NOT NULL,updated_at timestamptz NOT NULL,submitted boolean NOT NULL DEFAULT false,
 locked_revision int,decision text NOT NULL DEFAULT 'PENDING' CHECK(decision IN ('PENDING','APPROVED','REJECTED','WITHHELD')),
 reviewed_revision int,review_version int NOT NULL DEFAULT 0,reviewer uuid REFERENCES game.actors,reason text,
 UNIQUE(run_id,member_id),FOREIGN KEY(run_id,member_id) REFERENCES game.rosters
);
CREATE TABLE IF NOT EXISTS game.caption_candidates (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),run_id uuid NOT NULL REFERENCES game.runs,submission_id uuid REFERENCES game.caption_submissions,
 group_id int CHECK(group_id BETWEEN 1 AND 6),text text NOT NULL,position int NOT NULL,
 UNIQUE(run_id,position),UNIQUE(run_id,group_id)
);
CREATE TABLE IF NOT EXISTS game.caption_votes (
 run_id uuid NOT NULL,member_id uuid NOT NULL,vote_type text NOT NULL CHECK(vote_type IN ('INTERNAL','FINAL')),
 candidate_id uuid NOT NULL,revision int NOT NULL CHECK(revision>0),accepted_at timestamptz NOT NULL,
 PRIMARY KEY(run_id,member_id,vote_type),FOREIGN KEY(run_id,member_id) REFERENCES game.rosters
);
ALTER TABLE game.caption_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE game.caption_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE game.caption_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE game.caption_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE game.caption_votes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA game FROM PUBLIC;

CREATE OR REPLACE FUNCTION game.caption_support(rr uuid,owner_group int,target uuid) RETURNS TABLE(numerator numeric,denominator numeric) LANGUAGE plpgsql STABLE AS $$
DECLARE counts record;common_den numeric:=1;eligible_count int:=0;total numeric:=0;vote_count numeric;
BEGIN
 FOR counts IN SELECT group_id,count(*)::numeric n FROM game.rosters WHERE run_id=rr AND (owner_group IS NULL OR group_id<>owner_group) GROUP BY group_id LOOP
  common_den:=common_den*counts.n;eligible_count:=eligible_count+1;
 END LOOP;
 IF eligible_count=0 THEN RETURN QUERY SELECT 0::numeric,1::numeric;RETURN;END IF;
 FOR counts IN SELECT group_id,count(*)::numeric n FROM game.rosters WHERE run_id=rr AND (owner_group IS NULL OR group_id<>owner_group) GROUP BY group_id LOOP
  SELECT count(*)::numeric INTO vote_count FROM game.caption_votes vote JOIN game.rosters ro ON ro.run_id=vote.run_id AND ro.member_id=vote.member_id
  WHERE vote.run_id=rr AND vote.vote_type='FINAL' AND vote.candidate_id=target AND ro.group_id=counts.group_id;
  total:=total+vote_count*(common_den/counts.n);
 END LOOP;
 RETURN QUERY SELECT total,common_den*eligible_count;
END $$;
CREATE OR REPLACE FUNCTION game.caption_results(rr uuid) RETURNS jsonb LANGUAGE sql STABLE AS $$
 WITH weighted AS (
 SELECT candidate.*,fraction.numerator support_num,fraction.denominator support_den,fraction.numerator/fraction.denominator support,
 (SELECT count(*)::int FROM game.caption_votes WHERE run_id=rr AND vote_type='FINAL' AND candidate_id=candidate.id) votes
 FROM game.caption_candidates candidate CROSS JOIN LATERAL game.caption_support(rr,candidate.group_id,candidate.id) fraction WHERE candidate.run_id=rr),
 best AS (SELECT support_num best_num,support_den best_den FROM weighted ORDER BY support DESC LIMIT 1),
 scored AS (SELECT * FROM weighted CROSS JOIN best)
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'text',text,'position',position,'groupId',group_id,
 'author',CASE WHEN group_id IS NULL THEN 'AI' ELSE (SELECT nickname FROM game.rosters ro JOIN game.caption_submissions sub ON sub.run_id=ro.run_id AND sub.member_id=ro.member_id WHERE sub.id=submission_id) END,
 'groupName',CASE WHEN group_id IS NULL THEN 'AI' ELSE (SELECT name FROM game.groups WHERE room_code=(SELECT room_code FROM game.runs WHERE id=rr) AND game.groups.id=group_id) END,
 'votes',votes,'support',support,'supportExact',support_num::text||'/'||support_den::text,
 'supportNumerator',support_num,'supportDenominator',support_den,
 'score',CASE WHEN best_num>0 THEN round(1000*support_num*best_den/(support_den*best_num))::int ELSE 0 END,
 'winner',best_num>0 AND support_num*best_den=best_num*support_den) ORDER BY position),'[]') FROM scored
$$;
CREATE OR REPLACE FUNCTION game.caption_digest(p_run uuid) RETURNS text LANGUAGE sql STABLE AS $$
 SELECT md5(coalesce((SELECT string_agg(id::text||':'||revision||':'||text||':'||decision||':'||coalesce(locked_revision::text,''),',' ORDER BY id) FROM game.caption_submissions WHERE run_id=p_run),'')||'|'||
 coalesce((SELECT string_agg(member_id::text||':'||vote_type||':'||candidate_id||':'||revision,',' ORDER BY member_id,vote_type) FROM game.caption_votes WHERE run_id=p_run),'')||'|'||
 coalesce((SELECT string_agg(id::text||':'||text||':'||position,',' ORDER BY position) FROM game.caption_candidates WHERE run_id=p_run),''));
$$;
CREATE OR REPLACE FUNCTION game.digest(p_run uuid) RETURNS text LANGUAGE sql STABLE AS $$
 SELECT CASE WHEN (SELECT game_id FROM game.runs WHERE id=p_run)='caption-battle' THEN game.caption_digest(p_run)
 ELSE game.digest_base(p_run) END
$$;
CREATE OR REPLACE FUNCTION game.caption_scores(p_run uuid) RETURNS jsonb LANGUAGE plpgsql STABLE AS $$
DECLARE result jsonb;
BEGIN
 SELECT jsonb_agg(jsonb_build_object('id',g.id,'name',g.name,
 'numerator',coalesce((SELECT (item->>'score')::int FROM jsonb_array_elements(game.caption_results(p_run)) item WHERE (item->>'groupId')::int=g.id),0)*
 (SELECT count(*) FROM game.rosters WHERE run_id=p_run AND group_id=g.id),
 'denominator',(SELECT count(*) FROM game.rosters WHERE run_id=p_run AND group_id=g.id)) ORDER BY g.id) INTO result
 FROM game.groups g WHERE room_code=(SELECT room_code FROM game.runs WHERE id=p_run);
 RETURN coalesce(result,'[]');
END $$;
CREATE OR REPLACE FUNCTION game.scores(p_run uuid) RETURNS jsonb LANGUAGE plpgsql STABLE AS $$
BEGIN
 IF (SELECT game_id FROM game.runs WHERE id=p_run)='caption-battle' THEN RETURN game.caption_scores(p_run); END IF;
 RETURN game.scores_base(p_run);
END $$;

CREATE OR REPLACE FUNCTION game.caption_nominate(rr uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
 INSERT INTO game.caption_candidates(run_id,submission_id,group_id,text,position)
 SELECT rr,nominee.id,nominee.group_id,nominee.text,row_number() OVER(ORDER BY random())::int FROM (
 SELECT DISTINCT ON(ro.group_id) sub.id,ro.group_id,sub.text FROM game.caption_submissions sub
 JOIN game.rosters ro ON ro.run_id=sub.run_id AND ro.member_id=sub.member_id
 WHERE sub.run_id=rr AND sub.decision='APPROVED' AND sub.locked_revision=sub.reviewed_revision AND sub.text<>''
 ORDER BY ro.group_id,(SELECT count(*) FROM game.caption_votes WHERE run_id=rr AND vote_type='INTERNAL' AND candidate_id=sub.id) DESC,sub.first_at,sub.id
 ) nominee;
 INSERT INTO game.caption_candidates(run_id,group_id,text,position)
 SELECT rr,NULL,content.ai_caption,coalesce((SELECT max(position) FROM game.caption_candidates WHERE run_id=rr),0)+1
 FROM game.caption_content content JOIN game.runs r ON r.content_version=content.version WHERE r.id=rr;
 -- Shuffle all positions once, including AI. Reconnection never reshuffles.
 WITH positions AS (SELECT id,row_number() OVER(ORDER BY random())::int pos FROM game.caption_candidates WHERE run_id=rr)
 UPDATE game.caption_candidates c SET position=-p.pos FROM positions p WHERE c.id=p.id;
 UPDATE game.caption_candidates SET position=-position WHERE run_id=rr;
END $$;

CREATE OR REPLACE FUNCTION game.caption_reconcile(p_run uuid) RETURNS void LANGUAGE plpgsql AS $$
DECLARE r game.runs;n timestamptz;next_phase text;duration interval;
BEGIN
 SELECT * INTO r FROM game.runs WHERE id=p_run;
 IF r.status<>'RUNNING' OR r.paused OR r.deadline IS NULL OR clock_timestamp()<r.deadline THEN RETURN;END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('run:'||p_run,0));
 SELECT * INTO r FROM game.runs WHERE id=p_run FOR UPDATE;n:=clock_timestamp();
 WHILE r.status='RUNNING' AND NOT r.paused AND r.deadline IS NOT NULL AND n>=r.deadline LOOP
  IF r.phase='COUNTDOWN' THEN next_phase:='WRITING';duration:=interval '20 seconds';
  ELSIF r.phase='WRITING' THEN
   UPDATE game.caption_submissions SET locked_revision=revision,
   decision=CASE WHEN reviewed_revision=revision AND decision<>'PENDING' THEN decision ELSE 'PENDING' END WHERE run_id=p_run;
   next_phase:='MODERATING';duration:=interval '60 seconds';
  ELSIF r.phase='MODERATING' THEN
   IF EXISTS(SELECT 1 FROM game.caption_submissions WHERE run_id=p_run AND text<>'' AND (decision='PENDING' OR reviewed_revision IS DISTINCT FROM locked_revision)) THEN
    UPDATE game.runs SET phase='REVIEW_REQUIRED',phase_start=r.deadline,deadline=NULL,phase_token=gen_random_uuid(),version=version+1 WHERE id=p_run;
    EXIT;
   END IF;
   next_phase:='INTERNAL_VOTE';duration:=interval '10 seconds';
  ELSIF r.phase='INTERNAL_VOTE' THEN
   PERFORM game.caption_nominate(p_run);next_phase:='FINAL_VOTE';duration:=interval '20 seconds';
  ELSIF r.phase='FINAL_VOTE' THEN
   UPDATE game.runs SET phase='RESULT',status='RESULT',phase_start=r.deadline,deadline=NULL,input_digest=game.digest(p_run),phase_token=gen_random_uuid(),version=version+1 WHERE id=p_run;
   EXIT;
  ELSE EXIT;
  END IF;
  UPDATE game.runs SET phase=next_phase,phase_start=r.deadline,deadline=r.deadline+duration,phase_token=gen_random_uuid(),version=version+1 WHERE id=p_run;
  SELECT * INTO r FROM game.runs WHERE id=p_run;
 END LOOP;
 INSERT INTO game.outbox(room_code,room_version) SELECT code,version FROM game.rooms WHERE code=r.room_code;
END $$;
CREATE OR REPLACE FUNCTION game.reconcile(p_run uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
 IF (SELECT game_id FROM game.runs WHERE id=p_run)='caption-battle' THEN PERFORM game.caption_reconcile(p_run);
 ELSE PERFORM game.reconcile_base(p_run); END IF;
END $$;

CREATE OR REPLACE FUNCTION game.caption_apply_command(a uuid,c text,k text,p jsonb) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE room game.rooms;actor game.actors;r game.runs;ro game.rosters;sub game.caption_submissions;
 rr uuid;n timestamptz;result jsonb;old_revision int;target_group int;vote_kind text;pending_count int;unready int;
BEGIN
 SELECT * INTO room FROM game.rooms WHERE code=c;
 SELECT * INTO actor FROM game.actors WHERE id=a;
 IF actor.role='host' THEN
  SELECT * INTO room FROM game.rooms WHERE code=c FOR UPDATE;
  n:=clock_timestamp();
  IF room.host_id<>a THEN RAISE EXCEPTION 'FORBIDDEN';END IF;
  IF room.controller_id IS DISTINCT FROM p->>'controllerId' OR room.controller_epoch<>(p->>'controllerEpoch')::int OR room.lease_until<=n THEN RAISE EXCEPTION 'STALE_CONTROLLER';END IF;
  IF room.version<>(p->>'expectedVersion')::int THEN RAISE EXCEPTION 'STALE_VERSION';END IF;
  IF k='caption-content-approve' THEN
   IF room.cue<>'04.01' OR room.active_run IS NOT NULL THEN RAISE EXCEPTION 'PREVIEW_CLOSED';END IF;
   INSERT INTO game.caption_approvals VALUES(c,room.preview_id,'caption-battle-v1',a,n)
    ON CONFLICT(room_code) DO UPDATE SET preview_id=excluded.preview_id,content_version=excluded.content_version,actor_id=a,approved_at=n;
   UPDATE game.rooms SET version=version+1 WHERE code=c;RETURN '{"approved":true}';
  END IF;
  IF k='start' THEN
   IF room.active_run IS NOT NULL THEN RAISE EXCEPTION 'RUN_ACTIVE';END IF;
   IF EXISTS(SELECT 1 FROM game.runs WHERE id=room.latest_run AND game_id='caption-battle' AND status='COMPLETED') THEN RAISE EXCEPTION 'REPLAY_REQUIRED';END IF;
   IF NOT EXISTS(SELECT 1 FROM game.caption_approvals WHERE room_code=c AND preview_id=room.preview_id AND content_version='caption-battle-v1') THEN RAISE EXCEPTION 'AI_REVIEW_REQUIRED';END IF;
   INSERT INTO game.runs(room_code,game_id,content_version,scoring_version,schedule_version,timing_profile,phase_start,deadline)
   VALUES(c,'caption-battle','caption-battle-v1','creative-support-v1','caption-3-20-60-10-20-v1',p->>'timingProfile',n,n+interval '3 seconds') RETURNING * INTO r;
   INSERT INTO game.rosters SELECT r.id,id,actor_id,group_id,nickname,side FROM game.members WHERE room_code=c AND active;
   INSERT INTO game.player_states(run_id,member_id) SELECT r.id,member_id FROM game.rosters WHERE run_id=r.id;
   SELECT count(*)::int INTO unready FROM game.members WHERE room_code=c AND active AND (ready_preview IS DISTINCT FROM room.preview_id OR ready_version IS DISTINCT FROM r.content_version);
   UPDATE game.rooms SET active_run=r.id,latest_run=r.id,team_locked=true,version=version+1,practice_until=NULL WHERE code=c;
   RETURN jsonb_build_object('runId',r.id,'unready',unready);
  END IF;
 ELSIF actor.role<>'player' THEN RAISE EXCEPTION 'FORBIDDEN';END IF;
 rr:=(p->>'runId')::uuid;
 PERFORM game.reconcile(rr);
 PERFORM pg_advisory_xact_lock(hashtextextended('run:'||rr,0));
 SELECT * INTO r FROM game.runs WHERE id=rr AND room_code=c FOR UPDATE;n:=clock_timestamp();
 IF r.id IS NULL OR r.game_id<>'caption-battle' OR room.active_run IS DISTINCT FROM rr THEN RAISE EXCEPTION 'RUN_NOT_FOUND';END IF;
 IF r.status<>'RUNNING' OR r.paused THEN RAISE EXCEPTION 'INPUT_CLOSED';END IF;
 IF (p->>'phaseToken')::uuid IS DISTINCT FROM r.phase_token THEN RAISE EXCEPTION 'STALE_PHASE';END IF;
 IF actor.role='host' THEN
  IF k NOT IN ('moderation','caption-open-vote') THEN RAISE EXCEPTION 'FORBIDDEN';END IF;
  IF r.phase NOT IN ('WRITING','MODERATING','REVIEW_REQUIRED') THEN RAISE EXCEPTION 'INPUT_CLOSED';END IF;
  IF k='caption-open-vote' THEN
   IF r.phase<>'REVIEW_REQUIRED' THEN RAISE EXCEPTION 'INPUT_CLOSED';END IF;
   SELECT count(*)::int INTO pending_count FROM game.caption_submissions WHERE run_id=rr AND text<>'' AND (decision='PENDING' OR reviewed_revision IS DISTINCT FROM locked_revision);
   IF pending_count>0 THEN RAISE EXCEPTION 'REVIEW_PENDING';END IF;
   UPDATE game.runs SET phase='INTERNAL_VOTE',phase_start=n,deadline=n+interval '10 seconds',phase_token=gen_random_uuid(),version=version+1 WHERE id=rr;
  ELSE
   SELECT * INTO sub FROM game.caption_submissions WHERE run_id=rr AND id=(p->>'submissionId')::uuid FOR UPDATE;
   IF sub.id IS NULL THEN RAISE EXCEPTION 'CANDIDATE_INVALID';END IF;
   IF sub.revision<>(p->>'lockedRevision')::int OR sub.review_version<>(p->>'expectedReviewVersion')::int THEN RAISE EXCEPTION 'STALE_REVIEW';END IF;
   IF p->>'decision' NOT IN ('APPROVED','REJECTED','WITHHELD') THEN RAISE EXCEPTION 'INVALID_REQUEST';END IF;
   IF p->>'decision'<>'APPROVED' AND length(btrim(coalesce(p->>'reason','')))=0 THEN RAISE EXCEPTION 'REASON_REQUIRED';END IF;
   UPDATE game.caption_submissions SET decision=p->>'decision',reviewed_revision=revision,review_version=review_version+1,reviewer=a,reason=nullif(btrim(p->>'reason'),'') WHERE id=sub.id;
   UPDATE game.runs SET version=version+1 WHERE id=rr;
  END IF;
 ELSE
  IF k NOT IN ('caption','internal-vote','final-vote') THEN RAISE EXCEPTION 'FORBIDDEN';END IF;
  IF NOT EXISTS(SELECT 1 FROM game.members WHERE room_code=c AND actor_id=a AND active) THEN RAISE EXCEPTION 'NOT_A_MEMBER';END IF;
  SELECT * INTO ro FROM game.rosters WHERE run_id=rr AND actor_id=a;
  IF ro.member_id IS NULL THEN RAISE EXCEPTION 'NOT_IN_ROSTER';END IF;
  IF r.deadline IS NULL OR n<r.phase_start OR n>=r.deadline THEN RAISE EXCEPTION 'INPUT_CLOSED';END IF;
  IF k='caption' THEN
   IF r.phase<>'WRITING' THEN RAISE EXCEPTION 'INPUT_CLOSED';END IF;
   IF coalesce((p->>'graphemeCount')::int,81)>80 THEN RAISE EXCEPTION 'CAPTION_TOO_LONG';END IF;
   IF p->>'text' ~ '[<>]' OR p->>'text' ~* '(https?://|www\.)' THEN RAISE EXCEPTION 'CAPTION_FORMAT';END IF;
   SELECT * INTO sub FROM game.caption_submissions WHERE run_id=rr AND member_id=ro.member_id FOR UPDATE;
   IF sub.id IS NOT NULL AND (p->>'revision')::int<=sub.revision THEN RAISE EXCEPTION 'STALE_REVISION';END IF;
   INSERT INTO game.caption_submissions(run_id,member_id,text,revision,graphemes,first_at,updated_at,submitted)
   VALUES(rr,ro.member_id,p->>'text',(p->>'revision')::int,(p->>'graphemeCount')::int,n,n,(p->>'submitted')::boolean)
   ON CONFLICT(run_id,member_id) DO UPDATE SET text=excluded.text,revision=excluded.revision,graphemes=excluded.graphemes,
   first_at=CASE WHEN game.caption_submissions.text='' THEN n ELSE game.caption_submissions.first_at END,
   updated_at=n,submitted=excluded.submitted,decision='PENDING',reviewed_revision=NULL,reviewer=NULL,reason=NULL,review_version=game.caption_submissions.review_version+1
   RETURNING * INTO sub;
   UPDATE game.runs SET version=version+1 WHERE id=rr;
   RETURN jsonb_build_object('accepted',true,'revision',sub.revision,'text',sub.text,'submitted',sub.submitted);
  ELSE
   vote_kind:=CASE k WHEN 'internal-vote' THEN 'INTERNAL' ELSE 'FINAL' END;
   IF (vote_kind='INTERNAL' AND r.phase<>'INTERNAL_VOTE') OR (vote_kind='FINAL' AND r.phase<>'FINAL_VOTE') THEN RAISE EXCEPTION 'INPUT_CLOSED';END IF;
   IF vote_kind='INTERNAL' THEN
    SELECT roster.group_id INTO target_group FROM game.caption_submissions candidate JOIN game.rosters roster ON roster.run_id=candidate.run_id AND roster.member_id=candidate.member_id
    WHERE candidate.id=(p->>'candidateId')::uuid AND candidate.run_id=rr AND candidate.decision='APPROVED' AND candidate.locked_revision=candidate.reviewed_revision AND candidate.text<>'';
    IF target_group IS NULL OR target_group<>ro.group_id THEN RAISE EXCEPTION 'CANDIDATE_INVALID';END IF;
   ELSE
    IF NOT EXISTS(SELECT 1 FROM game.caption_candidates WHERE id=(p->>'candidateId')::uuid AND run_id=rr) THEN RAISE EXCEPTION 'CANDIDATE_INVALID';END IF;
    SELECT group_id INTO target_group FROM game.caption_candidates WHERE id=(p->>'candidateId')::uuid;
    IF target_group=ro.group_id THEN RAISE EXCEPTION 'OWN_GROUP';END IF;
   END IF;
   SELECT revision INTO old_revision FROM game.caption_votes WHERE run_id=rr AND member_id=ro.member_id AND vote_type=vote_kind;
   IF old_revision IS NOT NULL AND (p->>'revision')::int<=old_revision THEN RAISE EXCEPTION 'STALE_REVISION';END IF;
   INSERT INTO game.caption_votes VALUES(rr,ro.member_id,vote_kind,(p->>'candidateId')::uuid,(p->>'revision')::int,n)
   ON CONFLICT(run_id,member_id,vote_type) DO UPDATE SET candidate_id=excluded.candidate_id,revision=excluded.revision,accepted_at=n;
   UPDATE game.runs SET version=version+1 WHERE id=rr;
  END IF;
 END IF;
 RETURN '{"accepted":true}';
END $$;

CREATE OR REPLACE FUNCTION game.apply_command(a uuid,c text,k text,p jsonb) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE room game.rooms;
BEGIN
 SELECT * INTO room FROM game.rooms WHERE code=c;
 IF k IN ('caption','moderation','internal-vote','final-vote','caption-content-approve','caption-open-vote') OR
 (k='start' AND room.cue='04.01') THEN
  RETURN game.caption_apply_command(a,c,k,p);
 END IF;
 RETURN game.apply_base_command(a,c,k,p);
END $$;

CREATE OR REPLACE FUNCTION game.caption_snapshot(a uuid,c text,actor_role text,p_run uuid) RETURNS jsonb LANGUAGE plpgsql STABLE AS $$
DECLARE r game.runs;content game.caption_content;ro game.rosters;own_submission jsonb;internal_rows jsonb:='[]';final_rows jsonb:='[]';host_rows jsonb:='[]';results jsonb:='[]';revealed boolean:=false;
BEGIN
 SELECT * INTO r FROM game.runs WHERE id=p_run AND game_id='caption-battle';
 SELECT * INTO content FROM game.caption_content WHERE version=coalesce(r.content_version,'caption-battle-v1');
 IF r.id IS NOT NULL THEN
  SELECT * INTO ro FROM game.rosters WHERE run_id=r.id AND actor_id=a;
  revealed:=r.status IN ('RESULT','COMPLETED');
  IF actor_role='player' THEN
   SELECT jsonb_build_object('id',id,'text',text,'revision',revision,'submitted',submitted,'decision',decision,'reason',reason,'lockedRevision',locked_revision) INTO own_submission
   FROM game.caption_submissions WHERE run_id=r.id AND member_id=ro.member_id;
   IF r.phase='INTERNAL_VOTE' THEN
    SELECT coalesce(jsonb_agg(jsonb_build_object('id',sub.id,'text',sub.text,'author',roster.nickname) ORDER BY sub.first_at,sub.id),'[]') INTO internal_rows
    FROM game.caption_submissions sub JOIN game.rosters roster ON roster.run_id=sub.run_id AND roster.member_id=sub.member_id
    WHERE sub.run_id=r.id AND roster.group_id=ro.group_id AND sub.decision='APPROVED' AND sub.locked_revision=sub.reviewed_revision AND sub.text<>'';
   END IF;
  END IF;
  IF r.phase='FINAL_VOTE' OR revealed THEN
   SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'text',text,'position',position,'ownGroup',actor_role='player' AND group_id=ro.group_id) ORDER BY position),'[]') INTO final_rows FROM game.caption_candidates WHERE run_id=r.id;
  END IF;
  IF actor_role='host' THEN
   SELECT coalesce(jsonb_agg(jsonb_build_object('id',sub.id,'text',sub.text,'revision',sub.revision,'lockedRevision',sub.locked_revision,'reviewVersion',sub.review_version,'decision',sub.decision,'reason',sub.reason,'author',roster.nickname,'groupId',roster.group_id,'submitted',sub.submitted) ORDER BY sub.first_at,sub.id),'[]') INTO host_rows
   FROM game.caption_submissions sub JOIN game.rosters roster ON roster.run_id=sub.run_id AND roster.member_id=sub.member_id WHERE sub.run_id=r.id AND sub.text<>'';
  END IF;
  IF revealed THEN results:=game.caption_results(r.id);END IF;
 END IF;
 RETURN jsonb_build_object('contentVersion',content.version,'imagePath',content.image_path,'imageAlt',content.image_alt,'task',content.task,
 'rosterCount',(SELECT count(*) FROM game.rosters WHERE run_id=r.id),'submittedCount',(SELECT count(*) FROM game.caption_submissions WHERE run_id=r.id AND text<>''),
 'pendingCount',CASE WHEN actor_role='host' THEN (SELECT count(*) FROM game.caption_submissions WHERE run_id=r.id AND text<>'' AND (decision='PENDING' OR reviewed_revision IS DISTINCT FROM revision)) ELSE NULL END,
 'contentApproved',EXISTS(SELECT 1 FROM game.caption_approvals approval JOIN game.rooms room ON room.code=approval.room_code AND room.preview_id=approval.preview_id WHERE room.code=c),
 'aiCaption',CASE WHEN actor_role='host' OR revealed THEN content.ai_caption ELSE NULL END,
 'aiMetadata',CASE WHEN actor_role='host' OR revealed THEN content.ai_metadata ELSE NULL END,
 'ownSubmission',own_submission,'internalCandidates',internal_rows,'finalCandidates',final_rows,'reviewQueue',host_rows,'revealed',revealed,'results',results,
 'internalVote',(SELECT jsonb_build_object('candidateId',candidate_id,'revision',revision) FROM game.caption_votes WHERE run_id=r.id AND member_id=ro.member_id AND vote_type='INTERNAL'),
 'finalVote',(SELECT jsonb_build_object('candidateId',candidate_id,'revision',revision) FROM game.caption_votes WHERE run_id=r.id AND member_id=ro.member_id AND vote_type='FINAL'));
END $$;
CREATE OR REPLACE FUNCTION game.snapshot(a uuid,c text) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE result jsonb;data jsonb;
BEGIN
 result:=game.snapshot_base(a,c);
 IF result->>'ok'<>'true' THEN RETURN result;END IF;
 data:=result->'data';
 IF data->'room'->>'cue'='04.01' OR data->'run'->>'gameId'='caption-battle' THEN
  data:=data||jsonb_build_object('caption',game.caption_snapshot(a,c,data->>'role',(data->'run'->>'id')::uuid));
 END IF;
 RETURN jsonb_build_object('ok',true,'data',data);
END $$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA game FROM PUBLIC;


-- Source: db\roulette.sql
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


-- Source: db\whack.sql
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


-- Source: db\shield.sql
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


-- Source: db\piece.sql
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
  group_id int CHECK (group_id BETWEEN 1 AND 6),
  position int NOT NULL,
  UNIQUE(run_id, position),
  UNIQUE(run_id, group_id)
);

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

