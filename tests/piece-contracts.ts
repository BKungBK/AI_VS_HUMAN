import {test, before, after} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {openDatabase, type Database} from '../api/database.ts';
import {validateCommand} from '../api/validation.ts';
import type {Snapshot} from '../src/shared/game-contracts.ts';

let db: Database;
let host: string;
let players: string[];
let display: string;
type Reply = {ok: boolean; error?: string; data: any};

before(async () => {
  db = await openDatabase(':memory:');
  host = (await db.query<{id: string}>("INSERT INTO game.actors(role, token_hash) VALUES('host', 'piece-host') RETURNING id")).rows[0].id;
  display = (await db.query<{id: string}>("INSERT INTO game.actors(role, token_hash) VALUES('display', 'piece-display') RETURNING id")).rows[0].id;
  players = [];
  for (let i = 0; i < 6; i++) {
    players.push(
      (await db.query<{id: string}>("INSERT INTO game.actors(role, token_hash) VALUES('player', $1) RETURNING id", [`piece-player-${i}`])).rows[0].id
    );
  }
});

after(async () => {
  await db.close();
});

async function cmd(actor: string, code: string, kind: string, payload: Record<string, unknown> = {}, key = randomUUID()): Promise<Reply> {
  return (await db.query<{result: Reply}>('SELECT game.command($1,$2,$3,$4,$5) result', [actor, code, kind, JSON.stringify(payload), key])).rows[0].result;
}

async function snap(actor: string, code: string): Promise<{ok: boolean; data: Snapshot}> {
  return (await db.query<{result: {ok: boolean; data: Snapshot}}>('SELECT game.snapshot($1,$2) result', [actor, code])).rows[0].result;
}

async function hostCmd(code: string, kind: string, payload: Record<string, unknown> = {}, key = randomUUID()): Promise<Reply> {
  const s = (await snap(host, code)).data;
  return cmd(host, code, kind, {
    controllerId: 'piece-host-tab',
    controllerEpoch: s.host!.controllerEpoch,
    expectedVersion: s.room.version,
    ...payload,
  }, key);
}

async function setupPieceRoom(code: string) {
  await db.query("INSERT INTO game.rooms(code, host_id, capacity, cue) VALUES($1, $2, 32, '14.01')", [code, host]);
  await db.query("INSERT INTO game.groups SELECT $1, i, 'กลุ่ม ' || i FROM generate_series(1, 6) i", [code]);

  // Assign players: 2 in Group 1, 2 in Group 2, 2 in Group 3
  assert.equal((await cmd(players[0], code, 'join', {nickname: 'นักบิน 1', groupId: 1})).ok, true);
  assert.equal((await cmd(players[1], code, 'join', {nickname: 'นักบิน 2', groupId: 1})).ok, true);
  assert.equal((await cmd(players[2], code, 'join', {nickname: 'นักบิน 3', groupId: 2})).ok, true);
  assert.equal((await cmd(players[3], code, 'join', {nickname: 'นักบิน 4', groupId: 2})).ok, true);
  assert.equal((await cmd(players[4], code, 'join', {nickname: 'นักบิน 5', groupId: 3})).ok, true);
  assert.equal((await cmd(players[5], code, 'join', {nickname: 'นักบิน 6', groupId: 3})).ok, true);

  await cmd(host, code, 'acquire', {controllerId: 'piece-host-tab'});
}

