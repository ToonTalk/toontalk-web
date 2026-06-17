// Regression guard: the active-point reticle is VISIBLE on the floor while a
// tool is held (it sits on the tool's tip/nose, so you can see where it acts),
// and hides again when the tool is dropped. The invisible active point was why
// floor tools kept missing.
//   node tools/verify/tool-reticle.mjs   (needs `npm run dev` on :3000)
import { chromium } from 'playwright';
const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto('http://localhost:3000/', { waitUntil: 'load' });
await page.waitForFunction(() => window.__ttReady === true, { timeout: 30000 });
await page.waitForTimeout(1000);
if (await page.evaluate(() => window.__ttCity?.isActive)) { await page.keyboard.press('Backquote'); await page.waitForTimeout(400); }
// A small ring Graphics sits directly on the stage (screen coords) as the reticle.
const ringInfo = () => page.evaluate(() => {
  const stage = window.__ttApp.stage;
  const ring = stage.children.find((c) => c.constructor.name.includes('Graphics'));
  if (!ring) return null;
  return { visible: ring.visible, x: Math.round(ring.position.x), y: Math.round(ring.position.y) };
});
const beforePick = await ringInfo();
await page.mouse.click(256, 352);              // pick Dusty
await page.mouse.move(620, 360); await page.waitForTimeout(120);
const held = await page.evaluate(() => window.__ttDrag.heldTool?.thing?.kind ?? null);
const heldRing = await ringInfo();             // should be visible AT the cursor
await page.keyboard.press('Escape');           // drop the tool
await page.waitForTimeout(80);
const droppedRing = await ringInfo();          // should be hidden again
await browser.close();
const near = (a, x, y) => a && Math.abs(a.x - x) <= 3 && Math.abs(a.y - y) <= 3;
const ok = held === 'dusty' && beforePick && !beforePick.visible
  && heldRing && heldRing.visible && near(heldRing, 620, 360)
  && droppedRing && !droppedRing.visible;
console.log(JSON.stringify({ beforePick, held, heldRing, droppedRing }, null, 1));
console.log(`${ok ? 'PASS' : 'FAIL'} floor reticle shows at the cursor while a tool is held`);
process.exit(ok ? 0 : 1);
