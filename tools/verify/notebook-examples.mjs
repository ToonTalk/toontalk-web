// Guard: the main notebook is seeded with the example-robot library (solo + teams)
// and each example actually works. A fresh Playwright context has empty
// localStorage, so the notebook seeds fresh.
//   node tools/verify/notebook-examples.mjs   (needs `npm run dev` on :3000)
import { chromium } from 'playwright';
const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
await ctx.clearCookies();
const page = await ctx.newPage();
await page.addInitScript(() => { try { localStorage.clear(); } catch {} });
await page.goto('http://localhost:3000/', { waitUntil: 'load' });
await page.waitForFunction(() => window.__ttReady === true, { timeout: 30000 });
await page.waitForTimeout(800);

const out = await page.evaluate(async () => {
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

  // pages: [0]=Pictures, then the 11 example robots in known order.
  const adder = pages[1], multiplier = pages[2], joiner = pages[5], addOrJoin = pages[9], allRounder = pages[11];
  const addRes = run(adder, numBox(3, 5)).contentsAt(0)?.value?.toString?.();
  const mulRes = run(multiplier, numBox(3, 5)).contentsAt(0)?.value?.toString?.();
  const joinRes = run(joiner, textBox('snow', 'man')).contentsAt(0)?.value;
  // the team adds a number pair AND (via its teammate) joins a text pair:
  const teamNum = run(addOrJoin, numBox(10, 7)).contentsAt(0)?.value?.toString?.();
  const teamTxt = run(addOrJoin, textBox('a', 'b')).contentsAt(0)?.value;

  // a filed team expands into separate linked floor robots
  const teamCopy = allRounder.copy();
  w.add(teamCopy);
  expandTeam(w, teamCopy);
  const expanded = teamCopy.team.every((m) => w.get(m.id) === m && m.leader === teamCopy);

  return {
    pageCount: pages.length,
    page0: pages[0] instanceof TextThing ? pages[0].value : pages[0]?.kind,
    robotCount: robots.length,
    teamCount: teams.length,
    teamSizes: teams.map((t) => t.team.length),
    addRes, mulRes, joinRes, teamNum, teamTxt,
    expandedMembers: teamCopy.team.length,
    expanded,
  };
});
await browser.close();

const ok =
  out.pageCount === 12 && out.page0 === 'Pictures' && out.robotCount === 11 &&
  out.teamCount === 3 && out.teamSizes.join(',') === '1,1,2' &&
  out.addRes === '8' && out.mulRes === '15' && out.joinRes === 'snowman' &&
  out.teamNum === '17' && out.teamTxt === 'ab' &&
  out.expandedMembers === 2 && out.expanded;
console.log(JSON.stringify(out, null, 1));
console.log(`${ok ? 'PASS' : 'FAIL'} notebook seeded with a working example-robot library (solo + teams)`);
process.exit(ok ? 0 : 1);
