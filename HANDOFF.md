# HANDOFF — start here for a new session

This file orients a fresh Claude Code session (e.g. on another machine). The
conversation history does **not** transfer between sessions; the repo + this note
do. Read `CLAUDE.md` first (project rules), then this.

## What the project is
A faithful TypeScript + PixiJS + Vite reimplementation of Ken Kahn's **ToonTalk**.
Pure model in `src/model/` (no rendering imports, unit-tested), PixiJS in
`src/view/`. Ground truth, in order: the per-element manual pages (toontalk.com)
and the **original C++** in `C:\Users\toont\dev\source\` — *read it, don't guess*.

## Run / verify
- `npm install` (first time on a new machine), `npm run dev` (port 3000),
  `npm run typecheck` (strict), `npm test` (vitest — keep all green before commit),
  `npm run build`.
- **Visual checks use the harness, NOT the preview screenshot tool**:
  `node tools/verify/snap.mjs …` (headless Chromium that pumps
  `__ttApp.ticker.update()`; the preview tab backgrounds rAF so the ticker/city
  never advance). For the harness: `npx playwright install chromium` once.
- **Debug globals** on `window`: `__ttApp`, `__ttWorld`, `__ttCity`, `__ttDrag`,
  `__ttRoom`, `__ttInput`, `__ttLog()`.
- **`__ttDev`** — headless debug-driver added this session (drives the *real*
  logic, no pixel hit-testing): `scene('floor'|'city'|'street')`,
  `spawn(kind,x,y)→id`, `drop(a,b,hole)→result`, `run(robot,box)`, `move/remove`,
  `state()`, and `adder()`/`holeValue()` (an add-1 robot + counter box for testing
  the robot loop). To reach the standing room view headlessly: set
  `__ttCity.model.mode='inside'` then `__ttDev.scene('city')`.

## Current state (build 2026-06-20t, branch master, clean tree)
Phases 0–4 done: all 8 toolbox elements, city (fly/land/walk/room), robot
training+teams+houses, sensors, save/load. This session's commits (newest first):
- **Standing room view: floor things at floor scale** (not a tiny mini-map) —
  `STAND_ITEM_SCALE` in `city-scene.ts renderInterior`; matched to the original.
- **Robots keep working across views** — off the working floor the run applies
  instantly (no enactment), ~200 ms standing / ~30 ms away; the standing floor-mini
  refreshes so the box ticks. (`animateRun` in `main.ts`.)
- **Edge-scroll** — pointer at a screen edge pans the floor to the wall
  (`main.ts`) and the city to the water (`CityScene.edgePush`). Replaces the
  Pointer Lock pan, which was **removed** (it trapped the cursor in a Hi-DPI corner).
- **Held tools** — Pumpy/Dusty clay at ~Lego size, gripped by the body (no mode
  plate / stomach count while held); toolbox icons fit at natural aspect; tray
  numbers show a clean plate (no `+` op badge).

## In flight / immediate next
- **Robots-persist live validation (optional):** confirm our `animateRun`
  enactment against the original's robot-working animation. Blocked only on getting
  a robot *running* in the original to capture (see reference notes below). The
  headless behavior is verified (counter +1/1.5 s on floor vs +83/3 s away).
- The standing-view scale (`2.3×`) is easy to nudge if it reads big/small live.

## Roadmap (grounded in the C++ — `docs/elements.md` has the ▢ gaps)
1. **Media (the big gap):** `sound.h` = a Text-pad that plays audio (small; unblocks
   sound sensors). Then **pictures** (`picture.h` is the sprite base — motion via
   `x_speed`/`y_speed`, **flip-to-back** = robots on a picture's back drive it = the
   game-making core). Unblocks bird t-shirts, media sensors, bomb-on-picture-back.
2. **Enter city houses → per-house contents** (`city.cpp`/`house.cpp`): walking into
   a house opens *that* house's world.
3. **Notebook page-as-snapshot** — pages as thumbnails of saved scenes (the original
   shows a picture thumbnail on the page; ours are single things).
4. Smaller: pad caret/fraction typing; robot Pumpy-resize step + re-open-to-edit.
Out of scope: network/DirectPlay birds, joystick/force-feedback, Java export.

## Gotchas / cross-session facts (these are not obvious from the code)
- **Kill stray dev servers with PowerShell, not `pkill`** (Git Bash `pkill -f vite`
  does NOT kill the Windows node processes; they pile up holding ports):
  `Get-CimInstance Win32_Process -Filter "Name='node.exe'" | ? { $_.CommandLine -match 'vite' } | % { Stop-Process -Id $_.ProcessId -Force }`.
  Prefer reusing one dev server; kill it at session end.
- **The floor cheatsheet HUD is dev-only** — it must be OFF by default in the
  shipping build (gate behind a help key). A `NOTE(release)` sits at the `setHud(...)`
  call in `main.ts`.
- **Commits** are authored as Ken Kahn / toontalk@gmail.com, trailer
  `Co-Authored-By: Claude <claude-opus-4-8> <noreply@anthropic.com>`.

## Reference: the original ToonTalk (for fidelity work)
- **Installed**: `C:\Program Files (x86)\Animated Programs\ToonTalk\StartTT.exe`.
- **Driving it via computer-use** (verified): launch it, click **Free Play** (the
  launcher minimizes; the desktop shows), then bring the *game window* forward with
  `open_application("Tt3191")` — the world runs in a normal **window**
  ("ToonTalk - claude 1") that screenshots fine. Use `tt3191.exe`, NOT the launcher.
  Also grant `agentsvr.exe` (the parrot helper steals focus). Live capture obviously
  needs ToonTalk installed on the machine.
- **Recordings** of the original are in `C:\Users\toont\dev\` (`sitting and
  standing.mp4`, two `claude 1 …mp4`). **Extract frames** with ffmpeg (PNG disabled
  — output `.jpg`): `& "C:\Program Files\CEWE Creator\CEWE Creator\ffmpeg.exe" -y -ss <s> -i "<mp4>" -frames:v 1 -q:v 3 out.jpg`.

## What lives OUTSIDE this repo (copy separately if needed)
- `C:\Users\toont\dev\source\` — the original C++ (ground truth). ~98 MB.
- `C:\Users\toont\dev\M22` + `M25` — original art, only needed to **re-bake** assets
  (`tools/*.py`); the baked assets are already in `public/assets`.
- `dev\*.mp4` — reference recordings (optional).
- My **memory files** (`~/.claude/projects/<launch-dir>/memory/`) — the key facts are
  folded into this note, so copying them is optional.
