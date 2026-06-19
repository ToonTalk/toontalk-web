// Guard: the notebook's corner buttons (◀ ▶) flip pages on a CLICK — forward and
// back — and a click does NOT duplicate a page (the old bug: tapping a page filed
// a copy and jumped to the last page).
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
  const nb = window.__ttWorld.all().find((t) => t instanceof Notebook && t.isMain);
  nb.goTo(1); window.__ttWorld.notifyChanged(nb);
  await new Promise((r) => setTimeout(r, 150));
  return { index: nb.index, pages: nb.pages.length, id: nb.id };
});

// Find a fresh screen point on the given arrow (-1 ◀ / 1 ▶) via arrowDir probe.
const arrowPoint = (dir) => page.evaluate(async (dir) => {
  const { floorCamera } = await import('/src/view/floor-camera.ts');
  const { Notebook } = await import('/src/model/notebook.ts');
  const w = window.__ttWorld, drag = window.__ttDrag;
  const nb = w.all().find((t) => t instanceof Notebook && t.isMain);
  const nv = drag.views.get(nb.id);
  const b = nv.container.getBounds();
  for (let fx = 0.02; fx <= 0.98; fx += 0.02) {
    for (let fy = 0.55; fy <= 0.98; fy += 0.02) {
      const sx = b.x + b.width * fx, sy = b.y + b.height * fy;
      if (nv.arrowDir(sx + floorCamera.x, sy + floorCamera.y) === dir) return [Math.round(sx), Math.round(sy)];
    }
  }
  return null;
}, dir);
const idxNow = () => page.evaluate((id) => window.__ttWorld.get(id).index, start.id);
const clickAt = async (p) => { await page.mouse.click(p[0], p[1]); await page.waitForTimeout(160); };

// Flipping doesn't move the notebook, so the right button stays put → click the
// same spot twice (0→1→2), then the left button (2→1).
const rightP = await arrowPoint(1);
if (rightP) await clickAt(rightP); const afterNext1 = await idxNow();
if (rightP) await clickAt(rightP); const afterNext2 = await idxNow();
const leftP = await arrowPoint(-1);
if (leftP) await clickAt(leftP); const afterPrev = await idxNow();
const end = await page.evaluate((id) => ({ pages: window.__ttWorld.get(id).pages.length }), start.id);
await browser.close();

const out = { startIndex: start.index, rightP, leftP, afterNext1, afterNext2, afterPrev, pagesBefore: start.pages, pagesAfter: end.pages };
const ok = rightP && leftP && afterNext1 === 1 && afterNext2 === 2 && afterPrev === 1 && end.pages === start.pages;
console.log(JSON.stringify(out, null, 1));
console.log(`${ok ? 'PASS' : 'FAIL'} notebook: corner buttons flip ▶▶◀ (0→1→2→1) and don't duplicate pages`);
process.exit(ok ? 0 : 1);
