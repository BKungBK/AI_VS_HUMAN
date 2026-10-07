import fs from 'node:fs/promises';
import {chromium} from 'playwright';
import {chapters, allCues} from '../src/content.ts';

const base = process.env.DECK_URL || 'http://127.0.0.1:5173';
const directory = 'tmp/pdfs/slide-captures';
await fs.mkdir(directory, {recursive: true});
const browser = await chromium.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
  args: ['--use-angle=d3d11', '--disable-features=CalculateNativeWinOcclusion'],
});
try {
  const page = await browser.newPage({viewport: {width: 1920, height: 1080}, deviceScaleFactor: 1});
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${base}/?clean=1`);
  await page.waitForFunction(() => window.deck?.ready, null, {timeout: 60000});
  await page.evaluate(() => { window.deck.pause(); return document.fonts.ready; });
  const manifest = [];
  for (const [index, item] of allCues.entries()) {
    await page.evaluate(([scene, beat]) => window.deck.go(scene, beat), [item.scene, item.beat]);
    await page.waitForFunction(id => document.querySelector('.stage')?.dataset.cue === id, item.cue.id);
    await page.waitForFunction(() => [...document.querySelectorAll('.spatial-host img')].every(img => img.complete && img.naturalWidth > 0));
    await page.evaluate(async () => {
      await Promise.all([...document.querySelectorAll('.spatial-host img')].map(img => img.decode()));
      window.deck.seek(4);
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    });
    const overflow = await page.evaluate(() => [...document.querySelectorAll('.spatial-host .glass-inner')]
      .filter(el => el.scrollHeight > el.clientHeight + 2 || el.scrollWidth > el.clientWidth + 2)
      .map(el => el.textContent.slice(0, 80)));
    if (overflow.length) throw new Error(`Overflow on ${item.cue.id}: ${overflow.join(', ')}`);
    const image = `${directory}/${String(index + 1).padStart(2, '0')}-${item.cue.id}.png`;
    await page.screenshot({path: image});
    manifest.push({page: index + 1, cueId: item.cue.id, title: item.cue.title.replaceAll('\n', ' '),
      chapterId: chapters[item.scene].id, chapterTitle: chapters[item.scene].title,
      kind: item.cue.kind, image, frameSeconds: 4});
    console.log(`Captured ${index + 1}/${allCues.length}: ${item.cue.id}`);
  }
  if (errors.length) throw new Error(errors.join('\n'));
  await fs.writeFile('tmp/pdfs/slide-manifest.json', JSON.stringify(manifest, null, 2));
  console.log('All 43 slide frames captured in presentation order.');
} finally {
  await browser.close();
}
