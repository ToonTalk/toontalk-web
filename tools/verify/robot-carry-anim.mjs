// Guard: a robot re-enacts copy / move / remove / swap / selfCopy by CARRYING the
// thing across — the model change lands on arrival / the Bammer strike, not
// instantly. Each "early" sample (mid-flight) shows the OLD state; each "late"
// sample shows the applied result.
//   node tools/verify/robot-carry-anim.mjs   (needs `npm run dev` on :3000)
import { chromium } from 'playwright';
const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto('http://localhost:3000/', { waitUntil: 'load' });
await page.waitForFunction(() => window.__ttReady === true, { timeout: 30000 });
await page.waitForTimeout(800);
if (await page.evaluate(() => window.__ttCity?.isActive)) { await page.keyboard.press('Backquote'); await page.waitForTimeout(400); }

async function run(condition, actions, holesSpec, exactSpec) {
  return page.evaluate(async ({ condition, actions, holesSpec, exactSpec }) => {
    const { Robot } = await import('/src/model/robot.ts');
    const { Box } = await import('/src/model/box.ts');
    const { NumberThing } = await import('/src/model/number.ts');
    const { Scale, recomputeScales } = await import('/src/model/scale.ts');
    const { floorCamera } = await import('/src/view/floor-camera.ts');
    const w = window.__ttWorld, drag = window.__ttDrag;
    for (const t of [...w.all()]) if (t.kind === 'robot' || t.kind === 'box') w.remove(t.id);
    const mk = (s) => (s === null ? null : s === 'scale' ? new Scale() : new NumberThing({ value: s }));
    const mkE = (s) => (s == null ? null : s === 'R' ? new Scale({ tilt: 'right' }) : new NumberThing({ value: s }));
    const r = w.add(new Robot({ condition, actions, exactValues: exactSpec ? exactSpec.map(mkE) : undefined }));
    const box = w.add(new Box({ holes: holesSpec.map(mk) }));
    recomputeScales(box);
    w.moveThing(r.id, { x: floorCamera.x + 740, y: floorCamera.y + 320 });
    w.moveThing(box.id, { x: floorCamera.x + 360, y: floorCamera.y + 320 });
    await new Promise((res) => setTimeout(res, 60));
    drag.resolve(box, r, {});
    window.__box = box.id;
  }, { condition, actions, holesSpec, exactSpec });
}
const cell = (i) => page.evaluate((i) => {
  const c = window.__ttWorld.get(window.__box)?.contentsAt(i);
  return c ? (c.kind === 'number' ? c.value.toString() : c.kind) : 'empty';
}, i);

await run(['number'], [{ type: 'copy', from: 0, to: 0 }], [5]);
await page.waitForTimeout(350); const copyEarly = await cell(0);
await page.waitForTimeout(2500); const copyLate = await cell(0);

await run(['number', null], [{ type: 'move', from: 0, to: 1 }], [7, null]);
await page.waitForTimeout(350); const moveEarly = await cell(1);
await page.waitForTimeout(1400); const moveLate = await cell(1);

await run(['number'], [{ type: 'remove', hole: 0 }], [9]);
await page.waitForTimeout(350); const remEarly = await cell(0);
await page.waitForTimeout(900); const remLate = await cell(0);

await run(['number', 'scale', 'number'], [{ type: 'swap', a: 0, b: 2 }], [3, 'scale', 8], [null, 'R', null]);
await page.waitForTimeout(350); const swapEarly = await cell(0);
await page.waitForTimeout(1400); const swapLate0 = await cell(0), swapLate2 = await cell(2);

await run(['number', null], [{ type: 'selfCopy', to: 1 }], [5, null]);
await page.waitForTimeout(350); const scEarly = await cell(1);
await page.waitForTimeout(1200); const scLate = await cell(1);

await browser.close();
const out = { copyEarly, copyLate, moveEarly, moveLate, remEarly, remLate, swapEarly, swapLate0, swapLate2, scEarly, scLate };
const ok =
  copyEarly === '5' && copyLate === '10' &&
  moveEarly === 'empty' && moveLate === '7' &&
  remEarly === '9' && remLate === 'empty' &&
  swapEarly === '3' && swapLate0 === '8' && swapLate2 === '3' &&
  scEarly === 'empty' && scLate === 'robot';
console.log(JSON.stringify(out, null, 1));
console.log(`${ok ? 'PASS' : 'FAIL'} carry re-enactment: copy/move/remove/swap/selfCopy land on arrival, not instantly`);
process.exit(ok ? 0 : 1);
