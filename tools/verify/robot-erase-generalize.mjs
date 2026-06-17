// Regression guard: Dusty (erase) dropped ON A TRAINED ROBOT clears its value
// guards — "removing details from its thought bubble" so it generalises. A robot
// trained on a 1 (only matches 1) is erased → then matches a box holding any
// number. This is the on-the-floor way to generalise an already-finished robot
// (aim Dusty at the ROBOT, not at the number).
//   node tools/verify/robot-erase-generalize.mjs   (needs `npm run dev` on :3000)
import { chromium } from 'playwright';
const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto('http://localhost:3000/', { waitUntil: 'load' });
await page.waitForFunction(() => window.__ttReady === true, { timeout: 30000 });
await page.waitForTimeout(1000);
if (await page.evaluate(() => window.__ttCity?.isActive)) { await page.keyboard.press('Backquote'); await page.waitForTimeout(400); }
const out = await page.evaluate(async () => {
  const { NumberThing } = await import('/src/model/number.ts');
  const { Box } = await import('/src/model/box.ts');
  const { Robot, teamMatch } = await import('/src/model/robot.ts');
  const { Dusty } = await import('/src/model/dusty.ts');
  const w = window.__ttWorld, drag = window.__ttDrag;
  // A robot trained on a 1 WITHOUT generalising → only matches a box holding 1.
  const robot = w.add(new Robot({ condition: ['number'], exactValues: [new NumberThing({ value: 1 })], actions: [{ type: 'insert', to: 0, thing: new NumberThing({ value: 1 }) }] }));
  const box5 = new Box({ holes: [new NumberThing({ value: 5 }) ] });
  const before = { guard: robot.exactValues[0]?.describe?.() ?? null, matches5: teamMatch(robot, box5).state };
  // Dusty in ERASE mode, dropped ON THE ROBOT → clears its value guards.
  const dusty = w.add(new Dusty({ mode: 'erase' }));
  drag.resolve(dusty, robot, {});
  const after = { guard: robot.exactValues[0]?.describe?.() ?? null, matches5: teamMatch(robot, box5).state };
  return { before, after };
});
await browser.close();
const ok = out.before.matches5 === 'mismatch' && out.after.guard === null && out.after.matches5 === 'match';
console.log(JSON.stringify(out, null, 1));
console.log(`${ok ? 'PASS' : 'FAIL'} Dusty-erase ON THE ROBOT clears its value guard → it then matches any number`);
process.exit(ok ? 0 : 1);
