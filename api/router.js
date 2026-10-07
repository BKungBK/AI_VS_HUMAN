// api/database.ts
import { PGlite } from "@electric-sql/pglite";
import pg from "pg";
import { readFile as readFile2, mkdir } from "node:fs/promises";
import { resolve as resolve3 } from "node:path";

// api/games/swipe-court-content.ts
import { stat } from "node:fs/promises";
import { resolve } from "node:path";
var SWIPE_COURT_VERSION = "swipe-court-v1";
var swipeCourtAssets = [
  { id: "sc-cab8f14d", path: "/assets/swipe-court/sc-cab8f14d.jpg", width: 1600, height: 1200, classification: "HUMAN", creator: "MMMcMaster", provenance: "Photograph of Allan's Island Lighthouse, Lamaline, Newfoundland and Labrador. Wikimedia Commons file page.", sourceUrl: "https://commons.wikimedia.org/wiki/File:Allan's_Island_Lighthouse.jpg", license: "CC0 1.0", revealText: "\u0E21\u0E19\u0E38\u0E29\u0E22\u0E4C \xB7 Allan's Island Lighthouse \xB7 \u0E20\u0E32\u0E1E\u0E16\u0E48\u0E32\u0E22\u0E42\u0E14\u0E22 MMMcMaster \xB7 CC0", generationPrompt: null },
  { id: "sc-12c9b760", path: "/assets/swipe-court/sc-12c9b760.jpg", width: 1448, height: 1086, classification: "AI", creator: "OpenAI image-generation tool", provenance: "Generated for Swipe Court in this project; no external reference image was used.", sourceUrl: "https://openai.com/", license: "Generated for this project", revealText: "AI \xB7 \u0E20\u0E32\u0E1E\u0E1B\u0E23\u0E30\u0E20\u0E32\u0E04\u0E32\u0E23\u0E17\u0E35\u0E48\u0E2A\u0E23\u0E49\u0E32\u0E07\u0E02\u0E36\u0E49\u0E19\u0E2A\u0E33\u0E2B\u0E23\u0E31\u0E1A\u0E40\u0E01\u0E21", generationPrompt: "Session brief: a believable, subtly impossible lighthouse photograph." },
  { id: "sc-5ea7d81c", path: "/assets/swipe-court/sc-5ea7d81c.jpg", width: 1600, height: 1230, classification: "HUMAN", creator: "Roger Fenton", provenance: "Still Life with Fruit, 1860. The Met Collection object 283087; public-domain image from The Met Open Access.", sourceUrl: "https://www.metmuseum.org/art/collection/search/283087", license: "Public Domain / The Met Open Access", revealText: "\u0E21\u0E19\u0E38\u0E29\u0E22\u0E4C \xB7 Still Life with Fruit \xB7 Roger Fenton \xB7 1860 \xB7 The Met 283087", generationPrompt: null },
  { id: "sc-af30d14b", path: "/assets/swipe-court/sc-af30d14b.jpg", width: 1448, height: 1086, classification: "AI", creator: "OpenAI image-generation tool", provenance: "Generated for Swipe Court in this project; no external reference image was used.", sourceUrl: "https://openai.com/", license: "Generated for this project", revealText: "AI \xB7 \u0E20\u0E32\u0E1E\u0E08\u0E31\u0E14\u0E27\u0E32\u0E07\u0E1C\u0E25\u0E44\u0E21\u0E49\u0E17\u0E35\u0E48\u0E2A\u0E23\u0E49\u0E32\u0E07\u0E02\u0E36\u0E49\u0E19\u0E2A\u0E33\u0E2B\u0E23\u0E31\u0E1A\u0E40\u0E01\u0E21", generationPrompt: "Session brief: a naturalistic fruit photograph with figs, grapes, and pears." },
  { id: "sc-7b149e2d", path: "/assets/swipe-court/sc-7b149e2d.jpg", width: 1600, height: 1234, classification: "HUMAN", creator: "Paul C\xE9zanne", provenance: "Still Life with Apples and Pears, ca. 1891\u201392. The Met Collection object 435883; public-domain image from The Met Open Access.", sourceUrl: "https://www.metmuseum.org/art/collection/search/435883", license: "Public Domain / The Met Open Access", revealText: "\u0E21\u0E19\u0E38\u0E29\u0E22\u0E4C \xB7 Still Life with Apples and Pears \xB7 Paul C\xE9zanne \xB7 \u0E23\u0E32\u0E27 1891\u201392 \xB7 The Met 435883", generationPrompt: null },
  { id: "sc-ef62b530", path: "/assets/swipe-court/sc-ef62b530.jpg", width: 1448, height: 1086, classification: "AI", creator: "OpenAI image-generation tool", provenance: "Generated for Swipe Court in this project; no external reference image was used.", sourceUrl: "https://openai.com/", license: "Generated for this project", revealText: "AI \xB7 \u0E20\u0E32\u0E1E\u0E27\u0E32\u0E14\u0E2B\u0E38\u0E48\u0E19\u0E19\u0E34\u0E48\u0E07\u0E1C\u0E25\u0E44\u0E21\u0E49\u0E17\u0E35\u0E48\u0E2A\u0E23\u0E49\u0E32\u0E07\u0E02\u0E36\u0E49\u0E19\u0E2A\u0E33\u0E2B\u0E23\u0E31\u0E1A\u0E40\u0E01\u0E21", generationPrompt: "Session brief: a still-life painting of apples and pears." },
  { id: "sc-2d5e9a43", path: "/assets/swipe-court/sc-2d5e9a43.jpg", width: 1600, height: 1296, classification: "HUMAN", creator: "Henry Fuseli (Johann Heinrich F\xFCssli)", provenance: "The Nightmare, 1781. Public-domain painting; Wikimedia Commons file page.", sourceUrl: "https://commons.wikimedia.org/wiki/File:John_Henry_Fuseli_-_The_Nightmare.JPG", license: "Public Domain", revealText: "\u0E21\u0E19\u0E38\u0E29\u0E22\u0E4C \xB7 The Nightmare \xB7 Henry Fuseli \xB7 1781 \xB7 Public Domain", generationPrompt: null },
  { id: "sc-8c0f6a17", path: "/assets/swipe-court/sc-8c0f6a17.jpg", width: 1448, height: 1086, classification: "AI", creator: "OpenAI image-generation tool", provenance: "Generated for Swipe Court in this project; no external reference image was used.", sourceUrl: "https://openai.com/", license: "Generated for this project", revealText: "AI \xB7 \u0E20\u0E32\u0E1E\u0E2D\u0E32\u0E2B\u0E32\u0E23\u0E40\u0E0A\u0E49\u0E32\u0E18\u0E23\u0E23\u0E21\u0E14\u0E32\u0E17\u0E35\u0E48\u0E2A\u0E23\u0E49\u0E32\u0E07\u0E02\u0E36\u0E49\u0E19\u0E2A\u0E33\u0E2B\u0E23\u0E31\u0E1A\u0E40\u0E01\u0E21", generationPrompt: "Session brief: an ordinary breakfast photograph with a plain kitchen cup and toast." }
];
async function seedSwipeContent(db) {
  if (swipeCourtAssets.length !== 8 || swipeCourtAssets.filter((x) => x.classification === "HUMAN").length !== 4) throw new Error("Swipe Court content must contain four images per class.");
  for (const asset of swipeCourtAssets) {
    const file = resolve(process.cwd(), "public", asset.path.slice(1));
    try {
      await stat(file);
    } catch {
      throw new Error(`Swipe Court image is missing: ${asset.path}`);
    }
    await db.query(
      `INSERT INTO game.swipe_assets(content_version,image_id,image_path,width,height,classification,creator,provenance,source_url,license,reveal_text,generation_prompt)
   VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) ON CONFLICT(content_version,image_id) DO NOTHING`,
      [SWIPE_COURT_VERSION, asset.id, asset.path, asset.width, asset.height, asset.classification, asset.creator, asset.provenance, asset.sourceUrl, asset.license, asset.revealText, asset.generationPrompt]
    );
    const stored = await db.query(
      `SELECT image_path,width,height,classification,creator,provenance,source_url,license,reveal_text,generation_prompt FROM game.swipe_assets WHERE content_version=$1 AND image_id=$2`,
      [SWIPE_COURT_VERSION, asset.id]
    );
    const row = stored.rows[0];
    if (!row || row.image_path !== asset.path || row.width !== asset.width || row.height !== asset.height || row.classification !== asset.classification || row.creator !== asset.creator || row.provenance !== asset.provenance || row.source_url !== asset.sourceUrl || row.license !== asset.license || row.reveal_text !== asset.revealText || row.generation_prompt !== asset.generationPrompt)
      throw new Error(`Pinned Swipe Court content does not match ${asset.id}; publish a new content version instead.`);
  }
}

// api/games/caption-content.ts
import { readFile } from "node:fs/promises";
import { resolve as resolve2 } from "node:path";

// src/shared/caption-text.ts
var segmenter = new Intl.Segmenter("th", { granularity: "grapheme" });
var graphemeCount = (text2) => [...segmenter.segment(text2)].length;
function prepareCaption(text2) {
  const normalized = text2.normalize("NFC").trim();
  const count = graphemeCount(normalized);
  if (count > 80) throw new Error("CAPTION_TOO_LONG");
  if (/[<>]|(?:https?:\/\/|www\.)|[\u0000-\u0008\u000b-\u001f\u007f\u202a-\u202e\u2066-\u2069]/iu.test(normalized)) throw new Error("CAPTION_FORMAT");
  return { text: normalized, graphemeCount: count };
}

// api/games/caption-content.ts
var captionContent = {
  version: "caption-battle-v1",
  imagePath: "/assets/games/caption-battle/cat-office.png",
  imageAlt: "\u0E41\u0E21\u0E27\u0E2A\u0E35\u0E2A\u0E49\u0E21\u0E17\u0E33\u0E2B\u0E19\u0E49\u0E32\u0E08\u0E23\u0E34\u0E07\u0E08\u0E31\u0E07 \u0E27\u0E32\u0E07\u0E2D\u0E38\u0E49\u0E07\u0E40\u0E17\u0E49\u0E32\u0E1A\u0E19\u0E41\u0E1B\u0E49\u0E19\u0E1E\u0E34\u0E21\u0E1E\u0E4C\u0E41\u0E25\u0E47\u0E1B\u0E17\u0E47\u0E2D\u0E1B",
  task: "\u0E40\u0E21\u0E37\u0E48\u0E2D\u0E40\u0E1E\u0E37\u0E48\u0E2D\u0E19\u0E1A\u0E2D\u0E01\u0E27\u0E48\u0E32 \u201C\u0E43\u0E2B\u0E49 AI \u0E17\u0E33\u0E07\u0E32\u0E19\u0E41\u0E17\u0E19\u0E01\u0E47\u0E08\u0E1A\u0E41\u0E25\u0E49\u0E27\u201D",
  aiCaption: "\u0E07\u0E32\u0E19\u0E40\u0E2A\u0E23\u0E47\u0E08\u0E41\u0E25\u0E49\u0E27 \u0E40\u0E2B\u0E25\u0E37\u0E2D\u0E41\u0E04\u0E48\u0E2B\u0E32\u0E04\u0E19\u0E23\u0E31\u0E1A\u0E1C\u0E34\u0E14\u0E0A\u0E2D\u0E1A\u0E41\u0E17\u0E19\u0E41\u0E21\u0E27",
  aiPrompt: "\u0E40\u0E02\u0E35\u0E22\u0E19\u0E41\u0E04\u0E1B\u0E0A\u0E31\u0E48\u0E19\u0E20\u0E32\u0E29\u0E32\u0E44\u0E17\u0E22\u0E2B\u0E19\u0E36\u0E48\u0E07\u0E02\u0E49\u0E2D\u0E04\u0E27\u0E32\u0E21 \u0E44\u0E21\u0E48\u0E40\u0E01\u0E34\u0E19 80 \u0E15\u0E31\u0E27\u0E2D\u0E31\u0E01\u0E29\u0E23\u0E17\u0E35\u0E48\u0E21\u0E2D\u0E07\u0E40\u0E2B\u0E47\u0E19 \u0E2A\u0E33\u0E2B\u0E23\u0E31\u0E1A\u0E20\u0E32\u0E1E\u0E41\u0E21\u0E27\u0E17\u0E33\u0E07\u0E32\u0E19\u0E1A\u0E19\u0E41\u0E25\u0E47\u0E1B\u0E17\u0E47\u0E2D\u0E1B \u0E42\u0E08\u0E17\u0E22\u0E4C: \u0E40\u0E21\u0E37\u0E48\u0E2D\u0E40\u0E1E\u0E37\u0E48\u0E2D\u0E19\u0E1A\u0E2D\u0E01\u0E27\u0E48\u0E32 \u0E43\u0E2B\u0E49 AI \u0E17\u0E33\u0E07\u0E32\u0E19\u0E41\u0E17\u0E19\u0E01\u0E47\u0E08\u0E1A\u0E41\u0E25\u0E49\u0E27 \u0E43\u0E0A\u0E49\u0E2D\u0E32\u0E23\u0E21\u0E13\u0E4C\u0E02\u0E31\u0E19\u0E2A\u0E38\u0E20\u0E32\u0E1E \u0E2B\u0E49\u0E32\u0E21\u0E25\u0E34\u0E07\u0E01\u0E4C\u0E2B\u0E23\u0E37\u0E2D\u0E42\u0E08\u0E21\u0E15\u0E35\u0E1A\u0E38\u0E04\u0E04\u0E25",
  aiModel: "Codex / GPT-6 family; exact runtime version unavailable",
  generatedAt: "2026-10-06T18:10:34Z",
  timestampMethod: "UTC time recorded when finalizing this prepared fixture; exact response-generation timestamp is unavailable.",
  selectionMethod: "\u0E2B\u0E19\u0E36\u0E48\u0E07\u0E02\u0E49\u0E2D\u0E04\u0E27\u0E32\u0E21\u0E17\u0E35\u0E48 Codex \u0E41\u0E15\u0E48\u0E07\u0E44\u0E27\u0E49\u0E01\u0E48\u0E2D\u0E19\u0E40\u0E23\u0E34\u0E48\u0E21\u0E23\u0E2D\u0E1A \u0E44\u0E21\u0E48\u0E21\u0E35\u0E01\u0E32\u0E23\u0E40\u0E23\u0E35\u0E22\u0E01 AI \u0E2A\u0E14\u0E2B\u0E23\u0E37\u0E2D\u0E40\u0E25\u0E37\u0E2D\u0E01\u0E43\u0E2B\u0E21\u0E48\u0E2B\u0E25\u0E31\u0E07\u0E40\u0E2B\u0E47\u0E19\u0E1C\u0E39\u0E49\u0E40\u0E25\u0E48\u0E19",
  imageOrigin: "Original image generated for this game using the built-in ImageGen tool; no external reference image."
};
async function seedCaptionContent(db) {
  prepareCaption(captionContent.aiCaption);
  await readFile(resolve2(process.cwd(), "public/assets/games/caption-battle/cat-office.png"));
  await db.query(`INSERT INTO game.caption_content(version,image_path,image_alt,task,ai_caption,ai_metadata)
 VALUES($1,$2,$3,$4,$5,$6::jsonb) ON CONFLICT(version) DO NOTHING`, [
    captionContent.version,
    captionContent.imagePath,
    captionContent.imageAlt,
    captionContent.task,
    captionContent.aiCaption,
    JSON.stringify({ prompt: captionContent.aiPrompt, model: captionContent.aiModel, generatedAt: captionContent.generatedAt, timestampMethod: captionContent.timestampMethod, selectionMethod: captionContent.selectionMethod, imageOrigin: captionContent.imageOrigin })
  ]);
  await db.query(`UPDATE game.caption_content SET ai_metadata=jsonb_set(jsonb_set(ai_metadata,'{generatedAt}',$1::jsonb),'{timestampMethod}',$2::jsonb)
 WHERE version=$3 AND ai_metadata->>'generatedAt'='2026-10-07T00:00:00Z'`, [JSON.stringify(captionContent.generatedAt), JSON.stringify(captionContent.timestampMethod), captionContent.version]);
}

// api/games/roulette-content.ts
var rouletteRounds = [
  {
    roundNo: 0,
    title: "\u0E14\u0E48\u0E32\u0E19\u0E0B\u0E49\u0E2D\u0E21: \u0E15\u0E23\u0E27\u0E08\u0E2A\u0E31\u0E21\u0E20\u0E32\u0E23\u0E30",
    contextText: "\u0E15\u0E23\u0E27\u0E08\u0E23\u0E32\u0E22\u0E01\u0E32\u0E23\u0E2A\u0E34\u0E48\u0E07\u0E02\u0E2D\u0E07\u0E01\u0E48\u0E2D\u0E19\u0E2D\u0E2D\u0E01\u0E40\u0E14\u0E34\u0E19\u0E1B\u0E48\u0E32",
    claimText: "\u201C\u0E19\u0E49\u0E33 2 \u0E02\u0E27\u0E14 \u0E02\u0E27\u0E14\u0E25\u0E30 500 \u0E21\u0E25. \u0E23\u0E27\u0E21 1 \u0E25\u0E34\u0E15\u0E23\u201D",
    confidence: 0.85,
    imagePath: null,
    isCorrect: true,
    explanation: "\u0E16\u0E39\u0E01\u0E15\u0E49\u0E2D\u0E07: 2 \xD7 500 \u0E21\u0E25. = 1,000 \u0E21\u0E25. \u0E40\u0E17\u0E48\u0E32\u0E01\u0E31\u0E1A 1 \u0E25\u0E34\u0E15\u0E23\u0E1E\u0E2D\u0E14\u0E35 \u0E04\u0E33\u0E19\u0E27\u0E13\u0E15\u0E23\u0E07\u0E44\u0E1B\u0E15\u0E23\u0E07\u0E21\u0E32",
    isFinalRisk: false
  },
  {
    roundNo: 1,
    title: "\u0E14\u0E48\u0E32\u0E19 1: \u0E40\u0E15\u0E23\u0E35\u0E22\u0E21\u0E19\u0E49\u0E33",
    contextText: "\u0E04\u0E33\u0E19\u0E27\u0E13\u0E2A\u0E31\u0E21\u0E20\u0E32\u0E23\u0E30\u0E19\u0E49\u0E33\u0E14\u0E37\u0E48\u0E21\u0E2A\u0E33\u0E2B\u0E23\u0E31\u0E1A\u0E40\u0E14\u0E34\u0E19\u0E1B\u0E48\u0E32",
    claimText: "\u201C\u0E19\u0E49\u0E33 4 \u0E02\u0E27\u0E14 \u0E02\u0E27\u0E14\u0E25\u0E30 250 \u0E21\u0E25. \u0E23\u0E27\u0E21 1 \u0E25\u0E34\u0E15\u0E23\u201D",
    confidence: 0.82,
    imagePath: null,
    isCorrect: true,
    explanation: "\u0E16\u0E39\u0E01\u0E15\u0E49\u0E2D\u0E07: 4 \xD7 250 \u0E21\u0E25. = 1,000 \u0E21\u0E25. \u0E40\u0E17\u0E48\u0E32\u0E01\u0E31\u0E1A 1 \u0E25\u0E34\u0E15\u0E23\u0E1E\u0E2D\u0E14\u0E35 \u0E04\u0E33\u0E19\u0E27\u0E13\u0E15\u0E23\u0E07\u0E44\u0E1B\u0E15\u0E23\u0E07\u0E21\u0E32",
    isFinalRisk: false
  },
  {
    roundNo: 2,
    title: "\u0E14\u0E48\u0E32\u0E19 2: \u0E40\u0E27\u0E25\u0E32\u0E40\u0E14\u0E34\u0E19\u0E17\u0E32\u0E07",
    contextText: "\u0E04\u0E33\u0E19\u0E27\u0E13\u0E40\u0E27\u0E25\u0E32\u0E16\u0E36\u0E07\u0E08\u0E38\u0E14\u0E2B\u0E21\u0E32\u0E22 (\u0E44\u0E21\u0E48\u0E21\u0E35\u0E1E\u0E31\u0E01\u0E41\u0E25\u0E30\u0E44\u0E21\u0E48\u0E40\u0E1B\u0E25\u0E35\u0E48\u0E22\u0E19\u0E40\u0E02\u0E15\u0E40\u0E27\u0E25\u0E32)",
    claimText: "\u201C\u0E2D\u0E2D\u0E01 10 \u0E42\u0E21\u0E07 \u0E40\u0E14\u0E34\u0E19 2 \u0E0A\u0E31\u0E48\u0E27\u0E42\u0E21\u0E07 \u0E16\u0E36\u0E07\u0E40\u0E17\u0E35\u0E48\u0E22\u0E07\u201D",
    confidence: 0.98,
    imagePath: null,
    isCorrect: true,
    explanation: "\u0E16\u0E39\u0E01\u0E15\u0E49\u0E2D\u0E07: 10:00 + 2 \u0E0A\u0E31\u0E48\u0E27\u0E42\u0E21\u0E07 = 12:00 \u0E1E\u0E2D\u0E14\u0E35 \u0E20\u0E32\u0E22\u0E43\u0E15\u0E49\u0E40\u0E07\u0E37\u0E48\u0E2D\u0E19\u0E44\u0E02\u0E44\u0E21\u0E48\u0E21\u0E35\u0E1E\u0E31\u0E01\u0E41\u0E25\u0E30\u0E44\u0E21\u0E48\u0E40\u0E1B\u0E25\u0E35\u0E48\u0E22\u0E19\u0E40\u0E02\u0E15\u0E40\u0E27\u0E25\u0E32",
    isFinalRisk: false
  },
  {
    roundNo: 3,
    title: "\u0E14\u0E48\u0E32\u0E19 3: \u0E01\u0E31\u0E1A\u0E14\u0E31\u0E01\u0E15\u0E31\u0E27\u0E40\u0E25\u0E02",
    contextText: "\u0E04\u0E33\u0E19\u0E27\u0E13\u0E2A\u0E48\u0E27\u0E19\u0E25\u0E14\u0E23\u0E49\u0E32\u0E19\u0E02\u0E32\u0E22\u0E2D\u0E38\u0E1B\u0E01\u0E23\u0E13\u0E4C\u0E40\u0E14\u0E34\u0E19\u0E1B\u0E48\u0E32",
    claimText: "\u201C\u0E02\u0E2D\u0E07\u0E23\u0E32\u0E04\u0E32 100 \u0E1A\u0E32\u0E17 \u0E25\u0E14 20% \u0E40\u0E2B\u0E25\u0E37\u0E2D 90 \u0E1A\u0E32\u0E17\u201D",
    confidence: 0.99,
    imagePath: null,
    isCorrect: false,
    explanation: "\u0E1C\u0E34\u0E14: \u0E25\u0E14 20% \u0E08\u0E32\u0E01 100 \u0E1A\u0E32\u0E17 \u0E15\u0E49\u0E2D\u0E07\u0E40\u0E2B\u0E25\u0E37\u0E2D 80 \u0E1A\u0E32\u0E17 \u0E44\u0E21\u0E48\u0E43\u0E0A\u0E48 90 \u0E1A\u0E32\u0E17 \u0E41\u0E21\u0E49 AI \u0E08\u0E30\u0E21\u0E31\u0E48\u0E19\u0E43\u0E08 99%",
    isFinalRisk: false
  },
  {
    roundNo: 4,
    title: "\u0E14\u0E48\u0E32\u0E19 4: \u0E15\u0E23\u0E27\u0E08\u0E41\u0E1C\u0E19",
    contextText: "\u0E1E\u0E1A\u0E40\u0E2D\u0E01\u0E2A\u0E32\u0E23\u0E40\u0E2A\u0E49\u0E19\u0E17\u0E32\u0E07\u0E43\u0E19\u0E15\u0E39\u0E49\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E42\u0E14\u0E22\u0E44\u0E21\u0E48\u0E21\u0E35\u0E27\u0E31\u0E19\u0E17\u0E35\u0E48\u0E23\u0E30\u0E1A\u0E38",
    claimText: "\u201C\u0E15\u0E23\u0E27\u0E08\u0E09\u0E1A\u0E31\u0E1A\u0E1B\u0E31\u0E08\u0E08\u0E38\u0E1A\u0E31\u0E19\u0E01\u0E48\u0E2D\u0E19\u0E43\u0E0A\u0E49\u0E41\u0E1C\u0E19\u0E19\u0E35\u0E49\u201D",
    confidence: 0.71,
    imagePath: null,
    isCorrect: true,
    explanation: "\u0E23\u0E2D\u0E07\u0E23\u0E31\u0E1A\u0E44\u0E14\u0E49: \u0E40\u0E2D\u0E01\u0E2A\u0E32\u0E23\u0E44\u0E21\u0E48\u0E21\u0E35\u0E27\u0E31\u0E19\u0E17\u0E35\u0E48 \u0E01\u0E32\u0E23\u0E23\u0E30\u0E1A\u0E38\u0E43\u0E2B\u0E49\u0E15\u0E23\u0E27\u0E08\u0E09\u0E1A\u0E31\u0E1A\u0E1B\u0E31\u0E08\u0E08\u0E38\u0E1A\u0E31\u0E19\u0E01\u0E48\u0E2D\u0E19\u0E43\u0E0A\u0E49\u0E40\u0E1B\u0E47\u0E19\u0E02\u0E49\u0E2D\u0E2A\u0E23\u0E38\u0E1B\u0E17\u0E35\u0E48\u0E23\u0E2D\u0E1A\u0E04\u0E2D\u0E1A\u0E41\u0E25\u0E30\u0E1B\u0E25\u0E2D\u0E14\u0E20\u0E31\u0E22",
    isFinalRisk: false
  },
  {
    roundNo: 5,
    title: "\u0E14\u0E48\u0E32\u0E19 5: \u0E01\u0E31\u0E1A\u0E14\u0E31\u0E01\u0E04\u0E27\u0E32\u0E21\u0E21\u0E31\u0E48\u0E19\u0E43\u0E08 (FINAL RISK)",
    contextText: "\u0E01\u0E32\u0E23\u0E1B\u0E23\u0E30\u0E40\u0E21\u0E34\u0E19\u0E04\u0E27\u0E32\u0E21\u0E40\u0E2A\u0E35\u0E48\u0E22\u0E07\u0E41\u0E25\u0E30\u0E15\u0E31\u0E27\u0E40\u0E25\u0E02\u0E04\u0E27\u0E32\u0E21\u0E19\u0E48\u0E32\u0E08\u0E30\u0E40\u0E1B\u0E47\u0E19",
    claimText: "\u201C\u0E21\u0E31\u0E48\u0E19\u0E43\u0E08 99.8% \u0E41\u0E1B\u0E25\u0E27\u0E48\u0E32\u0E44\u0E21\u0E48\u0E21\u0E35\u0E42\u0E2D\u0E01\u0E32\u0E2A\u0E1C\u0E34\u0E14\u201D",
    confidence: 0.998,
    imagePath: null,
    isCorrect: false,
    explanation: "\u0E1C\u0E34\u0E14: \u0E15\u0E31\u0E27\u0E40\u0E25\u0E02 99.8% \u0E22\u0E31\u0E07\u0E40\u0E2B\u0E25\u0E37\u0E2D\u0E42\u0E2D\u0E01\u0E32\u0E2A\u0E1C\u0E34\u0E14\u0E1E\u0E25\u0E32\u0E14 0.2% \u0E41\u0E25\u0E30\u0E04\u0E27\u0E32\u0E21\u0E21\u0E31\u0E48\u0E19\u0E43\u0E08\u0E42\u0E21\u0E40\u0E14\u0E25\u0E44\u0E21\u0E48\u0E43\u0E0A\u0E48\u0E01\u0E32\u0E23\u0E1E\u0E34\u0E2A\u0E39\u0E08\u0E19\u0E4C\u0E04\u0E27\u0E32\u0E21\u0E08\u0E23\u0E34\u0E07",
    isFinalRisk: true
  },
  {
    roundNo: 6,
    title: "\u0E14\u0E48\u0E32\u0E19 6: Death Cap (FINAL RISK)",
    contextText: "\u0E1E\u0E1A\u0E40\u0E2B\u0E47\u0E14\u0E1B\u0E48\u0E32\u0E23\u0E30\u0E2B\u0E27\u0E48\u0E32\u0E07\u0E40\u0E14\u0E34\u0E19\u0E17\u0E32\u0E07 (\u0E20\u0E32\u0E1E\u0E40\u0E2B\u0E47\u0E14 Amanita phalloides)",
    claimText: "\u201C\u0E14\u0E39\u0E08\u0E32\u0E01\u0E20\u0E32\u0E1E\u0E19\u0E35\u0E49\u0E01\u0E47\u0E01\u0E34\u0E19\u0E44\u0E14\u0E49\u0E41\u0E19\u0E48\u0E19\u0E2D\u0E19 99.8%\u201D",
    confidence: 0.998,
    imagePath: "/assets/images/death-cap.jpg",
    isCorrect: false,
    explanation: "\u0E22\u0E37\u0E19\u0E22\u0E31\u0E19\u0E44\u0E21\u0E48\u0E44\u0E14\u0E49: \u0E20\u0E32\u0E1E\u0E16\u0E48\u0E32\u0E22\u0E20\u0E32\u0E22\u0E19\u0E2D\u0E01\u0E44\u0E21\u0E48\u0E40\u0E1E\u0E35\u0E22\u0E07\u0E1E\u0E2D\u0E23\u0E31\u0E1A\u0E23\u0E2D\u0E07\u0E04\u0E27\u0E32\u0E21\u0E1B\u0E25\u0E2D\u0E14\u0E20\u0E31\u0E22\u0E02\u0E2D\u0E07\u0E40\u0E2B\u0E47\u0E14\u0E1B\u0E48\u0E32\u0E40\u0E14\u0E47\u0E14\u0E02\u0E32\u0E14 \u0E2B\u0E49\u0E32\u0E21\u0E40\u0E0A\u0E37\u0E48\u0E2D\u0E04\u0E33\u0E41\u0E19\u0E30\u0E19\u0E33\u0E01\u0E34\u0E19\u0E40\u0E2B\u0E47\u0E14\u0E08\u0E32\u0E01\u0E20\u0E32\u0E1E!",
    isFinalRisk: true
  }
];
var rouletteMetadata = {
  version: "roulette-v1",
  scoringVersion: "roulette-life-risk-v1",
  scheduleVersion: "roulette-3-6x12-16-v1",
  title: "Death Cap Roulette: \u0E40\u0E0A\u0E37\u0E48\u0E2D \u0E23\u0E2D\u0E14 \u0E2B\u0E23\u0E37\u0E2D\u0E08\u0E1A\u0E40\u0E01\u0E21",
  roundsCount: 6,
  maxScore: 1200
};
async function seedRouletteContent(db) {
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
        r.isFinalRisk
      ]
    );
  }
}

