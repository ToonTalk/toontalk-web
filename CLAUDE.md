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

## Element behavior digest (from the manual) — incl. divergences to fix

Read 2026-06 from the per-element pages above. ✅ = matches our impl, ⚠ =
divergence/simplification in our current code, ▢ = not yet implemented.

- **Numbers** (`newnum.htm`): ⚠ **op is chosen by a keypress *before* the drop,
  default is `+`** — not baked into the number. We currently store an
  `operation` on the NumberThing and apply that; authentic behavior is
  transient per-drop. Also ▢ missing ops: `%` remainder, `^` power, `=` replace,
  `-` negation, and number-on-blank-text → text conversion. ✅ exact BigInt
  rationals (division → exact fractions) is correct.
- **Text** (`text.htm`): ✅ drop side decides order (left=prepend, right=append).
  ▢ a **blank pad acts as a wildcard** in robot conditions (like erased); ▢
  dropping a number on a blank pad converts it to text; ▢ editing.
- **Boxes** (`box.htm`): ✅ holes fill / combine-in-place. ▢ **join** (drop box on
  another box's edge → merged box), ▢ **split** (drop box on a number N → splits
  into N and remainder), ▢ text on an (erased/empty) box explodes into one hole
  per character, ▢ set hole count by typing a digit. Robots ignore hole labels —
  only hole count + contents matter (we have no labels, fine).
- **Birds & nests** (`bird.htm`): ⚠ a bird **stacks** deliveries on the nest (we
  show latest + count). ▢ copying a *nest* makes the bird copy itself to deliver
  to both nests; ▢ combining nests (drop nest on nest); ▢ eggs hatch into birds;
  ▢ a nest saved without its bird reloads as a fresh egg → new bird. Birds/nests
  are ToonTalk's inter-process channel (a robot waits for a bird to fill a nest).
- **Robots** (`robot.htm`): ✅ train by example; condition = box shape; erasing
  generalizes; thought bubble shows the condition. ⚠ **finish key**: the manual
  says **Escape finishes** training — we use **Enter to finish, Esc to cancel**.
  Confirm desired web UX before changing. ▢ **teams**: drop robot on robot →
  tried front-to-back, first match runs, others step aside, no match passes
  along; if nothing matches it waits. ▢ negation via a team + marker. ▢ recursion
  via the wand's 'S' mode copying the robot+team.
- **Scale** (`scale.htm`): ▢ not implemented. Balance tilts toward the bigger
  number / later-alphabetical text; robots read the tilt as a condition (the
  real path to `<`, `>`, `=` conditionals). Good candidate feature.
- **Dusty / vacuum** (`dusty.htm`): ⚠ real Dusty has **three modes via the nose
  button — Suck (remove, stored in its stomach), Reverse (spit back out), Erase**.
  We model only Erase, as a *toggle*; authentic erase is a mode and restore is
  via Dusty-reverse or the wand's 'O' mode, not a toggle. Note **Suck (remove,
  restorable) is distinct from the Bomb (destroy, permanent)**.
- **Wand** (`wand.htm`): ✅ copies via the **tip**, not consumed. ⚠ we only do
  mode 'C'. ▢ mode 'O' = copy and restore an erased original; ▢ mode 'S' = copy
  self / copy a robot+team (the only way to make another wand; enables recursion).
- **Notebook** (`notebook.htm`): ▢ not implemented. Pages indexed by number;
  number→page, text→matching page. The **main notebook persists across
  sessions** (this is the real save/load model); secondary notebooks are
  transient unless dropped on a main-notebook page. Used as a **module** when
  given to a truck. Dropping a notebook on an erased box → a box with one hole
  holding every page.
- **Pumpy** (`pumpy.htm`): ▢ not implemented (art staged as `pumpy.png`). A
  resize tool — modes big/wide/narrow/little/short/tall/good-size. Cosmetic;
  not consumed.

## Status

Phases 0–3 done. Phase 4 tools: **Dusty (erase/wildcard) ✅**, **bomb ✅**.
Next up: **trucks** (spawn running processes / houses), then polish (bird flight,
robot-run animation). Keep the README's top changelog updated per feature.
