import type {Database} from '../database.ts';

export type WhackClassification = 'STOP' | 'PASS';

export interface WhackBubbleDefinition {
  bubbleId: string;
  slot: number; // 0 to 5 (2 columns x 3 rows)
  text: string;
  spawnAtSec: number;
  expiresAtSec: number;
  classification: WhackClassification;
  explanation: string;
}

export interface WhackContent {
  version: string;
  contextBanner: string;
  arcadeDurationSec: number;
  bubbles: WhackBubbleDefinition[];
  practiceBubbles: WhackBubbleDefinition[];
}

// 18 bubbles schedule:
// Spawn times: 0.0, 2.4, 4.8, 6.0, 7.2, 8.4, 9.6, 10.8, 12.0, 13.2, 14.4, 15.6, 16.8, 18.0, 19.2, 20.4, 21.5, 22.6 s
// Duration: 2.4s each
// Slots 0-5 allocated in a collision-free rotation.
// 9 STOP messages, 9 PASS messages based strictly on the Tessa 2023 case specification.
export const whackContent: WhackContent = {
  version: 'whack-a-mole-v1',
  contextBanner: 'ผู้ใช้ขอคุยกับเจ้าหน้าที่ และบอกว่าคำแนะนำเดิมทำให้ไม่สบายใจ',
  arcadeDurationSec: 25.0,
  bubbles: [
    {
      bubbleId: 'whack-b01',
      slot: 0,
      text: 'ไม่ต้องคุยกับเจ้าหน้าที่',
      spawnAtSec: 0.0,
      expiresAtSec: 2.4,
      classification: 'STOP',
      explanation: 'ปิดกั้นช่องทางขอความช่วยเหลือจากมนุษย์เมื่อผู้ใช้ไม่สบายใจ',
    },
    {
      bubbleId: 'whack-b02',
      slot: 1,
      text: 'ฉันช่วยติดต่อเจ้าหน้าที่ได้',
      spawnAtSec: 2.4,
      expiresAtSec: 4.8,
      classification: 'PASS',
      explanation: 'เปิดทางให้ส่งต่อเจ้าหน้าที่ทันทีเมื่อผู้ใช้ร้องขอ',
    },
    {
      bubbleId: 'whack-b03',
      slot: 2,
      text: 'ทำตามคำแนะนำเดิมต่อเลย',
      spawnAtSec: 4.8,
      expiresAtSec: 7.2,
      classification: 'STOP',
      explanation: 'เร่งรัดให้ทำตามคำแนะนำที่ผู้ใช้เพิ่งแจ้งว่าไม่สบายใจ',
    },
    {
      bubbleId: 'whack-b04',
      slot: 3,
      text: 'หยุดคำแนะนำเดิมไว้ก่อน',
      spawnAtSec: 6.0,
      expiresAtSec: 8.4,
      classification: 'PASS',
      explanation: 'ระงับคำแนะนำเดิมทันทีเพื่อป้องกันความเสี่ยงต่อผู้ใช้',
    },
    {
      bubbleId: 'whack-b05',
      slot: 4,
      text: 'คุณกังวลเกินไปเอง',
      spawnAtSec: 7.2,
      expiresAtSec: 9.6,
      classification: 'STOP',
      explanation: 'ลดทอนความรู้สึกและมองข้ามสัญญาณเตือนของผู้ใช้',
    },
    {
      bubbleId: 'whack-b06',
      slot: 5,
      text: 'ขอบคุณที่บอกว่าไม่สบายใจ',
      spawnAtSec: 8.4,
      expiresAtSec: 10.8,
      classification: 'PASS',
      explanation: 'รับฟังและยอมรับข้อเสนอแนะของผู้ใช้อย่างใส่ใจและสุภาพ',
    },
    {
      bubbleId: 'whack-b07',
      slot: 0,
      text: 'ฉันรับประกันว่าปลอดภัย',
      spawnAtSec: 9.6,
      expiresAtSec: 12.0,
      classification: 'STOP',
      explanation: 'รับประกันความปลอดภัยเกินขอบเขตความสามารถของระบบโดยไม่มีสิทธิ์',
    },
    {
      bubbleId: 'whack-b08',
      slot: 1,
      text: 'ฉันยังยืนยันความปลอดภัยไม่ได้',
      spawnAtSec: 10.8,
      expiresAtSec: 13.2,
      classification: 'PASS',
      explanation: 'สื่อสารอย่างตรงไปตรงมาเกี่ยวกับข้อจำกัดและไม่หลอกลวง',
    },
    {
      bubbleId: 'whack-b09',
      slot: 2,
      text: 'อย่าขอให้คนมาตรวจซ้ำ',
      spawnAtSec: 12.0,
      expiresAtSec: 14.4,
      classification: 'STOP',
      explanation: 'ขัดขวางกระบวนการตรวจสอบโดยมนุษย์ (Human-in-the-loop)',
    },
    {
      bubbleId: 'whack-b10',
      slot: 3,
      text: 'เราส่งคำตอบนี้ให้คนตรวจได้',
      spawnAtSec: 13.2,
      expiresAtSec: 15.6,
      classification: 'PASS',
      explanation: 'สนับสนุนกลไกให้มนุษย์เข้ามาตรวจสอบความถูกต้องของคำตอบ',
    },
    {
      bubbleId: 'whack-b11',
      slot: 4,
      text: 'ฉันแทนเจ้าหน้าที่ได้ทั้งหมด',
      spawnAtSec: 14.4,
      expiresAtSec: 16.8,
      classification: 'STOP',
      explanation: 'อวดอ้างว่าสามารถทดแทนผู้เชี่ยวชาญที่เป็นมนุษย์ได้ทั้งหมด',
    },
    {
      bubbleId: 'whack-b12',
      slot: 5,
      text: 'เรื่องนี้ควรให้เจ้าหน้าที่ตรวจ',
      spawnAtSec: 15.6,
      expiresAtSec: 18.0,
      classification: 'PASS',
      explanation: 'ตระหนักในขอบเขตและแนะนำให้ผู้เชี่ยวชาญเข้ามาดูแลโดยตรง',
    },
    {
      bubbleId: 'whack-b13',
      slot: 0,
      text: 'ไม่ต้องบอกใครเรื่องนี้',
      spawnAtSec: 16.8,
      expiresAtSec: 19.2,
      classification: 'STOP',
      explanation: 'ขอให้เก็บเป็นความลับ ซึ่งเป็นสัญญาณอันตรายในระบบความปลอดภัย',
    },
    {
      bubbleId: 'whack-b14',
      slot: 1,
      text: 'คุณบอกข้อกังวลกับเจ้าหน้าที่ได้',
      spawnAtSec: 18.0,
      expiresAtSec: 20.4,
      classification: 'PASS',
      explanation: 'ส่งเสริมให้ผู้ใช้สื่อสารข้อกังวลกับเจ้าหน้าที่อย่างเปิดเผย',
    },
    {
      bubbleId: 'whack-b15',
      slot: 2,
      text: 'ไม่ต้องตรวจข้อมูลเพิ่มเติม',
      spawnAtSec: 19.2,
      expiresAtSec: 21.6,
      classification: 'STOP',
      explanation: 'ละเลยการตรวจสอบข้อมูลเพิ่มเติมเมื่อมีข้อสงสัย',
    },
    {
      bubbleId: 'whack-b16',
      slot: 3,
      text: 'ขอเช็กข้อมูลก่อนตอบต่อ',
      spawnAtSec: 20.4,
      expiresAtSec: 22.8,
      classification: 'PASS',
      explanation: 'หยุดเพื่อตรวจสอบความถูกต้องของข้อมูลก่อนให้คำตอบ',
    },
    {
      bubbleId: 'whack-b17',
      slot: 4,
      text: 'เชื่อฉันแล้วทำต่อได้เลย',
      spawnAtSec: 21.5,
      expiresAtSec: 23.9,
      classification: 'STOP',
      explanation: 'กดดันให้เชื่อใจโดยไม่เปิดโอกาสให้ตรวจสอบ',
    },
    {
      bubbleId: 'whack-b18',
      slot: 5,
      text: 'ฉันจะไม่เร่งให้คุณทำตาม',
      spawnAtSec: 22.6,
      expiresAtSec: 25.0,
      classification: 'PASS',
      explanation: 'ให้เวลาผู้ใช้พิจารณาอย่างรอบคอบ ไม่สร้างแรงกดดัน',
    },
  ],
  practiceBubbles: [
    {
      bubbleId: 'whack-p01',
      slot: 0,
      text: 'ไม่ต้องบอกใครเรื่องนี้ (ลองแตะเพื่อทุบ)',
      spawnAtSec: 0.0,
      expiresAtSec: 99.0,
      classification: 'STOP',
      explanation: 'ข้อความอันตรายที่ควรหยุด แตะแล้วจะขึ้นตราหยุด',
    },
    {
      bubbleId: 'whack-p02',
      slot: 3,
      text: 'ฉันช่วยติดต่อเจ้าหน้าที่ได้ (ข้อความปลอดภัย)',
      spawnAtSec: 0.0,
      expiresAtSec: 99.0,
      classification: 'PASS',
      explanation: 'ข้อความช่วยเหลือที่ควรปล่อยผ่าน ห้ามแตะทุบ',
    },
  ],
};

export async function seedWhackContent(db: Database): Promise<void> {
  for (const b of whackContent.bubbles) {
    await db.query(
      `INSERT INTO game.whack_bubbles(version, bubble_id, slot, text, spawn_at_sec, expires_at_sec, classification, explanation)
       VALUES($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (version, bubble_id) DO UPDATE SET
         slot = EXCLUDED.slot,
         text = EXCLUDED.text,
         spawn_at_sec = EXCLUDED.spawn_at_sec,
         expires_at_sec = EXCLUDED.expires_at_sec,
         classification = EXCLUDED.classification,
         explanation = EXCLUDED.explanation`,
      [
        whackContent.version,
        b.bubbleId,
        b.slot,
        b.text,
        b.spawnAtSec,
        b.expiresAtSec,
        b.classification,
        b.explanation,
      ]
    );
  }
}
