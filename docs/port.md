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
1. **Flying** — `screen.cpp` ✅ (camera.ts) · `block/city` constants ⚠ (in
   city-model.ts, to be made literal) · `Programmer_City_Flying::react` ⚠
   (approximated in city-model.ts) · `Sprite` shim ▢.
2. **Landing** — `Programmer_City_Landing::react` ▢.
3. **Walking** — `Programmer_City_Walking::react` ▢.
4. **Rooms** — `room.cpp` + `Programmer_Room_Walking`/`At_Floor` ▢.
5. **Elements** — `cubby/number/text/bird/robot/tools` onto the `Sprite` shim ▢.

Keep the app working after each slice; per-element fidelity detail stays in
`docs/elements.md`.
