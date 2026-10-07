import { chromium, request } from 'playwright';
import { readFile, mkdir, writeFile, copyFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const base = process.env.GAME_TEST_ORIGIN ?? 'http://127.0.0.1:5184';
const out = 'qa/game4';
await mkdir(out, { recursive: true });
await mkdir('.impeccable/review', { recursive: true });

const key = (await readFile('data/host-key.txt', 'utf8')).trim();
const browser = await chromium.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true
});

const errors = [];
const checks = [];
const contexts = [];
const latencies = [];

const check = (name, value) => {
  assert.ok(value, name);
  checks.push({ name, passed: true });
};

const json = async (response) => {
  const value = await response.json();
  assert.equal(value.ok, true, value.error);
  return value.data ?? value;
};

const snapshot = (ctx, code, role) =>
  ctx.request.get(`${base}/api/rooms/${code}/snapshot`, { headers: { 'x-game-role': role } }).then(json);

const send = async (ctx, code, role, kind, payload) => {
  const start = Date.now();
  const response = await ctx.request.post(`${base}/api/rooms/${code}/commands/${kind}`, {
    headers: { 'x-game-role': role },
    data: { key: crypto.randomUUID(), payload }
  });
  const data = await response.json();
  latencies.push(Date.now() - start);
  return data;
};

