// Regression guard: in the thought bubble, the wiggle feedback is on the HOLE'S
// CONTENT the active point is over (so you see what a tool/drop will act on),
// not the whole robot. Off the box, nothing wiggles.
//   node tools/verify/bubble-wiggle.mjs   (needs `npm run dev` on :3000)
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
  const box = w.add(new Box({ holes: [new NumberThing({ value: 1 })] }));
  w.moveThing(box.id, { x: floorCamera.x + 400, y: floorCamera.y + 300 });
  await new Promise((r) => setTimeout(r, 80));
  drag.resolve(box, robot, {});
  await new Promise((r) => setTimeout(r, 200));
  const copy = drag.trainer.box;
  return { boxCentre: [Math.round(copy.x - floorCamera.x), Math.round(copy.y - floorCamera.y)] };
});
// over the filled hole → hoverTarget is that hole's content node
await page.mouse.move(geo.boxCentre[0], geo.boxCentre[1]); await page.waitForTimeout(80);
const onHole = await page.evaluate(() => {
  const drag = window.__ttDrag, t = drag.hoverTarget, bv = drag.views.get(drag.trainer.box.id);
  return { hasTarget: !!t, isHoleNode: !!t && t.node === bv.holeNode(0)?.node, isRobot: !!t && t.node === drag.views.get(window.__ttWorld.all().find((x)=>x.kind==='robot').id)?.container };
});
// far from the box → nothing wiggles
await page.mouse.move(geo.boxCentre[0], geo.boxCentre[1] - 200); await page.waitForTimeout(80);
const offBox = await page.evaluate(() => ({ hasTarget: !!window.__ttDrag.hoverTarget }));
await browser.close();
const ok = onHole.hasTarget && onHole.isHoleNode && !onHole.isRobot && !offBox.hasTarget;
console.log(JSON.stringify({ onHole, offBox }, null, 1));
console.log(`${ok ? 'PASS' : 'FAIL'} bubble wiggles the targeted hole's content (not the robot)`);
process.exit(ok ? 0 : 1);