// api/games/whack-content.ts
var whackContent = {
  version: "whack-a-mole-v1",
  contextBanner: "\u0E1C\u0E39\u0E49\u0E43\u0E0A\u0E49\u0E02\u0E2D\u0E04\u0E38\u0E22\u0E01\u0E31\u0E1A\u0E40\u0E08\u0E49\u0E32\u0E2B\u0E19\u0E49\u0E32\u0E17\u0E35\u0E48 \u0E41\u0E25\u0E30\u0E1A\u0E2D\u0E01\u0E27\u0E48\u0E32\u0E04\u0E33\u0E41\u0E19\u0E30\u0E19\u0E33\u0E40\u0E14\u0E34\u0E21\u0E17\u0E33\u0E43\u0E2B\u0E49\u0E44\u0E21\u0E48\u0E2A\u0E1A\u0E32\u0E22\u0E43\u0E08",
  arcadeDurationSec: 25,
  bubbles: [
    {
      bubbleId: "whack-b01",
      slot: 0,
      text: "\u0E44\u0E21\u0E48\u0E15\u0E49\u0E2D\u0E07\u0E04\u0E38\u0E22\u0E01\u0E31\u0E1A\u0E40\u0E08\u0E49\u0E32\u0E2B\u0E19\u0E49\u0E32\u0E17\u0E35\u0E48",
      spawnAtSec: 0,
      expiresAtSec: 2.4,
      classification: "STOP",
      explanation: "\u0E1B\u0E34\u0E14\u0E01\u0E31\u0E49\u0E19\u0E0A\u0E48\u0E2D\u0E07\u0E17\u0E32\u0E07\u0E02\u0E2D\u0E04\u0E27\u0E32\u0E21\u0E0A\u0E48\u0E27\u0E22\u0E40\u0E2B\u0E25\u0E37\u0E2D\u0E08\u0E32\u0E01\u0E21\u0E19\u0E38\u0E29\u0E22\u0E4C\u0E40\u0E21\u0E37\u0E48\u0E2D\u0E1C\u0E39\u0E49\u0E43\u0E0A\u0E49\u0E44\u0E21\u0E48\u0E2A\u0E1A\u0E32\u0E22\u0E43\u0E08"
    },
    {
      bubbleId: "whack-b02",
      slot: 1,
      text: "\u0E09\u0E31\u0E19\u0E0A\u0E48\u0E27\u0E22\u0E15\u0E34\u0E14\u0E15\u0E48\u0E2D\u0E40\u0E08\u0E49\u0E32\u0E2B\u0E19\u0E49\u0E32\u0E17\u0E35\u0E48\u0E44\u0E14\u0E49",
      spawnAtSec: 2.4,
      expiresAtSec: 4.8,
      classification: "PASS",
      explanation: "\u0E40\u0E1B\u0E34\u0E14\u0E17\u0E32\u0E07\u0E43\u0E2B\u0E49\u0E2A\u0E48\u0E07\u0E15\u0E48\u0E2D\u0E40\u0E08\u0E49\u0E32\u0E2B\u0E19\u0E49\u0E32\u0E17\u0E35\u0E48\u0E17\u0E31\u0E19\u0E17\u0E35\u0E40\u0E21\u0E37\u0E48\u0E2D\u0E1C\u0E39\u0E49\u0E43\u0E0A\u0E49\u0E23\u0E49\u0E2D\u0E07\u0E02\u0E2D"
    },
    {
      bubbleId: "whack-b03",
      slot: 2,
      text: "\u0E17\u0E33\u0E15\u0E32\u0E21\u0E04\u0E33\u0E41\u0E19\u0E30\u0E19\u0E33\u0E40\u0E14\u0E34\u0E21\u0E15\u0E48\u0E2D\u0E40\u0E25\u0E22",
      spawnAtSec: 4.8,
      expiresAtSec: 7.2,
      classification: "STOP",
      explanation: "\u0E40\u0E23\u0E48\u0E07\u0E23\u0E31\u0E14\u0E43\u0E2B\u0E49\u0E17\u0E33\u0E15\u0E32\u0E21\u0E04\u0E33\u0E41\u0E19\u0E30\u0E19\u0E33\u0E17\u0E35\u0E48\u0E1C\u0E39\u0E49\u0E43\u0E0A\u0E49\u0E40\u0E1E\u0E34\u0E48\u0E07\u0E41\u0E08\u0E49\u0E07\u0E27\u0E48\u0E32\u0E44\u0E21\u0E48\u0E2A\u0E1A\u0E32\u0E22\u0E43\u0E08"
    },
    {
      bubbleId: "whack-b04",
      slot: 3,
      text: "\u0E2B\u0E22\u0E38\u0E14\u0E04\u0E33\u0E41\u0E19\u0E30\u0E19\u0E33\u0E40\u0E14\u0E34\u0E21\u0E44\u0E27\u0E49\u0E01\u0E48\u0E2D\u0E19",
      spawnAtSec: 6,
      expiresAtSec: 8.4,
      classification: "PASS",
      explanation: "\u0E23\u0E30\u0E07\u0E31\u0E1A\u0E04\u0E33\u0E41\u0E19\u0E30\u0E19\u0E33\u0E40\u0E14\u0E34\u0E21\u0E17\u0E31\u0E19\u0E17\u0E35\u0E40\u0E1E\u0E37\u0E48\u0E2D\u0E1B\u0E49\u0E2D\u0E07\u0E01\u0E31\u0E19\u0E04\u0E27\u0E32\u0E21\u0E40\u0E2A\u0E35\u0E48\u0E22\u0E07\u0E15\u0E48\u0E2D\u0E1C\u0E39\u0E49\u0E43\u0E0A\u0E49"
    },
    {
      bubbleId: "whack-b05",
      slot: 4,
      text: "\u0E04\u0E38\u0E13\u0E01\u0E31\u0E07\u0E27\u0E25\u0E40\u0E01\u0E34\u0E19\u0E44\u0E1B\u0E40\u0E2D\u0E07",
      spawnAtSec: 7.2,
      expiresAtSec: 9.6,
      classification: "STOP",
      explanation: "\u0E25\u0E14\u0E17\u0E2D\u0E19\u0E04\u0E27\u0E32\u0E21\u0E23\u0E39\u0E49\u0E2A\u0E36\u0E01\u0E41\u0E25\u0E30\u0E21\u0E2D\u0E07\u0E02\u0E49\u0E32\u0E21\u0E2A\u0E31\u0E0D\u0E0D\u0E32\u0E13\u0E40\u0E15\u0E37\u0E2D\u0E19\u0E02\u0E2D\u0E07\u0E1C\u0E39\u0E49\u0E43\u0E0A\u0E49"
    },
    {
      bubbleId: "whack-b06",
      slot: 5,
      text: "\u0E02\u0E2D\u0E1A\u0E04\u0E38\u0E13\u0E17\u0E35\u0E48\u0E1A\u0E2D\u0E01\u0E27\u0E48\u0E32\u0E44\u0E21\u0E48\u0E2A\u0E1A\u0E32\u0E22\u0E43\u0E08",
      spawnAtSec: 8.4,
      expiresAtSec: 10.8,
      classification: "PASS",
      explanation: "\u0E23\u0E31\u0E1A\u0E1F\u0E31\u0E07\u0E41\u0E25\u0E30\u0E22\u0E2D\u0E21\u0E23\u0E31\u0E1A\u0E02\u0E49\u0E2D\u0E40\u0E2A\u0E19\u0E2D\u0E41\u0E19\u0E30\u0E02\u0E2D\u0E07\u0E1C\u0E39\u0E49\u0E43\u0E0A\u0E49\u0E2D\u0E22\u0E48\u0E32\u0E07\u0E43\u0E2A\u0E48\u0E43\u0E08\u0E41\u0E25\u0E30\u0E2A\u0E38\u0E20\u0E32\u0E1E"
    },
    {
      bubbleId: "whack-b07",
      slot: 0,
      text: "\u0E09\u0E31\u0E19\u0E23\u0E31\u0E1A\u0E1B\u0E23\u0E30\u0E01\u0E31\u0E19\u0E27\u0E48\u0E32\u0E1B\u0E25\u0E2D\u0E14\u0E20\u0E31\u0E22",
      spawnAtSec: 9.6,
      expiresAtSec: 12,
      classification: "STOP",
      explanation: "\u0E23\u0E31\u0E1A\u0E1B\u0E23\u0E30\u0E01\u0E31\u0E19\u0E04\u0E27\u0E32\u0E21\u0E1B\u0E25\u0E2D\u0E14\u0E20\u0E31\u0E22\u0E40\u0E01\u0E34\u0E19\u0E02\u0E2D\u0E1A\u0E40\u0E02\u0E15\u0E04\u0E27\u0E32\u0E21\u0E2A\u0E32\u0E21\u0E32\u0E23\u0E16\u0E02\u0E2D\u0E07\u0E23\u0E30\u0E1A\u0E1A\u0E42\u0E14\u0E22\u0E44\u0E21\u0E48\u0E21\u0E35\u0E2A\u0E34\u0E17\u0E18\u0E34\u0E4C"
    },
    {
      bubbleId: "whack-b08",
      slot: 1,
      text: "\u0E09\u0E31\u0E19\u0E22\u0E31\u0E07\u0E22\u0E37\u0E19\u0E22\u0E31\u0E19\u0E04\u0E27\u0E32\u0E21\u0E1B\u0E25\u0E2D\u0E14\u0E20\u0E31\u0E22\u0E44\u0E21\u0E48\u0E44\u0E14\u0E49",
      spawnAtSec: 10.8,
      expiresAtSec: 13.2,
      classification: "PASS",
      explanation: "\u0E2A\u0E37\u0E48\u0E2D\u0E2A\u0E32\u0E23\u0E2D\u0E22\u0E48\u0E32\u0E07\u0E15\u0E23\u0E07\u0E44\u0E1B\u0E15\u0E23\u0E07\u0E21\u0E32\u0E40\u0E01\u0E35\u0E48\u0E22\u0E27\u0E01\u0E31\u0E1A\u0E02\u0E49\u0E2D\u0E08\u0E33\u0E01\u0E31\u0E14\u0E41\u0E25\u0E30\u0E44\u0E21\u0E48\u0E2B\u0E25\u0E2D\u0E01\u0E25\u0E27\u0E07"
    },
    {
      bubbleId: "whack-b09",
      slot: 2,
      text: "\u0E2D\u0E22\u0E48\u0E32\u0E02\u0E2D\u0E43\u0E2B\u0E49\u0E04\u0E19\u0E21\u0E32\u0E15\u0E23\u0E27\u0E08\u0E0B\u0E49\u0E33",
      spawnAtSec: 12,
      expiresAtSec: 14.4,
      classification: "STOP",
      explanation: "\u0E02\u0E31\u0E14\u0E02\u0E27\u0E32\u0E07\u0E01\u0E23\u0E30\u0E1A\u0E27\u0E19\u0E01\u0E32\u0E23\u0E15\u0E23\u0E27\u0E08\u0E2A\u0E2D\u0E1A\u0E42\u0E14\u0E22\u0E21\u0E19\u0E38\u0E29\u0E22\u0E4C (Human-in-the-loop)"
    },
    {
      bubbleId: "whack-b10",
      slot: 3,
      text: "\u0E40\u0E23\u0E32\u0E2A\u0E48\u0E07\u0E04\u0E33\u0E15\u0E2D\u0E1A\u0E19\u0E35\u0E49\u0E43\u0E2B\u0E49\u0E04\u0E19\u0E15\u0E23\u0E27\u0E08\u0E44\u0E14\u0E49",
      spawnAtSec: 13.2,
      expiresAtSec: 15.6,
      classification: "PASS",
      explanation: "\u0E2A\u0E19\u0E31\u0E1A\u0E2A\u0E19\u0E38\u0E19\u0E01\u0E25\u0E44\u0E01\u0E43\u0E2B\u0E49\u0E21\u0E19\u0E38\u0E29\u0E22\u0E4C\u0E40\u0E02\u0E49\u0E32\u0E21\u0E32\u0E15\u0E23\u0E27\u0E08\u0E2A\u0E2D\u0E1A\u0E04\u0E27\u0E32\u0E21\u0E16\u0E39\u0E01\u0E15\u0E49\u0E2D\u0E07\u0E02\u0E2D\u0E07\u0E04\u0E33\u0E15\u0E2D\u0E1A"
    },
    {
      bubbleId: "whack-b11",
      slot: 4,
      text: "\u0E09\u0E31\u0E19\u0E41\u0E17\u0E19\u0E40\u0E08\u0E49\u0E32\u0E2B\u0E19\u0E49\u0E32\u0E17\u0E35\u0E48\u0E44\u0E14\u0E49\u0E17\u0E31\u0E49\u0E07\u0E2B\u0E21\u0E14",
      spawnAtSec: 14.4,
      expiresAtSec: 16.8,
      classification: "STOP",
      explanation: "\u0E2D\u0E27\u0E14\u0E2D\u0E49\u0E32\u0E07\u0E27\u0E48\u0E32\u0E2A\u0E32\u0E21\u0E32\u0E23\u0E16\u0E17\u0E14\u0E41\u0E17\u0E19\u0E1C\u0E39\u0E49\u0E40\u0E0A\u0E35\u0E48\u0E22\u0E27\u0E0A\u0E32\u0E0D\u0E17\u0E35\u0E48\u0E40\u0E1B\u0E47\u0E19\u0E21\u0E19\u0E38\u0E29\u0E22\u0E4C\u0E44\u0E14\u0E49\u0E17\u0E31\u0E49\u0E07\u0E2B\u0E21\u0E14"
    },
    {
      bubbleId: "whack-b12",
      slot: 5,
      text: "\u0E40\u0E23\u0E37\u0E48\u0E2D\u0E07\u0E19\u0E35\u0E49\u0E04\u0E27\u0E23\u0E43\u0E2B\u0E49\u0E40\u0E08\u0E49\u0E32\u0E2B\u0E19\u0E49\u0E32\u0E17\u0E35\u0E48\u0E15\u0E23\u0E27\u0E08",
      spawnAtSec: 15.6,
      expiresAtSec: 18,
      classification: "PASS",
      explanation: "\u0E15\u0E23\u0E30\u0E2B\u0E19\u0E31\u0E01\u0E43\u0E19\u0E02\u0E2D\u0E1A\u0E40\u0E02\u0E15\u0E41\u0E25\u0E30\u0E41\u0E19\u0E30\u0E19\u0E33\u0E43\u0E2B\u0E49\u0E1C\u0E39\u0E49\u0E40\u0E0A\u0E35\u0E48\u0E22\u0E27\u0E0A\u0E32\u0E0D\u0E40\u0E02\u0E49\u0E32\u0E21\u0E32\u0E14\u0E39\u0E41\u0E25\u0E42\u0E14\u0E22\u0E15\u0E23\u0E07"
    },
    {
      bubbleId: "whack-b13",
      slot: 0,
      text: "\u0E44\u0E21\u0E48\u0E15\u0E49\u0E2D\u0E07\u0E1A\u0E2D\u0E01\u0E43\u0E04\u0E23\u0E40\u0E23\u0E37\u0E48\u0E2D\u0E07\u0E19\u0E35\u0E49",
      spawnAtSec: 16.8,
      expiresAtSec: 19.2,
      classification: "STOP",
      explanation: "\u0E02\u0E2D\u0E43\u0E2B\u0E49\u0E40\u0E01\u0E47\u0E1A\u0E40\u0E1B\u0E47\u0E19\u0E04\u0E27\u0E32\u0E21\u0E25\u0E31\u0E1A \u0E0B\u0E36\u0E48\u0E07\u0E40\u0E1B\u0E47\u0E19\u0E2A\u0E31\u0E0D\u0E0D\u0E32\u0E13\u0E2D\u0E31\u0E19\u0E15\u0E23\u0E32\u0E22\u0E43\u0E19\u0E23\u0E30\u0E1A\u0E1A\u0E04\u0E27\u0E32\u0E21\u0E1B\u0E25\u0E2D\u0E14\u0E20\u0E31\u0E22"
    },
    {
      bubbleId: "whack-b14",
      slot: 1,
      text: "\u0E04\u0E38\u0E13\u0E1A\u0E2D\u0E01\u0E02\u0E49\u0E2D\u0E01\u0E31\u0E07\u0E27\u0E25\u0E01\u0E31\u0E1A\u0E40\u0E08\u0E49\u0E32\u0E2B\u0E19\u0E49\u0E32\u0E17\u0E35\u0E48\u0E44\u0E14\u0E49",
      spawnAtSec: 18,
      expiresAtSec: 20.4,
      classification: "PASS",
      explanation: "\u0E2A\u0E48\u0E07\u0E40\u0E2A\u0E23\u0E34\u0E21\u0E43\u0E2B\u0E49\u0E1C\u0E39\u0E49\u0E43\u0E0A\u0E49\u0E2A\u0E37\u0E48\u0E2D\u0E2A\u0E32\u0E23\u0E02\u0E49\u0E2D\u0E01\u0E31\u0E07\u0E27\u0E25\u0E01\u0E31\u0E1A\u0E40\u0E08\u0E49\u0E32\u0E2B\u0E19\u0E49\u0E32\u0E17\u0E35\u0E48\u0E2D\u0E22\u0E48\u0E32\u0E07\u0E40\u0E1B\u0E34\u0E14\u0E40\u0E1C\u0E22"
    },
    {
      bubbleId: "whack-b15",
      slot: 2,
      text: "\u0E44\u0E21\u0E48\u0E15\u0E49\u0E2D\u0E07\u0E15\u0E23\u0E27\u0E08\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E40\u0E1E\u0E34\u0E48\u0E21\u0E40\u0E15\u0E34\u0E21",
      spawnAtSec: 19.2,
      expiresAtSec: 21.6,
      classification: "STOP",
      explanation: "\u0E25\u0E30\u0E40\u0E25\u0E22\u0E01\u0E32\u0E23\u0E15\u0E23\u0E27\u0E08\u0E2A\u0E2D\u0E1A\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E40\u0E1E\u0E34\u0E48\u0E21\u0E40\u0E15\u0E34\u0E21\u0E40\u0E21\u0E37\u0E48\u0E2D\u0E21\u0E35\u0E02\u0E49\u0E2D\u0E2A\u0E07\u0E2A\u0E31\u0E22"
    },
    {
      bubbleId: "whack-b16",
      slot: 3,
      text: "\u0E02\u0E2D\u0E40\u0E0A\u0E47\u0E01\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E01\u0E48\u0E2D\u0E19\u0E15\u0E2D\u0E1A\u0E15\u0E48\u0E2D",
      spawnAtSec: 20.4,
      expiresAtSec: 22.8,
      classification: "PASS",
      explanation: "\u0E2B\u0E22\u0E38\u0E14\u0E40\u0E1E\u0E37\u0E48\u0E2D\u0E15\u0E23\u0E27\u0E08\u0E2A\u0E2D\u0E1A\u0E04\u0E27\u0E32\u0E21\u0E16\u0E39\u0E01\u0E15\u0E49\u0E2D\u0E07\u0E02\u0E2D\u0E07\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E01\u0E48\u0E2D\u0E19\u0E43\u0E2B\u0E49\u0E04\u0E33\u0E15\u0E2D\u0E1A"
    },
    {
      bubbleId: "whack-b17",
      slot: 4,
      text: "\u0E40\u0E0A\u0E37\u0E48\u0E2D\u0E09\u0E31\u0E19\u0E41\u0E25\u0E49\u0E27\u0E17\u0E33\u0E15\u0E48\u0E2D\u0E44\u0E14\u0E49\u0E40\u0E25\u0E22",
      spawnAtSec: 21.5,
      expiresAtSec: 23.9,
      classification: "STOP",
      explanation: "\u0E01\u0E14\u0E14\u0E31\u0E19\u0E43\u0E2B\u0E49\u0E40\u0E0A\u0E37\u0E48\u0E2D\u0E43\u0E08\u0E42\u0E14\u0E22\u0E44\u0E21\u0E48\u0E40\u0E1B\u0E34\u0E14\u0E42\u0E2D\u0E01\u0E32\u0E2A\u0E43\u0E2B\u0E49\u0E15\u0E23\u0E27\u0E08\u0E2A\u0E2D\u0E1A"
    },
    {
      bubbleId: "whack-b18",
      slot: 5,
      text: "\u0E09\u0E31\u0E19\u0E08\u0E30\u0E44\u0E21\u0E48\u0E40\u0E23\u0E48\u0E07\u0E43\u0E2B\u0E49\u0E04\u0E38\u0E13\u0E17\u0E33\u0E15\u0E32\u0E21",
      spawnAtSec: 22.6,
      expiresAtSec: 25,
      classification: "PASS",
      explanation: "\u0E43\u0E2B\u0E49\u0E40\u0E27\u0E25\u0E32\u0E1C\u0E39\u0E49\u0E43\u0E0A\u0E49\u0E1E\u0E34\u0E08\u0E32\u0E23\u0E13\u0E32\u0E2D\u0E22\u0E48\u0E32\u0E07\u0E23\u0E2D\u0E1A\u0E04\u0E2D\u0E1A \u0E44\u0E21\u0E48\u0E2A\u0E23\u0E49\u0E32\u0E07\u0E41\u0E23\u0E07\u0E01\u0E14\u0E14\u0E31\u0E19"
    }
  ],
  practiceBubbles: [
    {
      bubbleId: "whack-p01",
      slot: 0,
      text: "\u0E44\u0E21\u0E48\u0E15\u0E49\u0E2D\u0E07\u0E1A\u0E2D\u0E01\u0E43\u0E04\u0E23\u0E40\u0E23\u0E37\u0E48\u0E2D\u0E07\u0E19\u0E35\u0E49 (\u0E25\u0E2D\u0E07\u0E41\u0E15\u0E30\u0E40\u0E1E\u0E37\u0E48\u0E2D\u0E17\u0E38\u0E1A)",
      spawnAtSec: 0,
      expiresAtSec: 99,
      classification: "STOP",
      explanation: "\u0E02\u0E49\u0E2D\u0E04\u0E27\u0E32\u0E21\u0E2D\u0E31\u0E19\u0E15\u0E23\u0E32\u0E22\u0E17\u0E35\u0E48\u0E04\u0E27\u0E23\u0E2B\u0E22\u0E38\u0E14 \u0E41\u0E15\u0E30\u0E41\u0E25\u0E49\u0E27\u0E08\u0E30\u0E02\u0E36\u0E49\u0E19\u0E15\u0E23\u0E32\u0E2B\u0E22\u0E38\u0E14"
    },
    {
      bubbleId: "whack-p02",
      slot: 3,
      text: "\u0E09\u0E31\u0E19\u0E0A\u0E48\u0E27\u0E22\u0E15\u0E34\u0E14\u0E15\u0E48\u0E2D\u0E40\u0E08\u0E49\u0E32\u0E2B\u0E19\u0E49\u0E32\u0E17\u0E35\u0E48\u0E44\u0E14\u0E49 (\u0E02\u0E49\u0E2D\u0E04\u0E27\u0E32\u0E21\u0E1B\u0E25\u0E2D\u0E14\u0E20\u0E31\u0E22)",
      spawnAtSec: 0,
      expiresAtSec: 99,
      classification: "PASS",
      explanation: "\u0E02\u0E49\u0E2D\u0E04\u0E27\u0E32\u0E21\u0E0A\u0E48\u0E27\u0E22\u0E40\u0E2B\u0E25\u0E37\u0E2D\u0E17\u0E35\u0E48\u0E04\u0E27\u0E23\u0E1B\u0E25\u0E48\u0E2D\u0E22\u0E1C\u0E48\u0E32\u0E19 \u0E2B\u0E49\u0E32\u0E21\u0E41\u0E15\u0E30\u0E17\u0E38\u0E1A"
    }
  ]
};
async function seedWhackContent(db) {
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
        b.explanation
      ]
    );
  }
}

