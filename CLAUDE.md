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
  in its box). The house is also shown in place on the floor (drawn house + its
  box + the lead robot peeking; `house-view.ts`). ▢ later: truck extras (house
  picture, address, notebook module). NOTE: the 800ms interval + animations make
  the preview screenshot tool time out — verify trucks/houses via tests or a real
  browser, not screenshots.

## The outdoor city ✅ (fly / land / walk)
ToonTalk's world isn't just one room: you fly a **helicopter** over a **city** of
houses, **land** on a street, get out, and **walk around**. Faithful to the
original outdoor "programmer" state machine (`source/prgrmmr.cpp`
`Programmer_City_Flying` / `_Landing` / `_Walking`) and city ground (`city.cpp`).
- **`src/city/city-model.ts`** — pure, no rendering. 12×12 block grid,
  checkerboard houses + scattered trees (deterministic). `Direction` 0..7 in the
  enum order **E,SE,S,SW,W,NW,N,NE** (= sprite cycle index). `scale` is flying
  altitude/zoom (1 = ground, higher = higher up): `nextScale` takes 0.75 s to
  double/halve (source), clamped `[MIN_FLYING_SCALE 1.25, MAX 16]`; descend to
  the minimum → land. `CityModel.fly/land/walk/callHelicopter` are the four
  transitions; `LIFTOFF_SCALE` (3) is the altitude on takeoff so returning to
  flying doesn't instantly re-land.
- **`src/city/city-sprites.ts`** — loads the baked frame sets + a
  `DirectionalSprite` (8 headings; animates only while moving).
- **`src/city/city-scene.ts`** — renders the model in three looks: **flying**
  (top-down green city — street grid + house tops + trees — scrolls under a
  centred helicopter; pointer offset pans, faster the higher you are; Up/right-
  button climb, Down/left-button descend), **landing** (side elevation, copter
  sinks to a street; Down lands → walking with the empty copter left behind, Up
  flies again), **walking** (top-down at ground level; lego person walks where
  you point; **H** calls the helicopter back). Avatar stays screen-centred; the
  world scrolls under it.
- **Art**: `tools/bake-city.py` bakes `HELIOFLY`/`HELIOLND`/`MANWALK8` .TTS into
  `public/assets/city/{heli-fly,heli-land,person}/<dir>/NN.png` + `house-*/tree`,
  black-keyed and aligned via each frame's (ox,oy); M22 frames upscaled 2× to the
  M25 space (`city-sprites.json` carries sizes/anchors/frame counts).
