// Guard: a robot re-enacts copy / move / combine by CARRYING the thing across —
// the model change lands on the Bammer strike / landing, not instantly. Verifies
// the doubler (copy 0→0) and a mover (move 0→1) defer their effect.
//   node tools/verify/robot-carry-anim.mjs   (needs `npm run dev` on :3000)
import { chromium } from 'playwright';
const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto('http://localhost:3000/', { waitUntil: 'load' });
await page.waitForFunction(() => window.__ttReady === true, { timeout: 30000 });
await page.waitForTimeout(800);
if (await page.evaluate(() => window.__ttCity?.isActive)) { await page.keyboard.press('Backquote'); await page.waitForTimeout(400); }

async function run(actions, holes) {
  return page.evaluate(async ({ actions, holes }) => {
    const { Robot } = await import('/src/model/robot.ts');
    const { Box } = await import('/src/model/box.ts');
    const { NumberThing } = await import('/src/model/number.ts');
    const { floorCamera } = await import('/src/view/floor-camera.ts');
    const w = window.__ttWorld, drag = window.__ttDrag;
    for (const t of [...w.all()]) if (t.kind === 'robot' || t.kind === 'box') w.remove(t.id);
    const cond = holes.map((h) => (h === null ? null : 'number'));
    const r = w.add(new Robot({ condition: cond, actions }));
    const box = w.add(new Box({ holes: holes.map((h) => (h === null ? null : new NumberThing({ value: h }))) }));
    w.moveThing(r.id, { x: floorCamera.x + 720, y: floorCamera.y + 320 });
    w.moveThing(box.id, { x: floorCamera.x + 360, y: floorCamera.y + 320 });
    await new Promise((res) => setTimeout(res, 60));
    drag.resolve(box, r, {});
    window.__box = box.id;
  }, { actions, holes });
}
const cell = (i) => page.evaluate((i) => {
  const b = window.__ttWorld.get(window.__box);
  const c = b?.contentsAt(i);
  return c ? c.value.toString() : 'empty';
}, i);

// Doubler: copy 0→0 on [5] → stays 5 mid-flight, becomes 10 on the strike.
await run([{ type: 'copy', from: 0, to: 0 }], [5]);
await page.waitForTimeout(350); const dblEarly = await cell(0);
await page.waitForTimeout(2500); const dblLate = await cell(0);

// Mover: move 0→1 on [7, empty] → hole 1 empty mid-carry, filled after landing.
await run([{ type: 'move', from: 0, to: 1 }], [7, null]);
await page.waitForTimeout(350); const mvEarly = await cell(1);
await page.waitForTimeout(1400); const mvLateTo = await cell(1); const mvLateFrom = await cell(0);

await browser.close();
const out = { dblEarly, dblLate, mvEarly, mvLateTo, mvLateFrom };
const ok = dblEarly === '5' && dblLate === '10' && mvEarly === 'empty' && mvLateTo === '7' && mvLateFrom === 'empty';
console.log(JSON.stringify(out, null, 1));
console.log(`${ok ? 'PASS' : 'FAIL'} carry re-enactment: copy (5→10) and move (0→1) land on the strike, not instantly`);
process.exit(ok ? 0 : 1);
