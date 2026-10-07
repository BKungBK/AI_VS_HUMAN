import type {Database} from '../database.ts';

export interface PieceContentRecord {
  version: string;
  prompt: string;
  task: string;
  baseAssetId: string;
  baseSvg: string;
  metadata: {
    title: string;
    description: string;
    aiModel: string;
    generatedAt: string;
    license: string;
    drawingZones: {
      left: {x: number; y: number; width: number; height: number; label: string};
      right: {x: number; y: number; width: number; height: number; label: string};
    };
  };
}

export const PIECE_CONTENT_V1: PieceContentRecord = {
  version: 'piece-v1',
  prompt: 'เติมปีกให้สิ่งประดิษฐ์นี้พร้อมออกเดินทางในแบบของคุณ',
  task: 'AI ร่างโครงสร้างลำตัวของอากาศยานกลไกไว้ให้แล้ว วาดเติมปีกหรืออุปกรณ์พยุงการบินทั้ง 2 ฝั่งในแบบของคุณภายใน 20 วินาที',
  baseAssetId: 'piece-asset-01',
  baseSvg: `<svg viewBox="0 0 1000 1000" xmlns="http://www.w3.org/2000/svg">
  <!-- Background Glow & Grid -->
  <defs>
    <radialGradient id="bodyGlow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#38bdf8" stop-opacity="0.15"/>
      <stop offset="100%" stop-color="#0284c7" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="metalHulk" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#334155"/>
      <stop offset="50%" stop-color="#1e293b"/>
      <stop offset="100%" stop-color="#0f172a"/>
    </linearGradient>
    <linearGradient id="goldTrim" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#fbbf24"/>
      <stop offset="100%" stop-color="#d97706"/>
    </linearGradient>
  </defs>

  <!-- Left & Right Wing Drawing Guides (Subtle Dashed) -->
  <rect x="50" y="240" width="360" height="480" rx="16" fill="rgba(56, 189, 248, 0.02)" stroke="#38bdf8" stroke-width="2" stroke-dasharray="8 8" opacity="0.45"/>
  <text x="230" y="275" fill="#38bdf8" font-size="20" font-family="sans-serif" font-weight="bold" text-anchor="middle" opacity="0.6">✦ ปีกซ้าย (LEFT WING ZONE)</text>

  <rect x="590" y="240" width="360" height="480" rx="16" fill="rgba(56, 189, 248, 0.02)" stroke="#38bdf8" stroke-width="2" stroke-dasharray="8 8" opacity="0.45"/>
  <text x="770" y="275" fill="#38bdf8" font-size="20" font-family="sans-serif" font-weight="bold" text-anchor="middle" opacity="0.6">✦ ปีกขวา (RIGHT WING ZONE)</text>

  <!-- Central Steampunk Fuselage (The Mechanical Bird Airship) -->
  <circle cx="500" cy="500" r="160" fill="url(#bodyGlow)"/>

  <!-- Main Body Hull -->
  <path d="M500,200 C560,280 580,450 565,650 C550,780 520,840 500,880 C480,840 450,780 435,650 C420,450 440,280 500,200 Z" fill="url(#metalHulk)" stroke="url(#goldTrim)" stroke-width="4"/>

  <!-- Cockpit Canopy Glass -->
  <ellipse cx="500" cy="350" rx="36" ry="68" fill="#0284c7" stroke="#38bdf8" stroke-width="3" opacity="0.85"/>
  <ellipse cx="490" cy="335" rx="12" ry="28" fill="#e0f2fe" opacity="0.6"/>

  <!-- Center Power Core / Heart Turbine -->
  <circle cx="500" cy="510" r="42" fill="#0f172a" stroke="#fbbf24" stroke-width="3"/>
  <circle cx="500" cy="510" r="28" fill="#f59e0b" opacity="0.7"/>
  <circle cx="500" cy="510" r="14" fill="#fef08a"/>
  <!-- Rotor blades -->
  <line x1="500" y1="472" x2="500" y2="548" stroke="#1e293b" stroke-width="4"/>
  <line x1="462" y1="510" x2="538" y2="510" stroke="#1e293b" stroke-width="4"/>

  <!-- Wing Sockets / Mounting Brackets -->
  <!-- Left Socket -->
  <path d="M438,440 L380,420 L380,540 L438,520 Z" fill="#1e293b" stroke="#f59e0b" stroke-width="3"/>
  <circle cx="390" cy="480" r="10" fill="#fbbf24"/>
  <!-- Right Socket -->
  <path d="M562,440 L620,420 L620,540 L562,520 Z" fill="#1e293b" stroke="#f59e0b" stroke-width="3"/>
  <circle cx="610" cy="480" r="10" fill="#fbbf24"/>

  <!-- Tail Stabilizers & Rudder -->
  <path d="M500,750 L440,860 L500,830 L560,860 Z" fill="#1e293b" stroke="#64748b" stroke-width="2"/>
  <line x1="500" y1="650" x2="500" y2="880" stroke="#f59e0b" stroke-width="2"/>
</svg>`,
  metadata: {
    title: 'The Unwinged Aviator (จักรกลเวหาไร้ปีก)',
    description: 'ร่างโครงสร้างยานสัตว์กลไฮบริด สร้างโดย generative model โดยเว้นช่องว่างปีกสำหรับมนุษย์เติมเต็มเจตจำนง',
    aiModel: 'Imagen 3 Core / Hybrid Structural Blueprint v1.0',
    generatedAt: '2026-10-06T12:00:00Z',
    license: 'Internal Creative Commons Non-Commercial Attribution',
    drawingZones: {
      left: {x: 0.05, y: 0.24, width: 0.36, height: 0.48, label: 'ปีกซ้าย'},
      right: {x: 0.59, y: 0.24, width: 0.36, height: 0.48, label: 'ปีกขวา'},
    },
  },
};

export async function seedPieceContent(db: Database): Promise<void> {
  await db.query(
    `INSERT INTO game.piece_content(version, prompt, task, base_asset_id, base_svg, base_metadata)
     VALUES($1, $2, $3, $4, $5, $6)
     ON CONFLICT(version) DO UPDATE SET
       prompt = EXCLUDED.prompt,
       task = EXCLUDED.task,
       base_asset_id = EXCLUDED.base_asset_id,
       base_svg = EXCLUDED.base_svg,
       base_metadata = EXCLUDED.base_metadata`,
    [
      PIECE_CONTENT_V1.version,
      PIECE_CONTENT_V1.prompt,
      PIECE_CONTENT_V1.task,
      PIECE_CONTENT_V1.baseAssetId,
      PIECE_CONTENT_V1.baseSvg,
      JSON.stringify(PIECE_CONTENT_V1.metadata),
    ]
  );
}
