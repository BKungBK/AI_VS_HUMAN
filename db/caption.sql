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
 group_id int CHECK(group_id BETWEEN 1 AND 8),text text NOT NULL,position int NOT NULL,
 UNIQUE(run_id,position),UNIQUE(run_id,group_id)
);
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='game.caption_candidates'::regclass AND conname='caption_candidates_group_id_check' AND pg_get_constraintdef(oid) LIKE '%<= 8%') THEN
  ALTER TABLE game.caption_candidates DROP CONSTRAINT IF EXISTS caption_candidates_group_id_check;
  ALTER TABLE game.caption_candidates ADD CONSTRAINT caption_candidates_group_id_check CHECK(group_id BETWEEN 1 AND 8);
 END IF;
END $$;
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
