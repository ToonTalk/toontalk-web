// Regression guard for the thought-bubble training bug: a robot's imagined box
// (a fresh copy that never gets a 'changed' refresh) must be hit-testable, so
// dropping a number onto a hole in the bubble records a put-in / combine.
// Before the view-factory fix its geometry was degenerate and the drop missed.
//   node tools/verify/bubble-train.mjs   (needs `npm run dev` on :3000)
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
  const { Robot } = await import('/src/model/robot.ts');
  const { floorCamera } = await import('/src/view/floor-camera.ts');
  const w = window.__ttWorld, drag = window.__ttDrag;
  const robot = w.add(new Robot({}));
  const box = w.add(new Box({ size: 1 }));
  w.moveThing(box.id, { x: floorCamera.x + 400, y: floorCamera.y + 300 });
  await new Promise((r) => setTimeout(r, 60));
  drag.resolve(new NumberThing({ value: 1 }), box, { holeIndex: 0 }); // box holds 1
  await new Promise((r) => setTimeout(r, 60));
  drag.resolve(box, robot, {});                                       // enter thoughts (no refresh!)
  await new Promise((r) => setTimeout(r, 200));
  const copy = drag.trainer.box;
  return { boxCentre: [Math.round(copy.x - floorCamera.x), Math.round(copy.y - floorCamera.y)] };
});
// Pick a number from Tooly, carry it to the box centre, drop → should COMBINE 1 -> 2.
await page.mouse.click(863, 184); // Tooly number compartment at 1280x800
await page.waitForTimeout(80);
await page.mouse.move(geo.boxCentre[0], geo.boxCentre[1]);
await page.waitForTimeout(60);
await page.mouse.click(geo.boxCentre[0], geo.boxCentre[1]);
await page.waitForTimeout(150);
const res = await page.evaluate(() => ({
  steps: window.__ttDrag.trainer.stepCount,
  imaginedHole0: window.__ttDrag.trainer.box.contentsAt(0)?.value?.toString?.() ?? null,
}));
await browser.close();
const ok = res.steps === 1 && res.imaginedHole0 === '2';
console.log(`${ok ? 'PASS' : 'FAIL'} bubble put-in: steps=${res.steps} imaginedHole0=${res.imaginedHole0} (want 1 / 2)`);
process.exit(ok ? 0 : 1);
