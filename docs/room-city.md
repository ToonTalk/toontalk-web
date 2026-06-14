# The room shell & the outdoor city

## The outdoor city ✅ (fly / land / walk)

ToonTalk's world isn't just one room: you fly a **helicopter** over a
**city**, **land** on a street, step out, and **walk around** with Tooly.
Faithful to the original outdoor "programmer" state machine
(`source/prgrmmr.cpp` `Programmer_City_Flying` / `_Landing` / `_Walking`) and
the city itself (`city.cpp`):

- **The city is rectangular**: the default is **3×3 blocks** ("small enough
  that it's hard to get lost exploring", city.cpp:91), each block 4:3
  (`BLOCK_W 800 × BLOCK_H 600` units). `build_initial_houses` builds exactly
  **THREE houses** on consecutive lots of the **centre block**, styles
  cycling **A, B, C** (city.cpp:178-216) — ours match, plus a few trees.
- **`src/city/city-model.ts`** — pure, no rendering. `Direction` 0..7 in the
  enum order **E,SE,S,SW,W,NW,N,NE** (= sprite cycle index). `scale` is
  flying altitude/zoom (1 = ground): `nextScale` takes 0.75 s to double/halve
  (source), clamped `[MIN 1.25, MAX 4]`, `START 2.5`, `LIFTOFF 2` (so
  returning to flying doesn't instantly re-land). Descend to the minimum →
  the view switches to the **horizontal street view**: `streetY` snaps to the
  nearest street, `landX` records where the copter comes down; touching the
  street parks it and the person **steps out beside the door** (`cx = landX +
  70`; cf. `Programmer_City_Landing::true_center` ≈ the door).
- **`src/city/city-scene.ts`** — two looks. **Flying**: top-down rectangular
  city scrolls under a centred 8-dir copter. **Street view (landing +
  walking)**: a **green Lego (lawn-brush) backdrop** over the street brush
  (the original front view clears with the lawn brush — *no blue sky*), the
  street's houses in their **side-view art** (HSA18 / HSB20 / HSC20); the
  copter (side art, animated rotors) is **big** (`HELI_LAND_W` ≈ 560 px),
  sinks to the street, swaps to the **parked art** (HELIHLM7) on touchdown and
  stays at `landX`. The lego person then **walks the street in both axes**
  (`model.walk(dx, dy)` — fully 8-directional, depth clamped to `[streetY −
  WALK_BAND_N, streetY + WALK_BAND_S]`), with **camera-follow within a band**
  (`streetCamCx`: the walker moves on screen before the world scrolls, per
  prgrmmr.cpp min_x/max_x) and **Tooly the toolbox following** (TOOLBOXS, 8-dir
  animated). Walking:
  - **up to a house door** (`enterableHouse`) → `enterHouse()` steps you INTO
    the **room standing view** (mode `'inside'`, below) — *not* straight to the
    floor;
  - **'s'** → sits on the grass → the room/World floor (`onEnter('grass')`);
  - **into the parked copter** (`boardHelicopter`) → auto take-off (the scene
    holds the climb until airborne, `takingOff`);
  - **H** → calls the helicopter back; **Esc** → the street menu.
  Trees are a web extra — **off by default** (`CityModel({trees})`).
- **Room standing view** (`mode 'inside'`, `renderInterior`) — the missing
  middle step, faithful to **`source/room.cpp` + `Programmer_Room_Walking`** and
  matched against `docs/ref/original-room.jpg`: after entering a house you
  **stand in the room** before sitting at the floor. Rendered as a **perspective
  brick box**: a white lego-brick back wall (`WALL.BMP`) + two receding
  side-wall `SimpleMesh` quads, a **blue lego floor** as a perspective trapezoid
  (`SimpleMesh`, studs larger at the front) by house style (`floor-{a,b,c}` =
  FLOORC/B/D; `create_floor` maps style→FLOOR background), and the **red door on
  the LEFT** (`ROOMDOOR`). You walk the room
  in normalised coords (`ix`/`iy`, slight depth perspective); `walkInside`
  returns **`'leave'`** at a side wall (→ back to the street at the house,
  `leaveRoom`) or **`'sit'`** at the front of the floor (→ `onEnter` → the
  working floor / World). `'s'` also sits; **Esc** steps back out. Standing up
  from the floor (`resume`) returns here, not straight to the street — matching
  `at_floor → stand up → room_walking`. Note: our existing `src/view/room.ts`
  is the *floor working* chrome (`Programmer_At_Floor` + `Floor`) — a different
  view from this room.
- **Input is the original's RELATIVE_MOUSE_MODE** (the default,
  globals.cpp:729): click the city to capture the mouse (Pointer Lock, cursor
  hidden, like `show_cursor(FALSE)`); raw mouse **movement** then steers
  directly, clamped per frame to the state's max speed (`dampen_big_deltas`):
  flying 2 screen-widths/s, landing 3, walking 1 (the prgrmmr.cpp ctors).
  Flying: mouse pans (deltas scale with altitude — `delta*scale/ground`);
  left button / ↓ descends, right button / Shift / ↑ climbs. Landing: mouse x
  drifts along the street, mouse y flies the copter up/down directly
  (prgrmmr.cpp:4338 `y += delta_y`). Walking: mouse x walks. **Arrow keys are
  the keyboard alternative** (winmain.cpp `read_arrow_keys`): held keys
  produce the same deltas, **accelerating with hold duration**; while flying,
  keyboard ↑/↓ mean climb/descend (prgrmmr.cpp:4012
  `tt_delta_x_and_delta_y_due_solely_to_arrow_keys`).
- **The ground is the original's Lego-stud brushes**: BRUSH*.BRH are 64-byte
  8×8 palettized DIB patterns (sprite.cpp reads 64 bytes per brush; palette =
  the shared 8-bit BMP palette), baked to `brush-{lawn,street,water}{1,2,4}` +
  `-side` PNGs by bake-city.py. Drawn as **screen-space TilingSprites** with
  the pattern anchored to the world (`set_brush_origin`) so studs stay a
  constant screen size while the world scrolls; the **brush tier switches
  with altitude** exactly as `street_brush_id`/`lawn_brush_id` (scale < 3 →
  tier 1, else tier 2; the street view uses tier 4, matching the
  CAMERA_IN_FRONT branch). Water fills beyond the city edge (city.cpp).
- **`src/city/city-sprites.ts`** — baked frame sets + `DirectionalSprite`
  (8 headings; animates only while moving). Bake adds: `tooly/<dir>/NN.png`,
  `house-{a,b,c}-side.png`, `heli-parked.png` (tools/bake-city.py).
- **Integration & sitting**: `main.ts` boots into the city. **Entering a house
  or sitting on the grass drops you onto the working floor (the room/World
  view)** — `onEnter` → `enterRoom()`; the dev **backquote (`` ` ``)** flips
  city ⇄ room directly. **Escape** raises a small modal menu (`showMenu`):
  in the street *Take off / Save / Keep exploring*, sitting *Stand up & leave
  / Save / Keep working*. *Stand up* → `city.resume()` (`standUp()` puts the
  walker back on the street centreline so they don't instantly re-enter the
  door). `window.__ttCity` exposes the scene for debugging.
- ▢ **Out of scope (next):** **per-house contents** (every house + the grass
  currently share the one World floor — the *transition* works, distinct
  contents don't yet); building new houses from trucks in the city; authentic
  `.tt` city save/load; helicopter/step audio; door-open animation; whether
  Save in the menu is needed at all (the main notebook already autosaves).
- Verify the city with the verify-app skill (`tools/verify/snap.mjs --scene
  city --frames 30 …`) or `--eval` snippets against `__ttCity` — the harness
  pumps the PIXI ticker manually, so the paused-backgrounded-tab problem
  doesn't apply. Use `--pre` to set up held input first, e.g. a file with
  `window.__ttCity.keys.add('ArrowDown')` then `--frames 24` lands mid-descent
  and `--frames 48` captures the walked-out scene (Tooly + parked copter).

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
