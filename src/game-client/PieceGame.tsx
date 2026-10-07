import React, {useCallback, useEffect, useRef, useState} from 'react';
import type {
  PieceArtwork,
  PieceCandidate,
  PiecePoint,
  PieceResult,
  PieceSnapshot,
  PieceStroke,
} from '../shared/game-contracts';
import {command, tabIdentity, type useRoom} from './network';
import {pieceSound} from './piece-sound';
import GameGlyph,{IconLabel} from './GameGlyph';
import './piece.css';

function useTicker(now: () => number) {
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick(x => x + 1), 50);
    return () => clearInterval(id);
  }, []);
  return now();
}

const PALETTE = ['#f43f5e', '#38bdf8', '#fbbf24', '#34d399', '#f8fafc'];
const supportPercent = (support: number) => `${Math.round(support * 100)}%`;

// ============================================================================
// Canvas Drawing Renderer (Displays base SVG + overlays normalized strokes)
// ============================================================================
export function CanvasViewer({
  baseSvg,
  strokes,
  className = '',
  style,
}: {
  baseSvg: string;
  strokes: PieceStroke[];
  className?: string;
  style?: React.CSSProperties;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    strokes.forEach(s => {
      if (!s.points || s.points.length < 2) return;
      ctx.strokeStyle = s.color;
      ctx.lineWidth = s.width * (width / 400); // Scale stroke width proportionally

      ctx.beginPath();
      ctx.moveTo(s.points[0].x * width, s.points[0].y * height);
      for (let i = 1; i < s.points.length; i++) {
        ctx.lineTo(s.points[i].x * width, s.points[i].y * height);
      }
      ctx.stroke();
    });
  }, [strokes]);

  return (
    <div className={`piece-canvas-wrapper ${className}`} style={style}>
      <div
        className="piece-canvas-base-svg"
        dangerouslySetInnerHTML={{__html: baseSvg}}
      />
      <canvas
        ref={canvasRef}
        width={400}
        height={400}
        style={{position: 'absolute', top: 0, left: 0, width: '100%', height: '100%'}}
      />
    </div>
  );
}

