# ToonTalk Web — project memory

A from-scratch web reimplementation of **ToonTalk** (Ken Kahn's visual
programming environment for children, 1992–2007). TypeScript + PixiJS + Vite,
tested with Vitest. A clean rewrite, **not** a port of the original DirectX
C++.

## Guiding principle

**Stick with the original ToonTalk manual.** When our behavior diverges from
the manual, fix it to match rather than inventing. Hold enhancements/new
ideas until everything documented is working faithfully. Ground truth, in
order:

1. The per-element manual pages — player's guide at
   https://toontalk.com/English/doc.htm → `bird.htm`, `box.htm`,
   `newnum.htm`, `text.htm`, `robot.htm`, `scale.htm`, `truck.htm`,
   `bomb.htm`, `dusty.htm`, `wand.htm`, `pumpy.htm`, `notebook.htm`.
2. The **original C++ source** in `C:\Users\toont\dev\source\`
   (`number.cpp`, `cubby.cpp` = boxes, `bird.cpp`, `sprite.cpp`,
   `dragdrop.cpp` …) — **read it instead of guessing.**

## Project docs — read before touching the area, update after

- `docs/elements.md` — the per-element behavior digest (manual/C++ vs. our
  impl, ✅/⚠/▢) **with full detail**. This is the fidelity ledger; keep it
  honest. Detailed per-feature notes go HERE, not in this file.
- `docs/assets.md` — M25/M22 art, `.TTS` format, baking pipeline, render
  modes, frame-based animation, the reference video.
- `docs/room-city.md` — the room shell (floor/toolbox/notebook/hand poses),
  the outdoor city (fly/land/walk), selection wiggle.

Skills: `/new-element` (faithful scaffold checklist), `/fidelity-audit
<element>` (divergence report), `/verify-app` (screenshots & in-page checks).

## Working facts

- **This dir (`toontalk-web/`) is a git repo** (initialized 2026-06; commits
  authored as Ken Kahn / toontalk@gmail.com). The parent `C:\Users\toont\dev`
  is **not** a repo. Earlier work came via Claude Cowork, whose chat history
  does **not** carry into Claude Code; the project state on disk + the README
  changelog are the source of truth.
- **Run:** `npm run dev` (port 3000), `npm test` (vitest), `npm run
  typecheck` (strict `tsc --noEmit`), `npm run build`. Keep typecheck clean
  and tests green before committing.
- `.claude/launch.json` defines the `toontalk-web` dev server (port 3000).

## Architecture (respect this split)

- `src/model/` — **pure ToonTalk logic, NO rendering imports.** Everything is
  unit-testable and serializable. Base class `Thing`
  (id/kind/x/y/erased; `copy`/`equals`/`describe`/`snapshot`). `World` is the
  registry + change-event source. `resolveDrop` in `interactions.ts` is the
  universal "drop A on B" rule engine and returns a `DropResult` string used
  for the HUD.
- `src/view/` — PixiJS rendering. `SpriteView` is the default view and keys
  off `thing.kind` → `<kind>.png`. Bespoke views exist for
  number/text/box/nest/robot.
- Adding a new element → use the **/new-element** skill (touches `thing.ts`,
  `model/<x>.ts`, `interactions.ts`, `persistence.ts`, `main.ts` seed, a test
  file, README, `docs/elements.md`).
- **Tools** (wand, dusty, pumpy) are held, not dropped, and NOT consumed on
  use. The **bomb IS consumed** on detonation.

## Element status (full detail + remaining gaps: `docs/elements.md`)

| Element | State | Headline gaps |
|---|---|---|
| Pad editing | ✅ | decimal typing ✅ · caret/insertion-point ▢ · fraction typing ▢ |
| Numbers | ✅ | exact BigInt rationals; ops via keys while held |
| Text | ✅ | concat · number→blank pad ✅ · number→non-blank pad shifts edge char (next_in_alphabet) ✅ · edit ✅ · blank-pad wildcard ✅ |
| Boxes | ✅ | join (faithful `closest_hole` geometry) ✅ · blank box sizes from number/text/robot/notebook ✅ · (no split exists in C++) |
| Birds & nests | ✅ | FIFO (audited faithful), multi-nest, combine, hatch · accepts only pads/pics/boxes ✅ · flight anim/t-shirt/network ▢ · egg-on-reload ▢ |
| Robots | ✅ | train (drop a box on it) in a **full-screen thought bubble**: imagines on a copy, **you control the robot (no hand)**, hole→hole/take-out/put-in/wand-copy/Dusty erase+suck, Bammer on combine · **runs as a guarded loop**: iterates while matching, stops on mismatch (scale guard) or grab, **waits** on an incomplete box / empty nest and resumes when filled ✅ · **run re-enacts training** (walks to Tooly, fetches a fresh element, drops it, walks home) ✅ · **nest-transparent** match + actions ✅ · **recursive (nested-box) matching** ✅ · generalize: per-hole erase in bubble (partial) or Dusty-erase the robot (all guards) ✅ · match/teams/copy/module-recursion ✅ · Pumpy-resize-step ▢ · wand-S self-copy (next) / negation (declined) / re-open-to-edit (postponed) ▢ |
| Scale | ✅ | `<` `>` `=` guards work |
| Dusty | ✅ | S/R/E modes; defaults to **suck** (faithful, audited) |
| Wand | ✅ | C/O/S modes |
| Pumpy | ✅ | in-hole sizing ▢ |
| Bomb | ✅ | only works on a house (recycles the process), consumed · refused on loose objects (faithful, bomb.cpp) · picture-back ▢ |
| Truck / House | ✅ | module ✅ · extras (picture, address) ▢ |
| Notebook | ✅ | main = real save model ✅ · open two-page **cards + name** (matches original) ✅ · modules + `fromModule` ✅ · sub-notebooks ▢ · page-as-snapshot ▢ |
| Sensors | ✅ | media sensors ▢ · joystick ▢ |
| City (fly/land/walk) | ✅ | **faithful port**: camera/coords (screen.cpp), flying, landing, takeoff, walking (walls+door), perspective room shows floor in miniature, **large scrollable floor — sit re-centres it, toolbox follows** (set_sit_corner) ✅ · per-house contents ▢ · audio ▢ |
| Room shell | ✅ | toolbox (3-D lego) + spiral notebook ✅ · holdwand anchors ⚠ |
| Animations | ✅ | explode ✅ · dusty-suck ✅ · bam-mouse 22-frame swing ✅ · directional bird flight ✅ · nest hatch (egg cracks → bird flies up) ✅ |

## Verification

- `npm run typecheck` + `npm test` green before every commit.
- **Visual checks: use the `verify-app` skill** (`node tools/verify/snap.mjs
  …`), NOT the preview screenshot tool. The preview tab is backgrounded, so
  rAF/the PIXI ticker is paused there (city/sensors/houses never advance) and
  animated scenes make screenshots time out. The harness pumps
  `__ttApp.ticker.update()` manually in headless Chromium — deterministic
  captures, frame series, and `--eval` checks against the debug globals.
- Debug globals: `__ttApp` (PIXI app), `__ttWorld`, `__ttCity`, `__ttDrag`,
  `__ttRoom`, `__ttInput`. `__ttLog()` returns the debug-log text.
- **Debug log** (`debug-log.ts`): the toolbar **Log** button toggles a copyable
  panel tracing interactions (grab / drop+result / toolbox pick / train gesture /
  scene / thoughts). Tell testers to open it, reproduce, and click it to copy —
  the trace shows e.g. `drop: num(3) → num(5) : combined` or `: none`.
- **Real-click harness gotcha**: standalone Playwright tests must press Backquote
  to switch from the boot **city** scene to the **room** before clicking the
  floor/toolbox (the city hides the room `chrome`, so clicks fall through). The
  city sit→floor needs Pointer Lock (headless can't), so jump scenes instead.
- Houses run on a real `setInterval(800ms)`; give them real time
  (`--settle 3000`) or verify via tests.

## Status

Phases 0–3 done. Phase 4 done (Dusty ✅, bomb ✅, trucks/houses ✅, city ✅,
sensors ✅, main-notebook save + modules ✅). Next: entering a house from the
city; media (pictures/sounds + media sensors); bird flight + nest hatch
animations. Keep the README's top changelog updated per feature; record
fidelity changes in `docs/elements.md`, not here — this file stays short.
