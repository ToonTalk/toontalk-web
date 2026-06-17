// Regression guard: a held tool applied just OFF a thing on the floor snaps to
// the nearest thing (DragController.nearestThing, ~48px) instead of dropping
// onto bare floor. Dusty aimed ~30px past a box's edge still sucks its number.
//   node tools/verify/tool-floor-aim.mjs   (needs `npm run dev` on :3000)
import { chromium } from 'playwright';
const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto('http://localhost:3000/', { waitUntil: 'load' });
await page.waitForFunction(() => window.__ttReady === true, { timeout: 30000 });
await page.waitForTimeout(1000);
if (await page.evaluate(() => window.__ttCity?.isActive)) { await page.keyboard.press('Backquote'); await page.waitForTimeout(400); }
const geo = await page.evaluate(async () => {
  const { NumberThing } = await import('/src/model/number.ts');
  const { Box } = await import('/src/model/box.ts');
  const { floorCamera } = await import('/src/view/floor-camera.ts');
  const w = window.__ttWorld;
  for (const t of [...w.all()]) w.remove(t.id);
  const box = w.add(new Box({ holes: [new NumberThing({ value: 7 })] }));
  w.moveThing(box.id, { x: floorCamera.x + 520, y: floorCamera.y + 300 });
  window.__b = box.id;
  await new Promise((r) => setTimeout(r, 150));
  const b = window.__ttDrag.views.get(box.id).container.getBounds();
  return { right: Math.round(b.x + b.width), midY: Math.round(b.y + b.height / 2), filled: !box.isHoleEmpty(0) };
});
await page.mouse.click(256, 352); await page.waitForTimeout(80); // pick Dusty (suck)
// Aim ~30px to the RIGHT of the box edge — a near-miss; nearestThing should snap.
await page.mouse.click(geo.right + 30, geo.midY); await page.waitForTimeout(150);
const res = await page.evaluate(() => ({
  empty: window.__ttWorld.get(window.__b)?.isHoleEmpty(0) ?? 'gone',
  log: window.__ttLog().split('\n').slice(-2).join('\n'),
}));
await browser.close();
const ok = geo.filled === true && res.empty === true;
console.log(JSON.stringify({ filledBefore: geo.filled, emptyAfter: res.empty }, null, 1));
console.log('LOG:\n' + res.log);
console.log(`${ok ? 'PASS' : 'FAIL'} near-miss Dusty-suck snaps to the box and sucks its number`);
process.exit(ok ? 0 : 1);