test('Missing Piece validation rules for strokes, votes, and host moderation', () => {
  const runId = randomUUID();
  const phaseToken = randomUUID();
  const candId = randomUUID();
  const artId = randomUUID();

  // piece-stroke validation
  assert.equal(validateCommand('piece-stroke', {
    runId, phaseToken, strokes: [{id: 's1', color: '#0ea5e9', width: 4, points: [{x: 0.1, y: 0.2}]}], revision: 1, clientTimeMs: 500
  }), true);
  assert.equal(validateCommand('piece-stroke', {
    runId, phaseToken, strokes: 'not-array', revision: 1, clientTimeMs: 500
  }), false);
  assert.equal(validateCommand('piece-stroke', {
    runId, phaseToken, strokes: [], revision: 0, clientTimeMs: 500
  }), false);

  // piece-finish-early
  assert.equal(validateCommand('piece-finish-early', {runId, phaseToken}), true);

  // ready validation
  assert.equal(validateCommand('ready', {previewId: randomUUID(), contentVersion: 'piece-v1'}), true);
  assert.equal(validateCommand('ready', {previewId: randomUUID(), contentVersion: 'unknown-v1'}), false);

  // host moderation
  assert.equal(validateCommand('piece-moderation', {
    controllerId: 'tab', controllerEpoch: 1, expectedVersion: 1, runId, phaseToken, artworkId: artId, decision: 'APPROVED', reason: ''
  }), true);
  assert.equal(validateCommand('piece-moderation', {
    controllerId: 'tab', controllerEpoch: 1, expectedVersion: 1, runId, phaseToken, artworkId: artId, decision: 'INVALID', reason: ''
  }), false);
  assert.equal(validateCommand('piece-approve-all', {
    controllerId: 'tab', controllerEpoch: 1, expectedVersion: 1, runId, phaseToken, reviewedArtworkIds: [artId]
  }), true);
  assert.equal(validateCommand('piece-approve-all', {
    controllerId: 'tab', controllerEpoch: 1, expectedVersion: 1, runId, phaseToken, reviewedArtworkIds: [artId, artId]
  }), false);

  // votes
  assert.equal(validateCommand('piece-internal-vote', {runId, phaseToken, candidateId: candId, revision: 1}), true);
  assert.equal(validateCommand('piece-final-vote', {runId, phaseToken, candidateId: candId, revision: 1}), true);
});

