// Regression guard: when a robot RUNS an insert, it re-enacts training by
// fetching a fresh element FROM TOOLY — a display node flies from the toolbox
// (top-right) toward the box hole mid-run before the combine lands.
//   node tools/verify/robot-fetch.mjs   (needs `npm run dev` on :3000)
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
  for (const t of [...w.all()]) w.remove(t.id);
  const robot = w.add(new Robot({ condition: ['number'], actions: [{ type: 'insert', to: 0, thing: new NumberThing({ value: 1 }) }] }));
  w.moveThing(robot.id, { x: floorCamera.x + 760, y: floorCamera.y + 320 });
  const box = w.add(new Box({ holes: [new NumberThing({ value: 5 })] }));
  w.moveThing(box.id, { x: floorCamera.x + 380, y: floorCamera.y + 320 });
  window.__b = box.id;
  await new Promise((r) => setTimeout(r, 80));
  drag.resolve(box, robot, {}); // run → first insert fetches from Tooly
  return { boxX: 380 };
});
// Mid-flight (~250ms into a 520ms fly): a high-zIndex display node should exist,
// somewhere between Tooly (right) and the box (left).
await page.waitForTimeout(250);
const fly = await page.evaluate(() => {
  const layer = window.__ttDrag.renderer.thingLayer;
  const node = layer.children.find((c) => c.zIndex >= 6000);
  return node ? { found: true, screenX: Math.round(node.getBounds().x) } : { found: false };
});
await page.waitForTimeout(2000);
const after = await page.evaluate(() => Number(window.__ttWorld.get(window.__b)?.contentsAt(0)?.value?.toString?.() ?? 'NaN'));
await browser.close();
const ok = fly.found && after === 6;
console.log(JSON.stringify({ flyingNodeMidRun: fly, valueAfter: after }, null, 1));
console.log(`${ok ? 'PASS' : 'FAIL'} insert run flies a fresh element from Tooly, then combines (5→6)`);
process.exit(ok ? 0 : 1);
