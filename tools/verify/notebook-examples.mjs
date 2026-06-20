// Guard: the main notebook carries the example-robot library (an "Examples"
// divider + solo robots + teams), each example works, and a library-less notebook
// SELF-HEALS (the library is detected by content and re-added on load).
//   node tools/verify/notebook-examples.mjs   (needs `npm run dev` on :3000)
import { chromium } from 'playwright';
const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } }); // fresh context = empty localStorage
const page = await ctx.newPage();
await page.goto('http://localhost:3000/', { waitUntil: 'load' });
await page.waitForFunction(() => window.__ttReady === true, { timeout: 30000 });
await page.waitForTimeout(700);

const fresh = await page.evaluate(async () => {
  const { Notebook } = await import('/src/model/notebook.ts');
  const { Robot, runRobot, expandTeam } = await import('/src/model/robot.ts');
  const { Box } = await import('/src/model/box.ts');
  const { NumberThing } = await import('/src/model/number.ts');
  const { TextThing } = await import('/src/model/text.ts');
  const w = window.__ttWorld;
  const nb = w.all().find((t) => t instanceof Notebook && t.isMain);
  const pages = nb.pages;
  const robots = pages.filter((p) => p instanceof Robot);
  const teams = robots.filter((r) => r.team.length > 0);
  const numBox = (...vs) => new Box({ holes: vs.map((v) => new NumberThing({ value: v })) });
  const textBox = (...vs) => new Box({ holes: vs.map((v) => new TextThing({ value: v })) });
  const run = (robot, box) => { const r = robot.copy(); runRobot(w, r, box); return box; };
  // pages: [0]=Pictures, [1]="Examples", then the 11 robots.
  const teamCopy = pages[12].copy(); w.add(teamCopy); expandTeam(w, teamCopy);
  return {
    pageCount: pages.length,
    page0: pages[0] instanceof TextThing ? pages[0].value : '?',
    page1: pages[1] instanceof TextThing ? pages[1].value : '?',
    robotCount: robots.length,
    names: robots.map((r) => r.name).join('|'),
    teamSizes: teams.map((t) => t.team.length).join(','),
    addRes: run(pages[2], numBox(3, 5)).contentsAt(0)?.value?.toString?.(),
    mulRes: run(pages[3], numBox(3, 5)).contentsAt(0)?.value?.toString?.(),
    joinRes: run(pages[6], textBox('snow', 'man')).contentsAt(0)?.value,
    teamNum: run(pages[10], numBox(10, 7)).contentsAt(0)?.value?.toString?.(),
    teamTxt: run(pages[10], textBox('a', 'b')).contentsAt(0)?.value,
    expanded: teamCopy.team.length === 2 && teamCopy.team.every((m) => w.get(m.id) === m && m.leader === teamCopy),
  };
});

// Self-heal: plant a library-LESS notebook (a pre-library save) and reload.
await page.evaluate(async () => {
  const { Notebook } = await import('/src/model/notebook.ts');
  const { Robot } = await import('/src/model/robot.ts');
  const { TextThing } = await import('/src/model/text.ts');
  const { thingToJson } = await import('/src/model/persistence.ts');
  const old = new Notebook({ isMain: true, name: 'claude 1' });
  old.store(new TextThing({ value: 'Pictures' }));
  old.store(new Robot({ condition: ['number'], actions: [{ type: 'copy', from: 0, to: 0 }] }));
  localStorage.setItem('toontalk-main-notebook-v1', thingToJson(old));
});
await page.reload({ waitUntil: 'load' });
await page.waitForFunction(() => window.__ttReady === true, { timeout: 30000 });
await page.waitForTimeout(600);
const healed = await page.evaluate(async () => {
  const { Notebook } = await import('/src/model/notebook.ts');
  const { TextThing } = await import('/src/model/text.ts');
  const nb = window.__ttWorld.all().find((t) => t instanceof Notebook && t.isMain);
  return {
    pages: nb.pages.length, // 2 user pages + Examples divider + 11 robots = 14
    hasHeader: nb.pages.some((p) => p instanceof TextThing && p.value === 'Examples'),
    persisted: (() => { try { return JSON.parse(localStorage.getItem('toontalk-main-notebook-v1')).pages.length; } catch { return -1; } })(),
  };
});

// Migrate: plant an OLD library (Examples divider + UNNAMED robots), reload, and
// the block is replaced in place with the current NAMED set — no duplicate divider.
await page.evaluate(async () => {
  const { Notebook } = await import('/src/model/notebook.ts');
  const { Robot } = await import('/src/model/robot.ts');
  const { TextThing } = await import('/src/model/text.ts');
  const { thingToJson } = await import('/src/model/persistence.ts');
  const old = new Notebook({ isMain: true, name: 'claude 1' });
  old.store(new TextThing({ value: 'Pictures' }));
  old.store(new TextThing({ value: 'Examples' }));
  for (let i = 0; i < 11; i++) old.store(new Robot({ condition: ['number'], actions: [{ type: 'remove', hole: 0 }] })); // unnamed
  localStorage.setItem('toontalk-main-notebook-v1', thingToJson(old));
});
await page.reload({ waitUntil: 'load' });
await page.waitForFunction(() => window.__ttReady === true, { timeout: 30000 });
await page.waitForTimeout(600);
const migrated = await page.evaluate(async () => {
  const { Notebook } = await import('/src/model/notebook.ts');
  const { Robot } = await import('/src/model/robot.ts');
  const { TextThing } = await import('/src/model/text.ts');
  const nb = window.__ttWorld.all().find((t) => t instanceof Notebook && t.isMain);
  return {
    pages: nb.pages.length, // Pictures + Examples + 11 named = 13 (no duplicate)
    dividers: nb.pages.filter((p) => p instanceof TextThing && p.value === 'Examples').length,
    firstName: nb.pages.filter((p) => p instanceof Robot)[0]?.name ?? '',
  };
});
await browser.close();

const ok =
  fresh.pageCount === 13 && fresh.page0 === 'Pictures' && fresh.page1 === 'Examples' &&
  fresh.robotCount === 11 && fresh.teamSizes === '1,1,2' &&
  fresh.names === 'Add|Multiply|Count up|Double|Join|Swap|Sort|Greet|Add or join|By size|All-rounder' &&
  fresh.addRes === '8' && fresh.mulRes === '15' && fresh.joinRes === 'snowman' &&
  fresh.teamNum === '17' && fresh.teamTxt === 'ab' && fresh.expanded &&
  healed.pages === 14 && healed.hasHeader && healed.persisted === 14 &&
  migrated.pages === 13 && migrated.dividers === 1 && migrated.firstName === 'Add';
console.log(JSON.stringify({ fresh, healed, migrated }, null, 1));
console.log(`${ok ? 'PASS' : 'FAIL'} notebook library: seeds fresh, self-heals, and migrates an old unnamed library to named`);
process.exit(ok ? 0 : 1);