async function capture(page, name) {
  await page.screenshot({ path: `${out}/${name}.png`, fullPage: true });
  check(`${name}: no horizontal overflow`, await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
}

async function waitForRoundPhase(ctx, code, round, roundPhase, maxWaitMs = 25000) {
  const until = Date.now() + maxWaitMs;
  while (Date.now() < until) {
    const s = await snapshot(ctx, code, 'host');
    if (s.roulette?.round === round && s.roulette?.roundPhase === roundPhase) {
      console.log(`Reached Round ${round} Phase ${roundPhase}`);
      return s;
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  const cur = await snapshot(ctx, code, 'host');
  throw Error(`Timeout waiting for Round ${round} Phase ${roundPhase}. Current: Round ${cur.roulette?.round} Phase ${cur.roulette?.roundPhase}`);
}

let roomCode;

try {
  // 1. Host creates room for Death Cap Roulette (cue 07.01)
  const hc = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const host = await hc.newPage();
  contexts.push(hc);
  host.on('pageerror', (e) => errors.push(e.message));

  await host.goto(`${base}/games?game=confidence-roulette`);
  await host.getByLabel('รหัสผู้จัด').fill(key);
  await host.getByRole('button', { name: 'เข้าสู่ระบบผู้จัด' }).click();

  check('Game 4 preselected for new room', (await host.getByLabel('เกมสำหรับห้องใหม่').inputValue()) === '07.01');
  await host.getByRole('button', { name: 'สร้างห้องทดสอบ' }).click();
  await host.waitForURL(/presenter/);
  const code = host.url().split('/').at(-1);
  roomCode = code;

  await host.getByRole('heading', { name: 'Death Cap Roulette (Host)' }).waitFor();

  // 2. Three browser player contexts (Mobile 390px, Desktop 1280px, Small mobile 320px)
  const players = [];
  for (const [i, width] of [[0, 390], [1, 1280], [2, 320]]) {
    const ctx = await browser.newContext({
      viewport: { width, height: width > 640 ? 900 : 844 },
      isMobile: width < 640,
      hasTouch: width < 640
    });
    const page = await ctx.newPage();
    contexts.push(ctx);
    page.on('pageerror', (e) => errors.push(e.message));

    await page.goto(`${base}/play/${code}`);
    await page.getByLabel('ชื่อเล่น').fill(`นักเสี่ยง ${i + 1}`);
    await page.getByText(`กลุ่ม ${i + 1}`, { exact: true }).click();
    await page.getByRole('button', { name: 'เข้าร่วมเกม' }).click();
    await page.getByRole('heading', { name: 'Death Cap Roulette' }).waitFor();
    players.push({ ctx, page, group: i + 1, name: `นักเสี่ยง ${i + 1}` });
  }

  // 3. 29 API player contexts to reach 32 players roster
  const extra = [];
  for (let i = 3; i < 32; i++) {
    const ctx = await request.newContext({ baseURL: base });
    contexts.push(ctx);
    await json(await ctx.post('/api/session', { data: { role: 'player' } }));
    await json(
      await ctx.post(`/api/rooms/${code}/commands/join`, {
        headers: { 'x-game-role': 'player' },
        data: { key: crypto.randomUUID(), payload: { nickname: `ผู้เล่นโหลด ${i + 1}`, groupId: (i % 8) + 1 } }
      })
    );
    const state = await snapshot({ request: ctx }, code, 'player');
    await json(
      await ctx.post(`/api/rooms/${code}/commands/ready`, {
        headers: { 'x-game-role': 'player' },
        data: { key: crypto.randomUUID(), payload: { previewId: state.room.previewId, contentVersion: 'roulette-v1' } }
      })
    );
    extra.push({ request: ctx, i, group: (i % 8) + 1 });
  }

  // 4. Projector Display context (1920x1080)
  const dc = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const display = await dc.newPage();
  contexts.push(dc);
  display.on('pageerror', (e) => errors.push(e.message));
  await display.goto(`${base}/display/${code}`);

  // Check preview stage
  const previewSnap = await snapshot(players[0].ctx, code, 'player');
  check('Preview mode is active', previewSnap.roulette.roundPhase === 'PREVIEW');
  check('Privacy fence: isCorrect is hidden in preview', previewSnap.roulette.currentRound.isCorrect == null);
  await capture(players[0].page, 'mobile-preview');
  await capture(display, 'display-preview');
  await capture(host, 'host-preview');

  // 5. Host starts game
  await host.getByRole('button', { name: 'เริ่มเกม 6 รอบ' }).click();

  // Wait for Round 1 ANSWERING
  await waitForRoundPhase(hc, code, 1, 'ANSWERING');
  const r1Snap = await snapshot(players[0].ctx, code, 'player');
  check('Round 1 current round is 1', r1Snap.roulette.round === 1);
  check('Answer key remains hidden during answering', r1Snap.roulette.currentRound.isCorrect === null);

  // Player 0 chooses BELIEVE, Player 1 chooses DOUBT, Player 2 chooses BELIEVE
  await players[0].page.getByRole('button', { name: /เชื่อ \(BELIEVE\)/ }).click();
  await players[1].page.getByRole('button', { name: /ไม่เชื่อ \(DOUBT\)/ }).click();
  await players[2].page.getByRole('button', { name: /เชื่อ \(BELIEVE\)/ }).click();

  // Extra API players make their decisions
  await Promise.all(
    extra.map(async (ctx, idx) => {
      const state = await snapshot(ctx, code, 'player');
      const choice = idx % 2 === 0 ? 'BELIEVE' : 'DOUBT';
      return send(ctx, code, 'player', 'roulette-decision', {
        runId: state.run.id,
        phaseToken: state.run.phaseToken,
        round: 1,
        choice
      });
    })
  );

  // Check that second answer attempt is rejected with ANSWER_LOCKED
  const duplicateAttempt = await send(players[0].ctx, code, 'player', 'roulette-decision', {
    runId: r1Snap.run.id,
    phaseToken: r1Snap.run.phaseToken,
    round: 1,
    choice: 'DOUBT'
  });
  check('Duplicate answer rejected with ANSWER_LOCKED', duplicateAttempt.error === 'ANSWER_LOCKED');

  await capture(players[0].page, 'mobile-answering-r1');
  await capture(players[1].page, 'desktop-answering-r1');
  await capture(players[2].page, 'mobile-320-answering-r1');
  await capture(display, 'display-answering-r1');

  // Wait for Round 1 REVEAL (5 seconds)
  await waitForRoundPhase(hc, code, 1, 'REVEAL');
  const r1RevealSnap = await snapshot(players[0].ctx, code, 'player');
  check('Answer key is revealed in REVEAL phase', r1RevealSnap.roulette.currentRound.isCorrect === true);
  check('Player 0 scored +300 points for correct belief', r1RevealSnap.roulette.myState.score === 300);
  check('Player 0 remains ALIVE', r1RevealSnap.roulette.myState.lifeState === 'ALIVE');

  await capture(players[0].page, 'mobile-reveal-r1');
  await capture(display, 'display-reveal-r1');

  // Wait for Round 2 ANSWERING (Time calculation, true)
  await waitForRoundPhase(hc, code, 2, 'ANSWERING', 12000);
  const r2Snap = await snapshot(players[0].ctx, code, 'player');
  check('Reached Round 2', r2Snap.roulette.round === 2);

  await players[0].page.getByRole('button', { name: /เชื่อ \(BELIEVE\)/ }).click();
  await players[1].page.getByRole('button', { name: /ไม่เชื่อ \(DOUBT\)/ }).click();

  // Wait for Round 2 REVEAL
  await waitForRoundPhase(hc, code, 2, 'REVEAL');
  const r2RevealP0 = await snapshot(players[0].ctx, code, 'player');
  check('Player 0 remains ALIVE in Round 2 with 600 points', r2RevealP0.roulette.myState.lifeState === 'ALIVE' && r2RevealP0.roulette.myState.score === 600);

  // Wait for Round 3 ANSWERING (Trap: 100 - 20% = 90, FALSE)
  await waitForRoundPhase(hc, code, 3, 'ANSWERING', 12000);
  const r3Snap = await snapshot(players[0].ctx, code, 'player');
  check('Reached Round 3', r3Snap.roulette.round === 3);

  // Player 0 believes falsehood (will die!), Player 1 doubts (will survive and gain +100!)
  await players[0].page.getByRole('button', { name: /เชื่อ \(BELIEVE\)/ }).click();
  await players[1].page.getByRole('button', { name: /ไม่เชื่อ \(DOUBT\)/ }).click();

  // Wait for Round 3 REVEAL
  await waitForRoundPhase(hc, code, 3, 'REVEAL');
  const r3RevealP0 = await snapshot(players[0].ctx, code, 'player');
  const r3RevealP1 = await snapshot(players[1].ctx, code, 'player');

  check('Player 0 is DEAD after trusting false claim in Round 3', r3RevealP0.roulette.myState.lifeState === 'DEAD');
  check('Player 0 score reset to 0 upon death', r3RevealP0.roulette.myState.score === 0);
  check('Player 0 eliminatedAtRound recorded as 3', r3RevealP0.roulette.myState.eliminatedAtRound === 3);
  check('Player 1 is ALIVE with +100 for doubting falsehood', r3RevealP1.roulette.myState.lifeState === 'ALIVE' && r3RevealP1.roulette.myState.score === 100);

  await capture(players[0].page, 'mobile-dead-spectator-r3');
  await capture(display, 'display-reveal-r3');

  // Wait for Round 6 ANSWERING (Death Cap mushroom finale!)
  await waitForRoundPhase(hc, code, 6, 'ANSWERING', 45000);
  const r6Snap = await snapshot(players[1].ctx, code, 'player');
  check('Round 6 is reached', r6Snap.roulette.round === 6);
  check('Round 6 contains lethal mushroom image', r6Snap.roulette.currentRound.imagePath === '/assets/images/death-cap.jpg');
  check('Round 6 is marked as isFinalRisk', r6Snap.roulette.currentRound.isFinalRisk === true);

  await capture(players[1].page, 'mobile-round6-lethal');
  await capture(display, 'display-round6-lethal');

  // Player 1 doubts the poisonous mushroom
  await players[1].page.getByRole('button', { name: /ไม่เชื่อ \(DOUBT\)/ }).click();

  // Wait for RESULT phase
  await waitForRoundPhase(hc, code, 6, 'RESULT', 18000);
  const finalHostSnap = await snapshot(hc, code, 'host');
  check('Reached RESULT phase', finalHostSnap.roulette.roundPhase === 'RESULT');
  check('All 6 rounds recorded in pastRounds', finalHostSnap.roulette.pastRounds.length === 8);
  check('Group survival matrix calculated for all 8 groups', finalHostSnap.roulette.groupSurvival.length === 8);
  check('Roster denominator remains 32', finalHostSnap.scores.reduce((sum, g) => sum + g.denominator, 0) === 32);

  await capture(players[0].page, 'mobile-final-results');
  await capture(display, 'display-final-results');
  await capture(host, 'host-final-results');

  // 6. Host finishes game and transitions to cue 07.02
  await host.getByRole('button', { name: 'ยืนยันผล / ไปคิว 07.02' }).click();
  await new Promise((r) => setTimeout(r, 600));

  const afterFinishSnap = await snapshot(hc, code, 'host');
  check('Room transitioned to cue 07.02', afterFinishSnap.room.cue === '07.02');
  check('Active run cleared on completion', afterFinishSnap.room.activeRunId === null);
  check('Run status is COMPLETED', afterFinishSnap.run.status === 'COMPLETED');

  // Check no browser errors
  check('No unhandled browser console/page errors', errors.length === 0);

  const sorted = latencies.sort((a, b) => a - b);
  const summary = {
    code,
    players: 32,
    checks,
    errors,
    latency: {
      commandP95Ms: sorted[Math.floor(sorted.length * 0.95)],
      maxMs: sorted.at(-1)
    },
    screenshots: out
  };

  await writeFile(`${out}/report.json`, JSON.stringify(summary, null, 2));

  // Copy key screenshots to .impeccable/review/
  for (const [source, target] of [
    ['mobile-preview', 'roulette-mobile-preview'],
    ['mobile-answering-r1', 'roulette-mobile-answering'],
    ['mobile-dead-spectator-r3', 'roulette-mobile-dead'],
    ['display-answering-r1', 'roulette-display-answering'],
    ['display-round6-lethal', 'roulette-display-lethal'],
    ['display-final-results', 'roulette-display-results'],
    ['host-final-results', 'roulette-host-results']
  ]) {
    try {
      await copyFile(`${out}/${source}.png`, `.impeccable/review/${target}.png`);
    } catch {
      // Ignore if copy fails
    }
  }

  console.log(JSON.stringify({ room: code, checks: checks.length, errors, latency: summary.latency }));
} catch (e) {
  await writeFile(`${out}/failure.json`, JSON.stringify({ roomCode, error: String(e), errors, checks }, null, 2));
  throw e;
} finally {
  for (const ctx of contexts) {
    if (ctx.close) await ctx.close();
    else if (ctx.dispose) await ctx.dispose();
  }
  await browser.close();
}
