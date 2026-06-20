// Guard: when a robot's COPY step needs the wand, it walks to the wand WHERE IT
// ACTUALLY SITS on the floor — not to Tooly. Put a wand at lower-left, run the
// doubler (which starts to its right), and check the robot heads LEFT toward the
// wand (x decreases), not right toward Tooly (top-right).
//   node tools/verify/robot-wand-source.mjs   (needs `npm run dev` on :3000)
import { chromium } from 'playwright';
const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto('http://localhost:3000/', { waitUntil: 'load' });
await page.waitForFunction(() => window.__ttReady === true, { timeout: 30000 });
await page.waitForTimeout(800);
if (await page.evaluate(() => window.__ttCity?.isActive)) { await page.keyboard.press('Backquote'); await page.waitForTimeout(400); }

const start = await page.evaluate(async () => {
  const { Robot } = await import('/src/model/robot.ts');
  const { Box } = await import('/src/model/box.ts');
  const { NumberThing } = await import('/src/model/number.ts');
  const { Wand } = await import('/src/model/wand.ts');
  const { floorCamera } = await import('/src/view/floor-camera.ts');
  const w = window.__ttWorld, drag = window.__ttDrag;
  for (const t of [...w.all()]) if (t.kind === 'robot' || t.kind === 'box' || t.kind === 'wand') w.remove(t.id);
  const wand = w.add(new Wand({ x: floorCamera.x + 200, y: floorCamera.y + 600 })); // lower-LEFT
  const dbl = w.add(new Robot({ condition: ['number'], actions: [{ type: 'copy', from: 0, to: 0 }] }));
  const box = w.add(new Box({ holes: [new NumberThing({ value: 5 })] }));
  w.moveThing(dbl.id, { x: floorCamera.x + 620, y: floorCamera.y + 320 });
  w.moveThing(box.id, { x: floorCamera.x + 760, y: floorCamera.y + 320 });
  await new Promise((r) => setTimeout(r, 60));
  drag.resolve(box, dbl, {});
  return { robotStartX: Math.round(dbl.x), wandX: Math.round(wand.x), dbl: dbl.id, box: box.id };
});

// Sample the robot's x while it's fetching the wand.
let minX = start.robotStartX;
for (let i = 0; i < 6; i++) {
  await page.waitForTimeout(100);
  const x = await page.evaluate((id) => Math.round(window.__ttWorld.get(id)?.x ?? 0), start.dbl);
  if (x > 0) minX = Math.min(minX, x);
}
await page.waitForTimeout(5000); // let the full gesture finish
const result = await page.evaluate((id) => window.__ttWorld.get(id)?.contentsAt(0)?.value?.toString?.() ?? '?', start.box);
await browser.close();

const out = { robotStartX: start.robotStartX, wandX: start.wandX, minX, result };
// Heads toward the wand (left) → minX well below the start; NOT toward Tooly (right).
const ok = minX < start.robotStartX - 120 && start.wandX < start.robotStartX && result === '10';
console.log(JSON.stringify(out, null, 1));
console.log(`${ok ? 'PASS' : 'FAIL'} copy fetches the wand from the floor (robot heads toward it), doubles 5→10`);
process.exit(ok ? 0 : 1);
