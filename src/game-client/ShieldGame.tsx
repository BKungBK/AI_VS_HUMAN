import {useCallback, useEffect, useRef, useState} from 'react';
import type {ShieldPacketItem, ShieldSnapshot} from '../shared/game-contracts';
import {command, tabIdentity, type useRoom} from './network';
import {shieldSound} from './shield-sound';
import GameGlyph,{IconLabel} from './GameGlyph';
import './shield.css';

function useTicker(now: () => number) {
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick(x => x + 1), 50);
    return () => clearInterval(id);
  }, []);
  return now();
}

const LANE_NAMES = ['ซ้าย', 'กลาง', 'ขวา'];
const LANE_NORM_X = [0.16, 0.50, 0.84];
const AIR_CANADA_CONTEXT = 'คณะพิจารณาข้อพิพาทแพ่ง BC ให้ Air Canada รับผิดจากข้อมูลค่าโดยสารกรณีสูญเสียสมาชิกครอบครัวที่แชตบอตให้ไม่ตรงนโยบาย — ข้อความในเกมเป็นสถานการณ์จำลอง';

// ============================================================================
// Top Context Banner
// ============================================================================
function ContextBanner() {
  return (
    <div className="shield-context-banner" role="region" aria-label="บริบทคดีจริง Air Canada ปี 2024">
      <GameGlyph name="building" />
      <div>
        <strong className="shield-context-label">บริบทคดีจริง · PINNED CONTEXT — AIR CANADA 2024</strong>
        <span>{AIR_CANADA_CONTEXT}</span>
      </div>
    </div>
  );
}

