// Regression guard: held Dusty acts on a thing under its nose ON THE FLOOR (not
// just in the bubble). Places a number exactly at the active point and clicks —
// it should be sucked. Proves the floor tool path works; misses were aiming.
//   node tools/verify/floor-dusty.mjs   (needs `npm run dev` on :3000)
import { chromium } from 'playwright';
const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errs = [];
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await page.goto('http://localhost:3000/', { waitUntil: 'load' });
await page.waitForFunction(() => window.__ttReady === true, { timeout: 30000 });
await page.waitForTimeout(1000);
if (await page.evaluate(() => window.__ttCity?.isActive)) { await page.keyboard.press('Backquote'); await page.waitForTimeout(400); }
// Pick Dusty (suck) and let the pick scale-tween settle.
await page.mouse.click(256, 352);
await page.mouse.move(600, 400); await page.waitForTimeout(400);
// Put a number EXACTLY where the held nose/active point is (drag.pointer, world).
const before = await page.evaluate(async () => {
  const { NumberThing } = await import('/src/model/number.ts');
  const drag = window.__ttDrag, w = window.__ttWorld;
  const p = drag.pointer; // world-space active point (where the nose sits)
  const n = w.add(new NumberThing({ value: 7 }));
  w.moveThing(n.id, { x: p.x, y: p.y });
  await new Promise((r) => setTimeout(r, 120));
  return { numId: n.id, count: w.all().filter((t) => t.kind === 'number').length, mode: drag.heldTool?.thing?.mode, stomach: drag.heldTool?.thing?.stomach?.length ?? null };
});
// Click right there → Dusty's nose is on the number → it should suck it.
await page.mouse.click(600, 400);
await page.waitForTimeout(150);
const after = await page.evaluate(() => {
  const drag = window.__ttDrag, w = window.__ttWorld;
  return { count: w.all().filter((t) => t.kind === 'number').length, stomach: drag.heldTool?.thing?.stomach?.length ?? null, log: window.__ttLog().split('\n').slice(-4).join('\n') };
});
await browser.close();
const sucked = after.count === before.count - 1 || (after.stomach ?? 0) > (before.stomach ?? 0);
console.log(JSON.stringify({ before, after: { count: after.count, stomach: after.stomach } }, null, 1));
console.log('LOG:\n' + after.log);
if (errs.length) console.log('ERRORS:\n' + errs.slice(0, 4).join('\n'));
console.log(`${sucked ? 'PASS' : 'FAIL'} floor Dusty sucks a number placed under its nose`);
process.exit(sucked ? 0 : 1);
