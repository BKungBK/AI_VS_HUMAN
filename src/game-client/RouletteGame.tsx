import { useCallback, useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { allCues } from '../content';
import type { GroupScore, RouletteChoice, RouletteRoundHistory, RouletteSnapshot, Snapshot } from '../shared/game-contracts';
import { command, GameError, tabIdentity, useRoom } from './network';
import { rouletteSound } from './roulette-sound';
import GameGlyph,{IconLabel} from './GameGlyph';
import './roulette.css';

type RoomState = ReturnType<typeof useRoom>;

function useNow(room: RoomState) {
  const [, tick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => tick((n) => n + 1), 100);
    return () => clearInterval(timer);
  }, []);
  return room.now();
}

function RouletteClock({ s, now, phase }: { s: Snapshot; now: number; phase?: string }) {
  const r = s.run;
  if (!r || r.gameId !== 'confidence-roulette' || r.status !== 'RUNNING') return null;
  const ms = r.paused ? (r.remainingMs ?? 0) : Math.max(0, (r.deadline ?? now) - now);
  const seconds = Math.ceil(ms / 1000);
  const isUrgent = (phase === 'ANSWERING' && seconds <= 2) || (phase === 'COUNTDOWN');

  // Trigger tick sound on countdown change
  const lastSec = useRef<number | null>(null);
  useEffect(() => {
    if (r.status === 'RUNNING' && !r.paused && (phase === 'ANSWERING' || phase === 'COUNTDOWN')) {
      if (lastSec.current !== null && lastSec.current !== seconds && seconds <= 3 && seconds > 0) {
        rouletteSound.playTick();
      }
      lastSec.current = seconds;
    }
  }, [seconds, phase, r.status, r.paused]);

  const label = r.paused
    ? 'พักเกม'
    : phase === 'COUNTDOWN'
    ? 'เตรียมตัว'
    : phase === 'ANSWERING'
    ? 'เวลาตัดสินใจ'
    : phase === 'REVEAL'
    ? 'เฉลยผล'
    : phase === 'TRANSITION'
    ? 'รอบถัดไป'
    : 'รอระบบ';

  return (
    <div className={`roulette-clock ${isUrgent ? 'urgent' : ''}`} aria-label={`${label} เหลือ ${seconds} วินาที`}>
      <span>{label}</span>
      <strong>
        {seconds}
        <small> วิ</small>
      </strong>
    </div>
  );
}

function ConfidenceGauge({ confidence }: { confidence: number }) {
  const percent = `${(confidence * 100).toFixed(1)}%`;
  return (
    <div className="ai-confidence-meter" role="region" aria-label="ระดับความมั่นใจของ AI">
      <span>AI CONFIDENCE</span>
      <strong>{percent}</strong>
    </div>
  );
}

function GroupSurvivalGrid({ survival }: { survival: RouletteSnapshot['groupSurvival'] }) {
  return (
    <div className="group-survival-matrix">
      {survival.map((g) => {
        const ratio = g.total > 0 ? `${g.alive}/${g.total}` : '0/0';
        const pct = g.total > 0 ? Math.round((g.alive / g.total) * 100) : 0;
        return (
          <div key={g.groupId} className="group-matrix-item">
            <strong>{g.groupName}</strong>
            <div className="surv-ratio">
              {ratio} <small style={{ fontSize: '13px', color: 'var(--roulette-muted)' }}>({pct}%)</small>
            </div>
            <div className="group-total-score">รวม {g.totalScore.toLocaleString()} แต้ม</div>
          </div>
        );
      })}
    </div>
  );
}

