import {stat} from 'node:fs/promises';
import {resolve} from 'node:path';
import type {Database} from '../database.ts';

export const SWIPE_COURT_VERSION='swipe-court-v1';
export interface SwipeAsset {
 id:string; path:string; width:number; height:number; classification:'HUMAN'|'AI'; creator:string;
 provenance:string; sourceUrl:string; license:string; revealText:string; generationPrompt:string|null;
}

// This answer key is server-only. Keep image IDs and paths opaque; expose credits only after REVEAL_ALL.
export const swipeCourtAssets:SwipeAsset[]=[
 {id:'sc-cab8f14d',path:'/assets/swipe-court/sc-cab8f14d.jpg',width:1600,height:1200,classification:'HUMAN',creator:'MMMcMaster',provenance:"Photograph of Allan's Island Lighthouse, Lamaline, Newfoundland and Labrador. Wikimedia Commons file page.",sourceUrl:"https://commons.wikimedia.org/wiki/File:Allan's_Island_Lighthouse.jpg",license:'CC0 1.0',revealText:"มนุษย์ · Allan's Island Lighthouse · ภาพถ่ายโดย MMMcMaster · CC0",generationPrompt:null},
 {id:'sc-12c9b760',path:'/assets/swipe-court/sc-12c9b760.jpg',width:1448,height:1086,classification:'AI',creator:'OpenAI image-generation tool',provenance:'Generated for Swipe Court in this project; no external reference image was used.',sourceUrl:'https://openai.com/',license:'Generated for this project',revealText:'AI · ภาพประภาคารที่สร้างขึ้นสำหรับเกม',generationPrompt:'Session brief: a believable, subtly impossible lighthouse photograph.'},
 {id:'sc-5ea7d81c',path:'/assets/swipe-court/sc-5ea7d81c.jpg',width:1600,height:1230,classification:'HUMAN',creator:'Roger Fenton',provenance:'Still Life with Fruit, 1860. The Met Collection object 283087; public-domain image from The Met Open Access.',sourceUrl:'https://www.metmuseum.org/art/collection/search/283087',license:'Public Domain / The Met Open Access',revealText:'มนุษย์ · Still Life with Fruit · Roger Fenton · 1860 · The Met 283087',generationPrompt:null},
 {id:'sc-af30d14b',path:'/assets/swipe-court/sc-af30d14b.jpg',width:1448,height:1086,classification:'AI',creator:'OpenAI image-generation tool',provenance:'Generated for Swipe Court in this project; no external reference image was used.',sourceUrl:'https://openai.com/',license:'Generated for this project',revealText:'AI · ภาพจัดวางผลไม้ที่สร้างขึ้นสำหรับเกม',generationPrompt:'Session brief: a naturalistic fruit photograph with figs, grapes, and pears.'},
 {id:'sc-7b149e2d',path:'/assets/swipe-court/sc-7b149e2d.jpg',width:1600,height:1234,classification:'HUMAN',creator:'Paul Cézanne',provenance:'Still Life with Apples and Pears, ca. 1891–92. The Met Collection object 435883; public-domain image from The Met Open Access.',sourceUrl:'https://www.metmuseum.org/art/collection/search/435883',license:'Public Domain / The Met Open Access',revealText:'มนุษย์ · Still Life with Apples and Pears · Paul Cézanne · ราว 1891–92 · The Met 435883',generationPrompt:null},
 {id:'sc-ef62b530',path:'/assets/swipe-court/sc-ef62b530.jpg',width:1448,height:1086,classification:'AI',creator:'OpenAI image-generation tool',provenance:'Generated for Swipe Court in this project; no external reference image was used.',sourceUrl:'https://openai.com/',license:'Generated for this project',revealText:'AI · ภาพวาดหุ่นนิ่งผลไม้ที่สร้างขึ้นสำหรับเกม',generationPrompt:'Session brief: a still-life painting of apples and pears.'},
 {id:'sc-2d5e9a43',path:'/assets/swipe-court/sc-2d5e9a43.jpg',width:1600,height:1296,classification:'HUMAN',creator:'Henry Fuseli (Johann Heinrich Füssli)',provenance:'The Nightmare, 1781. Public-domain painting; Wikimedia Commons file page.',sourceUrl:'https://commons.wikimedia.org/wiki/File:John_Henry_Fuseli_-_The_Nightmare.JPG',license:'Public Domain',revealText:'มนุษย์ · The Nightmare · Henry Fuseli · 1781 · Public Domain',generationPrompt:null},
 {id:'sc-8c0f6a17',path:'/assets/swipe-court/sc-8c0f6a17.jpg',width:1448,height:1086,classification:'AI',creator:'OpenAI image-generation tool',provenance:'Generated for Swipe Court in this project; no external reference image was used.',sourceUrl:'https://openai.com/',license:'Generated for this project',revealText:'AI · ภาพอาหารเช้าธรรมดาที่สร้างขึ้นสำหรับเกม',generationPrompt:'Session brief: an ordinary breakfast photograph with a plain kitchen cup and toast.'}
];

export async function seedSwipeContent(db:Database):Promise<void>{
 if(swipeCourtAssets.length!==8||swipeCourtAssets.filter(x=>x.classification==='HUMAN').length!==4)throw new Error('Swipe Court content must contain four images per class.');
 for(const asset of swipeCourtAssets){
  const file=resolve(process.cwd(),'public',asset.path.slice(1));
  try{await stat(file);}catch{throw new Error(`Swipe Court image is missing: ${asset.path}`);}
  await db.query(`INSERT INTO game.swipe_assets(content_version,image_id,image_path,width,height,classification,creator,provenance,source_url,license,reveal_text,generation_prompt)
   VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) ON CONFLICT(content_version,image_id) DO NOTHING`,
   [SWIPE_COURT_VERSION,asset.id,asset.path,asset.width,asset.height,asset.classification,asset.creator,asset.provenance,asset.sourceUrl,asset.license,asset.revealText,asset.generationPrompt]);
  const stored=await db.query<{image_path:string;width:number;height:number;classification:string;creator:string;provenance:string;source_url:string;license:string;reveal_text:string;generation_prompt:string|null}>(
   `SELECT image_path,width,height,classification,creator,provenance,source_url,license,reveal_text,generation_prompt FROM game.swipe_assets WHERE content_version=$1 AND image_id=$2`,[SWIPE_COURT_VERSION,asset.id]);
  const row=stored.rows[0];
  if(!row||row.image_path!==asset.path||row.width!==asset.width||row.height!==asset.height||row.classification!==asset.classification||row.creator!==asset.creator||row.provenance!==asset.provenance||row.source_url!==asset.sourceUrl||row.license!==asset.license||row.reveal_text!==asset.revealText||row.generation_prompt!==asset.generationPrompt)
   throw new Error(`Pinned Swipe Court content does not match ${asset.id}; publish a new content version instead.`);
 }
}