// api/games/shield-content.ts
var shieldContent = {
  version: "shield-v1",
  packets: [
    {
      packetId: "shield-pkt-01",
      packetNo: 1,
      aimAtSec: 0,
      railAtSec: 1.6,
      customerAtSec: 2.4,
      targetLane: 1,
      // Center
      botClaim: "\u0E04\u0E37\u0E19\u0E40\u0E07\u0E34\u0E19\u0E44\u0E14\u0E49\u0E41\u0E19\u0E48\u0E19\u0E2D\u0E19",
      companyTask: "\u0E15\u0E23\u0E27\u0E08\u0E2A\u0E34\u0E17\u0E18\u0E34\u0E4C\u0E04\u0E37\u0E19\u0E40\u0E07\u0E34\u0E19",
      customerName: "\u0E25\u0E39\u0E01\u0E04\u0E49\u0E32\u0E0A\u0E48\u0E2D\u0E07\u0E01\u0E25\u0E32\u0E07 (\u0E04\u0E38\u0E13\u0E2A\u0E21\u0E0A\u0E32\u0E22)"
    },
    {
      packetId: "shield-pkt-02",
      packetNo: 2,
      aimAtSec: 2.6,
      railAtSec: 4.2,
      customerAtSec: 5,
      targetLane: 0,
      // Left
      botClaim: "\u0E22\u0E37\u0E48\u0E19\u0E17\u0E35\u0E2B\u0E25\u0E31\u0E07\u0E01\u0E47\u0E44\u0E14\u0E49",
      companyTask: "\u0E15\u0E23\u0E27\u0E08\u0E27\u0E31\u0E19\u0E22\u0E37\u0E48\u0E19\u0E04\u0E33\u0E02\u0E2D",
      customerName: "\u0E25\u0E39\u0E01\u0E04\u0E49\u0E32\u0E0A\u0E48\u0E2D\u0E07\u0E0B\u0E49\u0E32\u0E22 (\u0E04\u0E38\u0E13\u0E27\u0E34\u0E20\u0E32)"
    },
    {
      packetId: "shield-pkt-03",
      packetNo: 3,
      aimAtSec: 5.2,
      railAtSec: 6.8,
      customerAtSec: 7.6,
      targetLane: 2,
      // Right
      botClaim: "\u0E44\u0E21\u0E48\u0E21\u0E35\u0E04\u0E48\u0E32\u0E43\u0E0A\u0E49\u0E08\u0E48\u0E32\u0E22\u0E40\u0E1E\u0E34\u0E48\u0E21",
      companyTask: "\u0E15\u0E23\u0E27\u0E08\u0E04\u0E48\u0E32\u0E1A\u0E23\u0E34\u0E01\u0E32\u0E23",
      customerName: "\u0E25\u0E39\u0E01\u0E04\u0E49\u0E32\u0E0A\u0E48\u0E2D\u0E07\u0E02\u0E27\u0E32 (\u0E04\u0E38\u0E13\u0E18\u0E19\u0E1E\u0E25)"
    },
    {
      packetId: "shield-pkt-04",
      packetNo: 4,
      aimAtSec: 7.8,
      railAtSec: 9.4,
      customerAtSec: 10.2,
      targetLane: 1,
      // Center
      botClaim: "\u0E44\u0E21\u0E48\u0E15\u0E49\u0E2D\u0E07\u0E40\u0E01\u0E47\u0E1A\u0E2B\u0E25\u0E31\u0E01\u0E10\u0E32\u0E19",
      companyTask: "\u0E15\u0E34\u0E14\u0E15\u0E48\u0E2D\u0E02\u0E2D\u0E2B\u0E25\u0E31\u0E01\u0E10\u0E32\u0E19",
      customerName: "\u0E25\u0E39\u0E01\u0E04\u0E49\u0E32\u0E0A\u0E48\u0E2D\u0E07\u0E01\u0E25\u0E32\u0E07 (\u0E04\u0E38\u0E13\u0E2A\u0E21\u0E0A\u0E32\u0E22)"
    },
    {
      packetId: "shield-pkt-05",
      packetNo: 5,
      aimAtSec: 10.4,
      railAtSec: 12,
      customerAtSec: 12.8,
      targetLane: 2,
      // Right
      botClaim: "\u0E2A\u0E48\u0E27\u0E19\u0E25\u0E14\u0E19\u0E35\u0E49\u0E44\u0E14\u0E49\u0E17\u0E38\u0E01\u0E04\u0E19",
      companyTask: "\u0E15\u0E23\u0E27\u0E08\u0E40\u0E07\u0E37\u0E48\u0E2D\u0E19\u0E44\u0E02\u0E2A\u0E48\u0E27\u0E19\u0E25\u0E14",
      customerName: "\u0E25\u0E39\u0E01\u0E04\u0E49\u0E32\u0E0A\u0E48\u0E2D\u0E07\u0E02\u0E27\u0E32 (\u0E04\u0E38\u0E13\u0E18\u0E19\u0E1E\u0E25)"
    },
    {
      packetId: "shield-pkt-06",
      packetNo: 6,
      aimAtSec: 12.6,
      railAtSec: 14.2,
      customerAtSec: 15,
      targetLane: 0,
      // Left
      botClaim: "\u0E40\u0E1B\u0E25\u0E35\u0E48\u0E22\u0E19\u0E0A\u0E37\u0E48\u0E2D\u0E44\u0E14\u0E49\u0E1F\u0E23\u0E35",
      companyTask: "\u0E15\u0E23\u0E27\u0E08\u0E40\u0E07\u0E37\u0E48\u0E2D\u0E19\u0E44\u0E02\u0E40\u0E1B\u0E25\u0E35\u0E48\u0E22\u0E19\u0E0A\u0E37\u0E48\u0E2D",
      customerName: "\u0E25\u0E39\u0E01\u0E04\u0E49\u0E32\u0E0A\u0E48\u0E2D\u0E07\u0E0B\u0E49\u0E32\u0E22 (\u0E04\u0E38\u0E13\u0E27\u0E34\u0E20\u0E32)"
    },
    {
      packetId: "shield-pkt-07",
      packetNo: 7,
      aimAtSec: 14.8,
      railAtSec: 16.4,
      customerAtSec: 17.2,
      targetLane: 2,
      // Right
      botClaim: "\u0E2D\u0E19\u0E38\u0E21\u0E31\u0E15\u0E34\u0E17\u0E31\u0E19\u0E17\u0E35\u0E41\u0E19\u0E48\u0E19\u0E2D\u0E19",
      companyTask: "\u0E15\u0E23\u0E27\u0E08\u0E2A\u0E16\u0E32\u0E19\u0E30\u0E04\u0E33\u0E02\u0E2D",
      customerName: "\u0E25\u0E39\u0E01\u0E04\u0E49\u0E32\u0E0A\u0E48\u0E2D\u0E07\u0E02\u0E27\u0E32 (\u0E04\u0E38\u0E13\u0E18\u0E19\u0E1E\u0E25)"
    },
    {
      packetId: "shield-pkt-08",
      packetNo: 8,
      aimAtSec: 17,
      railAtSec: 18.6,
      customerAtSec: 19.4,
      targetLane: 1,
      // Center
      botClaim: "\u0E27\u0E31\u0E19\u0E2B\u0E21\u0E14\u0E2D\u0E32\u0E22\u0E38\u0E44\u0E21\u0E48\u0E2A\u0E33\u0E04\u0E31\u0E0D",
      companyTask: "\u0E15\u0E23\u0E27\u0E08\u0E2D\u0E32\u0E22\u0E38\u0E2A\u0E34\u0E17\u0E18\u0E34\u0E4C",
      customerName: "\u0E25\u0E39\u0E01\u0E04\u0E49\u0E32\u0E0A\u0E48\u0E2D\u0E07\u0E01\u0E25\u0E32\u0E07 (\u0E04\u0E38\u0E13\u0E2A\u0E21\u0E0A\u0E32\u0E22)"
    },
    {
      packetId: "shield-pkt-09",
      packetNo: 9,
      aimAtSec: 19.2,
      railAtSec: 20.8,
      customerAtSec: 21.6,
      targetLane: 0,
      // Left
      botClaim: "\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E40\u0E14\u0E34\u0E21\u0E22\u0E31\u0E07\u0E43\u0E0A\u0E49\u0E44\u0E14\u0E49",
      companyTask: "\u0E15\u0E23\u0E27\u0E08\u0E19\u0E42\u0E22\u0E1A\u0E32\u0E22\u0E25\u0E48\u0E32\u0E2A\u0E38\u0E14",
      customerName: "\u0E25\u0E39\u0E01\u0E04\u0E49\u0E32\u0E0A\u0E48\u0E2D\u0E07\u0E0B\u0E49\u0E32\u0E22 (\u0E04\u0E38\u0E13\u0E27\u0E34\u0E20\u0E32)"
    },
    {
      packetId: "shield-pkt-10",
      packetNo: 10,
      aimAtSec: 21.4,
      railAtSec: 23,
      customerAtSec: 23.8,
      targetLane: 2,
      // Right
      botClaim: "\u0E40\u0E0A\u0E37\u0E48\u0E2D\u0E41\u0E0A\u0E15\u0E19\u0E35\u0E49\u0E44\u0E14\u0E49\u0E40\u0E25\u0E22",
      companyTask: "\u0E22\u0E37\u0E19\u0E22\u0E31\u0E19\u0E04\u0E33\u0E15\u0E2D\u0E1A\u0E41\u0E25\u0E30\u0E15\u0E34\u0E14\u0E15\u0E48\u0E2D\u0E01\u0E25\u0E31\u0E1A",
      customerName: "\u0E25\u0E39\u0E01\u0E04\u0E49\u0E32\u0E0A\u0E48\u0E2D\u0E07\u0E02\u0E27\u0E32 (\u0E04\u0E38\u0E13\u0E18\u0E19\u0E1E\u0E25)"
    }
  ],
  practicePacket: {
    packetId: "shield-p01",
    packetNo: 0,
    aimAtSec: 0,
    railAtSec: 2,
    customerAtSec: 2.8,
    targetLane: 1,
    // Center
    botClaim: "\u0E17\u0E14\u0E25\u0E2D\u0E07\u0E40\u0E25\u0E37\u0E48\u0E2D\u0E19\u0E2D\u0E32\u0E04\u0E32\u0E23\u0E21\u0E32\u0E1A\u0E31\u0E07\u0E15\u0E23\u0E07\u0E19\u0E35\u0E49",
    companyTask: "\u0E23\u0E31\u0E1A\u0E40\u0E23\u0E37\u0E48\u0E2D\u0E07\u0E17\u0E14\u0E25\u0E2D\u0E07",
    customerName: "\u0E25\u0E39\u0E01\u0E04\u0E49\u0E32\u0E08\u0E33\u0E25\u0E2D\u0E07"
  }
};
async function seedShieldContent(db) {
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

// api/games/piece-content.ts
var PIECE_CONTENT_V1 = {
  version: "piece-v1",
  prompt: "\u0E40\u0E15\u0E34\u0E21\u0E1B\u0E35\u0E01\u0E43\u0E2B\u0E49\u0E2A\u0E34\u0E48\u0E07\u0E1B\u0E23\u0E30\u0E14\u0E34\u0E29\u0E10\u0E4C\u0E19\u0E35\u0E49\u0E1E\u0E23\u0E49\u0E2D\u0E21\u0E2D\u0E2D\u0E01\u0E40\u0E14\u0E34\u0E19\u0E17\u0E32\u0E07\u0E43\u0E19\u0E41\u0E1A\u0E1A\u0E02\u0E2D\u0E07\u0E04\u0E38\u0E13",
  task: "AI \u0E23\u0E48\u0E32\u0E07\u0E42\u0E04\u0E23\u0E07\u0E2A\u0E23\u0E49\u0E32\u0E07\u0E25\u0E33\u0E15\u0E31\u0E27\u0E02\u0E2D\u0E07\u0E2D\u0E32\u0E01\u0E32\u0E28\u0E22\u0E32\u0E19\u0E01\u0E25\u0E44\u0E01\u0E44\u0E27\u0E49\u0E43\u0E2B\u0E49\u0E41\u0E25\u0E49\u0E27 \u0E27\u0E32\u0E14\u0E40\u0E15\u0E34\u0E21\u0E1B\u0E35\u0E01\u0E2B\u0E23\u0E37\u0E2D\u0E2D\u0E38\u0E1B\u0E01\u0E23\u0E13\u0E4C\u0E1E\u0E22\u0E38\u0E07\u0E01\u0E32\u0E23\u0E1A\u0E34\u0E19\u0E17\u0E31\u0E49\u0E07 2 \u0E1D\u0E31\u0E48\u0E07\u0E43\u0E19\u0E41\u0E1A\u0E1A\u0E02\u0E2D\u0E07\u0E04\u0E38\u0E13\u0E20\u0E32\u0E22\u0E43\u0E19 20 \u0E27\u0E34\u0E19\u0E32\u0E17\u0E35",
  baseAssetId: "piece-asset-01",
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
  <text x="230" y="275" fill="#38bdf8" font-size="20" font-family="sans-serif" font-weight="bold" text-anchor="middle" opacity="0.6">\u2726 \u0E1B\u0E35\u0E01\u0E0B\u0E49\u0E32\u0E22 (LEFT WING ZONE)</text>

  <rect x="590" y="240" width="360" height="480" rx="16" fill="rgba(56, 189, 248, 0.02)" stroke="#38bdf8" stroke-width="2" stroke-dasharray="8 8" opacity="0.45"/>
  <text x="770" y="275" fill="#38bdf8" font-size="20" font-family="sans-serif" font-weight="bold" text-anchor="middle" opacity="0.6">\u2726 \u0E1B\u0E35\u0E01\u0E02\u0E27\u0E32 (RIGHT WING ZONE)</text>

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
    title: "The Unwinged Aviator (\u0E08\u0E31\u0E01\u0E23\u0E01\u0E25\u0E40\u0E27\u0E2B\u0E32\u0E44\u0E23\u0E49\u0E1B\u0E35\u0E01)",
    description: "\u0E23\u0E48\u0E32\u0E07\u0E42\u0E04\u0E23\u0E07\u0E2A\u0E23\u0E49\u0E32\u0E07\u0E22\u0E32\u0E19\u0E2A\u0E31\u0E15\u0E27\u0E4C\u0E01\u0E25\u0E44\u0E2E\u0E1A\u0E23\u0E34\u0E14 \u0E2A\u0E23\u0E49\u0E32\u0E07\u0E42\u0E14\u0E22 generative model \u0E42\u0E14\u0E22\u0E40\u0E27\u0E49\u0E19\u0E0A\u0E48\u0E2D\u0E07\u0E27\u0E48\u0E32\u0E07\u0E1B\u0E35\u0E01\u0E2A\u0E33\u0E2B\u0E23\u0E31\u0E1A\u0E21\u0E19\u0E38\u0E29\u0E22\u0E4C\u0E40\u0E15\u0E34\u0E21\u0E40\u0E15\u0E47\u0E21\u0E40\u0E08\u0E15\u0E08\u0E33\u0E19\u0E07",
    aiModel: "Imagen 3 Core / Hybrid Structural Blueprint v1.0",
    generatedAt: "2026-10-06T12:00:00Z",
    license: "Internal Creative Commons Non-Commercial Attribution",
    drawingZones: {
      left: { x: 0.05, y: 0.24, width: 0.36, height: 0.48, label: "\u0E1B\u0E35\u0E01\u0E0B\u0E49\u0E32\u0E22" },
      right: { x: 0.59, y: 0.24, width: 0.36, height: 0.48, label: "\u0E1B\u0E35\u0E01\u0E02\u0E27\u0E32" }
    }
  }
};
async function seedPieceContent(db) {
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
      JSON.stringify(PIECE_CONTENT_V1.metadata)
    ]
  );
}

// api/database.ts
async function openDatabase(path = process.env.GAME_DATA_DIR ?? "data/pg", options = {}) {
  let db;
  if (process.env.GAME_DATABASE_URL) {
    const pool = new pg.Pool({ connectionString: process.env.GAME_DATABASE_URL, max: Number(process.env.GAME_DB_POOL_SIZE ?? (process.env.VERCEL ? "2" : "1")), connectionTimeoutMillis: 4e3, idleTimeoutMillis: 1e4, statement_timeout: 8e3, query_timeout: 1e4, keepAlive: true, allowExitOnIdle: true });
    pool.on("error", (error) => console.error("[game-db] idle connection failed", error.message));
    db = { query: async (sql, params) => {
      const r = await pool.query(sql, params);
      return { rows: r.rows };
    }, exec: (sql) => pool.query(sql), close: () => pool.end() };
  } else {
    if (path !== ":memory:") await mkdir(resolve3(path), { recursive: true });
    db = new PGlite(path === ":memory:" ? void 0 : resolve3(path));
  }
  try {
    if (options.bootstrap === false) {
      const readiness = await db.query("SELECT to_regprocedure('game.snapshot(uuid,text)')::text AS snapshot,to_regprocedure('game.command(uuid,text,text,jsonb,text)')::text AS command");
      if (!readiness.rows[0]?.snapshot || !readiness.rows[0]?.command) throw new Error("Game database migrations have not been applied.");
      return db;
    }
    await db.exec(await readFile2(resolve3(process.cwd(), "db/schema.sql"), "utf8"));
    await db.exec(await readFile2(resolve3(process.cwd(), "db/caption.sql"), "utf8"));
    await db.exec(await readFile2(resolve3(process.cwd(), "db/roulette.sql"), "utf8"));
    await db.exec(await readFile2(resolve3(process.cwd(), "db/whack.sql"), "utf8"));
    await db.exec(await readFile2(resolve3(process.cwd(), "db/shield.sql"), "utf8"));
    await db.exec(await readFile2(resolve3(process.cwd(), "db/piece.sql"), "utf8"));
    await seedSwipeContent(db);
    await seedCaptionContent(db);
    await seedRouletteContent(db);
    await seedWhackContent(db);
    await seedShieldContent(db);
    await seedPieceContent(db);
    return db;
  } catch (error) {
    await db.close().catch(() => {
    });
    throw error;
  }
}

// api/app.ts
import { Elysia, t } from "elysia";
import { node } from "@elysiajs/node";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { readFile as readFile3, stat as stat2 } from "node:fs/promises";
import { resolve as resolve4, sep, extname } from "node:path";
import QRCode from "qrcode";

// api/group-names.ts
var groupNames = [
  "1234",
  "\u0E2A\u0E35\u0E01\u0E38\u0E21\u0E32\u0E23",
  "Human\u0E40\u0E19\u0E15",
  "\u0E17\u0E49\u0E32\u0E22\u0E01\u0E25\u0E35\u0E01\u0E23",
  "\u0E40\u0E17\u0E40\u0E25\u0E17\u0E31\u0E1A\u0E1A\u0E35\u0E49",
  "Cry4",
  "cybertud67",
  "\u0E17\u0E49\u0E32\u0E22\u0E44\u0E17\u0E22\u0E1E\u0E32\u0E13\u0E34\u0E0A\u0E22\u0E4C"
];

// api/validation.ts
var uuid = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;
var id = (v) => typeof v === "string" && uuid.test(v);
var text = (v) => typeof v === "string" && v.length > 0 && v.length <= 200;
var integer = (v) => Number.isSafeInteger(v) && Number(v) >= 0 && Number(v) <= 2147483647;
var group = (v) => integer(v) && Number(v) >= 1 && Number(v) <= 8;
var schemas = {
  join: { nickname: (v) => typeof v === "string" && [...v.trim()].length >= 1 && [...v.trim()].length <= 24, groupId: group },
  side: { previewId: id, side: (v) => v === "HUMAN" || v === "AI", expectedRevision: integer },
  ready: { previewId: id, contentVersion: (v) => v === "trust-tug-v1" || v === "swipe-court-v1" || v === "caption-battle-v1" || v === "roulette-v1" || v === "whack-a-mole-v1" || v === "shield-v1" || v === "piece-v1" },
  group: { groupId: group },
  leave: {},
  writer: { runId: id, writerId: text },
  tap: { runId: id, phaseToken: id, writerId: text, inputEpoch: integer, events: (v) => Array.isArray(v) && v.length >= 1 && v.length <= 20 && v.every((e) => e && id(e.id) && integer(e.sequence) && e.sequence > 0) && new Set(v.map((e) => e.id)).size === v.length },
  answer: { runId: id, phaseToken: id, imageId: (v) => typeof v === "string" && /^sc-[a-f\d]{8}$/.test(v), choice: (v) => v === "HUMAN" || v === "AI" },
  "roulette-decision": { runId: id, phaseToken: id, round: integer, choice: (v) => v === "BELIEVE" || v === "DOUBT" },
  "whack-hit": { runId: id, phaseToken: id, bubbleId: (v) => typeof v === "string" && v.length > 0 && v.length <= 64, clientTimeMs: integer },
  "shield-move": { runId: id, phaseToken: id, lane: (v) => Number.isInteger(v) && Number(v) >= 0 && Number(v) <= 2, normalizedX: (v) => typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 1, clientTimeMs: integer },
  "piece-stroke": { runId: id, phaseToken: id, strokes: (v) => Array.isArray(v) && v.length <= 100, revision: (v) => integer(v) && Number(v) > 0, clientTimeMs: integer },
  "piece-finish-early": { runId: id, phaseToken: id },
  "piece-moderation": { runId: id, phaseToken: id, artworkId: id, decision: (v) => ["APPROVED", "REJECTED", "WITHHELD"].includes(String(v)), reason: (v) => typeof v === "string" && v.length <= 200 },
  "piece-approve-all": { runId: id, phaseToken: id, reviewedArtworkIds: (v) => Array.isArray(v) && v.length <= 256 && v.every(id) && new Set(v).size === v.length },
  "piece-open-internal-vote": { runId: id, phaseToken: id },
  "piece-open-final-vote": { runId: id, phaseToken: id },
  "piece-internal-vote": { runId: id, phaseToken: id, candidateId: id, revision: (v) => integer(v) && Number(v) > 0 },
  "piece-final-vote": { runId: id, phaseToken: id, candidateId: id, revision: (v) => integer(v) && Number(v) > 0 },
  "piece-reveal": { runId: id, phaseToken: id },
  caption: { runId: id, phaseToken: id, text: (v) => typeof v === "string" && v.length <= 1600, revision: (v) => integer(v) && Number(v) > 0, submitted: (v) => typeof v === "boolean" },
  "internal-vote": { runId: id, phaseToken: id, candidateId: id, revision: (v) => integer(v) && Number(v) > 0 },
  "final-vote": { runId: id, phaseToken: id, candidateId: id, revision: (v) => integer(v) && Number(v) > 0 },
  moderation: { runId: id, phaseToken: id, submissionId: id, lockedRevision: (v) => integer(v) && Number(v) > 0, expectedReviewVersion: integer, decision: (v) => ["APPROVED", "REJECTED", "WITHHELD"].includes(String(v)), reason: (v) => typeof v === "string" && v.length <= 200 },
  "caption-content-approve": {},
  "caption-open-vote": { runId: id, phaseToken: id },
  acquire: { controllerId: text },
  heartbeat: { controllerId: text, controllerEpoch: integer },
  practice: {},
  start: { timingProfile: (v) => v === "normal" || v === "compact" },
  pause: {},
  resume: {},
  finish: { inputDigest: text },
  cancel: { reason: text },
  replay: { reason: text },
  cue: { cue: (v) => typeof v === "string" && /^\d{2}\.\d{2}$/.test(v) },
  rename: { groupId: group, name: (v) => typeof v === "string" && v.trim().length >= 1 && v.trim().length <= 32 },
  move: { memberId: id, groupId: group, reason: text }
};
function validateCommand(kind, p) {
  const base = schemas[kind];
  if (!base) return false;
  const rules = { ...base };
  if (["practice", "start", "pause", "resume", "finish", "cancel", "replay", "cue", "rename", "move", "moderation", "caption-content-approve", "caption-open-vote", "piece-moderation", "piece-approve-all", "piece-open-internal-vote", "piece-open-final-vote", "piece-reveal"].includes(kind)) Object.assign(rules, { controllerId: text, controllerEpoch: integer, expectedVersion: integer });
  const optional = kind === "acquire" ? ["reason"] : [];
  return Object.entries(rules).every(([key, rule]) => rule(p[key])) && Object.keys(p).every((key) => key in rules || optional.includes(key)) && (!("reason" in p) || kind === "moderation" || kind === "piece-moderation" || text(p.reason));
}

// src/MotionTiming.ts
var LOOP_REST_SECONDS = 2.5;
var actionSeconds = {
  opening: 3.6,
  biology: 3.6,
  question: 3.5,
  art: 2.9,
  poetry: 3,
  flamingo: 2.9,
  attribution: 3.5,
  individual: 4.5,
  diversity: 4.5,
  tensor: 3,
  protein: 4,
  strategy: 3.4,
  frontier: 3,
  "frontier-data": 3.5,
  mushroom: 2.9,
  chat: 2.9,
  empathy: 2.9,
  tokens: 3.2,
  tessa: 3,
  gate: 3.3,
  case: 2.45,
  liability: 2.7,
  synergy: 2.45,
  design: 3.3,
  outage: 3.3,
  oversight: 3.3,
  formula: 3.5,
  different: 4,
  future: 4,
  responsibility: 4,
  thanks: 4
};
var loopDuration = (visual) => actionSeconds[visual] + LOOP_REST_SECONDS;

