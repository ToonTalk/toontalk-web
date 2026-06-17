// Regression guard: Dusty works inside a robot's thought bubble. The held tool
// sits ON the active point there (so aiming the nozzle at a hole hits it), and
// the mode keys (E/S/R) are live during training, so pressing E switches Dusty
// to ERASE and clicking a hole generalises its value (erased=true), not just
// removes it. (Both were broken: tool drawn ~HELD_OFFSET off; keys disabled.)
//   node tools/verify/bubble-dusty.mjs   (needs `npm run dev` on :3000)
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
  drag.resolve(new NumberThing({ value: 1 }), box, { holeIndex: 0 });
  await new Promise((r) => setTimeout(r, 60));
  drag.resolve(box, robot, {});
  await new Promise((r) => setTimeout(r, 200));
  const copy = drag.trainer.box;
  return { boxCentre: [Math.round(copy.x - floorCamera.x), Math.round(copy.y - floorCamera.y)] };
});
await page.mouse.click(256, 352); // pick Dusty (suck)
await page.waitForTimeout(80);
await page.keyboard.press('KeyE'); // switch to erase mode
await page.waitForTimeout(60);
const mode = await page.evaluate(() => window.__ttDrag.heldTool?.thing?.mode ?? null);
await page.mouse.move(geo.boxCentre[0], geo.boxCentre[1]);
await page.waitForTimeout(60);
await page.mouse.click(geo.boxCentre[0], geo.boxCentre[1]); // erase hole 0's value (generalise)
await page.waitForTimeout(120);
const res = await page.evaluate(() => {
  const c = window.__ttDrag.trainer.box.contentsAt(0);
  return {
    erased: c?.erased ?? null,
    stillThere: c?.value?.toString?.() ?? null,
    log: window.__ttLog().split('\n').slice(-3).join('\n'),
  };
});
await browser.close();
const ok = mode === 'erase' && res.erased === true;
console.log(`${ok ? 'PASS' : 'FAIL'} bubble erase: mode=${mode} erased=${res.erased} value=${res.stillThere}`);
console.log(res.log);
process.exit(ok ? 0 : 1);
