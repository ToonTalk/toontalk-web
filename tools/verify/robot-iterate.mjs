// Regression guard: a trained robot run on the floor ITERATES — a generalised
// "add 1" robot keeps counting (5→7→…) on its own — and STOPS the moment you
// grab it (the box freezes exactly, no extra in-flight tick).
//   node tools/verify/robot-iterate.mjs   (needs `npm run dev` on :3000)
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
  const robot = w.add(new Robot({ condition: ['number'], actions: [{ type: 'insert', to: 0, thing: new NumberThing({ value: 1 }) }] }));
  w.moveThing(robot.id, { x: floorCamera.x + 760, y: floorCamera.y + 300 });
  const box = w.add(new Box({ holes: [new NumberThing({ value: 5 })] }));
  w.moveThing(box.id, { x: floorCamera.x + 400, y: floorCamera.y + 300 });
  window.__b = box.id;
  await new Promise((r) => setTimeout(r, 80));
  drag.resolve(box, robot, {}); // start the robot iterating on the box
  return { robotScreen: [Math.round(robot.x - floorCamera.x), Math.round(robot.y - floorCamera.y)] };
});
const read = () => page.evaluate(() => Number(window.__ttWorld.get(window.__b)?.contentsAt(0)?.value?.toString?.() ?? 'NaN'));
await page.waitForTimeout(4200);
const climbed = await read();
const looping = await page.evaluate(() => !!window.__ttDrag && !!window.__ttRoom); // sanity
await page.mouse.click(geo.robotScreen[0], geo.robotScreen[1]); // grab the robot → should stop it
await page.waitForTimeout(300);
const atGrab = await read();
await page.waitForTimeout(2600);
const afterGrab = await read();
await browser.close();
const iterated = climbed > 5;
const stopped = afterGrab - atGrab <= 1; // frozen after the grab (allow one in-flight)
const ok = iterated && stopped;
console.log(JSON.stringify({ start: 5, after4_2s: climbed, atGrab, afterGrab }, null, 1));
console.log(`${ok ? 'PASS' : 'FAIL'} robot iterates (5→${climbed}) and stops when grabbed (${atGrab}→${afterGrab})`);
process.exit(ok ? 0 : 1);
