# ToonTalk Web — project memory

A from-scratch web reimplementation of **ToonTalk** (Ken Kahn's visual
programming environment for children, 1992–2007). TypeScript + PixiJS + Vite,
tested with Vitest. This is a clean rewrite, **not** a port of the original
DirectX C++.

## Guiding principle

**Stick with the original ToonTalk manual.** When our behavior diverges from the
manual (see the digest below), fix it to match the manual rather than inventing.
Hold enhancements/new ideas until everything documented is working faithfully.
When in doubt, consult the per-element manual pages (URLs below).

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

- Original art lives in sibling folders **`C:\Users\toont\dev\M25\`** (735 `.BMP`
  + 44 `.TTS` sprite-definition files; the primary source — **present**) and
  **`M22/`** (a **low-res** version of M25 — but it contains **a few images that
  are MISSING from M25**, so check M22 when an M25 bitmap is absent). Neither
  folder is in the git repo.
- **`C:\Users\toont\dev\source\`** — the **original ToonTalk C++ source**
  (present): per-element files (`number.cpp`, `text.cpp`, `pad.cpp`, `cubby.cpp`
  = boxes, `bird.cpp`, `robot.cpp`, `bomb.cpp`, `truck.cpp`, `thought.cpp`),
  `sprite.cpp`/`animate.cpp` (animation + the selection **wiggle** — selection
  feedback IS a wiggle), `dragdrop.cpp`/`mouse.cpp`/`input.cpp` (interaction),
  plus 19 `.tt` world files (the original save format → importable later) and
  `.pzl` puzzles. **This is ground truth for exact behavior** — read it instead
  of guessing. `ASSET_GUIDE.md` was derived from `sprite.cpp`.
- Converted PNGs live in `public/assets/sprites/`. Black is the transparency key
  (see `ASSET_GUIDE.md` for the `.TTS` format, offsets, and per-asset exceptions
  like the green/magenta-keyed number/text plates).
- Known M25 gaps already substituted: wand (`USEWAND1`), dusty (`SUCK0`),
  thought bubble (`BUBBL10`). Tooling: `tools/parse-tts.py` → `tools/tts-manifest.json`.
- **Render modes** (`config/render-mode.ts`, view-only): `?mode=faithful`
  (default) = square corners, chunky borders, nearest-neighbor pixels, playful
  font, no shadows; `?mode=modern` = rounded corners, soft drop shadows, drag
  glow, smoothed textures, clean sans. Driven by theme fields (`cornerRadius`,
  `borderWidth`, `fontFamily`, `dropShadow`, `scaleMode`, `dragHighlight`).
  ✅ **Authentic plates done:** numbers use `numplat.png` (NUMBPLAT, green lego
  plate) and text uses `textplat.png` (TEXTPLT1, pink) — nine-slice via
  `view/plate.ts` (`drawPlate`). Chroma keys (green/magenta) are NOT keyed out.
  ✅ **Boxes** (box-view.ts) follow cubby.cpp: tiled lego pieces — `cubby1.png`
  (CUBBY1, first hole = wall·hole·wall) + `cubbyr.png` (CUBBYR, each further hole
  = hole·wall) abutted, **no outer frame**; empty holes show the recessed hole,
  contents drawn on top. (`cubbyb.png` = CUBBYB blank, for erased boxes — not yet
  used.) ✅ **Scale** uses distinct tilt bitmaps (scale-view.ts), **centred, never
  rotated**: `scale-level` (SCALE01), `scale-left` (SCALE04, left pan down =
  left heavier), `scale-right` (SCALE02, right pan down). tottering → level,
  faded.

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
  have no houses yet. ✅ a bomb now **terminates a house** (the running process):
  `world.remove(target)` already covers it. ▢ still simplified for loose objects.
- **Truck / House ✅** (`truck.cpp` fill_house/initial_contents; `truck.ts`,
  `house.ts`): drop a **robot (team) + a box** into a `Truck` (the truck is the
  target) — with both aboard it drives off (truck removed) and builds a **House**,
  a running process. A periodic step in main.ts (`setInterval` 800ms →
  `runHouse`) offers the house's box to its team front-to-back; the first
  matching robot runs, so the house keeps reacting (e.g. to a bird feeding a nest
  in its box). **City postponed** — the house is shown in place on the floor
  (drawn house + its box + the lead robot peeking; `house-view.ts`). ▢ later: the
  city with houses on lots + helicopter navigation; truck extras (house picture,
  address, notebook module). NOTE: the 800ms interval + animations make the
  preview screenshot tool time out — verify trucks/houses via tests or a real
  browser, not screenshots.

## Element behavior digest (from the manual) — incl. divergences to fix

Read 2026-06 from the per-element pages above. ✅ = matches our impl, ⚠ =
divergence/simplification in our current code, ▢ = not yet implemented.

- **Pad editing** (`pad.cpp`): ✅ select a pad (hover it / hold it) and **type to
  edit** — numbers: digits append (sign preserved), Backspace drops a digit;
  text: characters append, Backspace deletes. Handled in `drag-controller`
  `onKeyDown` → `editNumber`/`editText` against the hovered/held thing.
  (`window.__ttWorld` exposes the world for debugging, like `__ttApp`.)
  ▢ no insertion-point/cursor editing or decimal/fraction typing yet.
- **Numbers** (`newnum.htm`): ✅ **op set by a keypress while holding the pad**,
  default `+` — `+` add, `x`/`*` multiply, `/` divide, `%` remainder, `^` power,
  `=` replace; `-` **negates** the pad (the manual has no binary minus —
  subtraction is negate-then-add). ✅ dropping a number on a **blank** text pad
  converts it to its digits as text. ✅ exact BigInt rationals (division → exact
  fractions; integer powers exact, non-integer powers approximated). Keyboard
  handling lives in `input/drag-controller.ts`.
- **Text** (`text.htm`): ✅ drop side decides order (left=prepend, right=append).
  ▢ a **blank pad acts as a wildcard** in robot conditions (like erased); ▢
  dropping a number on a blank pad converts it to text; ▢ editing.
- **Boxes** (`box.htm`): ✅ holes fill / combine-in-place. ✅ **join** — drop a box
  on another box's *edge* (not over a hole) → holes merge, side decides order
  (`Box.join`); dropping *over a hole* still nests/fills. ▢ **split** (drop box on
  a number N → splits into N and remainder), ▢ text on an (erased/empty) box
  explodes into one hole per character, ▢ set hole count by typing a digit.
  Robots ignore hole labels — only hole count + contents matter (we have no
  labels, fine).
- **Birds & nests** (`bird.cpp`): ✅ a nest is a **FIFO queue** — birds deliver to
  the back (`receive`), things are read from the **front** (`front`/`takeFront`,
  oldest first), and the nest displays the front item. ✅ a delivered thing
  **fully covers** the nest (`renderThingDisplay(..., { scaleUp: true })`).
  ✅ resting bird is **MORP01** (standing); FLY* frames are flight only.
  ✅ **a bird feeds multiple nests** (`Bird.nests`): **copying a nest** (wand)
  adds the copy to its bird's nests, so giving to the bird delivers a copy to
  **every** nest — keeping copied channels in sync (the manual's "deliver to
  both"). ✅ **combine** — drop a nest on a nest: deliveries merge into the target
  and any feeding bird is re-pointed to it (one channel). ✅ **hatch** —
  `hatchFromNest`: pressing an empty nest with no bird gives a fresh bird that
  feeds it (an egg hatching), wired into the drag controller's `tryExtract`.
  ▢ a nest saved without its bird reloads as a fresh egg → new bird. Birds/nests
  are ToonTalk's inter-process channel (a robot waits for a bird to fill a nest).
- **Robots** (`robot.htm`): ✅ train by example; condition = box shape; erasing
  generalizes; thought bubble shows the condition. ✅ **finish key**: Escape
  finishes training (matches the manual; Backspace cancels as a web-only helper
  since the manual has no cancel gesture). ✅ **teams** (robot.cpp `next_robot`):
  drop robot on robot → the dragged robot (+ its team) lines up behind the
  target (`Robot.team`); a box is offered front-to-back via `runRobot` →
  `lineup()`, first trained matching robot runs, else nothing (waits).
  Teammates aren't world things; the view stacks them behind the lead. ▢ negation via a team + marker. ▢ recursion
  via the wand's 'S' mode copying the robot+team.
- **Scale** (`scale.htm`): ✅ a `Scale` (model/scale.ts) sits in a box hole and
  weighs its two neighbours: tilts `left`/`right` toward the bigger number or
  later-alphabetical text, `balanced` when equal, `tottering` when a neighbour is
  missing (matches nothing). An **erased** neighbour keeps the previous tilt (so
  erasing operands generalises). Tilt is a robot guard (`Scale.equals` compares
  tilt) → real `<`, `>`, `=` conditions. `recomputeScales(box)` is called at every
  box-mutation point (interactions/extraction/robot actions/trainer/load/seed)
  and before robot matching. View tips the sprite by tilt. ✅ the classic "swap if
  first<second" demo runs (a scale-guarded robot with a `swap` action; seeded).
- **Dusty / vacuum** ✅ (`dusty.ts`): now has the **three modes** (cycle with the
  nose button — hover/hold Dusty and press **E/S/R** or **space**): **erase**
  (toggle erased / generalize a robot — default), **suck** (vacuum a thing or a
  box hole's contents into its `stomach`), **reverse** (spit the last sucked
  thing back out, into an empty hole or beside Dusty). `DustyView` shows the mode
  badge + stomach count. We default to **erase** (our wildcard workflow leans on
  it) though the original's default is suck. Original-manual note below:
- **Dusty / vacuum** (`dusty.htm`): the real Dusty has **three modes via the nose
  button — Suck (remove, stored in its stomach), Reverse (spit back out), Erase**.
  We model only Erase, as a *toggle*; authentic erase is a mode and restore is
  via Dusty-reverse or the wand's 'O' mode, not a toggle. Note **Suck (remove,
  restorable) is distinct from the Bomb (destroy, permanent)**.
- **Wand** ✅ (`wand.ts`): copies via the **tip**, not consumed, with **three
  modes** (hover/hold + press C/O/S or space; `WandView` shows the badge): **C**
  copy + restore (un-erased — default); **O** "original" copies preserving the
  erased/wildcard state (per `picture.cpp`: original mode doesn't restore); **S**
  copy-self copies a robot *with its team* (C/O copy just the lead). Mode persists.
- **Notebook** ✅ (`notebook.ts`/`notebook-view.ts`): a page store. Drop a thing
  on it → filed as a new page (turned to it); drop a **number** → flips to that
  1-based page; **drag the page off → a copy** comes out (the notebook keeps its
  own). Pages + current index persist. ▢ not yet: the **main** notebook as the
  real save model, modules-in-trucks, page-turn arrows/animation, number-format
  pages. (Older manual note below.)
- **Notebook** (`notebook.htm`): ▢ original: pages indexed by number;
  number→page, text→matching page. The **main notebook persists across
  sessions** (this is the real save/load model); secondary notebooks are
  transient unless dropped on a main-notebook page. Used as a **module** when
  given to a truck. Dropping a notebook on an erased box → a box with one hole
  holding every page.
- **Pumpy** (`pumpy.htm`): ▢ not implemented (art staged as `pumpy.png`). A
  resize tool — modes big/wide/narrow/little/short/tall/good-size. Cosmetic;
  not consumed.

## Room reconstruction (the desktop shell)

ToonTalk has **3 house types, each with a different floor colour** (tan `FLOORC`,
blue `FLOORB`, green `FLOORD` — all 640×480 baseplates in M25). We render the tan
floor; per-house floor colour is a later concern. The hand cursor has **context poses** (`HAND_POSES` in room.ts), driven by the
drag controller's `onGrab(thing)` callback (not Room's own press handler):
`open` (HAND01, point — **hotspot at the leftmost fingertip, 0.24w/0.17h**),
`grab` (HAND04, while carrying a thing), and `holdwand` (USEWAND1, while carrying
the **wand** — the floor wand is alpha-hidden since it's "in" the cursor). Each
pose has its own wrist calibration (`cx`/`w`/`top`/anchor/scale) so the coral
sleeve (`#bb5d64`) continues the stub. ⚠ `holdwand` is a wide sprite with
estimated anchors — **may need visual tuning**. Hand frames HAND01–07 run
open→closed.


