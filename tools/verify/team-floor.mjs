// Regression guard for separate-floor teams: dropping a robot on a robot makes
// them a team of SEPARATE world robots lined up behind the lead (each its own
// thing, leader set); grabbing a teammate pulls it OFF the team.
//   node tools/verify/team-floor.mjs   (needs `npm run dev` on :3000)
import { chromium } from 'playwright';
const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto('http://localhost:3000/', { waitUntil: 'load' });
await page.waitForFunction(() => window.__ttReady === true, { timeout: 30000 });
await page.waitForTimeout(1000);
if (await page.evaluate(() => window.__ttCity?.isActive)) { await page.keyboard.press('Backquote'); await page.waitForTimeout(400); }
const built = await page.evaluate(async () => {
  const { Robot } = await import('/src/model/robot.ts');
  const { floorCamera } = await import('/src/view/floor-camera.ts');
  const w = window.__ttWorld, drag = window.__ttDrag;
  for (const t of [...w.all()]) w.remove(t.id);
  const lead = w.add(new Robot({ condition: ['number'], actions: [{ type: 'remove', hole: 0 }] }));
  const mate = w.add(new Robot({ condition: ['text'], actions: [{ type: 'remove', hole: 0 }] }));
  w.moveThing(lead.id, { x: floorCamera.x + 480, y: floorCamera.y + 320 });
  w.moveThing(mate.id, { x: floorCamera.x + 850, y: floorCamera.y + 320 });
  window.__lead = lead.id; window.__mate = mate.id;
  await new Promise((r) => setTimeout(r, 60));
  drag.resolve(mate, lead, {}); // mate joins lead's team
  await new Promise((r) => setTimeout(r, 60));
  const lb = drag.views.get(lead.id).container.getBounds();
  const mb = drag.views.get(mate.id).container.getBounds();
  return {
    teamLen: lead.team.length,
    mateLinked: mate.leader === lead,
    mateInWorld: w.get(mate.id) === mate,
    mateScreen: [Math.round(mate.x - floorCamera.x), Math.round(mate.y - floorCamera.y)],
    leadBounds: [Math.round(lb.x), Math.round(lb.x + lb.width)],
    mateBounds: [Math.round(mb.x), Math.round(mb.x + mb.width)],
    linedUp: mate.x > lead.x,
  };
});
// Pull the teammate off: grab it where it sits and DRAG it away to empty floor
// (a click in place would drop it back onto the overlapping lead and re-team).
await page.mouse.move(built.mateScreen[0], built.mateScreen[1]);
await page.mouse.down();
await page.mouse.move(150, 700, { steps: 6 }); // far from the lead so the big robot bounds don't overlap (re-team)
await page.mouse.up();
await page.waitForTimeout(120);
const after = await page.evaluate(() => ({
  teamLen: window.__ttWorld.get(window.__lead).team.length,
  mateDetached: (window.__ttWorld.get(window.__mate)?.leader ?? null) === null,
  grabbed: window.__ttDrag.dragging?.thing?.id ?? null,
  leadId: window.__lead, mateId: window.__mate,
  log: window.__ttLog().split('\n').slice(-3).join(' | '),
}));
await browser.close();
const ok = built.teamLen === 1 && built.mateLinked && built.mateInWorld && built.linedUp && after.teamLen === 0 && after.mateDetached;
console.log(JSON.stringify({ built, after }, null, 1));
console.log(`${ok ? 'PASS' : 'FAIL'} team = separate lined-up robots; grabbing a member pulls it off`);
process.exit(ok ? 0 : 1);
