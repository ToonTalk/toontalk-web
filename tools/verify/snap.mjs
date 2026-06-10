#!/usr/bin/env node
/**
 * snap.mjs — deterministic screenshots + in-page checks for toontalk-web.
 *
 * WHY THIS EXISTS
 * The Claude Code preview tool screenshots a *backgrounded* tab, where
 * requestAnimationFrame (and therefore the PIXI ticker) is paused — so the
 * city scene, sensors, trucks/houses etc. never advance, and animated scenes
 * make the screenshot time out (30s). This harness drives real headless
 * Chromium instead: the page counts as visible, and on top of that it STOPS
 * the PIXI ticker and pumps it by hand (`__ttApp.ticker.update(t)`), so any
 * frame of any animation can be captured deterministically and repeatably.
 *
 * PREREQS (one-time):
 *   npm i -D playwright
 *   npx playwright install chromium
 * The dev server must be running:  npm run dev   (port 3000)
 *
 * USAGE
 *   node tools/verify/snap.mjs [options]
 *
 * OPTIONS
 *   --url <u>        app URL                       (default http://localhost:3000)
 *   --mode <m>       sets ?mode=faithful|modern on the URL
 *   --scene <s>      room | city — presses Backquote if the boot scene differs
 *   --keys <list>    comma-separated keys pressed after scene selection, using
 *                    Playwright key names (e.g. "Backquote,ArrowUp,Space,h")
 *   --settle <ms>    real-time wait after load for textures/seed (default 1200)
 *   --frames <n>     manual ticker steps before each shot        (default 12)
 *   --dt <ms>        simulated milliseconds per step             (default 50)
 *   --series <n>     take n screenshots, stepping --frames between each
 *                    (default 1) — great for checking an animation's frames
 *   --name <s>       output file basename                        (default snap)
 *   --out <dir>      output directory          (default tools/verify/shots)
 *   --pre <file>     JS file whose body runs inside the page BEFORE stepping —
 *                    set up state the pumped frames act on (e.g. hold a key:
 *                    window.__ttCity.keys.add('ArrowDown') to descend/land)
 *   --eval <file>    JS file whose body runs inside the page (in an async
 *                    function) AFTER stepping; its `return` value is printed
 *                    as JSON. BigInts are serialized as strings like "12n".
 *   --keep-ticker    do NOT stop the ticker (real-time, non-deterministic)
 *   --width <px>     viewport width                              (default 1280)
 *   --height <px>    viewport height                             (default 800)
 *
 * OUTPUT
 *   A single JSON object on stdout:
 *     { ok, url, shots: ["...png"], eval: <result|null>, errors: [...] }
 *   `errors` collects page console.error and uncaught page errors — check it!
 *
 * EXAMPLES
 *   # still of the room (boot scene is the city, so this flips with `)
 *   node tools/verify/snap.mjs --scene room --name room
 *
 *   # the city, advanced 30 deterministic frames of 50ms
 *   node tools/verify/snap.mjs --scene city --frames 30 --name city-flying
 *
 *   # 6-shot series to inspect an animation cycle (e.g. an explosion)
 *   node tools/verify/snap.mjs --scene room --series 6 --frames 4 --dt 100 --name boom
 *
 *   # no screenshot needed? run a check and read the JSON
 *   node tools/verify/snap.mjs --scene room --eval tools/verify/checks/world-summary.js
 */

import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

// ---------------------------------------------------------------- arg parsing
const FLAGS = new Set(['keep-ticker']);
const args = {};
{
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    if (FLAGS.has(key)) args[key] = true;
    else args[key] = argv[++i];
  }
}

const url = new URL(args.url ?? 'http://localhost:3000');
if (args.mode) url.searchParams.set('mode', args.mode);
const settle = Number(args.settle ?? 1200);
const frames = Number(args.frames ?? 12);
const dt = Number(args.dt ?? 50);
const series = Number(args.series ?? 1);
const name = args.name ?? 'snap';
const outDir = args.out ?? path.join('tools', 'verify', 'shots');
const width = Number(args.width ?? 1280);
const height = Number(args.height ?? 800);
const keepTicker = !!args['keep-ticker'];

function fail(msg, e) {
  console.log(JSON.stringify(
    { ok: false, error: msg, detail: String(e?.message ?? e ?? '') }, null, 2));
  process.exit(2);
}