`src/view/room.ts` (`Room`) reconstructs the original ToonTalk room as
presentation-only chrome over the model: a tiled **tan floor** (`FLOORC`), the
open **toolbox** top-right (a drawn tray with the tool icons), an open
**notebook** bottom (`NBPAGE1`, "claude 1"), the **wand** (mode `C`) and
**vacuum** (mode `S`) on the left, and the giant **hand cursor on a red arm**
that follows the pointer (the OS cursor is hidden via `cursorStyles`). Room art
is in `public/assets/room/` (`floor/toolbox/notebook/hand/wandbar/truck.png`),
converted from M25 (toolbox+wand came from **M22** — missing from M25).
The toolbox is a *drawn* charcoal 3D lego tray (2×4 recessed slots + a studded
open lid) — the real `TBOPEN5` bitmap is teal and only 2×3, so it doesn't match
the video; the engine draws the grid dynamically. **Toolbox = infinite stacks: pressing an icon calls `onPick(key, x, y)` →
`spawnTool` which adds a fresh element AT the cursor; the same (bubbled)
pointerdown reaches the drag controller, which picks it up — so the element
drags out of the box while the toolbox keeps its copy.** Reference: a screen-capture video is at `C:\Users\toont\dev\*.mp4`;
extract frames with the ffmpeg at
`C:\Program Files\CEWE Creator\CEWE Creator\ffmpeg.exe` (PNG encoder disabled —
output `.jpg`; crop frames with PIL for close study). ▢ The seeded *world* still
has the busy feature-demo on the floor; the video's room was nearly empty.

