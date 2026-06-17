// Regression guard for the WAIT state: a robot given an INCOMPLETE box (a hole
// the rule needs is empty) doesn't stop — it waits, and resumes the moment the
// missing thing is added. Here an "add the two holes" robot gets [5, empty]:
// it waits (box stays 5), then dropping a 3 into hole 1 resumes it → 5+3 = 8.
// (Same path resumes when a bird delivers to an empty nest — both notifyChanged.)
//   node tools/verify/robot-wait.mjs   (needs `npm run dev` on :3000)
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
  // "add the two holes": needs BOTH holes filled. Give it [5, empty] → it waits.
  const robot = w.add(new Robot({ condition: ['number', 'number'], actions: [{ type: 'combine', from: 1, to: 0 }] }));
  w.moveThing(robot.id, { x: floorCamera.x + 760, y: floorCamera.y + 300 });
  const box = w.add(new Box({ holes: [new NumberThing({ value: 5 }), null] }));
  w.moveThing(box.id, { x: floorCamera.x + 400, y: floorCamera.y + 300 });
  window.__b = box.id;
  await new Promise((r) => setTimeout(r, 80));
  drag.resolve(box, robot, {}); // box is incomplete → robot should WAIT, not run
});
const read = () => page.evaluate(() => Number(window.__ttWorld.get(window.__b)?.contentsAt(0)?.value?.toString?.() ?? 'NaN'));
await page.waitForTimeout(1300);
const whileWaiting = await read(); // still 5 — it hasn't run
const waitingLogged = await page.evaluate(() => window.__ttLog().includes('waiting'));
// Now ADD the missing number to hole 1 → the robot should resume and add.
await page.evaluate(async () => {
  const { NumberThing } = await import('/src/model/number.ts');
  const w = window.__ttWorld, drag = window.__ttDrag;
  drag.resolve(new NumberThing({ value: 3 }), w.get(window.__b), { holeIndex: 1 });
});
await page.waitForTimeout(1900); // resume + the combine lands on the bam
const afterFill = await read();
await browser.close();
const ok = whileWaiting === 5 && waitingLogged && afterFill === 8;
console.log(JSON.stringify({ whileWaiting, waitingLogged, afterFill }, null, 1));
console.log(`${ok ? 'PASS' : 'FAIL'} robot waits on an incomplete box, resumes when filled (5 +3 → 8)`);
process.exit(ok ? 0 : 1);
