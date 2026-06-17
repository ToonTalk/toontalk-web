// Regression guard for robot.htm "use Dusty to suck things out of the box to
// generalise": erasing a hole's value IN THE BUBBLE during training clears the
// robot's exact-value guard, so the trained robot then matches a box holding
// ANY number — give it a box with 5 and it adds 1 → 6. (Doing this on the floor
// after training does NOT generalise; the condition is fixed when you finish.)
//   node tools/verify/robot-generalize.mjs   (needs `npm run dev` on :3000)
import { chromium } from 'playwright';
const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto('http://localhost:3000/', { waitUntil: 'load' });
await page.waitForFunction(() => window.__ttReady === true, { timeout: 30000 });
await page.waitForTimeout(1000);
if (await page.evaluate(() => window.__ttCity?.isActive)) { await page.keyboard.press('Backquote'); await page.waitForTimeout(400); }
// Train a robot ON a box holding 1, but ERASE hole 0 first (generalise → any
// number), then demonstrate "add 1" (insert a 1 → combine).
await page.evaluate(async () => {
  const { NumberThing } = await import('/src/model/number.ts');
  const { Box } = await import('/src/model/box.ts');
  const { Robot } = await import('/src/model/robot.ts');
  const { floorCamera } = await import('/src/view/floor-camera.ts');
  const w = window.__ttWorld, drag = window.__ttDrag;
  const robot = w.add(new Robot({}));
  window.__rid = robot.id;
  const box = w.add(new Box({ holes: [new NumberThing({ value: 1 })] }));
  w.moveThing(box.id, { x: floorCamera.x + 380, y: floorCamera.y + 300 });
  await new Promise((r) => setTimeout(r, 80));
  drag.resolve(box, robot, {});                 // enter thoughts
  await new Promise((r) => setTimeout(r, 120));
  drag.trainer.eraseHole(0);                     // Dusty-erase the 1 → "any number"
  drag.trainer.recordInsert(0, new NumberThing({ value: 1 })); // demonstrate +1
  await new Promise((r) => setTimeout(r, 60));
});
await page.keyboard.press('Escape');             // finish training
await page.waitForTimeout(300);
const cond = await page.evaluate(() => {
  const r = window.__ttWorld.get(window.__rid);
  return { actions: r.actions.length, exact0: r.exactValues?.[0] ?? null, cond0: r.condition?.[0] ?? null };
});
// Now GIVE THE ROBOT A BOX HOLDING 5 → it should match (any number) and add 1 → 6.
await page.evaluate(async () => {
  const { NumberThing } = await import('/src/model/number.ts');
  const { Box } = await import('/src/model/box.ts');
  const { floorCamera } = await import('/src/view/floor-camera.ts');
  const w = window.__ttWorld, drag = window.__ttDrag;
  const robot = w.get(window.__rid);
  const box5 = w.add(new Box({ holes: [new NumberThing({ value: 5 })] }));
  window.__b5 = box5.id;
  w.moveThing(box5.id, { x: floorCamera.x + 720, y: floorCamera.y + 300 });
  await new Promise((r) => setTimeout(r, 80));
  drag.resolve(box5, robot, {});                 // give it the box → run/replay
});
await page.waitForTimeout(2200);                 // let the replay finish (combine lands on the bam)
const out = await page.evaluate(() => ({
  box5hole0: window.__ttWorld.get(window.__b5)?.contentsAt(0)?.value?.toString?.() ?? null,
  log: window.__ttLog().split('\n').slice(-4).join('\n'),
}));
await browser.close();
const ok = out.box5hole0 === '6';
console.log(JSON.stringify({ trained: cond, gaveBox5_got: out.box5hole0 }, null, 1));
console.log('LOG:\n' + out.log);
console.log(`${ok ? 'PASS' : 'FAIL'} erase-in-bubble generalises: robot adds 1 to a box holding 5 → 6`);
process.exit(ok ? 0 : 1);