## Selection wiggle

The thing under the hand (or being held) wiggles as selection feedback —
`tickWiggle` in drag-controller.ts, on the PIXI ticker. Faithful to the original
(`sprite.cpp` `selection_delta_x/y`): a **2px circular offset** stepping right →
down → left → up every 100ms (400ms loop). The previous selection is settled via
`syncPosition`. The hit-test runs on pointer-move (not per frame). The wiggle
targets the **specific node** under the hand — a number inside a box hole, or an
item on a nest, wiggles on its own (BoxView.holeNode / NestView.item), not the
whole container.

## Frame-based sprite animation

`view/animation.ts`: loads cycle frames (converted from M25 to
`public/assets/anim/<name>/NN.png`, timings from `tts-manifest.json`) and builds
PIXI `AnimatedSprite`s on the shared ticker. `makeIdleSprite(name)` plays the
cycle then rests on frame 0 for ~2.6s before fidgeting again (periodic idle, more
faithful than a constant loop). Wired: **robot** uses `robot-wait` (ROBOT.TTS
cycle 13, 12 frames @200ms). Add an element by converting its frames + adding a
spec to `ANIMATIONS`. **Frames are baked pre-aligned** to a uniform canvas using
each frame's registration offset (`-ox,-oy` from the manifest) so the element
doesn't shift/scale during the cycle — the spec stores the resulting `anchor`.
`playOnce(name, parent, x, y)` plays a cycle once and self-removes — used for
one-shot effects: **bomb explosion** (`explode`, EXPLODE.TTS) on a detonation,
and **Dusty suck** (`dusty-suck`, SUCK0–7) on an erase, both fired from main's
drop resolver by `DropResult`. ▢ Remaining: bird flight on delivery, nest hatch.

**Tooling note:** the preview screenshot tool can become unresponsive (30s
timeouts) during long sessions even when the app is healthy (eval still works).
`window.__ttApp` exposes the PIXI app — `__ttApp.ticker.stop()` freezes the
render loop for a still capture if needed.

## Status

Phases 0–3 done. Phase 4 tools: **Dusty (erase/wildcard) ✅**, **bomb ✅**.
Next up: **trucks** (spawn running processes / houses), then polish (bird flight,
robot-run animation). Keep the README's top changelog updated per feature.
