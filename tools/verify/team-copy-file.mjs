// Integration guard for Teams Phase 2 in the LIVE app (real world events +
// view-factory, driven through the model APIs the UI calls):
//   • wand "S" copies a lead + its team as SEPARATE floor robots (each with a view)
//   • filing the lead GATHERS its teammates off the floor (views removed too)
//   • unfiling (a fresh copy + expandTeam) brings the whole team back with views
//   node tools/verify/team-copy-file.mjs   (needs `npm run dev` on :3000)
import { chromium } from 'playwright';
const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto('http://localhost:3000/', { waitUntil: 'load' });
await page.waitForFunction(() => window.__ttReady === true, { timeout: 30000 });
await page.waitForTimeout(800);
if (await page.evaluate(() => window.__ttCity?.isActive)) { await page.keyboard.press('Backquote'); await page.waitForTimeout(400); }

const out = await page.evaluate(async () => {
  const { Robot, expandTeam } = await import('/src/model/robot.ts');
  const { resolveDrop } = await import('/src/model/interactions.ts');
  const { Wand } = await import('/src/model/wand.ts');
  const { Notebook } = await import('/src/model/notebook.ts');
  const { floorCamera } = await import('/src/view/floor-camera.ts');
  const w = window.__ttWorld, drag = window.__ttDrag;
  const settle = () => new Promise((r) => setTimeout(r, 60));
  const robots = () => w.all().filter((t) => t instanceof Robot);
  const hasView = (id) => !!drag.views.get(id);

  for (const t of [...w.all()]) w.remove(t.id);
  const lead = w.add(new Robot({ condition: ['number'], actions: [{ type: 'remove', hole: 0 }] }));
  const mate = w.add(new Robot({ condition: ['text'], actions: [{ type: 'remove', hole: 0 }] }));
  w.moveThing(lead.id, { x: floorCamera.x + 420, y: floorCamera.y + 300 });
  w.moveThing(mate.id, { x: floorCamera.x + 800, y: floorCamera.y + 300 });
  await settle();
  resolveDrop(w, mate, lead); // team of two on the floor
  await settle();

  // 1. Wand "S" copy → original team + a copied team, all separate, all with views.
  resolveDrop(w, new Wand({ mode: 'S' }), lead);
  await settle();
  const after = robots();
  const leads = after.filter((r) => r.leader === null);
  const copyLead = leads.find((r) => r !== lead);
  const copyMate = copyLead?.team[0];
  const copied = {
    robotCount: after.length, // expect 4
    leadCount: leads.length, // expect 2
    copyMateLinked: copyMate?.leader === copyLead,
    copyMateInWorld: copyMate ? w.get(copyMate.id) === copyMate : false,
    copyMateHasView: copyMate ? hasView(copyMate.id) : false,
    copyMateLinedUp: copyMate ? copyMate.x > copyLead.x : false,
    origTeamIntact: lead.team.length === 1 && mate.leader === lead,
  };

  // 2. File the lead → it and its teammate (and the copies) leave the floor.
  const nb = w.add(new Notebook());
  resolveDrop(w, lead, nb);
  resolveDrop(w, copyLead, nb);
  await settle();
  const filed = {
    floorRobots: robots().length, // expect 0
    leadGone: !w.get(lead.id) && !hasView(lead.id),
    mateGone: !w.get(mate.id) && !hasView(mate.id),
    pageIsTeam: nb.current() instanceof Robot && nb.current().team.length === 1,
  };

  // 3. Unfile the first page → the whole team comes back with views.
  const copy = nb.pages[0].copy();
  copy.moveTo({ x: floorCamera.x + 500, y: floorCamera.y + 500 });
  w.add(copy);
  expandTeam(w, copy);
  await settle();
  const back = copy.team[0];
  const unfiled = {
    floorRobots: robots().length, // expect 2 (lead + mate)
    mateBack: back ? w.get(back.id) === back && hasView(back.id) : false,
    mateLinked: back?.leader === copy,
    leadHasView: hasView(copy.id),
  };
  return { copied, filed, unfiled };
});
await browser.close();

const ok =
  out.copied.robotCount === 4 && out.copied.leadCount === 2 && out.copied.copyMateLinked &&
  out.copied.copyMateInWorld && out.copied.copyMateHasView && out.copied.copyMateLinedUp &&
  out.copied.origTeamIntact &&
  out.filed.floorRobots === 0 && out.filed.leadGone && out.filed.mateGone && out.filed.pageIsTeam &&
  out.unfiled.floorRobots === 2 && out.unfiled.mateBack && out.unfiled.mateLinked && out.unfiled.leadHasView;
console.log(JSON.stringify(out, null, 1));
console.log(`${ok ? 'PASS' : 'FAIL'} teams: wand-S copy · file gathers · unfile expands (views + world)`);
process.exit(ok ? 0 : 1);