- **Integration**: `main.ts` boots into the city. **Backquote (`` ` ``)** is a
  dev seam to flip city ⇄ room (`Room.setVisible` + `DragController.setEnabled`
  gate the room/World while the city is on top). `window.__ttCity` exposes the
  scene for debugging.
- ▢ **Out of scope (next):** walking up to a house and **entering it** (switch
  into the room/`World` floor view) + recalling the copter from inside; a toolbox
  following the walker; trucks driving the city; authentic `.tt` city save/load;
  helicopter/step audio.
- NOTE: verify via `__ttCity` + manual `tick()` calls in `preview_eval` — the
  preview tab is backgrounded so `requestAnimationFrame` (and the PIXI ticker) is
  paused; screenshots time out. The logic is correct; a real visible tab animates.

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
- **Dusty / vacuum** ✅ (`dusty.ts`): **held tool** (see *Tools are held* below).
  Has the **three modes** (set with the nose button — **E/S/R** keys; **Tab**
  cycles): **erase** (toggle erased / generalize a robot — default), **suck**
  (vacuum a thing or a box hole's contents into its `stomach`), **reverse** (spit
  the last sucked thing back out, into an empty hole or beside Dusty). `DustyView`
  shows the mode badge + stomach count. We default to **erase** (our wildcard
  workflow leans on it) though the original's default is suck. Manual note below:
- **Dusty / vacuum** (`dusty.htm`): the real Dusty has **three modes via the nose
  button — Suck (remove, stored in its stomach), Reverse (spit back out), Erase**.
  We model only Erase, as a *toggle*; authentic erase is a mode and restore is
  via Dusty-reverse or the wand's 'O' mode, not a toggle. Note **Suck (remove,
  restorable) is distinct from the Bomb (destroy, permanent)**.
- **Wand** ✅ (`wand.ts`): **held tool** (see *Tools are held* below); copies via
  the **tip**, not consumed, with **three modes** (press C/O/S to set, Tab
  cycles; `WandView` shows the badge): **C**
  copy + restore (un-erased — default); **O** "original" copies preserving the
  erased/wildcard state (per `picture.cpp`: original mode doesn't restore); **S**
  copy-self copies a robot *with its team* (C/O copy just the lead). Mode persists.
- **Notebook** ✅ (`notebook.ts`/`notebook-view.ts`): a page store + the **real
  save model**. Drop a thing → filed as a new page; drop a **number** → flip to
  that 1-based page; drop a **text** → flip to the first page whose text *starts
  with* it ("ma"→"mat"), else file; **drag a page off → a copy**; **only Dusty
  removes** the current page. Page-turn arrow cues; ←/→ (and Backspace→last) turn
  pages while pointing at it.
  **Main notebook = persistence (strictly faithful):** `Notebook.isMain` marks the
  one toolbox notebook that survives between sessions (`notebook-store.ts` ↔
  `localStorage`, via `thingToJson`/`thingFromJson`); the **floor is transient**,
  reseeded each load. Saving = filing onto the main notebook (saved on its change,
  identity-checked so sensor ticks don't thrash it). Secondary notebooks are
  transient unless filed onto a main page. (`★` marks the main notebook.)
  **Modules:** a notebook dropped on a **truck** → `Truck.module`, carried into
  `House.module` (persisted). Robot action `fromModule {page,to}` copies a module
  page into an empty hole (threaded via `applyAction(ctx)`/`runHouse`) — the
  runtime module-use / **recursion primitive**; demo house counts up by pulling a
  copy of its module's page each tick.
  ▢ not yet: training-by-example of `fromModule`; full self-replicating-house
  recursion + result-return via birds/nests; per-user named notebooks; the
  picture/sound/options sub-notebooks (media deferred); dropping a notebook on an
  erased box → a box with one hole per page; page-turn animation.
- **Pumpy** ✅ (`pumpy.ts`): the resize **held tool** (see *Tools are held*
  below). `Thing` has `scaleX`/`scaleY` (applied by ThingView, persisted, omitted
  from snapshots when 1); applying Pumpy to the thing under its hose tip resizes
  it by its mode (bigger/smaller/wider/narrower/taller/shorter/good; clamp
  0.4–3×). Mode keys: `+`/`b` bigger · `-` smaller · `w` wider · `n` narrower ·
  `t` taller · `s` shorter · `g` good (revert); **Tab** cycles. `PumpyView` shows
  a badge and scales the 800×600 art down to tool size.
  ▢ in-hole things ignore Pumpy size (the cubby fit-scale dominates); copies and
  box-fit don't carry Pumpy size.

### Tools are held, not dropped
Pumpy, Dusty and the wand are **not** drag-and-drop. You pick a tool up (it rides
the cursor with its tip/hose at the pointer, offset up-and-right), move the tip
over a thing, then **click or press space** to apply the tool's *current default*
to that thing — the tool **stays in hand**. A click/space over empty floor
**puts the tool down**. Mode keys (above) change the current default while held.
Implemented in `drag-controller.ts`: `heldTool` field, `onPointerDown` picks a
tool into hand (vs. normal drag for everything else), `applyHeldTool` runs the
normal `resolveDrop` rules against the thing under the tip, `onKeyDown` routes
space→apply and letters→`setToolMode`. This matches the original (`pumpy.htm`
etc.): "move the end of the hose over the thing, then click/space".

## Sensors ✅ (live pads)
Sensors are pads that report **live system state** (the original ships a notebook
full of them; `source/.../doc/sensor.htm`, `sensors.rc`). The manual says a sensor
"works much like a control for a picture" and *is* a number or text/yes-no pad
whose value refreshes every frame — so we model it exactly that way and reuse the
whole interaction engine with zero special cases.
- **`src/model/sensor.ts`** — `NumberSensor extends NumberThing` and
  `TextSensor extends TextThing` (same `kind`, so robots match them, numbers
  combine with them, they sit on scales). Each adds `sensorType` + `update(input)`
  / `copy()` / `snapshot()`. `SENSORS` catalog + `makeSensor(type)` factory.
  Implemented (non-media): `mouse-vx`/`mouse-vy` (velocity, 1000 = screen/sec),
  `ms-per-frame` (clock/timer), `random` (0–1000), `address-road`/`-street`
  (from the city block), `click-left|middle|right` (momentary), `down-…` (held),
  `key-just` (momentary) / `key-last` (held), `shift-down`, `ctrl-down`,
  `hand-visible`.
- **`src/input/input-state.ts`** — `InputState` + `InputTracker`: mouse/keyboard
  listeners; `sample(dt)` builds a per-frame snapshot (velocity from accumulated
  pointer movement; momentary click/key **edges** true for one sample) then clears
  the edges. Pluggable `handVisible` + `address` providers.
- **`src/model/sensor-runtime.ts`** — `updateSensors(world, input)` each frame
  (on the render ticker in `main.ts`), notifying the view only on change.
- **Views**: number/text pads draw a sensor tag (antenna + label;
  `src/view/sensor-tag.ts`). **Persistence**: sensors round-trip via `sensorType`
  on the number/text snapshot. Seeded: a 17-page **sensor notebook** + two loose
  sensors in the demo room.
- ▢ **Media sensors deferred** (with the rest of media): file→picture/sound, MCI,
  text→speech, wall/house/roof decorations, clipboard. ▢ joystick; the sensor
  "remote control" state-cycling UI. ▢ NOTE: verify with `__ttInput.sample()` +
  manual `sensor.update()` — the preview tab is backgrounded so the ticker is
  paused (real visible tab updates sensors every frame).

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
