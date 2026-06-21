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
  the view switches to the **horizontal street view**: the copter **lands on the
  road** along the south edge of the block (`cy = roadYFor(cy)`, so the houses —
  set back to the north — appear ahead), `landX`/`parkedX,parkedY` record where it
  comes down; touching down parks it and the person **steps out beside it**
  (`cx = landX + STEP_OUT`).
- **`src/city/city-scene.ts`** — two looks. **Flying**: top-down rectangular
  city scrolls under a centred 8-dir copter. **Street view (landing + walking)**
  is a **side-scroller on a ground plane** (`renderStreet` projects world→screen
  via `proj`, following the walker in BOTH axes): a **green Lego (lawn-brush)
  backdrop** (no blue sky), the **E–W roads as horizontal bands** at each block
  boundary (a small pool, depth-placed), the houses in their **side-view art**
  set back to the north and **perspective-scaled** (depth-sorted), and the copter
  (side art, animated rotors) **big** (`HELI_LAND_W` ≈ 0.58·W), sinking to the
  road then swapping to the **parked art** at `parkedX,parkedY`. The lego person
  then **walks the whole city** (`model.walk(dx, dy)` — fully 8-directional,
  roaming `cx∈[0,CITY_W]`, `cy∈[0,CITY_H]` across **every street**; the camera
  follows in x within a band and centres in y) with **Tooly the toolbox
  following** (8-dir animated, trailing behind). Walking:
  - **standing at a house's door** (`enterableHouse`, gated narrowly in BOTH x
    `DOOR_REACH` and y `DOOR_DEPTH` — **only the door**, not the walls) →
    `enterHouse()` steps you INTO the **room standing view** (mode `'inside'`);
  - **a click**, or **'s'**, → sits on the grass → the working floor
    (`onEnter('grass')` → green floor);
  - **walking back into the parked copter** (`nearHelicopter`) → take-off;
  - **H** → calls the helicopter back; **Esc** → the street menu.
  Trees are a web extra — **off by default** (`CityModel({trees})`).
- **Avatar head choice** (the original `starttt.exe` "choice of heads") — pick
  **plain / purple-hair girl / red-cap boy** from the **⚙ Settings** toolbar
  button (`showSettings` in `main.ts`), not a startup screen. `HAIR.TTS`/`HAT.TTS`
  are a single 64-frame cycle (E,N,NE,S,SE,W,NW,SW) of full replacement heads;
  `bake-city.py` remaps them to the person's enum-order cycles and composites each
  onto the matching walking frame by **detecting the head per frame** (the head
  bobs), producing `person-hair`/`person-hat` sprite sheets. `CityScene.setHead`
  swaps the `person` DirectionalSprite's spec (so it shows walking AND standing);
  the choice is saved to `localStorage['tt-head']` and re-applied on boot.
- **Room standing view** (`mode 'inside'`, `renderInterior`) — the missing
  middle step, faithful to **`source/room.cpp` + `Programmer_Room_Walking`** and
  matched against the `sitting and standing.mp4` reference: after entering a house
  you **stand in the room** before sitting at the floor. As in `room.cpp:114`
  (`display_region` blits `ROOM_A/B/C_BACKGROUND`), it is **one cohesive
  perspective picture per house style** — `room-{a,b,c}.png` (baked from
  `ROOMA/B/C.BMP`: white brick walls + a receding lego floor — yellow/blue/cream —
  + the red door on the left), stretched to fill. *(This replaced the earlier
  drawn brick box — back/side-wall `SimpleMesh` quads + a floor trapezoid — which
  read as a "collage of perspectives".)* The avatar stands on it facing **NORTH**
  (back to camera, `Direction` enum 6), ~0.52 H tall and depth-scaled; Tooly does
  **not** appear inside (it trails only in the street). You walk the room
  in normalised coords (`ix`/`iy`, slight depth perspective); `walkInside`
  returns **`'leave'`** at a side wall (→ back to the street just south of the
  house door, `leaveRoom`) or **`'sit'`** at the front of the floor (→ `onEnter`
  → the working floor / World). **A click** also sits; `'s'` also sits; **Esc**
  steps back out. Note: our existing `src/view/room.ts` is the *floor working*
  chrome (`Programmer_At_Floor` + `Floor`) — a different view from this room. The
  working floor matches the original (`ToonTalk - claude 1` capture): a **tan
  lego baseplate**, the **open lego toolbox top-right** whose 2×4 grid spawns
  fresh elements in the source order (constant.h:1049 / tools.cpp:4024:
  **number, text / box, nest / scale, robot / truck, bomb**), the **`claude 1`
  notebook**, and the **three real hand tools** (wand, Dusty, Pumpy) seeded in
  the World (`seedFloor`) — *not* chrome, so no duplicates. Demo content is
  opt-in via `?demo=1`.
- **The working floor is a large, scrollable area** (`view/floor-camera.ts`,
  `FLOOR_W×FLOOR_H`), faithful to `prgrmmr.cpp set_sit_corner`: sitting at a spot
  re-centres the floor there (`enterRoom(style, ix, iy)` → `setFloorCamera`,
  clamped to the walls). The `thingLayer` is panned by `−camera` and the baseplate
  scrolls, so **things you leave stay put in world coords** while the **toolbox
  chrome stays on screen** (it "follows" you). Drag & drop stays correct while
  scrolled: all pointer↔world conversion goes through `worldPt` in the drag
  controller, the `getBounds`-based hit tests (`containsPoint`,
  nest/notebook `pressedOn…`) shift bounds by `floorCamera`, `holeIndexAt` is
  already world, and drop-overlap is screen-consistent.
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
  `house-{a,b,c}-side.png`, `heli-parked.png` (tools/bake-city.py). The parked copter is baked from
  **HELIHLM1** (canopy down, **no pilot**) so it reads as EMPTY once you've
  climbed out and walked off. (HELIOLND cycle 3 HELICOPTER_EMPTY nominally points
  at HLM7, but that BMP still shows the pilot mid-exit, so HLM1 is the faithful
  "empty parked copter".)
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
it's "in" the cursor). A held **Pumpy/Dusty** is **grabbed by its body** with the
`grab` pose (not a finger pointing at it); its business end — Pumpy's hose nozzle,
Dusty's nose tip (`CLAY_TIP_FRAC` on the clay it morphs into, since the Lego art
has no nozzle) — is the **active point** and sits on the cursor, with the rest of
the tool pointing out toward the work. The held clay is drawn **~2.4× its Lego
footprint** so the tool reads as the focus (like the original), and the hand grips
the BODY's far side (`DragController.heldHandOffset` = `1.6·heldVec`, i.e. past the
tool centre toward its far edge) so the hose/nose + body stay clear of the hand
and show. The held clay carries **no mode plate and no stomach count** — those
appear only on the at-rest Lego tool, so the tool in hand reads cleanly. The tip
*is* the active point, so there's **no reticle** on the floor
(the yellow ring is training-only). On empty floor, **space** keeps the tool in hand (use intent) but
a **click** puts it down. Each pose has its own wrist calibration
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
the box while the toolbox keeps its copy.** Each compartment icon (and each
spilled tool chip) **wiggles while the pointer is over it** — the 2px circular
selection wiggle (`Room.wireToolHover`/`tickToolWiggle`) — to show it's ready
to be picked up; it settles when the pointer leaves.

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
