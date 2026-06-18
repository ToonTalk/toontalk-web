// Regression guard: hand tools are reachable + usable INSIDE the thought bubble.
// The thingLayer renders above the toolbox chrome, so the imagined box must sit
// clear of the spilled tools (Dusty/Pumpy/wand) or it covers them and steals
// their clicks. Verifies, with REAL clicks:
//   • Dusty picked from Tooly erases a SINGLE hole (generalise), not the robot.
//   • the wand picked from Tooly copies hole→hole (and doesn't double-fire).
//   node tools/verify/train-tools.mjs   (needs `npm run dev` on :3000)
import { chromium } from 'playwright';
const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto('http://localhost:3000/', { waitUntil: 'load' });
await page.waitForFunction(() => window.__ttReady === true, { timeout: 30000 });
await page.waitForTimeout(800);
if (await page.evaluate(() => window.__ttCity?.isActive)) { await page.keyboard.press('Backquote'); await page.waitForTimeout(400); }

async function freshTraining() {
  return page.evaluate(async () => {
    const { Robot } = await import('/src/model/robot.ts');
    const { Box } = await import('/src/model/box.ts');
    const { NumberThing } = await import('/src/model/number.ts');
    const { floorCamera } = await import('/src/view/floor-camera.ts');
    const w = window.__ttWorld, drag = window.__ttDrag;
    for (const t of [...w.all()]) w.remove(t.id);
    const robot = w.add(new Robot());
    const box = w.add(new Box({ holes: [new NumberThing({ value: 3 }), new NumberThing({ value: 5 }), null] }));
    w.moveThing(robot.id, { x: floorCamera.x + 520, y: floorCamera.y + 300 });
    w.moveThing(box.id, { x: floorCamera.x + 300, y: floorCamera.y + 300 });
    await new Promise((r) => setTimeout(r, 60));
    drag.resolve(box, robot, {}); // → enter thoughts (training)
    await new Promise((r) => setTimeout(r, 160));
    const W = window.__ttApp.renderer.width, H = window.__ttApp.renderer.height;
    const bubbleId = w.all().filter((t) => t.kind === 'box').slice(-1)[0].id;
    const bv = drag.views.get(bubbleId);
    const h0 = bv.holeNode(0).node.getGlobalPosition();
    const h1 = bv.holeNode(1).node.getGlobalPosition();
    return {
      active: drag.debug.trainerActive, bubbleId,
      wandChip: [Math.round(W * 0.24), Math.round(H * 0.72)],
      dustyChip: [Math.round(W * 0.2), Math.round(H * 0.44)],
      h0: [Math.round(h0.x), Math.round(h0.y)], h1: [Math.round(h1.x), Math.round(h1.y)],
    };
  });
}

// Dusty: pick it, erase mode, click hole 0 → that hole only generalises.
let s = await freshTraining();
await page.mouse.click(s.dustyChip[0], s.dustyChip[1]); await page.waitForTimeout(120);
const dustyHeld = await page.evaluate(() => window.__ttDrag.debug.heldTool);
await page.keyboard.press('e'); await page.waitForTimeout(50);
await page.mouse.move(s.h0[0], s.h0[1]); await page.mouse.down(); await page.mouse.up();
await page.waitForTimeout(150);
const dusty = await page.evaluate((id) => {
  const b = window.__ttWorld.get(id);
  return { hole0Erased: b?.contentsAt(0)?.erased ?? null, hole1Erased: b?.contentsAt(1)?.erased ?? null };
}, s.bubbleId);

// Wand: pick it, copy-drag hole 0 (3) onto hole 1 (5) → hole 1 becomes 8.
s = await freshTraining();
await page.mouse.click(s.wandChip[0], s.wandChip[1]); await page.waitForTimeout(120);
const wandHeld = await page.evaluate(() => window.__ttDrag.debug.heldTool);
await page.mouse.move(s.h0[0], s.h0[1]); await page.mouse.down();
await page.mouse.move(s.h1[0], s.h1[1], { steps: 5 }); await page.mouse.up();
await page.waitForTimeout(150);
const wand = await page.evaluate((id) => {
  const b = window.__ttWorld.get(id);
  return { hole1: b?.contentsAt(1)?.value?.toString?.() ?? null };
}, s.bubbleId);

await browser.close();
const out = { dustyHeld, dusty, wandHeld, wand };
const ok = dustyHeld === 'dusty' && dusty.hole0Erased === true && dusty.hole1Erased !== true &&
           wandHeld === 'wand' && wand.hole1 === '8';
console.log(JSON.stringify(out, null, 1));
console.log(`${ok ? 'PASS' : 'FAIL'} bubble tools: Dusty erases one hole · wand copies hole→hole`);
process.exit(ok ? 0 : 1);
