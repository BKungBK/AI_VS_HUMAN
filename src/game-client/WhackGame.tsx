import {useCallback, useEffect, useRef, useState} from 'react';
import type {Snapshot, WhackBubbleItem, WhackSnapshot} from '../shared/game-contracts';
import {command, tabIdentity, type useRoom} from './network';
import {whackSound} from './whack-sound';
import GameGlyph,{IconLabel} from './GameGlyph';
import './whack.css';

function useTicker(now: () => number) {
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick(x => x + 1), 60);
    return () => clearInterval(id);
  }, []);
  return now();
}

// ============================================================================
// Pinned Context Banner
// ============================================================================
function ContextBanner({text}: {text: string}) {
  return (
    <div className="whack-context-banner" role="region" aria-label="บริบทสถานการณ์จำลอง">
      <div className="whack-context-icon"><GameGlyph name="warning"/></div>
      <div className="whack-context-content">
        <div className="whack-context-title">บริบทของสถานการณ์ (Pinned Context)</div>
        <p className="whack-context-text">“{text}”</p>
      </div>
    </div>
  );
}

// ============================================================================
// Player View (Mobile Screen)
// ============================================================================
export function WhackPlayer({room}: {room: ReturnType<typeof useRoom>}) {
  const s = room.snapshot!;
  const me = s.me!;
  const r = s.run;
  const game: WhackSnapshot = s.whack ?? {
    contentVersion: 'whack-a-mole-v1',
    phase: 'PREVIEW',
    contextBanner: 'ผู้ใช้ขอคุยกับเจ้าหน้าที่ และบอกว่าคำแนะนำเดิมทำให้ไม่สบายใจ',
    bubbles: [],
    myState: null,
    revealed: false,
    keyPairs: null,
    stats: {rosterCount: 0, totalHits: 0, totalCorrectHits: 0, totalWrongHits: 0, missedRiskCount: 0, bubbleHits: []},
  };

  const now = useTicker(room.now);
  const [soundOn, setSoundOn] = useState(true);
  const [localHits, setLocalHits] = useState<Record<string, {stamped: boolean; isCorrect?: boolean}>>({});
  const [practiceWhacked, setPracticeWhacked] = useState<Record<string, boolean>>({});
  const seenSpawns = useRef<Set<string>>(new Set());
  const timesUpPlayed = useRef(false);

  // Sync sound toggle
  useEffect(() => {
    whackSound.setEnabled(soundOn);
  }, [soundOn]);

  // Ready handshake during PREVIEW
  const preview = s.room.activeRunId === null && s.room.cue === '10.02';
  useEffect(() => {
    if (!preview || me.ready || !room.apiOnline) return;
    let cancelled = false;
    const sendReady = async () => {
      try {
        await document.fonts.ready;
        if (!cancelled) {
          await command(s.room.code, 'player', 'ready', {
            previewId: s.room.previewId,
            contentVersion: 'whack-a-mole-v1',
          });
          await room.refresh();
        }
      } catch {
        // Retry silently
      }
    };
    void sendReady();
    return () => {
      cancelled = true;
    };
  }, [preview, me.ready, s.room.previewId, s.room.code, room.apiOnline, room.refresh]);

  // Reset local state on new run
  useEffect(() => {
    setLocalHits({});
    seenSpawns.current = new Set();
    timesUpPlayed.current = false;
  }, [r?.id]);

  // Merge server acknowledged hits into localHits
  useEffect(() => {
    if (game.myState?.hits) {
      setLocalHits(prev => {
        const next = {...prev};
        for (const h of game.myState!.hits) {
          if (!next[h.bubbleId]) {
            next[h.bubbleId] = {stamped: true, isCorrect: h.isCorrect ?? undefined};
          }
        }
        return next;
      });
    }
  }, [game.myState?.hits]);

  const active = r?.status === 'RUNNING';
  const paused = !!r?.paused;
  const isPlaying = active && r.phase === 'PLAYING' && !paused;
  const isCountdown = active && r.phase === 'COUNTDOWN';
  const isResult = r?.status === 'RESULT' || r?.status === 'COMPLETED' || game.revealed;

  // Compute precise arcade elapsed time (0.0 to 25.0s) derived from server deadline
  const remainingArcadeSec = Math.max(0, ((r?.deadline ?? now) - now) / 1000);
  const elapsedArcadeSec = Math.min(25.0, Math.max(0, 25.0 - remainingArcadeSec));

  // Sound cues during Countdown
  const countdownSec = Math.ceil(Math.max(0, ((r?.deadline ?? now) - now) / 1000));
  const prevCountdown = useRef<number | null>(null);
  useEffect(() => {
    if (isCountdown && countdownSec !== prevCountdown.current) {
      prevCountdown.current = countdownSec;
      if (countdownSec > 0) whackSound.playTick();
    }
  }, [isCountdown, countdownSec]);

  // Sound cues on Time's Up
  useEffect(() => {
    if (isResult && !timesUpPlayed.current) {
      timesUpPlayed.current = true;
      whackSound.playTimesUp();
    }
  }, [isResult]);

  // Compute active bubbles for slots 0-5
  const activeBubbles: Record<number, WhackBubbleItem | null> = {0: null, 1: null, 2: null, 3: null, 4: null, 5: null};
  if (isPlaying) {
    for (const b of game.bubbles) {
      if (elapsedArcadeSec >= b.spawnAtSec && elapsedArcadeSec < b.expiresAtSec) {
        activeBubbles[b.slot] = b;
        if (!seenSpawns.current.has(b.bubbleId)) {
          seenSpawns.current.add(b.bubbleId);
          whackSound.playSpawn();
        }
      }
    }
  }

  // Handle tap on bubble
  const handleWhack = useCallback(
    async (b: WhackBubbleItem) => {
      if (!isPlaying || localHits[b.bubbleId]?.stamped) return;

      // 1. Immediate tactile and audio feedback
      whackSound.playWhack();
      setLocalHits(prev => ({...prev, [b.bubbleId]: {stamped: true}}));

      // 2. Dispatch to server
      try {
        const res = await command<{accepted: boolean; isCorrect: boolean; duplicate?: boolean}>(
          s.room.code,
          'player',
          'whack-hit',
          {
            runId: r!.id,
            phaseToken: r!.phaseToken,
            bubbleId: b.bubbleId,
            clientTimeMs: Math.round(elapsedArcadeSec * 1000),
          }
        );

        if (res.accepted) {
          setLocalHits(prev => ({
            ...prev,
            [b.bubbleId]: {stamped: true, isCorrect: res.isCorrect},
          }));
          if (res.isCorrect) {
            whackSound.playCorrect();
          } else {
            whackSound.playWrong();
          }
        }
      } catch {
        // Keep stamped on local
      }
    },
    [isPlaying, localHits, s.room.code, r, elapsedArcadeSec]
  );

  // Practice bubbles
  const handlePracticeWhack = (id: string, isStop: boolean) => {
    whackSound.playWhack();
    setPracticeWhacked(prev => ({...prev, [id]: true}));
    if (isStop) {
      whackSound.playCorrect();
    } else {
      whackSound.playWrong();
    }
  };

  const correctCount = game.myState?.correctHits ?? Object.values(localHits).filter(h => h.isCorrect === true).length;
  const currentScore = game.myState?.score ?? Math.max(0, Math.min(900, (game.myState?.rawScore ?? 0)));

  return (
    <main className="whack-container">
      {/* Context banner pinned at top */}
      <ContextBanner text={game.contextBanner} />

      {/* Top HUD */}
      <div className="whack-hud">
        <div className="whack-hud-metric">
          <span className="whack-hud-label">ผู้ตรวจ</span>
          <span className="whack-hud-val" style={{fontSize: '15px'}}>{me.nickname}</span>
        </div>
        <div className="whack-hud-metric" style={{textAlign: 'center'}}>
          <span className="whack-hud-label">{paused ? 'พักเกม' : isCountdown ? 'เตรียมตัว' : isPlaying ? 'เวลาเล่น' : 'สถานะ'}</span>
          <span className="whack-hud-val time">
            {paused ? 'PAUSED' : isCountdown ? `${countdownSec}s` : isPlaying ? `${Math.max(0, remainingArcadeSec).toFixed(1)}s` : isResult ? 'จบเกม' : 'พร้อม'}
          </span>
        </div>
        <div className="whack-hud-metric" style={{textAlign: 'right'}}>
          <span className="whack-hud-label">คะแนน</span>
          <span className="whack-hud-val score">{currentScore}</span>
        </div>
        <button
          type="button"
          className="whack-hud-sound-btn"
          onClick={() => setSoundOn(x => !x)}
          aria-label={soundOn ? 'ปิดเสียง' : 'เปิดเสียง'}
        >
          <GameGlyph name={soundOn?'sound-on':'sound-off'}/>
        </button>
      </div>

      {/* Mode 1: PREVIEW & PRACTICE */}
      {preview && (
        <div className="whack-practice-card">
          <h2 className="whack-practice-title">
            <IconLabel name="target">แตะหยุดแชตที่เสี่ยง</IconLabel>
          </h2>
          <p className="whack-practice-desc">
            ในบริบทที่ผู้ใช้ขอคุยกับเจ้าหน้าที่และแจ้งว่าไม่สบายใจ ให้แตะทุบข้อความที่<b>ปิดกั้นการช่วยเหลือ หรือรับประกันเกินจริง (+100)</b> ส่วนข้อความที่ช่วยเปิดทางให้ปล่อยผ่าน <b>หากทุบข้อความช่วยเหลือจะถูกหัก 100 คะแนน</b>
          </p>

          <div className="whack-practice-slots">
            <div
              className="whack-bubble"
              style={{position: 'relative', height: '110px'}}
              onClick={() => handlePracticeWhack('p1', true)}
            >
              <div className="whack-bubble-header">
                <span className="whack-bot-badge">BOT จำลอง</span>
              </div>
              <p className="whack-bubble-text">“ไม่ต้องคุยกับใคร”</p>
              {practiceWhacked.p1 && (
                <div className="whack-stamp-overlay">
                  <div className="whack-stamp-badge"><IconLabel name="stop">หยุด / ส่งตรวจ</IconLabel></div>
                  <span className="whack-stamp-sub">+100 ถูกต้อง!</span>
                </div>
              )}
            </div>

            <div
              className="whack-bubble"
              style={{position: 'relative', height: '110px'}}
              onClick={() => handlePracticeWhack('p2', false)}
            >
              <div className="whack-bubble-header">
                <span className="whack-bot-badge">BOT จำลอง</span>
              </div>
              <p className="whack-bubble-text">“ฉันช่วยติดต่อเจ้าหน้าที่ได้”</p>
              {practiceWhacked.p2 && (
                <div className="whack-stamp-overlay">
                  <div className="whack-stamp-badge wrong"><IconLabel name="warning">ข้อความช่วยเหลือ</IconLabel></div>
                  <span className="whack-stamp-sub">-100 ควรปล่อยผ่าน</span>
                </div>
              )}
            </div>
          </div>
          <p style={{fontSize: '12px', color: '#94a3b8', marginTop: '10px', textAlign: 'center'}}>
            {me.ready ? <IconLabel name="check">พร้อมแล้ว · รอผู้จัดเริ่ม</IconLabel> : 'กำลังเตรียมเกม…'}
          </p>
        </div>
      )}

      {/* Mode 2: COUNTDOWN OVERLAY */}
      {isCountdown && (
        <div className="whack-countdown-overlay">
          <div className="whack-countdown-number">{countdownSec}</div>
          <div className="whack-countdown-hint">เตรียมสายตาจ้อง 6 ช่อง… เล่นจริง 25 วินาที!</div>
        </div>
      )}

      {/* Mode 3: PLAYING 2x3 GRID */}
      {isPlaying && (
        <div className="whack-grid">
          {[0, 1, 2, 3, 4, 5].map(slotIdx => {
            const b = activeBubbles[slotIdx];
            const hitInfo = b ? localHits[b.bubbleId] : null;
            const progress = b ? Math.max(0, Math.min(1, 1 - (elapsedArcadeSec - b.spawnAtSec) / 2.4)) : 0;

            return (
              <div key={slotIdx} className="whack-slot">
                {b && (
                  <div
                    className="whack-bubble"
                    onPointerDown={e => {
                      if (e.button !== 0) return;
                      e.preventDefault();
                      void handleWhack(b);
                    }}
                  >
                    <div className="whack-bubble-header">
                      <span className="whack-bot-badge">ข้อความแชต</span>
                    </div>
                    <p className="whack-bubble-text">“{b.text}”</p>
                    <div className="whack-bubble-timer">
                      <div
                        className="whack-bubble-timer-fill"
                        style={{transform: `scaleX(${progress})`}}
                      />
                    </div>

                    {hitInfo?.stamped && (
                      <div className="whack-stamp-overlay">
                        <div className={`whack-stamp-badge ${hitInfo.isCorrect === false ? 'wrong' : ''}`}>
                          {hitInfo.isCorrect === false ? <IconLabel name="warning">แตะผิด</IconLabel> : <IconLabel name="stop">หยุด / ส่งตรวจ</IconLabel>}
                        </div>
                        <span className="whack-stamp-sub">
                          {hitInfo.isCorrect === false ? '-100 ข้อความดี' : '+100 ข้อความเสี่ยง'}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Mode 4: RESULT SCREEN */}
      {isResult && (
        <div className="whack-result-screen">
          <div className="whack-score-card">
            <span className="whack-hud-label">คะแนนของคุณในเกมนี้</span>
            <div className="whack-score-hero">
              {game.myState?.score ?? 0}
              <small>/ 900</small>
            </div>
            <p style={{fontSize: '13px', color: '#94a3b8', margin: 0}}>
              {r?.status === 'COMPLETED' ? 'ยืนยันคะแนนเรียบร้อยแล้ว' : 'รอผู้จัดยืนยันผลเพื่อไปสไลด์ถัดไป'}
            </p>

            <div className="whack-stats-row">
              <div className="whack-stat-pill">
                <span className="whack-stat-num correct">{game.myState?.correctHits ?? 0}</span>
                <span className="whack-stat-lbl">หยุดถูกต้อง (+100)</span>
              </div>
              <div className="whack-stat-pill">
                <span className="whack-stat-num wrong">{game.myState?.wrongHits ?? 0}</span>
                <span className="whack-stat-lbl">ทุบผิด (-100)</span>
              </div>
              <div className="whack-stat-pill">
                <span className="whack-stat-num missed">{9 - (game.myState?.correctHits ?? 0)}</span>
                <span className="whack-stat-lbl">หลุดผ่าน (0)</span>
              </div>
            </div>
          </div>

          {/* Key Comparison Pairs */}
          {game.keyPairs && game.keyPairs.length > 0 && (
            <div className="whack-pairs-section">
              <h3 style={{fontSize: '15px', color: '#fff', margin: '4px 0 0 0'}}>บทเรียนสำคัญ: 2 คู่เปรียบเทียบ</h3>
              {game.keyPairs.map((pair, idx) => (
                <div key={idx} className="whack-pair-card">
                  <div className="whack-pair-lesson"><GameGlyph name="idea"/> {pair.teachingPoint}</div>
                  <div className="whack-pair-grid">
                    <div className="whack-bubble-reveal stop">
                      <span className="whack-bubble-tag stop"><IconLabel name="stop">ควรหยุด</IconLabel></span>
                      <span className="whack-reveal-quote">“{pair.stopBubble.text}”</span>
                      <span className="whack-reveal-reason">{pair.stopBubble.explanation}</span>
                    </div>
                    <div className="whack-bubble-reveal pass">
                      <span className="whack-bubble-tag pass"><IconLabel name="check">ปล่อยผ่าน</IconLabel></span>
                      <span className="whack-reveal-quote">“{pair.passBubble.text}”</span>
                      <span className="whack-reveal-reason">{pair.passBubble.explanation}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Group standing */}
          {s.scores && (
            <div className="whack-pair-card">
              <h3 style={{fontSize: '15px', color: '#fff', margin: '0 0 8px 0'}}>คะแนนเฉลี่ยกลุ่ม</h3>
              <ol style={{paddingLeft: '20px', margin: 0, color: '#e2e8f0', fontSize: '14px'}}>
                {s.scores.map(g => (
                  <li key={g.id} style={{marginBottom: '4px'}}>
                    <b>{g.name}:</b> {g.denominator ? (g.numerator / g.denominator).toFixed(1) : '0.0'} คะแนน
                    <span style={{fontSize: '12px', color: '#94a3b8', marginLeft: '6px'}}>
                      ({g.numerator} คะแนน / {g.denominator} คน)
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}
    </main>
  );
}

// ============================================================================
// Display View (Big Projector 1920x1080)
// ============================================================================
export function WhackDisplay({room}: {room: ReturnType<typeof useRoom>}) {
  const s = room.snapshot!;
  const r = s.run;
  const game = s.whack;
  const now = useTicker(room.now);

  const active = r?.status === 'RUNNING';
  const isPlaying = active && r?.phase === 'PLAYING' && !r.paused;
  const isCountdown = active && r?.phase === 'COUNTDOWN';
  const isResult = r?.status === 'RESULT' || r?.status === 'COMPLETED' || game?.revealed;

  const remainingArcadeSec = Math.max(0, ((r?.deadline ?? now) - now) / 1000);
  const countdownSec = Math.ceil(Math.max(0, ((r?.deadline ?? now) - now) / 1000));

  return (
    <main className="whack-display-container">
      <div className="whack-display-header">
        <div className="whack-display-title">
          <h1>Chat Whack-a-Mole: ทุบแชตที่ควรหยุด</h1>
          <p>คิว 10.02 · บริบท: เมื่อคำแนะนำบอตกระทบความปลอดภัยและความรู้สึกของผู้ใช้</p>
        </div>
        <div style={{textAlign: 'right'}}>
          <div style={{fontSize: '13px', color: '#94a3b8'}}>ห้อง {s.room.code}</div>
          <div style={{fontSize: '28px', fontWeight: 900, color: 'var(--whack-cyan)'}}>
            {isCountdown ? `นับถอยหลัง ${countdownSec}s` : isPlaying ? `เหลือ ${remainingArcadeSec.toFixed(1)}s` : isResult ? 'สรุปผลและเฉลย' : 'รอผู้จัดเริ่มเกม'}
          </div>
        </div>
      </div>

      <ContextBanner text={game?.contextBanner ?? 'ผู้ใช้ขอคุยกับเจ้าหน้าที่ และบอกว่าคำแนะนำเดิมทำให้ไม่สบายใจ'} />

      {/* Room Stat Cards */}
      <div className="whack-display-stats">
        <div className="whack-display-stat-card">
          <div className="whack-display-stat-val">{game?.stats.rosterCount ?? s.groups.reduce((n, g) => n + g.members, 0)}</div>
          <div className="whack-display-stat-lbl">ผู้ตรวจทั้งหมด (คน)</div>
        </div>
        <div className="whack-display-stat-card">
          <div className="whack-display-stat-val" style={{color: 'var(--whack-pass)'}}>{game?.stats.totalCorrectHits ?? 0}</div>
          <div className="whack-display-stat-lbl">หยุดข้อความเสี่ยงสำเร็จ (ครั้ง)</div>
        </div>
        <div className="whack-display-stat-card">
          <div className="whack-display-stat-val" style={{color: 'var(--whack-danger)'}}>{game?.stats.totalWrongHits ?? 0}</div>
          <div className="whack-display-stat-lbl">ทุบข้อความช่วยเหลือผิดพลาด (ครั้ง)</div>
        </div>
        <div className="whack-display-stat-card">
          <div className="whack-display-stat-val" style={{color: '#38bdf8'}}>{game?.stats.totalHits ?? 0}</div>
          <div className="whack-display-stat-lbl">การแตะทุบรวมทั้งห้อง</div>
        </div>
      </div>

      {/* Result Key Comparison Pairs */}
      {isResult && game?.keyPairs && (
        <div className="whack-display-pairs">
          {game.keyPairs.map((pair, idx) => (
            <div key={idx} className="whack-pair-card" style={{padding: '18px'}}>
              <div className="whack-pair-lesson" style={{fontSize: '16px'}}>
                บทเรียนที่ {idx + 1}: {pair.teachingPoint}
              </div>
              <div className="whack-pair-grid">
                <div className="whack-bubble-reveal stop" style={{padding: '14px'}}>
                  <span className="whack-bubble-tag stop" style={{fontSize: '12px'}}><IconLabel name="stop">ข้อความที่ควรหยุด</IconLabel></span>
                  <span className="whack-reveal-quote" style={{fontSize: '16px'}}>“{pair.stopBubble.text}”</span>
                  <span className="whack-reveal-reason" style={{fontSize: '13px'}}>{pair.stopBubble.explanation}</span>
                </div>
                <div className="whack-bubble-reveal pass" style={{padding: '14px'}}>
                  <span className="whack-bubble-tag pass" style={{fontSize: '12px'}}><IconLabel name="check">ข้อความที่ควรปล่อยผ่าน</IconLabel></span>
                  <span className="whack-reveal-quote" style={{fontSize: '16px'}}>“{pair.passBubble.text}”</span>
                  <span className="whack-reveal-reason" style={{fontSize: '13px'}}>{pair.passBubble.explanation}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Scores Table */}
      {isResult && s.scores && (
        <div style={{marginTop: '24px', background: 'var(--whack-surface)', border: '1px solid var(--whack-border)', borderRadius: '12px', padding: '18px'}}>
          <h2 style={{margin: '0 0 12px 0', fontSize: '18px'}}>คะแนนเฉลี่ยประจำกลุ่ม (คิดรวมสมาชิกที่ได้ 0)</h2>
          <div style={{display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px'}}>
            {s.scores.map((g, idx) => (
              <div key={g.id} style={{background: 'rgba(0,0,0,0.3)', padding: '12px', borderRadius: '8px', borderLeft: `4px solid ${idx === 0 ? '#f59e0b' : '#38bdf8'}`}}>
                <div style={{fontWeight: 700, fontSize: '15px'}}>{g.name}</div>
                <div style={{fontSize: '22px', fontWeight: 900, color: '#38bdf8', margin: '4px 0'}}>
                  {g.denominator ? (g.numerator / g.denominator).toFixed(2) : '0.00'} <small style={{fontSize: '12px', color: '#94a3b8'}}>แต้มเฉลี่ย</small>
                </div>
                <div style={{fontSize: '12px', color: '#94a3b8'}}>รวม {g.numerator} แต้ม จากสมาชิก {g.denominator} คน</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}

// ============================================================================
// Host View (Presenter Controls)
// ============================================================================
export function WhackHost({room}: {room: ReturnType<typeof useRoom>}) {
  const s = room.snapshot!;
  const r = s.run;
  const game = s.whack;
  const controller = useRef(tabIdentity('controller'));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [reason, setReason] = useState('');
  const now = useTicker(room.now);

  const hasControl = s.host?.controllerId === controller.current && (s.host?.leaseUntil ?? 0) > now;

  const acquire = useCallback(
    async (takeover = false) => {
      try {
        await command(s.room.code, 'host', 'acquire', {
          controllerId: controller.current,
          ...(takeover ? {reason: reason.trim()} : {}),
        });
        await room.refresh();
        setMessage('');
      } catch (e) {
        setMessage(e instanceof Error ? e.message : 'รับสิทธิ์ไม่ได้');
      }
    },
    [s.room.code, room.refresh, reason]
  );

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
          controllerEpoch: cur.host.controllerEpoch,
        }).catch(() => void room.refresh());
      }
    }, 5000);
    return () => clearInterval(timer);
  }, [hasControl, s.room.code, room.latest, room.refresh]);

  const act = async (kind: string, payload: Record<string, unknown> = {}) => {
    setBusy(true);
    setMessage('');
    const cur = room.latest.current!;
    try {
      const res = await command(s.room.code, 'host', kind, {
        ...payload,
        controllerId: controller.current,
        controllerEpoch: cur.host!.controllerEpoch,
        expectedVersion: cur.room.version,
      });
      await room.refresh();
      if (kind === 'start' && Number(res.unready) > 0) {
        setMessage(`เริ่มแล้ว มีผู้เล่นยังไม่พร้อม ${res.unready} คน`);
      } else if (['cancel', 'replay'].includes(kind)) {
        setReason('');
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'ติดต่อระบบไม่ได้');
      void room.refresh();
    } finally {
      setBusy(false);
    }
  };

  const baseDisabled = busy || !hasControl || !room.apiOnline;
  const active = r?.gameId === 'chat-whack-a-mole' && r.status === 'RUNNING';
  const result = r?.gameId === 'chat-whack-a-mole' && r.status === 'RESULT';
  const finished = r?.gameId === 'chat-whack-a-mole' && r.status === 'COMPLETED';
  const canStart = !s.room.activeRunId && s.room.cue === '10.02' && !finished;

  return (
    <main className="host-main">
      <div className="host-heading">
        <div>
          <h1>Chat Whack-a-Mole (ทุบแชตที่ควรหยุด)</h1>
          <p>
            คิว {s.room.cue} · {r ? `รอบ ${r.id.slice(0, 8)}` : 'เตรียมห้อง'} · ผู้เล่น{' '}
            {s.groups.reduce((v, g) => v + g.members, 0)}/{s.room.capacity} คน
          </p>
        </div>
        <a className="secondary button-link" href={`/display/${s.room.code}`} target="_blank" rel="noreferrer">
          เปิดจอฉาย
        </a>
      </div>

      <div className="host-grid">
        <section className="control-section">
          <div className="section-heading">
            <h2>
              {active
                ? r?.paused
                  ? 'พักเกม'
                  : r?.phase === 'COUNTDOWN'
                  ? 'กำลังนับถอยหลัง 3 วินาที'
                  : 'กำลังเล่น 25 วินาที'
                : result
                ? 'จบเกม / ตรวจสอบสถิติและเฉลย'
                : finished
                ? 'ยืนยันคะแนนแล้ว'
                : 'พร้อมเริ่ม Chat Whack-a-Mole'}
            </h2>
          </div>

          <ContextBanner text={game?.contextBanner ?? 'ผู้ใช้ขอคุยกับเจ้าหน้าที่ และบอกว่าคำแนะนำเดิมทำให้ไม่สบายใจ'} />

          {!hasControl && (
            <div className="control-notice">
              <p>ยังไม่มีสิทธิ์ควบคุมห้อง</p>
              <button
                type="button"
                className="secondary"
                disabled={busy}
                onClick={() => void acquire(true)}
              >
                รับสิทธิ์ควบคุม
              </button>
            </div>
          )}

          <div className="host-controls">
            {!active && !result && !finished && s.room.cue === '10.02' && (
              <button
                type="button"
                className="primary"
                disabled={baseDisabled || !canStart}
                onClick={() => void act('start', {timingProfile: 'normal'})}
              >
                เริ่มเกม (25 วินาที)
              </button>
            )}

            {active && (
              <button
                type="button"
                className="primary"
                disabled={baseDisabled}
                onClick={() => void act(r!.paused ? 'resume' : 'pause')}
              >
                {r?.paused ? 'เล่นต่อ' : 'พักเกม'}
              </button>
            )}

            {result && (
              <button
                type="button"
                className="primary finish-button"
                disabled={baseDisabled}
                onClick={() => void act('finish', {inputDigest: s.host!.inputDigest})}
              >
                ยืนยันผล / ไปสไลด์ 10.03
              </button>
            )}
          </div>

          {result && (
            <p style={{fontSize: '13px', color: '#94a3b8', marginTop: '8px'}}>
              กดปุ่มด้านบนเพื่อยืนยันคะแนนและเปลี่ยนคิวไปยัง 10.03 (ตรวจก่อนปล่อยคำตอบ)
            </p>
          )}

          {message && <p className="input-message" role="status">{message}</p>}

          <details className="host-tools" style={{marginTop: '16px'}}>
            <summary>จัดการรอบและเล่นใหม่</summary>
            <label htmlFor="whack-reason">เหตุผลยกเลิก / เล่นใหม่</label>
            <input
              id="whack-reason"
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="ใส่เหตุผลเพื่อบันทึกใน Audit Trail"
            />
            <div className="tool-buttons">
              <button
                type="button"
                className="quiet danger"
                disabled={baseDisabled || !s.room.activeRunId || !reason.trim()}
                onClick={() => void act('cancel', {reason: reason.trim()})}
              >
                ยกเลิก / ไม่นับคะแนน
              </button>
              <button
                type="button"
                className="secondary"
                disabled={baseDisabled || !r || !reason.trim()}
                onClick={() => void act('replay', {reason: reason.trim()})}
              >
                เล่นใหม่ (Replay)
              </button>
            </div>
          </details>
        </section>

        <aside className="join-section">
          <h2>ชวนผู้เล่นเข้าห้อง</h2>
          <strong className="room-code">{s.room.code}</strong>
          <p>เปิดลิงก์ /play/{s.room.code}</p>
        </aside>
      </div>
    </main>
  );
}

export default function WhackGame({room}: {room: ReturnType<typeof useRoom>}) {
  const role = room.snapshot?.role;
  if (role === 'host') return <WhackHost room={room} />;
  if (role === 'display') return <WhackDisplay room={room} />;
  return <WhackPlayer room={room} />;
}