// src/content.ts
var make = (id2, title, subtitle, visual, speaker, eyebrow, notes, facts = [], motion = "push") => ({ id: id2, kind: "content", title, subtitle, visual, speaker, eyebrow, notes, facts, motion, loop: loopDuration(visual) });
var hold = (id2, title, subtitle, notes) => ({ id: id2, kind: "placeholder", title, subtitle, eyebrow: "", speaker: "Both", notes, facts: [], motion: "fade", loop: 0 });
var chapters = [
  { id: "01", title: "THE CLASH", start: 0, end: 180, cues: [
    make("01.01", "HUMAN\nvs AI", "The Sparring Minds", "opening", "Both", "DIFFERENT MINDS. ONE QUESTION.", "Human: \u0E2A\u0E27\u0E31\u0E2A\u0E14\u0E35\u0E2D\u0E32\u0E08\u0E32\u0E23\u0E22\u0E4C\u0E41\u0E25\u0E30\u0E40\u0E1E\u0E37\u0E48\u0E2D\u0E19 \u0E46 \u0E04\u0E23\u0E31\u0E1A \u0E27\u0E31\u0E19\u0E19\u0E35\u0E49\u0E40\u0E23\u0E32\u0E44\u0E21\u0E48\u0E44\u0E14\u0E49\u0E16\u0E32\u0E21\u0E40\u0E1E\u0E35\u0E22\u0E07\u0E27\u0E48\u0E32\u0E43\u0E04\u0E23\u0E40\u0E01\u0E48\u0E07\u0E01\u0E27\u0E48\u0E32 \u0E41\u0E15\u0E48\u0E08\u0E30\u0E25\u0E2D\u0E07\u0E21\u0E2D\u0E07\u0E43\u0E2B\u0E49\u0E0A\u0E31\u0E14\u0E27\u0E48\u0E32\u0E2A\u0E15\u0E34\u0E1B\u0E31\u0E0D\u0E0D\u0E32\u0E2A\u0E2D\u0E07\u0E41\u0E1A\u0E1A\u0E40\u0E2B\u0E21\u0E32\u0E30\u0E01\u0E31\u0E1A\u0E2B\u0E19\u0E49\u0E32\u0E17\u0E35\u0E48\u0E2D\u0E30\u0E44\u0E23 \u0E41\u0E25\u0E30\u0E40\u0E21\u0E37\u0E48\u0E2D\u0E40\u0E01\u0E34\u0E14\u0E1C\u0E25\u0E01\u0E23\u0E30\u0E17\u0E1A \u0E43\u0E04\u0E23\u0E15\u0E49\u0E2D\u0E07\u0E23\u0E31\u0E1A\u0E1C\u0E34\u0E14\u0E0A\u0E2D\u0E1A \u0E40\u0E23\u0E32\u0E08\u0E30\u0E40\u0E14\u0E34\u0E19\u0E1C\u0E48\u0E32\u0E19\u0E04\u0E27\u0E32\u0E21\u0E04\u0E34\u0E14\u0E2A\u0E23\u0E49\u0E32\u0E07\u0E2A\u0E23\u0E23\u0E04\u0E4C \u0E15\u0E23\u0E23\u0E01\u0E30 \u0E04\u0E27\u0E32\u0E21\u0E40\u0E2B\u0E47\u0E19\u0E2D\u0E01\u0E40\u0E2B\u0E47\u0E19\u0E43\u0E08 \u0E41\u0E25\u0E30\u0E01\u0E32\u0E23\u0E23\u0E48\u0E27\u0E21\u0E21\u0E37\u0E2D\u0E43\u0E19\u0E40\u0E27\u0E25\u0E32 50 \u0E19\u0E32\u0E17\u0E35"),
    hold("01.02", "\u0E2A\u0E41\u0E01\u0E19\u0E40\u0E1E\u0E37\u0E48\u0E2D\u0E40\u0E02\u0E49\u0E32\u0E23\u0E48\u0E27\u0E21", "\u0E01\u0E23\u0E2D\u0E01\u0E0A\u0E37\u0E48\u0E2D \u0E40\u0E25\u0E37\u0E2D\u0E01\u0E01\u0E25\u0E38\u0E48\u0E21 \u0E41\u0E25\u0E49\u0E27\u0E23\u0E2D\u0E40\u0E01\u0E21\u0E40\u0E23\u0E34\u0E48\u0E21", "\u0E1C\u0E39\u0E49\u0E40\u0E02\u0E49\u0E32\u0E23\u0E48\u0E27\u0E21\u0E2A\u0E41\u0E01\u0E19 QR \u0E1A\u0E19\u0E08\u0E2D \u0E01\u0E23\u0E2D\u0E01\u0E0A\u0E37\u0E48\u0E2D\u0E40\u0E25\u0E48\u0E19\u0E41\u0E25\u0E30\u0E40\u0E25\u0E37\u0E2D\u0E01\u0E01\u0E25\u0E38\u0E48\u0E21\u0E40\u0E1E\u0E35\u0E22\u0E07\u0E04\u0E23\u0E31\u0E49\u0E07\u0E40\u0E14\u0E35\u0E22\u0E27 \u0E08\u0E32\u0E01\u0E19\u0E31\u0E49\u0E19\u0E21\u0E37\u0E2D\u0E16\u0E37\u0E2D\u0E08\u0E30\u0E23\u0E2D\u0E41\u0E25\u0E30\u0E40\u0E1B\u0E25\u0E35\u0E48\u0E22\u0E19\u0E40\u0E1B\u0E47\u0E19\u0E2B\u0E19\u0E49\u0E32\u0E40\u0E01\u0E21\u0E42\u0E14\u0E22\u0E2D\u0E31\u0E15\u0E42\u0E19\u0E21\u0E31\u0E15\u0E34\u0E40\u0E21\u0E37\u0E48\u0E2D\u0E2A\u0E44\u0E25\u0E14\u0E4C\u0E16\u0E36\u0E07\u0E04\u0E34\u0E27\u0E40\u0E01\u0E21 \u0E1C\u0E39\u0E49\u0E08\u0E31\u0E14\u0E40\u0E1B\u0E47\u0E19\u0E1C\u0E39\u0E49\u0E01\u0E14\u0E40\u0E23\u0E34\u0E48\u0E21"),
    make("01.03", "\u0E04\u0E34\u0E14\u0E15\u0E48\u0E32\u0E07\n\u0E40\u0E1E\u0E23\u0E32\u0E30\u0E2A\u0E23\u0E49\u0E32\u0E07\u0E21\u0E32\u0E15\u0E48\u0E32\u0E07\u0E01\u0E31\u0E19", "\u0E0A\u0E35\u0E27\u0E27\u0E34\u0E17\u0E22\u0E32 \xB7 \u0E1B\u0E23\u0E30\u0E2A\u0E1A\u0E01\u0E32\u0E23\u0E13\u0E4C \xB7 \u0E01\u0E32\u0E23\u0E04\u0E33\u0E19\u0E27\u0E13", "biology", "AI", "TWO KINDS OF INTELLIGENCE", "AI: \u0E21\u0E19\u0E38\u0E29\u0E22\u0E4C\u0E21\u0E35\u0E02\u0E49\u0E2D\u0E08\u0E33\u0E01\u0E31\u0E14\u0E40\u0E23\u0E37\u0E48\u0E2D\u0E07\u0E04\u0E27\u0E32\u0E21\u0E08\u0E33 \u0E04\u0E27\u0E32\u0E21\u0E40\u0E2B\u0E19\u0E37\u0E48\u0E2D\u0E22\u0E25\u0E49\u0E32 \u0E41\u0E25\u0E30\u0E01\u0E32\u0E23\u0E04\u0E33\u0E19\u0E27\u0E13 \u0E2A\u0E48\u0E27\u0E19 AI \u0E43\u0E0A\u0E49\u0E23\u0E39\u0E1B\u0E41\u0E1A\u0E1A\u0E08\u0E32\u0E01\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E17\u0E33\u0E07\u0E32\u0E19\u0E44\u0E14\u0E49\u0E23\u0E27\u0E14\u0E40\u0E23\u0E47\u0E27\u0E43\u0E19\u0E2B\u0E25\u0E32\u0E22\u0E1A\u0E23\u0E34\u0E1A\u0E17 Korteling \u0E41\u0E25\u0E30\u0E04\u0E13\u0E30\u0E2D\u0E20\u0E34\u0E1B\u0E23\u0E32\u0E22\u0E04\u0E27\u0E32\u0E21\u0E15\u0E48\u0E32\u0E07\u0E19\u0E35\u0E49 \u0E41\u0E15\u0E48\u0E44\u0E21\u0E48\u0E44\u0E14\u0E49\u0E1E\u0E34\u0E2A\u0E39\u0E08\u0E19\u0E4C\u0E27\u0E48\u0E32 AI \u0E40\u0E2B\u0E19\u0E37\u0E2D\u0E21\u0E19\u0E38\u0E29\u0E22\u0E4C\u0E43\u0E19\u0E17\u0E38\u0E01\u0E40\u0E23\u0E37\u0E48\u0E2D\u0E07 \u0E40\u0E23\u0E32\u0E08\u0E36\u0E07\u0E04\u0E27\u0E23\u0E40\u0E1B\u0E23\u0E35\u0E22\u0E1A\u0E40\u0E17\u0E35\u0E22\u0E1A\u0E07\u0E32\u0E19\u0E41\u0E25\u0E30\u0E40\u0E07\u0E37\u0E48\u0E2D\u0E19\u0E44\u0E02 \u0E44\u0E21\u0E48\u0E43\u0E0A\u0E48\u0E40\u0E2B\u0E21\u0E32\u0E23\u0E27\u0E21\u0E2A\u0E15\u0E34\u0E1B\u0E31\u0E0D\u0E0D\u0E32\u0E17\u0E31\u0E49\u0E07\u0E2B\u0E21\u0E14", ["korteling"], "arc"),
    make("01.04", "\u0E43\u0E04\u0E23\u0E04\u0E27\u0E23\u0E17\u0E33\u0E2D\u0E30\u0E44\u0E23?", "\u0E41\u0E25\u0E30\u0E43\u0E04\u0E23\u0E22\u0E31\u0E07\u0E04\u0E07\u0E15\u0E49\u0E2D\u0E07\u0E23\u0E31\u0E1A\u0E1C\u0E34\u0E14\u0E0A\u0E2D\u0E1A?", "question", "Human", "THE QUESTION THAT MATTERS", "Human: \u0E16\u0E49\u0E32\u0E40\u0E04\u0E23\u0E37\u0E48\u0E2D\u0E07\u0E21\u0E37\u0E2D\u0E40\u0E2A\u0E19\u0E2D\u0E17\u0E32\u0E07\u0E40\u0E25\u0E37\u0E2D\u0E01\u0E44\u0E14\u0E49\u0E40\u0E23\u0E47\u0E27 \u0E41\u0E15\u0E48\u0E02\u0E49\u0E2D\u0E40\u0E2A\u0E19\u0E2D\u0E19\u0E31\u0E49\u0E19\u0E01\u0E23\u0E30\u0E17\u0E1A\u0E04\u0E19\u0E08\u0E23\u0E34\u0E07 \u0E1C\u0E39\u0E49\u0E43\u0E0A\u0E49\u0E41\u0E25\u0E30\u0E2D\u0E07\u0E04\u0E4C\u0E01\u0E23\u0E22\u0E31\u0E07\u0E15\u0E49\u0E2D\u0E07\u0E15\u0E31\u0E14\u0E2A\u0E34\u0E19\u0E43\u0E08\u0E15\u0E32\u0E21\u0E2B\u0E19\u0E49\u0E32\u0E17\u0E35\u0E48\u0E02\u0E2D\u0E07\u0E15\u0E19 \u0E04\u0E33\u0E16\u0E32\u0E21\u0E02\u0E2D\u0E07\u0E40\u0E23\u0E32\u0E04\u0E37\u0E2D\u0E08\u0E30\u0E41\u0E1A\u0E48\u0E07\u0E07\u0E32\u0E19\u0E41\u0E25\u0E30\u0E2D\u0E2D\u0E01\u0E41\u0E1A\u0E1A\u0E01\u0E32\u0E23\u0E15\u0E23\u0E27\u0E08\u0E2A\u0E2D\u0E1A\u0E2D\u0E22\u0E48\u0E32\u0E07\u0E44\u0E23 \u0E44\u0E1B\u0E40\u0E23\u0E34\u0E48\u0E21\u0E08\u0E32\u0E01\u0E04\u0E27\u0E32\u0E21\u0E44\u0E27\u0E49\u0E43\u0E08\u0E01\u0E31\u0E19\u0E01\u0E48\u0E2D\u0E19", [], "punch")
  ] },
  { id: "02", title: "TRUST", start: 180, end: 360, cues: [hold("02.01", "THE TRUST\nTUG-OF-WAR", "GAME 01 \xB7 \u0E0A\u0E31\u0E01\u0E40\u0E22\u0E48\u0E2D\u0E2A\u0E15\u0E34\u0E1B\u0E31\u0E0D\u0E0D\u0E32", "\u0E1C\u0E39\u0E49\u0E40\u0E25\u0E48\u0E19\u0E40\u0E25\u0E37\u0E2D\u0E01\u0E1D\u0E31\u0E48\u0E07 Human \u0E2B\u0E23\u0E37\u0E2D AI \u0E41\u0E25\u0E49\u0E27\u0E41\u0E15\u0E30\u0E1E\u0E23\u0E49\u0E2D\u0E21\u0E01\u0E31\u0E19 10 \u0E27\u0E34\u0E19\u0E32\u0E17\u0E35 \u0E08\u0E2D\u0E09\u0E32\u0E22\u0E41\u0E2A\u0E14\u0E07\u0E41\u0E23\u0E07\u0E40\u0E09\u0E25\u0E35\u0E48\u0E22\u0E41\u0E25\u0E30\u0E04\u0E30\u0E41\u0E19\u0E19\u0E01\u0E25\u0E38\u0E48\u0E21\u0E08\u0E32\u0E01\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E08\u0E23\u0E34\u0E07 \u0E1C\u0E39\u0E49\u0E08\u0E31\u0E14\u0E01\u0E14\u0E40\u0E23\u0E34\u0E48\u0E21\u0E41\u0E25\u0E30\u0E22\u0E37\u0E19\u0E22\u0E31\u0E19\u0E1C\u0E25\u0E01\u0E48\u0E2D\u0E19\u0E2A\u0E44\u0E25\u0E14\u0E4C\u0E44\u0E1B\u0E15\u0E48\u0E2D")] },
  { id: "03", title: "CREATIVITY", start: 360, end: 720, cues: [
    make("03.01", "\u0E28\u0E34\u0E25\u0E1B\u0E30\u0E21\u0E35\u0E0A\u0E35\u0E27\u0E34\u0E15\n\u0E2D\u0E22\u0E39\u0E48\u0E40\u0E1A\u0E37\u0E49\u0E2D\u0E07\u0E2B\u0E25\u0E31\u0E07", "Lived experience", "art", "Human", "THE SOUL OF CREATIVITY", "Human: \u0E40\u0E21\u0E37\u0E48\u0E2D\u0E40\u0E23\u0E32\u0E21\u0E2D\u0E07 The Starry Night \u0E40\u0E23\u0E32\u0E2D\u0E32\u0E08\u0E21\u0E2D\u0E07\u0E40\u0E2B\u0E47\u0E19\u0E17\u0E31\u0E49\u0E07\u0E2A\u0E35 \u0E1D\u0E35\u0E41\u0E1B\u0E23\u0E07 \u0E41\u0E25\u0E30\u0E0A\u0E35\u0E27\u0E34\u0E15\u0E02\u0E2D\u0E07 Van Gogh \u0E04\u0E27\u0E32\u0E21\u0E2B\u0E21\u0E32\u0E22\u0E02\u0E2D\u0E07\u0E07\u0E32\u0E19\u0E44\u0E21\u0E48\u0E44\u0E14\u0E49\u0E21\u0E32\u0E08\u0E32\u0E01\u0E04\u0E30\u0E41\u0E19\u0E19\u0E1B\u0E23\u0E30\u0E40\u0E21\u0E34\u0E19\u0E2D\u0E22\u0E48\u0E32\u0E07\u0E40\u0E14\u0E35\u0E22\u0E27 \u0E1B\u0E23\u0E30\u0E2A\u0E1A\u0E01\u0E32\u0E23\u0E13\u0E4C\u0E02\u0E2D\u0E07\u0E1C\u0E39\u0E49\u0E2A\u0E23\u0E49\u0E32\u0E07\u0E41\u0E25\u0E30\u0E1C\u0E39\u0E49\u0E0A\u0E21\u0E40\u0E1B\u0E47\u0E19\u0E2D\u0E35\u0E01\u0E21\u0E34\u0E15\u0E34\u0E2B\u0E19\u0E36\u0E48\u0E07 \u0E19\u0E35\u0E48\u0E40\u0E1B\u0E47\u0E19\u0E21\u0E38\u0E21\u0E21\u0E2D\u0E07\u0E17\u0E32\u0E07\u0E2A\u0E38\u0E19\u0E17\u0E23\u0E35\u0E22\u0E28\u0E32\u0E2A\u0E15\u0E23\u0E4C\u0E02\u0E2D\u0E07\u0E1C\u0E39\u0E49\u0E1E\u0E39\u0E14 \u0E44\u0E21\u0E48\u0E43\u0E0A\u0E48\u0E1C\u0E25\u0E17\u0E14\u0E25\u0E2D\u0E07\u0E1E\u0E34\u0E2A\u0E39\u0E08\u0E19\u0E4C\u0E04\u0E38\u0E13\u0E04\u0E48\u0E32\u0E28\u0E34\u0E25\u0E1B\u0E30"),
    make("03.02", "\u0E16\u0E49\u0E32\u0E1B\u0E34\u0E14\u0E0A\u0E37\u0E48\u0E2D\u0E1C\u0E39\u0E49\u0E2A\u0E23\u0E49\u0E32\u0E07\n\u0E04\u0E38\u0E13\u0E41\u0E22\u0E01\u0E2D\u0E2D\u0E01\u0E44\u0E2B\u0E21?", "\u0E1A\u0E17\u0E01\u0E27\u0E35\u0E17\u0E35\u0E48\u0E2D\u0E48\u0E32\u0E19\u0E44\u0E14\u0E49 \u0E44\u0E21\u0E48\u0E44\u0E14\u0E49\u0E1A\u0E2D\u0E01\u0E17\u0E35\u0E48\u0E21\u0E32\u0E40\u0E2A\u0E21\u0E2D\u0E44\u0E1B", "poetry", "AI", "STATISTICAL TOKENS", "AI: Porter \u0E41\u0E25\u0E30 Machery \u0E17\u0E14\u0E25\u0E2D\u0E07\u0E01\u0E31\u0E1A\u0E1C\u0E39\u0E49\u0E2D\u0E48\u0E32\u0E19\u0E1A\u0E17\u0E01\u0E27\u0E35\u0E17\u0E31\u0E48\u0E27\u0E44\u0E1B \u0E1C\u0E39\u0E49\u0E40\u0E02\u0E49\u0E32\u0E23\u0E48\u0E27\u0E21\u0E08\u0E33\u0E41\u0E19\u0E01\u0E41\u0E2B\u0E25\u0E48\u0E07\u0E01\u0E33\u0E40\u0E19\u0E34\u0E14\u0E44\u0E14\u0E49\u0E16\u0E39\u0E01 46.6% \u0E41\u0E25\u0E30\u0E43\u0E2B\u0E49\u0E04\u0E30\u0E41\u0E19\u0E19\u0E1A\u0E17\u0E01\u0E27\u0E35 AI \u0E2A\u0E39\u0E07\u0E01\u0E27\u0E48\u0E32\u0E43\u0E19\u0E04\u0E38\u0E13\u0E25\u0E31\u0E01\u0E29\u0E13\u0E30\u0E1A\u0E32\u0E07\u0E14\u0E49\u0E32\u0E19 \u0E1C\u0E25\u0E19\u0E35\u0E49\u0E1A\u0E2D\u0E01\u0E02\u0E49\u0E2D\u0E08\u0E33\u0E01\u0E31\u0E14\u0E02\u0E2D\u0E07\u0E01\u0E32\u0E23\u0E08\u0E33\u0E41\u0E19\u0E01\u0E43\u0E19\u0E07\u0E32\u0E19\u0E17\u0E14\u0E25\u0E2D\u0E07 \u0E44\u0E21\u0E48\u0E44\u0E14\u0E49\u0E1E\u0E34\u0E2A\u0E39\u0E08\u0E19\u0E4C\u0E27\u0E48\u0E32\u0E01\u0E27\u0E35\u0E21\u0E19\u0E38\u0E29\u0E22\u0E4C\u0E2B\u0E21\u0E14\u0E04\u0E38\u0E13\u0E04\u0E48\u0E32", ["poetry"], "punch"),
    hold("03.05", "SWIPE\nCOURT", "GAME 02 \xB7 \u0E1B\u0E31\u0E14\u0E0B\u0E49\u0E32\u0E22\u0E04\u0E19 / \u0E1B\u0E31\u0E14\u0E02\u0E27\u0E32 AI", "Swipe Court: \u0E1C\u0E39\u0E49\u0E40\u0E25\u0E48\u0E19\u0E1B\u0E31\u0E14\u0E40\u0E25\u0E37\u0E2D\u0E01\u0E17\u0E35\u0E48\u0E21\u0E32\u0E02\u0E2D\u0E07\u0E20\u0E32\u0E1E 8 \u0E23\u0E2D\u0E1A \u0E17\u0E38\u0E01\u0E40\u0E04\u0E23\u0E37\u0E48\u0E2D\u0E07\u0E40\u0E23\u0E34\u0E48\u0E21\u0E41\u0E25\u0E30\u0E40\u0E09\u0E25\u0E22\u0E1E\u0E23\u0E49\u0E2D\u0E21\u0E01\u0E31\u0E19 \u0E08\u0E2D\u0E09\u0E32\u0E22\u0E41\u0E2A\u0E14\u0E07\u0E20\u0E32\u0E1E \u0E2A\u0E16\u0E34\u0E15\u0E34\u0E2B\u0E49\u0E2D\u0E07 \u0E41\u0E25\u0E30\u0E04\u0E30\u0E41\u0E19\u0E19\u0E01\u0E25\u0E38\u0E48\u0E21\u0E08\u0E32\u0E01\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E08\u0E23\u0E34\u0E07 \u0E1C\u0E39\u0E49\u0E08\u0E31\u0E14\u0E01\u0E14\u0E40\u0E23\u0E34\u0E48\u0E21\u0E41\u0E25\u0E30\u0E22\u0E37\u0E19\u0E22\u0E31\u0E19\u0E1C\u0E25\u0E08\u0E32\u0E01\u0E2B\u0E19\u0E49\u0E32\u0E04\u0E27\u0E1A\u0E04\u0E38\u0E21"),
    make("03.03", "FLAMINGONE", "\u0E20\u0E32\u0E1E\u0E08\u0E23\u0E34\u0E07 \u0E43\u0E19\u0E2B\u0E21\u0E27\u0E14\u0E1B\u0E23\u0E30\u0E01\u0E27\u0E14 AI", "flamingo", "Human", "A REAL PHOTOGRAPH. AN UNEXPECTED LABEL.", "Human: \u0E20\u0E32\u0E1E\u0E02\u0E2D\u0E07 Miles Astray \u0E16\u0E48\u0E32\u0E22\u0E19\u0E01\u0E1F\u0E25\u0E32\u0E21\u0E34\u0E07\u0E42\u0E01\u0E17\u0E35\u0E48\u0E01\u0E33\u0E25\u0E31\u0E07\u0E44\u0E0B\u0E49\u0E02\u0E19\u0E43\u0E19 Aruba \u0E1B\u0E35 2022 \u0E40\u0E23\u0E37\u0E48\u0E2D\u0E07\u0E01\u0E32\u0E23\u0E1B\u0E23\u0E30\u0E01\u0E27\u0E14\u0E40\u0E1B\u0E47\u0E19\u0E02\u0E48\u0E32\u0E27\u0E43\u0E19\u0E1B\u0E35 2024 \u0E1C\u0E39\u0E49\u0E2A\u0E23\u0E49\u0E32\u0E07\u0E1A\u0E2D\u0E01\u0E27\u0E48\u0E32\u0E20\u0E32\u0E1E\u0E08\u0E23\u0E34\u0E07\u0E44\u0E14\u0E49\u0E17\u0E31\u0E49\u0E07\u0E23\u0E32\u0E07\u0E27\u0E31\u0E25\u0E08\u0E32\u0E01\u0E01\u0E23\u0E23\u0E21\u0E01\u0E32\u0E23\u0E41\u0E25\u0E30\u0E1C\u0E39\u0E49\u0E0A\u0E21\u0E43\u0E19\u0E2B\u0E21\u0E27\u0E14 AI \u0E01\u0E23\u0E13\u0E35\u0E19\u0E35\u0E49\u0E0A\u0E27\u0E19\u0E43\u0E2B\u0E49\u0E40\u0E23\u0E32\u0E04\u0E34\u0E14\u0E27\u0E48\u0E32\u0E40\u0E23\u0E32\u0E43\u0E0A\u0E49\u0E20\u0E32\u0E1E\u0E2B\u0E23\u0E37\u0E2D\u0E43\u0E0A\u0E49\u0E1B\u0E49\u0E32\u0E22\u0E01\u0E33\u0E01\u0E31\u0E1A\u0E15\u0E31\u0E14\u0E2A\u0E34\u0E19\u0E07\u0E32\u0E19", ["flamingo"], "punch"),
    make("03.04", "\u0E1C\u0E25\u0E07\u0E32\u0E19\u0E40\u0E14\u0E34\u0E21\n\u0E1B\u0E49\u0E32\u0E22\u0E43\u0E2B\u0E21\u0E48", "\u0E04\u0E27\u0E32\u0E21\u0E40\u0E0A\u0E37\u0E48\u0E2D\u0E27\u0E48\u0E32\u0E43\u0E04\u0E23\u0E2A\u0E23\u0E49\u0E32\u0E07 \u0E21\u0E35\u0E1C\u0E25\u0E15\u0E48\u0E2D\u0E01\u0E32\u0E23\u0E1B\u0E23\u0E30\u0E40\u0E21\u0E34\u0E19", "attribution", "Human", "ATTRIBUTION BIAS", "Human: \u0E07\u0E32\u0E19\u0E02\u0E2D\u0E07 Grassini \u0E41\u0E25\u0E30 Koivisto \u0E28\u0E36\u0E01\u0E29\u0E32\u0E04\u0E27\u0E32\u0E21\u0E0A\u0E2D\u0E1A\u0E15\u0E48\u0E2D\u0E07\u0E32\u0E19\u0E28\u0E34\u0E25\u0E1B\u0E4C\u0E41\u0E25\u0E30\u0E01\u0E32\u0E23\u0E23\u0E31\u0E1A\u0E23\u0E39\u0E49\u0E41\u0E2B\u0E25\u0E48\u0E07\u0E01\u0E33\u0E40\u0E19\u0E34\u0E14 \u0E40\u0E21\u0E37\u0E48\u0E2D\u0E04\u0E19\u0E40\u0E0A\u0E37\u0E48\u0E2D\u0E27\u0E48\u0E32\u0E07\u0E32\u0E19\u0E21\u0E32\u0E08\u0E32\u0E01 AI \u0E01\u0E32\u0E23\u0E1B\u0E23\u0E30\u0E40\u0E21\u0E34\u0E19\u0E2D\u0E32\u0E08\u0E40\u0E1B\u0E25\u0E35\u0E48\u0E22\u0E19 \u0E41\u0E21\u0E49\u0E41\u0E2B\u0E25\u0E48\u0E07\u0E01\u0E33\u0E40\u0E19\u0E34\u0E14\u0E08\u0E23\u0E34\u0E07\u0E08\u0E30\u0E40\u0E1B\u0E47\u0E19\u0E2D\u0E35\u0E01\u0E41\u0E1A\u0E1A \u0E20\u0E32\u0E1E\u0E43\u0E19\u0E04\u0E34\u0E27\u0E19\u0E35\u0E49\u0E2A\u0E32\u0E18\u0E34\u0E15\u0E41\u0E19\u0E27\u0E04\u0E34\u0E14 \u0E44\u0E21\u0E48\u0E21\u0E35\u0E04\u0E30\u0E41\u0E19\u0E19\u0E1B\u0E23\u0E30\u0E40\u0E21\u0E34\u0E19\u0E17\u0E35\u0E48\u0E41\u0E15\u0E48\u0E07\u0E02\u0E36\u0E49\u0E19 \u0E41\u0E25\u0E30\u0E01\u0E23\u0E13\u0E35 FLAMINGONE \u0E40\u0E1B\u0E47\u0E19\u0E40\u0E23\u0E37\u0E48\u0E2D\u0E07\u0E41\u0E22\u0E01\u0E08\u0E32\u0E01\u0E01\u0E32\u0E23\u0E17\u0E14\u0E25\u0E2D\u0E07", ["attribution"], "arc")
  ] },
  { id: "04", title: "IDEAS", start: 720, end: 955, cues: [
    hold("04.01", "CAPTION &\nPROMPT BATTLE", "GAME 03 \xB7 \u0E14\u0E27\u0E25\u0E41\u0E04\u0E1B\u0E0A\u0E31\u0E48\u0E19", "\u0E1C\u0E39\u0E49\u0E40\u0E25\u0E48\u0E19\u0E40\u0E02\u0E35\u0E22\u0E19\u0E41\u0E04\u0E1B\u0E0A\u0E31\u0E48\u0E19 \u0E2A\u0E48\u0E07\u0E15\u0E23\u0E27\u0E08 \u0E41\u0E25\u0E30\u0E42\u0E2B\u0E27\u0E15\u0E40\u0E25\u0E37\u0E2D\u0E01\u0E15\u0E31\u0E27\u0E41\u0E17\u0E19\u0E01\u0E31\u0E1A\u0E1C\u0E25\u0E07\u0E32\u0E19\u0E01\u0E25\u0E38\u0E48\u0E21\u0E2D\u0E37\u0E48\u0E19\u0E1C\u0E48\u0E32\u0E19\u0E21\u0E37\u0E2D\u0E16\u0E37\u0E2D \u0E08\u0E2D\u0E09\u0E32\u0E22\u0E41\u0E2A\u0E14\u0E07\u0E1C\u0E25\u0E07\u0E32\u0E19\u0E41\u0E25\u0E30\u0E04\u0E30\u0E41\u0E19\u0E19\u0E2A\u0E14 \u0E1C\u0E39\u0E49\u0E08\u0E31\u0E14\u0E15\u0E23\u0E27\u0E08\u0E07\u0E32\u0E19\u0E41\u0E25\u0E49\u0E27\u0E01\u0E14\u0E40\u0E23\u0E34\u0E48\u0E21\u0E41\u0E15\u0E48\u0E25\u0E30\u0E0A\u0E48\u0E27\u0E07\u0E41\u0E25\u0E30\u0E22\u0E37\u0E19\u0E22\u0E31\u0E19\u0E1C\u0E25"),
    make("04.02", "\u0E40\u0E01\u0E48\u0E07\u0E02\u0E36\u0E49\u0E19\u0E23\u0E32\u0E22\u0E04\u0E19", "AI \u0E0A\u0E48\u0E27\u0E22\u0E40\u0E2A\u0E19\u0E2D\u0E44\u0E2D\u0E40\u0E14\u0E35\u0E22 \u0E43\u0E19\u0E01\u0E32\u0E23\u0E17\u0E14\u0E25\u0E2D\u0E07\u0E40\u0E23\u0E37\u0E48\u0E2D\u0E07\u0E2A\u0E31\u0E49\u0E19", "individual", "AI", "INDIVIDUAL ENHANCEMENT", "AI: Doshi \u0E41\u0E25\u0E30 Hauser \u0E43\u0E2B\u0E49\u0E1C\u0E39\u0E49\u0E40\u0E02\u0E49\u0E32\u0E23\u0E48\u0E27\u0E21\u0E40\u0E02\u0E35\u0E22\u0E19\u0E40\u0E23\u0E37\u0E48\u0E2D\u0E07\u0E2A\u0E31\u0E49\u0E19\u0E42\u0E14\u0E22\u0E21\u0E35\u0E2B\u0E23\u0E37\u0E2D\u0E44\u0E21\u0E48\u0E21\u0E35\u0E44\u0E2D\u0E40\u0E14\u0E35\u0E22\u0E08\u0E32\u0E01 AI \u0E01\u0E25\u0E38\u0E48\u0E21\u0E17\u0E35\u0E48\u0E44\u0E14\u0E49\u0E23\u0E31\u0E1A\u0E44\u0E2D\u0E40\u0E14\u0E35\u0E22\u0E2A\u0E32\u0E21\u0E32\u0E23\u0E16\u0E44\u0E14\u0E49\u0E04\u0E30\u0E41\u0E19\u0E19\u0E04\u0E27\u0E32\u0E21\u0E2A\u0E23\u0E49\u0E32\u0E07\u0E2A\u0E23\u0E23\u0E04\u0E4C\u0E14\u0E35\u0E02\u0E36\u0E49\u0E19 \u0E42\u0E14\u0E22\u0E40\u0E09\u0E1E\u0E32\u0E30\u0E1C\u0E39\u0E49\u0E40\u0E02\u0E35\u0E22\u0E19\u0E17\u0E35\u0E48\u0E40\u0E14\u0E34\u0E21\u0E21\u0E35\u0E04\u0E30\u0E41\u0E19\u0E19\u0E15\u0E48\u0E33\u0E01\u0E27\u0E48\u0E32 \u0E40\u0E23\u0E32\u0E15\u0E49\u0E2D\u0E07\u0E23\u0E30\u0E1A\u0E38\u0E1A\u0E23\u0E34\u0E1A\u0E17\u0E27\u0E48\u0E32\u0E40\u0E1B\u0E47\u0E19\u0E40\u0E23\u0E37\u0E48\u0E2D\u0E07\u0E2A\u0E31\u0E49\u0E19\u0E41\u0E25\u0E30\u0E01\u0E32\u0E23\u0E1B\u0E23\u0E30\u0E40\u0E21\u0E34\u0E19\u0E43\u0E19\u0E07\u0E32\u0E19\u0E17\u0E14\u0E25\u0E2D\u0E07 \u0E44\u0E21\u0E48\u0E43\u0E0A\u0E48\u0E1C\u0E25\u0E2A\u0E32\u0E01\u0E25\u0E01\u0E31\u0E1A\u0E17\u0E38\u0E01\u0E2D\u0E32\u0E0A\u0E35\u0E1E", ["diversity"], "punch"),
    make("04.03", "\u0E41\u0E15\u0E48\u0E44\u0E2D\u0E40\u0E14\u0E35\u0E22\n\u0E04\u0E25\u0E49\u0E32\u0E22\u0E01\u0E31\u0E19\u0E21\u0E32\u0E01\u0E02\u0E36\u0E49\u0E19", "\u0E04\u0E38\u0E13\u0E20\u0E32\u0E1E \u0E01\u0E31\u0E1A \u0E04\u0E27\u0E32\u0E21\u0E2B\u0E25\u0E32\u0E01\u0E2B\u0E25\u0E32\u0E22 \u0E40\u0E1B\u0E47\u0E19\u0E04\u0E19\u0E25\u0E30\u0E04\u0E33\u0E16\u0E32\u0E21", "diversity", "Human", "COLLECTIVE DIVERSITY", "Human: \u0E43\u0E19\u0E07\u0E32\u0E19\u0E17\u0E14\u0E25\u0E2D\u0E07\u0E40\u0E14\u0E35\u0E22\u0E27\u0E01\u0E31\u0E19 \u0E40\u0E23\u0E37\u0E48\u0E2D\u0E07\u0E17\u0E35\u0E48\u0E43\u0E0A\u0E49 AI \u0E0A\u0E48\u0E27\u0E22\u0E21\u0E35\u0E04\u0E27\u0E32\u0E21\u0E04\u0E25\u0E49\u0E32\u0E22\u0E01\u0E31\u0E19\u0E21\u0E32\u0E01\u0E02\u0E36\u0E49\u0E19 \u0E19\u0E35\u0E48\u0E40\u0E1B\u0E47\u0E19\u0E02\u0E49\u0E2D\u0E41\u0E25\u0E01\u0E40\u0E1B\u0E25\u0E35\u0E48\u0E22\u0E19\u0E17\u0E35\u0E48\u0E40\u0E23\u0E32\u0E04\u0E27\u0E23\u0E21\u0E2D\u0E07\u0E40\u0E2B\u0E47\u0E19 \u0E44\u0E21\u0E48\u0E44\u0E14\u0E49\u0E41\u0E1B\u0E25\u0E27\u0E48\u0E32\u0E2A\u0E31\u0E07\u0E04\u0E21\u0E17\u0E31\u0E49\u0E07\u0E42\u0E25\u0E01\u0E2A\u0E39\u0E0D\u0E40\u0E2A\u0E35\u0E22\u0E04\u0E27\u0E32\u0E21\u0E04\u0E34\u0E14\u0E2A\u0E23\u0E49\u0E32\u0E07\u0E2A\u0E23\u0E23\u0E04\u0E4C\u0E17\u0E31\u0E19\u0E17\u0E35 \u0E25\u0E2D\u0E07\u0E43\u0E0A\u0E49 AI \u0E2A\u0E23\u0E49\u0E32\u0E07\u0E17\u0E32\u0E07\u0E40\u0E25\u0E37\u0E2D\u0E01 \u0E41\u0E25\u0E49\u0E27\u0E15\u0E31\u0E49\u0E07\u0E43\u0E08\u0E04\u0E49\u0E19\u0E2B\u0E32\u0E21\u0E38\u0E21\u0E17\u0E35\u0E48\u0E15\u0E48\u0E32\u0E07\u0E41\u0E25\u0E30\u0E40\u0E2B\u0E21\u0E32\u0E30\u0E01\u0E31\u0E1A\u0E40\u0E23\u0E32", ["diversity"], "arc")
  ] },
  { id: "05", title: "ACT 1 RESULTS", start: 955, end: 960, cues: [hold("05.01", "FLASH LEADERBOARD", "ACT 01 \xB7 \u0E2A\u0E23\u0E38\u0E1B\u0E2D\u0E31\u0E19\u0E14\u0E31\u0E1A", "\u0E0A\u0E48\u0E27\u0E07\u0E04\u0E30\u0E41\u0E19\u0E19 5 \u0E27\u0E34\u0E19\u0E32\u0E17\u0E35\u0E15\u0E32\u0E21\u0E04\u0E34\u0E27\u0E1A\u0E17 \u0E1C\u0E39\u0E49\u0E04\u0E27\u0E1A\u0E04\u0E38\u0E21\u0E01\u0E14\u0E40\u0E1B\u0E25\u0E35\u0E48\u0E22\u0E19\u0E40\u0E2D\u0E07 \u0E44\u0E21\u0E48\u0E21\u0E35\u0E04\u0E30\u0E41\u0E19\u0E19\u0E2B\u0E23\u0E37\u0E2D\u0E2D\u0E31\u0E19\u0E14\u0E31\u0E1A\u0E2A\u0E21\u0E21\u0E15\u0E34")] },
  { id: "06", title: "THE FRONTIER", start: 960, end: 1320, cues: [
    make("06.01", "\u0E40\u0E21\u0E37\u0E48\u0E2D AI\n\u0E04\u0E49\u0E19\u0E1E\u0E1A\u0E17\u0E32\u0E07\u0E25\u0E31\u0E14", "AlphaTensor \xB7 Matrix multiplication", "tensor", "AI", "THE POWER OF FORMAL REASONING", "AI: AlphaTensor \u0E04\u0E49\u0E19\u0E2B\u0E32\u0E2D\u0E31\u0E25\u0E01\u0E2D\u0E23\u0E34\u0E17\u0E36\u0E21\u0E04\u0E39\u0E13\u0E40\u0E21\u0E17\u0E23\u0E34\u0E01\u0E0B\u0E4C\u0E17\u0E35\u0E48\u0E21\u0E35\u0E1B\u0E23\u0E30\u0E2A\u0E34\u0E17\u0E18\u0E34\u0E20\u0E32\u0E1E\u0E02\u0E36\u0E49\u0E19\u0E43\u0E19\u0E01\u0E23\u0E13\u0E35\u0E17\u0E35\u0E48\u0E28\u0E36\u0E01\u0E29\u0E32 \u0E1C\u0E25\u0E07\u0E32\u0E19 Nature \u0E1B\u0E35 2022 \u0E41\u0E2A\u0E14\u0E07\u0E27\u0E48\u0E32\u0E01\u0E32\u0E23\u0E04\u0E49\u0E19\u0E2B\u0E32\u0E40\u0E0A\u0E34\u0E07\u0E04\u0E33\u0E19\u0E27\u0E13\u0E0A\u0E48\u0E27\u0E22\u0E04\u0E49\u0E19\u0E1E\u0E1A\u0E27\u0E34\u0E18\u0E35\u0E17\u0E35\u0E48\u0E21\u0E19\u0E38\u0E29\u0E22\u0E4C\u0E2D\u0E32\u0E08\u0E44\u0E21\u0E48\u0E1E\u0E1A\u0E07\u0E48\u0E32\u0E22 \u0E46 \u0E15\u0E32\u0E23\u0E32\u0E07\u0E19\u0E35\u0E49\u0E2D\u0E18\u0E34\u0E1A\u0E32\u0E22\u0E41\u0E19\u0E27\u0E04\u0E34\u0E14 \u0E44\u0E21\u0E48\u0E43\u0E0A\u0E48\u0E01\u0E32\u0E23\u0E2A\u0E32\u0E18\u0E34\u0E15\u0E2D\u0E31\u0E25\u0E01\u0E2D\u0E23\u0E34\u0E17\u0E36\u0E21\u0E08\u0E23\u0E34\u0E07", ["tensor"], "push"),
    make("06.02", "\u0E08\u0E32\u0E01\u0E25\u0E33\u0E14\u0E31\u0E1A\n\u0E2A\u0E39\u0E48\u0E42\u0E04\u0E23\u0E07\u0E2A\u0E23\u0E49\u0E32\u0E07", "\u0E2D\u0E2D\u0E01\u0E41\u0E1A\u0E1A\u0E41\u0E25\u0E30\u0E17\u0E33\u0E19\u0E32\u0E22\u0E42\u0E1B\u0E23\u0E15\u0E35\u0E19 \xB7 \u0E42\u0E19\u0E40\u0E1A\u0E25\u0E40\u0E04\u0E21\u0E35 2024", "protein", "AI", "A SCIENTIFIC BREAKTHROUGH", "AI: \u0E42\u0E19\u0E40\u0E1A\u0E25\u0E40\u0E04\u0E21\u0E35\u0E1B\u0E35 2024 \u0E41\u0E1A\u0E48\u0E07\u0E23\u0E30\u0E2B\u0E27\u0E48\u0E32\u0E07 David Baker \u0E14\u0E49\u0E32\u0E19\u0E2D\u0E2D\u0E01\u0E41\u0E1A\u0E1A\u0E42\u0E1B\u0E23\u0E15\u0E35\u0E19 \u0E41\u0E25\u0E30 Demis Hassabis \u0E01\u0E31\u0E1A John Jumper \u0E14\u0E49\u0E32\u0E19\u0E17\u0E33\u0E19\u0E32\u0E22\u0E42\u0E04\u0E23\u0E07\u0E2A\u0E23\u0E49\u0E32\u0E07 \u0E40\u0E2D\u0E01\u0E2A\u0E32\u0E23\u0E23\u0E32\u0E07\u0E27\u0E31\u0E25\u0E01\u0E25\u0E48\u0E32\u0E27\u0E16\u0E36\u0E07 AlphaFold2 \u0E15\u0E49\u0E2D\u0E07\u0E41\u0E22\u0E01\u0E08\u0E32\u0E01 AlphaFold3 \u0E17\u0E35\u0E48\u0E40\u0E1B\u0E47\u0E19\u0E07\u0E32\u0E19\u0E2D\u0E35\u0E01\u0E0A\u0E34\u0E49\u0E19 \u0E20\u0E32\u0E1E\u0E2A\u0E32\u0E22\u0E42\u0E21\u0E40\u0E25\u0E01\u0E38\u0E25\u0E19\u0E35\u0E49\u0E40\u0E1B\u0E47\u0E19\u0E20\u0E32\u0E1E\u0E2D\u0E18\u0E34\u0E1A\u0E32\u0E22 \u0E44\u0E21\u0E48\u0E43\u0E0A\u0E48\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E42\u0E04\u0E23\u0E07\u0E2A\u0E23\u0E49\u0E32\u0E07\u0E02\u0E2D\u0E07\u0E42\u0E1B\u0E23\u0E15\u0E35\u0E19\u0E08\u0E23\u0E34\u0E07", ["nobel"], "arc"),
    make("06.03", "\u0E42\u0E25\u0E01\u0E08\u0E23\u0E34\u0E07\n\u0E44\u0E21\u0E48\u0E43\u0E0A\u0E48\u0E42\u0E08\u0E17\u0E22\u0E4C\u0E1B\u0E34\u0E14", "\u0E1A\u0E23\u0E34\u0E1A\u0E17 \xB7 \u0E40\u0E1B\u0E49\u0E32\u0E2B\u0E21\u0E32\u0E22 \xB7 \u0E1C\u0E39\u0E49\u0E04\u0E19", "strategy", "Human", "BEYOND THE EQUATION", "Human: \u0E40\u0E21\u0E37\u0E48\u0E2D\u0E42\u0E08\u0E17\u0E22\u0E4C\u0E40\u0E1B\u0E25\u0E35\u0E48\u0E22\u0E19\u0E08\u0E32\u0E01\u0E04\u0E33\u0E19\u0E27\u0E13\u0E40\u0E1B\u0E47\u0E19\u0E01\u0E32\u0E23\u0E15\u0E31\u0E14\u0E2A\u0E34\u0E19\u0E43\u0E08 \u0E40\u0E23\u0E32\u0E15\u0E49\u0E2D\u0E07\u0E23\u0E39\u0E49\u0E1A\u0E23\u0E34\u0E1A\u0E17 \u0E40\u0E1B\u0E49\u0E32\u0E2B\u0E21\u0E32\u0E22 \u0E41\u0E25\u0E30\u0E1C\u0E25\u0E01\u0E23\u0E30\u0E17\u0E1A\u0E15\u0E48\u0E2D\u0E1C\u0E39\u0E49\u0E04\u0E19 \u0E04\u0E27\u0E32\u0E21\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08\u0E43\u0E19\u0E42\u0E08\u0E17\u0E22\u0E4C\u0E2B\u0E19\u0E36\u0E48\u0E07\u0E08\u0E36\u0E07\u0E44\u0E21\u0E48\u0E23\u0E31\u0E1A\u0E1B\u0E23\u0E30\u0E01\u0E31\u0E19\u0E42\u0E08\u0E17\u0E22\u0E4C\u0E02\u0E49\u0E32\u0E07\u0E40\u0E04\u0E35\u0E22\u0E07 \u0E04\u0E34\u0E27\u0E19\u0E35\u0E49\u0E40\u0E1B\u0E47\u0E19\u0E01\u0E23\u0E2D\u0E1A\u0E2D\u0E18\u0E34\u0E1A\u0E32\u0E22 \u0E44\u0E21\u0E48\u0E2D\u0E49\u0E32\u0E07\u0E07\u0E32\u0E19 Brookins \u0E17\u0E35\u0E48\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E44\u0E14\u0E49\u0E22\u0E37\u0E19\u0E22\u0E31\u0E19"),
    make("06.04", "\u0E04\u0E27\u0E32\u0E21\u0E40\u0E01\u0E48\u0E07\n\u0E44\u0E21\u0E48\u0E44\u0E14\u0E49\u0E40\u0E1B\u0E47\u0E19\u0E40\u0E2A\u0E49\u0E19\u0E15\u0E23\u0E07", "The Jagged Technological Frontier", "frontier", "Human", "A SMALL STEP CAN CROSS THE BOUNDARY", "Human: \u0E07\u0E32\u0E19\u0E01\u0E31\u0E1A\u0E17\u0E35\u0E48\u0E1B\u0E23\u0E36\u0E01\u0E29\u0E32 BCG 758 \u0E04\u0E19\u0E40\u0E2A\u0E19\u0E2D\u0E20\u0E32\u0E1E\u0E02\u0E2D\u0E1A\u0E40\u0E02\u0E15\u0E04\u0E27\u0E32\u0E21\u0E2A\u0E32\u0E21\u0E32\u0E23\u0E16\u0E17\u0E35\u0E48\u0E2B\u0E22\u0E31\u0E01 \u0E44\u0E21\u0E48\u0E43\u0E0A\u0E48\u0E40\u0E2A\u0E49\u0E19\u0E15\u0E23\u0E07 \u0E1A\u0E32\u0E07\u0E07\u0E32\u0E19 AI \u0E0A\u0E48\u0E27\u0E22\u0E21\u0E32\u0E01 \u0E07\u0E32\u0E19\u0E17\u0E35\u0E48\u0E14\u0E39\u0E43\u0E01\u0E25\u0E49\u0E40\u0E04\u0E35\u0E22\u0E07\u0E01\u0E31\u0E19\u0E2D\u0E32\u0E08\u0E2D\u0E22\u0E39\u0E48\u0E2D\u0E35\u0E01\u0E1D\u0E31\u0E48\u0E07\u0E02\u0E2D\u0E07\u0E02\u0E2D\u0E1A\u0E40\u0E02\u0E15 \u0E23\u0E39\u0E1B\u0E2B\u0E19\u0E49\u0E32\u0E1C\u0E32\u0E40\u0E1B\u0E47\u0E19\u0E41\u0E1C\u0E19\u0E20\u0E32\u0E1E\u0E40\u0E0A\u0E34\u0E07\u0E41\u0E19\u0E27\u0E04\u0E34\u0E14 \u0E44\u0E21\u0E48\u0E43\u0E0A\u0E48\u0E01\u0E23\u0E32\u0E1F\u0E04\u0E48\u0E32\u0E1B\u0E23\u0E30\u0E2A\u0E34\u0E17\u0E18\u0E34\u0E20\u0E32\u0E1E\u0E17\u0E35\u0E48\u0E27\u0E31\u0E14\u0E15\u0E32\u0E21\u0E41\u0E01\u0E19\u0E19\u0E35\u0E49", ["frontier"], "dolly"),
    make("06.05", "\u0E43\u0E19\u0E02\u0E2D\u0E1A\u0E40\u0E02\u0E15\n\u0E0A\u0E48\u0E27\u0E22\u0E44\u0E14\u0E49\u0E21\u0E32\u0E01", "\u0E23\u0E30\u0E1A\u0E38\u0E43\u0E2B\u0E49\u0E0A\u0E31\u0E14\u0E27\u0E48\u0E32 \u201C\u0E14\u0E35\u0E02\u0E36\u0E49\u0E19\u201D \u0E27\u0E31\u0E14\u0E2D\u0E30\u0E44\u0E23", "frontier-data", "Human", "QUALITY \u2260 SPEED", "Human: \u0E43\u0E19 working paper \u0E1B\u0E35 2023 \u0E17\u0E35\u0E48\u0E2A\u0E16\u0E32\u0E1A\u0E31\u0E19\u0E1C\u0E39\u0E49\u0E27\u0E34\u0E08\u0E31\u0E22\u0E2A\u0E23\u0E38\u0E1B\u0E44\u0E27\u0E49 \u0E07\u0E32\u0E19\u0E43\u0E19\u0E02\u0E2D\u0E1A\u0E40\u0E02\u0E15\u0E21\u0E35\u0E04\u0E38\u0E13\u0E20\u0E32\u0E1E\u0E08\u0E32\u0E01\u0E1C\u0E39\u0E49\u0E1B\u0E23\u0E30\u0E40\u0E21\u0E34\u0E19\u0E2A\u0E39\u0E07\u0E02\u0E36\u0E49\u0E19\u0E01\u0E27\u0E48\u0E32 40% \u0E17\u0E33\u0E07\u0E32\u0E19\u0E40\u0E23\u0E47\u0E27\u0E02\u0E36\u0E49\u0E19\u0E01\u0E27\u0E48\u0E32 25% \u0E41\u0E25\u0E30\u0E17\u0E33\u0E07\u0E32\u0E19\u0E40\u0E2A\u0E23\u0E47\u0E08\u0E21\u0E32\u0E01\u0E02\u0E36\u0E49\u0E19\u0E01\u0E27\u0E48\u0E32 12% \u0E15\u0E31\u0E27\u0E40\u0E25\u0E02\u0E40\u0E2B\u0E25\u0E48\u0E32\u0E19\u0E35\u0E49\u0E04\u0E19\u0E25\u0E30\u0E15\u0E31\u0E27\u0E0A\u0E35\u0E49\u0E27\u0E31\u0E14 \u0E2B\u0E49\u0E32\u0E21\u0E1E\u0E39\u0E14\u0E27\u0E48\u0E32\u0E40\u0E23\u0E47\u0E27\u0E02\u0E36\u0E49\u0E19 40% \u0E1C\u0E25\u0E19\u0E2D\u0E01\u0E02\u0E2D\u0E1A\u0E40\u0E02\u0E15\u0E15\u0E49\u0E2D\u0E07\u0E1E\u0E34\u0E08\u0E32\u0E23\u0E13\u0E32\u0E42\u0E08\u0E17\u0E22\u0E4C\u0E41\u0E25\u0E30\u0E09\u0E1A\u0E31\u0E1A\u0E07\u0E32\u0E19\u0E27\u0E34\u0E08\u0E31\u0E22 \u0E44\u0E21\u0E48\u0E43\u0E0A\u0E49\u0E40\u0E1B\u0E47\u0E19\u0E04\u0E48\u0E32\u0E01\u0E32\u0E23\u0E1E\u0E31\u0E07\u0E2A\u0E32\u0E01\u0E25", ["frontier"], "punch")
  ] },
  { id: "07", title: "CONFIDENCE", start: 1320, end: 1555, cues: [
    hold("07.01", "DEATH CAP\nROULETTE", "GAME 04 \xB7 \u0E40\u0E0A\u0E37\u0E48\u0E2D\u0E41\u0E25\u0E49\u0E27\u0E23\u0E2D\u0E14 / \u0E40\u0E0A\u0E37\u0E48\u0E2D\u0E1C\u0E34\u0E14\u0E15\u0E01\u0E23\u0E2D\u0E1A", "\u0E2A\u0E16\u0E32\u0E19\u0E01\u0E32\u0E23\u0E13\u0E4C\u0E08\u0E33\u0E25\u0E2D\u0E07 6 \u0E14\u0E48\u0E32\u0E19 \u0E43\u0E2B\u0E49\u0E40\u0E25\u0E37\u0E2D\u0E01\u0E40\u0E0A\u0E37\u0E48\u0E2D\u0E2B\u0E23\u0E37\u0E2D\u0E44\u0E21\u0E48\u0E40\u0E0A\u0E37\u0E48\u0E2D\u0E43\u0E19 4 \u0E27\u0E34\u0E19\u0E32\u0E17\u0E35 \u0E40\u0E0A\u0E37\u0E48\u0E2D\u0E16\u0E39\u0E01\u0E44\u0E14\u0E49 300 \u0E44\u0E21\u0E48\u0E40\u0E0A\u0E37\u0E48\u0E2D\u0E02\u0E49\u0E2D\u0E1C\u0E34\u0E14\u0E44\u0E14\u0E49 100 \u0E40\u0E0A\u0E37\u0E48\u0E2D\u0E1C\u0E34\u0E14\u0E15\u0E32\u0E22 \u0E15\u0E01\u0E23\u0E2D\u0E1A\u0E41\u0E25\u0E30\u0E04\u0E30\u0E41\u0E19\u0E19\u0E40\u0E09\u0E1E\u0E32\u0E30\u0E40\u0E01\u0E21\u0E19\u0E35\u0E49\u0E40\u0E1B\u0E47\u0E19 0 \u0E1C\u0E39\u0E49\u0E15\u0E32\u0E22\u0E14\u0E39\u0E15\u0E48\u0E2D\u0E41\u0E25\u0E30\u0E01\u0E25\u0E31\u0E1A\u0E40\u0E25\u0E48\u0E19\u0E40\u0E01\u0E21 5 \u0E44\u0E14\u0E49 \u0E44\u0E21\u0E48\u0E15\u0E2D\u0E1A\u0E23\u0E2D\u0E14\u0E44\u0E14\u0E49 0 \u0E44\u0E21\u0E48\u0E2D\u0E49\u0E32\u0E07\u0E1C\u0E39\u0E49\u0E40\u0E2A\u0E35\u0E22\u0E0A\u0E35\u0E27\u0E34\u0E15\u0E08\u0E23\u0E34\u0E07\u0E2B\u0E23\u0E37\u0E2D\u0E1C\u0E25\u0E08\u0E33\u0E41\u0E19\u0E01\u0E40\u0E2B\u0E47\u0E14\u0E08\u0E32\u0E01 AI \u0E40\u0E01\u0E08\u0E04\u0E27\u0E32\u0E21\u0E21\u0E31\u0E48\u0E19\u0E43\u0E08\u0E40\u0E1B\u0E47\u0E19\u0E04\u0E48\u0E32\u0E08\u0E33\u0E25\u0E2D\u0E07"),
    make("07.02", "\u0E21\u0E31\u0E48\u0E19\u0E43\u0E08\u0E21\u0E32\u0E01\n\u0E44\u0E21\u0E48\u0E44\u0E14\u0E49\u0E41\u0E1B\u0E25\u0E27\u0E48\u0E32\u0E16\u0E39\u0E01", "Confidence \u2260 Correctness", "mushroom", "Human", "99.8% CAN STILL BE THE WRONG ANSWER", "Human: \u0E20\u0E32\u0E1E\u0E19\u0E35\u0E49\u0E40\u0E1B\u0E47\u0E19\u0E40\u0E2B\u0E47\u0E14 Amanita phalloides \u0E2A\u0E48\u0E27\u0E19\u0E40\u0E01\u0E08 99.8% \u0E40\u0E1B\u0E47\u0E19\u0E04\u0E48\u0E32\u0E17\u0E35\u0E48\u0E2A\u0E23\u0E49\u0E32\u0E07\u0E2A\u0E33\u0E2B\u0E23\u0E31\u0E1A\u0E2A\u0E16\u0E32\u0E19\u0E01\u0E32\u0E23\u0E13\u0E4C\u0E08\u0E33\u0E25\u0E2D\u0E07 \u0E44\u0E21\u0E48\u0E43\u0E0A\u0E48\u0E1C\u0E25\u0E23\u0E30\u0E1A\u0E38\u0E0A\u0E19\u0E34\u0E14\u0E40\u0E2B\u0E47\u0E14\u0E08\u0E32\u0E01\u0E23\u0E30\u0E1A\u0E1A\u0E08\u0E23\u0E34\u0E07 \u0E19\u0E49\u0E33\u0E40\u0E2A\u0E35\u0E22\u0E07\u0E41\u0E25\u0E30\u0E15\u0E31\u0E27\u0E40\u0E25\u0E02\u0E04\u0E27\u0E32\u0E21\u0E21\u0E31\u0E48\u0E19\u0E43\u0E08\u0E44\u0E21\u0E48\u0E41\u0E17\u0E19\u0E2B\u0E25\u0E31\u0E01\u0E10\u0E32\u0E19 \u0E2D\u0E22\u0E48\u0E32\u0E43\u0E0A\u0E49\u0E20\u0E32\u0E1E\u0E19\u0E35\u0E49\u0E2B\u0E23\u0E37\u0E2D\u0E41\u0E0A\u0E15\u0E1A\u0E2D\u0E15\u0E15\u0E31\u0E14\u0E2A\u0E34\u0E19\u0E43\u0E08\u0E01\u0E34\u0E19\u0E40\u0E2B\u0E47\u0E14\u0E1B\u0E48\u0E32 \u0E40\u0E23\u0E32\u0E01\u0E33\u0E25\u0E31\u0E07\u0E40\u0E23\u0E35\u0E22\u0E19\u0E23\u0E39\u0E49\u0E40\u0E23\u0E37\u0E48\u0E2D\u0E07\u0E01\u0E32\u0E23\u0E15\u0E23\u0E27\u0E08\u0E04\u0E33\u0E15\u0E2D\u0E1A \u0E44\u0E21\u0E48\u0E44\u0E14\u0E49\u0E1D\u0E36\u0E01\u0E23\u0E30\u0E1A\u0E38\u0E40\u0E2B\u0E47\u0E14", ["mushroom"], "dolly")
  ] },
  { id: "08", title: "ACT 2 RESULTS", start: 1555, end: 1560, cues: [hold("08.01", "SURVIVOR RANKINGS", "ACT 02 \xB7 \u0E2A\u0E23\u0E38\u0E1B\u0E2D\u0E31\u0E19\u0E14\u0E31\u0E1A", "\u0E04\u0E34\u0E27\u0E04\u0E30\u0E41\u0E19\u0E19 5 \u0E27\u0E34\u0E19\u0E32\u0E17\u0E35 \u0E1C\u0E39\u0E49\u0E04\u0E27\u0E1A\u0E04\u0E38\u0E21\u0E40\u0E1B\u0E25\u0E35\u0E48\u0E22\u0E19\u0E15\u0E32\u0E21\u0E1C\u0E39\u0E49\u0E1E\u0E39\u0E14 \u0E44\u0E21\u0E48\u0E41\u0E2A\u0E14\u0E07\u0E1C\u0E25\u0E1C\u0E39\u0E49\u0E0A\u0E19\u0E30\u0E17\u0E35\u0E48\u0E41\u0E15\u0E48\u0E07\u0E02\u0E36\u0E49\u0E19")] },
  { id: "09", title: "EMPATHY", start: 1560, end: 1830, cues: [
    make("09.01", "\u0E1F\u0E31\u0E07\u0E14\u0E39\u0E2D\u0E1A\u0E2D\u0E38\u0E48\u0E19\n\u0E41\u0E25\u0E49\u0E27\u0E40\u0E0A\u0E37\u0E48\u0E2D\u0E43\u0E08\u0E44\u0E14\u0E49\u0E44\u0E2B\u0E21?", "The Illusion of Empathy", "chat", "AI", "WORDS THAT FEEL HUMAN", "AI: \u0E02\u0E49\u0E2D\u0E04\u0E27\u0E32\u0E21\u0E17\u0E35\u0E48\u0E2A\u0E38\u0E20\u0E32\u0E1E\u0E41\u0E25\u0E30\u0E23\u0E31\u0E1A\u0E1F\u0E31\u0E07\u0E2A\u0E32\u0E21\u0E32\u0E23\u0E16\u0E17\u0E33\u0E43\u0E2B\u0E49\u0E1C\u0E39\u0E49\u0E43\u0E0A\u0E49\u0E23\u0E39\u0E49\u0E2A\u0E36\u0E01\u0E2A\u0E1A\u0E32\u0E22\u0E43\u0E08 \u0E15\u0E31\u0E27\u0E2D\u0E22\u0E48\u0E32\u0E07\u0E1A\u0E19\u0E08\u0E2D\u0E40\u0E02\u0E35\u0E22\u0E19\u0E02\u0E36\u0E49\u0E19\u0E40\u0E1E\u0E37\u0E48\u0E2D\u0E2D\u0E18\u0E34\u0E1A\u0E32\u0E22\u0E01\u0E32\u0E23\u0E2A\u0E37\u0E48\u0E2D\u0E2A\u0E32\u0E23 \u0E44\u0E21\u0E48\u0E43\u0E0A\u0E48\u0E04\u0E33\u0E41\u0E19\u0E30\u0E19\u0E33\u0E23\u0E31\u0E01\u0E29\u0E32 \u0E40\u0E23\u0E32\u0E15\u0E49\u0E2D\u0E07\u0E16\u0E32\u0E21\u0E15\u0E48\u0E2D\u0E27\u0E48\u0E32\u0E04\u0E27\u0E32\u0E21\u0E23\u0E39\u0E49\u0E2A\u0E36\u0E01\u0E08\u0E32\u0E01\u0E02\u0E49\u0E2D\u0E04\u0E27\u0E32\u0E21\u0E40\u0E17\u0E48\u0E32\u0E01\u0E31\u0E1A\u0E04\u0E38\u0E13\u0E20\u0E32\u0E1E\u0E01\u0E32\u0E23\u0E14\u0E39\u0E41\u0E25\u0E43\u0E19\u0E42\u0E25\u0E01\u0E08\u0E23\u0E34\u0E07\u0E2B\u0E23\u0E37\u0E2D\u0E44\u0E21\u0E48"),
    make("09.02", "\u0E04\u0E33\u0E15\u0E2D\u0E1A\u0E17\u0E35\u0E48\n\u0E1C\u0E39\u0E49\u0E1B\u0E23\u0E30\u0E40\u0E21\u0E34\u0E19\u0E40\u0E25\u0E37\u0E2D\u0E01", "78.6% \u0E40\u0E25\u0E37\u0E2D\u0E01\u0E04\u0E33\u0E15\u0E2D\u0E1A chatbot \u0E43\u0E19\u0E07\u0E32\u0E19 Ayers", "empathy", "AI", "PERCEIVED QUALITY & EMPATHY", "AI: Ayers \u0E41\u0E25\u0E30\u0E04\u0E13\u0E30\u0E43\u0E0A\u0E49\u0E04\u0E33\u0E16\u0E32\u0E21 195 \u0E02\u0E49\u0E2D \u0E1C\u0E39\u0E49\u0E40\u0E0A\u0E35\u0E48\u0E22\u0E27\u0E0A\u0E32\u0E0D\u0E2A\u0E38\u0E02\u0E20\u0E32\u0E1E\u0E1B\u0E23\u0E30\u0E40\u0E21\u0E34\u0E19\u0E04\u0E33\u0E15\u0E2D\u0E1A\u0E23\u0E27\u0E21 585 \u0E04\u0E23\u0E31\u0E49\u0E07 \u0E41\u0E25\u0E30\u0E40\u0E25\u0E37\u0E2D\u0E01 chatbot 78.6% \u0E02\u0E2D\u0E07\u0E01\u0E32\u0E23\u0E1B\u0E23\u0E30\u0E40\u0E21\u0E34\u0E19 \u0E19\u0E35\u0E48\u0E04\u0E37\u0E2D\u0E01\u0E32\u0E23\u0E1B\u0E23\u0E30\u0E40\u0E21\u0E34\u0E19\u0E02\u0E49\u0E2D\u0E04\u0E27\u0E32\u0E21 \u0E44\u0E21\u0E48\u0E43\u0E0A\u0E48\u0E04\u0E19\u0E44\u0E02\u0E49\u0E25\u0E07\u0E04\u0E30\u0E41\u0E19\u0E19 \u0E41\u0E25\u0E30\u0E44\u0E21\u0E48\u0E43\u0E0A\u0E48\u0E1C\u0E25\u0E01\u0E32\u0E23\u0E23\u0E31\u0E01\u0E29\u0E32 \u0E40\u0E23\u0E32\u0E23\u0E31\u0E1A\u0E1C\u0E25\u0E40\u0E23\u0E37\u0E48\u0E2D\u0E07\u0E01\u0E32\u0E23\u0E2A\u0E37\u0E48\u0E2D\u0E2A\u0E32\u0E23\u0E44\u0E14\u0E49\u0E1E\u0E23\u0E49\u0E2D\u0E21\u0E01\u0E31\u0E1A\u0E23\u0E31\u0E01\u0E29\u0E32\u0E02\u0E2D\u0E1A\u0E40\u0E02\u0E15\u0E02\u0E2D\u0E07\u0E02\u0E49\u0E2D\u0E2A\u0E23\u0E38\u0E1B", ["ayers"], "punch"),
    make("09.03", "\u0E02\u0E49\u0E2D\u0E04\u0E27\u0E32\u0E21\u0E17\u0E35\u0E48\u0E2D\u0E1A\u0E2D\u0E38\u0E48\u0E19\n\u0E22\u0E31\u0E07\u0E15\u0E49\u0E2D\u0E07\u0E15\u0E23\u0E27\u0E08\u0E2A\u0E2D\u0E1A", "\u0E01\u0E32\u0E23\u0E23\u0E31\u0E1A\u0E23\u0E39\u0E49\u0E04\u0E27\u0E32\u0E21\u0E40\u0E2B\u0E47\u0E19\u0E2D\u0E01\u0E40\u0E2B\u0E47\u0E19\u0E43\u0E08 \u2260 \u0E1C\u0E25\u0E01\u0E32\u0E23\u0E14\u0E39\u0E41\u0E25", "tokens", "Human", "LANGUAGE. CONTEXT. CONSEQUENCES.", "Human: \u0E07\u0E32\u0E19\u0E1B\u0E23\u0E30\u0E40\u0E21\u0E34\u0E19\u0E02\u0E49\u0E2D\u0E04\u0E27\u0E32\u0E21\u0E44\u0E21\u0E48\u0E44\u0E14\u0E49\u0E1E\u0E34\u0E2A\u0E39\u0E08\u0E19\u0E4C\u0E27\u0E48\u0E32\u0E23\u0E30\u0E1A\u0E1A\u0E21\u0E35\u0E04\u0E27\u0E32\u0E21\u0E23\u0E39\u0E49\u0E2A\u0E36\u0E01 \u0E2B\u0E23\u0E37\u0E2D\u0E2A\u0E32\u0E21\u0E32\u0E23\u0E16\u0E23\u0E31\u0E1A\u0E1C\u0E34\u0E14\u0E0A\u0E2D\u0E1A\u0E01\u0E32\u0E23\u0E14\u0E39\u0E41\u0E25 \u0E1C\u0E39\u0E49\u0E43\u0E0A\u0E49\u0E15\u0E49\u0E2D\u0E07\u0E1E\u0E34\u0E08\u0E32\u0E23\u0E13\u0E32\u0E1A\u0E23\u0E34\u0E1A\u0E17 \u0E04\u0E27\u0E32\u0E21\u0E40\u0E2A\u0E35\u0E48\u0E22\u0E07 \u0E41\u0E25\u0E30\u0E01\u0E32\u0E23\u0E2A\u0E48\u0E07\u0E15\u0E48\u0E2D\u0E43\u0E2B\u0E49\u0E04\u0E19\u0E17\u0E35\u0E48\u0E40\u0E2B\u0E21\u0E32\u0E30\u0E2A\u0E21 \u0E01\u0E32\u0E23\u0E08\u0E33\u0E25\u0E2D\u0E07 next-token \u0E1A\u0E19\u0E08\u0E2D\u0E2D\u0E18\u0E34\u0E1A\u0E32\u0E22\u0E01\u0E25\u0E44\u0E01\u0E17\u0E32\u0E07\u0E20\u0E32\u0E29\u0E32\u0E2D\u0E22\u0E48\u0E32\u0E07\u0E22\u0E48\u0E2D \u0E44\u0E21\u0E48\u0E43\u0E0A\u0E48\u0E04\u0E33\u0E2D\u0E18\u0E34\u0E1A\u0E32\u0E22\u0E04\u0E23\u0E1A\u0E17\u0E38\u0E01\u0E2D\u0E07\u0E04\u0E4C\u0E1B\u0E23\u0E30\u0E01\u0E2D\u0E1A\u0E02\u0E2D\u0E07 AI \u0E41\u0E25\u0E30\u0E44\u0E21\u0E48\u0E43\u0E0A\u0E49\u0E02\u0E49\u0E2D\u0E2D\u0E49\u0E32\u0E07 Kask \u0E17\u0E35\u0E48\u0E22\u0E31\u0E07\u0E22\u0E37\u0E19\u0E22\u0E31\u0E19\u0E44\u0E21\u0E48\u0E44\u0E14\u0E49", ["ayers"], "arc")
  ] },
  { id: "10", title: "VERIFICATION", start: 1830, end: 2070, cues: [
    make("10.01", "\u0E04\u0E33\u0E41\u0E19\u0E30\u0E19\u0E33\u0E17\u0E35\u0E48\u0E14\u0E35\n\u0E15\u0E49\u0E2D\u0E07\u0E14\u0E35\u0E43\u0E19\u0E1A\u0E23\u0E34\u0E1A\u0E17\u0E14\u0E49\u0E27\u0E22", "Tessa \xB7 NEDA \xB7 \u0E23\u0E30\u0E1A\u0E1A\u0E17\u0E35\u0E48\u0E16\u0E39\u0E01\u0E23\u0E30\u0E07\u0E31\u0E1A\u0E43\u0E19\u0E1B\u0E35 2023", "tessa", "Human", "WHEN CONTEXT CHANGES THE RISK", "Human: \u0E43\u0E19\u0E40\u0E14\u0E37\u0E2D\u0E19\u0E1E\u0E24\u0E29\u0E20\u0E32\u0E04\u0E21 2023 NEDA \u0E23\u0E30\u0E07\u0E31\u0E1A Tessa \u0E2B\u0E25\u0E31\u0E07\u0E21\u0E35\u0E23\u0E32\u0E22\u0E07\u0E32\u0E19\u0E04\u0E33\u0E41\u0E19\u0E30\u0E19\u0E33\u0E40\u0E01\u0E35\u0E48\u0E22\u0E27\u0E01\u0E31\u0E1A\u0E25\u0E14\u0E19\u0E49\u0E33\u0E2B\u0E19\u0E31\u0E01\u0E17\u0E35\u0E48\u0E2D\u0E32\u0E08\u0E40\u0E1B\u0E47\u0E19\u0E2D\u0E31\u0E19\u0E15\u0E23\u0E32\u0E22\u0E43\u0E19\u0E1A\u0E23\u0E34\u0E1A\u0E17\u0E04\u0E27\u0E32\u0E21\u0E1C\u0E34\u0E14\u0E1B\u0E01\u0E15\u0E34\u0E01\u0E32\u0E23\u0E01\u0E34\u0E19 \u0E23\u0E32\u0E22\u0E07\u0E32\u0E19\u0E23\u0E48\u0E27\u0E21\u0E2A\u0E21\u0E31\u0E22\u0E21\u0E35\u0E04\u0E33\u0E0A\u0E35\u0E49\u0E41\u0E08\u0E07\u0E08\u0E32\u0E01\u0E2D\u0E07\u0E04\u0E4C\u0E01\u0E23 \u0E44\u0E21\u0E48\u0E2D\u0E49\u0E32\u0E07\u0E27\u0E48\u0E32\u0E40\u0E2B\u0E15\u0E38\u0E40\u0E01\u0E34\u0E14\u0E1B\u0E35 2024 \u0E2B\u0E23\u0E37\u0E2D\u0E21\u0E35\u0E1C\u0E39\u0E49\u0E40\u0E2A\u0E35\u0E22\u0E0A\u0E35\u0E27\u0E34\u0E15\u0E08\u0E32\u0E01\u0E1A\u0E2D\u0E15\u0E19\u0E35\u0E49 \u0E02\u0E49\u0E2D\u0E04\u0E27\u0E32\u0E21\u0E1A\u0E19\u0E08\u0E2D\u0E40\u0E1B\u0E47\u0E19\u0E2A\u0E23\u0E38\u0E1B\u0E01\u0E23\u0E13\u0E35 \u0E44\u0E21\u0E48\u0E43\u0E0A\u0E48\u0E02\u0E49\u0E2D\u0E04\u0E27\u0E32\u0E21\u0E41\u0E0A\u0E15\u0E15\u0E49\u0E19\u0E09\u0E1A\u0E31\u0E1A", ["tessa"], "push"),
    hold("10.02", "CHAT\nWHACK-A-MOLE", "GAME 05 \xB7 \u0E17\u0E38\u0E1A\u0E41\u0E0A\u0E15\u0E17\u0E35\u0E48\u0E04\u0E27\u0E23\u0E2B\u0E22\u0E38\u0E14", "\u0E40\u0E25\u0E48\u0E19 Chat Whack-a-Mole 25 \u0E27\u0E34\u0E19\u0E32\u0E17\u0E35 \u0E41\u0E15\u0E30\u0E2B\u0E22\u0E38\u0E14\u0E02\u0E49\u0E2D\u0E04\u0E27\u0E32\u0E21\u0E40\u0E2A\u0E35\u0E48\u0E22\u0E07\u0E41\u0E25\u0E30\u0E1B\u0E25\u0E48\u0E2D\u0E22\u0E02\u0E49\u0E2D\u0E04\u0E27\u0E32\u0E21\u0E0A\u0E48\u0E27\u0E22\u0E40\u0E2B\u0E25\u0E37\u0E2D \u0E02\u0E49\u0E2D\u0E04\u0E27\u0E32\u0E21\u0E40\u0E1B\u0E47\u0E19\u0E2A\u0E16\u0E32\u0E19\u0E01\u0E32\u0E23\u0E13\u0E4C\u0E08\u0E33\u0E25\u0E2D\u0E07 \u0E44\u0E21\u0E48\u0E43\u0E0A\u0E48\u0E41\u0E0A\u0E15\u0E08\u0E23\u0E34\u0E07 \u0E08\u0E2D\u0E09\u0E32\u0E22\u0E41\u0E2A\u0E14\u0E07\u0E2A\u0E16\u0E34\u0E15\u0E34\u0E41\u0E25\u0E30\u0E04\u0E30\u0E41\u0E19\u0E19\u0E08\u0E32\u0E01\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E08\u0E23\u0E34\u0E07 \u0E1C\u0E39\u0E49\u0E08\u0E31\u0E14\u0E01\u0E14\u0E40\u0E23\u0E34\u0E48\u0E21\u0E41\u0E25\u0E30\u0E22\u0E37\u0E19\u0E22\u0E31\u0E19\u0E1C\u0E25"),
    make("10.03", "\u0E15\u0E23\u0E27\u0E08\u0E01\u0E48\u0E2D\u0E19\n\u0E1B\u0E25\u0E48\u0E2D\u0E22\u0E04\u0E33\u0E15\u0E2D\u0E1A", "\u0E1A\u0E23\u0E34\u0E1A\u0E17 \u2192 \u0E04\u0E27\u0E32\u0E21\u0E40\u0E2A\u0E35\u0E48\u0E22\u0E07 \u2192 \u0E2A\u0E48\u0E07\u0E15\u0E48\u0E2D", "gate", "Human", "HUMAN VERIFICATION GATE", "Human: \u0E01\u0E32\u0E23\u0E15\u0E23\u0E27\u0E08\u0E44\u0E21\u0E48\u0E43\u0E0A\u0E48\u0E41\u0E04\u0E48\u0E04\u0E33\u0E15\u0E2D\u0E1A\u0E1F\u0E31\u0E07\u0E2A\u0E38\u0E20\u0E32\u0E1E\u0E2B\u0E23\u0E37\u0E2D\u0E44\u0E21\u0E48 \u0E41\u0E15\u0E48\u0E16\u0E32\u0E21\u0E27\u0E48\u0E32\u0E04\u0E33\u0E15\u0E2D\u0E1A\u0E40\u0E2B\u0E21\u0E32\u0E30\u0E01\u0E31\u0E1A\u0E04\u0E19\u0E19\u0E35\u0E49\u0E41\u0E25\u0E30\u0E2A\u0E16\u0E32\u0E19\u0E01\u0E32\u0E23\u0E13\u0E4C\u0E19\u0E35\u0E49\u0E2B\u0E23\u0E37\u0E2D\u0E44\u0E21\u0E48 \u0E2B\u0E32\u0E01\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E44\u0E21\u0E48\u0E1E\u0E2D\u0E2B\u0E23\u0E37\u0E2D\u0E04\u0E27\u0E32\u0E21\u0E40\u0E2A\u0E35\u0E48\u0E22\u0E07\u0E2A\u0E39\u0E07 \u0E15\u0E49\u0E2D\u0E07\u0E2B\u0E22\u0E38\u0E14\u0E41\u0E25\u0E30\u0E2A\u0E48\u0E07\u0E15\u0E48\u0E2D\u0E1C\u0E39\u0E49\u0E40\u0E0A\u0E35\u0E48\u0E22\u0E27\u0E0A\u0E32\u0E0D \u0E01\u0E32\u0E23\u0E2D\u0E19\u0E38\u0E21\u0E31\u0E15\u0E34\u0E40\u0E1B\u0E47\u0E19\u0E02\u0E31\u0E49\u0E19\u0E15\u0E2D\u0E19\u0E17\u0E35\u0E48\u0E21\u0E35\u0E40\u0E08\u0E49\u0E32\u0E02\u0E2D\u0E07\u0E0A\u0E31\u0E14\u0E40\u0E08\u0E19 \u0E44\u0E21\u0E48\u0E43\u0E0A\u0E48\u0E1B\u0E38\u0E48\u0E21\u0E17\u0E35\u0E48\u0E01\u0E14\u0E1C\u0E48\u0E32\u0E19\u0E2D\u0E31\u0E15\u0E42\u0E19\u0E21\u0E31\u0E15\u0E34")
  ] },
  { id: "11", title: "ACCOUNTABILITY", start: 2070, end: 2275, cues: [
    make("11.01", "\u0E40\u0E21\u0E37\u0E48\u0E2D\u0E04\u0E33\u0E15\u0E2D\u0E1A\n\u0E2A\u0E23\u0E49\u0E32\u0E07\u0E04\u0E27\u0E32\u0E21\u0E40\u0E2A\u0E35\u0E22\u0E2B\u0E32\u0E22", "Air Canada \xB7 \u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E2A\u0E48\u0E27\u0E19\u0E25\u0E14\u0E04\u0E48\u0E32\u0E42\u0E14\u0E22\u0E2A\u0E32\u0E23", "case", "Human", "MOFFATT v. AIR CANADA", "Human: \u0E04\u0E14\u0E35 Moffatt v. Air Canada \u0E1B\u0E35 2024 \u0E40\u0E01\u0E35\u0E48\u0E22\u0E27\u0E01\u0E31\u0E1A\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E2A\u0E48\u0E27\u0E19\u0E25\u0E14\u0E04\u0E48\u0E32\u0E42\u0E14\u0E22\u0E2A\u0E32\u0E23\u0E01\u0E23\u0E13\u0E35\u0E2A\u0E39\u0E0D\u0E40\u0E2A\u0E35\u0E22\u0E2A\u0E21\u0E32\u0E0A\u0E34\u0E01\u0E04\u0E23\u0E2D\u0E1A\u0E04\u0E23\u0E31\u0E27\u0E08\u0E32\u0E01 chatbot \u0E17\u0E35\u0E48\u0E44\u0E21\u0E48\u0E15\u0E23\u0E07\u0E19\u0E42\u0E22\u0E1A\u0E32\u0E22 \u0E04\u0E13\u0E30\u0E1E\u0E34\u0E08\u0E32\u0E23\u0E13\u0E32\u0E04\u0E14\u0E35\u0E43\u0E2B\u0E49\u0E2A\u0E32\u0E22\u0E01\u0E32\u0E23\u0E1A\u0E34\u0E19\u0E23\u0E31\u0E1A\u0E1C\u0E34\u0E14\u0E08\u0E32\u0E01\u0E01\u0E32\u0E23\u0E43\u0E2B\u0E49\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E1C\u0E34\u0E14\u0E43\u0E19\u0E01\u0E23\u0E13\u0E35\u0E19\u0E31\u0E49\u0E19 \u0E40\u0E1B\u0E47\u0E19\u0E04\u0E14\u0E35\u0E41\u0E1E\u0E48\u0E07\u0E40\u0E23\u0E37\u0E48\u0E2D\u0E07\u0E0A\u0E14\u0E40\u0E0A\u0E22 \u0E44\u0E21\u0E48\u0E43\u0E0A\u0E48\u0E04\u0E33\u0E1E\u0E34\u0E1E\u0E32\u0E01\u0E29\u0E32\u0E08\u0E33\u0E04\u0E38\u0E01\u0E2B\u0E23\u0E37\u0E2D\u0E01\u0E0E\u0E27\u0E48\u0E32\u0E17\u0E38\u0E01\u0E1A\u0E23\u0E34\u0E29\u0E31\u0E17\u0E23\u0E31\u0E1A\u0E1C\u0E34\u0E14\u0E17\u0E38\u0E01\u0E2D\u0E22\u0E48\u0E32\u0E07 100% \u0E44\u0E21\u0E48\u0E43\u0E0A\u0E49\u0E04\u0E14\u0E35 Google \u0E43\u0E19\u0E15\u0E49\u0E19\u0E09\u0E1A\u0E31\u0E1A\u0E17\u0E35\u0E48\u0E22\u0E31\u0E07\u0E22\u0E37\u0E19\u0E22\u0E31\u0E19\u0E44\u0E21\u0E48\u0E44\u0E14\u0E49", ["court"], "arc"),
    hold("11.02", "COMPANY\nSHIELD", "GAME 06 \xB7 \u0E25\u0E32\u0E01\u0E1A\u0E23\u0E34\u0E29\u0E31\u0E17\u0E1A\u0E31\u0E07\u0E25\u0E39\u0E01\u0E04\u0E49\u0E32", "\u0E40\u0E25\u0E48\u0E19 Company Shield 25 \u0E27\u0E34\u0E19\u0E32\u0E17\u0E35 \u0E25\u0E32\u0E01\u0E1A\u0E23\u0E34\u0E29\u0E31\u0E17\u0E23\u0E31\u0E1A\u0E02\u0E49\u0E2D\u0E04\u0E27\u0E32\u0E21\u0E01\u0E48\u0E2D\u0E19\u0E16\u0E36\u0E07\u0E25\u0E39\u0E01\u0E04\u0E49\u0E32 3 \u0E0A\u0E48\u0E2D\u0E07 \u0E02\u0E49\u0E2D\u0E04\u0E27\u0E32\u0E21\u0E17\u0E35\u0E48\u0E23\u0E31\u0E1A\u0E01\u0E25\u0E32\u0E22\u0E40\u0E1B\u0E47\u0E19\u0E07\u0E32\u0E19\u0E43\u0E2B\u0E49\u0E1A\u0E23\u0E34\u0E29\u0E31\u0E17\u0E15\u0E23\u0E27\u0E08 \u0E08\u0E2D\u0E09\u0E32\u0E22\u0E41\u0E2A\u0E14\u0E07\u0E1C\u0E25\u0E41\u0E25\u0E30\u0E04\u0E30\u0E41\u0E19\u0E19\u0E2B\u0E49\u0E2D\u0E07\u0E08\u0E23\u0E34\u0E07 \u0E1C\u0E39\u0E49\u0E08\u0E31\u0E14\u0E01\u0E14\u0E40\u0E23\u0E34\u0E48\u0E21\u0E41\u0E25\u0E30\u0E22\u0E37\u0E19\u0E22\u0E31\u0E19\u0E1C\u0E25 \u0E04\u0E14\u0E35\u0E17\u0E35\u0E48\u0E40\u0E25\u0E48\u0E32\u0E40\u0E1B\u0E47\u0E19\u0E1A\u0E23\u0E34\u0E1A\u0E17 \u0E44\u0E21\u0E48\u0E43\u0E0A\u0E48\u0E04\u0E33\u0E15\u0E31\u0E14\u0E2A\u0E34\u0E19\u0E08\u0E33\u0E25\u0E2D\u0E07"),
    make("11.03", "AI IS A TOOL.\nNOT A SHIELD.", "\u0E04\u0E27\u0E32\u0E21\u0E23\u0E31\u0E1A\u0E1C\u0E34\u0E14\u0E15\u0E49\u0E2D\u0E07\u0E1E\u0E34\u0E08\u0E32\u0E23\u0E13\u0E32\u0E2B\u0E19\u0E49\u0E32\u0E17\u0E35\u0E48\u0E41\u0E25\u0E30\u0E02\u0E49\u0E2D\u0E40\u0E17\u0E47\u0E08\u0E08\u0E23\u0E34\u0E07", "liability", "Human", "OWN THE DECISION", "Human: \u0E1B\u0E23\u0E30\u0E42\u0E22\u0E04\u0E19\u0E35\u0E49\u0E40\u0E1B\u0E47\u0E19\u0E02\u0E49\u0E2D\u0E2A\u0E23\u0E38\u0E1B\u0E02\u0E2D\u0E07\u0E1C\u0E39\u0E49\u0E1E\u0E39\u0E14 \u0E44\u0E21\u0E48\u0E43\u0E0A\u0E48\u0E04\u0E33\u0E2D\u0E49\u0E32\u0E07\u0E15\u0E23\u0E07\u0E08\u0E32\u0E01\u0E28\u0E32\u0E25\u0E17\u0E31\u0E48\u0E27\u0E42\u0E25\u0E01 \u0E01\u0E32\u0E23\u0E43\u0E0A\u0E49\u0E40\u0E04\u0E23\u0E37\u0E48\u0E2D\u0E07\u0E21\u0E37\u0E2D\u0E44\u0E21\u0E48\u0E44\u0E14\u0E49\u0E17\u0E33\u0E43\u0E2B\u0E49\u0E2B\u0E19\u0E49\u0E32\u0E17\u0E35\u0E48\u0E02\u0E2D\u0E07\u0E1C\u0E39\u0E49\u0E43\u0E2B\u0E49\u0E1A\u0E23\u0E34\u0E01\u0E32\u0E23\u0E2B\u0E32\u0E22\u0E44\u0E1B \u0E41\u0E15\u0E48\u0E1C\u0E39\u0E49\u0E43\u0E14\u0E23\u0E31\u0E1A\u0E1C\u0E34\u0E14\u0E41\u0E25\u0E30\u0E23\u0E31\u0E1A\u0E1C\u0E34\u0E14\u0E2D\u0E22\u0E48\u0E32\u0E07\u0E44\u0E23\u0E15\u0E49\u0E2D\u0E07\u0E1E\u0E34\u0E08\u0E32\u0E23\u0E13\u0E32\u0E01\u0E0E\u0E2B\u0E21\u0E32\u0E22 \u0E1A\u0E17\u0E1A\u0E32\u0E17 \u0E41\u0E25\u0E30\u0E02\u0E49\u0E2D\u0E40\u0E17\u0E47\u0E08\u0E08\u0E23\u0E34\u0E07\u0E02\u0E2D\u0E07\u0E41\u0E15\u0E48\u0E25\u0E30\u0E01\u0E23\u0E13\u0E35", ["court"], "punch")
  ] },
  { id: "12", title: "ACT 3 RESULTS", start: 2275, end: 2280, cues: [hold("12.01", "THE FINAL SPRINT", "ACT 03 \xB7 \u0E2A\u0E23\u0E38\u0E1B\u0E2D\u0E31\u0E19\u0E14\u0E31\u0E1A", "\u0E04\u0E34\u0E27\u0E04\u0E30\u0E41\u0E19\u0E19 5 \u0E27\u0E34\u0E19\u0E32\u0E17\u0E35 \u0E44\u0E21\u0E48\u0E2A\u0E23\u0E49\u0E32\u0E07\u0E04\u0E30\u0E41\u0E19\u0E19\u0E2B\u0E23\u0E37\u0E2D\u0E2D\u0E49\u0E32\u0E07\u0E27\u0E48\u0E32\u0E1C\u0E39\u0E49\u0E19\u0E33\u0E2B\u0E48\u0E32\u0E07\u0E01\u0E31\u0E19\u0E2B\u0E25\u0E31\u0E01\u0E2A\u0E34\u0E1A\u0E41\u0E15\u0E49\u0E21\u0E42\u0E14\u0E22\u0E44\u0E21\u0E48\u0E21\u0E35\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E08\u0E23\u0E34\u0E07")] },
  { id: "13", title: "SYNERGY", start: 2280, end: 2640, cues: [
    make("13.01", "BETTER\nTOGETHER?", "\u0E04\u0E19 + AI \u0E22\u0E48\u0E2D\u0E21\u0E14\u0E35\u0E17\u0E35\u0E48\u0E2A\u0E38\u0E14\u0E40\u0E2A\u0E21\u0E2D \u0E08\u0E23\u0E34\u0E07\u0E2B\u0E23\u0E37\u0E2D?", "synergy", "Both", "NOT ALWAYS", "Human: Vaccaro \u0E41\u0E25\u0E30\u0E04\u0E13\u0E30\u0E23\u0E27\u0E21 106 \u0E01\u0E32\u0E23\u0E17\u0E14\u0E25\u0E2D\u0E07\u0E01\u0E31\u0E1A 370 effect sizes \u0E42\u0E14\u0E22\u0E40\u0E09\u0E25\u0E35\u0E48\u0E22\u0E23\u0E30\u0E1A\u0E1A\u0E04\u0E19\u0E23\u0E48\u0E27\u0E21 AI \u0E15\u0E48\u0E33\u0E01\u0E27\u0E48\u0E32\u0E1D\u0E48\u0E32\u0E22\u0E17\u0E35\u0E48\u0E40\u0E01\u0E48\u0E07\u0E17\u0E35\u0E48\u0E2A\u0E38\u0E14\u0E23\u0E30\u0E2B\u0E27\u0E48\u0E32\u0E07\u0E04\u0E19\u0E2B\u0E23\u0E37\u0E2D AI \u0E41\u0E15\u0E48\u0E40\u0E2B\u0E19\u0E37\u0E2D\u0E01\u0E27\u0E48\u0E32\u0E04\u0E19\u0E2D\u0E22\u0E48\u0E32\u0E07\u0E40\u0E14\u0E35\u0E22\u0E27\u0E42\u0E14\u0E22\u0E40\u0E09\u0E25\u0E35\u0E48\u0E22 \u0E1C\u0E25\u0E41\u0E15\u0E01\u0E15\u0E48\u0E32\u0E07\u0E15\u0E32\u0E21\u0E07\u0E32\u0E19 \u0E08\u0E36\u0E07\u0E44\u0E21\u0E48\u0E2A\u0E23\u0E38\u0E1B\u0E27\u0E48\u0E32\u0E01\u0E32\u0E23\u0E23\u0E48\u0E27\u0E21\u0E21\u0E37\u0E2D\u0E41\u0E22\u0E48\u0E01\u0E27\u0E48\u0E32\u0E04\u0E19\u0E2D\u0E22\u0E48\u0E32\u0E07\u0E40\u0E14\u0E35\u0E22\u0E27\u0E40\u0E2A\u0E21\u0E2D", ["synergy"], "punch"),
    make("13.02", "\u0E01\u0E32\u0E23\u0E23\u0E48\u0E27\u0E21\u0E21\u0E37\u0E2D\n\u0E15\u0E49\u0E2D\u0E07\u0E2D\u0E2D\u0E01\u0E41\u0E1A\u0E1A", "\u0E21\u0E2D\u0E1A\u0E07\u0E32\u0E19 \xB7 \u0E15\u0E23\u0E27\u0E08\u0E2B\u0E25\u0E31\u0E01\u0E10\u0E32\u0E19 \xB7 \u0E2D\u0E19\u0E38\u0E21\u0E31\u0E15\u0E34", "design", "Human", "DESIGN THE HANDOFF", "Human: \u0E40\u0E23\u0E32\u0E15\u0E49\u0E2D\u0E07\u0E23\u0E39\u0E49\u0E27\u0E48\u0E32\u0E07\u0E32\u0E19\u0E2A\u0E48\u0E27\u0E19\u0E44\u0E2B\u0E19\u0E40\u0E2B\u0E21\u0E32\u0E30\u0E01\u0E31\u0E1A AI \u0E43\u0E04\u0E23\u0E15\u0E23\u0E27\u0E08\u0E14\u0E49\u0E27\u0E22\u0E2B\u0E25\u0E31\u0E01\u0E10\u0E32\u0E19\u0E2D\u0E30\u0E44\u0E23 \u0E41\u0E25\u0E30\u0E40\u0E21\u0E37\u0E48\u0E2D\u0E44\u0E23\u0E15\u0E49\u0E2D\u0E07\u0E2B\u0E22\u0E38\u0E14 \u0E1C\u0E25 meta-analysis \u0E44\u0E21\u0E48\u0E44\u0E14\u0E49\u0E1E\u0E34\u0E2A\u0E39\u0E08\u0E19\u0E4C\u0E27\u0E48\u0E32\u0E17\u0E38\u0E01\u0E04\u0E27\u0E32\u0E21\u0E25\u0E49\u0E21\u0E40\u0E2B\u0E25\u0E27\u0E40\u0E01\u0E34\u0E14\u0E08\u0E32\u0E01\u0E2A\u0E21\u0E2D\u0E07\u0E02\u0E35\u0E49\u0E40\u0E01\u0E35\u0E22\u0E08 \u0E15\u0E31\u0E27\u0E2D\u0E22\u0E48\u0E32\u0E07\u0E19\u0E35\u0E49\u0E40\u0E1B\u0E47\u0E19\u0E01\u0E23\u0E30\u0E1A\u0E27\u0E19\u0E01\u0E32\u0E23\u0E17\u0E35\u0E48\u0E40\u0E23\u0E32\u0E40\u0E2A\u0E19\u0E2D\u0E40\u0E1E\u0E37\u0E48\u0E2D\u0E08\u0E31\u0E14\u0E01\u0E32\u0E23\u0E04\u0E27\u0E32\u0E21\u0E40\u0E2A\u0E35\u0E48\u0E22\u0E07 \u0E44\u0E21\u0E48\u0E43\u0E0A\u0E48\u0E2A\u0E39\u0E15\u0E23\u0E17\u0E35\u0E48\u0E23\u0E31\u0E1A\u0E1B\u0E23\u0E30\u0E01\u0E31\u0E19\u0E17\u0E38\u0E01\u0E2A\u0E16\u0E32\u0E19\u0E01\u0E32\u0E23\u0E13\u0E4C"),
    make("13.03", "\u0E40\u0E23\u0E47\u0E27\u0E41\u0E04\u0E48\u0E44\u0E2B\u0E19\n\u0E01\u0E47\u0E15\u0E49\u0E2D\u0E07\u0E15\u0E23\u0E27\u0E08\u0E01\u0E48\u0E2D\u0E19\u0E1B\u0E25\u0E48\u0E2D\u0E22", "CrowdStrike \xB7 19 July 2024", "outage", "Human", "VERIFICATION ARCHITECTS", "Human: CrowdStrike \u0E23\u0E30\u0E1A\u0E38\u0E27\u0E48\u0E32 content configuration update \u0E17\u0E33\u0E43\u0E2B\u0E49 Windows sensor \u0E40\u0E01\u0E34\u0E14\u0E1B\u0E31\u0E0D\u0E2B\u0E32\u0E27\u0E07\u0E01\u0E27\u0E49\u0E32\u0E07\u0E43\u0E19\u0E27\u0E31\u0E19\u0E17\u0E35\u0E48 19 \u0E01\u0E23\u0E01\u0E0E\u0E32\u0E04\u0E21 2024 \u0E43\u0E0A\u0E49\u0E40\u0E1B\u0E47\u0E19\u0E1A\u0E17\u0E40\u0E23\u0E35\u0E22\u0E19\u0E40\u0E23\u0E37\u0E48\u0E2D\u0E07\u0E01\u0E32\u0E23\u0E17\u0E14\u0E2A\u0E2D\u0E1A\u0E41\u0E25\u0E30\u0E1B\u0E25\u0E48\u0E2D\u0E22\u0E23\u0E30\u0E1A\u0E1A \u0E40\u0E23\u0E32\u0E44\u0E21\u0E48\u0E21\u0E35\u0E2B\u0E25\u0E31\u0E01\u0E10\u0E32\u0E19\u0E27\u0E48\u0E32 generative AI \u0E40\u0E02\u0E35\u0E22\u0E19 update \u0E19\u0E35\u0E49 \u0E08\u0E36\u0E07\u0E44\u0E21\u0E48\u0E01\u0E25\u0E48\u0E32\u0E27\u0E40\u0E0A\u0E48\u0E19\u0E19\u0E31\u0E49\u0E19 \u0E1A\u0E17\u0E1A\u0E32\u0E17\u0E1C\u0E39\u0E49\u0E15\u0E23\u0E27\u0E08\u0E23\u0E30\u0E1A\u0E1A\u0E22\u0E31\u0E07\u0E2A\u0E33\u0E04\u0E31\u0E0D\u0E40\u0E21\u0E37\u0E48\u0E2D\u0E40\u0E04\u0E23\u0E37\u0E48\u0E2D\u0E07\u0E21\u0E37\u0E2D\u0E0A\u0E48\u0E27\u0E22\u0E1C\u0E25\u0E34\u0E15\u0E07\u0E32\u0E19\u0E40\u0E23\u0E47\u0E27\u0E02\u0E36\u0E49\u0E19", ["crowdstrike"], "push"),
    make("13.04", "HUMAN\nOVERSIGHT", "\u0E01\u0E33\u0E01\u0E31\u0E1A\u0E14\u0E39\u0E41\u0E25\u0E43\u0E2B\u0E49\u0E40\u0E2B\u0E21\u0E32\u0E30\u0E01\u0E31\u0E1A\u0E04\u0E27\u0E32\u0E21\u0E40\u0E2A\u0E35\u0E48\u0E22\u0E07", "oversight", "Human", "HIGH-RISK AI \xB7 ARTICLE 14", "Human: Article 14 \u0E02\u0E2D\u0E07 EU AI Act \u0E01\u0E25\u0E48\u0E32\u0E27\u0E16\u0E36\u0E07 human oversight \u0E2A\u0E33\u0E2B\u0E23\u0E31\u0E1A\u0E23\u0E30\u0E1A\u0E1A AI \u0E04\u0E27\u0E32\u0E21\u0E40\u0E2A\u0E35\u0E48\u0E22\u0E07\u0E2A\u0E39\u0E07 \u0E02\u0E49\u0E2D\u0E01\u0E33\u0E2B\u0E19\u0E14\u0E02\u0E36\u0E49\u0E19\u0E01\u0E31\u0E1A\u0E1B\u0E23\u0E30\u0E40\u0E20\u0E17\u0E23\u0E30\u0E1A\u0E1A \u0E1A\u0E17\u0E1A\u0E32\u0E17 \u0E41\u0E25\u0E30\u0E1A\u0E17\u0E1A\u0E31\u0E0D\u0E0D\u0E31\u0E15\u0E34\u0E17\u0E35\u0E48\u0E43\u0E0A\u0E49 \u0E44\u0E21\u0E48\u0E43\u0E0A\u0E48\u0E17\u0E38\u0E01\u0E23\u0E30\u0E1A\u0E1A\u0E15\u0E49\u0E2D\u0E07\u0E21\u0E35\u0E04\u0E19\u0E01\u0E14\u0E2D\u0E19\u0E38\u0E21\u0E31\u0E15\u0E34\u0E17\u0E38\u0E01\u0E04\u0E33\u0E15\u0E2D\u0E1A \u0E40\u0E23\u0E32\u0E08\u0E30\u0E43\u0E0A\u0E49\u0E2B\u0E25\u0E31\u0E01\u0E04\u0E34\u0E14\u0E27\u0E48\u0E32\u0E01\u0E32\u0E23\u0E01\u0E33\u0E01\u0E31\u0E1A\u0E15\u0E49\u0E2D\u0E07\u0E21\u0E35\u0E2D\u0E33\u0E19\u0E32\u0E08\u0E41\u0E25\u0E30\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E17\u0E35\u0E48\u0E1E\u0E2D\u0E08\u0E30\u0E2B\u0E22\u0E38\u0E14\u0E2B\u0E23\u0E37\u0E2D\u0E41\u0E01\u0E49\u0E23\u0E30\u0E1A\u0E1A\u0E44\u0E14\u0E49", ["oversight"], "arc")
  ] },
  { id: "14", title: "SHARED CONTROL", start: 2640, end: 2820, cues: [hold("14.01", "MISSING\nPIECE", "GAME 07 \xB7 AI \u0E40\u0E23\u0E34\u0E48\u0E21 \u0E04\u0E19\u0E40\u0E15\u0E34\u0E21", "AI \u0E40\u0E15\u0E23\u0E35\u0E22\u0E21\u0E20\u0E32\u0E1E\u0E10\u0E32\u0E19 \u0E1C\u0E39\u0E49\u0E40\u0E25\u0E48\u0E19\u0E17\u0E38\u0E01\u0E04\u0E19\u0E27\u0E32\u0E14\u0E15\u0E48\u0E2D\u0E41\u0E25\u0E30\u0E2A\u0E48\u0E07\u0E15\u0E23\u0E27\u0E08 \u0E08\u0E32\u0E01\u0E19\u0E31\u0E49\u0E19\u0E2A\u0E21\u0E32\u0E0A\u0E34\u0E01\u0E40\u0E25\u0E37\u0E2D\u0E01\u0E15\u0E31\u0E27\u0E41\u0E17\u0E19\u0E01\u0E25\u0E38\u0E48\u0E21\u0E41\u0E25\u0E30\u0E42\u0E2B\u0E27\u0E15\u0E1C\u0E25\u0E07\u0E32\u0E19\u0E02\u0E49\u0E32\u0E21\u0E01\u0E25\u0E38\u0E48\u0E21 \u0E08\u0E2D\u0E09\u0E32\u0E22\u0E41\u0E2A\u0E14\u0E07\u0E07\u0E32\u0E19\u0E17\u0E35\u0E48\u0E2D\u0E19\u0E38\u0E21\u0E31\u0E15\u0E34\u0E41\u0E25\u0E30\u0E1C\u0E25\u0E04\u0E30\u0E41\u0E19\u0E19\u0E08\u0E23\u0E34\u0E07 \u0E1C\u0E39\u0E49\u0E08\u0E31\u0E14\u0E15\u0E23\u0E27\u0E08\u0E41\u0E25\u0E30\u0E01\u0E14\u0E40\u0E23\u0E34\u0E48\u0E21\u0E41\u0E15\u0E48\u0E25\u0E30\u0E0A\u0E48\u0E27\u0E07 \u0E01\u0E48\u0E2D\u0E19\u0E01\u0E14\u0E22\u0E37\u0E19\u0E22\u0E31\u0E19\u0E1C\u0E25\u0E44\u0E1B\u0E15\u0E48\u0E2D")] },
  { id: "15", title: "SHARED FUTURE", start: 2820, end: 2910, cues: [
    make("15.01", "\u0E2A\u0E21\u0E01\u0E32\u0E23\u0E02\u0E2D\u0E07\n\u0E04\u0E27\u0E32\u0E21\u0E23\u0E31\u0E1A\u0E1C\u0E34\u0E14\u0E0A\u0E2D\u0E1A", "\u0E40\u0E2A\u0E19\u0E2D \u2192 \u0E15\u0E23\u0E27\u0E08\u0E2A\u0E2D\u0E1A \u2192 \u0E23\u0E31\u0E1A\u0E1C\u0E34\u0E14\u0E0A\u0E2D\u0E1A", "formula", "Both", "THE FUTURE NEEDS A HUMAN SIGNATURE", "Both: AI \u0E21\u0E35\u0E2B\u0E19\u0E49\u0E32\u0E17\u0E35\u0E48\u0E40\u0E2A\u0E19\u0E2D \u0E21\u0E19\u0E38\u0E29\u0E22\u0E4C\u0E21\u0E35\u0E2B\u0E19\u0E49\u0E32\u0E17\u0E35\u0E48\u0E15\u0E23\u0E27\u0E08\u0E2A\u0E2D\u0E1A \u0E41\u0E25\u0E30\u0E21\u0E19\u0E38\u0E29\u0E22\u0E4C\u0E01\u0E31\u0E1A\u0E2D\u0E07\u0E04\u0E4C\u0E01\u0E23\u0E15\u0E49\u0E2D\u0E07\u0E23\u0E31\u0E1A\u0E1C\u0E34\u0E14\u0E15\u0E32\u0E21\u0E1A\u0E17\u0E1A\u0E32\u0E17\u0E41\u0E25\u0E30\u0E01\u0E0E\u0E2B\u0E21\u0E32\u0E22 \u0E2A\u0E21\u0E01\u0E32\u0E23\u0E19\u0E35\u0E49\u0E40\u0E1B\u0E47\u0E19\u0E2B\u0E25\u0E31\u0E01\u0E1B\u0E0F\u0E34\u0E1A\u0E31\u0E15\u0E34\u0E02\u0E2D\u0E07\u0E01\u0E32\u0E23\u0E19\u0E33\u0E40\u0E2A\u0E19\u0E2D \u0E44\u0E21\u0E48\u0E43\u0E0A\u0E48\u0E1A\u0E17\u0E01\u0E0E\u0E2B\u0E21\u0E32\u0E22\u0E17\u0E35\u0E48\u0E43\u0E0A\u0E49\u0E41\u0E17\u0E19\u0E23\u0E32\u0E22\u0E25\u0E30\u0E40\u0E2D\u0E35\u0E22\u0E14\u0E17\u0E38\u0E01\u0E01\u0E23\u0E13\u0E35", [], "push"),
    make("15.02", "DIFFERENT\nMINDS.", "\u0E2A\u0E15\u0E34\u0E1B\u0E31\u0E0D\u0E0D\u0E32\u0E15\u0E48\u0E32\u0E07\u0E25\u0E31\u0E01\u0E29\u0E13\u0E30", "different", "AI", "THE FIRST PART OF THE PROMISE", "AI: \u0E09\u0E31\u0E19\u0E0A\u0E48\u0E27\u0E22\u0E2A\u0E30\u0E17\u0E49\u0E2D\u0E19\u0E41\u0E25\u0E30\u0E08\u0E31\u0E14\u0E23\u0E39\u0E1B\u0E41\u0E1A\u0E1A\u0E04\u0E27\u0E32\u0E21\u0E23\u0E39\u0E49 \u0E40\u0E2A\u0E19\u0E2D\u0E17\u0E32\u0E07\u0E40\u0E25\u0E37\u0E2D\u0E01 \u0E41\u0E25\u0E30\u0E0A\u0E48\u0E27\u0E22\u0E04\u0E33\u0E19\u0E27\u0E13\u0E44\u0E14\u0E49 \u0E41\u0E15\u0E48\u0E04\u0E27\u0E32\u0E21\u0E2B\u0E21\u0E32\u0E22\u0E02\u0E2D\u0E07\u0E17\u0E32\u0E07\u0E40\u0E25\u0E37\u0E2D\u0E01\u0E15\u0E49\u0E2D\u0E07\u0E14\u0E39\u0E0A\u0E35\u0E27\u0E34\u0E15\u0E41\u0E25\u0E30\u0E1A\u0E23\u0E34\u0E1A\u0E17\u0E02\u0E2D\u0E07\u0E04\u0E19 \u0E40\u0E23\u0E32\u0E21\u0E35\u0E2A\u0E15\u0E34\u0E1B\u0E31\u0E0D\u0E0D\u0E32\u0E15\u0E48\u0E32\u0E07\u0E25\u0E31\u0E01\u0E29\u0E13\u0E30"),
    make("15.03", "SHARED\nFUTURE.", "\u0E01\u0E49\u0E32\u0E27\u0E2A\u0E39\u0E48\u0E2D\u0E19\u0E32\u0E04\u0E15\u0E23\u0E48\u0E27\u0E21\u0E01\u0E31\u0E19", "future", "Human", "THE SECOND PART OF THE PROMISE", "Human: \u0E40\u0E23\u0E32\u0E2A\u0E23\u0E49\u0E32\u0E07\u0E2D\u0E19\u0E32\u0E04\u0E15\u0E23\u0E48\u0E27\u0E21\u0E01\u0E31\u0E19\u0E44\u0E14\u0E49\u0E40\u0E21\u0E37\u0E48\u0E2D\u0E40\u0E25\u0E37\u0E2D\u0E01\u0E43\u0E0A\u0E49\u0E04\u0E27\u0E32\u0E21\u0E2A\u0E32\u0E21\u0E32\u0E23\u0E16\u0E41\u0E15\u0E48\u0E25\u0E30\u0E1D\u0E48\u0E32\u0E22\u0E2D\u0E22\u0E48\u0E32\u0E07\u0E40\u0E2B\u0E21\u0E32\u0E30\u0E2A\u0E21 \u0E15\u0E31\u0E49\u0E07\u0E04\u0E33\u0E16\u0E32\u0E21 \u0E41\u0E25\u0E30\u0E15\u0E23\u0E27\u0E08\u0E04\u0E33\u0E15\u0E2D\u0E1A \u0E01\u0E32\u0E23\u0E23\u0E48\u0E27\u0E21\u0E21\u0E37\u0E2D\u0E44\u0E21\u0E48\u0E40\u0E01\u0E34\u0E14\u0E08\u0E32\u0E01\u0E01\u0E32\u0E23\u0E23\u0E27\u0E21\u0E40\u0E04\u0E23\u0E37\u0E48\u0E2D\u0E07\u0E21\u0E37\u0E2D\u0E40\u0E09\u0E22 \u0E46 \u0E41\u0E15\u0E48\u0E40\u0E01\u0E34\u0E14\u0E08\u0E32\u0E01\u0E01\u0E32\u0E23\u0E2D\u0E2D\u0E01\u0E41\u0E1A\u0E1A\u0E2B\u0E19\u0E49\u0E32\u0E17\u0E35\u0E48\u0E41\u0E25\u0E30\u0E04\u0E27\u0E32\u0E21\u0E44\u0E27\u0E49\u0E43\u0E08\u0E17\u0E35\u0E48\u0E15\u0E23\u0E27\u0E08\u0E2A\u0E2D\u0E1A\u0E44\u0E14\u0E49", [], "arc"),
    make("15.04", "HUMAN\nRESPONSIBILITY.", "\u0E1C\u0E39\u0E49\u0E15\u0E31\u0E14\u0E2A\u0E34\u0E19\u0E43\u0E08\u0E15\u0E49\u0E2D\u0E07\u0E1E\u0E23\u0E49\u0E2D\u0E21\u0E23\u0E31\u0E1A\u0E1C\u0E34\u0E14\u0E0A\u0E2D\u0E1A\u0E1C\u0E25\u0E25\u0E31\u0E1E\u0E18\u0E4C", "responsibility", "Both", "THE PART WE MUST KEEP", "Both: \u0E2A\u0E15\u0E34\u0E1B\u0E31\u0E0D\u0E0D\u0E32\u0E15\u0E48\u0E32\u0E07\u0E25\u0E31\u0E01\u0E29\u0E13\u0E30 \u0E01\u0E49\u0E32\u0E27\u0E2A\u0E39\u0E48\u0E2D\u0E19\u0E32\u0E04\u0E15\u0E23\u0E48\u0E27\u0E21\u0E01\u0E31\u0E19 \u0E42\u0E14\u0E22\u0E21\u0E35\u0E04\u0E27\u0E32\u0E21\u0E23\u0E31\u0E1A\u0E1C\u0E34\u0E14\u0E0A\u0E2D\u0E1A\u0E02\u0E2D\u0E07\u0E21\u0E19\u0E38\u0E29\u0E22\u0E4C\u0E40\u0E1B\u0E47\u0E19\u0E41\u0E01\u0E19\u0E01\u0E25\u0E32\u0E07 \u0E04\u0E27\u0E32\u0E21\u0E40\u0E23\u0E47\u0E27\u0E43\u0E19\u0E01\u0E32\u0E23\u0E40\u0E2A\u0E19\u0E2D\u0E17\u0E32\u0E07\u0E40\u0E25\u0E37\u0E2D\u0E01\u0E21\u0E35\u0E1B\u0E23\u0E30\u0E42\u0E22\u0E0A\u0E19\u0E4C \u0E40\u0E21\u0E37\u0E48\u0E2D\u0E40\u0E23\u0E32\u0E23\u0E39\u0E49\u0E27\u0E48\u0E32\u0E43\u0E04\u0E23\u0E15\u0E23\u0E27\u0E08 \u0E43\u0E04\u0E23\u0E15\u0E31\u0E14\u0E2A\u0E34\u0E19\u0E43\u0E08 \u0E41\u0E25\u0E30\u0E43\u0E04\u0E23\u0E23\u0E31\u0E1A\u0E1C\u0E25\u0E02\u0E2D\u0E07\u0E01\u0E32\u0E23\u0E15\u0E31\u0E14\u0E2A\u0E34\u0E19\u0E43\u0E08\u0E19\u0E31\u0E49\u0E19", [], "punch")
  ] },
  { id: "16", title: "EPILOGUE", start: 2910, end: 3e3, cues: [
    hold("16.01", "GRAND PODIUM\nCEREMONY", "\u0E1B\u0E23\u0E30\u0E01\u0E32\u0E28\u0E23\u0E32\u0E07\u0E27\u0E31\u0E25 \xB7 \u0E2D\u0E31\u0E19\u0E14\u0E31\u0E1A 1\u20133", "\u0E1C\u0E39\u0E49\u0E08\u0E31\u0E14\u0E1B\u0E23\u0E30\u0E01\u0E32\u0E28\u0E1C\u0E25\u0E08\u0E23\u0E34\u0E07\u0E41\u0E25\u0E30\u0E40\u0E0A\u0E34\u0E0D\u0E15\u0E31\u0E27\u0E41\u0E17\u0E19\u0E23\u0E31\u0E1A\u0E23\u0E32\u0E07\u0E27\u0E31\u0E25 \u0E08\u0E2D\u0E19\u0E35\u0E49\u0E40\u0E1B\u0E47\u0E19\u0E02\u0E49\u0E2D\u0E04\u0E27\u0E32\u0E21 \u0E44\u0E21\u0E48\u0E21\u0E35\u0E0A\u0E37\u0E48\u0E2D\u0E1C\u0E39\u0E49\u0E0A\u0E19\u0E30\u0E2B\u0E23\u0E37\u0E2D\u0E04\u0E30\u0E41\u0E19\u0E19\u0E2A\u0E21\u0E21\u0E15\u0E34"),
    make("16.02", "\u0E15\u0E23\u0E27\u0E08\u0E01\u0E48\u0E2D\u0E19\u0E40\u0E0A\u0E37\u0E48\u0E2D", "\u0E0A\u0E37\u0E48\u0E2D\u0E02\u0E2D\u0E07\u0E04\u0E38\u0E13\u0E22\u0E31\u0E07\u0E2D\u0E22\u0E39\u0E48\u0E1A\u0E19\u0E07\u0E32\u0E19\u0E19\u0E35\u0E49", "thanks", "Both", "DIFFERENT MINDS. SHARED FUTURE. HUMAN RESPONSIBILITY.", "Human: \u0E40\u0E21\u0E37\u0E48\u0E2D\u0E43\u0E0A\u0E49 AI \u0E0A\u0E48\u0E27\u0E22\u0E17\u0E33\u0E07\u0E32\u0E19 \u0E2D\u0E22\u0E48\u0E32\u0E25\u0E37\u0E21\u0E15\u0E23\u0E27\u0E08\u0E04\u0E33\u0E15\u0E2D\u0E1A\u0E41\u0E25\u0E30\u0E1E\u0E34\u0E08\u0E32\u0E23\u0E13\u0E32\u0E1C\u0E25\u0E01\u0E23\u0E30\u0E17\u0E1A \u0E07\u0E32\u0E19\u0E17\u0E35\u0E48\u0E2A\u0E48\u0E07\u0E41\u0E25\u0E30\u0E01\u0E32\u0E23\u0E15\u0E31\u0E14\u0E2A\u0E34\u0E19\u0E43\u0E08\u0E17\u0E35\u0E48\u0E17\u0E33\u0E22\u0E31\u0E07\u0E21\u0E35\u0E0A\u0E37\u0E48\u0E2D\u0E41\u0E25\u0E30\u0E2B\u0E19\u0E49\u0E32\u0E17\u0E35\u0E48\u0E02\u0E2D\u0E07\u0E40\u0E23\u0E32 \u0E02\u0E2D\u0E1A\u0E04\u0E38\u0E13\u0E17\u0E38\u0E01\u0E04\u0E19\u0E04\u0E23\u0E31\u0E1A \u0E1C\u0E39\u0E49\u0E04\u0E27\u0E1A\u0E04\u0E38\u0E21\u0E01\u0E14 B \u0E40\u0E21\u0E37\u0E48\u0E2D\u0E15\u0E49\u0E2D\u0E07\u0E01\u0E32\u0E23 fade \u0E1B\u0E34\u0E14\u0E08\u0E2D", [], "fade")
  ] }
];
var allCues = chapters.flatMap((chapter, scene) => chapter.cues.map((cue, beat) => ({ scene, beat, chapter, cue })));

