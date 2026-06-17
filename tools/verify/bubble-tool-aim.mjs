// Regression guard: Dusty (and tools) in the thought bubble use the SAME
// forgiving snap as put-in (BoxView.dropHole, ~30px), so a near-miss still
// erases the hole. Aims ~55px off the hole: strict holeIndexAt → null (would
// miss), forgiving dropHole → 0, and the erase lands. This was why Dusty kept
// missing while put-in (already forgiving) worked.
//   node tools/verify/bubble-tool-aim.mjs   (needs `npm run dev` on :3000)
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
  w.moveThing(box.id, { x: floorCamera.x + 460, y: floorCamera.y + 320 });
  await new Promise((r) => setTimeout(r, 60));
  drag.resolve(new NumberThing({ value: 1 }), box, { holeIndex: 0 });
  await new Promise((r) => setTimeout(r, 60));
  drag.resolve(box, robot, {});
  await new Promise((r) => setTimeout(r, 200));
  const copy = drag.trainer.box;
  return { boxCentre: [Math.round(copy.x - floorCamera.x), Math.round(copy.y - floorCamera.y)] };
});
await page.mouse.click(256, 352); await page.waitForTimeout(80); // pick Dusty
await page.keyboard.press('KeyE'); await page.waitForTimeout(60); // erase mode
// Aim ~55px ABOVE the hole — outside the strict box rect, inside the forgiving margin.
await page.mouse.move(geo.boxCentre[0], geo.boxCentre[1] - 55); await page.waitForTimeout(80);
const aim = await page.evaluate(() => {
  const drag = window.__ttDrag, bv = drag.views.get(drag.trainer.box.id), p = drag.pointer;
  return { strictHole: bv.holeIndexAt(p.x, p.y), forgivingHole: bv.dropHole(p.x, p.y, 30) };
});
await page.mouse.click(geo.boxCentre[0], geo.boxCentre[1] - 55); await page.waitForTimeout(150);
const erased = await page.evaluate(() => window.__ttDrag.trainer.box.contentsAt(0)?.erased ?? null);
await browser.close();
const ok = aim.strictHole === null && aim.forgivingHole === 0 && erased === true;
console.log(JSON.stringify({ aim, erased }, null, 1));
console.log(`${ok ? 'PASS' : 'FAIL'} near-miss Dusty (strict miss, forgiving snap) still erases the hole`);
process.exit(ok ? 0 : 1);
