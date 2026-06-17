// Regression guard for the ITERATION/loop path: dropping a generalised "add 1"
// robot + a box into a TRUCK builds a HOUSE (a running process); the truck
// drives off and the house re-runs the robot every tick, so the box keeps
// counting up (5 -> 8 -> ...). This is how a robot "keeps counting until
// stopped" — the loop is the house, not extra erasing in the thought bubble.
//   node tools/verify/robot-counter.mjs   (needs `npm run dev` on :3000)
import { chromium } from 'playwright';
const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto('http://localhost:3000/', { waitUntil: 'load' });
await page.waitForFunction(() => window.__ttReady === true, { timeout: 30000 });
await page.waitForTimeout(1000);
if (await page.evaluate(() => window.__ttCity?.isActive)) { await page.keyboard.press('Backquote'); await page.waitForTimeout(400); }
const built = await page.evaluate(async () => {
  const { NumberThing } = await import('/src/model/number.ts');
  const { Box } = await import('/src/model/box.ts');
  const { Robot } = await import('/src/model/robot.ts');
  const { Truck } = await import('/src/model/truck.ts');
  const { floorCamera } = await import('/src/view/floor-camera.ts');
  const w = window.__ttWorld, drag = window.__ttDrag;
  const truck = w.add(new Truck({ x: floorCamera.x + 520, y: floorCamera.y + 360 }));
  const robot = w.add(new Robot({ condition: ['number'], actions: [{ type: 'insert', to: 0, thing: new NumberThing({ value: 1 }) }] }));
  const box = w.add(new Box({ holes: [new NumberThing({ value: 5 })] }));
  drag.resolve(robot, truck, {});  // load the robot
  drag.resolve(box, truck, {});    // load the box → truck drives off, builds a house
  await new Promise((r) => setTimeout(r, 60));
  const house = w.all().find((t) => t.kind === 'house');
  window.__h = house?.id ?? null;
  return { houseBuilt: !!house, trucksLeft: w.all().filter((t) => t.kind === 'truck').length, startVal: house?.box?.contentsAt(0)?.value?.toString?.() ?? null };
});
const read = () => page.evaluate(() => window.__ttWorld.get(window.__h)?.box?.contentsAt(0)?.value?.toString?.() ?? null);
await page.waitForTimeout(2600);
const after = await read();
await browser.close();
const ok = built.houseBuilt && built.trucksLeft === 0 && Number(after) > Number(built.startVal);
console.log(JSON.stringify({ ...built, afterTicks: after }, null, 1));
console.log(`${ok ? 'PASS' : 'FAIL'} truck(robot+box) → house that counts up`);
process.exit(ok ? 0 : 1);
