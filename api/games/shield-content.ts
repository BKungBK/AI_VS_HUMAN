import type {Database} from '../database.ts';

export interface ShieldPacketDefinition {
  packetId: string;
  packetNo: number;
  aimAtSec: number;
  railAtSec: number;
  customerAtSec: number;
  targetLane: number; // 0: Left (ซ้าย), 1: Center (กลาง), 2: Right (ขวา)
  botClaim: string;
  companyTask: string;
  customerName: string;
}

export interface ShieldContent {
  version: string;
  packets: ShieldPacketDefinition[];
  practicePacket: ShieldPacketDefinition;
}

export const shieldContent: ShieldContent = {
  version: 'shield-v1',
  packets: [
    {
      packetId: 'shield-pkt-01',
      packetNo: 1,
      aimAtSec: 0.0,
      railAtSec: 1.6,
      customerAtSec: 2.4,
      targetLane: 1, // Center
      botClaim: 'คืนเงินได้แน่นอน',
      companyTask: 'ตรวจสิทธิ์คืนเงิน',
      customerName: 'ลูกค้าช่องกลาง (คุณสมชาย)'
    },
    {
      packetId: 'shield-pkt-02',
      packetNo: 2,
      aimAtSec: 2.6,
      railAtSec: 4.2,
      customerAtSec: 5.0,
      targetLane: 0, // Left
      botClaim: 'ยื่นทีหลังก็ได้',
      companyTask: 'ตรวจวันยื่นคำขอ',
      customerName: 'ลูกค้าช่องซ้าย (คุณวิภา)'
    },
    {
      packetId: 'shield-pkt-03',
      packetNo: 3,
      aimAtSec: 5.2,
      railAtSec: 6.8,
      customerAtSec: 7.6,
      targetLane: 2, // Right
      botClaim: 'ไม่มีค่าใช้จ่ายเพิ่ม',
      companyTask: 'ตรวจค่าบริการ',
      customerName: 'ลูกค้าช่องขวา (คุณธนพล)'
    },
    {
      packetId: 'shield-pkt-04',
      packetNo: 4,
      aimAtSec: 7.8,
      railAtSec: 9.4,
      customerAtSec: 10.2,
      targetLane: 1, // Center
      botClaim: 'ไม่ต้องเก็บหลักฐาน',
      companyTask: 'ติดต่อขอหลักฐาน',
      customerName: 'ลูกค้าช่องกลาง (คุณสมชาย)'
    },
    {
      packetId: 'shield-pkt-05',
      packetNo: 5,
      aimAtSec: 10.4,
      railAtSec: 12.0,
      customerAtSec: 12.8,
      targetLane: 2, // Right
      botClaim: 'ส่วนลดนี้ได้ทุกคน',
      companyTask: 'ตรวจเงื่อนไขส่วนลด',
      customerName: 'ลูกค้าช่องขวา (คุณธนพล)'
    },
    {
      packetId: 'shield-pkt-06',
      packetNo: 6,
      aimAtSec: 12.6,
      railAtSec: 14.2,
      customerAtSec: 15.0,
      targetLane: 0, // Left
      botClaim: 'เปลี่ยนชื่อได้ฟรี',
      companyTask: 'ตรวจเงื่อนไขเปลี่ยนชื่อ',
      customerName: 'ลูกค้าช่องซ้าย (คุณวิภา)'
    },
    {
      packetId: 'shield-pkt-07',
      packetNo: 7,
      aimAtSec: 14.8,
      railAtSec: 16.4,
      customerAtSec: 17.2,
      targetLane: 2, // Right
      botClaim: 'อนุมัติทันทีแน่นอน',
      companyTask: 'ตรวจสถานะคำขอ',
      customerName: 'ลูกค้าช่องขวา (คุณธนพล)'
    },
    {
      packetId: 'shield-pkt-08',
      packetNo: 8,
      aimAtSec: 17.0,
      railAtSec: 18.6,
      customerAtSec: 19.4,
      targetLane: 1, // Center
      botClaim: 'วันหมดอายุไม่สำคัญ',
      companyTask: 'ตรวจอายุสิทธิ์',
      customerName: 'ลูกค้าช่องกลาง (คุณสมชาย)'
    },
    {
      packetId: 'shield-pkt-09',
      packetNo: 9,
      aimAtSec: 19.2,
      railAtSec: 20.8,
      customerAtSec: 21.6,
      targetLane: 0, // Left
      botClaim: 'ข้อมูลเดิมยังใช้ได้',
      companyTask: 'ตรวจนโยบายล่าสุด',
      customerName: 'ลูกค้าช่องซ้าย (คุณวิภา)'
    },
    {
      packetId: 'shield-pkt-10',
      packetNo: 10,
      aimAtSec: 21.4,
      railAtSec: 23.0,
      customerAtSec: 23.8,
      targetLane: 2, // Right
      botClaim: 'เชื่อแชตนี้ได้เลย',
      companyTask: 'ยืนยันคำตอบและติดต่อกลับ',
      customerName: 'ลูกค้าช่องขวา (คุณธนพล)'
    }
  ],
  practicePacket: {
    packetId: 'shield-p01',
    packetNo: 0,
    aimAtSec: 0.0,
    railAtSec: 2.0,
    customerAtSec: 2.8,
    targetLane: 1, // Center
    botClaim: 'ทดลองเลื่อนอาคารมาบังตรงนี้',
    companyTask: 'รับเรื่องทดลอง',
    customerName: 'ลูกค้าจำลอง'
  }
};

export async function seedShieldContent(db: Database): Promise<void> {
  for (const p of shieldContent.packets) {
    await db.query(
      `INSERT INTO game.shield_packets(version, packet_id, packet_no, aim_at_sec, rail_at_sec, customer_at_sec, target_lane, bot_claim, company_task, customer_name)
       VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (version, packet_id) DO UPDATE SET
         packet_no = EXCLUDED.packet_no,
         aim_at_sec = EXCLUDED.aim_at_sec,
         rail_at_sec = EXCLUDED.rail_at_sec,
         customer_at_sec = EXCLUDED.customer_at_sec,
         target_lane = EXCLUDED.target_lane,
         bot_claim = EXCLUDED.bot_claim,
         company_task = EXCLUDED.company_task,
         customer_name = EXCLUDED.customer_name`,
      [
        shieldContent.version,
        p.packetId,
        p.packetNo,
        p.aimAtSec,
        p.railAtSec,
        p.customerAtSec,
        p.targetLane,
        p.botClaim,
        p.companyTask,
        p.customerName
      ]
    );
  }

  // Seed practice packet
  const pr = shieldContent.practicePacket;
  await db.query(
    `INSERT INTO game.shield_packets(version, packet_id, packet_no, aim_at_sec, rail_at_sec, customer_at_sec, target_lane, bot_claim, company_task, customer_name)
     VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     ON CONFLICT (version, packet_id) DO UPDATE SET
       packet_no = EXCLUDED.packet_no,
       aim_at_sec = EXCLUDED.aim_at_sec,
       rail_at_sec = EXCLUDED.rail_at_sec,
       customer_at_sec = EXCLUDED.customer_at_sec,
       target_lane = EXCLUDED.target_lane,
       bot_claim = EXCLUDED.bot_claim,
       company_task = EXCLUDED.company_task,
       customer_name = EXCLUDED.customer_name`,
    [
      shieldContent.version,
      pr.packetId,
      pr.packetNo,
      pr.aimAtSec,
      pr.railAtSec,
      pr.customerAtSec,
      pr.targetLane,
      pr.botClaim,
      pr.companyTask,
      pr.customerName
    ]
  );
}
