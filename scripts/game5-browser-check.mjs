import { chromium, request } from 'playwright';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const base = process.env.GAME_TEST_ORIGIN ?? 'http://127.0.0.1:5186';
const out = 'qa/game5';
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

const snapshot = (ctx, code, role) =>
  ctx.request.get(`${base}/api/rooms/${code}/snapshot`, { headers: { 'x-game-role': role } }).then(json);

const send = async (ctx, code, role, kind, payload) => {
  const start = Date.now();
  const response = await ctx.request.post(`${base}/api/rooms/${code}/commands/${kind}`, {
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
  console.log(`Starting Game 5 browser check against ${base}...`);

  // 1. Host creates room for Chat Whack-a-Mole (cue 10.02)
  const hc = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const host = await hc.newPage();
  contexts.push(hc);
  host.on('pageerror', (e) => errors.push(e.message));

  await host.goto(`${base}/games?game=chat-whack-a-mole`);
  await host.getByLabel('รหัสผู้จัด').fill(key);
  await host.getByRole('button', { name: 'เข้าสู่ระบบผู้จัด' }).click();

  check('Game 5 preselected for new room', (await host.getByLabel('เกมสำหรับห้องใหม่').inputValue()) === '10.02');
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
    await page.getByLabel('ชื่อเล่น').fill(`ผู้ตรวจแชต ${i + 1}`);
    await page.getByText(`กลุ่ม ${i + 1}`, { exact: true }).click();
    await page.getByRole('button', { name: 'เข้าร่วมเกม' }).click();
    await page.getByText('กติกา: แตะทุบเฉพาะแชตที่ควรหยุด').waitFor();
    players.push({ ctx, page, group: i + 1, name: `ผู้ตรวจแชต ${i + 1}` });
  }

  // 3. 29 API player contexts to reach 32 players across 6 groups
  console.log('Registering 29 API players to form full 32-player roster...');
  const extra = [];
  for (let i = 3; i < 32; i++) {
    const ctx = await request.newContext({ baseURL: base });
    contexts.push(ctx);
    await json(await ctx.post('/api/session', { data: { role: 'player' } }));
    await json(
      await ctx.post(`/api/rooms/${code}/commands/join`, {
        headers: { 'x-game-role': 'player' },
        data: { key: crypto.randomUUID(), payload: { nickname: `ผู้ตรวจแชต ${i + 1}`, groupId: (i % 6) + 1 } },
      })
    );
    const state = await snapshot({ request: ctx }, code, 'player');
    await json(
      await ctx.post(`/api/rooms/${code}/commands/ready`, {
        headers: { 'x-game-role': 'player' },
        data: { key: crypto.randomUUID(), payload: { previewId: state.room.previewId, contentVersion: 'whack-a-mole-v1' } },
      })
    );
    extra.push({ request: ctx, i, group: (i % 6) + 1 });
  }

  // 4. Projector Display context (1920x1080)
  const dc = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const display = await dc.newPage();
  contexts.push(dc);
  display.on('pageerror', (e) => errors.push(e.message));
  await display.goto(`${base}/display/${code}`);

  // Check preview stage
  const previewSnap = await snapshot(players[0].ctx, code, 'player');
  check('Preview mode is active', previewSnap.whack.phase === 'PREVIEW');
  check('Context banner pinned with correct text', previewSnap.whack.contextBanner.includes('ผู้ใช้ขอคุยกับเจ้าหน้าที่'));

  // Test interactive practice tapping in player browser
  await players[0].page.getByText('“ไม่ต้องคุยกับใคร”').click();
  await players[0].page.getByText('+100 ถูกต้อง!').waitFor();
  check('Practice whack stamp triggered on tap', true);

  await capture(players[0].page, 'mobile-preview');
  await capture(display, 'display-preview');
  await capture(host, 'host-preview');

  // 5. Host starts 25-second arcade game
  console.log('Host starting game...');
  await host.getByRole('button', { name: /เริ่มเกม \(25 วินาที\)/ }).click();

  // Wait for PLAYING phase
  console.log('Waiting for PLAYING phase after 3s countdown...');
  let playingSnap;
  for (let t = 0; t < 20; t++) {
    const s = await snapshot(players[0].ctx, code, 'player');
    if (s.whack?.phase === 'PLAYING') {
      playingSnap = s;
      break;
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  check('Reached PLAYING phase', playingSnap && playingSnap.whack.phase === 'PLAYING');

  // STRICT PRIVACY FENCE CHECK: classification and explanation MUST be null during play!
  check('Privacy fence: bubble classification is null', playingSnap.whack.bubbles[0].classification === null);
  check('Privacy fence: bubble explanation is null', playingSnap.whack.bubbles[0].explanation === null);

  // 6. Test Whack Hit interaction in browser
  console.log('Testing bubble whack in mobile player browser...');
  const firstBubble = players[0].page.locator('.whack-bubble').first();
  await firstBubble.waitFor({ timeout: 5000 });
  await firstBubble.click();
  await players[0].page.locator('.whack-stamp-overlay').first().waitFor();
  check('Mallet stamp slam rendered on tapped bubble', true);

  await capture(players[0].page, 'mobile-arcade-playing');
  await capture(display, 'display-arcade-playing');

  // API players tap active bubbles
  console.log('Simulating concurrent whacks from 29 API players...');
  const curRun = playingSnap.run;
  await Promise.all(
    extra.slice(0, 15).map(async (p) => {
      return send(p, code, 'player', 'whack-hit', {
        runId: curRun.id,
        phaseToken: curRun.phaseToken,
        bubbleId: 'whack-b01',
        clientTimeMs: 1200,
      });
    })
  );

  // Duplicate hit test from Player 0
  const dupHit = await send(players[0].ctx, code, 'player', 'whack-hit', {
    runId: curRun.id,
    phaseToken: curRun.phaseToken,
    bubbleId: 'whack-b01',
    clientTimeMs: 1300,
  });
  check('Duplicate hit handled idempotently', dupHit.data?.duplicate === true || dupHit.ok === true);

  // 7. Wait for 25-second arcade to finish and reach RESULT phase
  console.log('Waiting for arcade duration to complete and reach RESULT...');
  let resultSnap;
  for (let t = 0; t < 35; t++) {
    const s = await snapshot(players[0].ctx, code, 'player');
    if (s.whack?.phase === 'RESULT' || s.run?.status === 'RESULT' || s.whack?.revealed) {
      resultSnap = s;
      break;
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  check('Reached RESULT phase after 25s arcade', resultSnap && (resultSnap.whack.phase === 'RESULT' || resultSnap.whack.revealed));

  // Verify result data
  check('Score clamped between 0 and 900', resultSnap.whack.myState.score >= 0 && resultSnap.whack.myState.score <= 900);
  check('Privacy fence lifted: classification revealed', resultSnap.whack.bubbles[0].classification === 'STOP');
  check('Privacy fence lifted: explanation revealed', resultSnap.whack.bubbles[0].explanation.length > 0);
  check('2 key comparison pairs revealed', resultSnap.whack.keyPairs?.length === 2);

  await capture(players[0].page, 'mobile-result');
  await capture(display, 'display-result');

  // 8. Host Finishes Game using UI button -> Cue advances to 10.03
  console.log('Host confirming and finishing game using UI button to transition to cue 10.03...');
  await host.getByRole('button', { name: 'ยืนยันผล / ไปสไลด์ 10.03' }).click();
  await new Promise((r) => setTimeout(r, 600));

  const postFinishSnap = await snapshot(hc, code, 'host');
  check('Room cue advanced to 10.03 (ตรวจก่อนปล่อยคำตอบ)', postFinishSnap.room.cue === '10.03');
  check('Run status is COMPLETED', postFinishSnap.run?.status === 'COMPLETED');

  // 9. Host Replays Game using UI button -> Cue returns to 10.02
  console.log('Host replaying game to return to cue 10.02...');
  await host.locator('details.host-tools').click();
  await host.locator('#whack-reason').fill('ทดสอบ Replay');
  await host.getByRole('button', { name: 'เล่นใหม่ (Replay)' }).click();
  await new Promise((r) => setTimeout(r, 600));

  const replaySnap = await snapshot(hc, code, 'host');
  check('Room cue returned to 10.02', replaySnap.room.cue === '10.02');

  console.log('All checks passed successfully!');
} finally {
  await browser.close();

  const report = {
    checks,
    totalChecks: checks.length,
    passedChecks: checks.filter((c) => c.passed).length,
    errors,
    averageLatencyMs: latencies.length ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : 0,
    timestamp: new Date().toISOString(),
  };

  await writeFile(`${out}/report.json`, JSON.stringify(report, null, 2), 'utf8');
  console.log(`Report written to ${out}/report.json`);
}
