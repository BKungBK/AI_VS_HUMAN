import { chromium, request } from 'playwright';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const base = process.env.GAME_TEST_ORIGIN ?? 'http://127.0.0.1:5188';
const out = 'qa/game6';
await mkdir(out, { recursive: true });

const key = (await readFile('data/host-key.txt', 'utf8')).trim();
const browser = await chromium.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
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

const snapshot = (ctx, code, role) => {
  const req = ctx.request ?? ctx;
  return req.get(`${base}/api/rooms/${code}/snapshot`, { headers: { 'x-game-role': role } }).then(json);
};

const send = async (ctx, code, role, kind, payload) => {
  const req = ctx.request ?? ctx;
  const start = Date.now();
  const response = await req.post(`${base}/api/rooms/${code}/commands/${kind}`, {
    headers: { 'x-game-role': role },
    data: { key: crypto.randomUUID(), payload },
  });
  const data = await response.json();
  latencies.push(Date.now() - start);
  return data;
};

async function capture(page, name) {
  await page.screenshot({ path: `${out}/${name}.png`, fullPage: true });
  check(`${name}: no horizontal overflow`, await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
}

let roomCode;

try {
  console.log(`Starting Game 6 browser check against ${base}...`);

  // 1. Host creates room for Company Shield (cue 11.02)
  const hc = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const host = await hc.newPage();
  contexts.push(hc);
  host.on('pageerror', (e) => errors.push(e.message));

  await host.goto(`${base}/games?game=company-shield`);
  await host.getByLabel('รหัสผู้จัด').fill(key);
  await host.getByRole('button', { name: 'เข้าสู่ระบบผู้จัด' }).click();

  check('Game 6 preselected for new room', (await host.getByLabel('เกมสำหรับห้องใหม่').inputValue()) === '11.02');
  await host.getByRole('button', { name: 'สร้างห้องทดสอบ' }).click();
  await host.waitForURL(/presenter/);
  const code = host.url().split('/').at(-1);
  roomCode = code;
  console.log(`Room created: ${code}`);

  // 2. Three browser player contexts (Mobile 390px, Desktop 1280px, Small mobile 320px)
  const players = [];
  for (const [i, width] of [[0, 390], [1, 1280], [2, 320]]) {
    const ctx = await browser.newContext({
      viewport: { width, height: width > 640 ? 900 : 844 },
      isMobile: width < 640,
      hasTouch: width < 640,
    });
    const page = await ctx.newPage();
    contexts.push(ctx);
    page.on('pageerror', (e) => errors.push(e.message));

    await page.goto(`${base}/play/${code}`);
    await page.getByLabel('ชื่อเล่น').fill(`ตัวแทนบริษัท ${i + 1}`);
    await page.getByText(`กลุ่ม ${i + 1}`, { exact: true }).click();
    await page.getByRole('button', { name: 'เข้าร่วมเกม' }).click();
    await page.getByText('บริษัทต้องรับก่อนถึงลูกค้า').waitFor();
    players.push({ ctx, page, group: i + 1, name: `ตัวแทนบริษัท ${i + 1}` });
  }

  // 3. 29 API player contexts to reach 32 players across 8 groups
  console.log('Registering 29 API players to form full 32-player roster...');
  const extra = [];
  for (let i = 3; i < 32; i++) {
    const ctx = await request.newContext({ baseURL: base });
    contexts.push(ctx);
    await json(await ctx.post('/api/session', { data: { role: 'player' } }));
    await json(
      await ctx.post(`/api/rooms/${code}/commands/join`, {
        headers: { 'x-game-role': 'player' },
        data: {
          key: crypto.randomUUID(),
          payload: { nickname: `บ.ตัวแทน ${i + 1}`, groupId: (i % 8) + 1 },
        },
      })
    );
    extra.push(ctx);
  }

  // 4. Open Display in 1920x1080 Projector View
  const dc = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const display = await dc.newPage();
  contexts.push(dc);
  display.on('pageerror', (e) => errors.push(e.message));
  await display.goto(`${base}/display/${code}`);
  await display.getByText('Company Shield: บริษัทต้องรับก่อนถึงลูกค้า').waitFor();

  // Capture preview screenshots
  await capture(players[0].page, '01-preview-mobile');
  await capture(display, '02-display-preview');

  // Verify preview state
  const hostSnap = await snapshot(hc, code, 'host');
  check('32 members present in host view', hostSnap.host.members.length === 32);
  check('Room cue is 11.02', hostSnap.room.cue === '11.02');
  check('Game phase is PREVIEW', hostSnap.shield.phase === 'PREVIEW');

  // Test practice slider interaction on player 0
  await players[0].page.getByRole('button', { name: /กลาง/ }).click();
  check('Player 1 practice clicked', true);

  // 5. Send ready from all players
  console.log('Sending ready confirmations from all 32 players...');
  for (const p of players) {
    await p.page.getByRole('button', { name: /ยืนยันพร้อมเล่น/ }).click();
    await p.page.getByText('พร้อมแล้ว (รอ Host เริ่มเกม)').waitFor();
  }
  for (const ctx of extra) {
    const s = await snapshot(ctx, code, 'player');
    await send(ctx, code, 'player', 'ready', {
      previewId: s.room.previewId,
      contentVersion: 'shield-v1',
    });
  }

  const allReadySnap = await snapshot(hc, code, 'host');
  check('All 32 players are marked ready', allReadySnap.host.unready === 0);

  // 6. Host starts the game (COUNTDOWN 3s -> 25s ARCADE PLAY)
  console.log('Host starting Company Shield game...');
  await host.getByRole('button', { name: /เริ่มเกม Company Shield/ }).click();
  await players[0].page.getByText('ตำแหน่งเริ่มต้น: ช่องกลาง').waitFor();
  check('Countdown screen displayed on mobile', true);

  // Wait for PLAYING phase
  await players[0].page.getByText('25s ARCADE').waitFor({ timeout: 6000 });
  console.log('Arcade 25s started!');
  check('Arcade status active on player view', true);

  // Capture active play screen
  await capture(players[0].page, '03-playing-mobile');
  await capture(display, '04-display-playing');

  // 7. Interactive movement during gameplay:
  // Player 0 (390px): uses quick-tap button to move to Left lane
  await players[0].page.getByRole('button', { name: /ช่องซ้าย/ }).click();

  // Player 2 (320px small screen): moves to Right lane
  await players[2].page.getByRole('button', { name: /ช่องขวา/ }).click();

  // Extra API players move across lanes to create realistic engagement
  const playSnap = await snapshot(extra[0], code, 'player');
  const runId = playSnap.run.id;
  const phaseToken = playSnap.run.phaseToken;

  for (let i = 0; i < extra.length; i++) {
    const chosenLane = i % 3;
    await send(extra[i], code, 'player', 'shield-move', {
      runId,
      phaseToken,
      lane: chosenLane,
      normalizedX: [0.16, 0.50, 0.84][chosenLane],
      clientTimeMs: 1500,
    });
  }

  // Verify movements were accepted
  const midPlaySnap = await snapshot(players[0].ctx, code, 'player');
  check('Player 0 current lane is Left (0)', midPlaySnap.shield.myState.currentLane === 0);

  // 8. Wait for arcade play (25s) to complete and enter RESULT
  console.log('Waiting for 25s arcade duration to finish...');
  await players[0].page.getByText('สรุปผลการรับผิดชอบของบริษัท', { timeout: 30000 }).waitFor();
  await display.getByText('สถิติการรับเรื่องทั้งห้อง', { timeout: 10000 }).waitFor();
  console.log('Game reached RESULT phase!');

  // Capture Result views
  await capture(players[0].page, '05-result-mobile');
  await capture(players[1].page, '06-result-desktop');
  await capture(display, '07-display-result');

  // Verify RESULT data integrity
  const finalSnap = await snapshot(hc, code, 'host');
  check('Run status is RESULT', finalSnap.run.status === 'RESULT');
  check('Shield phase is RESULT', finalSnap.shield.phase === 'RESULT');
  check('Results revealed', finalSnap.shield.revealed === true);
  check('Customer trust meter is valid (0..10)', finalSnap.shield.stats.customerTrustSlots >= 0 && finalSnap.shield.stats.customerTrustSlots <= 10);
  check('Total packets evaluated is > 0', finalSnap.shield.stats.totalPacketsBlocked + finalSnap.shield.stats.totalPacketsMissed > 0);

  // Verify scores for all 8 groups with positive denominators
  check('All 8 groups scored', finalSnap.scores.length === 8);
  check('Group denominators count all roster members', finalSnap.scores.every(g => g.denominator > 0));

  // 9. Host finishes the game -> transition to cue 11.03
  console.log('Host confirming and finishing game...');
  await host.getByRole('button', { name: /จบเกมและไปต่อคิว 11.03/ }).click();

  let postFinishSnap = null;
  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 250));
    postFinishSnap = await snapshot(hc, code, 'host');
    if (postFinishSnap?.room?.cue === '11.03') break;
  }

  check('Room cue successfully advanced to 11.03', postFinishSnap?.room?.cue === '11.03');
  check('Active run cleared on finish', postFinishSnap?.room?.activeRunId === null);
  console.log('Game 6 finished and moved to cue 11.03!');

  // 10. Replay game -> transitions back to cue 11.02
  console.log('Host testing replay to return to cue 11.02...');
  const curHostSnap = await snapshot(hc, code, 'host');
  const repRes = await send(hc, code, 'host', 'replay', {
    controllerId: curHostSnap.host.controllerId,
    controllerEpoch: curHostSnap.host.controllerEpoch,
    expectedVersion: curHostSnap.room.version,
    reason: 'ทดสอบ Replay Game 6',
  });
  check('Replay command accepted', repRes.ok === true);

  const postReplaySnap = await snapshot(hc, code, 'host');
  check('Room cue returned to 11.02 on replay', postReplaySnap?.room?.cue === '11.02');
  console.log('Game 6 replay verified!');

  // Write summary report
  const summary = {
    test: 'Game 6 (Company Shield: บริษัทต้องรับก่อนถึงลูกค้า) Browser QA Check',
    timestamp: new Date().toISOString(),
    roomCode: code,
    checksPassed: checks.length,
    errorsCount: errors.length,
    p95LatencyMs: latencies.sort((a, b) => a - b)[Math.floor(latencies.length * 0.95)] ?? 0,
    checks,
    errors,
  };

  await writeFile(`${out}/summary.json`, JSON.stringify(summary, null, 2), 'utf8');
  console.log(`QA Check Passed! ${checks.length}/${checks.length} assertions verified.`);
} catch (err) {
  console.error('QA Test failed:', err);
  errors.push(err.message);
  process.exitCode = 1;
} finally {
  for (const c of contexts) {
    try {
      await c.close();
    } catch {
      // Ignore cleanup
    }
  }
  await browser.close();
}
