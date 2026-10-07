import { chromium, request } from 'playwright';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const base = process.env.GAME_TEST_ORIGIN ?? 'http://127.0.0.1:5189';
const out = 'qa/game7';
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
  console.log(`Starting Game 7 browser check against ${base}...`);

  // 1. Host creates room for Missing Piece (cue 14.01)
  const hc = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const host = await hc.newPage();
  contexts.push(hc);
  host.on('pageerror', (e) => errors.push(`[host] ${e.stack ?? e.message}`));

  await host.goto(`${base}/games?game=missing-piece`);
  await host.getByLabel('รหัสผู้จัด').fill(key);
  await host.getByRole('button', { name: 'เข้าสู่ระบบผู้จัด' }).click();

  check('Game 7 preselected for new room', (await host.getByLabel('เกมสำหรับห้องใหม่').inputValue()) === '14.01');
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
    page.on('pageerror', (e) => errors.push(`[player ${i + 1}] ${e.stack ?? e.message}`));

    await page.goto(`${base}/play/${code}`);
    await page.getByLabel('ชื่อเล่น').fill(`นักประดิษฐ์ ${i + 1}`);
    await page.getByText(`กลุ่ม ${i + 1}`, { exact: true }).click();
    await page.getByRole('button', { name: 'เข้าร่วมเกม' }).click();
    await page.getByText('AI เริ่ม คนเติม').waitFor();
    players.push({ ctx, page, group: i + 1, name: `นักประดิษฐ์ ${i + 1}` });
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
          payload: { nickname: `ช่างวาด ${i + 1}`, groupId: (i % 8) + 1 },
        },
      })
    );
    extra.push(ctx);
  }

  // 4. Open Display in 1920x1080 Projector View
  const dc = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const display = await dc.newPage();
  contexts.push(dc);
  display.on('pageerror', (e) => errors.push(`[display] ${e.stack ?? e.message}`));
  await display.goto(`${base}/display/${code}`);
  await display.getByText(/Missing Piece: AI เริ่ม คนเติม/).waitFor({ timeout: 10000 });

  // Capture preview screenshots
  await capture(players[0].page, '01-preview-mobile');
  await capture(display, '02-display-preview');

  // Verify preview state
  const hostSnap = await snapshot(hc, code, 'host');
  check('32 members present in host view', hostSnap.host.members.length === 32);
  check('Room cue is 14.01', hostSnap.room.cue === '14.01');
  check('Game phase is PREVIEW', hostSnap.piece.phase === 'PREVIEW');

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
      contentVersion: 'piece-v1',
    });
  }

  const allReadySnap = await snapshot(hc, code, 'host');
  check('All 32 players are marked ready', allReadySnap.host.unready === 0);

  // 6. Host starts the game (COUNTDOWN 3s -> 20s DRAWING)
  console.log('Host starting Missing Piece game...');
  await host.getByRole('button', { name: /เริ่มเกม Missing Piece/ }).click();
  await players[0].page.getByText('เตรียมวาดปีกให้ยานกลไกในแบบของคุณ...').waitFor();
  check('Countdown screen displayed on mobile', true);

  // Wait for DRAWING phase
  await players[0].page.getByText(/เติมปีกตามจินตนาการ/).waitFor({ timeout: 6000 });
  console.log('Drawing 20s started!');
  check('Drawing status active on player view', true);

  // 7. Interactive Drawing Simulation
  // Player 0 submits drawing strokes
  const playSnap = await snapshot(players[0].ctx, code, 'player');
  const runId = playSnap.run.id;
  const phaseToken = playSnap.run.phaseToken;

  await send(players[0].ctx, code, 'player', 'piece-stroke', {
    runId,
    phaseToken,
    strokes: [
      {
        id: 's-01',
        color: '#38bdf8',
        width: 4,
        points: [
          { x: 0.12, y: 0.35 },
          { x: 0.22, y: 0.38 },
          { x: 0.32, y: 0.45 },
        ],
      },
      {
        id: 's-02',
        color: '#fbbf24',
        width: 4,
        points: [
          { x: 0.68, y: 0.45 },
          { x: 0.78, y: 0.38 },
          { x: 0.88, y: 0.35 },
        ],
      },
    ],
    revision: 1,
    clientTimeMs: 1200,
  });

  // Extra players draw strokes
  for (let i = 0; i < extra.length; i++) {
    await send(extra[i], code, 'player', 'piece-stroke', {
      runId,
      phaseToken,
      strokes: [
        {
          id: `extra-s-${i}`,
          color: ['#f43f5e', '#38bdf8', '#fbbf24', '#34d399', '#f8fafc'][i % 5],
          width: 4,
          points: [
            { x: 0.15 + (i % 5) * 0.02, y: 0.3 + (i % 3) * 0.05 },
            { x: 0.25 + (i % 5) * 0.02, y: 0.4 + (i % 3) * 0.05 },
          ],
        },
      ],
      revision: 1,
      clientTimeMs: 1500,
    });
  }

  // Capture active drawing screens
  await capture(players[0].page, '03-drawing-mobile');
  await capture(display, '04-display-drawing');

  // Player 0 clicks finish early
  await players[0].page.getByRole('button', { name: /วาดเสร็จแล้ว/ }).click();
  await players[0].page.getByText('ส่งผลงานเรียบร้อยแล้ว').waitFor();
  check('Finish early reflected on mobile', true);

  // 8. Wait for DRAWING (20s) to transition to REVIEW_REQUIRED
  console.log('Waiting for 20s drawing duration to finish...');
  await host.getByText(/ตรวจสอบผลงานที่ส่งเข้ามา/).waitFor({ timeout: 25000 });
  console.log('Game reached REVIEW_REQUIRED phase!');

  // Capture host moderation view
  await capture(host, '05-host-moderation');

  // Bulk approval stays disabled until each pending artwork has been visible to the host.
  const approveAll = host.getByRole('button', { name: /อนุมัติงานที่ตรวจครบแล้ว/ });
  assert.equal(await approveAll.isDisabled(), true, 'Bulk approval starts disabled before review');
  const reviewCards = host.locator('[data-piece-review-id]');
  const reviewCardCount = await reviewCards.count();
  check('Host moderation queue contains pending artwork cards', reviewCardCount > 0);
  for (let i = 0; i < reviewCardCount; i++) {
    await reviewCards.nth(i).scrollIntoViewIfNeeded();
    await host.waitForTimeout(400);
  }
  const reviewProgress = await host.locator('.piece-review-progress').innerText();
  check('Every pending artwork was shown before bulk approval', reviewProgress.includes(`${reviewCardCount} / ${reviewCardCount}`));
  assert.equal(await approveAll.isDisabled(), false, 'Bulk approval enables after visual review');
  await approveAll.click();
  check('Host approved all artworks', true);

  // Host opens internal vote (15s)
  await host.getByRole('button', { name: /เริ่มโหวตภายในกลุ่ม/ }).click();
  await players[0].page.getByText(/โหวตตัวแทนของกลุ่ม/).waitFor({ timeout: 5000 });
  console.log('Game reached INTERNAL_VOTE phase!');

  // Capture internal vote screen
  await capture(players[0].page, '06-internal-vote-mobile');

  // Players vote for candidate within group
  const internalSnap = await snapshot(players[0].ctx, code, 'player');
  const internalCandidateId = internalSnap.piece.internalArtworks[0]?.id;
  assert.ok(internalCandidateId, 'Internal candidate exists');

  await send(players[0].ctx, code, 'player', 'piece-internal-vote', {
    runId,
    phaseToken: internalSnap.run.phaseToken,
    candidateId: internalCandidateId,
    revision: 1,
  });

  // 9. Host opens final vote (20s)
  await host.getByRole('button', { name: /เริ่มโหวตกลุ่มอื่น|Open Final Vote/ }).click();
  await players[0].page.getByText(/โหวตผลงานของกลุ่มอื่น/).waitFor({ timeout: 5000 });
  console.log('Game reached FINAL_VOTE phase!');

  // Capture final vote screens
  await capture(players[0].page, '07-final-vote-mobile');
  await capture(display, '08-display-final-vote');

  // Players vote for other groups
  const finalSnap = await snapshot(players[0].ctx, code, 'player');
  const otherCandidate = finalSnap.piece.candidates.find((c) => c.groupId !== players[0].group);
  assert.ok(otherCandidate, 'Other group candidate exists');

  await send(players[0].ctx, code, 'player', 'piece-final-vote', {
    runId,
    phaseToken: finalSnap.run.phaseToken,
    candidateId: otherCandidate.id,
    revision: 1,
  });

  // Extra players cast final votes
  for (let i = 0; i < extra.length; i++) {
    const extraSnap = await snapshot(extra[i], code, 'player');
    const extraCand = extraSnap.piece.candidates.find((c) => c.groupId !== ((i % 8) + 1));
    if (extraCand) {
      await send(extra[i], code, 'player', 'piece-final-vote', {
        runId,
        phaseToken: extraSnap.run.phaseToken,
        candidateId: extraCand.id,
        revision: 1,
      });
    }
  }

  // 10. Host reveals results
  console.log('Host revealing results...');
  await host.getByRole('button', { name: /เปิดผลคะแนน/ }).click();
  await display.getByText(/สรุปคะแนนกลุ่ม|ผลการสนับสนุนและคะแนนสรุป/).waitFor({ timeout: 10000 });
  await players[0].page.getByText(/สรุปผลคะแนน Missing Piece/).waitFor({ timeout: 10000 });
  console.log('Game reached RESULT phase!');

  // Capture result screens
  await capture(players[0].page, '09-result-mobile');
  await capture(display, '10-display-result');

  // 11. Host finishes run (advances cue to 15.01)
  console.log('Host confirming finish...');
  await host.getByRole('button', { name: /จบเกมและไปต่อคิว 15.01/ }).click();

  let postFinishSnap = null;
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 250));
    postFinishSnap = await snapshot(hc, code, 'host');
    if (postFinishSnap?.room?.cue === '15.01') break;
  }

  check('Room cue successfully advanced to 15.01', postFinishSnap?.room?.cue === '15.01');
  check('Active run cleared on finish', postFinishSnap?.room?.activeRunId === null);
  console.log('Game 7 finished and moved to cue 15.01!');

  // Capture finish screen
  await capture(display, '11-display-finish');

  // 12. Host replays back to 14.01
  console.log('Host testing replay to return to cue 14.01...');
  const curHostSnap = await snapshot(hc, code, 'host');
  const repRes = await send(hc, code, 'host', 'replay', {
    controllerId: curHostSnap.host.controllerId,
    controllerEpoch: curHostSnap.host.controllerEpoch,
    expectedVersion: curHostSnap.room.version,
    reason: 'ทดสอบ Replay Game 7',
  });
  check('Replay command accepted', repRes.ok === true);

  const postReplaySnap = await snapshot(hc, code, 'host');
  check('Room cue returned to 14.01 on replay', postReplaySnap?.room?.cue === '14.01');
  check('Host controls report no rejected commands', await host.locator('.piece-action-error').count() === 0);
  console.log('Game 7 replay verified!');

  console.log('All browser QA steps completed successfully!');
} catch (err) {
  console.error('QA script error:', err);
  errors.push(err.message);
} finally {
  await browser.close();
}

const report = {
  timestamp: new Date().toISOString(),
  checks,
  errors,
  p95LatencyMs: latencies.length ? latencies.sort((a, b) => a - b)[Math.floor(latencies.length * 0.95)] : 0,
};

await writeFile(`${out}/report.json`, JSON.stringify(report, null, 2));
console.log('QA Report saved to', `${out}/report.json`);

if (errors.length > 0) {
  console.error('QA FAILED with errors:', errors);
  process.exit(1);
} else {
  console.log('QA PASSED 100%!');
}
