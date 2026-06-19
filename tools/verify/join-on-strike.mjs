// Guard: dropping a box on the side of another box does NOT join until Bammer's
// hammer comes down — the boxes merge ON the strike (~1.2s), not immediately.
//   node tools/verify/join-on-strike.mjs   (needs `npm run dev` on :3000)
import { chromium } from 'playwright';
const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto('http://localhost:3000/', { waitUntil: 'load' });
await page.waitForFunction(() => window.__ttReady === true, { timeout: 30000 });
await page.waitForTimeout(800);
if (await page.evaluate(() => window.__ttCity?.isActive)) { await page.keyboard.press('Backquote'); await page.waitForTimeout(400); }

const ids = await page.evaluate(async () => {
  const { Box } = await import('/src/model/box.ts');
  const { NumberThing } = await import('/src/model/number.ts');
  const { floorCamera } = await import('/src/view/floor-camera.ts');
  const w = window.__ttWorld, drag = window.__ttDrag;
  for (const t of [...w.all()]) if (t.kind === 'box') w.remove(t.id);
  const a = w.add(new Box({ holes: [new NumberThing({ value: 1 }), new NumberThing({ value: 2 })] })); // size 2
  const b = w.add(new Box({ holes: [new NumberThing({ value: 9 })] })); // size 1
  w.moveThing(a.id, { x: floorCamera.x + 360, y: floorCamera.y + 300 });
  w.moveThing(b.id, { x: floorCamera.x + 620, y: floorCamera.y + 300 });
  await new Promise((r) => setTimeout(r, 60));
  drag.resolve(a, b, {}); // drop A on B's side (no holeIndex → join)
  return { a: a.id, b: b.id };
});

const sizeB = () => page.evaluate((id) => window.__ttWorld.get(id)?.size ?? -1, ids.b);
const aGone = () => page.evaluate((id) => !window.__ttWorld.get(id), ids.a);

await page.waitForTimeout(200);
const earlySize = await sizeB();      // still 1 — not joined yet (Bammer en route)
const earlyAGone = await aGone();     // A still present
await page.waitForTimeout(1800);
const lateSize = await sizeB();       // 3 — joined on the strike
const lateAGone = await aGone();      // A consumed
await browser.close();

const out = { earlySize, earlyAGone, lateSize, lateAGone };
const ok = earlySize === 1 && earlyAGone === false && lateSize === 3 && lateAGone === true;
console.log(JSON.stringify(out, null, 1));
console.log(`${ok ? 'PASS' : 'FAIL'} box join waits for Bammer: size 1 (before) → 3 (on strike), A consumed`);
process.exit(ok ? 0 : 1);
