// Regression guard: a robot guarded on a SCALE tilt stops itself. Box is
// [counter, scale, limit]; the scale tips right while counter < limit, so the
// robot keeps adding 1 — and when counter reaches the limit the scale balances,
// the guard fails, and the loop halts on its own (climbs to 3, then stops).
//   node tools/verify/robot-scale-stop.mjs   (needs `npm run dev` on :3000)
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
  const { Scale } = await import('/src/model/scale.ts');
  const { floorCamera } = await import('/src/view/floor-camera.ts');
  const w = window.__ttWorld, drag = window.__ttDrag;
  // [counter, scale, limit]; the scale tips right while counter < limit.
  const box = w.add(new Box({ holes: [new NumberThing({ value: 0 }), new Scale(), new NumberThing({ value: 3 })] }));
  w.moveThing(box.id, { x: floorCamera.x + 400, y: floorCamera.y + 320 });
  window.__b = box.id;
  // Add 1 to hole 0, but only WHILE the scale tips right (counter < limit).
  const robot = w.add(new Robot({
    condition: ['number', 'scale', 'number'],
    exactValues: [null, new Scale({ tilt: 'right' }), null],
    actions: [{ type: 'insert', to: 0, thing: new NumberThing({ value: 1 }) }],
  }));
  w.moveThing(robot.id, { x: floorCamera.x + 760, y: floorCamera.y + 320 });
  await new Promise((r) => setTimeout(r, 80));
  drag.resolve(box, robot, {});
});
const read = () => page.evaluate(() => Number(window.__ttWorld.get(window.__b)?.contentsAt(0)?.value?.toString?.() ?? 'NaN'));
await page.waitForTimeout(8500);
const a = await read();
await page.waitForTimeout(2400);
const b = await read();
const running = await page.evaluate(() => !!window.__ttDrag); // (loop tracked privately)
await browser.close();
const ok = a === 3 && b === 3;
console.log(JSON.stringify({ stoppedAt: a, stillAfter: b }, null, 1));
console.log(`${ok ? 'PASS' : 'FAIL'} scale-guarded counter climbs to the limit (3) and stops itself`);
process.exit(ok ? 0 : 1);
