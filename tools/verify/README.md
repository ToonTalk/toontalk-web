# tools/verify — deterministic visual verification

The Claude Code preview tool screenshots a **backgrounded** tab, where
`requestAnimationFrame` (and the PIXI ticker) is paused — animated scenes
(city, trucks/houses, sensors, explosions) never advance and the screenshot
times out. `snap.mjs` replaces it: headless Chromium + a manually pumped
ticker (`__ttApp.ticker.update(t)`), so any frame is capturable, repeatably.

## Setup (once)

```bash
npm i -D playwright
npx playwright install chromium
```

Optional npm script in `package.json`:

```json
"snap": "node tools/verify/snap.mjs"
```

## Use

```bash
npm run dev                                      # in another terminal
node tools/verify/snap.mjs --scene room --name room
node tools/verify/snap.mjs --scene city --frames 30 --name city
node tools/verify/snap.mjs --scene room --series 6 --frames 4 --dt 100 --name boom
node tools/verify/snap.mjs --eval tools/verify/checks/world-summary.js
```

Full option list is documented at the top of `snap.mjs`. Output is one JSON
object on stdout (`shots`, `eval`, and any page `errors`). Screenshots land in
`tools/verify/shots/` — consider adding that folder to `.gitignore`.
