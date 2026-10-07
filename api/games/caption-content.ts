import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import type {Database} from '../database.ts';
import {prepareCaption} from '../../src/shared/caption-text.ts';

export const captionContent={
 version:'caption-battle-v1',imagePath:'/assets/games/caption-battle/cat-office.png',
 imageAlt:'แมวสีส้มทำหน้าจริงจัง วางอุ้งเท้าบนแป้นพิมพ์แล็ปท็อป',
 task:'เมื่อเพื่อนบอกว่า “ให้ AI ทำงานแทนก็จบแล้ว”',
 aiCaption:'งานเสร็จแล้ว เหลือแค่หาคนรับผิดชอบแทนแมว',
 aiPrompt:'เขียนแคปชั่นภาษาไทยหนึ่งข้อความ ไม่เกิน 80 ตัวอักษรที่มองเห็น สำหรับภาพแมวทำงานบนแล็ปท็อป โจทย์: เมื่อเพื่อนบอกว่า ให้ AI ทำงานแทนก็จบแล้ว ใช้อารมณ์ขันสุภาพ ห้ามลิงก์หรือโจมตีบุคคล',
 aiModel:'Codex / GPT-6 family; exact runtime version unavailable',
 generatedAt:'2026-10-06T18:10:34Z',
 timestampMethod:'UTC time recorded when finalizing this prepared fixture; exact response-generation timestamp is unavailable.',
 selectionMethod:'หนึ่งข้อความที่ Codex แต่งไว้ก่อนเริ่มรอบ ไม่มีการเรียก AI สดหรือเลือกใหม่หลังเห็นผู้เล่น',
 imageOrigin:'Original image generated for this game using the built-in ImageGen tool; no external reference image.',
};
export async function seedCaptionContent(db:Database){
 prepareCaption(captionContent.aiCaption);
 await readFile(fileURLToPath(new URL('../../public/assets/games/caption-battle/cat-office.png',import.meta.url)));
 await db.query(`INSERT INTO game.caption_content(version,image_path,image_alt,task,ai_caption,ai_metadata)
 VALUES($1,$2,$3,$4,$5,$6::jsonb) ON CONFLICT(version) DO NOTHING`,[
 captionContent.version,captionContent.imagePath,captionContent.imageAlt,captionContent.task,captionContent.aiCaption,
 JSON.stringify({prompt:captionContent.aiPrompt,model:captionContent.aiModel,generatedAt:captionContent.generatedAt,timestampMethod:captionContent.timestampMethod,selectionMethod:captionContent.selectionMethod,imageOrigin:captionContent.imageOrigin})]);
 // Correct only the initial development fixture's placeholder timestamp.
 await db.query(`UPDATE game.caption_content SET ai_metadata=jsonb_set(jsonb_set(ai_metadata,'{generatedAt}',$1::jsonb),'{timestampMethod}',$2::jsonb)
 WHERE version=$3 AND ai_metadata->>'generatedAt'='2026-10-07T00:00:00Z'`,[JSON.stringify(captionContent.generatedAt),JSON.stringify(captionContent.timestampMethod),captionContent.version]);
}