function FinalLeaderboard({ scores, history }: { scores: GroupScore[]; history: RouletteRoundHistory[] }) {
  const sorted = [...scores].sort(
    (a, b) => (b.denominator ? b.numerator / b.denominator : 0) - (a.denominator ? a.numerator / a.denominator : 0) || a.id - b.id
  );
  const sameAverage = (a: GroupScore, b: GroupScore) => {
    const aDenominator = a.denominator || 1;
    const bDenominator = b.denominator || 1;
    const aNumerator = a.denominator ? a.numerator : 0;
    const bNumerator = b.denominator ? b.numerator : 0;
    return aNumerator * bDenominator === bNumerator * aDenominator;
  };
  let previousRank = 0;

  return (
    <section className="roulette-results-screen">
      <div className="roulette-results-header">
        <h2>สรุปผลการเอาชีวิตรอด 6 รอบ</h2>
        <p>คะแนนกลุ่ม = ผลรวมคะแนนผู้รอดชีวิต ÷ จำนวนสมาชิกเริ่มต้น (คนตายยังเป็นตัวหาร)</p>
      </div>

      <div className="roulette-leaderboard">
        {sorted.map((g, idx) => {
          const avg = g.denominator ? (g.numerator / g.denominator).toFixed(1) : '0.0';
          const rank = idx > 0 && sameAverage(g, sorted[idx - 1]) ? previousRank : idx + 1;
          previousRank = rank;
          return (
            <div key={g.id} className={`roulette-podium-card rank-${rank}`}>
              <div className="podium-rank">#{rank}{idx > 0 && sameAverage(g, sorted[idx - 1]) ? ' เสมอ' : ''}</div>
              <div className="podium-group-name">{g.name}</div>
              <div className="podium-stats">
                <span>คะแนนเฉลี่ยกลุ่ม</span>
                <strong>{avg} <small style={{ fontSize: '16px' }}>/ 1,200</small></strong>
                <span>คะแนนรวมผู้รอดชีวิต: {g.numerator.toLocaleString()} แต้ม</span>
                <span>สมาชิกเริ่มต้นใน roster: {g.denominator} คน</span>
              </div>
            </div>
          );
        })}
      </div>

      <details className="roulette-history-details">
        <summary>เปิดประวัติการตัดสินใจทั้ง 6 รอบ</summary>
        <div className="roulette-history-list">
          {history.map((h) => (
            <div key={h.roundNo} className={`roulette-history-item ${h.isCorrect ? 'correct' : 'lethal'}`}>
              <div className="roulette-history-round">รอบที่ {h.roundNo}</div>
              <div className="roulette-history-claim">
                <strong>{h.claimText}</strong>
                <span>
                  ความมั่นใจ AI: {(h.confidence * 100).toFixed(1)}% · {h.isCorrect ? 'คำกล่าวอ้างถูกต้อง' : <IconLabel name="skull">ข้อมูลผิด</IconLabel>}
                </span>
              </div>
              <div className="roulette-history-casualties">
                <span>เสียชีวิตในรอบนี้</span>
                <strong>{h.totalDeaths} คน</strong>
              </div>
            </div>
          ))}
        </div>
      </details>
    </section>
  );
}

