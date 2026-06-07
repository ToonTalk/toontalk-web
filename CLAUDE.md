# ToonTalk Web — project memory

A from-scratch web reimplementation of **ToonTalk** (Ken Kahn's visual
programming environment for children, 1992–2007). TypeScript + PixiJS + Vite,
tested with Vitest. This is a clean rewrite, **not** a port of the original
DirectX C++.

## Working facts

- **This dir (`toontalk-web/`) is a git repo** (initialized 2026-06; commits
  authored as Ken Kahn / toontalk@gmail.com). The parent `C:\Users\toont\dev`
  is **not** a repo. There was no git before — earlier work came via Claude
  Cowork, whose chat history does **not** carry into Claude Code; the project
  state on disk + the README changelog are the source of truth.
- **Run:** `npm run dev` (port 3000), `npm test` (vitest), `npm run typecheck`
  (strict `tsc --noEmit`), `npm run build`. Keep typecheck clean and tests green
  before committing.
- **Preview/verify:** `.claude/launch.json` defines the `toontalk-web` dev
  server for the preview tool (screenshots on port 3000).

## Architecture (respect this split)

- `src/model/` — **pure ToonTalk logic, NO rendering imports.** Everything is
  unit-testable and serializable. Base class `Thing` (id/kind/x/y/erased;
  `copy`/`equals`/`describe`/`snapshot`). `World` is the registry + change-event
  source. `resolveDrop` in `interactions.ts` is the universal "drop A on B" rule
  engine and returns a `DropResult` string used for the HUD.
- `src/view/` — PixiJS rendering. `SpriteView` is the default view and keys off
  `thing.kind` → `<kind>.png`. Bespoke views exist for number/text/box/nest/robot.
- Adding a new element typically touches: `thing.ts` (`ThingKind`), a new
  `model/<x>.ts`, `interactions.ts` (drop behavior), `persistence.ts`
  (`buildByKind` case), `main.ts` (seed in demo), a test file, and README.
- **Tools** (wand, dusty) are `Thing`s that are NOT consumed on drop. The
  **bomb IS consumed** on detonation.

## Assets

- Original art lives in sibling folders **`M25/`** (~735 `.BMP` + 44 `.TTS`
  sprite-definition files; the primary source) and **`M22/`** (a **low-res**
  version of M25 — but it contains **a few images that are MISSING from M25**, so
  check M22 when an M25 bitmap is absent). Neither folder is in the git repo.
- Converted PNGs live in `public/assets/sprites/`. Black is the transparency key
  (see `ASSET_GUIDE.md` for the `.TTS` format, offsets, and per-asset exceptions
  like the green/magenta-keyed number/text plates).
- Known M25 gaps already substituted: wand (`USEWAND1`), dusty (`SUCK0`),
  thought bubble (`BUBBL10`). Tooling: `tools/parse-tts.py` → `tools/tts-manifest.json`.

## Reference: the original manual

Player's guide at https://toontalk.com/English/doc.htm. Per-element pages:
`bird.htm`, `box.htm`, `newnum.htm`, `text.htm`, `robot.htm`, `scale.htm`,
`truck.htm`, `bomb.htm`, `dusty.htm`, `wand.htm`, `pumpy.htm`, `notebook.htm`.
(The first 7 menu items — puzzle game, demos, free play, options, help, WebLabs,
Playground — are app-launcher options, not element behavior.)

### Authentic-behavior notes (vs. current simplified impl)

- **Bomb:** in real ToonTalk a bomb blows up the **house/room you're in** — it
  terminates a whole running process (a robot team working in a house); its
  stated purpose is *recycling* (deallocating finished houses). It is consumed.
  Our current impl simplifies this to "destroy the target thing/box" because we
  have no houses yet. When trucks/houses land, revisit so the bomb terminates a
  running process, not just any object on the table.
- **Truck (next feature):** drop a **robot (or team of robots) + a box** into a
  truck → it drives to an empty lot, builds a **house**, and the robot runs on
  that box there (a spawned process). Optional extras: a house picture, an
  address, and a notebook that acts as a **module** robots consult first. The
  truck is **not** consumed.

## Status

Phases 0–3 done. Phase 4 tools: **Dusty (erase/wildcard) ✅**, **bomb ✅**.
Next up: **trucks** (spawn running processes / houses), then polish (bird flight,
robot-run animation). Keep the README's top changelog updated per feature.
