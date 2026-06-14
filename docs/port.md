# Faithful C++ → TypeScript port

The way we close the gap with the original: **port the C++ in
`C:\Users\toont\dev\source` faithfully, one logic slice at a time**, instead of
reconstructing behavior. Approximation drifts; the source is ground truth.

## Method: port the *logic*, shim the *platform*

The logic files transitively `#include` ~33 platform headers (DirectX / Win32 /
GMP), so a whole file can't be translated in isolation. Split every file:

### Platform — reimplement once, never translate
PixiJS + DOM events + our `Rational` **are** this layer. Do not port:

| C++ | our substitute |
|---|---|
| `blit/blitbody/dispdib/genpalet` (palette DIB blitter) | PixiJS draws sprites |
| `dirty/region/quadtree/cache` (dirty-rect + spatial index) | PixiJS scene graph |
| `dsutil/sounds` (DirectSound) | (WebAudio later / stub) |
| `input` (DirectInput) | DOM events → the react() input shape |
| `winmain/main` (Win32 message loop) | the Pixi ticker + `main.ts` |
| `gmp` (bignum) | `src/model/rational.ts` |

### Logic — port faithfully, function-by-function
Same class/method names, constants, and control flow; idiomatic TS; every ported
function carries a `// prgrmmr.cpp:3988`-style cross-ref. Even inside a logic
file, port the rule/geometry/state methods and route `display()`/blit to Pixi.

Files: `constant.h/globals.cpp` (constants), `screen.cpp` (camera), `block.cpp`
`city.cpp` (city geometry), `prgrmmr.cpp` (the Programmer state machine),
`sprite.cpp` (DATA + behavior virtuals only — `react/receive_item/copy/used`,
position/size/priority/relationships; rendering → Pixi), `cubby/number/text/
bird/robot/tools/dragdrop`, `room.cpp/floor.cpp`.

## The shim (replaces the 33 includes)
- **`Screen`** — camera/projection. **Done:** `src/city/camera.ts` is a literal
  port of `screen.cpp` `update_viewing_region`/`screen_x`/`screen_y`/`set_scale`
  (lines 182–189, 1831–1889). NB: `screen.cpp screen_y` is **DIB bottom-up**
  (Windows DIBs store row 0 at the bottom — "min_y → FG max_y", screen.cpp:1864),
  so city +y = NORTH shows at the *top*. We render in Pixi's top-down space, so we
  **flip y** (`sy = h/2 − (y−cy)·pxPerUnit`) — that flip *is* the DIB convention.
- **`Sprite`** — base for every element (city coords `llx/lly`, `width/height`,
  `kind_of`, priority, the `react/receive_item/copy/used` virtuals), backed by a
  Pixi container for `display`. *TODO (next).*
- **globals** — `tt_screen / tt_city / tt_programmer` singletons. *TODO.*
- **input** — DOM → `(key, delta_x, delta_y, button_status)` exactly as the
  `react()` functions expect. (Partly in `city-scene.ts`.)

## Order (by testability) & status
1. **Flying — ✅ done (faithfully sourced).** constants (`src/port/constants.ts`
   ← constant.h/globals.cpp/block.cpp) · Screen (`camera.ts` ← screen.cpp) ·
   geometry (`city-model.ts` ← block.cpp:205 `city_location`, city.cpp:172
   `build_initial_houses`, free-play **10×10** blocks) · `fly()` ← `Programmer_
   City_Flying::react` (prgrmmr.cpp:3988), anchored with line refs.
2. **Landing — analyzed, port next.** `Programmer_City_Landing::react`
   (prgrmmr.cpp:4296): the copter moves in **real y** (`y += delta_y`,
   `delta_y ± button_speed·duration/1000`); **`y>max_y && Δ>0 → FLYING_AGAIN`**,
   **`y<min_y → LEAVE_HELICOPTER`**; horizontal mouse **pans the city** (shift
   `min_x/max_x` + `tt_screen->move_by`) with the copter centred. Our `land()`
   approximates this with a normalised `landY`; reconcile to real-y. (The
   side-view *render* stays Pixi — CAMERA_IN_FRONT is platform.)
3. **Walking** — `Programmer_City_Walking::react` (prgrmmr.cpp:5000) ▢.
4. **Rooms** — `room.cpp` + `Programmer_Room_Walking` (5260) / `At_Floor` ▢.
5. **Elements** — `cubby/number/text/bird/robot/tools` onto the `Sprite` shim ▢.

The **`Sprite` base shim** (city coords / size / priority / `react·receive_item·
copy·used`, Pixi-backed display) is still ▢ and is the prerequisite for porting
elements faithfully (slice 5); landing/walking/rooms mostly need the Programmer
state machine, not the full Sprite base.

Keep the app working after each slice; per-element fidelity detail stays in
`docs/elements.md`.