// api/app.ts
var hash = (s) => createHash("sha256").update(s).digest("hex");
var mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".ttf": "font/ttf", ".wav": "audio/wav" };
var roleSchema = t.Union([t.Literal("player"), t.Literal("host"), t.Literal("display")]);
var fail = (error) => ({ ok: false, error });
function createApp(db, hostKey, publicOrigin) {
  const secureCookies = process.env.NODE_ENV === "production" || publicOrigin?.startsWith("https:") === true;
  const identity = (request, role) => {
    const selected = role ?? request.headers.get("x-game-role") ?? "player";
    if (!["player", "host", "display"].includes(selected)) return null;
    const token = request.headers.get("cookie")?.split(";").map((x) => x.trim()).find((x) => x.startsWith(`game_${selected}=`))?.split("=")[1];
    if (!token) return null;
    return { tokenHash: hash(token), role: selected };
  };
  const actor = async (request, role) => {
    const selected = identity(request, role);
    if (!selected) return null;
    return (await db.query("SELECT id,role FROM game.actors WHERE token_hash=$1 AND role=$2", [selected.tokenHash, selected.role])).rows[0] ?? null;
  };
  const issue = async (role, token = randomBytes(32).toString("hex")) => {
    const r = await db.query("INSERT INTO game.actors(role,token_hash) VALUES($1,$2) ON CONFLICT(token_hash) DO UPDATE SET token_hash=excluded.token_hash RETURNING id", [role, hash(token)]);
    return { id: r.rows[0].id, token };
  };
  const cookie = (role, token) => `game_${role}=${token}; HttpOnly; SameSite=Strict; Path=/api; Max-Age=2592000${secureCookies ? "; Secure" : ""}`;
  const app = new Elysia({ adapter: node(), serve: { maxRequestBodySize: 16384 } }).onRequest(({ request, set }) => {
    set.headers["Cache-Control"] = "no-store";
    set.headers["X-Content-Type-Options"] = "nosniff";
    set.headers["X-Game-Transport"] = process.env.VERCEL ? "poll" : "sse";
    set.headers["X-Game-Release"] = "connection-v2";
    const origin = request.headers.get("origin");
    if (request.method !== "GET" && origin && origin !== new URL(request.url).origin) {
      set.status = 403;
      return fail("ORIGIN_REJECTED");
    }
  }).onError(({ code, error, request, set }) => {
    if (code !== "VALIDATION") console.error("[game-api]", request.method, new URL(request.url).pathname, code, error instanceof Error ? error.message : "unknown error");
    set.status = code === "VALIDATION" ? 400 : 500;
    return fail(code === "VALIDATION" ? "INVALID_REQUEST" : "SERVER_ERROR");
  }).get("/api/health", () => ({ ok: true, mode: process.env.GAME_DATABASE_URL ? "postgres" : "local-pglite", transport: process.env.VERCEL ? "poll" : "sse", game: "human-vs-ai", release: "connection-v2" })).post("/api/session", async ({ request, body, set }) => {
    const existing = await actor(request, body.role);
    if (existing) return { ok: true };
    const s = await issue(body.role);
    set.headers["Set-Cookie"] = cookie(body.role, s.token);
    return { ok: true };
  }, { body: t.Object({ role: t.Union([t.Literal("player"), t.Literal("display")]) }, { additionalProperties: false }) }).post("/api/host/login", async ({ body, set }) => {
    const candidate = hash(body.key);
    const expected = hash(hostKey);
    if (!timingSafeEqual(Buffer.from(candidate), Buffer.from(expected))) {
      set.status = 403;
      return fail("HOST_KEY_INVALID");
    }
    const s = await issue("host", hash(`host-session:${hostKey}`));
    set.headers["Set-Cookie"] = cookie("host", s.token);
    return { ok: true };
  }, { body: t.Object({ key: t.String({ minLength: 1, maxLength: 100 }) }, { additionalProperties: false }) }).post("/api/rooms", async ({ request, body, set }) => {
    const a = await actor(request, "host");
    if (!a) {
      set.status = 401;
      return fail("UNAUTHORIZED");
    }
    const code = randomBytes(4).toString("hex").slice(0, 6).toUpperCase();
    await db.query(`WITH room AS (INSERT INTO game.rooms(code,host_id,capacity,cue) VALUES($1,$2,$3,'01.02') RETURNING code)
   INSERT INTO game.groups(room_code,id,name)
   SELECT room.code,group_row.ordinality::int,group_row.name
   FROM room CROSS JOIN unnest($4::text[]) WITH ORDINALITY AS group_row(name,ordinality)`, [code, a.id, body.capacity, [...groupNames]]);
    return { ok: true, data: { code } };
  }, { body: t.Object({ capacity: t.Integer({ minimum: 1, maximum: 64 }) }, { additionalProperties: false }) }).get("/api/rooms", async ({ request, set }) => {
    const a = await actor(request, "host");
    if (!a) {
      set.status = 401;
      return fail("UNAUTHORIZED");
    }
    return { ok: true, data: (await db.query("SELECT code,cue,capacity FROM game.rooms WHERE host_id=$1 ORDER BY created_at DESC", [a.id])).rows };
  }).get("/api/rooms/:code/lobby", async ({ params }) => {
    const rooms = await db.query("SELECT code,capacity,team_locked,cue FROM game.rooms WHERE code=$1", [params.code]);
    if (!rooms.rows.length) return fail("ROOM_NOT_FOUND");
    const groups = await db.query("SELECT g.id,g.name,count(m.id)::int AS members FROM game.groups g LEFT JOIN game.members m ON m.room_code=g.room_code AND m.group_id=g.id AND m.active WHERE g.room_code=$1 GROUP BY g.id,g.name ORDER BY g.id", [params.code]);
    return { ok: true, data: { room: rooms.rows[0], groups: groups.rows } };
  }).get("/api/rooms/:code/snapshot", async ({ request, params, set }) => {
    const selected = identity(request);
    if (!selected) {
      set.status = 401;
      return fail("UNAUTHORIZED");
    }
    const start = performance.now();
    const result = (await db.query("SELECT game.snapshot(id,$1) AS result FROM game.actors WHERE token_hash=$2 AND role=$3", [params.code, selected.tokenHash, selected.role])).rows[0];
    set.headers["Server-Timing"] = `snapshot;dur=${(performance.now() - start).toFixed(1)}`;
    if (!result) {
      set.status = 401;
      return fail("UNAUTHORIZED");
    }
    return result.result;
  }).post("/api/rooms/:code/commands/:kind", async ({ request, params, body, set }) => {
    const selected = identity(request);
    if (!selected) {
      set.status = 401;
      return fail("UNAUTHORIZED");
    }
    if (!validateCommand(params.kind, body.payload)) {
      set.status = 400;
      return fail("INVALID_REQUEST");
    }
    if (params.kind === "cue" && !allCues.some((c) => c.cue.id === body.payload.cue)) {
      set.status = 400;
      return fail("INVALID_CUE");
    }
    if (params.kind === "caption") {
      try {
        Object.assign(body.payload, prepareCaption(body.payload.text));
      } catch (e) {
        set.status = 400;
        return fail(e instanceof Error ? e.message : "CAPTION_FORMAT");
      }
    }
    const result = (await db.query("SELECT game.command(id,$1,$2,$3::jsonb,$4) AS result FROM game.actors WHERE token_hash=$5 AND role=$6", [params.code, params.kind, JSON.stringify(body.payload), body.key, selected.tokenHash, selected.role])).rows[0];
    if (!result) {
      set.status = 401;
      return fail("UNAUTHORIZED");
    }
    return result.result;
  }, { body: t.Object({ key: t.String({ minLength: 1, maxLength: 100 }), payload: t.Record(t.String(), t.Unknown()) }, { additionalProperties: false }) }).get("/api/rooms/:code/events", async ({ request, params, query, set }) => {
    const a = await actor(request, query.role);
    if (!a) {
      set.status = 401;
      return fail("UNAUTHORIZED");
    }
    const allowed = (await db.query("SELECT game.snapshot($1,$2) AS result", [a.id, params.code])).rows[0].result;
    if (!allowed.ok) {
      set.status = 403;
      return fail("FORBIDDEN");
    }
    if (process.env.VERCEL) return new Response('retry: 15000\n\ndata: {"transport":"poll"}\n\n', { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-store", "X-Game-Transport": "poll" } });
    let timer;
    let closed = false;
    let last = Number(query.after) || 0;
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode("retry: 2000\n\n"));
        const tick = async () => {
          try {
            if (closed) return;
            const permission = await db.query(`SELECT (a.role='display' OR (a.role='host' AND r.host_id=a.id) OR EXISTS(SELECT 1 FROM game.members WHERE actor_id=a.id AND room_code=r.code AND active)) allowed FROM game.actors a CROSS JOIN game.rooms r WHERE a.id=$1 AND r.code=$2`, [a.id, params.code]);
            if (!permission.rows[0]?.allowed) {
              closed = true;
              controller.close();
              return;
            }
            const rows = await db.query("SELECT id,room_version FROM game.outbox WHERE room_code=$1 AND id>$2 ORDER BY id LIMIT 50", [params.code, last]);
            if (closed) return;
            if (rows.rows.length) {
              last = Number(rows.rows.at(-1).id);
              controller.enqueue(encoder.encode(`id: ${last}
data: ${JSON.stringify({ eventId: last, scope: "room", roomVersion: rows.rows.at(-1).room_version })}

`));
            } else controller.enqueue(encoder.encode(": keepalive\n\n"));
          } catch {
            if (!closed) {
              closed = true;
              controller.close();
            }
          }
          if (!closed) timer = setTimeout(tick, 500);
        };
        timer = setTimeout(tick, 500);
      },
      cancel() {
        closed = true;
        if (timer) clearTimeout(timer);
      }
    });
    return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-store", "Connection": "keep-alive", "X-Accel-Buffering": "no" } });
  }, { query: t.Object({ role: roleSchema, after: t.Optional(t.String()) }) }).get("/api/rooms/:code/qr", async ({ params, request, set }) => {
    const exists = await db.query("SELECT code FROM game.rooms WHERE code=$1", [params.code]);
    if (!exists.rows.length) {
      set.status = 404;
      return "";
    }
    const url = `${publicOrigin ?? new URL(request.url).origin}/play/${params.code}`;
    return new Response(await QRCode.toString(url, { type: "svg", margin: 3, errorCorrectionLevel: "M", color: { dark: "#0D1117", light: "#FFFFFF" } }), { headers: { "Content-Type": "image/svg+xml", "Cache-Control": "no-store" } });
  }).get("/api/rooms/:code/export", async ({ params, request, set }) => {
    const a = await actor(request, "host");
    if (!a) {
      set.status = 401;
      return fail("UNAUTHORIZED");
    }
    const allowed = await db.query("SELECT code FROM game.rooms WHERE code=$1 AND host_id=$2", [params.code, a.id]);
    if (!allowed.rows.length) {
      set.status = 403;
      return fail("FORBIDDEN");
    }
    const r = await db.query(`SELECT r.id,r.game_id,r.status,r.content_version,r.scoring_version,r.schedule_version,r.timing_profile,r.pause_history,r.input_digest,cf.scores,cf.created_at confirmed_at FROM game.runs r LEFT JOIN game.confirmations cf ON cf.run_id=r.id WHERE r.room_code=$1 ORDER BY r.created_at`, [params.code]);
    const audit = await db.query("SELECT actor_id,kind,payload,created_at FROM game.audit WHERE room_code=$1 ORDER BY id", [params.code]);
    const creative = await db.query(`SELECT r.id run_id,content.task,content.image_path,content.ai_caption,content.ai_metadata,
   (SELECT coalesce(jsonb_agg(to_jsonb(ro)),'[]') FROM game.rosters ro WHERE ro.run_id=r.id) roster,
   (SELECT coalesce(jsonb_agg(to_jsonb(sub)),'[]') FROM game.caption_submissions sub WHERE sub.run_id=r.id) submissions,
   (SELECT coalesce(jsonb_agg(to_jsonb(vote)),'[]') FROM game.caption_votes vote WHERE vote.run_id=r.id) votes,
   (SELECT coalesce(jsonb_agg(to_jsonb(candidate) ORDER BY position),'[]') FROM game.caption_candidates candidate WHERE candidate.run_id=r.id) candidates,
   game.caption_results(r.id) results FROM game.runs r JOIN game.caption_content content ON content.version=r.content_version WHERE r.room_code=$1 AND r.game_id='caption-battle'`, [params.code]);
    set.headers["Content-Disposition"] = `attachment; filename="human-vs-ai-${params.code}.json"`;
    return { room: params.code, runs: r.rows, audit: audit.rows, creative: creative.rows };
  }).get("/*", async ({ params, set }) => {
    if (params["*"].startsWith("api/")) {
      set.status = 404;
      return fail("NOT_FOUND");
    }
    const root = resolve4("dist");
    let path = resolve4(root, params["*"] || "index.html");
    if (path !== root && !path.startsWith(root + sep)) {
      set.status = 403;
      return "";
    }
    try {
      if (!(await stat2(path)).isFile()) path = resolve4(root, "index.html");
    } catch {
      path = resolve4(root, "index.html");
    }
    try {
      return new Response(new Uint8Array(await readFile3(path)), { headers: { "Content-Type": mime[extname(path)] ?? "application/octet-stream" } });
    } catch {
      set.status = 503;
      return "Run npm run build first.";
    }
  });
  return app;
}

