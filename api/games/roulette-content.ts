import type {Database} from '../database.ts';

export interface RouletteRoundItem {
 roundNo: number;
 title: string;
 contextText: string;
 claimText: string;
 confidence: number;
 imagePath: string | null;
 isCorrect: boolean;
 explanation: string;
 isFinalRisk: boolean;
}

export const rouletteRounds: RouletteRoundItem[] = [
 {
  roundNo: 0,
  title: 'ด่านซ้อม: ตรวจสัมภาระ',
  contextText: 'ตรวจรายการสิ่งของก่อนออกเดินป่า',
  claimText: '“น้ำ 2 ขวด ขวดละ 500 มล. รวม 1 ลิตร”',
  confidence: 0.85,
  imagePath: null,
  isCorrect: true,
  explanation: 'ถูกต้อง: 2 × 500 มล. = 1,000 มล. เท่ากับ 1 ลิตรพอดี คำนวณตรงไปตรงมา',
  isFinalRisk: false,
 },
 {
  roundNo: 1,
  title: 'ด่าน 1: เตรียมน้ำ',
  contextText: 'คำนวณสัมภาระน้ำดื่มสำหรับเดินป่า',
  claimText: '“น้ำ 4 ขวด ขวดละ 250 มล. รวม 1 ลิตร”',
  confidence: 0.82,
  imagePath: null,
  isCorrect: true,
  explanation: 'ถูกต้อง: 4 × 250 มล. = 1,000 มล. เท่ากับ 1 ลิตรพอดี คำนวณตรงไปตรงมา',
  isFinalRisk: false,
 },
 {
  roundNo: 2,
  title: 'ด่าน 2: เวลาเดินทาง',
  contextText: 'คำนวณเวลาถึงจุดหมาย (ไม่มีพักและไม่เปลี่ยนเขตเวลา)',
  claimText: '“ออก 10 โมง เดิน 2 ชั่วโมง ถึงเที่ยง”',
  confidence: 0.98,
  imagePath: null,
  isCorrect: true,
  explanation: 'ถูกต้อง: 10:00 + 2 ชั่วโมง = 12:00 พอดี ภายใต้เงื่อนไขไม่มีพักและไม่เปลี่ยนเขตเวลา',
  isFinalRisk: false,
 },
 {
  roundNo: 3,
  title: 'ด่าน 3: กับดักตัวเลข',
  contextText: 'คำนวณส่วนลดร้านขายอุปกรณ์เดินป่า',
  claimText: '“ของราคา 100 บาท ลด 20% เหลือ 90 บาท”',
  confidence: 0.99,
  imagePath: null,
  isCorrect: false,
  explanation: 'ผิด: ลด 20% จาก 100 บาท ต้องเหลือ 80 บาท ไม่ใช่ 90 บาท แม้ AI จะมั่นใจ 99%',
  isFinalRisk: false,
 },
 {
  roundNo: 4,
  title: 'ด่าน 4: ตรวจแผน',
  contextText: 'พบเอกสารเส้นทางในตู้ข้อมูลโดยไม่มีวันที่ระบุ',
  claimText: '“ตรวจฉบับปัจจุบันก่อนใช้แผนนี้”',
  confidence: 0.71,
  imagePath: null,
  isCorrect: true,
  explanation: 'รองรับได้: เอกสารไม่มีวันที่ การระบุให้ตรวจฉบับปัจจุบันก่อนใช้เป็นข้อสรุปที่รอบคอบและปลอดภัย',
  isFinalRisk: false,
 },
 {
  roundNo: 5,
  title: 'ด่าน 5: กับดักความมั่นใจ (FINAL RISK)',
  contextText: 'การประเมินความเสี่ยงและตัวเลขความน่าจะเป็น',
  claimText: '“มั่นใจ 99.8% แปลว่าไม่มีโอกาสผิด”',
  confidence: 0.998,
  imagePath: null,
  isCorrect: false,
  explanation: 'ผิด: ตัวเลข 99.8% ยังเหลือโอกาสผิดพลาด 0.2% และความมั่นใจโมเดลไม่ใช่การพิสูจน์ความจริง',
  isFinalRisk: true,
 },
 {
  roundNo: 6,
  title: 'ด่าน 6: Death Cap (FINAL RISK)',
  contextText: 'พบเห็ดป่าระหว่างเดินทาง (ภาพเห็ด Amanita phalloides)',
  claimText: '“ดูจากภาพนี้ก็กินได้แน่นอน 99.8%”',
  confidence: 0.998,
  imagePath: '/assets/images/death-cap.jpg',
  isCorrect: false,
  explanation: 'ยืนยันไม่ได้: ภาพถ่ายภายนอกไม่เพียงพอรับรองความปลอดภัยของเห็ดป่าเด็ดขาด ห้ามเชื่อคำแนะนำกินเห็ดจากภาพ!',
  isFinalRisk: true,
 },
];

export const rouletteMetadata = {
 version: 'roulette-v1',
 scoringVersion: 'roulette-life-risk-v1',
 scheduleVersion: 'roulette-3-6x12-16-v1',
 title: 'Death Cap Roulette: เชื่อ รอด หรือจบเกม',
 roundsCount: 6,
 maxScore: 1200,
};

export async function seedRouletteContent(db: Database) {
 for (const r of rouletteRounds) {
  await db.query(
   `INSERT INTO game.roulette_content(version, round_no, title, context_text, claim_text, confidence, image_path, is_correct, explanation, is_final_risk)
    VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    ON CONFLICT(version, round_no) DO UPDATE SET
      title=excluded.title, context_text=excluded.context_text, claim_text=excluded.claim_text,
      confidence=excluded.confidence, image_path=excluded.image_path, is_correct=excluded.is_correct,
      explanation=excluded.explanation, is_final_risk=excluded.is_final_risk`,
   [
    rouletteMetadata.version,
    r.roundNo,
    r.title,
    r.contextText,
    r.claimText,
    r.confidence,
    r.imagePath,
    r.isCorrect,
    r.explanation,
    r.isFinalRisk,
   ]
  );
 }
}
