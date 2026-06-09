---
name: verify-app
description: Take reliable screenshots of, and run in-page checks against, the running toontalk-web app. Use this INSTEAD of the preview screenshot tool whenever a screenshot times out, the scene animates (city, trucks/houses, explosions, bird flight), or sensor/ticker state must be observed — the preview tab is backgrounded so rAF/the PIXI ticker is paused there; this harness pumps the ticker manually in headless Chromium, so any frame captures deterministically.
---

# Verify the app visually (and programmatically)

## Preconditions

- Dev server running: `npm run dev` (port 3000).
- One-time: `npm i -D playwright && npx playwright install chromium`.

## Taking screenshots

```bash
# still of the room (the app boots into the city; --scene flips with Backquote)
node tools/verify/snap.mjs --scene room --name room

# the city after 30 deterministic 50ms frames
node tools/verify/snap.mjs --scene city --frames 30 --name city-flying

# a 6-shot series through an animation (4 ticks of 100ms between shots) —
# use this to verify explosion / dusty-suck / bird-flight cycles frame by frame
node tools/verify/snap.mjs --scene room --series 6 --frames 4 --dt 100 --name boom

# drive the keyboard first (Playwright key names), e.g. descend & land in the city
node tools/verify/snap.mjs --scene city --keys "ArrowDown,ArrowDown,ArrowDown" --name landing
```

Shots land in `tools/verify/shots/` — Read the PNG to inspect it. The command
prints JSON: check `errors` for page console/uncaught errors every time.

## Running in-page checks (no screenshot needed)

Write a snippet file whose body `return`s a serializable value, then:

```bash
node tools/verify/snap.mjs --scene room --eval tools/verify/checks/world-summary.js
```

The snippet runs inside the page after the ticker pump; `__ttApp`, `__ttWorld`,
`__ttCity`, `__ttInput` are available. BigInts (number pads are exact BigInt
rationals) are serialized as strings like `"12n"`.

## Notes

- The pump (`--frames`/`--dt`) drives everything on the PIXI ticker, including
  `updateSensors` and frame animations. House running uses a real
  `setInterval(800ms)`, so to see houses react, add real time: `--settle 3000`.
- `--keep-ticker` runs real-time instead (non-deterministic; rarely needed).
- `--mode modern` / `--mode faithful` selects the render mode.
- If `ok: false` says the URL didn't load, start `npm run dev` first.
- Prefer this harness over the preview tool for ANY screenshot in this repo;
  the preview tool is only fine for quick static checks early in a session.
