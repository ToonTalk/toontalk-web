// Guard: you can pull a COPY off EITHER open leaf of the notebook (left = current
// page, right = next page), and the notebook keeps its own — pad.cpp grabs a copy
// of the page on the clicked side (which_side). Uses real drag-aways.
//   node tools/verify/notebook-take.mjs   (needs `npm run dev` on :3000)
import { chromium } from 'playwright';
const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();
await page.goto('http://localhost:3000/', { waitUntil: 'load' });
await page.waitForFunction(() => window.__ttReady === true, { timeout: 30000 });
await page.waitForTimeout(800);
if (await page.evaluate(() => window.__ttCity?.isActive)) { await page.keyboard.press('Backquote'); }
await page.waitForTimeout(2000); // let the floor camera finish settling

// Flip the main notebook so BOTH leaves show robots (Add | Multiply).
const setup = await page.evaluate(async () => {
  const { Notebook } = await import('/src/model/notebook.ts');
  const { Robot } = await import('/src/model/robot.ts');
  const w = window.__ttWorld, drag = window.__ttDrag;
  const nb = w.all().find((t) => t instanceof Notebook && t.isMain);
  nb.goTo(3); // index 2 → left = page 3 (Add), right = page 4 (Multiply)
  w.notifyChanged(nb);
  await new Promise((r) => setTimeout(r, 250));
  return {
    nbId: nb.id, pagesBefore: nb.pages.length,
    robotsBefore: w.all().filter((t) => t instanceof Robot).length,
    leftIsRobot: nb.pages[nb.index] instanceof Robot,
    rightIsRobot: nb.pages[nb.index + 1] instanceof Robot,
  };
});

// Read a leaf's CURRENT screen centre (card.getBounds is global = page coords).
const leafCenter = (which) => page.evaluate((which) => {
  const w = window.__ttWorld, drag = window.__ttDrag;
  const nb = w.all().find((t) => t.kind === 'notebook' && t.isMain);
  const nv = drag.views.get(nb.id);
  const leaves = nv.leafScreenCenters();
  const want = which === 'left' ? nb.index : nb.index + 1;
  const leaf = leaves.find((l) => l.index === want);
  return leaf ? [Math.round(leaf.x), Math.round(leaf.y)] : null;
}, which);

async function dragLeafAway(which, to) {
  const c = await leafCenter(which); // read fresh, click immediately
  if (!c) return null;
  await page.mouse.move(c[0], c[1]);
  await page.mouse.down();
  await page.mouse.move(to[0], to[1], { steps: 6 });
  await page.mouse.up();
  await page.waitForTimeout(150);
  return c;
}
const rightC = await dragLeafAway('right', [200, 200]);
const leftC = await dragLeafAway('left', [200, 470]);

const after = await page.evaluate((nbId) => {
  const w = window.__ttWorld;
  const nb = w.get(nbId);
  return {
    robotsAfter: w.all().filter((t) => t.kind === 'robot').length,
    pagesAfter: nb.pages.length,
  };
}, setup.nbId);
await browser.close();

const out = { ...setup, rightC, leftC, ...after };
const ok = setup.leftIsRobot && setup.rightIsRobot && rightC && leftC &&
  out.robotsAfter === setup.robotsBefore + 2 && out.pagesAfter === setup.pagesBefore;
console.log(JSON.stringify(out, null, 1));
console.log(`${ok ? 'PASS' : 'FAIL'} notebook: a copy can be taken off EITHER leaf; the notebook keeps its pages`);
process.exit(ok ? 0 : 1);