// =========================================================
// 1. PLAYER VIEW
// =========================================================
function RoulettePlayer({ room }: { room: RoomState }) {
  const s = room.snapshot!;
  const game = s.roulette!;
  const me = s.me!;
  const r = s.run?.gameId === 'confidence-roulette' ? s.run : null;
  const now = useNow(room);

  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [localChoice, setLocalChoice] = useState<RouletteChoice | null>(null);

  const phase = game.roundPhase;
  const currentRound = game.currentRound;
  const myState = game.myState;
  const isAlive = myState?.lifeState !== 'DEAD';
  const myScore = myState?.score ?? 0;

  // Sound triggers on phase transition
  const prevPhase = useRef<string>(phase);
  useEffect(() => {
    if (prevPhase.current !== phase) {
      if (phase === 'REVEAL') {
        rouletteSound.playReveal();
        // Check if just eliminated
        if (myState?.lifeState === 'DEAD' && myState?.eliminatedAtRound === game.round) {
          rouletteSound.playDeath();
        } else if (isAlive && localChoice) {
          rouletteSound.playSurvive();
        }
      }
      prevPhase.current = phase;
    }
  }, [phase, myState?.lifeState, myState?.eliminatedAtRound, game.round, isAlive, localChoice]);

  // Sync choice from server
  useEffect(() => {
    if (myState?.currentChoice) {
      setLocalChoice(myState.currentChoice);
    } else {
      setLocalChoice(null);
    }
  }, [game.round, myState?.currentChoice]);

  // Auto ready in preview
  useEffect(() => {
    if (s.room.cue !== '07.01' || s.room.activeRunId || me.ready || !room.apiOnline) return;
    let cancelled = false;
    void document.fonts.ready.then(async () => {
      if (!cancelled) {
        try {
          await command(s.room.code, 'player', 'ready', {
            previewId: s.room.previewId,
            contentVersion: game.contentVersion
          });
          await room.refresh();
        } catch {
          // Retry smoothly
        }
      }
    });
    return () => {
      cancelled = true;
    };
  }, [s.room.cue, s.room.previewId, s.room.activeRunId, me.ready, room.apiOnline, game.contentVersion, room.refresh, s.room.code]);

  // Make Decision
  const handleDecision = async (choice: RouletteChoice) => {
    if (busy || !r || r.status !== 'RUNNING' || phase !== 'ANSWERING' || r.paused || !isAlive || !me.inRoster) return;
    setBusy(true);
    setMessage('');
    rouletteSound.playLock();
    setLocalChoice(choice);

    try {
      await command(s.room.code, 'player', 'roulette-decision', {
        runId: r.id,
        phaseToken: r.phaseToken,
        round: game.round,
        choice
      });
      await room.refresh();
    } catch (e) {
      if (e instanceof GameError && e.code === 'ANSWER_LOCKED') {
        setMessage('บันทึกคำตอบแล้ว ไม่สามารถเปลี่ยนได้');
      } else {
        setMessage(e instanceof Error ? e.message : 'ยังส่งคำตอบไม่ได้');
      }
      void room.refresh();
    } finally {
      setBusy(false);
    }
  };

  const isAnswering = r?.status === 'RUNNING' && phase === 'ANSWERING' && !r.paused && isAlive && me.inRoster;
  const isLocked = !!localChoice || !!myState?.currentChoice;

  return (
    <main className="player-main roulette-player">
      <div className="roulette-player-header">
        <div className="roulette-player-id">
          <strong>{me.nickname}</strong>
          <span>{s.groups.find((g) => g.id === me.groupId)?.name}</span>
        </div>
        <div className="roulette-player-stats">
          <div className="roulette-score-badge">
            <strong>{myScore}</strong>
            <small>แต้มสะสม</small>
          </div>
          <span className={`life-badge ${isAlive ? 'alive' : 'dead'}`}>
            <GameGlyph name={isAlive?'check':'skull'}/>
            {isAlive ? 'ALIVE' : 'DEAD'}
          </span>
        </div>
      </div>

      <div className="roulette-heading">
        <div>
          <h1>Death Cap Roulette</h1>
          {currentRound?.isFinalRisk ? (
            <span className="badge-risk"><IconLabel name="warning">เสี่ยงอันตรายถึงชีวิต</IconLabel></span>
          ) : null}
        </div>
        <RouletteClock s={s} now={now} phase={phase} />
      </div>

      {phase === 'PREVIEW' ? (
        <section className="roulette-claim-card">
          <div className="roulette-round-tag">
            <span>เตรียมพร้อมก่อนเริ่มเกม</span>
          </div>
          <p className="roulette-context">
            กติกา 6 รอบ · รอบละ 4 วินาที · มีเวลาตัดสินใจจำกัด:
          </p>
          <ul style={{ fontSize: '14px', lineHeight: '1.7', color: '#e6f4ea', paddingLeft: '20px', margin: '10px 0' }}>
            <li><strong>เชื่อ (BELIEVE):</strong> ถูกได้ +300 แต้ม | <strong>ผิดคือ “ตายทันที” แต้มเป็น 0!</strong></li>
            <li><strong>ไม่เชื่อ (DOUBT):</strong> ผิดได้ +100 แต้ม | ถูกได้ +0 แต้ม (รอดทั้งคู่)</li>
            <li><strong>ไม่ตอบ / หมดเวลา:</strong> ได้ +0 แต้ม (รอด)</li>
          </ul>
          <p style={{ fontSize: '13px', color: 'var(--roulette-muted)' }}>
            ผู้ที่เสียชีวิตจะกลายเป็นผู้ชม ไม่สามารถตอบรอบถัดไปได้ และยังถูกนับเป็นตัวหารคะแนนกลุ่ม
          </p>
          <div className="waiting-note" style={{ marginTop: '16px' }}>
            <p>{me.ready ? 'คุณพร้อมแล้ว · รอผู้จัดเริ่มเกม' : 'กำลังเตรียมความพร้อม…'}</p>
          </div>
        </section>
      ) : phase === 'COUNTDOWN' ? (
        <div className="waiting-note">
          <h2 style={{ fontSize: '28px', color: 'var(--roulette-spore)' }}>เตรียมตัวรอบที่ 1</h2>
          <p>จำไว้: “มั่นใจมาก ไม่ได้แปลว่าถูกต้องเสมอไป”</p>
        </div>
      ) : phase === 'ANSWERING' || phase === 'TRANSITION' ? (
        <>
          <section className={`roulette-claim-card ${currentRound?.isFinalRisk ? 'lethal' : ''}`}>
            <div className="roulette-round-tag">
              <span>รอบที่ {game.round} / 6</span>
              <small style={{ color: 'var(--roulette-muted)' }}>{currentRound?.title}</small>
            </div>

            <p className="roulette-context">{currentRound?.contextText}</p>
            <div className="roulette-claim-text">{currentRound?.claimText}</div>

            {currentRound?.imagePath ? (
              <div className="roulette-image-wrap">
                <img src={currentRound.imagePath} alt={currentRound.title} />
                {currentRound.isFinalRisk ? (
                  <span className="lethal-watermark">LETHAL RISK</span>
                ) : null}
              </div>
            ) : null}

            {currentRound?.confidence ? (
              <ConfidenceGauge confidence={Number(currentRound.confidence)} />
            ) : null}

            {isAlive ? (
              <>
                <div className="roulette-decision-grid">
                  <button
                    className={`roulette-btn believe ${localChoice === 'BELIEVE' ? 'selected' : ''}`}
                    disabled={!isAnswering || isLocked || busy}
                    onClick={() => void handleDecision('BELIEVE')}
                  >
                    <strong>เชื่อ (BELIEVE)</strong>
                    <span>ถูกได้ +300 แต้ม<br /><b style={{ color: '#ff8787' }}>ผิด = ตายทันที</b></span>
                  </button>

                  <button
                    className={`roulette-btn doubt ${localChoice === 'DOUBT' ? 'selected' : ''}`}
                    disabled={!isAnswering || isLocked || busy}
                    onClick={() => void handleDecision('DOUBT')}
                  >
                    <strong>ไม่เชื่อ (DOUBT)</strong>
                    <span>ผิดได้ +100 แต้ม<br /><b style={{ color: '#8ce99a' }}>รอดปลอดภัย</b></span>
                  </button>
                </div>

                {isLocked ? (
                  <div className="roulette-locked-banner">
                    <IconLabel name="check">ล็อกคำตอบแล้ว: {localChoice === 'BELIEVE' ? 'เชื่อ AI' : 'สงสัย / ไม่เชื่อ'} · รอเฉลย</IconLabel>
                  </div>
                ) : null}
              </>
            ) : (
              <div className="roulette-ghost-hud">
                <span className="skull-icon"><GameGlyph name="skull"/></span>
                <h3>คุณเสียชีวิตในรอบที่ {myState?.eliminatedAtRound}</h3>
                <p>เหตุผล: {myState?.eliminatedReason}</p>
                <small>คุณกำลังรับชมในฐานะผู้ชม ดูว่าใครจะรอดจนถึงรอบสุดท้าย</small>
              </div>
            )}
          </section>
        </>
      ) : phase === 'REVEAL' ? (
        <section className={`roulette-reveal-card ${currentRound?.isCorrect ? 'correct-answer' : 'hallucination'}`}>
          <div className={`reveal-verdict-title ${currentRound?.isCorrect ? 'correct' : 'false'}`}>
            {currentRound?.isCorrect ? <IconLabel name="check">คำกล่าวอ้างนี้ถูกต้อง</IconLabel> : <IconLabel name="skull">คำกล่าวอ้างผิด</IconLabel>}
          </div>

          <div className="roulette-claim-text" style={{ fontSize: '17px', margin: '8px 0 14px' }}>
            {currentRound?.claimText}
          </div>

          <p className="roulette-explanation">{currentRound?.explanation}</p>

          {isAlive ? (
            <div className={`roulette-my-result ${myState?.lifeState === 'DEAD' ? 'died' : 'survived'}`}>
              <span>สถานะของคุณรอบนี้:</span>
              <strong>
                {myState?.lifeState === 'DEAD'
                  ? <IconLabel name="skull">เชื่อข้อมูลผิด · คะแนนรอบนี้เป็น 0</IconLabel>
                  : localChoice === 'BELIEVE' && currentRound?.isCorrect
                  ? '+300 แต้ม (เชื่อถูกต้อง)'
                  : localChoice === 'DOUBT' && !currentRound?.isCorrect
                  ? '+100 แต้ม (สงสัยถูกต้อง)'
                  : 'รอดชีวิต (+0 แต้ม)'}
              </strong>
            </div>
          ) : (
            <div className="roulette-my-result died">
              <span>สถานะของคุณ:</span>
              <strong>เสียชีวิตแล้วในรอบที่ {myState?.eliminatedAtRound}</strong>
            </div>
          )}

          <div style={{ marginTop: '14px', fontSize: '13px', color: 'var(--roulette-muted)' }}>
            ผู้รอดชีวิตทั้งหมด: {game.stats.aliveCount} / {game.stats.rosterCount} คน
          </div>
        </section>
      ) : phase === 'RESULT' ? (
        <FinalLeaderboard scores={s.scores ?? []} history={game.pastRounds} />
      ) : null}

      {message ? <p className="input-message" role="status">{message}</p> : null}
    </main>
  );
}