test('Missing Piece full game lifecycle: Start, Draw, Moderation, Internal Vote, Final Vote (cross-group), Scoring, Finish, Replay', async () => {
  const code = 'PIEC01';
  await setupPieceRoom(code);

  const previewSnap = (await snap(players[0], code)).data;
  assert.equal(previewSnap.room.cue, '14.01');
  assert.equal(previewSnap.piece?.phase, 'PREVIEW');
  assert.equal(previewSnap.piece?.version, 'piece-v1');

  // Players ready
  for (let i = 0; i < 6; i++) {
    assert.equal((await cmd(players[i], code, 'ready', {previewId: previewSnap.room.previewId, contentVersion: 'piece-v1'})).ok, true);
  }

  // Host starts game
  const startRes = await hostCmd(code, 'start', {timingProfile: 'normal'});
  assert.equal(startRes.ok, true, startRes.error);
  const runId = startRes.data.runId as string;

  // COUNTDOWN phase
  const snapCount = (await snap(players[0], code)).data;
  assert.equal(snapCount.run?.phase, 'COUNTDOWN');
  assert.equal(snapCount.piece?.phase, 'COUNTDOWN');

  // Advance COUNTDOWN -> DRAWING
  await db.query("UPDATE game.runs SET phase='DRAWING', phase_start=clock_timestamp(), deadline=clock_timestamp()+interval '20 seconds', phase_token=gen_random_uuid() WHERE id=$1", [runId]);
  await db.query("UPDATE game.piece_run_state SET current_phase='DRAWING', phase_start=clock_timestamp(), drawing_start=clock_timestamp(), deadline=clock_timestamp()+interval '20 seconds' WHERE run_id=$1", [runId]);

  const snapDraw = (await snap(players[0], code)).data;
  assert.equal(snapDraw.run?.phase, 'DRAWING');
  assert.equal(snapDraw.piece?.phase, 'DRAWING');
  const ptDraw = snapDraw.run!.phaseToken;

  // Players draw strokes
  // Player 0 (Group 1)
  const draw0 = await cmd(players[0], code, 'piece-stroke', {
    runId,
    phaseToken: ptDraw,
    strokes: [
      {id: 's-0-1', color: '#0ea5e9', width: 4, points: [{x: 0.1, y: 0.3}, {x: 0.2, y: 0.35}, {x: 0.3, y: 0.4}]},
      {id: 's-0-2', color: '#10b981', width: 4, points: [{x: 0.7, y: 0.3}, {x: 0.8, y: 0.35}, {x: 0.9, y: 0.4}]}
    ],
    revision: 1,
    clientTimeMs: 1000
  });
  assert.equal(draw0.ok, true, draw0.error);

  // Player 1 (Group 1)
  const draw1 = await cmd(players[1], code, 'piece-stroke', {
    runId,
    phaseToken: ptDraw,
    strokes: [{id: 's-1-1', color: '#f59e0b', width: 6, points: [{x: 0.15, y: 0.35}, {x: 0.25, y: 0.45}]}],
    revision: 1,
    clientTimeMs: 1200
  });
  assert.equal(draw1.ok, true, draw1.error);

  // Player 2 (Group 2)
  const draw2 = await cmd(players[2], code, 'piece-stroke', {
    runId,
    phaseToken: ptDraw,
    strokes: [{id: 's-2-1', color: '#ec4899', width: 4, points: [{x: 0.12, y: 0.32}, {x: 0.22, y: 0.42}]}],
    revision: 1,
    clientTimeMs: 1400
  });
  assert.equal(draw2.ok, true, draw2.error);

  // Player 4 (Group 3)
  const draw4 = await cmd(players[4], code, 'piece-stroke', {
    runId,
    phaseToken: ptDraw,
    strokes: [{id: 's-4-1', color: '#8b5cf6', width: 4, points: [{x: 0.18, y: 0.28}, {x: 0.28, y: 0.38}]}],
    revision: 1,
    clientTimeMs: 1500
  });
  assert.equal(draw4.ok, true, draw4.error);

  // Player 0 finishes early
  const finishEarly = await cmd(players[0], code, 'piece-finish-early', {runId, phaseToken: ptDraw});
  assert.equal(finishEarly.ok, true, finishEarly.error);

  // Stale revision rejection test
  const staleDraw = await cmd(players[0], code, 'piece-stroke', {
    runId,
    phaseToken: ptDraw,
    strokes: [],
    revision: 1,
    clientTimeMs: 2000
  });
  // Since player 0 already locked artwork via finish-early, ARTWORK_LOCKED is raised
  assert.equal(staleDraw.error, 'ARTWORK_LOCKED');

  // Verify privacy during DRAWING:
  // Display only sees moderationStats, not private player strokes
  const displaySnap = (await snap(display, code)).data;
  assert.equal(displaySnap.piece?.moderation.length, 0); // Display doesn't have private stroke stream
  assert.equal(displaySnap.piece?.moderationStats.submitted, 4);

  // Advance DRAWING -> MODERATING / REVIEW_REQUIRED
  await db.query("UPDATE game.runs SET phase='REVIEW_REQUIRED', phase_start=clock_timestamp(), deadline=NULL, phase_token=gen_random_uuid() WHERE id=$1", [runId]);
  await db.query("UPDATE game.piece_run_state SET current_phase='REVIEW_REQUIRED', phase_start=clock_timestamp(), deadline=NULL WHERE run_id=$1", [runId]);

  const snapMod = (await snap(host, code)).data;
  assert.equal(snapMod.run?.phase, 'REVIEW_REQUIRED');
  assert.equal(snapMod.piece?.phase, 'REVIEW_REQUIRED');
  assert.equal(snapMod.piece?.moderation.length, 4);

  // Host approves all
  const unreviewedApprove = await hostCmd(code, 'piece-approve-all', {
    runId,
    phaseToken: snapMod.run!.phaseToken,
    reviewedArtworkIds: [],
  });
  assert.equal(unreviewedApprove.ok, false);
  assert.equal(unreviewedApprove.error, 'UNREVIEWED_ARTWORKS');

  const approveAllRes = await hostCmd(code, 'piece-approve-all', {
    runId,
    phaseToken: snapMod.run!.phaseToken,
    reviewedArtworkIds: snapMod.piece!.moderation.map(art => art.id),
  });
  assert.equal(approveAllRes.ok, true, approveAllRes.error);

  // Host opens internal vote
  const hostSnapAfterApprove = (await snap(host, code)).data;
  const openInternal = await hostCmd(code, 'piece-open-internal-vote', {
    runId,
    phaseToken: hostSnapAfterApprove.run!.phaseToken
  });
  assert.equal(openInternal.ok, true, openInternal.error);

  // Check player snapshot in INTERNAL_VOTE
  const snapInternal0 = (await snap(players[0], code)).data;
  assert.equal(snapInternal0.piece?.phase, 'INTERNAL_VOTE');
  // Group 1 player sees Group 1 internal artworks (Player 0 and Player 1)
  assert.equal(snapInternal0.piece?.internalArtworks.length, 2);
  const p0ArtworkId = snapInternal0.piece!.internalArtworks.find(c => c.author === 'นักบิน 1')!.id;
  const p1ArtworkId = snapInternal0.piece!.internalArtworks.find(c => c.author === 'นักบิน 2')!.id;

  // Both Player 0 and Player 1 vote for Player 0's artwork
  const voteP0 = await cmd(players[0], code, 'piece-internal-vote', {
    runId,
    phaseToken: snapInternal0.run!.phaseToken,
    candidateId: p0ArtworkId,
    revision: 1
  });
  assert.equal(voteP0.ok, true, voteP0.error);

  const snapInternal1 = (await snap(players[1], code)).data;
  const voteP1 = await cmd(players[1], code, 'piece-internal-vote', {
    runId,
    phaseToken: snapInternal1.run!.phaseToken,
    candidateId: p0ArtworkId,
    revision: 1
  });
  assert.equal(voteP1.ok, true, voteP1.error);

  // Player 0 tries to vote for Player 2's artwork (from Group 2) -> CANDIDATE_INVALID
  const p2Artwork = snapMod.piece!.moderation.find(a => a.author === 'นักบิน 3')!;
  const invalidVote = await cmd(players[0], code, 'piece-internal-vote', {
    runId,
    phaseToken: snapInternal0.run!.phaseToken,
    candidateId: p2Artwork.id,
    revision: 2
  });
  assert.equal(invalidVote.error, 'CANDIDATE_INVALID');

  // Player 2 & 3 in Group 2 vote for Player 2's artwork
  const snapInternal2 = (await snap(players[2], code)).data;
  const p2ArtworkId = snapInternal2.piece!.internalArtworks.find(c => c.author === 'นักบิน 3')!.id;
  assert.equal((await cmd(players[2], code, 'piece-internal-vote', {runId, phaseToken: snapInternal2.run!.phaseToken, candidateId: p2ArtworkId, revision: 1})).ok, true);
  assert.equal((await cmd(players[3], code, 'piece-internal-vote', {runId, phaseToken: snapInternal2.run!.phaseToken, candidateId: p2ArtworkId, revision: 1})).ok, true);

  // Player 4 & 5 in Group 3 vote for Player 4's artwork
  const snapInternal4 = (await snap(players[4], code)).data;
  const p4ArtworkId = snapInternal4.piece!.internalArtworks.find(c => c.author === 'นักบิน 5')!.id;
  assert.equal((await cmd(players[4], code, 'piece-internal-vote', {runId, phaseToken: snapInternal4.run!.phaseToken, candidateId: p4ArtworkId, revision: 1})).ok, true);

  // Host advances to FINAL_VOTE
  const hostSnapInternal = (await snap(host, code)).data;
  const openFinal = await hostCmd(code, 'piece-open-final-vote', {
    runId,
    phaseToken: hostSnapInternal.run!.phaseToken
  });
  assert.equal(openFinal.ok, true, openFinal.error);

  // In FINAL_VOTE:
  const snapFinal0 = (await snap(players[0], code)).data;
  assert.equal(snapFinal0.piece?.phase, 'FINAL_VOTE');
  // There are candidates from Group 1, Group 2, Group 3
  assert.equal(snapFinal0.piece?.candidates.length, 3);

  const ownCandidate = snapFinal0.piece!.candidates.find(c => c.groupId === 1)!;
  const g2Candidate = snapFinal0.piece!.candidates.find(c => c.groupId === 2)!;
  const g3Candidate = snapFinal0.piece!.candidates.find(c => c.groupId === 3)!;

  assert.ok(ownCandidate);
  assert.ok(g2Candidate);
  assert.ok(g3Candidate);

  // STRICT RULE TEST: Voting for own group candidate MUST FAIL with 'OWN_GROUP'
  const ownVoteAttempt = await cmd(players[0], code, 'piece-final-vote', {
    runId,
    phaseToken: snapFinal0.run!.phaseToken,
    candidateId: ownCandidate.id,
    revision: 1
  });
  assert.equal(ownVoteAttempt.error, 'OWN_GROUP');

  // Player 0 votes for Group 2 candidate
  const voteFinal0 = await cmd(players[0], code, 'piece-final-vote', {
    runId,
    phaseToken: snapFinal0.run!.phaseToken,
    candidateId: g2Candidate.id,
    revision: 1
  });
  assert.equal(voteFinal0.ok, true, voteFinal0.error);

  // Player 1 also votes for Group 2 candidate
  const voteFinal1 = await cmd(players[1], code, 'piece-final-vote', {
    runId,
    phaseToken: snapFinal0.run!.phaseToken,
    candidateId: g2Candidate.id,
    revision: 1
  });
  assert.equal(voteFinal1.ok, true, voteFinal1.error);

  // Player 2 & 3 (Group 2) vote for Group 1 candidate
  const snapFinal2 = (await snap(players[2], code)).data;
  const g1CandFromP2 = snapFinal2.piece!.candidates.find(c => c.groupId === 1)!;
  assert.equal((await cmd(players[2], code, 'piece-final-vote', {runId, phaseToken: snapFinal2.run!.phaseToken, candidateId: g1CandFromP2.id, revision: 1})).ok, true);
  assert.equal((await cmd(players[3], code, 'piece-final-vote', {runId, phaseToken: snapFinal2.run!.phaseToken, candidateId: g1CandFromP2.id, revision: 1})).ok, true);

  // Player 4 & 5 (Group 3) vote for Group 2 candidate
  const snapFinal4 = (await snap(players[4], code)).data;
  const g2CandFromP4 = snapFinal4.piece!.candidates.find(c => c.groupId === 2)!;
  assert.equal((await cmd(players[4], code, 'piece-final-vote', {runId, phaseToken: snapFinal4.run!.phaseToken, candidateId: g2CandFromP4.id, revision: 1})).ok, true);
  assert.equal((await cmd(players[5], code, 'piece-final-vote', {runId, phaseToken: snapFinal4.run!.phaseToken, candidateId: g2CandFromP4.id, revision: 1})).ok, true);

  // Host reveals results
  const hostSnapFinal = (await snap(host, code)).data;
  const revealRes = await hostCmd(code, 'piece-reveal', {
    runId,
    phaseToken: hostSnapFinal.run!.phaseToken
  });
  assert.equal(revealRes.ok, true, revealRes.error);

  const snapResult = (await snap(host, code)).data;
  assert.equal(snapResult.run?.status, 'RESULT');
  assert.equal(snapResult.piece?.results.length, 3);

  // Check normalized support & scoring:
  // Group 2 candidate received votes from Group 1 (2/2 = 1.0) and Group 3 (2/2 = 1.0)
  // Total possible other groups for G2 is 2 other groups (G1 and G3) => support = 2.0 / 2 = 1.0 (1000 points)
  // Group 1 candidate received votes from Group 2 (2/2 = 1.0) and 0 from Group 3 => support = 1.0 / 2 = 0.5 (500 points)
  // Group 3 candidate received 0 votes => support = 0.0 (0 points)
  const g2Result = snapResult.piece!.results.find(r => r.groupId === 2)!;
  const g1Result = snapResult.piece!.results.find(r => r.groupId === 1)!;
  const g3Result = snapResult.piece!.results.find(r => r.groupId === 3)!;

  assert.equal(g2Result.score, 1000);
  assert.equal(g2Result.winner, true);
  assert.equal(g1Result.score, 500);
  assert.equal(g3Result.score, 0);

  // Host confirms finish
  const inputDigest = snapResult.host!.inputDigest;
  assert.ok(inputDigest);
  const finishRes = await hostCmd(code, 'finish', {inputDigest});
  assert.equal(finishRes.ok, true, finishRes.error);

  // Verify transition to cue 15.01
  const snapAfterFinish = (await snap(host, code)).data;
  assert.equal(snapAfterFinish.room.cue, '15.01');
  assert.equal(snapAfterFinish.run?.status, 'COMPLETED');
  assert.equal(snapAfterFinish.room.activeRunId, null);

  // Replay back to 14.01
  const replayRes = await hostCmd(code, 'replay', {reason: 'ซ้อมวาดใหม่อีกรอบ'});
  assert.equal(replayRes.ok, true, replayRes.error);

  const snapReplay = (await snap(host, code)).data;
  assert.equal(snapReplay.room.cue, '14.01');
  assert.equal(snapReplay.confirmedScores, null);
});
