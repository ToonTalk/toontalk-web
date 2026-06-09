# The room shell & the outdoor city

## The outdoor city ✅ (fly / land / walk)

ToonTalk's world isn't just one room: you fly a **helicopter** over a
**city** of houses, **land** on a street, get out, and **walk around**.
Faithful to the original outdoor "programmer" state machine
(`source/prgrmmr.cpp` `Programmer_City_Flying` / `_Landing` / `_Walking`) and
city ground (`city.cpp`).

- **`src/city/city-model.ts`** — pure, no rendering. 12×12 block grid,
  checkerboard houses + scattered trees (deterministic). `Direction` 0..7 in
  the enum order **E,SE,S,SW,W,NW,N,NE** (= sprite cycle index). `scale` is
  flying altitude/zoom (1 = ground, higher = higher up): `nextScale` takes
  0.75 s to double/halve (source), clamped `[MIN_FLYING_SCALE 1.25, MAX 16]`;
  descend to the minimum → land. `CityModel.fly/land/walk/callHelicopter` are
  the four transitions; `LIFTOFF_SCALE` (3) is the altitude on takeoff so
  returning to flying doesn't instantly re-land.
- **`src/city/city-sprites.ts`** — loads the baked frame sets + a
  `DirectionalSprite` (8 headings; animates only while moving).
- **`src/city/city-scene.ts`** — renders the model in three looks: **flying**
  (top-down green city — street grid + house tops + trees — scrolls under a
  centred helicopter; pointer offset pans, faster the higher you are;
  Up/right-button climb, Down/left-button descend), **landing** (side
  elevation, copter sinks to a street; Down lands → walking with the empty
  copter left behind, Up flies again), **walking** (top-down at ground level;
  lego person walks where you point; **H** calls the helicopter back). Avatar
  stays screen-centred; the world scrolls under it.
- **Integration**: `main.ts` boots into the city. **Backquote (`` ` ``)** is
  a dev seam to flip city ⇄ room (`Room.setVisible` +
  `DragController.setEnabled` gate the room/World while the city is on top).
  `window.__ttCity` exposes the scene for debugging.
- ▢ **Out of scope (next):** walking up to a house and **entering it**
  (switch into the room/`World` floor view) + recalling the copter from
  inside; a toolbox following the walker; trucks driving the city; authentic
  `.tt` city save/load; helicopter/step audio.
- Verify the city with the verify-app skill (`tools/verify/snap.mjs --scene
  city --frames 30 …`) or `--eval` snippets against `__ttCity` — the harness
  pumps the PIXI ticker manually, so the paused-backgrounded-tab problem
  doesn't apply.

## Room reconstruction (the desktop shell)

ToonTalk has **3 house types, each with a different floor colour** (tan
`FLOORC`, blue `FLOORB`, green `FLOORD` — all 640×480 baseplates in M25). We
render the tan floor; per-house floor colour is a later concern.

The hand cursor has **context poses** (`HAND_POSES` in room.ts), driven by
the drag controller's `onGrab(thing)` callback (not Room's own press
handler): `open` (HAND01, point — **hotspot at the leftmost fingertip,
0.24w/0.17h**), `grab` (HAND04, while carrying a thing), and `holdwand`
(USEWAND1, while carrying the **wand** — the floor wand is alpha-hidden since
it's "in" the cursor). Each pose has its own wrist calibration
(`cx`/`w`/`top`/anchor/scale) so the coral sleeve (`#bb5d64`) continues the
stub. ⚠ `holdwand` is a wide sprite with estimated anchors — **may need
visual tuning**. Hand frames HAND01–07 run open→closed.

`src/view/room.ts` (`Room`) reconstructs the original ToonTalk room as
presentation-only chrome over the model: a tiled **tan floor** (`FLOORC`),
the open **toolbox** top-right (a drawn tray with the tool icons), an open
**notebook** bottom (`NBPAGE1`, "claude 1"), the **wand** (mode `C`) and
**vacuum** (mode `S`) on the left, and the giant **hand cursor on a red arm**
that follows the pointer (the OS cursor is hidden via `cursorStyles`).

The toolbox is a *drawn* charcoal 3D lego tray (2×4 recessed slots + a
studded open lid) — the real `TBOPEN5` bitmap is teal and only 2×3, so it
doesn't match the video; the engine draws the grid dynamically. **Toolbox =
infinite stacks: pressing an icon calls `onPick(key, x, y)` → `spawnTool`
which adds a fresh element AT the cursor; the same (bubbled) pointerdown
reaches the drag controller, which picks it up — so the element drags out of
the box while the toolbox keeps its copy.**

▢ The seeded *world* still has the busy feature-demo on the floor; the
video's room was nearly empty.

## Selection wiggle

The thing under the hand (or being held) wiggles as selection feedback —
`tickWiggle` in drag-controller.ts, on the PIXI ticker. Faithful to the
original (`sprite.cpp` `selection_delta_x/y`): a **2px circular offset**
stepping right → down → left → up every 100ms (400ms loop). The previous
selection is settled via `syncPosition`. The hit-test runs on pointer-move
(not per frame). The wiggle targets the **specific node** under the hand — a
number inside a box hole, or an item on a nest, wiggles on its own
(BoxView.holeNode / NestView.item), not the whole container.