// --------------------------------------------------------------------- main
const browser = await chromium.launch({
  args: [
    '--enable-unsafe-swiftshader',          // software WebGL fallback if no GPU
    '--disable-renderer-backgrounding',     // belt-and-braces: never throttle
    '--disable-background-timer-throttling' // keep setInterval (houses) honest
  ]
}).catch(e => fail('Could not launch Chromium — run `npx playwright install chromium`?', e));

const page = await browser.newPage({ viewport: { width, height } });
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push('[console] ' + m.text()); });
page.on('pageerror', e => errors.push('[pageerror] ' + e.message));

try {
  await page.goto(url.href, { waitUntil: 'load', timeout: 15000 });
} catch (e) {
  fail(`Could not load ${url.href} — is \`npm run dev\` running on that port?`, e);
}

// Wait for FULL boot: main.ts sets __ttReady as the last line of start().
// (__ttApp appears early, before assets/seed/city — don't trust it alone.)
await page.waitForFunction(() => window.__ttReady === true, null, { timeout: 30000 })
  .catch(e => fail('window.__ttReady never appeared — app failed to finish booting? See `errors`.', e));

// real-time settle so textures/seed/world finish loading
await page.waitForTimeout(settle);

// ----------------------------------------------------------- scene selection
// The app boots into the city; Backquote (`) flips city <-> room (dev seam).
if (args.scene === 'room' || args.scene === 'city') {
  const inCity = await page.evaluate(() => {
    const c = window.__ttCity;
    // CityScene.isActive is the real API (city-scene.ts); container.visible as fallback
    return c?.isActive ?? c?.container?.visible ?? true;
  });
  const wantCity = args.scene === 'city';
  if (wantCity !== inCity) {
    await page.keyboard.press('Backquote');
    await page.waitForTimeout(150);
  }
}

// ------------------------------------------------------------ scripted keys
if (args.keys) {
  for (const k of args.keys.split(',').map(s => s.trim()).filter(Boolean)) {
    await page.keyboard.press(k);
    await page.waitForTimeout(60);
  }
}

// --------------------------------------------------------------- pre snippet
// --pre <file>: JS run inside the page BEFORE the ticker pump — use it to set
// up state the pumped frames then act on (e.g. hold a key for the city:
// `window.__ttCity.keys.add('ArrowDown')` descends across the pumped frames).
if (args.pre) {
  const src = fs.readFileSync(args.pre, 'utf8');
  try {
    await page.evaluate(async (s) => { await (0, eval)('(async () => {\n' + s + '\n})')(); }, src);
  } catch (e) {
    errors.push('[pre] ' + (e?.message ?? String(e)));
  }
}

// ------------------------------------------------- deterministic ticker pump
async function pump(n) {
  await page.evaluate(([n, dt]) => {
    const app = window.__ttApp;
    app.ticker.stop();                          // freeze real-time rendering
    let t = (window.__ttSnapClock ??= performance.now());
    for (let i = 0; i < n; i++) { t += dt; app.ticker.update(t); }
    window.__ttSnapClock = t;                   // monotonic across pumps
  }, [n, dt]);
}

// ----------------------------------------------------------------- shooting
fs.mkdirSync(outDir, { recursive: true });
const shots = [];
for (let s = 0; s < series; s++) {
  if (keepTicker) await page.waitForTimeout(frames * dt);
  else await pump(frames);
  const file = path.join(
    outDir,
    series > 1 ? `${name}-${String(s + 1).padStart(2, '0')}.png` : `${name}.png`
  );
  await page.screenshot({ path: file });
  shots.push(file);
}

// -------------------------------------------------------------------- eval
let evalResult = null;
if (args.eval) {
  const src = fs.readFileSync(args.eval, 'utf8');
  try {
    const json = await page.evaluate(async (src) => {
      const fn = (0, eval)('(async () => {\n' + src + '\n})');
      const out = await fn();
      return JSON.stringify(out === undefined ? null : out,
        (k, v) => (typeof v === 'bigint' ? v.toString() + 'n' : v));
    }, src);
    evalResult = JSON.parse(json);
  } catch (e) {
    errors.push('[eval] ' + (e?.message ?? String(e)));
  }
}

console.log(JSON.stringify({ ok: true, url: url.href, shots, eval: evalResult, errors }, null, 2));
await browser.close();
