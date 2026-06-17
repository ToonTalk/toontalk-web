// Regression guard: a held tool's BUSINESS END is the active point — Dusty's
// nose and the wand's star sit on the cursor/reticle (tipErr≈0), while the
// sprite centre is offset, so aiming the tip is what gets clicked.
//   node tools/verify/tool-tip.mjs   (needs `npm run dev` on :3000)
import { chromium } from 'playwright';
const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const probe = () => page.evaluate(async () => {
  const drag = window.__ttDrag, v = drag.heldTool;
  if (!v) return { held: null };
  const off = v.activeOffset(), s = v.container.scale;
  const tex = v.textures.get(v.thing.kind);
  return {
    held: v.thing.kind,
    off: [Math.round(off.x), Math.round(off.y)],
    scale: [s.x, s.y],
    texWH: tex ? [tex.width, tex.height] : null,
    spriteW: Math.round(v.container.getLocalBounds().width),
    tipErr: [Math.round(v.thing.x + off.x * s.x - drag.pointer.x), Math.round(v.thing.y + off.y * s.y - drag.pointer.y)],
    centerErr: [Math.round(v.thing.x - drag.pointer.x), Math.round(v.thing.y - drag.pointer.y)],
  };
});
async function testTool(pickXY) {
  await page.goto('http://localhost:3000/', { waitUntil: 'load' });
  await page.waitForFunction(() => window.__ttReady === true, { timeout: 30000 });
  await page.waitForTimeout(900);
  if (await page.evaluate(() => window.__ttCity?.isActive)) { await page.keyboard.press('Backquote'); await page.waitForTimeout(400); }
  await page.mouse.click(pickXY[0], pickXY[1]);
  await page.mouse.move(600, 400); await page.waitForTimeout(350); // let the pick scale-tween settle
  await page.mouse.move(640, 440); await page.waitForTimeout(60);  // a move at the settled scale sets the final position
  return probe();
}
const d = await testTool([256, 352]); // Dusty chip
const w = await testTool([307, 576]); // wand chip
await browser.close();
const near0 = (e) => e && Math.abs(e[0]) <= 2 && Math.abs(e[1]) <= 2;
const offCenter = (e) => e && (Math.abs(e[0]) > 5 || Math.abs(e[1]) > 5);
const ok = d.held === 'dusty' && w.held === 'wand'
  && near0(d.tipErr) && near0(w.tipErr)      // the TIP sits on the hit point
  && offCenter(d.centerErr) && offCenter(w.centerErr); // the CENTRE does not (tip ≠ centre)
console.log(JSON.stringify({ d, w }, null, 1));
console.log(`${ok ? 'PASS' : 'FAIL'} held tool's tip/nose is the active point (tipErr≈0, centre offset)`);
process.exit(ok ? 0 : 1);
