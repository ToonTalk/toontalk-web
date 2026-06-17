// Regression guard: a trained robot REPLAYS a combine step with Bammer, and the
// result lands at the SLAM (~1.2s) — not instantly. We sample the box value at
// 600ms (mouse still running in → unchanged) and at 1600ms (after the slam →
// combined), so "the 2 appeared before the mouse came out" stays fixed.
//   node tools/verify/bubble-replay.mjs   (needs `npm run dev` on :3000)
import { chromium } from 'playwright';
const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto('http://localhost:3000/', { waitUntil: 'load' });
await page.waitForFunction(() => window.__ttReady === true, { timeout: 30000 });
await page.waitForTimeout(1000);
if (await page.evaluate(() => window.__ttCity?.isActive)) { await page.keyboard.press('Backquote'); await page.waitForTimeout(400); }
// Train a robot to "add 1" (put-in of a 1 into hole 0), then finish.
await page.evaluate(async () => {
  const { NumberThing } = await import('/src/model/number.ts');
  const { Box } = await import('/src/model/box.ts');
  const { Robot } = await import('/src/model/robot.ts');
  const { floorCamera } = await import('/src/view/floor-camera.ts');
  const w = window.__ttWorld, drag = window.__ttDrag;
  const robot = w.add(new Robot({}));
  window.__robotId = robot.id;
  const box = w.add(new Box({ holes: [new NumberThing({ value: 1 })] }));
  w.moveThing(box.id, { x: floorCamera.x + 400, y: floorCamera.y + 300 });
  await new Promise((r) => setTimeout(r, 80));
  drag.resolve(box, robot, {});                 // enter thoughts
  await new Promise((r) => setTimeout(r, 120));
  drag.trainer.recordInsert(0, new NumberThing({ value: 1 })); // put a 1 in → combine
  await new Promise((r) => setTimeout(r, 60));
});
await page.keyboard.press('Escape'); // finish training
await page.waitForTimeout(300);
// Test: drop a matching box (holds 1) on the trained robot → it REPLAYS.
await page.evaluate(async () => {
  const { NumberThing } = await import('/src/model/number.ts');
  const { Box } = await import('/src/model/box.ts');
  const { floorCamera } = await import('/src/view/floor-camera.ts');
  const w = window.__ttWorld, drag = window.__ttDrag;
  const robot = w.get(window.__robotId);
  const box2 = w.add(new Box({ holes: [new NumberThing({ value: 1 })] }));
  window.__box2Id = box2.id;
  w.moveThing(box2.id, { x: floorCamera.x + 700, y: floorCamera.y + 300 });
  await new Promise((r) => setTimeout(r, 80));
  drag.resolve(box2, robot, {}); // → animateRun replay
});
const read = () => page.evaluate(() => window.__ttWorld.get(window.__box2Id)?.contentsAt(0)?.value?.toString?.() ?? null);
await page.waitForTimeout(600);  const at600 = await read();   // Bammer still running in → unchanged
await page.waitForTimeout(1000); const at1600 = await read();  // after the slam → combined
await browser.close();
const ok = at600 === '1' && at1600 === '2';
console.log(`${ok ? 'PASS' : 'FAIL'} replay timing: value@600ms=${at600} (want 1, pre-slam) value@1600ms=${at1600} (want 2, post-slam)`);
process.exit(ok ? 0 : 1);