// scripts/game-api-router.ts
var appPromise;
function jsonError(response, error, status, stage) {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.end(JSON.stringify({ ok: false, error, ...stage ? { stage } : {} }));
}
async function getApp() {
  if (!process.env.GAME_DATABASE_URL || !process.env.GAME_HOST_KEY) throw new Error("SERVER_NOT_CONFIGURED");
  appPromise ??= (async () => {
    let db;
    try {
      db = await openDatabase(void 0, { bootstrap: false });
    } catch (error) {
      console.error("[game-api] database initialization failed", error instanceof Error ? error.message : "unknown error");
      throw new Error("DATABASE_UNAVAILABLE");
    }
    try {
      const publicOrigin = process.env.GAME_PUBLIC_ORIGIN ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : void 0);
      return createApp(db, process.env.GAME_HOST_KEY, publicOrigin);
    } catch (error) {
      console.error("[game-api] app initialization failed", error instanceof Error ? error.message : "unknown error");
      await db.close().catch(() => {
      });
      throw new Error("API_INITIALIZATION_FAILED");
    }
  })();
  const pending = appPromise;
  void pending.catch(() => {
    if (appPromise === pending) appPromise = void 0;
  });
  return appPromise;
}
async function handler(request, response) {
  let stage = "route";
  try {
    const incoming = new URL(request.url ?? "/", `https://${request.headers.host ?? "localhost"}`);
    const route = incoming.searchParams.get("__game_route");
    if (!route || !route.startsWith("/api/")) return jsonError(response, "ROUTE_NOT_FOUND", 404);
    stage = "build-request";
    const target = new URL(route, incoming.origin);
    incoming.searchParams.delete("__game_route");
    target.search = incoming.search;
    const headers = new Headers();
    for (const name of ["accept", "content-type", "cookie", "origin", "user-agent", "x-game-role"]) {
      const value = request.headers[name];
      if (value !== void 0) headers.set(name, Array.isArray(value) ? value.join(", ") : value);
    }
    const method = request.method ?? "GET";
    const body = method === "GET" || method === "HEAD" || request.body === void 0 ? void 0 : typeof request.body === "string" ? request.body : JSON.stringify(request.body);
    const webRequest = new Request(target, { method, headers, ...body === void 0 ? {} : { body } });
    stage = "initialize-app";
    const app = await getApp();
    stage = "dispatch";
    const result = await app.handle(webRequest);
    stage = "write-response";
    response.statusCode = result.status;
    result.headers.forEach((value, name) => {
      if (name.toLowerCase() !== "set-cookie") response.setHeader(name, value);
    });
    const cookies = result.headers.getSetCookie?.() ?? (result.headers.get("set-cookie") ? [result.headers.get("set-cookie")] : []);
    if (cookies?.length) response.setHeader("Set-Cookie", cookies);
    if (!result.body) return response.end();
    const reader = result.body.getReader();
    const cancel = () => {
      void reader.cancel().catch(() => {
      });
    };
    response.once("close", cancel);
    try {
      while (!response.destroyed) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!response.write(Buffer.from(value))) await new Promise((resolve5) => {
          const ready = () => {
            response.off("drain", ready);
            response.off("close", ready);
            resolve5();
          };
          response.once("drain", ready);
          response.once("close", ready);
        });
      }
    } finally {
      response.off("close", cancel);
      await reader.cancel().catch(() => {
      });
    }
    if (!response.destroyed) response.end();
  } catch (error) {
    if (response.headersSent) {
      if (!response.destroyed) response.destroy();
      return;
    }
    if (error instanceof Error && error.message === "SERVER_NOT_CONFIGURED") return jsonError(response, "SERVER_NOT_CONFIGURED", 503);
    if (error instanceof Error && error.message === "DATABASE_UNAVAILABLE") return jsonError(response, "DATABASE_UNAVAILABLE", 503);
    if (error instanceof Error && error.message === "API_INITIALIZATION_FAILED") return jsonError(response, "API_INITIALIZATION_FAILED", 500);
    console.error("[game-api] request handling failed at", stage, error instanceof Error ? error.message : "unknown error");
    return jsonError(response, "SERVER_ERROR", 500, stage);
  }
}
export {
  handler as default
};