// ============================================================================
// Player View (Mobile Screen)
// ============================================================================
export function ShieldPlayer({room}: {room: ReturnType<typeof useRoom>}) {
  const s = room.snapshot!;
  const me = s.me!;
  const r = s.run;
  const game: ShieldSnapshot = s.shield ?? {
    contentVersion: 'shield-v1',
    phase: 'PREVIEW',
    contextBanner: AIR_CANADA_CONTEXT,
    packets: [],
    myState: null,
    revealed: false,
    stats: {rosterCount: 0, totalPacketsBlocked: 0, totalPacketsMissed: 0, customerTrustSlots: 10, packetStats: []},
  };

  const now = useTicker(room.now);
  const [soundOn, setSoundOn] = useState(true);
  const [localLane, setLocalLane] = useState(1); // 0: Left, 1: Center, 2: Right
  const [normalizedX, setNormalizedX] = useState(0.5);
  const [isImpact, setIsImpact] = useState(false);
  const [practiceLane, setPracticeLane] = useState(1);
  const [practiceBlocked, setPracticeBlocked] = useState(false);

  const isDragging = useRef(false);
  const railRef = useRef<HTMLDivElement>(null);
  const seenAims = useRef<Set<string>>(new Set());
  const seenLaunches = useRef<Set<string>>(new Set());
  const seenBlocks = useRef<Set<string>>(new Set());
  const seenMisses = useRef<Set<string>>(new Set());
  const timesUpPlayed = useRef(false);

  // Sync sound toggle
  useEffect(() => {
    shieldSound.setEnabled(soundOn);
  }, [soundOn]);

  // Sync state from server if not dragging
  useEffect(() => {
    if (!isDragging.current && game.myState) {
      setLocalLane(game.myState.currentLane);
      setNormalizedX(Number(game.myState.normalizedX));
    }
  }, [game.myState]);

  // Calculate arcade elapsed time in seconds
  let elapsedSec = 0;
  let remainingMs = 25000;
  if (r && r.phase === 'PLAYING') {
    if (r.deadline) {
      remainingMs = Math.max(0, r.deadline - now);
      elapsedSec = Math.max(0, 25.0 - remainingMs / 1000);
    } else {
      elapsedSec = Math.max(0, (now - r.phaseStart) / 1000);
      remainingMs = Math.max(0, 25000 - elapsedSec * 1000);
    }
  }

  // Send movement command to server
  const sendMove = useCallback((targetLane: number, normX: number) => {
    if (!r || r.phase !== 'PLAYING') return;
    shieldSound.playSlideMove();
    const clientTimeMs = Math.round(now - (r.phaseStart || now));
    void command(s.room.code, 'player', 'shield-move', {
      runId: r.id,
      phaseToken: r.phaseToken,
      lane: targetLane,
      normalizedX: Number(normX.toFixed(3)),
      clientTimeMs: Math.max(0, clientTimeMs),
    });
  }, [now, r, s.room.code]);

  // Change lane via tap or drag
  const setLane = useCallback((newLane: number) => {
    const clampedLane = Math.max(0, Math.min(2, newLane));
    const newX = LANE_NORM_X[clampedLane];
    setLocalLane(clampedLane);
    setNormalizedX(newX);
    sendMove(clampedLane, newX);
  }, [sendMove]);

  // Handle pointer drag on rail
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (r?.phase !== 'PLAYING') return;
    isDragging.current = true;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    updateFromPointer(e.clientX);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging.current) return;
    updateFromPointer(e.clientX);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging.current) return;
    isDragging.current = false;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // Ignore if already released
    }
    // Snap to closest lane on release
    setLane(localLane);
  };

  const updateFromPointer = (clientX: number) => {
    const rect = railRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0) return;
    const rel = Math.max(0.08, Math.min(0.92, (clientX - rect.left) / rect.width));
    setNormalizedX(rel);

    let chosen = 1;
    if (rel < 0.33) chosen = 0;
    else if (rel > 0.66) chosen = 2;

    if (chosen !== localLane) {
      setLocalLane(chosen);
      sendMove(chosen, rel);
    }
  };

  // Sound triggers during PLAYING
  useEffect(() => {
    if (!r || r.phase !== 'PLAYING') return;

    game.packets.forEach(p => {
      // Aim sound
      if (elapsedSec >= p.aimAtSec && elapsedSec < p.aimAtSec + 0.8 && !seenAims.current.has(p.packetId)) {
        seenAims.current.add(p.packetId);
        shieldSound.playAim();
      }
      // Launch drop sound
      if (elapsedSec >= p.aimAtSec + 0.8 && elapsedSec < p.railAtSec && !seenLaunches.current.has(p.packetId)) {
        seenLaunches.current.add(p.packetId);
        shieldSound.playLaunch();
      }
      // Rail pass impact / block
      if (elapsedSec >= p.railAtSec) {
        const intercept = game.myState?.intercepts.find(i => i.packetId === p.packetId);
        if (intercept) {
          if (intercept.status === 'BLOCKED' && !seenBlocks.current.has(p.packetId)) {
            seenBlocks.current.add(p.packetId);
            shieldSound.playShieldBlock();
            setIsImpact(true);
            setTimeout(() => setIsImpact(false), 250);
          } else if (intercept.status === 'MISSED' && !seenMisses.current.has(p.packetId)) {
            seenMisses.current.add(p.packetId);
            shieldSound.playCustomerHit();
          }
        }
      }
    });

    if (remainingMs <= 100 && !timesUpPlayed.current) {
      timesUpPlayed.current = true;
      shieldSound.playTimesUp();
    }
  }, [elapsedSec, game.myState, game.packets, r, remainingMs]);

  // Current active packet in aiming or dropping phase
  const activePacket = game.packets.find(p => elapsedSec >= p.aimAtSec && elapsedSec < p.customerAtSec);

  // Ready handler
  const handleReady = () => {
    void command(s.room.code, 'player', 'ready', {
      previewId: s.room.previewId,
      contentVersion: 'shield-v1',
    });
  };

  // Practice slide handler
  const handlePracticeMove = (lane: number) => {
    setPracticeLane(lane);
    shieldSound.playSlideMove();
    if (lane === 1) {
      setPracticeBlocked(true);
      shieldSound.playShieldBlock();
    }
  };

  // ==========================================================================
  // 1. PREVIEW / BRIEFING
  // ==========================================================================
  if (game.phase === 'PREVIEW' || !r) {
    return (
      <main className="shield-root" role="main">
        <header className="shield-topbar">
          <div className="shield-brand-badge">
            <span className="shield-badge-tag">เกมที่ 6</span>
            <span className="shield-brand-title">Company Shield</span>
          </div>
          <button
            type="button"
            className="shield-audio-btn"
            onClick={() => setSoundOn(!soundOn)}
            aria-label={soundOn ? 'ปิดเสียง' : 'เปิดเสียง'}
          >
            <IconLabel name={soundOn?'sound-on':'sound-off'}>{soundOn?'เปิดเสียง':'ปิดเสียง'}</IconLabel>
          </button>
        </header>

        <ContextBanner />

        <div className="shield-arena">
          <div className="shield-result-card" style={{marginTop: 0, textAlign: 'left'}}>
            <h1 className="shield-result-header" style={{fontSize: '18px', color: '#fbbf24'}}>
              <IconLabel name="building">บริษัทต้องรับก่อนถึงลูกค้า</IconLabel>
            </h1>
            <p style={{fontSize: '13px', color: '#cbd5e1', lineHeight: '1.5', margin: '8px 0'}}>
              <strong>กติกา:</strong> บอตจะพูดข้อความที่ยังไม่ผ่านการยืนยันลงมา 10 ครั้ง
              ให้คุณ<strong>ลากอาคารบริษัทไปรับข้อความ</strong>ก่อนจะหลุดไปถึงลูกค้า!
            </p>
            <div style={{background: '#090e1c', padding: '10px', borderRadius: '8px', margin: '8px 0'}}>
              <div style={{fontSize: '12px', color: '#38bdf8', marginBottom: '4px'}}>
                <IconLabel name="bolt">รับทัน: <strong>+50 คะแนน</strong> (สูงสุด 500)</IconLabel>
              </div>
              <div style={{fontSize: '12px', color: '#94a3b8'}}>
                <IconLabel name="document">บริษัทรับข้อความไปตรวจสอบ</IconLabel>
              </div>
            </div>

            {/* Interactive Practice Slider */}
            <div style={{marginTop: '12px', borderTop: '1px solid #1e293b', paddingTop: '10px'}}>
              <div style={{fontSize: '12px', color: '#fbbf24', fontWeight: 700, marginBottom: '6px'}}>
                <IconLabel name="target">ทดลองเลื่อนบริษัท</IconLabel>
              </div>
              <div
                style={{
                  height: '60px',
                  background: '#090e1c',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    left: `${(practiceLane / 2) * 65 + 5}%`,
                    width: '30%',
                    height: '50px',
                    background: '#1e293b',
                    border: '2px solid #f59e0b',
                    borderRadius: '6px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'left 0.15s ease',
                  }}
                >
                  <GameGlyph name="building" />
                  <span style={{fontSize: '10px', color: '#fbbf24', fontWeight: 800}}>บริษัท</span>
                </div>
              </div>
              <div className="shield-tap-controls" style={{marginTop: '6px'}}>
                <button
                  type="button"
                  className={`shield-tap-btn ${practiceLane === 0 ? 'active' : ''}`}
                  onClick={() => handlePracticeMove(0)}
                >
                  <IconLabel name="left">ซ้าย</IconLabel>
                </button>
                <button
                  type="button"
                  className={`shield-tap-btn ${practiceLane === 1 ? 'active' : ''}`}
                  onClick={() => handlePracticeMove(1)}
                >
                  <IconLabel name="target">กลาง {practiceBlocked ? <GameGlyph name="check"/> : null}</IconLabel>
                </button>
                <button
                  type="button"
                  className={`shield-tap-btn ${practiceLane === 2 ? 'active' : ''}`}
                  onClick={() => handlePracticeMove(2)}
                >
                  <IconLabel name="right">ขวา</IconLabel>
                </button>
              </div>
            </div>

            {/* Ready Button */}
            <button
              type="button"
              className="shield-host-btn primary"
              style={{marginTop: '16px', width: '100%', fontSize: '16px', padding: '14px'}}
              onClick={handleReady}
              disabled={me.ready}
            >
              {me.ready ? <IconLabel name="check">พร้อมแล้ว · รอผู้จัด</IconLabel> : <IconLabel name="bolt">ยืนยันพร้อมเล่น</IconLabel>}
            </button>
          </div>
        </div>
      </main>
    );
  }

  // ==========================================================================
  // 2. COUNTDOWN PHASE
  // ==========================================================================
  if (r.phase === 'COUNTDOWN') {
    const cdSec = Math.max(1, Math.ceil(((r.deadline ?? now) - now) / 1000));
    return (
      <main className="shield-root" role="main">
        <header className="shield-topbar">
          <div className="shield-brand-badge">
            <span className="shield-badge-tag">เกมที่ 6</span>
            <span className="shield-brand-title">Company Shield</span>
          </div>
        </header>
        <ContextBanner />
        <div
          className="shield-arena"
          style={{display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh'}}
        >
          <div style={{textAlign: 'center'}}>
            <div style={{fontSize: '14px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px'}}>
              เตรียมเลื่อนบริษัทบังลูกค้าใน
            </div>
            <div
              style={{
                fontSize: '84px',
                fontWeight: 900,
                color: '#fbbf24',
                fontFamily: 'monospace',
                textShadow: '0 0 30px rgba(245, 158, 11, 0.6)',
              }}
            >
              {cdSec}
            </div>
            <div style={{fontSize: '14px', color: '#f8fafc', marginTop: '8px'}}>
              ตำแหน่งเริ่มต้น: <strong>ช่องกลาง</strong>
            </div>
          </div>
        </div>
      </main>
    );
  }

  // ==========================================================================
  // 3. PLAYING PHASE (25s ARCADE ACTION)
  // ==========================================================================
  if (r.phase === 'PLAYING') {
    const score = game.myState?.score ?? 0;
    const blockedCount = game.myState?.blockedCount ?? 0;
    const timerText = (remainingMs / 1000).toFixed(1);
    const isUrgent = remainingMs <= 5000;

    // Building horizontal percentage position:
    const buildingLeftPct = Math.max(0, Math.min(68, normalizedX * 68));

    return (
      <main className="shield-root" role="main">
        <header className="shield-topbar">
          <div className="shield-brand-badge">
            <span className="shield-badge-tag">25s ARCADE</span>
            <span className="shield-brand-title">Company Shield</span>
          </div>
          <button
            type="button"
            className="shield-audio-btn"
            onClick={() => setSoundOn(!soundOn)}
            aria-label={soundOn ? 'ปิดเสียง' : 'เปิดเสียง'}
          >
            <GameGlyph name={soundOn?'sound-on':'sound-off'}/>
          </button>
        </header>

        <ContextBanner />
        <div className="shield-arena">
          {/* Top Live Stats Bar */}
          <div className="shield-stats-bar">
            <div className="shield-stat-block">
              <span className="shield-stat-label">เวลาที่เหลือ</span>
              <span className={`shield-stat-val timer ${isUrgent ? 'urgent' : ''}`}>{timerText}s</span>
            </div>
            <div className="shield-stat-block" style={{alignItems: 'center'}}>
              <span className="shield-stat-label">รับเรื่องแล้ว</span>
              <span className="shield-stat-val" style={{color: '#34d399'}}>
                {blockedCount} / 10
              </span>
            </div>
            <div className="shield-stat-block" style={{alignItems: 'flex-end'}}>
              <span className="shield-stat-label">คะแนน (+50)</span>
              <span className="shield-stat-val score">{score}</span>
            </div>
          </div>

          {/* The 3-Lane Flight Field */}
          <div className="shield-field">
            {/* Top Bot Zone */}
            <div className="shield-bot-zone">
              {[0, 1, 2].map(laneIdx => {
                const isAimingLane =
                  activePacket &&
                  activePacket.targetLane === laneIdx &&
                  elapsedSec >= activePacket.aimAtSec &&
                  elapsedSec < activePacket.aimAtSec + 0.8;
                return (
                  <div key={laneIdx} className={`shield-nozzle ${isAimingLane ? 'aiming' : ''}`}>
                    <span className="shield-nozzle-badge">
                      <IconLabel name="robot">ช่อง {LANE_NAMES[laneIdx]}</IconLabel>
                    </span>
                    {isAimingLane && (
                      <div className="shield-aim-bubble">
                        <IconLabel name="chat">“{activePacket.botClaim}”</IconLabel>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Runways & Descending Packets */}
            <div className="shield-runways">
              {[0, 1, 2].map(laneIdx => {
                const isAimingHere =
                  activePacket &&
                  activePacket.targetLane === laneIdx &&
                  elapsedSec >= activePacket.aimAtSec &&
                  elapsedSec < activePacket.aimAtSec + 0.8;

                const isDroppingHere =
                  activePacket &&
                  activePacket.targetLane === laneIdx &&
                  elapsedSec >= activePacket.aimAtSec + 0.8 &&
                  elapsedSec < activePacket.railAtSec;

                // Vertical descent progress (0 to 1)
                let dropPct = 0;
                if (isDroppingHere) {
                  const dropElapsed = elapsedSec - (activePacket.aimAtSec + 0.8);
                  dropPct = Math.min(100, Math.max(0, (dropElapsed / 0.8) * 100));
                }

                return (
                  <div key={laneIdx} className="shield-runway-col">
                    {/* Laser guide line during aim */}
                    {isAimingHere && <div className="shield-laser-guide" />}

                    {/* Missile packet dropping downward */}
                    {isDroppingHere && (
                      <div
                        className="shield-packet-projectile"
                        style={{top: `${dropPct * 0.75}%`}}
                      >
                        <div className="shield-packet-no"><IconLabel name="warning">คำตอบบอต #{activePacket.packetNo}</IconLabel></div>
                        <div className="shield-packet-claim">“{activePacket.botClaim}”</div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Company Shield Rail (Player Intercept Track) */}
            <div
              ref={railRef}
              className="shield-rail-zone"
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
            >
              <div className="shield-rail-marker" />
              {/* Sliding Company Building */}
              <div
                className={`shield-building ${isImpact ? 'impact' : ''}`}
                style={{left: `${buildingLeftPct}%`}}
              >
                <span className="shield-building-icon"><GameGlyph name="building"/></span>
                <span className="shield-building-title">บริษัทรับเรื่อง</span>
                <span className="shield-building-tasks">
                  <IconLabel name="document">งานตรวจ: {blockedCount}</IconLabel>
                </span>
              </div>
            </div>

            {/* Customer Zone at Bottom */}
            <div className="shield-customer-zone">
              {[
                {name: 'คุณวิภา (ซ้าย)', lane: 0},
                {name: 'คุณสมชาย (กลาง)', lane: 1},
                {name: 'คุณธนพล (ขวา)', lane: 2},
              ].map(cust => {
                const lastIntercept = game.myState?.intercepts
                  .filter(i => {
                    const pkt = game.packets.find(p => p.packetId === i.packetId);
                    return pkt && pkt.targetLane === cust.lane;
                  })
                  .slice(-1)[0];

                const isSafe = lastIntercept?.status === 'BLOCKED';
                const isHit = lastIntercept?.status === 'MISSED';

                return (
                  <div key={cust.lane} className="shield-customer-pod">
                    <span className="shield-customer-avatar">
                      <GameGlyph name={isHit?'warning':isSafe?'check':'user'}/>
                    </span>
                    <span className="shield-customer-name">{cust.name}</span>
                    <span
                      className={`shield-customer-status ${
                        isSafe ? 'safe' : isHit ? 'hit' : ''
                      }`}
                    >
                      {isSafe ? <IconLabel name="check">บริษัทรับเรื่องแล้ว</IconLabel> : isHit ? <IconLabel name="warning">ข้อมูลไม่ยืนยัน</IconLabel> : 'รอคำตอบ'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick Tap Buttons for Accessibility */}
          <div className="shield-tap-controls">
            <button
              type="button"
              className={`shield-tap-btn ${localLane === 0 ? 'active' : ''}`}
              onClick={() => setLane(0)}
            >
              <IconLabel name="left">ช่องซ้าย</IconLabel>
              <span className="shield-tap-sub">คุณวิภา</span>
            </button>
            <button
              type="button"
              className={`shield-tap-btn ${localLane === 1 ? 'active' : ''}`}
              onClick={() => setLane(1)}
            >
              <IconLabel name="target">ช่องกลาง</IconLabel>
              <span className="shield-tap-sub">คุณสมชาย</span>
            </button>
            <button
              type="button"
              className={`shield-tap-btn ${localLane === 2 ? 'active' : ''}`}
              onClick={() => setLane(2)}
            >
              <IconLabel name="right">ช่องขวา</IconLabel>
              <span className="shield-tap-sub">คุณธนพล</span>
            </button>
          </div>
        </div>
      </main>
    );
  }

  // ==========================================================================
  // 4. RESULT PHASE
  // ==========================================================================
  const score = game.myState?.score ?? 0;
  const blockedCount = game.myState?.blockedCount ?? 0;
  const missedCount = game.myState?.missedCount ?? 0;

  return (
    <main className="shield-root" role="main">
      <header className="shield-topbar">
        <div className="shield-brand-badge">
          <span className="shield-badge-tag">สรุปผล</span>
          <span className="shield-brand-title">Company Shield</span>
        </div>
        <button
          type="button"
          className="shield-audio-btn"
          onClick={() => setSoundOn(!soundOn)}
          aria-label={soundOn ? 'ปิดเสียง' : 'เปิดเสียง'}
        >
          <GameGlyph name={soundOn?'sound-on':'sound-off'}/>
        </button>
      </header>

      <ContextBanner />
      <div className="shield-arena">
        <div className="shield-result-card">
          <h1 className="shield-result-header">สรุปผลการรับผิดชอบของบริษัท</h1>
          <div style={{fontSize: '13px', color: '#94a3b8'}}>
            บริษัทรับเรื่องไว้: <strong style={{color: '#34d399'}}>{blockedCount}</strong> / หลุดถึงลูกค้า:{' '}
            <strong style={{color: '#f43f5e'}}>{missedCount}</strong>
          </div>
          <div className="shield-result-score">{score} คะแนน</div>
          <div style={{fontSize: '12px', color: '#cbd5e1'}}>
            (รับได้ {blockedCount} ครั้ง × 50 = {score} / เต็ม 500)
          </div>

          <div className="shield-takeaway-banner">
            <div style={{fontWeight: 800, color: '#38bdf8', marginBottom: '4px'}}>
              “AI IS A TOOL. NOT A SHIELD.”
            </div>
            คำพูดจากบอตของผู้ให้บริการ คือเรื่องที่ผู้ให้บริการต้องรับไว้ตรวจสอบและรับผิดชอบต่อลูกค้า
            การใช้ AI ไม่ใช่ข้ออ้างในการปัดความรับผิดชอบ
          </div>
        </div>

        {/* Accepted Work Task Stack */}
        <div className="shield-task-stack">
          <div className="shield-task-stack-title">
            <IconLabel name="document">งานที่บริษัทรับไว้ตรวจสอบ ({blockedCount})</IconLabel>
          </div>
          <div className="shield-task-list">
            {game.packets.map(p => {
              const intercept = game.myState?.intercepts.find(i => i.packetId === p.packetId);
              const isBlocked = intercept?.status === 'BLOCKED';
              return (
                <div key={p.packetId} className={`shield-task-item ${isBlocked ? '' : 'missed'}`}>
                  <div>
                    <div className="shield-task-text">{p.companyTask}</div>
                    <div className="shield-task-origin">
                      จากบอต: “{p.botClaim}” ({p.customerName})
                    </div>
                  </div>
                  <span className={`shield-task-status-tag ${isBlocked ? 'blocked' : 'missed'}`}>
                    {isBlocked ? <IconLabel name="check">รับเรื่องแล้ว</IconLabel> : <IconLabel name="warning">หลุดถึงลูกค้า</IconLabel>}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </main>
  );
}

// ============================================================================
// Display / Big Screen View (1920x1080 Stadium View)
// ============================================================================
export function ShieldDisplay({room}: {room: ReturnType<typeof useRoom>}) {
  const s = room.snapshot!;
  const r = s.run;
  const game: ShieldSnapshot = s.shield ?? {
    contentVersion: 'shield-v1',
    phase: 'PREVIEW',
    contextBanner: AIR_CANADA_CONTEXT,
    packets: [],
    myState: null,
    revealed: false,
    stats: {rosterCount: 0, totalPacketsBlocked: 0, totalPacketsMissed: 0, customerTrustSlots: 10, packetStats: []},
  };

  const now = useTicker(room.now);

  let remainingSec = 25;
  let elapsedSec = 0;
  if (r && r.phase === 'PLAYING') {
    if (r.deadline) {
      remainingSec = Math.max(0, Math.ceil((r.deadline - now) / 1000));
      elapsedSec = Math.max(0, 25.0 - (r.deadline - now) / 1000);
    }
  }

  const activePacket = game.packets.find(p => elapsedSec >= p.aimAtSec && elapsedSec < p.customerAtSec);

  return (
    <main className="shield-root" role="main" style={{minHeight: '100vh'}}>
      <header className="shield-topbar" style={{padding: '14px 24px'}}>
        <div className="shield-brand-badge">
          <span className="shield-badge-tag" style={{fontSize: '14px', padding: '4px 10px'}}>
            STADIUM SCREEN
          </span>
          <span className="shield-brand-title" style={{fontSize: '20px'}}>
            <IconLabel name="building">Company Shield · ปกป้องลูกค้า</IconLabel>
          </span>
        </div>
        <div style={{fontSize: '14px', color: '#94a3b8'}}>
          ห้อง: <strong style={{color: '#fbbf24', letterSpacing: '1px'}}>{s.room.code}</strong> | สมาชิก:{' '}
          <strong style={{color: '#38bdf8'}}>{game.stats.rosterCount}</strong> คน
        </div>
      </header>

      <ContextBanner />
      <div className="shield-display-container">
        {/* Left Arena View */}
        <div className="shield-display-stadium">
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px'}}>
            <span style={{fontSize: '16px', fontWeight: 800, color: '#fbbf24'}}>
              {game.revealed ? <IconLabel name="document">งานที่บริษัทรับไว้ตรวจ</IconLabel> : <IconLabel name="robot">AIR-SERVICE BOT RUNWAY</IconLabel>}
            </span>
            <span style={{fontSize: '24px', fontWeight: 900, color: '#38bdf8', fontFamily: 'monospace'}}>
              {r?.phase === 'PLAYING' ? `${remainingSec}s` : r?.phase ?? 'PREVIEW'}
            </span>
          </div>

          {game.revealed ? (
            <section className="shield-display-results" aria-label="กองงานบริษัทและผลห้อง">
              <div>
                <h2 className="shield-display-results-title">บริษัทรับเรื่องไว้ตรวจต่อ</h2>
                <p className="shield-display-results-note">
                  การรับข้อความไว้ไม่ใช่การแก้ปัญหาลูกค้าเสร็จแล้ว · {game.stats.totalPacketsBlocked} รับไว้ / {game.stats.totalPacketsMissed} หลุดถึงลูกค้า
                </p>
              </div>
              <ol className="shield-display-task-list">
                {game.packets
                  .map(packet => ({
                    packet,
                    blockedCount: game.stats.packetStats.find(item => item.packetId === packet.packetId)?.blockedCount ?? 0,
                  }))
                  .filter(item => item.blockedCount > 0)
                  .map(({packet, blockedCount}) => (
                    <li key={packet.packetId}>
                      <span className="shield-display-task-number">{String(packet.packetNo).padStart(2, '0')}</span>
                      <span className="shield-display-task-name">{packet.companyTask}</span>
                      <span className="shield-display-task-count">
                        {blockedCount} / {game.stats.rosterCount} รับไว้
                      </span>
                    </li>
                  ))}
                {game.stats.totalPacketsBlocked === 0 && (
                  <li className="shield-display-task-empty">ไม่มีข้อความที่บริษัทบังทันในรอบนี้</li>
                )}
              </ol>
              <div className="shield-display-lesson">
                <strong>AI IS A TOOL. NOT A SHIELD.</strong>
                <span>คำพูดของบอตต้องมีผู้ให้บริการรับไว้ตรวจสอบและจัดการผลกระทบ</span>
              </div>
            </section>
          ) : (
          /* 3 Large Runways */
          <div style={{flex: 1, minHeight: '460px', display: 'flex', border: '2px solid #1e293b', borderRadius: '12px', background: '#090e1c', position: 'relative'}}>
            {[0, 1, 2].map(laneIdx => {
              const isAiming = activePacket && activePacket.targetLane === laneIdx && elapsedSec >= activePacket.aimAtSec && elapsedSec < activePacket.aimAtSec + 0.8;
              const isDropping = activePacket && activePacket.targetLane === laneIdx && elapsedSec >= activePacket.aimAtSec + 0.8 && elapsedSec < activePacket.railAtSec;
              let dropPct = 0;
              if (isDropping) {
                dropPct = Math.min(100, Math.max(0, ((elapsedSec - (activePacket.aimAtSec + 0.8)) / 0.8) * 100));
              }

              return (
                <div key={laneIdx} style={{flex: 1, borderRight: laneIdx === 2 ? 'none' : '1px dashed #334155', position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
                  <div style={{padding: '8px', background: isAiming ? '#be123c' : '#1e293b', color: '#fff', borderRadius: '6px', marginTop: '10px', fontSize: '13px', fontWeight: 700}}>
                    ช่อง {LANE_NAMES[laneIdx]}
                  </div>

                  {isAiming && (
                    <div style={{marginTop: '20px', background: '#e11d48', color: '#fff', padding: '6px 14px', borderRadius: '8px', fontWeight: 800, fontSize: '14px', boxShadow: '0 0 16px #e11d48'}}>
                      <IconLabel name="chat">“{activePacket.botClaim}”</IconLabel>
                    </div>
                  )}

                  {isDropping && (
                    <div style={{position: 'absolute', top: `${dropPct * 0.7}%`, background: '#1e1b4b', border: '2px solid #f43f5e', padding: '8px 12px', borderRadius: '8px', color: '#fff', textAlign: 'center', boxShadow: '0 0 20px #f43f5e'}}>
                      <div style={{fontSize: '11px', color: '#fda4af'}}><IconLabel name="warning">บอต #{activePacket.packetNo}</IconLabel></div>
                      <div style={{fontSize: '13px', fontWeight: 800}}>“{activePacket.botClaim}”</div>
                    </div>
                  )}

                  {/* Customer pod at bottom */}
                  <div style={{marginTop: 'auto', marginBottom: '16px', background: '#0f172a', border: '1px solid #334155', padding: '8px 14px', borderRadius: '8px', textAlign: 'center'}}>
                    <GameGlyph name="user"/>
                    <div style={{fontSize: '12px', color: '#94a3b8'}}>
                      {laneIdx === 0 ? 'คุณวิภา' : laneIdx === 1 ? 'คุณสมชาย' : 'คุณธนพล'}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          )}
        </div>

        {/* Right Telemetry / Stats Sidebar */}
        <div className="shield-display-sidebar">
          {/* Customer Trust Meter Card */}
          <div className="shield-display-metric-card">
            <div style={{fontSize: '14px', fontWeight: 700, color: '#38bdf8'}}>
              <IconLabel name="shield">ความเชื่อมั่นของลูกค้า</IconLabel>
            </div>
            <div style={{fontSize: '12px', color: '#94a3b8', marginTop: '2px'}}>
              เริ่มเต็ม 10 ช่อง — ลดลงเมื่อคำตอบที่ไม่ยืนยันหลุดถึงลูกค้า
            </div>
            <div className="shield-trust-meter-grid">
              {Array.from({length: 10}).map((_, idx) => (
                <div
                  key={idx}
                  className={`shield-trust-slot ${idx < game.stats.customerTrustSlots ? 'active' : 'lost'}`}
                />
              ))}
            </div>
          </div>

          {/* Room Accumulator Card */}
          <div className="shield-display-metric-card">
            <div style={{fontSize: '14px', fontWeight: 700, color: '#fbbf24'}}>
              <IconLabel name="chart">สถิติทั้งห้อง</IconLabel>
            </div>
            <div style={{display: 'flex', justifyContent: 'space-around', marginTop: '12px', textAlign: 'center'}}>
              <div>
                <div style={{fontSize: '28px', fontWeight: 900, color: '#34d399'}}>
                  {game.stats.totalPacketsBlocked}
                </div>
                <div style={{fontSize: '11px', color: '#94a3b8'}}>ครั้งที่บริษัทรับไว้</div>
              </div>
              <div>
                <div style={{fontSize: '28px', fontWeight: 900, color: '#f43f5e'}}>
                  {game.stats.totalPacketsMissed}
                </div>
                <div style={{fontSize: '11px', color: '#94a3b8'}}>ครั้งที่หลุดถึงลูกค้า</div>
              </div>
            </div>
          </div>

          {/* Group Scores Leaderboard */}
          <div className="shield-display-metric-card" style={{flex: 1}}>
            <div style={{fontSize: '14px', fontWeight: 700, color: '#f8fafc', marginBottom: '8px'}}>
              <IconLabel name="trophy">คะแนนกลุ่ม</IconLabel>
            </div>
            <div style={{display: 'flex', flexDirection: 'column', gap: '8px'}}>
              {s.scores?.map(g => {
                const avg = g.denominator > 0 ? (g.numerator / g.denominator).toFixed(1) : '0';
                return (
                  <div
                    key={g.id}
                    style={{
                      background: '#090e1c',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <span style={{fontSize: '13px', fontWeight: 600, color: '#e2e8f0'}}>{g.name}</span>
                    <span style={{fontSize: '15px', fontWeight: 800, color: '#fbbf24', fontFamily: 'monospace'}}>
                      {avg} <span style={{fontSize: '11px', color: '#94a3b8'}}>pts</span>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

// ============================================================================
// Host Controller View
// ============================================================================
export function ShieldHost({room}: {room: ReturnType<typeof useRoom>}) {
  const s = room.snapshot!;
  const r = s.run;
  const h = s.host!;
  const controller = useRef(tabIdentity('controller'));
  const now = useTicker(room.now);
  const [reason, setReason] = useState('เล่นซ้ำรอบที่สอง');
  const [busy, setBusy] = useState(false);

  const hasControl = s.host?.controllerId === controller.current && (s.host?.leaseUntil ?? 0) > now;

  const acquire = useCallback(
    async (takeover = false) => {
      try {
        await command(s.room.code, 'host', 'acquire', {
          controllerId: controller.current,
          ...(takeover ? {reason: reason.trim()} : {}),
        });
        await room.refresh();
      } catch (e) {
        console.error('Acquire failed:', e);
      }
    },
    [s.room.code, room.refresh, reason]
  );

  useEffect(() => {
    if (s.host && (!s.host.controllerId || (!hasControl && s.host.controllerId === controller.current))) {
      void acquire();
    }
  }, [s.host?.controllerId, hasControl, acquire]);

  useEffect(() => {
    if (!hasControl) return;
    const timer = setInterval(() => {
      const cur = room.latest.current;
      if (cur?.host && cur.host.controllerId === controller.current) {
        void command(s.room.code, 'host', 'heartbeat', {
          controllerId: controller.current,
          controllerEpoch: cur.host.controllerEpoch,
        }).catch(() => void room.refresh());
      }
    }, 4000);
    return () => clearInterval(timer);
  }, [hasControl, s.room.code, room.latest, room.refresh]);

  const act = async (kind: string, payload: Record<string, unknown> = {}) => {
    setBusy(true);
    const cur = room.latest.current!;
    try {
      const res = await command(s.room.code, 'host', kind, {
        ...payload,
        controllerId: controller.current,
        controllerEpoch: cur.host!.controllerEpoch,
        expectedVersion: cur.room.version,
      });
      await room.refresh();
      return res;
    } catch (e) {
      console.error('Host command failed:', e);
      void room.refresh();
      throw e;
    } finally {
      setBusy(false);
    }
  };

  const handleStart = () => {
    void act('start', {timingProfile: 'normal'});
  };

  const handleFinish = () => {
    const cur = room.latest.current!;
    void act('finish', {inputDigest: cur.host?.inputDigest ?? ''});
  };

  const handleReplay = () => {
    void act('replay', {reason: reason.trim() || 'เล่นใหม่'});
  };

  const unreadyCount = h.unready ?? 0;
  const totalCount = h.members.length;

  return (
    <main className="shield-root" role="main">
      <header className="shield-topbar">
        <div className="shield-brand-badge">
          <span className="shield-badge-tag">HOST CONSOLE</span>
          <span className="shield-brand-title">Company Shield (คิว 11.02)</span>
        </div>
        <div style={{fontSize: '13px', color: '#94a3b8'}}>
          ห้อง: <strong style={{color: '#fbbf24'}}>{s.room.code}</strong>
        </div>
      </header>

      <div className="shield-arena">
        <ContextBanner />
        <div className="shield-host-panel">
          <h2 style={{fontSize: '18px', fontWeight: 800, color: '#fbbf24', margin: '0 0 10px 0'}}>
            ควบคุมเกม Company Shield
          </h2>

          <div style={{fontSize: '13px', color: '#cbd5e1', marginBottom: '12px'}}>
            สถานะคิวปัจจุบัน: <strong style={{color: '#38bdf8'}}>{s.room.cue}</strong> | ผู้เล่นพร้อม:{' '}
            <strong style={{color: unreadyCount === 0 ? '#34d399' : '#f59e0b'}}>
              {totalCount - unreadyCount} / {totalCount}
            </strong>
          </div>

          {!hasControl && (
            <button
              type="button"
              className="shield-host-btn primary"
              style={{width: '100%', marginBottom: '12px'}}
              onClick={() => void acquire(true)}
            >
              <IconLabel name="key">รับสิทธิ์ควบคุม</IconLabel>
            </button>
          )}

          {/* Start button if run not active */}
          {!s.room.activeRunId && (
            <button
              type="button"
              className="shield-host-btn primary"
              style={{width: '100%', padding: '16px', fontSize: '16px'}}
              onClick={handleStart}
              disabled={!hasControl || busy}
            >
              <IconLabel name="play">เริ่มเกม Company Shield</IconLabel>
            </button>
          )}

          {/* During active play: Pause / Resume */}
          {r && r.status === 'RUNNING' && (
            <div className="shield-host-btn-row">
              {r.paused ? (
                <button
                  type="button"
                  className="shield-host-btn primary"
                  onClick={() => void act('resume')}
                  disabled={!hasControl || busy}
                >
                  <IconLabel name="play">เล่นต่อ</IconLabel>
                </button>
              ) : (
                <button
                  type="button"
                  className="shield-host-btn secondary"
                  onClick={() => void act('pause')}
                  disabled={!hasControl || busy}
                >
                  <IconLabel name="pause">พักเกม</IconLabel>
                </button>
              )}
            </div>
          )}

          {/* On Result: Finish to 11.03 or Replay */}
          {r && r.status === 'RESULT' && (
            <div style={{marginTop: '16px'}}>
              <div style={{background: '#090e1c', padding: '12px', borderRadius: '8px', marginBottom: '12px'}}>
                <div style={{fontSize: '13px', fontWeight: 700, color: '#34d399'}}>
                  <IconLabel name="check">ผลเกมพร้อมแล้ว</IconLabel>
                </div>
                <div style={{fontSize: '12px', color: '#94a3b8', marginTop: '2px'}}>
                  กดจบเกมเพื่อส่งห้องต่อไปยังคิว <strong>11.03</strong> (“AI IS A TOOL. NOT A SHIELD.”)
                </div>
              </div>

              <button
                type="button"
                className="shield-host-btn primary"
                style={{width: '100%', padding: '14px', fontSize: '15px'}}
                onClick={handleFinish}
                disabled={!hasControl || busy}
              >
                <IconLabel name="finish">จบเกมและไปต่อคิว 11.03</IconLabel>
              </button>

              <div style={{marginTop: '12px'}}>
                <input
                  type="text"
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  placeholder="เหตุผลการเล่นใหม่..."
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    background: '#090e1c',
                    border: '1px solid #334155',
                    color: '#fff',
                    marginBottom: '8px',
                    boxSizing: 'border-box',
                  }}
                />
                <button
                  type="button"
                  className="shield-host-btn secondary"
                  style={{width: '100%'}}
                  onClick={handleReplay}
                  disabled={!hasControl || busy}
                >
                  <IconLabel name="reset">เล่นรอบนี้ซ้ำ</IconLabel>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

// Default export router
export default function ShieldGame({room}: {room: ReturnType<typeof useRoom>}) {
  const role = room.snapshot?.role;
  if (role === 'host') return <ShieldHost room={room} />;
  if (role === 'display') return <ShieldDisplay room={room} />;
  return <ShieldPlayer room={room} />;
}
