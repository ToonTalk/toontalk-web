// Regression guard: running an insert WALKS the robot — toward Tooly (right) to
// fetch a fresh element, then to the box (left) to drop it, then home. We poll
// the robot's x through one run: it should swing well right of home, then well
// left, then return; and the combine lands (5→6).
//   node tools/verify/robot-walk.mjs   (needs `npm run dev` on :3000)
import { chromium } from 'playwright';
const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto('http://localhost:3000/', { waitUntil: 'load' });
await page.waitForFunction(() => window.__ttReady === true, { timeout: 30000 });
await page.waitForTimeout(1000);
if (await page.evaluate(() => window.__ttCity?.isActive)) { await page.keyboard.press('Backquote'); await page.waitForTimeout(400); }
const home = await page.evaluate(async () => {
  const { NumberThing } = await import('/src/model/number.ts');
  const { Box } = await import('/src/model/box.ts');
  const { Robot } = await import('/src/model/robot.ts');
  const { floorCamera } = await import('/src/view/floor-camera.ts');
  const w = window.__ttWorld, drag = window.__ttDrag;
  for (const t of [...w.all()]) w.remove(t.id);
  // exactValue 5 → runs ONCE on [5] (becomes 6, then stops) so we watch one walk.
  const robot = new Robot({ condition: ['number'], exactValues: [new NumberThing({ value: 5 })], actions: [{ type: 'insert', to: 0, thing: new NumberThing({ value: 1 }) }] });
  const box = new Box({ holes: [new NumberThing({ value: 5 })] });
  w.add(robot); w.add(box);
  window.__r = robot.id; window.__b = box.id;
  w.moveThing(robot.id, { x: floorCamera.x + 740, y: floorCamera.y + 320 });
  w.moveThing(box.id, { x: floorCamera.x + 380, y: floorCamera.y + 320 });
  await new Promise((r) => setTimeout(r, 80));
  drag.resolve(box, robot, {});
  return 740;
});
const xs = [];
for (let i = 0; i < 22; i++) {
  await page.waitForTimeout(160);
  xs.push(await page.evaluate(async () => {
    const { floorCamera } = await import('/src/view/floor-camera.ts');
    return Math.round((window.__ttWorld.get(window.__r)?.x ?? NaN) - floorCamera.x);
  }));
}
const value = await page.evaluate(() => Number(window.__ttWorld.get(window.__b)?.contentsAt(0)?.value?.toString?.() ?? 'NaN'));
await browser.close();
const maxX = Math.max(...xs), minX = Math.min(...xs), finalX = xs[xs.length - 1];
const ok = maxX > home + 120 && minX < home - 100 && Math.abs(finalX - home) < 50 && value === 6;
console.log(JSON.stringify({ home, maxX, minX, finalX, value }, null, 1));
console.log(`${ok ? 'PASS' : 'FAIL'} robot walks to Tooly (right) then the box (left) then home, and combines (5→6)`);
process.exit(ok ? 0 : 1);
