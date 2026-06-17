// Regression guard: a WAITING robot must not freeze the tab when the world
// changes. The wait-resume subscriber used to re-subscribe synchronously inside
// world.emit(); adding a listener mid-emit makes the same emit visit it again →
// infinite loop. We fire a 'changed' event while a robot waits and require the
// page to stay responsive (the call returns well under the watchdog).
//   node tools/verify/robot-wait-nofreeze.mjs   (needs `npm run dev` on :3000)
import { chromium } from 'playwright';
const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto('http://localhost:3000/', { waitUntil: 'load' });
await page.waitForFunction(() => window.__ttReady === true, { timeout: 30000 });
await page.waitForTimeout(1000);
if (await page.evaluate(() => window.__ttCity?.isActive)) { await page.keyboard.press('Backquote'); await page.waitForTimeout(400); }
await page.evaluate(async () => {
  const { NumberThing } = await import('/src/model/number.ts');
  const { Box } = await import('/src/model/box.ts');
  const { Robot } = await import('/src/model/robot.ts');
  const { floorCamera } = await import('/src/view/floor-camera.ts');
  const w = window.__ttWorld, drag = window.__ttDrag;
  const robot = w.add(new Robot({ condition: ['number', 'number'], actions: [{ type: 'combine', from: 1, to: 0 }] }));
  w.moveThing(robot.id, { x: floorCamera.x + 760, y: floorCamera.y + 300 });
  const box = w.add(new Box({ holes: [new NumberThing({ value: 5 }), null] }));
  w.moveThing(box.id, { x: floorCamera.x + 400, y: floorCamera.y + 300 });
  window.__b = box.id;
  await new Promise((r) => setTimeout(r, 80));
  drag.resolve(box, robot, {}); // incomplete box → robot WAITS (subscribes)
});
await page.waitForTimeout(200);
// Fire a 'changed' event while the robot waits. Pre-fix this re-fired forever.
const ranInMs = await Promise.race([
  page.evaluate(() => {
    const t0 = performance.now();
    window.__ttWorld.notifyChanged(window.__ttWorld.get(window.__b)); // still incomplete → stays waiting
    return performance.now() - t0;
  }),
  new Promise((r) => setTimeout(() => r('TIMEOUT'), 6000)),
]);
const responsive = ranInMs === 'TIMEOUT' ? false : await page.evaluate(() => 1 + 1 === 2);
await browser.close();
const ok = ranInMs !== 'TIMEOUT' && responsive;
console.log(JSON.stringify({ notifyTookMs: ranInMs, responsive }, null, 1));
console.log(`${ok ? 'PASS' : 'FAIL'} a waiting robot does not freeze the tab on a world change`);
process.exit(ok ? 0 : 1);
