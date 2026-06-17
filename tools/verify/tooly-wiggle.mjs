// Regression guard: a Tooly item wiggles while the pointer is over it ("ready to
// be picked up") and settles when the pointer leaves.
//   node tools/verify/tooly-wiggle.mjs   (needs `npm run dev` on :3000)
import { chromium } from 'playwright';
const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto('http://localhost:3000/', { waitUntil: 'load' });
await page.waitForFunction(() => window.__ttReady === true, { timeout: 30000 });
await page.waitForTimeout(1000);
if (await page.evaluate(() => window.__ttCity?.isActive)) { await page.keyboard.press('Backquote'); await page.waitForTimeout(400); }
const read = () => page.evaluate(() => {
  const t = window.__ttRoom?.toolHover;
  return t ? { x: t.x, y: t.y, nodeX: Math.round(t.node.position.x), nodeY: Math.round(t.node.position.y) } : null;
});
// Hover a Tooly compartment (this spot picks 'number')
await page.mouse.move(863, 184); await page.waitForTimeout(250);
const onItem = await read();
const wiggling = onItem && (onItem.nodeX !== onItem.x || onItem.nodeY !== onItem.y);
// Move away to empty floor → wiggle stops, hover clears
await page.mouse.move(450, 430); await page.waitForTimeout(120);
const offItem = await read();
await browser.close();
const ok = !!onItem && wiggling && offItem === null;
console.log(JSON.stringify({ onItem, wiggling, offItem }, null, 1));
console.log(`${ok ? 'PASS' : 'FAIL'} Tooly item wiggles on hover, settles on leave`);
process.exit(ok ? 0 : 1);
