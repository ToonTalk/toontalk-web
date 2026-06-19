// Guard: notebook navigation matches the original — SPACE / right-click → next
// page, Backspace (rubout) → previous, a typed NUMBER jumps to that page (digits
// accumulate). No on-screen page buttons. Pages are never duplicated by this.
//   node tools/verify/notebook-flip.mjs   (needs `npm run dev` on :3000)
import { chromium } from 'playwright';
const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();
await page.goto('http://localhost:3000/', { waitUntil: 'load' });
await page.waitForFunction(() => window.__ttReady === true, { timeout: 30000 });
await page.waitForTimeout(800);
if (await page.evaluate(() => window.__ttCity?.isActive)) { await page.keyboard.press('Backquote'); }
await page.waitForTimeout(2000); // floor camera settles

const start = await page.evaluate(async () => {
  const { Notebook } = await import('/src/model/notebook.ts');
  const { floorCamera } = await import('/src/view/floor-camera.ts');
  const nb = window.__ttWorld.all().find((t) => t instanceof Notebook && t.isMain);
  nb.goTo(1); window.__ttWorld.notifyChanged(nb);
  await new Promise((r) => setTimeout(r, 150));
  return { id: nb.id, pages: nb.pages.length, center: [Math.round(nb.x - floorCamera.x), Math.round(nb.y - floorCamera.y)] };
});
const idx = () => page.evaluate((id) => window.__ttWorld.get(id).index, start.id);

// Point at the notebook so keys target it (hoveredThing), then drive the keys.
await page.mouse.move(start.center[0], start.center[1]);
await page.waitForTimeout(100);

await page.keyboard.press('Space'); await page.waitForTimeout(120); const afterSpace1 = await idx(); // →1
await page.keyboard.press('Space'); await page.waitForTimeout(120); const afterSpace2 = await idx(); // →2
await page.mouse.click(start.center[0], start.center[1], { button: 'right' }); await page.waitForTimeout(120);
const afterRight = await idx(); // →3
await page.keyboard.press('Backspace'); await page.waitForTimeout(120); const afterBack = await idx(); // →2
// type "10" → page 10 (index 9), proving digit accumulation
await page.mouse.move(start.center[0], start.center[1]); await page.waitForTimeout(60);
await page.keyboard.press('1'); await page.waitForTimeout(80);
await page.keyboard.press('0'); await page.waitForTimeout(120);
const afterDigits = await idx(); // →9
const pagesAfter = await page.evaluate((id) => window.__ttWorld.get(id).pages.length, start.id);
await browser.close();

const out = { afterSpace1, afterSpace2, afterRight, afterBack, afterDigits, pagesBefore: start.pages, pagesAfter };
const ok = afterSpace1 === 1 && afterSpace2 === 2 && afterRight === 3 && afterBack === 2 &&
  afterDigits === 9 && pagesAfter === start.pages;
console.log(JSON.stringify(out, null, 1));
console.log(`${ok ? 'PASS' : 'FAIL'} notebook nav: space/right-click next, rubout back, "10"→page 10; no dup`);
process.exit(ok ? 0 : 1);