// ============================================================================
// Interactive Drawing Canvas (Pointer Event Normalized Coordinates)
// ============================================================================
export function InteractiveDrawingCanvas({
  baseSvg,
  strokes,
  onChange,
  disabled = false,
}: {
  baseSvg: string;
  strokes: PieceStroke[];
  onChange: (newStrokes: PieceStroke[]) => void;
  disabled?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [currentColor, setCurrentColor] = useState(PALETTE[0]);
  const [currentWidth, setCurrentWidth] = useState(4); // 4px thin, 8px thick
  const isDrawing = useRef(false);
  const activeStroke = useRef<PiecePoint[]>([]);

  // Re-draw canvas whenever strokes change
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    strokes.forEach(s => {
      if (!s.points || s.points.length < 2) return;
      ctx.strokeStyle = s.color;
      ctx.lineWidth = s.width * (width / 400);

      ctx.beginPath();
      ctx.moveTo(s.points[0].x * width, s.points[0].y * height);
      for (let i = 1; i < s.points.length; i++) {
        ctx.lineTo(s.points[i].x * width, s.points[i].y * height);
      }
      ctx.stroke();
    });
  }, [strokes]);

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.setPointerCapture(e.pointerId);
    isDrawing.current = true;
    const rect = canvas.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));

    activeStroke.current = [{x, y}];
    pieceSound.playStrokeDraw();
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing.current || disabled) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));

    activeStroke.current.push({x, y});

    // Draw active stroke on canvas context immediately
    const ctx = canvas.getContext('2d');
    if (ctx && activeStroke.current.length >= 2) {
      const len = activeStroke.current.length;
      const p1 = activeStroke.current[len - 2];
      const p2 = activeStroke.current[len - 1];

      ctx.strokeStyle = currentColor;
      ctx.lineWidth = currentWidth * (canvas.width / 400);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      ctx.beginPath();
      ctx.moveTo(p1.x * canvas.width, p1.y * canvas.height);
      ctx.lineTo(p2.x * canvas.width, p2.y * canvas.height);
      ctx.stroke();
    }
  };

  const handlePointerUp = () => {
    if (!isDrawing.current || disabled) return;
    isDrawing.current = false;

    if (activeStroke.current.length >= 2) {
      const newStroke: PieceStroke = {
        color: currentColor,
        width: currentWidth,
        points: [...activeStroke.current],
      };
      onChange([...strokes, newStroke]);
    }
    activeStroke.current = [];
  };

  const handleUndo = () => {
    if (disabled || strokes.length === 0) return;
    pieceSound.playUndo();
    onChange(strokes.slice(0, -1));
  };

  const handleClear = () => {
    if (disabled || strokes.length === 0) return;
    pieceSound.playClear();
    onChange([]);
  };

  return (
    <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%'}}>
      <div ref={containerRef} className="piece-canvas-wrapper">
        <div
          className="piece-canvas-base-svg"
          dangerouslySetInnerHTML={{__html: baseSvg}}
        />
        <canvas
          ref={canvasRef}
          width={400}
          height={400}
          className="piece-canvas-draw-layer"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        />
      </div>

      {!disabled && (
        <div className="piece-toolbar">
          <div className="piece-color-row">
            {PALETTE.map((c, idx) => (
              <button
                key={c}
                type="button"
                className={`piece-color-btn ${currentColor === c ? 'active' : ''}`}
                style={{backgroundColor: c, color: c}}
                onClick={() => {
                  setCurrentColor(c);
                  pieceSound.playColorSelect(idx);
                }}
                aria-label={`Color ${idx + 1}`}
              />
            ))}
          </div>

          <div className="piece-actions-row">
            <button
              type="button"
              className={`piece-tool-btn ${currentWidth === 4 ? 'active' : ''}`}
              onClick={() => setCurrentWidth(4)}
            >
              <IconLabel name="pen">บาง 4 px</IconLabel>
            </button>
            <button
              type="button"
              className={`piece-tool-btn ${currentWidth === 8 ? 'active' : ''}`}
              onClick={() => setCurrentWidth(8)}
            >
              <IconLabel name="pen">หนา 8 px</IconLabel>
            </button>
            <button
              type="button"
              className="piece-tool-btn"
              onClick={handleUndo}
              disabled={strokes.length === 0}
            >
              <IconLabel name="undo">ย้อน</IconLabel>
            </button>
            <button
              type="button"
              className="piece-tool-btn"
              onClick={handleClear}
              disabled={strokes.length === 0}
            >
              <IconLabel name="trash">ล้าง</IconLabel>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Player View (Mobile Screen)
// ============================================================================
export function PiecePlayer({room}: {room: ReturnType<typeof useRoom>}) {
  const s = room.snapshot!;
  const me = s.me!;
  const r = s.run;
  const game = s.piece!;
  const now = useTicker(room.now);

  const [localStrokes, setLocalStrokes] = useState<PieceStroke[]>([]);
  const [revision, setRevision] = useState(1);
  const [hasFinishedEarly, setHasFinishedEarly] = useState(false);
  const [actionError, setActionError] = useState('');
  const [readySubmitting, setReadySubmitting] = useState(false);

  // Sync server artwork if reconnecting
  useEffect(() => {
    if (game.myArtwork && game.myArtwork.strokes.length > 0 && localStrokes.length === 0) {
      setLocalStrokes(game.myArtwork.strokes);
      setRevision(game.myArtwork.revision);
    }
  }, [game.myArtwork]);

  // Command sender helper
  const sendCmd = useCallback(
    async (kind: string, payload: Record<string, unknown> = {}) => {
      return command(s.room.code, 'player', kind, {
        runId: r?.id,
        phaseToken: r?.phaseToken,
        ...payload,
      });
    },
    [s.room.code, r?.id, r?.phaseToken]
  );

  // Send drawing strokes to server
  const handleStrokesChange = (newStrokes: PieceStroke[]) => {
    setLocalStrokes(newStrokes);
    const nextRev = revision + 1;
    setRevision(nextRev);

    if (r && r.status === 'RUNNING' && r.phase === 'DRAWING') {
      void sendCmd('piece-stroke', {
        strokes: newStrokes,
        revision: nextRev,
        clientTimeMs: Date.now(),
      }).catch(e => setActionError(e instanceof Error ? e.message : 'บันทึกภาพไม่สำเร็จ ลองวาดอีกครั้ง'));
    }
  };

  const handleReady = async () => {
    setReadySubmitting(true);
    setActionError('');
    try {
      await command(s.room.code, 'player', 'ready', {
        previewId: s.room.previewId,
        contentVersion: 'piece-v1',
      });
      await room.refresh();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'ยืนยันความพร้อมไม่สำเร็จ ลองอีกครั้ง');
    } finally {
      setReadySubmitting(false);
    }
  };

  const handleFinishEarly = async () => {
    setActionError('');
    try {
      await sendCmd('piece-finish-early');
      setHasFinishedEarly(true);
      pieceSound.playSubmit();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'ส่งภาพไม่สำเร็จ ตรวจการเชื่อมต่อแล้วลองอีกครั้ง');
    }
  };

  const handleVoteInternal = async (candidateId: string) => {
    setActionError('');
    try {
      await sendCmd('piece-internal-vote', {
        candidateId,
        revision: 1,
      });
      pieceSound.playVote();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'บันทึกคะแนนโหวตไม่สำเร็จ ลองเลือกอีกครั้ง');
    }
  };

  const handleVoteFinal = async (candidateId: string) => {
    setActionError('');
    try {
      await sendCmd('piece-final-vote', {
        candidateId,
        revision: 1,
      });
      pieceSound.playVote();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'บันทึกคะแนนโหวตไม่สำเร็จ ลองเลือกอีกครั้ง');
    }
  };

  const remainingSec = r?.deadline ? Math.max(0, Math.ceil((r.deadline - now) / 1000)) : 0;

  return (
    <main className="piece-root" role="main">
      <header className="piece-topbar">
        <div className="piece-brand-badge">
          <span className="piece-badge-tag">MISSING PIECE</span>
          <span className="piece-brand-title">AI เริ่ม คนเติม</span>
        </div>
        <div style={{fontSize: '13px', color: '#94a3b8'}}>
          กลุ่ม: <strong style={{color: '#fbbf24'}}>{me.groupId}</strong> | {me.nickname}
        </div>
      </header>

      {/* Pinned Context Banner */}
      <div className="piece-context-banner">
        <GameGlyph name="art" />
        <div>
          <strong style={{color: '#fbbf24', marginRight: '4px'}}>[โจทย์สร้างสรรค์]:</strong>
          <span>{game.prompt}</span>
        </div>
      </div>
      {actionError ? <p className="piece-action-error" role="alert">{actionError}</p> : null}

      <div className="piece-arena">
        {/* PREVIEW PHASE */}
        {game.phase === 'PREVIEW' && (
          <div style={{width: '100%', textAlign: 'center'}}>
            <p style={{fontSize: '14px', color: '#cbd5e1', marginBottom: '8px'}}>
              {game.task}
            </p>
            <InteractiveDrawingCanvas
              baseSvg={game.baseSvg}
              strokes={localStrokes}
              onChange={handleStrokesChange}
            />
            <div style={{marginTop: '16px'}}>
              <button
                type="button"
                className="piece-host-btn primary"
                style={{width: '100%', padding: '14px'}}
                onClick={() => void handleReady()}
                disabled={me.ready || readySubmitting}
              >
                {me.ready ? <IconLabel name="check">พร้อมแล้ว · รอผู้จัด</IconLabel> : <IconLabel name="thumb">ยืนยันพร้อมเล่น</IconLabel>}
              </button>
            </div>
          </div>
        )}

        {/* COUNTDOWN PHASE */}
        {game.phase === 'COUNTDOWN' && (
          <div style={{textAlign: 'center', marginTop: '40px'}}>
            <div style={{fontSize: '48px', fontWeight: 900, color: '#fbbf24'}}>
              {remainingSec > 0 ? remainingSec : 'GO!'}
            </div>
            <p style={{fontSize: '16px', color: '#94a3b8', marginTop: '10px'}}>
              เตรียมวาดปีกให้ยานกลไกในแบบของคุณ...
            </p>
          </div>
        )}

        {/* DRAWING PHASE */}
        {game.phase === 'DRAWING' && (
          <div style={{width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
            <div style={{display: 'flex', justifyContent: 'space-between', width: '100%', maxWidth: '380px', marginBottom: '6px'}}>
              <span style={{fontSize: '13px', fontWeight: 700, color: '#fbbf24'}}>
                <IconLabel name="pen">เติมปีก · 20 วิ</IconLabel>
              </span>
              <span style={{fontSize: '16px', fontWeight: 900, color: '#38bdf8', fontFamily: 'monospace'}}>
                <IconLabel name="clock">{remainingSec} วิ</IconLabel>
              </span>
            </div>

            <InteractiveDrawingCanvas
              baseSvg={game.baseSvg}
              strokes={localStrokes}
              onChange={handleStrokesChange}
              disabled={hasFinishedEarly}
            />

            {!hasFinishedEarly ? (
              <button
                type="button"
                className="piece-submit-btn"
                style={{width: '100%', maxWidth: '380px', marginTop: '10px'}}
                onClick={handleFinishEarly}
                disabled={localStrokes.length === 0}
              >
                <IconLabel name="send">ส่งผลงาน</IconLabel>
              </button>
            ) : (
              <div style={{marginTop: '12px', color: '#34d399', fontWeight: 700}}>
                <IconLabel name="check">ส่งแล้ว · รอหมดเวลา</IconLabel>
              </div>
            )}
          </div>
        )}

        {/* REVIEW REQUIRED (Wait for moderation) */}
        {game.phase === 'REVIEW_REQUIRED' && (
          <div style={{textAlign: 'center', marginTop: '20px', width: '100%'}}>
            <h3 style={{fontSize: '18px', color: '#fbbf24', margin: '0 0 10px 0'}}>
              <IconLabel name="lock">ส่งแล้ว · รอผู้จัดตรวจ</IconLabel>
            </h3>
            <p style={{fontSize: '13px', color: '#94a3b8', marginBottom: '14px'}}>
              ผลงานของคุณถูกส่งไปยังห้องควบคุมแล้ว เตรียมเลือกตัวแทนกลุ่มในรอบถัดไป
            </p>
            <CanvasViewer
              baseSvg={game.baseSvg}
              strokes={localStrokes}
              style={{maxWidth: '300px', margin: '0 auto'}}
            />
          </div>
        )}

        {/* INTERNAL VOTE PHASE (Vote for own group candidate) */}
        {game.phase === 'INTERNAL_VOTE' && (
          <div style={{width: '100%'}}>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
              <h3 style={{fontSize: '16px', color: '#fbbf24', margin: 0}}>
                <IconLabel name="vote">เลือกตัวแทนกลุ่ม {me.groupId}</IconLabel>
              </h3>
              <span style={{fontSize: '15px', fontWeight: 800, color: '#38bdf8'}}>
                <IconLabel name="clock">{remainingSec} วิ</IconLabel>
              </span>
            </div>
            <p style={{fontSize: '12px', color: '#94a3b8', margin: '4px 0 12px 0'}}>
              เลือกผลงานที่ดีที่สุดในกลุ่มของคุณเพื่อส่งไปประชันกับกลุ่มอื่น (เลือกงานตัวเองได้)
            </p>

            <div className="piece-vote-grid">
              {game.internalArtworks?.map(art => {
                const isSelected = game.myInternalVote === art.id;
                return (
                  <div
                    key={art.id}
                    className={`piece-vote-card ${isSelected ? 'selected' : ''}`}
                    onClick={() => void handleVoteInternal(art.id)}
                  >
                    <CanvasViewer
                      baseSvg={game.baseSvg}
                      strokes={art.strokes}
                      className="piece-vote-thumb"
                    />
                    <div className="piece-vote-label">
                      {art.isMe ? <IconLabel name="star">งานของคุณ</IconLabel> : `โดย: ${art.author}`}
                    </div>
                    {isSelected && (
                      <span style={{fontSize: '11px', color: '#fbbf24', fontWeight: 700, marginTop: '2px'}}>
                        <IconLabel name="check">โหวตแล้ว</IconLabel>
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* FINAL VOTE PHASE (Vote for other group candidate) */}
        {game.phase === 'FINAL_VOTE' && (
          <div style={{width: '100%'}}>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
              <h3 style={{fontSize: '16px', color: '#fbbf24', margin: 0}}>
                <IconLabel name="trophy">เลือกผลงานกลุ่มอื่น</IconLabel>
              </h3>
              <span style={{fontSize: '15px', fontWeight: 800, color: '#38bdf8'}}>
                <IconLabel name="clock">{remainingSec} วิ</IconLabel>
              </span>
            </div>
            <p style={{fontSize: '12px', color: '#94a3b8', margin: '4px 0 12px 0'}}>
              ผลงานตัวแทนทั้ง 6 กลุ่มแบบนิรนาม A–F: โหวตผลงานที่คุณประทับใจที่สุด
            </p>

            <div className="piece-vote-grid">
              {game.candidates?.map(cand => {
                const isOwnGroup = cand.groupId === me.groupId;
                const isSelected = game.myFinalVote === cand.id;
                const label = String.fromCharCode(64 + cand.position); // A, B, C...

                return (
                  <div
                    key={cand.id}
                    className={`piece-vote-card ${isSelected ? 'selected' : ''}`}
                    style={isOwnGroup ? {opacity: 0.5, cursor: 'not-allowed'} : {}}
                    onClick={() => {
                      if (!isOwnGroup) void handleVoteFinal(cand.id);
                    }}
                  >
                    <CanvasViewer
                      baseSvg={game.baseSvg}
                      strokes={cand.strokes}
                      className="piece-vote-thumb"
                    />
                    <div className="piece-vote-label">
                      ผลงาน {label} {isOwnGroup ? '(กลุ่มของคุณ)' : ''}
                    </div>
                    {isSelected && (
                      <span style={{fontSize: '11px', color: '#fbbf24', fontWeight: 700, marginTop: '2px'}}>
                        <IconLabel name="check">โหวตแล้ว</IconLabel>
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* RESULT PHASE */}
        {game.phase === 'RESULT' && (
          <div style={{width: '100%', textAlign: 'center'}}>
            <h3 style={{fontSize: '20px', fontWeight: 900, color: '#fbbf24', margin: '0 0 8px 0'}}>
              <IconLabel name="trophy">ผลคะแนน Missing Piece</IconLabel>
            </h3>
            <p style={{fontSize: '13px', color: '#94a3b8', marginBottom: '14px'}}>
              AI ให้ฐานรากเท่ากัน แต่มนุษย์เติมความหมายที่แตกต่าง
            </p>

            <div className="piece-result-list">
              {game.results?.map(res => (
                <div key={res.id} className={`piece-result-row ${res.winner ? 'winner' : ''}`}>
                  <div style={{textAlign: 'left'}}>
                    <strong style={{color: '#fff', fontSize: '14px'}}>
                      {res.winner ? <IconLabel name="crown">{res.groupName}</IconLabel> : res.groupName}
                    </strong>
                    <div style={{fontSize: '11px', color: '#94a3b8'}}>
                      ผู้วาด: {res.author} | เสียงโหวต: {res.votes}
                    </div>
                  </div>
                  <div style={{textAlign: 'right'}}>
                    <strong style={{color: '#fbbf24', fontSize: '18px', fontFamily: 'monospace'}}>
                      {res.score}
                    </strong>
                    <div className="piece-result-support" aria-label={`การสนับสนุน ${supportPercent(res.support)}; สัดส่วนจริง ${res.supportExact}`}>
                      สนับสนุน {supportPercent(res.support)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

// ============================================================================
// Display View (1920x1080 Stadium Projector Screen)
// ============================================================================
export function PieceDisplay({room}: {room: ReturnType<typeof useRoom>}) {
  const s = room.snapshot!;
  const r = s.run;
  const game = s.piece!;
  const now = useTicker(room.now);

  const remainingSec = r?.deadline ? Math.max(0, Math.ceil((r.deadline - now) / 1000)) : 0;

  return (
    <main className="piece-root" role="main" style={{minHeight: '100vh'}}>
      <header className="piece-topbar" style={{padding: '14px 24px'}}>
        <div className="piece-brand-badge">
          <span className="piece-badge-tag" style={{fontSize: '14px', padding: '4px 10px'}}>
            STADIUM SCREEN
          </span>
          <span className="piece-brand-title" style={{fontSize: '20px'}}>
            <IconLabel name="art">Missing Piece · AI เริ่ม คนเติม</IconLabel>
          </span>
        </div>
        <div style={{fontSize: '14px', color: '#94a3b8'}}>
          ห้อง: <strong style={{color: '#fbbf24'}}>{s.room.code}</strong> | สมาชิก:{' '}
          <strong style={{color: '#38bdf8'}}>{s.groups.reduce((acc, g) => acc + g.members, 0)}</strong> คน
        </div>
      </header>

      {/* Pinned Context Banner */}
      <div className="piece-context-banner" style={{fontSize: '14px', padding: '10px 24px'}}>
        <GameGlyph name="art" />
        <div>
          <strong style={{color: '#fbbf24', marginRight: '8px'}}>[โจทย์ใหญ่ของห้อง]:</strong>
          <span>{game.prompt}</span>
        </div>
      </div>

      <div className="piece-display-container">
        {/* Left Arena View */}
        <div className="piece-display-gallery">
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px'}}>
            <span style={{fontSize: '18px', fontWeight: 800, color: '#fbbf24'}}>
              {game.phase === 'PREVIEW' && <IconLabel name="document">ภาพตั้งต้น</IconLabel>}
              {game.phase === 'DRAWING' && <IconLabel name="pen">ช่วงวาด</IconLabel>}
              {game.phase === 'REVIEW_REQUIRED' && <IconLabel name="search">รอผู้จัดตรวจ</IconLabel>}
              {game.phase === 'INTERNAL_VOTE' && <IconLabel name="vote">เลือกตัวแทนกลุ่ม</IconLabel>}
              {game.phase === 'FINAL_VOTE' && <IconLabel name="trophy">โหวตข้ามกลุ่ม</IconLabel>}
              {game.phase === 'RESULT' && <IconLabel name="chart">ผลคะแนน</IconLabel>}
            </span>
            <span style={{fontSize: '26px', fontWeight: 900, color: '#38bdf8', fontFamily: 'monospace'}}>
              {r?.phase === 'DRAWING' || r?.phase === 'INTERNAL_VOTE' || r?.phase === 'FINAL_VOTE'
                ? `${remainingSec}s`
                : game.phase}
            </span>
          </div>

          {/* PREVIEW / DRAWING / REVIEW: Show base canvas */}
          {['PREVIEW', 'COUNTDOWN', 'DRAWING', 'REVIEW_REQUIRED'].includes(game.phase) && (
            <div style={{display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1}}>
              <CanvasViewer
                baseSvg={game.baseSvg}
                strokes={[]}
                style={{maxWidth: '480px', width: '100%', height: 'auto'}}
              />
            </div>
          )}

          {/* FINAL VOTE: Show 6 anonymous candidates */}
          {game.phase === 'FINAL_VOTE' && (
            <div className="piece-candidate-grid">
              {game.candidates?.map(cand => {
                const label = String.fromCharCode(64 + cand.position);
                return (
                  <div key={cand.id} className="piece-candidate-card">
                    <span style={{fontSize: '16px', fontWeight: 800, color: '#fbbf24', marginBottom: '8px'}}>
                      ตัวแทน {label}
                    </span>
                    <CanvasViewer
                      baseSvg={game.baseSvg}
                      strokes={cand.strokes}
                      style={{width: '100%', aspectRatio: '1/1'}}
                    />
                  </div>
                );
              })}
            </div>
          )}

          {/* RESULT: Show revealed candidates with ranking */}
          {game.phase === 'RESULT' && (
            <div className="piece-candidate-grid">
              {game.results?.map(res => (
                <div key={res.id} className={`piece-candidate-card ${res.winner ? 'winner' : ''}`}>
                  <span style={{fontSize: '16px', fontWeight: 800, color: res.winner ? '#fbbf24' : '#fff', marginBottom: '4px'}}>
                    {res.winner ? <IconLabel name="crown">{res.groupName}</IconLabel> : res.groupName}
                  </span>
                  <span style={{fontSize: '12px', color: '#38bdf8', marginBottom: '8px'}}>
                    {res.author} | {res.score} pts | สนับสนุน {supportPercent(res.support)}
                  </span>
                  <CanvasViewer
                    baseSvg={game.baseSvg}
                    strokes={res.strokes}
                    style={{width: '100%', aspectRatio: '1/1'}}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Sidebar: Group Scores & Live Stats */}
        <div className="piece-display-sidebar">
          <div style={{background: '#0f1c3f', border: '1px solid #273b70', borderRadius: '12px', padding: '16px'}}>
            <div style={{fontSize: '16px', fontWeight: 800, color: '#fbbf24', marginBottom: '12px'}}>
              <IconLabel name="trophy">คะแนนกลุ่ม</IconLabel>
            </div>
            <div style={{display: 'flex', flexDirection: 'column', gap: '8px'}}>
              {s.scores?.map(g => {
                const avg = g.denominator > 0 ? (g.numerator / g.denominator).toFixed(1) : '0';
                return (
                  <div
                    key={g.id}
                    style={{
                      background: '#090f24',
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
export function PieceHost({room}: {room: ReturnType<typeof useRoom>}) {
  const s = room.snapshot!;
  const r = s.run;
  const h = s.host!;
  const game = s.piece!;
  const controller = useRef(tabIdentity('controller'));
  const now = useTicker(room.now);
  const [reason, setReason] = useState('เล่นซ้ำรอบที่สอง');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const [reviewedArtworkIds, setReviewedArtworkIds] = useState<Set<string>>(() => new Set());

  const hasControl = s.host?.controllerId === controller.current && (s.host?.leaseUntil ?? 0) > now;
  const pendingReviewIds = (game.moderation ?? [])
    .filter(art => art.strokeCount > 0 && art.decision === 'PENDING')
    .map(art => art.id);
  const reviewedCount = pendingReviewIds.filter(id => reviewedArtworkIds.has(id)).length;
  const allPendingReviewed = pendingReviewIds.every(id => reviewedArtworkIds.has(id));

  useEffect(() => {
    if (r?.phase !== 'REVIEW_REQUIRED') {
      setReviewedArtworkIds(new Set());
      return;
    }
    const reviewCards = Array.from(document.querySelectorAll<HTMLElement>('[data-piece-review-id]'));
    if (!reviewCards.length) return;
    if (typeof window.IntersectionObserver !== 'function') {
      setReviewedArtworkIds(new Set(pendingReviewIds));
      return;
    }

    const timers = new Map<HTMLElement, number>();
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        const card = entry.target as HTMLElement;
        const artworkId = card.dataset.pieceReviewId;
        if (!artworkId) continue;
        if (entry.isIntersecting && entry.intersectionRatio >= 0.55) {
          if (timers.has(card)) continue;
          timers.set(card, window.setTimeout(() => {
            setReviewedArtworkIds(current => {
              if (current.has(artworkId)) return current;
              const next = new Set(current);
              next.add(artworkId);
              return next;
            });
            timers.delete(card);
          }, 350));
        } else {
          const timer = timers.get(card);
          if (timer !== undefined) window.clearTimeout(timer);
          timers.delete(card);
        }
      }
    }, {threshold: [0, 0.55, 1]});

    reviewCards.forEach(card => observer.observe(card));
    return () => {
      observer.disconnect();
      timers.forEach(timer => window.clearTimeout(timer));
    };
  }, [r?.phase, game.moderation?.length, pendingReviewIds.join('|')]);

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
    setActionError('');
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
      console.error(`Host command failed (${kind}):`, e);
      setActionError(`${kind}: ${e instanceof Error ? e.message : 'คำสั่งไม่สำเร็จ โหลดสถานะล่าสุดแล้วลองอีกครั้ง'}`);
      void room.refresh();
      return undefined;
    } finally {
      setBusy(false);
    }
  };

  const handleStart = () => {
    void act('start', {timingProfile: 'normal'});
  };

  const handleApproveAll = () => {
    void act('piece-approve-all', {
      runId: r?.id,
      phaseToken: r?.phaseToken,
      reviewedArtworkIds: pendingReviewIds.filter(id => reviewedArtworkIds.has(id)),
    });
  };

  const handleOpenInternalVote = () => {
    void act('piece-open-internal-vote', {runId: r?.id, phaseToken: r?.phaseToken});
  };

  const handleOpenFinalVote = () => {
    void act('piece-open-final-vote', {runId: r?.id, phaseToken: r?.phaseToken});
  };

  const handleReveal = () => {
    void act('piece-reveal', {runId: r?.id, phaseToken: r?.phaseToken});
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
    <main className="piece-root" role="main">
      <header className="piece-topbar">
        <div className="piece-brand-badge">
          <span className="piece-badge-tag">HOST CONSOLE</span>
          <span className="piece-brand-title">Missing Piece (คิว 14.01)</span>
        </div>
        <div style={{fontSize: '13px', color: '#94a3b8'}}>
          ห้อง: <strong style={{color: '#fbbf24'}}>{s.room.code}</strong>
        </div>
      </header>
      {actionError ? <p className="piece-action-error" role="alert">{actionError}</p> : null}

      <div className="piece-arena">
        <div className="piece-host-panel">
          <h2 style={{fontSize: '18px', fontWeight: 800, color: '#fbbf24', margin: '0 0 10px 0'}}>
            ควบคุมเกม Missing Piece (AI เริ่ม คนเติม)
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
              className="piece-host-btn primary"
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
              className="piece-host-btn primary"
              style={{width: '100%', padding: '16px', fontSize: '16px'}}
              onClick={handleStart}
              disabled={!hasControl || busy}
            >
              <IconLabel name="play">เริ่มเกม Missing Piece</IconLabel>
            </button>
          )}

          {/* Active play: Pause / Resume */}
          {r && r.status === 'RUNNING' && (
            <div style={{display: 'flex', gap: '8px', marginBottom: '12px'}}>
              {r.paused ? (
                <button
                  type="button"
                  className="piece-host-btn primary"
                  onClick={() => void act('resume')}
                  disabled={!hasControl || busy}
                >
                  <IconLabel name="play">เล่นต่อ</IconLabel>
                </button>
              ) : (
                <button
                  type="button"
                  className="piece-host-btn secondary"
                  onClick={() => void act('pause')}
                  disabled={!hasControl || busy}
                >
                  <IconLabel name="pause">พักเกม</IconLabel>
                </button>
              )}
            </div>
          )}

          {/* Host Moderation Controls during REVIEW_REQUIRED */}
          {r && r.phase === 'REVIEW_REQUIRED' && (
            <div style={{background: '#090f24', padding: '14px', borderRadius: '10px', marginTop: '12px'}}>
              <h3 style={{fontSize: '15px', color: '#fbbf24', margin: '0 0 8px 0'}}>
                <IconLabel name="search">ตรวจผลงาน ({game.moderationStats?.submitted ?? 0})</IconLabel>
              </h3>
              <div style={{display: 'flex', gap: '8px', marginBottom: '12px'}}>
                <button
                  type="button"
                  className="piece-host-btn secondary"
                  onClick={handleApproveAll}
                  disabled={!hasControl || busy || pendingReviewIds.length === 0 || !allPendingReviewed}
                >
                  <IconLabel name="check">อนุมัติงานที่ตรวจครบ</IconLabel>
                </button>
                <button
                  type="button"
                  className="piece-host-btn primary"
                  onClick={handleOpenInternalVote}
                  disabled={!hasControl || busy}
                >
                <IconLabel name="vote">เริ่มโหวตในกลุ่ม</IconLabel>
                </button>
              </div>
              <p className="piece-review-progress" role="status" aria-live="polite">
                ตรวจดูผลงานที่ยังรออนุมัติแล้ว {reviewedCount} / {pendingReviewIds.length} ชิ้น · เลื่อนดูภาพให้ครบก่อนอนุมัติรวม
              </p>

              {/* Moderation preview grid */}
              <div className="piece-mod-grid">
                {game.moderation?.map(art => (
                  <div
                    key={art.id}
                    className="piece-mod-card"
                    data-piece-review-id={art.strokeCount > 0 && art.decision === 'PENDING' ? art.id : undefined}
                  >
                    <span style={{fontSize: '12px', fontWeight: 700, color: '#fbbf24'}}>
                      กลุ่ม {art.groupId} — {art.author}
                    </span>
                    {art.strokeCount > 0 && art.decision === 'PENDING' ? (
                      <span className="piece-review-status">
                        {reviewedArtworkIds.has(art.id) ? 'เห็นภาพแล้ว' : 'รอตรวจด้วยตา'}
                      </span>
                    ) : null}
                    <CanvasViewer
                      baseSvg={game.baseSvg}
                      strokes={art.strokes}
                      style={{width: '100%', aspectRatio: '1/1', marginTop: '6px'}}
                    />
                    <div style={{display: 'flex', gap: '4px', marginTop: '6px'}}>
                      <button
                        type="button"
                        style={{flex: 1, padding: '4px', fontSize: '11px', background: art.decision === 'APPROVED' ? '#10b981' : '#334155', color: '#fff', border: 'none', borderRadius: '4px'}}
                        onClick={() => void act('piece-moderation', {runId: r?.id, phaseToken: r?.phaseToken, artworkId: art.id, decision: 'APPROVED'})}
                      >
                        {art.decision === 'APPROVED' ? <IconLabel name="check">ผ่านแล้ว</IconLabel> : 'อนุมัติ'}
                      </button>
                      <button
                        type="button"
                        style={{flex: 1, padding: '4px', fontSize: '11px', background: art.decision === 'REJECTED' ? '#ef4444' : '#334155', color: '#fff', border: 'none', borderRadius: '4px'}}
                        onClick={() => void act('piece-moderation', {runId: r?.id, phaseToken: r?.phaseToken, artworkId: art.id, decision: 'REJECTED', reason: 'ไม่เหมาะสม'})}
                      >
                        {art.decision === 'REJECTED' ? '✕ คัดออก' : 'คัดออก'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Transition from INTERNAL_VOTE to FINAL_VOTE */}
          {r && r.phase === 'INTERNAL_VOTE' && (
            <div style={{marginTop: '14px'}}>
              <button
                type="button"
                className="piece-host-btn primary"
                style={{width: '100%', padding: '14px'}}
                onClick={handleOpenFinalVote}
                disabled={!hasControl || busy}
              >
                <IconLabel name="trophy">เริ่มโหวตข้ามกลุ่ม</IconLabel>
              </button>
            </div>
          )}

          {/* Transition from FINAL_VOTE to RESULT */}
          {r && r.phase === 'FINAL_VOTE' && (
            <div style={{marginTop: '14px'}}>
              <button
                type="button"
                className="piece-host-btn primary"
                style={{width: '100%', padding: '14px'}}
                onClick={handleReveal}
                disabled={!hasControl || busy}
              >
                <IconLabel name="chart">เปิดผลคะแนน</IconLabel>
              </button>
            </div>
          )}

          {/* On Result: Finish to 15.01 or Replay */}
          {r && r.status === 'RESULT' && (
            <div style={{marginTop: '16px'}}>
              <div style={{background: '#090f24', padding: '12px', borderRadius: '8px', marginBottom: '12px'}}>
                <div style={{fontSize: '13px', fontWeight: 700, color: '#34d399'}}>
                  <IconLabel name="check">ผลเกมพร้อมแล้ว</IconLabel>
                </div>
                <div style={{fontSize: '12px', color: '#94a3b8', marginTop: '2px'}}>
                  กดจบเกมเพื่อส่งห้องต่อไปยังคิว <strong>15.01</strong> (“สมการของความรับผิดชอบ”)
                </div>
              </div>

              <button
                type="button"
                className="piece-host-btn primary"
                style={{width: '100%', padding: '14px', fontSize: '15px'}}
                onClick={handleFinish}
                disabled={!hasControl || busy}
              >
                <IconLabel name="finish">จบเกมและไปต่อคิว 15.01</IconLabel>
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
                    background: '#090f24',
                    border: '1px solid #334155',
                    color: '#fff',
                    marginBottom: '8px',
                    boxSizing: 'border-box',
                  }}
                />
                <button
                  type="button"
                  className="piece-host-btn secondary"
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

// Default router export
export default function PieceGame({room}: {room: ReturnType<typeof useRoom>}) {
  const role = room.snapshot?.role;
  if (role === 'host') return <PieceHost room={room} />;
  if (role === 'display') return <PieceDisplay room={room} />;
  return <PiecePlayer room={room} />;
}