// =========================================================
// 2. DISPLAY VIEW (1920x1080 Projector)
// =========================================================
function RouletteDisplay({ room }: { room: RoomState }) {
  const s = room.snapshot!;
  const game = s.roulette!;
  const r = s.run?.gameId === 'confidence-roulette' ? s.run : null;
  const now = useNow(room);

  const phase = game.roundPhase;
  const currentRound = game.currentRound;

  return (
    <main className="roulette-display">
      <div className="roulette-heading">
        <div>
          <h1>Death Cap Roulette: เชื่อ รอด หรือจบเกม</h1>
          <p style={{ margin: '4px 0 0', fontSize: '18px', color: 'var(--roulette-muted)' }}>
            คิว 07.01 · ห้อง {s.room.code} · AI มั่นใจมาก ไม่ได้แปลว่าถูกต้องเสมอไป
          </p>
        </div>
        <RouletteClock s={s} now={now} phase={phase} />
      </div>

      {phase === 'RESULT' ? (
        <FinalLeaderboard scores={s.scores ?? []} history={game.pastRounds} />
      ) : (
        <div className="roulette-display-stage">
          {/* Main Stage Card */}
          <div className={`roulette-display-claim-box ${currentRound?.isFinalRisk ? 'lethal' : ''}`}>
            <div className="display-round-header">
              <span className="display-round-badge">
                {phase === 'PREVIEW'
                  ? 'รอบทดสอบกติกา'
                  : phase === 'COUNTDOWN'
                  ? 'เตรียมเข้าสู่รอบที่ 1'
                  : `รอบที่ ${game.round} จาก 6`}
              </span>
              {currentRound?.isFinalRisk ? (
                <span className="badge-risk"><IconLabel name="warning">LETHAL DECISION RISK</IconLabel></span>
              ) : null}
            </div>

            <p className="display-context">{currentRound?.contextText}</p>
            <div className="display-claim">{currentRound?.claimText}</div>

            {currentRound?.imagePath ? (
              <div className="display-image-wrap">
                <img src={currentRound.imagePath} alt={currentRound.title} />
              </div>
            ) : null}

            {currentRound?.confidence ? (
              <ConfidenceGauge confidence={Number(currentRound.confidence)} />
            ) : null}

            {phase === 'REVEAL' ? (
              <div className={`display-reveal-stage ${currentRound?.isCorrect ? 'true' : 'hallucination'}`}>
                <div className="display-reveal-banner">
                  {currentRound?.isCorrect ? <IconLabel name="check">ข้อความนี้ถูกต้อง</IconLabel> : <IconLabel name="skull">ข้อความนี้ผิด</IconLabel>}
                </div>
                <p className="display-explanation">{currentRound?.explanation}</p>
                <div className="display-death-toll">
                  <span>ผู้เสียชีวิตรอบนี้:</span>
                  <strong>
                    {game.pastRounds.find((p) => p.roundNo === game.round)?.totalDeaths ?? 0} คน
                  </strong>
                </div>
              </div>
            ) : null}
          </div>

          {/* Right Statistics Column */}
          <div className="roulette-display-side">
            <div className="display-stat-card">
              <h3>สถานะผู้เล่นแบบเรียลไทม์</h3>
              <div className="display-survival-counter">
                <div className="display-counter-item alive">
                  <strong>{game.stats.aliveCount}</strong>
                  <span>ยังมีชีวิต</span>
                </div>
                <div className="display-counter-item dead">
                  <strong>{game.stats.deadCount}</strong>
                  <span>เสียชีวิตแล้ว</span>
                </div>
                <div className="display-counter-item answered">
                  <strong>{game.stats.answeredCount}</strong>
                  <span>ตอบแล้ว</span>
                </div>
              </div>
            </div>

            <div className="display-stat-card">
              <h3>อัตราการรอดชีวิตแยกตามกลุ่ม</h3>
              <GroupSurvivalGrid survival={game.groupSurvival} />
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

// =========================================================
// 3. HOST VIEW
// =========================================================
function RouletteHost({ room }: { room: RoomState }) {
  const s = room.snapshot!;
  const game = s.roulette!;
  const r = s.run?.gameId === 'confidence-roulette' ? s.run : null;
  const now = useNow(room);
  const controller = useRef(tabIdentity('controller'));

  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [reason, setReason] = useState('');
  const [timing, setTiming] = useState('normal');

  const hasControl = s.host?.controllerId === controller.current && (s.host.leaseUntil ?? 0) > now;

  const acquire = useCallback(async () => {
    try {
      await command(s.room.code, 'host', 'acquire', {
        controllerId: controller.current,
        ...(reason.trim() ? { reason: reason.trim() } : {})
      });
      await room.refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'รับสิทธิ์ไม่ได้');
    }
  }, [s.room.code, room.refresh, reason]);

  useEffect(() => {
    if (s.host && !s.host.controllerId) void acquire();
  }, [s.host?.controllerId, acquire]);

  useEffect(() => {
    if (!hasControl) return;
    const timer = setInterval(() => {
      const cur = room.latest.current;
      if (cur?.host) {
        void command(s.room.code, 'host', 'heartbeat', {
          controllerId: controller.current,
          controllerEpoch: cur.host.controllerEpoch
        }).catch(() => void room.refresh());
      }
    }, 5000);
    return () => clearInterval(timer);
  }, [hasControl, s.room.code, room.latest, room.refresh]);

  const act = useCallback(
    async (kind: string, payload: Record<string, unknown> = {}) => {
      setBusy(true);
      setMessage('');
      const cur = room.latest.current!;
      try {
        const response = await command(s.room.code, 'host', kind, {
          ...payload,
          controllerId: controller.current,
          controllerEpoch: cur.host!.controllerEpoch,
          expectedVersion: cur.room.version
        });
        await room.refresh();
        if (kind === 'start' && Number(response.unready) > 0) {
          setMessage(`เริ่มแล้ว มีผู้เล่นยังไม่พร้อม ${response.unready} คน ใช้เวลารอบเดียวกัน`);
        }
      } catch (e) {
        setMessage(e instanceof Error ? e.message : 'ติดต่อระบบไม่ได้');
        void room.refresh();
      } finally {
        setBusy(false);
      }
    },
    [room.latest, room.refresh, s.room.code]
  );

  const disabled = busy || !hasControl || !room.apiOnline;
  const active = r?.status === 'RUNNING';
  const canStart = !s.room.activeRunId && s.room.cue === '07.01' && r?.status !== 'COMPLETED';

  return (
    <main className="host-main roulette-page" style={{ padding: '24px 32px' }}>
      <div className="host-heading">
        <div>
          <h1>Death Cap Roulette (Host)</h1>
          <p>
            คิว {s.room.cue} · ห้อง {s.room.code} · ผู้เล่น {s.groups.reduce((sum, g) => sum + g.members, 0)} / {s.room.capacity} คน
          </p>
        </div>
        <a className="secondary button-link" href={`/display/${s.room.code}`} target="_blank" rel="noreferrer">
          เปิดจอฉาย
        </a>
      </div>

      <div className="roulette-host-telemetry">
        <div className="telemetry-cell">
          <span>รอบปัจจุบัน</span>
          <strong>{game.round} / 6</strong>
        </div>
        <div className="telemetry-cell alive">
          <span>ผู้รอดชีวิต</span>
          <strong>{game.stats.aliveCount}</strong>
        </div>
        <div className="telemetry-cell dead">
          <span>เสียชีวิตแล้ว</span>
          <strong>{game.stats.deadCount}</strong>
        </div>
        <div className="telemetry-cell answered">
          <span>ส่งคำตอบรอบนี้</span>
          <strong>{game.stats.answeredCount}</strong>
        </div>
      </div>

      <div className="host-grid">
        <section className="control-section">
          <div className="section-heading">
            <h2>{active ? `กำลังเล่น: ${game.roundPhase}` : r?.status === 'RESULT' ? 'สรุปผลรอยืนยัน' : 'พร้อมเริ่มเกม'}</h2>
            <RouletteClock s={s} now={now} phase={game.roundPhase} />
          </div>

          {!hasControl ? (
            <div className="control-notice">
              <p>รับสิทธิ์ควบคุมก่อนเริ่มเกม</p>
              <button className="secondary" onClick={() => void acquire()}>
                รับสิทธิ์ควบคุม
              </button>
            </div>
          ) : null}

          <div className="host-controls">
            {canStart ? (
              <button className="primary" disabled={disabled} onClick={() => void act('start', { timingProfile: timing })}>
                เริ่มเกม 6 รอบ
              </button>
            ) : null}

            {active && r!.deadline !== null ? (
              <button className="secondary" disabled={disabled} onClick={() => void act(r!.paused ? 'resume' : 'pause')}>
                {r!.paused ? 'เล่นต่อ' : 'พักเกม'}
              </button>
            ) : null}

            {r?.status === 'RESULT' ? (
              <button
                className="primary finish-button"
                disabled={disabled}
                onClick={() => void act('finish', { inputDigest: s.host!.inputDigest })}
              >
                ยืนยันผล / ไปคิว 07.02
              </button>
            ) : null}
          </div>

          {message ? <p className="input-message" role="status">{message}</p> : null}

          <details className="host-tools" style={{ marginTop: '24px' }}>
            <summary>จัดการรอบและเปลี่ยนคิว</summary>
            <label htmlFor="roulette-host-reason">เหตุผลยกเลิก / เล่นใหม่</label>
            <input
              id="roulette-host-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={200}
            />
            <div className="tool-buttons">
              <button
                className="quiet danger"
                disabled={disabled || !s.room.activeRunId || !reason.trim()}
                onClick={() => void act('cancel', { reason: reason.trim() })}
              >
                ยกเลิก / ไม่นับคะแนน
              </button>
              <button
                className="secondary"
                disabled={disabled || !r || !reason.trim()}
                onClick={() => void act('replay', { reason: reason.trim() })}
              >
                เล่นใหม่แทนรอบเดิม
              </button>
            </div>
            <label>
              คิวสไลด์
              <select
                value={s.room.cue}
                disabled={disabled || !!s.room.activeRunId}
                onChange={(e) => void act('cue', { cue: e.target.value })}
              >
                {allCues.map((c) => (
                  <option key={c.cue.id} value={c.cue.id}>
                    {c.cue.id} {c.cue.title}
                  </option>
                ))}
              </select>
            </label>
          </details>
        </section>

        <aside className="join-section">
          <h2>ชวนผู้เล่น</h2>
          <strong className="room-code">{s.room.code}</strong>
          <p>
            เกมที่ 4 · Death Cap Roulette<br />
            รอบละ 4 วินาที · 6 รอบรวม<br />
            คะแนนเต็ม 1,200 แต้ม
          </p>
        </aside>
      </div>

      <section className="room-members" style={{ marginTop: '32px' }}>
        <h2>กลุ่มและความพร้อมของผู้เล่น</h2>
        <div className="group-roster-grid">
          {s.groups.map((g) => (
            <div key={g.id} className="roster-column">
              <h3>
                {g.name} <small>{g.members} คน</small>
              </h3>
              <ul>
                {s.host?.members
                  .filter((m) => m.groupId === g.id)
                  .map((m) => (
                    <li key={m.id}>
                      <span>{m.nickname}</span>
                      <span>{m.online ? 'ออนไลน์' : 'ขาดการเชื่อมต่อ'}</span>
                    </li>
                  ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

export default function RouletteGame({ room }: { room: RoomState }) {
  if (room.snapshot?.role === 'host') {
    return <RouletteHost room={room} />;
  }
  if (room.snapshot?.role === 'display') {
    return <RouletteDisplay room={room} />;
  }
  return <RoulettePlayer room={room} />;
}
