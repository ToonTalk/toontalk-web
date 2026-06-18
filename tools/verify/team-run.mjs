// Regression guard: a box dropped on a team is offered front-to-back; the front
// robot that DOESN'T match steps aside and the matching teammate comes forward to
// work (robot.cpp move_to_side — the team taking turns). Verifies both the visible
// turn-taking (peak displacement) and that the matching teammate's action ran.
//   node tools/verify/team-run.mjs   (needs `npm run dev` on :3000)
import { chromium } from 'playwright';
const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto('http://localhost:3000/', { waitUntil: 'load' });
await page.waitForFunction(() => window.__ttReady === true, { timeout: 30000 });
await page.waitForTimeout(800);
if (await page.evaluate(() => window.__ttCity?.isActive)) { await page.keyboard.press('Backquote'); await page.waitForTimeout(400); }

await page.evaluate(async () => {
  const { Robot } = await import('/src/model/robot.ts');
  const { Box } = await import('/src/model/box.ts');
  const { TextThing } = await import('/src/model/text.ts');
  const { floorCamera } = await import('/src/view/floor-camera.ts');
  const w = window.__ttWorld, drag = window.__ttDrag;
  for (const t of [...w.all()]) w.remove(t.id);
  // Front robot matches a 1-NUMBER box; the teammate matches a 2-TEXT box (combine).
  const lead = w.add(new Robot({ condition: ['number'], actions: [{ type: 'remove', hole: 0 }] }));
  const mate = w.add(new Robot({ condition: ['text', 'text'], actions: [{ type: 'combine', from: 1, to: 0 }] }));
  w.moveThing(lead.id, { x: floorCamera.x + 380, y: floorCamera.y + 560 });
  w.moveThing(mate.id, { x: floorCamera.x + 900, y: floorCamera.y + 560 });
  await new Promise((r) => setTimeout(r, 60));
  drag.resolve(mate, lead, {}); // team
  await new Promise((r) => setTimeout(r, 80));
  window.__lead = lead.id; window.__mate = mate.id;
  window.__home = { lead: { x: lead.x, y: lead.y }, mate: { x: mate.x, y: mate.y } };
  // Give the team a 2-TEXT box — only the teammate matches.
  const box = w.add(new Box({ holes: [new TextThing({ value: 'hi' }), new TextThing({ value: 'ho' })] }));
  w.moveThing(box.id, { x: floorCamera.x + 640, y: floorCamera.y + 300 });
  window.__box = box.id;
  await new Promise((r) => setTimeout(r, 60));
  drag.resolve(box, lead, {}); // box → team (via lead)
});

// Poll peak displacement of each robot while the run plays out.
let leadPeak = 0, matePeak = 0;
for (let i = 0; i < 22; i++) {
  const d = await page.evaluate(() => {
    const w = window.__ttWorld, h = window.__home;
    const lead = w.get(window.__lead), mate = w.get(window.__mate);
    const dl = lead ? Math.abs(lead.x - h.lead.x) + Math.abs(lead.y - h.lead.y) : 0;
    const dm = mate ? Math.abs(mate.x - h.mate.x) + Math.abs(mate.y - h.mate.y) : 0;
    return [dl, dm];
  });
  leadPeak = Math.max(leadPeak, d[0]);
  matePeak = Math.max(matePeak, d[1]);
  await page.waitForTimeout(120);
}
const final = await page.evaluate(() => {
  const b = window.__ttWorld.get(window.__box);
  return {
    hole0: b?.contentsAt(0)?.value ?? (b?.contentsAt(0) ? '?' : 'empty'),
    log: window.__ttLog().split('\n').filter((l) => l.includes('steps aside') || l.includes('starts on')).slice(-3).join(' | '),
  };
});
await browser.close();
const out = { leadPeak: Math.round(leadPeak), matePeak: Math.round(matePeak), ...final };
const ok = leadPeak > 60 && matePeak > 60 && final.hole0 === 'hiho';
console.log(JSON.stringify(out, null, 1));
console.log(`${ok ? 'PASS' : 'FAIL'} team turn-taking: front steps aside, matcher comes forward & runs`);
process.exit(ok ? 0 : 1);
